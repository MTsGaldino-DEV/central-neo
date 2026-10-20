/**
 * lib/planilhaLucas.ts — Leitura e cruzamento da Planilha Lucas
 *
 * A Planilha Lucas é o controle antigo de atribuições (jan–mar/2026). Ela
 * serve para recuperar medidores que nunca entraram no TraceOne e para trocar
 * a data de atribuição genérica (DATA_GENERICA) que a importação histórica
 * gravou. Em todo o resto o TraceOne prevalece: a planilha pode estar
 * desatualizada.
 *
 * Sem dependência de React, para poder ser exercitado fora do navegador.
 */
import * as XLSX from 'xlsx';

/** Data que a importação histórica gravou no lugar da atribuição real. */
export const DATA_GENERICA = '2026-08-05';

export interface LinhaLucas {
  serial: string;
  data: string | null;            // atribuição, YYYY-MM-DD
  materialSap: string;
  matricula: string;              // minúscula, como o banco grava
  status: 'PENDENTE' | 'CONCLUIDO' | null;
  dataConclusao: string | null;
  servicoGdis: string | null;     // só quando é número de serviço
  servicoCampo: string | null;
  equipe: string | null;
  linhaPlanilha: number;          // 1-based, para apontar o erro
  aba: string;
}

export interface ParseLucasResult {
  linhas: LinhaLucas[];
  abasLidas: string[];
  repetidas: number;              // mesmo serial em mais de uma aba/linha
  erro?: string;
}

/** Estado atual de uma linha do cadastro, para cruzar com a planilha. */
export interface MedidorParaLucas {
  id: string;
  serial: string;
  matricula: string;
  data: string;
}

export interface ItemNovoLucas {
  acao: 'NOVO';
  serial: string;
  data: string;
  material_sap: string;
  matricula: string;
  status: 'PENDENTE' | 'CONCLUIDO';
  data_conclusao: string | null;
  servico_gdis: string | null;
  servico_campo: string | null;
  equipe: string | null;
}

export interface ItemDataLucas {
  acao: 'DATA';
  medidor_id: string;
  data: string;
  // Troca de matrícula, só por escolha na revisão. O banco só troca se a
  // linha ainda estiver com matricula_atual.
  matricula?: string;
  matricula_atual?: string;
}

export type ItemLucas = ItemNovoLucas | ItemDataLucas;

interface ItemLista { serial: string; detail: string }

/**
 * Linha que não entra sozinha, mas pode ser aplicada pela revisão:
 *   MATRICULA — atribuição 05/08 com outra matrícula no TraceOne
 *   MATERIAL  — medidor novo sem Material SAP válido; o usuário escolhe um
 *   BLOQUEADO — falta algo que a revisão não resolve (ex.: matrícula não cadastrada)
 */
export type ItemRevisao = ItemLista & (
  | {
      tipo: 'MATRICULA';
      medidorId: string;
      data: string;
      matriculaTraceone: string;
      matriculaPlanilha: string;
      matriculaPlanilhaValida: boolean;
    }
  | { tipo: 'MATERIAL'; linha: LinhaLucas }
  | { tipo: 'BLOQUEADO' }
);

export interface PlanoLucas {
  novos: (ItemNovoLucas & ItemLista)[];
  datas: (ItemDataLucas & ItemLista)[];
  inalterados: number;            // já no TraceOne, nada a mudar
  revisao: ItemRevisao[];         // não entram sem a escolha do usuário
}

const ALIASES: Record<string, string> = {
  data: 'data', 'data atribuicao': 'data', 'data de atribuicao': 'data',
  'material sap': 'material_sap', material: 'material_sap',
  serial: 'serial',
  matricula: 'matricula',
  'servico gdis': 'servico_gdis',
  concluidopendente: 'status', status: 'status',
  'data da conclusao': 'data_conclusao', 'data conclusao': 'data_conclusao',
  'servico campo': 'servico_campo',
  equipe: 'equipe',
};

const OBRIGATORIAS = ['data', 'material_sap', 'serial', 'matricula', 'status'];

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 _]/g, '').replace(/\s+/g, ' ').trim();
}

/** Serial de data do Excel (dias desde 1899-12-30), com hora ou não, plausível entre 1990 e 2100. */
function dataExcel(raw: number): string | null {
  const d = new Date(Math.round((Math.floor(raw) - 25569) * 864e5));
  if (isNaN(d.getTime())) return null;
  const ano = d.getUTCFullYear();
  if (ano < 1990 || ano > 2100) return null;
  return d.toISOString().slice(0, 10);
}

/** DD/MM/AAAA (nunca MM/DD), AAAA-MM-DD ou serial do Excel. "#N/A" e afins viram null. */
function parseData(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return dataExcel(raw);
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function texto(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

function textoOuNull(raw: unknown): string | null {
  const s = texto(raw);
  return s && !s.startsWith('#') ? s : null;
}

function parseStatus(raw: unknown): LinhaLucas['status'] {
  const s = normalizeHeader(texto(raw));
  if (s.startsWith('conc')) return 'CONCLUIDO';
  if (s.startsWith('pend')) return 'PENDENTE';
  return null;
}

/**
 * Lê todas as abas que tenham o cabeçalho da Planilha Lucas e junta por
 * serial. A aba "Janeiro" repete o começo da aba do trimestre, então o mesmo
 * serial aparece duas vezes: vale a primeira ocorrência.
 */
export function parsePlanilhaLucas(buffer: ArrayBuffer | Uint8Array): ParseLucasResult {
  const wb = XLSX.read(buffer, { type: 'array', codepage: 1252, raw: true });
  const porSerial = new Map<string, LinhaLucas>();
  const abasLidas: string[] = [];
  let repetidas = 0;

  for (const nomeAba of wb.SheetNames) {
    // blankrows: false — a aba do trimestre declara ~1 milhão de linhas por
    // formatação, mas só alguns milhares têm conteúdo.
    const data = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], {
      header: 1, raw: true, blankrows: false, defval: null,
    }) as unknown[][];

    let headerIdx = -1;
    let col: Record<string, number> = {};
    for (let i = 0; i < Math.min(data.length, 30); i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      const map: Record<string, number> = {};
      row.forEach((cell, idx) => {
        const campo = ALIASES[normalizeHeader(texto(cell))];
        if (campo && !(campo in map)) map[campo] = idx;
      });
      if (OBRIGATORIAS.every((c) => c in map)) { headerIdx = i; col = map; break; }
    }
    if (headerIdx === -1) continue;
    abasLidas.push(nomeAba);

    const get = (row: unknown[], campo: string) => (campo in col ? row[col[campo]] : null);

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      const serial = texto(get(row, 'serial')).toUpperCase();
      if (!serial) continue;
      if (porSerial.has(serial)) { repetidas++; continue; }

      const status = parseStatus(get(row, 'status'));
      const concluido = status === 'CONCLUIDO';
      const gdis = texto(get(row, 'servico_gdis'));
      const sap = get(row, 'material_sap');

      porSerial.set(serial, {
        serial,
        data: parseData(get(row, 'data')),
        materialSap: typeof sap === 'number' ? String(sap) : texto(sap),
        matricula: texto(get(row, 'matricula')).toLowerCase(),
        status,
        // pendente com serviço ou conclusão seria contraditório: entra limpo
        dataConclusao: concluido ? parseData(get(row, 'data_conclusao')) : null,
        servicoGdis: concluido && /^\d+$/.test(gdis) ? gdis : null,
        servicoCampo: textoOuNull(get(row, 'servico_campo')),
        equipe: textoOuNull(get(row, 'equipe')),
        linhaPlanilha: i + 1,
        aba: nomeAba,
      });
    }
  }

  if (abasLidas.length === 0) {
    return {
      linhas: [], abasLidas, repetidas: 0,
      erro: "Não encontrei as colunas 'Data', 'Material SAP', 'Serial', 'MATRICULA' e 'Concluído/Pendente'. Confirme que é a planilha certa.",
    };
  }
  return { linhas: [...porSerial.values()], abasLidas, repetidas };
}

function formatBR(iso: string): string {
  const [a, m, d] = iso.split('-');
  return d ? `${d}/${m}/${a}` : iso;
}

/**
 * Medidor novo a partir de uma linha da planilha. O material vem à parte
 * porque a revisão pode trocar o da planilha (vazio ou não cadastrado).
 * Pressupõe linha já validada: data e status preenchidos.
 */
export function novoDeLinha(l: LinhaLucas, materialSap: string): ItemNovoLucas & ItemLista {
  const partes = [`${l.matricula} · atribuído em ${formatBR(l.data!)}`];
  if (l.status === 'CONCLUIDO') {
    partes.push(l.dataConclusao ? `concluído em ${formatBR(l.dataConclusao)}` : 'concluído (sem data)');
    if (l.servicoGdis) partes.push(`serviço ${l.servicoGdis}`);
  } else {
    partes.push('pendente');
  }

  return {
    acao: 'NOVO',
    serial: l.serial,
    data: l.data!,
    material_sap: materialSap,
    matricula: l.matricula,
    status: l.status!,
    data_conclusao: l.dataConclusao,
    servico_gdis: l.servicoGdis,
    servico_campo: l.servicoCampo,
    equipe: l.equipe,
    detail: partes.join(' · '),
  };
}

/**
 * Cruza a planilha com o banco. O serial é a chave: se já existe em qualquer
 * linha do cadastro, o medidor não é inserido de novo, e só a data genérica
 * pode ser trocada.
 */
export function montarPlanoLucas(
  linhas: LinhaLucas[],
  medidores: MedidorParaLucas[],
  matriculasValidas: Set<string>,
  materiaisValidos: Set<string>
): PlanoLucas {
  const cadastro = new Map<string, MedidorParaLucas[]>();
  for (const m of medidores) {
    const k = m.serial.trim().toUpperCase();
    const lista = cadastro.get(k);
    if (lista) lista.push(m);
    else cadastro.set(k, [m]);
  }

  const plano: PlanoLucas = { novos: [], datas: [], inalterados: 0, revisao: [] };
  const onde = (l: LinhaLucas) => `aba ${l.aba}, linha ${l.linhaPlanilha}`;
  const bloquear = (l: LinhaLucas, motivo: string) =>
    plano.revisao.push({ tipo: 'BLOQUEADO', serial: l.serial, detail: `${motivo} (${onde(l)})` });

  for (const l of linhas) {
    const existentes = cadastro.get(l.serial);

    if (existentes) {
      const genericas = existentes.filter((m) => m.data === DATA_GENERICA);
      if (genericas.length === 0 || !l.data || l.data === DATA_GENERICA) {
        plano.inalterados++;
        continue;
      }
      // Com várias linhas (reatribuição), só a da mesma matrícula é o
      // mesmo período de posse que a planilha descreve.
      const alvo = genericas.find((m) => m.matricula.toLowerCase() === l.matricula);
      if (!alvo) {
        const outra = genericas[0];
        plano.revisao.push({
          tipo: 'MATRICULA',
          serial: l.serial,
          detail: `Atribuição 05/08/2026 → ${formatBR(l.data)} · TraceOne: ${outra.matricula} · planilha: ${l.matricula} (${onde(l)})`,
          medidorId: outra.id,
          data: l.data,
          matriculaTraceone: outra.matricula.toLowerCase(),
          matriculaPlanilha: l.matricula,
          matriculaPlanilhaValida: matriculasValidas.has(l.matricula),
        });
        continue;
      }
      plano.datas.push({
        acao: 'DATA', medidor_id: alvo.id, data: l.data,
        serial: l.serial, detail: `Atribuição: 05/08/2026 → ${formatBR(l.data)}`,
      });
      continue;
    }

    if (!l.matricula) { bloquear(l, 'Sem matrícula'); continue; }
    if (!matriculasValidas.has(l.matricula)) { bloquear(l, `Matrícula ${l.matricula} não cadastrada — cadastre o colaborador e reimporte`); continue; }
    if (!l.data) { bloquear(l, 'Data de atribuição inválida'); continue; }
    if (!l.status) { bloquear(l, 'Status diferente de Concluído/Pendente'); continue; }

    if (!l.materialSap || !materiaisValidos.has(l.materialSap)) {
      plano.revisao.push({
        tipo: 'MATERIAL',
        serial: l.serial,
        detail: `${l.materialSap ? `Material ${l.materialSap} não cadastrado` : 'Sem Material SAP'} · ${l.matricula} · atribuído em ${formatBR(l.data)} (${onde(l)})`,
        linha: l,
      });
      continue;
    }

    plano.novos.push(novoDeLinha(l, l.materialSap));
  }

  return plano;
}
