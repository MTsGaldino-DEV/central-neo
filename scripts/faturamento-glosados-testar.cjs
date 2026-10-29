// Migration 046: serviço com código de glosa (G.xx) vira GLOSADO, fora de Confere e Pagou a menos (fatura 9844, transação desfeita).
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{v046}]=await t`select neo_fat_impressao('9844')->>0='046' v046`;
    if(!v046)await t.unsafe(fs.readFileSync('supabase/migrations/046_faturamento_glosados.sql','utf8'));
    // conferências feitas à mão tiram serviços dos lados; o teste parte sem elas
    await t`delete from neo_fat_conferencias_servico where fatura='9844'`;
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`set local role authenticated`;
    const listar=async f=>(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',...f})},0,1000) d`)[0].d;

    // os 345 serviços com G.02: nada pago, situação própria, sem motivo de "a menos"
    let r=await listar({lado:'glosados'});
    assert.equal(r.total,345);
    assert.ok(r.servicos.every(s=>s.situacao==='GLOSADO'&&s.glosado&&s.codigos.some(c=>/^G\./.test(c))&&Number(s.pago_comparado)===0&&s.motivo===null));
    assert.equal(r.lados.glosados.servicos,345);assert.equal(Number(r.lados.glosados.us).toFixed(4),'6.6949');
    assert.equal(Number(r.soma).toFixed(4),'-6.6949');
    // ordem padrão: maior perda primeiro
    assert.ok(Number(r.servicos[0].diferenca)<=Number(r.servicos[1].diferenca));
    // nenhum G.xx sobra em Confere, Pagou a menos ou Pagou a mais
    for(const lado of ['a_menos','a_mais'])assert.ok((await listar({lado})).servicos.every(s=>!s.glosado),lado);
    assert.equal((await listar({lado:'todos',situacoes:['OK'],codigos:['G.02']})).total,0);
    assert.equal((await listar({lado:'todos',situacoes:['GLOSADO']})).total,345);
    // 245728835: glosa no 5.14 com G.02 (antes "a menos", RC não pago)
    const s835=(await listar({lado:'todos',q:'245728835'})).servicos[0];
    assert.equal(s835.situacao,'GLOSADO');assert.equal(s835.situacao_calculo,'GLOSADO');
    // os 3 RC + 5.62 + G.02 que tinham ficado "a menos" na 044
    r=await listar({lado:'glosados',q:'245839322, 245879192, 245992861'});assert.equal(r.total,3);

    const tot=(await t`select neo_fat_atualizar_totais('9844') d`)[0].d;
    assert.equal(tot.glosados.servicos,345);
    assert.equal(Number(tot.glosados.us).toFixed(4),'6.6949');assert.equal(Number(tot.glosados.devido).toFixed(4),'6.6949');
    assert.equal(Number(tot.glosados.glosa).toFixed(4),'7.2971');
    // 155 a menos na 044, menos os 14 com G.02 (12 RC não pago e 2 outra diferença)
    assert.equal(tot.a_menos.servicos,141);assert.equal(tot.a_menos.por_motivo.RC_NAO_PAGO.servicos,7);
    assert.equal(tot.a_mais.servicos,25);
    assert.equal(tot.funil.glosados,345);
    console.log('glosados',tot.glosados,'a_menos',tot.a_menos.servicos,Number(tot.a_menos.us).toFixed(4),'confere',tot.funil.valor_confere);

    // o lado continua validado
    await t`savepoint s`;
    await assert.rejects(()=>listar({lado:'x'}),/Lado inválido/);
    await t`rollback to savepoint s`;
    // conferido à mão sai dos glosados
    await t`select neo_fat_conferir_servico('9844','245728835','teste')`;
    assert.equal((await listar({lado:'glosados'})).total,344);
  });
  console.log('OK: serviços com código de glosa ficam em Glosados, fora de Confere e Pagou a menos.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
