// Interface real, Supabase simulado: nenhuma leitura ou gravação remota.
// Confere a linha amarela de NSMP / NSPR / NSMC repetidas e a confirmação antes de gravar.
// Requer o Vite aberto e o Playwright local usado pelos demais testes de UI.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../.tmp-faturamento/browser/node_modules/playwright');

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const api = new URL(env.VITE_NEO_SUPABASE_URL);
const urlBase = process.env.NEO_TEST_URL || 'http://127.0.0.1:5173';
const id = '00000000-0000-0000-0000-000000000001';
const user = { id, email: 'teste@example.invalid', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'teste-local', refresh_token: 'teste-local', expires_at: Math.floor(Date.now() / 1000) + 86400,
  expires_in: 86400, token_type: 'bearer', user };

// 900000001 e 900000002: mesma NSPR 7001 (repetida).
// 900000003: NSMP 5003 igual à NSMC 5003 da NSRI 900000011 — tipos diferentes, não conta.
// NSRI 900000011: NSMC gravada em nsmp e nspr — não se marca sozinha.
// NSRI 900000012 e 900000013: mesma NSMC 6001 (repetida).
const tipos = { 900000001: 'NSIS', 900000002: 'NSIS', 900000003: 'NSIS', 900000011: 'NSRI', 900000012: 'NSRI', 900000013: 'NSRI' };
const itens = [
  ['900000001', '5001', '7001'], ['900000002', '5002', '7001'], ['900000003', '5003', null],
  ['900000011', '5003', '5003'], ['900000012', '6001', '6001'], ['900000013', '6001', '6001'],
].map(([servico, nsmp, nspr], i) => ({
  id: `00000000-0000-0000-0000-0000000001${String(i).padStart(2, '0')}`, servico, descricao: 'Poda', codigo: null, quantidade: 1, fator: 1,
  fator_unitario: null, equipe: '4404', valor_inicial: 10, us_adicional: null, nsmp, nspr, valor_final: nspr ? 10 : null, fatura: null,
  observacao: null, criado_em: '2026-11-20T12:00:00Z', atualizado_em: '2026-11-20T12:00:00Z',
}));
const nsis = Object.entries(tipos).map(([servico, tipo_serv]) => {
  const meus = itens.filter((it) => it.servico === servico);
  const nspr = meus[0].nspr;
  return {
    servico, tipo_serv, etapa: nspr ? 'AGUARDANDO_SALESFORCE' : 'AGUARDANDO_NSPR', fluxo_novo: true, sem_cobranca: false, origem: 'MANUAL',
    observacao: 'Serviço fictício para validar duplicidade', termino: '2026-11-18T15:00:00Z', localidade: '2002', zona: null,
    supervisor: null, supervisor_equipe: 'Ana', qtd_itens: 1, valor_inicial_total: 10, valor_final_total: nspr ? 10 : 0,
    itens_sem_nsmp: 0, itens_sem_nspr: nspr ? 0 : 1, itens_sem_fatura: 1, itens_divergentes: 0, itens_sem_valor_pago: 0,
    valor_us_reais: null, valor_inicial_reais_total: 0, valor_final_reais_total: 0,
    nsmps: meus[0].nsmp, nsprs: nspr, equipes: '4404', data_lancamento_sf: null, faturas: null,
  };
});

/** "in.(a,"b")" → ['a', 'b'] */
const lerIn = (v) => v.replace(/^in\.\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const falhas = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      { key: 'sb-' + api.hostname.split('.')[0] + '-auth-token', value: session });
    const gravacoes = [];
    await context.route('**/*.supabase.co/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const recurso = url.pathname.split('/').pop();
      const objeto = (req.headers().accept || '').includes('vnd.pgrst.object');
      const q = (c) => url.searchParams.get(c);
      let corpo = [];
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200 });
      if (url.hostname !== api.hostname) corpo = objeto ? null : [];
      else if (recurso === 'user') corpo = user;
      else if (recurso === 'neo_acessos') corpo = { user_id: id, papel: 'USUARIO', ativo: true, modulos: ['fechamento'] };
      else if (recurso === 'colaboradores') corpo = { id, nome: 'Teste local' };
      else if (req.method() !== 'GET' && (recurso === 'neo_nsis_itens' || recurso === 'neo_nsis')) {
        gravacoes.push(`${req.method()} ${recurso}`);
        corpo = recurso === 'neo_nsis_itens' && req.method() === 'PATCH' ? [{ id: itens[0].id }] : null;
      } else if (recurso === 'neo_vw_nsis') {
        corpo = nsis.filter((n) => ['tipo_serv', 'etapa', 'servico'].every((c) => !q(c) || q(c) === 'eq.' + n[c]));
        if (objeto) corpo = corpo[0];
      } else if (recurso === 'neo_nsis_itens') {
        corpo = itens.filter((it) => ['servico', 'nsmp', 'nspr'].every((c) => {
          const f = q(c);
          if (!f) return true;
          if (f.startsWith('eq.')) return it[c] === f.slice(3);
          if (f.startsWith('in.')) return lerIn(f).includes(it[c]);
          return false;
        }));
        if ((q('select') || '').includes('neo_nsis!inner')) {
          corpo = corpo.map((it) => ({ servico: it.servico, nsmp: it.nsmp, nspr: it.nspr, neo_nsis: { tipo_serv: tipos[it.servico] } }));
        }
      } else if (recurso !== 'neo_vw_contrato_itens') {
        falhas.push('Requisição inesperada: ' + recurso);
      }
      const total = Array.isArray(corpo) ? corpo.length : 1;
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': total ? `0-${total - 1}/${total}` : '*/0' }, body: JSON.stringify(corpo) });
    });
    page = await context.newPage();
    page.on('pageerror', (e) => falhas.push(e.message));
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(60000); // a primeira abertura do Vite otimiza as dependências
    let aceitar = false;
    const dialogos = [];
    page.on('dialog', async (d) => { dialogos.push(d.message()); await (aceitar ? d.accept() : d.dismiss()); });
    const linha = (s) => page.getByRole('row').filter({ hasText: s });
    const amarela = async (s) => /\bduplicada\b/.test(await linha(s).getAttribute('class'));

    // Lista NSIS: as duas com NSPR 7001 ficam amarelas; a 900000003 não (NSMP 5003 só bate com NSMC)
    await page.goto(`${urlBase}/fechamento?tipo=NSIS&etapa=TODAS`);
    await page.locator('tr.duplicada').first().waitFor();
    assert.ok(await amarela('900000001'), '900000001 amarela');
    assert.ok(await amarela('900000002'), '900000002 amarela');
    assert.ok(!(await amarela('900000003')), 'NSMP igual a NSMC não é repetição');
    assert.match(await linha('900000001').getAttribute('title'), /NSPR 7001 também no serviço 900000002/);
    assert.equal(await linha('900000001').getByText('repetido').count(), 1, 'marca só a NSPR repetida, não a NSMP');
    await page.screenshot({ path: path.resolve('.tmp-faturamento/fila-duplicidade-nsis.png') });

    // Lista NSRI: NSMC 6001 repetida; a 900000011 (NSMC = NSPR dela mesma) não
    await page.goto(`${urlBase}/fechamento?tipo=NSRI&etapa=TODAS`);
    await page.locator('tr.duplicada').first().waitFor();
    assert.ok(await amarela('900000012'), '900000012 amarela');
    assert.ok(await amarela('900000013'), '900000013 amarela');
    assert.ok(!(await amarela('900000011')), 'NSRI não se marca sozinha');
    assert.match(await linha('900000012').getAttribute('title'), /NSMC 6001 também no serviço 900000013/);

    // Informar NSPR repetida: pede confirmação; cancelar não grava, aceitar grava
    await page.goto(`${urlBase}/fechamento?tipo=NSIS&etapa=AGUARDANDO_NSPR`);
    await linha('900000003').getByRole('button', { name: 'Informar NSPR' }).click();
    const janela = page.getByRole('dialog');
    await janela.locator('#nspr-fluxo').fill('7001');
    await janela.locator('#pago-nspr-fluxo').fill('10');
    await janela.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForTimeout(500);
    assert.match(dialogos.at(-1) ?? '', /A NSPR 7001 já existe nos serviços 900000001, 900000002\./);
    assert.match(dialogos.at(-1), /Lançar mesmo assim\?/);
    assert.deepEqual(gravacoes, [], 'cancelar não grava');
    assert.equal(await janela.getByRole('alert').count(), 0, 'cancelar não mostra erro');

    aceitar = true;
    await janela.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForFunction(() => true);
    await page.waitForTimeout(800);
    assert.equal(dialogos.length, 2);
    assert.ok(gravacoes.includes('POST neo_nsis_itens'), 'aceitar grava a NSPR: ' + gravacoes.join(', '));

    // Número sem repetição não pergunta nada
    aceitar = false;
    gravacoes.length = 0;
    await page.goto(`${urlBase}/fechamento?tipo=NSIS&etapa=AGUARDANDO_NSPR&nsis=900000003`);
    await page.getByRole('dialog').locator('#nspr-fluxo').fill('7999');
    await page.getByRole('dialog').locator('#pago-nspr-fluxo').fill('10');
    await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForTimeout(800);
    assert.equal(dialogos.length, 2, 'sem repetição, sem confirmação');
    assert.ok(gravacoes.includes('POST neo_nsis_itens'), 'grava direto');

    assert.deepEqual(falhas, []);
    console.log('OK: linhas amarelas (NSPR e NSMC), NSMP x NSMC e NSRI sozinha sem marca, confirmação com serviços, cancelar sem gravar, aceitar grava, número novo sem pergunta. Nenhum dado remoto alterado.');
  } catch (e) {
    await page?.screenshot({ path: path.resolve('.tmp-faturamento/fila-duplicidade-falha.png') });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
