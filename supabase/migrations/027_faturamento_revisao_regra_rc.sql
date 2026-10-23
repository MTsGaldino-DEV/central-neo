-- Mudança de regra ou de totalização do RC invalida revisão manual anterior.
-- Contextos antigos (sem devido_referencia/situacao_calculo) reabrem por design.
create or replace view public.neo_fat_conferencia with(security_invoker=false) as
select c.*,case when h.dados=c.dados and h.contexto=x.contexto then 'CONFERIDO' else c.situacao_calculo end situacao,
 h.observacao observacao_manual,h.usuario conferido_por,h.data conferido_em,
 (h.linha is not null and (h.dados is distinct from c.dados or h.contexto is distinct from x.contexto)) revisao_desatualizada,
 v.numvei,v.ident_turma
from neo_fat_calculo c left join neo_fat_conferencias h on h.fatura=c.fatura and h.linha=c.id
left join neo_fat_vinculos v on v.fatura=c.fatura and v.numserv=c.numserv
cross join lateral (select jsonb_build_array(c.fator_csc,c.fator_cod,c.tipo_turma,c.devido_csc,c.devido_cod,c.moto_csc,c.moto_cod,v.numvei,v.ident_turma,c.devido_referencia,c.situacao_calculo) contexto) x
where (select neo_tem_modulo('faturamento'));

create or replace function public.neo_fat_conferir(p_fatura text,p_linha text,p_observacao text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso.'; end if;
 if length(trim(coalesce(p_observacao,'')))<3 then raise exception 'Escreva uma observação.'; end if;
 insert into neo_fat_conferencias(fatura,linha,dados,observacao,contexto)
 select b.fatura,b.id,b.dados,p_observacao,
 jsonb_build_array(b.fator_csc,b.fator_cod,b.tipo_turma,b.devido_csc,b.devido_cod,b.moto_csc,b.moto_cod,v.numvei,v.ident_turma,b.devido_referencia,b.situacao_calculo)
 from neo_fat_calculo b left join neo_fat_vinculos v on v.fatura=b.fatura and v.numserv=b.numserv
 where b.fatura=p_fatura and b.id=p_linha
 on conflict(fatura,linha) do update set dados=excluded.dados,observacao=excluded.observacao,contexto=excluded.contexto,usuario=auth.uid(),data=now();
 if not found then raise exception 'Linha não encontrada.'; end if;
end $$;
