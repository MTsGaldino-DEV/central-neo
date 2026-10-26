-- Hash (SHA-256) dos dois arquivos importados: reimportar o mesmo conteúdo avisa "nada mudou".
alter table public.neo_fat_faturas add column if not exists hash_resumida text, add column if not exists hash_completa text;

create or replace function public.neo_fat_registrar_hashes(p_fatura text,p_hash_resumida text,p_hash_completa text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 update neo_fat_faturas set hash_resumida=p_hash_resumida,hash_completa=p_hash_completa where id=p_fatura;
 if not found then raise exception 'Fatura não encontrada.'; end if;
end $$;

revoke all on function public.neo_fat_registrar_hashes(text,text,text) from public,anon;
grant execute on function public.neo_fat_registrar_hashes(text,text,text) to authenticated;
