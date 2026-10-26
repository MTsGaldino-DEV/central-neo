# Checklist do pedido versus entrega

Auditoria de 23/10/2026, solicitada por Matheus após reprovar o resultado.
Base: prompt original, decisões do modo autônomo, código atual e histórico Git.
Esta é uma inspeção de código e das evidências da execução anterior, sem nova validação visual ou deploy.

Legenda: atendido = implementado com evidência; parcial = existe com lacunas; falha = requisito não atendido.

| Pedido | Estado | Evidência e limite |
|---|---|---|
| Entender o contexto e estudar Fechamento | Parcial | Contexto lido e arquivos consultados, mas a execução não preservou o mesmo nível de organização e apresentação. |
| Mesma stack, cores e fontes | Atendido | React/TS/Vite/Tailwind, tokens e fonte de códigos utilizados. Isso não prova fidelidade visual. |
| Mesmo estilo de código e telas do Fechamento | Parcial | Componentes muito condensados, formulários e resumo simplificados; sem revisão visual. |
| Não alterar TraceOne ou objetos antigos do Fechamento | Atendido | Diff da entrega contém novas migrations 013–018 e integração de navegação; nenhuma migration antiga editada. |
| Novo módulo e rotas protegidas | Atendido | Modulo/MODULOS, ExigeModulo e navegação implementados. |
| RLS, security_invoker e ADMIN no contrato | Atendido com cobertura limitada | Mecanismos presentes; teste automatizado não cobre todas as combinações de usuários e RPCs. |
| Testar migrations antes de aplicar | Atendido | Logs anteriores registram --testar com rollback antes da aplicação de 013–018. |
| Extrair PDFs, conferir ordem e contagem código/fator | Parcial | Comparação de códigos entre layout/raw e listas de números ordenadas; não há prova completa de correspondência de cada coluna com cada código. |
| Validar fatores contra a fatura | Parcial | Critério automático aceita um crédito coincidente; não exige amostra representativa ou validação independente dos dois fatores. |
| Não inventar fatores e listar pendentes | Atendido | 219 entradas, 116 validadas e 103 pendentes. Fallback autorizado pelo usuário; 657 linhas sem fator calculável. |
| Descrição, como lançar, rural, moto e NOTA | Parcial | Campos existem, mas extração heurística mistura texto e pode deixar como_lancar vazio. Notas não passam ao cálculo quando o contrato não está validado. |
| Acerto ADMIN com motivo, histórico e ativação | Atendido | Tela, RPC e trigger presentes. Fator publicado preservado. |
| Importar abas e guardar colunas | Atendido | US_Servico, US_Turma, Evento_Glosa, Glosa e Debito_Credito; JSON guarda campos originais; cidade normalizada. |
| Lotes de 1.000–2.000 e substituição da fatura | Atendido | Lotes de 1.000, staging e publicação transacional. |
| Preservar conferências na reimportação | Parcial | Preserva pelo idapropriacaotemposervico; teste simula exclusão/reinserção, não reimportação completa pela tela. Troca do ID de origem exige nova revisão. |
| Tabela 12 primeiro; RC ausente usa Tabela 11 | Atendido | Prioridade presente; RC79/código 7.28 testado. |
| Quantidade, urbano/rural, seis casas, tolerância | Atendido | numeric, round a seis casas e configuração de 0,000001. |
| Comparar CSC/COD e mostrar fator coincidente | Parcial | Alternativas calculadas e rótulo CSC/COD exibido; fator_aplicado é uma coluna calculada que também recebe candidato quando nenhum coincide, sem registro persistente da decisão. |
| Moto provável e importação de vínculo | Atendido com validação parcial | Tabela e tela prontas; 0,7/0,9 configurados. Planilha real ausente conforme previsto; fluxo completo com vínculos reais não testado. |
| L/N/O guardadas, sem cálculo e com observação | Atendido | Valores preservados, excluídos do cálculo, observação para não coincidência. |
| RC multilinha: conferir linha e soma | Parcial | Soma e status implementados, mas agregação pode aceitar base incompleta; teste usa caso sintético, não explica completamente o caso real 245881140. |
| Estorno positivo com destaque | Parcial | Identificado e destacado, mas comparação exige glosa integral igual ao devido; isso acrescenta uma hipótese não definida nas decisões do usuário. |
| Regras provisórias fáceis de trocar | Parcial | Multiplicadores/tolerância em configuração; demais regras em SQL e constantes repetidas no extrator. Não há uma fonte única para todas. |
| Conferência com filtros na URL | Atendido | Fatura, situação, tabela, tipo, código, cidade e serviço. |
| Colunas completas, incluindo fator e regra | Parcial | Mostra rótulo do fator, não seu valor numérico. Para contrato não validado, tabela/regra também se perde na junção. |
| Justificativa, observação, usuário/data e conferido | Atendido | Implementado; usuário exibido como UUID. Mudança apenas no contrato não reabre revisão. |
| Exportar divergências Excel | Implementado, sem teste completo | Função percorre páginas e exporta; arquivo gerado pelo navegador não foi validado. |
| Cards com totais e pendências | Parcial | Existem; devido é parcial e usa CSC sem coincidência. Não é total contratual definitivo da fatura. |
| Totais por tipo/código/cidade e navegação | Parcial | Crédito visível; devido/débito ficam no title do elemento, diferença não é apresentada como comparação completa. |
| Gráficos no padrão do Painel, escala e hover | Parcial | Barras HTML com escala comum e tooltip nativo; não reproduzem a apresentação do Painel existente. |
| Comparar faturas e filtrar de/até | Implementado, sem amostra múltipla | Código permite comparar; apenas 9844 foi carregada e validada. |
| Quatro partes funcionais, cada commit com checks | Falha | Há quatro commits e checks executados, mas 217804a importa Resumo.tsx, ausente naquele commit; arquivo só entra em cf2b28a. O estado commitado não correspondeu ao estado isolado validado. |
| Relatório e CONTEXTO_GERAL atualizados | Atendido com ressalvas | Arquivos existem. Números refletem as regras implementadas, cuja aderência não estava completamente validada. |
| Memória compartilhada | Atendido | Arquivo comum, AGENTS.md/CLAUDE.md e referência na memória local do Claude. |
| Garantir experiência funcionando de ponta a ponta | Não verificado | Sem navegador, upload real pela UI, exportação visual ou confirmação do Dokploy. |

## Problemas adicionais encontrados

- Linha pode ficar OK com crédito igual ao devido e glosa negativa integral, embora a diferença líquida seja negativa. O significado de OK para crédito, débito e líquido precisa ficar consistente e explícito.
- RC multilinha soma valores ignorando nulos; não exige que todas as linhas tenham contrato conhecido. Além disso, aceita soma normal mesmo com moto confirmada. Pode classificar casos inadequadamente como revisão por soma coincidente.
- Ao escolher CSC como referência para uma divergência, calcula-se um valor de referência útil, mas ele não comprova qual fator era contratualmente aplicável.
- O extrator escreve diretamente a migration 014. Ela já foi aplicada: executar novamente o script pode reescrever uma migration histórica. Deve produzir uma nova carga revisável.
- Os testes existentes comprovam alguns cenários e o bloqueio de leitura sem módulo; não comprovam toda a operação no navegador nem todas as regras de negócio.

## Correção do status de entrega

A implementação tem estrutura e funcionalidades úteis, mas a declaração anterior de escopo concluído foi excessiva. A entrega está em revisão por falta de aderência visual/operacional e lacunas de validação de cálculo. Prioridades: validar contrato e casos reais, explicitar crédito/débito/líquido, completar conferência/resumo no padrão do projeto e testar o fluxo no navegador.

## Revisão posterior — duas planilhas e fatores do contrato (23/10/2026)

Esta seção atualiza os pontos corrigidos sem apagar o diagnóstico da entrega inicial:

- Importador redesenhado no padrão da NEO, com duas origens nomeadas, prévia das quatro equipes, período da Apropriação, progresso e publicação atômica. Arquivos reais cruzados: 21.910 serviços, nenhum ausente/ambíguo após ident_turma.
- Conferência agora mostra equipe/frota e o valor numérico do fator coincidente; detalhe mostra ident_turma. Alterar dados, vínculo ou fatores reabre a revisão manual, mantendo a observação.
- Fatores validados por coordenadas das células do PDF, ordem e extração textual: 215/219 pares numéricos. 99 códigos complementados, incluindo 1.13; apenas quatro dependem da NOTA 10. Extrator deixou de escrever a migration 014.
- RC agregado passou a respeitar a equipe Moto confirmada. Demais ressalvas sobre somas incompletas e pagamento por atendimento permanecem.
- Chrome desktop/celular: prévia/importação simulada com arquivos reais, resultado, erro de arquivo, contrato e equipe. Banco: importação real, preservação/reabertura de revisão, rollback e permissões. O teste do navegador usa respostas interceptadas e não comprova deploy.
- Nova fotografia: 13.101 OK, 13.580 DIVERGENTE, 0 MOTO_PROVAVEL, 652 CODIGO_FORA_CONTRATO, 56 REVISAR_RC_MULTILINHA. Devido parcial 1.030,403921 US. Diagnóstico e perguntas no relatório atualizado.
- Isso não homologa as regras provisórias de glosa/RC/NOTAs, nem resolve todas as lacunas do Resumo e das demais telas apontadas acima.

## Revisão integral dos dois PDFs e notas (23/10/2026)

As tabelas acima registram a auditoria **histórica** da entrega inicial e da primeira revisão. O estado atual do cálculo está no [relatório de Faturamento](faturamento-relatorio.md). Foram lidas todas as páginas disponíveis dos dois PDFs, inclusive as notas finais. As migrations 023–027, testadas com rollback antes da aplicação, corrigiram FATOR RURAL/MOTO por código, transposição de RC para um único código remunerável da lista das notas 2–3, remuneração de RC uma vez por atendimento e reabertura de revisões manuais antigas. A conferência mostra o motivo da transposição e o devido atribuído a uma linha para somar sem duplicidade. O teste visual em Chrome com APIs simuladas e os testes de integração passaram.

Fotografia atual da 9844: **24.785 OK, 642 DIVERGENTE, 1.310 REVISAR_RC_MULTILINHA, 652 CODIGO_FORA_CONTRATO e 0 MOTO_PROVAVEL**, devido parcial **857,921936 US**. Permanecem abertas a NOTA 10 ausente, a ligação PSAP/apoio, o rural de Moto, glosas parciais, a verificação física da coluna Como lançar/notas 8 e a revisão de casos como 5.62. O deploy continua não verificado.

## Redesenho por serviço e nova interface (26/10/2026)

Esta seção cobre as lacunas de interface, Resumo e RC multilinha apontadas acima.

| Requisito | Situação | Evidência |
|---|---|---|
| Conferência responde "quanto pagou a menos e a mais", por serviço | Atendido | `neo_fat_servicos` (028/029/032), `scripts/faturamento-servicos-testar.cjs` |
| RC pago certo numa linha não fica "a revisar" | Atendido | 245530193 confere; `REVISAR_RC_MULTILINHA` não existe no modelo por serviço |
| Totais por serviço fecham com as linhas | Atendido | crédito 917,112183, multas 21,226389, estorno 7,446161 |
| Multas fora do saldo; conferido sai do saldo e da exportação | Atendido | Testes de lista, totais e conferência |
| Lista de faturas com saldo por fatura e 3 cartões | Atendido | `Faturas.tsx`, teste de UI |
| Resumo legível, filtro sem data nativa, legenda pequena | Atendido | Teste de UI: nenhum `input[type=date]`, legenda até 12 px |
| Janela de detalhe (X, Cancelar, Esc) | Atendido | Teste de UI |
| Exportação para negociação com todas as páginas | Atendido | Teste de UI com 1.500 serviços por lado |
| Importação: substituição confirmada, arquivo idêntico e duplicidade | Atendido | Migration 033, teste de planilhas e de UI |
| Valor Moto no contrato; rural oculto | Atendido | `faturamentoMoto.ts`, teste de texto, 6.01 "sem desconto" |
| Documentação para leigos, fora da sidebar | Atendido | `/faturamento/documentacao`, teste de UI |
| Tela abre com os últimos dados | Atendido | `cacheTela.ts` (cache bloqueado não quebra a tela) |
| Celular 390 px sem rolagem horizontal | Atendido | Teste de UI em seis rotas |
| Deploy no Dokploy e uso com login real | **Não verificado** | Teste de UI usa APIs simuladas |
| Regras de negócio abertas (NOTA 10, PSAP, rural de Moto, 5.62) | **Sem mudança** | Ver perguntas no relatório |
