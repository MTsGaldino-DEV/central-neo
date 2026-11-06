# Disponibilidade da frota: desenho

Aprovado por Matheus em 06/11/2026 sobre o modelo clicável (`.superpowers/brainstorm/896-1793974391/content/disponibilidade-v5.html`).
Levantamento da planilha: [disponibilidade-frota-analise.md](../../disponibilidade-frota-analise.md).

## Por quê

Toda manhã, uma pessoa confere no GDIS, equipe por equipe, quem cadastrou no dia anterior, e registra o motivo de quem não cadastrou numa planilha.
A planilha estima quanto custa uma equipe parada, contando a multa da CEMIG, e tem um painel com erros. O sistema substitui a planilha mantendo os mesmos números.

## Objetivos

- Lançar o que houve com cada frota em cada dia, com motivos prontos, e ver o mês inteiro numa só tela.
- Acompanhar o resultado num painel confiável, no estilo do painel da planilha.

## Fora do escopo

- Ler o GDIS ou a fatura para preencher sozinho. O lançamento continua manual.
- Tela para editar frotas, escalas e horários. A grade entra por migration.
- Registrar a multa cobrada de fato e o resultado das contestações.
- Importar os comentários da planilha: têm nomes e dados de saúde.

## Decisões do Matheus

- **Valor:** R$ 864 por ocorrência multável, mostrado como negativo.
- **Multáveis:** Veículo Quebrado, Atraso superior a 4h, Descadastramento Antecipado.
- **Contestáveis (R$ 0):** Atestado, Treinamento, Folga TAC, Férias, Suspensão, ASO, Interstício.
- **Duas visões com botão de troca.** A visão mensal é a principal ao entrar na aba.
- **Visão do dia:** lista de todas as equipes, com Cadastrou / Não cadastrou e motivos prontos; mini calendário ao clicar na data.
- **Visão do mês:** frotas nas linhas e dias nas colunas; clicar na célula marca o dia e clicar na frota mostra o que houve com ela.
- **Evolução mensal com barras para cima.** Lista centralizada.
- **Meta do mês só o admin define.** Os demais veem o valor, sem editar.
- **Componentes com shadcn.**
- O "." da planilha não significa nada.

## Decisões do Claude, a confirmar pelo uso

- **Quem marca:** quem tem o módulo novo `disponibilidade` lê e marca; ADMIN sempre. A pergunta sobre supervisores ficou sem resposta; basta não dar o módulo a quem não deve marcar.
- **Meta inicial:** R$ 30.000, o limite fixo da planilha. Status do mês: zero = Perfeito; até a meta = Atenção; acima = Crítico.
- **Limites herdados da planilha:** supervisão com R$ 10.000; causa com 10 ocorrências (Descadastramento com 5); criticidade com 15% e 25%.
- **Histórico:** dia sem lançamento até 31/10/2026 entra como "Cadastrou", com origem `PLANILHA`. Novembro em diante começa como "Falta conferir".
- **Limpar marcação:** a marcação pode ser desfeita (não estava no modelo). Sem isso, "Marcar as que faltam" não teria volta.
- **Dia futuro** não pode ser marcado, inclusive pelo banco. Início do controle: 23/03/2026.
- **Frota x operação:** soma só as multáveis, para bater com o total do mês (a planilha cobrava R$ 864 dos contestáveis também).

## Dados

- `neo_disp_frotas`: as 62 frotas da grade atual (frota, placa, supervisor, região, escala, horário, local, ordem, ativo).
- `neo_disp_lancamentos`: uma linha por dia e frota. `situacao` CADASTROU ou OCORRENCIA, `causa`, `observacao`, `origem`, quem e quando. Sem linha = falta conferir.
- `neo_disp_config`: linha única com valor da ocorrência e meta mensal.
- O valor em R$ é calculado na leitura (ocorrências multáveis × valor).
- As leituras de mês e ano são RPCs que devolvem JSON, porque um mês passa do limite de 1.000 linhas da API.
- RLS: `neo_tem_modulo('disponibilidade')` para ler e marcar; `neo_is_admin()` para alterar a configuração e as frotas.

## Telas

- `/disponibilidade`: conferência; abre no mês atual em "Mês inteiro". `?visao=dia&dia=AAAA-MM-DD` abre o dia; `?mes=AAAA-MM` escolhe o mês.
- `/disponibilidade/painel`: painel com mês, supervisão, meta, indicadores, ranking, causas, evolução, impacto, top 5 e frota x operação.
- Menu: seção "Frota", itens "Conferência" e "Painel". Módulo novo em Logins e acessos.

## Totais que o histórico precisa reproduzir

1.031 ocorrências, 274 multáveis, R$ 236.736. Mar 22.464; Abr 59.616; Mai 34.560; Jun 20.736; Jul 30.240; Ago 36.288; Set 25.056; Out 7.776.

## Publicação

As migrations não são aplicadas nesta entrega: `migrar.cjs` está proibido (reaplicaria a 051 e a 052) e escrever no banco real pede a autorização do Matheus.
O front só deve ir ao ar depois de aplicar a 054 e a 055.
