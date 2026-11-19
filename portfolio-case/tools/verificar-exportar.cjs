// Verifica a página real no Chrome e gera PDF/pranchas a partir do mesmo HTML.
// Execute da raiz com o servidor estático em 8088: node portfolio-case/tools/verificar-exportar.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { chromium } = require('../../.tmp-faturamento/browser/node_modules/playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8088';
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'exports');
const qa = path.resolve('.tmp-portfolio');
const downloads = path.join(root, 'site/dist/downloads');
const doExport = !process.argv.includes('--somente-verificar');
for (const dir of [output, qa, downloads]) fs.mkdirSync(dir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const failedResources = [];
  const external = [];
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) {
        external.push(url.hostname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) failedResources.push(response.url()); });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('img').evaluateAll(async (images) => {
      await Promise.all(images.map((img) => { img.loading = 'eager'; return img.decode(); }));
    });
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('[data-export]').count(), 12);
    assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
    await page.screenshot({ path: path.join(qa, 'portfolio-desktop.png'), fullPage: true });

    await page.getByRole('link', { name: 'Engenharia', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#engenharia');
    await page.getByRole('tab', { name: 'Segurança', exact: true }).click();
    assert.equal(await page.getByRole('tab', { name: 'Segurança', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#panel-seguranca').isVisible(), true);
    assert.equal(await page.locator('#panel-dados').isVisible(), false);
    await page.getByRole('tab', { name: 'Segurança', exact: true }).press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Arquivos', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'Arquivos', exact: true }).press('Home');
    assert.equal(await page.getByRole('tab', { name: 'Dados', exact: true }).getAttribute('aria-selected'), 'true');

    await page.getByRole('button', { name: 'Confere', exact: true }).click();
    assert.equal(await page.locator('#difference-value').innerText(), 'R$ 0,00');
    assert.equal(await page.locator('#paid-value').innerText(), 'R$ 1.250,00');
    await page.getByRole('button', { name: 'A mais', exact: true }).click();
    assert.equal(await page.locator('#difference-value').innerText(), 'R$ 60,00');
    await page.getByRole('button', { name: 'A menos', exact: true }).click();
    assert.equal(await page.locator('#difference-value').innerText(), 'R$ 80,00');

    const firstImage = page.locator('[data-lightbox]').first();
    await firstImage.click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('#expanded-image').getAttribute('alt'), await firstImage.locator('img').getAttribute('alt'));
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    assert.equal(await firstImage.evaluate((el) => el === document.activeElement), true);
    await page.locator('.login-link').click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Fechar imagem ampliada' }).click();

    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('img').evaluateAll(async (images) => {
        await Promise.all(images.map((img) => { img.loading = 'eager'; return img.decode(); }));
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `sem overflow em ${width}px`);
      const outside = await page.locator('.chapter h1,.chapter h2,.chapter h3,.chapter p').evaluateAll((elements) => elements.filter((el) => {
        const rect = el.getBoundingClientRect();
        const section = el.closest('.chapter').getBoundingClientRect();
        return rect.width && (rect.left < section.left - 1 || rect.right > section.right + 1);
      }).map((el) => el.textContent.slice(0, 50)));
      assert.deepEqual(outside, [], `texto não cortado nas laterais em ${width}px`);
      assert.equal(await page.locator('img').evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0)), true);
      await page.screenshot({ path: path.join(qa, `portfolio-${width}.png`), fullPage: true });
      await page.locator('#inicio').screenshot({ path: path.join(qa, `portfolio-capa-${width}.png`) });
    }

    if (doExport) {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await page.goto(base + '/?presentation', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('img').evaluateAll(async (images) => {
        await Promise.all(images.map((img) => { img.loading = 'eager'; return img.decode(); }));
      });
      const clipped = await page.locator('[data-export]').evaluateAll((sections) => sections.flatMap((section) => {
        const bounds = section.getBoundingClientRect();
        return [...section.querySelectorAll('h1,h2,h3,p,.project-meta,.palette,.closing-brand')].filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return style.display !== 'none' && r.height > 0 && (r.bottom > bounds.bottom - 12 || r.right > bounds.right + 1);
        }).map((el) => ({ section: section.dataset.export, element: el.tagName, text: el.textContent.slice(0, 55) }));
      }));
      assert.deepEqual(clipped, [], 'texto não pode ser cortado nas pranchas');
      const frames = page.locator('[data-export]');
      const files = [];
      for (let i = 0; i < await frames.count(); i++) {
        const frame = frames.nth(i);
        const name = (await frame.getAttribute('data-export')) + '.png';
        const target = path.join(output, name);
        await frame.screenshot({ path: target, animations: 'disabled' });
        files.push(name);
      }
      // Links de ampliação da prévia local não devem virar URLs localhost no PDF.
      await page.locator('a[href]').evaluateAll((links, origin) => {
        links.forEach((link) => { if (new URL(link.href).origin === origin) link.removeAttribute('href'); });
      }, new URL(base).origin);
      await page.pdf({ path: path.join(output, 'central-neo-portfolio.pdf'), width: '1400px', height: '1000px', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, tagged: true });
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(output, 'central-neo-portfolio.pdf'))), useSystemFonts: true }).promise;
      assert.equal(pdf.numPages, 12, 'PDF com exatamente 12 páginas');
      for (let i = 1; i <= pdf.numPages; i++) {
        const pdfPage = await pdf.getPage(i);
        assert.ok((await pdfPage.getTextContent()).items.length > 30, 'página com texto selecionável');
        assert.ok((await pdfPage.getAnnotations()).every((annotation) => !String(annotation.url || '').includes(new URL(base).host)), 'PDF sem links para a prévia local');
      }
      await pdf.destroy();
      fs.copyFileSync(path.join(output, files[0]), path.join(output, 'capa-central-neo.png'));
      fs.copyFileSync(path.join(output, 'central-neo-portfolio.pdf'), path.join(downloads, 'central-neo-portfolio.pdf'));
      const images = files.map((name) => `<figure><img src="${name}" alt="${name}"><figcaption>${name.replace('.png', '')}</figcaption></figure>`).join('');
      fs.writeFileSync(path.join(output, 'indice.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Central NEO — pranchas Behance</title><style>body{margin:0;padding:32px;background:#111210;color:#fafaf7;font:16px Arial}h1{margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%;height:auto;display:block}figcaption{padding:12px 0;color:#b8bcad;font-size:13px}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style><h1>Central NEO — apresentação visual</h1><div class="grid">${images}</div></html>`, 'utf8');
      fs.writeFileSync(path.join(output, 'manifesto.json'), JSON.stringify({ generated: '2026-11-19', width: 1400, height: 1000, frames: files, pdf: 'central-neo-portfolio.pdf', syntheticData: true }, null, 2));
      const zip = new JSZip();
      for (const file of [...files, 'capa-central-neo.png', 'indice.html', 'manifesto.json', 'central-neo-portfolio.pdf']) {
        zip.file(file, fs.readFileSync(path.join(output, file)), { date: new Date('2026-11-19T12:00:00Z') });
      }
      zip.file('LEIA-ME.txt', 'Central NEO / Matheus Galdino / Full Stack Developer\n\n12 pranchas em 1400 x 1000 px. Use os arquivos 01 a 12 em ordem no Behance.\nO PDF e o indice.html apresentam o mesmo case.\nCapturas autenticas do aplicativo, com dados inteiramente ficticios.\nPaleta da Central NEO: petroleo, noite, ciano, nevoa e cobre.\n', { date: new Date('2026-11-19T12:00:00Z') });
      fs.writeFileSync(path.join(output, 'central-neo-behance.zip'), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));
      fs.copyFileSync(path.join(output, 'central-neo-behance.zip'), path.join(downloads, 'central-neo-behance.zip'));
      console.log('EXPORTADO: 12 pranchas PNG (1400 x 1000), capa, PDF, índice visual e ZIP para o Behance.');
    }
    for (const file of ['central-neo-portfolio.pdf', 'central-neo-behance.zip']) {
      const response = await context.request.get(base + '/downloads/' + file);
      assert.equal(response.status(), 200, 'download disponível: ' + file);
      assert.ok((await response.body()).length > 10000, 'download preenchido: ' + file);
    }
    assert.deepEqual(errors, [], 'zero erros JavaScript');
    assert.deepEqual(failedResources, [], 'zero arquivos quebrados');
    assert.deepEqual(external, [], 'o portfólio carrega sem serviços externos');
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const fallback = await noJs.newPage();
    await fallback.goto(base);
    assert.equal(await fallback.getByRole('heading', { name: /FULL STACK/ }).count(), 1);
    assert.equal(await fallback.locator('[data-lightbox]').first().getAttribute('href'), 'assets/screenshots/fila.png');
    assert.equal(await fallback.locator('#panel-arquivos').isVisible(), true, 'detalhes continuam acessíveis sem JavaScript');
    await noJs.close();
    console.log('OK: navegação, simulação, abas e teclado, galeria/Escape/foco, 320/390/768/1440/1920 px, downloads, fontes locais, imagens, fallback sem JS e zero erros.');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
