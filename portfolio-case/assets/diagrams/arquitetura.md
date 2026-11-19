# Diagrama — Arquitetura da Central NEO

Fonte: `CONTEXTO_GERAL.md` §2, `src/lib/supabase.ts`, `src/App.tsx`, `supabase/functions/`. Status: CONFIRMADO (documentação + estrutura do código). O que não aparece aqui não foi verificado.

```mermaid
flowchart LR
  U[Usuário no navegador] --> SPA

  subgraph SPA[Aplicação web - React 19 + Vite + TypeScript]
    R[React Router - rotas por módulo]
    L[Regras puras em src/lib - leitura de planilhas, cálculo de KM, regras de disponibilidade]
    X[Leitura de planilhas e PDFs no navegador - xlsx, exceljs, pdf.js]
  end

  SPA -->|cliente supabase - sessão NEO| NEO[(Supabase CENTRAL-NEO - Postgres, Auth, RLS, RPCs)]
  SPA -->|cliente supabaseTraceone - sessão própria| TRA[(Supabase TraceOne - somente medidores)]
  SPA -->|criar login, redefinir senha, bloquear| EF[Edge Function admin-usuarios]
  EF -->|valida neo_is_admin e usa service_role| NEO
  GIRO[Sistema GIRO] -.->|lista colaboradores, protegida por segredo| EF2[Edge Function giro-colaboradores]
  EF2 --> NEO

  VERCEL[Vercel - hospedagem estática com rewrite para index.html] --> SPA
```

Legenda: linha tracejada = integração com código presente, uso em produção NÃO VERIFICADO.
