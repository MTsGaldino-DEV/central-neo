-- Lista paginada de serviços (pagos a menos, a mais ou todos) e linhas de um serviço.
-- A view por serviço é calculada uma vez por chamada (CTE materializada).
create or replace function public.neo_fat_servicos_listar(
  p_filtros jsonb default '{}'::jsonb,
  p_offset integer default 0,
  p_limite integer default 50
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_fatura text := nullif(trim(p_filtros->>'fatura'),'');
  v_lado text := coalesce(nullif(trim(p_filtros->>'lado'),''),'todos');
  v_motivo text := nullif(trim(p_filtros->>'motivo'),'');
  v_situacao text := nullif(trim(p_filtros->>'situacao'),'');
  v_conferidos text := nullif(trim(p_filtros->>'conferidos'),'');
  v_tipo_turma text := nullif(trim(p_filtros->>'tipo_turma'),'');
  v_codserv text := nullif(trim(p_filtros->>'codserv'),'');
  v_cidade text := nullif(trim(p_filtros->>'cidade'),'');
  v_tipo_serv text := nullif(trim(p_filtros->>'tipo_serv'),'');
  v_q text := nullif(replace(replace(trim(p_filtros->>'q'),'%',''),'_',''),'');
  v_resultado jsonb;
begin
  if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
  if p_offset < 0 or p_limite < 1 or p_limite > 1000 then raise exception 'Paginação inválida.'; end if;
  if v_lado not in ('a_menos','a_mais','todos') then raise exception 'Lado inválido.'; end if;
  v_conferidos := coalesce(v_conferidos,case when v_lado='todos' then 'incluir' else 'excluir' end);
  with base as materialized (
    select s.* from neo_fat_servicos s
    where (v_fatura is null or s.fatura=v_fatura)
      and (v_tipo_turma is null or s.tipo_turma=v_tipo_turma)
      and (v_codserv is null or v_codserv=any(s.codigos))
      and (v_cidade is null or s.cidade=v_cidade)
      and (v_tipo_serv is null or s.tipo_serv=v_tipo_serv)
      and (v_q is null or s.numserv ilike '%'||v_q||'%')
  ), filtrada as (
    select b.* from base b
    where (v_lado='todos' or b.situacao_calculo=case v_lado when 'a_menos' then 'A_MENOS' else 'A_MAIS' end)
      and (v_motivo is null or b.motivo=v_motivo)
      and (v_situacao is null or b.situacao=v_situacao)
      and (v_conferidos='incluir' or (v_conferidos='somente')=(b.situacao='CONFERIDO'))
  ), lado as (
    select b.situacao_calculo,b.motivo,count(*)::int servicos,
      sum(case b.situacao_calculo when 'A_MENOS' then -b.diferenca else b.diferenca end) us
    from base b where b.situacao_calculo in ('A_MENOS','A_MAIS') and b.situacao<>'CONFERIDO'
    group by 1,2
  )
  select jsonb_build_object(
    'total',(select count(*)::int from filtrada),
    'servicos',(select coalesce(jsonb_agg(to_jsonb(p) order by p.ordem),'[]'::jsonb) from (
      select f.*,row_number() over(order by
        case when v_lado='a_menos' then f.diferenca end asc,
        case when v_lado='a_mais' then f.diferenca end desc,f.fatura,f.numserv) ordem
      from filtrada f order by ordem limit p_limite offset p_offset) p),
    'lados',jsonb_build_object(
      'a_menos',(select jsonb_build_object('us',coalesce(sum(us),0),'servicos',coalesce(sum(servicos),0)::int,
        'por_motivo',coalesce(jsonb_object_agg(motivo,jsonb_build_object('us',us,'servicos',servicos)),'{}'::jsonb))
        from lado where situacao_calculo='A_MENOS'),
      'a_mais',(select jsonb_build_object('us',coalesce(sum(us),0),'servicos',coalesce(sum(servicos),0)::int,
        'por_motivo',coalesce(jsonb_object_agg(motivo,jsonb_build_object('us',us,'servicos',servicos)),'{}'::jsonb))
        from lado where situacao_calculo='A_MAIS'))
  ) into v_resultado;
  return v_resultado;
end $$;

create or replace function public.neo_fat_servico_linhas(p_fatura text,p_numserv text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_linhas jsonb;
begin
  if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'codserv',c.codserv,'tipo_serv',c.tipo_serv,'tabela',c.tabela,
    'urbano',c.urbano,'rural',c.rural,'creditado',c.creditado,'glosa',c.glosa,
    'devido_csc',c.devido_csc,'devido_cod',c.devido_cod,'moto_csc',c.moto_csc,'moto_cod',c.moto_cod,
    'justificativa',c.justificativa,'observacoes',c.observacoes) order by c.id),'[]'::jsonb)
  into v_linhas from neo_fat_calculo c where c.fatura=p_fatura and c.numserv=p_numserv;
  return v_linhas;
end $$;

revoke all on function public.neo_fat_servicos_listar(jsonb,integer,integer) from public,anon;
revoke all on function public.neo_fat_servico_linhas(text,text) from public,anon;
grant execute on function public.neo_fat_servicos_listar(jsonb,integer,integer) to authenticated;
grant execute on function public.neo_fat_servico_linhas(text,text) to authenticated;
