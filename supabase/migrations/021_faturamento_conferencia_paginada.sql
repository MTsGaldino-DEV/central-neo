-- A view calcula a fatura inteira. Sob RLS, a checagem de módulo é repetida
-- para cada linha de cada subconsulta e estoura o timeout do PostgREST.
-- Esta RPC checa o acesso uma vez e consulta a mesma view com o dono da função.
create function public.neo_fat_listar(
  p_filtros jsonb default '{}'::jsonb,
  p_offset integer default 0,
  p_limite integer default 50
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_fatura text := nullif(trim(p_filtros->>'fatura'),'');
  v_situacao text := nullif(trim(p_filtros->>'situacao'),'');
  v_tabela text := nullif(trim(p_filtros->>'tabela'),'');
  v_tipo_serv text := nullif(trim(p_filtros->>'tipo_serv'),'');
  v_codserv text := nullif(trim(p_filtros->>'codserv'),'');
  v_cidade text := nullif(trim(p_filtros->>'cidade'),'');
  v_tipo_turma text := nullif(trim(p_filtros->>'tipo_turma'),'');
  v_q text := nullif(trim(p_filtros->>'q'),'');
  v_de date := nullif(p_filtros->>'de','')::date;
  v_ate date := nullif(p_filtros->>'ate','')::date;
  v_total integer;
  v_linhas jsonb;
begin
  if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
  if p_offset < 0 or p_limite < 1 or p_limite > 1000 then raise exception 'Paginação inválida.'; end if;
  select count(*) into v_total from neo_fat_conferencia c
    join neo_fat_faturas f on f.id=c.fatura
    where (v_fatura is null or c.fatura=v_fatura)
      and (v_situacao is null or c.situacao=v_situacao)
      and (v_tabela is null or c.tabela=v_tabela)
      and (v_tipo_serv is null or c.tipo_serv=v_tipo_serv)
      and (v_codserv is null or c.codserv=v_codserv)
      and (v_cidade is null or c.cidade=v_cidade)
      and (v_tipo_turma is null or c.tipo_turma=v_tipo_turma)
      and (v_q is null or c.numserv ilike '%'||replace(replace(v_q,'%',''),'_','')||'%')
      and (v_de is null or f.fim>=v_de)
      and (v_ate is null or f.inicio<=v_ate);
  select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) into v_linhas from (
    select c.* from neo_fat_conferencia c join neo_fat_faturas f on f.id=c.fatura
    where (v_fatura is null or c.fatura=v_fatura)
      and (v_situacao is null or c.situacao=v_situacao)
      and (v_tabela is null or c.tabela=v_tabela)
      and (v_tipo_serv is null or c.tipo_serv=v_tipo_serv)
      and (v_codserv is null or c.codserv=v_codserv)
      and (v_cidade is null or c.cidade=v_cidade)
      and (v_tipo_turma is null or c.tipo_turma=v_tipo_turma)
      and (v_q is null or c.numserv ilike '%'||replace(replace(v_q,'%',''),'_','')||'%')
      and (v_de is null or f.fim>=v_de)
      and (v_ate is null or f.inicio<=v_ate)
    order by c.fatura,c.id limit p_limite offset p_offset
  ) l;
  return jsonb_build_object('linhas',v_linhas,'total',v_total);
end $$;
revoke all on function public.neo_fat_listar(jsonb,integer,integer) from public,anon;
grant execute on function public.neo_fat_listar(jsonb,integer,integer) to authenticated;
