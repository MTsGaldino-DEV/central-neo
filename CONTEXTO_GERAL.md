# Contexto Geral — Central NEO

> **Atualizado em:** 2026-10-20
> Ponto de entrada para quem (pessoa ou IA) for trabalhar na Central NEO.

## 1. O que é

Central do **NEO**, irmã da Central NEC. Responsabilidades do NEO:

| Frente | Situação |
|---|---|
| Controle de medidores (TraceOne) | ✅ no MVP |
| Fechamento de notas de manutenção (controle de NSMC, aba "211 NSIS") | ✅ no MVP |
| Faturamento | em breve |
| Notas de ouvidoria | em breve |
| Conciliação: o que foi enviado para pagamento × o que a CEMIG pagou | em breve (o fechamento já traz o comparativo por fatura) |

## 2. Arquitetura

- **Frontend:** React 19 + Vite 6 + TypeScript + Tailwind v4 + React Router 6. Deploy: Docker/Nginx no Dokploy (`Dockerfile`, `docker-compose.yml`).
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
supabase/migrations/       001–007 do banco central-neo (aplicar com `node scripts/migrar.cjs`)
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
- As permissões das telas de medidores continuam vindo de `profiles.role` (RLS do TraceOne). Despachante só vê a lista, e Backup é só para ADMIN do TraceOne.
- Primeiro admin: `matheus.galdino@engelmig.com.br`.

## 4. Fechamento de NSIS

### O processo (como era na planilha)
1. O GDIS gera o relatório **"Serviços Executados - Completo"**. Interessa só **Tipo de Serv. = NSIS** com **Resp. = CONTRATADA**.
2. O rapaz do fechamento lê a **Observação** (o que a equipe fez) e decide o que cobrar. Pode ser mais de um item por NSIS, cada um com um valor em **US**, conforme o contrato CEMIG.
3. Gera a **NSMP** (pedido de pagamento) no sistema da CEMIG.
4. A CEMIG devolve a **NSPR** (confirmação) e o **valor final** pago.
5. O pagamento aparece numa fatura: **APROPRIAÇÃO/FATURA** (ex.: `AP 83809`).

### Modelo
- `neo_nsis`: uma linha por NSIS, com os campos do relatório. Localidade = 4 primeiros dígitos da Referência, e DT EXECUÇÃO = Término. Também guarda `sem_cobranca` + `motivo_sem_cobranca` e a `origem` (RELATORIO, HISTORICO ou MANUAL).
- `neo_nsis_itens`: cada cobrança (descrição, código, equipe, valor_inicial, us_adicional, nsmp, nspr, valor_final, fatura).
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
- O contrato paga em US. O valor da US em R$ fica em `neo_valor_us` (uma linha por início de vigência), mantido pelo ADMIN NEO na tela **Tabela de valores**. Carga inicial: R$ 2.880,23 de 24/05/2025 a 23/05/2026 e R$ 2.964,33 a partir de 24/05/2026. O início em 24/05/2025 é uma suposição de reajuste anual e ainda precisa ser confirmado.
- **R$ do item = round(US × valor da US vigente na data de execução (Término), 2)**. O cálculo é feito na consulta (`neo_vw_itens`, colunas novas no fim de `neo_vw_nsis`), então corrigir um valor da US corrige tudo. NSIS sem data ou executada antes da primeira vigência fica sem R$.
- **Painel** (`/fechamento/painel`, RPC `neo_painel_fechamento(inicio, fim)`): período pela data de execução, alternância R$/US, cartões (executadas, pedido, pago, aguardando), pedido × pago por mês (clique leva à fila filtrada), etapas do período, pendências por idade (foto de hoje) e rankings de serviços, equipes e localidades.
- **Fila**: os filtros ficam na URL (`q`, `loc`, `equipe`, `de`, `ate`, `alerta`, `ordem`). A data de execução vai de/até, com atalhos, e as contagens por etapa seguem os filtros. NSMP e NSPR têm colunas próprias.

### Pendente
- As abas "211 TRAFO" e "211 TRIPSAVER" da planilha ficaram fora do MVP. O modelo (`neo_nsis` + itens) serve de base para elas.

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
  - Em 2026-10-20 estava vazio, ainda sem tabelas nem usuários.
- **TRACEONE (emprestado, medidores)**, ref `ctlaygzndbaojxpwqsco`: `VITE_TRACEONE_SUPABASE_URL`, `VITE_TRACEONE_SUPABASE_ANON_KEY`. **Hoje o app inteiro ainda roda aqui** (`src/lib/supabase.ts`).
- `VITE_TRACEONE_URL`: URL do TraceOne web, usada nos botões que abrem telas de lá.

Só variáveis `VITE_` vão para o navegador. Service_role e senha do banco nunca levam esse prefixo.

Migrations do banco central-neo: `node scripts/migrar.cjs` (usa `NEO_DATABASE_URL`; `--testar` roda e desfaz). 001–007 aplicadas em 2026-10-20.
Edge Function: `supabase functions deploy admin-usuarios --project-ref dxcxoimvweeggrvtbmxb --use-api`.
No painel do Supabase (central-neo), em Authentication → URL Configuration, cadastre a URL publicada da NEO em Site URL e em Redirect URLs. Sem isso, o link de "Esqueci minha senha" não volta para `/reset-senha`.

Deploy no Dokploy: `docker-compose.yml` (rede `dokploy-network`). Não precisa de VPN, porque a NEO não acessa o GDIS diretamente.
