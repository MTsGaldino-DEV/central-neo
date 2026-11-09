// Interface real da Fila de NSIS com o Supabase simulado em memória (nenhuma escrita remota).
// Usa o Playwright de .tmp-faturamento/browser. Rode com `npm run dev` aberto (ou NEO_TEST_URL).
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('../.tmp-faturamento/browser/node_modules/playwright');

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const api = new URL(env.VITE_NEO_SUPABASE_URL);
const urlBase = (process.env.NEO_TEST_URL || 'http://localhost:5173').replace(/\/$/, '');
const saida = path.resolve('.tmp-faturamento');
const id = '00000000-0000-0000-0000-000000000001';
const usuario = { id, email: 'teste@example.invalid', aud: 'authenticated', role: 'authenticated' };
const sessao = { access_token: 'teste-local', refresh_token: 'teste-local', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, token_type: 'bearer', user: usuario };

const codigo = (codigo, operacao, atividade, fator_us, unidade = 'UN') => ({
  codigo, tabela: '03', operacao, atividade, unidade, descricao: `${operacao} ${atividade}`, fator_original: fator_us, fator_us, ativo: true,
  atualizado_em: '2026-01-01T00:00:00Z', acertado: false, qtd_usos: 0, ultimo_acerto: null,
});
const contrato = [
  codigo('704001', 'Instalar', 'Cruzeta', 0.0567),
  codigo('704002', 'Retirar', 'Cruzeta', 0.0231),
  codigo('704003', 'Podar', 'Arvore tocando na MT', 0.1, 'ARVORE'),
  codigo('704004', 'Instalar', 'Espacador', 0.0333, 'VAO'),
];

const baseNsis = (servico, zona, observacao) => ({
  servico, tipo_serv: 'NSIS', referencia: '1234567', localidade: '1234', endereco: 'Rua das Flores, 10', pedido_em: '2026-11-01T10:00:00Z', termino: '2026-11-02T15:00:00Z',
  resp: 'CONTRATADA', matricula: 'e1', nome: 'Equipe teste', tempo_deslocamento: null, tempo_execucao: null, prazo_legal: '24', observacao, zona, referencia_local: null,
  sem_cobranca: false, motivo_sem_cobranca: null, origem: 'RELATORIO', importado_em: '2026-11-03T00:00:00Z', atualizado_em: '2026-11-03T00:00:00Z', valor_us_reais: 2964.33, supervisor: 'Pedro',
  fluxo_novo: false, supervisor_equipe: null, data_lancamento_sf: null,
});
const novaNsis = (servico, tipo, localidade, termino, observacao) => ({
  ...baseNsis(servico, 'U', observacao), tipo_serv: tipo, localidade, termino, fluxo_novo: true, supervisor: null,
});
const nsis = [
  baseNsis('900000001', 'R', 'Trocada cruzeta e podada arvore tocando na rede'),
  baseNsis('900000002', 'U', 'Dois pedidos antigos'),
  baseNsis('900000003', 'U', 'Sem nada lancado'),
  // fluxo novo: três a fechar (duas NSIS e uma NSRI) e uma que já tem NSMP
  novaNsis('900010010', 'NSIS', '2001', '2026-11-03T15:00:00Z', 'Fluxo novo A'),
  novaNsis('900010011', 'NSRI', '2002', '2026-11-04T15:00:00Z', 'Fluxo novo B'),
  novaNsis('900010012', 'NSIS', '2003', '2026-11-05T15:00:00Z', 'Fluxo novo C'),
  { ...novaNsis('900010013', 'NSIS', '2004', '2026-11-06T15:00:00Z', 'Fluxo novo D'), supervisor: 'Ana', supervisor_equipe: 'Ana' },
];
// serviços que o simulado esconde da lista (para isolar um cenário de colunas)
const ocultos = new Set();
let seq = 0;
const novoId = () => `item-${++seq}`;
const legado = (servico, descricao, nsmp, valor) => ({
  id: novoId(), servico, descricao, codigo: null, quantidade: 1, rural: false, fator: 1, fator_unitario: null, equipe: '100', valor_inicial: valor, us_adicional: null,
  nsmp, nspr: null, valor_final: null, fatura: null, observacao: null, criado_em: '2026-10-01T00:00:00Z', atualizado_em: '2026-10-01T00:00:00Z',
});
let itens = [
  legado('900000002', 'Pedido antigo A', 'A1', 0.1), legado('900000002', 'Pedido antigo B', 'B1', 0.2),
  { ...legado('900010013', 'Pedido novo', 'N9', 0.1), equipe: '4404' },
];
const escritas = [];

function comItens(n) {
  const d = itens.filter((i) => i.servico === n.servico);
  const soma = (f) => d.reduce((s, i) => s + (Number(i[f]) || 0), 0);
  const conta = (f) => d.filter(f).length;
  const semNsmp = conta((i) => !i.nsmp); const semNspr = conta((i) => i.nsmp && !i.nspr); const semFatura = conta((i) => i.nspr && !i.fatura);
  const unico = (f) => [...new Set(d.map((i) => i[f]).filter(Boolean))].join(', ') || null;
  return {
    ...n, qtd_itens: d.length, valor_inicial_total: soma('valor_inicial'), valor_final_total: soma('valor_final'), itens_sem_nsmp: semNsmp, itens_sem_nspr: semNspr, itens_sem_fatura: semFatura,
    itens_divergentes: 0, itens_sem_valor_pago: 0, nsmps: unico('nsmp'), nsprs: unico('nspr'), faturas: unico('fatura'), equipes: unico('equipe'), codigos: unico('codigo'),
    etapa: n.fluxo_novo
      ? (d.length === 0 || semNsmp ? 'A_FECHAR' : n.tipo_serv !== 'NSRI' && semNspr ? 'AGUARDANDO_NSPR' : !n.data_lancamento_sf ? 'AGUARDANDO_SALESFORCE' : d.some((i) => !i.fatura) ? 'AGUARDANDO_APROPRIACAO' : 'FATURADA')
      : d.length === 0 ? 'A_FECHAR' : semNsmp ? 'AGUARDANDO_NSMP' : semNspr ? 'AGUARDANDO_NSPR' : semFatura ? 'AGUARDANDO_FATURA' : 'FATURADA',
    valor_inicial_reais_total: soma('valor_inicial') * 2964.33, valor_final_reais_total: soma('valor_final') * 2964.33,
  };
}

/** Lista da fila com os filtros que o teste usa: etapa, tipo_serv in(...) e order. */
function filtrarLista(url) {
  let lista = nsis.map(comItens).filter((n) => !ocultos.has(n.servico));
  const etapa = url.searchParams.get('etapa');
  if (etapa?.startsWith('eq.')) lista = lista.filter((n) => n.etapa === etapa.slice(3));
  const tipo = url.searchParams.get('tipo_serv');
  if (tipo?.startsWith('in.(')) {
    const valores = tipo.slice(4, -1).split(',').map((v) => v.replaceAll('"', ''));
    lista = lista.filter((n) => valores.includes(n.tipo_serv));
  }
  const chaves = (url.searchParams.get('order') || '').split(',').filter(Boolean).map((k) => { const [col, dir] = k.split('.'); return { col, desc: dir === 'desc' }; });
  return lista.sort((a, b) => {
    for (const { col, desc } of chaves) {
      const x = a[col]; const y = b[col];
      if (x == y) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

function responderItens(url, metodo, corpo) {
  const parametro = (nome) => url.searchParams.get(nome);
  if (metodo === 'GET') {
    const servico = parametro('servico')?.replace('eq.', '');
    return itens.filter((i) => i.servico === servico).sort((a, b) => a.criado_em.localeCompare(b.criado_em) || String(a.codigo).localeCompare(String(b.codigo)));
  }
  escritas.push({ metodo, corpo, consulta: url.search });
  const agora = '2026-11-06T12:00:00Z';
  if (metodo === 'POST' && parametro('on_conflict') === 'id') {
    for (const linha of corpo) {
      const atual = itens.find((i) => i.id === linha.id);
      assert.ok(atual, 'a confirmação não pode criar item novo');
      Object.assign(atual, linha);
    }
    return [];
  }
  if (metodo === 'POST') {
    const novos = corpo.map((c) => ({ id: novoId(), rural: false, nsmp: null, nspr: null, valor_final: null, fatura: null, us_adicional: null, observacao: null, criado_em: agora, atualizado_em: agora, ...c }));
    itens.push(...novos);
    return novos;
  }
  const alvoIds = parametro('id')?.startsWith('in.') ? parametro('id').slice(4, -1).split(',').map((s) => s.replaceAll('"', '')) : [parametro('id')?.replace('eq.', '')];
  if (metodo === 'PATCH') {
    const alterados = itens.filter((i) => alvoIds.includes(i.id));
    alterados.forEach((i) => Object.assign(i, corpo));
    return alterados;
  }
  if (metodo === 'DELETE') {
    itens = itens.filter((i) => !alvoIds.includes(i.id));
    return [];
  }
  throw Error('Método inesperado: ' + metodo);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const falhas = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: 'sb-' + api.hostname.split('.')[0] + '-auth-token', value: sessao });
    await context.route('**/*.supabase.co/**', async (route) => {
      const req = route.request(); const url = new URL(req.url()); const recurso = url.pathname.split('/').pop(); const metodo = req.method();
      if (metodo === 'OPTIONS') return route.fulfill({ status: 200 });
      const umObjeto = (req.headers().accept || '').includes('vnd.pgrst.object');
      let corpo = [];
      if (url.hostname !== api.hostname) corpo = umObjeto ? null : [];
      else if (recurso === 'user') corpo = usuario;
      else if (recurso === 'neo_acessos') corpo = { user_id: id, papel: 'ADMIN', modulos: ['fechamento'], ativo: true };
      else if (recurso === 'colaboradores') corpo = { id, nome: 'Revisao da interface' };
      else if (recurso === 'neo_tipos_servico') corpo = ['NSIS'];
      else if (recurso === 'neo_resumo_fechamento') corpo = { A_FECHAR: 0, AGUARDANDO_NSMP: 0, AGUARDANDO_NSPR: 0, AGUARDANDO_FATURA: 0, FATURADA: 0, SEM_COBRANCA: 0, DIVERGENTES: 0 };
      else if (recurso === 'neo_vw_contrato_itens') corpo = contrato;
      else if (recurso === 'neo_vw_nsis') {
        const servico = url.searchParams.get('servico')?.replace('eq.', '');
        corpo = servico ? nsis.filter((n) => n.servico === servico).map(comItens) : filtrarLista(url);
        if (umObjeto) corpo = corpo[0];
      } else if (recurso === 'neo_nsis_itens') corpo = responderItens(url, metodo, req.postDataJSON());
      else throw Error('Requisição inesperada: ' + recurso);
      const quantos = Array.isArray(corpo) ? corpo.length : 1;
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': quantos ? `0-${quantos - 1}/${quantos}` : '*/0' }, body: JSON.stringify(corpo) });
    });

    const page = await context.newPage(); globalThis.paginaTeste = page;
    page.on('pageerror', (e) => falhas.push(e.message));
    const foto = (nome) => page.screenshot({ path: path.join(saida, nome + '.png') });
    const janela = page.getByRole('dialog');
    const form = page.getByRole('form', { name: 'O que deve ser cobrado?' });
    const buscar = async (termo) => {
      await page.getByLabel('Código da Tabela 03').fill(termo);
      await page.getByText('Carregando a tabela').waitFor({ state: 'detached' });
      await page.getByLabel('Código da Tabela 03').press('Enter');
    };

    // ── A NSIS abre na janela do meio, a partir da lista, como na Conferência ──
    await page.goto(urlBase + '/fechamento?etapa=TODAS');
    await page.getByRole('cell', { name: '900000001' }).first().click();
    await janela.waitFor();
    assert.equal(await page.locator('aside.max-w-2xl').count(), 0, 'a gaveta lateral saiu');
    const caixa = await janela.boundingBox();
    assert.ok(Math.abs(caixa.x + caixa.width / 2 - 720) < 2, 'a janela fica centralizada');
    await form.waitFor();
    assert.equal(await page.getByRole('radio', { name: /× 1,2/ }).isChecked(), true, 'zona rural abre em × 1,2');
    await foto('manutencao-janela-vazia');

    // ── Enter com a busca vazia não escolhe código nem grava ──
    await page.getByLabel('Código da Tabela 03').press('Enter');
    assert.equal(await form.locator('li').count(), 0, 'Enter vazio não adiciona');
    assert.equal(escritas.length, 0);
    assert.equal(await form.getByRole('button', { name: 'Salvar' }).isDisabled(), true, 'sem código não dá para salvar');

    // ── Vários códigos na mesma lista, sem sair da busca ──
    await buscar('704003');
    await buscar('cruzeta');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'busca-codigo', 'a busca segue pronta para o próximo código');
    assert.equal(await form.locator('ul > li').count(), 2);
    await form.getByLabel('Qtd (arvore)').fill('3');
    // Código repetido não duplica
    await buscar('704003');
    await form.getByText('704003 já está na lista').waitFor();
    assert.equal(await form.locator('ul > li').count(), 2);
    // Substituição inclui a retirada como mais um código
    await form.getByRole('button', { name: /Foi substituição/ }).click();
    assert.equal(await form.locator('ul > li').count(), 3);
    await page.getByLabel('Nº da equipe').fill('4052');

    // Conta: (0,1×3 + 0,0567 + 0,0231) × 1,2 = 0,3600 + 0,0680 + 0,0277 = 0,4557
    await form.getByText('0,4557 US').waitFor();
    await foto('manutencao-tres-codigos');

    // Muda o fator: × 1,4 recalcula tudo
    await form.getByText('× 1,4', { exact: true }).click();
    await form.getByText('0,5317 US').waitFor();
    assert.equal(await form.getByRole('radio', { name: /× 1,4/ }).isChecked(), true);

    // ── Fechar com códigos não salvos avisa e não perde nada ──
    await page.keyboard.press('Escape');
    await page.getByText('Os códigos escolhidos ainda não foram salvos.').waitFor();
    assert.ok(await janela.isVisible(), 'o Esc não fecha com rascunho');
    await foto('manutencao-aviso-sair');
    await page.getByRole('button', { name: 'Continuar lançando' }).click();
    assert.equal(await form.locator('ul > li').count(), 3, 'a lista continua lá');

    // ── Salvar grava todos de uma vez ──
    await form.getByRole('button', { name: 'Salvar 3 códigos' }).click();
    await janela.getByText('Total do lançamento, 3 códigos').waitFor();
    const gravacao = escritas.filter((e) => e.metodo === 'POST');
    assert.equal(gravacao.length, 1, 'uma gravação só');
    assert.equal(gravacao[0].corpo.length, 3);
    assert.deepEqual(gravacao[0].corpo.map((c) => [c.codigo, c.quantidade, c.fator, c.valor_inicial, c.equipe]), [
      ['704003', 3, 1.4, 0.42, '4052'], ['704001', 1, 1.4, 0.0794, '4052'], ['704002', 1, 1.4, 0.0323, '4052'],
    ]);
    assert.ok(gravacao[0].corpo.every((c) => !('rural' in c)), 'a tela não grava mais rural');
    await page.waitForTimeout(100);
    assert.equal(await page.getByText('× 1,4)').count(), 3, 'cada código mostra o fator');
    await foto('manutencao-lancamento');

    // ── Uma NSMP vale para todos os códigos ──
    const ids = itens.filter((i) => i.servico === '900000001').map((i) => i.id);
    escritas.length = 0;
    await janela.getByLabel('Nº da NSMP').fill('NSMP77');
    await janela.getByLabel('Nº da NSMP').press('Enter');
    await janela.getByLabel('Nº da NSPR').waitFor();
    assert.equal(escritas.length, 1);
    assert.equal(escritas[0].metodo, 'PATCH');
    assert.ok(itens.filter((i) => ids.includes(i.id)).every((i) => i.nsmp === 'NSMP77'));
    assert.equal(await janela.getByText('NSMP77').count(), 1, 'a NSMP aparece uma vez');

    // ── Valor pago total é dividido e a soma fecha ──
    escritas.length = 0;
    await janela.getByLabel('Nº da NSPR').fill('NSPR88');
    await janela.getByLabel('Valor pago total em US').fill('0,4');
    await janela.getByRole('button', { name: 'Salvar' }).first().click();
    await janela.getByText('Dividido na proporção do pedido').waitFor();
    assert.equal(escritas.length, 1, 'uma gravação só');
    const pagos = itens.filter((i) => ids.includes(i.id)).map((i) => i.valor_final);
    assert.equal(Math.round(pagos.reduce((a, b) => a + b, 0) * 10000) / 10000, 0.4);
    assert.ok(itens.filter((i) => ids.includes(i.id)).every((i) => i.nspr === 'NSPR88' && i.codigo), 'nada mais muda no item');

    // ── AP para todos, e a NSIS fecha ──
    await janela.getByLabel('Ex.: AP 83809').fill('83809');
    await janela.getByLabel('Ex.: AP 83809').press('Enter');
    await janela.getByText('AP 83809').waitFor();
    assert.ok(itens.filter((i) => ids.includes(i.id)).every((i) => i.fatura === 'AP 83809'));
    await foto('manutencao-faturado');

    // Outro lançamento depois da NSMP gerada é separado
    await janela.getByRole('button', { name: 'Novo lançamento, com outra NSMP' }).click();
    await janela.getByRole('form', { name: 'Novo lançamento' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await janela.isVisible(), false, 'sem rascunho, o Esc fecha');
    assert.equal(new URL(page.url()).searchParams.get('nsis'), null);

    // ── Histórico com NSMP diferentes continua em cartões separados ──
    await page.goto(urlBase + '/fechamento?etapa=TODAS&nsis=900000002');
    await janela.getByText('Pedido antigo A').waitFor();
    assert.equal(await janela.getByLabel('Nº da NSPR').count(), 2, 'cada NSMP antiga tem sua NSPR');
    assert.equal(await janela.getByText(/Total do lançamento/).count(), 0);
    await foto('manutencao-historico');

    // ── Edição usa o fator e mantém a NSMP dos outros ──
    await page.goto(urlBase + '/fechamento?etapa=TODAS&nsis=900000001');
    await janela.getByRole('button', { name: 'Editar item 1' }).click();
    await janela.getByRole('radio', { name: /× 1,4/ }).waitFor();
    assert.equal(await janela.getByRole('radio', { name: /× 1,4/ }).isChecked(), true);
    await janela.getByText('× 1,0', { exact: true }).click();
    await janela.getByText('0,0567 US', { exact: true }).waitFor();
    await foto('manutencao-edicao');
    await janela.getByRole('button', { name: 'Cancelar' }).first().click();

    // ── Item sem código no lançamento: sem fator, valor digitado ──
    await page.goto(urlBase + '/fechamento?etapa=TODAS&nsis=900000003');
    await form.waitFor();
    assert.equal(await page.getByRole('radio', { name: /× 1,0/ }).isChecked(), true, 'zona urbana abre em × 1,0');
    await form.getByRole('button', { name: 'Lançar item sem código' }).click();
    await form.getByRole('button', { name: 'Salvar' }).click();
    await form.getByRole('alert').getByText('Descreva o item sem código.').waitFor();
    await form.getByLabel('Descrição no pedido').fill('Serviço fora da tabela');
    await form.getByLabel('Valor (US)').fill('0,25');
    await buscar('espacador');
    await form.getByText('× 1,2', { exact: true }).click();
    await form.getByText('0,2900 US').waitFor();
    escritas.length = 0;
    await form.getByRole('button', { name: 'Salvar 2 códigos' }).click();
    await janela.getByText('Serviço fora da tabela').waitFor();
    assert.deepEqual(escritas[0].corpo.map((c) => [c.codigo, c.fator, c.valor_inicial]), [[null, 1, 0.25], ['704004', 1.2, 0.04]]);

    // ── Colunas por etapa e filtros por coluna (estilo Excel) ──
    const cabecalhos = () => page.locator('table.grade-nsis thead th').evaluateAll((ths) => ths.map((t) => t.textContent.trim()));
    const esperarLinhas = (n) => page.waitForFunction((q) => document.querySelectorAll('table.grade-nsis tbody tr:not(.sem-hover)').length === q, n);
    const primeiraCelula = () => page.locator('table.grade-nsis tbody tr').first().locator('td').first().textContent();
    const menu = (rotulo) => page.getByRole('dialog', { name: `Filtro de ${rotulo}` });
    const parametro = (nome) => new URL(page.url()).searchParams.get(nome);

    // NSIS do fluxo novo em A fechar: só as colunas dessa etapa
    for (const s of ['900000001', '900000002', '900000003']) ocultos.add(s);
    await page.goto(urlBase + '/fechamento?etapa=A_FECHAR');
    await esperarLinhas(3);
    assert.deepEqual(await cabecalhos(), ['N° Serviço', 'Tipo do serviço', 'Localidade', 'DT execução', 'Etapa']);
    assert.equal(await page.getByRole('button', { name: /Gerar NSMP/ }).count(), 0, 'chip de histórico vazio fica escondido');
    assert.equal(await page.getByRole('button', { name: /Aguard\. fatura/ }).count(), 0, 'chip de histórico vazio fica escondido');
    assert.equal(await page.getByRole('button', { name: /Sem cobrança/ }).count(), 1);
    assert.equal(await page.getByRole('button', { name: /Aguard\. apropriação/ }).count(), 1, 'etapas novas na fila');
    assert.equal(await page.getByRole('button', { name: /Aguard\. Salesforce/ }).count(), 1);
    assert.equal(await primeiraCelula(), '900010010');
    await foto('fila-fluxo-a-fechar');

    // ▾ de Tipo do serviço lista os valores; Esc fecha
    await page.getByRole('button', { name: 'Filtrar Tipo do serviço' }).click();
    await menu('Tipo do serviço').waitFor();
    await menu('Tipo do serviço').getByLabel('NSRI').waitFor();
    assert.equal(await menu('Tipo do serviço').getByLabel('NSIS').count(), 1);
    await page.keyboard.press('Escape');
    await menu('Tipo do serviço').waitFor({ state: 'detached' });

    // Marcar um valor e aplicar reduz as linhas e mostra o chip removível
    await page.getByRole('button', { name: 'Filtrar Tipo do serviço' }).click();
    await menu('Tipo do serviço').getByLabel('NSRI').waitFor();
    await menu('Tipo do serviço').getByLabel('Selecionar todos').uncheck();
    await menu('Tipo do serviço').getByLabel('NSRI').check();
    await menu('Tipo do serviço').getByRole('button', { name: 'Aplicar' }).click();
    await esperarLinhas(1);
    assert.equal(await primeiraCelula(), '900010011');
    assert.equal(parametro('col.tipo_serv'), 'NSRI');
    await page.getByText('Tipo do serviço: NSRI').waitFor();
    await foto('fila-fluxo-filtro-coluna');

    // Com o filtro ativo o menu mostra a seleção e a lista ignora o próprio filtro
    await page.getByRole('button', { name: 'Filtrar Tipo do serviço' }).click();
    await menu('Tipo do serviço').getByLabel('NSIS').waitFor();
    assert.equal(await menu('Tipo do serviço').getByLabel('NSRI').isChecked(), true);
    assert.equal(await menu('Tipo do serviço').getByLabel('NSIS').isChecked(), false);
    await page.keyboard.press('Escape');

    // Remover o chip restaura as linhas
    await page.getByRole('button', { name: 'Remover filtro' }).click();
    await esperarLinhas(3);
    assert.equal(parametro('col.tipo_serv'), null);
    assert.equal(await page.getByText('Tipo do serviço: NSRI').count(), 0);

    // Ordenar: clicar de novo na mesma ordem volta à padrão
    await page.getByRole('button', { name: 'Filtrar Tipo do serviço' }).click();
    await page.getByRole('button', { name: 'Ordenar de Z a A' }).click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('ordcol') === 'tipo_serv:desc');
    await page.waitForFunction(() => document.querySelector('table.grade-nsis tbody tr td')?.textContent === '900010011');
    await page.getByRole('button', { name: 'Filtrar Tipo do serviço' }).click();
    await page.getByRole('button', { name: 'Ordenar de Z a A' }).click();
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('ordcol'));
    await page.waitForFunction(() => document.querySelector('table.grade-nsis tbody tr td')?.textContent === '900010010');

    // Colunas de valor só ordenam: sem pesquisa nem lista
    ocultos.clear();
    await page.goto(urlBase + '/fechamento?etapa=TODAS');
    await esperarLinhas(7);
    assert.deepEqual(await cabecalhos(), [
      'N° Serviço', 'Tipo do serviço', 'Localidade', 'DT execução', 'Equipe', 'Supervisor', 'NSMP', 'NSPR',
      'Lançamento Salesforce', 'Valor pago', 'Data lançamento SF', 'Apropriação', 'Observação', 'Etapa',
    ], 'na etapa Todas aparecem todas as colunas');
    await page.getByRole('button', { name: 'Filtrar Valor pago' }).click();
    await menu('Valor pago').getByRole('button', { name: 'Do menor para o maior' }).waitFor();
    assert.equal(await menu('Valor pago').getByPlaceholder('Pesquisar').count(), 0);
    await page.keyboard.press('Escape');

    // NSIS do fluxo novo já com NSMP: etapa seguinte acrescenta equipe, supervisor e NSMP
    for (const s of ['900000001', '900000002', '900000003']) ocultos.add(s);
    await page.goto(urlBase + '/fechamento?etapa=AGUARDANDO_NSPR');
    await esperarLinhas(1);
    assert.deepEqual(await cabecalhos(), ['N° Serviço', 'Tipo do serviço', 'Localidade', 'DT execução', 'Equipe', 'Supervisor', 'NSMP', 'Etapa']);
    assert.equal(await page.locator('table.grade-nsis tbody tr td').nth(5).textContent(), 'Ana');

    // NSIS histórica mantém as colunas de hoje, inclusive Observação
    ocultos.clear(); ocultos.add('900010013');
    await page.goto(urlBase + '/fechamento?etapa=AGUARDANDO_NSPR');
    await esperarLinhas(1);
    assert.deepEqual(await cabecalhos(), [
      'N° Serviço', 'Tipo do serviço', 'NSMP', 'Equipe', 'Supervisor', 'NSPR', 'DT execução',
      'Lançamento Salesforce', 'Valor pago', 'Apropriação', 'Observação', 'Etapa',
    ]);
    await page.goto(urlBase + '/fechamento?etapa=AGUARDANDO_NSMP');
    await page.getByRole('button', { name: /Gerar NSMP/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Aguard\. fatura/ }).count(), 0);
    ocultos.clear();

    // ── Celular: sem rolagem lateral ──
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(urlBase + '/fechamento?etapa=TODAS&nsis=900000001');
    await janela.getByText('NSMP77').waitFor();
    const larguras = await janela.evaluate((d) => ({ janela: d.scrollWidth, tela: window.innerWidth, doc: document.documentElement.scrollWidth }));
    assert.ok(larguras.janela <= larguras.tela && larguras.doc <= larguras.tela, 'sem rolagem lateral: ' + JSON.stringify(larguras));
    await foto('manutencao-celular');
    await page.goto(urlBase + '/fechamento?etapa=TODAS');
    itens = itens.filter((i) => i.servico !== '900000003');
    await page.goto(urlBase + '/fechamento?etapa=TODAS&nsis=900000003');
    await form.waitFor();
    await buscar('704003');
    await buscar('cruzeta');
    const larguraForm = await janela.evaluate((d) => ({ janela: d.scrollWidth, tela: window.innerWidth, corpo: d.querySelector('form').scrollWidth, caixa: d.querySelector('form').clientWidth }));
    assert.ok(larguraForm.janela <= larguraForm.tela && larguraForm.corpo <= larguraForm.caixa, 'lançamento cabe no celular: ' + JSON.stringify(larguraForm));
    await foto('manutencao-celular-lancamento');

    assert.deepEqual(falhas, [], 'sem erro de JavaScript na tela');
    console.log('OK: janela no meio, vários códigos, fator, aviso ao fechar, NSMP/NSPR/AP do lançamento, rateio, histórico, edição, item sem código, colunas por etapa, filtros por coluna e celular.');
  } catch (e) {
    await globalThis.paginaTeste?.screenshot({ path: path.join(saida, 'manutencao-falha.png') });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
