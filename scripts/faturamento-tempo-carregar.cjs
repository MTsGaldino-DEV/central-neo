// Preenche acionamento, término e área numa fatura importada antes da migration 039.
//   node scripts/faturamento-tempo-carregar.cjs "Comparação de fatura/RelatorioDadosFatura9844….xlsx"
const fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {lerFaturaCompleta}=require('../src/lib/faturamentoPlanilhas.ts');

/** Grava os três campos na aba Servico de neo_fat_anexos e força o recálculo da fatura. */
async function carregarTempo(t,completa){
  const linhas=completa.vinculos.map(v=>({numserv:v.numserv,acionamento:v.acionamento,termino:v.termino,area:v.area}));
  const [r]=await t`with feito as (update neo_fat_anexos a set dados=a.dados||jsonb_build_object('acionamento',x.acionamento,'termino',x.termino,'area',x.area)
   from jsonb_to_recordset(${t.json(linhas)}) x(numserv text,acionamento text,termino text,area text)
   where a.fatura=${completa.fatura} and a.aba='Servico' and a.dados->>'numserv'=x.numserv returning 1) select count(*) n from feito`;
  await t`delete from neo_fat_calc_estado where fatura=${completa.fatura}`;
  await t`update neo_fat_totais set impressao=null where fatura=${completa.fatura}`;
  return Number(r?.n??0);
}
module.exports={carregarTempo,lerFaturaCompleta};

if(require.main===module)(async()=>{
  const postgres=require('../../traceone/frontend/node_modules/postgres');
  const env=Object.fromEntries(fs.readFileSync(path.join(__dirname,'../.env'),'utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
  const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
  try{
    const completa=lerFaturaCompleta(fs.readFileSync(process.argv[2]));
    const n=await sql.begin(t=>carregarTempo(t,completa));
    console.log(`Fatura ${completa.fatura}: ${n} serviços atualizados de ${completa.vinculos.length}.`);
  }catch(e){console.error(e.message);process.exitCode=1;}finally{await sql.end();}
})();
