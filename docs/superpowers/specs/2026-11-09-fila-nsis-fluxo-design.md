# Fila de NSIS: novo fluxo e filtros por coluna — desenho (09/11/2026)

Pedido de Matheus (09/11/2026). Este documento junta tudo o que ele decidiu em conversa. Onde algo é decisão
minha, está marcado como **[decisão minha]**.

## Intenção

A fila de NSIS do módulo Manutenção (`/fechamento`, tela `src/paginas/fechamento/Fila.tsx`) acompanha cada NSIS
da execução até a apropriação. O fluxo de hoje foi desenhado para várias NSMP por NSIS e para quatro fatores. A
operação real é mais simples: **cada NSIS tem 1 NSMP e 1 NSPR** (na NSRI, 1 NSMC), e só existem dois fatores. A
fila também deve mostrar, em cada etapa, só o que já se sabe, e permitir filtrar por coluna como a aba
Instalações do Visão de Dono (`C:\APPWEB\visao-de-dono`, `FluxoInstalacoes.jsx`).

Sucesso: Matheus abre a fila, vê só as colunas que fazem sentido na etapa, avança cada NSIS clicando nela,
informa o que a etapa pede e a NSIS vai para a etapa seguinte sem nenhum passo extra.

## Metas

1. Fluxo novo com quatro etapas ativas e, no fim, a conclusão (ver "Fluxo").
2. Colunas da lista acumuladas por etapa (ver "Colunas").
3. Filtro e ordenação por coluna, no estilo Excel do Visão de Dono (ver "Filtros").
4. Fator reduzido a dois valores.
5. Supervisor ligado à equipe informada, a partir das frotas da Disponibilidade.
6. Fluxo especial da NSRI.

## Não metas e antimetas

- **Não mexer no histórico.** NSIS que já têm NSMP, NSPR ou fatura continuam exatamente como estão, nas etapas
  de hoje. O fluxo novo vale só para NSIS que entram a partir do início desta mudança. Nenhuma NSIS antiga pode
  cair na etapa "Aguardando Salesforce".
- Não apagar tabelas, views, RPCs nem migrations existentes (regra do projeto: nunca editar migration aplicada;
  nova migration para qualquer mudança de banco).
- Não tocar no Faturamento, no TraceOne nem na Disponibilidade além de **ler** as frotas.
- Falha seria: uma NSIS nova ficar presa numa etapa sem como avançar; ou o histórico mudar de etapa.

## Fluxo (NSIS comum)

| Etapa | O que a NSIS tem | O que Matheus informa ao clicar nela | Vai para |
|---|---|---|---|
| 1. A fechar | só o que veio do relatório | códigos (como hoje), nº da equipe e NSMP | 2 |
| 2. Aguardando NSPR | NSMP | nº da NSPR e valor pago (digitado em US) | 3 |
| 3. Aguardando Salesforce | NSPR e valor pago | data de lançamento no Salesforce (uma por NSIS) | 4 |
| 4. Aguardando apropriação | data de lançamento | nº da apropriação (AP), que só chega tempos depois | Concluída |

- Em todas as etapas o dado é informado **na janela da NSIS**, aberta ao clicar na linha (como já é na etapa 1).
  Nada de campo na própria linha.
- A etapa de fatura/AP de hoje (`AGUARDANDO_FATURA` → `FATURADA`) é a etapa 4 e a conclusão. A apropriação
  continua sendo o último passo.
- "Sem cobrança" continua existindo como hoje.
- **[decisão minha]** A etapa `AGUARDANDO_NSMP` ("Gerar NSMP") não existe no fluxo novo, porque os códigos e a NSMP
  são informados juntos na etapa 1. Ela continua para o histórico que já está nela.
- **[decisão minha]** Cada passo pode ser corrigido depois (editar o que foi informado), como a janela já permite
  hoje; voltar a NSIS de etapa acontece ao apagar o dado da etapa seguinte.

### Uma NSMP, uma NSPR

Cada NSIS nova tem exatamente um lançamento. O botão "Novo lançamento, com outra NSMP" não faz sentido no fluxo
novo e pode sair da janela para NSIS novas. **[decisão minha]** Ele continua funcionando para o histórico, que pode
ter vários lançamentos.

### NSRI (tipo de serviço `NSRI`, campo `tipo_serv`)

- Etapa 1 pede códigos, nº da equipe, **NSMC** (no lugar da NSMP) e **valor pago** (em US).
- Não há etapa de NSPR: a NSIS vai da etapa 1 direto para "Aguardando Salesforce" e depois para "Aguardando
  apropriação", como as demais.
- Matheus voltará à NSRI quando tratar do Salesforce; até lá vale isto.

## Fatores

Só existem **Urbano e CSC = 1,0** e **Rural e CSC = 1,2**. Deixam de existir Urbano e COD (1,2) e Rural e COD (1,4).
Hoje `src/lib/fechamentoCobranca.ts` calcula fator = 1 + 0,2 se rural + 0,2 se COD, e o `Fator` aceita 1, 1,2 e
1,4. A janela só oferece os dois novos. **[decisão minha]** Itens antigos com 1,4 ou com COD continuam lidos e
calculados como estão; a mudança vale só para o que for informado daqui em diante. A constante `FATORES` e a
regra de `fatorPadrao` (a zona vem do relatório) precisam refletir isso.

## Supervisor

- **Na importação:** a lista mostra a **localidade** (4 dígitos, que o relatório já traz) no lugar do supervisor.
  Nesta fase não há supervisor.
- **Depois da etapa 1:** o supervisor passa a ser o da frota da equipe informada, lido de `neo_disp_frotas`
  (`frota` integer = nº da equipe; `supervisor` ∈ Vinícius, Victor, Elton, Pedro). Ele aparece na lista.
- **Equipe fora da lista de frotas:** a janela abre um campo para informar o supervisor à mão. O sistema não
  bloqueia.
- A tabela `neo_localidade_supervisor` (e a coluna `supervisor` da view `neo_vw_nsis`) deixa de ser usada no
  fluxo novo. **[decisão minha]** Não apagar; só parar de usar. O histórico continua mostrando o que mostra hoje.
- **[decisão minha]** O supervisor da equipe é gravado na NSIS ao informar a equipe, para não mudar depois se a
  frota mudar. O campo à mão usa o mesmo lugar.

## Colunas por etapa

Acumulam conforme a etapa, como `colunasVisiveis` do Visão de Dono. A coluna Etapa fica sempre à direita.

| Etapa | Colunas |
|---|---|
| A fechar | N° Serviço, Tipo do serviço, Localidade, DT execução, Etapa |
| Aguardando NSPR | + Equipe, Supervisor, NSMP (na NSRI mostra NSMC) |
| Aguardando Salesforce | + NSPR, Valor pago |
| Aguardando apropriação | + Data de lançamento |
| Concluída | + Apropriação |
| Todas | todas as colunas |

As demais colunas de hoje (observação do GDIS, valores de lançamento etc.) saem da lista nas etapas do fluxo novo,
porque Matheus ainda não tem esses dados. O importador continua lendo o relatório inteiro; só a tela muda.
Para as etapas do histórico a lista continua com as colunas de hoje.

## Filtros

Como no Visão de Dono: botão ▾ em cada cabeçalho com menu para ordenar crescente ou decrescente e marcar valores
(com pesquisa), chips azuis removíveis para os filtros ativos, contador "N NSIS" e chips de etapa no topo com
contagem. Os valores de cada menu respeitam os outros filtros, não o próprio. Clicar de novo na ordem atual volta
à ordem padrão (execução mais antiga primeiro nas etapas da fila). Vazios sempre no fim.

Isso se soma aos filtros que já existem (busca, data de execução, tipo, localidade, equipe, pagamento). O que
substituir o quê fica para o plano.

**[decisão minha]** Como a lista de hoje é paginada no servidor (50 por página, filtros na URL), o filtro por
coluna também roda no servidor e os valores dos menus vêm de consulta própria, para não carregar milhares de NSIS no
navegador. Se o plano mostrar que carregar tudo no cliente é mais simples e rápido, o construtor decide.

## Decisões técnicas e restrições

- Banco: CENTRAL-NEO (Supabase). Mudanças só por migration nova em `supabase/migrations` (hoje vai até a 055),
  testada com `node scripts/migrar.cjs --testar` antes de aplicar. A pasta `supabase/` está fora do Git. Quem aplica
  é Matheus.
- A etapa de uma NSIS é calculada no banco (view `neo_vw_nsis`) a partir dos itens; o fluxo novo precisa de
  etapas novas (`AGUARDANDO_SALESFORCE`, `AGUARDANDO_APROPRIACAO` ou nomes equivalentes) e de campos novos
  (data de lançamento no Salesforce, supervisor gravado, NSMC, valor pago da NSRI). Nomes e modelo ficam com o
  construtor, respeitando o que já existe (`neo_nsis`, itens, `neo_vw_nsis`, RLS por `neo_tem_modulo('fechamento')`).
- **Marca do fluxo novo:** o plano precisa dizer como o banco distingue NSIS "do fluxo novo" de histórico (por
  exemplo uma data de corte ou uma marca gravada na importação). Isso define o que é histórico.
- Valor pago é digitado em US; o R$ continua pela US vigente na data de execução.
- Linguagem da tela: "Manutenção" (o nome interno `fechamento` não muda).
- Visual: grade em estilo Excel já aplicada na fila (`.grade-nsis` em `src/index.css`).
- Testes existentes que cobrem a fila: `scripts/manutencao-ui-testar.cjs`, `manutencao-lancamento-testar.cjs`,
  `manutencao-fator-testar.cjs`. Devem ser atualizados e continuar passando.

## Decisões fechadas depois da revisão do desenho

Todas são **[decisão minha]**, tomadas com base no que já existe. Matheus pode trocar qualquer uma.

1. **Valor pago é um valor por NSIS** (o que a CEMIG paga na NSPR; na NSRI, o valor pago informado na etapa 1).
   Ele é rateado entre os itens na proporção do pedido, como `ratearPago` já faz hoje. Assim a divergência
   (pedido × pago), o Painel e `fechamentoCobranca.ts` continuam funcionando por item, sem mudar.
2. **Quem é histórico e quem entra no fluxo novo:** é histórico toda NSIS com origem `HISTORICO` ou que já tenha
   qualquer NSMP, NSPR ou fatura. Entram no fluxo novo as NSIS **sem nenhum desses dados** e com origem
   `RELATORIO` ou `MANUAL`, inclusive as que já estão em "A fechar" no banco, porque ainda não têm nada a
   preservar. O plano deve confirmar com uma contagem no banco antes de aplicar.
3. **Painel:** fora do escopo de mudança de tela, mas não pode quebrar. As etapas novas contam como "abertas";
   "Concluída" é a mesma `FATURADA` de hoje, então os totais de faturadas continuam iguais.
4. **Onde ficam os dados:** no fluxo novo, equipe, supervisor, NSMP, NSPR, NSMC, valor pago e data de lançamento
   no Salesforce são da NSIS (uma de cada), e os itens guardam só código, quantidade, fator e valor. A etapa do
   fluxo novo vem desses campos da NSIS, não da contagem de itens; o histórico continua calculado pelos itens.
   O modelo exato fica para o construtor.
5. **NSRI:** usa a mesma etapa de Salesforce e a mesma de apropriação. A coluna NSMP mostra a NSMC e a coluna NSPR
   fica com "—".
6. **Supervisor pela equipe:** `neo_disp_frotas.frota` é chave primária, então não há duas linhas por equipe.
   Se a equipe informada não for um número inteiro ou não existir em `neo_disp_frotas`, abre o campo de
   supervisor à mão.

## O que fica para o construtor

Modelo de dados e nomes das etapas novas; como marcar o histórico; migration; mudança na view e nos tipos;
janelas de cada etapa; consulta dos valores dos menus de filtro; ordem de entrega (por exemplo: banco e
etapas, depois janelas, depois filtros).
