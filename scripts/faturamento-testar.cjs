// Verificações de integração reais, sempre revertidas no final.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
(async()=>{try{await sql.begin(async t=>{
 const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
 await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
 const [ex]=await t`select * from neo_fat_conferencia where fatura='9844' and numserv='246220152' and codserv='7.28'`;
 assert.equal(Number(ex.creditado),0.056511);assert.equal(ex.situacao_calculo,'OK');assert.equal(ex.tabela,'11');
 await t`insert into neo_fat_faturas(id,arquivo,inicio,fim) values('__teste__','teste','2026-09-02','2026-10-01')`;
 const casos=[['moto','RC79','7.28',9,0.039558],['divergente','RC79','7.28',9,9],['ausente','RC79','SEM-CODIGO',9,1],['rc1','RC08','5.71',1,0.233168],['rc2','RC08','T.10',1,0]];
 for(const [id,tipo,codigo,qtd,valor] of casos){const dados={...ex.dados,qtdurbanohn:qtd,qtdruralhn:0,ustotal:valor,usglosa:0};await t`insert into neo_fat_linhas values('__teste__',${id},${String(id).startsWith('rc')?'rc':id},${tipo},${codigo},'TESTE',${t.json(dados)})`;}
 const resultados=await t`select id,situacao_calculo from neo_fat_calculo where fatura='__teste__'`;
 const mapa=Object.fromEntries(resultados.map(r=>[r.id,r.situacao_calculo]));assert.equal(mapa.moto,'MOTO_PROVAVEL');assert.equal(mapa.divergente,'DIVERGENTE');assert.equal(mapa.ausente,'CODIGO_FORA_CONTRATO');assert.equal(mapa.rc1,'REVISAR_RC_MULTILINHA');assert.equal(mapa.rc2,'REVISAR_RC_MULTILINHA');
 await t`select neo_fat_conferir('9844',${ex.id},'Teste automatizado com rollback')`;
 const [h]=await t`select * from neo_fat_conferencias where fatura='9844' and linha=${ex.id}`;assert(h.usuario);
 await t`delete from neo_fat_linhas where fatura='9844' and id=${ex.id}`;
 await t`insert into neo_fat_linhas(fatura,id,numserv,tipo_serv,codserv,cidade,dados) values('9844',${ex.id},${ex.numserv},${ex.tipo_serv},${ex.codserv},${ex.cidade},${t.json(ex.dados)})`;
 const [igual]=await t`select situacao from neo_fat_conferencia where fatura='9844' and id=${ex.id}`;assert.equal(igual.situacao,'CONFERIDO');
 await t`update neo_fat_linhas set dados=jsonb_set(dados,'{ustotal}','999'::jsonb) where fatura='9844' and id=${ex.id}`;
 const [mudou]=await t`select revisao_desatualizada,situacao from neo_fat_conferencia where fatura='9844' and id=${ex.id}`;assert(mudou.revisao_desatualizada);assert.notEqual(mudou.situacao,'CONFERIDO');
 const inicio=Date.now();const [resumo]=await t`select neo_fat_resumo('2026-09-02','2026-10-01','9844') r`;assert.equal(resumo.r.totais.linhas,27389);console.log('Resumo em ms:',Date.now()-inicio);
 await t`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true)`;
 await t`set local role authenticated`;
 const [sem]=await t`select count(*)::int n from neo_fat_linhas`;assert.equal(sem.n,0);
 console.log('OK: exemplo 7.28, prioridade RC, conferência preservada, alteração reabre revisão, resumo e RLS sem acesso.');
 throw Error('ROLLBACK_TESTE');
 });}catch(e){if(e.message!=='ROLLBACK_TESTE'){console.error(e.message);process.exitCode=1;}}finally{await sql.end();}})();
