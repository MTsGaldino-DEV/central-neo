// Migration 051 (Matheus, 05/11/2026): o 1.62 paga sempre × 1,0 e a glosa por reincidência volta para a lista.
// Fatura 9844 em transação desfeita, sem as conferências à mão.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{v}]=await t`select neo_fat_impressao('9844')->>0 v`;
    if(v<'051')await t.unsafe(fs.readFileSync('supabase/migrations/051_faturamento_162_reincidencia.sql','utf8'));
    if(v<'052')await t.unsafe(fs.readFileSync('supabase/migrations/052_faturamento_reincidencia_guardada.sql','utf8'));
    await t`delete from neo_fat_conferencias_servico where fatura='9844'`;
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`select neo_fat_recalcular('9844')`;

    // 1.62: 61 linhas, sempre × 1,0; quem paga o adicional continua pagando
    const l=await t`select numserv,tipo_turma,multiplicador,horas,us_hora,creditado,devido_cod from neo_fat_calculo where fatura='9844' and codserv='1.62'`;
    assert.equal(l.length,61);
    assert.ok(l.every(x=>Number(x.multiplicador)===1));
    const conf=l.filter(x=>Math.abs(Number(x.creditado)-Number(x.devido_cod))<=0.000003);
    assert.equal(conf.length,56,'as 56 de dupla conferem');
    // as 5 de umpla foram pagas pela hora da dupla (0,1097): ficam em Pagou a mais até o Matheus decidir
    const um=l.filter(x=>x.tipo_turma==='U');
    assert.equal(um.length,5);
    for(const x of um)assert.ok(Math.abs(Number(x.creditado)-Number(x.horas)*0.1097)<=0.000003,x.numserv);
    const [fr]=await t`select count(*)::int n,count(*) filter(where situacao_calculo='A_MAIS' and motivo='FATOR_MAIOR')::int mais,round(sum(diferenca),6) dif
      from neo_fat_servicos_lista where fatura='9844' and numserv in ${t(um.map(x=>x.numserv))}`;
    assert.deepEqual(fr,{n:5,mais:5,dif:'0.098291'});
    const adic=await t`select codigo,homem_hora_adicional a from neo_fat_contrato where remuneracao='HOMEM_HORA' order by codigo`;
    assert.deepEqual(adic.map(x=>[x.codigo,x.a]),[['1.62',false],['1.73',true],['5.63',true],['5.64',true]]);
    const [m564]=await t`select multiplicador from neo_fat_calculo where fatura='9844' and numserv='246042202' and codserv='5.64'`;
    assert.ok(Number(m564.multiplicador)>1||Number(m564.multiplicador)===1,'5.64 segue a tabela');

    // reincidência: 94 serviços; os 78 que conferiam voltam para a lista, os outros não mudam
    const g=await t`select situacao_calculo s,motivo m,count(*)::int n from neo_fat_servicos_lista where fatura='9844' and reincidencia group by 1,2 order by 3 desc`;
    assert.deepEqual(g.map(x=>[x.s,x.m,x.n]),[['A_CONFERIR','GLOSA_REINCIDENCIA',78],['A_MENOS','GLOSA_PARCIAL',11],['A_CONFERIR','GLOSA_SEM_QUANTIDADE',5]]);
    const [z]=await t`select count(*) filter(where diferenca is not null)::int com_dif,count(*) filter(where not (multas=devido))::int glosa_dif from neo_fat_servicos_lista where fatura='9844' and motivo='GLOSA_REINCIDENCIA'`;
    assert.deepEqual(z,{com_dif:0,glosa_dif:0});
    // glosa = contrato sem reincidência continua conferindo
    const [ok]=await t`select count(*)::int n,min(numserv) ex from neo_fat_servicos_lista where fatura='9844' and glosado and situacao_calculo='OK'`;
    assert.deepEqual(ok,{n:1,ex:'246140737'});

    const r=(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'glosas',motivo:'GLOSA_REINCIDENCIA'})},0,100) d`)[0].d;
    assert.equal(r.total,78);
    assert.equal(r.servicos[0].motivo,'GLOSA_REINCIDENCIA');
    const tot=(await t`select neo_fat_atualizar_totais('9844') d`)[0].d;
    assert.equal(tot.glosas_erradas.servicos,125);
    assert.equal(tot.glosas_erradas.parcial.servicos+tot.glosas_erradas.reincidencia.servicos+tot.glosas_erradas.conferir.servicos,125);
    assert.equal(Number(tot.devido).toFixed(6),'929.006639');
    assert.equal(tot.a_menos.servicos,96);assert.equal(tot.a_mais.servicos,30);
  });
  console.log('OK: 1.62 × 1,0 e reincidência de volta na lista.');
}finally{await sql.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
