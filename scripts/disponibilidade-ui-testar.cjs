// Interface real da Disponibilidade com o Supabase simulado em memória (nenhuma escrita remota).
// Dados: .tmp-faturamento/disp-dados.json, gerado da planilha por .tmp-faturamento/gerar-disp-historico.py.
// Rode com `npm run dev` aberto (ou NEO_TEST_URL). Capturas em .tmp-faturamento/disp-*.png.
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
const MULT = ['Veículo Quebrado', 'Atraso superior a 4h', 'Descadastramento Antecipado'];
const texto = async (l) => (await l.textContent()).replace(/\s+/g, ' ').trim();

function banco() {
  const linhas = new Map();
  const k = (d, f) => `${d}|${f}`;
  for (const o of dados.ocorrencias) linhas.set(k(o.dia, o.frota), { dia: o.dia, frota: o.frota, situacao: 'OCORRENCIA', causa: o.causa, observacao: null });
  for (let d = new Date(2026, 2, 23); d <= new Date(2026, 9, 31); d.setDate(d.getDate() + 1)) {
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const f of dados.frotas) if (!linhas.has(k(dia, f.frota))) linhas.set(k(dia, f.frota), { dia, frota: f.frota, situacao: 'CADASTROU', causa: null, observacao: null });
  }
  return { linhas, k, config: { valor_ocorrencia: 864, meta_mensal: 30000 }, escritas: [], falhar: false };
}

async function novoContexto(browser, db, largura, altura, papel, modulos) {
  const context = await browser.newContext({ viewport: { width: largura, height: altura } });
  await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: 'sb-' + api.hostname.split('.')[0] + '-auth-token', value: sessao });
  await context.route('**/*.supabase.co/**', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const recurso = url.pathname.split('/').pop(); const metodo = req.method();
    if (metodo === 'OPTIONS') return route.fulfill({ status: 200 });
    let corpo = null, status = 200;
    if (url.hostname === api.hostname) {
      if (recurso === 'user') corpo = usuario;
      else if (recurso === 'neo_acessos') corpo = { user_id: id, papel, modulos, ativo: true };
      else if (recurso === 'colaboradores') corpo = { id, nome: 'Revisao da interface' };
      else if (recurso === 'neo_disp_frotas') corpo = dados.frotas.map((f) => ({ ...f, ativo: true }));
      else if (recurso === 'neo_disp_mes') {
        const { p_ano, p_mes } = req.postDataJSON();
        const pre = `${p_ano}-${String(p_mes).padStart(2, '0')}`;
        corpo = [...db.linhas.values()].filter((l) => l.dia.startsWith(pre));
      } else if (recurso === 'neo_disp_ano') {
        corpo = [...db.linhas.values()].filter((l) => l.situacao === 'OCORRENCIA').map(({ dia, frota, causa }) => ({ dia, frota, causa }));
      } else if (recurso === 'neo_disp_config') {
        if (metodo === 'PATCH') { assert.equal(papel, 'ADMIN', 'só o admin altera a meta'); Object.assign(db.config, req.postDataJSON()); db.escritas.push({ meta: db.config.meta_mensal }); corpo = [{ id: 1 }]; }
        else corpo = db.config;
      } else if (recurso === 'neo_disp_lancamentos') {
        db.escritas.push({ metodo, corpo: req.postData(), consulta: url.search });
        if (db.falhar) { status = 500; corpo = { message: 'falha simulada', code: 'XX000' }; }
        else if (metodo === 'POST') { for (const l of req.postDataJSON()) db.linhas.set(db.k(l.dia, l.frota), l); corpo = []; }
        else if (metodo === 'DELETE') { db.linhas.delete(db.k(url.searchParams.get('dia').replace('eq.', ''), Number(url.searchParams.get('frota').replace('eq.', '')))); corpo = []; }
      } else throw Error('Requisição inesperada: ' + recurso);
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00'));
  return { context, page };
}

const celula = (page, f, d) => page.locator(`.disp-cel[data-frota="${f}"][data-dia="${d}"]`);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const falhas = [];
  try {
    for (const [nome, w, h] of [['desk', 1440, 900], ['larga', 1920, 1080], ['cel', 390, 844]]) {
      const db = banco();
      const { context, page } = await novoContexto(browser, db, w, h, 'ADMIN', []);
      page.on('pageerror', (e) => falhas.push(`${nome}: ${e.message}`));
      const semRolagem = async (onde) => {
        const [a, b] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        assert.ok(a <= b, `${nome}/${onde}: rolagem lateral ${a} > ${b}`);
      };

      // Ao entrar na aba, a visão principal é o mês atual
      await page.goto(urlBase + '/disponibilidade');
      await page.getByRole('heading', { name: 'Conferência do mês' }).waitFor();
      assert.equal(await texto(page.getByTestId('mes-atual')), 'Novembro de 2026');
      assert.equal(await page.getByRole('radio', { name: 'Mês inteiro' }).getAttribute('aria-checked'), 'true');
      assert.equal(await celula(page, 4052, '2026-11-07').isDisabled(), true, 'dia futuro não abre');
      assert.equal(await celula(page, 4052, '2026-11-03').getAttribute('class').then((c) => c.includes(' p')), true, 'novembro começa em falta conferir');

      // Outubro bate com a planilha e com a foto
      await page.getByRole('button', { name: 'Mês anterior' }).click();
      await page.getByTestId('mes-atual').getByText('Outubro de 2026').waitFor();
      await page.locator('.disp-grade tbody tr:not(.disp-grupo)').first().waitFor();
      const resumo = await texto(page.locator('section').first());
      assert.match(resumo, /Dias conferidos31 de 31/);
      assert.match(resumo, /-R\$ 7\.776/);
      assert.match(resumo, /Frotas com multa8/);
      assert.match(resumo, /Contestáveis56/);
      assert.equal(await page.locator('.disp-grade thead th').count(), 33, '31 dias, frota e valor');
      assert.equal(await page.locator('.disp-grade tbody tr:not(.disp-grupo)').count(), 62);
      assert.equal(await page.locator('.disp-cel.m[data-frota="9477"]').count(), 2);
      assert.equal(await celula(page, 9477, '2026-10-30').textContent(), 'VQ');
      // Cadastrou: verde com check, em tom diferente do contestável (outubro: 1.922 células, 65 ocorrências)
      assert.equal(await page.locator('.disp-cel.ok').count(), 1857);
      assert.equal(await page.locator('.disp-cel[aria-label$="cadastrou"]:not(.ok)').count(), 0);
      const pintura = (sel) => page.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return { fundo: c.backgroundColor, imagem: c.backgroundImage }; });
      const ok = await pintura('.disp-cel.ok'), cont = await pintura('.disp-cel.c');
      assert.match(ok.imagem, /^url\("data:image\/svg/, 'o check aparece');
      assert.equal(cont.imagem, 'none', 'contestável fica sem check');
      assert.notEqual(ok.fundo, cont.fundo, 'cadastrou e contestável não têm o mesmo verde');
      assert.equal(await page.locator('.disp-cel.ok').first().textContent(), '');
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(saida, `disp-mes-${nome}.png`) });
      await semRolagem('mês');

      // Histórico da frota
      await page.locator('[data-frota-hist="9477"]').click();
      const hist = page.getByRole('dialog');
      await hist.getByText('O que aconteceu', { exact: true }).waitFor();
      const th = await texto(hist);
      assert.match(th, /Multas no mês-R\$ 1\.728/);
      assert.match(th, /Ocorrências3/);
      assert.match(th, /Descadastramento Antecipado/);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(saida, `disp-historico-${nome}.png`) });
      await page.keyboard.press('Escape');
      await hist.waitFor({ state: 'detached' });

      // Filtro
      await page.getByRole('button', { name: 'Só com multa' }).click();
      assert.equal(await page.locator('.disp-grade tbody tr:not(.disp-grupo)').count(), 8);
      await page.getByRole('button', { name: 'Elton' }).click();
      assert.ok(await page.locator('.disp-grade tbody tr:not(.disp-grupo)').count() < 8);
      await page.getByRole('button', { name: 'Todas', exact: true }).click();
      await page.getByRole('button', { name: 'Todas as frotas' }).click();

      // Marcar pela grade (novembro)
      await page.getByRole('button', { name: 'Próximo mês' }).click();
      await page.getByTestId('mes-atual').getByText('Novembro de 2026').waitFor();
      await celula(page, 4052, '2026-11-03').click();
      const pop = page.locator('[data-slot="popover-content"]');
      await pop.getByLabel('Observação').fill('oficina');
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(saida, `disp-celula-${nome}.png`) });
      await pop.getByRole('button', { name: 'Veículo Quebrado' }).click();
      await pop.waitFor({ state: 'detached' });
      assert.match(await celula(page, 4052, '2026-11-03').getAttribute('class'), /\bm\b/);
      assert.deepEqual(db.linhas.get('2026-11-03|4052'), { dia: '2026-11-03', frota: 4052, situacao: 'OCORRENCIA', causa: 'Veículo Quebrado', observacao: 'oficina' });
      assert.match(await texto(page.locator('section').first()), /-R\$ 864/);

      // Falha ao salvar: volta como estava e avisa
      db.falhar = true;
      await celula(page, 4174, '2026-11-03').click();
      await page.locator('[data-slot="popover-content"]').getByRole('button', { name: 'Atestado' }).click();
      await page.getByRole('alert').waitFor();
      assert.match(await celula(page, 4174, '2026-11-03').getAttribute('class'), /\bp\b/, 'a marcação recusada volta atrás');
      assert.equal(db.linhas.has('2026-11-03|4174'), false);
      db.falhar = false;

      // Limpar
      await celula(page, 4052, '2026-11-03').click();
      const pop2 = page.locator('[data-slot="popover-content"]');
      assert.equal(await pop2.getByLabel('Observação').inputValue(), 'oficina');
      await pop2.getByRole('button', { name: 'Limpar marcação' }).click();
      await pop2.waitFor({ state: 'detached' });
      assert.equal(db.linhas.has('2026-11-03|4052'), false);
      assert.match(await celula(page, 4052, '2026-11-03').getAttribute('class'), /\bp\b/);

      // Marcar Cadastrou pela célula: fica verde com check na hora
      await celula(page, 4052, '2026-11-03').click();
      const pop3 = page.locator('[data-slot="popover-content"]');
      await pop3.getByRole('button', { name: 'Cadastrou' }).click();
      await pop3.waitFor({ state: 'detached' });
      assert.match(await celula(page, 4052, '2026-11-03').getAttribute('class'), /\bok\b/);
      assert.equal(db.linhas.get('2026-11-03|4052').situacao, 'CADASTROU');

      // Do cabeçalho do mês para o dia
      await page.locator('[data-ir-dia="2026-11-05"]').click();
      await page.getByRole('heading', { name: 'Conferência do dia' }).waitFor();
      assert.match(page.url(), /visao=dia/);
      assert.match(await texto(page.getByTestId('dia-atual')), /05\/11\/2026/);
      assert.match(await texto(page.locator('section').first()), /Conferidas0 de 62/);
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(saida, `disp-dia-${nome}.png`) });
      await semRolagem('dia');

      // Lista do dia: Não cadastrou com motivo
      const linha = page.locator('[data-frota="4822"]');
      await linha.getByRole('button', { name: 'Não cadastrou' }).click();
      await linha.getByRole('button', { name: 'Atraso superior a 4h' }).click();
      await linha.getByText('Atraso superior a 4h').waitFor();
      assert.equal(db.linhas.get('2026-11-05|4822').causa, 'Atraso superior a 4h');
      assert.match(await texto(linha), /-R\$ 864/);
      await linha.getByRole('button', { name: 'Trocar' }).click();
      await linha.getByRole('button', { name: 'Treinamento' }).click();
      await linha.getByText('R$ 0').waitFor();

      // Marcar as que faltam
      await page.getByRole('button', { name: /Marcar 61 que faltam como cadastrou/ }).click();
      await page.getByRole('button', { name: 'Nada a marcar' }).waitFor();
      assert.match(await texto(page.locator('section').first()), /Conferidas62 de 62/);

      // Mini calendário
      await page.getByTestId('dia-atual').click();
      const cal = page.locator('[data-slot="popover-content"]');
      await cal.getByRole('grid').waitFor();
      await page.waitForTimeout(150);
      await cal.locator('.disp-dia-ponto').first().waitFor();
      assert.ok(await cal.locator('.disp-dia-ponto').count() >= 1, 'dia conferido tem ponto');
      await cal.getByRole('button', { name: /mês anterior|previous/i }).click();
      await cal.locator('.disp-dia-ponto').nth(20).waitFor();
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(saida, `disp-calendario-${nome}.png`) });
      assert.equal(await cal.locator('.disp-dia-ponto').count(), 31, 'outubro inteiro conferido');
      await cal.locator('button[data-day]').filter({ hasText: /^30$/ }).click();
      await cal.waitFor({ state: 'detached' });
      assert.match(await texto(page.getByTestId('dia-atual')), /30\/10\/2026/);
      assert.match(await texto(page.locator('section').first()), /Conferidas62 de 62/);

      // Voltar para o mês
      await page.getByRole('radio', { name: 'Mês inteiro' }).click();
      await page.getByRole('heading', { name: 'Conferência do mês' }).waitFor();
      assert.equal(await texto(page.getByTestId('mes-atual')), 'Outubro de 2026', 'volta para o mês do dia que estava aberto');

      // Painel: os totais da planilha recontada, sem os erros dela (novembro: 1 contestável + 61 cadastrou, sem multa)
      await page.goto(urlBase + '/disponibilidade/painel?mes=9');
      const kpis = page.getByTestId('kpis');
      await kpis.waitFor();
      const k = await texto(kpis);
      assert.match(k, /Total do mês-R\$ 7\.776/);
      assert.match(k, /Frotas com multa8/);
      assert.match(k, /Total anual-R\$ 236\.736/);
      assert.match(k, /-69%/);
      assert.match(k, /Atenção/);
      const rank = await texto(page.getByTestId('ranking'));
      assert.match(rank, /Elton14-R\$ 3\.456/);
      assert.match(rank, /Pedro26-R\$ 3\.456/);
      assert.match(rank, /Victor10-R\$ 864/);
      assert.match(rank, /Vinícius12R\$ 0/);
      assert.match(await texto(page.getByTestId('causas')), /Atestado \/ ASO2843%/);
      assert.match(await texto(page.getByTestId('causas')), /Total65100%/);
      assert.match(await texto(page.getByTestId('impacto')), /Elton e Pedro/);
      const top = page.getByTestId('top');
      assert.equal(await top.locator('tbody tr').count(), 5);
      assert.match(await texto(top.locator('tbody tr').first()), /9477.*Pedro.*-R\$ 1\.728/);
      assert.match(await texto(page.getByTestId('frota-operacao')), /Total9100%-R\$ 7\.776/);
      const ev = await texto(page.getByTestId('evolucao'));
      for (const v of ['22.464', '59.616', '34.560', '20.736', '30.240', '36.288', '25.056', '7.776']) assert.ok(ev.includes('-R$ ' + v), 'evolução ' + v);
      // Barras para cima: abril encostado na base, com altura
      const barra = await page.evaluate(() => {
        const c = document.querySelector('[data-mes="3"]').getBoundingClientRect();
        const i = document.querySelector('[data-mes="3"] i').getBoundingClientRect();
        return { daBase: Math.round(c.bottom - i.bottom), altura: Math.round(i.height), topoLivre: Math.round(i.top - c.top) };
      });
      assert.equal(barra.daBase, 0, 'a barra nasce embaixo');
      assert.ok(barra.altura > 150 && barra.topoLivre > 0, 'barra crescendo para cima');
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(saida, `disp-painel-${nome}.png`), fullPage: false });
      await page.setViewportSize({ width: w, height: 1700 });
      await page.screenshot({ path: path.join(saida, `disp-painel-alto-${nome}.png`) });
      await page.setViewportSize({ width: w, height: h });
      await semRolagem('painel');

      // Clicar no mês do gráfico troca o mês; abril compara com março (+165%)
      await page.locator('[data-mes="3"]').click();
      await kpis.getByText('+165%').waitFor();
      // Filtro de supervisão pelo Select
      await page.getByRole('combobox', { name: 'Supervisão' }).click();
      await page.getByRole('option', { name: 'Elton' }).click();
      const soElton = await texto(page.getByTestId('ranking'));
      assert.match(soElton, /Elton/);
      assert.doesNotMatch(soElton, /Pedro/);
      assert.match(await texto(kpis), /de 14 frotas/);

      // Meta: admin altera
      await page.getByLabel('Meta do mês (R$)').fill('25000');
      await page.getByLabel('Meta do mês (R$)').press('Enter');
      await kpis.getByText('Meta -R$ 25.000').waitFor();
      assert.equal(db.config.meta_mensal, 25000);
      await context.close();
    }

    // Usuário comum: vê a meta, não edita. Marca normalmente.
    {
      const db = banco();
      const { context, page } = await novoContexto(browser, db, 1440, 900, 'USUARIO', ['disponibilidade']);
      page.on('pageerror', (e) => falhas.push(`usuario: ${e.message}`));
      await page.goto(urlBase + '/disponibilidade/painel?mes=9');
      await page.getByTestId('meta-leitura').waitFor();
      assert.match(await texto(page.getByTestId('meta-leitura')), /30\.000/);
      assert.equal(await page.locator('input#meta-mes').count(), 0, 'sem campo de meta');
      assert.equal(db.escritas.filter((e) => 'meta' in e).length, 0);
      await page.setViewportSize({ width: 1440, height: 1700 });
      await page.screenshot({ path: path.join(saida, 'disp-painel-usuario.png') });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('link', { name: 'Conferência' }).click();
      await page.getByRole('heading', { name: 'Conferência do mês' }).waitFor();
      await context.close();
    }

    // Sem o módulo: nem menu nem rota
    {
      const db = banco();
      const { context, page } = await novoContexto(browser, db, 1280, 800, 'USUARIO', []);
      await page.goto(urlBase + '/disponibilidade');
      await page.waitForURL((u) => u.pathname === '/');
      assert.equal(await page.getByRole('link', { name: 'Conferência' }).count(), 0);
      await context.close();
    }

    assert.deepEqual(falhas, []);
    console.log('PASSOU');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
