# 02 — Estratégia do produto: Central NEO

Classificação: CONFIRMADO / INFERIDO / NÃO VERIFICADO / PLANEJADO, como em `01-project-discovery.md`.

---

## 1. Raciocínio central

**Contexto → Problema → Consequência → Oportunidade → Solução**

- **Contexto (CONFIRMADO).** Uma equipe de manutenção de redes de energia executa serviços sob um contrato com a distribuidora. O contrato define o preço de cada tipo de serviço em unidades próprias (US), com regras de multiplicação por área (urbano/rural), despacho (CSC/COD), tipo de equipe e tempo. A distribuidora devolve o pagamento em faturas com dezenas de milhares de linhas. Ao lado disso, o setor acompanha cada nota de serviço do pedido ao pagamento, controla se as equipes cadastraram jornada e confere quilometragem dos veículos.
- **Problema (CONFIRMADO como processo anterior; INFERIDO como dor).** Esse acompanhamento vivia em planilhas (controle de notas, disponibilidade com macro VBA), em consulta manual a relatórios e em contas de quilometragem feitas à mão. Cada planilha guardava uma parte da regra, sem histórico de quem mudou o quê e sem ligação entre as etapas.
- **Consequência (INFERIDO).** Conferir uma fatura inteira contra o contrato exige horas, às vezes dias; diferenças pequenas e repetidas passam despercebidas; o setor negocia com a distribuidora sem um relatório objetivo por serviço; a multa por equipe parada é estimada manualmente. A memória do projeto registra o gancho "horas ou dias no Excel × análises em segundos", mas **como relato do briefing, não como medição** (NÃO VERIFICADO).
- **Oportunidade.** Transformar as regras do contrato em código e dados versionados, para que o computador faça a conferência exaustiva e a pessoa fique com a decisão e a negociação.
- **Solução (CONFIRMADO).** Uma central web com módulos por frente de trabalho, login único e acesso por módulo, em que cada regra de negócio tem lugar definido (banco, função pura ou tabela editável com motivo).

## 2. Proposta de valor (uma frase)

> A Central NEO transforma as regras do contrato e as planilhas do dia a dia da manutenção em um fluxo único e rastreável, para que o setor saiba o que executou, o que cobrou e o que a distribuidora realmente pagou.

(INFERIDO a partir do conjunto; a direção de mensagem do vídeo institucional confirma a ideia de "clareza no controle dos serviços, do faturamento e dos pagamentos".)

## 3. Público-alvo

| Público | Evidência | Classificação |
|---|---|---|
| Equipe do NEO / UEN 211, em especial quem fecha as notas, quem confere a fatura e quem confere a frota | Módulos, papéis ADMIN/USUARIO, módulos `fechamento`, `faturamento`, `disponibilidade`, `traceone` | CONFIRMADO |
| Gestão e diretoria (consumo do painel e do vídeo institucional) | Memória do vídeo de 26/10/2026 | CONFIRMADO |
| Supervisores de campo (filtro por supervisor na disponibilidade) | `?sup=` na rota de disponibilidade | CONFIRMADO |
| Usuários externos ou clientes pagantes | Nenhuma evidência | NÃO VERIFICADO; o produto parece de uso interno |

## 4. Desafio de negócio × desafio de desenvolvimento

**Desafio de negócio (CONFIRMADO/INFERIDO)**
- Dar rastreabilidade a um processo longo (relatório → pedido → confirmação → lançamento → apropriação → fatura) que passa por vários sistemas externos.
- Verificar pagamentos contra um contrato com muitas exceções, sem que a conferência dependa da memória de quem a faz.
- Substituir planilhas que as equipes já conhecem sem perder o formato que elas usam (exportação em Excel no formato da planilha).

**Desafio de desenvolvimento (CONFIRMADO)**
- Modelar regras contratuais (transposição de código, RC por atendimento, despacho, área, homem-hora, glosa) com precisão de seis casas decimais e tolerância definida.
- Processar faturas de mais de 27 mil linhas sem estourar limites da API (consultas por RPC, cache de cálculo por serviço, paginação por função de banco).
- Manter dois bancos e duas sessões (NEO e TraceOne) sem misturar permissões.
- Fazer leitura de PDF e planilhas inteiramente no navegador, com limpeza de dados de GPS.
- Construir uma grade de quase 2 mil células com interação fluida.

## 5. Diferenciais de produto

1. **Motor de conferência contratual por serviço**, com regras explícitas, cobertas por scripts de teste de integração.
2. **Rastreabilidade por desenho**: dado original preservado, contrato com histórico e motivo de cada acerto, valor lançado que não muda quando o contrato é corrigido, log de exclusão, planilha de auditoria exportável.
3. **Ferramentas que substituem rotinas manuais com lógica própria**: Cálculo de KM (limpeza de pontos falsos de GPS, status por trecho, km linear do contrato) e Disponibilidade (regras de multa, fim de semana automático, painel anual).

Detalhamento em `05-portfolio-case.md` §10.

## 6. Posicionamento do case

- **Não é** "mais um sistema de gestão". É um produto que resolve um problema financeiro e operacional específico, com domínio de regras que um desenvolvedor só dominaria entendendo o negócio.
- **Narrativa:** de uma planilha a um sistema em que cada regra tem endereço. Mostrar que o desenvolvedor entende o problema (contexto contratual), projeta a solução (módulos, banco, regras), cuida da experiência (design próprio, painéis, filtros) e opera (deploy, migrações, testes).
- **Tom:** profissional, sóbrio e específico, coerente com a marca da própria Central NEO (petróleo e cobre, tipografia limpa).
- **Funciona sem demo pública**: o conteúdo depende de capturas e diagramas, não de acesso ao software.

## 7. Limites para o discurso

Evitar: percentuais de ganho de tempo ou de dinheiro; "milhões recuperados"; número de usuários; afirmação de que a distribuidora aceitou as conferências; nomes de pessoas; valores contratuais e financeiros reais. Chamar de **benefícios esperados** o que não tem medição. Ver `08-verification-report.md`.

## 8. Perguntas estratégicas em aberto

Resumidas e priorizadas em `08-verification-report.md` §6 (motivação original, se foi encomenda ou iniciativa própria, existência de resultado mensurável, autorização para publicar nome da distribuidora e do setor, estado real em produção).
