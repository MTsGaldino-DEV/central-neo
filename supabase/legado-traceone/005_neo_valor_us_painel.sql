-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 005: valor da US em reais (apostilamento) e painel de gestão
--
-- O contrato paga em US (unidade de serviço). O valor da US em reais muda por
-- apostilamento; vale o valor vigente na DATA DE EXECUÇÃO da NSIS (Término):
--
--   R$ do item = round(US do item × valor da US na data de execução, 2)
--
-- Os valores ficam em neo_valor_us (uma linha por início de vigência) e são
-- mantidos pelo ADMIN NEO na tela "Tabela de valores". Como o R$ é calculado
-- na consulta, corrigir um valor da US corrige todos os relatórios.
-- NSIS sem data de execução, ou anterior à primeira vigência, fica sem R$.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.neo_valor_us (
  vigencia_inicio  date primary key,
  valor_reais      numeric(12, 2) not null check (valor_reais > 0),
  descricao        text,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid default auth.uid()
);

alter table public.neo_valor_us enable row level security;

drop policy if exists neo_valor_us_ler on public.neo_valor_us;
create policy neo_valor_us_ler on public.neo_valor_us
  for select to authenticated using (neo_tem_modulo('fechamento'));

drop policy if exists neo_valor_us_admin on public.neo_valor_us;
create policy neo_valor_us_admin on public.neo_valor_us
  for all to authenticated using (neo_is_admin()) with check (neo_is_admin());

grant select, insert, update, delete on public.neo_valor_us to authenticated;

-- Apostilamento 2026 (o reajuste é anual, em 24/05)
insert into public.neo_valor_us (vigencia_inicio, valor_reais, descricao) values
  ('2025-05-24', 2880.23, 'Valores US / 2026: valor até 23/05/2026'),
  ('2026-05-24', 2964.33, 'Valores US / 2026: valor a partir de 24/05/2026')
on conflict (vigencia_inicio) do nothing;

-- Data de execução no fuso de Brasília
create or replace function public.neo_data_execucao(p_termino timestamptz)
returns date
language sql immutable
as $$ select (p_termino at time zone 'America/Sao_Paulo')::date $$;

-- ─── Itens com R$ ────────────────────────────────────────────────────────────

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
  round(it.valor_final * vu.valor_reais, 2)    as valor_final_reais
from public.neo_nsis_itens it
join public.neo_nsis n on n.servico = it.servico
left join lateral (
  select v.valor_reais from public.neo_valor_us v
  where n.termino is not null and v.vigencia_inicio <= neo_data_execucao(n.termino)
  order by v.vigencia_inicio desc
  limit 1
) vu on true;

-- ─── NSIS: acrescenta o valor da US e os totais em R$ (colunas no fim) ─────

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
  coalesce(i.valor_final_reais, 0)      as valor_final_reais_total
from public.neo_nsis n
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
    sum(round(it.valor_inicial * vu.valor_reais, 2)) as valor_inicial_reais,
    sum(round(it.valor_final * vu.valor_reais, 2))   as valor_final_reais
  from public.neo_nsis_itens it
  where it.servico = n.servico
) i on true;

-- ─── Resumo da fila: mesmos números, agora também em R$ ─────────────────────

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
    'valor_pedido_confirmado', (select coalesce(sum(valor_inicial), 0) from neo_nsis_itens
                                where nspr is not null and valor_final is not null),
    'valor_pago_confirmado', (select coalesce(sum(valor_final), 0) from neo_nsis_itens
                              where nspr is not null and valor_final is not null),
    'valor_pedido_reais', (select coalesce(sum(valor_inicial_reais), 0) from neo_vw_itens where nsmp is not null),
    'valor_pago_reais', (select coalesce(sum(valor_final_reais), 0) from neo_vw_itens where nspr is not null),
    'valor_pedido_confirmado_reais', (select coalesce(sum(valor_inicial_reais), 0) from neo_vw_itens
                                      where nspr is not null and valor_final is not null),
    'valor_pago_confirmado_reais', (select coalesce(sum(valor_final_reais), 0) from neo_vw_itens
                                    where nspr is not null and valor_final is not null),
    -- itens com valor em US mas sem valor da US cadastrado para a data (ou sem data)
    'itens_sem_valor_us', (select count(*) from neo_vw_itens
                           where valor_us_reais is null and (valor_inicial is not null or valor_final is not null))
  );
$$;

drop function if exists public.neo_resumo_faturas();
create function public.neo_resumo_faturas()
returns table (fatura text, qtd_itens bigint, qtd_nsis bigint, valor_pedido numeric, valor_pago numeric,
               divergentes bigint, sem_valor_pago bigint, valor_pedido_reais numeric, valor_pago_reais numeric)
language sql stable
set search_path = public
as $$
  select it.fatura,
         count(*),
         count(distinct it.servico),
         coalesce(sum(it.valor_inicial), 0),
         coalesce(sum(it.valor_final), 0),
         count(*) filter (where it.valor_final is not null and it.valor_final is distinct from it.valor_inicial),
         count(*) filter (where it.valor_final is null),
         coalesce(sum(it.valor_inicial_reais), 0),
         coalesce(sum(it.valor_final_reais), 0)
  from neo_vw_itens it
  where it.fatura is not null
  group by it.fatura
  order by (substring(it.fatura from '\d+'))::bigint desc nulls last, it.fatura;
$$;

-- ─── Painel de gestão ───────────────────────────────────────────────────────
-- Período = data de execução (Término) entre p_inicio e p_fim, inclusive.
-- O "pendente" (backlog e idade) é sempre a foto de hoje, sem filtro de período.

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
          'pago_reais', coalesce(sum(x.pago_reais), 0)
        ) as m
        from nsis n
        left join lateral (
          select sum(i.valor_inicial) filter (where i.nsmp is not null)       as pedido_us,
                 sum(i.valor_final) filter (where i.nspr is not null)         as pago_us,
                 sum(i.valor_inicial_reais) filter (where i.nsmp is not null) as pedido_reais,
                 sum(i.valor_final_reais) filter (where i.nspr is not null)   as pago_reais
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
    'servicos', coalesce((
      select jsonb_agg(s order by (s->>'pedido_us')::numeric desc) from (
        select jsonb_build_object(
          'codigo', min(codigo),
          'descricao', min(descricao),
          'itens', count(*),
          'pedido_us', coalesce(sum(valor_inicial), 0),
          'pedido_reais', coalesce(sum(valor_inicial_reais), 0)
        ) as s
        from itens
        group by coalesce(codigo, upper(btrim(regexp_replace(descricao, '\s+', ' ', 'g'))))
        order by sum(valor_inicial) desc nulls last
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
grant execute on function public.neo_resumo_faturas() to authenticated;
grant execute on function public.neo_data_execucao(timestamptz) to authenticated;
grant select on public.neo_vw_itens to authenticated;
