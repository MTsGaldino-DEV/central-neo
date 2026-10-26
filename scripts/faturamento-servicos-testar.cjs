// Conferência por serviço: totais fecham com as linhas, exemplos do Matheus e revisão manual.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`set local role authenticated`;
    let inicio=Date.now();
    const [t9844]=await t`select count(*)::int n,sum(creditado) cred,sum(multas) multas,sum(estorno) est,sum(qtd_linhas)::int linhas from neo_fat_servicos where fatura='9844'`;
    console.log('Agregação por serviço:',Date.now()-inicio,'ms');
    assert.equal(t9844.n,21910);assert.equal(t9844.linhas,27389);
    assert.equal(Number(t9844.cred).toFixed(6),'917.112183');
    assert.equal(Number(t9844.multas).toFixed(6),'21.226389');
    assert.equal(Number(t9844.est).toFixed(6),'7.446161');
    const s=async n=>(await t`select * from neo_fat_servicos where fatura='9844' and numserv=${n}`)[0];
    inicio=Date.now();
    const rc=await s('245530193');                                   // RC07 pago uma vez, crédito dividido nas 2 linhas
    console.log('Um serviço:',Date.now()-inicio,'ms');
    assert.equal(rc.situacao,'OK');assert.equal(rc.rc_por_atendimento,true);assert.equal(rc.motivo,null);
    const nssr=await s('242861522');                                 // dois códigos, cada um pago
    assert.deepEqual([...nssr.codigos].sort(),['7.10','7.15']);assert.equal(nssr.qtd_linhas,2);
    assert.equal(nssr.rc_por_atendimento,false);assert.equal(nssr.situacao,'OK');
    assert.equal((await s('245531435')).moto,true);                 // 6.01 Moto, fator 1
    assert.equal((await s('246450669')).tabela,'11');               // RC07→8.82 transposto
    const glosas=await s('245881140');                               // RC08 com glosas: multa e estorno à parte
    assert.ok(Number(glosas.multas)>0);assert.ok(Number(glosas.estorno)>0);assert.equal(glosas.situacao,'OK');
    const glosado=await s('245543429');                              // RC07 glosado por inteiro: a multa explica, fora do saldo
    assert.equal(Number(glosado.creditado),0);assert.equal(Number(glosado.multas).toFixed(6),Number(glosado.devido).toFixed(6));
    assert.equal(glosado.situacao,'OK');assert.equal(glosado.motivo,null);
    // revisão por serviço tira do saldo
    const alvo=(await t`select numserv from neo_fat_servicos where fatura='9844' and situacao='A_MENOS' limit 1`)[0].numserv;
    await t`select neo_fat_conferir_servico('9844',${alvo},'teste de conferência')`;
    const conf=await s(alvo);
    assert.equal(conf.situacao,'CONFERIDO');assert.equal(conf.situacao_calculo,'A_MENOS');assert.ok(conf.motivo);
    assert.equal(conf.observacao_manual,'teste de conferência');assert.equal(conf.revisao_desatualizada,false);
    await t`select neo_fat_desconferir_servico('9844',${alvo})`;
    assert.equal((await s(alvo)).situacao,'A_MENOS');
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_conferir_servico('9844',${alvo},'ab')`),/observação/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_conferir_servico('9844','nao-existe','observação válida')`),/não encontrado/);
    // relatório para o Matheus (não é asserção)
    const [dev]=await t`select sum(devido) d,count(*) filter(where parcial)::int parciais from neo_fat_servicos where fatura='9844'`;
    console.log('Devido por serviço:',Number(dev.d).toFixed(6),'· antes 857.921936 · parciais',dev.parciais);
    console.table(await t`select situacao,motivo,count(*)::int n,round(sum(abs(diferenca)),6) us from neo_fat_servicos where fatura='9844' group by 1,2 order by 1,2`);
  });
  await rollback(async t=>{
    await t`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true)`;
    await t`set local role authenticated`;
    const [r]=await t`select count(*)::int n from neo_fat_servicos`;
    assert.equal(r.n,0);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_conferir_servico('9844','1','observação válida')`),/Sem acesso/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_desconferir_servico('9844','1')`),/Sem acesso/);
  });
  console.log('OK: serviços fecham com as linhas, exemplos, revisão por serviço e acesso restrito.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await sql.end();}})();
