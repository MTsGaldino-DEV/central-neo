# 07 — Plano de assets visuais: Central NEO

Nenhuma captura foi feita nesta etapa: o app não foi executado e o banco não foi acessado. Este arquivo lista o que existe, o que deve ser capturado e como.

---

## 1. Regra de ouro para capturas

O sistema mostra dados reais de operação (números de serviço, equipes, placas, valores, nomes de colaboradores, e-mails). **Nenhuma captura pode ser publicada a partir de dados reais.** Caminho recomendado:

1. Criar um **ambiente de demonstração** com banco Supabase separado (ou transação local sem acesso a produção) com dados **fictícios**: faturas e serviços sintéticos, equipes com nomes genéricos (ex.: "Equipe 01"), placas inventadas, valores plausíveis mas não contratuais.
2. Alternativa mais rápida: reutilizar a técnica dos testes de interface do próprio projeto (`scripts/*-ui-testar.cjs`), que simulam o Supabase no navegador com um arquivo de dados local, **mas alimentá-la com um arquivo de dados fictício**, nunca com dados lidos da produção.
3. Capturar em Chromium com janela fixa, tema padrão, zoom do app em 90% (o padrão do app), sem extensões e sem barra de favoritos.
4. Nunca aparecer: e-mails, nomes de pessoas, CPF, matrícula, placas reais, números de serviço reais, valores em R$ ou US reais, URL do projeto Supabase, abas do navegador.
5. Exportar em PNG (2x), nomes `S##-rota-estado.png` em `assets/screenshots/`.

Dispositivos: desktop **1440×900** (padrão), largo **1920×1080** quando indicado, celular **390×844**.

## 2. Material já existente (não copiado)

| Material | Local | Situação |
|---|---|---|
| Ícone/favicon real | `public/favicon.svg` | **Copiado** para `assets/branding/neo-simbolo-favicon.svg` |
| Logo (componente) | `src/components/NeoLogo.tsx` | Logos SVG **derivados do componente** em `assets/branding/` (ver §4) |
| Capas e vídeo institucional | `entregas/central-neo/` (MP4 de ~88 s, capa JPG, legendas SRT); ignorados pelo Git | **Não copiado.** Contém capturas do app com dados reais autorizados como exemplo pelo autor para uso interno; **revisar e pedir autorização** antes de usar |
| Capturas de teste | `.tmp-faturamento/*.png` (124 imagens: Faturamento, Disponibilidade, Fila, celular, documentação) | **Não copiadas.** Foram geradas com respostas locais alimentadas por dados reais. Servem como referência de enquadramento e de estados, não como material final |
| Projeto do vídeo | `video/central-neo/` | Referência de direção visual |
| Modelo HTML de conferência | `docs/modelos/conferencia-sistema.html` | Referência, não verificado se contém dados reais |

## 3. Screenshots necessários

Colunas: ID · rota · objetivo · estado ideal · resolução · elementos · ocultar · frame.

| ID | Rota | Objetivo | Estado ideal | Res. | Deve aparecer | Ocultar/anonimizar | Frame |
|---|---|---|---|---|---|---|---|
| S01 | `/login` | Marca e circuito animado | Formulário vazio; circuito em momento de pulso visível | 1440×900 | Logo, tagline, lista de frentes, formulário | Nada sensível; nome do autor no rodapé só se desejado | 01, 05, 12 |
| S02 | `/` | Início com cartões por módulo | Usuário ADMIN de demonstração; dados fictícios nos cartões | 1440×900 | Saudação, "O que precisa fechar hoje", cartões, menu | Nome do usuário; valores | 02, 11 |
| S03 | `/faturamento/painel` | Painel da conferência | Fatura fictícia selecionada; chave R$ ativa; gráfico com resumo aberto no mouse | 1440×900 | Cards "pagou a menos" e "a mais", funil, gráfico | Valores e números de fatura reais | 01, 06, 08 |
| S04 | `/faturamento` | Lista de faturas | 3 faturas fictícias com cartões de comparação | 1440×900 | Lista, cartões, saldo | Números de fatura reais | 07 |
| S05 | `/faturamento/conferencia` | Lista por serviço com filtros | Filtro "pagou a menos" ativo; coluna filtrada aberta | 1440×900 | Colunas, atalhos de situação, motivo por linha | Números de serviço e equipes reais | 04, 08 |
| S06 | Janela do serviço (Conferência) | Prova do cálculo | Serviço fictício com fatores aplicados, tabela de pago e motivo | 1440×900 | Frota, tipo, fatores, histórico | Placa, número real | 07, 08, 10 |
| S07 | `/faturamento/importar` | Importação das duas planilhas | Duas planilhas fictícias lidas, prévia visível | 1440×900 | Áreas das duas planilhas, resumo da leitura | Nomes de arquivos reais | 04 |
| S08 | `/faturamento/tabelas` | Tabelas do contrato | Tabela 11 aberta, um item com histórico | 1440×900 | Códigos, fatores, selo de acerto | **Valores contratuais reais** (usar valores fictícios) | 10 |
| S09 | `/faturamento/documentacao` | Documentação para leigos | Uma página com texto explicativo | 1440×900 | Texto, índice | Valores reais | opcional |
| S10 | `/fechamento` | Fila por etapas | Lista NSIS, etapa "NSPR", filtro de coluna e painel da seleção abertos | 1440×900 | Pílulas de etapa com contagem, grade, painel | Números de serviço e observações reais | 06 |
| S11 | Janela da NSIS (`/fechamento`) | Lançamento de códigos | Nota fictícia com "O que deve ser cobrado?" com vários códigos | 1440×900 | O que foi feito, códigos, fatores, valores, lançamentos | Observação real, equipe, localidade | 07 |
| S12 | `/fechamento/painel` | Painel da manutenção | Período de 12 meses; gráfico mensal com três séries | 1440×900 | Cartões, gráfico, pendências por idade, rankings | Valores reais | opcional |
| S13 | `/fechamento/tabela` | Tabela de valores com acertos | Janela de histórico de um item; valor da US por vigência | 1440×900 | Item, motivo, histórico | **Valores reais** | 07, 10 |
| S14 | `/fechamento/importar` | Importação do relatório | Estado "pronto para importar" com prévia | 1440×900 | Áreas de arquivo | Nome de arquivo real | opcional |
| S15 | `/disponibilidade` | Grade do mês | Mês com mistura de verde (cadastrou), amarelo, vermelho; cruz de destaque ativa | 1920×1080 | Cabeçalho, legenda, grade, totais | Placas e nomes de supervisores reais | 06 |
| S16 | `/disponibilidade?visao=dia` | Conferência do dia | Dia com algumas frotas já marcadas e motivos abertos | 1440×900 | Lista do dia, escolha de motivo | Placas e comentários reais | 07 |
| S17 | `/disponibilidade/painel` | Painel anual | Ano com meta e total | 1440×900 | Gráfico, cartões, meta | Valores reais | opcional |
| S18 | `/ferramentas/calculo-km` | Resultado com mapa | PDFs **fictícios ou sintéticos**; mapa aproximado num trecho; status marcados | 1440×900 | Resumo de km, mapa, km por status, avisos | Placas, coordenadas reais, nomes de agente | 07, 10 |
| S19 | `/ferramentas/calculo-km` | Estado de upload | Área de soltar PDFs vazia | 1440×900 | Instrução e limite de 5 PDFs | — | opcional |
| S20 | `/traceone` | Lista de Medidores com "Ocultar valores" ativo | Valores borrados, contagens visíveis | 1440×900 | Cartões, Top 10, botão de olho | Dados reais de medidores | opcional (mostra o cuidado com privacidade) |
| S21 | `/acessos` | Logins e acessos por módulo | Três usuários fictícios com módulos diferentes | 1440×900 | Lista, chips de módulo | **E-mails e nomes reais** | opcional |
| S22 | `/colaboradores` | Cadastro único | **Não usar** (dados pessoais). Se necessário, só com 100% fictícios | — | — | Tudo | evitar |
| S23 | Celular: `/faturamento/conferencia`, `/disponibilidade` | Responsividade | Lista e grade em 390 px, sem rolagem lateral | 390×844 | Layout compacto | Mesmos itens acima | 08 |
| S24 | Menu lateral | Navegação | Menu expandido e recolhido lado a lado | recorte 320×900 | Grupos, ícones, item ativo, "em breve" | Nome do usuário no rodapé | 02, 08 |

Total: 21 capturas úteis (S22 evitada). Mínimo viável para os frames principais: S01, S02, S03, S05, S06, S10, S11, S13, S15, S16, S18, S23, S24.

### Grupo P — planilhas originais anonimizadas (Frame 03)

| ID | Conteúdo | Como produzir |
|---|---|---|
| P01 | Recorte do cabeçalho e das colunas da planilha de controle de notas | Abrir o arquivo original, apagar todas as linhas de dados, manter cabeçalhos e a aparência; capturar |
| P02 | Recorte da grade da planilha de disponibilidade com macro | Mesmo processo; remover placas, nomes e comentários; deixar a estrutura de cores |
| P03 | Recorte de uma aba de fatura (cabeçalhos) | Cabeçalhos apenas, sem valores |

Não publicar os arquivos de planilha. Não ilustrar com células legíveis.

## 4. Branding (em `assets/branding/`)

| Arquivo | Origem | Observação |
|---|---|---|
| `neo-simbolo-favicon.svg` | Cópia exata de `public/favicon.svg` | Ícone do app (quadrado Noite com símbolo) |
| `neo-logo-claro.svg` | Derivado de `NeoLogo.tsx` (tema claro) | Usa a fonte Manrope 800 para "NE"; sem a fonte instalada, o texto cai em sans-serif. **Converter o texto em curvas** num editor vetorial antes de publicar |
| `neo-logo-escuro.svg` | Derivado de `NeoLogo.tsx` (tema escuro), com fundo Noite | Idem |
| `neo-simbolo-claro.svg` | Derivado de `NeoLogo.tsx` (símbolo, tema claro) | Sem texto |
| `paleta-neo.svg` | Gerado dos tokens de `index.css` | Amostras de cor; usa Inter, sem requisito de curvas se o case usar a mesma fonte |

A tipografia (Inter, JetBrains Mono, Manrope) está disponível no Google Fonts, com licença livre.

## 5. Mockups (em `assets/mockups/`, a produzir)

Somente composições feitas com **screenshots autênticos** e molduras mínimas. Evitar mockups de notebook e celular de banco de imagens.

| ID | Composição | Frame |
|---|---|---|
| M01 | Capa: S03 em perspectiva leve sobre o anel gigante da marca, fundo Noite | 01 |
| M02 | Três telas em escada (S03, S10, S15), moldura de janela de navegador | 06 |
| M03 | Fluxo em quatro passos (S03 → card → S05 → S06) com setas finas | 08 |
| M04 | Trio de telas de celular (S23) | 08 |
| M05 | Prancha de marca: logos, paleta, tipografia, textura de anéis | 05 |
| M06 | Encerramento: anel gigante com ponto ciano preenchendo a abertura | 12 |

## 6. Diagramas (em `assets/diagrams/`)

Já criados em Mermaid, com conteúdo só verificado: `arquitetura.md`, `fluxo-fechamento.md`, `fluxo-faturamento.md`, `acesso-por-modulo.md`. Para o Behance, redesenhá-los em vetor na paleta da marca (Petróleo para linhas, Noite como fundo, ciano nos pontos de chegada), mantendo o mesmo conteúdo.

## 7. Outros elementos a produzir

- Texturas: anéis concêntricos (para Noite) e grade de pontos (para Névoa), recriadas a partir dos utilitários de `src/index.css`.
- Ícones: usar Lucide (já usado no produto) em 24 px, traço 1,75.
- Capa de vídeo: reaproveitar a do vídeo institucional apenas se autorizada.
- Opcional: GIF curto de 6 s da cruz de destaque da grade de disponibilidade (captura de tela com dados fictícios).

## 8. Checklist antes de exportar

- Nenhuma captura contém nome de pessoa, e-mail, CPF, matrícula, placa real, número de serviço real, URL de banco ou valor financeiro real.
- Nenhum arquivo `.env`, chave ou token foi aberto durante as capturas.
- Os dados fictícios não reproduzem a estrutura de uma fatura real a ponto de identificá-la.
- Marca da distribuidora e do setor só com autorização (ver `08-verification-report.md`).
