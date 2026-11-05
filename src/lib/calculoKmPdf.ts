/**
 * lib/calculoKmPdf.ts — Lê o PDF de Percursos no navegador (pdf.js) e entrega os textos com
 * posição para lerRelatorio. O pdf.js só é baixado quando a tela de Cálculo de KM lê um arquivo.
 */
import { ErroNeo } from './erros';
import { lerRelatorio, type ItemTexto, type RelatorioKm } from './calculoKm';

export async function lerPdfPercursos(arquivo: File): Promise<RelatorioKm> {
  if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== 'application/pdf')
    throw new ErroNeo(`"${arquivo.name}" não é um PDF. Exporte o relatório de Percursos em PDF.`);
  const [pdfjs, { default: urlWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  } catch {
    throw new ErroNeo(`Não foi possível abrir "${arquivo.name}". O arquivo pode estar corrompido ou protegido por senha.`);
  }
  try {
    const itens: ItemTexto[] = [];
    for (let pagina = 1; pagina <= doc.numPages; pagina++) {
      const conteudo = await (await doc.getPage(pagina)).getTextContent();
      for (const it of conteudo.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        itens.push({ str: it.str, x: it.transform[4], y: it.transform[5], pagina });
      }
    }
    return lerRelatorio(itens, arquivo.name);
  } finally {
    void doc.destroy();
  }
}
