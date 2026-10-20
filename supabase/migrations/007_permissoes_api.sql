-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 007: permissões da API (PostgREST)
--
-- Projetos Supabase novos podem não expor automaticamente as tabelas do schema
-- public. Quem decide o que cada um vê é a RLS; aqui só liberamos o acesso
-- da role "authenticated". "anon" (sem login) não acessa nada.
-- ════════════════════════════════════════════════════════════════════════════

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;
