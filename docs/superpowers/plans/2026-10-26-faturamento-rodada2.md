# Faturamento rodada 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o Painel com dois cards, a lista da Conferência estilo Excel, a nova janela do serviço com o 1.NS cruzado com a Manutenção, o renome para Manutenção, a barra lateral recolhível, a documentação por aba e os erros em uma linha.

**Architecture:** Uma migration (036) acrescenta ao banco o que as telas precisam: indicadores por serviço (1.NS, Manutenção, 5.62, multado) na view da lista, filtros por coluna e lista de valores com contagem no servidor, totais por lado, cruzamento com a Manutenção, histórico de eventos, valor da US e avaliação da documentação. O front ganha componentes pequenos e reaproveitáveis (pílulas de período, chave R$ | US, filtro de coluna, aviso de erro) e reescreve Painel, Conferência, janela do serviço, barra lateral e documentação.

**Tech Stack:** React 19, Vite 6, Tailwind v4 (tokens de `src/index.css`), react-router 6, lucide-react, Supabase/Postgres, xlsx.

**Spec:** `docs/superpowers/specs/2026-10-26-faturamento-rodada2-design.md`

## Global Constraints

- Imports com `@/`; tokens Tailwind do projeto (`sinal`, `cobre`, `erro*`, `concluido*`, `pendente*`, `revisao*`, `nevoa`, `linha`, `aco`, `noite`); ícones lucide de traço, sem emoji.
- Migration nova: `supabase/migrations/036_faturamento_rodada2.sql`; dry-run `node scripts/migrar.cjs --testar` (sai 1 com "DRY-RUN: desfeito", é normal) e depois `node scripts/migrar.cjs`. Nunca editar 001–035. `supabase/` está no `.gitignore`: a migration não entra no commit.
- Funções `security definer set search_path=public`, checam `neo_tem_modulo('faturamento')` (erro `42501`), `revoke all ... from public,anon`, `grant execute ... to authenticated`.
- Toda chamada da Conferência cabe em 8 s com chamadas simultâneas (`node scripts/faturamento-carga-testar.cjs`).
- Valor da US: o mais recente de `neo_valor_us` (hoje 2964.33), um só para todo o Faturamento. Abre em R$; `?unidade=us` troca.
- Texto: "Fechamento de Notas" → "Manutenção" em tudo que o usuário lê. URLs `/fechamento…`, tabelas `neo_nsis*`, módulo `fechamento` e nomes internos ficam.
- 1.NS da Manutenção nunca entra em totais, situação ou diferença.
- Commits: `<tipo>(faturamento): <descrição>` + parágrafo "Corrigimos alguns erros e melhoramos a experiência geral. Até Breve, Matheus" + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git status` antes; nunca `ns_preventiva_c_fonte.jsp`; sem push.
- Verificação geral: `npm run typecheck`, `npm run build`, scripts `node scripts/faturamento-*-testar.cjs`.

## Review Focus

1. Lista com vários filtros de coluna ao mesmo tempo mais um atalho (ex.: Pagou a menos + Contém 1.NS + Cidade ∈ {A,B}) → interseção correta, total e contagens da lista de valores respeitando os outros filtros. Teste no Task 1.
2. Valores de coluna com texto especial na busca (`%`, `_`, aspas) ou coluna desconhecida → sem erro de SQL; coluna desconhecida recusada com mensagem. Teste no Task 1.
3. Serviço com 1.NS cujo `neo_nsis` existe mas sem itens com valor → bloco da Manutenção não aparece; aviso "não encontrado" também não (o serviço existe). Teste no Task 1 (RPC) e Task 7 (UI).
4. Valor da US ausente (tabela vazia ou RPC falhou) → telas continuam em US, chave R$ desabilitada com dica, nada quebra. Teste no Task 2.
5. Erro sem código conhecido, ou `Error` comum, para usuário não admin → só a frase genérica, sem detalhes técnicos na tela. Teste no Task 3.

---

### Task 1: Migration 036 (banco)

**Files:**
- Create: `supabase/migrations/036_faturamento_rodada2.sql` (fora do Git)
- Create: `scripts/faturamento-rodada2-testar.cjs`
- Modify: `scripts/faturamento-carga-testar.cjs` (acrescenta chamadas com filtros novos e `neo_fat_servicos_valores`)

**Interfaces:**
- Produces (RPCs, todas com checagem do módulo):
  - View `neo_fat_servicos_lista` recriada com colunas a mais no fim: `tem_1ns boolean` (`'1.NS'=any(codigos)`), `tem_562 boolean`, `multado boolean` (`multas<>0`), `na_manutencao boolean` (`exists neo_nsis where servico=numserv`), `manutencao_com_valor boolean` (existe item com `valor_final` não nulo e ≠ 0).
  - `neo_fat_servicos_listar(p_filtros jsonb, p_offset int, p_limite int) returns jsonb` — mesma saída de hoje (`total`, `servicos`, `lados`), aceita além das chaves atuais:
    - `tem_1ns`, `multado`, `tem_562`: `'sim'` | `'nao'`;
    - listas (array JSON de texto, `in`): `situacoes`, `tipos_serv`, `codigos` (serviço tem algum), `frotas` (`numvei`), `tipos_turma`, `cidades`, `motivos` (`'—'` casa com nulo em qualquer lista);
    - faixas numéricas `pago_min/pago_max`, `devido_min/devido_max`, `diferenca_min/diferenca_max`, `multa_min/multa_max` (sobre `pago_comparado`, `devido`, `diferenca`, `multas`);
    - `ordem`: `{"coluna": "<nome>", "dir": "asc"|"desc"}` com colunas permitidas `situacao,numserv,tipo_serv,codigos,numvei,tipo_turma,cidade,pago_comparado,devido,diferenca,multas,motivo`; sem `ordem`, a ordem de hoje.
  - `neo_fat_servicos_valores(p_filtros jsonb, p_coluna text, p_busca text default null) returns jsonb` — `[{valor text|null, n int}]`, até 200, ordenado por `n desc, valor`; aplica todos os filtros menos o da própria coluna; `p_coluna` ∈ `situacao,tipo_serv,codigos,numvei,tipo_turma,cidade,motivo` (para `codigos`, conta cada código do array); busca `ilike` com `%`/`_` escapados; coluna inválida → `raise exception 'Coluna inválida.'`.
  - `neo_fat_atualizar_totais(p_fatura)` recriada: em `a_menos` e `a_mais` acrescenta `pago` (soma `pago_comparado`), `devido`, `us` (soma de `abs(diferenca)`), e mais `com_1ns int` em `a_menos` e `c562 {servicos int, us numeric}` em `a_mais`; no topo acrescenta `fora_contrato int`. No fim da migration: `delete from neo_fat_totais;` (força recálculo).
  - `neo_fat_servico_manutencao(p_numserv text) returns jsonb` — `{existe bool, itens:[{codigo, operacao, atividade, descricao, quantidade, valor}]}` com itens de `neo_nsis_itens` de `valor_final` não nulo e ≠ 0, juntando `neo_contrato_itens` pelo código.
  - Tabela `neo_fat_eventos(id bigint identity pk, fatura text not null references neo_fat_faturas on delete cascade, numserv text, tipo text not null check in ('IMPORTADA','CONFERIDO','DESCONFERIDO'), observacao text, usuario uuid default auth.uid(), data timestamptz default now())`, RLS ligada, sem acesso direto. Triggers: em `neo_fat_faturas` after insert / after update of `importado_em` → `IMPORTADA` (numserv nulo); em `neo_fat_conferencias_servico` after insert/update → `CONFERIDO` com a observação, after delete → `DESCONFERIDO`.
  - `neo_fat_servico_historico(p_fatura text, p_numserv text) returns jsonb` — `[{tipo, observacao, usuario_nome, data}]` mais recente primeiro: eventos do serviço + eventos `IMPORTADA` da fatura; se não houver `IMPORTADA`, um item sintético `IMPORTADA` com `importado_em` da fatura. `usuario_nome` de `colaboradores.nome` via `neo_acessos`, ou e-mail, ou nulo.
  - `neo_fat_valor_us() returns jsonb` — `{valor numeric, vigencia date}` da linha mais recente de `neo_valor_us`, ou `null`.
  - Tabela `neo_doc_avaliacoes(id identity, pagina text not null, util boolean not null, usuario uuid default auth.uid(), data timestamptz default now())` e `neo_doc_avaliar(p_pagina text, p_util boolean) returns void` (só autenticado; não exige módulo).

- [ ] **Step 1: Escrever `scripts/faturamento-rodada2-testar.cjs`** no padrão de `faturamento-servicos-testar.cjs` (transação desfeita, ADMIN, `set local role authenticated`), com as asserções:
  - `neo_fat_servicos_listar({fatura:'9844',lado:'a_menos',tem_1ns:'sim'})` → `total===3`, todos com `tem_1ns===true`, e `'246101137'` entre eles com `na_manutencao===false`.
  - `{fatura:'9844',lado:'todos',tem_562:'sim',situacoes:['A_MAIS']}` → `total===158`.
  - `{fatura:'9844',lado:'a_menos',multado:'sim'}` → `total===72`.
  - `{fatura:'9844',lado:'todos',codigos:['1.62']}` → `total===61`; `{...,cidades:['ALPERCATA'],codigos:['1.21']}` contém `246101137`.
  - faixa: `{fatura:'9844',lado:'todos',diferenca_max:-0.3}` → todos com `diferenca<=-0.3` e inclui `246101137`.
  - `ordem:{coluna:'numserv',dir:'asc'}` → `servicos[0].numserv <= servicos[1].numserv`; `ordem:{coluna:'x;drop',dir:'asc'}` → rejeita com `/Ordem inválida/`.
  - `neo_fat_servicos_valores({fatura:'9844',lado:'a_menos'},'motivo')` → item `RC_NAO_PAGO` com `n===34`; com filtro `motivos:['RC_NAO_PAGO']` a contagem de `motivo` continua listando os outros motivos (ignora o filtro da própria coluna); `('codigos', '1.')` só valores começando com `1.`; busca `'%'` não dá erro; coluna `'senha'` rejeita com `/Coluna inválida/`.
  - totais: `neo_fat_atualizar_totais('9844')` → `a_menos.servicos===106`, `a_menos.com_1ns===3`, `Number(a_menos.pago).toFixed(4)==='5.1968'`, `Number(a_menos.devido).toFixed(4)==='12.6441'`, `a_mais.c562.servicos===158`, `fora_contrato===88`.
  - `neo_fat_servico_manutencao('246101137')` → `{existe:false,itens:[]}`; `('245579601')` → `existe===true`, `itens.length===1`, `Number(itens[0].valor)===0.06`, `itens[0].codigo===null`.
  - histórico: conferir `246101137` com 'teste' e desconferir → `neo_fat_servico_historico('9844','246101137')` traz `DESCONFERIDO`, `CONFERIDO` (observação 'teste') e `IMPORTADA`, nessa ordem.
  - `neo_fat_valor_us()` → `Number(valor)===2964.33`.
  - `neo_doc_avaliar('faturamento/painel',true)` grava uma linha (ler com `reset role`).
  - Sem módulo: com `request.jwt.claim.sub` de um usuário sem faturamento (ou nulo), `neo_fat_servicos_valores` rejeita com código `42501`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `node scripts/faturamento-rodada2-testar.cjs` — Expected: FAIL (função/coluna inexistente).
- [ ] **Step 3: Escrever a 036** com o que está em Interfaces. Para recriar a view sem quebrar dependentes, `create or replace view` acrescentando colunas só no fim. `neo_fat_servicos_listar` e `neo_fat_servicos_valores` montam o mesmo `where` (uma função SQL auxiliar `neo_fat_filtro_servico(s neo_fat_servicos_lista, p_filtros jsonb, p_ignorar text) returns boolean`, `stable`, é a escolha recomendada). Ordenação por coluna dinâmica com `case` por coluna permitida (sem SQL dinâmico).
- [ ] **Step 4: Dry-run e aplicar.** Run: `node scripts/migrar.cjs --testar` — Expected: "DRY-RUN: desfeito" sem erro antes dele. Depois `node scripts/migrar.cjs` — Expected: 036 aplicada.
- [ ] **Step 5: Rodar os testes de banco.** Run: `node scripts/faturamento-rodada2-testar.cjs && node scripts/faturamento-servicos-testar.cjs && node scripts/faturamento-carga-testar.cjs` — Expected: PASS; carga com máximo < 8000 ms.
- [ ] **Step 6: Commit** só dos scripts (a migration fica fora do Git): `test(faturamento): cobre filtros por coluna, Manutenção e histórico no banco`.

### Task 2: Biblioteca do front (tipos, chamadas, moeda)

**Files:**
- Modify: `src/lib/faturamentoServicos.ts`, `src/lib/faturamentoTexto.ts`
- Test: `scripts/faturamento-texto-testar.cjs`

**Interfaces:**
- Consumes: RPCs do Task 1.
- Produces:
  - `ServicoFat` ganha `tem_1ns:boolean; tem_562:boolean; multado:boolean; na_manutencao:boolean; manutencao_com_valor:boolean`.
  - `TotaisFat.a_menos`/`a_mais` ganham `pago:number; devido:number; us:number`; `a_menos.com_1ns:number`; `a_mais.c562:{servicos:number;us:number}`; `TotaisFat.fora_contrato:number`. `somarTotais` soma esses campos.
  - `type FiltrosListaFat = Record<string, string | string[] | number | {coluna:string;dir:'asc'|'desc'}>`; `listarServicosFat(filtros: FiltrosListaFat, pagina, limite?)`.
  - `valoresColunaFat(filtros: FiltrosListaFat, coluna: ColunaFiltroFat, busca?: string): Promise<{valor:string|null;n:number}[]>`, `type ColunaFiltroFat = 'situacao'|'tipo_serv'|'codigos'|'numvei'|'tipo_turma'|'cidade'|'motivo'`.
  - `manutencaoServicoFat(numserv): Promise<{existe:boolean; itens:ItemManutencaoFat[]}>`, `ItemManutencaoFat = {codigo:string|null; operacao:string|null; atividade:string|null; descricao:string|null; quantidade:number; valor:number}`.
  - `historicoServicoFat(fatura, numserv): Promise<EventoFat[]>`, `EventoFat = {tipo:'IMPORTADA'|'CONFERIDO'|'DESCONFERIDO'; observacao:string|null; usuario_nome:string|null; data:string}`.
  - `valorUsFat(): Promise<{valor:number; vigencia:string} | null>`.
  - `avaliarDocFat(pagina: string, util: boolean): Promise<void>`.
  - Em `faturamentoTexto.ts`: `type UnidadeFat = 'reais'|'us'`; `valorFat(us: number|null, unidade: UnidadeFat, taxa: number|null, sinal?: boolean): string` (R$ com `toLocaleString('pt-BR',{style:'currency',currency:'BRL'})`; US com `usFat` + " US"; sem taxa cai em US; `sinal` põe `+`/`−`); `outraUnidadeFat(us, unidade, taxa): string|null` (a outra unidade, para a linha de baixo).
- [ ] **Step 1: Testes** em `faturamento-texto-testar.cjs`:
  - `valorFat(-7.447278,'reais',2964.33,true)==='−R$ 22.076,19'` (normalizar o espaço não separável do `toLocaleString` com `.replace(/ /g,' ')` dentro de `valorFat`).
  - `valorFat(17.001786,'us',2964.33,true)==='+17,001786 US'` (formato de `usFat` atual; ajustar a expectativa ao `usFat` real se ele usar outra precisão).
  - `valorFat(1,'reais',null)` cai em US: termina com `' US'`.
  - `outraUnidadeFat(0.3288,'reais',2964.33)` termina com `' US'`; `valorFat(null,'reais',2964.33)==='—'`.
  - `somarTotais` de duas faturas soma `a_menos.pago`, `a_menos.com_1ns`, `a_mais.c562.servicos` e `fora_contrato`.
- [ ] **Step 2: Rodar e ver falhar.** `node scripts/faturamento-texto-testar.cjs` — Expected: FAIL (`valorFat` não existe).
- [ ] **Step 3: Implementar** as interfaces acima.
- [ ] **Step 4:** `node scripts/faturamento-texto-testar.cjs && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(faturamento): chamadas da rodada 2 e valores em R$ ou US`.

### Task 3: Erros em uma linha, detalhes para o admin

**Files:**
- Create: `src/lib/erros.ts`, `src/components/faturamento/AvisoErro.tsx`
- Create: `scripts/faturamento-erros-testar.cjs`
- Modify: `src/lib/faturamento.ts` (`erroFat` passa a usar `traduzirErro(e).mensagem`, para não quebrar chamadas antigas)

**Interfaces:**
- Produces:
  - `interface ErroAmigavel { mensagem: string; oQueHouve: string; acao: 'tentar'|'avisar'|'corrigir'|'nenhuma'; codigo: string|null; tecnico: string }`.
  - `traduzirErro(e: unknown, onde?: string): ErroAmigavel` — mapas: código `57014` ou mensagem com `statement timeout` → mensagem "Não foi possível carregar os dados. Aguarde alguns segundos e tente de novo.", oQueHouve "O banco de dados demorou mais de 8 segundos e cancelou a consulta.", acao `tentar`; `42501` ou "Sem acesso" → "Você não tem permissão para isso. Peça a um administrador.", `avisar`; `TypeError: Failed to fetch`/"NetworkError" → "Sem conexão com o servidor. Verifique a internet e tente de novo.", `tentar`; mensagem começando com "A fatura " e contendo "já existe" → a própria mensagem, `corrigir`; mensagens de planilha (`exigir` em `faturamentoPlanilhas.ts`, que começam com "A planilha" ou "Coluna") → a própria mensagem, `corrigir`; resto → "Algo deu errado. Tente de novo; se repetir, avise o administrador.", `tentar`. `tecnico` junta `onde`, `code`, `message`, `details`, `hint`, data/hora ISO e `location.pathname + search` quando houver `location`.
  - `<AvisoErro erro={ErroAmigavel} onTentar?={() => void} admin={boolean} compacto?={boolean} />` — uma linha com ícone `XCircle`, a mensagem, "Tentar de novo" quando `acao==='tentar'` e `onTentar`; se `admin`, botão "Ver mais detalhes" / "Ver menos" que abre "O que houve", "Onde" e o bloco técnico (`<pre>`) com "Copiar detalhes" (`navigator.clipboard.writeText`, em try/catch). `compacto` para avisos dentro de janelas.
  - Hook `useAdminNeo(): boolean` em `src/lib/erros.ts` ou ao lado (`useSessao().acesso?.papel === 'ADMIN'`).
- [ ] **Step 1: Testes** (TS via `transpileModule`): `traduzirErro({code:'57014',message:'canceling statement due to statement timeout'})` → `acao==='tentar'`, mensagem exata acima, `tecnico` contém `57014`; `traduzirErro(new Error('qualquer'))` → mensagem genérica e `tecnico` contém `qualquer`; `traduzirErro({code:'42501',message:'Sem acesso ao Faturamento.'}).acao==='avisar'`; `traduzirErro(new TypeError('Failed to fetch')).mensagem` começa com "Sem conexão"; `traduzirErro(Error('A fatura 9844 já existe. Revise…')).mensagem` igual à original.
- [ ] **Step 2:** `node scripts/faturamento-erros-testar.cjs` — Expected: FAIL.
- [ ] **Step 3: Implementar** `erros.ts`, `AvisoErro.tsx`, e trocar os `<p role="alert">` de erro de carga nas telas do Faturamento (Faturas, Painel, Conferência, Importar, Contrato, DetalheServico) por `AvisoErro` com `admin={useAdminNeo()}`. Erros de validação já em português (ex.: "Escreva uma observação…") continuam como texto simples.
- [ ] **Step 4:** `node scripts/faturamento-erros-testar.cjs && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(faturamento): erros em uma linha com detalhes para o administrador`.

### Task 4: Painel (antigo Resumo), pílulas e R$ | US

**Files:**
- Create: `src/paginas/faturamento/Painel.tsx` (a partir de `Resumo.tsx`, que é apagado), `src/components/faturamento/PilulasPeriodo.tsx`, `src/components/faturamento/ChaveUnidade.tsx`, `src/components/faturamento/CardsLados.tsx`, `src/lib/useUnidadeFat.ts`
- Modify: `src/App.tsx` (rota `painel`, `resumo` → `<Navigate to="/faturamento/painel" replace />` preservando a query string), `src/components/Shell.tsx` (item "Painel" → `/faturamento/painel`), `src/paginas/faturamento/Faturas.tsx` e demais links para `/faturamento/resumo`, `src/paginas/faturamento/Conferencia.tsx` (tira `AlternarFatura`)
- Delete: `src/components/faturamento/AlternarFatura.tsx`
- Test: `scripts/faturamento-ui-testar.cjs`

**Interfaces:**
- Consumes: `valorFat`, `outraUnidadeFat`, `valorUsFat`, campos novos de `TotaisFat` (Task 2); `AvisoErro` (Task 3); `atalhoPeriodo`, `SeletorPeriodo`, `rotuloPeriodo` existentes.
- Produces:
  - `useUnidadeFat(): { unidade: UnidadeFat; taxa: number|null; vigencia: string|null; mudar: (u: UnidadeFat) => void }` — lê `?unidade=us` (padrão `reais`), busca `valorUsFat()` uma vez com `useDadosComCache('valor-us', …)`; sem taxa força `us`.
  - `<ChaveUnidade />` — segmentado "R$ | US" + texto "1 US = R$ 2.964,33"; R$ desabilitado com `title="Valor da US não encontrado"` quando `taxa===null`.
  - `<PilulasPeriodo faturas={{id,inicio,fim}[]} fatura={string|null} periodo={PeriodoFat} referencia={string} onFatura={(id)=>void} onPeriodo={(p)=>void} />` — pílula "Fatura N ▾" (menu com as faturas), pílulas "Este mês · 3 meses · 6 meses · Ano" (ativa preenchida `bg-sinal text-white`) e "Período" que abre `SeletorPeriodo` num popover (`useFecharFora`).
  - `<CardsLados totais={TotaisFat} unidade taxa onVer={(lado)=>void} />` — os dois cards do spec 4.2 (a menos vermelho; a mais todo verde com tokens `concluido*`; frase "A CEMIG pagou X e o contrato prevê Y"; etiquetas por motivo com `MOTIVOS_FAT`; "N com 1.NS"; "N são 5.62 pago como RC inteiro" e "N outros"; botão "Ver os N serviços →").
- Layout do Painel (de cima para baixo): cabeçalho "Painel do faturamento" + subtítulo (fatura/período · "1 US = R$ …") com `PilulasPeriodo` e `ChaveUnidade` à direita e o "?" (`AjudaFat tema="painel"`); `CardsLados`; grade funil | gráfico (Task 5); grupos "Por tipo de equipe / Por código / Por cidade" (valores na unidade); "Ajustes da fatura". Saem os três cartões `Apoio` e o card escuro.
- Links do Painel com período de várias faturas usam a fatura mais recente do período (`doPeriodo[0]`).
- [ ] **Step 1: Teste de navegador** em `faturamento-ui-testar.cjs` (adaptar o roteiro existente): abrir `/faturamento/painel`; não existe botão "Resumo | Conferência"; existe texto "Pagou a menos" e "Pagou a mais"; o card a menos mostra "−R$ 22.076,19" com `neo_fat_valor_us` interceptado retornando `{valor:2964.33,vigencia:'2026-05-24'}`; clicar "US" muda para "−7,447278 US" (ou o formato de `usFat`) e a URL ganha `unidade=us`; `/faturamento/resumo?fatura=9844` redireciona para `/faturamento/painel?fatura=9844`; a pílula "3 meses" fica ativa por padrão. O interceptador passa a responder `neo_fat_valor_us`, `neo_fat_servicos_valores`, `neo_fat_servico_manutencao` e `neo_fat_servico_historico` (dados reais lidos na transação inicial, como os outros).
- [ ] **Step 2:** `node scripts/faturamento-ui-testar.cjs` com o dev server em `http://127.0.0.1:5173` — Expected: FAIL nas novas asserções.
- [ ] **Step 3: Implementar** os arquivos acima.
- [ ] **Step 4:** `npm run typecheck && node scripts/faturamento-ui-testar.cjs` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(faturamento): Painel com dois cards, pílulas de período e R$ ou US`.

### Task 5: Funil até os divergentes e resumo do gráfico no mouse

**Files:**
- Modify: `src/components/faturamento/FunilConferencia.tsx`, `src/components/faturamento/GraficoFaturas.tsx`, `src/paginas/faturamento/Faturas.tsx`
- Create: `src/components/faturamento/DicaInfo.tsx`
- Test: `scripts/faturamento-ui-testar.cjs`

**Interfaces:**
- Consumes: `TotaisFat` (Task 2), `useUnidadeFat` (Task 4).
- Produces:
  - `<FunilConferencia totais={TotaisFat} unidade taxa onEtapa={(e: 'fora_contrato'|'divergente'|'a_menos'|'a_mais') => void} />` — barras centralizadas com larguras estritamente decrescentes (100, 90, 80, 68, 56 %); etapas Serviços na fatura → Código no contrato (−N fora do contrato) → Valor confere (−N divergentes) → depois as duas de divergência ordenadas por quantidade (maior em cima), "Pagou a mais" `bg-concluido` e "Pagou a menos" `bg-erro-marca`, com a diferença na unidade à direita. Embaixo "X% conferem sem intervenção · clique numa etapa para abrir a lista" e, se houver, "· N conferidos à mão".
  - `<DicaInfo>{conteúdo}</DicaInfo>` — "i" redondo pequeno (`size-3.5 rounded-full bg-nevoa text-aco text-[10px] font-extrabold`), balão escuro (`bg-noite text-linha`) no hover e no foco (é um `button` com `aria-describedby`); sem sublinhado. Textos exatos do spec 4.2; em "Divergentes", "pagou a mais" `font-bold text-concluido-marca` e "pagou a menos" `font-bold text-erro-marca`.
  - `ItemGraficoFat` ganha `a_menos:{us:number;servicos:number}; a_mais:{us:number;servicos:number}; fora_contrato:number; rotulo:string` (fatura e mês). `GraficoFaturas` recebe `unidade` e `taxa`; no hover/foco de cada grupo mostra um balão com uma linha por informação (`flex justify-between gap-3`): título "Fatura N · mês/ano", Pago, Devido, Multas, separador, "A menos · N", "A mais · N", "Fora do contrato". Substitui o `title`.
- [ ] **Step 1: Teste de navegador:** no Painel, hover em "−88 fora do contrato" mostra "Serviços com código que não tem valor na tabela do contrato"; hover no grupo da fatura 9844 do gráfico mostra "A menos · 106" e "A mais · 172" em linhas separadas (dois elementos distintos); as larguras das barras do funil, lidas por `getBoundingClientRect`, são estritamente decrescentes.
- [ ] **Step 2:** rodar — Expected: FAIL.
- [ ] **Step 3: Implementar** (Faturas passa os campos novos para o gráfico).
- [ ] **Step 4:** `npm run typecheck && node scripts/faturamento-ui-testar.cjs` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(faturamento): funil até os divergentes e resumo do gráfico no mouse`.

### Task 6: Lista da Conferência estilo Excel

**Files:**
- Modify: `src/paginas/faturamento/Conferencia.tsx` (reescrita da lista; some a visão "negociar" de cartões e a `TodosServicos` atual)
- Create: `src/components/faturamento/FiltroColuna.tsx`, `src/lib/filtrosConferencia.ts`
- Test: `scripts/faturamento-conferencia-filtros-testar.cjs` (puro), `scripts/faturamento-ui-testar.cjs`

**Interfaces:**
- Consumes: `listarServicosFat`, `valoresColunaFat`, `FiltrosListaFat`, `ColunaFiltroFat` (Task 2); `AvisoErro` (Task 3); `useUnidadeFat`, `ChaveUnidade` (Task 4).
- Produces:
  - `filtrosDaUrl(p: URLSearchParams): FiltrosListaFat` e `urlDosFiltros(f: FiltrosListaFat, base: URLSearchParams): URLSearchParams` em `filtrosConferencia.ts` — listas na URL como valores repetidos (`cidades=A&cidades=B`); atalho de situação em `atalho=a_menos|a_mais|fora|confere|conferidos|todos` (padrão `a_menos`) que vira `lado`/`situacoes` (fora → `situacoes:['FORA_CONTRATO']`, confere → `['OK']`, conferidos → `situacoes:['CONFERIDO']` com `conferidos:'somente'`); toggles `tem_1ns`, `multado`, `tem_562`; faixas `pago_min…`; `ordem=coluna.dir`; `pagina`.
  - `<FiltroColuna coluna rotulo tipo={'lista'|'numero'} filtros onAplicar onOrdenar ativo />` — botão ▾ (preenchido quando ativo) que abre menu: "Ordenar de A a Z / Z a A" (ou "menor para maior / maior para menor" em número); em `lista`: busca (debounce 250 ms chamando `valoresColunaFat`), "(Selecionar tudo)", caixas com contagem, Cancelar / OK; em `numero`: "maior que", "menor que", "entre" (dois campos), Cancelar / OK. Fecha com Esc e clique fora (`useFecharFora`). Valor nulo aparece como "(vazio)" e é enviado como `'—'`.
- Tela: cabeçalho "Conferência" + "Fatura N · mês · 1 US = R$ …" com pílula de fatura (menu com as faturas), `ChaveUnidade`, "Exportar para Excel" (o que está filtrado, todas as páginas, colunas da tabela em US) e "Exportar para negociação" (o atual). Atalhos com contagem (contagens de `lados` e de `totais`), separador, toggles "Contém 1.NS", "Multado", "5.62" (ícones lucide, borda tracejada quando desligado). Linha de etiquetas dos filtros ativos com ✕ e "Limpar todos" + à direita "N serviços · diferença X". Tabela com as 12 colunas do spec 4.4, `FiltroColuna` em cada cabeçalho; fundo `bg-erro-fundo/60` em a menos e `bg-concluido-fundo/60` em a mais; código 1.NS `bg-revisao-fundo text-revisao`, 5.62 `bg-cobre-fundo text-cobre`; ⚠ (`AlertTriangle` `text-revisao`) quando `tem_1ns && !na_manutencao`, com `title` "Tem 1.NS e não foi encontrado na Manutenção". Clique na linha abre `DetalheServico`. Paginação de 50 como hoje. Tabela rola na horizontal dentro do cartão no celular.
- [ ] **Step 1: Testes puros** (`faturamento-conferencia-filtros-testar.cjs`): `filtrosDaUrl(new URLSearchParams('fatura=9844&atalho=a_mais&cidades=A&cidades=B&tem_1ns=sim&ordem=numserv.asc'))` deep-equal `{fatura:'9844',lado:'a_mais',cidades:['A','B'],tem_1ns:'sim',ordem:{coluna:'numserv',dir:'asc'}}`; sem `atalho` → `lado:'a_menos'`; `atalho=fora` → `lado:'todos',situacoes:['FORA_CONTRATO']`; `atalho=conferidos` → `situacoes:['CONFERIDO'],conferidos:'somente'`; ida e volta `filtrosDaUrl(urlDosFiltros(f))` devolve `f`; `ordem=x.lado` é ignorado.
- [ ] **Step 2: Teste de navegador:** abrir a Conferência da 9844; os cabeçalhos são exatamente as 12 colunas; clicar no ▾ de "Cidade" chama `neo_fat_servicos_valores` com `p_coluna:'cidade'`; marcar um valor e OK chama `neo_fat_servicos_listar` com `cidades:[valor]` e a URL ganha `cidades=`; aparece a etiqueta e o ✕ remove; "Contém 1.NS" envia `tem_1ns:'sim'`; a linha com `tem_1ns && !na_manutencao` tem o ⚠.
- [ ] **Step 3:** rodar os dois — Expected: FAIL.
- [ ] **Step 4: Implementar.**
- [ ] **Step 5:** `node scripts/faturamento-conferencia-filtros-testar.cjs && npm run typecheck && node scripts/faturamento-ui-testar.cjs` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(faturamento): Conferência em colunas com filtro estilo Excel`.

### Task 7: Janela do serviço

**Files:**
- Modify: `src/paginas/faturamento/DetalheServico.tsx`
- Test: `scripts/faturamento-ui-testar.cjs`

**Interfaces:**
- Consumes: `linhasServicoFat`, `manutencaoServicoFat`, `historicoServicoFat`, `ServicoFat` novos campos (Task 2); `AvisoErro` (Task 3); `useUnidadeFat` (Task 4); `configFat` (`neo_fat_config.rural`: acrescentar `rural` ao select de `configFat` em `src/lib/faturamento.ts`).
- Conteúdo, na ordem do spec 4.5: cabeçalho (rótulo "Serviço da fatura N", número grande, cidade · zona — Urbana/Rural pela soma de `urbano`/`rural` das linhas, "Urbana e rural" se as duas; selo e diferença na unidade com a outra embaixo); faixa com Nº do serviço · Tipo do serviço · Nº de frota · Tipo da frota; "Como o devido foi calculado" com etiquetas Despacho `fator_aplicado` · Zona (`Urbano` / `Rural × {rural}`) · Tabela, e uma linha de conta por código com fator ("1.21: fator CSC 0,2740 × rural 1,2 = 0,3288 US devido · a CEMIG pagou 0", usando `devido_csc`/`devido_cod` conforme `fator_aplicado`); avisos roxo (tem 1.NS e outro código) e amarelo (`tem_1ns && !na_manutencao`); a frase `fraseServico` e o motivo continuam acima dos avisos; tabela Código · Descrição (do contrato do Faturamento, `neo_fat_contrato.descricao` primeira linha — acrescentar `descricao` ao retorno de `neo_fat_servico_linhas` só se já não vier; senão buscar de `contratosFat` em cache) · Zona · Pago · Multa/estorno, com a linha 1.NS por último em `bg-revisao-fundo/50`, "código informativo, valor pela Manutenção"; bloco "1.NS · Pago pela Manutenção (não entra na soma)" só se `manutencao.itens.length>0`, colunas Código · Observação do contrato (operação · atividade em negrito, descrição embaixo) · Qtd. · US, "sem código" quando `codigo` nulo; glosas como hoje; "Histórico" com `historicoServicoFat` (data `dd/mm hh:mm`, texto por tipo: "Importado na fatura N", "Conferido: <observação> · <nome>", "Conferência desfeita · <nome>"); observação e "Marcar como conferido / Desfazer" como hoje.
- [ ] **Step 1: Teste de navegador:** abrir o serviço `246101137` (dados reais interceptados): textos "Nº de frota", "8180", "Tipo da frota", "Multifuncional", "Rural × 1,2"; não há texto "Moto" nas etiquetas; não há "Devido CSC"; há linha "1.NS" na tabela; há "Não encontrado na Manutenção"; não há "Pago pela Manutenção". Abrir `245579601` (interceptar a manutenção com 1 item de valor 0.06): aparece "Pago pela Manutenção" e "sem código", e não aparece "Observação da equipe".
- [ ] **Step 2:** rodar — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm run typecheck && node scripts/faturamento-ui-testar.cjs` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(faturamento): janela do serviço com frota, fatores, 1.NS da Manutenção e histórico`.

### Task 8: Barra lateral e Manutenção no projeto

**Files:**
- Modify: `src/components/Shell.tsx`, `src/index.css` (classe `rolagem-neo`), textos em `src/App.tsx`, `src/lib/fechamento.ts`, `src/lib/neo.ts`, `src/paginas/fechamento/*.tsx`, `src/paginas/Inicio.tsx`, `src/paginas/Login.tsx`, `src/paginas/faturamento/*` (avisos), `CONTEXTO_GERAL.md`, `MEMORIA_COMPARTILHADA.md`, `docs/*.md` onde nomeiam o módulo
- Create: `src/lib/secoesRecolhidas.ts`
- Test: `scripts/faturamento-texto-testar.cjs` (ou script novo puro) e `scripts/faturamento-ui-testar.cjs`

**Interfaces:**
- Produces:
  - `lerRecolhidas(): Set<string>` e `gravarRecolhidas(s: Set<string>): void` (chave `neo-menu-recolhidas`, JSON, try/catch; falha → conjunto vazio).
  - Em `Shell`: título de seção vira `button` com `aria-expanded` e `ChevronDown` que gira `-rotate-90` quando fechada; fechada mostra a contagem de itens; seção da rota atual abre sozinha ao navegar; seção sem título ("Início") não recolhe; "Em breve" recolhe também.
  - CSS `.rolagem-neo`: `scrollbar-width: thin; scrollbar-color: var(--color-sinal-claro) transparent` e `::-webkit-scrollbar` 10 px, trilho `rgb(255 255 255 / .03)` arredondado com `margin-block: 8px`, alça em `linear-gradient(var(--color-sinal-claro), var(--color-sinal))` com `border: 3px solid transparent; background-clip: padding-box`, hover clareia; esmaecido no topo/pé via `mask-image` ou pseudo-elementos no contêiner da `nav`.
  - Renome: seção do menu "Manutenção"; todo texto de interface "Fechamento de Notas"/"Fechamento" (referindo-se ao módulo) → "Manutenção". `grep -rn "Fechamento" src` ao final só pode achar nomes internos (imports, rotas, identificadores, comentários técnicos).
- [ ] **Step 1: Testes:** puro — `gravarRecolhidas(new Set(['TraceOne · Medidores']))` e `lerRecolhidas()` devolve o mesmo conjunto com um `localStorage` falso; com `localStorage` que lança, `lerRecolhidas()` devolve conjunto vazio. Navegador — o menu tem "Manutenção" e não tem "Fechamento de Notas"; clicar em "Faturamento" esconde "Conferência" e recarregar mantém fechado; ir para `/faturamento/conferencia` com a seção fechada reabre.
- [ ] **Step 2:** rodar — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm run typecheck && npm run build && node scripts/faturamento-ui-testar.cjs` — Expected: PASS; `grep -rn "Fechamento de Notas" src` vazio.
- [ ] **Step 5: Commit** `feat(faturamento): menu recolhível, rolagem nova e Manutenção no lugar de Fechamento de Notas`.

### Task 9: Tabelas do contrato — Valor Moto antes de Fator Moto

**Files:**
- Modify: `src/paginas/faturamento/Contrato.tsx:37` e `:47`
- Test: `scripts/faturamento-ui-testar.cjs`
- [ ] **Step 1: Teste de navegador:** em `/faturamento/tabelas`, o índice do cabeçalho "Valor Moto" é menor que o de "Fator Moto"; na janela de detalhe, "Valor Moto" aparece antes de "Fator Moto".
- [ ] **Step 2:** rodar — Expected: FAIL.
- [ ] **Step 3: Implementar** trocando a ordem das colunas e das células correspondentes.
- [ ] **Step 4:** `node scripts/faturamento-ui-testar.cjs` — Expected: PASS.
- [ ] **Step 5: Commit** `fix(faturamento): Valor Moto antes de Fator Moto nas tabelas do contrato`.

### Task 10: Documentação por aba

**Files:**
- Modify: `src/paginas/faturamento/Documentacao.tsx` (reescrita), `src/components/faturamento/AjudaFat.tsx`, `src/App.tsx` (rota `documentacao/:pagina?`)
- Create: `src/paginas/faturamento/documentacaoPaginas.ts` (conteúdo)
- Test: `scripts/faturamento-ui-testar.cjs`

**Interfaces:**
- Consumes: `avaliarDocFat` (Task 2).
- Produces:
  - `interface PaginaDoc { id: string; titulo: string; grupo: 'Faturamento'|'Referência'; atualizada: string; secoes: { id: string; titulo: string; blocos: BlocoDoc[] }[] }`; `type BlocoDoc = {tipo:'texto';html:string} | {tipo:'nota'|'importante';texto:string} | {tipo:'tabela';cabecalho:string[];linhas:string[][]} | {tipo:'exemplo';titulo:string;linhas:string[]}`. `PAGINAS_DOC: PaginaDoc[]` com ids `visao-geral, faturas, painel, conferencia, importar, tabelas, regras, glossario` (nessa ordem). `html` só com `<b>`/`<i>` controlados no próprio arquivo (sem entrada de usuário).
  - `AjudaFat({ pagina, secao? })` → `/faturamento/documentacao/<pagina>#<secao>`. Painel → `painel`, Conferência → `conferencia`, Faturas → `faturas`, Importar → `importar`, Tabelas → `tabelas`.
  - Layout do spec 4.9: barra do topo com "Documentação" e busca (filtra títulos e textos de `PAGINAS_DOC`, mostra resultados com link); coluna esquerda com grupos e a página aberta expandida mostrando as seções; trilha; título; "Última atualização em …"; blocos; à direita "Nesta página" com destaque da seção visível (`IntersectionObserver`); "Esta página foi útil? Sim / Não" (chama `avaliarDocFat`, depois mostra "Obrigado!"; erro mostra `AvisoErro` compacto); Anterior / Próxima. No celular a coluna esquerda vira um seletor no topo e a direita some.
  - Conteúdo: o de hoje de `Documentacao.tsx`, redistribuído, mais: dois cards e funil (painel), R$ | US e valor da US, filtros por coluna e atalhos/toggles (conferência), 1.NS e Manutenção, 5.62, histórico, erros. `/faturamento/documentacao` sem página abre `visao-geral`; hashes antigos (`#funil`, `#conferencia`, …) redirecionam para a página nova correspondente.
- [ ] **Step 1: Teste de navegador:** `/faturamento/documentacao/painel` mostra a trilha "Documentação › Faturamento › Painel", "Nesta página" com "Os dois cards", e "Esta página foi útil?"; clicar "Sim" chama `neo_doc_avaliar` com `p_pagina:'painel', p_util:true`; "Próxima" leva a `conferencia`; o "?" da Conferência leva a `/faturamento/documentacao/conferencia`; busca "1.NS" lista a página da conferência.
- [ ] **Step 2:** rodar — Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm run typecheck && node scripts/faturamento-ui-testar.cjs` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(faturamento): documentação com uma página por aba`.

### Task 11: Fechamento da rodada

**Files:**
- Modify: `MEMORIA_COMPARTILHADA.md`, `docs/faturamento-relatorio.md`, `CONTEXTO_GERAL.md` (se a arquitetura mudou: tabelas/RPCs novas, `supabase/` fora do Git)
- [ ] **Step 1:** Rodar tudo: `npm run typecheck && npm run build && for f in scripts/faturamento-*-testar.cjs; do node "$f" || exit 1; done` (o `faturamento-ui-testar.cjs` com o dev server aberto). Expected: tudo PASS.
- [ ] **Step 2:** Atualizar a memória e o relatório: 035 (tabela guardada, fim do tempo esgotado), 036 (o que entrou), `supabase/` fora do Git e o risco de não ter cópia, renome Manutenção, decisões tomadas sem o Matheus (lista de "decisões minhas" do spec e do ledger), pendências (modelo "Conferência como sistema" em avaliação; códigos nos lançamentos da Manutenção ainda vazios; push não feito).
- [ ] **Step 3: Commit** `docs(faturamento): registra a rodada 2`.

---

## Resultado da execução (26/10/2026)

Decisões tomadas durante a execução e itens menores adiados na revisão final (copiados do registro de trabalho, que foi apagado).

- Setup: Ruling: executar no main, sem worktree — mesma decisão da rodada 1 aprovada pelo Matheus ("direto na sessão"); Codex usa o mesmo diretório — custo se errado: commits ficam no main local (sem push), fáceis de reverter.
- Setup: Ruling: docs/modelos/conferencia-sistema.html entra no commit do spec — Matheus pediu para guardar o modelo e acessar depois — custo se errado: um arquivo a mais no repo.
- Task 1: Ruling: busca da lista de valores é "contém" (como o Excel), não "começa com"; teste ajustado para includes('1.') — custo se errado: troca de um '%' no SQL.
- Task 1: Ruling: criada a 037 (filtros rápidos) porque a 036 aplicada deixou a lista em 6 s (funções por linha com SET não embutidas); 036 não foi editada — custo se errado: nenhum, 037 só substitui funções.
- Task 1: Ruling: helper neo_fat_servicos_filtrar devolve só as colunas de filtro/ordem; a página busca a linha completa pela chave — mantém o campo "ordem" nos serviços como antes.
- Task 3: Ruling: mensagens do próprio sistema (Error comum, não TypeError, e P0001 do banco) aparecem como estão, com acao 'corrigir'; o teste "Error('qualquer') → genérica" virou "código desconhecido/TypeError → genérica" — todas as `throw Error` do código já são frases em português — custo se errado: algum Error técnico interno apareceria cru.
- Task 3: Ruling: AvisoErro em Faturas, Importar e Contrato agora; Conferência, Painel e janela do serviço recebem nas tarefas 4/6/7, que reescrevem essas telas — custo se errado: nenhum, só ordem.
- Task 3: Ruling: useAdminNeo fica em AvisoErro.tsx (precisa do contexto React), erros.ts fica puro para teste em Node.
- Task 4: Ruling: o teste de navegador da Importação procurava a frase antiga do aviso (mudou na Task 3); ajustado para "A importação fica bloqueada até conferir…". A Task 3 só rodou testes puros e typecheck — o teste de navegador passa a rodar em toda tarefa de tela — custo se errado: nenhum.
- Task 4: Ruling: Painel com fatura escolhida usa a pílula "Fatura N" preenchida; sem fatura, a pílula do atalho fica ativa (3 meses por padrão).
- Task 5: Ruling: na aba Faturas o resumo do gráfico fica em US (a aba não tem a chave R$ | US) — custo se errado: acrescentar a chave na aba Faturas.
- Task 5: Ruling: funil sem a etapa "Equipe identificada" (o spec lista só Serviços → Código no contrato → Valor confere → a mais → a menos); os sem equipe aparecem na nota de baixo quando houver.
- Task 5: Ruling: tabela para leitores de tela do gráfico dentro de div.sr-only — a tabela sr-only com mais colunas estourava a largura no celular.
- Task 6: Ruling: em vez de filtrosDaUrl/urlDosFiltros (plano), um EstadoConferencia com estadoDaUrl/urlDoEstado/filtrosDoEstado — o atalho (a menos, fora…) não se reconstrói só pelos filtros do banco; os testes cobrem o mesmo comportamento — custo se errado: só nomes.
- Task 6: Ruling: botões 1.NS / Multado / 5.62 alternam em três estados (contém → não contém → tanto faz), atendendo "contém 1.NS ou não" — custo se errado: virar liga/desliga.
- Task 6: Ruling: selo de situação: a mais em verde, confere neutro, fora do contrato em âmbar (cores do Painel aprovado) — custo se errado: troca de classes.
- Task 6: Ruling: filtros de número digitados na unidade da tela (R$ ou US) e guardados na URL sempre em US.
- Task 6: Ruling: link "Por código" do Painel usa codigo_principal (mesma conta do grupo), mostrado como etiqueta "Código principal".
- Task 7: Ruling: descrição do código vem da tabela do contrato do Faturamento (contratosFat em cache), primeira linha; a RPC de linhas não foi alterada — custo se errado: nenhum além de 1 chamada a mais na janela.
- Task 7: Ruling: em serviço pago por RC (uma vez por atendimento) a conta por linha dá lugar à nota de cálculo (RC pago uma vez); nos outros, uma linha de conta por código com fator.
- Task 8: Ruling: a seção da página aberta reabre só quando a página muda (ou carrega), não no clique — senão não dava para fechar a seção em que se está — custo se errado: ajuste no efeito.
- Task 8: Ruling: renome dos .md (memória, contexto, relatório) fica para a Task 11, junto com a atualização da memória.
- Task 8: Ruling: "Fechamento de NSIS" (título da fila) virou "Manutenção · fila de NSIS"; no Login, "Manutenção · notas de NSIS"; "códigos de fechamento" da Tabela 11 do contrato continua (é o nome do tipo de código, não do módulo).
- Task 10: Ruling: conteúdo com marcador **negrito** em texto simples, não HTML (sem dangerouslySetInnerHTML) — mesmo resultado, sem risco de marcação — custo se errado: nenhum.
- Task 10: Ruling: rotas "documentacao" e "documentacao/:pagina" (duas rotas, em vez de :pagina?) e #tema antigo redireciona para a página nova.
- Final review: reviewer opus — 0 Critical, 4 Important, 11 Minor. Re-grade: 2 minors subiram para Important (links antigos da Conferência — o redirecionamento de /faturamento?situacao= do próprio app caía na visão errada; "0.5" no filtro virava 5 em silêncio).
- Final: fixed coluna com 200+ valores perdia linhas ao desmarcar — UI "Coluna com 200 valores" RED→GREEN, suite 12/12
- Final: fixed soma do cabeçalho ignorava motivo/situação — rodada2-testar soma -3.998762 RED→GREEN (migration 038), suite 12/12
- Final: fixed Conferência carregando para sempre sem painel — UI "Sem painel (falha ou nenhuma fatura)" RED→GREEN, suite 12/12
- Final: fixed Error técnico chegava cru ao usuário — erros-testar "Corrupted zip/RangeError → genérica" RED→GREEN (ErroNeo + leitura de planilha protegida), suite 12/12
- Final: fixed links antigos da Conferência — filtros-testar "lado/visao/situacao/motivo/cidade/codserv" RED→GREEN, suite 12/12
- Final: fixed "0.5" lido como 5 — filtros-testar lerNumeroBr RED→GREEN, suite 12/12
- Final: fixed (junto) pagina fracionária na URL — filtros-testar pagina=1.01 RED→GREEN, suite 12/12
- Final: minor (deferred): atalho Fora/Conferem/Conferidos sobrepõe a seleção da coluna Situação sem avisar.
- Final: minor (deferred): contagem das pílulas (fora do contrato, conferem) conta conferidos e pode diferir do total da lista.
- Final: minor (deferred): apagar uma fatura com conferências falharia pelo gatilho DESCONFERIDO (não há caminho no app que apague fatura).
- Final: minor (deferred): "(Selecionar tudo)" desmarcado + OK tira o filtro em vez de mostrar nada.
- Final: minor (deferred): neo_fat_servico_manutencao responde por qualquer numserv a quem tem o módulo Faturamento (sem exigir o da Manutenção).
- Final: minor (deferred): neo_fat_atualizar_totais faz select * da view (consulta a Manutenção para 21.910 linhas a cada recálculo; cabe no tempo).
- Final: minor (deferred): na janela do serviço, o erro das linhas e o da Manutenção usam o mesmo aviso; falha no histórico mostra "Sem registros.".
- Final: Ruling: valor da US pega a vigência mais recente mesmo se for futura — o spec pede "o mais recente" — custo se errado: R$ adiantado até a data da vigência.
- Final: Ruling: período com várias faturas abre a Conferência da mais recente — decisão registrada no spec — custo se errado: link para outra fatura.
