// Carga local autenticada e relatório; credenciais nunca são impressas.
const fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {lerFatura,lerFaturaCompleta,cruzarFaturas}=require('../src/lib/faturamentoPlanilhas.ts');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{},connect_timeout:15});
(async()=>{try{
 if(process.argv[2]==='importar'){
 if(!process.argv[3]||!process.argv[4])throw Error('Uso: importar <Fatura Resumida.xlsx> <Fatura Completa.xlsx>');
 const l=lerFatura(fs.readFileSync(process.argv[3])),completa=lerFaturaCompleta(fs.readFileSync(process.argv[4]));
 console.log('Cruzamento:',cruzarFaturas(l,completa));
 const abas={...l.abas,Servico:completa.vinculos.map(v=>({...v,idapropriacao:completa.fatura}))};
 await sql.begin(async t=>{
 const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
 await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
 const [r]=await t`select neo_fat_iniciar_completa(${l.fatura},${path.basename(process.argv[3])},${path.basename(process.argv[4])},${completa.inicio},${completa.fim},${t.json(Object.fromEntries(Object.entries(abas).map(([a,v])=>[a,v.length])))} ) id`;
 for(const [aba,linhas] of Object.entries(abas))for(let i=0;i<linhas.length;i+=1000)await t`select neo_fat_enviar_lote(${r.id},${aba},${i/1000},${t.json(linhas.slice(i,i+1000))})`;
 await t`select neo_fat_finalizar_completa(${r.id})`;console.log('Importadas',l.abas.US_Servico.length,'linhas; crédito',l.creditado,'glosa',l.glosa);
 });
 }else{
 const contagens=await sql`select situacao_calculo,count(*)::int quantidade from neo_fat_calculo where fatura='9844' group by 1`;
 const [totais]=await sql`select sum(creditado) creditado,sum(greatest(-glosa,0)) debitado,sum(greatest(glosa,0)) estorno,sum(devido_referencia) devido,sum(devido_csc) devido_csc,sum(devido_cod) devido_cod,count(*) filter(where devido_referencia is null) sem_fator from neo_fat_calculo where fatura='9844'`;
 const ajustes=await sql`select dados->>'tipoajusteapropriacao' tipo,sum((dados->>'valor')::numeric) valor from neo_fat_anexos where fatura='9844' and aba='Debito_Credito' group by 1`;
 const equipes=await sql`select tipo_turma,count(*)::int linhas,count(distinct numserv)::int servicos from neo_fat_base where fatura='9844' group by 1 order by 1`;
 fs.writeFileSync('docs/faturamento-9844-resultados.json',JSON.stringify({totais,contagens,ajustes,equipes},null,2));console.log({totais,contagens,ajustes,equipes});
 }
}catch(e){console.error(e.message);process.exitCode=1;}finally{await sql.end();}})();
