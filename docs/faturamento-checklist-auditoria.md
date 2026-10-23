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
