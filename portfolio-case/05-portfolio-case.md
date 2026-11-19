# 05 — Case de portfólio: Central NEO

Texto pronto para adaptação ao site pessoal e ao Behance. Cada seção traz o **texto publicável**, a **recomendação visual** e as **evidências** no projeto. Dados sem fonte verificável foram deixados de fora de propósito. Nomes de clientes e do setor aparecem como "a distribuidora" e "a unidade regional" para publicação segura; ver `08-verification-report.md` antes de citar nomes.

---

## 01 — HERO / ABERTURA

**Nome do projeto:** Central NEO

**Categoria:** Produto digital de gestão operacional e financeira · Aplicação web interna

**Headline:** Cada nota aberta, até o último centavo fechado.

**Subheadline:** Uma central única para acompanhar serviços de manutenção, conferir o que a distribuidora pagou e controlar a disponibilidade das equipes.

**Descrição resumida:** A Central NEO nasceu para tirar do Excel as rotinas de um núcleo de eficiência operacional que mantém redes de distribuição de energia. Do pedido de pagamento à fatura, da jornada da equipe ao quilômetro rodado, cada regra do contrato tem um lugar definido, e cada diferença pode ser vista serviço a serviço. Concepção do produto, marca, interface, banco de dados e publicação foram conduzidos de ponta a ponta pelo desenvolvedor responsável.

**Tags:** Produto digital · UX/UI · Design de marca · React · TypeScript · PostgreSQL · Supabase · Regras de negócio · Automação de planilhas · Dashboards

**Imagem principal recomendada:** composição sobre fundo Noite (`#061A1F`) com a tela do Painel do Faturamento em destaque, o símbolo da marca em escala gigante atrás (anel aberto com ponto ciano) e, em primeiro plano, um recorte ampliado de um card "pagou a menos". Alternativa: a tela de login real, com o circuito animado em captura estática.

**Evidências:** `src/paginas/Login.tsx` (tagline), `src/components/NeoLogo.tsx`, `src/paginas/faturamento/Painel.tsx`.

---

## 02 — VISÃO GERAL

**O que é.** A Central NEO é a plataforma interna do Núcleo de Eficiência Operacional, setor que cuida da manutenção de redes de energia em uma unidade regional. Reúne, num só login, os módulos que o setor usa todos os dias.

**Para quem.** Para a equipe que fecha as notas de serviço, para quem confere a fatura da distribuidora, para quem acompanha a disponibilidade das equipes de campo e para a gestão, que precisa de números claros para decidir e negociar.

**Objetivo.** Dar rastreabilidade a todo o ciclo financeiro e operacional da manutenção: o que foi executado, o que foi cobrado, o que foi pago e o que está pendente.

**O que permite realizar.**
- Acompanhar cada nota de serviço por etapas, do pedido à conclusão, com alertas de valor divergente.
- Importar a fatura da distribuidora e conferir, serviço a serviço, se o pagamento corresponde ao contrato.
- Manter a tabela de valores do contrato com histórico e motivo de cada acerto.
- Registrar, dia a dia, por que uma equipe não cumpriu a jornada, e estimar o custo disso.
- Calcular a quilometragem de uma equipe a partir do relatório de percursos do rastreador, sem enviar o arquivo a nenhum servidor.
- Controlar quem acessa o quê, por módulo.

**Síntese do trabalho desenvolvido.** Um produto com cerca de vinte rotas, 61 migrações de banco, regras de contrato codificadas em Postgres, ferramentas de processamento de arquivos no navegador, identidade visual própria e publicação na web.

**Visual:** mapa de módulos em cartões (Manutenção, Faturamento, Frota, Ferramentas, Administração), cada um com um recorte de tela real.

**Evidências:** `src/App.tsx`, `src/components/Shell.tsx`, `CONTEXTO_GERAL.md` §1.

---

## 03 — O PROBLEMA

**Contexto.** A manutenção de redes de energia funciona sob contrato. Cada serviço executado tem um preço definido em unidades contratuais, com regras próprias para área urbana ou rural, tipo de despacho, tipo de equipe e tempo trabalhado. A distribuidora devolve o pagamento em faturas com dezenas de milhares de linhas.

**A dor.** O acompanhamento desse ciclo vivia em planilhas: uma para o controle das notas, outra, com macro, para a disponibilidade, contas de quilometragem feitas à mão. Cada arquivo guardava uma parte da regra, sem histórico de alterações e sem ligação entre as etapas.

**Consequências.**
- Conferir uma fatura inteira contra o contrato exigia um esforço manual enorme.
- Diferenças pequenas e repetidas tendiam a passar despercebidas.
- A negociação com a distribuidora dependia de números montados à mão.
- O custo de uma equipe parada era estimado, não calculado de forma consistente.

**Oportunidade.** Se as regras do contrato vivessem no sistema, e não na cabeça de quem opera as planilhas, o computador faria a conferência exaustiva, e as pessoas ficariam com o que exige julgamento: decidir, contestar, negociar.

*Observação editorial:* o texto não afirma ganhos de tempo ou de dinheiro. Não há medição disponível.

**Visual:** colagem de planilhas reais anonimizadas (colunas, abas e fórmulas), com o símbolo da NEO aberto (anel sem ponto) como metáfora da nota pendente.

**Evidências:** `docs/disponibilidade-frota-analise.md` (planilha original com macro), `docs/faturamento-relatorio.md` (tamanho da fatura), `CONTEXTO_GERAL.md` §4.

---

## 04 — O DESAFIO

**Desafio de negócio**
- Rastrear um processo longo que cruza vários sistemas externos, do relatório de despacho ao lançamento na distribuidora.
- Verificar pagamentos contra um contrato cheio de exceções.
- Substituir planilhas conhecidas sem perder o formato que as equipes já usam.

**Desafio operacional**
- Absorver mudanças de regra durante o uso: o fluxo de etapas das notas foi redesenhado em novembro de 2026 sem descartar o histórico.
- Receber dados que chegam por planilha e PDF, com formatos nem sempre estáveis.

**Desafio de design**
- Telas com muitíssimos dados (grade de quase 2 mil células, faturas de mais de 27 mil linhas) que precisavam continuar legíveis e rápidas.
- Uma identidade própria que sustentasse um produto interno sem cair em aparência genérica de painel administrativo.

**Desafio técnico**
- Modelar regras contratuais com precisão decimal e tolerância definida (comparação em seis casas).
- Superar limites de consulta da API com cálculos em funções de banco, cache por serviço e paginação por RPC.
- Operar dois bancos e duas sessões sem misturar permissões.
- Processar PDFs de GPS no navegador, descartando pontos falsos sem apagar paradas reais.

**Visual:** quatro colunas (Negócio, Operação, Design, Técnica) com um número ou fragmento de tela real em cada uma.

**Evidências:** `CONTEXTO_GERAL.md` §4, §7, §8; `docs/faturamento-relatorio.md`; migrations 021, 022, 035–037.

---

## 05 — A SOLUÇÃO

A Central NEO traduz o contrato em regras explícitas e organiza o trabalho em módulos que conversam entre si.

1. **Um login, vários módulos.** O acesso é liberado por módulo e conferido no banco. Cada pessoa vê só o que precisa.
2. **A nota de serviço como linha do tempo.** Cada nota passa por etapas visíveis, com contagem por etapa e alerta quando o valor pago difere do pedido.
3. **A fatura como prova.** O sistema importa as duas planilhas da fatura, preserva os dados originais, calcula o devido por serviço com as regras do contrato e destaca o que foi pago a menos, a mais ou glosado.
4. **O contrato como dado.** As tabelas de valores são editáveis só por administradores, sempre com motivo, e cada acerto fica no histórico. Um valor lançado não muda quando o contrato é corrigido.
5. **Ferramentas que substituem rotinas manuais.** A conferência de disponibilidade e o cálculo de quilometragem deixaram de depender de macros e contas à mão.

**Proposta de valor:** o setor passa a ter, num só lugar, o que foi executado, o que foi cobrado e o que foi pago, com a regra à vista.

**Visual:** diagrama do fluxo "Planilha → Importação → Regra → Conferência → Decisão", feito a partir de `assets/diagrams/fluxo-faturamento.md`.

**Evidências:** `src/lib/faturamento*.ts`, `supabase/migrations/013–037`, `src/paginas/fechamento/*`.

---

## 06 — EXPERIÊNCIA DO USUÁRIO

**Jornadas principais**
- *Fechar uma nota:* abrir a fila, escolher a lista (NSIS ou NSRI), clicar na nota, ler o que a equipe fez, escolher os códigos que serão cobrados, avançar a etapa com um Enter.
- *Conferir uma fatura:* importar as duas planilhas, abrir o painel, clicar no card "pagou a menos", ver a lista de serviços já filtrada, abrir um serviço e ler o motivo da diferença em linguagem simples.
- *Conferir a frota:* abrir o dia, marcar o motivo de quem não cadastrou; o fim de semana é preenchido automaticamente como folga.
- *Calcular quilometragem:* soltar até cinco PDFs, escolher quais status contam, ver o mapa e baixar a planilha de auditoria.

**Arquitetura de informação.** Menu lateral por frentes de trabalho (Ferramentas, Manutenção, Faturamento, Frota, Administração), recolhível a ícones; itens futuros aparecem esmaecidos como "em breve".

**Soluções de usabilidade**
- Filtros por coluna no estilo planilha, familiares a quem vem do Excel.
- Estado dos filtros na URL: uma visão filtrada pode ser compartilhada por link.
- Cartões do painel que levam à lista já filtrada.
- Janela da nota no centro da tela, com tudo o que importa sobre ela.
- Alternância R$ / US em painéis.
- Botão "Ocultar valores" que borra números financeiros sem esconder contagens.
- Início com pergunta de ação: "O que precisa fechar hoje".

**Consistência.** Mesmos tokens, mesmos rótulos de etapa e mesma linguagem de cor entre módulos; identificadores sempre em fonte monoespaçada.

**Visual:** sequência de três a quatro telas em fluxo, com setas finas em Petróleo e numeração nos passos.

**Evidências:** `src/components/Shell.tsx`, `src/paginas/Inicio.tsx`, `src/paginas/fechamento/Fila.tsx`, `src/paginas/faturamento/Painel.tsx`, `src/paginas/disponibilidade/*`, memória de 16–19/11/2026.

---

## 07 — IDENTIDADE VISUAL

**A ideia: o círculo que fecha.** O símbolo da Central NEO é um anel aberto com um ponto preenchendo a abertura: a nota pendente que se fecha quando o pagamento entra. É também o "O" de NEO.

**Paleta.** Petróleo `#0B7285` para ação e foco; Noite `#061A1F` para a barra lateral e o login; Névoa `#F4F7F8` como fundo; Cobre `#D9822B` reservado a valores e alertas; ciano `#3BC9DB` para o ponto da marca sobre fundo escuro.

**Tipografia.** Inter na interface, JetBrains Mono nos números e códigos, Manrope extra-negrito no logo.

**Elementos gráficos.** Anéis concêntricos sutis sobre o fundo escuro, grade de pontos no login e um circuito animado cujos pulsos correm até acender uma "ilha" na ponta, eco do ponto que fecha o anel.

**Componentes.** Tokens definidos em Tailwind e componentes shadcn aplicados em telas novas sem reescrever as antigas. Etapas e estados têm cor semântica própria.

**O papel dessas decisões.** O fundo claro e frio com um único azul-petróleo mantém o foco em números; o cobre separa dinheiro de ação; a monoespaçada reduz erros de leitura; a marca conta a história do produto.

**Visual:** prancha de marca com o logo nos três temas, a paleta, as fontes e a textura de anéis.

**Evidências:** `src/index.css`, `src/components/NeoLogo.tsx`, `public/favicon.svg`, `src/components/CircuitoAnimado.tsx`. Arquivos em `assets/branding/`.

---

## 08 — PRINCIPAIS FUNCIONALIDADES

### 8.1 Conferência de fatura por serviço
- **Problema que resolve:** saber se a distribuidora pagou o valor previsto em contrato, serviço a serviço, numa fatura de dezenas de milhares de linhas.
- **Como funciona:** importam-se a Fatura Resumida e a Fatura Completa. O sistema preserva os dados originais, vincula cada serviço ao veículo e à equipe, aplica as tabelas do contrato (códigos, rural, despacho, homem-hora, glosa, transposição de códigos) e classifica cada serviço: confere, pagou a menos, pagou a mais, glosado ou fora do contrato. A conferência manual fica registrada e é invalidada se os dados mudarem.
- **Benefício:** transforma a conferência exaustiva em lista priorizada e dá fundamento à negociação.
- **Evidência:** `src/paginas/faturamento/*`, `src/lib/faturamento*.ts`, migrations 013–051, `docs/faturamento-relatorio.md`, scripts `faturamento-*-testar.cjs`.
- **Tela ideal:** Conferência (`/faturamento/conferencia`) com a janela de um serviço aberta, mostrando fatores aplicados e o motivo. Com dados fictícios.

### 8.2 Fila de fechamento de notas (Manutenção)
- **Problema que resolve:** acompanhar cada nota de serviço do pedido ao pagamento sem perder pendências.
- **Como funciona:** fila por etapas (em revisão, NSPR, Salesforce, apropriação, concluída) com listas separadas para NSIS e NSRI, filtros por coluna, busca, alertas de valor divergente e exportação para Excel no formato da planilha anterior. A janela da nota aceita vários códigos de uma vez, aplica fatores e divide o valor pago na proporção do pedido.
- **Benefício:** cada nota tem uma etapa e um dono visíveis; a divergência aparece sozinha.
- **Evidência:** `src/paginas/fechamento/Fila.tsx`, `JanelaFluxo.tsx`, `src/lib/fechamentoFluxo.ts`, `fechamentoCobranca.ts`, migrations 004–012, 053, 056, 061.
- **Tela ideal:** Fila (`/fechamento`) na etapa "NSPR", com painel da seleção aberto.

### 8.3 Tabela de valores do contrato com histórico
- **Problema que resolve:** manter o preço contratual correto sem perder a rastreabilidade das mudanças.
- **Como funciona:** os itens da tabela de manutenção ficam no banco; só administradores alteram valores, sempre com motivo; cada acerto vai para o histórico; lançamentos antigos guardam o valor da época; o valor da unidade contratual em reais é versionado por vigência.
- **Benefício:** confiança no número e auditoria sem planilha paralela.
- **Evidência:** `src/paginas/fechamento/TabelaValores.tsx`, migrations 004, 049, 050, `neo_acertar_fator`.
- **Tela ideal:** Tabela de valores com a janela de histórico de um item.

### 8.4 Disponibilidade da frota
- **Problema que resolve:** registrar por que uma equipe não trabalhou a jornada prevista e calcular o custo, antes feito numa planilha com macro.
- **Como funciona:** grade mensal com uma célula por frota e dia, visão do dia, painel anual com meta e histórico por frota. Regras explícitas separam motivos que geram multa e motivos contestáveis. Sábados e domingos sem marcação são preenchidos automaticamente como folga. Exportação para Excel.
- **Benefício:** um critério único, calculado igual para todos, e visão rápida do mês inteiro.
- **Evidência:** `src/paginas/disponibilidade/*`, `src/lib/disponibilidadeRegras.ts`, migrations 054–060, `docs/disponibilidade-frota-analise.md`.
- **Tela ideal:** grade do mês (`/disponibilidade`) com a cruz de destaque ativa.

### 8.5 Cálculo de KM por PDF de percursos
- **Problema que resolve:** saber quantos quilômetros uma equipe rodou, descontando pontos falsos do rastreador.
- **Como funciona:** até cinco PDFs são lidos no próprio navegador; relatórios do mesmo veículo e dia são unidos; duas regras descartam pontos falsos (posição presa e vai-e-volta); a distância é a soma entre posições consecutivas (fórmula de Haversine). A ferramenta mostra mapa com zoom, km por status, avisos de lacunas e aplica a regra de km linear do contrato. Exporta resumo e planilha de auditoria com o motivo de cada descarte.
- **Benefício:** resultado auditável e repetível, sem enviar o arquivo a servidor.
- **Evidência:** `src/paginas/ferramentas/CalculoKm.tsx`, `src/lib/calculoKm.ts`, `calculoKmPdf.ts`.
- **Tela ideal:** resultado com o mapa ampliado sobre um trecho.

---

## 09 — ENGENHARIA E ARQUITETURA

**Stack real.** React 19 e TypeScript em modo estrito, Vite 6, Tailwind 4, React Router 6; Supabase (Postgres, Auth, RLS, RPCs, Edge Functions); leitura de planilhas com SheetJS, exportação com ExcelJS, PDFs com pdf.js; Motion e visx para gráficos e movimento; hospedagem estática na Vercel.

**Arquitetura.** Uma aplicação de página única com telas carregadas sob demanda. As regras de leitura, cálculo e fluxo ficam em funções puras separadas da interface. O banco guarda as regras de cobrança e as conferências por meio de views e funções, e a segurança é aplicada nele, não só na tela.

**Decisões técnicas importantes**
- Cálculo do devido por serviço no Postgres, com resultado guardado e invalidado por mudança de dado, para suportar faturas grandes.
- Dados originais da importação preservados em JSON, o que permite refazer o cálculo quando a regra muda.
- Item lançado guarda o fator da época; acertos no contrato não reescrevem a história.
- Processamento de PDF e planilhas no navegador.
- Migrações testadas em transação desfeita antes de aplicar.

**Integrações.** Segundo projeto Supabase para a Lista de Medidores, com sessão e permissões próprias; endpoint de listagem de colaboradores protegido por segredo para outro sistema do mesmo ecossistema; entradas por planilhas e PDFs exportados de sistemas externos.

**Segurança.** Acesso por papel e por módulo conferido no banco (RLS); criação de logins por função de servidor que valida o administrador antes de usar a chave de serviço; chaves fora do navegador e do repositório.

**Estrutura de dados.** 61 migrações; objetos agrupados por prefixo de módulo; contrato com histórico; disponibilidade com resumo por função, para ultrapassar o limite de linhas da API.

**Automação e IA.** Preenchimento automático de fim de semana por função de banco; limpeza algorítmica de GPS. Não há IA no produto.

**Produção.** Deploy na Vercel com tratamento do caso de abas abertas durante uma publicação (recarga automática e cache seletivo).

**Visual:** diagrama de arquitetura (`assets/diagrams/arquitetura.md`) com cartões laterais para segurança, dados e testes.

**Evidências:** `package.json`, `vercel.json`, `src/main.tsx`, `supabase/migrations`, `supabase/functions`, `docs/faturamento-relatorio.md`.

---

## 10 — DIFERENCIAIS

1. **Um motor de conferência contratual por serviço.** Não é um painel que soma colunas: reconstrói o valor devido de cada serviço a partir das regras do contrato (transposição de códigos, atendimento por RC, despacho, área, homem-hora por minuto, glosa) e compara com o que foi pago, com tolerância definida e prova automatizada em scripts de teste.
2. **Rastreabilidade por desenho.** Dado original preservado; contrato com histórico e motivo; lançamento que guarda o valor da época; conferência manual invalidada quando algo muda; log da exclusão; planilha de auditoria exportável. O número pode ser defendido.
3. **Rotinas manuais substituídas por lógica própria.** O Cálculo de KM limpa pontos falsos de GPS e explica cada descarte; a Disponibilidade traduz uma planilha com macro em regras claras e automações. São ferramentas pequenas, mas com algoritmo e rigor de produto.

---

## 11 — RESULTADOS E ENTREGAS

**Entregas comprovadas (evidência no repositório)**
- Aplicação web com cerca de vinte rotas e cinco frentes: Manutenção, Faturamento, Frota, Ferramentas e Administração.
- 61 migrações de banco, duas funções de servidor e regras de contrato codificadas.
- Identidade visual própria: símbolo, paleta, tipografia, texturas e login animado.
- 32 scripts de verificação, incluindo testes de banco com reversão e de interface em três larguras.
- Vídeo institucional de cerca de 88 segundos, com narração e trilha, produzido a partir do próprio sistema.
- Publicação na Vercel (deploy registrado em 05/11/2026), com correção de falha pós-deploy documentada. Endereço e uso real em produção a confirmar com o autor.

**Resultados mensurados.** Nenhum indicador com fonte verificável foi encontrado. O case não apresenta métricas de ganho.

**Benefícios esperados (não medidos)**
- Redução do esforço de conferência de faturas.
- Maior visibilidade de diferenças de pagamento para fundamentar negociações.
- Controle consistente da disponibilidade das equipes.
- Menos retrabalho por regra espalhada em planilhas.

**Visual:** três colunas (Entregue, Medido, Esperado), com a coluna "Medido" propositalmente vazia ou ausente enquanto não houver dados. Se houver dados reais autorizados no futuro, incluí-los com fonte e data.

---

## 12 — ENCERRAMENTO

A Central NEO reúne, em um só produto, entendimento de um contrato complexo, modelagem de dados, regras de negócio no banco, interface densa e legível, marca própria e publicação na web. Mais do que telas: um sistema em que cada regra tem endereço, e cada número pode ser explicado.

**Frase de fechamento:** *Quando cada nota tem um endereço e cada número tem uma origem, fechar a conta deixa de ser um ato de fé.*

**Competências demonstradas:** descoberta de problema e requisitos · modelagem de domínio · UX/UI e design system · front-end React/TypeScript · back-end e banco Postgres/Supabase · segurança por RLS · processamento de arquivos · testes de integração · publicação e operação.

**Visual:** fundo Noite com o anel gigante, ponto ciano preenchendo a abertura, a frase de fechamento em Inter extra-negrito branca e a lista de competências em JetBrains Mono.
