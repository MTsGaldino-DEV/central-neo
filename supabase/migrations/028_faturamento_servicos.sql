-- Conferência por serviço: uma linha por fatura + numserv.
-- Compara o crédito (sem glosas) com o devido do serviço; RC paga uma vez por atendimento.
-- Multas (glosa negativa) e estorno (glosa positiva) ficam à parte e não entram no saldo.
create table if not exists public.neo_fat_conferencias_servico (
 fatura text not null references public.neo_fat_faturas(id) on delete cascade,
 numserv text not null,
 observacao text not null,
 contexto jsonb not null,
 usuario uuid default auth.uid(),
 data timestamptz not null default now(),
 primary key(fatura,numserv)
);
alter table public.neo_fat_conferencias_servico enable row level security;
revoke all on public.neo_fat_conferencias_servico from public,anon,authenticated;

-- Revisões antigas por linha viram revisão do serviço, desatualizada (contexto vazio):
-- o texto fica guardado e o serviço volta a pedir conferência.
insert into public.neo_fat_conferencias_servico(fatura,numserv,observacao,contexto,usuario,data)
select l.fatura,l.numserv,string_agg(h.observacao,' | ' order by h.data),'[]'::jsonb,
 (array_agg(h.usuario order by h.data desc))[1],max(h.data)
from public.neo_fat_conferencias h join public.neo_fat_linhas l on l.fatura=h.fatura and l.id=h.linha
group by l.fatura,l.numserv
on conflict(fatura,numserv) do nothing;

create or replace view public.neo_fat_servicos with(security_invoker=false) as
with linhas as (
 select c.*,(c.devido_csc is not null or c.devido_cod is not null) com_fator
 from neo_fat_calculo c
), agregado as (
 select l.fatura,l.numserv,count(*)::int qtd_linhas,
  array_agg(l.codserv order by l.id) codigos,
  (array_agg(l.codserv order by l.id) filter(where l.com_fator))[1] codigo_principal,
  min(l.tipo_serv) tipo_serv,
  case when count(distinct l.tabela)>1 then 'MISTO' else min(l.tabela) end tabela,
  min(l.cidade) cidade,min(l.tipo_turma) tipo_turma,
  sum(l.creditado) creditado,
  coalesce(sum(l.creditado) filter(where l.com_fator),0) pago_comparado,
  sum(greatest(-l.glosa,0)) multas,sum(greatest(l.glosa,0)) estorno,
  count(*) filter(where l.creditado>0)::int linhas_pagas,
  bool_or(l.com_fator) and bool_or(not l.com_fator) parcial,
  bool_and(l.tabela='12') and min(l.tipo_serv)=max(l.tipo_serv) rc_por_atendimento,
  min(l.tolerancia)*count(*) tolerancia,
  sum(l.devido_csc) soma_csc,sum(l.devido_cod) soma_cod,sum(l.moto_csc) soma_moto_csc,sum(l.moto_cod) soma_moto_cod,
  max(l.devido_csc) max_csc,max(l.devido_cod) max_cod,max(l.moto_csc) max_moto_csc,max(l.moto_cod) max_moto_cod
 from linhas l group by l.fatura,l.numserv
), candidatos as (
 select a.*,v.numvei,v.ident_turma,
  case when a.rc_por_atendimento then a.max_csc else a.soma_csc end d_csc,
  case when a.rc_por_atendimento then a.max_cod else a.soma_cod end d_cod,
  case when a.rc_por_atendimento then a.max_moto_csc else a.soma_moto_csc end m_csc,
  case when a.rc_por_atendimento then a.max_moto_cod else a.soma_moto_cod end m_cod
 from agregado a left join neo_fat_vinculos v on v.fatura=a.fatura and v.numserv=a.numserv
), escolha as (
 select c.*,p.fator_aplicado,p.moto,p.devido,coalesce(p.bate,false) bate
 from candidatos c left join lateral (
  select x.fator_aplicado,x.moto,x.devido,abs(c.pago_comparado-x.devido)<=c.tolerancia bate
  from (values ('CSC',false,c.d_csc),('COD',false,c.d_cod),('CSC',true,c.m_csc),('COD',true,c.m_cod)) x(fator_aplicado,moto,devido)
  where x.devido is not null and (c.tipo_turma is null or x.moto=(c.tipo_turma='M'))
  order by abs(c.pago_comparado-x.devido)<=c.tolerancia desc,x.moto,x.fator_aplicado desc limit 1
 ) p on true
), classificado as (
 select e.*,e.pago_comparado-e.devido diferenca,
  case when e.devido is null then 'FORA_CONTRATO' when e.bate then 'OK'
  when e.pago_comparado<e.devido-e.tolerancia then 'A_MENOS' else 'A_MAIS' end situacao_calculo
 from escolha e
), com_motivo as (
 select k.*,
  case k.situacao_calculo
  when 'A_MENOS' then case
   when k.tipo_turma is distinct from 'M' and (
    abs(k.pago_comparado-case k.fator_aplicado when 'COD' then k.m_cod else k.m_csc end)<=k.tolerancia
    or abs(k.pago_comparado-0.7*k.devido)<=k.tolerancia) then 'MOTO_INDEVIDO'
   when k.rc_por_atendimento and k.creditado=0 then 'RC_NAO_PAGO'
   when k.pago_comparado>0 then 'FATOR_MENOR'
   else 'OUTRA' end
  when 'A_MAIS' then case
   when k.rc_por_atendimento and k.linhas_pagas>1 then 'RC_VARIAS_LINHAS'
   when k.devido>0 then 'FATOR_MAIOR'
   else 'OUTRA' end
  end motivo,
  jsonb_build_array(k.devido,k.fator_aplicado,k.moto,k.tipo_turma,k.numvei,k.ident_turma,
   k.situacao_calculo,k.creditado,k.multas,k.estorno) contexto
 from classificado k
)
select m.fatura,m.numserv,m.qtd_linhas,m.codigos,m.codigo_principal,m.tipo_serv,m.tabela,m.cidade,
 m.tipo_turma,m.numvei,m.ident_turma,m.creditado,m.pago_comparado,m.multas,m.estorno,m.devido,
 m.fator_aplicado,m.moto,m.bate,m.parcial,m.rc_por_atendimento,m.diferenca,
 case when h.contexto=m.contexto then 'CONFERIDO' else m.situacao_calculo end situacao,
 m.motivo,h.observacao observacao_manual,h.usuario conferido_por,h.data conferido_em,
 (h.numserv is not null and h.contexto is distinct from m.contexto) revisao_desatualizada,
 m.situacao_calculo,m.contexto
from com_motivo m
left join neo_fat_conferencias_servico h on h.fatura=m.fatura and h.numserv=m.numserv
where (select neo_tem_modulo('faturamento'));

revoke all on public.neo_fat_servicos from public,anon;
grant select on public.neo_fat_servicos to authenticated;

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
end $$;

create or replace function public.neo_fat_desconferir_servico(p_fatura text,p_numserv text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;
 delete from neo_fat_conferencias_servico where fatura=p_fatura and numserv=p_numserv;
end $$;

revoke all on function public.neo_fat_conferir_servico(text,text,text) from public,anon;
revoke all on function public.neo_fat_desconferir_servico(text,text) from public,anon;
grant execute on function public.neo_fat_conferir_servico(text,text,text) to authenticated;
grant execute on function public.neo_fat_desconferir_servico(text,text) to authenticated;
