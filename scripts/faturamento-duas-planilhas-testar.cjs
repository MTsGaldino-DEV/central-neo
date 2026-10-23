// Integração com rollback. --pendentes ensaia 019/020 sem aplicá-las definitivamente.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
(async()=>{try{await sql.begin(async t=>{
 if(process.argv.includes('--pendentes'))for(const f of ['019_faturamento_duas_planilhas.sql','020_faturamento_fatores_pdf.sql'])await t.unsafe(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
 await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
 const [ex]=await t`select dados from neo_fat_linhas where fatura='9844' and codserv='7.28' limit 1`;
 const fatura='__duas_planilhas__';
 const servico={...ex.dados,idapropriacao:fatura,idapropriacaotemposervico:'linha1',numserv:'servico1',tipo_serv:'RC79',codserv:'7.28',qtdurbanohn:9,qtdruralhn:0,ustotal:0.039558,usglosa:0};
 const turmas=[{idapropriacao:fatura,numvei:'7',ident_turma:'m',tipo_turma:'M'},{idapropriacao:fatura,numvei:'7',ident_turma:'d',tipo_turma:'D'}];
 async function preparar(){
   const contagens={US_Servico:1,US_Turma:2,Evento_Glosa:0,Glosa:0,Debito_Credito:0,Servico:1};
   const [r]=await t`select neo_fat_iniciar_completa(${fatura},'resumo.xlsx','completa.xlsx','2026-09-02','2026-10-01',${t.json(contagens)}) id`;
   await t`select neo_fat_enviar_lote(${r.id},'US_Servico',0,${t.json([servico])})`;
   await t`select neo_fat_enviar_lote(${r.id},'US_Turma',0,${t.json(turmas)})`;
   return r.id;
 }
 async function vincular(id,ident,fat=fatura){await t`select neo_fat_enviar_lote(${id},'Servico',0,${t.json([{idapropriacao:fat,numserv:'servico1',numvei:'7',ident_turma:ident}])})`;}
 let id=await preparar();
 await assert.rejects(()=>t.savepoint(s=>s`select neo_fat_finalizar(${id})`),/Lotes incompletos/);
 assert.equal((await t`select count(*)::int n from neo_fat_faturas where id=${fatura}`)[0].n,0);
 await vincular(id,'m','outra');
 await assert.rejects(()=>t.savepoint(s=>s`select neo_fat_finalizar_completa(${id})`),/outra fatura/);
 await vincular(id,'m');await t`select neo_fat_finalizar_completa(${id})`;
 const ler=async()=>(await t`select * from neo_fat_conferencia where fatura=${fatura}`)[0];
 assert.equal((await ler()).tipo_turma,'M');assert.equal((await ler()).situacao,'OK');
 assert.equal((await t`select arquivo_completo from neo_fat_faturas where id=${fatura}`)[0].arquivo_completo,'completa.xlsx');
 await t`select neo_fat_conferir(${fatura},'linha1','Conferência com equipe Moto')`;
 id=await preparar();await vincular(id,'m');await t`select neo_fat_finalizar_completa(${id})`;
 assert.equal((await ler()).situacao,'CONFERIDO');
 id=await preparar();
 await assert.rejects(()=>t.savepoint(s=>s`select neo_fat_finalizar_completa(${id})`),/Lotes incompletos/);
 assert.equal((await ler()).situacao,'CONFERIDO');
 await vincular(id,'d');await t`select neo_fat_finalizar_completa(${id})`;
 assert.equal((await ler()).tipo_turma,'D');assert.equal((await ler()).situacao,'DIVERGENTE');assert.equal((await ler()).revisao_desatualizada,true);
 id=await preparar();await vincular(id,null);await t`select neo_fat_finalizar_completa(${id})`;
 assert.equal((await ler()).tipo_turma,null);assert.equal((await ler()).situacao,'MOTO_PROVAVEL');
 const [codigo]=await t`select * from neo_fat_contrato where tabela='11' and codigo='1.13'`;
 assert.equal(Number(codigo.fator_original),0.137718);assert.equal(Number(codigo.fator_cod_original),0.165261);assert.equal(codigo.validado,true);
 await t`select set_config('neo_fat.motivo','Tentativa de alteração de original',true)`;
 await assert.rejects(()=>t.savepoint(s=>s`update neo_fat_contrato set fator_original=1 where tabela='11' and codigo='1.13'`),/imutáveis/);
 const [priv]=await t`select has_function_privilege('authenticated','neo_fat_publicar_lotes(uuid)','EXECUTE') publica,has_function_privilege('anon','neo_fat_finalizar_completa(uuid)','EXECUTE') anonimo`;
 assert.equal(priv.publica,false);assert.equal(priv.anonimo,false);
 await t`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true)`;
 await t`set local role authenticated`;
 await assert.rejects(()=>t.savepoint(s=>s`select neo_fat_finalizar_completa(${id})`),/não autorizada/);
 assert.equal((await t`select count(*)::int n from neo_fat_vinculos`)[0].n,0);
 console.log('OK: publicação atômica, lotes incompletos, mistura de faturas, reimportação, equipes Moto/Multifuncional/ambígua, revisão reaberta, 1.13, imutabilidade e permissões. Tudo revertido.');
 throw Error('ROLLBACK_TESTE');
 });}catch(e){if(e.message!=='ROLLBACK_TESTE'){console.error(e);process.exitCode=1;}}finally{await sql.end();}})();
