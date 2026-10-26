# Central NEO — geração da narração no ElevenLabs

Preparado em 26/10/2026. Guia de produção da voz para o motion design de até
2 minutos. Complementa `video-central-neo-roteiro.md`.

Atualização de produção: Matheus entregou o áudio Hale / ElevenLabs v4 de
88,607 segundos e autorizou usar essa duração no vídeo. A meta de 1min50s abaixo
é histórica da preparação; não é necessário gerar nova narração.

## Modelo e configuração

Este texto foi preparado com audio tags, para Eleven v4 ou Eleven v3. Usar Eleven
v4 como primeira opção, se disponível na conta, conforme a recomendação atual do
fornecedor. As mesmas marcações são aceitas pelo v3. Não colar esta versão no
Multilingual v2: esse modelo usa outra forma de controlar as pausas.

| Campo | Ponto de partida proposto |
|---|---|
| Ferramenta | Text to Speech |
| Modelo | Eleven v4; alternativa compatível: Eleven v3 |
| Voz | Masculina, nativa de português brasileiro, adulta, natural e próxima |
| Speed, no v4 | 1,0 inicialmente; experimentar 0,95 se a leitura estiver corrida |
| Stability, no v4 | 50% como ponto de partida, ajustando conforme a voz |
| Similarity, no v4 | 75% como ponto de partida |
| Style exaggeration, no v4 | 0% inicialmente |
| Configuração no v3 | Começar com os ajustes padrão; Speed e Similarity não estão disponíveis nesse modelo |
| Efeitos | Voz limpa; trilha e efeitos serão adicionados na montagem |

Os números são pontos de partida, não um preset que garante resultado. Priorizar
uma voz com a interpretação desejada nas próprias amostras da biblioteca. O idioma
do texto é detectado no site; o sotaque depende da voz escolhida.

## Como gerar

1. Selecionar o modelo e a voz antes de colar o texto.
2. Gerar uma amostra usando os dois primeiros parágrafos do bloco abaixo.
   Ouvir principalmente a naturalidade e as pronúncias de “Cemig” e “Central NEO”.
3. Se a voz soletrar NEO, experimentar a grafia “Neo” no texto de narração e
   verificar o resultado. A grafia visual da marca permanece NEO.
4. Com a voz escolhida, colar o bloco completo e gerar uma única narração para
   preservar a continuidade. Cabeçalhos e instruções deste guia ficam fora do campo.
5. Buscar uma narração de até aproximadamente 1min50s, reservando espaço à
   abertura, leitura e assinatura. É uma meta: medir o áudio gerado antes da montagem.
6. Se houver apenas um trecho com problema, regenerá-lo com o mesmo modelo,
   voz e ajustes. Enviar também o áudio completo para comparação de continuidade.
7. Baixar a voz pelo histórico em WAV, se possível. MP3 também pode ser usado.
   Enviar o arquivo original para a montagem, sem adicionar trilha.

## Texto para colar — audio tags para v4/v3

As marcações descrevem a interpretação da voz. Pausas curtas e longas não têm
segundos fixos nesses modelos; o tempo final será ajustado na edição. As instruções
de tom usadas aqui são propostas criativas e precisam ser ouvidas na voz escolhida.

```text
[thoughtful] Horas, às vezes dias, conferindo planilhas.
[short pause]
[curious] Como analisar milhares de serviços e saber se a Cemig está pagando conforme o contrato?
[long pause]

[warm, conversational tone] A Central NEO reúne ferramentas para acompanhar a manutenção da UEN duzentos e onze, trazendo mais clareza ao controle dos serviços, do faturamento e dos pagamentos.
[short pause]

[calm, explanatory delivery] Na Manutenção, cada serviço tem seu acompanhamento: o que precisa ser cobrado, os valores solicitados e as etapas até o pagamento. Filtros e indicadores ajudam a localizar pendências e visualizar o andamento do trabalho.
[long pause]

[confident, measured delivery] No Faturamento, você importa dois arquivos: a Fatura Resumida e a Fatura Completa.
[short pause]
A Central cruza os dados e organiza as informações. O trabalho manual de horas dá lugar a consultas e comparações em segundos.
[long pause]

[calm, explanatory delivery] No painel, fica mais fácil entender o pagamento da Cemig. Você visualiza os serviços analisados, compara os valores pagos com o que o contrato prevê e identifica diferenças para mais ou para menos.
[short pause]

Cada diferença pode ser investigada. Ao abrir um serviço, você consulta o pagamento e entende como o valor previsto foi calculado.
[short pause]
Com filtros e exportação, esses dados se tornam uma base organizada para fundamentar questionamentos e negociar com a Cemig com mais clareza e embasamento.
[long pause]

[warm, confident delivery] Central NEO.
[short pause]
Mais controle dos serviços, mais força para negociar e mais clareza para identificar oportunidades de aumentar o faturamento.
```

## Intenção de cada trecho

| Trecho | Voz e pausa | Encontro com a imagem |
|---|---|---|
| Horas/dias e pergunta | Reflexivo, seguido de curiosidade; sustentar a pausa após a pergunta | Planilha, esforço manual e pergunta em destaque |
| Apresentação da Central | Próximo e seguro | Marca e o acompanhamento da manutenção da UEN 211, incluindo faturamento e pagamentos |
| Manutenção | Explicação clara, com leitura confortável | Fila, serviço e etapas |
| Importação e segundos | Ganhar energia com controle; destacar naturalmente “segundos” | Conferência manual e tempo, dois arquivos, organização e entrada do painel |
| Painel | Clareza ao distinguir pago e previsto | Indicadores e comparação ampliados |
| Serviço e negociação | Explicar o caso e concluir com segurança | Detalhe do cálculo e exportação |
| Assinatura | Confiante e acolhedor; pequena pausa após a marca | Símbolo e benefício para a gestão |

Os tempos de cada cena do roteiro visual serão ajustados ao áudio entregue.
Pausas para ler valores e estudar as telas poderão ser ampliadas na montagem,
mantendo o vídeo em até 2 minutos. Não solicitar música, sons de transição ou
animações nas audio tags da narração.

## Compatibilidade e fontes consultadas

Eleven v4 e v3 aceitam audio tags, pontuação e estrutura para interpretação e
pausas; não aceitam pausas SSML `<break time="1s" />`. Multilingual v2 aceita
esse formato SSML. A documentação também explica a influência da voz, os controles
disponíveis por modelo e o download pelo histórico.

- [Text to Speech — página enviada por Matheus](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- [Best practices — interpretação e audio tags](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- [Como adicionar pausas](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses)

Documentação consultada em 26/10/2026. Compatibilidade verificada nas fontes;
nenhuma geração de áudio foi feita pelo Codex. A duração, as pronúncias e a
interpretação ainda dependem da amostra gerada pelo Matheus.
