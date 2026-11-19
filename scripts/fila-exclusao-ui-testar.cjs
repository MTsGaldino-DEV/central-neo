// Interface real, Supabase simulado: nenhuma leitura ou exclusão remota.
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
const etapas = ['A_FECHAR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA'];
const originais = ['NSIS', 'NSRI'].flatMap((tipo_serv, tipo) => etapas.map((etapa, i) => ({
  servico: String(900000000 + tipo * 10 + i), tipo_serv, etapa, fluxo_novo: true,
  sem_cobranca: false, origem: 'MANUAL', observacao: 'Serviço fictício para validar exclusão',
  termino: '2026-11-18T15:00:00Z', localidade: '2002', supervisor: null, supervisor_equipe: null,
  qtd_itens: i ? 1 : 0, valor_inicial_total: 0, valor_final_total: 0, itens_sem_nsmp: 0,
  itens_sem_nspr: 0, itens_sem_fatura: 0, itens_divergentes: 0, itens_sem_valor_pago: 0,
  valor_us_reais: 2964.33, valor_inicial_reais_total: 0, valor_final_reais_total: 0,
  nsmps: i ? '1001' : null, nsprs: i ? '2001' : null, equipes: i ? '4404' : null,
  data_lancamento_sf: i > 1 ? '2026-11-18' : null, faturas: i > 2 ? 'AP 1' : null,
})));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const falhas = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      { key: 'sb-' + api.hostname.split('.')[0] + '-auth-token', value: session });
    let linhas = [...originais];
    let permitir = true;
    let recusar = false;
    const exclusoes = [];
    await context.route('**/*.supabase.co/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const recurso = url.pathname.split('/').pop();
      const objeto = (req.headers().accept || '').includes('vnd.pgrst.object');
      let corpo = [];
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200 });
      if (url.hostname !== api.hostname) corpo = objeto ? null : [];
      else if (recurso === 'user') corpo = user;
      else if (recurso === 'neo_acessos') corpo = { user_id: id, papel: 'USUARIO', ativo: true, modulos: permitir ? ['fechamento'] : [] };
      else if (recurso === 'colaboradores') corpo = { id, nome: 'Teste local' };
      else if (recurso === 'neo_vw_nsis') {
        corpo = linhas.filter((n) => ['tipo_serv', 'etapa', 'servico'].every((campo) => {
          const filtro = url.searchParams.get(campo);
          return !filtro || filtro === 'eq.' + n[campo];
        }));
        if (objeto) corpo = corpo[0];
      } else if (recurso === 'neo_excluir_nsis') {
        const { p_servico } = req.postDataJSON();
        exclusoes.push(p_servico);
        if (recusar) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Exclusão recusada no teste' }) });
        linhas = linhas.filter((n) => n.servico !== p_servico);
        corpo = null;
      } else if (recurso !== 'neo_nsis_itens' && recurso !== 'neo_vw_contrato_itens') {
        falhas.push('Requisição inesperada: ' + recurso);
      }
      const total = Array.isArray(corpo) ? corpo.length : 1;
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': total ? `0-${total - 1}/${total}` : '*/0' }, body: JSON.stringify(corpo) });
    });
    page = await context.newPage();
    page.on('pageerror', (e) => falhas.push(e.message));
    page.setDefaultTimeout(7000);
    let aceitar = false;
    const dialogos = [];
    page.on('dialog', async (d) => { dialogos.push(d.message()); await (aceitar ? d.accept() : d.dismiss()); });
    const abrir = async (n) => {
      await page.goto(`${urlBase}/fechamento?tipo=${n.tipo_serv}&etapa=${n.etapa}`);
      await page.getByRole('row').filter({ hasText: n.servico }).waitFor();
      return page.getByRole('row').filter({ hasText: n.servico });
    };

    for (const n of originais) {
      const linha = await abrir(n);
      const botao = linha.getByRole('button', { name: `Excluir a ${n.tipo_serv} ${n.servico}`, exact: true });
      await botao.waitFor();
      assert.equal(await botao.getAttribute('title'), `Excluir ${n.tipo_serv}`);
      assert.match(await botao.innerText(), /Excluir/, 'a exclusão deve ser identificável sem passar o mouse');
      await botao.click();
      assert.match(dialogos.at(-1), new RegExp(`Excluir a ${n.tipo_serv} ${n.servico}`));
      assert.match(dialogos.at(-1), n.qtd_itens ? /1 código lançado/ : /sem códigos lançados/);
      assert.equal(exclusoes.length, 0, 'cancelar não chama a exclusão');
      assert.equal(await page.getByRole('dialog').count(), 0, 'a lixeira não abre o detalhe da linha');
    }
    const n = originais.find((n) => n.tipo_serv === 'NSRI');
    await abrir(n);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: `Excluir a NSRI ${n.servico}` }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.resolve('.tmp-faturamento/fila-exclusao-nsri-celular.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem lateral na página');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.resolve('.tmp-faturamento/fila-exclusao-nsri-desktop.png') });
    aceitar = true;
    recusar = true;
    await page.getByRole('button', { name: `Excluir a NSRI ${n.servico}` }).click();
    await page.getByText('Falha ao excluir o serviço: Exclusão recusada no teste', { exact: true }).waitFor();
    assert.ok(linhas.some((l) => l.servico === n.servico), 'erro mantém a linha');
    recusar = false;
    await page.getByRole('button', { name: `Excluir a NSRI ${n.servico}` }).click();
    await page.getByRole('row').filter({ hasText: n.servico }).waitFor({ state: 'detached' });
    assert.deepEqual(exclusoes, [n.servico, n.servico]);
    assert.equal(linhas.length, originais.length - 1, 'exclui só o serviço escolhido');

    linhas = [...originais];
    await abrir(n);
    await page.getByRole('row').filter({ hasText: n.servico }).getByRole('button', { name: 'Fechar →' }).click();
    const janela = page.getByRole('dialog');
    const excluirJanela = janela.getByRole('button', { name: 'Excluir NSRI', exact: true });
    await excluirJanela.waitFor();
    aceitar = false;
    await excluirJanela.click();
    assert.match(dialogos.at(-1), new RegExp(`Excluir a NSRI ${n.servico}`));
    assert.equal(exclusoes.length, 2);

    permitir = false;
    await page.goto(urlBase + '/fechamento?tipo=NSRI');
    await page.waitForURL(urlBase + '/');
    assert.equal(await page.getByRole('button', { name: /Excluir/ }).count(), 0);
    assert.deepEqual(falhas, []);
    console.log('OK: excluir NSIS/NSRI em quatro etapas, identificação e confirmação corretas, cancelar, erro, recarga, detalhe, permissão, desktop e celular. Nenhum dado remoto alterado.');
  } catch (e) {
    await page?.screenshot({ path: path.resolve('.tmp-faturamento/fila-exclusao-falha.png') });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
