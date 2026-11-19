# 01 — Descoberta do projeto: Central NEO

Investigação de 19/11/2026. Método: leitura da memória compartilhada, do contexto geral, das instruções do projeto e do inventário de portfólio; depois confirmação na estrutura e no código (`package.json`, `src/`, `supabase/`, `vercel.json`, `scripts/`, `docs/`). O app não foi executado, não houve build e o banco não foi consultado. Memória é contexto, não prova.

Legenda: **CONFIRMADO** (código, configuração ou documentação consistente com o código), **INFERIDO**, **NÃO VERIFICADO**, **PLANEJADO**.

---

## 1. O que o produto é

A Central NEO é uma aplicação web interna do **Núcleo de Eficiência Operacional (NEO)**, setor responsável pela manutenção de redes de distribuição de energia numa unidade regional (UEN 211) sob contrato com a distribuidora. Reúne, num único login, as ferramentas que o setor usa para acompanhar serviços executados, conferir o que a distribuidora pagou, controlar a disponibilidade das equipes e calcular quilometragem. (CONFIRMADO: `CONTEXTO_GERAL.md` §1, rotas em `src/App.tsx`, menu em `src/components/Shell.tsx`.)

Frase-tese do próprio produto, exibida na tela de login: **"Cada nota aberta, até o último centavo fechado."** (CONFIRMADO: `src/paginas/Login.tsx`.)

## 2. Módulos e estado

| Módulo / frente | Rota(s) | Estado | Classificação |
|---|---|---|---|
| Manutenção (fechamento de notas NSIS/NSRI): fila por etapas, painel, importação, tabela de valores | `/fechamento`, `/fechamento/painel`, `/fechamento/importar`, `/fechamento/tabela` | Implementado e em evolução até 19/11/2026 (listas NSIS e NSRI separadas) | CONFIRMADO |
| Faturamento: conferência da fatura da distribuidora contra o contrato | `/faturamento`, `/painel`, `/conferencia`, `/importar`, `/tabelas`, `/documentacao` | Implementado; regras refinadas em rodadas até 05/11/2026. A memória registra que a primeira entrega foi reprovada e que as revisões não substituem a validação de negócio | CONFIRMADO (código/docs); validação de negócio NÃO VERIFICADO |
| Disponibilidade da frota: conferência diária e custo de equipe parada | `/disponibilidade`, `/disponibilidade/painel` | Publicado em 06/11/2026; migrations 054 a 060 | CONFIRMADO (memória + migrations); uso real pelas equipes NÃO VERIFICADO |
| Ferramentas: Cálculo de KM (PDF de percursos do rastreador, 100% no navegador) | `/ferramentas/calculo-km` | Implementado e publicado em 05/11/2026 | CONFIRMADO |
| Ferramentas: Lista de Medidores (copiada e adaptada do TraceOne) | `/traceone` | Em uso; depende de segundo banco emprestado | CONFIRMADO |
| Acessos e Colaboradores (ADMIN) | `/acessos`, `/colaboradores` | Implementado | CONFIRMADO |
| Notas de Ouvidoria; Conciliação CEMIG | itens de menu desabilitados ("em breve") | Não implementado | PLANEJADO (CONFIRMADO como placeholder em `Shell.tsx`) |
| Login único para TraceOne, Central NEC e Warefly | — | Objetivo declarado; hoje só a NEO usa esse login | PLANEJADO |
| Sincronização direta com o sistema de despacho (GDIS) | — | Mencionada como intenção; hoje a entrada é por planilha | PLANEJADO |

## 3. Respostas às 20 perguntas do superprompt

1. **O que é:** plataforma interna de gestão operacional e financeira de manutenção de redes. CONFIRMADO.
2. **Para quem:** equipe do NEO / UEN 211 (administradores e usuários com módulos liberados); vídeo institucional foi direcionado a diretoria e gestores. CONFIRMADO (papéis em `neo_acessos`; público do vídeo na memória).
3. **Objetivo principal:** dar controle e rastreabilidade sobre o que foi executado, o que foi cobrado e o que foi pago. INFERIDO a partir dos módulos; a mensagem do vídeo ("entender o pagamento e identificar se corresponde ao contrato") é CONFIRMADA na memória.
4. **Problema:** conferir milhares de serviços e valores em planilhas, sem trilha e sem regra única. CONFIRMADO como descrição do processo anterior (planilha "controle de NSMC", planilha de disponibilidade com macro, conferência manual de km). Volume/tempo exatos: NÃO VERIFICADO.
5. **Efeito na operação:** perda de tempo, risco de pagamento menor que o devido ficar invisível, multa por equipe parada sem controle. INFERIDO (a memória registra que o responsável pelo projeto não tem certeza de que a distribuidora esteja cobrando a multa por equipe parada).
6. **Solução:** módulos web com regras de contrato codificadas no banco e no front. CONFIRMADO.
7. **Funcionalidades reais:** ver §2 e `03-technical-analysis.md`. CONFIRMADO.
8. **Fluxos principais:** importar → ver fila por etapa → abrir janela da nota → lançar códigos e valores; importar fatura → conferir serviço a serviço; conferir disponibilidade do dia anterior e registrar motivo; enviar PDFs de percurso → ver km. CONFIRMADO.
9. **Tecnologias:** React 19, TypeScript, Vite 6, Tailwind 4, React Router 6, Supabase (Postgres, Auth, RLS, Edge Functions), pdf.js, SheetJS e ExcelJS, Motion, visx/d3-shape, Radix/shadcn. CONFIRMADO (`package.json`).
10. **Arquitetura:** SPA com regras puras em `src/lib`, banco Postgres com RLS e RPCs, duas conexões Supabase, hospedagem estática na Vercel. CONFIRMADO.
11. **Integrações:** TraceOne (segundo Supabase, só medidores); endpoint para o GIRO listar colaboradores; entradas por planilha exportada do sistema de despacho e da distribuidora. CONFIRMADO (código). Operação do endpoint GIRO em produção: NÃO VERIFICADO.
12. **Automação/IA:** automação de fim de semana na disponibilidade (função no banco); limpeza algorítmica de pontos de GPS. **Não há IA** (a memória diz "sem IA" para o Cálculo de KM; nenhum SDK de IA em `package.json`). CONFIRMADO.
13. **Decisões técnicas de destaque:** ver `03-technical-analysis.md` §6.
14. **UX/UI de destaque:** ver `04-brand-and-design.md`.
15. **Identidade visual própria:** sim; símbolo "o círculo que fecha", paleta petróleo e cobre, textura de anéis, circuito animado no login. CONFIRMADO.
16. **Estado atual:** em desenvolvimento ativo (119 commits entre 20/10 e 19/11/2026). CONFIRMADO (`git log`).
17. **Pronto / parcial / planejado:** §2.
18. **Uso real e produção:** há `vercel.json` e a memória registra deploys e tela branca pós-deploy corrigida em 05/11/2026; o inventário de portfólio marca "em uso". URL, número de usuários e frequência de uso: NÃO VERIFICADO.
19. **Diferença para uma aplicação comum:** regras de contrato complexas e auditáveis no banco; ferramentas que substituem rotinas manuais com algoritmo próprio. Ver `02-product-strategy.md`.
20. **Competências demonstradas:** modelagem de domínio de negócio, Postgres avançado (RLS, RPC, views, migrations), front-end de dados densos, design system e identidade, ferramentas client-side com processamento de arquivos, testes de integração com rollback, operação em produção. INFERIDO a partir das evidências.

## 4. Números do repositório (verificados por contagem de arquivos, sem executar)

- 61 migrations SQL (001 a 061), ~10,3 mil linhas de SQL; 2 Edge Functions. CONFIRMADO.
- ~25,8 mil linhas de TypeScript/TSX em `src/` (124 arquivos). CONFIRMADO.
- 32 scripts `*-testar` de verificação (banco com rollback, planilhas, interface com Supabase simulado). CONFIRMADO.
- 119 commits, de 20/10/2026 a 19/11/2026 (um mês de histórico). CONFIRMADO.
- `tsconfig.json` com `strict: true`. CONFIRMADO.
- 16 migrations ativam RLS; 36 políticas `create policy`. CONFIRMADO por busca textual.

## 5. Evidências de identidade e produto

- Símbolo e logo: `src/components/NeoLogo.tsx`, `public/favicon.svg`. Tokens: `src/index.css` (`@theme`). Textura e circuito animado: `src/components/CircuitoAnimado.tsx`, utilitários em `index.css`.
- Vídeo institucional de 88,6 s produzido em 26/10/2026 (código em `video/central-neo/`, arquivo final em `entregas/central-neo/`, ignorado pelo Git). CONFIRMADO (memória e LEIA-ME); o arquivo de vídeo não foi aberto nesta investigação.
- Capturas de tela de testes (`.tmp-faturamento/*.png`, 124 imagens, ignoradas pelo Git): existem, mas foram geradas com respostas locais alimentadas por dados reais. Não foram copiadas; ver `07-visual-assets-plan.md`.

## 6. O que NÃO existe (para não se afirmar no case)

- IA/LLM no produto.
- Métricas de uso, ganho de produtividade ou faturamento recuperado, com fonte.
- Login único entre sistemas.
- Integração direta com o sistema de despacho ou com a distribuidora (entrada é por planilha/PDF).
- Pipeline de CI, testes unitários com runner (os testes são scripts de integração), observabilidade (APM/logs externos).
- Demo pública.

## 7. Divergências encontradas entre documentos e código

- `MEMORIA_COMPARTILHADA.md` (seção "Mapeamento entre projetos") cita fontes Archivo e Atkinson Hyperlegible Mono. O código atual usa **Inter** (interface), **JetBrains Mono** (números) e **Manrope** (apenas no logo). Vale o código.
- `CONTEXTO_GERAL.md` §2 menciona migrations "001–012" na árvore; existem 61. Vale a contagem real.
- O nome "Fila de NSIS" virou "Fila de fechamento" em 19/11/2026; documentos antigos ainda usam o nome anterior.
- A pasta `supabase/` está no `.gitignore` por decisão registrada: as migrations e funções não vão para o repositório remoto. Isso limita a evidência pública do backend (ver `08-verification-report.md`).
