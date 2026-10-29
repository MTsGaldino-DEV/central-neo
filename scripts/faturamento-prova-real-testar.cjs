// Prova real do Faturamento (Matheus, 29/10/2026: "não pode ter nenhuma divergência de dados").
// Para cada fatura importada: planilha (neo_fat_linhas) = lista por serviço = totais do Painel, cada
// serviço numa única situação, diferença coerente com a regra e o resumo da Conferência = soma da lista.
// Roda numa transação desfeita; aplica a 048 se o banco ainda não tiver.
const fs=require('fs'),assert=require('node:assert/strict');
const postgres=require('../../traceone/frontend/node_modules/postgres');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
const rollback=async f=>{try{await sql.begin(async t=>{await f(t);throw new Error('rollback');});}catch(e){if(e.message!=='rollback')throw e;}};
const igual=(a,b,msg)=>assert.equal(Number(a).toFixed(6),Number(b).toFixed(6),msg);
(async()=>{try{
  await rollback(async t=>{
    const [{v}]=await t`select neo_fat_impressao(id)->>0 v from neo_fat_faturas limit 1`;
    if(v<'048')await t.unsafe(fs.readFileSync('supabase/migrations/048_faturamento_glosa_conferir.sql','utf8'));
    const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
    await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
    const faturas=(await t`select id from neo_fat_faturas order by id`).map(f=>f.id);
    assert.ok(faturas.length>0);
    for(const fatura of faturas){
      const tot=(await t`select neo_fat_atualizar_totais(${fatura}) d`)[0].d;
      // 1. planilha = lista = Painel (crédito, glosa, estorno, linhas e serviços)
      const [pl]=await t`select count(*)::int linhas,count(distinct l.numserv)::int servicos,
        sum((l.dados->>'ustotal')::numeric) credito,
        sum(greatest(-coalesce((l.dados->>'usglosa')::numeric,0),0)) glosa,sum(greatest(coalesce((l.dados->>'usglosa')::numeric,0),0)) estorno
        from neo_fat_linhas l where l.fatura=${fatura}`;
      const [li]=await t`select count(*)::int servicos,sum(qtd_linhas)::int linhas,sum(creditado) credito,sum(multas) glosa,sum(estorno) estorno,
        coalesce(sum(devido),0) devido from neo_fat_servicos_lista where fatura=${fatura}`;
      assert.equal(li.servicos,pl.servicos,`${fatura}: serviços`);assert.equal(li.linhas,pl.linhas,`${fatura}: linhas`);
      igual(li.credito,pl.credito,`${fatura}: crédito da planilha × lista`);igual(li.glosa,pl.glosa,`${fatura}: glosa`);igual(li.estorno,pl.estorno,`${fatura}: estorno`);
      assert.equal(tot.servicos,pl.servicos);assert.equal(tot.linhas,pl.linhas);
      igual(tot.creditado,pl.credito,`${fatura}: Valor pago do Painel`);igual(tot.multas,pl.glosa,`${fatura}: Glosas do Painel`);
      igual(tot.estorno,pl.estorno);igual(tot.devido,li.devido,`${fatura}: Contrato previa do Painel`);

      // 2. cada serviço numa única situação conhecida; diferença coerente com a regra
      const ruins=await t`select numserv,situacao_calculo,motivo,diferenca,pago_comparado,multas,devido,glosado from neo_fat_servicos_lista
        where fatura=${fatura} and not (
          case
           when situacao_calculo not in ('OK','A_MENOS','A_MAIS','FORA_CONTRATO','A_CONFERIR') then false
           when situacao_calculo='FORA_CONTRATO' then devido is null and diferenca is null
           when situacao_calculo='A_CONFERIR' then glosado and diferenca is null and motivo in ('GLOSA_SEM_QUANTIDADE','GLOSA_ACIMA')
           when glosado then diferenca=pago_comparado+multas-devido and (situacao_calculo<>'A_MENOS' or motivo='GLOSA_PARCIAL')
           else diferenca=pago_comparado-devido and motivo is distinct from 'GLOSA_PARCIAL' end)`;
      assert.deepEqual([...ruins],[],`${fatura}: serviços fora da regra`);
      const [sit]=await t`select count(*)::int n,count(*) filter(where situacao in ('OK','A_MENOS','A_MAIS','FORA_CONTRATO','A_CONFERIR','CONFERIDO'))::int conhecidas
        from neo_fat_servicos_lista where fatura=${fatura}`;
      assert.equal(sit.conhecidas,sit.n,`${fatura}: situação desconhecida`);

      // 3. cards e funil do Painel = soma da lista (sem os conferidos à mão)
      const [sl]=await t`select
        count(*) filter(where situacao='A_MENOS')::int menos,coalesce(sum(-diferenca) filter(where situacao='A_MENOS'),0) us_menos,
        count(*) filter(where situacao='A_MAIS')::int mais,coalesce(sum(diferenca) filter(where situacao='A_MAIS'),0) us_mais,
        count(*) filter(where situacao<>'CONFERIDO' and motivo in ('GLOSA_PARCIAL','GLOSA_SEM_QUANTIDADE','GLOSA_ACIMA'))::int glosas,
        count(*) filter(where situacao='CONFERIDO')::int conferidos,
        count(*) filter(where tipo_turma is not null and situacao_calculo='OK')::int confere
        from neo_fat_servicos_lista where fatura=${fatura}`;
      assert.equal(tot.a_menos.servicos,sl.menos);igual(tot.a_menos.us,sl.us_menos,`${fatura}: card Pagou a menos`);
      assert.equal(tot.a_mais.servicos,sl.mais);igual(tot.a_mais.us,sl.us_mais,`${fatura}: card Pagou a mais`);
      assert.equal(tot.glosas_erradas.servicos,sl.glosas);
      assert.equal(tot.glosas_erradas.parcial.servicos+tot.glosas_erradas.conferir.servicos,tot.glosas_erradas.servicos);
      assert.equal(tot.funil.valor_confere,sl.confere);assert.equal(tot.funil.conferidos,sl.conferidos);
      igual(Object.values(tot.a_menos.por_motivo).reduce((s,m)=>s+Number(m.us),0),tot.a_menos.us,`${fatura}: motivos do a menos`);

      // 4. resumo da Conferência = soma dos serviços filtrados (todas as páginas)
      await t`set local role authenticated`;
      for(const f of [{lado:'todos'},{lado:'a_menos'},{lado:'glosas'},{lado:'todos',cidades:['ALPERCATA']}]){
        const r=(await t`select neo_fat_servicos_listar(${t.json({fatura,...f})},0,1000) d`)[0].d;
        const [s]=await t`select coalesce(sum(pago_comparado),0) pago,coalesce(sum(devido),0) contrato,coalesce(sum(multas),0) glosa,coalesce(sum(diferenca),0) dif,count(*)::int n
          from neo_fat_servicos_filtrar(${fatura},${t.json({fatura,...f})},true)`;
        assert.equal(r.total,s.n);igual(r.resumo.pago,s.pago,`${fatura} ${JSON.stringify(f)}: pago`);igual(r.resumo.contrato,s.contrato);
        igual(r.resumo.glosa,s.glosa);igual(r.resumo.diferenca,s.dif);igual(r.soma,s.dif);
      }
      await t`reset role`;
      await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
      console.log(`${fatura}: ${pl.linhas} linhas, ${pl.servicos} serviços, crédito ${Number(pl.credito).toFixed(6)}, glosa ${Number(pl.glosa).toFixed(6)} — confere`);
    }
  });
  console.log('OK: prova real (planilha = lista = Painel = Conferência; cada serviço numa situação).');
}catch(e){console.error(e);process.exitCode=1;}finally{await sql.end();}})();
