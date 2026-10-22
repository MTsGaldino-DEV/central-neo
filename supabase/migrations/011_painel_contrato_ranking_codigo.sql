-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 011: painel com contrato 2026 por mês, ranking por código e
-- filtro da fila por código
--
-- 1. neo_vw_nsis ganha "codigos" (códigos da Tabela 03 dos itens), para o
--    painel abrir a fila filtrada por serviço.
-- 2. neo_painel_fechamento:
--    - meses: série contrato 2026 (itens com código e NSMP), ao lado do pedido
--      (Tabela CEMIG) e do pago;
--    - servicos ("O que mais pedimos"): só itens escolhidos pelo código em
--      "O que deve ser cobrado?". O histórico, sem código, fica fora.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Fila: códigos dos itens (coluna no fim) ─────────────────────────────────

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
  coalesce(i.sem_valor_pago, 0)         as itens_sem_valor_pago,
  vu.valor_reais                        as valor_us_reais,
  coalesce(i.valor_inicial_reais, 0)    as valor_inicial_reais_total,
  coalesce(i.valor_final_reais, 0)      as valor_final_reais_total,
  ls.supervisor                         as supervisor,
  i.codigos                             as codigos
from public.neo_nsis n
left join public.neo_localidade_supervisor ls on ls.localidade = n.localidade
left join lateral (
  select v.valor_reais from public.neo_valor_us v
  where n.termino is not null and v.vigencia_inicio <= neo_data_execucao(n.termino)
  order by v.vigencia_inicio desc
  limit 1
) vu on true
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
    string_agg(distinct it.equipe, ', ') as equipes,
    string_agg(distinct it.codigo, ', ') as codigos,
    sum(round(it.valor_inicial * vu.valor_reais, 2)) as valor_inicial_reais,
    sum(round(it.valor_final * vu.valor_reais, 2))   as valor_final_reais
  from public.neo_nsis_itens it
  where it.servico = n.servico
) i on true;

grant select on public.neo_vw_nsis to authenticated;

-- ─── Painel ─────────────────────────────────────────────────────────────────

create or replace function public.neo_painel_fechamento(p_inicio date, p_fim date)
returns jsonb
language sql stable
set search_path = public
as $$
  with
  nsis as (
    select * from neo_vw_nsis
    where termino is not null and neo_data_execucao(termino) between p_inicio and p_fim
  ),
  itens as (
    select * from neo_vw_itens
    where termino is not null and neo_data_execucao(termino) between p_inicio and p_fim
  ),
  abertas as (
    select *, (current_date - neo_data_execucao(termino)) as dias
    from neo_vw_nsis
    where etapa not in ('FATURADA', 'SEM_COBRANCA')
  )
  select jsonb_build_object(
    'totais', (
      select jsonb_build_object(
        'nsis', (select count(*) from nsis),
        'sem_cobranca', (select count(*) from nsis where sem_cobranca),
        'faturadas', (select count(*) from nsis where etapa = 'FATURADA'),
        'itens', count(*),
        'pedido_us', coalesce(sum(valor_inicial) filter (where nsmp is not null), 0),
        'pedido_reais', coalesce(sum(valor_inicial_reais) filter (where nsmp is not null), 0),
        'pago_us', coalesce(sum(valor_final) filter (where nspr is not null), 0),
        'pago_reais', coalesce(sum(valor_final_reais) filter (where nspr is not null), 0),
        'aguardando_us', coalesce(sum(valor_inicial) filter (where nsmp is not null and nspr is null), 0),
        'aguardando_reais', coalesce(sum(valor_inicial_reais) filter (where nsmp is not null and nspr is null), 0),
        'a_pedir_us', coalesce(sum(valor_inicial) filter (where nsmp is null), 0),
        'a_pedir_reais', coalesce(sum(valor_inicial_reais) filter (where nsmp is null), 0),
        'pedido_confirmado_us', coalesce(sum(valor_inicial) filter (where nspr is not null and valor_final is not null), 0),
        'pago_confirmado_us', coalesce(sum(valor_final) filter (where nspr is not null and valor_final is not null), 0),
        'pedido_confirmado_reais', coalesce(sum(valor_inicial_reais) filter (where nspr is not null and valor_final is not null), 0),
        'pago_confirmado_reais', coalesce(sum(valor_final_reais) filter (where nspr is not null and valor_final is not null), 0),
        'itens_sem_valor_us', count(*) filter (where valor_us_reais is null and (valor_inicial is not null or valor_final is not null))
      ) from itens
    ),
    'meses', coalesce((
      select jsonb_agg(m order by m->>'mes') from (
        select jsonb_build_object(
          'mes', to_char(date_trunc('month', neo_data_execucao(n.termino)), 'YYYY-MM'),
          'nsis', count(*),
          'sem_cobranca', count(*) filter (where n.sem_cobranca),
          'faturadas', count(*) filter (where n.etapa = 'FATURADA'),
          'pedido_us', coalesce(sum(x.pedido_us), 0),
          'pago_us', coalesce(sum(x.pago_us), 0),
          'pedido_reais', coalesce(sum(x.pedido_reais), 0),
          'pago_reais', coalesce(sum(x.pago_reais), 0),
          'contrato_us', coalesce(sum(x.contrato_us), 0),
          'contrato_reais', coalesce(sum(x.contrato_reais), 0)
        ) as m
        from nsis n
        left join lateral (
          select sum(i.valor_inicial) filter (where i.nsmp is not null)       as pedido_us,
                 sum(i.valor_final) filter (where i.nspr is not null)         as pago_us,
                 sum(i.valor_inicial_reais) filter (where i.nsmp is not null) as pedido_reais,
                 sum(i.valor_final_reais) filter (where i.nspr is not null)   as pago_reais,
                 sum(i.valor_contrato) filter (where i.nsmp is not null)        as contrato_us,
                 sum(i.valor_contrato_reais) filter (where i.nsmp is not null)  as contrato_reais
          from itens i where i.servico = n.servico
        ) x on true
        group by date_trunc('month', neo_data_execucao(n.termino))
      ) s
    ), '[]'::jsonb),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object('etapa', etapa, 'nsis', qtd, 'valor_us', us, 'valor_reais', rs))
      from (select etapa, count(*) qtd, sum(valor_inicial_total) us, sum(valor_inicial_reais_total) rs
            from nsis group by etapa) e
    ), '[]'::jsonb),
    'pendentes', coalesce((
      select jsonb_agg(jsonb_build_object('etapa', etapa, 'faixa', faixa, 'nsis', qtd, 'valor_us', us, 'valor_reais', rs))
      from (
        select etapa,
               case when dias is null then 'sem data'
                    when dias <= 30 then '0–30 dias'
                    when dias <= 60 then '31–60 dias'
                    when dias <= 90 then '61–90 dias'
                    when dias <= 180 then '91–180 dias'
                    else 'mais de 180 dias' end as faixa,
               count(*) qtd, sum(valor_inicial_total) us, sum(valor_inicial_reais_total) rs
        from abertas group by 1, 2
      ) p
    ), '[]'::jsonb),
    'localidades', coalesce((
      select jsonb_agg(l order by (l->>'pedido_us')::numeric desc) from (
        select jsonb_build_object(
          'localidade', coalesce(localidade, '—'),
          'nsis', count(distinct servico),
          'pedido_us', coalesce(sum(valor_inicial), 0),
          'pedido_reais', coalesce(sum(valor_inicial_reais), 0),
          'pago_us', coalesce(sum(valor_final) filter (where nspr is not null), 0),
          'pago_reais', coalesce(sum(valor_final_reais) filter (where nspr is not null), 0)
        ) as l
        from itens group by coalesce(localidade, '—')
        order by sum(valor_inicial) desc nulls last
        limit 10
      ) s
    ), '[]'::jsonb),
    -- "O que mais pedimos": só o que foi escolhido em "O que deve ser cobrado?" (item com código)
    'servicos', coalesce((
      select jsonb_agg(s order by (s->>'pedido_us')::numeric desc) from (
        select jsonb_build_object(
          'codigo', i.codigo,
          'descricao', coalesce(min(c.operacao || ' ' || c.atividade), min(i.descricao)),
          'itens', count(*),
          'pedido_us', coalesce(sum(i.valor_inicial), 0),
          'pedido_reais', coalesce(sum(i.valor_inicial_reais), 0)
        ) as s
        from itens i
        left join neo_contrato_itens c on c.codigo = i.codigo
        where i.codigo is not null
        group by i.codigo
        order by sum(i.valor_inicial) desc nulls last
        limit 10
      ) s
    ), '[]'::jsonb),
    'equipes', coalesce((
      select jsonb_agg(e order by (e->>'pedido_us')::numeric desc) from (
        select jsonb_build_object(
          'equipe', equipe,
          'nsis', count(distinct servico),
          'itens', count(*),
          'pedido_us', coalesce(sum(valor_inicial), 0),
          'pedido_reais', coalesce(sum(valor_inicial_reais), 0)
        ) as e
        from itens where equipe is not null and btrim(equipe) <> ''
        group by equipe
        order by sum(valor_inicial) desc nulls last
        limit 10
      ) s
    ), '[]'::jsonb),
    'qualidade', jsonb_build_object(
      'sem_data', (select count(*) from neo_nsis where termino is null),
      'data_futura', (select count(*) from neo_nsis where termino is not null and neo_data_execucao(termino) > current_date),
      'primeira_vigencia', (select min(vigencia_inicio) from neo_valor_us)
    ),
    'periodo_disponivel', (
      select jsonb_build_object('inicio', min(neo_data_execucao(termino)), 'fim', max(neo_data_execucao(termino)))
      from neo_nsis where termino is not null
    )
  );
$$;

grant execute on function public.neo_painel_fechamento(date, date) to authenticated;
