# 04 — Marca e design: Central NEO

Fontes: `src/index.css` (`@theme`), `src/components/NeoLogo.tsx`, `public/favicon.svg`, `src/components/Shell.tsx`, `src/components/CircuitoAnimado.tsx`, `src/paginas/Login.tsx`, `src/paginas/Inicio.tsx`, `src/paginas/disponibilidade/disponibilidade.css`, `index.html`, memória do projeto. Nenhuma tela foi renderizada nesta investigação: o que está abaixo vem do código e da documentação. Não há evidência de pesquisa com usuários, moodboards ou etapas formais de concepção; elas não são descritas aqui.

---

## 1. Marca

- **Nome:** Central NEO. NEO = Núcleo de Eficiência Operacional. CONFIRMADO.
- **Conceito do símbolo, descrito no próprio código:** "o círculo que fecha". Um anel aberto representa a nota pendente; um ponto preenche a abertura e representa o pagamento que fecha a conta. O símbolo é também o "O" de NEO. CONFIRMADO (comentário em `NeoLogo.tsx` e `CONTEXTO_GERAL.md` §5).
- **Construção geométrica (CONFIRMADO no SVG):** anel de raio 15 num quadro de 48 px, traço 6,5 com pontas arredondadas, cobrindo cerca de 298° (`stroke-dasharray 76 100`); abertura no canto superior direito, com um ponto de raio 5.
- **Logo completo:** "NE" em tipografia Manrope extra-negrito + símbolo no lugar do "O", reduzido a 85% e alinhado à altura das maiúsculas. Três temas: claro (tinta + petróleo), escuro (branco + ciano) e monocromático (`currentColor`).
- **Ícone do app:** quadrado de cantos arredondados em Noite (`#061A1F`) com o símbolo em branco e ponto ciano. Arquivo real: `assets/branding/neo-simbolo-favicon.svg` (cópia de `public/favicon.svg`).
- **Tagline em uso na tela de login:** "Cada nota aberta, até o último centavo fechado." CONFIRMADO.
- **Assinatura de rodapé do login:** crédito de autoria do desenvolvedor. CONFIRMADO. (Texto não reproduzido aqui; ver §10.)

## 2. Paleta (CONFIRMADO em `index.css`)

| Token | Hex | Papel |
|---|---|---|
| `sinal` (Petróleo) | `#0B7285` | Ação principal, links, foco, item ativo |
| `sinal-forte` | `#08596A` | Hover e pressionado |
| `sinal-fundo` | `#E6F4F6` | Item ativo, linha selecionada |
| `sinal-claro` | `#3BC9DB` | Ponto da marca sobre fundo escuro |
| `noite` / `noite-alto` / `noite-baixo` | `#061A1F` / `#0C2F38` / `#030D10` | Barra lateral e login, em degradê radial |
| `tinta` | `#0B1F24` | Texto principal |
| `nevoa` | `#F4F7F8` | Fundo das páginas |
| `linha` | `#DDE6E8` | Bordas |
| `aco` / `aco-claro` | `#586E74` / `#93A5AA` | Texto secundário; ícones inativos e placeholders |
| `cobre` / `cobre-fundo` | `#D9822B` / `#FDF3E8` | Valores em US, divergências, destaque quente |

**Cores semânticas:** pendente (âmbar), revisão (violeta), concluído (verde), erro (vermelho) e glosa (laranja), cada uma com texto, fundo e marcador. **Etapas do fechamento:** a fechar (petróleo), NSMP (âmbar), NSPR (violeta), Salesforce (verde-azulado), apropriação (índigo), fatura (azul), faturada/concluída (verde), sem cobrança (cinza).

Leitura de uso: o petróleo carrega o que é ação e o cobre carrega o que é dinheiro ou alerta, o que separa visualmente "o que fazer" de "o que está em jogo". (INFERIDO a partir do uso documentado: cobre para valores em US e divergências.)

Arquivo de apoio: `assets/branding/paleta-neo.svg` (amostras geradas a partir dos tokens acima).

## 3. Tipografia (CONFIRMADO em `index.css` e `index.html`)

- **Inter** (400–800): interface. Substituiu a Manrope em 10/11/2026.
- **JetBrains Mono** (400–700): números de serviço, NSMP, NSPR, AP, serial, matrícula, rótulos técnicos em caixa-alta espaçada.
- **Manrope** (800): só no logo (`NeoLogo`) e em materiais da marca.
- Fontes carregadas do Google Fonts.

Uso observado: títulos em peso extra-negrito com `tracking` justo, rótulos de seção em monoespaçada versal com espaçamento de 0,2 em, e identificadores de negócio sempre em monoespaçada, o que facilita comparar números a olho.

## 4. Elementos gráficos

- **Anéis concêntricos** discretos sobre fundo Noite (`textura-aneis`), ecoando o símbolo.
- **Grade de pontos** no lado claro do login (`textura-pontos`), com máscara radial que apaga o centro.
- **Circuito animado** no login (`CircuitoAnimado.tsx`): pulsos que correm trilhas e acendem "ilhas" na ponta, em ciclo; o lado do texto é escurecido por um degradê para manter leitura. CONFIRMADO (código CSS e componente).
- **Ícones:** biblioteca Lucide, tamanho 15–22 px, em contêineres arredondados (`rounded-xl`).
- Entrada suave em formulários (`animate-surgir`).

## 5. Estrutura de interface

- **Shell:** barra lateral Noite com navegação por grupos (Início, Ferramentas, Manutenção, Faturamento, Frota, Em breve, Administração), recolhível a apenas ícones com `title` e `aria-label`; no celular, menu em gaveta com botão de abrir/fechar. Itens futuros ("Notas de Ouvidoria", "Conciliação CEMIG") aparecem esmaecidos com "em breve". CONFIRMADO (`Shell.tsx`).
- **Densidade:** a interface roda em zoom de 90% por decisão registrada em 16/11/2026 (mais dados por tela). CONFIRMADO (memória).
- **Início:** saudação por período do dia e uma pergunta como título: "O que precisa fechar hoje". Cartões por módulo, com resumos de dados reais (fatura atual, pendências da manutenção, medidores). CONFIRMADO (`Inicio.tsx`).
- **Telas de dados densos:** listas em grade com filtros por coluna no estilo planilha, pílulas de etapa com contagem, janelas modais no centro da tela com tudo sobre o item, atalhos de período, estado nos parâmetros da URL (`?q=`, `?etapa=`, `?tipo=`), que permitem compartilhar uma visão filtrada. CONFIRMADO.
- **Painéis:** cartões de totais com alternância R$ / US, gráficos com resumo ao passar o mouse, clique que leva à lista já filtrada. CONFIRMADO.
- **Privacidade na interface:** botão de olho "Ocultar valores" na Lista de Medidores, que borra valores em R$ mantendo as contagens (17/11/2026). CONFIRMADO.
- **Responsivo:** testes de interface registrados em 1440, 1920 e 390 px sem rolagem lateral (Cálculo de KM, Disponibilidade, Faturamento). CONFIRMADO como execução registrada na memória; resultado atual não reverificado.
- **Design system:** tokens do Tailwind em `@theme` + shadcn aplicado só em telas novas, sem regra global, para não alterar as telas antigas. CONFIRMADO.

## 6. Linguagem de cor na Disponibilidade

Grade mensal com uma célula por frota e dia: "Cadastrou" em verde com ícone de check (desenhado como imagem de fundo por desempenho), "Falta conferir" em azul-névoa, motivos multáveis em vermelho, motivos contestáveis em amarelo de alerta. A cor repete a regra de negócio (valem R$ 0 ou geram multa), de modo que o painel pode ser lido sem legenda extensa. CONFIRMADO (memória + `disponibilidade.css`).

## 7. Interação e movimento

- Zoom, arrasto, dica de posição e régua de escala no mapa do Cálculo de KM, que acompanha o zoom.
- Cruz de destaque de linha e coluna na grade da Disponibilidade, em DOM direto para ficar fluida.
- Números animados e gráficos com revelação progressiva (`@number-flow/react`, `motion`, componentes em `components/charts`).
- O vídeo institucional (26/10/2026) usa a mesma identidade e o símbolo redesenhado a partir do componente real. CONFIRMADO (memória).

## 8. Como as decisões visuais servem à experiência

- Um fundo claro e frio com um único azul-petróleo mantém foco em tabelas e números; as cores de etapa dão leitura rápida do ponto do processo.
- O cobre reservado a dinheiro e alertas evita "ruído colorido" em telas cheias de linhas.
- Monoespaçada nos identificadores reduz erro de leitura em conferência.
- A marca conta a história do produto (nota aberta que se fecha), o que reforça o propósito sem recorrer a ilustrações genéricas.

## 9. Recomendações de arte para o case (respeitando a identidade real)

- Base de cor: Névoa `#F4F7F8` para o fundo geral do case, com blocos em Noite `#061A1F` para capa, tecnologia e encerramento.
- Acento: Petróleo `#0B7285` para títulos de seção e linhas; Cobre `#D9822B` apenas para dados de dinheiro, alertas e um detalhe por frame.
- Tipografia: Inter para texto corrido, JetBrains Mono para rótulos e números, Manrope extra-negrito apenas na assinatura de marca.
- Texturas: anéis concêntricos em Noite (do `textura-aneis`) e grade de pontos em fundo claro (do `textura-pontos`).
- Símbolo como ornamento: um anel gigante recortado atrás dos títulos, com o ponto ciano preenchendo a abertura.
- Screenshots reais, nunca ilustrações genéricas; mostrar a densidade das telas como virtude.

## 10. Itens sensíveis na marca

- O rodapé do login traz o nome do autor; usar no case apenas se o autor desejar e com a forma de crédito que escolher.
- A marca da distribuidora e do setor (UEN 211) não faz parte da identidade da NEO; qualquer uso exige autorização (ver `08-verification-report.md`).

## 11. O que não se afirma

Não há registro de naming workshop, pesquisa, testes de usabilidade, versões anteriores do símbolo ou alternativas descartadas. O case descreve o **resultado visual** e a **lógica declarada no código**, sem inventar processo criativo.
