// Carga da tela de Conferência: várias chamadas ao mesmo tempo, como dois usuários ou o
// React em desenvolvimento (que monta duas vezes), com o limite de 8 s do Supabase.
// Grava só o cálculo guardado (neo_fat_servicos_calc/neo_fat_totais), que é derivado.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const lista=lado=>`select neo_fat_servicos_listar('{"fatura":"9844","lado":"${lado}"}'::jsonb,0,50)`;
const filtrada=`select neo_fat_servicos_listar('{"fatura":"9844","lado":"todos","tem_1ns":"sim","cidades":["ALPERCATA","COLUNA"],"ordem":{"coluna":"cidade","dir":"desc"}}'::jsonb,0,50)`;
const valores=c=>`select neo_fat_servicos_valores('{"fatura":"9844","lado":"a_menos"}'::jsonb,'${c}')`;
const chamadas=[lista('a_menos'),lista('a_menos'),lista('todos'),filtrada,valores('cidade'),valores('codigos'),"select neo_fat_atualizar_totais('9844')","select neo_fat_atualizar_totais('9844')",'select neo_fat_painel()','select neo_fat_painel()'];
(async()=>{
  const adm=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,max:1});
  const [a]=await adm`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;await adm.end();
  const tempos=await Promise.all(chamadas.map(async q=>{
    const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,max:1,onnotice:()=>{}});const t0=Date.now();
    try{await sql.begin(async t=>{await t`select set_config('request.jwt.claim.sub',${a.user_id},true)`;await t`set local role authenticated`;await t`set local statement_timeout='8s'`;await t.unsafe(q);});return Date.now()-t0;}
    finally{await sql.end();}
  }));
  console.log('Tempos (ms):',tempos.join(' · '));
  assert.ok(Math.max(...tempos)<8000);
  console.log(`OK: ${chamadas.length} chamadas simultâneas da Conferência dentro do limite de 8 s.`);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
