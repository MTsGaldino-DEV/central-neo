// Migration 048 (substitui 046/047): quando a CEMIG não pagou nada e glosou, compara glosa × contrato;
// quando pagou, pago × contrato. "Possíveis glosas erradas" = glosa parcial + conferir à mão
// (fatura 9844, transação desfeita, sem as conferências feitas à mão).
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [{v}]=await t`select neo_fat_impressao('9844')->>0 v`;
    if(v<'048')await t.unsafe(fs.readFileSync('supabase/migrations/048_faturamento_glosa_conferir.sql','utf8'));
    await t`delete from neo_fat_conferencias_servico where fatura='9844'`;
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`set local role authenticated`;
    const listar=async f=>(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',...f})},0,1000) d`)[0].d;
    const um=async n=>(await listar({lado:'todos',q:n})).servicos.find(s=>s.numserv===n);
    const conf=async(n,situacao,motivo,dif)=>{const s=await um(n);
      assert.equal(s.situacao,situacao,n);assert.equal(s.motivo,motivo,n);
      if(dif===null)assert.equal(s.diferenca,null,n);else assert.equal(Number(s.diferenca).toFixed(6),dif,n);};

    // nada pago e glosa = contrato: confere (G.02, 0.00)
    await conf('246309215','OK',null,'0.000000');await conf('245588785','OK',null,'0.000000');await conf('245722442','OK',null,'0.000000');
    // nada pago e glosa < contrato: a menos, diferença = glosa − contrato (com G.02 e com 0.00)
    await conf('246310816','A_MENOS','GLOSA_PARCIAL','-0.000731');   // R$ 13,01 − 10,84
    await conf('245839322','A_MENOS','GLOSA_PARCIAL','-0.036990');
    await conf('246327823','A_MENOS','GLOSA_PARCIAL','-0.016936');   // 0.00, antes −0,101615 (R$ 301,22)
    await conf('246042202','A_MENOS','GLOSA_PARCIAL','-0.012798');
    // nada pago, glosou e zerou a quantidade (contrato 0): conferir à mão, sem diferença
    await conf('246088548','A_CONFERIR','GLOSA_SEM_QUANTIDADE',null);  // 5.10 NSRI, 1 unidade COD urbana
    await conf('245971209','A_CONFERIR','GLOSA_SEM_QUANTIDADE',null);  // 8.75 "não condiz com a observação"
    // pagou: a glosa é de um código que saiu; vale pago × contrato
    await conf('246073073','OK',null,'0.000000');                    // 1.72 "por vão"
    await conf('245663748','OK',null,'0.000000');                    // glosou e devolveu
    await conf('245962803','A_MENOS','FATOR_MENOR','-0.000463');      // 6.07 glosado, 7.89 pago a menos

    // possíveis glosas erradas: 17 glosas parciais (14 G.02 + 3 com 0.00) e 30 para conferir à mão
    const r=await listar({lado:'glosas'});
    assert.equal(r.total,47);
    assert.ok(r.servicos.every(s=>['GLOSA_PARCIAL','GLOSA_SEM_QUANTIDADE','GLOSA_ACIMA'].includes(s.motivo)&&Number(s.pago_comparado)===0));
    assert.equal(r.servicos.filter(s=>s.motivo==='GLOSA_PARCIAL').length,17);
    assert.equal(r.servicos.filter(s=>s.situacao==='A_CONFERIR').length,30);
    assert.equal(r.servicos[0].diferenca,null,'conferir à mão primeiro');
    assert.equal(Number(r.resumo.diferenca).toFixed(6),'-0.393084');assert.equal(Number(r.resumo.pago),0);
    assert.equal((await listar({lado:'todos',situacoes:['GLOSADO']})).total,0,'não existe mais GLOSADO');

    const tot=(await t`select neo_fat_atualizar_totais('9844') d`)[0].d;
    assert.equal(tot.glosas_erradas.servicos,47);
    assert.equal(tot.glosas_erradas.parcial.servicos,17);assert.equal(Number(tot.glosas_erradas.parcial.us).toFixed(6),'0.393084');
    assert.equal(tot.glosas_erradas.conferir.servicos,30);assert.equal(tot.funil.a_conferir,30);
    assert.equal(tot.a_menos.servicos,155);assert.equal(Number(tot.a_menos.us).toFixed(4),'6.6677');
    assert.equal(tot.a_menos.por_motivo.GLOSA_PARCIAL.servicos,17);assert.equal(tot.a_menos.por_motivo.RC_NAO_PAGO.servicos,5);
    assert.equal(tot.a_mais.servicos,25);assert.equal(tot.funil.valor_confere,21674);
    assert.equal(Number(tot.multas).toFixed(6),'21.226389');          // "Glosas" da faixa: total bruto
    console.log('glosas erradas',tot.glosas_erradas,'a menos',tot.a_menos.servicos,Number(tot.a_menos.us).toFixed(4));

    await t`savepoint s`;
    await assert.rejects(()=>listar({lado:'glosados'}),/Lado inválido/);
    await t`rollback to savepoint s`;
    // conferido à mão sai das possíveis glosas erradas
    await t`select neo_fat_conferir_servico('9844','246088548','conferido pela linha do 5.10')`;
    assert.equal((await listar({lado:'glosas'})).total,46);
  });
  console.log('OK: glosa × contrato quando nada foi pago; glosa parcial e conferir à mão em Possíveis glosas erradas.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
