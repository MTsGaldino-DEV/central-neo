# Memória compartilhada — Central NEO

Atualizada em 23/10/2026 pelo Codex. Este arquivo é o ponto de continuidade entre
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
- Commit: `<tipo>(<escopo>): <descrição específica>`, seguido de parágrafo:
  `Corrigimos alguns erros e melhoramos a experiência geral. Até Breve, Matheus`.
  Atribuição de autoria, quando utilizada, deve corresponder ao agente real.
- Não incluir arquivos de terceiros no commit nem reescrever histórico.

## Arquitetura e cuidados

- NEO = Núcleo de Eficiência Operacional.
- React 19, TypeScript, Vite 6, Tailwind 4 e React Router 6. Docker/Nginx no Dokploy.
- Supabase CENTRAL-NEO é o banco principal: autenticação, colaboradores, acessos,
  Fechamento e Faturamento. A migração do login principal já ocorreu.
- TraceOne permanece em paralelo e fornece somente o módulo de medidores, com
  cliente, sessão e permissões próprios. Não alterar banco nem app do TraceOne.
- Login único de NEO, NEC, TraceOne e Warefly é objetivo futuro, não integração concluída.
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

## Última entrega: Faturamento

**Revisão em 23/10/2026:** Matheus reprovou o resultado por não atender ao pedido.
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
- Faltam a planilha serviço → veículo/turma, confirmação das regras e revisão dos
  fatores pendentes. A lista completa está no relatório; não inventar esses valores.
- Mudança nos dados da linha reabre revisão manual; mudança apenas no contrato ainda
  não invalida automaticamente a conferência já registrada. Histórico manual guarda
  a última observação por linha; histórico de contrato guarda todos os acertos.
- Verificados: typecheck, build e `node scripts/faturamento-testar.cjs` (rollback,
  cálculo, classificação, preservação de revisão, RLS e resumo). Resumo em cerca de
  1,6 segundo na conexão usada. Há aviso de bundle acima de 500 kB.
- Ainda não verificados: aparência no navegador e deploy do Dokploy.
- `.tmp-faturamento/` contém extrações locais não commitadas; exclusão foi bloqueada
  pela revisão automática. `ns_preventiva_c_fonte.jsp` é arquivo do usuário, fora da entrega.

## Origem da memória

Consolidada a partir da conversa com Matheus, do código e documentação do projeto,
e dos arquivos locais do Claude `central-neo-escopo-mvp.md`,
`commit-mensagem-padrao.md` e `lembrete-contrato-2026-gdis.md`.
Referências antigas sobre todo o app rodar no TraceOne e importar somente NSIS
foram superadas: CENTRAL-NEO é o principal e a migration 008 ampliou os tipos de serviço.
