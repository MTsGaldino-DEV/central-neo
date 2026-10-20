# Migrations antigas (projeto TraceOne)

Até 2026-10-20 a Central NEO rodava dentro do projeto Supabase do TraceOne
(`ctlaygzndbaojxpwqsco`), com objetos de prefixo `neo_`.

- 001–004 foram aplicadas lá.
- 005 nunca foi aplicada lá.

Os dados foram copiados para o banco próprio `central-neo` com `scripts/copiar-do-traceone.cjs`.
Os objetos `neo_*` que ficaram no TraceOne não são mais usados pelo app.
Dá para removê-los quando a migração estiver validada.
