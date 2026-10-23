-- As duas origens e seus vínculos são publicados na mesma transação.
alter table public.neo_fat_importacoes add column arquivo_completo text;
alter table public.neo_fat_faturas add column arquivo_completo text;

create function public.neo_fat_iniciar_completa(p_fatura text,p_arquivo text,p_arquivo_completo text,p_inicio date,p_fim date,p_contagens jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
  if nullif(trim(p_arquivo_completo),'') is null or coalesce((p_contagens->>'Servico')::int,0)<1 then
    raise exception 'Informe a Fatura Completa com seus serviços.';
  end if;
  v := neo_fat_iniciar(p_fatura,p_arquivo,p_inicio,p_fim,p_contagens);
  update neo_fat_importacoes set arquivo_completo=p_arquivo_completo where id=v;
  return v;
end $$;

create or replace function public.neo_fat_enviar_lote(p_importacao uuid,p_aba text,p_numero int,p_dados jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not neo_tem_modulo('faturamento') or not exists(select 1 from neo_fat_importacoes where id=p_importacao and usuario=auth.uid()) then raise exception 'Importação não autorizada.'; end if;
  if p_aba not in ('US_Servico','US_Turma','Evento_Glosa','Glosa','Debito_Credito','Servico') then raise exception 'Aba inválida.'; end if;
  insert into neo_fat_lotes values(p_importacao,p_aba,p_numero,p_dados)
  on conflict(importacao,aba,numero) do update set dados=excluded.dados;
end $$;

alter function public.neo_fat_finalizar(uuid) rename to neo_fat_publicar_lotes;
revoke all on function public.neo_fat_publicar_lotes(uuid) from public,anon,authenticated;

create function public.neo_fat_finalizar_completa(p_importacao uuid) returns void
language plpgsql security definer set search_path=public as $$
declare imp neo_fat_importacoes; vinculos jsonb;
begin
  select * into imp from neo_fat_importacoes where id=p_importacao and usuario=auth.uid() for update;
  if not found or not neo_tem_modulo('faturamento') then raise exception 'Importação não autorizada.'; end if;
  if imp.arquivo_completo is null then raise exception 'Fatura Completa não informada.'; end if;
  select coalesce(jsonb_agg(d),'[]') into vinculos
  from neo_fat_lotes l cross join lateral jsonb_array_elements(l.dados) d where l.importacao=imp.id and l.aba='Servico';
  if jsonb_array_length(vinculos)<>coalesce((imp.contagens->>'Servico')::int,-1) then raise exception 'Lotes incompletos da Fatura Completa.'; end if;
  if exists(select 1 from jsonb_array_elements(vinculos) d where nullif(trim(d->>'numserv'),'') is null) then raise exception 'Serviço sem número na Fatura Completa.'; end if;
  if exists(select 1 from jsonb_array_elements(vinculos) d group by d->>'numserv' having count(*)>1) then raise exception 'Serviço duplicado na Fatura Completa.'; end if;
  -- Valida as cinco abas e a identidade da fatura em TODOS os lotes, inclusive Serviço.
  -- Mantém o lock por fatura até os vínculos abaixo terminarem.
  perform neo_fat_publicar_lotes(imp.id);
  update neo_fat_faturas set arquivo_completo=imp.arquivo_completo where id=imp.fatura;
  delete from neo_fat_vinculos where fatura=imp.fatura;
  insert into neo_fat_vinculos(fatura,numserv,numvei,ident_turma)
  select imp.fatura,d->>'numserv',nullif(trim(d->>'numvei'),''),nullif(trim(d->>'ident_turma'),'')
  from jsonb_array_elements(vinculos) d
  where coalesce(nullif(trim(d->>'numvei'),''),nullif(trim(d->>'ident_turma'),'')) is not null;
end $$;
revoke all on function public.neo_fat_iniciar_completa(text,text,text,date,date,jsonb),public.neo_fat_finalizar_completa(uuid) from public,anon;
grant execute on function public.neo_fat_iniciar_completa(text,text,text,date,date,jsonb),public.neo_fat_finalizar_completa(uuid) to authenticated;

-- Uma frota pode trocar de tipo durante o período. Identificador da turma desempata,
-- mas só é aceito se também corresponder ao veículo fornecido.
create or replace view public.neo_fat_base with(security_invoker=true) as
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
left join lateral (select case when count(distinct a.dados->>'tipo_turma')=1
 and min(a.dados->>'tipo_turma') in ('D','M','U','Q') then min(a.dados->>'tipo_turma') end tipo_turma
 from neo_fat_anexos a where a.fatura=l.fatura and a.aba='US_Turma'
 and ((v.ident_turma is not null and a.dados->>'ident_turma'=v.ident_turma and (v.numvei is null or a.dados->>'numvei'=v.numvei))
 or (v.ident_turma is null and v.numvei is not null and a.dados->>'numvei'=v.numvei))) tm on true;

-- A revisão precisa refletir também a equipe/fatores usados no cálculo.
alter table public.neo_fat_conferencias add column contexto jsonb;
create or replace view public.neo_fat_conferencia with(security_invoker=true) as
select c.*,case when h.dados=c.dados and h.contexto=x.contexto then 'CONFERIDO' else c.situacao_calculo end situacao,
 h.observacao observacao_manual,h.usuario conferido_por,h.data conferido_em,
 (h.linha is not null and (h.dados is distinct from c.dados or h.contexto is distinct from x.contexto)) revisao_desatualizada,
 v.numvei,v.ident_turma
from neo_fat_calculo c left join neo_fat_conferencias h on h.fatura=c.fatura and h.linha=c.id
left join neo_fat_vinculos v on v.fatura=c.fatura and v.numserv=c.numserv
cross join lateral (select jsonb_build_array(c.fator_csc,c.fator_cod,c.tipo_turma,c.devido_csc,c.devido_cod,c.moto_csc,c.moto_cod,v.numvei,v.ident_turma) contexto) x;

create or replace function public.neo_fat_conferir(p_fatura text,p_linha text,p_observacao text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso.'; end if;
 if length(trim(coalesce(p_observacao,'')))<3 then raise exception 'Escreva uma observação.'; end if;
 insert into neo_fat_conferencias(fatura,linha,dados,observacao,contexto)
 select b.fatura,b.id,b.dados,p_observacao,
 jsonb_build_array(b.fator_csc,b.fator_cod,b.tipo_turma,b.devido_csc,b.devido_cod,b.moto_csc,b.moto_cod,v.numvei,v.ident_turma)
 from neo_fat_base b left join neo_fat_vinculos v on v.fatura=b.fatura and v.numserv=b.numserv
 where b.fatura=p_fatura and b.id=p_linha
 on conflict(fatura,linha) do update set dados=excluded.dados,observacao=excluded.observacao,contexto=excluded.contexto,usuario=auth.uid(),data=now();
 if not found then raise exception 'Linha não encontrada.'; end if;
end $$;

-- Compatibilidade de clientes anteriores: também encaminha cargas completas pela validação.
create function public.neo_fat_finalizar(p_importacao uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from neo_fat_importacoes where id=p_importacao and arquivo_completo is not null) then
    perform neo_fat_finalizar_completa(p_importacao);
  else
    perform neo_fat_publicar_lotes(p_importacao);
  end if;
end $$;
revoke all on function public.neo_fat_finalizar(uuid) from public,anon;
grant execute on function public.neo_fat_finalizar(uuid) to authenticated;

-- RC multilinha respeita o tipo confirmado também na comparação agregada.
create or replace view public.neo_fat_calculo with(security_invoker=true) as
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
 ((tipo_turma is null or tipo_turma<>'M') and (abs(liquido_servico-soma_csc)<=tolerancia or abs(liquido_servico-soma_cod)<=tolerancia) or
 (tipo_turma is null or tipo_turma='M') and (abs(liquido_servico-soma_moto_csc)<=tolerancia or abs(liquido_servico-soma_moto_cod)<=tolerancia)) then 'REVISAR_RC_MULTILINHA'
 else 'DIVERGENTE' end situacao_calculo,
 creditado+glosa-devido_referencia diferenca,
 concat_ws('; ',case when tipo_turma is null then 'moto não verificada' end,
 case when glosa>0 then 'Glosa positiva: estorno' end,
 case when not coalesce(bate,false) and ((dados->>'qtdurbanohe')::numeric<>0 or (dados->>'qtdruralhe')::numeric<>0 or (dados->>'qtdhh')::numeric<>0) then 'colunas L/N/O preenchidas: regra a confirmar' end,
 case when not coalesce(bate,false) and nota is not null then 'código com NOTA no contrato: conferir' end) observacoes
from grupos;
