// Migration 044: 5.62 dentro de RC é informativo (fatura 9844, transação desfeita).
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{v044}]=await t`select neo_fat_impressao_calc('9844')->>0='044' v044`;
    if(!v044)await t.unsafe(fs.readFileSync('supabase/migrations/044_faturamento_562_rc.sql','utf8'));
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    // as conferências à mão tiram serviços dos lados; aqui só interessa o cálculo
    await t`delete from neo_fat_conferencias_servico where fatura='9844'`;
    await t`select neo_fat_recalcular('9844')`;
    const serv=async n=>(await t`select tipo_serv,devido,situacao_calculo s from neo_fat_servicos_calc where fatura='9844' and numserv=${n}`)[0];
    const linhas=async n=>t`select codserv,tabela,coalesce(devido_csc,devido_cod) devido from neo_fat_calculo where fatura='9844' and numserv=${n}`;

    // só 5.62: paga o RC (despacho da lista, × 1,2 rural), como a CEMIG
    for(const [n,devido] of [['245471166',0.112253],['245473715',0.167881]]){
      const s=await serv(n);assert.equal(Number(s.devido),devido,n);assert.equal(s.s,'OK',n);
      assert.ok((await linhas(n)).every(l=>l.tabela==='12'),n);
    }
    // RC07/RC06 fora da lista do COD pagos como COD: continuam a mais
    for(const [n,devido] of [['246059059',0.101615],['246098036',0.136702]]){
      const s=await serv(n);assert.equal(Number(s.devido),devido,n);assert.equal(s.s,'A_MAIS',n);
    }
    // 5.62 + 8.82: transpõe para o 8.82 e a linha do 5.62 vale zero
    const s8=await serv('245812418');assert.equal(Number(s8.devido),0.01634);assert.equal(s8.s,'OK');
    const l8=await linhas('245812418');
    assert.ok(l8.every(l=>l.tabela==='11'));assert.equal(Number(l8.find(l=>l.codserv==='5.62').devido),0);
    // 5.62 + código fora da lista: mantém o RC
    assert.equal(Number((await serv('245616960')).devido),0.22194);
    // RC fora da Tabela 12: cada linha paga o seu código, 5.62 inclusive
    const s02=await serv('245183693');assert.equal(Number(s02.devido),0.018264);assert.equal(s02.s,'OK');

    // glosa no 5.14 com a justificativa lançada no G.02 (aba Evento_Glosa)
    const [j]=await t`select justificativa from neo_fat_calculo where fatura='9844' and numserv='245728835' and codserv='5.14'`;
    assert.equal(j.justificativa,'G.02: Reincidencia no serviço 244859969');

    const menos=await t`select c.numserv,c.tipo_serv,c.codigos,c.pago_comparado,c.devido,c.multas,c.motivo from neo_fat_servicos_calc c
     where c.fatura='9844' and '5.62'=any(c.codigos) and c.situacao_calculo='A_MENOS'
      and exists(select 1 from neo_fat_contrato k where k.tabela='12' and k.codigo=c.tipo_serv)`;
    // RC + 5.62 + G.02 (reincidência): vale o RC e a CEMIG glosou pelo valor urbano CSC, como nos
    // outros 9 RC com G.02 da 9844 (RC_NAO_PAGO); antes conferiam por acaso (5.62 com quantidade 0)
    assert.deepEqual(menos.map(m=>m.numserv).sort(),['245839322','245879192','245992861']);
    assert.ok(menos.every(m=>m.codigos.includes('G.02')&&m.motivo==='RC_NAO_PAGO'));
    // 246105962: equipe fechou com 5.62, a CEMIG glosou e lançou o 8.82 → paga o 8.82
    const s9=await serv('246105962');assert.equal(Number(s9.devido),0.019608);assert.equal(s9.s,'OK');
    const [j9]=await t`select justificativa from neo_fat_calculo where fatura='9844' and numserv='246105962' and codserv='5.62'`;
    assert.match(j9.justificativa,/^8\.82: 5\.62 obrigatoriamente/);
    const [r]=await t`select
      count(*) filter(where c.situacao_calculo='A_MAIS')::int a_mais,
      count(*) filter(where c.situacao_calculo='A_MENOS')::int a_menos,
      count(*) filter(where c.situacao_calculo='OK')::int ok
     from neo_fat_servicos_calc c where c.fatura='9844' and '5.62'=any(c.codigos)
      and exists(select 1 from neo_fat_contrato k where k.tabela='12' and k.codigo=c.tipo_serv)`;
    assert.deepEqual(r,{a_mais:2,a_menos:3,ok:r.ok});
    assert.equal((await t`select ativo from neo_fat_rc_transposicao where codigo='5.62'`)[0].ativo,false);

    const depois=await t`select situacao_calculo s,count(*)::int n from neo_fat_servicos_calc where fatura='9844' group by 1 order by 1`;
    console.log('Situação depois:',Object.fromEntries(depois.map(x=>[x.s,x.n])));
  });
  console.log('OK: 5.62 dentro de RC é informativo (só 5.62 paga o RC; 5.62 + 8.82 paga o 8.82).');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
