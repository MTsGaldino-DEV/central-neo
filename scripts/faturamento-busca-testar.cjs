// Migration 045: filtro "Nº serviço" com vários números separados por vírgula (transação desfeita).
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    await t.unsafe(fs.readFileSync('supabase/migrations/045_faturamento_busca_varios.sql','utf8'));
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    const busca=async q=>(await t`select numserv from neo_fat_servicos_filtrar('9844',${t.json({q})},false) order by 1`).map(r=>r.numserv);
    assert.deepEqual(await busca('246101137, 246445398, 246006974'),['246006974','246101137','246445398']);
    assert.deepEqual(await busca('246101137,246445398'),['246101137','246445398']);
    assert.deepEqual(await busca(' 246101137 ; 246445398 '),['246101137','246445398']);
    // um número só continua sendo "contém"
    const parte=await busca('2461011');
    assert.ok(parte.includes('246101137')&&parte.every(n=>n.includes('2461011')));
    // curingas do ilike não valem como busca: '%,_' é o mesmo que nenhum filtro
    const todos=(await busca('')).length;
    assert.ok(todos>21000,'busca vazia não filtra');assert.equal((await busca('%,_')).length,todos);
  });
  console.log('OK: filtro Nº serviço com vários números separados por vírgula.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
