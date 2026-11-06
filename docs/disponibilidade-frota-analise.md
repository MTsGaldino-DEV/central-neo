# Disponibilidade da frota: como a planilha funciona

Levantamento feito em 06/11/2026 para replicar em sistema a planilha
`Importação/Disponibilidade Contrato 7360_Macro.xlsm` (contrato CEMIG 4680007360-530, UEN 211).
Este documento descreve a planilha e as evidências. O desenho do sistema ainda não foi decidido.

## 1. Para que serve

Registra, por frota e por dia, por que uma equipe não trabalhou a jornada prevista, e estima quanto isso custa.
**Definição do Matheus:** é o cálculo do gasto de uma equipe parada, contando a multa da CEMIG. Os números são para usar como estão.
A CEMIG pode cobrar a multa, mas ele não tem certeza de que está cobrando.

## 2. Estrutura

| Parte | O que é |
|---|---|
| Abas de mês (MARÇO a DEZEMBRO/2026) | Grade: 62 frotas nas linhas (2 a 63) e um dia por coluna. A linha 64 traz os totais |
| Colunas fixas | Supervisão (mesclada por faixa), Item, Placa, Nº de frota, Escala, Horário, Local, Valor |
| Dashboard | Painel com seletor de mês |
| Macro VBA | Só abre a legenda das causas ao abrir o arquivo. Não calcula nada |
| Ocultas, em desuso | Análise de Insights (só `#NAME?`), Dash (só abril), Notas (23/03 a 17/04) |
| Ocultas, referência | Localidades por Postos (cidade → posto 1 a 4), Frota Matheus (13 placas com km e oficina) |

- **Supervisão por linhas:** Vinícius 2–13 (12 frotas), Victor 14–23 (10), Elton 24–37 (14), Pedro 38–63 (26).
- **Proteção:** livro e abas têm senha. Em abril e outubro só os dias (I:AL) ficam editáveis; março e novembro estão inteiros travados, e no Dashboard só o mês.
  Novembro travado pode explicar a falta de lançamentos em 01–06/11 (suposição).
- **Comentários:** 58 células têm observações livres (oficina, "senta e levanta" com outra equipe, nomes e atestados). Há dados pessoais e de saúde.
- **Grade igual em todos os meses:** placa, escala e horário não têm histórico.

## 3. Regras de cálculo

| Grupo | Causas | Valor | Cor |
|---|---|---|---|
| Multável | Veículo Quebrado, Atraso superior a 4h, Descadastramento Antecipado | R$ 864 por frota-dia | Vermelho (`#FFC7CE` / `#9C0006`) |
| Contestável | Atestado, Treinamento, Folga TAC, Férias, Suspensão, ASO, Interstício | R$ 0 | Verde (`#C6EFCE` / `#006100`) |

- `Valor da frota no mês = ocorrências multáveis × 864`. O total do mês soma as frotas, e a linha 64 traz o total por dia.
- Maiúsculas e minúsculas não mudam a conta. Só o texto exato da causa conta como multa.
- Cada célula guarda uma causa por frota-dia.
- Fora da lista, existem à mão: "Férias de 2 colaboradores" (7), "atestado + férias" (3), "Equipe Desativada" (1). Valem R$ 0.
- O "." não significa nada (Matheus, 06/11/2026): ignorar os 160 na importação.
- Março tem layout antigo: Valor em F, dias em G:O, sem Escala e Horário, e não conta Descadastramento.

## 4. Totais de referência

Recontagem de todas as células de dia, somando **274 multáveis** e 757 outras (fora os "." e uma célula só com espaço).

| Mês | Planilha | Recontado |
|---|---:|---:|
| Mar (desde 23/03) | 22.464 | 22.464 |
| Abr | 59.616 | 59.616 |
| Mai | 34.560 | 34.560 |
| Jun | 20.736 | 20.736 |
| Jul | 29.376 | 30.240 |
| Ago | 34.560 | 36.288 |
| Set | 25.056 | 25.056 |
| Out | 7.776 | 7.776 |
| **Total** | **234.144** | **236.736** |

Por supervisão (recontado): Elton 84.672, Vinícius 55.296, Pedro 52.704, Victor 44.064.
Por causa: Veículo Quebrado 141, Atraso 96, Descadastramento 37. A queda de outubro foi confirmada pelo Matheus como provavelmente real.

## 5. O painel

Indicadores: total do mês, frotas com multa, total anual, comparação com o mês anterior, status, ranking por supervisão,
causas, evolução mensal, valor potencial de veículo quebrado, supervisão crítica, top frotas e frota × operação (veículo quebrado × todas as outras causas).

Status: verde se zero, amarelo abaixo de R$ 30.000 no mês (R$ 10.000 por supervisão), vermelho acima.

**Não replicar estes erros:**

1. Valor da frota ignora a coluna AM: maio, julho, agosto, outubro e dezembro perdem o dia 31 (R$ 2.592 até agora).
2. Total Anual dá `#REF!`, e o painel lê `H64` de março (R$ 2.592) no lugar de `F64` (R$ 22.464).
3. Abril aparece como +2200% sobre março; o certo é +165%. A comparação só existe para abril e maio.
4. A série do gráfico mensal soma a linha de total e dobra os valores. Tabela e gráfico param em julho.
5. `*ASO*` também encontra "Atr**aso**": em abril, Atestado/ASO mostra 71, e o certo é 43.
6. Supervisão e Meta não mudam nada. Junho e julho usam regra de cor diferente.
7. O "Top 5" mostra 3, repete a frota em caso de empate, e a 2ª linha busca o supervisor do 3º.
8. Abas de 31 dias e listas de causas variam de mês para mês (Interstício falta em julho, agosto, novembro e dezembro).

## 6. O que está por trás dos lançamentos

A aba `Turma` da Fatura Completa traz início (`horijr`) e fim (`horfjr`) de cada jornada por frota (`numvei`), com placa.
Cruzei com a grade na fatura 9844 (02/09 a 01/10/2026):

| Lançamento | Casos | Sem jornada no dia | Observação |
|---|---:|---:|---|
| Veículo Quebrado | 12 | 12 | Sempre sem jornada |
| Descadastramento Antecipado | 4 | 0 | Todos saíram mais de 4h antes (4,2h a 9,8h) |
| Atraso superior a 4h | 12 | 6 | 4 entraram cerca de 4h ou mais depois (4,0h a 6,9h); 2 não encaixam |
| Férias | 17 | 17 | |
| Folga TAC | 5 | 5 | |
| Atestado | 25 | 22 | |
| Treinamento | 28 | 24 | |
| ASO | 2 | 0 | |

Conclusão provável (dedução, a confirmar com quem preenche):

- **Sem jornada:** a equipe não cadastrou. A causa vem de fora do sistema, pelo supervisor.
- **Entrou mais de 4h depois do horário:** Atraso superior a 4h.
- **Saiu antes do horário:** Descadastramento Antecipado. Os 4 casos passam de 4h, mas o limite real não está escrito.

**Limites para automatizar:**

- De 89 frota-dias com mais de 4h de diferença e sem lançamento (02–30/09), 78 vêm de 6 frotas com a jornada sempre deslocada cerca de 5h (4593, 9642, 9693, 4733, 4565, 4377). O horário da grade parece desatualizado.
- Dos outros 11, 8 são em fim de semana e 3 em dia útil (7924 em 17/09; 4052 e 9477 em 30/09). Esses 3 podem ser ocorrências não lançadas.
- Faltam na fonte: feriados (07/09 aparece sem jornada), o ciclo de folgas das frotas 4x2 e a causa da parada.
- As frotas 6366 e 9475 não têm jornada alguma na fatura. A 6366 tem 22 dias úteis sem jornada e sem lançamento. Não se sabe se a aba omite jornadas sem serviço.
- A fatura é mensal e chega depois: serve para conferir, não para lançar no dia.

## 7. A CEMIG está cobrando?

**Na fatura 9844, não aparece.** Os 444 débitos são `glosa_relatorio_PE` (64,96 US), cada um ligado a um serviço, sem frota nem dia.
`usmulta` está zerado em todas as cidades, e nenhum débito tem o formato frota-dia. Na planilha, setembro estima R$ 25.056.
Isso vale só para essa fatura e não exclui cobrança por outro meio. O valor de R$ 864 também não aparece nos PDFs de texto do repositório.

## 8. Ferramentas

- `C:\Engenharia Reversa\rea-main` (REA) é voltada a binários e aplicativos, e seus documentos e código não citam planilhas. Não foi usada nem é necessária: o conteúdo do `.xlsm`, inclusive a macro, foi lido direto.
- A leitura foi feita com openpyxl e oletools, sem abrir no Excel. Não vi o painel desenhado na tela (sem LibreOffice nesta máquina).
