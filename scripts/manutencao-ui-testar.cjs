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
  // histórica sem nenhum item, em A fechar: conta como fluxo novo (nada do histórico a preservar)
  { ...baseNsis('900000004', 'U', null), origem: 'HISTORICO', termino: '2026-11-08T15:00:00Z' },
  // histórica com itens, aguardando fatura: continua com a janela e as colunas antigas
  { ...baseNsis('900000005', 'U', 'Historica aguardando fatura'), origem: 'HISTORICO' },
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
  // 900000001 e 900000003 já têm um lançamento antigo pago e faturado (sem itens elas seriam fluxo novo);
  // o teste do formulário antigo parte de "Novo lançamento, com outra NSMP"
  { ...legado('900000001', 'Lancamento antigo X', 'ANT1', 0.05), nspr: 'NSPRANT', valor_final: 0.05, fatura: 'AP 1' },
  { ...legado('900000003', 'Lancamento antigo Z', 'ANT3', 0.05), nspr: 'NSPRANT', valor_final: 0.05, fatura: 'AP 3' },
  { ...legado('900000005', 'Pedido FA', 'F1', 0.1), nspr: 'P5', valor_final: 0.1 },
];
const idLegadoZ = itens.find((i) => i.servico === '900000003').id;
const escritas = [];
let atrasoGravacao = 0;
// equipes que existem em neo_disp_frotas no simulado
const frotas = { 4404: 'Vinícius' };

function comItens(n) {
  const d = itens.filter((i) => i.servico === n.servico);
  const soma = (f) => d.reduce((s, i) => s + (Number(i[f]) || 0), 0);
  const conta = (f) => d.filter(f).length;
  const semNsmp = conta((i) => !i.nsmp); const semNspr = conta((i) => i.nsmp && !i.nspr); const semFatura = conta((i) => i.nspr && !i.fatura);
  const unico = (f) => [...new Set(d.map((i) => i[f]).filter(Boolean))].join(', ') || null;
  return {
    ...n, supervisor: n.fluxo_novo ? n.supervisor_equipe : n.supervisor, qtd_itens: d.length, valor_inicial_total: soma('valor_inicial'), valor_final_total: soma('valor_final'), itens_sem_nsmp: semNsmp, itens_sem_nspr: semNspr, itens_sem_fatura: semFatura,
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

/** PATCH e POST em neo_nsis (supervisor, data do Salesforce, sem cobrança, NSIS manual). */
function responderNsis(url, metodo, corpo) {
  escritas.push({ metodo, corpo, consulta: url.search, tabela: 'neo_nsis' });
  if (metodo === 'POST') { nsis.push({ ...baseNsis(corpo.servico, 'U', corpo.observacao ?? null), ...corpo }); return []; }
  if (metodo === 'PATCH') {
    const alvo = nsis.find((n) => n.servico === url.searchParams.get('servico')?.replace('eq.', ''));
    assert.ok(alvo, 'PATCH em NSIS que não existe');
    Object.assign(alvo, corpo);
    return [];
  }
  throw Error('Método inesperado em neo_nsis: ' + metodo);
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
      if (metodo !== 'GET' && atrasoGravacao) await new Promise((r) => setTimeout(r, atrasoGravacao));
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
      else if (recurso === 'neo_nsis') corpo = responderNsis(url, metodo, req.postDataJSON());
      else if (recurso === 'neo_supervisor_da_equipe') corpo = frotas[req.postDataJSON().p_equipe] ?? null;
      else throw Error('Requisição inesperada: ' + recurso);
      const quantos = Array.isArray(corpo) ? corpo.length : 1;
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': quantos ? `0-${quantos - 1}/${quantos}` : '*/0' }, body: JSON.stringify(corpo) });
    });

    const page = await context.newPage(); globalThis.paginaTeste = page;
    page.on('pageerror', (e) => falhas.push(e.message));
    // confirm() do app: aceita por padrão; os testes de cancelamento trocam a resposta
    const dialogos = []; let aceitarDialogo = true;
    page.on('dialog', async (d) => { dialogos.push(d.message()); if (aceitarDialogo) await d.accept(); else await d.dismiss(); });
    const foto = (nome) => page.screenshot({ path: path.join(saida, nome + '.png') });
    const janela = page.getByRole('dialog');
    const form = page.getByRole('form', { name: 'Novo lançamento' });
    const novoLancamento = () => janela.getByRole('button', { name: 'Novo lançamento, com outra NSMP' }).click();
    const buscar = async (termo) => {
      await page.getByLabel('Código da Tabela 03').fill(termo);
      await page.getByText('Carregando a tabela').waitFor({ state: 'detached' });
      await page.getByLabel('Código da Tabela 03').press('Enter');
    };

    // ── A NSIS abre na janela do meio, a partir da lista, como na Conferência ──
    await page.goto(urlBase + '/fechamento?etapa=TODAS');
    await page.getByRole('cell', { name: '900000001' }).first().click();
    await janela.waitFor();
    await janela.getByText('Lancamento antigo X').waitFor();
    assert.equal(await janela.getByRole('form', { name: /Códigos, equipe/ }).count(), 0, 'NSIS histórica com itens não usa a janela do fluxo novo');
    assert.equal(await page.locator('aside.max-w-2xl').count(), 0, 'a gaveta lateral saiu');
    const caixa = await janela.boundingBox();
    assert.ok(Math.abs(caixa.x + caixa.width / 2 - 720) < 2, 'a janela fica centralizada');
    await novoLancamento();
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
    const ids = itens.filter((i) => i.servico === '900000001' && i.codigo).map((i) => i.id);
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
    await janela.getByRole('button', { name: 'Editar item 2' }).click();
    await janela.getByRole('radio', { name: /× 1,4/ }).waitFor();
    assert.equal(await janela.getByRole('radio', { name: /× 1,4/ }).isChecked(), true);
    await janela.getByText('× 1,0', { exact: true }).click();
    await janela.getByText('0,0567 US', { exact: true }).waitFor();
    await foto('manutencao-edicao');
    await janela.getByRole('button', { name: 'Cancelar' }).first().click();

    // ── Item sem código no lançamento: sem fator, valor digitado ──
    await page.goto(urlBase + '/fechamento?etapa=TODAS&nsis=900000003');
    await novoLancamento();
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
    await esperarLinhas(4);
    assert.deepEqual(await cabecalhos(), ['N° Serviço', 'Tipo do serviço', 'Localidade', 'DT execução', 'Observação', 'Etapa']);
    await page.getByRole('cell', { name: '900000004' }).waitFor();
    // a observação do GDIS aparece na célula (e a NSIS sem observação e sem itens avisa)
    await page.getByRole('cell', { name: 'Fluxo novo A' }).waitFor();
    await page.getByRole('cell', { name: 'sem observação no GDIS' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Gerar NSMP/ }).count(), 0, 'chip de histórico vazio fica escondido');
    assert.equal(await page.getByRole('button', { name: /Aguard\. fatura/ }).count(), 0, 'chip de histórico vazio fica escondido');
    assert.equal(await page.getByRole('button', { name: /Sem cobrança/ }).count(), 1);
    assert.equal(await page.getByRole('button', { name: /Aguard\. apropriação/ }).count(), 1, 'etapas novas na fila');
    assert.equal(await page.getByRole('button', { name: /Aguard\. Salesforce/ }).count(), 1);
    assert.equal(await primeiraCelula(), '900010010');
    await foto('fila-fluxo-a-fechar');
    // 1440 e 390: a página não rola de lado e o texto da Observação aparece inteiro na célula (até 2 linhas)
    for (const [largura, sufixo] of [[1440, 'desktop'], [390, 'celular']]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.waitForTimeout(150);
      const medidas = await page.evaluate(() => {
        const doc = document.documentElement;
        const celula = [...document.querySelectorAll('table.grade-nsis tbody tr td')].find((td) => td.textContent.includes('Fluxo novo A'));
        const r = celula.getBoundingClientRect();
        return { doc: doc.scrollWidth, tela: window.innerWidth, largura: r.width, cortado: celula.scrollWidth > celula.clientWidth + 1 };
      });
      assert.ok(medidas.doc <= medidas.tela, `A fechar em ${largura}: página sem rolagem lateral ${JSON.stringify(medidas)}`);
      assert.ok(medidas.largura >= 255 && !medidas.cortado, `A fechar em ${largura}: Observação com largura mínima e sem corte ${JSON.stringify(medidas)}`);
      await page.locator('table.grade-nsis').scrollIntoViewIfNeeded();
      await foto('fila-fluxo-a-fechar-' + sufixo);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

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
    await esperarLinhas(4);
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
    await esperarLinhas(9);
    assert.deepEqual(await cabecalhos(), [
      'N° Serviço', 'Tipo do serviço', 'Localidade', 'DT execução', 'Equipe', 'Supervisor', 'NSMP', 'NSPR',
      'Lançamento Salesforce', 'Valor pago', 'Data lançamento SF', 'Apropriação', 'Observação', 'Etapa',
    ], 'na etapa Todas aparecem todas as colunas');
    await page.getByRole('button', { name: 'Filtrar Valor pago' }).click();
    await menu('Valor pago').getByRole('button', { name: 'Do menor para o maior' }).waitFor();
    assert.equal(await menu('Valor pago').getByPlaceholder('Pesquisar').count(), 0);
    await page.keyboard.press('Escape');
    // Observação (texto livre) também só ordena: sem pesquisa nem lista de valores
    await page.getByRole('button', { name: 'Filtrar Observação' }).click();
    await menu('Observação').getByRole('button', { name: 'Ordenar de A a Z' }).waitFor();
    assert.equal(await menu('Observação').getByPlaceholder('Pesquisar').count(), 0);
    await page.keyboard.press('Escape');

    // NSIS do fluxo novo já com NSMP: etapa seguinte acrescenta equipe, supervisor e NSMP
    for (const s of ['900000001', '900000002', '900000003']) ocultos.add(s);
    await page.goto(urlBase + '/fechamento?etapa=AGUARDANDO_NSPR');
    await esperarLinhas(1);
    assert.deepEqual(await cabecalhos(), ['N° Serviço', 'Tipo do serviço', 'Localidade', 'DT execução', 'Equipe', 'Supervisor', 'NSMP', 'Etapa']);
    assert.equal(await page.locator('table.grade-nsis tbody tr td').nth(5).textContent(), 'Ana');
    assert.equal(await page.getByRole('cell', { name: 'Fluxo novo D' }).count(), 0, 'a observação não aparece depois de A fechar');

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
    itens = itens.filter((i) => i.servico !== '900000003' || i.id === idLegadoZ);
    await page.goto(urlBase + '/fechamento?etapa=TODAS&nsis=900000003');
    await novoLancamento();
    await form.waitFor();
    await buscar('704003');
    await buscar('cruzeta');
    const larguraForm = await janela.evaluate((d) => ({ janela: d.scrollWidth, tela: window.innerWidth, corpo: d.querySelector('form').scrollWidth, caixa: d.querySelector('form').clientWidth }));
    assert.ok(larguraForm.janela <= larguraForm.tela && larguraForm.corpo <= larguraForm.caixa, 'lançamento cabe no celular: ' + JSON.stringify(larguraForm));
    await foto('manutencao-celular-lancamento');

    // ── Janela do fluxo novo: quatro etapas pela interface ──
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const dias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const mais = (servico, tipo, localidade) => nsis.push(novaNsis(servico, tipo, localidade, '2026-11-07T15:00:00Z', 'Fluxo novo, janela'));
    mais('900020001', 'NSIS', '3001'); mais('900020002', 'NSRI', '3002'); mais('900020003', 'NSIS', '3003'); mais('900020004', 'NSIS', '3004');
    await page.setViewportSize({ width: 1440, height: 1300 });
    const abrir = async (servico) => { await page.goto(`${urlBase}/fechamento?etapa=TODAS&nsis=${servico}`); await janela.getByText('Detalhes da execução').waitFor(); };
    const formEtapa = (nome) => janela.getByRole('form', { name: new RegExp(nome) });
    const resumo = (nome) => janela.getByRole('region', { name: new RegExp(nome) });
    const chip = (nome) => janela.getByText(nome, { exact: true }).first();
    const salvar = (nome) => formEtapa(nome).getByRole('button', { name: 'Salvar' });
    const alerta = (nome, texto) => formEtapa(nome).getByRole('alert').getByText(texto).waitFor();
    const semBotaoNovo = async () => assert.equal(await janela.getByRole('button', { name: /Novo lançamento|Adicionar mais códigos/ }).count(), 0, 'o fluxo novo não tem novo lançamento');
    const itensDe = (servico) => itens.filter((i) => i.servico === servico);
    const nsisDe = (servico) => nsis.find((n) => n.servico === servico);
    const E1 = 'Códigos, equipe e NSMP'; const E2 = 'NSPR e valor pago'; const E3 = 'Lançamento no Salesforce'; const E4 = 'Apropriação';
    /** Nada passa da borda da janela, no desktop (1440) e no celular (390): confere e tira a foto dos dois. */
    const fotoNosDois = async (nome) => {
      for (const [largura, sufixo] of [[1440, 'desktop'], [390, 'celular']]) {
        await page.setViewportSize({ width: largura, height: 1500 });
        await page.waitForTimeout(150);
        const cortes = await janela.evaluate((d) => {
          const borda = d.getBoundingClientRect();
          const fora = [...d.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > borda.right + 1 || r.left < borda.left - 1); });
          return { rolagem: d.scrollWidth > d.clientWidth + 1, doc: document.documentElement.scrollWidth > window.innerWidth, fora: fora.map((e) => e.tagName + ':' + (e.textContent || '').slice(0, 30)) };
        });
        assert.deepEqual(cortes, { rolagem: false, doc: false, fora: [] }, `nada cortado em ${nome} (${sufixo})`);
        await foto(`fluxo-${nome}-${sufixo}`);
      }
      await page.setViewportSize({ width: 1440, height: 1300 });
    };

    // NSIS comum: etapa 1
    await abrir('900020001');
    await formEtapa(E1).waitFor();
    await semBotaoNovo();
    assert.equal(await janela.getByRole('radio').count(), 2, 'só os dois fatores do fluxo novo');
    assert.equal(await janela.getByRole('radio', { name: /Urbano e CSC/ }).isChecked(), true, 'zona urbana abre em Urbano e CSC');
    assert.equal(await janela.getByRole('radio', { name: /Rural e CSC/ }).isChecked(), false);
    assert.equal(await janela.getByText('× 1,4').count(), 0, 'sem fator de 1,4');
    assert.equal(await formEtapa(E1).getByLabel('NSMP').count(), 1);
    assert.equal(await formEtapa(E1).getByLabel('Valor pago (US)').count(), 0, 'só a NSRI pede valor pago na etapa 1');
    await formEtapa(E1).getByRole('button', { name: 'Salvar' }).click();
    await alerta(E1, 'Escolha pelo menos um código.');
    await buscar('704003');
    await formEtapa(E1).getByLabel('Qtd (arvore)').fill('2');
    await janela.getByRole('radio', { name: /Rural e CSC/ }).check({ force: true });
    await formEtapa(E1).getByText('0,2400 US').waitFor();
    await salvar(E1).click();
    await alerta(E1, 'Informe o número da equipe.');
    await formEtapa(E1).getByLabel('Nº da equipe').fill('4404');
    await formEtapa(E1).getByLabel('Nº da equipe').blur();
    await formEtapa(E1).getByText('Supervisor: Vinícius').waitFor();
    await salvar(E1).click();
    await alerta(E1, 'Informe a NSMP.');
    assert.equal(itensDe('900020001').length, 0, 'nada foi gravado com a NSMP vazia');
    await formEtapa(E1).getByLabel('NSMP').fill('NSMP100');
    await fotoNosDois('etapa1');
    escritas.length = 0;
    await salvar(E1).click();
    await formEtapa(E2).waitFor();
    await chip('Aguardando NSPR').waitFor();
    assert.deepEqual(itensDe('900020001').map((i) => [i.codigo, i.quantidade, i.fator, i.valor_inicial, i.equipe, i.nsmp, i.nspr]), [['704003', 2, 1.2, 0.24, '4404', 'NSMP100', null]]);
    assert.equal(nsisDe('900020001').supervisor_equipe, 'Vinícius', 'o supervisor da frota fica gravado');
    await semBotaoNovo();
    await resumo(E1).getByText('NSMP100').waitFor();

    // Etapa 2: NSPR e valor pago em US
    assert.equal(await janela.getByLabel('NSMC').count(), 0);
    await salvar(E2).click();
    await alerta(E2, 'Informe a NSPR.');
    await formEtapa(E2).getByLabel('NSPR', { exact: true }).fill('NSPR200');
    await salvar(E2).click();
    await alerta(E2, 'Informe o valor pago (zero é aceito).');
    assert.equal(itensDe('900020001')[0].nspr, null, 'valor vazio não avança a etapa');
    await formEtapa(E2).getByLabel('Valor pago (US)').fill('abc');
    await salvar(E2).click();
    await alerta(E2, 'Valor pago inválido.');
    await formEtapa(E2).getByLabel('Valor pago (US)').fill('1,5');
    await fotoNosDois('etapa2');
    await salvar(E2).click();
    await formEtapa(E3).waitFor();
    await chip('Aguardando Salesforce').waitFor();
    assert.deepEqual([itensDe('900020001')[0].nspr, itensDe('900020001')[0].valor_final], ['NSPR200', 1.5], '1,5 vale 1,5');

    // Etapa 3: data de lançamento no Salesforce
    assert.equal(await formEtapa(E3).getByLabel('Data de lançamento no Salesforce').getAttribute('max'), hoje, 'a data máxima é hoje em Brasília');
    await salvar(E3).click();
    await alerta(E3, 'Informe a data de lançamento no Salesforce.');
    await formEtapa(E3).getByLabel('Data de lançamento no Salesforce').fill(dias(3));
    await salvar(E3).click();
    await alerta(E3, 'A data de lançamento não pode ser futura.');
    assert.equal(nsisDe('900020001').data_lancamento_sf, null, 'data futura não grava');
    await formEtapa(E3).getByLabel('Data de lançamento no Salesforce').fill(hoje);
    await fotoNosDois('etapa3');
    await salvar(E3).click();
    await formEtapa(E4).waitFor();
    await chip('Aguardando apropriação').waitFor();
    assert.equal(nsisDe('900020001').data_lancamento_sf, hoje);

    // Etapa 4: apropriação, e a NSIS conclui
    await salvar(E4).click();
    await alerta(E4, 'Informe a apropriação.');
    await formEtapa(E4).getByLabel('Apropriação (AP)').fill('83809');
    await fotoNosDois('etapa4');
    await salvar(E4).click();
    await chip('Concluída').waitFor();
    await janela.getByText('NSIS concluída').waitFor();
    assert.equal(await janela.getByRole('form').count(), 0, 'concluída: só o resumo');
    assert.equal(itensDe('900020001')[0].fatura, 'AP 83809');
    await resumo(E4).getByText('AP 83809').waitFor();
    await semBotaoNovo();
    await fotoNosDois('concluida');

    // Corrigir: reabre a etapa preenchida e atualiza no lugar
    await resumo(E2).getByRole('button', { name: 'Corrigir' }).click();
    assert.equal(await formEtapa(E2).getByLabel('NSPR', { exact: true }).inputValue(), 'NSPR200');
    assert.equal(await formEtapa(E2).getByLabel('Valor pago (US)').inputValue(), '1,5');
    await formEtapa(E2).getByLabel('NSPR', { exact: true }).fill('NSPR201');
    await salvar(E2).click();
    await formEtapa(E2).waitFor({ state: 'detached' });
    await resumo(E2).getByText('NSPR201').waitFor();
    assert.equal(itensDe('900020001')[0].nspr, 'NSPR201');
    await chip('Concluída').waitFor();

    await resumo(E1).getByRole('button', { name: 'Corrigir' }).click();
    await formEtapa(E1).getByText('704003').waitFor();
    assert.equal(await formEtapa(E1).getByLabel('Nº da equipe').inputValue(), '4404');
    await formEtapa(E1).getByText('Supervisor: Vinícius').waitFor();
    assert.equal(await formEtapa(E1).getByLabel('NSMP').inputValue(), 'NSMP100');
    assert.equal(await formEtapa(E1).getByLabel('Qtd (arvore)').inputValue(), '2');
    assert.equal(await formEtapa(E1).getByRole('button', { name: 'Cancelar' }).count(), 1);
    await fotoNosDois('corrigir-etapa1');
    await formEtapa(E1).getByLabel('NSMP').fill('NSMP101');
    await formEtapa(E1).getByLabel('Qtd (arvore)').fill('3');
    await salvar(E1).click();
    await formEtapa(E1).waitFor({ state: 'detached' });
    await resumo(E1).getByText('NSMP101').waitFor();
    assert.deepEqual(itensDe('900020001').map((i) => [i.nsmp, i.quantidade, i.valor_inicial, i.nspr, i.fatura, i.valor_final]), [['NSMP101', 3, 0.36, 'NSPR201', 'AP 83809', 1.5]], 'a correção mantém NSPR, AP e total pago');

    // Desfazer esta etapa: a NSIS volta para ela e o dado some (etapa 1 não tem desfazer)
    assert.equal(await resumo(E1).getByRole('button', { name: 'Desfazer esta etapa' }).count(), 0);
    // Cancelar o diálogo: nada é apagado e a NSIS continua na mesma etapa
    aceitarDialogo = false;
    for (const [etapa, trecho] of [[E4, 'O número da apropriação será apagado'], [E3, 'A data será apagada'], [E2, 'A NSPR e o valor pago desta NSIS serão apagados']]) {
      dialogos.length = 0;
      escritas.length = 0;
      await resumo(etapa).getByRole('button', { name: 'Desfazer esta etapa' }).click();
      await page.waitForTimeout(300);
      assert.equal(dialogos.length, 1, `desfazer pede confirmação (${etapa})`);
      assert.ok(dialogos[0].includes(trecho), `o diálogo diz o que será apagado: ${dialogos[0]}`);
      assert.equal(escritas.filter((e) => e.metodo !== 'GET').length, 0, 'cancelar não grava nada');
    }
    assert.equal(itensDe('900020001')[0].fatura, 'AP 83809', 'cancelar mantém a apropriação');
    assert.equal(nsisDe('900020001').data_lancamento_sf, hoje, 'cancelar mantém a data do Salesforce');
    assert.deepEqual([itensDe('900020001')[0].nspr, itensDe('900020001')[0].valor_final], ['NSPR201', 1.5], 'cancelar mantém NSPR e valor pago');
    await chip('Concluída').waitFor();
    assert.equal(await janela.getByRole('form').count(), 0, 'cancelar não reabre etapa nenhuma');
    // Aceitar o diálogo: o dado some e a NSIS volta à etapa
    aceitarDialogo = true;
    await resumo(E4).getByRole('button', { name: 'Desfazer esta etapa' }).click();
    await chip('Aguardando apropriação').waitFor();
    assert.equal(itensDe('900020001')[0].fatura, null);
    await formEtapa(E4).waitFor();
    await resumo(E3).getByRole('button', { name: 'Desfazer esta etapa' }).click();
    await chip('Aguardando Salesforce').waitFor();
    assert.equal(nsisDe('900020001').data_lancamento_sf, null);
    await resumo(E2).getByRole('button', { name: 'Desfazer esta etapa' }).click();
    await chip('Aguardando NSPR').waitFor();
    assert.deepEqual([itensDe('900020001')[0].nspr, itensDe('900020001')[0].valor_final], [null, null]);
    // valor pago zero é aceito
    await formEtapa(E2).getByLabel('NSPR', { exact: true }).fill('NSPR202');
    await formEtapa(E2).getByLabel('Valor pago (US)').fill('0');
    await salvar(E2).click();
    await chip('Aguardando Salesforce').waitFor();
    assert.deepEqual([itensDe('900020001')[0].nspr, itensDe('900020001')[0].valor_final], ['NSPR202', 0], 'zero é um valor pago');

    // NSRI: etapa 1 pede NSMC e valor pago, e vai direto para o Salesforce
    await abrir('900020002');
    await formEtapa('Códigos, equipe, NSMC e valor pago').waitFor();
    assert.equal(await janela.getByLabel('NSMP').count(), 0, 'na NSRI o campo é NSMC');
    await buscar('704004');
    await formEtapa('NSMC').getByLabel('Nº da equipe').fill('4404');
    await formEtapa('NSMC').getByLabel('NSMC').fill('NSMC1');
    await formEtapa('NSMC').getByRole('button', { name: 'Salvar' }).click();
    await alerta('NSMC', 'Informe o valor pago (zero é aceito).');
    assert.equal(itensDe('900020002').length, 0, 'sem valor pago a NSRI não grava');
    await formEtapa('NSMC').getByLabel('Valor pago (US)').fill('0,5');
    await fotoNosDois('nsri-etapa1');
    await formEtapa('NSMC').getByRole('button', { name: 'Salvar' }).click();
    await formEtapa(E3).waitFor();
    await chip('Aguardando Salesforce').waitFor();
    assert.deepEqual(itensDe('900020002').map((i) => [i.nsmp, i.nspr, i.valor_final]), [['NSMC1', null, 0.5]]);
    assert.equal(await janela.getByLabel('NSPR', { exact: true }).count(), 0, 'a NSRI não pede NSPR');
    await resumo('Códigos, equipe, NSMC').getByText('NSMC1').waitFor();
    await fotoNosDois('nsri-etapa3');

    // Supervisor: equipe fora das frotas abre o campo à mão, opcional
    await abrir('900020003');
    await formEtapa(E1).waitFor();
    await buscar('704003');
    await formEtapa(E1).getByLabel('NSMP').fill('NSMP300');
    const equipeCampo = formEtapa(E1).getByLabel('Nº da equipe');
    assert.equal(await formEtapa(E1).getByText(/Supervisor/).count(), 0, 'sem equipe não há supervisor');
    await equipeCampo.fill('abc'); await equipeCampo.blur();
    await formEtapa(E1).getByLabel('Supervisor (informar à mão)').waitFor();
    await foto('fluxo-supervisor-manual');
    await equipeCampo.fill('999999'); await equipeCampo.blur();
    await formEtapa(E1).getByLabel('Supervisor (informar à mão)').waitFor();
    await equipeCampo.fill('4404'); await equipeCampo.blur();
    await formEtapa(E1).getByText('Supervisor: Vinícius').waitFor();
    assert.equal(await formEtapa(E1).getByLabel('Supervisor (informar à mão)').count(), 0, 'equipe da frota preenche sozinha');
    await equipeCampo.fill('abc'); await equipeCampo.blur();
    await formEtapa(E1).getByLabel('Supervisor (informar à mão)').waitFor();
    await salvar(E1).click(); // o campo à mão é opcional: vazio não bloqueia
    await formEtapa(E2).waitFor();
    assert.equal(nsisDe('900020003').supervisor_equipe, null);
    assert.equal(itensDe('900020003')[0].equipe, 'abc');
    // e preenchido na correção
    await resumo(E1).getByRole('button', { name: 'Corrigir' }).click();
    await formEtapa(E1).getByLabel('Supervisor (informar à mão)').fill('Elton');
    await salvar(E1).click();
    await formEtapa(E1).waitFor({ state: 'detached' });
    assert.equal(nsisDe('900020003').supervisor_equipe, 'Elton');
    await resumo(E1).getByText('Elton').waitFor();

    // Duplo clique em Salvar grava uma vez só e não passa duas etapas
    atrasoGravacao = 400;
    await abrir('900020004');
    await formEtapa(E1).waitFor();
    await buscar('704001');
    await formEtapa(E1).getByLabel('Nº da equipe').fill('4404');
    await formEtapa(E1).getByLabel('NSMP').fill('NSMP400');
    escritas.length = 0;
    await salvar(E1).dblclick();
    await formEtapa(E2).waitFor();
    assert.equal(itensDe('900020004').length, 1, 'o duplo clique não duplica o item');
    assert.equal(escritas.filter((e) => e.metodo === 'POST' && !e.tabela).length, 1, 'uma gravação de itens só');
    await chip('Aguardando NSPR').waitFor();
    await formEtapa(E2).getByLabel('NSPR', { exact: true }).fill('NSPR400');
    await formEtapa(E2).getByLabel('Valor pago (US)').fill('0,1');
    escritas.length = 0;
    await salvar(E2).dblclick();
    await formEtapa(E3).waitFor();
    assert.equal(escritas.filter((e) => e.metodo === 'POST').length, 1, 'uma confirmação só');
    await chip('Aguardando Salesforce').waitFor();
    atrasoGravacao = 0;

    // NSIS histórica sem itens em A fechar: a lista mistura com fluxo novo e mesmo assim só tem as colunas da etapa
    ocultos.clear();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(urlBase + '/fechamento?etapa=A_FECHAR');
    await page.getByRole('cell', { name: '900000004' }).waitFor();
    assert.ok(await page.getByRole('cell', { name: '900010010' }).count() >= 1, 'a lista tem NSIS do fluxo novo junto');
    assert.deepEqual(await cabecalhos(), ['N° Serviço', 'Tipo do serviço', 'Localidade', 'DT execução', 'Observação', 'Etapa'], 'só a Observação a mais; sem Lançamento Salesforce');
    await foto('fila-historica-a-fechar');

    // ...e a janela dela é a do fluxo novo: sem a palavra COD, pede códigos, equipe e NSMP
    await abrir('900000004');
    await formEtapa(E1).waitFor();
    await semBotaoNovo();
    assert.doesNotMatch(await janela.innerText(), /COD/i, 'a janela do fluxo novo não menciona COD');
    assert.equal(await janela.getByRole('radio').count(), 2, 'só os dois fatores do fluxo novo');
    await janela.getByRole('radio', { name: /Urbano e CSC/ }).waitFor();
    await janela.getByRole('radio', { name: /Rural e CSC/ }).waitFor();
    await formEtapa(E1).getByLabel('Código da Tabela 03').waitFor();
    await formEtapa(E1).getByLabel('Nº da equipe').waitFor();
    await formEtapa(E1).getByLabel('NSMP').waitFor();
    await fotoNosDois('historica-etapa1');
    await buscar('704003');
    assert.doesNotMatch(await janela.innerText(), /COD/i, 'nem depois de escolher um código');
    await formEtapa(E1).getByLabel('Nº da equipe').fill('4404');
    await formEtapa(E1).getByLabel('NSMP').fill('NSMP500');
    escritas.length = 0;
    assert.equal(nsisDe('900000004').fluxo_novo, false);
    await salvar(E1).click();
    await formEtapa(E2).waitFor();
    await chip('Aguardando NSPR').waitFor();
    assert.equal(nsisDe('900000004').fluxo_novo, true, 'salvar a etapa 1 marca a NSIS como fluxo novo');
    const gravadas = escritas.filter((e) => e.metodo !== 'GET').map((e) => (e.tabela ?? 'neo_nsis_itens') + ':' + e.metodo);
    assert.deepEqual(gravadas, ['neo_nsis:PATCH', 'neo_nsis_itens:POST'], 'a NSIS é marcada antes de gravar os itens');
    assert.equal(escritas[0].corpo.fluxo_novo, true);
    assert.deepEqual(itensDe('900000004').map((i) => [i.codigo, i.equipe, i.nsmp]), [['704003', '4404', 'NSMP500']]);

    // NSIS histórica com itens (aguardando fatura): colunas e janela antigas
    await page.goto(urlBase + '/fechamento?etapa=AGUARDANDO_FATURA');
    await esperarLinhas(1);
    assert.deepEqual(await cabecalhos(), [
      'N° Serviço', 'Tipo do serviço', 'NSMP', 'Equipe', 'Supervisor', 'NSPR', 'DT execução',
      'Lançamento Salesforce', 'Valor pago', 'Apropriação', 'Observação', 'Etapa',
    ]);
    await abrir('900000005');
    await janela.getByText('Pedido FA').waitFor();
    assert.equal(await janela.getByRole('form', { name: /Códigos, equipe/ }).count(), 0, 'histórica com itens não ganha a janela do fluxo novo');
    assert.equal(await janela.getByLabel('Ex.: AP 83809').count(), 1, 'a janela antiga pede a fatura');

    // NSIS histórica abre a janela antiga, com Novo lançamento
    await abrir('900000002');
    await janela.getByRole('button', { name: 'Novo lançamento, com outra NSMP' }).waitFor();
    assert.equal(await janela.getByRole('form', { name: new RegExp(E1) }).count(), 0);
    assert.equal(await janela.getByRole('button', { name: 'Desfazer esta etapa' }).count(), 0);
    await janela.getByText('Pedido antigo A').waitFor();

    assert.deepEqual(falhas, [], 'sem erro de JavaScript na tela');
    console.log('OK: janela no meio, vários códigos, fator, aviso ao fechar, NSMP/NSPR/AP do lançamento, rateio, histórico, edição, item sem código, colunas por etapa, filtros por coluna, celular e janela do fluxo novo (4 etapas, NSRI, supervisor, valor pago, data, desfazer, corrigir, duplo clique).');
  } catch (e) {
    await globalThis.paginaTeste?.screenshot({ path: path.join(saida, 'manutencao-falha.png') });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
