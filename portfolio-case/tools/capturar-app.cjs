/** Captura o app AUTÊNTICO com fixtures sintéticas; nenhuma chamada sai para Supabase.
 * Requer Vite em 127.0.0.1:5173 e Playwright local. Execute da raiz:
 * node portfolio-case/tools/capturar-app.cjs
 * Não lê .env, não autentica remotamente e não toca dados do aplicativo.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../../.tmp-faturamento/browser/node_modules/playwright');
const base = process.env.PORTFOLIO_APP_URL || 'http://127.0.0.1:5173';
const output = path.resolve(__dirname, '../site/dist/assets/screenshots');
const userId = '00000000-0000-4000-8000-000000000001';
const user = { id: userId, email: 'portfolio@example.invalid', aud: 'authenticated', role: 'authenticated' };
const session = { user, access_token: 'portfolio-synthetic-local-only', refresh_token: 'portfolio-synthetic-local-only', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400 };
// Host público documentado em CONTEXTO_GERAL.md; não é credencial.
const storageKey = 'sb-dxcxoimvweeggrvtbmxb-auth-token';
// Valores inventados para a apresentação; não reproduzem o contrato do projeto.
const demoUnitReais = 3200;
const demoOccurrenceReais = 750;
const demoMonthlyTargetReais = 24000;
const stages = ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA'];
const descriptions = ['Substituição de isolador e revisão da conexão', 'Manutenção preventiva da rede de distribuição', 'Instalação de conjunto de proteção', 'Regularização do ramal de ligação', 'Inspeção e ajuste de estrutura', 'Troca de cruzeta e acessórios'];
const services = Array.from({ length: 18 }, (_, i) => {
  const etapa = stages[i % stages.length];
  const amount = +(0.25 + i * 0.027).toFixed(4);
  const paid = i % 5 > 1 ? +(amount * (i % 7 === 0 ? 0.92 : 1)).toFixed(4) : 0;
  return {
    servico: String(900000101 + i), tipo_serv: 'NSIS', referencia: '9001-000' + i, localidade: '9001', endereco: 'Av. das Acácias, ' + (100 + i * 12),
    pedido_em: '2026-10-28T10:00:00Z', termino: '2026-11-' + String(18 - i % 12).padStart(2, '0') + 'T15:30:00Z', resp: 'CONTRATADA', matricula: null, nome: 'Equipe ' + (i % 2 ? 'B' : 'A'),
    tempo_deslocamento: '00:25', tempo_execucao: '01:15', prazo_legal: null, observacao: descriptions[i % descriptions.length], zona: i % 3 ? 'U' : 'R', referencia_local: null,
    sem_cobranca: false, motivo_sem_cobranca: null, origem: 'RELATORIO', importado_em: '2026-11-18T16:00:00Z', atualizado_em: '2026-11-18T16:00:00Z',
    qtd_itens: etapa === 'A_FECHAR' ? 0 : 2, valor_inicial_total: etapa === 'A_FECHAR' ? 0 : amount, valor_final_total: paid,
    itens_sem_nsmp: 0, itens_sem_nspr: etapa === 'AGUARDANDO_NSPR' ? 1 : 0, itens_sem_fatura: etapa === 'FATURADA' ? 0 : 1,
    itens_divergentes: paid && paid !== amount ? 1 : 0, itens_sem_valor_pago: 0, nsmps: etapa === 'A_FECHAR' ? null : String(8000100 + i),
    nsprs: paid ? String(7000100 + i) : null, faturas: etapa === 'FATURADA' ? 'AP 90001' : null,
    equipes: etapa === 'A_FECHAR' ? null : String(1001 + i % 16), etapa, valor_us_reais: demoUnitReais,
    valor_inicial_reais_total: etapa === 'A_FECHAR' ? 0 : +(amount * demoUnitReais).toFixed(2), valor_final_reais_total: +(paid * demoUnitReais).toFixed(2),
    supervisor: 'Equipe ' + (i % 2 ? 'B' : 'A'), supervisor_equipe: 'Equipe ' + (i % 2 ? 'B' : 'A'), fluxo_novo: true,
    data_lancamento_sf: ['AGUARDANDO_APROPRIACAO', 'FATURADA'].includes(etapa) ? '2026-11-18' : null,
  };
});
// A grade agrupa usando os quatro rótulos fixos do app. São chaves de apresentação,
// trocadas por Equipe A-D no DOM antes da captura; não representam pessoas/dados reais.
const presentationKeys = ['Vinícius', 'Victor', 'Elton', 'Pedro'];
const fleet = Array.from({ length: 16 }, (_, i) => ({ frota: 1001 + i, placa: 'DEMO-' + String(i + 1).padStart(2, '0'), supervisor: presentationKeys[Math.floor(i / 4)], regiao: ['Norte', 'Sul', 'Leste', 'Oeste'][Math.floor(i / 4)], escala: '5 × 2', horario: '07:00 às 16:00', local: 'Base ' + String.fromCharCode(65 + Math.floor(i / 4)), ordem: i, ativo: true }));
function monthRows(year, month) {
  return fleet.flatMap((f, i) => Array.from({ length: new Date(year, month, 0).getDate() }, (_, d) => {
    const day = d + 1;
    const weekday = new Date(year, month - 1, day).getDay();
    const weekend = weekday === 0 || weekday === 6;
    const cause = weekend ? 'Folga de fim de escala' : (day + i * 3) % 23 === 0 ? 'Veículo Quebrado' : (day * 2 + i) % 29 === 0 ? 'Treinamento' : (day + i * 2) % 37 === 0 ? 'Atraso superior a 4h' : null;
    return { dia: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, frota: f.frota, situacao: cause ? 'OCORRENCIA' : 'CADASTROU', causa: cause, observacao: null, origem: weekend ? 'AUTO' : 'TELA' };
  }));
}
function billingFixture(i) {
  const scale = 1 + i * 0.11;
  const creditado = 430 * scale, devido = 447 * scale;
  const group = (values) => values.map((valor, n) => ({ valor, servicos: 340 - n * 41, creditado: +(120 * scale - n * 15).toFixed(4), devido: +(126 * scale - n * 15).toFixed(4), multas: 1.2, saldo: 6 * scale }));
  return { fatura: String(9100 + i), inicio: `2026-${String(11 - i).padStart(2, '0')}-01`, fim: `2026-${String(11 - i).padStart(2, '0')}-28`, importado_em: '2026-11-18T12:00:00Z', calculado_em: '2026-11-18T12:00:00Z',
    linhas: 2140, servicos: 1820, creditado, pago_com_fator: creditado, devido, diferenca: creditado - devido, multas: 4.8 * scale, estorno: 1.1, sem_fator_servicos: 24, parciais: 12, saldo_a_receber: 21.3 * scale, pago_a_mais: 4.3 * scale,
    a_menos: { servicos: 102, us: 21.3 * scale, pago: 41, devido: 62.3, com_1ns: 12, por_motivo: { FATOR_MENOR: { us: 14.2 * scale, servicos: 70 }, RC_NAO_PAGO: { us: 7.1 * scale, servicos: 32 } } },
    a_mais: { servicos: 31, us: 4.3 * scale, pago: 18.3, devido: 14, c562: { servicos: 18, us: 2.8 * scale }, por_motivo: {} }, fora_contrato: 24,
    glosas_erradas: { servicos: 17, glosa: 3.4, parcial: { servicos: 10, us: 1.8 }, reincidencia: { servicos: 3, glosa: 0.6 }, conferir: { servicos: 4, glosa: 1 } },
    funil: { importados: 1820, equipe_identificada: 1810, codigo_no_contrato: 1796, valor_confere: 1646, conferidos: 26, a_conferir: 17 },
    grupos: { tipo_turma: group(['LM', 'LV', 'MOTO', 'LEVE']), codserv: group(['703994', '704021', '704058', '704103']), cidade: group(['Cidade Jardim', 'Vila Aurora', 'Nova Esperança', 'Vale Sereno']) },
    ajustes: { debito: 0.45, credito: 0.9, itens: [{ tipo: 'C', observacao: 'Ajuste de competência demonstrativa', valor: 0.9 }] } };
}
const billing = Array.from({ length: 6 }, (_, i) => billingFixture(i));
function filterRows(url) {
  return services.filter(row => [...url.searchParams].every(([key, value]) => {
    if (!(key in row)) return true;
    if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
    if (value.startsWith('gte.')) return row[key] >= value.slice(4);
    if (value.startsWith('lt.')) return row[key] < value.slice(3);
    if (value.startsWith('gt.')) return Number(row[key]) > Number(value.slice(3));
    if (value.startsWith('ilike.')) return String(row[key]).toLowerCase().includes(value.slice(6).replaceAll('%', '').toLowerCase());
    return true;
  }));
}
async function anonymize(page) {
  await page.evaluate(() => {
    const replace = value => value.replace(/CEMIG/g, 'Distribuidora').replace(/Vinícius|Vinicius/g, 'Equipe A').replace(/Victor/g, 'Equipe B').replace(/Elton/g, 'Equipe C').replace(/Pedro/g, 'Equipe D');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) if (!['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName)) node.nodeValue = replace(node.nodeValue);
    document.querySelectorAll('[title],[aria-label]').forEach(el => ['title', 'aria-label'].forEach(attr => { if (el.hasAttribute(attr)) el.setAttribute(attr, replace(el.getAttribute(attr))); }));
    if (!document.getElementById('portfolio-demo-badge')) {
      const badge = document.createElement('div'); badge.id = 'portfolio-demo-badge'; badge.textContent = 'DADOS DEMONSTRATIVOS';
      Object.assign(badge.style, { position: 'fixed', bottom: '12px', right: '14px', zIndex: '9999', background: '#eef6f7', color: '#286573', border: '1px solid #bdd9de', borderRadius: '6px', padding: '6px 9px', font: '600 9px/1.2 ui-monospace,monospace', letterSpacing: '1px', pointerEvents: 'none' });
      document.body.appendChild(badge);
    }
  });
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [], unexpected = [], intercepted = [], blocked = [], result = [];
  async function context(authenticated, viewport) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
    if (authenticated) await context.addInitScript(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem('neo.fila.painel', '1'); }, { key: storageKey, value: session });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === new URL(base).origin) return route.continue();
      if (!url.hostname.endsWith('.supabase.co')) { blocked.push(url.origin); return route.abort('blockedbyclient'); }
      const resource = url.pathname.split('/').pop();
      intercepted.push({ resource, method: req.method() });
      const object = (req.headers().accept || '').includes('vnd.pgrst.object');
      let data = [];
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
      if (resource === 'user') data = user;
      else if (resource === 'neo_acessos') data = { user_id: userId, papel: 'USUARIO', ativo: true, modulos: ['fechamento', 'faturamento', 'disponibilidade'] };
      else if (resource === 'colaboradores') data = { id: userId, nome: 'Portfolio · Demonstração' };
      else if (resource === 'neo_vw_nsis') data = filterRows(url);
      else if (resource === 'neo_nsis_itens') data = services.filter(s => s.qtd_itens).map(s => ({ servico: s.servico, descricao: s.observacao, codigo: '703994' }));
      else if (resource === 'neo_disp_frotas') data = fleet;
      else if (resource === 'neo_disp_equipe_estado') data = [];
      else if (resource === 'neo_disp_config') data = { valor_ocorrencia: demoOccurrenceReais, meta_mensal: demoMonthlyTargetReais };
      else if (resource === 'neo_disp_preencher_fim_de_semana') data = 0;
      else if (resource === 'neo_disp_mes') { const body = req.postDataJSON(); data = monthRows(body.p_ano, body.p_mes); }
      else if (resource === 'neo_fat_faturas_desatualizadas') data = [];
      else if (resource === 'neo_fat_painel') data = billing;
      else if (resource === 'neo_fat_valor_us') data = { valor: demoUnitReais, vigencia: '2026-01-01' };
      else if (resource === 'neo_vw_contrato_itens') data = [];
      else { unexpected.push(resource); }
      const total = Array.isArray(data) ? data.length : 1;
      if (object && Array.isArray(data)) data = data[0] ?? null;
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': total ? `0-${total - 1}/${total}` : '*/0', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: req.method() === 'HEAD' ? '' : JSON.stringify(data) });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(15000);
    return { context, page };
  }
  async function capture(page, name, dimensions) {
    await page.mouse.move(0, 0); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(350); await anonymize(page);
    assert.equal(await page.locator('[role="alert"]').count(), 0, `${name}: sem alerta`);
    assert.ok(!/Falha ao carregar|Nenhuma frota|Nenhuma fatura/.test(await page.locator('body').innerText()), `${name}: carregado com dados`);
    assert.ok(!/CEMIG|Vinícius|Victor|Elton|Pedro/.test(await page.locator('body').innerText()), `${name}: sem rótulos empresariais ou supervisores originais`);
    await page.screenshot({ path: path.join(output, name), animations: 'disabled' });
    const png = fs.readFileSync(path.join(output, name));
    assert.equal(png.readUInt32BE(16), dimensions.width, `${name}: largura PNG`);
    assert.equal(png.readUInt32BE(20), dimensions.height, `${name}: altura PNG`);
    result.push({ file: 'assets/screenshots/' + name, ...dimensions });
  }
  try {
    const desktop = await context(true, { width: 1440, height: 960 });
    await desktop.page.goto(base + '/fechamento?etapa=TODAS&de=2026-11-01&ate=2026-11-30');
    await desktop.page.getByRole('row').filter({ hasText: '900000101' }).waitFor();
    assert.equal(await desktop.page.getByRole('row').filter({ hasText: /9000001/ }).count(), 18);
    await desktop.page.getByText('18 NSIS com esses filtros (todas as etapas)', { exact: true }).waitFor();
    await capture(desktop.page, 'fila.png', { width: 1440, height: 960 });
    await desktop.page.setViewportSize({ width: 390, height: 844 });
    await capture(desktop.page, 'fila-mobile.png', { width: 390, height: 844 });
    assert.ok(await desktop.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'fila mobile sem overflow na página');
    await desktop.page.setViewportSize({ width: 1440, height: 960 });
    await desktop.page.goto(base + '/disponibilidade?mes=2026-10');
    await desktop.page.locator('.disp-cel.ok').first().waitFor();
    assert.equal(await desktop.page.locator('.disp-frota').count(), 16);
    assert.ok(await desktop.page.locator('.disp-cel.m').count() > 0, 'grade com ocorrências multáveis');
    await capture(desktop.page, 'disponibilidade.png', { width: 1440, height: 960 });
    await desktop.page.goto(base + '/faturamento/painel');
    await desktop.page.getByRole('heading', { name: 'Comparação entre faturas' }).waitFor();
    await capture(desktop.page, 'faturamento.png', { width: 1440, height: 960 });
    await desktop.context.close();
    const login = await context(false, { width: 1440, height: 960 });
    await login.page.goto(base + '/login'); await login.page.locator('#email').waitFor();
    await capture(login.page, 'login.png', { width: 1440, height: 960 });
    await login.context.close();
    assert.deepEqual(errors, [], 'zero pageerrors'); assert.deepEqual(unexpected, [], 'nenhuma requisição Supabase desconhecida');
    assert.ok(intercepted.length > 0);
    console.log(JSON.stringify({ screenshots: result, syntheticServices: services.length, syntheticFleet: fleet.length, interceptedSupabaseRequests: intercepted.length, realSupabaseRequests: 0, pageerrors: errors, blockedExternalOrigins: [...new Set(blocked)] }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
