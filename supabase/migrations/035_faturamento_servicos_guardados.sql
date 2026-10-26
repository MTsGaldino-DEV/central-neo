-- Cálculo por serviço guardado em tabela. A view neo_fat_servicos refaz a conta das
-- 27 mil linhas a cada consulta (~3-4 s); com duas chamadas ao mesmo tempo (dois
-- usuários, ou lista + recálculo dos totais) passava dos 8 s do Supabase e o banco
-- cancelava ("canceling statement due to statement timeout").
-- Agora: neo_fat_recalcular(fatura) refaz a tabela só quando a "impressão" das entradas
-- muda (importação, vínculos, contrato, configuração, transposição), com trava por fatura:
-- quem chega depois espera e encontra tudo em dia. A lista e os totais leem a tabela e
-- juntam as revisões manuais na hora.
create table if not exists public.neo_fat_servicos_calc as
 select fatura,numserv,qtd_linhas,codigos,codigo_principal,tipo_serv,tabela,cidade,tipo_turma,numvei,ident_turma,creditado,pago_comparado,multas,estorno,devido,fator_aplicado,moto,bate,parcial,rc_por_atendimento,diferenca,motivo,situacao_calculo,contexto from public.neo_fat_servicos with no data;
alter table public.neo_fat_servicos_calc add primary key(fatura,numserv),
 add constraint neo_fat_servicos_calc_fatura foreign key(fatura) references public.neo_fat_faturas(id) on delete cascade;
create index if not exists neo_fat_servicos_calc_lado on public.neo_fat_servicos_calc(fatura,situacao_calculo,diferenca);
alter table public.neo_fat_servicos_calc enable row level security;
revoke all on public.neo_fat_servicos_calc from public,anon,authenticated;

create table if not exists public.neo_fat_calc_estado (
 fatura text primary key references public.neo_fat_faturas(id) on delete cascade,
 impressao jsonb not null,
 calculado_em timestamptz not null default clock_timestamp()
);
alter table public.neo_fat_calc_estado enable row level security;
revoke all on public.neo_fat_calc_estado from public,anon,authenticated;

create or replace function public.neo_fat_impressao_calc(p_fatura text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_array('035',
  (select importado_em from neo_fat_faturas where id=p_fatura),
  (select jsonb_build_array(count(*),max(atualizado_em)) from neo_fat_vinculos where fatura=p_fatura),
  (select jsonb_build_array(count(*),max(data)) from neo_fat_contrato_historico),
  (select jsonb_agg(to_jsonb(c)) from neo_fat_config c),
  (select jsonb_build_array(count(*),count(*) filter(where ativo)) from neo_fat_rc_transposicao))
$$;
revoke all on function public.neo_fat_impressao_calc(text) from public,anon,authenticated;

create or replace function public.neo_fat_recalcular(p_fatura text) returns boolean
language plpgsql security definer set search_path=public as $$
declare v_impressao jsonb;
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 if not exists(select 1 from neo_fat_faturas where id=p_fatura) then raise exception 'Fatura não encontrada.'; end if;
 -- Uma conta por fatura de cada vez; o próximo comando já enxerga o que o outro gravou.
 perform pg_advisory_xact_lock(hashtextextended('neo_fat_calc:'||p_fatura,0));
 v_impressao := neo_fat_impressao_calc(p_fatura);
 if exists(select 1 from neo_fat_calc_estado where fatura=p_fatura and impressao=v_impressao) then return false; end if;
 delete from neo_fat_servicos_calc where fatura=p_fatura;
 insert into neo_fat_servicos_calc(fatura,numserv,qtd_linhas,codigos,codigo_principal,tipo_serv,tabela,cidade,tipo_turma,numvei,ident_turma,creditado,pago_comparado,multas,estorno,devido,fator_aplicado,moto,bate,parcial,rc_por_atendimento,diferenca,motivo,situacao_calculo,contexto) select fatura,numserv,qtd_linhas,codigos,codigo_principal,tipo_serv,tabela,cidade,tipo_turma,numvei,ident_turma,creditado,pago_comparado,multas,estorno,devido,fator_aplicado,moto,bate,parcial,rc_por_atendimento,diferenca,motivo,situacao_calculo,contexto from neo_fat_servicos where fatura=p_fatura;
 insert into neo_fat_calc_estado(fatura,impressao,calculado_em) values(p_fatura,v_impressao,clock_timestamp())
 on conflict(fatura) do update set impressao=excluded.impressao,calculado_em=excluded.calculado_em;
 return true;
end $$;

create or replace view public.neo_fat_servicos_lista with(security_invoker=false) as
select c.fatura,c.numserv,c.qtd_linhas,c.codigos,c.codigo_principal,c.tipo_serv,c.tabela,c.cidade,
 c.tipo_turma,c.numvei,c.ident_turma,c.creditado,c.pago_comparado,c.multas,c.estorno,c.devido,
 c.fator_aplicado,c.moto,c.bate,c.parcial,c.rc_por_atendimento,c.diferenca,
 case when h.contexto=c.contexto then 'CONFERIDO' else c.situacao_calculo end situacao,
 c.motivo,h.observacao observacao_manual,h.usuario conferido_por,h.data conferido_em,
 (h.numserv is not null and h.contexto is distinct from c.contexto) revisao_desatualizada,
 c.situacao_calculo,c.contexto
from neo_fat_servicos_calc c
left join neo_fat_conferencias_servico h on h.fatura=c.fatura and h.numserv=c.numserv
where (select neo_tem_modulo('faturamento'));
revoke all on public.neo_fat_servicos_lista from public,anon;
grant select on public.neo_fat_servicos_lista to authenticated;

create or replace function public.neo_fat_atualizar_totais(p_fatura text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v jsonb; v_impressao jsonb;
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 -- A impressão vem antes dos dados: se algo mudar no meio, a fatura fica desatualizada (nunca o contrário).
 perform neo_fat_recalcular(p_fatura);
 v_impressao := neo_fat_impressao(p_fatura);
 with s as materialized (
  select * from neo_fat_servicos_lista where fatura=p_fatura
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
  if v_fatura is not null then perform neo_fat_recalcular(v_fatura); end if;
  v_conferidos := coalesce(v_conferidos,case when v_lado='todos' then 'incluir' else 'excluir' end);
  with base as materialized (
    select s.* from neo_fat_servicos_lista s
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

create or replace function public.neo_fat_conferir_servico(p_fatura text,p_numserv text,p_observacao text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 if length(trim(coalesce(p_observacao,'')))<3 then raise exception 'Escreva uma observação.'; end if;
 perform neo_fat_recalcular(p_fatura);
 insert into neo_fat_conferencias_servico(fatura,numserv,observacao,contexto)
 select s.fatura,s.numserv,trim(p_observacao),s.contexto from neo_fat_servicos_lista s
 where s.fatura=p_fatura and s.numserv=p_numserv
 on conflict(fatura,numserv) do update set observacao=excluded.observacao,contexto=excluded.contexto,usuario=auth.uid(),data=now();
 if not found then raise exception 'Serviço não encontrado.'; end if;
 perform neo_fat_atualizar_totais(p_fatura);
end $$;

revoke all on function public.neo_fat_recalcular(text) from public,anon;
grant execute on function public.neo_fat_recalcular(text) to authenticated;
