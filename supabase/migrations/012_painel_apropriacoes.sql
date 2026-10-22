-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 012: apropriações (AP/fatura) com mais valor no painel
--
-- As 10 APs com maior valor pago entre os itens executados no período
-- (mesma data de execução do resto do painel). Também traz o pedido, para
-- mostrar a diferença, e quantas NSIS entraram em cada AP.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.neo_painel_apropriacoes(p_inicio date, p_fim date)
returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(a order by (a->>'pago_us')::numeric desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'fatura', fatura,
      'nsis', count(distinct servico),
      'itens', count(*),
      'pedido_us', coalesce(sum(valor_inicial), 0),
      'pedido_reais', coalesce(sum(valor_inicial_reais), 0),
      'pago_us', coalesce(sum(valor_final), 0),
      'pago_reais', coalesce(sum(valor_final_reais), 0)
    ) as a
    from neo_vw_itens
    where fatura is not null
      and termino is not null and neo_data_execucao(termino) between p_inicio and p_fim
    group by fatura
    order by sum(valor_final) desc nulls last
    limit 10
  ) s;
$$;

grant execute on function public.neo_painel_apropriacoes(date, date) to authenticated;
