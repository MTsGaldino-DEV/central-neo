-- Nota de transposição apenas para RCs publicados na Tabela 12.
create or replace view public.neo_fat_calculo with(security_invoker=false) as
with candidatos as (
 select b.*,p.fator_aplicado,p.moto,p.devido,p.bate,
 coalesce(p.devido,case when tipo_turma='M' then moto_csc else devido_csc end) devido_linha
 from neo_fat_base b left join lateral (
  select * from (select x.*,
   ((abs(creditado-x.devido)<=tolerancia or (creditado=0 and glosa<0))
    and (glosa=0 or abs(abs(glosa)-x.devido)<=tolerancia)) bate
   from (values ('CSC',false,devido_csc),('COD',false,devido_cod),
    ('CSC',true,moto_csc),('COD',true,moto_cod)) x(fator_aplicado,moto,devido)
   where x.devido is not null and (tipo_turma is null or x.moto=(tipo_turma='M'))
  ) y order by bate desc,moto,fator_aplicado desc limit 1
 ) p on true
), grupos as (
 select *,count(*) over w qtd_servico,
 sum(creditado+glosa) over w liquido_servico,
 sum(devido_csc) over w soma_csc_bruta,sum(devido_cod) over w soma_cod_bruta,
 sum(moto_csc) over w soma_moto_csc_bruta,sum(moto_cod) over w soma_moto_cod_bruta,
 max(devido_csc) over w atendimento_csc,max(devido_cod) over w atendimento_cod,
 max(moto_csc) over w atendimento_moto_csc,max(moto_cod) over w atendimento_moto_cod,
 bool_and(coalesce(bate,false)) over w linhas_batem,
 bool_and(tabela='12') over w and min(tipo_serv) over w=max(tipo_serv) over w rc_por_atendimento,
 row_number() over(partition by fatura,numserv order by id) ordem_servico
 from candidatos window w as(partition by fatura,numserv)
), escolha as (
 select g.*,a.devido_atendimento,a.atendimento_bate,
 case when rc_por_atendimento then
  case when ordem_servico=1 then a.devido_atendimento else 0::numeric end
 else devido_linha end devido_referencia
 from grupos g left join lateral (
  select coalesce(x.valor,case when g.tipo_turma='M' then g.atendimento_moto_csc else g.atendimento_csc end) devido_atendimento,
  coalesce(x.bate,false) atendimento_bate
  from (select v.valor,v.bate from (
   select val.valor,abs(g.liquido_servico-val.valor)<=g.tolerancia bate,val.moto,val.fator
   from (values ('CSC',false,g.atendimento_csc),('COD',false,g.atendimento_cod),
    ('CSC',true,g.atendimento_moto_csc),('COD',true,g.atendimento_moto_cod)) val(fator,moto,valor)
   where val.valor is not null and (g.tipo_turma is null or val.moto=(g.tipo_turma='M'))
  ) v order by v.bate desc,v.moto,v.fator desc limit 1) x
 ) a on true
)
select fatura,id,numserv,tipo_serv,codserv,cidade,dados,tabela,codigo_contrato,nota,
 fator_csc,fator_cod,urbano,rural,creditado,glosa,devido_csc,devido_cod,moto_csc,moto_cod,
 tolerancia,tipo_turma,justificativa,fator_aplicado,moto,devido,bate,devido_referencia,
 qtd_servico,liquido_servico,
 case when rc_por_atendimento then atendimento_csc else soma_csc_bruta end soma_csc,
 case when rc_por_atendimento then atendimento_cod else soma_cod_bruta end soma_cod,
 case when rc_por_atendimento then atendimento_moto_csc else soma_moto_csc_bruta end soma_moto_csc,
 case when rc_por_atendimento then atendimento_moto_cod else soma_moto_cod_bruta end soma_moto_cod,
 case when devido_referencia is null then 'CODIGO_FORA_CONTRATO'
 when rc_por_atendimento and not atendimento_bate then 'DIVERGENTE'
 when rc_por_atendimento and qtd_servico>1 and not linhas_batem then 'REVISAR_RC_MULTILINHA'
 when bate then case when moto and tipo_turma is null then 'MOTO_PROVAVEL' else 'OK' end
 else 'DIVERGENTE' end situacao_calculo,
 creditado+glosa-devido_referencia diferenca,
 concat_ws('; ',case when tipo_turma is null then 'moto não verificada' end,
 case when glosa>0 then 'Glosa positiva: estorno' end,
 case when rc_por_atendimento and qtd_servico>1 and ordem_servico=1 then
  'RC pago uma vez por atendimento; devido atribuído a esta linha para totalização' end,
 case when rc_por_atendimento and qtd_servico>1 and ordem_servico>1 then
  'RC pago uma vez por atendimento; devido atribuído à primeira linha' end,
 case when tabela='11' and exists(select 1 from neo_fat_contrato rc where rc.tabela='12' and rc.codigo=tipo_serv and rc.ativo) then
  'Tabela 12, notas 2/3: RC substituído pelo código de fechamento' end,
 case when not coalesce(bate,false) and ((dados->>'qtdurbanohe')::numeric<>0 or
  (dados->>'qtdruralhe')::numeric<>0 or (dados->>'qtdhh')::numeric<>0) then
  'colunas L/N/O preenchidas: regra a confirmar' end,
 case when not coalesce(bate,false) and nota is not null then
  'código com NOTA no contrato: conferir' end) observacoes
from escolha;

