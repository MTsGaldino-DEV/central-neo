-- Correções da revisão final do redesenho:
-- 1. Totais guardam a "impressão" das entradas (reimportação, revisões, vínculos, contrato,
--    configuração e transposição). Diferença = desatualizado, inclusive com revisões gravadas
--    em paralelo ou removidas.
-- 2. O painel recalcula só o que cabe em ~3 s; o app recalcula fatura a fatura antes
--    (neo_fat_faturas_desatualizadas + neo_fat_atualizar_totais), sem estourar o tempo limite.
-- 3. Filtro por código principal (o grupo "Por código" do Resumo), e codserv também acha RC.
-- 4. Valor de ajuste mal formatado não derruba os totais.
alter table public.neo_fat_totais add column if not exists impressao jsonb;
delete from public.neo_fat_totais;

create or replace function public.neo_fat_impressao(p_fatura text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_array('034',
  (select importado_em from neo_fat_faturas where id=p_fatura),
  (select jsonb_build_array(count(*),max(data)) from neo_fat_conferencias_servico where fatura=p_fatura),
  (select jsonb_build_array(count(*),max(atualizado_em)) from neo_fat_vinculos where fatura=p_fatura),
  (select jsonb_build_array(count(*),max(data)) from neo_fat_contrato_historico),
  (select jsonb_agg(to_jsonb(c)) from neo_fat_config c),
  (select jsonb_build_array(count(*),count(*) filter(where ativo)) from neo_fat_rc_transposicao))
$$;
revoke all on function public.neo_fat_impressao(text) from public,anon,authenticated;

create or replace function public.neo_fat_atualizar_totais(p_fatura text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v jsonb; v_impressao jsonb;
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 -- A impressão vem antes dos dados: se algo mudar no meio, a fatura fica desatualizada (nunca o contrário).
 v_impressao := neo_fat_impressao(p_fatura);
 with s as materialized (
  select * from neo_fat_servicos where fatura=p_fatura
 ), grupos as (
  select g.chave,g.valor,count(*)::int servicos,coalesce(sum(s.creditado),0) creditado,sum(s.devido) devido,
   coalesce(sum(s.multas),0) multas,coalesce(sum(-s.diferenca) filter(where s.situacao='A_MENOS'),0) saldo
  from s cross join lateral (values ('tipo_turma',s.tipo_turma),('codserv',coalesce(s.codigo_principal,s.codigos[1])),('cidade',s.cidade)) g(chave,valor)
  group by g.chave,g.valor
 ), lados as (
  select s.situacao,s.motivo,count(*)::int servicos,sum(abs(s.diferenca)) us
  from s where s.situacao in ('A_MENOS','A_MAIS') group by s.situacao,s.motivo
 ), ajustes as (
  select a.dados->>'tipoajusteapropriacao' tipo,a.dados->>'observacao' observacao,case when a.dados->>'valor' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then (a.dados->>'valor')::numeric end valor
  from neo_fat_anexos a where a.fatura=p_fatura and a.aba='Debito_Credito'
 )
 select jsonb_build_object(
  'fatura',f.id,'inicio',f.inicio,'fim',f.fim,'importado_em',f.importado_em,
  'linhas',(select coalesce(sum(qtd_linhas),0)::int from s),
  'servicos',(select count(*)::int from s),
  'creditado',(select coalesce(sum(creditado),0) from s),
  'pago_com_fator',(select coalesce(sum(pago_comparado) filter(where devido is not null),0) from s),
  'multas',(select coalesce(sum(multas),0) from s),
  'estorno',(select coalesce(sum(estorno),0) from s),
  'devido',(select coalesce(sum(devido),0) from s),
  'diferenca',(select coalesce(sum(diferenca),0) from s),
  'sem_fator_servicos',(select count(*)::int from s where devido is null),
  'parciais',(select count(*)::int from s where parcial),
  'saldo_a_receber',(select coalesce(sum(us),0) from lados where situacao='A_MENOS'),
  'pago_a_mais',(select coalesce(sum(us),0) from lados where situacao='A_MAIS'),
  'a_menos',(select jsonb_build_object('servicos',coalesce(sum(servicos),0)::int,'por_motivo',
    coalesce(jsonb_object_agg(motivo,jsonb_build_object('us',us,'servicos',servicos)),'{}'::jsonb)) from lados where situacao='A_MENOS'),
  'a_mais',(select jsonb_build_object('servicos',coalesce(sum(servicos),0)::int,'por_motivo',
    coalesce(jsonb_object_agg(motivo,jsonb_build_object('us',us,'servicos',servicos)),'{}'::jsonb)) from lados where situacao='A_MAIS'),
  'funil',(select jsonb_build_object('importados',count(*)::int,
    'equipe_identificada',count(*) filter(where tipo_turma is not null)::int,
    'codigo_no_contrato',count(*) filter(where tipo_turma is not null and situacao_calculo<>'FORA_CONTRATO')::int,
    'valor_confere',count(*) filter(where tipo_turma is not null and situacao_calculo='OK')::int,
    'conferidos',count(*) filter(where situacao='CONFERIDO')::int) from s),
  'grupos',(select jsonb_build_object(
    'tipo_turma',coalesce(jsonb_agg(jsonb_build_object('valor',valor,'servicos',servicos,'creditado',creditado,'devido',devido,'multas',multas,'saldo',saldo) order by creditado desc) filter(where chave='tipo_turma'),'[]'::jsonb),
    'codserv',coalesce(jsonb_agg(jsonb_build_object('valor',valor,'servicos',servicos,'creditado',creditado,'devido',devido,'multas',multas,'saldo',saldo) order by creditado desc) filter(where chave='codserv'),'[]'::jsonb),
    'cidade',coalesce(jsonb_agg(jsonb_build_object('valor',valor,'servicos',servicos,'creditado',creditado,'devido',devido,'multas',multas,'saldo',saldo) order by creditado desc) filter(where chave='cidade'),'[]'::jsonb)) from grupos),
  'ajustes',(select jsonb_build_object(
    'debito',coalesce(sum(valor) filter(where tipo='D'),0),
    'credito',coalesce(sum(valor) filter(where tipo='C'),0),
    'itens',coalesce(jsonb_agg(jsonb_build_object('tipo',tipo,'observacao',observacao,'valor',valor) order by tipo,valor desc),'[]'::jsonb)) from ajustes)
 ) into v from neo_fat_faturas f where f.id=p_fatura;
 if v is null then raise exception 'Fatura não encontrada.'; end if;
 insert into neo_fat_totais(fatura,dados,calculado_em,impressao) values(p_fatura,v,clock_timestamp(),v_impressao)
 on conflict(fatura) do update set dados=excluded.dados,calculado_em=excluded.calculado_em,impressao=excluded.impressao;
 return v;
end $$;

create or replace function public.neo_fat_faturas_desatualizadas() returns text[]
language plpgsql security definer set search_path=public as $$
declare v text[];
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 select coalesce(array_agg(f.id order by f.fim desc,f.id desc),'{}') into v
 from neo_fat_faturas f left join neo_fat_totais t on t.fatura=f.id
 where t.fatura is null or t.impressao is distinct from neo_fat_impressao(f.id);
 return v;
end $$;

create or replace function public.neo_fat_painel() returns jsonb
language plpgsql security definer set search_path=public as $$
declare r text; v jsonb; v_inicio timestamptz := clock_timestamp();
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 foreach r in array neo_fat_faturas_desatualizadas() loop
  exit when clock_timestamp()-v_inicio > interval '3 seconds';
  perform neo_fat_atualizar_totais(r);
 end loop;
 select coalesce(jsonb_agg(t.dados||jsonb_build_object('calculado_em',t.calculado_em,
   'desatualizado',t.impressao is distinct from neo_fat_impressao(f.id)) order by f.fim desc,f.id desc),'[]'::jsonb)
 into v from neo_fat_faturas f join neo_fat_totais t on t.fatura=f.id;
 return v;
end $$;

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
  v_principal text := nullif(trim(p_filtros->>'codigo_principal'),'');
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
      and (v_codserv is null or v_codserv=any(s.codigos) or s.codigo_principal=v_codserv)
      and (v_principal is null or coalesce(s.codigo_principal,s.codigos[1])=v_principal)
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

revoke all on function public.neo_fat_faturas_desatualizadas() from public,anon;
grant execute on function public.neo_fat_faturas_desatualizadas() to authenticated;
