create function public.neo_fat_resumo(p_inicio date,p_fim date,p_fatura text default null)
returns jsonb language sql stable set search_path=public as $$
with linhas as materialized (
 select c.* from neo_fat_conferencia c join neo_fat_faturas f on f.id=c.fatura
 where f.fim>=p_inicio and f.inicio<=p_fim and (p_fatura is null or f.id=p_fatura)
), grupos as (
 select chave,valor,count(*) linhas,sum(creditado) creditado,sum(greatest(-glosa,0)) debitado,
 sum(greatest(glosa,0)) estorno,sum(devido_referencia) devido,sum(diferenca) diferenca
 from linhas l cross join lateral(values('tipo_serv',tipo_serv),('codserv',codserv),('cidade',cidade),('fatura',fatura)) g(chave,valor)
 group by chave,valor
), ajustes as (
 select a.fatura,a.dados from neo_fat_anexos a join neo_fat_faturas f on f.id=a.fatura
 where a.aba='Debito_Credito' and f.fim>=p_inicio and f.inicio<=p_fim and (p_fatura is null or f.id=p_fatura)
)
select jsonb_build_object(
 'totais',(select jsonb_build_object('linhas',count(*),'creditado',coalesce(sum(creditado),0),'debitado',coalesce(sum(greatest(-glosa,0)),0),
 'estorno',coalesce(sum(greatest(glosa,0)),0),'devido',sum(devido_referencia),'diferenca',sum(diferenca),
 'divergentes',count(*) filter(where situacao='DIVERGENTE'),'pendentes',count(*) filter(where situacao not in ('OK','CONFERIDO','DIVERGENTE')),
 'sem_fator',count(*) filter(where devido_referencia is null)) from linhas),
 'grupos',coalesce((select jsonb_agg(to_jsonb(g) order by creditado desc) from grupos g),'[]'::jsonb),
 'ajustes',coalesce((select jsonb_agg(to_jsonb(a)) from ajustes a),'[]'::jsonb)
);
$$;
revoke all on function public.neo_fat_resumo(date,date,text) from public,anon;
grant execute on function public.neo_fat_resumo(date,date,text) to authenticated;
