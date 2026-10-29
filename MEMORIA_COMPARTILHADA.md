# Memória compartilhada — Central NEO

Atualizada em 28/10/2026 pelo Claude (homem-hora e despacho COD no Faturamento). Este arquivo é o ponto de continuidade entre
Codex e Claude neste repositório. Guarda decisões e estado de trabalho, não o
histórico completo das conversas. Ambos devem lê-lo e atualizá-lo.

## Como manter

- Registrar decisões duráveis, motivo, data e pendências; identificar suposições.
- Atualizar o estado existente em vez de acumular relatos repetidos.
- Conferir código, Git e banco quando necessário: memória não comprova estado atual.
- Arquitetura e regras detalhadas ficam em `CONTEXTO_GERAL.md`; relatórios em `docs/`.
- Nunca gravar senhas, tokens, conteúdo do `.env` ou dados pessoais nesta memória.
- Se dois agentes estiverem trabalhando, reler o arquivo antes de salvar e preservar
  as alterações do outro. Este mecanismo não sincroniza conversas nem evita conflitos sozinho.

## Preferências do Matheus

- Trabalhar em português do Brasil, seguindo os padrões existentes.
- **Prioridade visual explícita (23/10/2026):** Matheus valoriza muito sistemas
  bonitos e interfaces bem acabadas. Qualidade visual é requisito central de
  aceitação: cuidar de hierarquia, tipografia, espaçamento, cores, gráficos,
  estados de interação e responsividade, mantendo a identidade da Central NEO.
  Usar as telas existentes como referência de acabamento e validar a experiência
  no navegador antes de declarar uma entrega de interface concluída. Registrar
  qualquer impedimento dessa validação; compilação sozinha não comprova qualidade visual.
- Entender o projeto antes de alterar. Resolver decisões técnicas rotineiras com
  autonomia, executar verificações e entregar o resultado sem pedir confirmações repetidas.
- A autorização se aplica às tarefas solicitadas; respeitar os limites explícitos
  de cada tarefa e registrar bloqueios reais que dependam do usuário.
- Commit e push nas entregas prontas, usando o remote SSH existente.
- **Mensagem de commit vigente, determinada por Matheus em 23/10/2026:**
  `Corrigimos alguns erros e melhoramos a experiência geral. Até breve, Matheus`.
  Usar exatamente este assunto em cada novo commit; ele substitui o formato anterior.
  Atribuição de autoria, quando utilizada, deve corresponder ao agente real.
- Não incluir arquivos de terceiros no commit nem reescrever histórico.

## Arquitetura e cuidados

- NEO = Núcleo de Eficiência Operacional.
- React 19, TypeScript, Vite 6, Tailwind 4 e React Router 6.
- Supabase CENTRAL-NEO é o banco principal: autenticação, colaboradores, acessos,
  Manutenção (antigo Fechamento de Notas) e Faturamento. A migração do login principal já ocorreu.
- TraceOne permanece em paralelo e fornece somente o módulo de medidores, com
  cliente, sessão e permissões próprios. Não alterar banco nem app do TraceOne.
- Login único de NEO, NEC, TraceOne e Warefly é objetivo futuro, não integração concluída.
- **`supabase/` fora do Git (26/10/2026, pedido do Matheus):** a pasta está no `.gitignore`
  e não vai para o remoto. As migrations existem só na máquina local: guardar cópia.
  O histórico antigo do remoto ainda tem as versões até a 027.
- **Nome do módulo:** em tudo que o usuário lê, "Fechamento de Notas" passou a ser
  **Manutenção** (26/10/2026). URLs `/fechamento…`, tabelas `neo_nsis*`, módulo
  `fechamento` e arquivos `fechamento.ts` continuam com o nome antigo.
- Novas migrations devem passar por `node scripts/migrar.cjs --testar` antes da
  aplicação. O script atual retorna código 1 também no rollback esperado
  `DRY-RUN: desfeito`; verificar a saída inteira para distinguir falha.
- Nunca editar migrations aplicadas. Faturamento usa objetos `neo_fat_*` próprios;
  preservar tabelas, views e RPCs do Fechamento.
- Faturamento: acesso por `neo_tem_modulo('faturamento')`; acertos do contrato só ADMIN.
- No PowerShell usar `npm.cmd run typecheck` e `npm.cmd run build`.
- Scripts de banco dependem atualmente de `../traceone/frontend/node_modules/postgres`.

## Pendência preservada da memória do Claude

Em 22/10/2026, Matheus adiou a mudança dos cards **Contrato 2026 × Tabela CEMIG × Pago**
do Fechamento. Eles consideram itens com código e já pagos; o histórico sem código
fica fora e pode deixar os cards zerados. Matheus pretende resolver com a sincronização
com o GDIS. Não ampliar a base desses cards sem solicitação. Relembrar quando essa
integração for retomada.

## Última entrega: homem-hora, despacho COD e área — 27/10/2026 (Claude)

Desenho: `docs/superpowers/specs/2026-10-27-faturamento-homem-hora-cod-design.md`. Plano:
`docs/superpowers/plans/2026-10-27-faturamento-homem-hora-cod.md`. Commits `e6d5c46`..`74998c1` na `main`; **push feito em 27/10/2026**.
Migrations **039** a **043** aplicadas no CENTRAL-NEO pelo `scripts/migrar.cjs` (arquivos locais em
`supabase/`, fora do Git; nada a rodar no painel do Supabase).

Regras do Matheus em vigor:
- **Despacho:** COD quando o `tipo_serv` está em `neo_fat_despacho_cod` (43 tipos: MA01…MA95,
  MACT, MAC1, MAB8, NSRI, RC01, RC08, RC09, RC11); senão CSC. Não se escolhe mais pelo valor
  que coincide. RC04/RC06/RC07/RC21/RC36 pagos como COD = pagos a mais (decisão do Matheus).
- **Área:** `cod_tip_area` da aba Serviço da Fatura Completa (U urbano; R rural; **S rural,
  provisório**). Quantidade continua nas colunas K + M. Sem área (fatura antiga) → K/M.
- **Homem-hora** (1.62, 1.73, 5.63, 5.64, `neo_fat_contrato.remuneracao='HOMEM_HORA'`):
  horas de `dh_aciona` a `dh_terreal`, por minuto (como a CEMIG) × Tabela 14 pela equipe
  (`neo_fat_prontidao`: D 0,1097, U 0,0922, M 0,0366, Q 0,1753 US/h) × (1 + 0,2 COD + 0,2 rural).
  Moto não leva o fator 0,7. Sem equipe/horário ou término antes do acionamento → sem devido,
  com observação. Equipe → Tabela 14: dupla = caminhonete 2, umpla = caminhonete 1, moto,
  quarteto = caminhonete cabine dupla com 4 elementos (linha de 4, 0,1753; Matheus, 28/10).
- **RC com homem-hora** (28/10/2026, migration 040): se o serviço RC tem 1.62, 1.73, 5.63 ou
  5.64, não vale mais o RC por atendimento; cada linha paga o próprio código (o homem-hora
  por hora). Na 9844: 246042202 (RC15) e 246140737 (RC05); a CEMIG calculou o 5.64 por hora e glosou.
- **CSC × COD:** a lista é o único critério (Matheus, 28/10). NEO não trabalha com linha viva nem caminhão.
- **0.06 não paga** (28/10, migration 041): Tabela 11 com valor 0; serviço com 0.06 (inclusive RC) tem devido 0.
  Na 9844: 17 RC fechados só com 0.06, pagos 0, passaram a conferir.
- **Possível fator errado** (041–043): `neo_fat_servicos_lista.fator_12` guarda o texto do caso exato:
  pago × 1,2 / × 1,4 / × 1,44, "1,4 no lugar de 1,2" (a mais); ÷ 1,2 / ÷ 1,4 / ÷ 1,44, "1,2 no lugar de
  1,4", × 0,8 (a menos). Tolerância 3 × 0,000001 × linhas × fator. Sem faixa aproximada (Matheus, 28/10).
  Botão e etiqueta "Possível fator errado", motivo com o caso, aviso na janela, coluna na exportação.
  Na 9844: 74 (33 "÷ 1,4" = 1.62 rural; 32 "÷ 1,2"; 9 "× 1,2").
  Na 9844: 9 acima, 32 abaixo. Janela mostra **Fator pago** (pago ÷ base CSC urbano × 1,0) e o do contrato
  (`src/lib/faturamentoFator.ts`; em tabela 12 a base é o fator do RC do `tipo_serv`, porque a linha
  traz o código do trabalho, ex.: 246480975 RC06 rural → pago × 1,44, contrato × 1,2). **Contrato rápido**: botão redondo na Conferência, painel lateral
  (`ContratoFlutuante`) com códigos, lista do COD e Tabela 14 — Matheus disse que ajusta depois.
- Testes de banco e de interface apagam as conferências da 9844 dentro da transação desfeita: Matheus
  já confere serviços de verdade (3 em 28/10), e elas tiram serviços dos lados e totais.
- A importação grava `acionamento`, `termino` e `area` em `neo_fat_anexos` (aba `Servico`).
  A 9844 foi preenchida por `scripts/faturamento-tempo-carregar.cjs`.
- Telas: janela do serviço mostra "COD (lista)" e a conta do homem-hora; Tabelas do contrato
  mostram a lista do COD e a Tabela 14 (só leitura, RPC `neo_fat_regras_despacho`).

9844 depois (041, sem contar conferências à mão): a menos 161 (8,4005 US · R$ 24.901,90), a mais 181, fora 26, conferem 21.542.
1.62: devido 9,9655 US contra 7,6662 pagos. Detalhes e transições no relatório
(`docs/faturamento-relatorio.md`, seção de 27/10/2026).

Verificado em 27/10/2026: `faturamento-homem-hora-testar` (novo), todos os
`scripts/faturamento-*testar.cjs` (números alterados pela regra anotados nos testes),
typecheck, build e interface com APIs simuladas (`NEO_TEST_URL=http://localhost:5173`;
capturas `janela-homem-hora` e `contrato-homem-hora` conferidas). Cálculo por linha ficou mais
rápido (contagem 1,2 s contra 1,9 s). Não verificado: login real.

Pendências:
- **Perguntar à supervisora Elen o que é `S` em `cod_tip_area`** (hoje rural; 9 serviços na 9844).

## Entrega: Glosados (código G.xx) — 29/10/2026 (Claude)

- **Decisão do Matheus:** serviço com código de glosa não é "pago a menos": a CEMIG glosou e não
  vai pagar. Vira a situação **GLOSADO** (migration 046), separada de Confere, Pagou a menos e Pagou
  a mais. Critério: algum código do serviço começa com `G.` (hoje só o G.02, "glosa de serviço":
  código errado ou reincidência). Glosa em linha **sem** código G (multa, 206 serviços na 9844)
  continua como antes: o serviço foi pago com desconto.
- A troca é feita em `neo_fat_servicos_lista` (coluna nova `glosado`; `situacao_calculo` = GLOSADO;
  motivo nulo). `neo_fat_servicos_calc` e o cálculo não mudam. Lado `glosados` em
  `neo_fat_servicos_filtrar`/`neo_fat_servicos_listar` (ordem: maior perda primeiro; `lados.glosados`).
  Totais ganham `glosados {servicos, us, devido, glosa}` e `funil.glosados`; `us` = o que o contrato
  pagaria (pago é zero), `glosa` = o que a CEMIG lançou. `neo_fat_impressao` passou para '046'.
- Tela: card laranja **Glosados** no Painel (token `--color-glosa`, separado do âmbar de "Fora do
  contrato"), linha Glosados no funil, atalho "Glosados" na Conferência, selo e fundo laranja na
  linha, aba "Glosados" na exportação para negociação, frase no detalhe e Documentação.
- Na 9844 (sem conferências à mão): 345 glosados, 6,6949 US pelo contrato, glosa lançada 7,2971 US;
  saem 331 de Confere e 14 de Pagou a menos (12 RC não pago, 2 outra diferença). A menos 155 → 141
  (6,5564 US); RC_NAO_PAGO 19 → 7.
- Testes: novo `faturamento-glosados-testar.cjs`. Ajustados: rodada2 (multados a menos 67 → 53,
  RC_NAO_PAGO 19 → 7, totais a menos 141), servicos (comparação cálculo × lista com a troca do
  GLOSADO; alvos "a menos" sem G.xx) e zero-fator (só reaplica a 041 se a versão for anterior; antes
  reaplicava sobre a 044). Todos os testes de banco passam com a 046 carregada; typecheck e build OK.
- **046 aplicada** no CENTRAL-NEO em 29/10/2026 (a pedido do Matheus). Totais da 9844 já na versão
  '046': glosados 345 (6,6949 US; glosa 7,2971), a menos 141 (6,5564 US), a mais 24, conferem 21.373,
  conferido 1, fora 26. Todos os testes de banco passam contra o banco real (o limite de 1,5 s da
  lista no servicos-testar estourou uma vez, 1,67 s; nas três rodadas seguintes 0,55–0,68 s).

- **Glosa parcial (047, Matheus, 29/10/2026):** com código G, a CEMIG pode glosar só uma parte.
  Glosa ≥ devido (cálculo OK) → GLOSADO; glosa < devido (cálculo A_MENOS) → fica em Pagou a menos,
  motivo `GLOSA_PARCIAL`. Para serviço com código G a diferença na lista é pago + glosa − devido (o que
  falta pagar). Ex.: 246310816 devido 0,004388, glosa 0,003657 → −0,000731 (R$ 2,17; antes mostrava
  −R$ 13,01). 246309215: glosa = devido 0,062101 → Glosados. Card Glosados passa a mostrar a glosa
  lançada (us = glosa) e "o contrato prevê". Sem código G a regra não vale: o crédito vem separado da
  multa (somar a multa deixaria 48 dos 53 "a menos" multados positivos). Na 9844 (sem conferências à
  mão): glosados 331 (glosa 5,9880; contrato 5,1074), a menos 155 (6,8350 US; 14 glosa parcial,
  −0,2785). Testes: glosados, rodada2, servicos e texto atualizados; todos passam com a 047 carregada.
  **047 aplicada** em 29/10/2026 (a pedido do Matheus); totais da 9844 na versão '047': glosados 331,
  a menos 155 (6,8350 US; glosa parcial 14), a mais 24, conferido 1. Testes de banco passam no banco real.
- **Possível fator errado só na coluna Motivo** (Matheus, 29/10/2026): saiu a etiqueta da coluna
  Situação da Conferência; o Motivo já mostra "Possível fator errado: <caso>". O filtro rápido e o
  aviso no detalhe do serviço continuam.

## Entrega: 5.62 dentro de RC, justificativa da glosa e busca por vários serviços — 29/10/2026 (Claude)

- **5.62 dentro de RC da Tabela 12 é informativo** (Matheus aprovou, migration 044): não conta como
  código remunerável na nota 3 e saiu de `neo_fat_rc_transposicao` (ativo = false). Só 5.62 → paga
  o RC; 5.62 + código da lista (8.81…8.8D, ex.: 8.82, 8.88) → paga esse código e a linha do 5.62
  vale zero; 5.62 + código fora da lista → RC. Fora de RC da Tabela 12, o 5.62 paga o próprio valor.
  Evidência na 9844: 158 de 158 RC só com 5.62 pagos pelo RC exato; 246105962 (RC06, 5.62 glosado e
  8.82 lançado pela CEMIG, justificativa "5.62 obrigatoriamente deve estar vinculado a geração de
  uma nota de serviço programada"). Resultado (sem conferências à mão): a mais 181 → 25,
  a menos 161 → 155, conferem 21.542 → 21.704. Ficam a mais 246059059 (RC07) e 246098036 (RC06),
  pagos como COD fora da lista. Passam a menos 245839322, 245879192, 245992861 (RC + 5.62 + G.02):
  a CEMIG glosou o RC pelo valor urbano CSC, como nos outros 9 RC com G.02 (RC_NAO_PAGO); antes
  conferiam por acaso. (Resolvido na 046: serviço com G.02 vai para Glosados.)
- **Justificativa da glosa** (044): sem evento no mesmo código, a linha com glosa mostra as
  justificativas do serviço na aba Evento_Glosa (Evento Glosa Apropriação da Fatura Completa),
  com o código na frente. Ex.: 245728835, glosa no 5.14 → "G.02: Reincidencia no serviço 244859969".
- **Filtro Nº serviço** (045 + tela): vários números separados por vírgula (também `;` ou espaço);
  cada parte vale como "contém"; o chip mostra "Nº serviço: …".
- **044 e 045 aplicadas** no CENTRAL-NEO em 29/10/2026 (`scripts/migrar.cjs`, a pedido do Matheus) e
  9844 recalculada: a mais 24, a menos 155 (8,1440 US), conferido 1, conferem 21.704, fora 26.
  Conferências à mão: 245826051 ("cemig pagou como 8.82 corretamente") agora confere pelo cálculo;
  ele e 245670551 ficaram com revisão desatualizada (o contexto mudou), ambos OK.
- Testes: novos `faturamento-562-testar.cjs` e `faturamento-busca-testar.cjs`; todos os
  `scripts/faturamento-*testar.cjs` de banco passam, com números da 044 anotados (conferência 704 → 548
  linhas divergentes; rodada2: 5.62 a mais 158 → 2, multados a menos 73 → 67, RC_NAO_PAGO 16 → 19,
  totais a menos 161 → 155; zero-fator: possível fator errado 74 → 76). Typecheck e build passaram.
  Não rodados: `faturamento-ui-testar` e `faturamento-menu-testar` (navegador).

## Ajuste: total pago no Início e no Painel — 26/10/2026 (Claude)

- **Início:** o card Faturamento mostra a fatura mais recente (`neo_fat_painel()[0]`, mesmo
  cache `painel` do Painel) com Pago pela CEMIG (`creditado`), pago a menos e pago a mais,
  em R$ sem centavos pelo valor da US (sem valor, fica em US). Leva ao Painel já na fatura.
- **Painel:** terceiro card principal **Pagou no total** à esquerda de "Pagou a menos"
  (crédito sem glosas, devido do contrato, multas fora do saldo, "Ver os N serviços" →
  atalho `todos`). Os três ficam em 3 colunas a partir de `lg`.
- Verificado: typecheck, build e capturas com APIs simuladas e dados reais da 9844
  (1440 px e 390 px). Não verificado: login real. Notado e não alterado: no celular, os
  números das barras do funil "Como ficou a conferência" ficam cortados.

## Última entrega: Faturamento rodada 2 — 26/10/2026 (Claude)

Desenho: `docs/superpowers/specs/2026-10-26-faturamento-rodada2-design.md` (modelos
aprovados no navegador, arquivos em `.superpowers/brainstorm/1866-1793030000/content/`).
Plano: `docs/superpowers/plans/2026-10-26-faturamento-rodada2.md` (11 tarefas, direto na
sessão). Commits `c0f6d21`..`c8f6e7c` na `main`; **push feito em 26/10/2026**.

O que mudou:
- **Painel** (antigo Resumo, rota `/faturamento/painel`; `/resumo` redireciona): dois
  cards (pagou a menos em vermelho, pagou a mais todo verde, "A CEMIG pagou X e o
  contrato prevê Y"), pílulas de fatura/período, chave **R$ | US**, funil até pagou a
  mais/a menos (sempre estreitando, "i" com explicação), gráfico com resumo no mouse,
  grupos e ajustes embaixo. Sem o botão "Resumo | Conferência".
- **R$:** um valor da US para todo o Faturamento, o mais recente de `neo_valor_us`
  (`neo_fat_valor_us()`, hoje R$ 2.964,33). Abre em R$; `?unidade=us` troca. Faturas
  antigas também convertem pelo valor atual (decisão do Matheus).
- **Conferência** em colunas com filtro estilo Excel (▾ por coluna, valores com
  contagem vindos do banco, faixas numéricas), atalhos (todos, a menos, a mais, fora,
  conferem, conferidos) e botões Contém 1.NS / Multado / 5.62 (contém → não → tanto faz).
  Filtros na URL. "Exportar para Excel" (filtrado) e "Exportar para negociação".
- **Janela do serviço:** nº do serviço, tipo, frota e tipo da frota em destaque; "como o
  devido foi calculado" (despacho, zona, tabela, conta por código; sem etiqueta Moto);
  tabela só com o pago e o 1.NS por último; avisos de 1.NS; bloco "1.NS · Pago pela
  Manutenção" só quando há valor (código e observação do contrato, sem observação da
  equipe); histórico de eventos.
- **Erros:** uma linha com o que fazer; ADMIN vê "Ver mais detalhes" (`src/lib/erros.ts`,
  `AvisoErro`). Não são gravados.
- **Menu:** seções recolhíveis (lembradas no navegador), rolagem redesenhada.
- **Documentação** em `/faturamento/documentacao/<página>`, uma por aba, layout dos guias
  do Mercado Livre; "Esta página foi útil?" grava em `neo_doc_avaliacoes`.
- Tabelas do contrato: Valor Moto antes de Fator Moto.

Banco: **035** (cálculo por serviço guardado em `neo_fat_servicos_calc`, recalculado só
quando a impressão muda; acabou o "statement timeout" da Conferência), **036** (indicadores
1.NS/5.62/multado/Manutenção na lista, filtros por coluna, `neo_fat_servicos_valores`,
totais por lado, `neo_fat_servico_manutencao`, `neo_fat_eventos` com gatilhos,
`neo_fat_servico_historico`, `neo_fat_valor_us`, `neo_doc_avaliacoes`), **037** (filtros
rápidos: a 036 deixou a lista em 6 s; voltou a 0,1–0,2 s). **038** (revisão final: soma da
diferença do cabeçalho segue os filtros). Revisão final por um revisor novo: 0 críticos;
os importantes foram corrigidos com teste (`a6ac102`); os menores adiados estão no fim do plano.

Cruzamento 1.NS: `neo_nsis.servico = numserv`. Na 9844, 204 serviços com 1.NS, 94 na
Manutenção, 63 com valor; os 2.155 itens da Manutenção ainda não têm `codigo`
(lançamentos antigos), então o bloco mostra "sem código". O valor da Manutenção não
entra em nenhum total.

Verificado em 26/10/2026: typecheck, build e todos os `scripts/faturamento-*testar.cjs`
(banco em transação desfeita; navegador com APIs simuladas, desktop e 390 px; carga com
10 chamadas simultâneas abaixo de 8 s). Não verificado: login real.

Pendências: Matheus mostrar a quem usa o modelo "Conferência como sistema"
(`docs/modelos/conferencia-sistema.html`) antes de decidir; conferir o deploy; código 1.62
(61 serviços) sem fator no contrato (resolvido em 27/10/2026, homem-hora); envio para a gestora adiado pelo Matheus.

## Entrega anterior: redesenho do Faturamento por serviço — 26/10/2026 (Claude)

Desenho aprovado: `docs/superpowers/specs/2026-10-26-faturamento-ux-design.md`.
Plano: `docs/superpowers/plans/2026-10-26-faturamento-ux.md` (12 tarefas, feitas
direto na sessão). Commits `7700296`..último `docs(faturamento)` na `main`,
**sem push** até Matheus conferir no navegador. Números e regras em
`docs/faturamento-relatorio.md`, seção "Conferência por serviço".

Decisões em vigor:
- A Conferência é **por serviço** (21.910 na 9844), na view `neo_fat_servicos`.
  Compara o **crédito** (sem glosas) com o devido do serviço. RC paga uma vez por
  atendimento (crédito pode vir dividido entre as linhas, como no 245530193).
  O candidato CSC/COD/Moto é escolhido uma vez por serviço.
- Multas (glosa negativa) e estorno ficam **fora** do saldo. Serviço glosado por
  inteiro (crédito + multa = devido) **confere** (migration 029).
- Serviço parcial compara só o crédito das linhas com fator (`pago_comparado`).
- Serviço conferido sai do saldo e da exportação; revisão por serviço em
  `neo_fat_conferencias_servico`. Revisões antigas por linha foram migradas como
  desatualizadas (texto guardado, pedem nova conferência).
- Totais por fatura em `neo_fat_totais`, com a "impressão" das entradas (034):
  reimportação, revisões, vínculos, contrato, configuração ou transposição diferentes
  = desatualizado. O app chama `neo_fat_faturas_desatualizadas()` e recalcula fatura
  a fatura (`neo_fat_atualizar_totais`) antes do painel, para caber no tempo limite.
  Conferir recalcula na hora. A Conferência trabalha uma fatura por vez (sem "todas").
- Rotas: `/faturamento` = lista de faturas; `/faturamento/resumo`,
  `/faturamento/conferencia`, `/faturamento/documentacao` (fora da sidebar).
  Links antigos `/faturamento?fatura=` vão para a Conferência.
- Reimportação: hash SHA-256 dos dois arquivos; idênticos = "Nada mudou";
  diferente = janela antes/depois e confirmação digitando o número da fatura.
- Migrations **028–034** aplicadas no CENTRAL-NEO (028 serviço, 029 multa explica,
  030 RPCs de lista, 031 totais, 032 RC como código principal, 033 hashes,
  034 correções da revisão final: impressão dos totais, filtro por código principal,
  ajuste mal formatado não derruba os totais).
- Importação bloqueada se a lista de faturas não carregar; antes de gravar, confere de
  novo no servidor e `importarFat` recusa substituir sem confirmação. Duplicidade
  compara o conteúdo sem o id técnico `idapropriacaotemposervico`. Cache limitado a
  20 chaves `neo-fat:*`.
- Nenhum `<input type="date">` no Faturamento; cabeçalho-filtro e janela modal
  são o padrão das abas. Cache dos últimos dados em `localStorage` (`neo-fat:*`).

Verificado em 26/10/2026: typecheck, build e os scripts `faturamento-planilhas`,
`-texto`, `-servicos`, `-conferencia`, `faturamento-testar`, `-duas-planilhas` e
`-ui` (Chrome com APIs simuladas, desktop e 390 px; capturas inspecionadas).
Não verificado: uso com o login real.

Pendências: Matheus conferir os exemplos no navegador; 5.62 responde por 158 dos
172 serviços "pagos a mais" (exceção aberta); motivo `MOTO_INDEVIDO` não apareceu
na 9844; 54 serviços de RC com multa e estorno ficam como "fator menor" e pedem
análise manual. Regras abertas do relatório continuam sem mudança.

Preferência de Matheus: planos e documentos só em `.md`, sem abrir no navegador
(gasta tokens). O navegador fica só para mockups, quando pedidos.

## Entrega anterior: Faturamento (23/10/2026)

Histórico. As rotas e a Conferência por linha abaixo foram substituídas pelo
redesenho de 26/10/2026 (seção anterior); as views por linha continuam no banco.

**Revisão da entrega inicial em 23/10/2026:** Matheus reprovou o resultado por não atender ao pedido.
Não tratar os quatro commits como escopo aprovado ou integralmente concluído.
A auditoria `docs/faturamento-checklist-auditoria.md` confronta requisitos e código:
faltam aderência visual, apresentação do fator numérico e validação mais forte dos
PDFs/casos reais; há hipóteses extras nas glosas, limitações no RC multilinha e
ausência de teste completo no navegador. O terceiro commit também referenciava a
tela Resumo antes de seu arquivo entrar no quarto. Pedido atual: checklist; a
auditoria não corrige o código nem redefine as regras de negócio.

- Quatro partes enviadas ao GitHub: `08b22c0`, `c7d3c33`, `217804a`, `cf2b28a`.
- Rotas: `/faturamento`, `/faturamento/importar`, `/faturamento/tabelas`,
  `/faturamento/resumo`. Migrations 013–018 testadas e aplicadas no CENTRAL-NEO.
- Fatura 9844 importada com 27.389 linhas. Valores e classificação são uma fotografia
  da entrega; recalcular após alterações de fatores, vínculos ou dados da fatura.
- Relatório: `docs/faturamento-relatorio.md`. Evidências:
  `docs/faturamento-validacao-contrato.json` e `docs/faturamento-9844-resultados.json`.
- Suposições autorizadas: comparar CSC/COD; guardar L/N/O sem cálculo; moto 0,7 urbano
  e 0,9 rural; moto provável sem vínculo; revisar RC multilinha quando soma coincide;
  glosa positiva como estorno; guardar NOTA sem inferir regra; fator não validado fica nulo.
- CSC é a referência provisória quando nenhum fator coincide. O devido é parcial,
  excluindo linhas sem fator. Configuração de multiplicadores: `neo_fat_config`.
- Na entrega inicial faltavam a planilha serviço → veículo/turma, confirmação das regras e revisão dos
  fatores pendentes. A lista completa está no relatório; não inventar esses valores.
- Mudança nos dados da linha reabre revisão manual; mudança apenas no contrato ainda
  não invalida automaticamente a conferência já registrada. Histórico manual guarda
  a última observação por linha; histórico de contrato guarda todos os acertos.
- Verificados: typecheck, build e `node scripts/faturamento-testar.cjs` (rollback,
  cálculo, classificação, preservação de revisão, RLS e resumo). Resumo em cerca de
  1,6 segundo na conexão usada. Há aviso de bundle acima de 500 kB.
- Ainda não verificados: aparência no navegador.
- `.tmp-faturamento/` contém extrações locais não commitadas; exclusão foi bloqueada
  pela revisão automática. `ns_preventiva_c_fonte.jsp` é arquivo do usuário, fora da entrega.

## Revisão de Faturamento — duas planilhas e PDF, 23/10/2026

**Correção posterior do HTTP 500:** a consulta direta autenticada à view
`neo_fat_conferencia` estourava o tempo limite porque as políticas de acesso eram
reavaliadas nas subconsultas de cada linha. Migrations 021/022 aplicadas: a RPC
`neo_fat_listar` pagina e filtra após conferir o módulo; as views passaram a
consultar como dono com checagem explícita do módulo, mantendo a versão publicada
funcional. Consulta antiga: 50 linhas e contagem 27.389 em ~2,2 s; novo caminho:
~2–3 s para página filtrada. Teste sem módulo retornou zero linhas na view e
acesso negado na RPC. Frontend atualizado para usar a RPC; typecheck/build e
teste no navegador passaram. Não é preciso rodar migration manualmente.

- A importação exige Fatura Resumida e Fatura Completa. Cruzamento: US_Servico.numserv → Serviço.numserv → Serviço.veiculo → US_Turma.numvei. Serviço.ident_turma desempata veículos usados por tipos de equipe diferentes no período e exige correspondência da frota. Não é preciso mover abas manualmente.
- Os 21.910 serviços da 9844 foram identificados: 10.311 Moto, 9.657 Multifuncional, 1.872 Umpla, 70 Quarteto. Dados/vínculos publicados juntos; mudança de equipe/fatores reabre revisão manual anterior com contexto registrado.
- O 1.13 estava vazio porque a extração anterior exigia crédito coincidente na fatura, apesar do fator publicado no PDF. Extração por célula, página e texto validou 215/219 pares; migration 020 complementou 99 fatores com histórico. 1.13: CSC 0,137718 / COD 0,165261. 1.62, 1.73, 5.63 e 5.64 seguem pendentes da NOTA 10.
- Nova fotografia 9844: 27.389 linhas; 13.101 OK, 13.580 DIVERGENTE, 0 MOTO_PROVAVEL, 652 CODIGO_FORA_CONTRATO, 56 REVISAR_RC_MULTILINHA. Devido parcial 1.030,403921 US, crédito 917,112183, débito 21,226389. Em 10.224 linhas de Moto, o pago coincide com fator normal e diverge de 0,7/0,9; a regra provisória permanece, precisa de revisão do Matheus.
- Migrations 019/020 passaram em --testar e foram aplicadas. Parser com arquivos reais, integração com rollback, typecheck/build e Chrome desktop/celular passaram. Navegador usou APIs interceptadas; a importação real foi feita separadamente. Deploy não verificado. Relatório atualizado em docs/faturamento-relatorio.md e auditoria em docs/faturamento-checklist-auditoria.md.
- A importação tomou como referência o fluxo de prévia/validação do TraceOne. Design confirmado no código da NEO: Manrope e JetBrains Mono, petróleo #0B7285, cobre #D9822B. Preservar modificações da outra conversa no mesmo checkout.

## Revisão integral dos dois PDFs — 23/10/2026

- Foram lidas as 14 páginas da Tabela 11 e as 2 da Tabela 12, inclusive notas ao final. As notas 8 terminam cortadas nos PDFs fornecidos; a NOTA 10 referida nos códigos 1.62, 1.73, 5.63 e 5.64 não aparece. Não inferir seus fatores.
- Migrations 023–027 testadas com `--testar` e aplicadas. Tabela 11: rural e Moto seguem as colunas por código; 5.70, 6.01, 6.05 têm Moto 1. Tabela 12: notas 2–3 transpõem RC para código de fechamento quando é o único remunerável (lista configurável em `neo_fat_rc_transposicao`); RC remanescente é pago uma vez por atendimento. O devido do RC com várias linhas é alocado à primeira linha por `id` somente para totalização. UI sinaliza transposição apenas para RCs publicados na Tabela 12 e explica a regra. A revisão manual agora inclui devido/situação no contexto; registros antigos são reabertos para nova validação. Nenhuma migration manual pendente.
- Fatura 9844 após a revisão: 27.389 linhas; **24.785 OK, 642 DIVERGENTE, 1.310 REVISAR_RC_MULTILINHA, 652 CODIGO_FORA_CONTRATO, 0 MOTO_PROVAVEL**. Crédito 917,112183 US, débito 21,226389, estorno 7,446161, devido parcial **857,921936 US**. São 1.813 serviços/1.820 linhas transpostos. Os números anteriores nesta memória são fotografias históricas, não o estado atual.
- Notas PSAP exigem relação apoio → principal e fator 0,3; as duas planilhas não dão vínculo confiável. Notas de documentação e unidade de lançamento não podem ser verificadas só com fatura. O rural de Moto 0,9 continua decisão expressa e provisória de Matheus, embora Tabela 12 notas 4–5 combinadas sugiram 0,84; registrar a dúvida. Alguns pagamentos do código 5.62 seguem o RC apesar da transposição literal, a revisar com Matheus. Relatório detalhado em `docs/faturamento-relatorio.md`.
- Verificados: integração de cálculo/importação com rollback, conferência paginada/permissões, typecheck, build e Chrome desktop/celular com APIs simuladas; captura da Conferência inspecionada. Sem deploy verificado.

## Origem da memória

Consolidada a partir da conversa com Matheus, do código e documentação do projeto,
e dos arquivos locais do Claude `central-neo-escopo-mvp.md`,
`commit-mensagem-padrao.md` e `lembrete-contrato-2026-gdis.md`.
Referências antigas sobre todo o app rodar no TraceOne e importar somente NSIS
foram superadas: CENTRAL-NEO é o principal e a migration 008 ampliou os tipos de serviço.

## Mapeamento entre projetos — 23/10/2026

Esta memória anterior foi preservada no levantamento geral de APPWEB.
Perfil de trabalho consolidado em
[memória geral](../MEMORIA_COMPARTILHADA.md), com preferências explícitas,
inferências separadas e relações entre produtos. Referências de funcionalidades
em [catálogo APPWEB](../CATALOGO_FUNCIONALIDADES.md).

- Design real: `src/index.css`, petróleo `#0B7285`, cobre `#D9822B`,
  fundo `#F4F7F8`, Archivo e Atkinson Hyperlegible Mono.
  `src/components/Shell.tsx`, `NeoLogo.tsx` e `CircuitoAnimado.tsx`
  são referências locais de identidade e navegação.
- Para reaproveitar Fechamento: `src/paginas/fechamento/Fila.tsx`,
  `PainelNsis.tsx`, `Painel.tsx`, `TabelaValores.tsx`,
  `src/lib/fechamentoPlanilhas.ts`, `fechamento.ts` e `contrato.ts`.
  Fluxo de serviço com vários itens e etapas NSMP → NSPR → fatura.
- Importadores puros: `fechamentoPlanilhas.ts` para relatório/histórico e
  `faturamentoPlanilhas.ts` para abas da fatura/vínculos.
- Telas TraceOne em `src/paginas/traceone/` são cópias adaptadas. Manter
  limites entre clientes, bancos, sessões e permissões ao portar atualizações.
- O contexto geral lista Faturamento como implementado; isso não supera a
  reprovação e as lacunas da auditoria registradas acima. Não apresentar a
  existência de rotas/commits como aceitação da entrega.

Levantamento estático de contexto, código, tokens, documentos e memórias do
Claude, sem novos testes de cálculo, navegação, banco ou deploy. Nenhuma regra
de negócio nem o estado anterior de Faturamento foi alterado nesta tarefa.

## Vídeo de apresentação — produzido, 26/10/2026 (Codex)

- Pedido de Matheus: motion design para TV, até 2 minutos, explicativo, ritmo com
  tempo de leitura, narração e textos de apoio. Público: diretoria e gestores;
  objetivo: mostrar o que foi desenvolvido na Central NEO, principalmente Faturamento
  (comparação de faturas). Tom institucional e elegante. Dados reais autorizados como
  exemplos. Ainda sem data de reunião; texto-base escolhido conforme a direção vigente abaixo.
- Referências em `Importação/`: `Download.mp4` (48,85 s, 576×1024) e vídeo iniciado
  por `From Klickpin.com-` (28,18 s, 720×540). Matheus quer a apresentação do sistema
  do Klickpin e o dinamismo, cores e narrativa do Download.
- Verificação: metadados via ffprobe; sequência visual completa amostrada a cada 2 s
  e trechos com intervalos de 0,5 s. Klickpin: interface clara, entrada inclinada,
  indicadores animados, aproximações, navegação e modais. Download: branco/vermelho,
  frases curtas animadas, ícones, formas e demonstrações em dispositivos; narrativa
  visual de necessidade → facilidade → funcionalidades → marca. Áudio não transcrito.
  Imagens de análise geradas só na pasta temporária do sistema.
- Direção confirmada por Matheus: identidade visual da Central NEO; abertura
  persuasiva em forma de pergunta; telas completas combinadas com elementos
  destacados. O conteúdo apresenta a manutenção da UEN 211 de forma abrangente,
  incluindo serviços, faturamento e pagamentos; TraceOne/Medidores ficam fora.
  Voz masculina, natural e próxima, mantendo a elegância.
- Mensagem confirmada: valorizar a facilidade de analisar as planilhas a partir
  da importação dos dois arquivos, entender o pagamento da CEMIG e identificar
  se corresponde ao contrato. Mostrar também escala, explicação e apoio à negociação.
- Matheus acrescentou dois benefícios: facilitar o uso dos dados para negociar com
  a CEMIG e aumentar o faturamento; destacar trabalho manual de horas/dias no Excel
  frente a análises em segundos na NEO. A comparação de tempo veio do briefing,
  sem medição nesta etapa. X vermelho no Excel foi sugestão, com liberdade criativa.
- Direção vigente, substituindo as alternativas de abertura: Matheus escolheu
  explicitamente o **primeiro roteiro**, que ele reenviou, começando por “Horas,
  às vezes dias, conferindo planilhas”, com as mesmas pausas e sequência, pedindo
  generalização para **manutenção da UEN 211**. Guia de voz e roteiro visual
  atualizados (versão 6, na duração da voz entregue). Introdução da marca: “A Central NEO reúne ferramentas
  para acompanhar a manutenção da UEN duzentos e onze, trazendo mais clareza ao
  controle dos serviços, do faturamento e dos pagamentos.” As propostas “Sabemos
  o que executamos...” e “Milhares de serviços. Cada valor importa...” não são a
  escolha final. Negociação fundamentada e oportunidades de aumento do faturamento
  continuam nas cenas finais; Excel continua como entrada dos dados.
- Entrega em `entregas/central-neo/Central-NEO-UEN-211.mp4`: **88,63 s**, Full HD
  1920×1080, 30 fps, H.264 High nível 4.1, YUV420P faixa TV/BT.709, áudio AAC
  estéreo 48 kHz. Capa JPG e legendas SRT opcionais na mesma pasta. Binários ficam
  locais, ignorados pelo Git. Roteiro visual em `docs/video-central-neo-roteiro.md`.
- Matheus enviou a voz Hale/ElevenLabs v4, autorizou usar os 1min28s e executar
  toda a produção autonomamente, inclusive capturar telas/consultar o código.
  Confirmou assinatura apenas Central NEO e UEN 211, entendida como o setor.
- Montagem em 15 planos/7 partes narrativas, com identidade NEO, aproximações das
  telas, textos/cards ampliados e trilha instrumental original criada localmente.
  Fonte Manrope e JetBrains Mono; símbolo baseado no componente NeoLogo real.
  Voz original mantida, com ajuste de nível e sem alteração de velocidade.
- Capturas do app atual no Chrome headless. Respostas locais alimentadas por
  consultas ao CENTRAL-NEO em transação **somente leitura**, sem importação ou revisão
  gravada no banco. Fatura 9844; serviço 246445398/código 1.21 (contrato validado),
  pago R$ 0 e previsto R$ 974,70. Totais a menos R$ 22.076,19/106 serviços e a mais
  R$ 50.398,90/172 serviços. Valores apresentados como saldos para análise, não
  receita recuperada. TraceOne e créditos pessoais não aparecem.
- Código de produção em `video/central-neo/`; capturas, fontes, transcrição local
  e dados brutos em `.tmp-faturamento/video-central-neo/`. Faster-whisper/base usado
  localmente para alinhar a voz; áudio não enviado a serviço externo.
- Verificado: decodificação completa do MP4 sem erros; codecs, cores, duração e
  resolução com FFprobe; 15 prévias e 12 quadros do arquivo final inspecionados;
  loudness da mixagem -16 LUFS, pico verdadeiro -4,2 dBFS; sintaxe Node/Python e
  diff sem problemas de espaço. Não testado fisicamente na TV da reunião.
- Pendente: Matheus assistir ao vídeo e indicar eventuais ajustes criativos.
  Nenhuma mudança no aplicativo ou no banco foi feita para produzir o vídeo.
- Narração: Matheus pediu instruções práticas e pausas, além do texto bruto, e
  enviou `https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech`.
  Página e guia oficial de prompting consultados. Guia pronto em
  `docs/video-central-neo-elevenlabs.md`, com configurações iniciais, texto completo
  com audio tags para Eleven v4/v3, teste de pronúncia, orientação de download e
  relação entre trechos e cenas. Áudio final recebido no v4. SSML de pausas não
  funciona no v4/v3; não misturar sintaxes. A montagem já usa os tempos do áudio real.
