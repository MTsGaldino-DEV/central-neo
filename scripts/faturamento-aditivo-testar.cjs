// 1º Termo Aditivo (30/03/2026), migration 050: 7.18, 7.19 e 7.20 na Tabela 11 e contas refeitas quando
// o contrato ganha código. Fatura 9844 em transação desfeita.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{v}]=await t`select neo_fat_impressao('9844')->>0 v`;
    if(v<'050')await t.unsafe(fs.readFileSync('supabase/migrations/050_contrato_aditivo_ramais.sql','utf8'));
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    const c=Object.fromEntries((await t`select codigo,fator_csc,fator_cod,fator_original,fator_cod_original,rural,moto from neo_fat_contrato where tabela='11' and codigo in ('7.18','7.19','7.20')`).map(r=>[r.codigo,r]));
    assert.deepEqual(Object.keys(c).sort(),['7.18','7.19','7.20']);
    for(const [k,csc,cod] of [['7.18','0.126786','0.152143'],['7.19','0.126786','0.152143'],['7.20','0.135182','0.162218']]){
      assert.equal(c[k].fator_csc,csc,k);assert.equal(c[k].fator_original,csc,k);assert.equal(c[k].fator_cod,cod,k);assert.equal(c[k].fator_cod_original,cod,k);
      assert.equal(c[k].rural,null);assert.equal(c[k].moto,null);}
    const tot=(await t`select neo_fat_atualizar_totais('9844') d`)[0].d;
    assert.equal(Number(tot.devido).toFixed(6),'931.404228','contrato previa com os ramais');
    assert.equal(Number(tot.pago_com_fator).toFixed(6),Number(tot.creditado).toFixed(6),'todo crédito tem preço no contrato');
    const [r]=await t`select count(*)::int n,count(*) filter(where situacao_calculo='OK')::int ok from neo_fat_servicos_lista
      where fatura='9844' and codigos && array['7.18','7.19','7.20']`;
    assert.deepEqual(r,{n:362,ok:362});
    // o 7.19 urbano CSC fecha no fator; o rural, × 1,2
    const [l]=await t`select count(*) filter(where urbano=1 and devido_csc=0.126786)::int urb,count(*) filter(where rural=1 and devido_csc=0.152143)::int rur
      from neo_fat_calculo where fatura='9844' and codserv='7.19'`;
    assert.deepEqual(l,{urb:231,rur:89});
    // código novo no contrato muda a impressão (refaz contas e totais)
    const antes=(await t`select neo_fat_impressao_calc('9844') i`)[0].i;
    await t`insert into neo_fat_contrato(tabela,codigo,descricao,fator_original,fator_cod_original,fator_csc,fator_cod,validado,ativo,origem) values('11','Z.99','teste',0,0,0,0,true,true,'teste')`;
    assert.notDeepEqual((await t`select neo_fat_impressao_calc('9844') i`)[0].i,antes);
  });
  console.log('OK: 7.18/7.19/7.20 do aditivo, 362 serviços com ramal conferem e contrato novo refaz as contas.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
