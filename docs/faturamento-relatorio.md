# Faturamento — relatório para Matheus

## Entregue

- /faturamento: conferência paginada, filtros na URL por fatura, situação, tabela, tipo, código, cidade e serviço; detalhe, justificativa da glosa, observação, usuário/data e exportação das divergências em Excel.
- /faturamento/importar: leitura das cinco abas US_Servico, US_Turma, Evento_Glosa, Glosa e Debito_Credito; lotes de 1.000 linhas; publicação atômica da fatura. Importação de vínculos numserv → numvei/ident_turma preparada.
- /faturamento/tabelas: consulta das tabelas 11/12; valores publicados preservados; acerto/ativação com motivo e histórico para ADMIN.
- /faturamento/resumo: cards, comparação entre faturas com escala comum, barras com valores no hover, agrupamentos por tipo/código/cidade e ajustes. Filtro de período usa sobreposição do período da fatura.
- Módulo de acesso faturamento, navegação lateral e cartão inicial.
- Migrations 013 a 018 testadas com node scripts/migrar.cjs --testar antes de aplicar no CENTRAL-NEO. Nenhum objeto do Fechamento ou TraceOne alterado.

## Como testar

1. Entrar como ADMIN NEO ou liberar o módulo Faturamento em Logins e acessos.
2. Abrir /faturamento?fatura=9844. A fatura já foi importada, com 27.389 linhas.
3. Buscar 246220152: RC79 usa Tabela 11, código 7.28, 9 urbanos, 0,056511 US; situação OK.
4. Filtrar MOTO_PROVAVEL e REVISAR_RC_MULTILINHA; abrir a linha para consultar os quatro valores candidatos e a soma do serviço.
5. Marcar uma linha como conferida com observação. Reimportar o arquivo completo: a conferência permanece; se os dados originais mudarem, ela fica desatualizada e volta à situação calculada.
6. Consultar tabelas e histórico. Alterar um fator com motivo como ADMIN atualiza os cálculos consultados. Uma revisão manual já registrada deve ser reavaliada por quem fez o acerto: mudanças apenas no contrato ainda não invalidam automaticamente a revisão.
7. Executar npm.cmd run typecheck e npm.cmd run build. Executar node scripts/faturamento-testar.cjs para testes de integração com rollback.

## Decisões provisórias

| Regra | Onde trocar | Efeito na 9844 |
|---|---|---|
| Comparar CSC/CSI e COD; prioridade CSC quando ambos coincidem | neo_fat_calculo, candidatos; neo_fat_contrato.fator_csc/fator_cod | 23192 linhas OK; fator aplicado exposto na conferência |
| Devido de referência sem coincidência usa CSC; total é parcial | neo_fat_calculo.devido_referencia | 1.050,866807 US devidos; alternativas CSC 1.034,871004 / COD 1.241,842993 |
| L/N/O guardadas sem cálculo; observação quando não coincide | neo_fat_calculo.observacoes; dados da neo_fat_linhas | qtdhh aparece em 61 linhas na fonte; não é convertido em US |
| Ausência de vínculo: comparar também moto | neo_fat_base.tipo_turma e neo_fat_calculo | 121 linhas MOTO_PROVAVEL; sem vínculo a identificação permanece pendente |
| Moto urbano 0,7 e rural 0,9 substituem 1 e 1,2 | neo_fat_config.moto_urbano/moto_rural/rural | Calculados os dois fatores de moto em todas as linhas com contrato |
| RC com várias linhas: somar devidos por linha e comparar com líquido do serviço | neo_fat_calculo, grupos e situacao_calculo | 56 linhas REVISAR_RC_MULTILINHA; não há deduplicação automática por atendimento |
| Glosa positiva = estorno; validar magnitude contra o devido, além do crédito | neo_fat_calculo.candidatos e observacoes | 7,446161 US de estornos; destaque na tela |
| Glosa negativa: débito positivo no resumo; líquido = crédito + glosa assinada | neo_fat_resumo e neo_fat_calculo | Débito 21,226389 US; glosa líquida −13,780228 US |
| Crédito zero com débito integral pode coincidir; glosa não zero deve coincidir em magnitude com o mesmo fator | neo_fat_calculo.candidatos | Débitos parciais seguem para revisão; decisão explícita a confirmar |
| NOTA armazenada, sem regra adicional | neo_fat_contrato.nota; neo_fat_calculo.observacoes | Códigos somente com NOTA 10 sem fator numérico ficam pendentes; o PDF não contém o texto dessa nota |
| Somente fatores com ordem/valores conferidos e pelo menos um crédito reproduzido são ativados | scripts/faturamento-extrair.cjs; neo_fat_contrato.validado | 116 códigos validados; 657 linhas sem fator |
| Tolerância de 0,000001, arredondamento a seis casas | neo_fat_config.tolerancia; neo_fat_base | Todos os cálculos em numeric no PostgreSQL |

## Números da fatura 9844

Valores da aba US_Servico, em US:

| Medida | Valor |
|---|---:|
| Total creditado | 917,112183 |
| Total debitado (glosas negativas, módulo) | 21,226389 |
| Estornos (glosas positivas) | 7,446161 |
| Líquido dos serviços | 903,331955 |
| Devido parcial de referência | 1.050,866807 |
| Linhas excluídas do devido por falta de fator | 657 |

| Situação calculada | Linhas |
|---|---:|
| CODIGO_FORA_CONTRATO | 657 |
| DIVERGENTE | 3363 |
| MOTO_PROVAVEL | 121 |
| OK | 23192 |
| REVISAR_RC_MULTILINHA | 56 |

Ajustes separados, aba Debito_Credito: débito 64,963712 US; crédito 95,344853 US. Não somar os valores repetidos das abas Cidades/US_Turma aos serviços. Não foram classificadas as abas Acima_Prazo e Sobreaviso: o escopo de importação solicitado enumera as cinco abas acima.

## Fatores a carregar manualmente

O catálogo contém os códigos/RCs extraídos mesmo quando não validados, com fatores nulos. Isso preserva a precedência da Tabela 12. Não foram inferidos fatores ausentes. A validação detalhada, candidatos e quantidade de amostras ficam em faturamento-validacao-contrato.json.

| Tabela | Código/RC | Motivo | Linhas na amostra aplicável |
|---|---|---|---:|
| 12 | RC39 | Sem amostra na fatura | 0 |
| 12 | RC40 | Nenhum crédito reproduzido | 5 |
| 12 | RC42 | Sem amostra na fatura | 0 |
| 12 | RC73 | Sem amostra na fatura | 0 |
| 12 | RC74 | Sem amostra na fatura | 0 |
| 12 | RC99 | Sem amostra na fatura | 0 |
| 11 | 1.13 | Sem amostra na fatura | 0 |
| 11 | 1.14 | Sem amostra na fatura | 0 |
| 11 | 1.22 | Sem amostra na fatura | 0 |
| 11 | 1.25 | Sem amostra na fatura | 0 |
| 11 | 1.28 | Sem amostra na fatura | 0 |
| 11 | 1.62 | Fatores não numéricos ou extração ambígua | 61 |
| 11 | 1.64 | Sem amostra na fatura | 0 |
| 11 | 1.73 | Fatores não numéricos ou extração ambígua | 0 |
| 11 | 2.01 | Sem amostra na fatura | 0 |
| 11 | 3.01 | Sem amostra na fatura | 0 |
| 11 | 3.06 | Sem amostra na fatura | 0 |
| 11 | 4.05 | Sem amostra na fatura | 0 |
| 11 | 4.06 | Sem amostra na fatura | 0 |
| 11 | 5.01 | Sem amostra na fatura | 0 |
| 11 | 5.11 | Sem amostra na fatura | 0 |
| 11 | 5.12 | Sem amostra na fatura | 0 |
| 11 | 5.13 | Sem amostra na fatura | 0 |
| 11 | 5.22 | Sem amostra na fatura | 0 |
| 11 | 5.31 | Sem amostra na fatura | 0 |
| 11 | 5.32 | Sem amostra na fatura | 0 |
| 11 | 5.33 | Sem amostra na fatura | 0 |
| 11 | 5.40 | Sem amostra na fatura | 0 |
| 11 | 5.41 | Sem amostra na fatura | 0 |
| 11 | 5.42 | Sem amostra na fatura | 0 |
| 11 | 5.44 | Sem amostra na fatura | 0 |
| 11 | 5.45 | Sem amostra na fatura | 0 |
| 11 | 5.63 | Fatores não numéricos ou extração ambígua | 2 |
| 11 | 5.64 | Fatores não numéricos ou extração ambígua | 0 |
| 11 | 6.02 | Sem amostra na fatura | 0 |
| 11 | 6.03 | Sem amostra na fatura | 0 |
| 11 | 6.04 | Sem amostra na fatura | 0 |
| 11 | 6.06 | Sem amostra na fatura | 0 |
| 11 | 6.08 | Sem amostra na fatura | 0 |
| 11 | 6.25 | Sem amostra na fatura | 0 |
| 11 | 6.31 | Sem amostra na fatura | 0 |
| 11 | 6.32 | Sem amostra na fatura | 0 |
| 11 | 6.34 | Sem amostra na fatura | 0 |
| 11 | 6.39 | Sem amostra na fatura | 0 |
| 11 | 6.42 | Sem amostra na fatura | 0 |
| 11 | 6.44 | Sem amostra na fatura | 0 |
| 11 | 6.46 | Sem amostra na fatura | 0 |
| 11 | 6.52 | Sem amostra na fatura | 0 |
| 11 | 6.53 | Sem amostra na fatura | 0 |
| 11 | 6.82 | Sem amostra na fatura | 0 |
| 11 | 6.83 | Sem amostra na fatura | 0 |
| 11 | 6.84 | Sem amostra na fatura | 0 |
| 11 | 7.04 | Sem amostra na fatura | 0 |
| 11 | 7.27 | Sem amostra na fatura | 0 |
| 11 | 7.42 | Sem amostra na fatura | 0 |
| 11 | 7.46 | Sem amostra na fatura | 0 |
| 11 | 7.49 | Sem amostra na fatura | 0 |
| 11 | 7.66 | Sem amostra na fatura | 0 |
| 11 | 7.72 | Sem amostra na fatura | 0 |
| 11 | 7.78 | Sem amostra na fatura | 0 |
| 11 | 7.79 | Sem amostra na fatura | 0 |
| 11 | 7.83 | Sem amostra na fatura | 0 |
| 11 | 7.87 | Sem amostra na fatura | 0 |
| 11 | 7.88 | Sem amostra na fatura | 0 |
| 11 | 7.90 | Sem amostra na fatura | 0 |
| 11 | 7.91 | Sem amostra na fatura | 0 |
| 11 | 7.P1 | Sem amostra na fatura | 0 |
| 11 | 7.P3 | Sem amostra na fatura | 0 |
| 11 | 7.P5 | Sem amostra na fatura | 0 |
| 11 | 7.P6 | Sem amostra na fatura | 0 |
| 11 | 7.P7 | Sem amostra na fatura | 0 |
| 11 | 7.P8 | Sem amostra na fatura | 0 |
| 11 | 7.P9 | Sem amostra na fatura | 0 |
| 11 | 7.S3 | Sem amostra na fatura | 0 |
| 11 | 7.S6 | Sem amostra na fatura | 0 |
| 11 | 7.S7 | Sem amostra na fatura | 0 |
| 11 | 7.S8 | Sem amostra na fatura | 0 |
| 11 | 7.S9 | Sem amostra na fatura | 0 |
| 11 | 8.79 | Sem amostra na fatura | 0 |
| 11 | 8.81 | Sem amostra na fatura | 0 |
| 11 | 8.83 | Sem amostra na fatura | 0 |
| 11 | 8.84 | Sem amostra na fatura | 0 |
| 11 | 8.93 | Sem amostra na fatura | 0 |
| 11 | 8.A1 | Sem amostra na fatura | 0 |
| 11 | 8.A2 | Sem amostra na fatura | 0 |
| 11 | 8.A3 | Sem amostra na fatura | 0 |
| 11 | 8.A4 | Sem amostra na fatura | 0 |
| 11 | 8.A5 | Sem amostra na fatura | 0 |
| 11 | 9.01 | Sem amostra na fatura | 0 |
| 11 | 9.02 | Sem amostra na fatura | 0 |
| 11 | 9.03 | Sem amostra na fatura | 0 |
| 11 | 9.04 | Sem amostra na fatura | 0 |
| 11 | 9.05 | Sem amostra na fatura | 0 |
| 11 | 9.08 | Sem amostra na fatura | 0 |
| 11 | 9.09 | Sem amostra na fatura | 0 |
| 11 | 9.11 | Sem amostra na fatura | 0 |
| 11 | 9.12 | Sem amostra na fatura | 0 |
| 11 | 9.82 | Sem amostra na fatura | 0 |
| 11 | LC02 | Sem amostra na fatura | 0 |
| 11 | LC03 | Sem amostra na fatura | 0 |
| 11 | LC04 | Sem amostra na fatura | 0 |
| 11 | T.10 | Sem amostra na fatura | 0 |
| 11 | V.39 | Sem amostra na fatura | 0 |

## Perguntas para revisão

1. Qual campo determina CSC/CSI ou COD? A coincidência numérica é provisória.
2. O que significam L/N/O e como remunerar homem-hora?
3. Enviar a ligação serviço → veículo/turma; como tratar serviço com mais de uma equipe?
4. Confirmar moto rural 0,9 e exceções dos fatores moto/rural publicados por código.
5. RC é pago uma vez por atendimento ou por linha? Como distribuir o valor no exemplo 245881140?
6. Confirmar estornos positivos e a regra para glosas parciais, crédito zero e valores simultâneos.
7. Disponibilizar o texto da NOTA 10 e confirmar a aplicação das demais notas.
8. Validar os fatores pendentes, inclusive códigos sem amostra nesta fatura e RC40.
9. Confirmar se o período do resumo deve seguir a fatura ou uma data de execução de outra fonte.

## Verificações e limites

- Typecheck e build executados em cada entrega; o build mantém o aviso existente de bundle acima de 500 kB.
- Integração com rollback: exemplo real 7.28, moto provável, código ausente, divergência, RC multilinha, preservação da revisão, alteração de dados e RLS sem módulo. Resumo após índices: aproximadamente 1,6 s na conexão utilizada.
- As quatro entregas têm commits separados. Nenhum arquivo preexistente do usuário foi incluído.
- A interface foi validada por compilação; não foi realizado teste visual em navegador nem verificação do deploy do Dokploy.
- Histórico de conferência mantém a última observação por linha. Histórico de fatores preserva todos os acertos.
- Reimportação preserva conferências pelo identificador idapropriacaotemposervico da fonte. Se esse identificador mudar na CEMIG, a nova linha precisa de revisão.
