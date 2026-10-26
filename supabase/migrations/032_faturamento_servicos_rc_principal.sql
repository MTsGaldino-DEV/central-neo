-- No pagamento por RC o item pago é o próprio RC (RC07, RC08…):
-- ele vira o código principal do serviço; os códigos de fechamento seguem em codigos.
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
  select x.fator_aplicado,x.moto,x.devido,x.bate
  from (select y.*,(abs(c.pago_comparado-y.devido)<=c.tolerancia
   or (c.multas>0 and abs(c.pago_comparado+c.multas-y.devido)<=c.tolerancia)) bate
   from (values ('CSC',false,c.d_csc),('COD',false,c.d_cod),('CSC',true,c.m_csc),('COD',true,c.m_cod)) y(fator_aplicado,moto,devido)
   where y.devido is not null and (c.tipo_turma is null or y.moto=(c.tipo_turma='M'))) x
  order by x.bate desc,x.moto,x.fator_aplicado desc limit 1
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
select m.fatura,m.numserv,m.qtd_linhas,m.codigos,
 case when m.rc_por_atendimento then m.tipo_serv else m.codigo_principal end codigo_principal,m.tipo_serv,m.tabela,m.cidade,
 m.tipo_turma,m.numvei,m.ident_turma,m.creditado,m.pago_comparado,m.multas,m.estorno,m.devido,
 m.fator_aplicado,m.moto,m.bate,m.parcial,m.rc_por_atendimento,m.diferenca,
 case when h.contexto=m.contexto then 'CONFERIDO' else m.situacao_calculo end situacao,
 m.motivo,h.observacao observacao_manual,h.usuario conferido_por,h.data conferido_em,
 (h.numserv is not null and h.contexto is distinct from m.contexto) revisao_desatualizada,
 m.situacao_calculo,m.contexto
from com_motivo m
left join neo_fat_conferencias_servico h on h.fatura=m.fatura and h.numserv=m.numserv
where (select neo_tem_modulo('faturamento'));

