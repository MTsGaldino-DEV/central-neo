# Faturamento: homem-hora, despacho COD e área pela fatura completa

Data: 27/10/2026. Conversa entre Matheus e Claude. Fatura de referência: 9844.

## Por que

Os códigos 1.62, 1.73, 5.63 e 5.64 ("remunerado por homem-hora, NOTA 10")
hoje ficam fora do contrato: não têm fator, e a conferência não diz se a CEMIG
pagou certo. Além disso, o sistema escolhe CSC ou COD pelo valor que coincide com
o pagamento, então nunca acusa um serviço COD pago como CSC (ou o contrário).
Matheus trouxe as regras que faltavam: a Tabela 14 do contrato, a lista de tipos
de serviço despachados pelo COD e a coluna de área da Fatura Completa.

Sucesso: o devido desses serviços aparece calculado, e a diferença em relação ao
pago vira argumento de negociação com a CEMIG.

## Regras decididas pelo Matheus

### 1. Despacho CSC × COD (todos os códigos)

- O serviço é **COD** quando o `tipo_serv` está na lista do COD; caso contrário,
  é **CSC**. Não se escolhe mais pelo valor que coincide.
- Lista (43 tipos): MA01, MA02, MA04, MA05, MA06, MA07, MA09, MA10, MA13, MA14,
  MA15, MA16, MA17, MA18, MA27, MA30, MA31, MA35, MA36, MA39, MA48, MA49, MA50,
  MA51, MA62, MA63, MA64, MA65, MA66, MA67, MA70, MA77, MA93, MA94, MA95, MAB8,
  MAC1, MACT, NSRI, RC08, RC09, RC11 e **RC01** (acrescentado por Matheus).
- Origem: `cod.md` (2.899 linhas = os serviços desses tipos na 9844). O arquivo
  deve ser apagado após a implementação.
- Validação na 9844 (linhas em que CSC ≠ COD): tipos da lista → 1.350 pagas
  como COD, 6 como CSC (RC08); fora da lista → 12 pagas como COD (RC01 ×3,
  RC04, RC06, RC07 ×5, RC21, RC36). Com RC01 na lista, os outros 9 passam a
  aparecer como **pago a mais** (decisão do Matheus), e os 6 RC08 como pago a menos.

### 2. Área urbana × rural (todos os códigos)

- A área vem da **Fatura Completa, aba Serviço, coluna AN `cod_tip_area`**:
  `U` = urbano, `R` = rural, `S` = **rural** (provisório; ver pendências).
- A **quantidade** continua vindo das colunas da Fatura Resumida
  (`qtdurbanohn` K + `qtdruralhn` M); só a decisão de área muda de fonte.
- Validação na 9844: K↔U 20.798 linhas, M↔R 5.962, nenhuma divergência; 10 linhas
  com `S` (9 tinham K, ou seja, viravam urbanas; agora são rurais).

### 3. Homem-hora (1.62, 1.73, 5.63, 5.64)

- Horas = `dh_terreal` (coluna L) − `dh_aciona` (coluna I) da aba Serviço da
  Fatura Completa, **por minuto, sem arredondar a hora** (igual à CEMIG; 61/61
  serviços 1.62 da 9844 conferem com essa conta).
- Valor por hora = **Tabela 14** ("Remuneração de prontidão", em US/h), pela
  equipe do serviço.
- Multiplicador: **1 + 0,2 se COD + 0,2 se rural** (CSC urbano 1,0; CSC rural 1,2;
  COD urbano 1,2; COD rural 1,4). Soma, não produto.
- Devido = horas × US/h × multiplicador, arredondado a 6 casas.
- Simulação 9844: devido 10,1358 US contra 7,6662 pagos (a CEMIG usou 0,1097 × 1,0
  em todos, sem equipe, COD ou rural): 2,47 US a menos, cerca de R$ 7.320.

Tabela 14 (do contrato, imagem enviada por Matheus), colunas que o sistema usa:

| Elementos | Caminhão | Caminhonete | Motocicleta |
|---|---|---|---|
| 4 | 0,1753 | – | – |
| 2 | 0,1453 | 0,1097 | – |
| 1 | 0,1275 | 0,0922 | 0,0366 |

## Decisões do Claude (Matheus pode corrigir)

- **Equipe → linha da Tabela 14** (proposta na conversa, sem objeção):
  D (dupla/multifuncional) = caminhonete 2 → 0,1097; U (umpla) = caminhonete 1 →
  0,0922; M (moto) = motocicleta 1 → 0,0366; Q (quarteto) = caminhão 4 → 0,1753.
  Guardado como tabela editável, não fixo no código.
- Homem-hora não usa o fator Moto (0,7/0,9): a própria Tabela 14 já tem a coluna
  da moto.
- Homem-hora sem equipe identificada, sem horários ou com término antes do
  acionamento fica **sem devido** (fora do contrato), com observação dizendo o que faltou.
- Para os outros códigos, o COD continua usando o `fator_cod` do contrato (não o
  ×1,2), e o rural continua usando o fator rural do código / `neo_fat_config`.
- Sem `cod_tip_area` (faturas antigas, serviço ausente da aba Serviço), a área cai
  no comportamento atual pelas colunas K/M.
- A lista do COD e a Tabela 14 ficam em tabelas do banco, visíveis na tela
  **Tabelas do contrato** (só leitura nesta entrega); mudanças entram na
  "impressão" do cálculo para recalcular as faturas.
- A 9844 já importada não tem os novos campos, e reimportar os mesmos arquivos dá
  "Nada mudou". Um script de carga preenche os campos da 9844 a partir do
  `RelatorioDadosFatura9844…xlsx`; importações novas já gravam tudo.

## Fora do escopo

- Turmas de linha viva, caminhão com 2/3/5–9 elementos e "sem veículo": não há
  como identificar pela fatura hoje.
- Hora extra da linha viva (US/h extra).
- Edição pela tela da lista do COD e da Tabela 14.
- Mudar a regra de quantidade (K/M) ou de RC por atendimento/transposição.

## O que muda (para quem vai construir)

Banco (nova migration, 039):
- `neo_fat_despacho_cod(tipo_serv pk, ativo)` com os 43 tipos.
- `neo_fat_prontidao(tipo_turma pk, elementos, veiculo, us_hora)` com D/U/M/Q.
- Marcar 1.62, 1.73, 5.63, 5.64 como homem-hora em `neo_fat_contrato`
  (ex.: coluna `remuneracao`), e torná-los utilizáveis pelo cálculo apesar de
  `fator_csc/fator_cod` nulos.
- Aba Serviço guardada com `dh_aciona`, `dh_terreal` e `cod_tip_area` (já passa
  por `neo_fat_lotes` → `neo_fat_anexos` aba `Servico`; aceitar e ler os campos).
- `neo_fat_base`: despacho pela lista; área por `cod_tip_area`; devido do
  despacho não escolhido fica nulo, de modo que a seleção de candidatos em
  `neo_fat_calculo` e `neo_fat_servicos` (que já ignora candidatos nulos) passa a
  escolher só entre moto/não moto do despacho certo. Homem-hora preenche o devido
  do despacho com a conta da seção 3 (mesmo valor nas variantes moto).
- Observações por linha: homem-hora mostra "h × US/h × multiplicador"; não
  mostrar mais "colunas L/N/O: regra a confirmar" nem "NOTA: conferir" quando o
  homem-hora foi calculado.
- `neo_fat_impressao_calc` e `neo_fat_impressao`: incluir as duas tabelas novas.

App:
- `lerFaturaCompleta`: ler `dh_aciona`, `dh_terreal` (data/hora do Excel) e
  `cod_tip_area`; enviar junto com os vínculos.
- Janela do serviço ("como o devido foi calculado"): despacho pela lista,
  área pela fatura completa e, no homem-hora, horas, US/h e multiplicador.
- Tabelas do contrato: mostrar a lista do COD e a Tabela 14.
- Documentação da Conferência/Tabelas e `docs/faturamento-relatorio.md`.

Verificação esperada na 9844 (script em transação desfeita):
- 1.62: 61 serviços com devido, 39 rurais e 22 urbanos, total 9,9655 US (5,5212
  + 3,7276 + 0,6669 + 0,0498), todos COD; 5.63/5.64: 2 serviços por hora, 0,071586 US.
  *(Na implementação: os 5.64 de RC05/RC15 vêm com o código 0.00, não há transposição e o RC
  continua pago; a simulação inicial de 4 serviços / 0,1703 US não considerava isso.)*
- Os 9 serviços RC04/RC06/RC07/RC21/RC36 pagos como COD → pago a mais; os 6 RC08
  pagos como CSC → pago a menos; RC01 confere.
- Contagem geral de OK/a menos/a mais antes e depois, com a explicação das mudanças.

## Pendências

- **Perguntar à supervisora Elen o que é `S` em `cod_tip_area`** (hoje tratado como rural).
- Matheus vai ensinar outros critérios de CSC × COD, se houver além da lista.
