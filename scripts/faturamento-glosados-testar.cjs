// Migrations 046/047: serviço com código de glosa (G.xx) vira GLOSADO quando a glosa cobre o devido;
// glosa parcial fica em Pagou a menos, com a diferença incluindo a glosa (fatura 9844, transação desfeita).
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{v}]=await t`select neo_fat_impressao('9844')->>0 v`;
    if(v<'046')await t.unsafe(fs.readFileSync('supabase/migrations/046_faturamento_glosados.sql','utf8'));
    if(v<'047')await t.unsafe(fs.readFileSync('supabase/migrations/047_faturamento_glosa_parcial.sql','utf8'));
    // conferências feitas à mão tiram serviços dos lados; o teste parte sem elas
    await t`delete from neo_fat_conferencias_servico where fatura='9844'`;
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`set local role authenticated`;
    const listar=async f=>(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',...f})},0,1000) d`)[0].d;
    const um=async n=>(await listar({lado:'todos',q:n})).servicos.find(s=>s.numserv===n);

    // glosa cobre o devido: GLOSADO, nada pago, sem motivo; diferença = pago + glosa − devido (≥ 0)
    let r=await listar({lado:'glosados'});
    assert.equal(r.total,331);
    assert.ok(r.servicos.every(s=>s.situacao==='GLOSADO'&&s.glosado&&s.codigos.some(c=>/^G\./.test(c))&&Number(s.pago_comparado)===0&&s.motivo===null));
    assert.ok(r.servicos.every(s=>Math.abs(Number(s.diferenca)-(Number(s.multas)-Number(s.devido)))<1e-9&&Number(s.diferenca)>=-1e-6));
    assert.equal(r.lados.glosados.servicos,331);assert.equal(Number(r.lados.glosados.us).toFixed(4),'5.9880');
    // ordem padrão: maior glosa primeiro
    assert.ok(Number(r.servicos[0].multas)>=Number(r.servicos[1].multas));
    // 246309215: glosa 0,062101 = devido → glosado por inteiro
    const s215=await um('246309215');assert.equal(s215.situacao,'GLOSADO');assert.equal(Number(s215.diferenca),0);

    // glosa parcial: Pagou a menos, motivo GLOSA_PARCIAL, diferença = o que falta pagar
    const s816=await um('246310816');
    assert.equal(s816.situacao,'A_MENOS');assert.equal(s816.motivo,'GLOSA_PARCIAL');assert.equal(s816.glosado,false);
    assert.equal(Number(s816.diferenca).toFixed(6),'-0.000731');   // 0 + 0,003657 − 0,004388
    r=await listar({lado:'a_menos',motivos:['GLOSA_PARCIAL']});
    assert.equal(r.total,14);assert.equal(Number(r.soma).toFixed(4),'-0.2785');
    assert.ok(r.servicos.every(s=>s.codigos.includes('G.02')&&Number(s.multas)<Number(s.devido)));
    // os 3 RC + 5.62 + G.02 da 044: glosa pelo valor urbano CSC, menor que o devido
    r=await listar({lado:'a_menos',q:'245839322, 245879192, 245992861'});assert.equal(r.total,3);
    assert.ok(r.servicos.every(s=>s.motivo==='GLOSA_PARCIAL'));
    // nenhum G.xx em Confere nem em Pagou a mais
    assert.equal((await listar({lado:'todos',situacoes:['OK','A_MAIS'],codigos:['G.02']})).total,0);

    const tot=(await t`select neo_fat_atualizar_totais('9844') d`)[0].d;
    assert.equal(tot.glosados.servicos,331);
    assert.equal(Number(tot.glosados.us).toFixed(4),'5.9880');assert.equal(Number(tot.glosados.glosa).toFixed(4),'5.9880');
    assert.equal(Number(tot.glosados.devido).toFixed(4),'5.1074');
    assert.equal(tot.a_menos.servicos,155);assert.equal(Number(tot.a_menos.us).toFixed(4),'6.8350');
    assert.equal(tot.a_menos.por_motivo.GLOSA_PARCIAL.servicos,14);assert.equal(tot.a_menos.por_motivo.RC_NAO_PAGO.servicos,7);
    assert.equal(tot.a_mais.servicos,25);assert.equal(tot.funil.glosados,331);
    console.log('glosados',tot.glosados,'a_menos',tot.a_menos.servicos,Number(tot.a_menos.us).toFixed(4),'confere',tot.funil.valor_confere);

    // o lado continua validado
    await t`savepoint s`;
    await assert.rejects(()=>listar({lado:'x'}),/Lado inválido/);
    await t`rollback to savepoint s`;
    // conferido à mão sai dos glosados
    await t`select neo_fat_conferir_servico('9844','246309215','teste')`;
    assert.equal((await listar({lado:'glosados'})).total,330);
  });
  console.log('OK: glosa que cobre o devido vai para Glosados; glosa parcial fica em Pagou a menos com a diferença que falta.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
