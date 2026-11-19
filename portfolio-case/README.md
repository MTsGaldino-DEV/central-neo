# Portfólio-case: Central NEO

Portfólio profissional de desenvolvimento full stack da Central NEO, por Matheus Galdino. Entrega em 19/11/2026: site navegável, apresentação PDF de 12 páginas e 12 pranchas PNG para o Behance. A pesquisa original dos documentos 01–08 foi estática; a entrega visual posterior executou o app local com dados sintéticos, verificou a página no navegador e gerou os arquivos finais sem acessar o banco real.

## Abrir a entrega

- [Projeto publicado no Behance](https://www.behance.net/gallery/258752635/Central-NEO-Desenvolvimento-Full-Stack) — publicado em 19/11/2026 na conta de Matheus Galdino, com as 12 pranchas, capa, descrição e categorias Programação, Interface e experiência do usuário e Web design.
- [Site navegável](site/dist/index.html).
- [Apresentação em PDF](exports/central-neo-portfolio.pdf).
- [Pacote para o Behance](exports/central-neo-behance.zip): pranchas de 1400 × 1000 px, capa, PDF e índice.
- [Índice visual das 12 pranchas](exports/indice.html).
- [Direção criativa e critérios](09-direcao-criativa.md).

Para prévia local, na raiz do repositório:

```powershell
python -m http.server 8088 --bind 127.0.0.1 --directory portfolio-case/site/dist
```

Abra `http://127.0.0.1:8088`. O site não precisa de build, conta ou conexão ao Supabase; imagens e fontes são locais. Possui navegação por seções, imagens ampliáveis, detalhes técnicos por abas, exemplo interativo de conferência e downloads. O layout foi verificado em 320, 390, 768, 1440 e 1920 px e continua legível sem JavaScript.

## Publicação no Behance

Descompacte `exports/central-neo-behance.zip`. Insira as imagens `01-abertura.png` a `12-encerramento.png`, nessa ordem. `capa-central-neo.png` oferece uma composição de abertura; ajuste o enquadramento no editor do Behance conforme o espaço da capa. `indice.html` permite revisar todas as pranchas no navegador.

**Título sugerido:** Central NEO — Desenvolvimento Full Stack.

**Descrição sugerida:** Case de uma aplicação web de gestão operacional. Da compreensão do processo à interface, à modelagem dos dados e às regras de negócio no PostgreSQL. React, TypeScript e Supabase conectam fechamento de serviços, conferência de pagamentos e disponibilidade de equipes em uma experiência única. As imagens usam dados demonstrativos.

**Direção visual:** a referência Nabil Designs orientou a hierarquia e o ritmo editorial. Por orientação explícita de Matheus, as cores seguem a NEO: petróleo, noite, ciano, névoa e cobre; o amarelo da referência foi removido. Barlow Condensed aparece nos títulos da apresentação; Inter e JetBrains Mono conectam a composição à tipografia do produto. As fontes locais têm licenças OFL junto dos arquivos.

## Reproduzir capturas e exportação

Os utilitários usam o Playwright já disponível em `.tmp-faturamento/browser/node_modules` e o `jszip` das dependências locais. Para gerar novas capturas do app, inicie o Vite na porta 5173 e execute:

```powershell
node portfolio-case/tools/capturar-app.cjs
```

O script intercepta toda a rede Supabase, bloqueia serviços externos e fornece 18 serviços, 16 frotas e seis faturas sintéticas. Também substitui os rótulos fixos de supervisores e o nome da distribuidora somente no DOM da captura. Não altera arquivos do app nem registros reais.

Com a prévia do portfólio aberta em 8088:

```powershell
node portfolio-case/tools/verificar-exportar.cjs
```

Esse comando verifica navegação, teclado, simulação, galeria, reflow, imagens e fontes; exporta PDF, PNG, capa e ZIP; atualiza os downloads no site. `--somente-verificar` executa as verificações sem refazer a exportação. `PORTFOLIO_APP_URL` e `PORTFOLIO_URL` permitem trocar as URLs locais. Os screenshots da aplicação ficam em `site/dist/assets/screenshots/`; os arquivos finais ficam em `exports/`. O PDF tem 12 páginas, texto selecionável e fontes incorporadas.

## Base editorial original

**O produto em uma frase:** a Central NEO é a plataforma interna de um núcleo de eficiência operacional de manutenção de redes de energia, que reúne acompanhamento de notas de serviço, conferência da fatura da distribuidora contra o contrato, controle de disponibilidade das equipes e ferramentas de apoio ao campo, sob um login único.

**Tese do case:** do Excel a um sistema em que cada regra do contrato tem endereço e cada número tem origem. Valor de negócio, design, engenharia e execução, sem métricas inventadas.

## Conteúdo

| Arquivo | Para que serve |
|---|---|
| `01-project-discovery.md` | Inventário das descobertas, estado do projeto e divergências encontradas |
| `02-product-strategy.md` | Problema, público, proposta de valor, desafios e posicionamento |
| `03-technical-analysis.md` | Stack, arquitetura, dados, segurança, testes e limitações |
| `04-brand-and-design.md` | Marca, paleta, tipografia, interface e recomendações de arte |
| `05-portfolio-case.md` | **Case editorial em 12 seções, pronto para adaptar ao site** |
| `06-behance-storyboard.md` | 12 frames de 1400 px com headline, copy, elementos e montagem |
| `07-visual-assets-plan.md` | Capturas e assets a produzir, com rota, estado, resolução e dados a ocultar |
| `08-verification-report.md` | O que é fato, inferência, não verificado ou planejado; autorizações e perguntas |
| `assets/branding/` | Ícone real do app e logos SVG derivados do componente de marca, mais paleta |
| `assets/diagrams/` | Diagramas Mermaid com conteúdo verificado (arquitetura, fluxos, acesso) |
| `site/dist/assets/screenshots/` | Cinco capturas autênticas do aplicativo com dados sintéticos: fila desktop/celular, faturamento, disponibilidade e login |
| `site/dist/`, `exports/`, `tools/` | Site, arquivos para apresentação e ferramentas reproduzíveis da entrega visual |

## Como usar

Os documentos 01–08 preservam o levantamento inicial e suas limitações. Para ampliar o conteúdo com nomes de clientes, indicadores de economia ou materiais internos, consulte `08-verification-report.md` e confirme as fontes. A entrega visual já utiliza dados fictícios, descrições genéricas e alegações técnicas verificáveis; não depende das informações ainda pendentes no levantamento original.

## Regras seguidas

- Cada afirmação relevante está classificada como CONFIRMADO, INFERIDO, NÃO VERIFICADO ou PLANEJADO (ver `01` e `08`).
- Planejado nunca é descrito como existente. Não há métricas de uso, ganho ou faturamento, porque não há fonte verificável.
- Sem credenciais, valores de variáveis de ambiente, dados pessoais, valores contratuais ou financeiros reais.
- A identidade visual entregue segue o próprio produto (petróleo, cobre, noite, ciano e névoa; Inter e JetBrains Mono, com Barlow Condensed nos títulos do case).
- Nenhum arquivo funcional da aplicação foi alterado nesta entrega de portfólio. A memória compartilhada registra a entrega e a regra de paleta; exceções específicas no `.gitignore` permitem versionar somente os artefatos gerados do case.

## Pontos de atenção

- Nomes da distribuidora, do setor e do vídeo institucional exigem autorização antes de publicar.
- Logos SVG usam a fonte Manrope: converter o texto em curvas antes de usar em arte final.
- `supabase/` está fora do Git, o que limita a evidência pública do backend.
