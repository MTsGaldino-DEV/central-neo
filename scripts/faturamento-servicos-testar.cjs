// Conferência por serviço: totais fecham com as linhas, exemplos do Matheus e revisão manual.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
// neo_fat_totais só abre para o dono (as telas leem pelo neo_fat_painel).
const totais=async(t,c)=>{await t`reset role`;const r=await t`select ${t(c)} from neo_fat_totais where fatura='9844'`;await t`set local role authenticated`;return r;};
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
    assert.equal(rc.codigo_principal,'RC07');                       // no RC, o item pago é o próprio RC
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
    const alvo=(await t`select numserv from neo_fat_servicos where fatura='9844' and situacao='A_MENOS' and not exists(select 1 from unnest(codigos) c where c ~ '^G[.]') limit 1`)[0].numserv;
    await t`select neo_fat_conferir_servico('9844',${alvo},'teste de conferência')`;
    const conf=await s(alvo);
    assert.equal(conf.situacao,'CONFERIDO');assert.equal(conf.situacao_calculo,'A_MENOS');assert.ok(conf.motivo);
    assert.equal(conf.observacao_manual,'teste de conferência');assert.equal(conf.revisao_desatualizada,false);
    await t`select neo_fat_desconferir_servico('9844',${alvo})`;
    assert.equal((await s(alvo)).situacao,'A_MENOS');
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_conferir_servico('9844',${alvo},'ab')`),/observação/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_conferir_servico('9844','nao-existe','observação válida')`),/não encontrado/);
    // desempenho: a lista lê o cálculo guardado por serviço, idêntico à view de cálculo
    await t`select neo_fat_recalcular('9844')`;
    assert.equal((await t`select neo_fat_recalcular('9844') d`)[0].d,false);          // já em dia: não refaz
    const [cmp]=await t`select
      (select jsonb_agg(to_jsonb(x) order by x.numserv) from (select numserv,
        -- 046/047: com código de glosa (G.xx) a glosa entra na diferença; se cobre o devido, a lista
        -- mostra GLOSADO sem motivo; se não cobre, fica A_MENOS com motivo GLOSA_PARCIAL
        case when g and situacao_calculo<>'A_MENOS' and situacao<>'CONFERIDO' then 'GLOSADO' else situacao end situacao,
        case when g and situacao_calculo<>'A_MENOS' then 'GLOSADO' else situacao_calculo end situacao_calculo,
        case when g and situacao_calculo<>'A_MENOS' then null when g then 'GLOSA_PARCIAL' else motivo end motivo,
        case when g then pago_comparado+multas-devido else diferenca end diferenca,devido,codigo_principal,pago_comparado,multas,contexto
       from (select *,exists(select 1 from unnest(codigos) c where c ~ '^G[.]') g from neo_fat_servicos where fatura='9844') y) x)
      =(select jsonb_agg(to_jsonb(x) order by x.numserv) from (select numserv,situacao,situacao_calculo,motivo,diferenca,devido,codigo_principal,pago_comparado,multas,contexto from neo_fat_servicos_lista where fatura='9844') x) igual`;
    assert.equal(cmp.igual,true);
    inicio=Date.now();
    await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_menos'})},0,50)`;
    const rapida=Date.now()-inicio;console.log('Lista com cálculo guardado:',rapida,'ms');
    assert.ok(rapida<1500,`lista levou ${rapida} ms`);
    // listagem paginada por lado
    inicio=Date.now();
    const [r]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_menos'})},0,50) d`;
    console.log('Primeira página a_menos:',Date.now()-inicio,'ms');
    assert.ok(r.d.total>0);assert.ok(r.d.servicos.length<=50);
    assert.ok(r.d.servicos.every(x=>x.situacao_calculo==='A_MENOS'));
    assert.ok(r.d.servicos.every((x,i,a)=>!i||Number(a[i-1].diferenca)<=Number(x.diferenca)));
    const [v]=await t`select sum(case when exists(select 1 from unnest(codigos) c where c ~ '^G[.]') then devido-pago_comparado-multas else -diferenca end) us,count(*)::int n from neo_fat_servicos where fatura='9844' and situacao='A_MENOS'`;
    assert.equal(Number(r.d.lados.a_menos.us).toFixed(6),Number(v.us).toFixed(6));
    assert.equal(r.d.lados.a_menos.servicos,v.n);
    const soma=Object.values(r.d.lados.a_menos.por_motivo).reduce((s,m)=>s+m.servicos,0);
    assert.equal(soma,v.n);
    const [am]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_mais'})},0,5) d`;
    assert.ok(am.d.servicos.every((x,i,a)=>x.situacao_calculo==='A_MAIS'&&(!i||Number(a[i-1].diferenca)>=Number(x.diferenca))));
    assert.ok(Number(am.d.lados.a_mais.us)>0);
    const [mot]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_menos',motivo:'RC_NAO_PAGO'})},0,50) d`;
    assert.equal(mot.d.total,r.d.lados.a_menos.por_motivo.RC_NAO_PAGO.servicos);
    assert.ok(mot.d.servicos.every(x=>x.motivo==='RC_NAO_PAGO'));
    const [big]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844'})},0,1000) d`;
    assert.equal(big.d.total,21910);assert.equal(big.d.servicos.length,1000);
    assert.ok(big.d.servicos.every((x,i,a)=>!i||a[i-1].numserv<=x.numserv));
    const [cod]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',codserv:'7.15',q:'2428615'})},0,50) d`;
    assert.ok(cod.d.servicos.some(x=>x.numserv==='242861522'));assert.ok(cod.d.servicos.every(x=>x.codigos.includes('7.15')));
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_servicos_listar('{}'::jsonb,0,1001)`),/Paginação/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_servicos_listar('{}'::jsonb,-1,50)`),/Paginação/);
    // conferido: some do lado e do total do lado; filtro "somente" mostra (além dos já conferidos à mão)
    const [jaConferidos]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_menos',conferidos:'somente'})},0,50) d`;
    await t`select neo_fat_conferir_servico('9844',${alvo},'conferido no teste')`;
    const [sem]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_menos'})},0,50) d`;
    assert.equal(sem.d.total,r.d.total-1);assert.equal(sem.d.lados.a_menos.servicos,v.n-1);
    const [so]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_menos',conferidos:'somente'})},0,50) d`;
    assert.deepEqual(so.d.servicos.map(x=>x.numserv).sort(),[...jaConferidos.d.servicos.map(x=>x.numserv),alvo].sort());
    await t`select neo_fat_desconferir_servico('9844',${alvo})`;
    // linhas do serviço (RC07: crédito dividido nas duas linhas, soma = um RC)
    const [l]=await t`select neo_fat_servico_linhas('9844','245530193') d`;
    assert.equal(l.d.length,2);assert.deepEqual(l.d.map(x=>x.codserv),['5.14','7.42']);
    assert.equal((Number(l.d[0].creditado)+Number(l.d[1].creditado)).toFixed(6),Number(rc.devido).toFixed(6));
    assert.ok('justificativa' in l.d[0]&&'devido_csc' in l.d[0]&&'moto_cod' in l.d[0]);
    // totais pré-calculados por fatura
    inicio=Date.now();
    const [p]=await t`select neo_fat_painel() d`;
    console.log('Painel (calculando):',Date.now()-inicio,'ms');
    const f=p.d.find(x=>x.fatura==='9844');
    assert.ok(p.d.every((x,i,a)=>!i||a[i-1].fim>=x.fim));
    assert.equal(f.servicos,21910);assert.equal(f.linhas,27389);
    assert.equal(Number(f.creditado).toFixed(6),'917.112183');
    assert.equal(Number(f.multas).toFixed(6),'21.226389');
    assert.equal(Number(f.estorno).toFixed(6),'7.446161');
    assert.equal(Number(f.ajustes.debito).toFixed(6),'64.963712');
    assert.equal(Number(f.ajustes.credito).toFixed(6),'95.344853');
    assert.ok(f.ajustes.itens.length>0&&'observacao' in f.ajustes.itens[0]);
    assert.equal(f.funil.importados,21910);
    assert.ok(f.funil.importados>=f.funil.equipe_identificada&&f.funil.equipe_identificada>=f.funil.codigo_no_contrato&&f.funil.codigo_no_contrato>=f.funil.valor_confere);
    assert.equal(Number(f.saldo_a_receber).toFixed(6),Number(v.us).toFixed(6));
    assert.equal(f.a_menos.servicos,v.n);
    assert.equal(Number(f.pago_a_mais).toFixed(6),Number(am.d.lados.a_mais.us).toFixed(6));
    assert.equal(f.grupos.tipo_turma.reduce((s,g)=>s+g.servicos,0),21910);
    assert.ok(f.grupos.codserv.length>0&&f.grupos.cidade.length>0);
    inicio=Date.now();await t`select neo_fat_painel()`;
    console.log('Painel (em cache):',Date.now()-inicio,'ms');
    // desatualização: reimportação simulada
    await t`reset role`;await t`update neo_fat_faturas set importado_em=now()+interval '1 minute' where id='9844'`;await t`set local role authenticated`;
    const [antes]=await totais(t,'calculado_em');
    await t`select neo_fat_painel()`;
    const [depois]=await totais(t,'calculado_em');
    assert.ok(depois.calculado_em>antes.calculado_em);
    // conferir atualiza o saldo
    const alvo2=(await t`select numserv,-diferenca d from neo_fat_servicos where fatura='9844' and situacao='A_MENOS' and not exists(select 1 from unnest(codigos) c where c ~ '^G[.]') limit 1`)[0];
    await t`select neo_fat_conferir_servico('9844',${alvo2.numserv},'aceito pela equipe')`;
    const [p2]=await totais(t,'dados');
    assert.equal((Number(f.saldo_a_receber)-Number(p2.dados.saldo_a_receber)).toFixed(6),Number(alvo2.d).toFixed(6));
    assert.equal(p2.dados.funil.conferidos,f.funil.conferidos+1);
    await t`select neo_fat_desconferir_servico('9844',${alvo2.numserv})`;
    const [p3]=await totais(t,'dados');
    assert.equal(Number(p3.dados.saldo_a_receber).toFixed(6),Number(f.saldo_a_receber).toFixed(6));
    // hashes da importação: guardados na fatura para detectar arquivo idêntico
    await t`select neo_fat_registrar_hashes('9844','aaa','bbb')`;
    const [hf]=await t`select hash_resumida,hash_completa from neo_fat_faturas where id='9844'`;
    assert.deepEqual([hf.hash_resumida,hf.hash_completa],['aaa','bbb']);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_registrar_hashes('nao-existe','a','b')`),/não encontrada/);
    // revisão final: totais guardam a impressão das entradas. Uma revisão gravada por outra
    // transação "antes" do recálculo (corrida) ainda deixa a fatura desatualizada.
    const [b4]=await t`select neo_fat_atualizar_totais('9844') d`;
    const alvo4=(await t`select numserv,-diferenca d from neo_fat_servicos where fatura='9844' and situacao='A_MENOS' and not exists(select 1 from unnest(codigos) c where c ~ '^G[.]') order by numserv limit 1`)[0];
    await t`reset role`;
    await t`insert into neo_fat_conferencias_servico(fatura,numserv,observacao,contexto,data)
      select fatura,numserv,'corrida',contexto,now()-interval '1 hour' from neo_fat_servicos where fatura='9844' and numserv=${alvo4.numserv}`;
    await t`set local role authenticated`;
    assert.ok((await t`select neo_fat_faturas_desatualizadas() d`)[0].d.includes('9844'));
    await t`select neo_fat_atualizar_totais('9844')`;
    assert.ok(!(await t`select neo_fat_faturas_desatualizadas() d`)[0].d.includes('9844'));
    const p5=(await t`select neo_fat_painel() d`)[0].d.find(x=>x.fatura==='9844');
    assert.equal(p5.desatualizado,false);
    assert.equal((Number(b4.d.saldo_a_receber)-Number(p5.saldo_a_receber)).toFixed(6),Number(alvo4.d).toFixed(6));
    await t`reset role`;await t`delete from neo_fat_conferencias_servico where fatura='9844' and numserv=${alvo4.numserv}`;await t`set local role authenticated`;
    assert.ok((await t`select neo_fat_faturas_desatualizadas() d`)[0].d.includes('9844'));   // remoção também conta
    await t`select neo_fat_atualizar_totais('9844')`;
    // revisão final: o grupo "Por código" leva aos mesmos serviços, inclusive RC
    const gRc=p5.grupos.codserv.find(x=>x.valor==='RC07');
    const [rcp]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',codigo_principal:'RC07'})},0,50) d`;
    assert.equal(rcp.d.total,gRc.servicos);
    const g715=p5.grupos.codserv.find(x=>x.valor==='7.15');
    assert.equal((await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',codigo_principal:'7.15'})},0,50) d`)[0].d.total,g715.servicos);
    assert.ok((await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',codserv:'RC07'})},0,50) d`)[0].d.total>0);
    // revisão final: um ajuste com valor mal formatado não derruba os totais
    await t`reset role`;await t`insert into neo_fat_anexos(fatura,aba,dados) values('9844','Debito_Credito','{"valor":"abc","tipoajusteapropriacao":"D"}')`;await t`set local role authenticated`;
    const [ruim]=await t`select neo_fat_atualizar_totais('9844') d`;
    assert.equal(Number(ruim.d.ajustes.debito).toFixed(6),'64.963712');
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
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_servicos_listar('{}'::jsonb,0,50)`),/Sem acesso/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_servico_linhas('9844','245530193')`),/Sem acesso/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_painel()`),/Sem acesso/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_atualizar_totais('9844')`),/Sem acesso/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_registrar_hashes('9844','a','b')`),/Sem acesso/);
    await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_faturas_desatualizadas()`),/Sem acesso/);
  });
  console.log('OK: serviços fecham com as linhas, exemplos, revisão por serviço e acesso restrito.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await sql.end();}})();
