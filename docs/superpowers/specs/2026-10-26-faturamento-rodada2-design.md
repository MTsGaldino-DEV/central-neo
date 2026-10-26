# Faturamento, rodada 2: Painel, lista estilo Excel, janela do serviço, Manutenção e erros

Data: 26/10/2026. Combinado com Matheus em conversa, com modelos no navegador.
Continua o redesenho de `2026-10-26-faturamento-ux-design.md` (já entregue,
migrations 028–035). Pedidos de origem: `docs/att.md`.

Modelos aprovados (locais, fora do Git) em
`.superpowers/brainstorm/1866-1793030000/content/`:

| Tela | Arquivo aprovado |
|---|---|
| Painel | `painel-v7.html` |
| Lista da Conferência | `conferencia-lista-v3.html` |
| Janela do serviço | `detalhe-servico-v5.html` |
| Barra lateral | `barra-lateral-v2.html` |
| Documentação | `documentacao-ml.html` |
| Erros | `erros-v2.html` |

Os números da 9844 nos modelos são reais. As faturas 9612/9730 do gráfico e o
código 704050 no bloco do 1.NS são ilustrativos. **Textos de explicação dos
modelos (subtítulos, "é só exemplo", "Serviço 245579601 (8.82 + 1.NS): a
Manutenção tem lançamento…") não vão para o sistema.** Os emojis dos modelos
viram ícones lucide de traço, de uma cor só, como já é hoje.

Um modelo alternativo, "Conferência como sistema" (causas agrupadas, decisão
em lote, contestação), está em `docs/modelos/conferencia-sistema.html`.
Matheus vai mostrar a quem usa antes de decidir. **Não faz parte desta rodada.**

## 1. Intenção

A métrica principal do Matheus é **quanto a CEMIG pagou a menos**; o pagou a
mais vem em segundo. O Painel atual mistura os dois num card só e parece dizer
que a CEMIG pagou a mais. A Conferência precisa voltar a ser uma lista em
colunas que a equipe (acostumada com Excel) filtre sem pensar. A janela do
serviço precisa dizer de cara qual serviço e qual frota é, e o que foi aplicado.
O 1.NS é pago pela Manutenção (antigo "Fechamento de Notas") e precisa
aparecer cruzado. Erros precisam dizer o que fazer, sem jargão do banco.

## 2. Objetivos

1. Painel (antigo Resumo) com dois cards, funil até os divergentes, gráfico com
   resumo no mouse e troca R$ | US.
2. Lista da Conferência em colunas com filtro estilo Excel por coluna.
3. Janela do serviço com identificação em destaque, fatores aplicados em cima,
   tabela só com o pago, 1.NS cruzado com a Manutenção e histórico.
4. "Fechamento de Notas" passa a se chamar **Manutenção** em todo o projeto.
5. Barra lateral com seções recolhíveis e rolagem redesenhada.
6. Documentação com uma página por aba do Faturamento, no layout dos guias do
   Mercado Livre.
7. Erros em uma linha para o usuário; detalhes só para o administrador.
8. Pequenos: Valor Moto antes de Fator Moto; destaque do 5.62; filtro Multado.

## 3. Fora do escopo

- Envio de serviço para a gestora revisar (Matheus adiou).
- O modelo "Conferência como sistema" (acima).
- Gravar os erros numa lista para consulta posterior (decisão minha; pode
  entrar depois).
- Somar o valor da Manutenção (1.NS) aos totais do Faturamento. "Não somar os
  totais por enquanto."
- Regras de negócio abertas (NOTA 10, Moto rural 0,9 × 0,84, PSAP, exceção do
  5.62): não mudar sem pedido. O 5.62 só ganha **destaque visual**.
- Mudar URLs (`/fechamento…`) ou nomes internos (tabelas `neo_nsis*`,
  `fechamento.ts`, módulo `fechamento` em `neo_tem_modulo`) no renome.

## 4. O que foi decidido, tela por tela

### 4.1 Navegação e nomes

- Some o botão "Resumo | Conferência" do topo (`AlternarFatura`) nas duas
  telas. O componente pode ser removido.
- A aba "Resumo" passa a se chamar **Painel**: menu, título da tela, links,
  documentação, exportações. Rota nova `/faturamento/painel`;
  `/faturamento/resumo` redireciona para ela (links salvos continuam).
- Menu Faturamento: Faturas · Painel · Conferência · Importar fatura · Tabelas
  do contrato.

### 4.2 Painel (`painel-v7.html`)

- **Topo:** título "Painel do faturamento", subtítulo com fatura, mês e
  "1 US = R$ 2.964,33". Filtros em **pílulas**: `Fatura 9844 ▾`, `Este mês`,
  `3 meses`, `6 meses`, `Ano`, `📅 Período` (abre o seletor de meses que já
  existe em `SeletorPeriodo`). A pílula ativa fica preenchida em petróleo.
  As pílulas substituem o cabeçalho clicável atual. Mesma lógica de atalhos de
  `atalhoPeriodo`.
- **Chave R$ | US**, como no painel da Manutenção (`paginas/fechamento/Painel.tsx`):
  abre em **R$**, guarda a escolha na URL (`?unidade=us`) igual ao de lá.
- **Dois cards lado a lado**, no lugar do card principal atual:
  - **Pagou a menos** (borda vermelha, valor em vermelho): valor da diferença,
    "N serviços", frase "A CEMIG pagou X e o contrato prevê Y" (soma de
    `pago_comparado` e `devido` só dos serviços `A_MENOS`), etiquetas por
    motivo com quantidade e valor (RC não pago, fator menor, outros…) e
    etiqueta "N com 1.NS". Botão "Ver os N serviços →" abre a Conferência
    filtrada em pagou a menos.
  - **Pagou a mais**: **tudo em verde** (borda, valor, etiquetas, botão;
    tokens `concluido*`). Mesma frase. Etiqueta em destaque
    "N são 5.62 pago como RC inteiro" com o valor, e "N outros".
  - Sai a linha "88 serviços sem fator… 564 serviços contam só a parte com
    fator". Matheus não entendeu.
- **Funil "Como ficou a conferência"**, em forma de funil de verdade: cada
  barra centralizada e **mais estreita que a de cima**:
  Serviços na fatura → Código no contrato (−N fora do contrato) → Valor confere
  (−N divergentes) → **Pagou a mais** (verde, maior) → **Pagou a menos**
  (vermelho, menor). Valores da diferença à direita das duas últimas. Embaixo:
  "X% conferem sem intervenção · clique numa etapa para abrir a lista".
  A ordem a mais / a menos segue o tamanho; com a 9844, 172 em cima e 106
  embaixo. Se um dia a menos for maior, inverte (decisão minha: manter o
  funil sempre estreitando).
  - "−N fora do contrato" e "−N divergentes" têm um **"i" pequeno** ao lado
    (sem sublinhado pontilhado). No mouse aparece:
    - Fora do contrato: "Serviços com código que não tem valor na tabela do
      contrato. Sem esse valor não dá para saber quanto a CEMIG deveria pagar,
      por isso ficam fora da conta."
    - Divergentes: "Serviços em que a CEMIG pagou diferente do que o contrato
      prevê. Logo abaixo: quantos ela **pagou a mais** e quantos **pagou a
      menos**.", com "pagou a mais" em verde e negrito e "pagou a menos" em
      vermelho e negrito.
- **O resto do Painel de hoje fica, embaixo do gráfico** (Matheus): os grupos
  "Por tipo de equipe / Por código / Por cidade" e "Ajustes da fatura (fora da
  conferência)". Os três cartões pequenos (Serviços analisados, US pagos,
  Multas) saem do topo; Multas já está no resumo do gráfico e o número de
  serviços no funil (decisão minha).
- **Conferidos à mão** continuam como decidido na rodada 1: o serviço marcado
  como conferido **sai** do pagou a menos, do pagou a mais e da exportação, e
  das contagens dos cards, do funil e dos atalhos. A nota "N conferidos à mão"
  embaixo do funil continua.
- **Painel com período de várias faturas** (3 meses, 6 meses, ano, período):
  os cards e o funil somam as faturas do período, como hoje (`somarTotais`).
  Os links ("Ver os N serviços", etapas do funil) abrem a Conferência da
  **fatura mais recente do período**, e a Conferência mostra qual fatura está
  aberta. Decisão minha; a Conferência continua sendo de uma fatura por vez.
- **Gráfico "Comparação entre faturas"** (aqui e na aba Faturas): ao passar o
  mouse numa fatura aparece um resumo, **uma informação por linha**, rótulo à
  esquerda e valor à direita: Fatura e mês (título), Pago, Devido, Multas,
  A menos · N, A mais · N, Fora do contrato. Valores na unidade escolhida.

### 4.3 Valor da US (apostilamento)

- Uma taxa só para todo o Faturamento: o **valor mais recente** de
  `neo_valor_us` (hoje R$ 2.964,33, vigente desde 24/05/2026). Matheus: o
  Faturamento começa a ser usado agora; as faturas antigas são histórico.
- Mostrar sempre "1 US = R$ 2.964,33" perto da chave R$ | US.
- Conversão no cliente (US × taxa), arredondada a centavos. Exportações para
  Excel continuam em US (decisão minha; dá para acrescentar colunas em R$
  depois).

### 4.4 Lista da Conferência (`conferencia-lista-v3.html`)

- Volta a ser **tabela em colunas**, uma linha por serviço:
  Situação · Nº serviço · Tipo serv. · Códigos · Frota · Tipo frota · Cidade ·
  Pago · Devido · Diferença · Multa · Motivo. Matheus aprovou essas colunas.
- **Filtro estilo Excel em cada coluna** (botão ▾ no cabeçalho, preenchido
  quando a coluna tem filtro): ordenar A→Z / Z→A, campo "Pesquisar",
  "(Selecionar tudo)" e uma lista de valores com caixa de marcar e a contagem
  de cada valor, botões Cancelar / OK. Nas colunas de número (Pago, Devido,
  Diferença, Multa): "maior que / menor que / entre".
- **Atalhos em cima** (pílulas com contagem): Todos · Pagou a menos · Pagou a
  mais · Fora do contrato · Conferem · **Conferidos** (os marcados à mão; o
  modelo não mostra, mas a rodada 1 exige esse filtro). Ao lado, três botões que se combinam com
  eles: **Contém 1.NS**, **Multado** (multas ≠ 0) e **5.62**.
- **Filtros ativos** como etiquetas com ✕ e "Limpar todos"; à direita,
  "N serviços · diferença X".
- Cores: linha com fundo vermelho-claro em a menos, verde-claro em a mais.
  Situação em selo colorido. Código **1.NS em roxo**, **5.62 em cobre**.
  **⚠ roxo** ao lado dos códigos quando o serviço tem 1.NS e **não** está na
  Manutenção (com título no mouse explicando).
- Paginação como hoje; "Exportar para Excel" exporta o que está filtrado.
  O **"Exportar para negociação"** de hoje (abas a menos / a mais com a
  coluna "Explicação") **continua**, ao lado. Decisão minha: é o arquivo que
  vai para a CEMIG.
- Chave R$ | US também aqui (padrão R$, igual ao Painel); colunas de valor
  mudam de unidade.
- **Filtrar, ordenar e contar no servidor.** São 21.910 serviços por fatura e
  o limite do Supabase é 8 s; a lista atual já lê a tabela guardada
  `neo_fat_servicos_calc` via `neo_fat_servicos_lista`. A lista de valores de
  cada coluna (com contagens) também vem do servidor, respeitando os outros
  filtros ativos, como no Excel. Como montar isso (uma RPC de valores por
  coluna, colunas novas na tabela guardada para `tem_1ns`, `na_manutencao`,
  `tem_562`, índices) fica com o construtor.
- Os filtros ficam na URL, para voltar à mesma lista e compartilhar o link.

### 4.5 Janela do serviço (`detalhe-servico-v5.html`)

- **Cabeçalho:** "Serviço da fatura 9844", número grande, cidade e zona; à
  direita o selo da situação e a diferença (na unidade escolhida, com a outra
  embaixo).
- **Faixa de identificação** com quatro campos grandes: **Nº do serviço ·
  Tipo do serviço · Nº de frota · Tipo da frota** (Moto, Multifuncional,
  Umpla, Quarteto; `TIPOS_TURMA_FAT`).
- **"Como o devido foi calculado"**: etiquetas Despacho (CSC ou COD) · Zona
  (Urbano, ou Rural × fator de `neo_fat_config.rural`) · Tabela. **Sem
  etiqueta de Moto**: o tipo da frota já diz. Embaixo, a conta numa linha, por
  exemplo "1.21: fator CSC 0,2740 × rural 1,2 = 0,3288 US devido · a CEMIG
  pagou 0".
- **Avisos:**
  - roxo, quando o serviço tem um código normal e também 1.NS: "Tem 1.21 e
    1.NS. Parte do pagamento pode vir pela Manutenção.";
  - amarelo, quando tem 1.NS e o serviço não existe na Manutenção
    (`neo_nsis.servico = numserv`): "Não encontrado na Manutenção. A nota
    deste serviço ainda não foi fechada."
- **Tabela "O que a CEMIG pagou na fatura"**: Código · Descrição · Zona ·
  Pago · Multa/estorno. **Só o pago**; somem as colunas "Devido CSC · COD ·
  Moto". O **1.NS aparece como linha**, logo abaixo dos outros códigos, mesmo
  zerado, em roxo, com "código informativo, valor pela Manutenção".
- **Bloco "1.NS · Pago pela Manutenção (não entra na soma)"**: **só aparece
  quando a Manutenção tem lançamento com valor** para o serviço. Uma linha por
  item de `neo_nsis_itens`: **Código** (do contrato da Manutenção, Tabela 03,
  `neo_contrato_itens`) · **Observação do contrato** (operação · atividade em
  negrito e a `descricao` do contrato embaixo) · Qtd. · US (`valor_final`).
  **Sem a observação da equipe.** Hoje nenhum dos 2.155 itens tem `codigo`
  preenchido (são todos antigos); sem código, a linha mostra "sem código" e o
  valor.
- **Histórico** do serviço (o "log por nota"): lista com data, hora e o que
  aconteceu: importado na fatura (e substituído, se for o caso), conferido à
  mão com a observação e quem, conferência desfeita, revisão que ficou
  desatualizada após reimportação. Os eventos passam a ser **gravados a partir
  de agora** numa tabela de eventos por fatura e serviço: conferir e desconferir
  (hoje `neo_fat_conferencias_servico` só guarda o último) e cada importação ou
  substituição da fatura (hoje `neo_fat_faturas` só guarda a última). Os
  eventos sobrevivem à reimportação. O que aconteceu antes desta rodada aparece
  só como "Importado em <importado_em atual>". Decisão minha; dá para cortar
  se pesar.
- Rodapé: Fechar · Marcar como conferido (como hoje).

### 4.6 Cruzamento com a Manutenção (1.NS)

- Chave: `neo_nsis.servico = neo_fat_*.numserv`.
- Na 9844: 204 serviços com 1.NS; 94 estão na Manutenção, 63 com valor;
  110 não estão. Matheus: os que não estão são notas ainda não fechadas,
  porque a equipe ainda não usa o sistema. Em produção vão diminuir.
- O cruzamento é só para mostrar; não muda situação, diferença nem totais.

### 4.7 Manutenção no lugar de Fechamento de Notas

- Todo texto que o usuário vê: menu, títulos, avisos, Início, Login,
  documentação e os `.md` de memória/contexto. "Fechamento de Notas" e
  "Fechamento" (quando se refere ao módulo) viram **Manutenção**.
- URLs e nomes internos ficam (ver Fora do escopo).

### 4.8 Barra lateral (`barra-lateral-v2.html`)

- Todas as seções começam **abertas**. Clicar no título fecha ou abre; uma
  setinha gira. Seção fechada mostra quantos itens tem dentro.
- O sistema lembra quais seções você fechou (no navegador, `localStorage`
  com try/catch; se não der, começa tudo aberto).
- A seção da página atual nunca fica escondida: se estiver fechada e você
  navegar para uma página dela, abre (decisão minha).
- **Rolagem redesenhada** na barra: trilho escuro arredondado com respiro em
  cima e embaixo, alça em degradê petróleo (`sinal-claro` → `sinal`) que
  clareia no mouse, e esmaecido no topo e no pé quando há mais itens.
- Ícones lucide de traço, como hoje. Sem emoji colorido.

### 4.9 Documentação (`documentacao-ml.html`)

- Layout dos guias do Mercado Livre (só o layout): barra no topo com
  "Documentação" e busca; à esquerda o menu de páginas; no meio trilha
  ("Documentação › Faturamento › Painel"), título, "Última atualização em
  dd/mm/aaaa", texto com caixas **Nota** (petróleo) e **Importante** (amarelo),
  tabelas e bloco de exemplo escuro; à direita "Nesta página", acompanhando a
  rolagem; no fim "Esta página foi útil? Sim / Não" e Anterior / Próxima.
- **Uma página por aba do Faturamento**: Visão geral, Faturas, Painel,
  Conferência, Importar fatura, Tabelas do contrato; e em "Referência":
  Regras de cálculo e Glossário. O conteúdo é o que já existe em
  `Documentacao.tsx`, redistribuído pelas páginas e atualizado com esta rodada
  (dois cards, funil, R$ | US, filtros, 1.NS/Manutenção, 5.62).
- Busca procura nos títulos e textos das páginas, no cliente.
- "Foi útil?": guardar a resposta no banco (tabela pequena com página,
  resposta, usuário e data). Decisão minha; dá para cortar.
- O "?" de cada tela leva à página da aba dela.

### 4.10 Erros (`erros-v2.html`)

- **Usuário comum:** uma linha só, com o que fazer, e "Tentar de novo"
  quando faz sentido. Exemplo: "Não foi possível carregar a lista. Aguarde
  alguns segundos e tente de novo."
- **Administrador** (`acesso.papel === 'ADMIN'`): a mesma linha e um botão
  **"Ver mais detalhes"**. Ao abrir: O que houve (em português), Onde (tela ›
  parte › etapa, com a fatura), e o bloco técnico (tela/URL, chamada RPC, código
  e mensagem do banco, quando, usuário) com "Copiar detalhes".
- Ações pequenas (salvar uma conferência) mostram o mesmo conteúdo num aviso no
  canto que some sozinho.
- Traduzir os erros conhecidos: tempo esgotado (57014), sem permissão (42501),
  sem conexão, planilha com coluna faltando (com arquivo, aba e coluna), fatura
  já existe. O desconhecido cai numa frase genérica e o detalhe fica para o
  admin.
- Vale para todas as telas do Faturamento. Substitui o `erroFat` atual.

### 4.11 Pequenos

- **Tabelas do contrato:** coluna **Valor Moto antes de Fator Moto** (tabela
  e janela de detalhe).
- **5.62:** destaque cobre na lista e etiqueta própria no card Pagou a mais.
  Sem mudar regra.
- **Multado:** filtro na lista (4.4).

## 5. Restrições

- React 19, Vite 6, Tailwind v4 com os tokens de `src/index.css`, lucide-react,
  Supabase/Postgres. Imports com `@/`.
- `supabase/` está fora do Git agora (`.gitignore`), a pedido do Matheus.
  Migrations novas continuam em `supabase/migrations/` (036 em diante), rodam
  com `node scripts/migrar.cjs` (dry-run com `--testar` antes); nunca editar
  migration aplicada. Elas não vão para o commit.
- Funções `security definer` com `search_path=public`, checam
  `neo_tem_modulo('faturamento')`, `revoke` de public/anon e `grant` para
  authenticated. Toda consulta da Conferência precisa caber em 8 s com
  chamadas simultâneas (`scripts/faturamento-carga-testar.cjs`).
- Testes no padrão do projeto: `scripts/*-testar.cjs` (banco em transação
  desfeita, TS via `transpileModule`) e o teste de navegador
  `scripts/faturamento-ui-testar.cjs`.
- Não mexer na lógica da Manutenção nem do TraceOne além do renome de textos e
  da leitura para o cruzamento.
- Commits: `<tipo>(faturamento): <descrição>`, parágrafo "Corrigimos alguns
  erros e melhoramos a experiência geral. Até Breve, Matheus", linha
  Co-Authored-By. `git status` antes; nunca incluir `ns_preventiva_c_fonte.jsp`.
  Codex usa o mesmo diretório. Sem push sem o Matheus pedir.
- Ao terminar, atualizar `MEMORIA_COMPARTILHADA.md` e
  `docs/faturamento-relatorio.md`, incluindo a 035 (tabela guardada, fim do
  tempo esgotado) e o `supabase/` fora do Git (as migrations só existem na
  máquina; vale guardar cópia).

## 6. Com o construtor

- Estrutura dos componentes (filtro de coluna reutilizável, pílulas, cards,
  aviso de erro), nomes de arquivos e de RPCs.
- Como levar ao servidor os filtros por coluna e as listas de valores com
  contagem, desde que caibam no limite de 8 s.
- Como guardar os eventos do histórico e as respostas de "Foi útil?".
- Texto final das páginas da documentação, a partir do conteúdo atual.
- Ajustes de layout no celular (as telas precisam funcionar em 360 px; a
  tabela da Conferência pode rolar na horizontal dentro do cartão).
