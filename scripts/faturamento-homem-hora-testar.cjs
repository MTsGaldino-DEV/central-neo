// Migration 039: homem-hora, despacho pela lista do COD e área da Fatura Completa (fatura 9844, transação desfeita).
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const {carregarTempo,lerFaturaCompleta}=require('./faturamento-tempo-carregar.cjs');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const dir=path.resolve('Comparação de fatura');
const perto=(a,b,tol=0.0005)=>assert.ok(Math.abs(Number(a)-b)<=tol,`${a} ≠ ${b}`);
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{aplicada}]=await t`select exists(select 1 from information_schema.columns where table_name='neo_fat_base' and column_name='despacho') aplicada`;
    if(!aplicada)await t.unsafe(fs.readFileSync('supabase/migrations/039_faturamento_homem_hora_cod.sql','utf8'));
    const [{v040}]=await t`select neo_fat_impressao_calc('9844')->>0='040' v040`;
    if(!v040)await t.unsafe(fs.readFileSync('supabase/migrations/040_faturamento_rc_homem_hora.sql','utf8'));
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    const [{ok}]=await t`select exists(select 1 from neo_fat_anexos where fatura='9844' and aba='Servico' and dados ? 'area') ok`;
    if(!ok)await carregarTempo(t,lerFaturaCompleta(fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(n=>n.startsWith('RelatorioDadosFatura9844'))))));
    const antes=await t`select situacao_calculo s,count(*)::int n from neo_fat_servicos_calc where fatura='9844' group by 1 order by 1`;
    await t`select neo_fat_recalcular('9844')`;

    // homem-hora 1.62
    const l162=await t`select numserv,despacho,area,horas,us_hora,multiplicador,tipo_turma,coalesce(devido_csc,devido_cod) devido,devido_cod
     from neo_fat_calculo where fatura='9844' and codserv='1.62'`;
    assert.equal(l162.filter(l=>l.devido!==null).length,61);
    assert.equal(l162.filter(l=>l.area==='RURAL').length,39);
    assert.ok(l162.every(l=>l.despacho==='COD'));
    perto(l162.reduce((s,l)=>s+Number(l.devido),0),9.9655);
    for(const l of l162){
      assert.ok([1.2,1.4].includes(Number(l.multiplicador)),l.numserv);
      perto(l.devido_cod,Math.round(Number(l.horas)*Number(l.us_hora)*Number(l.multiplicador)*1e6)/1e6,0.0000011);
    }
    perto(l162.find(l=>l.numserv==='246015779').horas,2.216667,0.000001);
    assert.ok(l162.filter(l=>l.tipo_turma==='U').every(l=>Number(l.us_hora)===0.0922));
    // 5.63 / 5.64: sempre por hora; RC com código de homem-hora deixa de pagar o RC e paga os códigos (Matheus, 28/10/2026)
    const l56=await t`select numserv,horas,coalesce(devido_csc,devido_cod) devido from neo_fat_calculo where fatura='9844' and codserv in ('5.63','5.64')`;
    assert.equal(l56.filter(l=>l.horas!==null).length,4);
    perto(l56.reduce((s,l)=>s+Number(l.devido),0),0.170316,0.000001);
    const rc=await t`select numserv,codserv,tabela,coalesce(devido_csc,devido_cod) devido from neo_fat_calculo where fatura='9844' and numserv in ('246042202','246140737')`;
    assert.ok(rc.every(l=>l.tabela!=='12'),'RC com homem-hora não paga o RC');
    assert.equal(Number(rc.find(l=>l.numserv==='246042202'&&l.codserv==='5.64').devido),0.07679);
    const sit=async n=>(await t`select situacao_calculo s from neo_fat_servicos_calc where fatura='9844' and numserv=${n}`)[0].s;
    assert.equal(await sit('246140737'),'OK');assert.equal(await sit('246042202'),'A_MENOS');
    // quarteto: 4 elementos da Tabela 14
    const [q]=await t`select us_hora from neo_fat_calculo where fatura='9844' and numserv='245640158' and codserv='5.63'`;
    assert.equal(Number(q.us_hora),0.1753);

    // despacho por serviço
    const serv=async(...ns)=>t`select numserv,tipo_serv,fator_aplicado,situacao_calculo from neo_fat_servicos_calc where fatura='9844' and numserv in ${t(ns)}`;
    const [ma27]=await t`select count(*) filter(where fator_aplicado<>'COD')::int n from neo_fat_servicos_calc where fatura='9844' and tipo_serv='MA27'`;
    assert.equal(ma27.n,0);
    const [odsa]=await t`select count(*) filter(where fator_aplicado<>'CSC')::int n from neo_fat_servicos_calc where fatura='9844' and tipo_serv='ODSA'`;
    assert.equal(odsa.n,0);
    for(const s of await serv('246106093','246480975','246008197','245617976','245589530','246008198','246148252','246410427','245833023'))assert.equal(s.situacao_calculo,'A_MAIS',s.numserv);
    for(const s of await serv('245964563','245594597','245833464'))assert.equal(s.situacao_calculo,'OK',s.numserv);
    for(const s of await serv('245643698','245775709','245903221','245994592','246165347','246189397'))assert.equal(s.situacao_calculo,'A_MENOS',s.numserv);

    // sem área na Fatura Completa: volta para as colunas K/M
    await t`update neo_fat_anexos set dados=dados-'area' where fatura='9844' and aba='Servico' and dados->>'numserv'='246106093'`;
    const [semArea]=await t`select area,urbano from neo_fat_calculo where fatura='9844' and numserv='246106093'`;
    assert.equal(semArea.area,'URBANO');assert.equal(Number(semArea.urbano),1);
    // término antes do acionamento: sem devido, com observação
    await t`update neo_fat_anexos set dados=dados||'{"termino":"2026-09-17T05:00:00"}' where fatura='9844' and aba='Servico' and dados->>'numserv'='246015779'`;
    const [inv]=await t`select devido_cod,devido_referencia,observacoes from neo_fat_calculo where fatura='9844' and numserv='246015779'`;
    assert.equal(inv.devido_cod,null);assert.equal(inv.devido_referencia,null);assert.match(inv.observacoes,/homem-hora: término antes/);

    // linhas da janela do serviço e regras para a tela
    const [{d}]=await t`select neo_fat_servico_linhas('9844','246019087') d`;
    assert.equal(d[0].despacho,'COD');assert.ok(d[0].horas>3);assert.equal(Number(d[0].us_hora),0.1097);
    const [{r}]=await t`select neo_fat_regras_despacho() r`;
    assert.equal(r.despacho_cod.length,43);assert.ok(r.despacho_cod.includes('RC01'));assert.equal(r.prontidao.length,4);
    assert.equal(r.prontidao.find(p=>p.tipo_turma==='Q').veiculo,'Caminhonete cabine dupla');

    const depois=await t`select situacao_calculo s,count(*)::int n from neo_fat_servicos_calc where fatura='9844' group by 1 order by 1`;
    console.log('Situação antes :',Object.fromEntries(antes.map(x=>[x.s,x.n])));
    console.log('Situação depois:',Object.fromEntries(depois.map(x=>[x.s,x.n])));
  });
  console.log('OK: homem-hora (1.62, 5.63/5.64), despacho pela lista do COD, área da Fatura Completa e dados faltando.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
