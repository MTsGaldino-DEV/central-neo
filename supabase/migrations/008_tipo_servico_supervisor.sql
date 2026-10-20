-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 008: tipo do serviço (GDIS) e supervisor por localidade
--
-- 1. O relatório do GDIS passa a entrar com todos os tipos (NSIS, NSRI,
--    MULTIFUNCIONAL…), sempre só Resp. = CONTRATADA. O tipo fica em
--    neo_nsis.tipo_serv (coluna "Tipo de Serv." do relatório). O que já estava
--    na base era só NSIS.
-- 2. Supervisor vem da localidade (4 primeiros dígitos da Referência), pela
--    tabela neo_localidade_supervisor.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.neo_nsis add column if not exists tipo_serv text not null default 'NSIS';
create index if not exists idx_neo_nsis_tipo_serv on public.neo_nsis (tipo_serv);

-- ─── Supervisor por localidade ──────────────────────────────────────────────

create table if not exists public.neo_localidade_supervisor (
  localidade     text primary key check (localidade ~ '^\d{4}$'),
  supervisor     text not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

alter table public.neo_localidade_supervisor enable row level security;

drop policy if exists neo_localidade_supervisor_ler on public.neo_localidade_supervisor;
create policy neo_localidade_supervisor_ler on public.neo_localidade_supervisor
  for select to authenticated using (neo_tem_modulo('fechamento'));

drop policy if exists neo_localidade_supervisor_admin on public.neo_localidade_supervisor;
create policy neo_localidade_supervisor_admin on public.neo_localidade_supervisor
  for all to authenticated using (neo_is_admin()) with check (neo_is_admin());

grant select, insert, update, delete on public.neo_localidade_supervisor to authenticated;

drop trigger if exists trg_neo_localidade_supervisor_touch on public.neo_localidade_supervisor;
create trigger trg_neo_localidade_supervisor_touch before update on public.neo_localidade_supervisor
  for each row execute function public.neo_touch();

-- ─── View da fila: tipo_serv entra pelo n.* e o supervisor vai no fim ──────
-- n.* muda de posição com a coluna nova, então a view é recriada.

drop view if exists public.neo_vw_nsis;
create view public.neo_vw_nsis
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
  ls.supervisor                         as supervisor
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
    sum(round(it.valor_inicial * vu.valor_reais, 2)) as valor_inicial_reais,
    sum(round(it.valor_final * vu.valor_reais, 2))   as valor_final_reais
  from public.neo_nsis_itens it
  where it.servico = n.servico
) i on true;

grant select on public.neo_vw_nsis to authenticated;

-- Tipos que existem na base (opções do filtro da fila)
create or replace function public.neo_tipos_servico()
returns setof text
language sql stable
set search_path = public
as $$
  select distinct tipo_serv from neo_nsis order by 1;
$$;

-- ─── Importação: passa a gravar o tipo do serviço ───────────────────────────

create or replace function public.neo_importar_nsis(p_itens jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_novas int := 0;
  v_atualizadas int := 0;
  r jsonb;
begin
  if not neo_tem_modulo('fechamento') then
    raise exception 'Sem acesso ao módulo de fechamento.';
  end if;

  for r in select * from jsonb_array_elements(p_itens) loop
    if exists (select 1 from neo_nsis where servico = r->>'servico') then
      update neo_nsis set
        tipo_serv          = coalesce(r->>'tipo_serv', tipo_serv),
        referencia         = coalesce(r->>'referencia', referencia),
        localidade         = coalesce(r->>'localidade', localidade),
        endereco           = coalesce(r->>'endereco', endereco),
        pedido_em          = coalesce((r->>'pedido_em')::timestamptz, pedido_em),
        termino            = coalesce((r->>'termino')::timestamptz, termino),
        resp               = coalesce(r->>'resp', resp),
        matricula          = coalesce(r->>'matricula', matricula),
        nome               = coalesce(r->>'nome', nome),
        tempo_deslocamento = coalesce(r->>'tempo_deslocamento', tempo_deslocamento),
        tempo_execucao     = coalesce(r->>'tempo_execucao', tempo_execucao),
        prazo_legal        = coalesce(r->>'prazo_legal', prazo_legal),
        observacao         = coalesce(r->>'observacao', observacao),
        zona               = coalesce(r->>'zona', zona),
        referencia_local   = coalesce(r->>'referencia_local', referencia_local)
      where servico = r->>'servico';
      v_atualizadas := v_atualizadas + 1;
    else
      insert into neo_nsis (
        servico, tipo_serv, referencia, localidade, endereco, pedido_em, termino, resp,
        matricula, nome, tempo_deslocamento, tempo_execucao, prazo_legal,
        observacao, zona, referencia_local, origem
      ) values (
        r->>'servico', coalesce(r->>'tipo_serv', 'NSIS'), r->>'referencia', r->>'localidade', r->>'endereco',
        (r->>'pedido_em')::timestamptz, (r->>'termino')::timestamptz, r->>'resp',
        r->>'matricula', r->>'nome', r->>'tempo_deslocamento', r->>'tempo_execucao',
        r->>'prazo_legal', r->>'observacao', r->>'zona', r->>'referencia_local', 'RELATORIO'
      );
      v_novas := v_novas + 1;
    end if;
  end loop;

  return jsonb_build_object('novas', v_novas, 'atualizadas', v_atualizadas);
end;
$$;
