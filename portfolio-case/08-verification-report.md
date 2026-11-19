# 08 — Relatório de verificação: Central NEO

Data: 19/11/2026. Escopo: investigação **estática** do repositório em `c:\APPWEB\central-neo`. Nada foi executado (sem `dev`, `build`, testes ou scripts), o banco não foi consultado e nenhum arquivo existente do projeto foi alterado (exceção: seção acrescentada ao fim de `MEMORIA_COMPARTILHADA.md`, conforme combinado).

## 1. O que foi lido

- Lido por completo: `CONTEXTO_GERAL.md`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `vercel.json`, `vite.config.ts`, `public/favicon.svg`, `src/components/NeoLogo.tsx`, `src/App.tsx`, `.env.example` (valores mascarados na leitura), seção "Central NEO" de `_portfolio-prints/INVENTARIO.md`.
- Lido em partes: `MEMORIA_COMPARTILHADA.md` (109 KB, 1.099 linhas): preferências, arquitetura, entregas recentes (fila, medidores, disponibilidade, Cálculo de KM, mapeamento, vídeo, listas NSIS/NSRI). Seções antigas de faturamento (23–29/10) foram lidas só por trechos e pelo `docs/faturamento-relatorio.md`.
- Lido em partes: `src/index.css`, `Shell.tsx`, `Inicio.tsx`, `Login.tsx`, `docs/disponibilidade-frota-analise.md`, `docs/video-central-neo-roteiro.md`, `video/central-neo/LEIA-ME.md`, `.gitignore`.
- Verificado por listagem/contagem: `src/`, `scripts/`, `supabase/migrations` (nomes), `supabase/functions`, `docs/`, `entregas/`, `.tmp-faturamento/`, histórico Git (contagem e datas).
- **Não abertos:** `.env` real, `node_modules`, `dist`, planilhas e PDFs de contrato, vídeo, imagens de teste, conteúdo SQL das migrations (só nomes e ocorrências por busca textual), código das telas além dos listados.

## 2. Tabela de afirmações do case

| Afirmação | Classificação | Base |
|---|---|---|
| Produto com módulos Manutenção, Faturamento, Frota, Ferramentas, Administração | CONFIRMADO | `App.tsx`, `Shell.tsx` |
| Stack React 19 / TS strict / Vite 6 / Tailwind 4 / Router 6 / Supabase | CONFIRMADO | `package.json`, `tsconfig.json` |
| 61 migrations, 2 Edge Functions, 32 scripts de teste, ~25,8 mil linhas TS/TSX, 119 commits | CONFIRMADO | contagem de arquivos e `git log` |
| Acesso por módulo conferido no banco (RLS, `neo_tem_modulo`) | CONFIRMADO (existência em 43 migrations) / INFERIDO (cobertura completa de todas as tabelas) | busca textual |
| Edge Function `admin-usuarios` valida admin antes de usar a chave de serviço | CONFIRMADO | trecho do código |
| Cálculo de KM 100% no navegador, sem IA | CONFIRMADO (código e dependências); "nada vai para o banco" CONFIRMADO por documentação | `CalculoKm.tsx`, `calculoKm*.ts`, `CONTEXTO_GERAL.md` §8 |
| Regras de faturamento (transposição RC, despacho COD/CSC, área, homem-hora, glosa) | CONFIRMADO como documentadas e implementadas em migrations nomeadas; **correção financeira NÃO VERIFICADA** | `docs/faturamento-relatorio.md`, migrations |
| Fluxo de etapas da NSIS (novo e histórico) | CONFIRMADO | `fechamentoFluxo.ts`, memória |
| Disponibilidade com regra de multa, fim de semana automático, painel anual | CONFIRMADO (documentação + migrations 054–060) | memória, nomes de arquivos |
| Identidade visual: símbolo, paleta, tipografia, textura, login animado | CONFIRMADO | `index.css`, `NeoLogo.tsx`, `CircuitoAnimado.tsx` |
| Tagline "Cada nota aberta, até o último centavo fechado." | CONFIRMADO | `Login.tsx` |
| Testes de interface em 390/1440/1920 sem rolagem lateral | CONFIRMADO como registro do autor; **não reexecutado** | memória |
| Medições de performance da grade (869 ms → 1,8 ms) | CONFIRMADO como registro do autor; **não reproduzido** | memória |
| Vídeo institucional de ~88 s | CONFIRMADO como produzido (memória e LEIA-ME); arquivo **não aberto** | memória, `entregas/` |
| Deploy na Vercel | CONFIRMADO (`vercel.json`; deploy citado na memória em 05/11/2026) | — |
| Aplicação "em uso" por equipes reais | NÃO VERIFICADO (afirmado em inventário/memória, sem evidência de uso) | `INVENTARIO.md` |
| Nº de usuários, frequência de uso, ganho de tempo, valores recuperados | NÃO VERIFICADO — **não aparecem no case** | — |
| Tempo "horas/dias no Excel × segundos" | NÃO VERIFICADO (relato de briefing, sem medição) — só como benefício esperado | memória do vídeo |
| Integração com o GIRO em operação | NÃO VERIFICADO (código presente) | `supabase/functions/giro-colaboradores` |
| Login único NEO/NEC/TraceOne/Warefly | PLANEJADO | `CONTEXTO_GERAL.md` §2 |
| Sincronização com GDIS | PLANEJADO | memória (22/10 e 04/11) |
| Notas de Ouvidoria, Conciliação CEMIG | PLANEJADO | `Shell.tsx` (itens desabilitados) |
| Conferência da disponibilidade pela fatura (aba de turma) | PLANEJADO | `CONTEXTO_GERAL.md` §9 |
| Projeto de cliente ou iniciativa própria | NÃO VERIFICADO | — |
| Desenvolvimento por uma só pessoa | NÃO VERIFICADO: a memória mostra trabalho alternado de dois assistentes de IA (Claude e Codex) sob direção do responsável. O case usa "o desenvolvedor responsável" | memória |

## 3. Inferências usadas no texto

- A dor do processo anterior (esforço de conferência, risco de diferenças passarem despercebidas) é inferida do tipo de planilha substituída e do tamanho da fatura. Não há medição.
- "Cobre separa dinheiro de ação" e outras leituras de design são interpretações do uso das cores, não uma intenção documentada além da do símbolo e do uso do cobre em valores e divergências.
- A frase de encerramento do case é redação editorial, não citação do projeto.

## 4. Divergências e limitações encontradas

1. **Fontes:** memória cita Archivo/Atkinson (registro antigo); o código usa Inter, JetBrains Mono e Manrope (logo). Vale o código.
2. **Contagem de migrations:** `CONTEXTO_GERAL.md` cita 001–012 na árvore; existem 61.
3. **Nome da fila:** "Fila de NSIS" virou "Fila de fechamento" (19/11/2026); documentos antigos usam o nome velho.
4. **Cabeçalho da memória:** diz "Atualizada em 11/11/2026", mas contém seções de 16–19/11.
5. **Entrega de Faturamento "reprovada" na primeira versão:** o status atual registrado é de revisão. O case apresenta o módulo como implementado, mas **a validação de negócio das regras depende do responsável**.
6. **Pendências de teste:** `manutencao-ui-testar` falhava num passo e o simulado de filtro por `tipo_serv` precisa de ajuste (registro de 19/11/2026). Dois scripts de faturamento gravam no banco de verdade (incidente de 05/11/2026). Não há CI.
7. **Backend fora do Git:** `supabase/` está no `.gitignore` por decisão do autor, então migrations e funções não estão versionadas no remoto. Isso limita a evidência pública e é um risco operacional.
8. **Dependência do TraceOne:** scripts de banco usam um módulo do projeto vizinho; Lista de Medidores depende de um segundo banco.
9. **Código sem rota:** telas copiadas do TraceOne permanecem no disco sem rota.
10. **Cards "Contrato 2026 × Tabela CEMIG × Pago" do Painel da Manutenção** podem aparecer zerados porque os itens do histórico não têm código (pendência registrada). Não usar essa tela como vitrine de resultado sem dados de demonstração.
11. **Valor da unidade contratual:** o início da vigência de 24/05/2025 foi registrado como suposição de reajuste anual ainda a confirmar.

## 5. Privacidade e autorização para publicar

**Precisa de autorização do responsável e, quando aplicável, da empresa/cliente antes de publicar:**
- Nome da **distribuidora** e do **setor/unidade regional** (UEN 211), citados neste material apenas em arquivos de análise (`01`, `02`, `03`, `07`, `08`, nos diagramas e na memória); o texto de `05` e `06` usa "a distribuidora" e "a unidade regional". A sigla do setor aparece na capa e no nome de arquivo do vídeo institucional.
- Existência e características do **contrato** (tabelas, códigos, regras de multa), mesmo sem valores. O texto do case descreve regras em termos gerais; confirmar se isso é aceitável.
- **Capa e conteúdo do vídeo institucional** (dados reais autorizados pelo autor para a apresentação interna; autorização para uso público é outra questão).
- Menção à **tecnologia do sistema de despacho** e ao sistema "TraceOne", "GIRO" e "Warefly" (outros produtos do mesmo ecossistema).
- Qualquer captura de tela: dados reais do sistema não podem aparecer (ver `07`).

**Foram deliberadamente omitidos deste material:** valores em R$/US, valor da unidade contratual, total de faturas, número de faturas e de serviços específicos, nomes de pessoas (inclusive supervisores e administrador), e-mails, CPF, matrículas, placas, números de contrato, nomes de projetos Supabase, URLs e chaves. As **contagens agregadas de escala** (por exemplo, "mais de 27 mil linhas por fatura") derivam de uma fatura real; decidir se podem ser publicadas.

**Observação sobre o `.env` do projeto:** existe um `.env` com credenciais na pasta do projeto, ignorado pelo Git. Ele não foi aberto. `.env.example` foi lido com valores mascarados.

**Observação sobre o rodapé do login:** contém crédito de autoria do desenvolvedor. O case não reproduz esse texto.

## 6. Perguntas prioritárias ao responsável

1. **Origem e contexto:** o projeto nasceu por encomenda da empresa, por iniciativa própria ou por pedido de uma gestão? Quem é o "cliente" do ponto de vista do portfólio?
2. **Produção:** o sistema está em uso diário? Por quantas pessoas e desde quando? Qual a URL (se pública)?
3. **Resultados:** existe alguma métrica com fonte (tempo de conferência antes e depois, valor identificado em negociação, número de faturas conferidas)? Pode ser publicada?
4. **Autorização:** a empresa autoriza o uso do nome da distribuidora, da sigla do setor, de screenshots com dados fictícios e do vídeo institucional?
5. **Processo anterior:** como a conferência era feita antes (quem, quanto tempo, com quais arquivos)? Isso sustenta a seção "O problema" com mais precisão.
6. **Participação de IA:** como o autor quer descrever o uso de assistentes de IA no desenvolvimento (transparência do processo)?
7. **Marca:** há decisões de branding (por que "o círculo que fecha", por que petróleo e cobre) que valem ser explicadas com as palavras do autor?
8. **Validação das regras:** as regras do faturamento foram validadas pela área responsável? Há registro? Isso muda o tom do case.
9. **Crédito:** como o autor quer assinar o case (nome, título, links)?
10. **Confidencialidade:** alguma funcionalidade (por exemplo, multa por disponibilidade) é sensível demais para ser mostrada?

## 7. Revisão editorial (Fase 10)

- Problema claro: sim, sem números inventados.
- Solução responde ao problema: sim; cada funcionalidade do case está ligada a uma frente do problema.
- Funcionalidades citadas existem: sim, com rota e arquivos; funcionalidades planejadas só aparecem como planejadas.
- Tecnologias corretas: conferidas contra `package.json`.
- Diferenciais defensáveis: três, todos com evidência em código ou migrations.
- Identidade visual respeitada: cores, fontes e texturas vêm do código.
- Funciona sem demo pública: sim; depende de capturas e diagramas (ver `07`).
- Storyboard viável: sim, mas **depende de capturas com dados fictícios, que ainda não existem**.
- Alegações sem evidência: removidas ou marcadas como benefício esperado.
- Jargão: reduzido nas seções 01–08 e 10–12 do case; a seção 09 é técnica por natureza.

## 8. Pendências para completar o case

1. Produzir os dados fictícios e as capturas de `07`.
2. Obter as autorizações da seção 5.
3. Responder às perguntas da seção 6 e atualizar `05-portfolio-case.md` (principalmente seções 03, 11 e 12).
4. Converter o texto dos logos SVG em curvas.
5. Se quiser reforçar a seção de engenharia, executar localmente os scripts de verificação (os não destrutivos) e registrar os resultados atuais.
