-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 010: Contrato 2026 × Tabela CEMIG × Pago
--
-- A CEMIG paga pela planilha "Contratão 2024 (Utilizado CEMIG)", aba
-- "Fechamento - NSIS". Em 2026-10-21 ela foi comparada código a código com o
-- Anexo VI (Tabela 03): os 155 códigos e valores são iguais (rural = +20%).
-- As diferenças entre os dois contratos aparecem como acertos na tela
-- "Tabela de valores":
--
--   fator_original = Contrato 2026 (Anexo VI publicado, não muda)
--   fator_us       = Tabela CEMIG (valor em vigor, com os acertos)
--
-- Métricas por item (só itens lançados com código da Tabela 03):
--   Contrato 2026 = fator_original × quantidade × 1,2 se rural
--   Tabela CEMIG  = valor_inicial (pedido, com o fator da época)
--   Pago          = valor_final (devolvido na NSPR)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Desfaz os acertos de teste de 2026-10-20 ───────────────────────────────
update public.neo_contrato_itens set fator_us = fator_original
where codigo in ('704055', '704093') and fator_original is not null;

delete from public.neo_contrato_historico where codigo in ('703994', '704055', '704093');

-- ─── Itens: valor pelo contrato 2026 (colunas no fim) ───────────────────────

create or replace view public.neo_vw_itens
with (security_invoker = true)
as
select
  it.*,
  n.termino,
  n.localidade,
  n.sem_cobranca,
  vu.valor_reais                               as valor_us_reais,
  round(it.valor_inicial * vu.valor_reais, 2)  as valor_inicial_reais,
  round(it.valor_final * vu.valor_reais, 2)    as valor_final_reais,
  c.fator_original                             as fator_contrato,
  vc.valor                                     as valor_contrato,
  round(vc.valor * vu.valor_reais, 2)          as valor_contrato_reais
from public.neo_nsis_itens it
join public.neo_nsis n on n.servico = it.servico
left join public.neo_contrato_itens c on c.codigo = it.codigo
left join lateral (
  select round(c.fator_original * it.quantidade * case when it.rural then 1.2 else 1 end, 4) as valor
) vc on true
left join lateral (
  select v.valor_reais from public.neo_valor_us v
  where n.termino is not null and v.vigencia_inicio <= neo_data_execucao(n.termino)
  order by v.vigencia_inicio desc
  limit 1
) vu on true;

-- ─── Painel: comparação dos contratos ───────────────────────────────────────
-- Base comparável: itens com código da Tabela 03, já pagos (NSPR + valor pago).
-- Assim as três barras falam dos mesmos itens.

create or replace function public.neo_painel_contratos(p_inicio date, p_fim date)
returns jsonb
language sql stable
set search_path = public
as $$
  with
  itens as (
    select * from neo_vw_itens
    where termino is not null and neo_data_execucao(termino) between p_inicio and p_fim
  ),
  base as (
    select * from itens
    where valor_contrato is not null and nspr is not null and valor_final is not null
  )
  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'itens', count(*),
        'nsis', count(distinct servico),
        'contrato_us', coalesce(sum(valor_contrato), 0),
        'contrato_reais', coalesce(sum(valor_contrato_reais), 0),
        'cemig_us', coalesce(sum(valor_inicial), 0),
        'cemig_reais', coalesce(sum(valor_inicial_reais), 0),
        'pago_us', coalesce(sum(valor_final), 0),
        'pago_reais', coalesce(sum(valor_final_reais), 0)
      ) from base
    ),
    -- fora da comparação: com código mas ainda sem pagamento, e sem código (histórico)
    'aguardando_pagamento', (select count(*) from itens where valor_contrato is not null
                             and (nspr is null or valor_final is null)),
    'sem_codigo', (select count(*) from itens where valor_contrato is null),
    'meses', coalesce((
      select jsonb_agg(m order by m->>'mes') from (
        select jsonb_build_object(
          'mes', to_char(date_trunc('month', neo_data_execucao(termino)), 'YYYY-MM'),
          'itens', count(*),
          'contrato_us', sum(valor_contrato),
          'contrato_reais', coalesce(sum(valor_contrato_reais), 0),
          'cemig_us', sum(valor_inicial),
          'cemig_reais', coalesce(sum(valor_inicial_reais), 0),
          'pago_us', sum(valor_final),
          'pago_reais', coalesce(sum(valor_final_reais), 0)
        ) as m
        from base
        group by date_trunc('month', neo_data_execucao(termino))
      ) s
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.neo_painel_contratos(date, date) to authenticated;
grant select on public.neo_vw_itens to authenticated;
