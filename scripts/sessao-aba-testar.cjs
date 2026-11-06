// Trocar de aba e voltar não pode desmontar a tela nem perder o que estava nela.
// Supabase simulado em memória (nada remoto). Rode com `npm run dev` aberto (ou NEO_TEST_URL).
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require('../.tmp-faturamento/browser/node_modules/playwright');

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const api = new URL(env.VITE_NEO_SUPABASE_URL);
const urlBase = (process.env.NEO_TEST_URL || 'http://localhost:5173').replace(/\/$/, '');
const id = '00000000-0000-0000-0000-000000000001';
const usuario = { id, email: 'teste@example.invalid', aud: 'authenticated', role: 'authenticated' };
const sessao = { access_token: 'teste-local', refresh_token: 'teste-local', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, token_type: 'bearer', user: usuario };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(({ chaves, value }) => { for (const k of chaves) localStorage.setItem(k, JSON.stringify(value)); },
      { chaves: ['sb-' + api.hostname.split('.')[0] + '-auth-token'], value: sessao });
    let leiturasAcesso = 0;
    await context.route('**/*.supabase.co/**', async (route) => {
      const req = route.request(); const url = new URL(req.url()); const recurso = url.pathname.split('/').pop();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200 });
      let corpo = null;
      if (url.hostname === api.hostname) {
        if (recurso === 'user') corpo = usuario;
        else if (recurso === 'neo_acessos') { leiturasAcesso++; corpo = { user_id: id, papel: 'ADMIN', modulos: [], ativo: true }; }
        else if (recurso === 'colaboradores') corpo = { id, nome: 'Teste de aba' };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
    });
    const page = await context.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(urlBase + '/ferramentas/calculo-km');
    const titulo = page.locator('main header h1');
    await titulo.waitFor();
    await page.waitForTimeout(500);

    // Marca um elemento da tela e observa se a tela de carregamento apareceu em algum momento.
    await page.evaluate(() => {
      window.__alvo = document.querySelector('main > div');
      window.__alvo.setAttribute('data-estado-da-tela', 'digitado');
      window.__desmontou = false;
      new MutationObserver(() => { if (!document.querySelector('main header h1')) window.__desmontou = true; })
        .observe(document.body, { childList: true, subtree: true });
    });

    const trocarAba = async () => {
      await page.evaluate(async () => {
        const definir = (estado) => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
          window.dispatchEvent(new Event('visibilitychange'));
        };
        definir('hidden');
        await new Promise((r) => setTimeout(r, 100));
        definir('visible');
      });
      await page.waitForTimeout(800);
    };

    const antes = leiturasAcesso;
    await trocarAba();
    const r1 = await page.evaluate(() => ({ ligado: window.__alvo.isConnected, desmontou: window.__desmontou, marca: document.querySelector('[data-estado-da-tela]')?.getAttribute('data-estado-da-tela') }));
    console.log('depois de voltar para a aba:', r1, '| releu o acesso', leiturasAcesso - antes, 'vez(es)');
    assert.equal(r1.desmontou, false, 'a tela de carregamento substituiu a página ao voltar para a aba');
    assert.equal(r1.ligado, true, 'a página foi desmontada ao voltar para a aba');
    assert.equal(r1.marca, 'digitado', 'o estado da tela se perdeu');

    await trocarAba();
    await trocarAba();
    const r2 = await page.evaluate(() => ({ ligado: window.__alvo.isConnected, desmontou: window.__desmontou }));
    assert.deepEqual(r2, { ligado: true, desmontou: false }, 'várias trocas seguidas');
    assert.equal(await titulo.isVisible(), true);

    // Sair continua funcionando: SIGNED_OUT ainda leva ao login.
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL('**/login', { timeout: 8000 });
    assert.deepEqual(erros, []);
    console.log('PASSOU');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
