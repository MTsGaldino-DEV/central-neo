# Faturamento: redesenho de UI/UX e ajustes de regra

Data: 26/10/2026. Desenho combinado com Matheus em conversa, com mockups no
navegador. Os mockups aprovados estão em
`.superpowers/brainstorm/1447-1793011880/content/`:
`resumo-final.html`, `conferencia-layout.html` (opção A), `lista-faturas-v3.html`
e `documentacao.html`. Neles, só são reais os números da fatura 9844
(totais e situações). Faturas 9701/9755/9799, agrupamentos, motivos e saldos
são ilustrativos.

## 1. Intenção

O Faturamento serve para **cobrar a CEMIG**. Matheus vai negociar com a CEMIG
usando o que o sistema mostra, então a tela precisa responder rápido duas coisas:
**quanto a CEMIG pagou a menos** (a dor principal) e **quanto pagou a mais**
(secundário), serviço por serviço, com o motivo em português. Hoje as telas
mostram tudo, mas não respondem isso: o Resumo é uma grade de 8 números sem
explicação, a Conferência é uma tabela de 13 colunas com 27.389 linhas e
situações em código, as datas usam o seletor nativo do navegador e a página
fica "carregando" a cada atualização.

Também é preciso que outras pessoas usem o sistema **sem perguntar ao Matheus**,
por isso há uma documentação curta para leigos.

## 2. Objetivos

1. Lista de faturas como porta de entrada, com saldo a receber por fatura.
2. Resumo de uma fatura que se entenda em poucos segundos.
3. Conferência focada no que foi pago a menos e a mais, **um registro por
   serviço** (21.910 na 9844), com motivo e frase explicativa.
4. Importação que não deixa estragar uma fatura por engano.
5. Tabela do contrato com o valor Moto calculado.
6. Página de Documentação curta, fora da sidebar.
7. Telas que abrem rápido, com os últimos dados já vistos.
8. Visual mais caprichado e consistente em todas as abas de Faturamento,
   no desktop e no celular.

## 3. Fora do escopo

- Perguntas de negócio abertas no `docs/faturamento-relatorio.md`: NOTA 10,
  rural de Moto 0,9 × 0,84, PSAP 0,3, exceção do 5.62, CSC × COD. Não mudar
  essas regras.
- Histórico de versões de importação: **a versão anterior pode ser substituída**
  (decisão do Matheus).
- Saldo acumulado entre faturas: cada fatura tem seu próprio saldo.
- Fechamento, TraceOne e qualquer tela fora de Faturamento.

## 4. O que faria isso fracassar (anti-objetivos)

- Números que não batem com a planilha. Os totais do novo modelo por serviço
  precisam fechar com os totais por linha de hoje: na 9844, crédito
  917,112183, débito 21,226389, estorno 7,446161, líquido 903,331955 US.
- Importação que apaga ou mistura dados sem o usuário perceber.
- Uma tela bonita que esconde o detalhe de que a negociação precisa. Cada
  número tem que levar até os serviços que o compõem.
- Texto longo. As pessoas não leem, então tudo tem que ser frase curta e
  exemplo.

## 5. Restrições

- Stack existente: React 19, Vite, Tailwind v4, react-router 6, Supabase,
  `xlsx`, `motion`, `@visx/*`, `lucide-react`. Não adicionar bibliotecas
  sem necessidade.
- Identidade NEO em `src/index.css`: petróleo `#0B7285`, cobre `#D9822B`,
  fundo névoa `#F4F7F8`, cores de status existentes, Manrope e JetBrains Mono
  (`font-codigo`). Usar os tokens, nunca cores soltas.
- Banco: nunca editar migrations já aplicadas. Criar novas a partir da 028 e
  testar com `node scripts/migrar.cjs --testar` antes de aplicar. Objetos
  `neo_fat_*` próprios. Acesso por `neo_tem_modulo('faturamento')`, e correção
  do contrato só para ADMIN.
- Seis casas decimais e tolerância `neo_fat_config.tolerancia` (0,000001 US).
- Releia o Git antes de editar: o Codex trabalha no mesmo diretório. Ao
  terminar, atualize `MEMORIA_COMPARTILHADA.md`, o relatório
  `docs/faturamento-relatorio.md` e a auditoria.
- Adicionar `.superpowers/` ao `.gitignore`.

## 6. Decidido com Matheus

### 6.1 Termos

- **Multas** = glosas negativas da US_Servico (o "debitado" de hoje). Os
  ajustes da aba Debito_Credito continuam separados.
- **Multas não entram no saldo** (decisão do Matheus). A glosa é tratada como
  desconto legítimo e aparece só no cartão/contagem de Multas. As multas
  injustas são contestadas à parte, com o detalhe do serviço e a justificativa.
  Por isso, a comparação devido × pago do serviço usa o **crédito**, e não o
  crédito + glosa. Na janela do serviço, a glosa aparece em separado.
- **Saldo a receber** de uma fatura = soma, nos serviços **não conferidos** e
  com fator conhecido, de quanto o crédito ficou **abaixo** do devido (acima da
  tolerância).
- **Pago a mais** = soma, do mesmo jeito, dos serviços não conferidos com
  crédito acima do devido.
- **Serviço conferido sai do saldo, do pago a mais e da exportação** (decisão
  do Matheus). É preciso poder **filtrar os conferidos**: um chip ou filtro
  "Conferidos" na Conferência. Marcar ou desmarcar um serviço como conferido
  recalcula o saldo, os cartões e a lista de faturas.

### 6.2 Lista de faturas (nova porta de entrada)

Mockup: `lista-faturas-v3.html`.

- Título "Faturas da CEMIG" e botão "Importar nova fatura".
- **Três cartões de total**, somando todas as faturas, cada um com uma linha de
  tendência:
  - Pago pela CEMIG, com a variação da atual em relação à anterior.
  - Pago a menos (soma dos saldos), com a fatura de maior saldo.
  - Multas aplicadas, com a média em percentual do valor pago.
- Gráfico "Comparação entre faturas" (pago, devido e multas por fatura).
  **Fica aqui e também no Resumo.**
- **Fatura atual** em destaque. Embaixo, "Histórico" com as anteriores, que
  servem como base de consulta. Cada fatura mostra:
  - número e mês;
  - um mini gráfico com três barrinhas (pago, devido e multas);
  - o percentual de conferência, com uma barrinha empilhada nas cores do funil;
  - o **saldo a receber** próprio da fatura.
- Clicar numa fatura abre o detalhe dela.

### 6.3 Resumo

Mockup: `resumo-final.html` (modelo B1, numa página só, com o filtro no título).

1. **Cabeçalho-contexto:** o título é a frase "Fatura **9844 ▾** ·
   **jul – set / 2026 ▾**".
   - Clicar na fatura troca a fatura.
   - Clicar no período abre um painel com atalhos (este mês, 3 meses, ano) e
     um calendário por mês.
   - Ao lado, "atualizado há X min ⟳".
   - **Não usar `<input type="date">` nativo.** Esse padrão de filtro vale para
     todas as abas de Faturamento.
2. **Manchete escura:** "Diferença · pago − devido", com o valor grande, a frase
   "A CEMIG pagou X e o contrato prevê Y." e o aviso de quantos itens sem fator
   ficaram fora. Ao lado ficam três números de apoio:
   - serviços analisados, com o número de linhas embaixo;
   - US pagos, com crédito e estorno embaixo;
   - multas.
3. **Lado a lado:**
   - à esquerda (cerca de 40%), o **funil compacto** "Como ficou a conferência";
   - à direita, a comparação entre faturas, com a **legenda pequena e de
     tamanho fixo**. Não usar texto dentro de SVG escalável: o Matheus
     reclamou da legenda gigante.
   - No celular, um embaixo do outro.
4. Funil (formato F1, centralizado, afunilando): Importados → Equipe
   identificada → Código no contrato → (etapa de RC, ver 6.4) → Valor confere.
   - À direita de cada etapa aparece quanto caiu ali, na cor do problema.
   - Embaixo, "X% conferem sem intervenção".
   - Cada perda é clicável e abre a Conferência filtrada.
5. Três listas clicáveis: por tipo de equipe, por código (top N + "ver todos")
   e por cidade.
6. Tabela "Ajustes da fatura (fora da conferência)", com o total de débito e
   de crédito.
7. Tudo o que o Resumo mostra hoje continua existindo (creditado, debitado,
   estorno, devido, diferença, divergentes, pendentes, sem fator, grupos e
   ajustes). Só muda a organização.

### 6.4 Conferência: um registro por serviço

Mockup: `conferencia-layout.html`, opção A.

- **Unidade = número do serviço**, para todos os tipos de pagamento. O serviço
  soma o crédito de todas as linhas (as glosas ficam à parte, ver 6.1) e compara
  com o devido do serviço:
  - **Pagamento por código** (por exemplo NSSR com 7.15 e 7.10): devido = soma
    de cada código.
  - **Pagamento por RC** (RC07, RC08…): devido = **um RC por atendimento**.
    Os códigos de fechamento só indicam o trabalho feito. A transposição das
    notas 2–3 da Tabela 12 continua como hoje.
  - Se o total bate, o serviço **confere**. Não existe mais o texto "já pago na
    linha anterior" nem a marcação `REVISAR_RC_MULTILINHA` para um RC que foi
    pago certo numa linha e zerado nas outras. Isso explica a maior parte das
    1.310 linhas que hoje estão "a revisar".
- **Layout A:**
  - No centro (2/3 da largura) fica o cartão vermelho "A receber · pagou a
    menos": total em US, quantos serviços, chips por motivo com contagem, e a
    lista de serviços.
  - Cada item mostra número, código principal, equipe e cidade, a diferença e
    uma frase do tipo "Deveria pagar **0,0234** (5.14, fator normal) e pagou
    **0,0164**: aplicaram o desconto de Moto 0,7 numa equipe Multifuncional."
  - Na lateral estreita fica "Pagou a mais", com o total, a contagem e a
    divisão por motivo.
  - No topo, os botões "Exportar para negociação" e "Ver todos os serviços"
    (a tabela completa, mais limpa, por serviço).
- **Detalhe:** clicar num serviço abre uma **janela flutuante centralizada**
  com o fundo escurecido.
  - Fecha pelo "X", pelo botão "Cancelar" ou pela tecla Esc.
  - Mostra todas as linhas e códigos do serviço, equipe, frota e turma, os
    fatores, o devido e o pago, e a justificativa da glosa.
  - Traz uma **nota curta explicando o cálculo**, por exemplo "RC07 pago uma vez
    por atendimento; os códigos 5.14 e 7.42 só indicam o trabalho feito".
  - A observação e o "Marcar como conferido", que hoje ficam no painel lateral,
    passam para essa janela, com foco preso dentro dela e acessível.
- **Exportação para negociação:** XLSX com serviço, códigos, equipe, frota,
  cidade, deveria, pagou, diferença, motivo e frase. Uma aba para pago a menos
  e outra para pago a mais.

### 6.5 Importar

- Continua exigindo a Fatura Resumida e a Fatura Completa.
- **Fatura que já existe:** antes de gravar, abre uma janela de confirmação com
  o antes e o depois: linhas, serviços, pago, devido e quantas conferências
  manuais serão reabertas. Para confirmar, o usuário **digita o número da
  fatura**. A versão anterior é substituída.
- **Arquivos idênticos** aos já importados (mesmo conteúdo): avisar "nada
  mudou" e não reimportar.
- **Resumida e Completa de faturas diferentes:** bloquear com uma mensagem
  clara.
- **Linhas suspeitas de duplicidade** dentro da planilha (linhas idênticas em
  todos os campos, e não apenas o mesmo número de serviço, que é legítimo)
  aparecem na prévia antes da confirmação.
- Mantém a publicação atômica e a trava de serviço duplicado na Completa que já
  existem.

### 6.6 Tabelas do contrato

- Duas colunas novas:
  - **Fator Moto**, com o valor do contrato por código: 0,7, 1 ou 0.
  - **Valor Moto**, já calculado para CSC e COD:
    - fator 0,7: CSC × 0,7 e COD × 0,7;
    - fator 1 (por exemplo 5.70, 6.01 e 6.05): o mesmo valor, com o selo
      "sem desconto";
    - fator 0: "não paga Moto".
  - Os códigos sem exceção na Tabela 11 e os RCs da Tabela 12 seguem a regra
    global de hoje (`neo_fat_config.moto_urbano`). O cálculo na tela tem que
    ser o mesmo que o banco usa (migration 023), na parte urbana.
- O fator Rural fica oculto.
- Link "Documentação" no canto superior direito.

### 6.7 Documentação

Mockup: `documentacao.html`.

- Página nova, **fora da sidebar**. O acesso é pelo link na Tabela do contrato,
  pelo rodapé das telas de Faturamento e por um "?" em cada tela, que leva
  direto ao tema daquela tela.
- Formato aprovado:
  - no topo, "Em 1 minuto", com o fluxo em cinco ícones (importa → liga à
    equipe → calcula → compara → saldo);
  - temas no formato **pergunta + resposta de 1 a 2 frases + exemplo visual**,
    com "ver detalhes" para quem quiser mais;
  - busca no topo.
- Linguagem para leigos, mas profissional.
- Temas mínimos:
  - Em 1 minuto.
  - Por que duas planilhas, e por que 27.389 linhas viram 21.910 serviços.
  - RC pago uma vez × código pago por linha, com os exemplos do Matheus:
    242861522 NSSR 7.15/7.10 e 245530193 RC07 5.14/7.42.
  - Fator Moto 0,7, 1 ou 0.
  - O que é o saldo a receber e o que é pago a mais.
  - Cores e etapas do funil.
  - Como importar e reimportar com segurança.
  - Glossário: US, glosa, CSC/CSI, COD, RC, Tabela 11/12, frota e turma.

### 6.8 Carregamento

- Ao abrir ou atualizar, a tela mostra **na hora os últimos dados já vistos** e
  atualiza por baixo, com o indicador "atualizado há X min".
- Quando ainda não há nada guardado, mostra uma **animação de carregamento
  bonita** no estilo da NEO: esqueleto da própria tela e marca/anel da NEO, e
  não o texto "Carregando…".
- Antes de otimizar, medir onde está o tempo. A memória registra de 2 a 3 s na
  RPC paginada.

## 7. Decisões minhas (Claude), a revisar pelo Matheus

- **Fatura atual** = a de período mais recente (`fim` mais recente).
- **Navegação:**
  - `/faturamento` passa a ser a lista de faturas.
  - O detalhe da fatura é o Resumo e a Conferência daquela fatura, com uma
    chave "Resumo | Conferência" no topo.
  - A sidebar de Faturamento fica com Faturas, Resumo, Conferência, Importar e
    Tabelas do contrato.
  - Links antigos (`/faturamento?fatura=…`) redirecionam para a Conferência
    daquela fatura.
- Resumo com período sem fatura escolhida = soma das faturas do período.
- **Motivos** do pago a menos e a mais são derivados do cálculo de cada serviço.
  Os nomes iniciais são:
  - pago a menos: desconto de Moto indevido, fator menor que o contrato e RC
    não pago;
  - pago a mais: fator maior que o contrato e RC pago em várias linhas.

  A glosa não é motivo de saldo, e o código fora do contrato não entra em
  nenhum dos lados. A lista final sai da análise da 9844 real. Cada serviço
  tem **um** motivo principal, e existe um "Outra diferença" de reserva.
- **Serviço misto** (parte dos códigos com fator, parte sem): calcula o que tem
  fator e marca o serviço como "parcial". A parte sem fator fica fora do saldo
  e aparece no aviso de itens sem fator. Um serviço que mistura RC com código
  da Tabela 11 não transposto, ou dois RCs diferentes, segue a regra atual de
  `neo_fat_base` (soma por linha), também marcado para revisão.
- **CSC × COD × Moto é escolhido uma vez por serviço:** vale o candidato cujo
  devido do serviço bate com o crédito; se nenhum bater, usa CSC como
  referência, como hoje. Com isso, um serviço não mistura critérios e a frase
  faz sentido. Medir e relatar quanto isso muda o devido parcial de
  857,921936 da 9844.
- Estornos (glosas positivas) aparecem junto das multas, como valor
  devolvido, e não entram no saldo.
- **Etapa de RC do funil:** com a unidade por serviço, "RC a revisar" deve
  quase sumir. Se ficar vazia nos dados reais, a etapa sai do funil.
- O mesmo padrão de cabeçalho-contexto e de janela flutuante vale em todas as
  abas de Faturamento.

## 8. Deixado para quem construir

- Como guardar o cache dos últimos dados (memória e/ou `sessionStorage`, com
  try/catch) e se vale pré-calcular os totais por fatura na importação (por
  exemplo uma tabela `neo_fat_resumo_fatura`) para a lista e os cartões
  abrirem rápido.
- Como implementar o modelo por serviço no banco (nova view ou RPC sobre
  `neo_fat_base`/`neo_fat_calculo`, que já calculam `liquido_servico`,
  `qtd_servico` e `soma_csc`/`soma_cod`), e como ligar a revisão manual, hoje
  por linha, ao serviço sem perder as revisões já feitas.
- A biblioteca dos gráficos (CSS puro ou `@visx`), desde que a legenda tenha
  tamanho fixo.
- O texto final da Documentação.
- A estrutura dos arquivos e componentes.

## 9. Como verificar

- Typecheck, build e os scripts `scripts/faturamento-*-testar.cjs` existentes.
- Migrations novas com `--testar` (rollback) antes de aplicar.
- Fechamento dos números: a soma por serviço tem que bater com os totais por
  linha da 9844 (seção 4). O devido parcial atual também tem que bater, salvo
  as mudanças explicadas: RC por serviço, comparação pelo crédito e candidato
  escolhido por serviço. Relatar as diferenças com números.
- Marcar um serviço como conferido tira ele do saldo e da exportação, e o
  filtro "Conferidos" mostra esse serviço.
- Conferir os exemplos com Matheus:
  - 245530193 (RC07) confere sem "revisar";
  - 242861522 (NSSR) paga os dois códigos;
  - 245531435 (6.01 Moto, fator 1);
  - 246450669 (RC07 → 8.82 transposto);
  - 245881140 (RC08 com glosas).
- Navegador em desktop e celular. Janela fecha com X, Cancelar e Esc. Filtro
  sem input nativo. Legenda pequena. Reimportação pede confirmação. Arquivo
  idêntico avisa "nada mudou".
- Atualizar `MEMORIA_COMPARTILHADA.md` e o relatório com as decisões, as
  verificações e as pendências.
