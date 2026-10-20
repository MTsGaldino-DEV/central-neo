
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, abrirNoTraceOne } from "@/lib/navegacao";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Table2,
  ArrowRight,
  RefreshCw,
  Trash2,
  ArrowLeftRight,
  GitCompare,
  ChevronDown,
  ChevronRight,
  Link2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  importServicos,
  importServicosForcado,
  getProfile,
  getMedidoresParaSync,
  syncAtribuicoes,
  getColaboradores,
  getMedidoresParaPC,
  importarPlanilhaPC,
  getTiposMedidores,
  importarPlanilhaLucas,
} from "@/lib/api";
import type { MedidorParaSync, MedidorParaPC, ResultadoPC, MatriculaNaoCadastrada, ResultadoLucas } from "@/lib/api";
import { parsePlanilhaLucas, montarPlanoLucas, novoDeLinha } from "@/lib/planilhaLucas";
import type { ParseLucasResult, PlanoLucas, ItemLucas, ItemRevisao } from "@/lib/planilhaLucas";
import type { Colaborador, Role, TipoMedidor } from "@/lib/supabase";
import { canForcarImportacao } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════════
// SEÇÃO GDIS — tipos e lógica
// ═══════════════════════════════════════════════════════════════════

interface ParsedServico {
  servico: string;
  matricula?: string;
  nome?: string;
  termino: string;
  cod_serv?: string;
  tipo_serv?: string;
}

interface ParseResult {
  rows: ParsedServico[];
  errors: string[];
}

const COL_ALIASES: Record<string, string> = {
  servico: "servico", "serviço": "servico", "servico gdis": "servico",
  "nº serviço": "servico", "numero servico": "servico", "n servico": "servico",
  matricula: "matricula", "matrícula": "matricula",
  nome: "nome",
  termino: "termino", "término": "termino", "data conclusao": "termino",
  "data conclusão": "termino", conclusao: "termino", "conclusão": "termino",
  "cod serv": "cod_serv", cod_serv: "cod_serv", "codigo servico": "cod_serv",
  "código serviço": "cod_serv",
  "tipo serv": "tipo_serv", tipo_serv: "tipo_serv", "tipo servico": "tipo_serv",
  "tipo serviço": "tipo_serv",
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 _]/g, "").trim();
}

function parseDateGdis(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 864e5));
    if (isNaN(d.getTime())) return null;
    const ano = d.getUTCFullYear();
    if (ano < 1990 || ano > 2100) return null;
    return d.toISOString();
  }
  const str = String(raw).trim();
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T00:00:00Z`;
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${str.slice(0, 10)}T00:00:00Z`;
  const t = new Date(str);
  if (!isNaN(t.getTime())) return t.toISOString();
  return null;
}

function parseGdisWorkbook(buffer: ArrayBuffer): ParseResult {
  // raw: sem isso o SheetJS le "12/08/2026" de um CSV como MM/DD (12 de agosto
  // vira 8 de dezembro). Mantem o valor original e deixa o parse com a gente.
  const wb = XLSX.read(buffer, { type: "array", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const errors: string[] = [];
  const rows: ParsedServico[] = [];

  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    const normalized = row.map((cell) => (cell ? normalizeHeader(String(cell)) : ""));
    if (normalized.some((h) => COL_ALIASES[h] === "servico")) {
      headerIdx = i;
      headers = normalized;
      break;
    }
  }

  if (headerIdx === -1) {
    return { rows: [], errors: ["Não foi possível encontrar a coluna 'Serviço' nas primeiras 30 linhas."] };
  }

  const colMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    const mapped = COL_ALIASES[h];
    if (mapped && !(mapped in colMap)) colMap[mapped] = idx;
  });

  if (!("servico" in colMap)) return { rows: [], errors: ["Coluna 'Serviço' não encontrada."] };
  if (!("termino" in colMap)) return { rows: [], errors: ["Coluna de data de término não encontrada."] };

  for (let i = headerIdx + 1; i < data.length; i++) {
    const rowData = data[i] as unknown[];
    if (!Array.isArray(rowData) || rowData.length === 0) continue;
    const rawServico = rowData[colMap["servico"]];
    if (!rawServico) continue;
    const servico = String(rawServico).trim();
    if (!servico) continue;
    const termino = parseDateGdis(rowData[colMap["termino"]]);
    if (!termino) {
      errors.push(`Linha ${i + 1}: data de término inválida — ignorada.`);
      continue;
    }
    const mat = colMap["matricula"] !== undefined ? rowData[colMap["matricula"]] : undefined;
    const nome = colMap["nome"] !== undefined ? rowData[colMap["nome"]] : undefined;
    const cod = colMap["cod_serv"] !== undefined ? rowData[colMap["cod_serv"]] : undefined;
    const tipo = colMap["tipo_serv"] !== undefined ? rowData[colMap["tipo_serv"]] : undefined;
    rows.push({
      servico,
      matricula: mat ? String(mat).trim() : undefined,
      nome: nome ? String(nome).trim() : undefined,
      termino,
      cod_serv: cod ? String(cod).trim() : undefined,
      tipo_serv: tipo ? String(tipo).trim() : undefined,
    });
  }
  return { rows, errors };
}

// ═══════════════════════════════════════════════════════════════════
// SEÇÃO ATRIBUIÇÕES — tipos e lógica
// ═══════════════════════════════════════════════════════════════════

interface AtribItem {
  id: string;
  serial: string;
  detail: string;
  patch?: { matricula?: string; material_sap?: string; data?: string };
}

interface SyncReport {
  devolvidos: AtribItem[];    // delete
  reatribuicoes: AtribItem[]; // matricula mudou
  divergencias: AtribItem[];  // material/data diverge
  invalidas: AtribItem[];     // matrícula não existe no sistema
}

/**
 * Data de atribuicao do SAP. Aceita DD/MM/AAAA (como vem no CSV) e o serial de
 * data do Excel (como vem num .xlsx de verdade). Nunca interpreta MM/DD: no
 * CSV o dia vem primeiro, e tratar 12/08 como dezembro joga a data no futuro.
 */
function parseDateAtrib(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    if (!dataExcelPlausivel(raw)) return null;
    return new Date(Math.round((raw - 25569) * 864e5)).toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (ymd) return s.slice(0, 10);
  return null;
}

function buildSyncReport(
  planilhaRows: { serial: string; material: string; matricula: string | null; data: string | null }[],
  dbMap: Map<string, MedidorParaSync>,
  colabMap: Set<string> // matrículas válidas
): SyncReport {
  const devolvidos: AtribItem[] = [];
  const reatribuicoes: AtribItem[] = [];
  const divergencias: AtribItem[] = [];
  const invalidas: AtribItem[] = [];

  for (const row of planilhaRows) {
    const db = dbMap.get(row.serial);
    if (!db) continue; // não é nosso cadastro

    if (!row.matricula) {
      devolvidos.push({ id: db.id, serial: row.serial, detail: `Recebedor vazio — será excluído` });
      continue;
    }

    if (!colabMap.has(row.matricula)) {
      invalidas.push({ id: db.id, serial: row.serial, detail: `Matrícula "${row.matricula}" não existe no sistema` });
      continue;
    }

    const patch: { matricula?: string; material_sap?: string; data?: string } = {};
    let reatrib = false;
    let diverg = false;

    if (row.matricula !== db.matricula) {
      patch.matricula = row.matricula;
      reatrib = true;
    }
    if (row.material && row.material !== db.material_sap) {
      patch.material_sap = row.material;
      diverg = true;
    }
    if (row.data && row.data !== db.data) {
      patch.data = row.data;
      diverg = true;
    }

    if (reatrib) {
      reatribuicoes.push({
        id: db.id, serial: row.serial, patch,
        detail: `${db.matricula} → ${row.matricula}`,
      });
    }
    if (diverg) {
      const parts: string[] = [];
      if (patch.material_sap) parts.push(`Material: ${db.material_sap} → ${patch.material_sap}`);
      if (patch.data) parts.push(`Data: ${db.data} → ${patch.data}`);
      divergencias.push({
        id: db.id, serial: row.serial, patch,
        detail: parts.join(" | "),
      });
    }
  }

  return { devolvidos, reatribuicoes, divergencias, invalidas };
}

// ═══════════════════════════════════════════════════════════════════
// SEÇÃO PLANILHAS DE VINCULAÇÃO (PC e TC) — tipos e lógica
//
// As duas planilhas dizem a mesma coisa — em qual serviço cada
// equipamento foi mexido — e só diferem no nome da coluna do serial e
// no texto de ajuda. A lógica e a tela são compartilhadas.
// ═══════════════════════════════════════════════════════════════════

const ALIASES_COMUNS: Record<string, string> = {
  numserv: "servico", "num serv": "servico", "numero servico": "servico",
  datafim: "data_fim", "data fim": "data_fim", data_fim: "data_fim",
  tipo_serv: "tipo_serv", "tipo serv": "tipo_serv", tiposerv: "tipo_serv",
};

const PC_ALIASES: Record<string, string> = {
  ...ALIASES_COMUNS,
  medidor_instalado: "serial", "medidor instalado": "serial",
};

const TC_ALIASES: Record<string, string> = {
  ...ALIASES_COMUNS,
  // O export vem como num_equipamento; "serial" fica aceito porque algumas
  // planilhas circulam com a coluna já renomeada.
  num_equipamento: "serial", "num equipamento": "serial",
  numequipamento: "serial", "numero equipamento": "serial",
  num_equip: "serial", serial: "serial",
};

/** Uma instalação declarada pela planilha. */
interface LinhaPC {
  servico: string;
  serial: string;
  dataFim: string;   // YYYY-MM-DD
  tipoServ: string;
}

/** Serial de data do Excel (dias desde 1899-12-30) plausível: anos entre 1990 e 2100. */
function dataExcelPlausivel(raw: number): boolean {
  const d = new Date(Math.round((raw - 25569) * 864e5));
  if (isNaN(d.getTime())) return false;
  const ano = d.getUTCFullYear();
  return ano >= 1990 && ano <= 2100;
}

/** Converte DD/MM/AAAA [HH:MM] ou serial de data do Excel em YYYY-MM-DD. */
function parseDataPC(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    if (!dataExcelPlausivel(raw)) return null;
    const d = new Date(Math.round((raw - 25569) * 864e5));
    return d.toISOString().slice(0, 10);
  }
  const str = String(raw).trim();
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return str.slice(0, 10);
  return null;
}

interface ParsePCResult {
  linhas: LinhaPC[];
  totalLinhas: number;
  semMedidor: number;
  semData: number;
  erro?: string;
}

function parsePCWorkbook(
  buffer: ArrayBuffer,
  aliases: Record<string, string>,
  colunaSerial: string
): ParsePCResult {
  // codepage 1252: o CSV exportado vem em Latin-1, não UTF-8
  const wb = XLSX.read(buffer, { type: "array", codepage: 1252, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  let headerIdx = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    const map: Record<string, number> = {};
    row.forEach((cell, idx) => {
      const mapped = aliases[normalizeHeader(String(cell ?? ""))];
      if (mapped && !(mapped in map)) map[mapped] = idx;
    });
    if ("serial" in map && "servico" in map) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      linhas: [], totalLinhas: 0, semMedidor: 0, semData: 0,
      erro: `Não encontrei as colunas 'NumServ' e '${colunaSerial}'. Confirme que é a planilha certa.`,
    };
  }
  if (!("data_fim" in colMap)) {
    return {
      linhas: [], totalLinhas: 0, semMedidor: 0, semData: 0,
      erro: "Coluna 'DataFim' não encontrada na planilha.",
    };
  }

  const linhas: LinhaPC[] = [];
  let totalLinhas = 0;
  let semMedidor = 0;
  let semData = 0;

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    if (!Array.isArray(row) || row.length === 0) continue;
    totalLinhas++;

    const serial = String(row[colMap["serial"]] ?? "").trim().toUpperCase();
    if (!serial) { semMedidor++; continue; }

    const servico = String(row[colMap["servico"]] ?? "").trim();
    if (!servico) continue;

    const rawDataFim = row[colMap["data_fim"]];
    if (typeof rawDataFim === "number" && !dataExcelPlausivel(rawDataFim)) {
      return {
        linhas: [], totalLinhas: 0, semMedidor: 0, semData: 0,
        erro: `A coluna 'DataFim' parece errada: a linha ${i + 1} tem o valor "${rawDataFim}", que não corresponde a uma data válida. Confira se a planilha tem a coluna DataFim na posição certa.`,
      };
    }

    const dataFim = parseDataPC(rawDataFim);
    if (!dataFim) { semData++; continue; }

    const tipoServ = colMap["tipo_serv"] !== undefined
      ? String(row[colMap["tipo_serv"]] ?? "").trim()
      : "";

    linhas.push({ servico, serial, dataFim, tipoServ });
  }

  return { linhas, totalLinhas, semMedidor, semData };
}

interface ItemPlano {
  medidor_id: string;
  serial: string;
  servico: string;
  dataFim: string;
  tipoServ: string;
  matricula: string;
  detail: string;
}

interface PlanoPC {
  novos: ItemPlano[];            // medidor pendente → vira concluído
  atualizados: ItemPlano[];      // já concluído, mas serviço/data mudam
  inalterados: number;           // já bate com a planilha
  anterioresAtribuicao: number;  // última instalação é anterior à atribuição
  foraDoCadastro: number;        // seriais da planilha que não são nossos
}

/**
 * Cruza a planilha com o banco. Quando o serial aparece em vários serviços,
 * vale a instalação de DataFim mais recente — é onde o medidor está agora.
 */
function montarPlanoPC(linhas: LinhaPC[], medidores: MedidorParaPC[]): PlanoPC {
  const porSerial = new Map<string, LinhaPC[]>();
  for (const l of linhas) {
    const lista = porSerial.get(l.serial);
    if (lista) lista.push(l);
    else porSerial.set(l.serial, [l]);
  }
  for (const lista of porSerial.values()) lista.sort((a, b) => a.dataFim.localeCompare(b.dataFim));

  const plano: PlanoPC = {
    novos: [], atualizados: [], inalterados: 0, anterioresAtribuicao: 0, foraDoCadastro: 0,
  };

  const seriaisUsados = new Set<string>();

  for (const m of medidores) {
    const candidatos = porSerial.get(m.serial.toUpperCase());
    if (!candidatos) continue;
    seriaisUsados.add(m.serial.toUpperCase());

    // lista ordenada por data: a última é a instalação mais recente
    const escolhido = candidatos[candidatos.length - 1];
    if (escolhido.dataFim < m.data) plano.anterioresAtribuicao++;

    const base = {
      medidor_id: m.id,
      serial: m.serial,
      matricula: m.matricula,
    };

    const item: ItemPlano = {
      ...base,
      servico: escolhido.servico,
      dataFim: escolhido.dataFim,
      tipoServ: escolhido.tipoServ,
      detail: "",
    };

    const jaBate =
      m.status === "CONCLUIDO" &&
      m.servico_gdis === escolhido.servico &&
      m.data_conclusao === escolhido.dataFim;

    if (jaBate) {
      plano.inalterados++;
    } else if (m.status === "PENDENTE") {
      item.detail = `Serviço ${escolhido.servico} · instalado em ${formatBR(escolhido.dataFim)}`;
      plano.novos.push(item);
    } else {
      const partes: string[] = [];
      if (m.servico_gdis !== escolhido.servico) {
        partes.push(`Serviço: ${m.servico_gdis ?? "—"} → ${escolhido.servico}`);
      }
      if (m.data_conclusao !== escolhido.dataFim) {
        partes.push(`Data: ${m.data_conclusao ? formatBR(m.data_conclusao) : "—"} → ${formatBR(escolhido.dataFim)}`);
      }
      item.detail = partes.join(" | ");
      plano.atualizados.push(item);
    }
  }

  for (const serial of porSerial.keys()) {
    if (!seriaisUsados.has(serial)) plano.foraDoCadastro++;
  }

  return plano;
}

function formatBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

function CollapsibleList({
  title, count, color, items,
}: {
  title: string; count: number; color: string; items: { serial: string; detail: string }[];
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <div className={`rounded-xl border overflow-hidden ${color}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold">{title} <span className="font-black">({count})</span></span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="border-t border-current/10 max-h-48 overflow-y-auto divide-y divide-current/10">
          {items.map((item) => (
            <div key={item.serial} className="px-4 py-2 text-xs flex gap-3">
              <span className="font-codigo font-semibold shrink-0">{item.serial}</span>
              <span className="opacity-70 truncate">{item.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ABA GDIS
// ═══════════════════════════════════════════════════════════════════

function GdisTab() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);
  const [matriculasFaltantes, setMatriculasFaltantes] = useState<MatriculaNaoCadastrada[]>([]);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    getProfile().then((p) => setRole(p?.role ?? null)).catch(() => setRole(null));
  }, []);

  const processFile = useCallback((f: File) => {
    setFile(f); setParsed(null); setImportError(null); setImportSuccess(null);
    setMatriculasFaltantes([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseGdisWorkbook(e.target?.result as ArrayBuffer);
        setParsed(result);
      } catch {
        setParsed({ rows: [], errors: ["Falha ao ler o arquivo."] });
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const reset = () => {
    setFile(null); setParsed(null); setImportError(null); setImportSuccess(null);
    setMatriculasFaltantes([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setImporting(true); setImportError(null); setMatriculasFaltantes([]);
    try {
      const result = await importServicos(parsed.rows);
      if (!result.ok) {
        // nada foi importado: o usuario precisa cadastrar os colaboradores antes
        setMatriculasFaltantes(result.matriculasNaoCadastradas);
        return;
      }
      setImportSuccess(result.imported);
      setTimeout(() => router.push("/traceone/conferencia"), 1500);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erro ao importar.");
    } finally {
      setImporting(false);
    }
  };

  // Importa mesmo com matrícula não cadastrada: esses serviços entram sem
  // colaborador. Só aparece para supervisor pra cima, e a RPC confere de novo.
  const handleForcarImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setImporting(true); setImportError(null);
    try {
      const { imported } = await importServicosForcado(parsed.rows);
      setMatriculasFaltantes([]);
      setImportSuccess(imported);
      setTimeout(() => router.push("/traceone/conferencia"), 1500);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erro ao forçar a importação.");
    } finally {
      setImporting(false);
    }
  };

  const hasRows = (parsed?.rows.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {importSuccess !== null && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold">Importação concluída!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {importSuccess} serviço{importSuccess !== 1 ? "s" : ""} importado{importSuccess !== 1 ? "s" : ""}. Redirecionando…
            </p>
          </div>
        </div>
      )}
      {matriculasFaltantes.length > 0 && (
        <div className="p-5 bg-red-50 border-2 border-red-300 rounded-xl text-red-900">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold">Importação cancelada — nenhum serviço foi importado</p>
              <p className="text-sm text-red-700 mt-1">
                {matriculasFaltantes.length === 1
                  ? "O colaborador abaixo está no relatório, mas ainda não foi cadastrado no sistema:"
                  : `Os ${matriculasFaltantes.length} colaboradores abaixo estão no relatório, mas ainda não foram cadastrados no sistema:`}
              </p>
              <ul className="mt-3 space-y-2">
                {matriculasFaltantes.map((m) => (
                  <li
                    key={m.matricula}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 bg-white border border-red-200 rounded-lg"
                  >
                    <span className="font-codigo font-bold text-sm uppercase">{m.matricula}</span>
                    {m.nome && <span className="text-sm font-semibold">{m.nome}</span>}
                    <span className="text-xs text-red-600">não existe no cadastro</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm font-semibold text-red-800 mt-3">
                O que fazer: cadastre {matriculasFaltantes.length === 1 ? "esse colaborador" : "esses colaboradores"} em
                Colaboradores (no TraceOne) e importe a planilha novamente.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  onClick={() => abrirNoTraceOne("/dashboard/colaboradores")}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg"
                >
                  Cadastrar colaborador
                </button>
                {canForcarImportacao(role) && (
                  <button
                    onClick={handleForcarImport}
                    disabled={importing}
                    title="Importa mesmo assim: esses serviços entram sem colaborador"
                    className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-red-100 text-red-700 border border-red-300 text-sm font-bold rounded-lg disabled:opacity-50"
                  >
                    {importing ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                    Forçar importação
                  </button>
                )}
              </div>
              {canForcarImportacao(role) && (
                <p className="text-xs text-red-600 mt-2">
                  Forçar importa tudo, mas {matriculasFaltantes.length === 1 ? "esse serviço fica" : "esses serviços ficam"} sem
                  colaborador até a matrícula ser cadastrada.
                </p>
              )}
            </div>
            <button onClick={() => setMatriculasFaltantes([])} className="text-red-400 hover:text-red-600"><X size={16} /></button>
          </div>
        </div>
      )}
      {importError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold">Erro na importação</p>
            <p className="text-xs text-red-600 mt-0.5">{importError}</p>
          </div>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${dragging ? "border-sinal bg-sinal-fundo" : "border-slate-300 bg-slate-50 hover:border-sinal-claro hover:bg-sinal-fundo/50"}`}
        >
          <div className="w-14 h-14 rounded-2xl bg-sinal-fundo flex items-center justify-center">
            <UploadCloud size={28} className="text-sinal" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">Arraste o arquivo Excel/CSV aqui ou clique</p>
            <p className="text-xs text-slate-500 mt-1">Suporte: .xlsx, .xls, .csv</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        </div>
      ) : null}

      {!file && (
        <div className="p-4 bg-sinal-fundo border border-sinal-fundo rounded-xl">
          <p className="text-xs font-semibold text-sinal-forte mb-2">Como funciona?</p>
          <ul className="text-xs text-sinal-forte space-y-1">
            <li>• Carregue o relatório exportado do GDIS (Excel ou CSV)</li>
            <li>• O sistema encontra automaticamente a linha de cabeçalho e reconhece as colunas <strong>Serviço</strong>, <strong>Matrícula</strong>, <strong>Término</strong>, <strong>Cód. Serv.</strong> e <strong>Tipo Serv.</strong> (mesmo com nomes ligeiramente diferentes)</li>
            <li>• Cada linha vira um serviço importado, usado depois na conferência de medidores</li>
            <li>• Linhas sem número de serviço ou com data de término inválida são ignoradas e listadas como aviso</li>
          </ul>
        </div>
      )}

      {file && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="w-10 h-10 rounded-xl bg-sinal-fundo flex items-center justify-center shrink-0">
              <FileText size={18} className="text-sinal" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={reset} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
          </div>
          {parsed ? (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-2xl font-black text-emerald-700">{parsed.rows.length}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">Serviços válidos</p>
                </div>
                <div className={`p-3 border rounded-xl text-center ${parsed.errors.length > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-2xl font-black ${parsed.errors.length > 0 ? "text-amber-700" : "text-slate-400"}`}>{parsed.errors.length}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${parsed.errors.length > 0 ? "text-amber-600" : "text-slate-400"}`}>{parsed.errors.length > 0 ? "Avisos" : "Sem erros"}</p>
                </div>
              </div>
              {parsed.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                  {parsed.errors.map((e, i) => (
                    <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />{e}
                    </p>
                  ))}
                </div>
              )}
              {hasRows && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Table2 size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pré-visualização (5 primeiras)</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {["Serviço", "Matrícula", "Término", "Cód.", "Tipo"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="px-3 py-2 font-codigo font-semibold text-slate-800">{row.servico}</td>
                            <td className="px-3 py-2 font-codigo text-slate-600">{row.matricula ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.termino.slice(0, 10)}</td>
                            <td className="px-3 py-2 text-slate-600">{row.cod_serv ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{row.tipo_serv ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.rows.length > 5 && <p className="text-xs text-slate-400 mt-1 text-right">+ {parsed.rows.length - 5} linhas</p>}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={reset} disabled={importing} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50">Cancelar</button>
                <button onClick={handleImport} disabled={!hasRows || importing || importSuccess !== null} className="flex-1 px-4 py-2.5 bg-sinal text-white font-bold text-sm rounded-xl hover:bg-sinal-forte transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
                  {importing ? <><Loader2 size={16} className="animate-spin" />Importando…</> : importSuccess !== null ? <><CheckCircle2 size={16} />Importado!</> : <>Importar {parsed.rows.length} serviço{parsed.rows.length !== 1 ? "s" : ""}<ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Processando arquivo…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ABA ATRIBUIÇÕES
// ═══════════════════════════════════════════════════════════════════

type AtribStage = "idle" | "loading-db" | "ready" | "syncing" | "done" | "error";

function AtribuicoesTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<AtribStage>("idle");
  const [report, setReport] = useState<SyncReport | null>(null);
  const [syncResult, setSyncResult] = useState<{ updated: number; deleted: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const reset = () => {
    setFile(null); setStage("idle"); setReport(null);
    setSyncResult(null); setErrorMsg(null); setProgress("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = useCallback(async (f: File) => {
    setFile(f); setStage("loading-db"); setReport(null); setErrorMsg(null); setSyncResult(null);
    setProgress("Lendo arquivo…");

    let planilhaRows: { serial: string; material: string; matricula: string | null; data: string | null }[];
    try {
      const buffer = await f.arrayBuffer();
      // raw: ver nota em parseGdisWorkbook — evita a leitura MM/DD de datas
      const wb = XLSX.read(buffer, { type: "array", raw: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

      planilhaRows = [];
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i] as unknown[];
        if (!Array.isArray(row) || row.length < 11) continue;
        const serial = row[2] ? String(row[2]).trim() : "";
        if (!serial) continue;
        const material = row[1] ? String(row[1]).trim() : "";
        const recebedor = row[10] ? String(row[10]).trim().toLowerCase() : null;
        planilhaRows.push({
          serial,
          material,
          matricula: recebedor || null,
          data: parseDateAtrib(row[11]),
        });
      }
    } catch (err) {
      setStage("error");
      setErrorMsg("Falha ao ler o arquivo. Verifique se é um Excel/CSV válido.");
      return;
    }

    setProgress("Buscando medidores no banco de dados…");
    let dbRecords: MedidorParaSync[];
    try {
      dbRecords = await getMedidoresParaSync();
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro ao buscar banco.");
      return;
    }

    setProgress("Validando matrículas…");
    let colaboradores: Colaborador[];
    try {
      colaboradores = await getColaboradores();
    } catch (err) {
      setStage("error");
      setErrorMsg("Erro ao buscar colaboradores válidos.");
      return;
    }
    const colabMap = new Set(colaboradores.map((c) => c.matricula));

    const dbMap = new Map<string, MedidorParaSync>(dbRecords.map((r) => [r.serial, r]));
    const rep = buildSyncReport(planilhaRows, dbMap, colabMap);
    setReport(rep);
    setStage("ready");
    setProgress("");
  }, []);

  const handleSync = async () => {
    if (!report) return;
    setStage("syncing");
    setProgress("Executando sincronização…");

    // Merge patches — um registro pode aparecer em reatribuicoes e divergencias
    const patchMap = new Map<string, { id: string; patch: Record<string, string> }>();
    for (const item of [...report.reatribuicoes, ...report.divergencias]) {
      const existing = patchMap.get(item.id);
      if (existing) {
        Object.assign(existing.patch, item.patch ?? {});
      } else {
        patchMap.set(item.id, { id: item.id, patch: { ...(item.patch ?? {}) } });
      }
    }

    const updates = Array.from(patchMap.values()).map(({ id, patch }) => ({ id, patch }));
    const deletes = report.devolvidos.map((d) => d.id);

    try {
      const result = await syncAtribuicoes({ updates, deletes });
      setSyncResult(result);
      setStage("done");
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setProgress("");
    }
  };

  const totalChanges = report ? report.devolvidos.length + new Set([...report.reatribuicoes, ...report.divergencias].map((i) => i.id)).size : 0;
  const hasInvalidas = (report?.invalidas.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {stage === "error" && errorMsg && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold">Erro</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
          <button onClick={reset} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {/* Done banner */}
      {stage === "done" && syncResult && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">Sincronização concluída!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {syncResult.updated} registro{syncResult.updated !== 1 ? "s" : ""} atualizado{syncResult.updated !== 1 ? "s" : ""} · {syncResult.deleted} excluído{syncResult.deleted !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={reset} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold flex items-center gap-1">
            <RefreshCw size={13} /> Nova sync
          </button>
        </div>
      )}

      {/* Drop zone */}
      {stage === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${dragging ? "border-sinal bg-sinal-fundo" : "border-slate-300 bg-slate-50 hover:border-sinal-claro hover:bg-sinal-fundo/50"}`}
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <RefreshCw size={28} className="text-indigo-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">Arraste a planilha de atribuições aqui ou clique</p>
            <p className="text-xs text-slate-500 mt-1">Exportação SAP · Suporte: .xlsx, .xls, .csv</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        </div>
      )}

      {/* How it works */}
      {stage === "idle" && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <p className="text-xs font-semibold text-indigo-900 mb-2">Como funciona?</p>
          <ul className="text-xs text-indigo-800 space-y-1">
            <li>• Carregue a planilha exportada do SAP (formato padrão com 12 colunas)</li>
            <li>• O sistema compara cada medidor com o banco de dados</li>
            <li>• Identifica: mudanças de atribuição, material ou datas</li>
            <li>• Exclui medidores sem recebedor (devolvidos)</li>
          </ul>
        </div>
      )}

      {/* Colunas necessárias */}
      {stage === "idle" && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-700 mb-2">Colunas que a planilha deve ter (nesta ordem, colunas A–L)</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100">
                  {["B", "C", "…", "K", "L"].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-center font-bold text-slate-500 border-r border-slate-200 last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1.5 text-center text-slate-700 border-r border-slate-200 font-medium">Material (SAP)</td>
                  <td className="px-2 py-1.5 text-center text-slate-700 border-r border-slate-200 font-medium">Nº de série do medidor</td>
                  <td className="px-2 py-1.5 text-center text-slate-400 border-r border-slate-200">—</td>
                  <td className="px-2 py-1.5 text-center text-slate-700 border-r border-slate-200 font-medium">Matrícula do recebedor</td>
                  <td className="px-2 py-1.5 text-center text-slate-700 font-medium">Data de atribuição</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">As demais colunas (A, D–J) podem conter outros dados do SAP — não são usadas.</p>
        </div>
      )}

      {/* Loading */}
      {(stage === "loading-db" || stage === "syncing") && (
        <div className="flex flex-col items-center justify-center gap-3 p-12 bg-slate-50 border border-slate-200 rounded-2xl">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
          <p className="text-sm font-semibold text-slate-600">{progress || "Processando…"}</p>
        </div>
      )}

      {/* File header + report */}
      {(stage === "ready" || stage === "done") && file && report && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* File info */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            {stage === "ready" && (
              <button onClick={reset} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                <Trash2 size={16} className="text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-red-700">{report.devolvidos.length}</p>
                <p className="text-xs font-semibold text-red-600 mt-0.5">Devolvidos</p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <ArrowLeftRight size={16} className="text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-amber-700">{report.reatribuicoes.length}</p>
                <p className="text-xs font-semibold text-amber-600 mt-0.5">Reatribuições</p>
              </div>
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-center">
                <GitCompare size={16} className="text-orange-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-orange-700">{report.divergencias.length}</p>
                <p className="text-xs font-semibold text-orange-600 mt-0.5">Divergências</p>
              </div>
            </div>

            {/* Listas colapsáveis */}
            <CollapsibleList
              title="Devolvidos — serão excluídos"
              count={report.devolvidos.length}
              color="bg-red-50 border-red-200 text-red-800"
              items={report.devolvidos}
            />
            <CollapsibleList
              title="Reatribuições — matrícula alterada"
              count={report.reatribuicoes.length}
              color="bg-amber-50 border-amber-200 text-amber-800"
              items={report.reatribuicoes}
            />
            <CollapsibleList
              title="Divergências — material ou data diferente"
              count={report.divergencias.length}
              color="bg-orange-50 border-orange-200 text-orange-800"
              items={report.divergencias}
            />
            {hasInvalidas && (
              <CollapsibleList
                title="Matrículas inválidas — não serão sincronizadas"
                count={report.invalidas.length}
                color="bg-red-50 border-red-200 text-red-800"
                items={report.invalidas}
              />
            )}

            {totalChanges === 0 && !hasInvalidas && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <CheckCircle2 size={20} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-emerald-700">Tudo sincronizado! Nenhuma diferença encontrada.</p>
              </div>
            )}

            {/* Botões */}
            {stage === "ready" && (
              <div className="flex gap-3 pt-1">
                <button onClick={reset} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSync}
                  disabled={totalChanges === 0 || hasInvalidas}
                  className="flex-1 px-4 py-2.5 bg-sinal text-white font-bold text-sm rounded-xl hover:bg-sinal-forte transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                  title={hasInvalidas ? "Corrija as matrículas inválidas antes de sincronizar" : ""}
                >
                  <RefreshCw size={16} />
                  Executar Sincronização ({totalChanges})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ABA DE VINCULAÇÃO (serve a Planilha PC e a Planilha TC)
// ═══════════════════════════════════════════════════════════════════

type PCStage = "idle" | "parsing" | "ready" | "importing" | "done" | "error";

/** O que muda entre uma planilha e outra. */
interface FormatoVinculacao {
  nome: string;
  equipamento: string;                    // "medidor" | "TC"
  equipamentoPlural: string;
  aliases: Record<string, string>;
  colunaSerial: string;                   // nome da coluna do serial na planilha
  dica: string;                           // subtítulo da área de upload
  comoFunciona: React.ReactNode[];
  colunas: { letra: string; nome: string | null }[];
  // Tailwind não aceita classe montada em runtime, então vêm inteiras.
  cor: {
    dropAtivo: string; dropHover: string;
    iconeBg: string; iconeTexto: string; spinner: string;
    ajudaBox: string; ajudaTitulo: string; ajudaTexto: string;
  };
}

const CORES_PC = {
  dropAtivo: "border-violet-500 bg-violet-50",
  dropHover: "border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50",
  iconeBg: "bg-violet-100", iconeTexto: "text-violet-600", spinner: "text-violet-500",
  ajudaBox: "bg-violet-50 border-violet-200", ajudaTitulo: "text-violet-900", ajudaTexto: "text-violet-800",
};

const CORES_TC = {
  dropAtivo: "border-teal-500 bg-teal-50",
  dropHover: "border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/50",
  iconeBg: "bg-teal-100", iconeTexto: "text-teal-600", spinner: "text-teal-500",
  ajudaBox: "bg-teal-50 border-teal-200", ajudaTitulo: "text-teal-900", ajudaTexto: "text-teal-800",
};

const FORMATO_PC: FormatoVinculacao = {
  nome: "Planilha PC",
  equipamento: "medidor",
  equipamentoPlural: "medidores",
  aliases: PC_ALIASES,
  colunaSerial: "Medidor_Instalado",
  dica: "Suporte: .xlsx, .xls, .csv · aceita arquivos grandes (70 mil+ linhas)",
  cor: CORES_PC,
  comoFunciona: [
    "A Planilha PC mostra exatamente em qual serviço cada medidor foi instalado",
    <>O sistema lê a coluna <strong>Medidor_Instalado</strong> e cruza com os seriais do nosso cadastro</>,
    <>Onde encontra, vincula o <strong>NumServ</strong> como serviço e grava a <strong>DataFim</strong> como data de instalação, fechando o medidor como concluído</>,
    "Se o serviço ainda não existir no sistema, ele é criado a partir da própria planilha — é ela que comprova que o serviço aconteceu",
    <>Quando um serial aparece em vários serviços, vale a instalação de <strong>DataFim mais recente</strong> — é onde o medidor está atualmente</>,
  ],
  colunas: [
    { letra: "A", nome: "NumServ" }, { letra: "B", nome: "tipo_serv" }, { letra: "…", nome: null },
    { letra: "G", nome: "DataFim" }, { letra: "…", nome: null }, { letra: "I", nome: "Medidor_Instalado" },
  ],
};

const FORMATO_TC: FormatoVinculacao = {
  nome: "Planilha TC",
  equipamento: "TC",
  equipamentoPlural: "TCs",
  aliases: TC_ALIASES,
  colunaSerial: "num_equipamento",
  dica: "Suporte: .xlsx, .xls, .csv",
  cor: CORES_TC,
  comoFunciona: [
    "A Planilha TC mostra em qual serviço cada transformador de corrente foi utilizado",
    <>O sistema lê a coluna <strong>num_equipamento</strong> (ou <strong>serial</strong>, se a planilha vier renomeada) e cruza com os seriais do nosso cadastro</>,
    <>Onde encontra, vincula o <strong>NumServ</strong> como serviço e grava a <strong>DataFim</strong> como data, fechando o TC como concluído</>,
    <>Entram as linhas de instalação e de remoção — a coluna <strong>cod_acao</strong> não filtra nada aqui</>,
    "Como TC é trifásico, o mesmo serviço costuma cobrir 2 a 6 seriais — todos recebem o mesmo número de serviço",
  ],
  colunas: [
    { letra: "A", nome: "NumServ" }, { letra: "B", nome: "tipo_serv" }, { letra: "…", nome: null },
    { letra: "G", nome: "DataFim" }, { letra: "…", nome: null }, { letra: "I", nome: "num_equipamento" },
  ],
};

function PlanilhaVinculacaoTab({ formato }: { formato: FormatoVinculacao }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<PCStage>("idle");
  const [parseInfo, setParseInfo] = useState<ParsePCResult | null>(null);
  const [plano, setPlano] = useState<PlanoPC | null>(null);
  const [resultado, setResultado] = useState<ResultadoPC | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const reset = () => {
    setFile(null); setStage("idle"); setParseInfo(null); setPlano(null);
    setResultado(null); setErrorMsg(null); setProgress("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = useCallback(async (f: File) => {
    setFile(f); setStage("parsing"); setPlano(null); setErrorMsg(null); setResultado(null);
    setProgress("Lendo a planilha… (arquivos grandes levam alguns segundos)");

    let info: ParsePCResult;
    try {
      const buffer = await f.arrayBuffer();
      info = parsePCWorkbook(buffer, formato.aliases, formato.colunaSerial);
    } catch {
      setStage("error");
      setErrorMsg("Falha ao ler o arquivo. Verifique se é um Excel/CSV válido.");
      return;
    }
    setParseInfo(info);
    if (info.erro) {
      setStage("error");
      setErrorMsg(info.erro);
      return;
    }

    setProgress("Buscando equipamentos no banco de dados…");
    let medidores: MedidorParaPC[];
    try {
      medidores = await getMedidoresParaPC();
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro ao buscar equipamentos.");
      return;
    }

    setProgress("Cruzando os seriais…");
    setPlano(montarPlanoPC(info.linhas, medidores));
    setStage("ready");
    setProgress("");
  }, [formato]);

  const aAplicar = plano ? [...plano.novos, ...plano.atualizados] : [];

  const handleImport = async () => {
    if (aAplicar.length === 0) return;
    setStage("importing");
    setProgress(`Aplicando 0 de ${aAplicar.length}…`);
    try {
      const res = await importarPlanilhaPC(
        aAplicar.map((i) => ({
          medidor_id: i.medidor_id,
          serial: i.serial,
          servico: i.servico,
          data_fim: i.dataFim,
          tipo_serv: i.tipoServ,
          matricula: i.matricula,
        })),
        (feitos, total) => setProgress(`Aplicando ${feitos} de ${total}…`)
      );
      setResultado(res);
      setStage("done");
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro ao importar.");
    } finally {
      setProgress("");
    }
  };

  return (
    <div className="space-y-6">
      {stage === "error" && errorMsg && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold">Erro</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
          <button onClick={reset} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {stage === "done" && resultado && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">Importação concluída!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {resultado.medidores_atualizados}{" "}
              {resultado.medidores_atualizados !== 1 ? formato.equipamentoPlural : formato.equipamento} vinculado
              {resultado.medidores_atualizados !== 1 ? "s" : ""} · {resultado.servicos_criados} serviço
              {resultado.servicos_criados !== 1 ? "s" : ""} criado{resultado.servicos_criados !== 1 ? "s" : ""} · {resultado.servicos_conferidos} conferido
              {resultado.servicos_conferidos !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={reset} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold flex items-center gap-1">
            <RefreshCw size={13} /> Nova importação
          </button>
        </div>
      )}

      {stage === "idle" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${dragging ? formato.cor.dropAtivo : formato.cor.dropHover}`}
          >
            <div className={`w-14 h-14 rounded-2xl ${formato.cor.iconeBg} flex items-center justify-center`}>
              <Link2 size={28} className={formato.cor.iconeTexto} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">Arraste a {formato.nome} aqui ou clique</p>
              <p className="text-xs text-slate-500 mt-1">{formato.dica}</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          </div>

          <div className={`p-4 border rounded-xl ${formato.cor.ajudaBox}`}>
            <p className={`text-xs font-semibold mb-2 ${formato.cor.ajudaTitulo}`}>Como funciona?</p>
            <ul className={`text-xs space-y-1 ${formato.cor.ajudaTexto}`}>
              {formato.comoFunciona.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-semibold text-slate-700 mb-2">Colunas que a planilha deve ter</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    {formato.colunas.map((c, i) => (
                      <th key={i} className="px-2 py-1.5 text-center font-bold text-slate-500 border-r border-slate-200 last:border-r-0">{c.letra}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {formato.colunas.map((c, i) => (
                      <td
                        key={i}
                        className={`px-2 py-1.5 text-center border-r border-slate-200 last:border-r-0 ${c.nome ? "text-slate-700 font-medium" : "text-slate-400"}`}
                      >
                        {c.nome ?? "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">As colunas são localizadas pelo nome no cabeçalho — a ordem pode variar. As demais são ignoradas.</p>
          </div>
        </>
      )}

      {(stage === "parsing" || stage === "importing") && (
        <div className="flex flex-col items-center justify-center gap-3 p-12 bg-slate-50 border border-slate-200 rounded-2xl">
          <Loader2 size={32} className={`animate-spin ${formato.cor.spinner}`} />
          <p className="text-sm font-semibold text-slate-600">{progress || "Processando…"}</p>
        </div>
      )}

      {(stage === "ready" || stage === "done") && file && plano && parseInfo && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
            <div className={`w-10 h-10 rounded-xl ${formato.cor.iconeBg} flex items-center justify-center shrink-0`}>
              <FileText size={18} className={formato.cor.iconeTexto} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(0)} KB · {parseInfo.linhas.length.toLocaleString("pt-BR")} linhas lidas
              </p>
            </div>
            {stage === "ready" && (
              <button onClick={reset} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
            )}
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <Link2 size={16} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-emerald-700">{plano.novos.length}</p>
                <p className="text-xs font-semibold text-emerald-600 mt-0.5">Novas vinculações</p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <GitCompare size={16} className="text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-amber-700">{plano.atualizados.length}</p>
                <p className="text-xs font-semibold text-amber-600 mt-0.5">Correções</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <CheckCircle2 size={16} className="text-slate-400 mx-auto mb-1" />
                <p className="text-2xl font-black text-slate-500">{plano.inalterados}</p>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Já corretos</p>
              </div>
            </div>

            <CollapsibleList
              title={`Novas vinculações — ${formato.equipamentoPlural} pendentes que serão concluídos`}
              count={plano.novos.length}
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
              items={plano.novos}
            />
            <CollapsibleList
              title="Correções — serviço ou data serão sobrescritos"
              count={plano.atualizados.length}
              color="bg-amber-50 border-amber-200 text-amber-800"
              items={plano.atualizados}
            />
            {plano.anterioresAtribuicao > 0 && (
              <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <AlertTriangle size={13} className="shrink-0 mt-0.5 text-slate-400" />
                <span className="text-xs text-slate-600">
                  Em {plano.anterioresAtribuicao.toLocaleString("pt-BR")} {formato.equipamentoPlural} a data
                  mais recente da planilha é anterior à data em que o equipamento foi atribuído. Eles estão
                  incluídos — a planilha é a fonte —, mas a divergência pode indicar cadastro desatualizado.
                </span>
              </div>
            )}

            <div className="text-xs text-slate-500 space-y-0.5 px-1">
              <p>{parseInfo.linhas.length.toLocaleString("pt-BR")} linhas na planilha · {plano.foraDoCadastro.toLocaleString("pt-BR")} seriais não são do nosso cadastro (ignorados)</p>
              {parseInfo.semMedidor > 0 && <p>{parseInfo.semMedidor.toLocaleString("pt-BR")} linhas sem {formato.colunaSerial} preenchido</p>}
              {parseInfo.semData > 0 && <p>{parseInfo.semData.toLocaleString("pt-BR")} linhas com DataFim inválida</p>}
            </div>

            {aAplicar.length === 0 && stage === "ready" && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <CheckCircle2 size={20} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-emerald-700">Nada a aplicar — tudo já está vinculado corretamente.</p>
              </div>
            )}

            {stage === "ready" && (
              <div className="flex gap-3 pt-1">
                <button onClick={reset} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={aAplicar.length === 0}
                  className="flex-1 px-4 py-2.5 bg-sinal text-white font-bold text-sm rounded-xl hover:bg-sinal-forte transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  <Link2 size={16} />
                  Vincular {aAplicar.length.toLocaleString("pt-BR")}{" "}
                  {aAplicar.length !== 1 ? formato.equipamentoPlural : formato.equipamento}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ABA PLANILHA LUCAS
// Controle antigo de atribuições: insere os medidores que faltam e troca
// a atribuição genérica de 05/08/2026. No resto, o TraceOne prevalece.
// ═══════════════════════════════════════════════════════════════════

/** Escolha do usuário para um item da revisão. */
interface EscolhaRevisao {
  marcado: boolean;
  trocarMatricula?: boolean;   // MATRICULA: false = só a data
  material?: string;           // MATERIAL: cod_sap escolhido
}

/** Pode ser aplicado com a escolha atual? */
function revisaoAplicavel(item: ItemRevisao, e: EscolhaRevisao | undefined): boolean {
  if (!e?.marcado) return false;
  if (item.tipo === "MATRICULA") return !e.trocarMatricula || item.matriculaPlanilhaValida;
  if (item.tipo === "MATERIAL") return !!e.material;
  return false;
}

/** Converte os itens marcados da revisão em itens para o RPC. */
function itensDaRevisao(revisao: ItemRevisao[], escolhas: Record<string, EscolhaRevisao>): ItemLucas[] {
  const itens: ItemLucas[] = [];
  for (const item of revisao) {
    const e = escolhas[item.serial];
    if (!e || !revisaoAplicavel(item, e)) continue;
    if (item.tipo === "MATERIAL") {
      const n = novoDeLinha(item.linha, e.material!);
      itens.push({
        acao: n.acao, serial: n.serial, data: n.data, material_sap: n.material_sap,
        matricula: n.matricula, status: n.status, data_conclusao: n.data_conclusao,
        servico_gdis: n.servico_gdis, servico_campo: n.servico_campo, equipe: n.equipe,
      });
    } else if (item.tipo === "MATRICULA") {
      itens.push(e.trocarMatricula
        ? { acao: "DATA", medidor_id: item.medidorId, data: item.data, matricula: item.matriculaPlanilha, matricula_atual: item.matriculaTraceone }
        : { acao: "DATA", medidor_id: item.medidorId, data: item.data });
    }
  }
  return itens;
}

/**
 * Lista do que não entra sozinho. Cada linha só é aplicada se marcada; as de
 * matrícula divergente escolhem se trocam a matrícula, as sem material
 * escolhem o material.
 */
function RevisaoLucas({
  itens, escolhas, onChange, tipos, editavel,
}: {
  itens: ItemRevisao[];
  escolhas: Record<string, EscolhaRevisao>;
  onChange: (serial: string, e: EscolhaRevisao) => void;
  tipos: TipoMedidor[];
  editavel: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (itens.length === 0) return null;

  const marcados = itens.filter((i) => revisaoAplicavel(i, escolhas[i.serial])).length;
  // "Marcar todos" só pega o que já pode ser aplicado sem mais escolha
  const marcaveis = itens.filter((i) => i.tipo === "MATRICULA" || (i.tipo === "MATERIAL" && escolhas[i.serial]?.material));
  const todosMarcados = marcaveis.length > 0 && marcaveis.every((i) => escolhas[i.serial]?.marcado);

  return (
    <div className="rounded-xl border overflow-hidden bg-slate-50 border-slate-200 text-slate-700">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold">
          Revisar não aplicados <span className="font-black">({itens.length})</span>
          {marcados > 0 && (
            <span className="ml-2 text-xs font-semibold text-sky-700">
              {marcados} marcado{marcados !== 1 ? "s" : ""} para aplicar
            </span>
          )}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="border-t border-slate-200">
          {editavel && marcaveis.length > 0 && (
            <div className="px-4 py-2 flex items-center justify-between bg-white border-b border-slate-200">
              <span className="text-xs text-slate-500">Nada aqui é aplicado sem você marcar.</span>
              <button
                onClick={() => marcaveis.forEach((i) => onChange(i.serial, { ...escolhas[i.serial], marcado: !todosMarcados }))}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900"
              >
                {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
              </button>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-200">
            {itens.map((item) => {
              const e = escolhas[item.serial] ?? { marcado: false };
              const bloqueado = item.tipo === "BLOQUEADO";
              const semMaterial = item.tipo === "MATERIAL" && !e.material;
              return (
                <div key={item.serial} className={`px-4 py-2.5 text-xs flex gap-3 ${bloqueado ? "opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0 accent-sky-600"
                    checked={e.marcado}
                    disabled={!editavel || bloqueado || semMaterial}
                    title={bloqueado ? "Não dá para aplicar por aqui" : semMaterial ? "Escolha o material primeiro" : undefined}
                    onChange={(ev) => onChange(item.serial, { ...e, marcado: ev.target.checked })}
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex gap-3">
                      <span className="font-codigo font-semibold shrink-0">{item.serial}</span>
                      <span className="opacity-70">{item.detail}</span>
                    </div>
                    {item.tipo === "MATRICULA" && (
                      <select
                        className="w-full max-w-sm px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs disabled:opacity-50"
                        disabled={!editavel}
                        value={e.trocarMatricula ? "matricula" : "data"}
                        onChange={(ev) => onChange(item.serial, { ...e, trocarMatricula: ev.target.value === "matricula", marcado: true })}
                      >
                        <option value="data">Só corrigir a data (mantém {item.matriculaTraceone})</option>
                        <option value="matricula" disabled={!item.matriculaPlanilhaValida}>
                          Data + matrícula da planilha ({item.matriculaPlanilha}
                          {item.matriculaPlanilhaValida ? "" : " — não cadastrada"})
                        </option>
                      </select>
                    )}
                    {item.tipo === "MATERIAL" && (
                      <select
                        className="w-full max-w-sm px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs disabled:opacity-50"
                        disabled={!editavel}
                        value={e.material ?? ""}
                        onChange={(ev) => onChange(item.serial, { ...e, material: ev.target.value || undefined, marcado: !!ev.target.value })}
                      >
                        <option value="">Escolha o material para incluir…</option>
                        {tipos.map((t) => (
                          <option key={t.cod_sap} value={String(t.cod_sap)}>{t.cod_sap} — {t.tipo}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanilhaLucasTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<PCStage>("idle");
  const [parseInfo, setParseInfo] = useState<ParseLucasResult | null>(null);
  const [plano, setPlano] = useState<PlanoLucas | null>(null);
  const [tipos, setTipos] = useState<TipoMedidor[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaRevisao>>({});
  const [resultado, setResultado] = useState<ResultadoLucas | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const reset = () => {
    setFile(null); setStage("idle"); setParseInfo(null); setPlano(null); setEscolhas({});
    setResultado(null); setErrorMsg(null); setProgress("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = useCallback(async (f: File) => {
    setFile(f); setStage("parsing"); setPlano(null); setEscolhas({}); setErrorMsg(null); setResultado(null);
    setProgress("Lendo a planilha… (pode levar uns 20 segundos)");
    // deixa o spinner pintar antes do parse, que trava a thread
    await new Promise((r) => setTimeout(r, 50));

    let info: ParseLucasResult;
    try {
      info = parsePlanilhaLucas(await f.arrayBuffer());
    } catch {
      setStage("error");
      setErrorMsg("Falha ao ler o arquivo. Verifique se é um Excel/CSV válido.");
      return;
    }
    setParseInfo(info);
    if (info.erro) {
      setStage("error");
      setErrorMsg(info.erro);
      return;
    }

    setProgress("Buscando o cadastro no banco de dados…");
    try {
      const [medidores, colaboradores, tipos] = await Promise.all([
        getMedidoresParaSync(),
        getColaboradores(),
        getTiposMedidores(false),
      ]);
      setProgress("Cruzando os seriais…");
      setTipos([...tipos].sort((a, b) => String(a.cod_sap).localeCompare(String(b.cod_sap))));
      setPlano(montarPlanoLucas(
        info.linhas,
        medidores,
        new Set(colaboradores.map((c) => c.matricula.toLowerCase())),
        new Set(tipos.map((t) => String(t.cod_sap))),
      ));
      setStage("ready");
      setProgress("");
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro ao buscar o cadastro.");
    }
  }, []);

  const revisaoAplicar = plano ? itensDaRevisao(plano.revisao, escolhas) : [];
  const totalAplicar = plano ? plano.novos.length + plano.datas.length + revisaoAplicar.length : 0;

  const handleImport = async () => {
    if (!plano || totalAplicar === 0) return;
    setStage("importing");
    setProgress(`Aplicando 0 de ${totalAplicar}…`);
    // novos primeiro: se algo falhar no meio, o que mais importa já entrou
    const itens: ItemLucas[] = [
      ...plano.novos.map((n) => ({
        acao: n.acao, serial: n.serial, data: n.data, material_sap: n.material_sap,
        matricula: n.matricula, status: n.status, data_conclusao: n.data_conclusao,
        servico_gdis: n.servico_gdis, servico_campo: n.servico_campo, equipe: n.equipe,
      })),
      ...revisaoAplicar.filter((i) => i.acao === "NOVO"),
      ...plano.datas.map(({ acao, medidor_id, data }) => ({ acao, medidor_id, data })),
      ...revisaoAplicar.filter((i) => i.acao === "DATA"),
    ];
    try {
      const res = await importarPlanilhaLucas(itens, (feitos, total) =>
        setProgress(`Aplicando ${feitos} de ${total}…`)
      );
      setResultado(res);
      setStage("done");
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro ao importar.");
    } finally {
      setProgress("");
    }
  };

  return (
    <div className="space-y-6">
      {stage === "error" && errorMsg && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold">Erro</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
          <button onClick={reset} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {stage === "done" && resultado && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">Importação concluída!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {resultado.medidores_criados} medidor{resultado.medidores_criados !== 1 ? "es" : ""} incluído
              {resultado.medidores_criados !== 1 ? "s" : ""} · {resultado.datas_corrigidas} data
              {resultado.datas_corrigidas !== 1 ? "s" : ""} corrigida{resultado.datas_corrigidas !== 1 ? "s" : ""} · {resultado.servicos_criados} serviço
              {resultado.servicos_criados !== 1 ? "s" : ""} criado{resultado.servicos_criados !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={reset} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold flex items-center gap-1">
            <RefreshCw size={13} /> Nova importação
          </button>
        </div>
      )}

      {stage === "idle" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${dragging ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/50"}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center">
              <UploadCloud size={28} className="text-sky-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">Arraste a Planilha Lucas aqui ou clique</p>
              <p className="text-xs text-slate-500 mt-1">Suporte: .xlsx, .xls, .csv · lê todas as abas</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          </div>

          <div className="p-4 border rounded-xl bg-sky-50 border-sky-200">
            <p className="text-xs font-semibold mb-2 text-sky-900">Como funciona?</p>
            <ul className="text-xs space-y-1 text-sky-800">
              <li>• A Planilha Lucas é o controle antigo de atribuições. O sistema cruza cada <strong>Serial</strong> com o cadastro</li>
              <li>• Serial que não está no TraceOne é <strong>incluído</strong> com atribuição, matrícula, material, status, conclusão e serviço GDIS da planilha</li>
              <li>• Serial que já está no TraceOne <strong>não é alterado</strong> — o TraceOne prevalece em matrícula, status, conclusão e serviço</li>
              <li>• Única exceção: se a atribuição no TraceOne for <strong>05/08/2026</strong> (data genérica da importação histórica) e a matrícula bater, a data é trocada pela da planilha</li>
              <li>• Reimportar o mesmo arquivo é seguro: nada é duplicado</li>
            </ul>
          </div>
        </>
      )}

      {(stage === "parsing" || stage === "importing") && (
        <div className="flex flex-col items-center justify-center gap-3 p-12 bg-slate-50 border border-slate-200 rounded-2xl">
          <Loader2 size={32} className="animate-spin text-sky-500" />
          <p className="text-sm font-semibold text-slate-600">{progress || "Processando…"}</p>
        </div>
      )}

      {(stage === "ready" || stage === "done") && file && plano && parseInfo && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-sky-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">
                {parseInfo.linhas.length.toLocaleString("pt-BR")} seriais · abas {parseInfo.abasLidas.join(", ")}
              </p>
            </div>
            {stage === "ready" && (
              <button onClick={reset} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
            )}
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <UploadCloud size={16} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-emerald-700">{plano.novos.length.toLocaleString("pt-BR")}</p>
                <p className="text-xs font-semibold text-emerald-600 mt-0.5">Medidores novos</p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <GitCompare size={16} className="text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-amber-700">{plano.datas.length.toLocaleString("pt-BR")}</p>
                <p className="text-xs font-semibold text-amber-600 mt-0.5">Datas corrigidas</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <CheckCircle2 size={16} className="text-slate-400 mx-auto mb-1" />
                <p className="text-2xl font-black text-slate-500">{plano.inalterados.toLocaleString("pt-BR")}</p>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Sem mudança</p>
              </div>
            </div>

            <CollapsibleList
              title="Medidores novos — não estão no TraceOne e serão incluídos"
              count={plano.novos.length}
              color="bg-emerald-50 border-emerald-200 text-emerald-800"
              items={plano.novos}
            />
            <CollapsibleList
              title="Datas corrigidas — atribuição 05/08/2026 trocada pela da planilha"
              count={plano.datas.length}
              color="bg-amber-50 border-amber-200 text-amber-800"
              items={plano.datas}
            />
            <RevisaoLucas
              itens={plano.revisao}
              escolhas={escolhas}
              onChange={(serial, e) => setEscolhas((prev) => ({ ...prev, [serial]: e }))}
              tipos={tipos}
              editavel={stage === "ready"}
            />

            <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <AlertTriangle size={13} className="shrink-0 mt-0.5 text-slate-400" />
              <span className="text-xs text-slate-600">
                Medidores excluídos de propósito (devolvidos, duplicados) não deixam rastro no banco. Se algum
                serial da lista de novos foi excluído por um motivo, ele volta — confira a lista antes de importar.
              </span>
            </div>

            {parseInfo.repetidas > 0 && (
              <p className="text-xs text-slate-500 px-1">
                {parseInfo.repetidas.toLocaleString("pt-BR")} linhas repetiam um serial de outra aba ou linha e foram lidas uma vez só.
              </p>
            )}

            {totalAplicar === 0 && stage === "ready" && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <CheckCircle2 size={20} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-sm font-semibold text-emerald-700">Nada a aplicar — o TraceOne já tem tudo o que a planilha traz.</p>
              </div>
            )}

            {stage === "ready" && (
              <div className="flex gap-3 pt-1">
                <button onClick={reset} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={totalAplicar === 0}
                  className="flex-1 px-4 py-2.5 bg-sinal text-white font-bold text-sm rounded-xl hover:bg-sinal-forte transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  <UploadCloud size={16} />
                  Aplicar {totalAplicar.toLocaleString("pt-BR")} alteraç{totalAplicar !== 1 ? "ões" : "ão"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

type Tab = "gdis" | "atribuicoes" | "pc" | "tc" | "lucas";

export default function ImportacaoPage() {
  const [activeTab, setActiveTab] = useState<Tab>("gdis");

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-tinta">Importar</h2>
        <p className="text-sm text-aco mt-0.5">Importe relatórios GDIS, sincronize a planilha de atribuições SAP, vincule serviços pelas planilhas PC e TC ou recupere atribuições antigas pela Planilha Lucas.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        {([
          ["gdis", "Relatório GDIS"],
          ["atribuicoes", "Atribuições"],
          ["pc", "Planilha PC"],
          ["tc", "Planilha TC"],
          ["lucas", "Planilha Lucas"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === key
                ? "bg-white text-sinal shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "gdis" ? (
        <GdisTab />
      ) : activeTab === "atribuicoes" ? (
        <AtribuicoesTab />
      ) : activeTab === "pc" ? (
        <PlanilhaVinculacaoTab formato={FORMATO_PC} />
      ) : activeTab === "tc" ? (
        <PlanilhaVinculacaoTab formato={FORMATO_TC} />
      ) : (
        <PlanilhaLucasTab />
      )}
    </div>
  );
}
