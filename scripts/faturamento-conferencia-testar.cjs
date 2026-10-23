// Reproduz a consulta da tela com papel autenticado e limite de 8 segundos.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
(async()=>{try{
  await sql.begin(async t=>{
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`set local role authenticated`;
    await t`set local statement_timeout='8000ms'`;
    const inicio=Date.now();
    const linhas=await t`select * from neo_fat_conferencia where fatura='9844' order by fatura,id limit 50 offset 0`;
    const [total]=await t`select count(*)::int n from neo_fat_conferencia where fatura='9844'`;
    assert.equal(linhas.length,50);assert.equal(total.n,27389);
    console.log('View usada pelo frontend anterior:',Date.now()-inicio,'ms, 50/27.389 linhas');
    for(const [nome,filtros,esperado] of [['todas',{fatura:'9844'},27389],['Moto',{fatura:'9844',tipo_turma:'M'},10426],['divergentes',{fatura:'9844',situacao:'DIVERGENTE'},13580]]){
      const [r]=await t`select neo_fat_listar(${t.json(filtros)},0,50) dados`;
      assert.equal(r.dados.total,esperado);assert.equal(r.dados.linhas.length,50);
      console.log('RPC',nome,r.dados.total);
    }
  });
  await sql.begin(async t=>{
    await t`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true)`;
    await t`set local role authenticated`;
    const [r]=await t`select count(*)::int n from neo_fat_conferencia where fatura='9844'`;
    assert.equal(r.n,0);
    await assert.rejects(()=>t.savepoint(s=>s`select neo_fat_listar('{}'::jsonb,0,50)`),/Sem acesso ao Faturamento/);
  });
  console.log('OK: consulta antiga, RPC paginada, filtros e acesso restrito.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await sql.end();}})();
