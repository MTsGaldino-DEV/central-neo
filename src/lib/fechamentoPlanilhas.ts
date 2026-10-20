/**
 * lib/fechamentoPlanilhas.ts — Leitura das planilhas do fechamento de NSIS.
 * Funções puras (sem Supabase), testáveis direto com os arquivos reais.
 */
import * as XLSX from 'xlsx';
import { lerNumero, normalizarAP } from './fechamentoFormato';

export { lerNumero, normalizarAP } from './fechamentoFormato';

export interface LinhaRelatorioNsis {
  servico: string;
  referencia: string | null;
  localidade: string | null;
  endereco: string | null;
  pedido_em: string | null;
  termino: string | null;
  resp: string | null;
  matricula: string | null;
  nome: string | null;
  tempo_deslocamento: string | null;
  tempo_execucao: string | null;
  prazo_legal: string | null;
  observacao: string | null;
  zona: string | null;
  referencia_local: string | null;
}

export interface LeituraRelatorio {
  linhas: LinhaRelatorioNsis[];
  totalLinhas: number;
  ignoradas: { motivo: string; qtd: number }[];
  periodo: string | null;
  erro?: string;
}

function normalizarCabecalho(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/ /g, ' ').trim();
  return s ? s : null;
}

/** Número de serviço/NSMP vindo como número do Excel: 207809115 (sem ".0"). */
function codigo(v: unknown): string | null {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return texto(v);
}

/**
 * Data do GDIS em horário de Brasília. Aceita "13/10/2026 12:20", "13/10/2026"
 * e o serial de data do Excel. Nunca lê como MM/DD.
 */
export function lerDataHora(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const p = (n: number) => String(n).padStart(2, '0');
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return `${raw.getFullYear()}-${p(raw.getMonth() + 1)}-${p(raw.getDate())}T${p(raw.getHours())}:${p(raw.getMinutes())}:00-03:00`;
  }
  if (typeof raw === 'number') {
    // serial do Excel: dias desde 1899-12-30; a fração é a hora
    const ms = Math.round((raw - 25569) * 864e5);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1990 || d.getUTCFullYear() > 2100) return null;
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00-03:00`;
  }
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const [, d, m, a, hh, mm] = dmy;
    return `${a}-${p(+m)}-${p(+d)}T${p(+(hh ?? 0))}:${mm ?? '00'}:00-03:00`;
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (ymd) {
    const [, a, m, d, hh, mm] = ymd;
    return `${a}-${m}-${d}T${hh ?? '00'}:${mm ?? '00'}:00-03:00`;
  }
  return null;
}

/**
 * Lê o relatório "Serviços Executados - Completo" do GDIS. O cabeçalho não
 * fica na primeira linha (vem depois do bloco de filtros), então procuramos a
 * linha que tem "Serviço" e "Término". Ficam só NSIS de responsabilidade da
 * CONTRATADA.
 */
export function lerRelatorioNsis(buffer: ArrayBuffer): LeituraRelatorio {
  const wb = XLSX.read(buffer, { type: 'array', raw: true, codepage: 1252 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const dados = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];

  let iCab = -1;
  for (let i = 0; i < Math.min(dados.length, 60); i++) {
    const cab = (dados[i] ?? []).map(normalizarCabecalho);
    if (cab.includes('servico') && cab.includes('termino')) {
      iCab = i;
      break;
    }
  }
  if (iCab === -1) {
    return { linhas: [], totalLinhas: 0, ignoradas: [], periodo: null,
      erro: 'Não encontrei o cabeçalho com "Serviço" e "Término". Confira se é o relatório "Serviços Executados" do GDIS.' };
  }

  const cab = (dados[iCab] ?? []).map(normalizarCabecalho);
  const col = (nome: string, ocorrencia = 0) => {
    let achados = -1;
    for (let i = 0; i < cab.length; i++) {
      if (cab[i] === nome && ++achados === ocorrencia) return i;
    }
    return -1;
  };
  const C = {
    servico: col('servico'),
    referencia: col('referencia'),
    endereco: col('endereco'),
    pedido: col('pedido'),
    termino: col('termino'),
    resp: col('resp'),
    matricula: col('matricula'),
    nome: col('nome'),
    deslocamento: col('tempo deslocamento'),
    execucao: col('tempo execucao'),
    prazo: col('atendimento prazo legal'),
    tipoServ: col('tipo de serv'),
    observacao: col('observacao'),
    zona: col('tipo'),
    referenciaLocal: col('referencia', 1),
  };
  if (C.tipoServ === -1) {
    return { linhas: [], totalLinhas: 0, ignoradas: [], periodo: null,
      erro: 'A coluna "Tipo de Serv." não foi encontrada: sem ela não dá para separar as NSIS.' };
  }

  // Período do relatório: as linhas "No período de" / data / "a" / data
  let periodo: string | null = null;
  for (let i = 0; i < iCab - 1; i++) {
    if (normalizarCabecalho(dados[i]?.[0]).startsWith('no periodo de')) {
      const ini = texto(dados[i + 1]?.[0]);
      const fim = texto(dados[i + 3]?.[0]);
      if (ini && fim) periodo = `${ini.slice(0, 10)} a ${fim.slice(0, 10)}`;
    }
  }

  const val = (linha: unknown[], i: number) => (i >= 0 ? linha[i] : null);
  const linhas: LinhaRelatorioNsis[] = [];
  const contagem = new Map<string, number>();
  const ignorar = (motivo: string) => contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
  const vistos = new Set<string>();
  let totalLinhas = 0;

  for (let i = iCab + 1; i < dados.length; i++) {
    const linha = dados[i] ?? [];
    const servico = codigo(val(linha, C.servico));
    if (!servico || !/^\d+$/.test(servico)) continue;
    totalLinhas++;

    const tipo = (texto(val(linha, C.tipoServ)) ?? '').toUpperCase();
    if (tipo !== 'NSIS') { ignorar(`Tipo ${tipo || 'vazio'} (não é NSIS)`); continue; }
    const resp = (texto(val(linha, C.resp)) ?? '').toUpperCase();
    if (C.resp !== -1 && resp !== 'CONTRATADA') { ignorar(`Responsável ${resp || 'vazio'}`); continue; }
    if (vistos.has(servico)) { ignorar('Serviço repetido no arquivo'); continue; }
    vistos.add(servico);

    const referencia = texto(val(linha, C.referencia));
    linhas.push({
      servico,
      referencia,
      localidade: referencia?.match(/^\d{4}/)?.[0] ?? null,
      endereco: texto(val(linha, C.endereco)),
      pedido_em: lerDataHora(val(linha, C.pedido)),
      termino: lerDataHora(val(linha, C.termino)),
      resp: resp || null,
      matricula: texto(val(linha, C.matricula))?.toLowerCase() ?? null,
      nome: texto(val(linha, C.nome)),
      tempo_deslocamento: texto(val(linha, C.deslocamento)),
      tempo_execucao: texto(val(linha, C.execucao)),
      prazo_legal: texto(val(linha, C.prazo)),
      observacao: texto(val(linha, C.observacao)),
      zona: texto(val(linha, C.zona)),
      referencia_local: texto(val(linha, C.referenciaLocal)),
    });
  }

  return {
    linhas,
    totalLinhas,
    ignoradas: [...contagem.entries()].map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd),
    periodo,
  };
}

// ─── Planilha de controle (aba "MANUTENÇÃO - 211 NSIS") ────────────────

export interface LinhaHistorico {
  servico: string;
  nsmp: string | null;
  equipe: string | null;
  descricao: string | null;
  valor_inicial: number | null;
  nspr: string | null;
  us_adicional: number | null;
  valor_final: number | null;
  termino: string | null;
  fatura: string | null;
}

export interface LeituraHistorico {
  aba: string | null;
  linhas: LinhaHistorico[];
  comItem: number;
  aFechar: number;
  nsisDistintas: number;
  erro?: string;
}

/**
 * Lê a planilha "controle de nsmc". Procura a aba de NSIS e o cabeçalho com
 * "Serviço" e "NSMP". O "-ok" no número da equipe era a marca de conferido na
 * planilha e não faz parte do número.
 */
export function lerPlanilhaHistorico(buffer: ArrayBuffer): LeituraHistorico {
  // sem cellDates: a data vem como serial do Excel e é convertida sem fuso
  const wb = XLSX.read(buffer, { type: 'array' });
  const aba = wb.SheetNames.find((n) => normalizarCabecalho(n).includes('nsis')) ?? null;
  if (!aba) {
    return { aba: null, linhas: [], comItem: 0, aFechar: 0, nsisDistintas: 0,
      erro: `Não encontrei a aba de NSIS. Abas do arquivo: ${wb.SheetNames.join(', ')}.` };
  }
  const dados = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null }) as unknown[][];

  let iCab = -1;
  for (let i = 0; i < Math.min(dados.length, 20); i++) {
    const cab = (dados[i] ?? []).map(normalizarCabecalho);
    if (cab.includes('servico') && cab.includes('nsmp')) { iCab = i; break; }
  }
  if (iCab === -1) {
    return { aba, linhas: [], comItem: 0, aFechar: 0, nsisDistintas: 0,
      erro: 'Não encontrei o cabeçalho com "Serviço" e "NSMP" na aba de NSIS.' };
  }
  const cab = (dados[iCab] ?? []).map(normalizarCabecalho);
  const acha = (...nomes: string[]) => cab.findIndex((h) => nomes.includes(h));
  const C = {
    servico: acha('servico'),
    nsmp: acha('nsmp'),
    equipe: acha('n do equipe', 'no do equipe', 'n da equipe', 'equipe'),
    descricao: acha('tipo de servico'),
    valorInicial: acha('valor inicial'),
    nspr: acha('nspr'),
    usAdicional: acha('us adicional'),
    valorFinal: acha('valor final'),
    termino: acha('dt execucao', 'data execucao'),
    fatura: acha('apropriacao fatura', 'apropriacao', 'fatura'),
  };
  const v = (l: unknown[], i: number) => (i >= 0 ? l[i] : null);

  const linhas: LinhaHistorico[] = [];
  for (let i = iCab + 1; i < dados.length; i++) {
    const l = dados[i] ?? [];
    const servico = codigo(v(l, C.servico));
    if (!servico || !/^\d+$/.test(servico)) continue;
    linhas.push({
      servico,
      nsmp: codigo(v(l, C.nsmp)),
      equipe: codigo(v(l, C.equipe))?.replace(/\s*-?\s*ok$/i, '') ?? null,
      descricao: texto(v(l, C.descricao)),
      valor_inicial: lerNumero(v(l, C.valorInicial)),
      nspr: codigo(v(l, C.nspr)),
      us_adicional: lerNumero(v(l, C.usAdicional)),
      valor_final: lerNumero(v(l, C.valorFinal)),
      termino: lerDataHora(v(l, C.termino)),
      fatura: texto(v(l, C.fatura)) ? normalizarAP(texto(v(l, C.fatura))!) : null,
    });
  }
  const comItem = linhas.filter((l) => l.nsmp || l.valor_inicial !== null).length;
  return {
    aba,
    linhas,
    comItem,
    aFechar: linhas.length - comItem,
    nsisDistintas: new Set(linhas.map((l) => l.servico)).size,
  };
}

