-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 001: identidade (projeto Supabase central-neo)
--
-- A Central NEO é o cadastro único de pessoas e logins. O objetivo é que todos
-- os sistemas (TraceOne, Central NEC, Warefly…) passem a autenticar por aqui.
--
--   auth.users      → login (e-mail + senha), gerenciado pelo Supabase Auth
--   colaboradores   → a pessoa: CPF, matrículas CEMIG/Engelmig, equipe, cargo…
--                     Tem login quando usuario_id está preenchido.
--   neo_acessos     → o que cada login pode usar na Central NEO (módulos)
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Acesso à Central NEO ──────────────────────────────────────────────────
-- Só entra na NEO quem tem linha ativa aqui. ADMIN vê tudo.

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

-- ─── Colaboradores (cadastro único de pessoas) ─────────────────────────────

create table if not exists public.colaboradores (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  cpf                text unique check (cpf ~ '^\d{11}$'),        -- só números
  matricula_cemig    text unique,                                 -- ex.: e272662
  matricula_engelmig text unique,
  email              text,
  telefone           text,
  cargo              text,
  equipe             text,
  supervisor         text,
  gc                 text,                                        -- gerente de contrato
  go                 text,                                        -- gerente de operação
  base               text,                                        -- base / localidade de lotação
  data_admissao      date,
  data_desligamento  date,
  ativo              boolean not null default true,
  observacao         text,
  usuario_id         uuid unique references auth.users(id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  criado_por         uuid default auth.uid(),
  atualizado_por     uuid default auth.uid()
);

create unique index if not exists idx_colaboradores_email on public.colaboradores (lower(email)) where email is not null;
create index if not exists idx_colaboradores_nome on public.colaboradores (nome);

create or replace function public.colaboradores_touch()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  new.matricula_cemig := nullif(lower(btrim(new.matricula_cemig)), '');
  new.matricula_engelmig := nullif(btrim(new.matricula_engelmig), '');
  new.cpf := nullif(regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g'), '');
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

drop trigger if exists trg_colaboradores_touch on public.colaboradores;
create trigger trg_colaboradores_touch before insert or update on public.colaboradores
  for each row execute function public.colaboradores_touch();

alter table public.colaboradores enable row level security;

-- Dados pessoais (CPF): cada um vê o próprio cadastro; o ADMIN NEO vê e edita todos.
drop policy if exists colaboradores_proprio on public.colaboradores;
create policy colaboradores_proprio on public.colaboradores
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists colaboradores_admin on public.colaboradores;
create policy colaboradores_admin on public.colaboradores
  for all to authenticated using (neo_is_admin()) with check (neo_is_admin());

-- Nome de quem fez algo (histórico de acertos etc.) sem expor os dados pessoais
create or replace function public.neo_nomes_usuarios(p_ids uuid[])
returns table (id uuid, nome text)
language sql stable security definer
set search_path = public
as $$
  select u.id, coalesce(c.nome, split_part(u.email, '@', 1))
  from auth.users u
  left join colaboradores c on c.usuario_id = u.id
  where u.id = any (p_ids)
    and exists (select 1 from neo_acessos a where a.user_id = auth.uid() and a.ativo);
$$;

-- ─── Logins com o acesso NEO e o cadastro de cada um (só ADMIN) ────────────
-- E-mail e último acesso moram em auth.users, que o cliente não lê.

drop function if exists public.neo_listar_usuarios();
create function public.neo_listar_usuarios()
returns table (
  id uuid, email text, nome text, colaborador_id uuid, matricula_cemig text,
  ultimo_acesso timestamptz, bloqueado boolean,
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
    select u.id, u.email::text, coalesce(c.nome, split_part(u.email, '@', 1)),
           c.id, c.matricula_cemig,
           u.last_sign_in_at, coalesce(u.banned_until > now(), false),
           a.papel, coalesce(a.modulos, '{}'), coalesce(a.ativo, false)
    from auth.users u
    left join colaboradores c on c.usuario_id = u.id
    left join neo_acessos a on a.user_id = u.id
    order by (a.user_id is null), coalesce(c.nome, u.email::text);
end;
$$;
