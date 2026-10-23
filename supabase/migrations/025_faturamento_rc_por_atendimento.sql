-- Tabela 12 é paga por atendimento, não pela soma de lançamentos/códigos.
-- Cada linha RC recebe candidato de uma ocorrência; a view de cálculo
-- totaliza uma única vez por fatura + numserv.
create or replace view public.neo_fat_base with(security_invoker=false) as
select l.*,c.tabela,c.codigo codigo_contrato,c.nota,c.fator_csc,c.fator_cod,
 (l.dados->>'qtdurbanohn')::numeric urbano,(l.dados->>'qtdruralhn')::numeric rural,
 (l.dados->>'ustotal')::numeric creditado,(l.dados->>'usglosa')::numeric glosa,
 round(c.fator_csc*((case when c.tabela='12' then least((l.dados->>'qtdurbanohn')::numeric,1) else (l.dados->>'qtdurbanohn')::numeric end)+(case when c.tabela='12' then least((l.dados->>'qtdruralhn')::numeric,1) else (l.dados->>'qtdruralhn')::numeric end)*(case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end)),6) devido_csc,
 round(c.fator_cod*((case when c.tabela='12' then least((l.dados->>'qtdurbanohn')::numeric,1) else (l.dados->>'qtdurbanohn')::numeric end)+(case when c.tabela='12' then least((l.dados->>'qtdruralhn')::numeric,1) else (l.dados->>'qtdruralhn')::numeric end)*(case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end)),6) devido_cod,
 round(c.fator_csc*((case when c.tabela='12' then least((l.dados->>'qtdurbanohn')::numeric,1) else (l.dados->>'qtdurbanohn')::numeric end)*(case when c.tabela='11' and c.moto='1' then 1 when c.tabela='11' and c.moto='0' then 0 else cfg.moto_urbano end)+(case when c.tabela='12' then least((l.dados->>'qtdruralhn')::numeric,1) else (l.dados->>'qtdruralhn')::numeric end)*(case when c.tabela='11' and c.moto='1' then (case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end) when c.tabela='11' and c.moto='0' then 0 else cfg.moto_rural end)),6) moto_csc,
 round(c.fator_cod*((case when c.tabela='12' then least((l.dados->>'qtdurbanohn')::numeric,1) else (l.dados->>'qtdurbanohn')::numeric end)*(case when c.tabela='11' and c.moto='1' then 1 when c.tabela='11' and c.moto='0' then 0 else cfg.moto_urbano end)+(case when c.tabela='12' then least((l.dados->>'qtdruralhn')::numeric,1) else (l.dados->>'qtdruralhn')::numeric end)*(case when c.tabela='11' and c.moto='1' then (case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end) when c.tabela='11' and c.moto='0' then 0 else cfg.moto_rural end)),6) moto_cod,
 cfg.tolerancia,tm.tipo_turma,
 (select string_agg(a.dados->>'justificativa',E'\n') from neo_fat_anexos a where a.fatura=l.fatura and a.aba='Evento_Glosa' and a.dados->>'numserv'=l.numserv and a.dados->>'codserv'=l.codserv) justificativa
from neo_fat_linhas l cross join neo_fat_config cfg
left join lateral (
 select case
  when count(distinct s.codserv) filter(where cs.fator_csc is null or cs.fator_cod is null or cs.fator_csc<>0 or cs.fator_cod<>0)=1
   then min(s.codserv) filter(where cs.fator_csc is null or cs.fator_cod is null or cs.fator_csc<>0 or cs.fator_cod<>0)
  when count(distinct s.codserv)=1 then min(s.codserv)
 end codigo,
 count(distinct s.tipo_serv)=1 mesmo_rc
 from neo_fat_linhas s
 left join neo_fat_contrato cs on cs.tabela='11' and cs.codigo=s.codserv and cs.ativo
 where s.fatura=l.fatura and s.numserv=l.numserv
 and exists(select 1 from neo_fat_contrato rc where rc.tabela='12' and rc.codigo=l.tipo_serv and rc.ativo)
) fechamento on true
left join lateral (
 select * from neo_fat_contrato cc
 where (cc.tabela='12' and cc.codigo=l.tipo_serv and not (fechamento.mesmo_rc and exists(select 1 from neo_fat_rc_transposicao t where t.codigo=fechamento.codigo and t.ativo)))
 or (cc.tabela='11' and cc.codigo=l.codserv)
 order by cc.tabela desc limit 1
) cat on true
left join neo_fat_contrato c on c.tabela=cat.tabela and c.codigo=cat.codigo and c.ativo and c.validado
left join neo_fat_vinculos v on v.fatura=l.fatura and v.numserv=l.numserv
left join lateral (select case when count(distinct a.dados->>'tipo_turma')=1
 and min(a.dados->>'tipo_turma') in ('D','M','U','Q') then min(a.dados->>'tipo_turma') end tipo_turma
 from neo_fat_anexos a where a.fatura=l.fatura and a.aba='US_Turma'
 and ((v.ident_turma is not null and a.dados->>'ident_turma'=v.ident_turma and (v.numvei is null or a.dados->>'numvei'=v.numvei))
 or (v.ident_turma is null and v.numvei is not null and a.dados->>'numvei'=v.numvei))) tm on true
where (select neo_tem_modulo('faturamento'));

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
 case when tabela='11' and tipo_serv like 'RC%' then
  'Tabela 12, notas 2/3: RC substituído pelo código de fechamento' end,
 case when not coalesce(bate,false) and ((dados->>'qtdurbanohe')::numeric<>0 or
  (dados->>'qtdruralhe')::numeric<>0 or (dados->>'qtdhh')::numeric<>0) then
  'colunas L/N/O preenchidas: regra a confirmar' end,
 case when not coalesce(bate,false) and nota is not null then
  'código com NOTA no contrato: conferir' end) observacoes
from escolha;

