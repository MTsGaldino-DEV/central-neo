-- Lotes são preparados separadamente; a troca da fatura ocorre numa transação.
create table public.neo_fat_faturas (
  id text primary key, arquivo text not null, inicio date not null, fim date not null,
  importado_em timestamptz not null default now(), usuario uuid default auth.uid(),
  check (fim >= inicio)
);
create table public.neo_fat_linhas (
  fatura text not null references public.neo_fat_faturas(id), id text not null,
  numserv text not null, tipo_serv text not null, codserv text not null, cidade text not null,
  dados jsonb not null, primary key(fatura,id)
);
create index neo_fat_servico on public.neo_fat_linhas(fatura,numserv);
create index neo_fat_codigo on public.neo_fat_linhas(fatura,codserv);
create table public.neo_fat_anexos (
  id bigint generated always as identity primary key,
  fatura text not null references public.neo_fat_faturas(id), aba text not null, dados jsonb not null
);
create index neo_fat_anexo_fatura on public.neo_fat_anexos(fatura,aba);
create index neo_fat_anexo_servico on public.neo_fat_anexos(fatura,(dados->>'numserv'),(dados->>'codserv'));
create table public.neo_fat_vinculos (
  fatura text not null references public.neo_fat_faturas(id), numserv text not null,
  numvei text, ident_turma text, usuario uuid default auth.uid(), atualizado_em timestamptz default now(),
  primary key(fatura,numserv), check (numvei is not null or ident_turma is not null)
);
create table public.neo_fat_importacoes (
  id uuid primary key default gen_random_uuid(), usuario uuid not null default auth.uid(),
  fatura text not null, arquivo text not null, inicio date not null, fim date not null,
  contagens jsonb not null, criada_em timestamptz default now(), check (fim >= inicio)
);
create table public.neo_fat_lotes (
  importacao uuid references public.neo_fat_importacoes(id) on delete cascade,
  aba text not null, numero integer not null check(numero >= 0), dados jsonb not null,
  primary key(importacao,aba,numero), check(jsonb_typeof(dados)='array' and jsonb_array_length(dados)<=2000)
);
do $$ declare t text; begin
  foreach t in array array['faturas','linhas','anexos','vinculos','importacoes','lotes'] loop
    execute format('alter table public.neo_fat_%I enable row level security',t);
    execute format('create policy neo_fat_ler on public.neo_fat_%I for select to authenticated using (neo_tem_modulo(''faturamento''))',t);
    execute format('grant select on public.neo_fat_%I to authenticated',t);
  end loop;
end $$;
create function public.neo_fat_iniciar(p_fatura text,p_arquivo text,p_inicio date,p_fim date,p_contagens jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
  if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.'; end if;
  if coalesce(p_fatura,'')='' or coalesce((p_contagens->>'US_Servico')::int,0)<1 then raise exception 'Fatura vazia.'; end if;
  delete from neo_fat_importacoes where usuario=auth.uid() and criada_em<now()-interval '1 day';
  insert into neo_fat_importacoes(fatura,arquivo,inicio,fim,contagens) values(p_fatura,p_arquivo,p_inicio,p_fim,p_contagens) returning id into v;
  return v;
end $$;
create function public.neo_fat_enviar_lote(p_importacao uuid,p_aba text,p_numero int,p_dados jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not neo_tem_modulo('faturamento') or not exists(select 1 from neo_fat_importacoes where id=p_importacao and usuario=auth.uid()) then raise exception 'Importação não autorizada.'; end if;
  if p_aba not in ('US_Servico','US_Turma','Evento_Glosa','Glosa','Debito_Credito') then raise exception 'Aba inválida.'; end if;
  insert into neo_fat_lotes values(p_importacao,p_aba,p_numero,p_dados)
  on conflict(importacao,aba,numero) do update set dados=excluded.dados;
end $$;
create function public.neo_fat_finalizar(p_importacao uuid) returns void
language plpgsql security definer set search_path=public as $$
declare imp neo_fat_importacoes; a text; qtd int;
begin
  select * into imp from neo_fat_importacoes where id=p_importacao and usuario=auth.uid() for update;
  if not found or not neo_tem_modulo('faturamento') then raise exception 'Importação não autorizada.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('neo_fat_'||imp.fatura,0));
  foreach a in array array['US_Servico','US_Turma','Evento_Glosa','Glosa','Debito_Credito'] loop
    select coalesce(sum(jsonb_array_length(dados)),0) into qtd from neo_fat_lotes where importacao=imp.id and aba=a;
    if qtd<>coalesce((imp.contagens->>a)::int,-1) then raise exception 'Lotes incompletos na aba %.',a; end if;
  end loop;
  if exists(select 1 from neo_fat_lotes l cross join lateral jsonb_array_elements(l.dados) d
    where l.importacao=imp.id and (d->>'idapropriacao') is distinct from imp.fatura) then raise exception 'Há dados de outra fatura.'; end if;
  insert into neo_fat_faturas(id,arquivo,inicio,fim) values(imp.fatura,imp.arquivo,imp.inicio,imp.fim)
  on conflict(id) do update set arquivo=excluded.arquivo,inicio=excluded.inicio,fim=excluded.fim,importado_em=now(),usuario=auth.uid();
  delete from neo_fat_linhas where fatura=imp.fatura;
  insert into neo_fat_linhas(fatura,id,numserv,tipo_serv,codserv,cidade,dados)
  select imp.fatura,d->>'idapropriacaotemposervico',d->>'numserv',d->>'tipo_serv',d->>'codserv',trim(d->>'cidade'),d
  from neo_fat_lotes l cross join lateral jsonb_array_elements(l.dados) d where l.importacao=imp.id and l.aba='US_Servico';
  delete from neo_fat_anexos where fatura=imp.fatura;
  insert into neo_fat_anexos(fatura,aba,dados)
  select imp.fatura,l.aba,d from neo_fat_lotes l cross join lateral jsonb_array_elements(l.dados) d where l.importacao=imp.id and l.aba<>'US_Servico';
  delete from neo_fat_importacoes where id=imp.id;
end $$;
create function public.neo_fat_importar_vinculos(p_fatura text,p_linhas jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.'; end if;
  insert into neo_fat_vinculos(fatura,numserv,numvei,ident_turma)
  select p_fatura,x->>'numserv',nullif(x->>'numvei',''),nullif(x->>'ident_turma','') from jsonb_array_elements(p_linhas) x
  on conflict(fatura,numserv) do update set numvei=excluded.numvei,ident_turma=excluded.ident_turma,usuario=auth.uid(),atualizado_em=now();
end $$;
revoke all on function public.neo_fat_iniciar(text,text,date,date,jsonb),public.neo_fat_enviar_lote(uuid,text,int,jsonb),public.neo_fat_finalizar(uuid),public.neo_fat_importar_vinculos(text,jsonb) from public,anon;
grant execute on function public.neo_fat_iniciar(text,text,date,date,jsonb),public.neo_fat_enviar_lote(uuid,text,int,jsonb),public.neo_fat_finalizar(uuid),public.neo_fat_importar_vinculos(text,jsonb) to authenticated;
