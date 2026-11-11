// Exportação da Conferência da disponibilidade para Excel (visão do mês e visão do dia).
// exceljs entra por import dinâmico: só é baixado quando alguém clica em "Baixar Excel".
import type { Cell, Fill, Font, Row, Worksheet } from 'exceljs';
import {
  INICIO_CONTROLE, NOMES_MES, SIGLAS, SUPERVISORES, MULTAVEIS, CONTESTAVEIS,
  chaveDia, dataDe, desativadaDesde, diasDoMes, ehMultavel, equipeDesativada,
  type EstadosEquipe, type Frota, type Lancamento,
} from './disponibilidadeRegras';

type Ler = (dia: string, frota: number) => Lancamento | undefined;

const MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const SEMANA_CURTA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Mesmas cores da tela (verde: cadastrou, vermelho: multável, amarelo: contestável). */
const COR = {
  titulo: '1F3B4D', cabecalho: '1F3B4D', cabecalhoFds: '3A5A6E', zebra: 'F6F9FA', borda: 'D5DDE0', cinza: 'EDEDED', texto: '1F2D33',
  ok: { fundo: 'C6EFCE', fonte: '006100' },
  multa: { fundo: 'FFC7CE', fonte: '9C0006' },
  contesta: { fundo: 'FFEB9C', fonte: '7A4600' },
  falta: { fundo: 'FFFFFF', fonte: '8A8A8A' },
  desativada: { fundo: 'D5DCE0', fonte: '4A5A62' },
};

const solido = (rgb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${rgb}` } });
const fonte = (rgb: string, extra: Partial<Font> = {}): Partial<Font> => ({ name: 'Calibri', size: 11, color: { argb: `FF${rgb}` }, ...extra });
const linhaFina = { style: 'thin' as const, color: { argb: `FF${COR.borda}` } };
const bordas = { top: linhaFina, left: linhaFina, bottom: linhaFina, right: linhaFina };

function pintar(c: Cell, fundo: string, letra: string, extra: Partial<Font> = {}) {
  c.fill = solido(fundo);
  c.font = fonte(letra, extra);
}

function cabecalho(l: Row, fds: (i: number) => boolean = () => false) {
  l.eachCell({ includeEmpty: true }, (c, i) => {
    pintar(c, fds(i) ? COR.cabecalhoFds : COR.cabecalho, 'FFFFFF', { bold: true });
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = bordas;
  });
}

function tituloDaFolha(ws: Worksheet, titulo: string, subtitulo: string, ultimaColuna: number) {
  ws.mergeCells(1, 1, 1, ultimaColuna);
  ws.mergeCells(2, 1, 2, ultimaColuna);
  const t = ws.getCell(1, 1), s = ws.getCell(2, 1);
  t.value = titulo; t.font = fonte(COR.titulo, { size: 16, bold: true }); t.alignment = { vertical: 'middle' };
  s.value = subtitulo; s.font = fonte('5C6B72', { size: 10 }); s.alignment = { vertical: 'middle', wrapText: true };
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 18;
}

function configurarImpressao(ws: Worksheet, titulosTopo: string) {
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: titulosTopo,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function baixar(wb: import('exceljs').Workbook, nome: string) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function novoLivro() {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  wb.creator = 'Central NEO';
  wb.created = new Date();
  return wb;
}

const agora = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dataBR = (chave: string) => dataDe(chave).toLocaleDateString('pt-BR');
const dataExcel = (chave: string) => { const [a, m, d] = chave.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const tipoDe = (causa: string | null | undefined) => (ehMultavel(causa) ? 'Multável' : 'Contestável');

function legenda(ws: Worksheet, primeiraLinha: number) {
  const itens: [string, string, { fundo: string; fonte: string }][] = [
    ...MULTAVEIS.map(c => [SIGLAS[c], `${c} (multável)`, COR.multa] as [string, string, { fundo: string; fonte: string }]),
    ...CONTESTAVEIS.map(c => [SIGLAS[c], `${c} (contestável, R$ 0 na conta)`, COR.contesta] as [string, string, { fundo: string; fonte: string }]),
    ['✓', 'Cadastrou', COR.ok],
    ['?', 'Falta conferir', COR.falta],
    ['DES', 'Equipe desativada (não entra na conta)', COR.desativada],
  ];
  const t = ws.getCell(primeiraLinha, 1);
  t.value = 'Legenda'; t.font = fonte(COR.titulo, { bold: true });
  itens.forEach(([sigla, texto, cor], i) => {
    const r = primeiraLinha + 1 + i;
    const c = ws.getCell(r, 1);
    c.value = sigla; pintar(c, cor.fundo, cor.fonte, { bold: true }); c.alignment = { horizontal: 'center' }; c.border = bordas;
    ws.getCell(r, 2).value = texto; ws.getCell(r, 2).font = fonte(COR.texto);
  });
}

export interface DadosMes {
  ano: number; mes: number; hoje: string; frotas: Frota[]; valor: number; ler: Ler; estados: EstadosEquipe;
  /** 'T' ou o nome do supervisor. */
  sup: string;
  /** 'T' todas as frotas, 'O' só com ocorrência, 'M' só com multa. */
  ver: string;
}

export async function exportarConferenciaMes({ ano, mes, hoje, frotas, valor, ler, estados, sup, ver }: DadosMes): Promise<void> {
  const dias = diasDoMes(ano, mes);
  const chaves = dias.map(chaveDia);
  const fora = (k: string) => k < INICIO_CONTROLE || k > hoje;
  const validos = chaves.filter(k => !fora(k));

  const noSup = frotas.filter(f => sup === 'T' || f.supervisor === sup);
  const passa = (f: Frota) => ver === 'T' || chaves.some(k => {
    const l = ler(k, f.frota);
    return l?.situacao === 'OCORRENCIA' && (ver === 'O' || ehMultavel(l.causa));
  });
  const ordemSup = (s: string) => { const i = (SUPERVISORES as readonly string[]).indexOf(s); return i < 0 ? 99 : i; };
  const lista = noSup.filter(passa).sort((a, b) => ordemSup(a.supervisor) - ordemSup(b.supervisor) || a.ordem - b.ordem);

  const nomeMes = `${NOMES_MES[mes]} de ${ano}`;
  const filtros = `Supervisor: ${sup === 'T' ? 'todos' : sup} · Frotas: ${ver === 'M' ? 'só com multa' : ver === 'O' ? 'só com ocorrência' : 'todas'}`;
  const subtitulo = `${filtros} · Valor por ocorrência multável: ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Gerado em ${agora()}`;

  const wb = await novoLivro();

  // ---------- Grade ----------
  const grade = wb.addWorksheet('Grade do mês', { views: [{ state: 'frozen', xSplit: 2, ySplit: 5, showGridLines: false }] });
  const col0 = 5;                                   // primeira coluna de dia (E)
  const colMultas = col0 + dias.length;
  const colContest = colMultas + 1;
  const colValor = colMultas + 2;
  tituloDaFolha(grade, `Conferência da frota · ${nomeMes}`, subtitulo, colValor);

  grade.getRow(4).values = ['', '', '', '', ...dias.map(d => d.getDate()), '', '', ''];
  grade.getRow(5).values = ['Frota', 'Placa', 'Supervisor', 'Região', ...dias.map(d => SEMANA_CURTA[d.getDay()]), 'Multas', 'Contestáveis', 'Valor'];
  const ehFds = (i: number) => i >= col0 && i < colMultas && dias[i - col0].getDay() % 6 === 0;
  cabecalho(grade.getRow(4), ehFds); cabecalho(grade.getRow(5), ehFds);
  grade.getRow(4).height = 20;

  const ini = 6;
  lista.forEach((f, idx) => {
    const r = ini + idx;
    const linha = grade.getRow(r);
    let multas = 0, contest = 0;
    linha.getCell(1).value = f.frota;
    linha.getCell(2).value = f.placa;
    linha.getCell(3).value = f.supervisor;
    linha.getCell(4).value = f.regiao;
    for (let c = 1; c <= 4; c++) {
      const cel = linha.getCell(c);
      cel.font = fonte(COR.texto, c === 1 ? { bold: true } : {});
      cel.alignment = { vertical: 'middle', horizontal: c === 1 || c === 2 ? 'center' : 'left' };
      cel.border = bordas;
      if (idx % 2) cel.fill = solido(COR.zebra);
    }
    chaves.forEach((k, i) => {
      const c = linha.getCell(col0 + i);
      const l = ler(k, f.frota);
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = bordas;
      // Dia fora do período fica cinza, sem marca; a equipe desativada ganha o "DES" sozinha quando o dia for liberado.
      if (fora(k)) { c.fill = solido(COR.cinza); return; }
      if (equipeDesativada(estados, f.frota, k)) { c.value = 'DES'; pintar(c, COR.desativada.fundo, COR.desativada.fonte, { bold: true, size: 9 }); return; }
      if (!l) { c.value = '?'; pintar(c, COR.falta.fundo, COR.falta.fonte); return; }
      if (l.situacao === 'CADASTROU') { c.value = '✓'; pintar(c, COR.ok.fundo, COR.ok.fonte, { bold: true }); return; }
      const m = ehMultavel(l.causa);
      if (m) multas++; else contest++;
      c.value = SIGLAS[l.causa ?? ''] ?? '?';
      pintar(c, (m ? COR.multa : COR.contesta).fundo, (m ? COR.multa : COR.contesta).fonte, { bold: true });
      c.note = { texts: [{ text: `${l.causa}${l.observacao ? `\n${l.observacao}` : ''}`, font: { name: 'Calibri', size: 10 } }], margins: { insetmode: 'auto', inset: [0.05, 0.05, 0.05, 0.05] } };
    });
    const cm = linha.getCell(colMultas), cc = linha.getCell(colContest), cv = linha.getCell(colValor);
    cm.value = multas || null; cc.value = contest || null; cv.value = multas ? -multas * valor : null;
    for (const c of [cm, cc, cv]) { c.font = fonte(COR.texto, { bold: c === cv }); c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = bordas; }
    cv.numFmt = MOEDA; cv.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  const fim = ini + lista.length - 1;

  // Rodapé: multas por dia e total.
  const rodape = grade.getRow(fim + 1);
  rodape.getCell(1).value = 'Multas no dia';
  grade.mergeCells(fim + 1, 1, fim + 1, 4);
  let totalMultas = 0;
  chaves.forEach((k, i) => {
    const n = lista.filter(f => ehMultavel(ler(k, f.frota)?.causa)).length;
    totalMultas += n;
    rodape.getCell(col0 + i).value = n || null;
  });
  rodape.getCell(colMultas).value = totalMultas || null;
  rodape.getCell(colValor).value = totalMultas ? -totalMultas * valor : null;
  rodape.getCell(colValor).numFmt = MOEDA;
  rodape.eachCell({ includeEmpty: true }, c => {
    pintar(c, 'E4EAED', COR.titulo, { bold: true }); c.border = bordas; c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rodape.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  rodape.getCell(colValor).alignment = { horizontal: 'right', vertical: 'middle' };

  grade.columns = [
    { width: 8 }, { width: 11 }, { width: 13 }, { width: 18 },
    ...dias.map(() => ({ width: 4.6 })),
    { width: 8 }, { width: 13 }, { width: 15 },
  ];
  // Filtro só nas colunas que identificam a frota: os botões não cobrem os dias, e o filtro esconde a linha inteira.
  if (lista.length) grade.autoFilter = { from: { row: 5, column: 1 }, to: { row: fim, column: 4 } };
  legenda(grade, fim + 3);
  configurarImpressao(grade, '4:5');

  // ---------- Resumo ----------
  const resumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
  tituloDaFolha(resumo, `Resumo · ${nomeMes}`, subtitulo, 6);
  const conferidos = validos.filter(k => lista.every(f => ler(k, f.frota) || equipeDesativada(estados, f.frota, k))).length;
  const comMulta = new Set<number>();
  let multaveis = 0, contestaveis = 0;
  for (const f of lista) for (const k of chaves) {
    const l = ler(k, f.frota);
    if (l?.situacao !== 'OCORRENCIA') continue;
    if (ehMultavel(l.causa)) { multaveis++; comMulta.add(f.frota); } else contestaveis++;
  }
  const kpis: [string, string | number, string?][] = [
    ['Dias conferidos', `${conferidos} de ${validos.length}`],
    ['Total do mês (multas)', -multaveis * valor, MOEDA],
    ['Ocorrências multáveis', multaveis],
    ['Frotas com multa', `${comMulta.size} de ${lista.length}`],
    ['Ocorrências contestáveis', contestaveis],
  ];
  kpis.forEach(([rotulo, v, fmt], i) => {
    const r = 4 + i;
    const a = resumo.getCell(r, 1), b = resumo.getCell(r, 2);
    a.value = rotulo; pintar(a, 'E4EAED', COR.titulo, { bold: true }); a.border = bordas;
    b.value = v; b.font = fonte(COR.texto, { bold: true, size: 12 }); b.alignment = { horizontal: 'right' }; b.border = bordas;
    if (fmt) b.numFmt = fmt;
  });

  let r = 4 + kpis.length + 1;
  const titulo = (txt: string) => { const c = resumo.getCell(r, 1); c.value = txt; c.font = fonte(COR.titulo, { bold: true, size: 13 }); r++; };
  titulo('Por supervisor');
  resumo.getRow(r).values = ['Supervisor', 'Região', 'Frotas', 'Multáveis', 'Contestáveis', 'Valor (multas)']; cabecalho(resumo.getRow(r)); r++;
  const sups = SUPERVISORES.filter(s => lista.some(f => f.supervisor === s));
  const primeiraSup = r;
  for (const s of sups) {
    const fs = lista.filter(f => f.supervisor === s);
    let m = 0, c = 0;
    for (const f of fs) for (const k of chaves) { const l = ler(k, f.frota); if (l?.situacao === 'OCORRENCIA') { if (ehMultavel(l.causa)) m++; else c++; } }
    resumo.getRow(r).values = [s, fs[0].regiao, fs.length, m, c, m ? -m * valor : 0];
    r++;
  }
  resumo.getRow(r).values = ['Total', '', lista.length, multaveis, contestaveis, multaveis ? -multaveis * valor : 0];
  for (let i = primeiraSup; i <= r; i++) {
    const l = resumo.getRow(i);
    l.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = bordas; c.font = fonte(COR.texto, { bold: i === r });
      c.alignment = { horizontal: col <= 2 ? 'left' : col === 6 ? 'right' : 'center' };
      if (i === r) c.fill = solido('E4EAED');
    });
    l.getCell(6).numFmt = MOEDA;
  }
  r += 2;

  titulo('Por causa');
  resumo.getRow(r).values = ['Causa', 'Sigla', 'Tipo', 'Qtd', '', 'Valor (multas)']; cabecalho(resumo.getRow(r)); r++;
  for (const causa of [...MULTAVEIS, ...CONTESTAVEIS]) {
    let n = 0;
    for (const f of lista) for (const k of chaves) if (ler(k, f.frota)?.causa === causa && ler(k, f.frota)?.situacao === 'OCORRENCIA') n++;
    const m = ehMultavel(causa);
    resumo.getRow(r).values = [causa, SIGLAS[causa], tipoDe(causa), n, '', m && n ? -n * valor : 0];
    resumo.getRow(r).eachCell({ includeEmpty: true }, (c, col) => {
      c.border = bordas; c.font = fonte(COR.texto);
      c.alignment = { horizontal: col === 1 || col === 3 ? 'left' : col === 6 ? 'right' : 'center' };
    });
    pintar(resumo.getRow(r).getCell(2), (m ? COR.multa : COR.contesta).fundo, (m ? COR.multa : COR.contesta).fonte, { bold: true });
    resumo.getRow(r).getCell(6).numFmt = MOEDA;
    r++;
  }
  resumo.columns = [{ width: 30 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 }];
  configurarImpressao(resumo, '1:2');

  // ---------- Ocorrências (uma linha por ocorrência, boa para filtro e tabela dinâmica) ----------
  const oc = wb.addWorksheet('Ocorrências', { views: [{ state: 'frozen', ySplit: 1 }] });
  oc.columns = [
    { header: 'Data', width: 12 }, { header: 'Dia', width: 8 }, { header: 'Frota', width: 8 }, { header: 'Placa', width: 11 },
    { header: 'Supervisor', width: 13 }, { header: 'Região', width: 18 }, { header: 'Causa', width: 28 }, { header: 'Sigla', width: 7 },
    { header: 'Tipo', width: 13 }, { header: 'Valor', width: 14 }, { header: 'Observação', width: 50 },
  ];
  cabecalho(oc.getRow(1));
  oc.getRow(1).height = 20;
  let n = 0;
  for (const k of chaves) for (const f of lista) {
    const l = ler(k, f.frota);
    if (l?.situacao !== 'OCORRENCIA') continue;
    const m = ehMultavel(l.causa);
    const linha = oc.addRow([dataExcel(k), dataDe(k).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), f.frota, f.placa, f.supervisor, f.regiao,
      l.causa, SIGLAS[l.causa ?? ''] ?? '', tipoDe(l.causa), m ? -valor : 0, l.observacao ?? '']);
    linha.getCell(1).numFmt = 'dd/mm/yyyy';
    linha.getCell(10).numFmt = MOEDA;
    linha.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = fonte(COR.texto); c.border = bordas;
      c.alignment = { vertical: 'middle', horizontal: col === 10 ? 'right' : col === 7 || col === 11 || col === 5 || col === 6 ? 'left' : 'center', wrapText: col === 11 };
    });
    pintar(linha.getCell(9), (m ? COR.multa : COR.contesta).fundo, (m ? COR.multa : COR.contesta).fonte, { bold: true });
    n++;
  }
  if (n) oc.autoFilter = { from: { row: 1, column: 1 }, to: { row: n + 1, column: 11 } };
  else { oc.addRow(['Nenhuma ocorrência neste mês.']); oc.getCell(2, 1).font = fonte('5C6B72', { italic: true }); }
  configurarImpressao(oc, '1:1');

  const suf = sup === 'T' ? '' : `-${slug(sup)}`;
  await baixar(wb, `conferencia-frota-${ano}-${String(mes + 1).padStart(2, '0')}${suf}.xlsx`);
}

export interface DadosDia {
  dia: string; frotas: Frota[]; valor: number; ler: Ler; estados: EstadosEquipe;
  sup: string;
  /** 'T' todas as situações, 'F' falta conferir, 'M' com motivo. */
  ver: string;
}

export async function exportarConferenciaDia({ dia, frotas, valor, ler, estados, sup, ver }: DadosDia): Promise<void> {
  const noSup = frotas.filter(f => sup === 'T' || f.supervisor === sup);
  const ordemSup = (s: string) => { const i = (SUPERVISORES as readonly string[]).indexOf(s); return i < 0 ? 99 : i; };
  const ordenar = (a: Frota, b: Frota) => ordemSup(a.supervisor) - ordemSup(b.supervisor) || a.ordem - b.ordem;
  const off = (f: Frota) => equipeDesativada(estados, f.frota, dia);
  const lista = noSup.filter(f => {
    const l = ler(dia, f.frota);
    return ver === 'F' ? !l && !off(f) : ver === 'M' ? l?.situacao === 'OCORRENCIA' : true;
  }).sort(ordenar);

  const cadastraram = noSup.filter(f => ler(dia, f.frota)?.situacao === 'CADASTROU').length;
  const multaveis = noSup.filter(f => ehMultavel(ler(dia, f.frota)?.causa)).length;
  const contestaveis = noSup.filter(f => ler(dia, f.frota)?.situacao === 'OCORRENCIA' && !ehMultavel(ler(dia, f.frota)?.causa)).length;
  const desativadas = noSup.filter(off).length;
  const faltam = noSup.length - desativadas - cadastraram - multaveis - contestaveis;

  const textoDia = dataDe(dia).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const filtros = `Supervisor: ${sup === 'T' ? 'todos' : sup} · Situação: ${ver === 'F' ? 'falta conferir' : ver === 'M' ? 'com motivo' : 'todas'}`;

  const wb = await novoLivro();
  const ws = wb.addWorksheet(`Dia ${dataBR(dia).slice(0, 5).replace('/', '-')}`, { views: [{ state: 'frozen', xSplit: 1, ySplit: 5, showGridLines: false }] });
  tituloDaFolha(ws, `Conferência da frota · ${textoDia}`, `${filtros} · Valor por ocorrência multável: ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Gerado em ${agora()}`, 12);

  const resumoDia = ws.getRow(3);
  resumoDia.getCell(1).value = `Conferidas: ${noSup.length - desativadas - faltam} de ${noSup.length - desativadas}${desativadas ? ` (${desativadas} ${desativadas === 1 ? 'equipe desativada' : 'equipes desativadas'})` : ''}   ·   Cadastraram: ${cadastraram}   ·   Multáveis: ${multaveis} (${(multaveis ? -multaveis * valor : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})   ·   Contestáveis: ${contestaveis}   ·   Faltam conferir: ${faltam}`;
  ws.mergeCells(3, 1, 3, 12);
  resumoDia.getCell(1).font = fonte(COR.titulo, { bold: true });
  resumoDia.getCell(1).fill = solido('E4EAED');
  resumoDia.height = 20;
  resumoDia.getCell(1).alignment = { vertical: 'middle' };

  ws.getRow(5).values = ['Frota', 'Placa', 'Supervisor', 'Região', 'Escala', 'Horário', 'Local', 'Situação', 'Causa', 'Tipo', 'Valor', 'Observação'];
  cabecalho(ws.getRow(5));
  ws.getRow(5).height = 20;

  lista.forEach((f, idx) => {
    const l = ler(dia, f.frota);
    const m = ehMultavel(l?.causa);
    const desde = desativadaDesde(estados, f.frota, dia);
    const situacao = desde ? `Desativada desde ${dataBR(desde)}` : !l ? 'Falta conferir' : l.situacao === 'CADASTROU' ? 'Cadastrou' : 'Ocorrência';
    const linha = ws.addRow([f.frota, f.placa, f.supervisor, f.regiao, f.escala, f.horario, f.local, situacao, l?.causa ?? '', l?.situacao === 'OCORRENCIA' ? tipoDe(l.causa) : '', m ? -valor : l?.situacao === 'OCORRENCIA' ? 0 : null, l?.observacao ?? '']);
    linha.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = fonte(COR.texto, col === 1 ? { bold: true } : {}); c.border = bordas;
      c.alignment = { vertical: 'middle', horizontal: col <= 2 || col === 5 ? 'center' : col === 11 ? 'right' : 'left', wrapText: col === 12 };
      if (idx % 2) c.fill = solido(COR.zebra);
    });
    linha.getCell(11).numFmt = MOEDA;
    const cor = desde ? COR.desativada : !l ? COR.falta : l.situacao === 'CADASTROU' ? COR.ok : m ? COR.multa : COR.contesta;
    pintar(linha.getCell(8), !l && !desde ? 'FFF4D6' : cor.fundo, !l && !desde ? '7A4600' : cor.fonte, { bold: true });
    if (l?.situacao === 'OCORRENCIA') pintar(linha.getCell(9), cor.fundo, cor.fonte, { bold: true });
  });
  if (!lista.length) { ws.addRow(['Nenhuma equipe nesta seleção.']); ws.getCell(6, 1).font = fonte('5C6B72', { italic: true }); }

  ws.columns = [
    { width: 8 }, { width: 11 }, { width: 13 }, { width: 18 }, { width: 9 }, { width: 16 }, { width: 34 },
    { width: 15 }, { width: 28 }, { width: 13 }, { width: 14 }, { width: 46 },
  ];
  if (lista.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + lista.length, column: 12 } };
  configurarImpressao(ws, '5:5');

  const suf = sup === 'T' ? '' : `-${slug(sup)}`;
  await baixar(wb, `conferencia-frota-${dia}${suf}.xlsx`);
}
