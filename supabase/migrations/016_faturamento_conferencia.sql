create table public.neo_fat_config (
 id boolean primary key default true check(id), rural numeric not null default 1.2,
 moto_urbano numeric not null default 0.7, moto_rural numeric not null default 0.9,
 tolerancia numeric not null default 0.000001
);
insert into public.neo_fat_config default values;
alter table public.neo_fat_config enable row level security;
create policy neo_fat_config_ler on public.neo_fat_config for select to authenticated using(neo_tem_modulo('faturamento'));
grant select on public.neo_fat_config to authenticated;
create table public.neo_fat_conferencias (
 fatura text not null, linha text not null, dados jsonb not null, observacao text not null,
 usuario uuid not null default auth.uid(), data timestamptz not null default now(), primary key(fatura,linha)
);
alter table public.neo_fat_conferencias enable row level security;
create policy neo_fat_conferencias_ler on public.neo_fat_conferencias for select to authenticated using(neo_tem_modulo('faturamento'));
grant select on public.neo_fat_conferencias to authenticated;
create view public.neo_fat_base with(security_invoker=true) as
select l.*,c.tabela,c.codigo codigo_contrato,c.nota,c.fator_csc,c.fator_cod,
 (l.dados->>'qtdurbanohn')::numeric urbano,(l.dados->>'qtdruralhn')::numeric rural,
 (l.dados->>'ustotal')::numeric creditado,(l.dados->>'usglosa')::numeric glosa,
 round(c.fator_csc*((l.dados->>'qtdurbanohn')::numeric+(l.dados->>'qtdruralhn')::numeric*cfg.rural),6) devido_csc,
 round(c.fator_cod*((l.dados->>'qtdurbanohn')::numeric+(l.dados->>'qtdruralhn')::numeric*cfg.rural),6) devido_cod,
 round(c.fator_csc*((l.dados->>'qtdurbanohn')::numeric*cfg.moto_urbano+(l.dados->>'qtdruralhn')::numeric*cfg.moto_rural),6) moto_csc,
 round(c.fator_cod*((l.dados->>'qtdurbanohn')::numeric*cfg.moto_urbano+(l.dados->>'qtdruralhn')::numeric*cfg.moto_rural),6) moto_cod,
 cfg.tolerancia,tm.tipo_turma,
 (select string_agg(a.dados->>'justificativa',E'\n') from neo_fat_anexos a where a.fatura=l.fatura and a.aba='Evento_Glosa' and a.dados->>'numserv'=l.numserv and a.dados->>'codserv'=l.codserv) justificativa
from neo_fat_linhas l cross join neo_fat_config cfg
left join lateral (select * from neo_fat_contrato cc where (cc.tabela='12' and cc.codigo=l.tipo_serv) or (cc.tabela='11' and cc.codigo=l.codserv) order by cc.tabela desc limit 1) cat on true
left join neo_fat_contrato c on c.tabela=cat.tabela and c.codigo=cat.codigo and c.ativo and c.validado
left join neo_fat_vinculos v on v.fatura=l.fatura and v.numserv=l.numserv
left join lateral (select case when count(distinct a.dados->>'tipo_turma')=1 then min(a.dados->>'tipo_turma') end tipo_turma
 from neo_fat_anexos a where a.fatura=l.fatura and a.aba='US_Turma'
 and ((v.ident_turma is not null and a.dados->>'ident_turma'=v.ident_turma) or (v.ident_turma is null and v.numvei is not null and a.dados->>'numvei'=v.numvei))) tm on true;
create view public.neo_fat_calculo with(security_invoker=true) as
with candidatos as (
 select b.*,p.fator_aplicado,p.moto,p.devido,p.bate,
 coalesce(p.devido,case when tipo_turma='M' then moto_csc else devido_csc end) devido_referencia
 from neo_fat_base b left join lateral (
 select * from (select x.*,
 ((abs(creditado-x.devido)<=tolerancia or (creditado=0 and glosa<0)) and (glosa=0 or abs(abs(glosa)-x.devido)<=tolerancia)) bate
 from (values ('CSC',false,devido_csc),('COD',false,devido_cod),('CSC',true,moto_csc),('COD',true,moto_cod)) x(fator_aplicado,moto,devido)
 where x.devido is not null and (tipo_turma is null or x.moto=(tipo_turma='M'))) y
 order by bate desc,moto,fator_aplicado desc limit 1) p on true
), grupos as (
 select *,count(*) over w qtd_servico,
 sum(creditado+glosa) over w liquido_servico,
 sum(devido_csc) over w soma_csc,sum(devido_cod) over w soma_cod,
 sum(moto_csc) over w soma_moto_csc,sum(moto_cod) over w soma_moto_cod
 from candidatos window w as(partition by fatura,numserv)
)
select *,case when devido_referencia is null then 'CODIGO_FORA_CONTRATO'
 when bate then case when moto and tipo_turma is null then 'MOTO_PROVAVEL' else 'OK' end
 when tabela='12' and qtd_servico>1 and
 (abs(liquido_servico-soma_csc)<=tolerancia or abs(liquido_servico-soma_cod)<=tolerancia or
 (tipo_turma is null or tipo_turma='M') and (abs(liquido_servico-soma_moto_csc)<=tolerancia or abs(liquido_servico-soma_moto_cod)<=tolerancia)) then 'REVISAR_RC_MULTILINHA'
 else 'DIVERGENTE' end situacao_calculo,
 creditado+glosa-devido_referencia diferenca,
 concat_ws('; ',case when tipo_turma is null then 'moto não verificada' end,
 case when glosa>0 then 'Glosa positiva: estorno' end,
 case when not coalesce(bate,false) and ((dados->>'qtdurbanohe')::numeric<>0 or (dados->>'qtdruralhe')::numeric<>0 or (dados->>'qtdhh')::numeric<>0) then 'colunas L/N/O preenchidas: regra a confirmar' end,
 case when not coalesce(bate,false) and nota is not null then 'código com NOTA no contrato: conferir' end) observacoes
from grupos;
create view public.neo_fat_conferencia with(security_invoker=true) as
select c.*,case when h.dados=c.dados then 'CONFERIDO' else c.situacao_calculo end situacao,
 h.observacao observacao_manual,h.usuario conferido_por,h.data conferido_em,
 coalesce(h.dados<>c.dados,false) revisao_desatualizada
from neo_fat_calculo c left join neo_fat_conferencias h on h.fatura=c.fatura and h.linha=c.id;
grant select on public.neo_fat_base,public.neo_fat_calculo,public.neo_fat_conferencia to authenticated;
create function public.neo_fat_conferir(p_fatura text,p_linha text,p_observacao text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso.'; end if;
 if length(trim(coalesce(p_observacao,'')))<3 then raise exception 'Escreva uma observação.'; end if;
 insert into neo_fat_conferencias(fatura,linha,dados,observacao)
 select fatura,id,dados,p_observacao from neo_fat_linhas where fatura=p_fatura and id=p_linha
 on conflict(fatura,linha) do update set dados=excluded.dados,observacao=excluded.observacao,usuario=auth.uid(),data=now();
 if not found then raise exception 'Linha não encontrada.'; end if;
end $$;
revoke all on function public.neo_fat_conferir(text,text,text) from public,anon;
grant execute on function public.neo_fat_conferir(text,text,text) to authenticated;
