# Fila de NSIS: novo fluxo e filtros por coluna — Plano de implementação

> **Para quem executar:** use superpowers:executing-plans (ou subagent-driven-development). Passos em `- [ ]`.
> Por `economia-tokens`: migration e revisão ficam no modelo principal; telas e lib vão para `executor-sonnet`; rodar testes/build e commit para `executor-haiku`.

**Objetivo:** NSIS novas seguem NSMP → NSPR → Salesforce → apropriação; a lista mostra colunas por etapa e filtra por coluna.

**Arquitetura:** o histórico não muda. Uma marca `fluxo_novo` em `neo_nsis` separa as NSIS do fluxo novo. A etapa dessas NSIS é calculada na view `neo_vw_nsis` com as colunas novas da NSIS e os itens, que continuam guardando código, quantidade, fator, equipe, NSMP, NSPR, valor pago e AP. Assim Painel, divergência, R$ e exportação seguem funcionando. A janela da NSIS ganha um componente próprio para o fluxo novo; a janela antiga continua para o histórico.

**Tecnologia:** React 19 + TS + Vite, Supabase (Postgres/RLS), scripts de teste `.cjs` (Playwright para UI, `postgres` para banco).

**Spec:** `docs/superpowers/specs/2026-11-09-fila-nsis-fluxo-design.md`

**Desvio da spec (decisão 4):** a spec previa NSMP, NSPR, equipe e valor pago na NSIS. Mantê-los nos itens (uma NSMP e uma NSPR copiadas em todos os itens da NSIS, como o lançamento de hoje faz) preserva Painel, resumo, divergência, conversão em R$ e Faturamento sem mexer neles. O comportamento visto pelo usuário é o mesmo. Só o que é novo vai para a NSIS: `fluxo_novo`, `supervisor_equipe`, `data_lancamento_sf`.

## Restrições globais

- Migration nova `supabase/migrations/056_fila_fluxo_novo.sql`. Nunca editar migration aplicada. **Não aplicar no banco real**: só Matheus aplica. Testar em transação desfeita (modelo de `scripts/manutencao-fator-testar.cjs`; não usar `migrar.cjs`, que hoje reaplicaria a 051).
- Etapas novas: `AGUARDANDO_SALESFORCE`, `AGUARDANDO_APROPRIACAO`. "Concluída" é a `FATURADA` existente (rótulo "Concluída").
- Fatores do fluxo novo: só 1,0 (Urbano e CSC) e 1,2 (Rural e CSC). O check do banco e o cálculo antigo ficam como estão (histórico).
- Valor pago digitado em US (`lerNumero` aceita vírgula); R$ continua automático.
- Fluxo novo: 1 NSMP (NSRI: 1 NSMC) e 1 NSPR por NSIS. NSMC fica na coluna `nsmp` dos itens.
- Texto de tela em português; nome "Manutenção".
- Outro agente trabalha neste diretório: antes de editar rodar `git status`; **commitar só arquivos próprios com `git add <caminho>`**, nunca `git add .`.
- Commit: mensagem exatamente `Corrigimos alguns erros e melhoramos a experiência geral. Até breve, Matheus` (via `git commit -F arquivo`). **Sem push.**

## Review Focus

1. NSIS histórica (`fluxo_novo=false`) abre a janela antiga, mostra as colunas de hoje e não muda de etapa.
2. Equipe não numérica ou fora de `neo_disp_frotas`: abre campo de supervisor manual, que é opcional e não bloqueia.
3. NSRI vai da etapa 1 direto para Salesforce, sem NSPR, e a coluna NSPR mostra "—".
4. Valor pago com vírgula (`1,5`), zero e vazio: vazio não avança a etapa 2; zero é aceito.
5. Reimportar relatório de NSIS já existente não altera `fluxo_novo`; NSIS nova nasce `fluxo_novo=true`.
6. Duplo clique em "Salvar" não duplica itens nem passa duas etapas.
7. Data de lançamento no Salesforce: não aceita vazia nem data futura.

## Mapa de arquivos

- Criar `supabase/migrations/056_fila_fluxo_novo.sql` (colunas, backfill, view, RPC, importador).
- Criar `scripts/fluxo-nsis-banco-testar.cjs` (teste da 056, transação desfeita).
- Modificar `src/lib/fechamento.ts` (tipos, `ETAPAS`, `Nsis`, `FiltrosNsis`, funções novas).
- Modificar `src/lib/fechamentoCobranca.ts` (`FATORES_NOVOS`).
- Criar `src/lib/fechamentoFluxo.ts` (colunas por etapa; puro, testável).
- Criar `src/components/fechamento/FiltroColuna.tsx` (botão ▾ e menu).
- Modificar `src/paginas/fechamento/Fila.tsx` (colunas por etapa, filtros por coluna).
- Criar `src/paginas/fechamento/JanelaFluxo.tsx` (quatro etapas do fluxo novo).
- Modificar `src/paginas/fechamento/PainelNsis.tsx` (decide janela nova ou antiga).
- Modificar `src/paginas/fechamento/Painel.tsx` e `src/paginas/Inicio.tsx` (etapas novas).
- Modificar `scripts/manutencao-lancamento-testar.cjs` e `scripts/manutencao-ui-testar.cjs`; criar `scripts/fluxo-colunas-testar.cjs`.

---

### Task 1: Banco — migration 056 (modelo principal)

**Files:** Create `supabase/migrations/056_fila_fluxo_novo.sql`, `scripts/fluxo-nsis-banco-testar.cjs`.

**Interfaces — Produces:**
- `neo_nsis.fluxo_novo boolean not null default false`, `neo_nsis.supervisor_equipe text`, `neo_nsis.data_lancamento_sf date`.
- `neo_vw_nsis`: mesmas colunas de hoje (recriada com `drop view` + `create view`, `security_invoker = true`, `grant select to authenticated`) mais `fluxo_novo`, `supervisor_equipe`, `data_lancamento_sf` no fim; `supervisor` = `supervisor_equipe` quando `fluxo_novo`, senão o da localidade.
- Etapa (só quando `fluxo_novo`): `sem_cobranca` → `SEM_COBRANCA`; sem itens ou item sem NSMP → `A_FECHAR`; `tipo_serv <> 'NSRI'` e item sem NSPR → `AGUARDANDO_NSPR`; `data_lancamento_sf is null` → `AGUARDANDO_SALESFORCE`; item sem fatura → `AGUARDANDO_APROPRIACAO`; senão `FATURADA`. Para `fluxo_novo=false` a regra de hoje, sem mudança.
- `neo_supervisor_da_equipe(p_equipe text) returns text`, `security definer`, `set search_path = public`, exige `neo_tem_modulo('fechamento')`; devolve o supervisor de `neo_disp_frotas` quando `p_equipe` é inteiro e a frota existe; senão `null`. `grant execute to authenticated`, `revoke` de `anon`.
- `neo_importar_nsis`: o `INSERT` de NSIS nova grava `fluxo_novo = true`; o `UPDATE` não toca `fluxo_novo`.
- Backfill: `fluxo_novo = true` para NSIS com `origem in ('RELATORIO','MANUAL')`, sem nenhum item e sem `sem_cobranca`. NSIS com itens (mesmo sem NSMP) ficam no histórico.

- [ ] **Step 1:** Escrever `scripts/fluxo-nsis-banco-testar.cjs` (modelo do `manutencao-fator-testar.cjs`: lê `.env`, transação sempre desfeita, carrega a 056 se ainda não aplicada). Asserções, cada uma com NSIS de teste inseridas na transação: (a) colunas novas existem e `neo_vw_nsis` mantém a ordem antiga das colunas com as três novas no fim; (b) NSIS `fluxo_novo` sem itens → `A_FECHAR`; com 1 item NSMP → `AGUARDANDO_NSPR`; + NSPR e valor → `AGUARDANDO_SALESFORCE`; + data → `AGUARDANDO_APROPRIACAO`; + fatura → `FATURADA`; (c) NSRI com NSMP e valor, sem NSPR → `AGUARDANDO_SALESFORCE`; (d) NSIS `fluxo_novo=false` com os mesmos dados segue a regra antiga (`AGUARDANDO_FATURA` com NSPR sem fatura); (e) `neo_supervisor_da_equipe('4404')` devolve o supervisor de `neo_disp_frotas` onde `frota=4404`, `('abc')` e `('999999')` devolvem `null`; (f) `neo_importar_nsis` com serviço novo cria `fluxo_novo=true`, e reimportar o mesmo serviço não muda o valor; (g) backfill: nenhuma NSIS `origem='HISTORICO'` e nenhuma com itens tem `fluxo_novo=true`; (h) `neo_painel_fechamento(date, date)` e `neo_resumo_fechamento()` ainda respondem; (i) `security_invoker = true` na view.
- [ ] **Step 2:** Rodar `node scripts/fluxo-nsis-banco-testar.cjs`. Esperado: FALHA (colunas inexistentes).
- [ ] **Step 3:** Escrever `056_fila_fluxo_novo.sql` conforme **Interfaces**, em uma transação. Reaproveitar a definição de `neo_vw_nsis` da migration 011 e o corpo de `neo_importar_nsis` da 008 (copiar, mudando só o que está acima).
- [ ] **Step 4:** Rodar o teste. Esperado: `OK`. Rodar também `node scripts/manutencao-fator-testar.cjs` (não pode quebrar).
- [ ] **Step 5:** Commit só de `scripts/fluxo-nsis-banco-testar.cjs` (a pasta `supabase/` está fora do Git; registrar na memória compartilhada que a 056 existe só local e **não foi aplicada**).

### Task 2: Lib — tipos, etapas, fator e funções de gravação

**Files:** Modify `src/lib/fechamento.ts`, `src/lib/fechamentoCobranca.ts`; Create `src/lib/fechamentoFluxo.ts`; Test `scripts/manutencao-lancamento-testar.cjs`, `scripts/fluxo-colunas-testar.cjs`.

**Interfaces — Produces:**
- `type Etapa` ganha `'AGUARDANDO_SALESFORCE' | 'AGUARDANDO_APROPRIACAO'`. `ETAPAS` em ordem: A_FECHAR, AGUARDANDO_NSMP, AGUARDANDO_NSPR, AGUARDANDO_SALESFORCE ("Aguard. Salesforce", cor reaproveitando os tokens `etapa-nspr` ou novos em `index.css`), AGUARDANDO_APROPRIACAO ("Aguard. apropriação", tokens `etapa-fatura`), FATURADA (nome "Concluída"), SEM_COBRANCA. `AGUARDANDO_FATURA` continua no tipo e em `ETAPAS` (histórico).
- `Nsis` ganha `fluxo_novo: boolean; supervisor_equipe: string | null; data_lancamento_sf: string | null`.
- `FATORES_NOVOS: { valor: 1 | 1.2; rotulo: string; legenda: string }[]` em `fechamentoCobranca.ts` (rótulos "Urbano e CSC" e "Rural e CSC"); `FATORES` e `fatorPadrao` ficam.
- `supervisorDaEquipe(equipe: string): Promise<string | null>` (RPC `neo_supervisor_da_equipe`).
- `fecharEtapa1(nsis: Nsis, dados: { itens: ItemNsisCampos[]; equipe: string; nsmp: string; supervisor: string | null; valorPagoUS: number | null }): Promise<void>` — insere os itens com `equipe` e `nsmp` iguais em todos; se `nsis.tipo_serv === 'NSRI'` exige `valorPagoUS` e grava `valor_final` rateado (`ratearPago`) sem `nspr`; grava `neo_nsis.supervisor_equipe`.
- `informarNspr(itens: ItemNsis[], nspr: string, valorPagoUS: number): Promise<void>` (usa `confirmarPago`).
- `informarLancamentoSf(servico: string, data: string): Promise<void>` (`data` ISO `YYYY-MM-DD`; rejeita vazia e futura).
- `informarApropriacao(itens: ItemNsis[], ap: string): Promise<void>` (usa `atualizarItens` + `normalizarAP`).
- `COLUNAS_FLUXO: { id: ColunaFluxo; rotulo: string; campo: keyof Nsis }[]` e `colunasVisiveis(etapa: Etapa | 'TODAS', historico: boolean): ColunaFluxo[]` em `fechamentoFluxo.ts`, conforme a tabela "Colunas por etapa" da spec; `historico=true` devolve as colunas de hoje.

- [ ] **Step 1:** Em `manutencao-lancamento-testar.cjs`, testes: `FATORES_NOVOS` tem exatamente os valores `[1, 1.2]`; `calcularValor(0.0567, 2, 1.2) === 0.1361` (4 casas). Criar `fluxo-colunas-testar.cjs` com `colunasVisiveis('A_FECHAR', false)` = `['servico','tipo_serv','localidade','termino','etapa']`; `'AGUARDANDO_NSPR'` acrescenta `equipes`, `supervisor`, `nsmps`; `'AGUARDANDO_SALESFORCE'` acrescenta `nsprs`, `valor_pago`; `'AGUARDANDO_APROPRIACAO'` acrescenta `data_lancamento_sf`; `'FATURADA'` acrescenta `faturas`; `'TODAS'` tem todas; `historico=true` não inclui `data_lancamento_sf`.
- [ ] **Step 2:** Rodar os dois scripts. Esperado: FALHA.
- [ ] **Step 3:** Implementar tudo em **Interfaces**. `fecharEtapa1` e `informarLancamentoSf` validam e lançam `Error` com mensagem em português; nada grava se a validação falhar.
- [ ] **Step 4:** Rodar os dois scripts e `npm.cmd run typecheck`. Esperado: `OK` e sem erro (os outros arquivos que importam `Etapa` podem precisar do novo tipo; ajustar só o necessário para compilar).
- [ ] **Step 5:** Commit dos arquivos da tarefa.

### Task 3: Fila — colunas por etapa e filtros por coluna

**Files:** Modify `src/paginas/fechamento/Fila.tsx`, `src/lib/fechamento.ts`; Create `src/components/fechamento/FiltroColuna.tsx`.

**Interfaces — Consumes:** `colunasVisiveis`, `COLUNAS_FLUXO` (Task 2). **Produces:**
- `FiltrosNsis.colunas?: Partial<Record<ColunaFluxo, string[]>>` e `FiltrosNsis.ordemColuna?: { coluna: ColunaFluxo; dir: 'asc' | 'desc' } | null`; `aplicarFiltros` aplica `.in()` por coluna (para `termino`, faixas do dia) e a ordem por coluna (vazios por último); `temFiltro` conta `colunas`.
- `valoresDaColuna(coluna: ColunaFluxo, filtros: FiltrosNsis): Promise<string[]>` — consulta a view só com a coluna pedida, aplicando os **outros** filtros (não o da própria coluna), em páginas de 1000, remove duplicados e vazios, ordena; limite de 20 páginas.
- `FiltroColuna` props: `{ coluna: { id: string; rotulo: string }; valores: string[]; selecionados?: string[]; ordem: 'asc' | 'desc' | null; ativo: boolean; onOrdenar: (dir: 'asc' | 'desc') => void; onFiltrar: (valores: string[]) => void; onAbrir?: () => void }` — botão ▾ de 16 px no cabeçalho (azul quando `ativo`), menu em portal `position: fixed` com ordenar ↑/↓, pesquisa e lista de valores marcáveis (referência: `C:\APPWEB\visao-de-dono\src\components\espacadores\FiltroColunaInstalacoes.jsx`).

- [ ] **Step 1:** Teste de UI (em `manutencao-ui-testar.cjs`, com o Supabase simulado): na etapa A fechar de uma NSIS `fluxo_novo` o cabeçalho mostra exatamente `N° Serviço, Tipo do serviço, Localidade, DT execução, Etapa`; ▾ de "Tipo do serviço" abre o menu com os valores; marcar um valor reduz as linhas e mostra um chip removível; clicar de novo na mesma ordem volta à padrão; na etapa "Todas" aparecem todas as colunas; NSIS histórica mantém as colunas de hoje.
- [ ] **Step 2:** Rodar `npm.cmd run dev` em segundo plano e `node scripts/manutencao-ui-testar.cjs`. Esperado: FALHA.
- [ ] **Step 3:** Implementar. Colunas por etapa: se todas as linhas da página forem `fluxo_novo`, usar `colunasVisiveis(etapa, false)`; se a etapa for histórica ou a lista misturar (aba "Todas"), usar a união; linhas históricas mostram `—` nas colunas novas. A coluna Etapa fica à direita (`.grade-fixa`). Manter a paginação de 50, os filtros atuais e a grade `.grade-nsis`. Mostrar chips de etapa com as etapas novas.
- [ ] **Step 4:** Rodar o teste de UI e `npm.cmd run typecheck`. Esperado: `OK`.
- [ ] **Step 5:** Commit dos arquivos da tarefa.

### Task 4: Janela da NSIS do fluxo novo

**Files:** Create `src/paginas/fechamento/JanelaFluxo.tsx`; Modify `src/paginas/fechamento/PainelNsis.tsx`.

**Interfaces — Consumes:** `fecharEtapa1`, `informarNspr`, `informarLancamentoSf`, `informarApropriacao`, `supervisorDaEquipe`, `FATORES_NOVOS` (Task 2). **Produces:** `JanelaFluxo({ nsis, itens, onAlterado }: { nsis: Nsis; itens: ItemNsis[]; onAlterado: () => void })`, renderizada por `PainelNsis` quando `nsis.fluxo_novo`; a janela antiga segue para as demais.

- [ ] **Step 1:** Teste de UI (Supabase simulado), NSIS comum: etapa 1 pede códigos (seletor da Tabela 03, só os fatores Urbano e CSC / Rural e CSC), equipe e NSMP; "Salvar" leva a NSIS para "Aguardando NSPR". Etapa 2 pede NSPR e valor pago em US (`1,5` aceito, vazio recusado) e leva a "Aguardando Salesforce". Etapa 3 pede data de lançamento (futura e vazia recusadas). Etapa 4 pede AP e leva a "Concluída". NSRI: etapa 1 pede NSMC e valor pago e a NSIS vai para "Aguardando Salesforce". Equipe `abc` ou `999999`: aparece o campo "Supervisor (informar à mão)", opcional. Equipe `4404`: supervisor preenchido sozinho. Não existe botão "Novo lançamento" no fluxo novo. NSIS histórica abre a janela antiga.
- [ ] **Step 2:** Rodar o teste de UI. Esperado: FALHA.
- [ ] **Step 3:** Implementar `JanelaFluxo` mostrando o formulário da etapa atual (`nsis.etapa`) e, abaixo, o que já foi informado nas etapas anteriores com botão de editar (reaproveitar `FormEdicao` do histórico quando servir). Reaproveitar `SeletorCodigo` e a lista de códigos de `FormLancamento` extraindo-os para fora de `PainelNsis.tsx` se necessário. Desabilitar o botão enquanto salva (Review Focus 6). Mostrar erro de validação em português.
- [ ] **Step 4:** Rodar o teste de UI e `npm.cmd run typecheck`. Esperado: `OK`.
- [ ] **Step 5:** Commit dos arquivos da tarefa.

### Task 5: Painel, Início, build, memória

**Files:** Modify `src/paginas/fechamento/Painel.tsx:10`, `src/paginas/Inicio.tsx:85-87`, `MEMORIA_COMPARTILHADA.md`, `CONTEXTO_GERAL.md`.

- [ ] **Step 1:** `ETAPAS_ABERTAS` do Painel passa a incluir `AGUARDANDO_SALESFORCE` e `AGUARDANDO_APROPRIACAO`; o Início mostra as etapas novas junto das atuais (um mini-cartão por etapa aberta).
- [ ] **Step 2:** Rodar `npm.cmd run typecheck`, `npm.cmd run build`, `node scripts/manutencao-lancamento-testar.cjs`, `node scripts/fluxo-colunas-testar.cjs`, `node scripts/manutencao-ui-testar.cjs`, `node scripts/fluxo-nsis-banco-testar.cjs`. Esperado: tudo passa. Se algum falhar, corrigir antes de seguir.
- [ ] **Step 3:** Atualizar `MEMORIA_COMPARTILHADA.md` (seção nova: o que foi feito, o desvio da decisão 4, a 056 **não aplicada** e como aplicar, verificações, pendências) e `CONTEXTO_GERAL.md` (etapas novas e `fluxo_novo`). Preservar as mudanças do outro agente nesses arquivos.
- [ ] **Step 4:** Commit só dos arquivos próprios. Sem push.

---

## Auto-revisão

- **Cobertura da spec:** fluxo e etapas (T1, T4); colunas por etapa (T2, T3); filtros por coluna (T3); fatores (T2, T4); supervisor pela equipe e campo manual (T1, T2, T4); NSRI (T1, T2, T4); histórico intacto e marca do fluxo novo (T1); Painel não quebra (T1 asserção h, T5).
- **Consistência de nomes:** `fluxo_novo`, `supervisor_equipe`, `data_lancamento_sf`, `colunasVisiveis`, `COLUNAS_FLUXO`, `FATORES_NOVOS` aparecem iguais em todas as tarefas.
- **Proporção:** o plano descreve interfaces e testes; os corpos ficam para quem implementa.
