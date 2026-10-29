// Conteúdo da Documentação do Faturamento: uma página por aba. Texto com **negrito** simples
// (sem HTML), para a busca e para ninguém injetar marcação.
export type BlocoDoc =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'nota' | 'importante'; texto: string }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] }
  | { tipo: 'exemplo'; titulo: string; linhas: [string, string][] };
export interface SecaoDoc { id: string; titulo: string; blocos: BlocoDoc[] }
export interface PaginaDoc { id: string; titulo: string; grupo: 'Faturamento' | 'Referência'; atualizada: string; resumo: string; secoes: SecaoDoc[] }

const HOJE = '29/10/2026';

export const PAGINAS_DOC: PaginaDoc[] = [
  { id: 'visao-geral', titulo: 'Visão geral', grupo: 'Faturamento', atualizada: HOJE,
    resumo: 'O Faturamento confere o que a CEMIG pagou com o que o contrato prevê, serviço por serviço, para negociar o que ela pagou a menos.',
    secoes: [
      { id: 'em-1-minuto', titulo: 'Em 1 minuto', blocos: [
        { tipo: 'lista', itens: ['Você importa as **duas planilhas** da CEMIG (Resumida e Completa).', 'O sistema liga cada serviço à **equipe** que fez.',
          'Calcula quanto o **contrato prevê** para cada serviço.', 'Compara com o que a CEMIG **pagou**.',
          'Mostra o que ela **pagou a menos** (para cobrar) e o que **pagou a mais**.'] },
      ] },
      { id: 'valores', titulo: 'Valores em R$ ou US', blocos: [
        { tipo: 'texto', texto: 'O contrato é em **US** (unidade de serviço). As telas abrem em **R$**, convertendo pelo valor da US mais recente do apostilamento, o mesmo da Tabela de valores da Manutenção. A chave **R$ | US** no topo troca a unidade.' },
        { tipo: 'nota', texto: 'Todas as faturas usam o mesmo valor da US, inclusive as antigas. O valor usado aparece sempre ao lado da chave (por exemplo, 1 US = R$ 2.964,33).' },
      ] },
      { id: 'erros', titulo: 'Quando algo dá errado', blocos: [
        { tipo: 'texto', texto: 'O aviso diz em uma linha o que fazer, por exemplo "Aguarde alguns segundos e tente de novo". O administrador vê também o botão **Ver mais detalhes**, com o que houve, onde e o detalhe técnico para copiar.' },
      ] },
    ] },
  { id: 'faturas', titulo: 'Faturas', grupo: 'Faturamento', atualizada: HOJE,
    resumo: 'A porta de entrada: todas as faturas importadas, com o que foi pago, o que ficou a receber e as multas.',
    secoes: [
      { id: 'lista', titulo: 'A lista de faturas', blocos: [
        { tipo: 'texto', texto: 'Cada fatura mostra o pago pela CEMIG, o **pago a menos** e as multas. Clique numa fatura para abrir o **Painel** dela.' },
      ] },
      { id: 'comparacao', titulo: 'Comparação entre faturas', blocos: [
        { tipo: 'texto', texto: 'O gráfico mostra pago, devido e multas de cada fatura. Passe o mouse numa fatura para ver o resumo dela, uma informação por linha: pago, devido, multas, a menos, a mais e fora do contrato.' },
      ] },
    ] },
  { id: 'painel', titulo: 'Painel', grupo: 'Faturamento', atualizada: HOJE,
    resumo: 'Para a fatura ou o período escolhido, quanto a CEMIG pagou a menos e a mais do que o contrato prevê. É a primeira tela para preparar uma negociação.',
    secoes: [
      { id: 'cards', titulo: 'O total e os cards', blocos: [
        { tipo: 'texto', texto: 'A faixa escura no topo mostra o que a CEMIG **pagou no total**, ao lado do que o contrato prevê, das multas e do número de serviços. Clique nela para abrir todos os serviços.' },
        { tipo: 'texto', texto: 'Embaixo, três cards: **Pagou a menos** (pagou abaixo do contrato), **Pagou a mais** (acima) e **Glosados** (laranja: serviços com código de glosa, G.02, em que a glosa cobre o que o contrato pagaria; não serão pagos). Clique num card para abrir a lista daquele grupo.' },
        { tipo: 'texto', texto: 'A barra colorida de cada card divide o valor: no Pagou a menos, por motivo; no Pagou a mais, entre os que têm 5.62 e os outros. Passe o mouse num pedaço para ver o valor.' },
        { tipo: 'nota', texto: 'Multa e estorno não entram nessa conta. Um serviço multado em que o crédito mais a multa fecham com o contrato aparece como "Confere". Se a glosa com G.02 foi só de uma parte, o resto continua devido: o serviço fica em Pagou a menos, motivo Glosa parcial.' },
        { tipo: 'tabela', cabecalho: ['Na tela', 'Quer dizer'], linhas: [
          ['Pagou no total', 'Soma do crédito da CEMIG na fatura, sem as glosas.'],
          ['Contrato prevê', 'Soma do devido pelo fator CSC ou COD, pela zona e pelo tipo de frota.'],
          ['Fator menor, RC não pago…', 'A diferença do Pagou a menos separada pelo motivo.'],
          ['Glosa parcial', 'Serviço com G.02 em que a glosa foi menor que o devido; a diferença é o que falta pagar.'],
          ['Com 5.62', 'Serviços pagos a mais que têm o código 5.62 (verificação do sistema).'],
          ['Glosa lançada', 'No card Glosados: a glosa que a CEMIG lançou; ao lado, o que o contrato previa.'],
        ] },
      ] },
      { id: 'funil', titulo: 'O funil', blocos: [
        { tipo: 'texto', texto: 'Mostra quantos serviços passaram por cada etapa da conferência, até chegar nos que pagaram a mais, a menos e nos glosados. Clique numa etapa para abrir a lista.' },
        { tipo: 'exemplo', titulo: 'Exemplo · fatura 9844', linhas: [['Serviços na fatura', '21.910'], ['− fora do contrato', '88'], ['Código no contrato', '21.822'],
          ['− divergentes', '278'], ['Valor confere', '21.544'], ['Pagou a mais', '172'], ['Pagou a menos', '106']] },
        { tipo: 'importante', texto: '"Fora do contrato" não é erro da CEMIG: o código não tem valor na tabela do contrato, então não dá para calcular o devido. Cadastre o valor em Tabelas do contrato.' },
      ] },
      { id: 'grafico', titulo: 'Comparação entre faturas', blocos: [
        { tipo: 'texto', texto: 'Igual ao da aba Faturas: passe o mouse numa fatura para ver o resumo dela.' },
      ] },
      { id: 'periodo', titulo: 'Fatura e período', blocos: [
        { tipo: 'texto', texto: 'As pílulas no topo escolhem uma fatura ou um período (este mês, 3 meses, 6 meses, ano ou um período qualquer). Com várias faturas, os cards e o funil somam todas; os links abrem a Conferência da fatura mais recente do período.' },
      ] },
      { id: 'grupos', titulo: 'Por equipe, código e cidade', blocos: [
        { tipo: 'texto', texto: 'Embaixo do gráfico ficam o pago e o a receber por tipo de equipe, por código e por cidade, e os **ajustes da fatura** (débitos e créditos fora da conferência).' },
      ] },
    ] },
  { id: 'conferencia', titulo: 'Conferência', grupo: 'Faturamento', atualizada: HOJE,
    resumo: 'A lista de serviços de uma fatura, em colunas, com filtro como no Excel, para achar e conferir cada diferença.',
    secoes: [
      { id: 'lista', titulo: 'A lista', blocos: [
        { tipo: 'texto', texto: 'Uma linha por serviço: situação, nº do serviço, tipo, códigos, frota, tipo de frota, cidade, pago, devido, diferença, multa e motivo. Linhas em vermelho-claro pagaram a menos; em verde-claro, a mais.' },
        { tipo: 'lista', itens: ['**1.NS** aparece em roxo; **5.62** em cobre.', 'O **⚠** roxo marca serviço com 1.NS que ainda não está na Manutenção.', 'Clique numa linha para abrir a janela do serviço.'] },
      ] },
      { id: 'filtros', titulo: 'Filtros como no Excel', blocos: [
        { tipo: 'texto', texto: 'Cada coluna tem o botão **▾**: ordenar, pesquisar e marcar os valores que quer ver, com a quantidade de cada um. Nas colunas de valor, "maior que", "menor que" ou "entre".' },
        { tipo: 'lista', itens: ['Na coluna **Nº serviço**, separe vários números por vírgula (ex.: 246101137, 246445398, 246006974). Um número só procura quem contém aquele trecho.', 'Os filtros ligados aparecem como etiquetas; o ✕ tira um, "Limpar todos" tira todos.', 'A lista de valores de uma coluna respeita os outros filtros, como no Excel.', 'Os filtros ficam no endereço da página: dá para voltar, recarregar ou mandar o link.'] },
      ] },
      { id: 'atalhos', titulo: 'Atalhos e botões', blocos: [
        { tipo: 'texto', texto: 'Os atalhos no topo escolhem a situação: Todos, Pagou a menos, Pagou a mais, Glosados, Fora do contrato, Conferem e Conferidos. Ao lado, **Contém 1.NS**, **Multado** e **5.62**: cada clique alterna entre contém, não contém e tanto faz.' },
        { tipo: 'nota', texto: 'Para separar as falhas que serão acertadas pela Manutenção, use "Pagou a menos" com "Contém 1.NS".' },
        { tipo: 'texto', texto: '**Possível fator errado** separa os serviços em que o pago é o previsto multiplicado ou dividido exatamente por um fator de zona/despacho: × 1,2 ou × 1,4 (COD rural), 1,4 no lugar de 1,2 (e o contrário), o fator esquecido (÷ 1,2, ÷ 1,4) ou × 0,8. Costuma ser COD ou zona rural trocados. Na lista, a coluna Motivo mostra **Possível fator errado** e qual foi o caso.' },
        { tipo: 'texto', texto: 'O **botão redondo** no canto de baixo, à direita, abre o **Contrato rápido**: busca de códigos com CSC, COD e Moto, a lista dos tipos despachados pelo COD e a Tabela 14, sem sair da lista. Esc ou X fecha.' },
      ] },
      { id: 'janela', titulo: 'A janela do serviço', blocos: [
        { tipo: 'lista', itens: ['Em cima: **Nº do serviço, tipo do serviço, nº de frota e tipo da frota**.',
          '**Como o devido foi calculado**: despacho (COD quando o tipo do serviço está na lista do COD; senão CSC), zona (pela coluna cod_tip_area da Fatura Completa) e tabela, com a conta de cada código. No homem-hora a conta mostra horas × US/h × multiplicador.',
          '**Fator pago**, ao lado do tipo da frota: quanto a CEMIG aplicou sobre o valor CSC urbano (× 1,0; × 1,2 rural ou COD; × 1,4 COD rural; × 0,7 Moto), com o fator do contrato embaixo.',
          '**O que a CEMIG pagou na fatura**: só o valor pago, código por código, com o 1.NS no fim.',
          '**Histórico**: importação e cada conferência, com quem fez.', 'Para conferir, escreva uma observação e clique em "Marcar como conferido".'] },
      ] },
      { id: 'ns', titulo: '1.NS e a Manutenção', blocos: [
        { tipo: 'texto', texto: 'O **1.NS** é um código informativo: a CEMIG paga esse serviço pela **Manutenção** (antigo Fechamento de Notas), não pela fatura. Quando o serviço tem um código normal e também 1.NS, a janela avisa que parte do pagamento pode vir pela Manutenção.' },
        { tipo: 'lista', itens: ['Se a Manutenção tem valor lançado para o serviço, a janela mostra o bloco "1.NS · Pago pela Manutenção", com o código e a observação do contrato.',
          'Se o serviço não está na Manutenção, aparece "Não encontrado na Manutenção": a nota ainda não foi fechada.'] },
        { tipo: 'importante', texto: 'O valor da Manutenção não entra na soma do Faturamento.' },
      ] },
      { id: '562', titulo: 'O 5.62', blocos: [
        { tipo: 'texto', texto: 'O 5.62 é a "verificação do sistema". Dentro de um RC da Tabela 12 ele é **informativo** (vale zero), como a CEMIG paga:' },
        { tipo: 'lista', itens: ['RC fechado **só com 5.62**: paga o RC.', 'RC com 5.62 e um código que substitui o RC (8.82, 8.85): paga só esse código; a linha do 5.62 vale zero.', 'RC com 5.62 e outro código fora dessa lista: paga o RC.', 'Serviço que não é RC da Tabela 12: o 5.62 paga o próprio valor.'] },
        { tipo: 'exemplo', titulo: 'Exemplo · fatura 9844', linhas: [['245473715 · RC08 COD rural, só 5.62', '0,139901 × 1,2 = 0,167881 US'], ['245812418 · RC07 com 5.62 e 8.82', 'só o 8.82: 0,016340 US']] },
      ] },
      { id: 'exportar', titulo: 'Exportar', blocos: [
        { tipo: 'lista', itens: ['**Exportar para Excel**: a lista como está filtrada, todas as páginas, em US.', '**Exportar para negociação**: uma aba para pagou a menos e outra para pagou a mais, com a explicação de cada serviço, sem os conferidos.'] },
      ] },
    ] },
  { id: 'importar', titulo: 'Importar fatura', grupo: 'Faturamento', atualizada: HOJE,
    resumo: 'Como trazer uma fatura nova (ou reimportar) sem estragar o que já está no sistema.',
    secoes: [
      { id: 'planilhas', titulo: 'Por que duas planilhas', blocos: [
        { tipo: 'texto', texto: 'A Fatura Resumida traz quanto a CEMIG pagou; a Fatura Completa diz qual equipe fez cada serviço. Sem as duas, não dá para saber se o desconto de Moto estava certo.' },
        { tipo: 'exemplo', titulo: 'Fatura 9844', linhas: [['Linhas da Resumida (uma por código)', '27.389'], ['Serviços (números únicos)', '21.910']] },
        { tipo: 'nota', texto: 'Um serviço com dois códigos ocupa duas linhas. O número do serviço liga as duas planilhas: o veículo da Completa encontra a frota na aba US_Turma da Resumida.' },
      ] },
      { id: 'seguranca', titulo: 'Importar ou reimportar com segurança', blocos: [
        { tipo: 'lista', itens: ['Se a fatura já existe, o sistema mostra o antes e o depois e pede que você **digite o número da fatura** para substituir.',
          'Arquivos idênticos aos já importados: aparece "Nada mudou" e nada é reimportado.', 'Resumida e Completa de faturas diferentes: a importação é bloqueada.',
          'Linhas idênticas em todos os campos aparecem como aviso antes de importar.', 'A gravação é tudo ou nada: se falhar no meio, a versão anterior continua valendo.'] },
      ] },
    ] },
  { id: 'tabelas', titulo: 'Tabelas do contrato', grupo: 'Faturamento', atualizada: HOJE,
    resumo: 'Os valores de cada código (Tabela 11) e de cada RC (Tabela 12), usados para calcular o devido.',
    secoes: [
      { id: 'contrato', titulo: 'Tabelas 11 e 12', blocos: [
        { tipo: 'texto', texto: 'A Tabela 11 tem o valor de cada código de fechamento; a Tabela 12, o de cada RC (atendimento). Cada código tem dois valores: **CSC/CSI** e **COD**. Só o administrador corrige um fator, e toda correção fica no histórico.' },
        { tipo: 'texto', texto: 'O código **0.06 não paga**: está na Tabela 11 com valor 0, e o serviço fechado com ele (inclusive RC) tem devido zero.' },
        { tipo: 'texto', texto: 'Qual dos dois vale é o **despacho**: o serviço é COD quando o tipo dele (MA27, RC08, NSRI…) está na lista **Despachados pelo COD**, no fim da página; os demais são CSC/CSI.' },
      ] },
      { id: 'homem-hora', titulo: 'Homem-hora (Tabela 14)', blocos: [
        { tipo: 'texto', texto: 'Os códigos **1.62, 1.73, 5.63 e 5.64** pagam por hora. As horas vão do acionamento (dh_aciona) ao término real (dh_terreal) da Fatura Completa, **por minuto**, sem arredondar a hora. O valor da hora vem da Tabela 14 pela equipe: dupla 0,1097, umpla 0,0922, moto 0,0366 e quarteto 0,1753 US/h.' },
        { tipo: 'tabela', cabecalho: ['Despacho e zona', 'Multiplicador'], linhas: [['CSC urbano', '1,0'], ['CSC rural', '1,2'], ['COD urbano', '1,2'], ['COD rural', '1,4']] },
        { tipo: 'exemplo', titulo: '1.62 · dupla, COD rural', linhas: [['2h13 × 0,1097 US/h × 1,4', '0,340436 US']] },
        { tipo: 'importante', texto: 'Dentro de um RC também: se o atendimento tem 1.62, 1.73, 5.63 ou 5.64, o RC deixa de ser pago por atendimento e cada linha vale o seu código, com o homem-hora por hora.' },
        { tipo: 'nota', texto: 'A zona vem da coluna cod_tip_area: U urbano, R rural. O valor S também conta como rural até a supervisora Elen confirmar o que significa.' },
      ] },
      { id: 'moto', titulo: 'Valor e fator Moto', blocos: [
        { tipo: 'texto', texto: 'Equipe Moto recebe 70% do valor (fator 0,7) na maioria dos códigos. Alguns pagam o valor cheio (fator 1) e outros não pagam Moto (fator 0). A coluna **Valor Moto** já mostra a conta pronta, antes do fator.' },
        { tipo: 'exemplo', titulo: 'Exemplos', linhas: [['5.14 · fator 0,7', '0,094983 × 0,7 = 0,066488'], ['6.01 · fator 1 (sem desconto)', '0,001065'], ['9.82 · fator 0', 'não paga Moto']] },
      ] },
    ] },
  { id: 'regras', titulo: 'Regras de cálculo', grupo: 'Referência', atualizada: HOJE,
    resumo: 'Como o sistema chega no valor devido de cada serviço.',
    secoes: [
      { id: 'rc-codigo', titulo: 'RC uma vez, código em cada linha', blocos: [
        { tipo: 'texto', texto: 'No pagamento por código, cada linha vale o seu código. No pagamento por RC (RC07, RC08…), vale **um RC por atendimento**, não importa quantas linhas ele tenha.' },
        { tipo: 'exemplo', titulo: 'Por RC · RC07', linhas: [['245530193 · 5.14', '0,043010'], ['245530193 · 7.42', '0,041669'], ['soma = 1 RC07', '0,084679']] },
        { tipo: 'nota', texto: 'Pelas notas 2 e 3 da Tabela 12, alguns RCs são trocados pelo código de fechamento (por exemplo RC07 → 8.82) e aí valem como código.' },
      ] },
      { id: 'saldo', titulo: 'Pagou a menos e pagou a mais', blocos: [
        { tipo: 'exemplo', titulo: 'Exemplo', linhas: [['Contrato prevê', '0,023400'], ['CEMIG pagou', '0,016400'], ['Pagou a menos', '0,007000']] },
        { tipo: 'lista', itens: ['Multas e estornos ficam fora: um serviço multado em que crédito + multa = devido confere.',
          'Serviço com **código de glosa** (G.02) vai para **Glosados** quando a glosa cobre o devido: a CEMIG não vai pagar. Se a glosa é menor, fica em **Pagou a menos** (Glosa parcial) e a diferença inclui a glosa: pago + glosa − devido.',
          'Serviço **conferido** à mão sai do pagou a menos, do pagou a mais e da exportação; o atalho "Conferidos" mostra todos.', 'Código sem valor no contrato fica fora dos dois lados.'] },
      ] },
      { id: 'urbano-rural', titulo: 'Urbano e rural', blocos: [
        { tipo: 'texto', texto: 'A zona vem da planilha da CEMIG: as quantidades urbanas e rurais de cada linha. A quantidade rural vale **× 1,2** no devido.' },
      ] },
      { id: 'csc-cod', titulo: 'CSC ou COD', blocos: [
        { tipo: 'texto', texto: 'As planilhas não dizem quem despachou o serviço. O sistema escolhe, por serviço, o valor (CSC ou COD, com ou sem Moto) que bate com o pagamento; se nenhum bate, usa o CSC como referência.' },
      ] },
    ] },
  { id: 'glossario', titulo: 'Glossário', grupo: 'Referência', atualizada: HOJE,
    resumo: 'As palavras que aparecem nas telas, em uma linha cada.',
    secoes: [
      { id: 'termos', titulo: 'Termos', blocos: [
        { tipo: 'tabela', cabecalho: ['Termo', 'O que é'], linhas: [
          ['US', 'Unidade de Serviço: a "moeda" do contrato com a CEMIG.'], ['Apostilamento', 'Valor da US em reais, definido por vigência.'],
          ['Glosa', 'Desconto aplicado pela CEMIG (multa). Glosa positiva é estorno: valor devolvido.'], ['Glosado', 'Serviço com código de glosa (G.02): a CEMIG não vai pagar.'], ['CSC / CSI', 'Valor do código para o centro de serviço (referência principal).'],
          ['COD', 'Valor alternativo do mesmo código no contrato.'], ['RC', 'Código de atendimento (RC07, RC08…), pago uma vez por atendimento.'],
          ['Tabela 11 / 12', 'Tabela 11: códigos de fechamento. Tabela 12: RCs.'], ['1.NS', 'Código informativo: o serviço é pago pela Manutenção.'],
          ['Manutenção', 'Módulo das notas de NSIS (antigo Fechamento de Notas).'], ['Frota', 'Número do veículo que fez o serviço.'],
          ['Tipo da frota', 'Equipe do veículo: Multifuncional, Moto, Umpla ou Quarteto.'],
        ] },
      ] },
    ] },
];

/** Links antigos (#tema) para a página nova. */
export const TEMA_ANTIGO: Record<string, [string, string?]> = {
  inicio: ['visao-geral'], planilhas: ['importar', 'planilhas'], 'rc-codigo': ['regras', 'rc-codigo'], moto: ['tabelas', 'moto'],
  saldo: ['regras', 'saldo'], funil: ['painel', 'funil'], conferencia: ['conferencia'], importar: ['importar'], contrato: ['tabelas', 'contrato'],
  glossario: ['glossario'],
};

/** Texto corrido de um bloco, para a busca. */
export const textoDoBloco = (b: BlocoDoc): string =>
  b.tipo === 'lista' ? b.itens.join(' ') : b.tipo === 'tabela' ? [...b.cabecalho, ...b.linhas.flat()].join(' ')
    : b.tipo === 'exemplo' ? [b.titulo, ...b.linhas.flat()].join(' ') : b.texto;
