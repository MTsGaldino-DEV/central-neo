const fs=require('fs');
const {totais,contagens,ajustes}=JSON.parse(fs.readFileSync('docs/faturamento-9844-resultados.json','utf8'));
const {pendentes,validacao}=JSON.parse(fs.readFileSync('docs/faturamento-validacao-contrato.json','utf8'));
const n=v=>Number(v).toLocaleString('pt-BR',{minimumFractionDigits:6,maximumFractionDigits:6});
const texto=`# Faturamento — relatório para Matheus

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
| Comparar CSC/CSI e COD; prioridade CSC quando ambos coincidem | neo_fat_calculo, candidatos; neo_fat_contrato.fator_csc/fator_cod | ${contagens.find(c=>c.situacao_calculo==='OK').quantidade} linhas OK; fator aplicado exposto na conferência |
| Devido de referência sem coincidência usa CSC; total é parcial | neo_fat_calculo.devido_referencia | ${n(totais.devido)} US devidos; alternativas CSC ${n(totais.devido_csc)} / COD ${n(totais.devido_cod)} |
| L/N/O guardadas sem cálculo; observação quando não coincide | neo_fat_calculo.observacoes; dados da neo_fat_linhas | qtdhh aparece em 61 linhas na fonte; não é convertido em US |
| Ausência de vínculo: comparar também moto | neo_fat_base.tipo_turma e neo_fat_calculo | ${contagens.find(c=>c.situacao_calculo==='MOTO_PROVAVEL').quantidade} linhas MOTO_PROVAVEL; sem vínculo a identificação permanece pendente |
| Moto urbano 0,7 e rural 0,9 substituem 1 e 1,2 | neo_fat_config.moto_urbano/moto_rural/rural | Calculados os dois fatores de moto em todas as linhas com contrato |
| RC com várias linhas: somar devidos por linha e comparar com líquido do serviço | neo_fat_calculo, grupos e situacao_calculo | ${contagens.find(c=>c.situacao_calculo==='REVISAR_RC_MULTILINHA').quantidade} linhas REVISAR_RC_MULTILINHA; não há deduplicação automática por atendimento |
| Glosa positiva = estorno; validar magnitude contra o devido, além do crédito | neo_fat_calculo.candidatos e observacoes | ${n(totais.estorno)} US de estornos; destaque na tela |
| Glosa negativa: débito positivo no resumo; líquido = crédito + glosa assinada | neo_fat_resumo e neo_fat_calculo | Débito ${n(totais.debitado)} US; glosa líquida −13,780228 US |
| Crédito zero com débito integral pode coincidir; glosa não zero deve coincidir em magnitude com o mesmo fator | neo_fat_calculo.candidatos | Débitos parciais seguem para revisão; decisão explícita a confirmar |
| NOTA armazenada, sem regra adicional | neo_fat_contrato.nota; neo_fat_calculo.observacoes | Códigos somente com NOTA 10 sem fator numérico ficam pendentes; o PDF não contém o texto dessa nota |
| Somente fatores com ordem/valores conferidos e pelo menos um crédito reproduzido são ativados | scripts/faturamento-extrair.cjs; neo_fat_contrato.validado | ${validacao.filter(c=>c.validado).length} códigos validados; ${totais.sem_fator} linhas sem fator |
| Tolerância de 0,000001, arredondamento a seis casas | neo_fat_config.tolerancia; neo_fat_base | Todos os cálculos em numeric no PostgreSQL |

## Números da fatura 9844

Valores da aba US_Servico, em US:

| Medida | Valor |
|---|---:|
| Total creditado | ${n(totais.creditado)} |
| Total debitado (glosas negativas, módulo) | ${n(totais.debitado)} |
| Estornos (glosas positivas) | ${n(totais.estorno)} |
| Líquido dos serviços | ${n(Number(totais.creditado)-Number(totais.debitado)+Number(totais.estorno))} |
| Devido parcial de referência | ${n(totais.devido)} |
| Linhas excluídas do devido por falta de fator | ${totais.sem_fator} |

| Situação calculada | Linhas |
|---|---:|
${contagens.map(c=>`| ${c.situacao_calculo} | ${c.quantidade} |`).join('\n')}

Ajustes separados, aba Debito_Credito: ${ajustes.map(a=>`${a.tipo==='C'?'crédito':'débito'} ${n(a.valor)} US`).join('; ')}. Não somar os valores repetidos das abas Cidades/US_Turma aos serviços. Não foram classificadas as abas Acima_Prazo e Sobreaviso: o escopo de importação solicitado enumera as cinco abas acima.

## Fatores a carregar manualmente

O catálogo contém os códigos/RCs extraídos mesmo quando não validados, com fatores nulos. Isso preserva a precedência da Tabela 12. Não foram inferidos fatores ausentes. A validação detalhada, candidatos e quantidade de amostras ficam em faturamento-validacao-contrato.json.

| Tabela | Código/RC | Motivo | Linhas na amostra aplicável |
|---|---|---|---:|
${pendentes.map(c=>`| ${c.tabela} | ${c.codigo} | ${c.motivo} | ${c.linhas} |`).join('\n')}

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
`;
fs.writeFileSync('docs/faturamento-relatorio.md',texto);
