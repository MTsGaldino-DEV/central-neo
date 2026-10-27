# Homem-hora, despacho COD e área — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular o devido dos códigos por homem-hora, decidir CSC/COD pela lista de despacho e a área pela coluna `cod_tip_area` da Fatura Completa.

**Architecture:** A importação passa a guardar acionamento, término e área de cada serviço na aba `Servico` de `neo_fat_anexos`. A migration 039 cria a lista do COD e a Tabela 14 e reescreve `neo_fat_base` para preencher só o devido do despacho certo (o outro fica nulo, e a escolha de candidatos já existente passa a ter um só despacho). Homem-hora vira devido calculado na própria `neo_fat_base`.

**Tech Stack:** Postgres (Supabase, views + plpgsql), React/TypeScript, `xlsx`, scripts Node com `postgres`.

**Spec:** `docs/superpowers/specs/2026-10-27-faturamento-homem-hora-cod-design.md`

## Global Constraints

- Lista COD = os 42 tipos únicos de `cod.md` + `RC01` (43).
- Tabela 14 usada: D 2 caminhonete 0,1097; U 1 caminhonete 0,0922; M 1 motocicleta 0,0366; Q 4 caminhão 0,1753 (US/h).
- Homem-hora: horas = (término − acionamento) em minutos / 60, sem arredondar; devido = round(horas × US/h × (1 + 0,2·COD + 0,2·rural), 6).
- Área: `cod_tip_area` U = urbano, R = rural, S = rural; sem valor → regra atual (K/M). Quantidade continua `qtdurbanohn + qtdruralhn`.
- Fora do homem-hora: COD usa `fator_cod`, rural usa o fator rural do código/`neo_fat_config` (sem mudança).
- Banco por `node scripts/migrar.cjs` (`--testar` desfaz). Testes de banco em transação desfeita.
- Commits com o parágrafo padrão do Matheus e `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push.

## Review Focus

- Serviço repetido na aba Serviço com horários diferentes: fica o primeiro com horário; não derruba a importação.
- Data/hora do Excel como número de série e como texto `dd/mm/aaaa hh:mm`: as duas viram `aaaa-mm-ddThh:mm:ss`.
- Homem-hora sem equipe, sem horário ou com término antes do acionamento: devido nulo + observação dizendo o que faltou.
- Faturas importadas antes desta mudança (sem `cod_tip_area`): área cai em K/M, nada quebra.
- Serviço RC cujo único código é 5.63/5.64 (transposição): o homem-hora entra no lugar do RC.

---

### Task 1: Ler acionamento, término e área na Fatura Completa

**Files:**
- Modify: `src/lib/faturamentoPlanilhas.ts` (`VinculoServicoFat`, `lerFaturaCompleta`)
- Test: `scripts/faturamento-planilhas-testar.cjs`

**Interfaces:**
- Produces: `VinculoServicoFat { numserv; numvei; ident_turma; acionamento: string|null; termino: string|null; area: string|null }` (datas `YYYY-MM-DDTHH:MM:SS`, área maiúscula). Os campos seguem para `neo_fat_anexos` aba `Servico` sem mudar `importarFat`.

- [ ] **Step 1: Testes** em `faturamento-planilhas-testar.cjs`, com o arquivo real:
  - `completa.vinculos.find(v=>v.numserv==='246015779')` tem `acionamento==='2026-09-17T06:23:00'` e `termino==='2026-09-17T08:36:00'`.
  - contagem de `area` nos vínculos: `{U:17137,R:4764,S:9}`.
  - planilha sintética: `dh_aciona:'17/09/2026 06:23'` vira `'2026-09-17T06:23:00'`; número de série `46282.25` vira `'2026-09-17T06:00:00'`; vazio vira `null`.
  - duas linhas do mesmo serviço com horários diferentes e mesma frota: não lança erro; fica o primeiro horário.
- [ ] **Step 2:** `node scripts/faturamento-planilhas-testar.cjs` → falha (campos ausentes).
- [ ] **Step 3:** implementar `dataHoraDaPlanilha(valor: unknown): string|null` (série via `XLSX.SSF.parse_date_code`, texto `dd/mm/aaaa hh:mm[:ss]`, ISO) e preencher os três campos.
- [ ] **Step 4:** teste passa; `npx tsc --noEmit -p .` limpo.
- [ ] **Step 5:** commit `feat(faturamento): lê acionamento, término e área da Fatura Completa`.

### Task 2: Migration 039, carga da 9844 e teste do cálculo

**Files:**
- Create: `supabase/migrations/039_faturamento_homem_hora_cod.sql`
- Create: `scripts/faturamento-tempo-carregar.cjs` (preenche a 9844 já importada)
- Create: `scripts/faturamento-homem-hora-testar.cjs`

**Interfaces:**
- Consumes: campos `acionamento`, `termino`, `area` em `neo_fat_anexos.dados` (aba `Servico`).
- Produces:
  - `neo_fat_despacho_cod(tipo_serv text pk, ativo bool default true)`; `neo_fat_prontidao(tipo_turma text pk, elementos int, veiculo text, us_hora numeric)`; `neo_fat_contrato.remuneracao text` (`'HOMEM_HORA'` em 1.62/1.73/5.63/5.64). Leitura para `authenticated` com módulo faturamento.
  - `neo_fat_base` ganha `despacho text`, `area text` (`'URBANO'|'RURAL'`), `horas numeric`, `us_hora numeric`, `multiplicador numeric`; `devido_cod`/`moto_cod` nulos quando despacho = CSC e `devido_csc`/`moto_csc` nulos quando COD.
  - `neo_fat_calculo` repassa as novas colunas; `neo_fat_servico_linhas` devolve `despacho, area, horas, us_hora, multiplicador`.
  - `neo_fat_impressao_calc` e `neo_fat_impressao` incluem as duas tabelas novas (versão `'039'`).
  - `node scripts/faturamento-tempo-carregar.cjs <RelatorioDadosFatura.xlsx>`: lê com `lerFaturaCompleta`, faz merge dos três campos em `neo_fat_anexos` (aba `Servico`, mesma fatura) e apaga `neo_fat_calc_estado`/zera `neo_fat_totais.impressao` da fatura.

- [ ] **Step 1: Teste** `faturamento-homem-hora-testar.cjs` (transação desfeita, ADMIN como no `rodada2-testar`; aplica a carga dentro da transação se a 9844 ainda não tiver `area`, depois `neo_fat_recalcular('9844')`):
  - linhas 1.62 com devido: 61; rurais: 39; soma do devido do despacho ≈ 9,9655 (±0,0005); despacho de todas = `'COD'`.
  - para cada linha 1.62: `devido_cod = round(horas*us_hora*multiplicador,6)` e `multiplicador ∈ {1.2,1.4}`; `246015779`: `horas` ≈ 2,216667.
  - umpla 1.62: `us_hora = 0.0922`.
  - 5.63/5.64: 4 linhas com devido, soma ≈ 0,1703 (±0,0005).
  - `neo_fat_servicos_calc`: serviços MA27 → `fator_aplicado='COD'`; ODSA → `'CSC'`; os 9 serviços RC04/RC06/RC07/RC21/RC36 da lista do design → `situacao_calculo='A_MAIS'`; os 3 RC01 → `'OK'`; os 6 RC08 pagos como CSC → `'A_MENOS'`.
  - linha sem `area` na anexos (remover de um serviço na transação) → área pela coluna K/M, sem erro.
  - homem-hora com término < acionamento (alterar na transação) → devido nulo e observação contém `homem-hora`.
  - imprime contagem OK / A_MENOS / A_MAIS / FORA antes e depois.
- [ ] **Step 2:** rodar → falha (colunas inexistentes).
- [ ] **Step 3:** escrever a 039 (sobre a `neo_fat_base` da 025 e o `neo_fat_calculo` da 026; observação de homem-hora `'homem-hora: X h × Y US/h × M'` ou o que faltou; sem "L/N/O: regra a confirmar" nem "NOTA: conferir" quando o homem-hora foi calculado) e o script de carga.
- [ ] **Step 4:** `node scripts/migrar.cjs --testar` ok; `node scripts/migrar.cjs`; `node scripts/faturamento-tempo-carregar.cjs "Comparação de fatura/RelatorioDadosFatura9844…xlsx"`; teste passa; rodar os testes de banco existentes (`faturamento-rodada2-testar`, `-servicos-testar`, `-conferencia-testar`) e ajustar só números que mudaram pela regra nova, anotando quais.
- [ ] **Step 5:** commit `feat(faturamento): homem-hora, despacho pela lista do COD e área da fatura completa`.

### Task 3: Telas — janela do serviço e Tabelas do contrato

**Files:**
- Modify: `src/lib/faturamentoServicos.ts` (`LinhaServicoFat` + campos novos; `despachoCodFat()`, `prontidaoFat()`)
- Modify: `src/paginas/faturamento/DetalheServico.tsx` (conta por linha e etiquetas)
- Modify: `src/paginas/faturamento/Contrato.tsx` (seções "Despachados pelo COD" e "Tabela 14 — homem-hora")
- Modify: `src/paginas/faturamento/documentacaoPaginas.ts`

**Interfaces:**
- Consumes: colunas de `neo_fat_servico_linhas` e tabelas da Task 2.

- [ ] **Step 1:** Janela: etiqueta Despacho mostra "COD (lista)" / "CSC"; Zona usa `area` da linha quando houver; linha de homem-hora mostra `1.62: 2h13 × 0,1097 US/h × 1,4 (COD rural) = … US devido · a CEMIG pagou …`.
- [ ] **Step 2:** Tabelas do contrato: lista dos 43 tipos e a Tabela 14 (equipe, elementos, veículo, US/h), só leitura; códigos homem-hora mostram "por hora (Tabela 14)" no lugar do fator.
- [ ] **Step 3:** Documentação: regra do despacho, da área e do homem-hora.
- [ ] **Step 4:** `npx tsc --noEmit -p .`, `npm run build`, `node scripts/faturamento-ui-testar.cjs` passam; captura da janela de um 1.62 conferida.
- [ ] **Step 5:** commit `feat(faturamento): mostra homem-hora, despacho e área na conferência`.

### Task 4: Registro e limpeza

**Files:**
- Modify: `docs/faturamento-relatorio.md`, `MEMORIA_COMPARTILHADA.md`, `CONTEXTO_GERAL.md` (seção Faturamento)
- Delete: `cod.md`

- [ ] **Step 1:** relatório e memória: regras novas, números da 9844 antes/depois, pendência **perguntar à supervisora Elen o que é `S` em `cod_tip_area`**.
- [ ] **Step 2:** apagar `cod.md`; `git status` sem ele.
- [ ] **Step 3:** commit `docs(faturamento): registra homem-hora e despacho COD` (inclui spec e plano).
