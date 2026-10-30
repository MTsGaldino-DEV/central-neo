# Faturamento — relatório para Matheus

Atualizado em 23/10/2026. Os dois PDFs fornecidos foram lidos por inteiro: [Código de Serviço Unificado.pdf](../Comparação%20de%20fatura/Código%20de%20Serviço%20Unificado.pdf) (Tabela 11, 14 páginas) e [Nota de Serviço Unificado.pdf](../Comparação%20de%20fatura/Nota%20de%20Serviço%20Unificado.pdf) (Tabela 12, 2 páginas). As tabelas, descrições, coluna **Como lançar** e notas ao fim de cada PDF foram confrontadas com a fatura 9844. O texto da NOTA 8 termina cortado nos dois arquivos e a NOTA 10, citada em quatro códigos, não consta neles.

## Homem-hora, despacho COD e área (27/10/2026)

Regras do Matheus, desenho em [2026-10-27-faturamento-homem-hora-cod-design.md](superpowers/specs/2026-10-27-faturamento-homem-hora-cod-design.md). Migrations locais **039** e **040** (28/10).

- **Despacho:** o serviço é COD quando o `tipo_serv` está na lista do COD (`neo_fat_despacho_cod`, 43 tipos, com RC01); senão, CSC. A escolha pelo valor que coincide acabou. Na 9844, antes: tipos da lista com CSC ≠ COD → 1.350 linhas pagas como COD e 6 como CSC (RC08); fora da lista → 12 pagas como COD (RC01 ×3, RC04, RC06, RC07 ×5, RC21, RC36).
- **Área:** Fatura Completa, aba Serviço, `cod_tip_area` (U urbano; R e **S** rural). A quantidade continua K + M. Bateu com K/M em todas as 26.760 linhas com quantidade; 10 linhas com S passaram a rural.
- **Homem-hora (1.62, 1.73, 5.63, 5.64):** horas = `dh_terreal − dh_aciona`, por minuto (a CEMIG paga assim: 61/61 serviços 1.62 conferem), × Tabela 14 pela equipe (`neo_fat_prontidao`: dupla 0,1097, umpla 0,0922, moto 0,0366, quarteto 0,1753 US/h) × (1 + 0,2 COD + 0,2 rural).
- **1.62 na 9844:** 61 serviços, todos COD (MA62), 39 rurais e 22 urbanos; devido 9,9655 US contra 7,6662 pagos (a CEMIG usou 0,1097 × 1,0 em todos).
- **5.63/5.64:** 4 serviços por hora, 0,170316 US. **RC com homem-hora** (040, 28/10): quando o serviço RC tem 1.62/1.73/5.63/5.64, não vale o RC por atendimento; cada linha paga o seu código. Em 246042202 (RC15) e 246140737 (RC05) a CEMIG calculou o 5.64 por hora (35 e 12 min × 0,1097) e glosou o valor inteiro; o 246140737 confere e o 246042202 fica a menos 0,0128 US (rural).
- **Situação dos serviços na 9844:** a menos 106 → 177, a mais 172 → 181, fora 88 → 27, conferem 21.544 → 21.525 (com a 040). Mudanças: 59 homem-hora fora → a menos e 2 fora → confere; 2 5.63 → a menos; 9 RC04/06/07/21/36 pagos como COD → a mais; 6 RC08 pagos como CSC → a menos; 5 serviços com área S → a menos (rural).
- **Totais da 9844:** devido 858,175 → 869,281 US; a menos 7,447 → 10,638 US (R$ 31.535,01); a mais 17,002 → 16,774 US.
- **0.06 (041, 28/10):** Tabela 11 com valor 0; serviço com 0.06 tem devido 0. Os 17 RC da 9844 fechados só com 0.06 (pagos 0) conferem; a menos 177 → 161 serviços (a menos sem conferências à mão: 8,4005 US), fora 27 → 26.
- **5.62 dentro de RC (044, 29/10):** informativo na nota 3 (sai da lista de transposição; a linha vale zero quando o RC é transposto para outro código). Na 9844: a mais 181 → 25, a menos 161 → 155, conferem 21.542 → 21.704. A 044 também mostra a justificativa da glosa lançada em outro código do serviço (aba Evento_Glosa); a 045 aceita vários números separados por vírgula no filtro Nº serviço.
- **Glosados (046, 29/10):** serviço com código de glosa (G.xx, hoje G.02) não é pago a menos: a CEMIG glosou e não vai pagar. Situação GLOSADO, card laranja no Painel e atalho na Conferência. Na 9844: 345 serviços, 6,6949 US pelo contrato (glosa lançada 7,2971 US); a menos 155 → 141 (6,5564 US). Glosa sem código G (multa) segue como antes.
- **Regra da glosa (048, 29/10, substitui 046/047):** nada pago e glosa → glosa × contrato (igual confere; menor = Glosa parcial no a menos; quantidade zerada ou glosa acima → Conferir à mão). Pagou algo → pago × contrato. "Possíveis glosas erradas" = parcial + conferir à mão (9844: 47). "Multas" renomeado para "Glosas". Prova real automática em `faturamento-prova-real-testar.cjs`.
- **Glosa parcial (047, 29/10):** com código G, glosa menor que o devido fica em Pagou a menos (motivo Glosa parcial) e a diferença é pago + glosa − devido. Na 9844: 14 serviços, 0,2785 US; Glosados ficam 331 (glosa 5,9880 US).
- **Possível fator errado (041–043):** pago = previsto × 1,2 / 1,4 / 1,44, 1,4 no lugar de 1,2 e o inverso de cada um, ou × 0,8. Só casos exatos. Na 9844: 74 serviços — 33 "÷ 1,4" (1.62 COD rural pago × 1,0), 32 "÷ 1,2" (21 do 1.62 urbano + RC08 pagos como CSC + área S) e 9 "× 1,2" (RC pagos como COD fora da lista).
- Quarteto = caminhonete cabine dupla com 4 elementos (linha de 4 da Tabela 14, 0,1753). CSC × COD só pela lista. NEO não trabalha com linha viva nem caminhão.
- Faturas importadas antes da 039 não têm horário nem área: a 9844 foi preenchida por `scripts/faturamento-tempo-carregar.cjs`; as próximas importações já gravam tudo.

## Rodada 2 (26/10/2026)

- **Painel** (`/faturamento/painel`, antigo Resumo): dois cards, "pagou a menos" (principal) e "pagou a mais", cada um com "A CEMIG pagou X e o contrato prevê Y"; funil até os divergentes; gráfico com resumo no mouse; valores em **R$** pelo valor da US mais recente do apostilamento (hoje R$ 2.964,33), com a chave R$ | US.
- **Conferência** em colunas com filtro estilo Excel, atalhos por situação e os botões Contém 1.NS, Multado e 5.62.
- **Janela do serviço** com nº de frota, tipo do serviço, nº do serviço e tipo da frota em destaque; fatores aplicados em cima; tabela só com o pago; o 1.NS cruzado com a **Manutenção** (antigo Fechamento de Notas), sem entrar na soma; histórico.
- **Tempo esgotado** ("canceling statement due to statement timeout") resolvido na **035**: o cálculo por serviço fica guardado em `neo_fat_servicos_calc` e só é refeito quando algo muda. A **036** traz filtros por coluna, totais por lado, Manutenção, histórico e o valor da US; a **037** deixou esses filtros rápidos (0,1–0,2 s).
- Na 9844: 204 serviços com 1.NS, 94 deles na Manutenção, 63 com valor lançado. Os lançamentos antigos da Manutenção não têm código, então aparecem como "sem código".
- Fora do contrato (88 na 9844): 61 são o código 1.62, que está na Tabela 11 sem fator (a CEMIG pagou 7,666 US neles); 27 usam códigos que não existem na tabela, todos com crédito zero. *(27/10: o 1.62 passou a ser calculado por hora; ficam 27 fora.)*

## Conferência por serviço (26/10/2026)

A tela passou a trabalhar **por serviço** (número do serviço), e não por linha. Rotas novas:

- `/faturamento`: lista de faturas, com três cartões (pago, pago a menos, multas), comparação entre faturas e o saldo a receber de cada fatura.
- `/faturamento/resumo` (hoje `/faturamento/painel`): manchete da diferença, funil, grupos e ajustes.
- `/faturamento/conferencia`: o que a CEMIG pagou a menos no centro, o que pagou a mais ao lado, com motivo e frase por serviço, mais a exportação para negociação.
- `/faturamento/documentacao`: explicação curta para leigos.

Os links antigos `/faturamento?fatura=…` levam à Conferência. Migrations **028–034** testadas com `--testar` e aplicadas. A 034 traz as correções da revisão final: os totais ficam desatualizados quando algo mudou, mesmo com duas pessoas conferindo juntas; o recálculo é feito fatura a fatura; o grupo "Por código" leva aos serviços certos, inclusive de RC; e um ajuste mal formatado não derruba os totais.

**Regra por serviço.** Soma o **crédito** de todas as linhas (sem glosas) e compara com o devido do serviço:

- **por código**: a soma dos códigos;
- **por RC**: um RC por atendimento;
- **transposição**: a das notas 2 e 3 da Tabela 12 continua igual.

O candidato CSC/COD/Moto é escolhido **uma vez por serviço**. Multas (glosa negativa) e estorno ficam **fora** do saldo, e um serviço glosado por inteiro (crédito + multa = devido) **confere**. Num serviço parcial, que tem códigos sem fator, compara-se só o crédito das linhas com fator. Serviço conferido à mão sai do saldo e da exportação.

| Fatura 9844 por serviço | Serviços | US |
|---|---:|---:|
| Confere (inclui 78 RCs glosados por inteiro, 6,573259 US em multa) | 21.544 | — |
| **Pagou a menos (saldo a receber)** | **106** | **7,447278** |
| · RC não pago | 34 | 3,998762 |
| · Fator menor que o contrato | 68 | 2,282716 |
| · Outra diferença (código sem crédito) | 4 | 1,165800 |
| Pagou a mais (fator maior que o contrato) | 172 | 17,001786 |
| Código fora do contrato | 88 | — |

- **Totais.** Crédito, multas e estorno fecham com as linhas: **917,112183**, **21,226389** e **7,446161 US**, em 27.389 linhas e 21.910 serviços.
- **Devido.** O devido por serviço é **858,174976 US**, contra 857,921936 antes (+0,253040). A diferença vem do RC por serviço e do candidato escolhido por serviço.
- **Serviços parciais:** 564.
- **Linhas idênticas na planilha:** 0.
- **5.62:** responde por **158 dos 172** serviços pagos a mais (16,674143 US). Se houver a exceção da pergunta 6, esses serviços não são cobrança da CEMIG.
- **Desconto de Moto indevido:** não apareceu na 9844.
- **54 RCs com multa e estorno ao mesmo tempo** ficam como "fator menor" e pedem análise manual (pergunta 5).

**Revisões e tempos.** As revisões antigas, por linha, foram copiadas para o serviço como desatualizadas: o texto fica guardado e o serviço pede nova conferência. Tempos medidos:

- agregação completa: 2,4 s;
- primeira página da Conferência: 2,7 s;
- painel com totais guardados: 52 ms.

Exemplos em `/faturamento/conferencia?fatura=9844` (aba "Ver todos os serviços" e busca pelo número):

- **245530193** (RC07) confere: crédito 0,043010 + 0,041669 = um RC.
- **242861522** (NSSR) paga 7.15 e 7.10.
- **245531435** usa Moto com fator 1 no 6.01.
- **246450669** transpõe RC07 → 8.82.
- **245881140** (RC08) confere pelo COD, com a multa e o estorno à parte.

## Entrega anterior (23/10/2026)

- `/faturamento` (hoje `/faturamento/conferencia`): Conferência com filtro por fatura, situação, tabela, equipe e serviço; crédito, glosa, devido, fator, frota, turma e observações. RC transposto para Tabela 11 recebe um selo e uma explicação no detalhe. Em RC com várias linhas, o devido contratual é lançado **uma vez por atendimento** na primeira linha (ordem por `id`), apenas para totalização; o detalhe mostra o valor do atendimento.
- `/faturamento/importar`: exige **Fatura Resumida** e **Fatura Completa**. Cruza `US_Servico.numserv → Serviço.numserv → Serviço.veiculo → US_Turma.numvei`, com `ident_turma` para desempate. Importação e vínculos são publicados juntos.
- `/faturamento/tabelas`: Tabelas 11/12, fatores originais preservados, correções administrativas com motivo e histórico. `/faturamento/resumo`: totais, comparação e agrupamentos; o devido agora conta cada RC somente uma vez.
- Migrations **023–027** testadas com `node scripts/migrar.cjs --testar` e aplicadas no banco CENTRAL-NEO. A 026 limita o aviso de transposição aos RCs publicados na Tabela 12; a 027 reabre conferências manuais antigas quando a regra/devido calculado mudou. Nenhuma migration manual pendente. Não houve alteração do Fechamento nem do TraceOne.

Para conferir exemplos em `/faturamento?fatura=9844`: o serviço **245531435**, código **6.01**, Moto, usa FATOR MOTO **1**, sem desconto de 0,7; o serviço **246450669**, RC07 com único código remunerável **8.82**, usa Tabela 11 e fecha em **0,016340 US**; o serviço **245881140** é RC08 multilinha com glosas e permanece divergente. Buscar **1.13** em `/faturamento/tabelas`: CSC/CSI **0,137718**, COD **0,165261**, 1 por conjunto. Reimportar os dois XLSX da pasta `Comparação de fatura/` mantém os vínculos e reabre revisões quando dados, equipe ou cálculo mudam.

## Leitura das notas e regra aplicada

| PDF e notas | Significado e tratamento |
|---|---|
| Tabela 11, corpo e notas 1–2 | Cada código tem descrição, instrução **Como lançar**, fator CSC/CSI, fator COD, FATOR RURAL e FATOR MOTO próprios. A migration 023 usa as colunas por código: por exemplo, **5.70, 6.01 e 6.05 têm moto = 1**; códigos com rural = 0 ou moto = 0 ficam com parcela zero. Para moto = 0,7, mantém-se provisoriamente 0,7 urbano / 0,9 rural conforme orientação de Matheus. Não dá para verificar em planilha se cada peça, conjunto ou dispositivo foi lançado corretamente.
| Tabela 11, notas 3–4 | Dupla de motociclistas: serviço principal 0,7 e nota PSAP de apoio (fechamento 5.64) 0,3 do fator do principal. A fatura não traz ligação confiável PSAP → serviço principal; **não** se inventou rateio. Há duas linhas 5.64 com glosa na 9844, mas o fator remete à NOTA 10 ausente.
| Tabela 11, notas 5–6 | O contrato permite atualização negociada das tabelas. O catálogo administrável com histórico de alterações já atende a mudança de fatores; novas regras exigem revisão específica.
| Tabela 11, nota 7 | Atendimentos de operação/restauração são remunerados pela Tabela 12, salvo transposição expressa nas notas 2–3 daquela tabela.
| Tabela 11, nota 8 | Exige códigos corretos e comprovantes de execução (imagens, equipamentos, materiais, coordenadas etc.). As duas planilhas não contêm todos esses comprovantes; a Conferência monetária não certifica execução física.
| Tabela 12, corpo e nota 1 | Cada RC é **pago por atendimento**, não por código/linha. Os códigos de fechamento indicam o trabalho feito. A migration 025 limita a quantidade do RC a uma ocorrência e atribui um devido ao serviço; quando o líquido do atendimento bate, mas as linhas não, usa `REVISAR_RC_MULTILINHA`.
| Tabela 12, notas 2–3 | Se o atendimento foi finalizado com **um único código remunerável da lista**, acompanhado ou não de códigos informativos com fator zero, o RC é descartado e paga-se apenas o código da Tabela 11. A lista está em `neo_fat_rc_transposicao`; migration 024 seleciona por serviço, independentemente do crédito. São **1.813 serviços / 1.820 linhas** transpostos na 9844. Havendo dois códigos remuneráveis, mantém-se o RC.
| Tabela 12, nota 4 | Atendimento rural acrescenta 20%, exceto homem-hora. RC rural usa 1,2; as colunas L/N/O continuam guardadas sem conversão de homem-hora, como decidido provisoriamente. Na 9844, as 61 linhas com L/N/O preenchidas são MA62/1.62, sem RC.
| Tabela 12, nota 5 | Um motociclista usa 0,7. Para rural, o sistema mantém **0,9 provisório** solicitado por Matheus; a leitura combinada das notas 4 e 5 poderia sugerir 1,2 × 0,7 = **0,84**, a confirmar antes de substituir a decisão explícita.
| Tabela 12, notas 6–7 | PSAP de apoio e dupla de motos: principal 0,7, apoio 0,3 do atendimento. Sem chave de relacionamento entre serviços, o apoio não é calculado automaticamente.
| Tabela 12, nota 8 | Obrigações de registro e evidência física. A verificação precisa dos documentos operacionais, além das planilhas de faturamento.

A [extração por célula](faturamento-celulas-pdf.json) guarda página, posição e hash dos PDFs; [validação cruzada](faturamento-validacao-contrato.json) separa leitura do PDF da coincidência com pagamentos. São **215 pares numéricos validados de 219 códigos** (184 da Tabela 11 e os 31 RCs da Tabela 12). O extrator antigo deixava 1.13 vazio por exigir crédito coincidente, apesar do valor legível no PDF; a migration 020 já corrigiu isso. Nenhum fator foi inferido dos valores pagos.

## Decisões provisórias e onde alterar

| Decisão | Ponto de ajuste | Efeito na 9844 |
|---|---|---|
| Comparar CSC/CSI e COD, sem campo que identifique o centro acionador | `neo_fat_calculo`, seleção de candidatos; `neo_fat_contrato.fator_csc/fator_cod` | O fator que coincide é mostrado; referência CSC quando nenhum coincide. Devido parcial: **857,921936 US**; alternativas sem troca por coincidência: CSC **836,567217** / COD **1.003,879036**. | **Substituído em 27/10/2026:** despacho pela lista do COD.
| Rural e moto por código da Tabela 11; moto 0,7/0,9 para códigos sem exceção e RC | `neo_fat_base`; `neo_fat_contrato.rural/moto`; `neo_fat_config.rural/moto_urbano/moto_rural` | 5.70, 6.01 e 6.05 de Moto deixam de ser falsamente divergentes por desconto indevido. O rural de Moto 0,9 ainda depende de confirmação. |
| Lista de códigos que transpõem RC | Tabela `neo_fat_rc_transposicao` (campo `ativo`) e `neo_fat_base` | 1.813 serviços usam Tabela 11; exemplo RC07/8.82 fecha em 0,016340 US, sem somar RC. |
| RC pago uma vez por atendimento; devido alocado à primeira linha para totalização | `neo_fat_base` e `neo_fat_calculo` | 1.310 linhas em `REVISAR_RC_MULTILINHA`; 642 `DIVERGENTE`. A alocação não afirma que a primeira linha executou todo o atendimento. |
| L/N/O guardadas sem cálculo | `neo_fat_calculo.observacoes`; `neo_fat_linhas.dados` | 61 linhas MA62/1.62 com `qtdhh`; aguardam regra/fator da NOTA 10. | **27/10/2026:** coluna O (homem-hora) calculada pela Tabela 14.
| Moto provável somente quando equipe não identificada | `neo_fat_calculo` e vínculo das duas planilhas | 0 `MOTO_PROVAVEL`; todos os 21.910 serviços têm equipe identificada. |
| Glosa positiva como estorno; débito negativo separado | `neo_fat_calculo`; `neo_fat_resumo` | Crédito **917,112183**, débito **21,226389**, estorno **7,446161 US**. Glosa parcial continua caso de revisão. |
| NOTA 10 sem regra nem fator inventado | `neo_fat_contrato.nota`, `fator_csc/fator_cod` nulos | 1.62/1.73/5.63/5.64 ficam sem cálculo quando aplicáveis. | **27/10/2026:** calculados por hora (Tabela 14), regra do Matheus.
| Tolerância e seis casas decimais | `neo_fat_config.tolerancia`; `round` em `neo_fat_base` | Tolerância atual: **0,000001 US**. |

## Números da fatura 9844

| Medida da aba US_Servico | US |
|---|---:|
| Creditado | 917,112183 |
| Debitado (glosas negativas, módulo) | 21,226389 |
| Estorno (glosas positivas) | 7,446161 |
| Líquido (crédito + glosa assinada) | 903,331955 |
| Devido parcial de referência | 857,921936 |

| Situação calculada | Linhas |
|---|---:|
| OK | 24.785 |
| DIVERGENTE | 642 |
| MOTO_PROVAVEL | 0 |
| CODIGO_FORA_CONTRATO | 652 |
| REVISAR_RC_MULTILINHA | 1.310 |

Total: **27.389 linhas**. O devido é **parcial**: 652 linhas não possuem fator utilizável. Nas 734 ocorrências RC com várias linhas da 9844, 571 têm líquido compatível com um único valor de RC (considerando os candidatos CSC/COD/Moto); a classificação final também exige equipe compatível. Ajustes da aba `Debito_Credito` são separados: débito **64,963712**, crédito **95,344853 US**. Não se somam novamente valores repetidos de Cidades/US_Turma. As abas Acima_Prazo e Sobreaviso não foram classificadas nesta importação.

## Códigos e RCs não carregados

Todos os **31 RCs** da Tabela 12 foram carregados. Faltam os valores numéricos de **1.62, 1.73, 5.63 e 5.64** da Tabela 11: as células remetem à **NOTA 10**, cujo texto não veio nos PDFs. Desses, 1.62 aparece em 61 linhas aplicáveis e 5.63 em duas. Outros códigos usados sem fator nos PDFs: **0.00 (209), 0.06 (1), 6.18 (2), 7.18 (34), 7.19 (320), 7.20 (7), V.01 (7), Z.22 (3), Z.23 (4), Z.38 (1), Z.41 (1)**. Essas 589 linhas, somadas às 63 da NOTA 10, permanecem `CODIGO_FORA_CONTRATO`. Não se supôs preço para elas.

**30/10/2026 — Anexo VI completo (`ANEXO VI-TABELAS_abril24.pdf`, "o contrato correto" segundo Matheus):** Tabelas 11, 12 e 14 conferidas código a código, com os mesmos 219 pares CSC/COD e os mesmos US/h do banco. A NOTA 10 da Tabela 11 confirma o homem-hora pela Tabela 14. Os códigos 0.00, 6.18, 7.18, 7.19, 7.20, V.01, Z.22, Z.23, Z.38 e Z.41 **não estão** no contrato. A migration 049 corrigiu rural/moto de 18 códigos com fator 0 (lidos como 0/1; o PDF traz 1,2/0,7), sem mudança em nenhum devido ou total da 9844. Também trouxe o 704128 da Tabela 03 (Manutenção) para 0,0158 no `fator_original`.

**30/10/2026 — 1º Termo Aditivo (`ADITIVO_CT_NOVOS_CODIGOS.pdf`, assinado em 30/03/2026):** inclui na Tabela 11 os códigos **7.18** (ramal monofásico), **7.19** (bifásico) e **7.20** (trifásico) direto na caixa de medição (ND-5.1), 1 por ramal: 0,126786/0,152143, 0,126786/0,152143 e 0,135182/0,162218 (CSC/COD). Sem colunas rural/moto (padrão 1,2/0,7). Migration 050: cadastra os três e passa a refazer contas e totais quando o contrato ganha código (a impressão só olhava o histórico de acertos). Fatura 9844: 362 serviços têm ramal (35 com 7.18, 320 com 7.19, 7 com 7.20); 361 passaram a comparar o ramal e **todos continuam conferindo** (a CEMIG pagou CSC, e CSC × 1,2 no rural); o outro é RC07 pago por atendimento. Contrato previa R$ 2.617.842,52 → **R$ 2.760.989,50** (+R$ 143.146,98); diferença Valor pago − Contrato −R$ 42.366,34. Nenhuma linha com crédito fica sem preço.

## Perguntas que continuam abertas

1. Qual campo da origem indica que **CSC/CSI** ou **COD** acionou a equipe? A coincidência numérica é apenas diagnóstico.
2. ~~NOTA 10~~: resolvida pelo Anexo VI completo (homem-hora pela Tabela 14). ~~7.18, 7.19, 7.20~~: incluídos pelo 1º Termo Aditivo (migration 050).
3. Como ligar uma nota **PSAP** à equipe e ao atendimento principal para aplicar 0,3, especialmente quando há mais de uma equipe?
4. Confirmar o multiplicador **rural de Moto** (0,9 solicitado; notas sugerem combinação 0,84) e como tratar homem-hora/L/N/O.
5. Como revisar **glosas parciais e simultâneas**? O serviço 245881140 tem crédito, glosa positiva e negativa em linhas distintas.
6. ~~5.62 seguindo o RC~~ — resolvido em 29/10/2026 (migration 044): dentro de RC da Tabela 12 o 5.62 é informativo; só 5.62 paga o RC, 5.62 + código da lista paga o código. Na 9844, 158 de 158 RC só com 5.62 foram pagos pelo RC exato.
7. Para análise física, onde obter evidências exigidas pelas notas 8 e verificar as unidades da coluna **Como lançar**?

## Verificações e limites

- `node scripts/faturamento-testar.cjs`: integração com rollback, fator Moto 1/0, rural 0, transposição com código informativo zero, manutenção do RC com dois códigos remuneráveis, RC por atendimento e conferência/RLS.
- `node scripts/faturamento-duas-planilhas-testar.cjs`: importação e vínculos com rollback. `node scripts/faturamento-conferencia-testar.cjs`: consulta antiga, RPC paginada, filtros e ausência de acesso sem módulo; consulta antiga de 50 linhas/contagem concluída em cerca de 4,9 s no teste.
- `npm.cmd run typecheck` e `npm.cmd run build` passaram; permanece o aviso de bundle principal acima de 500 kB. Chrome com APIs simuladas validou os dois arquivos reais, a Conferência e o selo de transposição (inclusive ausência do selo para RC fora da Tabela 12); a captura foi inspecionada.
- Reimportação conserva histórico de conferência com contexto do cálculo. Mudança de equipe, dados, fatores, devido ou situação calculada reabre revisão; os contextos antigos foram reabertos para que a nova regra seja validada. O devido de RC é atribuído à primeira linha apenas para totalização; agrupamentos por código podem atribuir esse valor a um código que não representa sozinho todo o trabalho.
