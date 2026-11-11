// Passar o mouse na grade do mês: precisa ser liso e marcar a cruz (linha e coluna) da célula. Supabase simulado.
// Mede com a CPU 4x mais lenta, para o resultado valer em computador fraco. Rode com `npm run dev` aberto (ou NEO_TEST_URL).
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('../.tmp-faturamento/browser/node_modules/playwright');

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const api = new URL(env.VITE_NEO_SUPABASE_URL);
const urlBase = (process.env.NEO_TEST_URL || 'http://localhost:5173').replace(/\/$/, '');
const saida = path.resolve('.tmp-faturamento');
const dados = JSON.parse(fs.readFileSync(path.join(saida, 'disp-dados.json'), 'utf8'));
const id = '00000000-0000-0000-0000-000000000001';
const usuario = { id, email: 'teste@example.invalid', aud: 'authenticated', role: 'authenticated' };
const sessao = { access_token: 'teste-local', refresh_token: 'teste-local', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, token_type: 'bearer', user: usuario };

function linhasDoMes(pre) {
  const linhas = new Map();
  for (const o of dados.ocorrencias) if (o.dia.startsWith(pre)) linhas.set(`${o.dia}|${o.frota}`, { dia: o.dia, frota: o.frota, situacao: 'OCORRENCIA', causa: o.causa, observacao: null });
  if (pre === '2026-10') for (let d = 1; d <= 31; d++) {
    const dia = `2026-10-${String(d).padStart(2, '0')}`;
    for (const f of dados.frotas) if (!linhas.has(`${dia}|${f.frota}`)) linhas.set(`${dia}|${f.frota}`, { dia, frota: f.frota, situacao: 'CADASTROU', causa: null, observacao: null });
  }
  return [...linhas.values()];
}

async function abrir(browser, largura, altura) {
  const context = await browser.newContext({ viewport: { width: largura, height: altura } });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: 'sb-' + api.hostname.split('.')[0] + '-auth-token', value: sessao });
  await context.route('**/*.supabase.co/**', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const recurso = url.pathname.split('/').pop();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200 });
    let corpo = null;
    if (url.hostname === api.hostname) {
      if (recurso === 'user') corpo = usuario;
      else if (recurso === 'neo_acessos') corpo = { user_id: id, papel: 'ADMIN', modulos: [], ativo: true };
      else if (recurso === 'colaboradores') corpo = { id, nome: 'Revisao da interface' };
      else if (recurso === 'neo_disp_frotas') corpo = dados.frotas.map((f) => ({ ...f, ativo: true }));
      else if (recurso === 'neo_disp_mes') { const { p_ano, p_mes } = req.postDataJSON(); corpo = linhasDoMes(`${p_ano}-${String(p_mes).padStart(2, '0')}`); }
      else if (recurso === 'neo_disp_ano') corpo = [];
      else if (recurso === 'neo_disp_equipe_estado') corpo = [];
      else if (recurso === 'neo_disp_config') corpo = { valor_ocorrencia: 864, meta_mensal: 30000 };
      else throw Error('Requisição inesperada: ' + recurso);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00'));
  await page.goto(urlBase + '/disponibilidade');
  await page.getByRole('heading', { name: 'Conferência do mês' }).waitFor();
  return { context, page };
}

const irParaOutubro = async (page) => {
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.getByTestId('mes-atual').getByText('Outubro de 2026').waitFor();
  await page.locator('.disp-cel.m[data-frota="9477"]').first().waitFor();
};

// Varre a grade em zigue-zague e devolve o trabalho do navegador por movimento e o intervalo entre quadros.
async function medir(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const caixa = await page.locator('.disp-rolo').boundingBox();
  const metricas = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await page.evaluate(() => {
    window.__quadros = []; let antes = performance.now();
    const passo = (t) => { window.__quadros.push(t - antes); antes = t; window.__raf = requestAnimationFrame(passo); };
    window.__raf = requestAnimationFrame(passo);
  });
  const a = await metricas();
  const MOVIMENTOS = 60;
  for (let i = 0; i < MOVIMENTOS; i++) {
    const x = caixa.x + 80 + ((i * 11) % (caixa.width - 180));
    const y = caixa.y + 70 + ((i * 7) % (caixa.height - 120));
    await page.mouse.move(x, y);
  }
  const b = await metricas();
  const quadros = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__quadros.slice(1); });
  // Clique até os motivos aparecerem, ainda com a CPU mais lenta
  const antesClique = Date.now();
  await page.locator('.disp-cel[data-frota="9477"][data-dia="2026-10-30"]').click();
  await page.locator('[data-slot="popover-content"]').getByRole('button', { name: 'Cadastrou' }).waitFor();
  const cliqueAteAbrir = Date.now() - antesClique;
  await page.keyboard.press('Escape');
  await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const ordenados = [...quadros].sort((p, q) => p - q);
  const ms = (nome) => (b[nome] - a[nome]) * 1000;
  return {
    scriptPorMovimento: ms('ScriptDuration') / MOVIMENTOS,
    estiloPorMovimento: ms('RecalcStyleDuration') / MOVIMENTOS,
    layoutPorMovimento: ms('LayoutDuration') / MOVIMENTOS,
    quadroMediano: ordenados[Math.floor(ordenados.length / 2)],
    quadroP95: ordenados[Math.floor(ordenados.length * 0.95)],
    quadrosLentos: quadros.filter((q) => q > 50).length,
    totalQuadros: quadros.length,
    cliqueAteAbrir,
  };
}

// Posição e tamanho das duas faixas comparados com a célula sob o mouse, já descontada a rolagem.
const alinhamento = (page, frota, dia) => page.evaluate(({ frota, dia }) => {
  const cel = document.querySelector(`.disp-cel[data-frota="${frota}"][data-dia="${dia}"]`).closest('td').getBoundingClientRect();
  const tab = document.querySelector('.disp-grade').getBoundingClientRect();
  const h = document.querySelector('.disp-cruz-h').getBoundingClientRect();
  const v = document.querySelector('.disp-cruz-v').getBoundingClientRect();
  return { cel: { top: cel.top, height: cel.height, left: cel.left, width: cel.width }, tab: { left: tab.left, width: tab.width, top: tab.top, height: tab.height }, h: { top: h.top, height: h.height, left: h.left, width: h.width }, v: { top: v.top, height: v.height, left: v.left, width: v.width } };
}, { frota, dia });

function conferirFaixas(a, onde) {
  const perto = (x, y, nome) => assert.ok(Math.abs(x - y) < 0.6, `${onde}: ${nome} ${x} != ${y}`);
  perto(a.h.top, a.cel.top, 'linha, topo'); perto(a.h.height, a.cel.height, 'linha, altura');
  perto(a.h.left, a.tab.left, 'linha, início'); perto(a.h.width, a.tab.width, 'linha, largura');
  perto(a.v.left, a.cel.left, 'coluna, início'); perto(a.v.width, a.cel.width, 'coluna, largura');
  perto(a.v.top, a.tab.top, 'coluna, topo'); perto(a.v.height, a.tab.height, 'coluna, altura');
}

const marcadas = (page) => page.evaluate(() => [...document.querySelectorAll('.disp-grade .disp-cruz')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
const dicaVisivel = (page) => page.evaluate(() => { const d = document.querySelector('.disp-dica'); return d && getComputedStyle(d).visibility === 'visible' ? d.textContent : null; });
const faixasVisiveis = (page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 200));
  return ['.disp-cruz-h', '.disp-cruz-v'].map((s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).opacity) : -1; });
});
const pontoDe = async (page, frota, dia) => {
  const celula = page.locator(`.disp-cel[data-frota="${frota}"][data-dia="${dia}"]`);
  await celula.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  const c = await celula.locator('xpath=..').boundingBox();
  return [c.x + c.width / 2, c.y + c.height / 2];
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const falhas = [];
  try {
    const { context, page } = await abrir(browser, 1440, 900);
    page.on('pageerror', (e) => falhas.push(e.message));
    await irParaOutubro(page);

    const m = await medir(page);
    console.log('medição (CPU 4x mais lenta, 60 movimentos):', Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v * 10) / 10])));

    // Liso: cada movimento precisa caber em meio quadro de tela (8 ms), mesmo com a CPU lenta; redesenhar a grade passa de 800 ms
    assert.ok(m.scriptPorMovimento < 8, `script por movimento: ${m.scriptPorMovimento.toFixed(1)} ms`);
    assert.ok(m.estiloPorMovimento < 8, `estilo por movimento: ${m.estiloPorMovimento.toFixed(1)} ms`);

    // A cruz acompanha a célula e marca as pontas fixas
    await page.mouse.move(...(await pontoDe(page, 9477, '2026-10-30')));
    conferirFaixas(await alinhamento(page, 9477, '2026-10-30'), 'desk');
    assert.deepEqual(await faixasVisiveis(page), [1, 1]);
    const pontas = await marcadas(page);
    assert.equal(pontas.length, 4, 'dia, frota, valor e rodapé');
    assert.ok(pontas.includes('9477'), 'frota da linha');
    assert.ok(pontas.some((t) => t.startsWith('30')), 'dia da coluna');
    assert.match(await dicaVisivel(page), /^9477 · 30\/10 · Veículo Quebrado/);
    await page.screenshot({ path: path.join(saida, 'disp-cruz-desk.png') });

    // As faixas não atrapalham o clique
    const dono = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).className, await pontoDe(page, 9477, '2026-10-30'));
    assert.match(dono, /disp-cel/);

    // Outra célula: a cruz anda e a anterior some
    await page.mouse.move(...(await pontoDe(page, 4052, '2026-10-05')));
    conferirFaixas(await alinhamento(page, 4052, '2026-10-05'), 'outra célula');
    assert.ok((await marcadas(page)).includes('4052'));
    assert.ok(!(await marcadas(page)).includes('9477'));
    assert.match(await dicaVisivel(page), /^4052 · 05\/10/);

    // Fora das células: nada de cruz nem dica
    await page.locator('[data-frota-hist="4052"]').hover();
    assert.deepEqual(await marcadas(page), []);
    assert.equal(await dicaVisivel(page), null);
    assert.deepEqual(await faixasVisiveis(page), [0, 0]);
    await page.mouse.move(...(await pontoDe(page, 4052, '2026-10-05')));
    await page.getByRole('heading', { name: 'Conferência do mês' }).hover();
    assert.deepEqual(await marcadas(page), []);
    assert.deepEqual(await faixasVisiveis(page), [0, 0]);

    // O clique segue abrindo os motivos, e a dica acompanha o que foi gravado
    await page.locator('.disp-cel[data-frota="9477"][data-dia="2026-10-30"]').click();
    await page.locator('[data-slot="popover-content"]').getByRole('button', { name: 'Cadastrou' }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });

    // Dia futuro também mostra a cruz e a dica, sem abrir nada
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await page.getByTestId('mes-atual').getByText('Novembro de 2026').waitFor();
    await page.mouse.move(...(await pontoDe(page, 4052, '2026-11-20')));
    conferirFaixas(await alinhamento(page, 4052, '2026-11-20'), 'dia futuro');
    assert.match(await dicaVisivel(page), /fora do período/);
    await page.mouse.down(); await page.mouse.up();
    assert.equal(await page.locator('[data-slot="popover-content"]').count(), 0, 'dia futuro não abre');
    await context.close();

    // Grade rolada na tela estreita: a cruz continua em cima da célula
    {
      const { context: c2, page: p2 } = await abrir(browser, 900, 700);
      p2.on('pageerror', (e) => falhas.push(e.message));
      await irParaOutubro(p2);
      await p2.locator('.disp-rolo').evaluate((e) => { e.scrollLeft = 300; e.scrollTop = 400; });
      const cel = p2.locator('.disp-cel[data-dia="2026-10-20"]').nth(20);
      const frota = await cel.getAttribute('data-frota');
      await cel.hover();
      conferirFaixas(await alinhamento(p2, frota, '2026-10-20'), 'rolada');
      await p2.screenshot({ path: path.join(saida, 'disp-cruz-rolada.png') });
      await c2.close();
    }

    assert.deepEqual(falhas, []);
    console.log('PASSOU');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
