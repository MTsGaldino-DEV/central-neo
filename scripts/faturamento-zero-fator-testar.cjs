// Migration 041: código 0.06 zera o serviço e sinal "fator 1,2" na Conferência (fatura 9844, transação desfeita).
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{v}]=await t`select neo_fat_impressao_calc('9844')->>0 v`;
    if(v!=='041')await t.unsafe(fs.readFileSync('supabase/migrations/041_faturamento_006_fator12.sql','utf8'));
    const [{tem08}]=await t`select pg_get_viewdef('neo_fat_servicos_lista'::regclass) like '%0.8%' tem08`;
    if(!tem08)await t.unsafe(fs.readFileSync('supabase/migrations/042_faturamento_fator_08.sql','utf8'));
    const [{tem14}]=await t`select pg_get_viewdef('neo_fat_servicos_lista'::regclass) like '%1,44%' tem14`;
    if(!tem14)await t.unsafe(fs.readFileSync('supabase/migrations/043_faturamento_fator_errado.sql','utf8'));
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`select neo_fat_recalcular('9844')`;

    // 0.06: os 17 serviços da 9844 (RC fechados só com 0.06, pagos 0) conferem com devido 0
    const z=await t`select numserv,situacao_calculo,devido from neo_fat_servicos_calc where fatura='9844' and '0.06'=any(codigos)`;
    assert.equal(z.length,17);
    assert.ok(z.every(s=>s.situacao_calculo==='OK'&&Number(s.devido)===0),JSON.stringify(z.filter(s=>s.situacao_calculo!=='OK')));
    const [c]=await t`select fator_csc,fator_cod,validado from neo_fat_contrato where tabela='11' and codigo='0.06'`;
    assert.equal(Number(c.fator_csc),0);assert.equal(Number(c.fator_cod),0);assert.equal(c.validado,true);
    // 0.06 junto com outro código zera o serviço inteiro
    const [ex]=await t`select dados from neo_fat_linhas where fatura='9844' and numserv='246329213'`;
    await t`insert into neo_fat_linhas values('9844','teste-006','246329213','RC06','5.14','TESTE',${t.json({...ex.dados,codserv:'5.14',qtdurbanohn:1,ustotal:0})})`;
    const zz=await t`select codserv,coalesce(devido_csc,devido_cod) d from neo_fat_calculo where fatura='9844' and numserv='246329213'`;
    assert.ok(zz.every(l=>Number(l.d)===0),JSON.stringify(zz));
    await t`delete from neo_fat_linhas where fatura='9844' and id='teste-006'`;

    // fator 1,2
    const f=await t`select fator_12,count(*)::int n from neo_fat_servicos_lista where fatura='9844' and fator_12 is not null group by 1`;
    // 1.62 rural pago sem o 1,4 do COD rural (33), sem o 1,2 (21 do 1.62 + 11 outros) e RC pagos como COD (9)
    assert.deepEqual(Object.fromEntries(f.map(x=>[x.fator_12,x.n])),{'pago ÷ 1,4':33,'pago ÷ 1,2':32,'pago × 1,2':11}); // 044: +246059059 e 246098036 (RC pago como COD)
    const [a]=await t`select fator_12 from neo_fat_servicos_lista where fatura='9844' and numserv='246106093'`;
    assert.equal(a.fator_12,'pago × 1,2');
    const [b]=await t`select fator_12 from neo_fat_servicos_lista where fatura='9844' and numserv='245643698'`;
    assert.equal(b.fator_12,'pago ÷ 1,2');
    const listar=async x=>(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',...x})},0,50) d`)[0].d;
    assert.equal((await listar({lado:'todos',fator_12:'sim'})).total,76);
    // listas por lado escondem os já conferidos à mão
    const [nc]=await t`select count(*) filter(where fator_12 is not null and situacao_calculo='A_MAIS')::int acima,count(*) filter(where fator_12 is not null and situacao_calculo='A_MENOS')::int abaixo
     from neo_fat_servicos_lista where fatura='9844' and situacao<>'CONFERIDO'`;
    assert.equal((await listar({lado:'a_mais',fator_12:'sim'})).total,nc.acima);
    assert.equal((await listar({lado:'a_menos',fator_12:'nao'})).total+nc.abaixo,(await listar({lado:'a_menos'})).total);
    assert.equal((await listar({lado:'a_mais',fator_12:'sim'})).servicos[0].fator_12,'pago × 1,2');
    // 20% a menos ao pé da letra: pago = devido × 0,8
    await t`update neo_fat_servicos_calc set pago_comparado=round(devido*0.8,6) where fatura='9844' and numserv='246015779'`;
    const [p08]=await t`select fator_12 from neo_fat_servicos_lista where fatura='9844' and numserv='246015779'`;
    assert.equal(p08.fator_12,'pago × 0,8');
    // troca entre 1,2 e 1,4, nos dois sentidos
    await t`update neo_fat_servicos_calc set pago_comparado=round(devido*1.4/1.2,6),situacao_calculo='A_MAIS' where fatura='9844' and numserv='246015779'`;
    assert.equal((await t`select fator_12 from neo_fat_servicos_lista where fatura='9844' and numserv='246015779'`)[0].fator_12,'pago 1,4 no lugar de 1,2');
    await t`update neo_fat_servicos_calc set pago_comparado=round(devido*1.2/1.4,6),situacao_calculo='A_MENOS' where fatura='9844' and numserv='246015779'`;
    assert.equal((await t`select fator_12 from neo_fat_servicos_lista where fatura='9844' and numserv='246015779'`)[0].fator_12,'pago 1,2 no lugar de 1,4');
  });
  console.log('OK: 0.06 zera o serviço (17 na 9844) e possível fator errado (1,2 / 1,4 / troca / esquecido; 76 na 9844) com filtro.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
