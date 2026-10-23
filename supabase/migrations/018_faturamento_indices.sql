-- Evita varrer todas as turmas para cada linha da fatura.
create index neo_fat_turma_veiculo on public.neo_fat_anexos(fatura,(dados->>'numvei')) where aba='US_Turma';
create index neo_fat_turma_ident on public.neo_fat_anexos(fatura,(dados->>'ident_turma')) where aba='US_Turma';
analyze public.neo_fat_linhas;
analyze public.neo_fat_anexos;
analyze public.neo_fat_contrato;
