-- Faturamento isolado do Fechamento. Os fatores publicados são imutáveis.
create table public.neo_fat_contrato (
  tabela text not null check (tabela in ('11','12')),
  codigo text not null,
  descricao text not null,
  como_lancar text,
  fator_original numeric(16,6),
  fator_cod_original numeric(16,6),
  fator_csc numeric(16,6) check (fator_csc >= 0),
  fator_cod numeric(16,6) check (fator_cod >= 0),
  rural text, moto text, nota text,
  validado boolean not null default false,
  ativo boolean not null default true,
  origem text not null,
  atualizado_em timestamptz not null default now(),
  primary key (tabela,codigo)
);
create table public.neo_fat_contrato_historico (
  id uuid primary key default gen_random_uuid(), tabela text not null, codigo text not null,
  anterior jsonb not null, novo jsonb not null, motivo text not null,
  usuario uuid default auth.uid(), data timestamptz not null default now()
);
create function public.neo_fat_log_contrato() returns trigger
language plpgsql security definer set search_path=public as $$
declare motivo text := current_setting('neo_fat.motivo',true);
begin
  if motivo is null or length(trim(motivo)) < 3 then raise exception 'Informe o motivo do acerto.'; end if;
  if new.fator_original is distinct from old.fator_original or new.fator_cod_original is distinct from old.fator_cod_original then
    raise exception 'Os fatores publicados são imutáveis.';
  end if;
  new.atualizado_em := now();
  insert into neo_fat_contrato_historico(tabela,codigo,anterior,novo,motivo)
  values(new.tabela,new.codigo,to_jsonb(old),to_jsonb(new),motivo);
  return new;
end $$;
create trigger neo_fat_log before update on public.neo_fat_contrato
for each row execute function public.neo_fat_log_contrato();
create function public.neo_fat_acertar_contrato(p_tabela text,p_codigo text,p_csc numeric,p_cod numeric,p_ativo boolean,p_motivo text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not neo_is_admin() then raise exception 'Apenas ADMIN NEO pode acertar o contrato.'; end if;
  if p_csc is null or p_cod is null or p_csc < 0 or p_cod < 0 then raise exception 'Fatores inválidos.'; end if;
  perform set_config('neo_fat.motivo',p_motivo,true);
  update neo_fat_contrato set fator_csc=p_csc,fator_cod=p_cod,ativo=p_ativo,validado=true
  where tabela=p_tabela and codigo=p_codigo;
  if not found then raise exception 'Código não encontrado.'; end if;
end $$;
alter table public.neo_fat_contrato enable row level security;
alter table public.neo_fat_contrato_historico enable row level security;
create policy neo_fat_contrato_ler on public.neo_fat_contrato for select to authenticated using (neo_tem_modulo('faturamento'));
create policy neo_fat_historico_ler on public.neo_fat_contrato_historico for select to authenticated using (neo_is_admin());
grant select on public.neo_fat_contrato,public.neo_fat_contrato_historico to authenticated;
revoke all on function public.neo_fat_acertar_contrato(text,text,numeric,numeric,boolean,text) from public,anon;
grant execute on function public.neo_fat_acertar_contrato(text,text,numeric,numeric,boolean,text) to authenticated;
