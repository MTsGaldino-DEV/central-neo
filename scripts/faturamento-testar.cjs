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
 const casos=[['moto','RC79','1.02',9,0.421205],['divergente','RC79','7.28',9,9],['ausente','RC79','SEM-CODIGO',9,1],['rc1','RC08','5.71',1,0.069950],['rc2','RC08','T.10',1,0.069951]];
 for(const [id,tipo,codigo,qtd,valor] of casos){const dados={...ex.dados,qtdurbanohn:qtd,qtdruralhn:0,ustotal:valor,usglosa:0};await t`insert into neo_fat_linhas values('__teste__',${id},${String(id).startsWith('rc')?'rc':id},${tipo},${codigo},'TESTE',${t.json(dados)})`;}
 for(const [id,codigo,urbano,rural,credito] of [['sem_desconto','6.01',1,0,0.001065],['rural_moto','1.02',0,1,0.060172],['rural_zero','7.70',0,1,0]]){
   const dados={...ex.dados,qtdurbanohn:urbano,qtdruralhn:rural,ustotal:credito,usglosa:0};
   await t`insert into neo_fat_linhas values('__teste__',${id},${id},'RC79',${codigo},'TESTE',${t.json(dados)})`;
 }
 for(const [id,numserv,codigo,credito] of [
  ['transposto','transposto','8.82',0.01634],
  ['informativo','transposto','9.82',0],
  ['rc_duplo_1','rc_duplo','8.82',0.084679],
  ['rc_duplo_2','rc_duplo','5.01',0.084679],
  ['zero_transposto','zero_transposto','7.70',0],
  ['rc_pago_duas_vezes_1','rc_pago_duas_vezes','7.28',0.084679],
  ['rc_pago_duas_vezes_2','rc_pago_duas_vezes','5.71',0.084679]
 ]){
   const dados={...ex.dados,qtdurbanohn:1,qtdruralhn:0,ustotal:credito,usglosa:0};
   await t`insert into neo_fat_linhas values('__teste__',${id},${numserv},'RC07',${codigo},'TESTE',${t.json(dados)})`;
 }
 const fatores=await t`select id,devido_csc,moto_csc from neo_fat_base where fatura='__teste__' and id in ('sem_desconto','rural_moto','rural_zero')`;
 const porId=Object.fromEntries(fatores.map(r=>[r.id,r]));
 assert.equal(Number(porId.sem_desconto.moto_csc),0.001065);
 assert.equal(Number(porId.rural_moto.moto_csc),0.060172);
 assert.equal(Number(porId.rural_moto.devido_csc),0.080230);
 assert.equal(Number(porId.rural_zero.moto_csc),0);
 assert.equal(Number(porId.rural_zero.devido_csc),0);
 const transposicoes=await t`select id,tabela,codigo_contrato,situacao_calculo from neo_fat_calculo where fatura='__teste__' and id in ('transposto','informativo','rc_duplo_1','rc_duplo_2','zero_transposto')`;
 const porTransposicao=Object.fromEntries(transposicoes.map(r=>[r.id,r]));
 assert.equal(porTransposicao.transposto.tabela,'11');
 assert.equal(porTransposicao.transposto.situacao_calculo,'OK');
 assert.equal(porTransposicao.informativo.tabela,'11');
 assert.equal(porTransposicao.informativo.situacao_calculo,'OK');
 assert.equal(porTransposicao.rc_duplo_1.tabela,'12');
 assert.equal(porTransposicao.rc_duplo_2.tabela,'12');
 assert.equal(porTransposicao.zero_transposto.tabela,'11');
 const rcDuplicado=await t`select situacao_calculo,devido_referencia from neo_fat_calculo where fatura='__teste__' and numserv='rc_pago_duas_vezes'`;
 assert(rcDuplicado.every(r=>r.situacao_calculo==='DIVERGENTE'));
 assert.equal(rcDuplicado.reduce((v,r)=>v+Number(r.devido_referencia),0),0.084679);
 for(const [id,urbano,rural,credito] of [['rc_quantidade',2,0,0.084679],['rc_rural',0,3,0.101615]]){
   const dados={...ex.dados,qtdurbanohn:urbano,qtdruralhn:rural,ustotal:credito,usglosa:0};
   await t`insert into neo_fat_linhas values('__teste__',${id},${id},'RC07','7.28','TESTE',${t.json(dados)})`;
 }
 const rcQuantidade=await t`select id,situacao_calculo,devido_referencia from neo_fat_calculo where fatura='__teste__' and id in ('rc_quantidade','rc_rural')`;
 assert(rcQuantidade.every(r=>r.situacao_calculo==='OK'));
 assert.equal(Number(rcQuantidade.find(r=>r.id==='rc_quantidade').devido_referencia),0.084679);
 assert.equal(Number(rcQuantidade.find(r=>r.id==='rc_rural').devido_referencia),0.101615);
 const resultados=await t`select id,situacao_calculo from neo_fat_calculo where fatura='__teste__'`;
 const mapa=Object.fromEntries(resultados.map(r=>[r.id,r.situacao_calculo]));assert.equal(mapa.moto,'MOTO_PROVAVEL');assert.equal(mapa.divergente,'DIVERGENTE');assert.equal(mapa.ausente,'CODIGO_FORA_CONTRATO');assert.equal(mapa.rc1,'REVISAR_RC_MULTILINHA');assert.equal(mapa.rc2,'REVISAR_RC_MULTILINHA');
 await t`select neo_fat_conferir('9844',${ex.id},'Teste automatizado com rollback')`;
 const [h]=await t`select * from neo_fat_conferencias where fatura='9844' and linha=${ex.id}`;assert(h.usuario);
 assert.equal(h.contexto.length,11);
 await t`update neo_fat_conferencias set contexto=contexto - 10 - 9 where fatura='9844' and linha=${ex.id}`;
 const [antiga]=await t`select situacao,revisao_desatualizada from neo_fat_conferencia where fatura='9844' and id=${ex.id}`;
 assert.equal(antiga.revisao_desatualizada,true);assert.notEqual(antiga.situacao,'CONFERIDO');
 await t`select neo_fat_conferir('9844',${ex.id},'Revisão da regra com rollback')`;
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
