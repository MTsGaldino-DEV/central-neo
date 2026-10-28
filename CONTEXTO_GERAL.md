# Contexto Geral — Central NEO

> **Atualizado em:** 2026-10-20
> Ponto de entrada para quem (pessoa ou IA) for trabalhar na Central NEO.
> Continuidade entre Codex e Claude: leia também `MEMORIA_COMPARTILHADA.md`.

## 1. O que é

Central do **NEO (Núcleo de Eficiência Operacional)**, irmã da Central NEC. Responsabilidades do NEO:

| Frente | Situação |
|---|---|
| Controle de medidores (TraceOne) | ✅ no MVP |
| Manutenção (antigo Fechamento de Notas: controle de NSMC, aba "211 NSIS") | ✅ no MVP |
| Faturamento | faturas, painel, conferência, importação, contrato e documentação implementados |
| Notas de ouvidoria | em breve |
| Conciliação: o que foi enviado para pagamento × o que a CEMIG pagou | em breve (o fechamento já traz o comparativo por fatura) |

## 2. Arquitetura

- **Frontend:** React 19 + Vite 6 + TypeScript + Tailwind v4 + React Router 6.
- **Backend principal: projeto Supabase `central-neo`** (`dxcxoimvweeggrvtbmxb`, sa-east-1). Nele ficam login (`auth.users`), cadastro único de colaboradores, acessos, fechamento, contrato e painel. Migração feita em 2026-10-20.
- **TraceOne emprestado** (`ctlaygzndbaojxpwqsco`): só para os medidores. O app abre uma segunda sessão lá com o mesmo e-mail e senha (`lib/auth.ts`, cliente `supabaseTraceone`), porque a RLS dos medidores depende do papel do usuário no TraceOne (`profiles.role`). Se a senha de lá for diferente, a tela "Conectar ao TraceOne" pede uma vez.
- O TraceOne web (Next.js) **continua no ar** em paralelo. As telas de medidores da NEO foram copiadas de `../traceone/frontend` e adaptadas.
- **Objetivo:** a Central NEO é o login único de todos os sistemas (TraceOne, Central NEC, Warefly). Por enquanto só a NEO usa esse login; ligar os outros sistemas é a próxima etapa.

### Pastas

```
src/
  lib/            supabase.ts       dois clientes: supabase (NEO) e supabaseTraceone (medidores)
                  api.ts, permissions.ts, planilhaLucas.ts  ← copiados do TraceOne (api.ts usa supabaseTraceone)
                  auth.ts           login NEO + conexão TraceOne, sair, trocar senha (sincroniza as duas)
                  navegacao.ts      ponte useRouter/usePathname (Next) → React Router
                  neo.ts            acesso por módulo (neo_acessos) e logins (Edge Function admin-usuarios)
                  colaboradores.ts  cadastro único de pessoas (CPF, matrículas…)
                  fechamento.ts     consultas/edição do fechamento de NSIS
                  fechamentoPlanilhas.ts  leitura do relatório GDIS e da planilha de controle (puro, testável)
                  fechamentoFormato.ts    lerNumero / normalizarAP (sem dependências)
  contexto/Sessao.tsx  sessão NEO + cadastro + acesso NEO + conexão/perfil TraceOne
  components/     Shell (layout), NeoLogo, fechamento/EtapaChip + copiados do TraceOne (charts, Pagination…)
  paginas/        Login, ResetSenha, Inicio, Acessos (logins e acessos), Colaboradores
  paginas/traceone/   Lista, Lancamento, Importacao, Conferencia, Conferencia45, Backup  ← portados
                      ConectarTraceone (pede a senha do TraceOne se a conexão automática falhar)
  paginas/fechamento/ Fila, PainelNsis, Importar, TabelaValores, Painel
supabase/migrations/       001–012 do banco central-neo (aplicar com `node scripts/migrar.cjs`)
supabase/functions/        admin-usuarios (criar login, redefinir senha, bloquear; só ADMIN NEO)
supabase/legado-traceone/  migrations antigas aplicadas no TraceOne (objetos neo_* de lá; podem ser removidos)
scripts/                   migrar.cjs, copiar-do-traceone.cjs (cópia única de 2026-10-20)
```

### Ao portar mudanças do TraceOne

As telas de `paginas/traceone/` são cópias. Se uma tela mudar no TraceOne, copie o arquivo de novo e reaplique:
imports `../../lib` → `@/lib`, `next/navigation` → `@/lib/navegacao`, rotas `/dashboard/*` → `/traceone/*`,
cores `bg-[#1e3a5f]` → `bg-sinal`. Os tokens de cor (`tinta`, `sinal`, `nevoa`, `linha`, `aco`…) têm **os mesmos nomes** do TraceOne e outros valores. Por isso o visual muda sem reescrever as telas.

## 3. Acesso

- **Login:** `auth.users` do central-neo. Os 7 usuários do TraceOne (sem as contas de serviço) foram copiados com o mesmo id e a mesma senha (hash bcrypt).
- **Colaboradores** (`colaboradores`): cadastro único de pessoas, com nome, CPF (só números, validado), matrícula CEMIG (ex.: `e272662`), matrícula Engelmig, e-mail, telefone, cargo, equipe, base, supervisor, GC, GO, admissão, desligamento e ativo.
  - `usuario_id` liga a pessoa ao login.
  - Carga inicial: os 248 colaboradores do TraceOne (a matrícula de lá é a CEMIG) e um cadastro para cada login.
  - RLS: o ADMIN NEO lê e edita tudo; cada um lê só o próprio cadastro.
- Entra na NEO quem tem linha ativa em `neo_acessos` (`papel` ADMIN/USUARIO, `modulos` ⊂ {`traceone`, `fechamento`}). ADMIN vê tudo.
- **Logins e acessos** (ADMIN NEO): cria login, redefine senha, bloqueia e escolhe os módulos. Criar login e trocar senha passam pela Edge Function `admin-usuarios`, que confere `neo_is_admin()` e usa a service_role.
- A troca da própria senha (menu) muda na NEO e, se o TraceOne estiver conectado, lá também, para as duas continuarem iguais.
- Na NEO o TraceOne é só ferramenta: quem não é ADMIN NEO vê apenas a **Lista de Medidores** (pesquisa e alterações ficam nela). Lançamento, Importar, Conferências e Backup ficam ocultos e só abrem para ADMIN NEO (menu e rotas).
- As permissões das telas de medidores continuam vindo de `profiles.role` (RLS do TraceOne). Despachante só vê a lista, e Backup é só para ADMIN do TraceOne.
- Primeiro admin: `matheus.galdino@engelmig.com.br`.

## 4. Manutenção (Fechamento de NSIS)

Na tela o módulo se chama **Manutenção** desde 26/10/2026; URLs, tabelas e arquivos mantêm o nome `fechamento`.

### O processo (como era na planilha)
1. O GDIS gera o relatório **"Serviços Executados - Completo"**. Interessa só **Resp. = CONTRATADA**. Desde a migration 008 entram todos os tipos (NSIS, NSRI, MULTIFUNCIONAL…), e o **Tipo de Serv.** fica em `neo_nsis.tipo_serv`.
2. O rapaz do fechamento lê a **Observação** (o que a equipe fez) e decide o que cobrar. Pode ser mais de um item por NSIS, cada um com um valor em **US**, conforme o contrato CEMIG.
3. Gera a **NSMP** (pedido de pagamento) no sistema da CEMIG.
4. A CEMIG devolve a **NSPR** (confirmação) e o **valor final** pago.
5. O pagamento aparece numa fatura: **APROPRIAÇÃO/FATURA** (ex.: `AP 83809`).

### Modelo
- `neo_nsis`: uma linha por NSIS, com os campos do relatório. Localidade = 4 primeiros dígitos da Referência, e DT EXECUÇÃO = Término. Também guarda `sem_cobranca` + `motivo_sem_cobranca` e a `origem` (RELATORIO, HISTORICO ou MANUAL).
- `neo_nsis_itens`: cada cobrança (descrição, código, equipe, valor_inicial, us_adicional, nsmp, nspr, valor_final, fatura).
- `neo_localidade_supervisor`: localidade (4 dígitos) → município, posto e supervisor (Posto 1 Pedro, 2 Elton, 3 Vinicius, 4 Victor; carga na migration 009). Não tem tela: mudanças vão por migration. A view traz `supervisor` no fim. NSIS sem localidade (as do histórico) ficam sem supervisor.
- `neo_vw_nsis` (security_invoker): calcula a **etapa** a partir dos itens:
  `A_FECHAR → AGUARDANDO_NSMP → AGUARDANDO_NSPR → AGUARDANDO_FATURA → FATURADA`, ou `SEM_COBRANCA`.
- Alertas: **divergente** = tem NSPR e valor pago ≠ pedido. **Sem valor pago** = tem NSPR, mas o valor final está vazio (comum no histórico). O "pago − pedido" só compara itens com os dois valores.
- RPCs: `neo_importar_nsis` (upsert do relatório, nunca mexe em itens), `neo_importar_historico` (planilha de controle, idempotente por serviço + NSMP), `neo_resumo_fechamento`, `neo_resumo_faturas`, `neo_listar_usuarios`.
- RLS: `neo_tem_modulo('fechamento')`.

### Telas
- **Fila de NSIS** (`/fechamento`): etapas com contagem, busca (serviço/NSMP/NSPR/AP/equipe/texto), localidade, alertas, visão **por fatura** (pedido × pago) e exportação Excel no formato da planilha. Ao clicar numa NSIS abre o painel com o que foi feito, os detalhes da execução e os itens. Cada item tem as etapas NSMP → NSPR + valor pago → AP, e cada uma é preenchida com um Enter.
- **Importar** (`/fechamento/importar`): relatório semanal do GDIS e planilha de controle (carga única do histórico).

### Tabela de valores (contrato CEMIG, Anexo VI, Tabela 03)
- Só a **Tabela 03** (manutenção em linha morta, códigos 703994–704148, 155 itens) é usada no fechamento. Fica em `neo_contrato_itens` (migration 004).
- `fator_original` = valor publicado; `fator_us` = valor em vigor. Acertos são feitos na tela **Tabela de valores** (`/fechamento/tabela`), só por ADMIN NEO, sempre com motivo. Cada acerto vai para `neo_contrato_historico` (trigger + RPC `neo_acertar_fator`). Também dá para desativar um código ou criar um código fora da tabela.
- No painel da NSIS, o item é lançado escolhendo o código (busca por número ou palavra). Valor = fator × quantidade × 1,2 se rural (o padrão vem da zona U/R do relatório). Se o código for uma instalação com retirada correspondente, a opção "Foi substituição" lança os dois itens (nota 2 da tabela). Ainda dá para lançar sem código.
- O item guarda `fator_unitario` (valor do código na hora do pedido): **acertar um código não muda itens já lançados**.

### Valor em reais (apostilamento) e Painel
- O contrato paga em US. O valor da US em R$ fica em `neo_valor_us` (uma linha por início de vigência), mantido pelo ADMIN NEO na tela **Tabela de valores** (todos veem; só o ADMIN NEO altera). Carga inicial: R$ 2.880,23 de 24/05/2025 a 23/05/2026 e R$ 2.964,33 a partir de 24/05/2026. O início em 24/05/2025 é uma suposição de reajuste anual e ainda precisa ser confirmado.
- **R$ do item = round(US × valor da US vigente na data de execução (Término), 2)**. O cálculo é feito na consulta (`neo_vw_itens`, colunas novas no fim de `neo_vw_nsis`), então corrigir um valor da US corrige tudo. NSIS sem data ou executada antes da primeira vigência fica sem R$.
- **Painel** (`/fechamento/painel`, RPC `neo_painel_fechamento(inicio, fim)`): período pela data de execução (atalhos 12 meses/ano/tudo ou campos de/até, na URL `periodo`, `de`, `ate`), alternância R$/US, cartões (executadas, pedido, pago, aguardando), gráfico mensal Contrato 2026 × Tabela CEMIG × Pago (clique leva à fila filtrada pelo mês), etapas do período, pendências por idade (foto de hoje) e rankings. **O que mais pedimos** só conta itens lançados por código em "O que deve ser cobrado?" (migration 011; o histórico, sem código, fica fora). Clicar num serviço, equipe ou localidade abre a fila filtrada (`codigo`, `equipe`, `loc`) no mesmo período. **Apropriações** (migration 012, RPC `neo_painel_apropriacoes`): as 10 APs com mais valor pago entre as NSIS executadas no período; o clique abre a fila buscando a AP.
- **Contrato 2026 × Tabela CEMIG × Pago** (Painel, migration 010, RPC `neo_painel_contratos`): a CEMIG paga pela aba "Fechamento - NSIS" da planilha "Contratão 2024 (Utilizado CEMIG)". Em 2026-10-21 ela foi comparada código a código com o Anexo VI (Tabela 03): mesmos 155 códigos e valores, rural = +20%. As diferenças entre os dois entram como **acertos** na Tabela de valores: `fator_original` = Contrato 2026 e `fator_us` = Tabela CEMIG. Por item: Contrato 2026 = fator_original × qtd × 1,2 se rural (`neo_vw_itens.valor_contrato`); Tabela CEMIG = valor_inicial (pedido); Pago = valor_final. Base comparável = itens com código e já pagos (NSPR + valor). Os itens do histórico não têm código e ficam fora. A aba "Planilha3" (CONTRATAO 2024, códigos 700xxx LV) ainda não é usada.
- **Fila**: colunas na ordem N° Serviço · Tipo do serviço · NSMP · Equipe · Supervisor (com a localidade) · NSPR/NSMC · DT execução · Lançamento Salesforce (US pedida) · Pago · Apropriação · Observação · Etapa. Tempo de deslocamento e de execução não aparecem mais (continuam guardados). Os filtros ficam na URL (`q`, `loc`, `equipe`, `tipo`, `codigo`, `de`, `ate`, `alerta`, `ordem`). `codigo` filtra pela coluna `codigos` de `neo_vw_nsis` (códigos da Tabela 03 dos itens). A data de execução vai de/até, com atalhos, e as contagens por etapa seguem os filtros. NSMP e NSPR têm colunas próprias.

### Pendente
- As abas "211 TRAFO" e "211 TRIPSAVER" da planilha ficaram fora do MVP. O modelo (`neo_nsis` + itens) serve de base para elas.
- **Lembrete (2026-10-22):** os cards Contrato 2026 × Tabela CEMIG × Pago ficam em 0 porque só somam itens lançados por código e já pagos, e o histórico não tem código. O Matheus vai resolver com a sincronização com o GDIS, que deve deixar o valor mais próximo do real.

## 5. Identidade visual

Conceito **"o círculo que fecha"**: um anel aberto (a nota pendente) com um ponto preenchendo a abertura (o pagamento que fecha a conta). O símbolo é o "O" de NEO (`components/NeoLogo.tsx`, `public/favicon.svg`).

| Token | Hex | Uso |
|---|---|---|
| `sinal` (Petróleo) | `#0B7285` | ação principal, ativo |
| `sinal-claro` | `#3BC9DB` | ponto da marca sobre fundo escuro |
| `noite` | `#061A1F` | barra lateral, login |
| `tinta` | `#0B1F24` | texto |
| `nevoa` / `linha` / `aco` | `#F4F7F8` / `#DDE6E8` / `#586E74` | fundo / bordas / texto secundário |
| `cobre` | `#D9822B` | valores em US, divergências |

Etapas: a fechar (petróleo), NSMP (âmbar), NSPR (violeta), fatura (azul), faturada (verde), sem cobrança (cinza).
Fontes: **Manrope** (interface) e **JetBrains Mono** (números de serviço, NSMP, NSPR, AP, serial, matrícula).

## 6. Rodar e publicar

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run build
```
`.env` (modelo em `.env.example`), com dois projetos Supabase:
- **CENTRAL-NEO (principal)**, ref `dxcxoimvweeggrvtbmxb`, sa-east-1:
  - frontend: `VITE_NEO_SUPABASE_URL`, `VITE_NEO_SUPABASE_ANON_KEY` (ou `_PUBLISHABLE_KEY`);
  - só para scripts: `NEO_SUPABASE_SERVICE_ROLE_KEY`, `NEO_DB_PASSWORD`, `NEO_DATABASE_URL` (pooler `aws-1-sa-east-1`, porta 5432 = sessão, 6543 = transação).
  - Banco principal em uso; login, colaboradores, acessos e fechamento migrados em 2026-10-20.
- **TRACEONE (emprestado, medidores)**, ref `ctlaygzndbaojxpwqsco`: `VITE_TRACEONE_SUPABASE_URL`, `VITE_TRACEONE_SUPABASE_ANON_KEY`. Usado somente para medidores, com sessão própria (`src/lib/supabase.ts`).
- `VITE_TRACEONE_URL`: URL do TraceOne web, usada nos botões que abrem telas de lá.

Só variáveis `VITE_` vão para o navegador. Service_role e senha do banco nunca levam esse prefixo.

Migrations do banco central-neo: `node scripts/migrar.cjs` (usa `NEO_DATABASE_URL`; `--testar` roda e desfaz). 001–009 aplicadas em 2026-10-20 010 em 2026-10-21 011 e 012 em 2026-10-22.
Edge Function: `supabase functions deploy admin-usuarios --project-ref dxcxoimvweeggrvtbmxb --use-api`.
No painel do Supabase (central-neo), em Authentication → URL Configuration, cadastre a URL publicada da NEO em Site URL e em Redirect URLs. Sem isso, o link de "Esqueci minha senha" não volta para `/reset-senha`.

A NEO não acessa o GDIS diretamente, então não precisa de VPN.

## 7. Faturamento

Implementado em 23/10/2026. Compara créditos e glosas da CEMIG com as Tabelas 11 (código de fechamento) e 12 (RC por atendimento), sem compartilhar tabelas do Fechamento. Banco CENTRAL-NEO, objetos `neo_fat_*`, migrations 013–027 aplicadas após teste com rollback. Entrega inicial reprovada; as revisões posteriores corrigem as regras descritas abaixo, mas não substituem a validação de negócio por Matheus.

- Rotas (26/10/2026): `/faturamento` (faturas), `/faturamento/painel` (`/resumo` redireciona), `/faturamento/conferencia`, `/faturamento/importar`, `/faturamento/tabelas`, `/faturamento/documentacao/<página>`. Migrations até a 037; `supabase/` fica fora do Git. Acesso via módulo `faturamento`; contrato editável por ADMIN com motivo e histórico.
- Leitura pura: `src/lib/faturamentoPlanilhas.ts`. Dados originais são preservados em JSON; importação em lotes publica a fatura numa transação, mantendo conferências em tabela separada. Identificador estável: `idapropriacaotemposervico`. Alteração dos dados, equipe/frota, fatores, devido ou situação calculada invalida a conferência anterior; ela permanece registrada para consulta. `neo_fat_conferencias.contexto` guarda o contexto da revisão; revisões anteriores à migration 027 são reabertas para contemplar a mudança da regra de RC.
- Tabela 12 tem precedência sobre 11, **exceto** na transposição obrigatória das notas 2–3: se há um único código remunerável da lista contratual, com eventuais códigos informativos de fator zero, o RC é descartado e vale a Tabela 11. A lista configurável fica em `neo_fat_rc_transposicao`. RC não transposto é pago uma vez por atendimento (`fatura + numserv`), mesmo com vários códigos/linhas. O devido fica na primeira linha por `id` para totalização; o detalhe mostra o valor do serviço e `REVISAR_RC_MULTILINHA` quando o líquido fecha mas as linhas não. Comparação dos dois fatores CSC/COD, seis casas, tolerância 0,000001. Tabela 11 usa FATOR RURAL/MOTO por código (`neo_fat_contrato.rural/moto`); RC e códigos Moto 0,7 usam configuração `neo_fat_config`, inclusive o rural de Moto 0,9 provisório. Regras em `neo_fat_base`/`neo_fat_calculo`.
- Importação exige **Fatura Resumida** e **Fatura Completa**. `US_Servico.numserv → Serviço.numserv → Serviço.veiculo → US_Turma.numvei`; `Serviço.ident_turma` desempata veículos que mudam de tipo, conferindo também a frota. Tipos D/M/U/Q = Multifuncional/Moto/Umpla/Quarteto. RPCs `neo_fat_iniciar_completa` e `neo_fat_finalizar_completa` publicam valores/vínculos juntos. Nome da Completa é guardado; período vem de Apropriação. Faltantes/ambíguos seguem sem equipe confirmada; coincidência exclusiva com moto gera `MOTO_PROVAVEL`. RC multilinha respeita equipe na comparação agregada.
- Despacho e área (27/10/2026, migration 039): COD quando o `tipo_serv` está em `neo_fat_despacho_cod`, senão CSC (sem escolha pelo valor que coincide); área pela `cod_tip_area` da aba Serviço (U urbano, R/S rural), quantidade ainda em K + M. Homem-hora (1.62, 1.73, 5.63, 5.64): horas `dh_terreal − dh_aciona` por minuto × Tabela 14 (`neo_fat_prontidao`, pela equipe) × (1 + 0,2 COD + 0,2 rural). `neo_fat_base` traz `despacho`, `area`, `horas`, `us_hora`, `multiplicador` e deixa nulo o devido do despacho não usado. RC com código de homem-hora (migration 040) não paga o RC por atendimento: cada linha vale o seu código. Código 0.06 (041) vale 0 e zera o serviço. `neo_fat_servicos_lista.fator_12` sinaliza possível fator errado com o texto do caso: × ou ÷ 1,2 / 1,4 / 1,44, troca 1,2 ↔ 1,4 ou × 0,8 (043; filtro `fator_12`).
- L/N/O são armazenadas sem cálculo (exceto a coluna O do homem-hora, desde 27/10/2026). Glosa positiva tratada como estorno. Ajustes de `Debito_Credito` mostrados separadamente. Fatores são validados por texto e posição nas células do PDF, independentemente do valor pago. São 215 códigos numéricos carregados, quatro pendentes da NOTA 10. A migration 020 complementou 99 fatores originais ausentes com histórico; acertos existentes foram preservados. Códigos sem fator calculável geram `CODIGO_FORA_CONTRATO`.
- Fatura 9844 após leitura integral dos PDFs: 27.389 linhas e 21.910 serviços; 24.785 OK, 642 DIVERGENTE, zero MOTO_PROVAVEL, 652 sem fator e 1.310 para revisar RC multilinha. Crédito 917,112183 US, débito 21,226389, estorno 7,446161 e devido parcial 857,921936. São 1.813 serviços/1.820 linhas RC transpostos. PDF da Tabela 11 tem 14 páginas, o da 12 tem 2; as notas 8 terminam cortadas e a NOTA 10 não está presente. PSAP/apoio 0,3 e documentação física não podem ser validados com as planilhas atuais; o rural de Moto 0,9 permanece provisório.
- Relatório completo: `docs/faturamento-relatorio.md`. Evidência da extração: `docs/faturamento-validacao-contrato.json`. Totais: `docs/faturamento-9844-resultados.json`.
- Testes de integração com rollback: `node scripts/faturamento-testar.cjs`; verificação de tipos e build com `npm.cmd run typecheck` / `npm.cmd run build` no PowerShell.
- Conferência após migrations 021/022: `neo_fat_listar` retorna linhas e total com filtros/paginação em uma RPC autenticada; `src/lib/faturamento.ts` a chama em vez de consultar a view com contagem direta pelo PostgREST. As views `neo_fat_base`, `neo_fat_calculo` e `neo_fat_conferencia` usam dono da view para evitar checagem de RLS por linha em subconsultas, com `neo_tem_modulo('faturamento')` explícito na base e na conferência. A consulta antiga continua funcional para o frontend já publicado. Teste: `node scripts/faturamento-conferencia-testar.cjs`.

- Revisão visual e funcional de importação/contrato/equipe no Chrome desktop e celular; APIs do navegador simuladas com dados lidos da NEO. Importação real e testes transacionais verificados separadamente. Scripts `faturamento-planilhas-testar.cjs`, `faturamento-duas-planilhas-testar.cjs`, `faturamento-ui-testar.cjs`; extração geométrica em `faturamento-validar-pdf.py`.
