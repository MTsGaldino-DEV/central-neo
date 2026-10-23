-- Tabela 11: FATOR MOTO e FATOR RURAL variam por código no próprio contrato.
-- 0,7/0,9 permanecem para códigos moto=0,7; RC usa configuração global.
-- Moto=1 não recebe desconto urbano; rural segue a coluna rural do código.
-- Moto=0 não remunera; rural=0 zera a parcela rural.
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
left join lateral (select * from neo_fat_contrato cc where (cc.tabela='12' and cc.codigo=l.tipo_serv) or (cc.tabela='11' and cc.codigo=l.codserv) order by cc.tabela desc limit 1) cat on true
left join neo_fat_contrato c on c.tabela=cat.tabela and c.codigo=cat.codigo and c.ativo and c.validado
left join neo_fat_vinculos v on v.fatura=l.fatura and v.numserv=l.numserv
left join lateral (select case when count(distinct a.dados->>'tipo_turma')=1
 and min(a.dados->>'tipo_turma') in ('D','M','U','Q') then min(a.dados->>'tipo_turma') end tipo_turma
 from neo_fat_anexos a where a.fatura=l.fatura and a.aba='US_Turma'
 and ((v.ident_turma is not null and a.dados->>'ident_turma'=v.ident_turma and (v.numvei is null or a.dados->>'numvei'=v.numvei))
 or (v.ident_turma is null and v.numvei is not null and a.dados->>'numvei'=v.numvei))) tm on true
where (select neo_tem_modulo('faturamento'));

