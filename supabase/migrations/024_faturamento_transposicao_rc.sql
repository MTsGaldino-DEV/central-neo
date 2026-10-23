-- Tabela 12, notas 2 e 3: um único código remunerável da lista abaixo
-- substitui o RC; códigos informativos de fator zero podem acompanhá-lo.
-- A lista fica em tabela própria para acompanhar futuras revisões do contrato.
create table public.neo_fat_rc_transposicao (
 codigo text primary key,
 ativo boolean not null default true
);
insert into public.neo_fat_rc_transposicao(codigo) values
 ('1.62'),('1.73'),('2.01'),('2.05'),('2.06'),('3.01'),('3.05'),('3.06'),
 ('4.01'),('4.05'),('4.06'),('5.01'),('5.62'),('5.63'),('5.64'),('5.70'),
 ('7.70'),('8.74'),('8.75'),('8.81'),('8.82'),('8.83'),('8.84'),('8.85'),
 ('8.88'),('8.8D'),('8.93'),('8.A1'),('8.A2'),('8.A3'),('8.A4'),('8.A5'),
 ('9.82'),('G.02'),('T.10');
revoke all on public.neo_fat_rc_transposicao from anon,authenticated;

-- Preserva os quatro fatores publicados pela Tabela 11. A escolha da tabela
-- ocorre por atendimento (fatura + numserv), nunca por coincidência do crédito.
create or replace view public.neo_fat_base with(security_invoker=false) as
select l.*,c.tabela,c.codigo codigo_contrato,c.nota,c.fator_csc,c.fator_cod,
 (l.dados->>'qtdurbanohn')::numeric urbano,(l.dados->>'qtdruralhn')::numeric rural,
 (l.dados->>'ustotal')::numeric creditado,(l.dados->>'usglosa')::numeric glosa,
 round(c.fator_csc*((l.dados->>'qtdurbanohn')::numeric+(l.dados->>'qtdruralhn')::numeric*(case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end)),6) devido_csc,
 round(c.fator_cod*((l.dados->>'qtdurbanohn')::numeric+(l.dados->>'qtdruralhn')::numeric*(case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end)),6) devido_cod,
 round(c.fator_csc*((l.dados->>'qtdurbanohn')::numeric*(case when c.tabela='11' and c.moto='1' then 1 when c.tabela='11' and c.moto='0' then 0 else cfg.moto_urbano end)+(l.dados->>'qtdruralhn')::numeric*(case when c.tabela='11' and c.moto='1' then (case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end) when c.tabela='11' and c.moto='0' then 0 else cfg.moto_rural end)),6) moto_csc,
 round(c.fator_cod*((l.dados->>'qtdurbanohn')::numeric*(case when c.tabela='11' and c.moto='1' then 1 when c.tabela='11' and c.moto='0' then 0 else cfg.moto_urbano end)+(l.dados->>'qtdruralhn')::numeric*(case when c.tabela='11' and c.moto='1' then (case when c.tabela='11' and c.rural='0' then 0 when c.tabela='11' and c.rural='1,2' then 1.2 else cfg.rural end) when c.tabela='11' and c.moto='0' then 0 else cfg.moto_rural end)),6) moto_cod,
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

