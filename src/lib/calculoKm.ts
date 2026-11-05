/**
 * lib/calculoKm.ts — Quilômetros rodados a partir do relatório "Percursos" do rastreador.
 *
 * Puro (sem React e sem PDF), para testar em Node. A leitura do PDF fica em calculoKmPdf.ts,
 * que entrega para cá só os textos de cada página com a posição (x, y).
 *
 * Método, o mesmo usado na conferência manual de 04–05/11/2026:
 * 1. junta os pontos de todos os relatórios da mesma equipe e do mesmo dia, em ordem de horário;
 * 2. descarta os pontos falsos do GPS (ver `limpar`);
 * 3. soma a distância em linha reta (fórmula de Haversine) entre cada ponto e o seguinte.
 * A linha reta corta as curvas: o odômetro tende a marcar alguns por cento a mais.
 */
import { ErroNeo } from './erros';

export interface ItemTexto { str: string; x: number; y: number; pagina: number }

export interface PontoKm {
  /** Horário em ms (horário local do relatório, tratado como UTC só para ordenar e subtrair). */
  ts: number;
  /** Como veio no relatório: "22/10 16:40:49". */
  hora: string;
  vel: number;
  lat: number;
  lon: number;
  evento: string;
  status: string;
  arquivo: string;
}

export interface RelatorioKm {
  arquivo: string;
  agente: string;
  placa: string;
  /** Início e fim do intervalo pedido na emissão do relatório (ms). */
  inicio: number;
  fim: number;
  pontos: PontoKm[];
}

export type MotivoDescarte = 'REPETIDO' | 'PICO';

export interface Descartado { ponto: PontoKm; motivo: MotivoDescarte; kmEvitados: number }

export interface Trecho { de: PontoKm; ate: PontoKm; km: number; kmh: number | null }

export type TipoAlerta = 'CORTADO' | 'LACUNA' | 'SALTO';
export interface AlertaKm { tipo: TipoAlerta; texto: string }

export interface ResultadoKm {
  chave: string;
  agente: string;
  placa: string;
  /** Dia do percurso, "2026-10-22". */
  dia: string;
  arquivos: string[];
  pontosLidos: number;
  pontos: PontoKm[];
  descartados: Descartado[];
  trechos: Trecho[];
  kmBruto: number;
  kmLimpo: number;
  kmLinhaReta: number;
  kmPorStatus: { status: string; km: number }[];
  alertas: AlertaKm[];
}

// ─── Parâmetros do método ─────────────────────────────────────────────────────

/** Salto mínimo (km) para um ponto ser considerado fora da rota. */
export const SALTO_KM = 2;
/** Velocidade acima da qual um trecho é fisicamente impossível para a frota (km/h). */
export const VELOCIDADE_IMPOSSIVEL = 150;
/** Vezes que a mesma coordenada parada precisa aparecer para ser tratada como "presa" no rastreador. */
export const REPETICOES_FANTASMA = 3;
/** Linhas por relatório a partir das quais o sistema do rastreador corta a exportação. */
export const LIMITE_LINHAS = 200;

// ─── Geometria ───────────────────────────────────────────────────────────────

const RAIO_TERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em km entre duas coordenadas na superfície da Terra. */
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const kmh = (km: number, a: PontoKm, b: PontoKm) => {
  const h = (b.ts - a.ts) / 3_600_000;
  return h > 0 ? km / h : null;
};

const somar = (p: PontoKm[]) => p.reduce((s, x, i) => (i ? s + haversine(p[i - 1], x) : 0), 0);

// ─── Leitura do relatório ────────────────────────────────────────────────────

const RE_HORA = /^(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const RE_COORD = /^(-?\d{1,3}(?:\.\d+)?)\s*;\s*(-?\d{1,3}(?:\.\d+)?)$/;
const RE_DATA_COMPLETA = /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/g;

const utc = (a: number, m: number, d: number, h: number, mi: number, s: number) => Date.UTC(a, m - 1, d, h, mi, s);

/** Monta o relatório a partir dos textos posicionados do PDF. */
export function lerRelatorio(itens: ItemTexto[], arquivo: string): RelatorioKm {
  const textos = itens.map(i => ({ ...i, str: i.str.replace(/\s+/g, ' ').trim() })).filter(i => i.str);
  const junto = textos.map(i => i.str).join(' ');

  const agenteTexto = textos.find((t, i) => /^Agente:?$/i.test(textos[i - 1]?.str ?? '') && /\//.test(t.str))?.str
    ?? junto.match(/Agente:\s*([^\s/]+\s*\/\s*\S+)/i)?.[1];
  const [agente, placa] = (agenteTexto ?? '').split('/').map(s => s.trim());
  const intervalo = [...(junto.match(/Intervalo:\s*([\d/: -]+)/i)?.[1] ?? '').matchAll(RE_DATA_COMPLETA)]
    .map(m => utc(+m[3], +m[2], +m[1], +m[4], +m[5], +m[6]));
  if (!agente || !placa || intervalo.length < 2 || !/Coordenadas/i.test(junto))
    throw new ErroNeo(`"${arquivo}" não parece um relatório de Percursos do rastreador (faltam Agente, Intervalo ou a coluna Coordenadas).`);
  const [inicio, fim] = intervalo;
  const anoInicio = new Date(inicio).getUTCFullYear(), mesInicio = new Date(inicio).getUTCMonth() + 1;

  // Cada linha da tabela é um grupo de textos com o mesmo y na mesma página.
  const linhas = new Map<string, typeof textos>();
  for (const t of textos) {
    const k = `${t.pagina}:${Math.round(t.y)}`;
    const l = linhas.get(k); if (l) l.push(t); else linhas.set(k, [t]);
  }

  const pontos: PontoKm[] = [];
  for (const l of linhas.values()) {
    l.sort((a, b) => a.x - b.x);
    const iHora = l.findIndex(t => RE_HORA.test(t.str));
    const iCoord = l.findIndex(t => RE_COORD.test(t.str));
    if (iHora < 0 || iCoord < 0) continue;
    const h = l[iHora].str.match(RE_HORA)!, c = l[iCoord].str.match(RE_COORD)!;
    const lat = +c[1], lon = +c[2];
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    // Velocidade: o número inteiro logo antes das coordenadas. Evento e status: os textos do meio.
    const meio = l.slice(iHora + 1, iCoord);
    const iVel = meio.map(t => /^\d{1,3}$/.test(t.str)).lastIndexOf(true);
    const vel = iVel >= 0 ? +meio[iVel].str : 0;
    const textosMeio = meio.filter((_, i) => i !== iVel).map(t => t.str);
    const evento = textosMeio.find(s => /^[A-Z_]+$/.test(s) && s.includes('_')) ?? '';
    const status = textosMeio.filter(s => s !== evento).join(' ');
    const mes = +h[2];
    // O relatório não traz o ano na linha: vem do intervalo (virada de ano: mês menor que o do início).
    const ano = mes < mesInicio ? anoInicio + 1 : anoInicio;
    pontos.push({ ts: utc(ano, mes, +h[1], +h[3], +h[4], +h[5]), hora: l[iHora].str, vel, lat, lon, evento, status, arquivo });
  }
  if (!pontos.length) throw new ErroNeo(`Nenhuma posição encontrada em "${arquivo}". Confira se o relatório tem registros no intervalo.`);
  pontos.sort((a, b) => a.ts - b.ts);
  return { arquivo, agente, placa, inicio, fim, pontos };
}

// ─── Limpeza dos pontos falsos ───────────────────────────────────────────────

const chaveCoord = (p: PontoKm) => `${p.lat};${p.lon}`;

/**
 * Descarta dois defeitos do rastreador, sem tocar no restante:
 * - REPETIDO: posição "presa". Velocidade 0, a mesma coordenada exata se repete ao longo do dia
 *   (≥ REPETICOES_FANTASMA vezes) e o ponto fica a mais de SALTO_KM de um vizinho. A exigência do
 *   salto preserva as paradas reais (equipe parada na base também repete a coordenada, mas perto dos vizinhos).
 * - PICO: o veículo "vai e volta". O ponto se afasta da rota e o seguinte volta para perto do anterior
 *   (anterior→seguinte menor que metade da ida ou da volta), com salto > SALTO_KM nos dois lados ou
 *   velocidade impossível (> VELOCIDADE_IMPOSSIVEL) em um deles. Repete até não sobrar nenhum.
 */
export function limpar(pontos: PontoKm[]): { pontos: PontoKm[]; descartados: Descartado[] } {
  const descartados: Descartado[] = [];
  const evitados = (a: PontoKm | undefined, b: PontoKm, c: PontoKm | undefined) =>
    (a ? haversine(a, b) : 0) + (c ? haversine(b, c) : 0) - (a && c ? haversine(a, c) : 0);

  const contagem = new Map<string, number>();
  for (const p of pontos) if (p.vel === 0) contagem.set(chaveCoord(p), (contagem.get(chaveCoord(p)) ?? 0) + 1);
  const presos = new Set<PontoKm>();
  const foraDaRota = (x: PontoKm, y: PontoKm | undefined) => {
    if (!y) return false;
    const d = haversine(x, y), [ini, fim] = x.ts < y.ts ? [x, y] : [y, x];
    return d > SALTO_KM || (d > 0.5 && (kmh(d, ini, fim) ?? Infinity) > VELOCIDADE_IMPOSSIVEL);
  };
  pontos.forEach((p, i) => {
    if (p.vel !== 0 || (contagem.get(chaveCoord(p)) ?? 0) < REPETICOES_FANTASMA) return;
    if (foraDaRota(p, pontos[i - 1]) || foraDaRota(p, pontos[i + 1])) presos.add(p);
  });
  let lista = pontos.filter(p => !presos.has(p));
  // km evitados de cada ponto preso: medido contra os vizinhos que ficaram.
  for (const p of presos) {
    const i = lista.findIndex(x => x.ts > p.ts);
    const c = i < 0 ? undefined : lista[i], a = i < 0 ? lista[lista.length - 1] : lista[i - 1];
    descartados.push({ ponto: p, motivo: 'REPETIDO', kmEvitados: evitados(a, p, c) });
  }

  for (let mudou = true; mudou;) {
    mudou = false;
    for (let i = 1; i < lista.length - 1; i++) {
      const a = lista[i - 1], b = lista[i], c = lista[i + 1];
      const ab = haversine(a, b), bc = haversine(b, c), ac = haversine(a, c);
      const volta = ac < 0.5 * Math.min(ab, bc);
      const longe = ab > SALTO_KM && bc > SALTO_KM;
      const impossivel = Math.max(kmh(ab, a, b) ?? Infinity, kmh(bc, b, c) ?? Infinity) > VELOCIDADE_IMPOSSIVEL && Math.min(ab, bc) > 0.5;
      if (volta && (longe || impossivel)) {
        // Eco: o seguinte está parado e repete a posição do anterior segundos depois. O falso é ele, não o ponto em movimento.
        const eco = b.vel > 0 && c.vel === 0 && ac < 0.2 && i + 2 < lista.length;
        const j = eco ? i + 1 : i;
        const [x, y, z] = [lista[j - 1], lista[j], lista[j + 1]];
        descartados.push({ ponto: y, motivo: 'PICO', kmEvitados: haversine(x, y) + haversine(y, z) - haversine(x, z) });
        lista = [...lista.slice(0, j), ...lista.slice(j + 1)];
        mudou = true;
        break;
      }
    }
  }
  descartados.sort((x, y) => x.ponto.ts - y.ponto.ts);
  return { pontos: lista, descartados };
}

// ─── Cálculo por equipe e dia ────────────────────────────────────────────────

const diaDe = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const horaDe = (ts: number) => new Date(ts).toISOString().slice(11, 16);

/** Junta os relatórios da mesma equipe e do mesmo dia e calcula cada grupo. */
export function calcular(relatorios: RelatorioKm[]): ResultadoKm[] {
  const grupos = new Map<string, RelatorioKm[]>();
  for (const r of relatorios) {
    const chave = `${r.agente}|${r.placa}|${diaDe(r.inicio)}`;
    const g = grupos.get(chave); if (g) g.push(r); else grupos.set(chave, [r]);
  }
  return [...grupos.entries()].map(([chave, rs]) => calcularGrupo(chave, rs))
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.agente.localeCompare(b.agente));
}

function calcularGrupo(chave: string, rs: RelatorioKm[]): ResultadoKm {
  // Relatórios que se sobrepõem repetem pontos: fica uma cópia de cada (horário + coordenada).
  const unicos = new Map<string, PontoKm>();
  for (const r of rs) for (const p of r.pontos) {
    const k = `${p.ts}|${chaveCoord(p)}`;
    const ja = unicos.get(k);
    if (!ja || (!ja.evento && p.evento)) unicos.set(k, p);
  }
  const brutos = [...unicos.values()].sort((a, b) => a.ts - b.ts);
  const { pontos, descartados } = limpar(brutos);

  const trechos: Trecho[] = pontos.slice(1).map((p, i) => {
    const km = haversine(pontos[i], p);
    return { de: pontos[i], ate: p, km, kmh: kmh(km, pontos[i], p) };
  });

  // km por status do agente: o status vale do evento até o próximo evento.
  const porStatus = new Map<string, number>();
  let status = 'Antes do primeiro status';
  for (const t of trechos) {
    if (t.de.status) status = t.de.status;
    porStatus.set(status, (porStatus.get(status) ?? 0) + t.km);
  }

  const alertas: AlertaKm[] = [];
  const ordenados = [...rs].sort((a, b) => a.pontos[0].ts - b.pontos[0].ts);
  for (const r of ordenados) {
    const primeiro = r.pontos[0].ts;
    if (r.pontos.length >= LIMITE_LINHAS && primeiro - r.inicio > 30 * 60_000) {
      // Só é corte se nenhum outro relatório cobre o começo que faltou.
      const coberto = rs.some(o => o !== r && o.pontos[0].ts <= r.inicio + 30 * 60_000 && o.pontos[o.pontos.length - 1].ts >= primeiro - 30 * 60_000);
      if (!coberto) alertas.push({ tipo: 'CORTADO', texto: `"${r.arquivo}" tem ${r.pontos.length} linhas e começa às ${horaDe(primeiro)}, mas o intervalo pedido começa às ${horaDe(r.inicio)}. O rastreador corta a exportação em ${LIMITE_LINHAS} linhas: emita outro relatório de ${horaDe(r.inicio)} a ${horaDe(primeiro)} e importe junto.` });
    }
  }
  for (let i = 1; i < ordenados.length; i++) {
    const fimAnterior = Math.max(...ordenados.slice(0, i).map(r => r.pontos[r.pontos.length - 1].ts));
    const inicioAtual = ordenados[i].pontos[0].ts;
    if (inicioAtual - fimAnterior > 30 * 60_000)
      alertas.push({ tipo: 'LACUNA', texto: `Sem registros entre ${horaDe(fimAnterior)} e ${horaDe(inicioAtual)}: os relatórios não cobrem esse período. O trecho entre os dois pontos entrou como linha reta.` });
  }
  const rapidos = trechos.filter(t => (t.kmh ?? 0) > VELOCIDADE_IMPOSSIVEL && t.km > 1);
  if (rapidos.length) alertas.push({ tipo: 'SALTO', texto: `${rapidos.length === 1 ? '1 trecho acima' : `${rapidos.length} trechos acima`} de ${VELOCIDADE_IMPOSSIVEL} km/h (${rapidos.map(t => horaDe(t.ate.ts)).join(', ')}) ${rapidos.length === 1 ? 'foi mantido' : 'foram mantidos'}: a rota continua a partir do novo ponto, o que indica atraso do sinal e não erro.` });

  const [agente, placa, dia] = chave.split('|');
  return {
    chave, agente, placa, dia,
    arquivos: ordenados.map(r => r.arquivo),
    pontosLidos: brutos.length,
    pontos, descartados, trechos,
    kmBruto: somar(brutos),
    kmLimpo: somar(pontos),
    kmLinhaReta: pontos.length > 1 ? haversine(pontos[0], pontos[pontos.length - 1]) : 0,
    kmPorStatus: [...porStatus.entries()].map(([s, km]) => ({ status: s, km })).sort((a, b) => b.km - a.km),
    alertas,
  };
}

// ─── Formatação ─────────────────────────────────────────────────────────────

export const formatarKm = (km: number, casas = 1) =>
  km.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const formatarDia = (dia: string) => dia.split('-').reverse().join('/');

/** "13:00" a partir do horário do ponto. */
export const formatarHora = (ts: number) => horaDe(ts);

export const NOME_MOTIVO: Record<MotivoDescarte, string> = {
  REPETIDO: 'Posição presa no rastreador',
  PICO: 'Vai e volta impossível',
};

/** Linhas da planilha de auditoria: todos os pontos lidos, com o que entrou e o que foi descartado. */
export function linhasAuditoria(r: ResultadoKm) {
  const descartes = new Map(r.descartados.map(d => [d.ponto, d]));
  const todos = [...r.pontos, ...r.descartados.map(d => d.ponto)].sort((a, b) => a.ts - b.ts);
  let anterior: PontoKm | null = null, acumulado = 0;
  return todos.map(p => {
    const d = descartes.get(p);
    let trecho: number | null = null;
    if (!d) {
      trecho = anterior ? haversine(anterior, p) : 0;
      acumulado += trecho; anterior = p;
    }
    return {
      'Data e hora': `${p.hora.slice(0, 5)}/${r.dia.slice(0, 4)} ${p.hora.slice(6)}`,
      'Evento': p.evento, 'Status': p.status, 'Velocidade (km/h)': p.vel,
      'Latitude': p.lat, 'Longitude': p.lon,
      'Considerado': d ? 'NÃO' : 'SIM',
      'Motivo do descarte': d ? NOME_MOTIVO[d.motivo] : '',
      'km evitados': d ? +d.kmEvitados.toFixed(3) : '',
      'km do trecho': trecho == null ? '' : +trecho.toFixed(3),
      'km acumulado': d ? '' : +acumulado.toFixed(3),
      'Arquivo': p.arquivo,
    };
  });
}
