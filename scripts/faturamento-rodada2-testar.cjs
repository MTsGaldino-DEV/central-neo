// Rodada 2: filtros por coluna, valores com contagem, totais por lado, Manutenção, histórico e valor da US.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
(async()=>{try{
  await rollback(async t=>{
    // conferências feitas à mão tiram serviços dos lados e dos totais; o teste parte sem elas
    await t`delete from neo_fat_conferencias_servico where fatura='9844'`;
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    await t`set local role authenticated`;
    const listar=async f=>(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',...f})},0,1000) d`)[0].d;
    const valores=async(f,c,b=null)=>(await t`select neo_fat_servicos_valores(${t.json({fatura:'9844',...f})},${c},${b}) d`)[0].d;
    const rejeita=async(f,re)=>{await t`savepoint s`;await assert.rejects(f,re);await t`rollback to savepoint s`;};

    let r=await listar({lado:'a_menos',tem_1ns:'sim'});
    assert.equal(r.total,3);assert.ok(r.servicos.every(s=>s.tem_1ns===true));
    const s137=r.servicos.find(s=>s.numserv==='246101137');assert.ok(s137);assert.equal(s137.na_manutencao,false);
    assert.equal((await listar({lado:'todos',tem_562:'sim',situacoes:['A_MAIS']})).total,2); // 044: 5.62 em RC paga o RC; ficam os 2 pagos como COD
    assert.equal((await listar({lado:'a_menos',multado:'sim'})).total,53); // 72 até a 039; 74 na 039; 73 na 040 (RC com homem-hora paga os códigos); 67 na 044 (5.62 em RC); 53 na 046 (G.02 vai para Glosados), sem conferências à mão
    assert.equal((await listar({lado:'todos',codigos:['1.62']})).total,61);
    r=await listar({lado:'todos',cidades:['ALPERCATA'],codigos:['1.21']});
    assert.ok(r.servicos.some(s=>s.numserv==='246101137'));assert.ok(r.servicos.every(s=>s.cidade==='ALPERCATA'));
    r=await listar({lado:'todos',diferenca_max:-0.3});
    assert.ok(r.servicos.every(s=>Number(s.diferenca)<=-0.3));assert.ok(r.servicos.some(s=>s.numserv==='246101137'));
    r=await listar({lado:'todos',ordem:{coluna:'numserv',dir:'asc'}});
    assert.ok(r.servicos[0].numserv<=r.servicos[1].numserv);
    await rejeita(()=>listar({lado:'todos',ordem:{coluna:'x;drop',dir:'asc'}}),/Ordem inválida/);
    // interseção de vários filtros com um atalho
    r=await listar({lado:'a_menos',tem_1ns:'sim',cidades:['ALPERCATA','COLUNA']});
    assert.deepEqual(r.servicos.map(s=>s.numserv),['246101137']);

    // revisão final: a soma do cabeçalho segue a lista filtrada (motivo incluso)
    r=await listar({lado:'a_menos',motivos:['RC_NAO_PAGO']});
    assert.equal(r.total,7);assert.equal(Number(r.soma).toFixed(6),'-0.778048'); // 34/-3,998762 até a 039; -4,189605 na 039; 32/-3,985038 na 040; a 041 zera os 16 RC com 0.06; 16/-1,747396 até a 043; 19/-2,294013 na 044; a 046 tira os 12 com G.02 (Glosados)
    let v=await valores({lado:'a_menos'},'motivo');
    assert.equal(v.find(x=>x.valor==='RC_NAO_PAGO').n,7);
    v=await valores({lado:'a_menos',motivos:['RC_NAO_PAGO']},'motivo');
    assert.ok(v.length>1,'a lista de valores ignora o filtro da própria coluna');
    v=await valores({lado:'a_menos',motivos:['RC_NAO_PAGO']},'cidade');
    assert.equal(v.reduce((a,x)=>a+x.n,0),7,'as outras colunas respeitam o filtro');
    v=await valores({lado:'todos'},'codigos','1.');
    assert.ok(v.length&&v.every(x=>x.valor.includes('1.')));
    await valores({lado:'todos'},'cidade','%');await valores({lado:'todos'},'cidade',"o'_");
    await rejeita(()=>valores({lado:'todos'},'senha'),/Coluna inválida/);

    const tot=(await t`select neo_fat_atualizar_totais('9844') d`)[0].d;
    // Até a 039: 106 serviços, pago 5,1968, devido 12,6441, 7,4473 a menos e 88 fora (homem-hora sem regra). 0.06 zerado na 041. Na 044 (5.62 em RC): 161 → 155, pago 13,5243 → 13,3566, devido 21,9248 → 21,5006, 8,4005 → 8,1440 US. Na 046 os 14 com G.02 vão para Glosados: 141, devido 19,9130, 6,5564 US.
    assert.equal(tot.a_menos.servicos,141);assert.equal(tot.a_menos.com_1ns,3);
    assert.equal(Number(tot.a_menos.pago).toFixed(4),'13.3566');assert.equal(Number(tot.a_menos.devido).toFixed(4),'19.9130');
    assert.equal(Number(tot.a_menos.us).toFixed(4),'6.5564');
    assert.equal(tot.glosados.servicos,345);
    assert.equal(tot.a_mais.c562.servicos,2);assert.equal(tot.fora_contrato,26);

    let m=(await t`select neo_fat_servico_manutencao('246101137') d`)[0].d;
    assert.deepEqual(m,{existe:false,itens:[]});
    m=(await t`select neo_fat_servico_manutencao('245579601') d`)[0].d;
    assert.equal(m.existe,true);assert.equal(m.itens.length,1);assert.equal(Number(m.itens[0].valor),0.06);assert.equal(m.itens[0].codigo,null);
    // serviço na Manutenção sem item com valor: existe, mas sem itens
    const [semValor]=await t`select n.servico from neo_nsis n where not exists(select 1 from neo_nsis_itens i where i.servico=n.servico and coalesce(i.valor_final,0)<>0) limit 1`;
    if(semValor){m=(await t`select neo_fat_servico_manutencao(${semValor.servico}) d`)[0].d;assert.equal(m.existe,true);assert.deepEqual(m.itens,[]);}

    await t`select neo_fat_conferir_servico('9844','246101137','teste')`;
    await t`select neo_fat_desconferir_servico('9844','246101137')`;
    const h=(await t`select neo_fat_servico_historico('9844','246101137') d`)[0].d;
    assert.deepEqual(h.slice(0,2).map(e=>e.tipo),['DESCONFERIDO','CONFERIDO']);
    assert.equal(h[1].observacao,'teste');assert.equal(h.at(-1).tipo,'IMPORTADA');

    assert.equal(Number((await t`select neo_fat_valor_us() d`)[0].d.valor),2964.33);
    await t`select neo_doc_avaliar('painel',true)`;
    await t`reset role`;
    assert.equal((await t`select count(*)::int n from neo_doc_avaliacoes where pagina='painel' and usuario=${admin.user_id}`)[0].n>=1,true);
    // sem o módulo
    await t`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true)`;
    await t`set local role authenticated`;
    await rejeita(()=>valores({lado:'todos'},'cidade'),e=>e.code==='42501');
  });
  console.log('OK: filtros por coluna, valores, totais por lado, Manutenção, histórico e valor da US.');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
