# Vídeo Central NEO · entrega de 26/10/2026

Arquivo local: `entregas/central-neo/Central-NEO-UEN-211.mp4`.
Tamanho: 36.978.024 bytes (aproximadamente 35,3 MiB).

## Conteúdo

Manutenção da UEN 211 como setor: acompanhamento dos serviços, importação das
duas planilhas, comparação dos pagamentos com o contrato, investigação de um
serviço e organização dos dados para negociar com a CEMIG. Assinatura apenas
Central NEO e UEN 211. As telas e recortes usam o aplicativo atual; TraceOne não aparece.

Narração fornecida por Matheus: Hale/ElevenLabs v4, ritmo preservado. Montagem
autônoma autorizada, com 15 planos sincronizados ao áudio, trilha original
discreta e identidade visual da NEO. Capa JPG e SRT opcional junto ao vídeo.

## Verificações

| Item | Resultado |
|---|---|
| Duração | 88,633 segundos |
| Resolução e formato | 1920×1080, horizontal 16:9 |
| Vídeo | H.264 High nível 4.1, 30 fps |
| Cores | YUV420P, faixa TV, BT.709 |
| Áudio | AAC LC, estéreo, 48 kHz |
| Loudness / pico verdadeiro | -16 LUFS / -4,2 dBFS |
| Decodificação completa | FFmpeg sem erros |
| Revisão visual | 15 prévias e 12 quadros extraídos do MP4 final |
| Sintaxe das ferramentas | Node e Python verificados |

Não houve teste físico na TV da reunião. A codificação utiliza parâmetros comuns
de reprodução em TVs e computadores; a apresentação final pode usar o MP4 diretamente.

## Exemplo usado

Dados consultados em transação somente leitura no CENTRAL-NEO. Capturas via
Chrome headless com sessão local e respostas interceptadas. A tela de importação
lê os arquivos Excel localmente; não conclui uma importação remota.

Fatura 9844, serviço 246445398, código 1.21. Pagamento R$ 0,00, previsto
R$ 974,70, conforme a conversão de US atual do sistema. Saldo a menos de
R$ 22.076,19 em 106 serviços e saldo a mais de R$ 50.398,90 em 172 serviços.
As diferenças aparecem como valores para conferir, não valores recuperados.

O dado de horas/dias no Excel versus comparações em segundos foi fornecido por
Matheus no briefing; não foi acrescentada medição de produtividade à produção.

## Continuidade

- Roteiro: `docs/video-central-neo-roteiro.md`.
- Preparação da voz: `docs/video-central-neo-elevenlabs.md`.
- Fontes de montagem e instruções: `video/central-neo/LEIA-ME.md`.
- Dados e capturas locais: `.tmp-faturamento/video-central-neo/`.
- Verificação detalhada local: `.tmp-faturamento/video-central-neo/verificacao.json`.

SHA-256 do MP4 final:

`a81a81515af609f2e8cae78f702e35b6a10204d8f559815d0645fb3eec83a977`
