# Diagrama — Conferência de fatura (módulo Faturamento)

Fonte: `CONTEXTO_GERAL.md` §7, `docs/faturamento-relatorio.md`, `src/lib/faturamentoPlanilhas.ts`, `src/lib/faturamento.ts`. Status: CONFIRMADO (documentação consistente com código); resultado financeiro NÃO está representado de propósito.

```mermaid
flowchart TD
  A[Fatura Resumida - planilha] --> I
  B[Fatura Completa - planilha com abas de serviço e equipe] --> I
  I[Leitura pura no navegador - dados originais preservados em JSON] --> P[Publicação em lotes numa transação - RPCs de início e fim da importação]
  P --> V[Vínculo serviço - veículo - equipe e tipo de frota]
  V --> C[Cálculo do devido por serviço no Postgres - views neo_fat_base e neo_fat_calculo]
  T[Tabelas 11, 12 e 14 do contrato - editáveis só por ADMIN, com motivo e histórico] --> C
  C --> K[Cache por serviço - refeito só quando algo muda]
  K --> L[Lista paginada por RPC - neo_fat_listar]
  L --> PN[Painel - pagou a menos, a mais, glosas]
  L --> CF[Conferência por serviço - filtros por coluna]
  CF --> R[Revisão manual - invalidada se os dados mudarem]
  CF --> XL[Exportação para negociação]
```
