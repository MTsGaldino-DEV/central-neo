-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 001: acesso por módulo + fechamento de notas NSIS
--
-- Roda no MESMO projeto Supabase do TraceOne. Só cria objetos novos, todos com
-- prefixo neo_. Nada do TraceOne é alterado.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Acesso à Central NEO ──────────────────────────────────────────────────
-- O login é o mesmo do TraceOne (auth.users), mas só entra na NEO quem tem
-- linha ativa aqui. Módulos: 'traceone', 'fechamento'. ADMIN vê tudo.

create table if not exists public.neo_acessos (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  papel         text not null default 'USUARIO' check (papel in ('ADMIN', 'USUARIO')),
  modulos       text[] not null default '{}',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create or replace function public.neo_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from neo_acessos
    where user_id = auth.uid() and ativo and papel = 'ADMIN'
  );
$$;

create or replace function public.neo_tem_modulo(p_modulo text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from neo_acessos
    where user_id = auth.uid() and ativo
      and (papel = 'ADMIN' or p_modulo = any (modulos))
  );
$$;

alter table public.neo_acessos enable row level security;

drop policy if exists neo_acessos_select on public.neo_acessos;
create policy neo_acessos_select on public.neo_acessos
  for select to authenticated using (user_id = auth.uid() or neo_is_admin());

drop policy if exists neo_acessos_admin_write on public.neo_acessos;
create policy neo_acessos_admin_write on public.neo_acessos
  for all to authenticated using (neo_is_admin()) with check (neo_is_admin());

-- Lista os usuários do login compartilhado com o acesso NEO de cada um.
-- E-mail mora em auth.users, que o cliente não lê: por isso SECURITY DEFINER.
create or replace function public.neo_listar_usuarios()
returns table (
  id uuid, email text, nome text, papel_traceone text, ativo_traceone boolean,
  papel text, modulos text[], ativo boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not neo_is_admin() then
    raise exception 'Apenas administradores da Central NEO podem listar usuários.';
  end if;
  return query
    select u.id, u.email::text, coalesce(p.name, split_part(u.email, '@', 1)),
           p.role::text, coalesce(p.is_active, false),
           a.papel, coalesce(a.modulos, '{}'), coalesce(a.ativo, false)
    from auth.users u
    left join profiles p on p.id = u.id
    left join neo_acessos a on a.user_id = u.id
    order by (a.user_id is null), coalesce(p.name, u.email);
end;
$$;

-- ─── Fechamento de notas: NSIS ───────────────────────────────────────────────
-- Uma linha por NSIS finalizada no GDIS (relatório "Serviços Executados").

create table if not exists public.neo_nsis (
  servico              text primary key,
  referencia           text,
  localidade           text,          -- 4 primeiros dígitos da referência
  endereco             text,          -- o GDIS traz aqui um resumo do pedido
  pedido_em            timestamptz,
  termino              timestamptz,   -- DT EXECUÇÃO
  resp                 text,
  matricula            text,          -- líder que executou
  nome                 text,
  tempo_deslocamento   text,
  tempo_execucao       text,
  prazo_legal          text,
  observacao           text,          -- o que a equipe fez
  zona                 text,          -- U / R
  referencia_local     text,
  sem_cobranca         boolean not null default false,
  motivo_sem_cobranca  text,
  origem               text not null default 'RELATORIO'
                       check (origem in ('RELATORIO', 'HISTORICO', 'MANUAL')),
  importado_em         timestamptz not null default now(),
  importado_por        uuid default auth.uid(),
  atualizado_em        timestamptz not null default now(),
  atualizado_por       uuid default auth.uid()
);

create index if not exists idx_neo_nsis_termino on public.neo_nsis (termino desc);
create index if not exists idx_neo_nsis_localidade on public.neo_nsis (localidade);

-- Cada pedido de pagamento feito à CEMIG para uma NSIS. Uma NSIS pode ter
-- vários (ex.: poda + espaçador). Ciclo: NSMP → NSPR + valor final → fatura (AP).
create table if not exists public.neo_nsis_itens (
  id             uuid primary key default gen_random_uuid(),
  servico        text not null references public.neo_nsis (servico) on delete cascade,
  descricao      text not null,         -- o que está sendo cobrado
  codigo         text,                  -- código do contrato (quando houver catálogo)
  equipe         text,                  -- nº da equipe que executou
  valor_inicial  numeric(12, 4),        -- US pedida
  us_adicional   numeric(12, 4),
  nsmp           text,                  -- pedido de pagamento
  nspr           text,                  -- confirmação da CEMIG
  valor_final    numeric(12, 4),        -- US paga pela CEMIG
  fatura         text,                  -- apropriação/fatura (ex.: AP 83809)
  observacao     text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create index if not exists idx_neo_nsis_itens_servico on public.neo_nsis_itens (servico);
create index if not exists idx_neo_nsis_itens_nsmp on public.neo_nsis_itens (nsmp);
create index if not exists idx_neo_nsis_itens_nspr on public.neo_nsis_itens (nspr);
create index if not exists idx_neo_nsis_itens_fatura on public.neo_nsis_itens (fatura);

create or replace function public.neo_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  return new;
end;
$$;

drop trigger if exists trg_neo_nsis_touch on public.neo_nsis;
create trigger trg_neo_nsis_touch before update on public.neo_nsis
  for each row execute function public.neo_touch();

drop trigger if exists trg_neo_nsis_itens_touch on public.neo_nsis_itens;
create trigger trg_neo_nsis_itens_touch before update on public.neo_nsis_itens
  for each row execute function public.neo_touch();

alter table public.neo_nsis enable row level security;
alter table public.neo_nsis_itens enable row level security;

drop policy if exists neo_nsis_fechamento on public.neo_nsis;
create policy neo_nsis_fechamento on public.neo_nsis
  for all to authenticated
  using (neo_tem_modulo('fechamento')) with check (neo_tem_modulo('fechamento'));

drop policy if exists neo_nsis_itens_fechamento on public.neo_nsis_itens;
create policy neo_nsis_itens_fechamento on public.neo_nsis_itens
  for all to authenticated
  using (neo_tem_modulo('fechamento')) with check (neo_tem_modulo('fechamento'));

-- ─── Visão consolidada: uma linha por NSIS, com a etapa do fechamento ────────
-- Etapas: A_FECHAR → AGUARDANDO_NSMP → AGUARDANDO_NSPR → AGUARDANDO_FATURA → FATURADA
--         (ou SEM_COBRANCA, quando não há o que pedir).
-- Divergência = item com NSPR cujo valor pago é diferente do pedido (ou vazio).

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
  end as etapa
from public.neo_nsis n
left join lateral (
  select
    count(*)                                                        as qtd_itens,
    sum(it.valor_inicial)                                           as valor_inicial_total,
    sum(it.valor_final)                                             as valor_final_total,
    count(*) filter (where it.nsmp is null)                         as sem_nsmp,
    count(*) filter (where it.nsmp is not null and it.nspr is null) as sem_nspr,
    count(*) filter (where it.nspr is not null and it.fatura is null) as sem_fatura,
    count(*) filter (where it.nspr is not null
                     and it.valor_final is distinct from it.valor_inicial) as divergentes,
    string_agg(distinct it.nsmp, ', ')   as nsmps,
    string_agg(distinct it.nspr, ', ')   as nsprs,
    string_agg(distinct it.fatura, ', ') as faturas,
    string_agg(distinct it.equipe, ', ') as equipes
  from public.neo_nsis_itens it
  where it.servico = n.servico
) i on true;

-- Contagem por etapa + totais em US, para os cartões do topo.
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
    'valor_pedido', (select coalesce(sum(valor_inicial), 0) from neo_nsis_itens where nsmp is not null),
    'valor_pago', (select coalesce(sum(valor_final), 0) from neo_nsis_itens where nspr is not null),
    'valor_pedido_confirmado', (select coalesce(sum(valor_inicial), 0) from neo_nsis_itens where nspr is not null)
  );
$$;

-- Comparativo pedido × pago agrupado por fatura (AP).
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
  order by max(it.atualizado_em) desc;
$$;

-- ─── Importação do relatório "Serviços Executados" do GDIS ──────────────────
-- Upsert pelos campos do relatório. Nunca mexe em itens, sem_cobranca ou motivo.
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
        servico, referencia, localidade, endereco, pedido_em, termino, resp,
        matricula, nome, tempo_deslocamento, tempo_execucao, prazo_legal,
        observacao, zona, referencia_local, origem
      ) values (
        r->>'servico', r->>'referencia', r->>'localidade', r->>'endereco',
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

-- ─── Importação da planilha de controle (aba "MANUTENÇÃO - 211 NSIS") ───────
-- Traz o histórico. Linha sem NSMP e sem valor = NSIS ainda a fechar (o texto
-- vira a observação). As demais viram itens. Reenviar não duplica: o item é
-- identificado por serviço + NSMP (ou serviço + descrição, quando sem NSMP).
create or replace function public.neo_importar_historico(p_itens jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_nsis int := 0;
  v_itens int := 0;
  v_ignorados int := 0;
  r jsonb;
  v_servico text;
  v_eh_item boolean;
begin
  if not neo_tem_modulo('fechamento') then
    raise exception 'Sem acesso ao módulo de fechamento.';
  end if;

  for r in select * from jsonb_array_elements(p_itens) loop
    v_servico := r->>'servico';
    v_eh_item := (r->>'nsmp') is not null or (r->>'valor_inicial') is not null;

    if not exists (select 1 from neo_nsis where servico = v_servico) then
      insert into neo_nsis (servico, termino, observacao, origem)
      values (
        v_servico,
        (r->>'termino')::timestamptz,
        case when v_eh_item then null else r->>'descricao' end,
        'HISTORICO'
      );
      v_nsis := v_nsis + 1;
    end if;

    if not v_eh_item then
      continue;
    end if;

    if exists (
      select 1 from neo_nsis_itens
      where servico = v_servico
        and (
          ((r->>'nsmp') is not null and nsmp = r->>'nsmp')
          or ((r->>'nsmp') is null and nsmp is null and descricao = coalesce(r->>'descricao', '—'))
        )
    ) then
      v_ignorados := v_ignorados + 1;
      continue;
    end if;

    insert into neo_nsis_itens (
      servico, descricao, equipe, valor_inicial, us_adicional,
      nsmp, nspr, valor_final, fatura
    ) values (
      v_servico, coalesce(r->>'descricao', '—'), r->>'equipe',
      (r->>'valor_inicial')::numeric, (r->>'us_adicional')::numeric,
      r->>'nsmp', r->>'nspr', (r->>'valor_final')::numeric, r->>'fatura'
    );
    v_itens := v_itens + 1;
  end loop;

  return jsonb_build_object('nsis_criadas', v_nsis, 'itens_criados', v_itens, 'itens_ja_existentes', v_ignorados);
end;
$$;

-- ─── Primeiro administrador ─────────────────────────────────────────────────
insert into public.neo_acessos (user_id, papel, modulos)
select id, 'ADMIN', array['traceone', 'fechamento']
from auth.users
where email = 'matheus.galdino@engelmig.com.br'
on conflict (user_id) do nothing;
