# Fila de fechamento: aviso de NSMP, NSPR e NSMC repetidas — design

Data: 25/11/2026. Pedido do Matheus; opção A escolhida por ele.

## Intenção

Cada serviço é único, e cada NSMP, NSPR e NSMC também pertence a um só serviço.
Um número repetido em outro serviço costuma ser erro de digitação ou de cópia e
precisa ficar visível na fila e ser avisado na hora de lançar.

## Regras

- **Nº de serviço:** continua bloqueado pelo banco (chave de `neo_nsis`). Nada muda.
- **NSMP, NSPR, NSMC:** um número usado em **outro** serviço é duplicidade.
  - Mesmo tipo com mesmo tipo: NSMP (serviço não NSRI, coluna `nsmp`), NSPR
    (serviço não NSRI, coluna `nspr`), NSMC (serviço NSRI, coluna `nsmp`; a coluna
    `nspr` da NSRI repete a NSMC e não é comparada).
  - Itens do mesmo serviço com o mesmo número não contam (é o normal).
- **Na fila:** a linha com algum número repetido fica amarela; o título da linha e
  uma marca na célula dizem qual número e em que serviço(s) ele também está.
- **Ao gravar:** se o número já está em outro serviço, aparece
  `confirm("A NSPR 123 já está no serviço 2451… . Lançar mesmo assim?")`.
  Cancelar não grava; OK grava normalmente.

## Abordagens consideradas

- **A (escolhida): conferência na tela.** Uma consulta a `neo_nsis_itens`
  (com `neo_nsis!inner(tipo_serv)`) pelos números da página aberta; a mesma
  consulta antes de gravar. Sem migration; os índices de `nsmp` e `nspr` já
  existem (migration 002).
- B: marca de duplicidade na view `neo_vw_nsis` + filtro "Duplicadas". Descartada
  por ora: exige migration e pesa em toda consulta da lista.

## Onde o aviso entra

- Fluxo novo (`JanelaFluxo.tsx`): etapa 1 (NSMP/NSMC) e etapa NSPR, ao lançar e ao corrigir.
- Histórico (`PainelNsis.tsx`): NSMP rápida do cartão, confirmação da NSPR e edição do item.

## Não faz

- Não impede gravar; não limpa duplicidades antigas; não filtra só duplicadas
  (só a página aberta é conferida).

## Decisões do Claude

- Aviso por `confirm` nativo, como o Desfazer e o Excluir.
- Comparação exata após `trim()`.
- Falha da consulta de duplicidade na lista não impede a lista de aparecer (só
  some o amarelo). Falha antes de gravar mostra o erro e não grava.
