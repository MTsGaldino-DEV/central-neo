# 06 — Storyboard Behance: Central NEO

Sequência vertical de módulos independentes, largura de trabalho de **1400 px** (ajustar aos limites atuais da plataforma antes de exportar). Altura sugerida de cada frame: 900 a 1800 px, conforme o conteúdo. Todos os screenshots seguem a lista de `07-visual-assets-plan.md` (IDs `S01`…); onde o ID ainda não existe como arquivo, o frame depende da captura. **Nenhuma tela inventada**: onde falta captura, o frame fica reservado.

Direção geral (respeitando a identidade real do produto):
- Alternar fundo Noite `#061A1F` (capa, solução, tecnologia, encerramento) e Névoa `#F4F7F8` (problema, UI, funcionalidades, experiência).
- Títulos em Inter 800, rótulos em JetBrains Mono versal com espaçamento largo, acento Petróleo `#0B7285`; Cobre `#D9822B` só em dinheiro e alertas; ciano `#3BC9DB` só como ponto da marca sobre Noite.
- Textura de anéis sobre Noite (eco do símbolo); grade de pontos sobre Névoa.
- Margens laterais de 120 px; coluna de texto até 520 px; espaço negativo generoso.
- Leitura em mobile: texto mínimo de 28 px no canvas de 1400 px, no máximo 40 palavras por bloco.

---

## FRAME 01 — CAPA

1. **Objetivo:** primeira impressão: marca, promessa e tela real.
2. **Headline:** *Cada nota aberta, até o último centavo fechado.*
3. **Copy de apoio:** "Central NEO · Plataforma de gestão operacional e financeira da manutenção de redes de energia. Produto, marca, interface e engenharia."
4. **Elementos visuais:** símbolo da marca em escala gigante (anel cortado pela borda), logo para fundo escuro (`assets/branding/neo-logo-escuro.svg`), tags (Produto digital · UX/UI · React · PostgreSQL), textura de anéis.
5. **Screenshots:** S03 (Painel do Faturamento), recorte do cartão principal; alternativa S01 (login).
6. **Composição:** tela em perspectiva leve à direita, sobreposta ao anel; texto à esquerda.
7. **Telas reais:** `/faturamento/painel`; `/login`.
8. **Hierarquia:** 1) headline; 2) tela; 3) nome e categoria; 4) tags.
9. **Montagem:** altura 1200 px; fundo Noite; tela com sombra suave e borda `linha` 1 px; o ponto ciano do símbolo alinhado ao canto da tela.

## FRAME 02 — INTRODUÇÃO

1. **Objetivo:** explicar o produto em 20 segundos para quem não é técnico.
2. **Headline:** *Uma central para o que a manutenção executa, cobra e recebe.*
3. **Copy de apoio:** "A Central NEO reúne, num só login, o acompanhamento das notas de serviço, a conferência da fatura da distribuidora, o controle de disponibilidade das equipes e ferramentas de apoio ao campo."
4. **Elementos:** mapa de módulos em cinco cartões (Manutenção, Faturamento, Frota, Ferramentas, Administração) com ícones Lucide.
5. **Screenshots:** S02 (Início), recorte do menu lateral expandido (S24).
6. **Composição:** menu lateral real à esquerda; cartões à direita.
7. **Telas reais:** `/` e o menu do Shell.
8. **Hierarquia:** 1) headline; 2) cartões de módulos; 3) texto de apoio.
9. **Montagem:** fundo Névoa; menu em Noite como bloco de contraste; ícones em Petróleo.

## FRAME 03 — O PROBLEMA

1. **Objetivo:** mostrar a dor sem exagero e sem números inventados.
2. **Headline:** *Cada planilha guardava um pedaço da regra.*
3. **Copy de apoio:** "O contrato define preço, área, despacho e tempo. O pagamento chega em faturas com dezenas de milhares de linhas. O controle vivia em planilhas, sem histórico e sem ligação entre as etapas."
4. **Elementos:** três cartões em fila (Notas · Fatura · Frota) cada um com um recorte de planilha **anonimizada** (colunas e cabeçalhos, sem dados); o símbolo aberto (anel sem ponto) ao centro.
5. **Screenshots:** recortes das planilhas originais com dados removidos (ver `07`, grupo P).
6. **Composição:** grade de três colunas sobre a grade de pontos; símbolo aberto como fio condutor.
7. **Telas reais:** não aplicável (planilhas originais). Não usar o sistema neste frame.
8. **Hierarquia:** 1) headline; 2) três cartões; 3) frase de consequência em cobre sutil.
9. **Montagem:** tom sóbrio; evitar clichê de "Excel vermelho"; nenhuma célula legível.

## FRAME 04 — A SOLUÇÃO

1. **Objetivo:** apresentar a abordagem: regra explícita e rastreável.
2. **Headline:** *O contrato virou regra. A planilha virou prova.*
3. **Copy de apoio:** "As regras do contrato moram no banco de dados. Os dados originais são preservados. Cada acerto tem motivo e histórico. As pessoas decidem; o sistema confere."
4. **Elementos:** diagrama de fluxo (planilha → importação → regra → conferência → decisão) a partir de `assets/diagrams/fluxo-faturamento.md`, redesenhado na paleta da marca; o anel se fecha ao final do fluxo.
5. **Screenshots:** miniaturas de S07 (Importar fatura) e S05 (Conferência) nas pontas do diagrama.
6. **Composição:** diagrama horizontal centrado; miniaturas como âncoras.
7. **Telas reais:** `/faturamento/importar`, `/faturamento/conferencia`.
8. **Hierarquia:** 1) headline; 2) diagrama; 3) legenda de cada passo em mono versal.
9. **Montagem:** fundo Noite; linhas finas em ciano; o ponto do anel é o último elemento a "acender".

## FRAME 05 — BRANDING

1. **Objetivo:** apresentar o sistema de marca real.
2. **Headline:** *O círculo que fecha.*
3. **Copy de apoio:** "Um anel aberto é a nota pendente. Um ponto preenche a abertura: o pagamento que fecha a conta. O símbolo é também o O de NEO."
4. **Elementos:** logo nos três temas, símbolo isolado, construção geométrica (anel r15, abertura superior direita, ponto r5), paleta, tipografia, textura de anéis, ícone do app.
5. **Screenshots:** nenhum obrigatório; opcional S01 (login) como aplicação.
6. **Composição:** prancha de marca em grade 12 colunas; logo grande à esquerda, paleta em linha, tipografia à direita.
7. **Telas reais:** aplicação da marca em `/login` e no Shell.
8. **Hierarquia:** 1) símbolo e conceito; 2) paleta; 3) tipografia; 4) aplicações.
9. **Montagem:** usar `assets/branding/*` (logos, paleta, favicon). Mostrar a construção do símbolo com linhas-guia só se for desenhada a partir do SVG real.

## FRAME 06 — UI SHOWCASE

1. **Objetivo:** mostrar a interface real e sua densidade como qualidade.
2. **Headline:** *Muitos dados, leitura limpa.*
3. **Copy de apoio:** "Listas com filtros por coluna, painéis com R$ e US, janelas com o contexto completo, tudo no mesmo sistema visual."
4. **Elementos:** três telas grandes em sequência diagonal ou em escada; selos mono pequenos com o nome da rota.
5. **Screenshots:** S03 (Painel do Faturamento), S10 (Fila de fechamento), S15 (Grade de disponibilidade).
6. **Composição:** telas em "janela de navegador" mínima, sem mockup de notebook, escalonadas com sombra leve.
7. **Telas reais:** `/faturamento/painel`, `/fechamento`, `/disponibilidade`.
8. **Hierarquia:** 1) uma tela dominante; 2) duas de apoio; 3) legendas.
9. **Montagem:** fundo Névoa; telas com cantos de 12 px; nenhum dado real visível (ver ocultação em `07`).

## FRAME 07 — FUNCIONALIDADES

1. **Objetivo:** apresentar as cinco funcionalidades que sustentam a proposta de valor.
2. **Headline:** *Cinco ferramentas, uma lógica.*
3. **Copy de apoio:** conferência de fatura por serviço · fila de fechamento por etapas · tabela de valores com histórico · disponibilidade da frota · cálculo de KM.
4. **Elementos:** cinco blocos alternados (imagem/texto) com o problema, o como funciona e o benefício em até 35 palavras cada; numeração em mono.
5. **Screenshots:** S06 (janela de serviço), S11 (janela da nota), S13 (tabela de valores), S16 (disponibilidade do dia), S18 (cálculo de KM com mapa).
6. **Composição:** blocos de largura total, imagem à esquerda e à direita alternadas.
7. **Telas reais:** serviço aberto na Conferência; janela da NSIS; `/fechamento/tabela`; `/disponibilidade?visao=dia`; `/ferramentas/calculo-km`.
8. **Hierarquia:** número + nome da funcionalidade → imagem → três linhas de texto.
9. **Montagem:** um destaque (círculo Petróleo de 2 px) ao redor do elemento principal de cada tela; sem setas decorativas.

## FRAME 08 — EXPERIÊNCIA

1. **Objetivo:** mostrar fluxos, navegação e responsividade.
2. **Headline:** *Do filtro ao motivo, em poucos cliques.*
3. **Copy de apoio:** "O estado da tela vive na URL. Os cartões do painel levam à lista já filtrada. O menu se recolhe a ícones. O celular tem a mesma lógica."
4. **Elementos:** fluxo em quatro passos (Painel → card → lista filtrada → janela do serviço) com numeração; trio de telas de celular; detalhe do menu recolhido.
5. **Screenshots:** S03 → S05 → S06 em sequência; S23 (celular, Conferência e Disponibilidade); S24 (menu recolhido).
6. **Composição:** faixa horizontal de passos acima; telas de celular abaixo, três em linha.
7. **Telas reais:** rotas já listadas; capturas em 390 px.
8. **Hierarquia:** 1) fluxo; 2) celular; 3) detalhe do menu.
9. **Montagem:** conectar os passos com linha fina Petróleo; telas de celular em moldura simples de 390 px sem hardware.

## FRAME 09 — TECNOLOGIA

1. **Objetivo:** demonstrar profundidade técnica com elegância.
2. **Headline:** *As regras moram no banco. A interface só as mostra bem.*
3. **Copy de apoio:** "React 19 e TypeScript no front. Postgres com RLS, views e funções no Supabase. Importação de planilhas e PDFs no navegador. Migrações testadas em transação desfeita."
4. **Elementos:** diagrama de arquitetura (`assets/diagrams/arquitetura.md`) redesenhado; selos de stack; quatro números verificados (61 migrações · 2 funções de servidor · 32 scripts de verificação · ~25 mil linhas de TypeScript, contagem aproximada).
5. **Screenshots:** nenhum obrigatório. Opcional: recorte de código **sem dados sensíveis** (ex.: tokens `@theme`).
6. **Composição:** diagrama central em três camadas (interface · banco · integrações); números em faixa inferior.
7. **Telas reais:** não aplicável.
8. **Hierarquia:** 1) diagrama; 2) números; 3) selos.
9. **Montagem:** fundo Noite; não colocar chaves, URLs de projeto nem nomes de variáveis com valor.

## FRAME 10 — DIFERENCIAIS

1. **Objetivo:** concentrar os três pontos defensáveis.
2. **Headline:** *O que torna a Central NEO diferente.*
3. **Copy de apoio:** (1) Conferência por serviço com regras de contrato explícitas. (2) Rastreabilidade por desenho: dado original, histórico, motivo e auditoria. (3) Rotinas manuais substituídas por lógica própria, como o Cálculo de KM.
4. **Elementos:** três colunas com número grande em Petróleo, um recorte de tela por coluna.
5. **Screenshots:** S06 (fatores aplicados), S13 (histórico de acerto), S18 (planilha/descartes do KM ou mapa).
6. **Composição:** grade de três colunas iguais.
7. **Telas reais:** as mesmas do Frame 07, em recortes diferentes.
8. **Hierarquia:** número → título → duas linhas → recorte.
9. **Montagem:** fundo Névoa; nenhuma frase de superlativo.

## FRAME 11 — RESULTADOS

1. **Objetivo:** apresentar entregas comprovadas e benefícios esperados, sem métricas inventadas.
2. **Headline:** *O que foi entregue.*
3. **Copy de apoio:** lista curta de entregas comprovadas (cinco frentes, 61 migrações, identidade visual, vídeo institucional, publicação na web) e, em bloco separado e visualmente mais leve, "benefícios esperados (ainda não medidos)".
4. **Elementos:** coluna "Entregue" com ícones de check; coluna "Esperado" com contorno tracejado; capa do vídeo institucional, se autorizada.
5. **Screenshots:** capa do vídeo (`entregas/central-neo/Central-NEO-UEN-211-capa.jpg`), **somente após revisão de dados e de marcas** (ver `08`); S02 (Início).
6. **Composição:** duas colunas desiguais (60/40).
7. **Telas reais:** `/`.
8. **Hierarquia:** entregas em destaque; esperados em segundo plano.
9. **Montagem:** se surgirem números medidos, incluir fonte e data em nota de rodapé; hoje o frame não traz nenhum.

## FRAME 12 — ENCERRAMENTO

1. **Objetivo:** fechar a narrativa e a abrangência do trabalho.
2. **Headline:** *Quando cada nota tem um endereço e cada número tem uma origem, fechar a conta deixa de ser um ato de fé.*
3. **Copy de apoio:** "Concepção, marca, interface, banco de dados, regras de negócio e publicação, de ponta a ponta."
4. **Elementos:** anel gigante com o ponto ciano preenchendo a abertura (animação estática, o ponto já no lugar); lista de competências em mono.
5. **Screenshots:** opcional: S01 (login) em tamanho pequeno.
6. **Composição:** centrada, muito espaço negativo.
7. **Telas reais:** `/login`.
8. **Hierarquia:** frase → competências → assinatura.
9. **Montagem:** fundo Noite com textura de anéis; assinatura do profissional no estilo que ele escolher (o produto usa um crédito de autoria no rodapé do login).

---

### Observação final

Os 12 frames são viáveis com 15 a 20 capturas reais. Se o tempo for curto, a sequência mínima é: 01, 02, 04, 05, 06, 07, 09, 12 (8 frames).
