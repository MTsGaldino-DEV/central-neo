# 03 — Análise técnica: Central NEO

Fontes: `package.json`, `vite.config.ts`, `tsconfig.json`, `vercel.json`, `.env.example` (só nomes de variáveis), `src/App.tsx`, `src/lib/*`, `src/components/*`, `supabase/migrations`, `supabase/functions`, `scripts/`, `CONTEXTO_GERAL.md`, `docs/faturamento-relatorio.md`. O app não foi executado. Onde a evidência é só documentação (não conferida linha a linha no código), está dito.

---

## 1. Stack real

| Camada | Tecnologia | Evidência |
|---|---|---|
| Front-end | React 19.2, TypeScript (strict), Vite 6, React Router 6, Tailwind CSS 4 (plugin Vite) | `package.json`, `tsconfig.json`, `vite.config.ts` |
| Componentes | shadcn/Radix (`src/components/ui`, 11 componentes), `class-variance-authority`, `tailwind-merge`, `lucide-react`, `react-day-picker` | `package.json`, `components.json` |
| Gráficos e movimento | visx (group, shape, responsive), d3-shape, Motion, NumberFlow; gráficos de pizza/estatística próprios em `src/components/charts` | `package.json` |
| Dados / back-end | Supabase (Postgres, Auth, RLS, RPCs em SQL, Edge Functions em Deno/TypeScript) | `supabase/`, `src/lib/supabase.ts` |
| Segundo banco | Supabase do TraceOne (somente medidores) | `CONTEXTO_GERAL.md` §2, `src/lib/supabase.ts` |
| Arquivos | `xlsx` (SheetJS) para leitura, `exceljs` para exportação (carregado sob demanda), `pdfjs-dist` para PDFs (carregado só na tela de Cálculo de KM) | `package.json`, imports dinâmicos em `src/lib` |
| Hospedagem | Vercel (rewrite para `index.html`, cache longo só para `/assets/`) | `vercel.json` |
| Testes | 32 scripts `*-testar` (Node): banco com transação desfeita, leitura de planilhas, interface com Supabase simulado em navegador headless | `scripts/` |
| IA | Nenhuma | ausência em `package.json` |
| Observabilidade | Nenhuma ferramenta externa evidenciada | NÃO VERIFICADO |

Variáveis de ambiente (apenas nomes): `VITE_NEO_SUPABASE_URL`, `VITE_NEO_SUPABASE_ANON_KEY`, `VITE_NEO_SUPABASE_PUBLISHABLE_KEY`, `VITE_TRACEONE_SUPABASE_URL`, `VITE_TRACEONE_SUPABASE_ANON_KEY`, `VITE_TRACEONE_URL`; e, só para scripts no servidor/máquina local, `NEO_SUPABASE_SERVICE_ROLE_KEY`, `NEO_DB_PASSWORD`, `NEO_DATABASE_URL`. A regra documentada é que só o prefixo `VITE_` chega ao navegador.

## 2. Arquitetura

Aplicação de página única que fala direto com o Supabase. Ver `assets/diagrams/arquitetura.md`.

- **Rotas e módulos.** `src/App.tsx` define cerca de 20 rotas. Cada tela é carregada sob demanda (`lazy`), e cada grupo de rotas é protegido por `ExigeModulo` (e `ExigeAdminNeo`, `ExigeTraceone`). CONFIRMADO.
- **Regras puras em `src/lib`.** Leitura de planilhas (`fechamentoPlanilhas.ts`, `faturamentoPlanilhas.ts`), cálculo de km (`calculoKm.ts`, `calculoKmPdf.ts`), regras da disponibilidade (`disponibilidadeRegras.ts`), cobrança (`fechamentoCobranca.ts`), fluxo de etapas (`fechamentoFluxo.ts`). A documentação indica que são funções puras, testáveis em Node, sem dependência de React. CONFIRMADO (estrutura e comentários); a ausência de dependências de React foi conferida por amostragem.
- **Duas sessões Supabase.** `supabase` (NEO) e `supabaseTraceone` (medidores). O app abre uma segunda sessão no TraceOne com as mesmas credenciais, porque a política de segurança dos medidores depende do papel do usuário lá. Se a senha diferir, uma tela pede a conexão. CONFIRMADO (`ConectarTraceone.tsx`, `lib/auth.ts`, documentação).
- **Ponte de compatibilidade.** As telas de medidores foram copiadas do TraceOne (Next.js) e adaptadas ao React Router por uma camada (`lib/navegacao.ts`) que reimplementa `useRouter`/`usePathname`. Os tokens de cor têm os mesmos nomes do TraceOne e valores diferentes, então o visual muda sem reescrever as telas. CONFIRMADO.

## 3. Estrutura de dados

- 61 migrations versionadas (001–061), com objetos agrupados por prefixo: `neo_nsis*` (manutenção), `neo_fat_*` (faturamento), `neo_disp_*` (disponibilidade), `neo_contrato_*` e `neo_valor_us` (contrato), `neo_acessos` e `colaboradores` (acesso). CONFIRMADO.
- **Manutenção.** `neo_nsis` (uma linha por nota) e `neo_nsis_itens` (cada cobrança, com fator unitário guardado no momento do pedido). A view `neo_vw_nsis` calcula a etapa a partir dos itens e do campo `fluxo_novo`; duas regras convivem (histórico e fluxo novo). Importação por RPC idempotente (`neo_importar_nsis`, `neo_importar_historico`). CONFIRMADO (documentação detalhada; migrations presentes).
- **Faturamento.** Dados originais da planilha preservados em JSON; publicação em lotes numa transação; identificador estável por `idapropriacaotemposervico`; conferências manuais em tabela separada, invalidadas quando dados, equipe, fatores ou situação calculada mudam. Views `neo_fat_base`, `neo_fat_calculo`, `neo_fat_conferencia`. CONFIRMADO (documentação + nomes de objetos nas migrations).
- **Contrato como dado.** Tabelas do contrato em `neo_contrato_itens`; cada acerto de fator vai para `neo_contrato_historico` com motivo (trigger + RPC `neo_acertar_fator`); `fator_original` (publicado) e `fator_us` (em vigor) coexistem. Valor da US em reais em `neo_valor_us`, uma linha por vigência. CONFIRMADO.
- **Disponibilidade.** `neo_disp_frotas`, `neo_disp_lancamentos` (uma linha por frota e dia; ausência de linha = falta conferir), `neo_disp_config`. Resumos mensal e anual por RPC em JSON, porque um mês passa do limite de 1.000 linhas da API. CONFIRMADO.

## 4. Segurança e acesso (CONFIRMADO)

- Login por Supabase Auth; acesso à Central só com linha ativa em `neo_acessos`.
- Papéis `ADMIN` e `USUARIO`; módulos `traceone`, `fechamento`, `faturamento`, `disponibilidade`.
- RLS no banco: `neo_tem_modulo(...)` aparece em 43 migrations; a tela não é a única barreira. Exemplo documentado: a exclusão de nota passou a exigir o módulo (migration 061), e o banco recusava a ação antes da migration, mesmo com o botão visível.
- Edge Function `admin-usuarios`: valida `neo_is_admin()` com o token do usuário e só então usa a chave de serviço para criar login, redefinir senha ou bloquear.
- Edge Function `giro-colaboradores`: lista só colunas do contrato de integração, protegida por segredo conferido em tempo constante; publicada sem JWT por escolha documentada. Uso em produção NÃO VERIFICADO.
- Chaves de serviço e senha do banco só existem em arquivo local ignorado pelo Git. `.gitignore` também exclui planilhas, PDFs e a pasta `supabase/`.

## 5. Tratamento de erros, performance e robustez

- **Tela branca pós-deploy** (05/11/2026): `src/main.tsx` recarrega a página uma vez ao falhar o carregamento de um pedaço do bundle (`vite:preloadError`), com limite de frequência, e o `vercel.json` não reescreve `/assets/` para o HTML. Testado pelo autor com build de produção. CONFIRMADO (código + memória).
- **Estouro de tempo no banco** (migration 035): cálculo por serviço guardado em `neo_fat_servicos_calc` e refeito só quando algo muda; filtros e totais por RPC (migrations 021/022/036/037). CONFIRMADO (documentação).
- **Grade de disponibilidade:** o movimento do mouse não passa por estado do React; a cruz de destaque mexe direto no DOM (`useCruz.ts`) por causa das quase 2 mil células. A memória cita 869 ms → 1,8 ms de script por movimento em build com CPU 4x mais lenta (medição do autor, reproduzível só por quem rodar o script). CONFIRMADO (código e comentário) / medição NÃO REPETIDA aqui.
- **Cache de tela:** `useDadosComCache`, `cacheTela.ts`. CONFIRMADO (arquivos existem).
- Carregamento sob demanda de `pdf.js`, `exceljs` e `xlsx` em telas específicas. CONFIRMADO.

## 6. Decisões técnicas que merecem destaque

1. **Regras de contrato no Postgres.** O cálculo do devido por serviço roda no banco (views + RPCs), com resultados guardados e invalidados por mudança de dado. Evita transferir dezenas de milhares de linhas ao navegador e dá um único lugar para a regra.
2. **Dado original preservado.** A importação guarda o JSON da planilha; o cálculo pode ser refeito quando a regra muda, sem pedir nova importação.
3. **Contrato corrigível sem reescrever a história.** O item lançado guarda o fator da época (`fator_unitario`); acertar o contrato não altera lançamentos antigos, mas o valor em reais é calculado na consulta, então corrigir a cotação da US corrige tudo.
4. **Processamento de arquivos no navegador** (Cálculo de KM): nenhum PDF sobe para servidor; limpeza de GPS em duas regras (posição presa e vai-e-volta) com parâmetros documentados.
5. **Acesso por módulo, aplicado no banco**, não só na interface.
6. **Migrations testadas em transação desfeita** antes de aplicar (`scripts/migrar.cjs --testar`), com incidente registrado e lição formalizada (nunca injetar migration em transação que faz commit).

## 7. Funcionalidades com evidência no código (resumo)

| Funcionalidade | Evidência principal |
|---|---|
| Fila de fechamento NSIS/NSRI por etapas, filtros por coluna, exportação Excel | `src/paginas/fechamento/Fila.tsx`, `JanelaFluxo.tsx`, `src/lib/fechamentoFluxo.ts`, `fechamentoCobranca.ts` |
| Janela da nota com vários códigos, fatores e valor pago dividido por proporção | `ComponentesLancamento.tsx`, `src/lib/fechamentoCobranca.ts`, migration 053 |
| Painel da manutenção (R$/US, pedido × pago, pendências por idade, rankings) | `src/paginas/fechamento/Painel.tsx`, RPCs `neo_painel_*` (migrations 010–012) |
| Tabela de valores com acertos auditados | `TabelaValores.tsx`, migrations 004, 049, 050 |
| Importação e conferência de fatura | `src/paginas/faturamento/Importar.tsx`, `Conferencia.tsx`, `DetalheServico.tsx`, `src/lib/faturamento*.ts` |
| Disponibilidade da frota: grade mensal, dia, painel anual, Excel | `src/paginas/disponibilidade/*`, `src/lib/disponibilidade*.ts`, migrations 054–060 |
| Cálculo de KM | `src/paginas/ferramentas/CalculoKm.tsx`, `src/lib/calculoKm.ts`, `calculoKmPdf.ts` |
| Logins e acessos, colaboradores | `src/paginas/Acessos.tsx`, `Colaboradores.tsx`, função `admin-usuarios` |

## 8. Testes e evidências de funcionamento

- 32 scripts de verificação: banco com rollback (`*-banco-testar`, `fluxo-nsis-banco-testar`, `faturamento-testar`), leitura de planilhas (`faturamento-planilhas-testar`), interface em Chromium headless com Supabase simulado em 1440, 1920 e 390 px (`*-ui-testar`), prova real de glosa (`faturamento-prova-real-testar`). CONFIRMADO (existência dos arquivos).
- **Resultados atuais não foram reexecutados** nesta investigação. A memória de 19/11/2026 registra que `manutencao-ui-testar` já falhava em um passo antes das últimas mudanças e precisa de ajuste. Dois scripts gravam de fato no banco e exigem cuidado (incidente de 05/11/2026). Não há runner de testes unitários nem CI evidenciados.

## 9. Limitações técnicas honestas (úteis para o case, sem esconder)

- `supabase/` fora do Git: migrations e funções só existem na máquina local.
- Scripts de banco dependem de módulo do projeto vizinho (TraceOne).
- Dependência de um segundo banco "emprestado" para medidores.
- Telas copiadas do TraceOne ficam como duplicação a ser mantida à mão.
- Algumas telas antigas de medidores permanecem no disco sem rota (código morto).

## 10. Possibilidades de expansão (PLANEJADO, não implementado)

- Login único para outros sistemas.
- Ligação direta com o sistema de despacho, que alimentaria os cards de comparação do contrato hoje zerados por falta de código nos itens do histórico (pendência registrada em 22/10 e 04/11/2026).
- Telas de Notas de Ouvidoria e Conciliação (itens de menu desabilitados).
- Conferência da disponibilidade pela fatura (aba de turma), ainda sem integração.
