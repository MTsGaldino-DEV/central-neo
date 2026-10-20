-- Central NEO — 003: separa "pago diferente do pedido" de "NSPR sem valor pago"
--
-- Na planilha histórica muitos itens têm NSPR mas o VALOR FINAL vazio. Contar
-- isso como divergência distorcia o comparativo (somava como pago 0). Agora:
--   divergente     = tem NSPR, tem valor pago, e ele é diferente do pedido
--   sem valor pago = tem NSPR, mas o valor pago não foi informado
-- O "pago − pedido" só compara itens que têm os dois valores.

create or replace view public.neo_vw_nsis
with (security_invoker = true)
as
select
  n.*,
  coalesce(i.qtd_itens, 0)              as qtd_itens,
  coalesce(i.valor_inicial_total, 0)    as valor_inicial_total,
  coalesce(i.valor_final_total, 0)      as valor_final_total,
  coalesce(i.sem_nsmp, 0)               as itens_sem_nsmp,
  coalesce(i.sem_nspr, 0)               as itens_sem_nspr,
  coalesce(i.sem_fatura, 0)             as itens_sem_fatura,
  coalesce(i.divergentes, 0)            as itens_divergentes,
  i.nsmps, i.nsprs, i.faturas, i.equipes,
  case
    when n.sem_cobranca then 'SEM_COBRANCA'
    when coalesce(i.qtd_itens, 0) = 0 then 'A_FECHAR'
    when i.sem_nsmp > 0 then 'AGUARDANDO_NSMP'
    when i.sem_nspr > 0 then 'AGUARDANDO_NSPR'
    when i.sem_fatura > 0 then 'AGUARDANDO_FATURA'
    else 'FATURADA'
  end as etapa,
  coalesce(i.sem_valor_pago, 0)         as itens_sem_valor_pago
from public.neo_nsis n
left join lateral (
  select
    count(*)                                                        as qtd_itens,
    sum(it.valor_inicial)                                           as valor_inicial_total,
    sum(it.valor_final)                                             as valor_final_total,
    count(*) filter (where it.nsmp is null)                         as sem_nsmp,
    count(*) filter (where it.nsmp is not null and it.nspr is null) as sem_nspr,
    count(*) filter (where it.nspr is not null and it.fatura is null) as sem_fatura,
    count(*) filter (where it.nspr is not null and it.valor_final is not null
                     and it.valor_final is distinct from it.valor_inicial) as divergentes,
    count(*) filter (where it.nspr is not null and it.valor_final is null) as sem_valor_pago,
    string_agg(distinct it.nsmp, ', ')   as nsmps,
    string_agg(distinct it.nspr, ', ')   as nsprs,
    string_agg(distinct it.fatura, ', ') as faturas,
    string_agg(distinct it.equipe, ', ') as equipes
  from public.neo_nsis_itens it
  where it.servico = n.servico
) i on true;

create or replace function public.neo_resumo_fechamento()
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'etapas', coalesce((select jsonb_object_agg(etapa, qtd)
                        from (select etapa, count(*) qtd from neo_vw_nsis group by etapa) e), '{}'::jsonb),
    'total', (select count(*) from neo_nsis),
    'divergentes', (select count(*) from neo_vw_nsis where itens_divergentes > 0),
    'sem_valor_pago', (select count(*) from neo_vw_nsis where itens_sem_valor_pago > 0),
    'valor_pedido', (select coalesce(sum(valor_inicial), 0) from neo_nsis_itens where nsmp is not null),
    'valor_pago', (select coalesce(sum(valor_final), 0) from neo_nsis_itens where nspr is not null),
    -- só itens com pedido e pago informados, para a diferença ser comparável
    'valor_pedido_confirmado', (select coalesce(sum(valor_inicial), 0) from neo_nsis_itens
                                where nspr is not null and valor_final is not null),
    'valor_pago_confirmado', (select coalesce(sum(valor_final), 0) from neo_nsis_itens
                              where nspr is not null and valor_final is not null)
  );
$$;

drop function if exists public.neo_resumo_faturas();
create function public.neo_resumo_faturas()
returns table (fatura text, qtd_itens bigint, qtd_nsis bigint, valor_pedido numeric, valor_pago numeric,
               divergentes bigint, sem_valor_pago bigint)
language sql stable
set search_path = public
as $$
  select it.fatura,
         count(*),
         count(distinct it.servico),
         coalesce(sum(it.valor_inicial), 0),
         coalesce(sum(it.valor_final), 0),
         count(*) filter (where it.valor_final is not null and it.valor_final is distinct from it.valor_inicial),
         count(*) filter (where it.valor_final is null)
  from neo_nsis_itens it
  where it.fatura is not null
  group by it.fatura
  order by (substring(it.fatura from '\d+'))::bigint desc nulls last, it.fatura;
$$;
