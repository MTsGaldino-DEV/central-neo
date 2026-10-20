-- Central NEO — 002: comparativo por fatura ordenado pelo número da AP (mais recente primeiro)

create or replace function public.neo_resumo_faturas()
returns table (fatura text, qtd_itens bigint, qtd_nsis bigint, valor_pedido numeric, valor_pago numeric, divergentes bigint)
language sql stable
set search_path = public
as $$
  select it.fatura,
         count(*),
         count(distinct it.servico),
         coalesce(sum(it.valor_inicial), 0),
         coalesce(sum(it.valor_final), 0),
         count(*) filter (where it.valor_final is distinct from it.valor_inicial)
  from neo_nsis_itens it
  where it.fatura is not null
  group by it.fatura
  order by (substring(it.fatura from '\d+'))::bigint desc nulls last, it.fatura;
$$;
