# Faturamento — relatório para Matheus

Atualizado em 23/10/2026 após a orientação sobre Fatura Resumida × Fatura Completa. Esta revisão entrega o cruzamento e a correção do catálogo; as outras ressalvas da auditoria continuam indicadas abaixo.

## Entregue

- /faturamento: conferência paginada, filtros na URL por fatura, situação, tabela, tipo, código, cidade, serviço e equipe; tipo da equipe/frota, fator numérico coincidente, detalhe com ident_turma e origem do vínculo, justificativa da glosa, observação, usuário/data e exportação das divergências em Excel.
- /faturamento/importar: dois anexos obrigatórios, **Fatura Resumida** e **Fatura Completa**, com arrastar/selecionar, prévia, identificação de equipes e progresso. Lê as cinco abas da Resumida e Serviço/Apropriação da Completa. Publica dados e vínculos juntos, em lotes de 1.000. Não exige copiar abas manualmente. Período vem da aba Apropriação.
- /faturamento/tabelas: consulta das tabelas 11/12; valores publicados preservados; acerto/ativação com motivo e histórico para ADMIN.
- /faturamento/resumo: cards, comparação entre faturas com escala comum, barras com valores no hover, agrupamentos por tipo/código/cidade e ajustes. Filtro de período usa sobreposição do período da fatura.
- Módulo de acesso faturamento, navegação lateral e cartão inicial.
- Migrations 013 a 020 testadas com node scripts/migrar.cjs --testar antes de aplicar no CENTRAL-NEO. Nenhum objeto do Fechamento ou TraceOne alterado.

## Como testar

1. Entrar como ADMIN NEO ou liberar o módulo Faturamento em Logins e acessos.
2. Abrir /faturamento?fatura=9844. A fatura já foi importada, com 27.389 linhas.
3. Buscar 246220152: RC79 usa Tabela 11, código 7.28, 9 urbanos, 0,056511 US; situação OK.
4. Filtrar por equipe Moto e abrir uma linha: consultar frota, turma, fatores e os quatro valores candidatos. MOTO_PROVAVEL está zerado na 9844 porque todas as equipes foram identificadas; REVISAR_RC_MULTILINHA permanece com 56 linhas.
5. Em /faturamento/importar, anexar Resumo_Fat_9844_02-09_a_01-10-2026.xlsx como Resumida e RelatorioDadosFatura98442210261707592768056627079586513.xlsx como Completa. Conferir 21.910 serviços e as quatro equipes antes de atualizar. Reimportar os mesmos dados preserva a conferência; mudanças nos dados, equipe, frota ou fatores reabrem a linha e mantêm a observação anterior. Revisões antigas sem contexto de cálculo também precisam ser refeitas.
6. Em /faturamento/tabelas, buscar 1.13: CSC 0,137718 / COD 0,165261. Alterações do administrador exigem motivo e atualizam cálculos e estado das revisões. Os fatores publicados seguem imutáveis após a complementação.
7. Executar npm.cmd run typecheck e npm.cmd run build. Executar node scripts/faturamento-testar.cjs para testes de integração com rollback.

## Decisões provisórias

| Regra | Onde trocar | Efeito na 9844 |
|---|---|---|
| Comparar CSC/CSI e COD; prioridade CSC quando ambos coincidem | neo_fat_calculo, candidatos; neo_fat_contrato.fator_csc/fator_cod | 13.101 linhas OK; fator aplicado exposto na conferência |
| Devido de referência sem coincidência usa CSC; total é parcial | neo_fat_calculo.devido_referencia | 1.030,403921 US devidos; alternativas sem ajuste de moto: CSC 1.035,320784 / COD 1.242,382723 |
| L/N/O guardadas sem cálculo; observação quando não coincide | neo_fat_calculo.observacoes; dados da neo_fat_linhas | qtdhh aparece em 61 linhas na fonte; não é convertido em US |
| Ausência de vínculo: comparar também moto | neo_fat_base.tipo_turma e neo_fat_calculo | 0 MOTO_PROVAVEL na 9844; todos os serviços vinculados. Em outras faturas, mantém o tratamento para ausentes/ambíguos |
| Moto urbano 0,7 e rural 0,9 substituem 1 e 1,2 | neo_fat_config.moto_urbano/moto_rural/rural | Calculados os dois fatores de moto em todas as linhas com contrato |
| RC com várias linhas: somar devidos por linha e comparar com líquido do serviço | neo_fat_calculo, grupos e situacao_calculo | 56 linhas REVISAR_RC_MULTILINHA; não há deduplicação automática por atendimento |
| Glosa positiva = estorno; validar magnitude contra o devido, além do crédito | neo_fat_calculo.candidatos e observacoes | 7,446161 US de estornos; destaque na tela |
| Glosa negativa: débito positivo no resumo; líquido = crédito + glosa assinada | neo_fat_resumo e neo_fat_calculo | Débito 21,226389 US; glosa líquida −13,780228 US |
| Crédito zero com débito integral pode coincidir; glosa não zero deve coincidir em magnitude com o mesmo fator | neo_fat_calculo.candidatos | Débitos parciais seguem para revisão; decisão explícita a confirmar |
| NOTA armazenada, sem regra adicional | neo_fat_contrato.nota; neo_fat_calculo.observacoes | Códigos somente com NOTA 10 sem fator numérico ficam pendentes; o PDF não contém o texto dessa nota |
| Fator publicado validado por células e texto do PDF, independentemente do crédito | scripts/faturamento-validar-pdf.py; scripts/faturamento-extrair.cjs; neo_fat_contrato | 215 códigos validados; 652 linhas sem fator. Regra anterior substituída pela orientação do usuário sobre 1.13 |
| Tolerância de 0,000001, arredondamento a seis casas | neo_fat_config.tolerancia; neo_fat_base | Todos os cálculos em numeric no PostgreSQL |

## Números da fatura 9844

Valores da aba US_Servico, em US:

| Medida | Valor |
|---|---:|
| Total creditado | 917,112183 |
| Total debitado (glosas negativas, módulo) | 21,226389 |
| Estornos (glosas positivas) | 7,446161 |
| Líquido dos serviços | 903,331955 |
| Devido parcial de referência | 1.030,403921 |
| Linhas excluídas do devido por falta de fator | 652 |

| Situação calculada | Linhas |
|---|---:|
| CODIGO_FORA_CONTRATO | 652 |
| DIVERGENTE | 13580 |
| MOTO_PROVAVEL | 0 |
| OK | 13101 |
| REVISAR_RC_MULTILINHA | 56 |

Ajustes separados, aba Debito_Credito: débito 64,963712 US; crédito 95,344853 US. Não somar os valores repetidos das abas Cidades/US_Turma aos serviços. Não foram classificadas as abas Acima_Prazo e Sobreaviso: o escopo de importação solicitado enumera as cinco abas acima.

## Fatores a carregar manualmente

A validação agora cruza a posição física das células no PDF com as extrações raw/layout, código a código. Dos 219 códigos, 215 têm os dois fatores numéricos confirmados. Todos os 31 RCs da Tabela 12 foram carregados. A migration 020 preencheu 99 códigos antes pendentes, com trilha e preservação dos acertos já feitos.

| Tabela | Código | Motivo | Linhas aplicáveis na 9844 |
|---|---|---|---:|
| 11 | 1.62 | NOTA 10, sem fator numérico nem texto da nota no PDF fornecido | 61 |
| 11 | 1.73 | NOTA 10 | 0 |
| 11 | 5.63 | NOTA 10 | 2 |
| 11 | 5.64 | NOTA 10 | 0 |

Outras 589 linhas usam códigos ausentes dos PDFs fornecidos, sem RC contratual aplicável: **0.00 (209), 0.06 (1), 6.18 (2), 7.18 (34), 7.19 (320), 7.20 (7), V.01 (7), Z.22 (3), Z.23 (4), Z.38 (1), Z.41 (1)**. Com as 63 linhas da NOTA 10, são 652 linhas sem fator. Permanecem CODIGO_FORA_CONTRATO; não foram inventados valores.

### Por que o 1.13 estava vazio

O extrator anterior condicionava o carregamento do contrato à existência de pelo menos um crédito coincidente na fatura 9844. O 1.13 possui fatores claros no PDF, mas suas oito linhas nesta fatura pertencem a RCs com precedência da Tabela 12; não havia amostra aplicável da Tabela 11. Esse critério descartou indevidamente o valor publicado.

Agora o 1.13 mostra **CSC/CSI 0,137718 e COD 0,165261**, rural 1,2, moto 0,7 e lançamento por conjunto. A correção do catálogo não altera diretamente suas oito linhas na 9844 enquanto vigorar a precedência dos RCs. O valor publicado e a coincidência do crédito são validações distintas.

Evidências: [células do PDF](faturamento-celulas-pdf.json), com SHA-256/página/coordenada, e [validação cruzada](faturamento-validacao-contrato.json). A extração não reescreve a migration 014: produz um catálogo candidato separado para uma nova migration.

## Perguntas para revisão

1. Qual campo determina CSC/CSI ou COD? A coincidência numérica é provisória.
2. O que significam L/N/O e como remunerar homem-hora?
3. A ligação foi entregue e validada. Falta definir como ratear serviços com múltiplas equipes de apoio; a importação rejeita vínculos conflitantes para o mesmo serviço.
4. Confirmar moto 0,7 urbano / 0,9 rural e exceções: 10.224 linhas de Moto divergem dessa regra, mas o crédito coincide com o fator normal. É necessário confirmar como a CEMIG remunera esses atendimentos; o sistema não muda a regra para fazer o pagamento coincidir.
5. RC é pago uma vez por atendimento ou por linha? Como distribuir o valor no exemplo 245881140?
6. Confirmar estornos positivos e a regra para glosas parciais, crédito zero e valores simultâneos.
7. Disponibilizar o texto da NOTA 10 e confirmar a aplicação das demais notas.
8. Fornecer fatores dos códigos ausentes dos PDFs e o conteúdo da NOTA 10. RC40 e códigos numéricos sem amostra já foram carregados e validados no PDF.
9. Confirmar se o período do resumo deve seguir a fatura ou uma data de execução de outra fonte.

## Verificações e limites

- Typecheck e build executados em cada entrega; o build mantém o aviso existente de bundle acima de 500 kB.
- Integração com rollback: exemplo real 7.28, moto provável, código ausente, divergência, RC multilinha, preservação da revisão, alteração de dados e RLS sem módulo. Resumo após índices e novos vínculos: aproximadamente 2,0 s na conexão utilizada.
- As quatro entregas têm commits separados. Nenhum arquivo preexistente do usuário foi incluído.
- Chrome desktop (1440 px) e celular (390 px): seleção dos arquivos reais, prévia, envio dos lotes, conclusão, remoção, arquivo incompatível, contrato 1.13 e detalhe de equipe. APIs do navegador interceptadas; cálculos, importação real e permissões verificados separadamente no CENTRAL-NEO. Capturas inspecionadas. Deploy do Dokploy ainda não verificado.
- Histórico de conferência mantém a última observação por linha. Histórico de fatores preserva todos os acertos.
- Reimportação preserva conferências pelo identificador idapropriacaotemposervico da fonte. Se esse identificador mudar na CEMIG, a nova linha precisa de revisão.

## Cruzamento das equipes — resultado real

US_Servico.numserv → Serviço.numserv → Serviço.veiculo → US_Turma.numvei.
Quando a frota tem mais de um tipo no período, Serviço.ident_turma seleciona a turma correta, exigindo correspondência do veículo. Sem esse desempate, 5.299 serviços teriam mais de um tipo possível; com ele, todos os 21.910 serviços são identificados.

| Equipe | Serviços únicos | Linhas de faturamento |
|---|---:|---:|
| Multifuncional (D) | 9.657 | 14.303 |
| Moto (M) | 10.311 | 10.426 |
| Umpla (U) | 1.872 | 2.563 |
| Quarteto (Q) | 70 | 97 |

Com a identificação real, 10.238 linhas de Moto são DIVERGENTE; em 10.224 delas o crédito coincide com CSC/COD **normal**, não com o multiplicador provisório de Moto. Isso explica a maior parte do aumento de divergências em relação à fotografia anterior, quando a equipe não era conhecida e a coincidência normal também era aceita. Equipe confirmada restringe a comparação ao cálculo correspondente, inclusive no agregado de RC multilinha. Totais de crédito/débito não mudaram.

A migration 020 reduz linhas sem fator de 657 para 652: as cinco linhas RC40 passam a ter cálculo. O total devido continua parcial e depende das regras provisórias. As ressalvas de glosa parcial, exceções das notas da Tabela 12, RC por atendimento e acabamento das outras telas não foram declaradas resolvidas por esta revisão.

## Reprodução das verificações desta revisão

**Correção do erro 500 na Conferência.** A view com RLS aplicado a cada subconsulta
estourava o tempo limite ao atender `GET neo_fat_conferencia?select=*&fatura=eq.9844`.
As migrations 021/022 foram testadas e aplicadas. A versão publicada da tela volta
a consultar a view em cerca de 2,2 s para página/contagem; o novo frontend usa
`neo_fat_listar`, que inclui filtros, paginação e total com verificação de acesso.
Usuário sem módulo recebe zero linhas na view e erro de acesso na RPC. Não há
migration manual pendente. O teste de regressão é
`node scripts/faturamento-conferencia-testar.cjs`.

- node scripts/faturamento-planilhas-testar.cjs: duas planilhas reais, faturas diferentes, frota ambígua, ident_turma incompatível, duplicidade e datas.
- node scripts/faturamento-duas-planilhas-testar.cjs: rollback, publicação atômica, falta de lotes, mistura de faturas, reimportação, mudança de equipe/revisão, contrato 1.13 e permissões.
- node scripts/faturamento-testar.cjs: suíte anterior de cálculo, resumo e RLS.
- npm.cmd run typecheck e npm.cmd run build: aprovados; aviso preexistente de bundle acima de 500 kB.
- node scripts/faturamento-ui-testar.cjs: requer npm.cmd run dev, Chrome e Playwright instalado em .tmp-faturamento/browser. Usa origens de dados locais para interceptar o Supabase, sem gravações pelo navegador. Capturas ficam em .tmp-faturamento/.
- Extração: PyMuPDF para scripts/faturamento-validar-pdf.py; pdftotext -layout e -raw em .tmp-faturamento/tabela11/12[-raw].txt; depois node scripts/faturamento-extrair.cjs .tmp-faturamento <Fatura Resumida.xlsx>. A saída contrato-validado.json é candidata de carga, nunca uma migration aplicada.
- Migrations 019/020: ensaiadas via node scripts/migrar.cjs --testar (saída DRY-RUN: desfeito), aplicadas e conferidas. Não há migration manual pendente desta entrega.
