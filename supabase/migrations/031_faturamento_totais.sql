-- Totais por fatura guardados para a lista e o Resumo abrirem rápido.
-- neo_fat_painel recalcula sob demanda o que ficou desatualizado
-- (reimportação, vínculos, revisão manual ou correção do contrato).
create table if not exists public.neo_fat_totais (
 fatura text primary key references public.neo_fat_faturas(id) on delete cascade,
 dados jsonb not null,
 calculado_em timestamptz not null default clock_timestamp()
);
alter table public.neo_fat_totais enable row level security;
revoke all on public.neo_fat_totais from public,anon,authenticated;

create or replace function public.neo_fat_atualizar_totais(p_fatura text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
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
  select a.dados->>'tipoajusteapropriacao' tipo,a.dados->>'observacao' observacao,(a.dados->>'valor')::numeric valor
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
 insert into neo_fat_totais(fatura,dados,calculado_em) values(p_fatura,v,clock_timestamp())
 on conflict(fatura) do update set dados=excluded.dados,calculado_em=excluded.calculado_em;
 return v;
end $$;

create or replace function public.neo_fat_painel() returns jsonb
language plpgsql security definer set search_path=public as $$
declare r record; v jsonb;
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 for r in
  select f.id from neo_fat_faturas f left join neo_fat_totais t on t.fatura=f.id
  where t.fatura is null or t.calculado_em<f.importado_em
   or exists(select 1 from neo_fat_conferencias_servico h where h.fatura=f.id and h.data>t.calculado_em)
   or exists(select 1 from neo_fat_vinculos x where x.fatura=f.id and x.atualizado_em>t.calculado_em)
   or exists(select 1 from neo_fat_contrato_historico ch where ch.data>t.calculado_em)
 loop
  perform neo_fat_atualizar_totais(r.id);
 end loop;
 select coalesce(jsonb_agg(t.dados||jsonb_build_object('calculado_em',t.calculado_em) order by f.fim desc,f.id desc),'[]'::jsonb)
 into v from neo_fat_faturas f join neo_fat_totais t on t.fatura=f.id;
 return v;
end $$;

-- Conferir ou desfazer recalcula os totais da fatura na hora.
create or replace function public.neo_fat_conferir_servico(p_fatura text,p_numserv text,p_observacao text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 if length(trim(coalesce(p_observacao,'')))<3 then raise exception 'Escreva uma observação.'; end if;
 insert into neo_fat_conferencias_servico(fatura,numserv,observacao,contexto)
 select s.fatura,s.numserv,trim(p_observacao),s.contexto from neo_fat_servicos s
 where s.fatura=p_fatura and s.numserv=p_numserv
 on conflict(fatura,numserv) do update set observacao=excluded.observacao,contexto=excluded.contexto,usuario=auth.uid(),data=now();
 if not found then raise exception 'Serviço não encontrado.'; end if;
 perform neo_fat_atualizar_totais(p_fatura);
end $$;

create or replace function public.neo_fat_desconferir_servico(p_fatura text,p_numserv text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 delete from neo_fat_conferencias_servico where fatura=p_fatura and numserv=p_numserv;
 if found then perform neo_fat_atualizar_totais(p_fatura); end if;
end $$;

revoke all on function public.neo_fat_atualizar_totais(text) from public,anon;
revoke all on function public.neo_fat_painel() from public,anon;
grant execute on function public.neo_fat_atualizar_totais(text) to authenticated;
grant execute on function public.neo_fat_painel() to authenticated;
