# Vídeo Central NEO · UEN 211

Produção de 26/10/2026, com voz enviada pelo Matheus. Escopo: manutenção do setor
UEN 211, acompanhamento dos serviços e comparação de faturas, sem TraceOne.

## Arquivos de entrega

Em `entregas/central-neo/` (pasta local, fora do Git):

- `Central-NEO-UEN-211.mp4`: apresentação para TV, 1920×1080, 30 fps, H.264/AAC.
- `Central-NEO-UEN-211-capa.jpg`: imagem de referência.
- `Central-NEO-UEN-211.srt`: legendas opcionais; não estão gravadas na imagem.

Duração: 88,607 segundos, seguindo a voz original. Marca: Central NEO e UEN 211.

## Fontes visuais e dados

`preparar.cjs` consulta o CENTRAL-NEO em transação **somente leitura**. Captura o
aplicativo local com o código atual, substituindo apenas a sessão/respostas de
rede por respostas locais com esses dados. Nenhuma importação, conferência ou
alteração é gravada no banco. A prévia das duas planilhas é calculada localmente.

Exemplo real: fatura 9844, serviço 246445398, código 1.21. A conversão de US é a
configuração atual do aplicativo. Valores apresentados como saldos para análise,
não como receitas já recuperadas. Dados brutos e capturas ficam em
`.tmp-faturamento/video-central-neo/`, já ignorado pelo Git.

Manrope e JetBrains Mono são obtidas do repositório Google Fonts para a área
temporária. Marca desenhada a partir de `src/components/NeoLogo.tsx`. Referências:
os dois vídeos enviados, sem reutilizar suas imagens ou suas trilhas.

## Produção local

Requisitos: Node, Python com NumPy, FFmpeg/FFprobe, Chrome, Playwright existente
em `.tmp-faturamento/browser`, cliente postgres do TraceOne e `.env` local.

1. Manter o Vite do projeto acessível em `http://127.0.0.1:5173`.
2. `node video/central-neo/preparar.cjs`
3. `node video/central-neo/renderizar.cjs --previa` gera as capturas de revisão.
4. `node video/central-neo/renderizar.cjs` gera a imagem H.264 sem áudio.
5. `python video/central-neo/finalizar.py` cria a trilha original, as legendas e
   o MP4 com voz e trilha em estéreo. Usa `transcricao.json` da área temporária
   para as legendas; os cortes visuais já estão fixados na montagem.

O áudio de entrada é o MP3 do ElevenLabs enviado em `Importação/`, identificado
pelo prefixo `ElevenLabs_2026-10-26T19_51_46`. Nenhuma credencial é incluída nas
capturas ou nos arquivos finais. A trilha é sintetizada localmente pelo finalizador.

A transcrição foi obtida localmente com faster-whisper/base, apenas para alinhar
os cortes e criar as legendas. As únicas transferências dessa etapa são o download
do modelo e das fontes; o áudio não foi enviado a serviço de transcrição.
