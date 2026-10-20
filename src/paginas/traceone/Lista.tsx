
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Plus,
  Trash2,
  ListOrdered,
  Download,
  Package,
  Clock,
  CheckCircle2,
  CircleDollarSign,
  TrendingUp,
  BarChart3,
  Calendar,
  AlertCircle,
  Link2,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getMedidoresCompleto,
  getAllMedidoresCompleto,
  updateMedidor,
  deleteMedidor,
  getColaboradores,
  getMedidorReatribuicaoInfo,
  getMedidoresMetrics,
  getMedidoresAcima45Dias,
  getSupervisores,
  getTiposMedidores,
  getMedidorLogs,
  getProfile,
} from "@/lib/api";
import type { SortConfig, RankingItem, MedidorLog } from "@/lib/api";
import type { MedidorCompleto, Colaborador, TipoMedidor, Profile } from "@/lib/supabase";
import type { ReatribuicaoHistorico, DashboardMetrics } from "@/lib/api";
import { canWrite } from "@/lib/permissions";
import { StatusMedidor } from "@/components/StatusMedidor";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import type { PieData } from "@/components/charts/pie-context";
import { MultiSelectSearch } from "@/components/MultiSelectSearch";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateBR(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── ColabMultiSelect — busca por nome OU matrícula ──────────────────────────

interface ColabMultiSelectProps {
  colabs: Colaborador[];
  selected: string[]; // matriculas selecionadas
  onChange: (matriculas: string[]) => void;
}

function ColabMultiSelect({ colabs, selected, onChange }: ColabMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = search.toLowerCase();
  const filtered = colabs.filter(
    (c) =>
      c.nome.toLowerCase().includes(q) ||
      c.matricula.toLowerCase().includes(q)
  );

  const toggle = (matricula: string) => {
    onChange(
      selected.includes(matricula)
        ? selected.filter((m) => m !== matricula)
        : [...selected, matricula]
    );
  };

  const label =
    selected.length === 0
      ? "Colaborador"
      : selected.length === 1
      ? colabs.find((c) => c.matricula === selected[0])?.nome ?? selected[0]
      : `Colaborador (${selected.length})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-8 px-3 text-xs border border-linha rounded-lg bg-white hover:bg-nevoa text-tinta min-w-[120px] max-w-[220px] truncate"
      >
        <span className="truncate">{label}</span>
        {selected.length > 0 && (
          <X
            size={10}
            className="flex-shrink-0 text-aco-claro hover:text-tinta"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
          />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-linha rounded-lg shadow-lg min-w-[240px] max-h-64 flex flex-col">
          <div className="p-2 border-b border-nevoa">
            <input
              autoFocus
              type="text"
              placeholder="Nome ou matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-linha rounded focus:outline-none focus:ring-1 focus:ring-sinal-claro"
            />
          </div>
          <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
            {filtered.length === 0 ? (
              <p className="text-xs text-aco-claro px-3 py-2">Nenhum resultado</p>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.matricula}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-nevoa cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c.matricula)}
                    onChange={() => toggle(c.matricula)}
                    className="w-3 h-3 accent-sinal flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-tinta truncate">{c.nome}</p>
                    <p className="text-[10px] text-aco-claro">{c.matricula}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  iconColor: string;   // icon stroke/fill color (text-*)
  iconBg: string;      // icon background (bg-*)
  valueColor?: string; // override for value text color
  loading?: boolean;
  action?: React.ReactNode; // slot opcional no canto superior direito
  onClick?: () => void;     // torna o card inteiro clicável (exceto a action)
  active?: boolean;         // destaque visual quando o filtro do card está aplicado
}

function MetricCard({ icon: Icon, label, value, sub, iconColor, iconBg, valueColor, loading, action, onClick, active }: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-[10px] border border-linha p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0" />
          <div className="h-3 bg-slate-100 rounded w-20" />
        </div>
        <div className="h-7 bg-linha rounded w-24 mb-1" />
        <div className="h-3 bg-slate-100 rounded w-28" />
      </div>
    );
  }
  return (
    <div
      onClick={onClick}
      title={onClick ? (active ? "Clique para remover o filtro" : "Clique para filtrar a lista") : undefined}
      className={`bg-white rounded-[10px] border p-4 flex flex-col relative ${
        onClick ? "cursor-pointer hover:border-slate-300 transition-colors" : ""
      } ${active ? "border-red-300 ring-1 ring-red-200" : "border-linha"}`}
    >
      {action && (
        <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={15} className={iconColor} strokeWidth={1.75} />
        </div>
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider leading-tight">
          {label}
        </p>
      </div>
      <p className={`text-[26px] font-semibold tabular-nums leading-none ${valueColor ?? "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Column labels ────────────────────────────────────────────────────────────

const SORTABLE_COLS: { key: string; label: string }[] = [
  { key: "Data", label: "Data Atrib." },
  { key: "Serial", label: "Serial" },
  { key: "COLABORADOR", label: "Colaborador" },
  { key: "SUPERVISOR", label: "Supervisor" },
  { key: "SERVIÇO GDIS", label: "Serviço GDIS" },
  { key: "Concluído/Pendente", label: "Status" },
  { key: "DIAS DE ATRIBUIÇÃO", label: "Dias Atrib." },
  { key: "Data da conclusão", label: "Conclusão" },
];

const ALL_EXPORT_COLS = [
  "Data", "Material SAP", "Serial", "MATRICULA", "COLABORADOR", "SUPERVISOR",
  "SERVIÇO GDIS", "Concluído/Pendente", "VALOR", "EQUIPAMENTO",
  "DIAS DE ATRIBUIÇÃO", "Data da conclusão",
];


const LOG_EVENTO_CONFIG: Record<string, { label: string; bg: string; ring: string; text: string }> = {
  CADASTRADO:        { label: "Cadastrado",        bg: "bg-sinal-claro",    ring: "ring-sinal-claro",    text: "text-sinal-forte" },
  CONCLUIDO:         { label: "Concluído",          bg: "bg-emerald-500", ring: "ring-emerald-300", text: "text-emerald-700" },
  SERVICO_VINCULADO: { label: "Serviço vinculado",  bg: "bg-emerald-400", ring: "ring-emerald-200", text: "text-emerald-600" },
  SERVICO_REMOVIDO:  { label: "Serviço removido",   bg: "bg-slate-400",    ring: "ring-linha",   text: "text-aco" },
  REABERTO:          { label: "Reaberto",            bg: "bg-amber-400",   ring: "ring-amber-200",  text: "text-amber-700" },
  REATRIBUIDO:       { label: "Reatribuído",         bg: "bg-purple-400",  ring: "ring-purple-200", text: "text-purple-700" },
  EDITADO:           { label: "Editado",             bg: "bg-slate-300",    ring: "ring-linha",   text: "text-aco" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function DashboardPage() {
  // Permissões
  const [profile, setProfile] = useState<Profile | null>(null);
  const canEdit = canWrite(profile?.role);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  // Data
  const [rows, setRows] = useState<MedidorCompleto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [exportando45, setExportando45] = useState(false);
  const [filterAcima45, setFilterAcima45] = useState(false);

  // Filter options
  const [supervisorOptions, setSupervisorOptions] = useState<string[]>([]);
  const [matriculaOptions, setMatriculaOptions] = useState<string[]>([]);
  const [allColabs, setAllColabs] = useState<Colaborador[]>([]);
  const [allTipos, setAllTipos] = useState<TipoMedidor[]>([]);

  // Active filters
  const [filterMatriculas, setFilterMatriculas] = useState<string[]>([]);
  const [filterSupervisores, setFilterSupervisores] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterServicoGdis, setFilterServicoGdis] = useState("");
  const [filterSerial, setFilterSerial] = useState("");
  const [atribuicaoInicio, setAtribuicaoInicio] = useState("");
  const [atribuicaoFim, setAtribuicaoFim] = useState("");
  const [conclusaoInicio, setConclusaoInicio] = useState("");
  const [conclusaoFim, setConclusaoFim] = useState("");
  const [filterMaterialSap, setFilterMaterialSap] = useState<string[]>([]);

  // Sort
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [showSortModal, setShowSortModal] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Detail modal
  const [modalRow, setModalRow] = useState<MedidorCompleto | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [editMatricula, setEditMatricula] = useState("");
  const [editData, setEditData] = useState("");
  const [editSerial, setEditSerial] = useState("");
  const [editMaterialSap, setEditMaterialSap] = useState("");
  const [editServicoGdis, setEditServicoGdis] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDataConclusao, setEditDataConclusao] = useState("");
  const [editSupervisor, setEditSupervisor] = useState("");
  const [colabSearch, setColabSearch] = useState("");
  const [colabSuggestions, setColabSuggestions] = useState<Colaborador[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Inline GDIS entry from list
  const [gdisTarget, setGdisTarget] = useState<{ id: string; serial: string } | null>(null);
  const [gdisInput, setGdisInput] = useState("");
  const [gdisSubmitting, setGdisSubmitting] = useState(false);
  const [gdisError, setGdisError] = useState<string | null>(null);

  // Quick delete (row-level confirm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; serial: string } | null>(null);
  const [quickDeleting, setQuickDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reatribuicao, setReatribuicao] = useState<ReatribuicaoHistorico | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [medidorLogs, setMedidorLogs] = useState<MedidorLog[]>([]);

  // ── load filter options once ──────────────────────────────────────────────

  useEffect(() => {
    getSupervisores().then(setSupervisorOptions).catch(() => {});
    getColaboradores().then((colabs) => {
      setAllColabs(colabs);
      const mats = [...new Set(colabs.map((c) => c.matricula))].sort();
      setMatriculaOptions(mats);
    }).catch(() => {});
    getTiposMedidores(false).then(setAllTipos).catch(() => {});
  }, []);

  // Opções do filtro de Material: pesquisáveis por código SAP ou pelo nome do material.
  const materialSapOptions = useMemo(
    () => allTipos.map((t) => ({ value: t.cod_sap, label: `${t.cod_sap} — ${t.tipo}` })),
    [allTipos]
  );

  // ── resolve Colaborador/Supervisor → matriculas ──────────────────────────

  const buildFinalMatriculas = useCallback((): string[] => {
    return [...filterMatriculas];
  }, [filterMatriculas]);

  // ── fetch data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const finalMatriculas = buildFinalMatriculas();
        const { data, total } = await getMedidoresCompleto({
          matriculas: finalMatriculas.length > 0 ? finalMatriculas : undefined,
          supervisores: filterSupervisores.length > 0 ? filterSupervisores : undefined,
          servicoGdis: filterServicoGdis || undefined,
          serial: filterSerial || undefined,
          status: filterStatus.length > 0 ? filterStatus : undefined,
          atribuicaoInicio: atribuicaoInicio || undefined,
          atribuicaoFim: atribuicaoFim || undefined,
          conclusaoInicio: conclusaoInicio || undefined,
          conclusaoFim: conclusaoFim || undefined,
          materialSapCodes: filterMaterialSap.length > 0 ? filterMaterialSap : undefined,
          diasMin: filterAcima45 ? 45 : undefined,
          sorts: sorts.length > 0 ? sorts : undefined,
          page: p,
          pageSize: PAGE_SIZE,
        });
        setRows(data);
        setTotal(total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    },
    [
      buildFinalMatriculas,
      filterSupervisores,
      filterServicoGdis,
      filterSerial,
      filterStatus,
      atribuicaoInicio,
      atribuicaoFim,
      conclusaoInicio,
      conclusaoFim,
      filterMaterialSap,
      filterAcima45,
      sorts,
    ]
  );

  const fetchMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const finalMatriculas = buildFinalMatriculas();
      const m = await getMedidoresMetrics({
        matriculas: finalMatriculas.length > 0 ? finalMatriculas : undefined,
        supervisores: filterSupervisores.length > 0 ? filterSupervisores : undefined,
        servicoGdis: filterServicoGdis || undefined,
        serial: filterSerial || undefined,
        status: filterStatus.length > 0 ? filterStatus : undefined,
        atribuicaoInicio: atribuicaoInicio || undefined,
        atribuicaoFim: atribuicaoFim || undefined,
        conclusaoInicio: conclusaoInicio || undefined,
        conclusaoFim: conclusaoFim || undefined,
        materialSapCodes: filterMaterialSap.length > 0 ? filterMaterialSap : undefined,
        diasMin: filterAcima45 ? 45 : undefined,
      });
      setMetrics(m);
    } catch {
      // silently ignore metric errors
    } finally {
      setLoadingMetrics(false);
    }
  }, [
    buildFinalMatriculas,
    filterSupervisores,
    filterServicoGdis,
    filterSerial,
    filterStatus,
    atribuicaoInicio,
    atribuicaoFim,
    conclusaoInicio,
    conclusaoFim,
    filterMaterialSap,
    filterAcima45,
  ]);

  useEffect(() => {
    setPage(1);
    fetchData(1);
    fetchMetrics();
  }, [fetchData, fetchMetrics]);

  const handleExportar45Dias = async () => {
    setExportando45(true);
    try {
      const finalMatriculas = buildFinalMatriculas();
      const rows = await getMedidoresAcima45Dias({
        matriculas: finalMatriculas.length > 0 ? finalMatriculas : undefined,
        supervisores: filterSupervisores.length > 0 ? filterSupervisores : undefined,
        servicoGdis: filterServicoGdis || undefined,
        serial: filterSerial || undefined,
        atribuicaoInicio: atribuicaoInicio || undefined,
        atribuicaoFim: atribuicaoFim || undefined,
        conclusaoInicio: conclusaoInicio || undefined,
        conclusaoFim: conclusaoFim || undefined,
        materialSapCodes: filterMaterialSap.length > 0 ? filterMaterialSap : undefined,
      });

      if (rows.length === 0) {
        alert("Nenhum medidor pendente há mais de 45 dias.");
        return;
      }

      const planilha = rows.map((r) => ({
        "Matrícula": r.matricula,
        "Colaborador": r.colaborador,
        "Serviço GDIS": r.servicoGdis ?? "",
        "Serial": r.serial,
        "Valor": r.valor,
        "Dias Pendente": r.dias,
        "Data Atribuição": r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "",
      }));

      const ws = XLSX.utils.json_to_sheet(planilha);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pendentes +45 dias");
      XLSX.writeFile(wb, `pendentes_45dias_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      alert("Erro ao exportar: " + (e instanceof Error ? e.message : "desconhecido"));
    } finally {
      setExportando45(false);
    }
  };

  const goToPage = (p: number) => {
    setPage(p);
    fetchData(p);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── clear filters ─────────────────────────────────────────────────────────

  const clearFilters = () => {
    setFilterMatriculas([]);
    setFilterSupervisores([]);
    setFilterStatus([]);
    setFilterServicoGdis("");
    setFilterSerial("");
    setAtribuicaoInicio("");
    setAtribuicaoFim("");
    setConclusaoInicio("");
    setConclusaoFim("");
    setFilterMaterialSap([]);
    setFilterAcima45(false);
    setSorts([]);
  };

  const hasFilters =
    filterMatriculas.length > 0 ||
    filterSupervisores.length > 0 ||
    filterStatus.length > 0 ||
    filterServicoGdis ||
    filterSerial ||
    atribuicaoInicio ||
    atribuicaoFim ||
    conclusaoInicio ||
    conclusaoFim ||
    filterMaterialSap.length > 0 ||
    filterAcima45 ||
    sorts.length > 0;

  const handleToggleFiltroAcima45 = () => {
    setFilterAcima45((prev) => {
      const next = !prev;
      if (next) setFilterStatus(["PENDENTE"]);
      return next;
    });
    setPage(1);
  };

  // ── export ────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const finalMatriculas = buildFinalMatriculas();
      const all = await getAllMedidoresCompleto({
        matriculas: finalMatriculas.length > 0 ? finalMatriculas : undefined,
        supervisores: filterSupervisores.length > 0 ? filterSupervisores : undefined,
        servicoGdis: filterServicoGdis || undefined,
        serial: filterSerial || undefined,
        status: filterStatus.length > 0 ? filterStatus : undefined,
        atribuicaoInicio: atribuicaoInicio || undefined,
        atribuicaoFim: atribuicaoFim || undefined,
        conclusaoInicio: conclusaoInicio || undefined,
        conclusaoFim: conclusaoFim || undefined,
        materialSapCodes: filterMaterialSap.length > 0 ? filterMaterialSap : undefined,
        diasMin: filterAcima45 ? 45 : undefined,
        sorts: sorts.length > 0 ? sorts : undefined,
      });
      const headers = ALL_EXPORT_COLS.join(";");
      const csvRows = all.map((row) =>
        ALL_EXPORT_COLS.map((col) => {
          const v = (row as any)[col];
          if (v === null || v === undefined) return "";
          if (typeof v === "string" && v.includes(";")) return `"${v}"`;
          return String(v);
        }).join(";")
      );
      const csv = "﻿" + [headers, ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medidores_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erro ao exportar: " + (e instanceof Error ? e.message : "desconhecido"));
    } finally {
      setExporting(false);
    }
  };

  // ── modal ────────────────────────────────────────────────────────────────

  const openModal = async (row: MedidorCompleto) => {
    setModalRow(row);
    setModalId(row.id);
    setEditMatricula(row["MATRICULA"] ?? "");
    setEditData(row["Data"] ?? "");
    setEditSerial(row["Serial"] ?? "");
    setEditMaterialSap((row["Material SAP"] as string) ?? "");
    setEditServicoGdis((row["SERVIÇO GDIS"] as string) ?? "");
    setEditStatus((row["Concluído/Pendente"] as string) ?? "PENDENTE");
    setEditDataConclusao((row["Data da conclusão"] as string) ?? "");
    setEditSupervisor((row["SUPERVISOR"] as string) ?? "");
    setColabSearch(row["COLABORADOR"] ?? "");
    setColabSuggestions([]);
    setReatribuicao(null);
    setMedidorLogs([]);
    setLoadingModal(true);
    try {
      const [hist, logs] = await Promise.all([
        getMedidorReatribuicaoInfo(row.id),
        getMedidorLogs(row.id),
      ]);
      setReatribuicao(hist);
      setMedidorLogs(logs);
    } catch {
      // ignore
    } finally {
      setLoadingModal(false);
    }
  };

  const closeModal = () => {
    setModalRow(null);
    setModalId(null);
    setColabSuggestions([]);
    setMedidorLogs([]);
  };

  const handleColabSearch = async (v: string) => {
    setColabSearch(v);
    if (v.length < 2) {
      setColabSuggestions([]);
      return;
    }
    try {
      const res = await getColaboradores(v);
      setColabSuggestions(res.slice(0, 10));
    } catch {
      setColabSuggestions([]);
    }
  };

  const selectColab = (c: Colaborador) => {
    setEditMatricula(c.matricula);
    setEditSupervisor(c.supervisor ?? "");
    setColabSearch(`${c.nome} (${c.matricula})`);
    setColabSuggestions([]);
  };

  const saveModal = async () => {
    if (!modalId) return;
    setSaving(true);
    try {
      const hasGdis = editServicoGdis.trim() !== "";
      const finalStatus = hasGdis ? "CONCLUIDO" : (editStatus as "PENDENTE" | "CONCLUIDO");
      const finalDataConclusao = hasGdis && !editDataConclusao
        ? new Date().toISOString().slice(0, 10)
        : editDataConclusao || null;

      await updateMedidor(modalId, {
        matricula: editMatricula,
        data: editData,
        serial: editSerial,
        material_sap: editMaterialSap,
        servico_gdis: editServicoGdis.trim() !== "" ? editServicoGdis.trim() : null,
        status: finalStatus,
        data_conclusao: finalDataConclusao,
      });
      closeModal();
      fetchData(page);
      fetchMetrics();
    } catch (e) {
      alert("Erro ao salvar: " + (e instanceof Error ? e.message : ""));
    } finally {
      setSaving(false);
    }
  };

  const handleGdisInline = async () => {
    if (!gdisTarget || !gdisInput.trim()) return;
    setGdisSubmitting(true);
    setGdisError(null);
    try {
      await updateMedidor(gdisTarget.id, {
        servico_gdis: gdisInput.trim(),
        status: "CONCLUIDO",
        data_conclusao: new Date().toISOString().slice(0, 10),
      });
      setGdisTarget(null);
      setGdisInput("");
      fetchData(page);
      fetchMetrics();
    } catch (e) {
      setGdisError(e instanceof Error ? e.message : "Erro ao vincular serviço.");
    } finally {
      setGdisSubmitting(false);
    }
  };

  const handleDeleteRow = async () => {
    if (!modalId || !modalRow) return;
    if (!confirm(`Excluir medidor serial ${modalRow["Serial"]}? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await deleteMedidor(modalId);
      closeModal();
      fetchData(page);
      fetchMetrics();
    } catch (e) {
      alert("Erro ao excluir: " + (e instanceof Error ? e.message : ""));
    } finally {
      setDeleting(false);
    }
  };

  // ── quick delete (row-level) ──────────────────────────────────────────────

  const handleQuickDelete = async () => {
    if (!deleteTarget) return;
    setQuickDeleting(true);
    setDeleteError(null);
    const removed = rows.find((r) => r.id === deleteTarget.id);
    setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setTotal((t) => t - 1);
    try {
      await deleteMedidor(deleteTarget.id);
      setDeleteTarget(null);
      fetchMetrics();
    } catch (e) {
      // revert
      if (removed) setRows((prev) => [...prev, removed]);
      setTotal((t) => t + 1);
      setDeleteError(e instanceof Error ? e.message : "Erro ao excluir.");
    } finally {
      setQuickDeleting(false);
    }
  };

  // ── sort modal helpers ────────────────────────────────────────────────────

  const toggleSort = (col: string) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.column === col);
      if (!existing) return [...prev, { column: col, ascending: true }];
      if (existing.ascending) return prev.map((s) => s.column === col ? { ...s, ascending: false } : s);
      return prev.filter((s) => s.column !== col);
    });
  };

  const getSortIcon = (col: string) => {
    const s = sorts.find((s) => s.column === col);
    if (!s) return <ArrowUpDown size={12} className="text-slate-300" />;
    return s.ascending
      ? <ArrowUp size={12} className="text-sinal" />
      : <ArrowDown size={12} className="text-sinal" />;
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-tinta">Lista de Medidores</h2>
          <p className="text-xs text-aco mt-0.5">
            {total.toLocaleString("pt-BR")} registros encontrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSortModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aco bg-white border border-linha rounded-lg hover:bg-nevoa transition-colors"
          >
            <ListOrdered size={13} />
            Ordenar {sorts.length > 0 && <span className="text-sinal">({sorts.length})</span>}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sinal rounded-lg hover:bg-sinal-forte transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            {exporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            onClick={() => { fetchData(page); fetchMetrics(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-aco bg-white border border-linha rounded-lg hover:bg-nevoa transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* ── KPI row — 5 cards grid único ─────────────────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <MetricCard
          icon={CircleDollarSign}
          label="Valor Pendente"
          value={loadingMetrics ? "—" : formatBRL(metrics?.valorPendente ?? 0)}
          sub="medidores em campo"
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          loading={loadingMetrics}
        />
        <MetricCard
          icon={TrendingUp}
          label="Valor Concluído"
          value={loadingMetrics ? "—" : formatBRL(metrics?.valorConcluido ?? 0)}
          sub="serviços finalizados"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          loading={loadingMetrics}
        />
        <MetricCard
          icon={BarChart3}
          label="Valor Total"
          value={loadingMetrics ? "—" : formatBRL(metrics?.valorTotal ?? 0)}
          sub="soma geral"
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
          loading={loadingMetrics}
        />
        <MetricCard
          icon={AlertCircle}
          label="+45 Dias Pendente"
          value={loadingMetrics ? "—" : (metrics?.acima45dias ?? 0).toLocaleString("pt-BR")}
          sub="requer atenção imediata"
          iconBg="bg-red-50"
          iconColor="text-red-600"
          valueColor="text-red-600"
          loading={loadingMetrics}
          onClick={handleToggleFiltroAcima45}
          active={filterAcima45}
          action={
            <button
              type="button"
              onClick={handleExportar45Dias}
              disabled={exportando45}
              title="Exportar pendentes +45 dias (Excel)"
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
            >
              {exportando45 ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>
          }
        />
        <MetricCard
          icon={Calendar}
          label="Média de Dias"
          value={loadingMetrics ? "—" : `${(metrics?.mediaDiasPendentes ?? 0).toFixed(1)} dias`}
          sub="tempo médio em campo"
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
          loading={loadingMetrics}
        />
      </div>

      {/* ── Donut + Ranking ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "340px 1fr" }}>

        {/* Card situação geral — largura fixa 340px */}
        <div className="bg-white rounded-[10px] border border-linha p-5">
          <p className="text-[13px] font-semibold text-slate-900 mb-4">Situação Geral</p>
          {loadingMetrics ? (
            <div className="space-y-3">
              <div className="w-[190px] h-[190px] rounded-full bg-slate-100 animate-pulse mx-auto" />
              {[1, 2].map((i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Anel maior */}
              {(() => {
                const pieData: PieData[] = [
                  { label: "Pendentes", value: metrics?.pendentes ?? 0, color: "#f59e0b" },
                  { label: "Concluídos", value: metrics?.concluidos ?? 0, color: "#10b981" },
                ];
                return (
                  <div className="mx-auto" style={{ width: 190, height: 190 }}>
                    <PieChart data={pieData} innerRadius={62} size={190}>
                      {pieData.map((item, index) => (
                        <PieSlice index={index} key={item.label} />
                      ))}
                      <PieCenter defaultLabel="Total" />
                    </PieChart>
                  </div>
                );
              })()}

              {/* Lista estruturada */}
              <div className="mt-5 divide-y divide-slate-100">
                {[
                  {
                    label: "Pendentes",
                    value: metrics?.pendentes ?? 0,
                    dot: "bg-amber-400",
                    pct: metrics && metrics.total > 0
                      ? ((metrics.pendentes / metrics.total) * 100).toFixed(1)
                      : "0",
                  },
                  {
                    label: "Concluídos",
                    value: metrics?.concluidos ?? 0,
                    dot: "bg-emerald-500",
                    pct: metrics && metrics.total > 0
                      ? ((metrics.concluidos / metrics.total) * 100).toFixed(1)
                      : "0",
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.dot} flex-shrink-0`} />
                      <div>
                        <p className="text-[12px] text-aco leading-none">{item.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.pct}% do total</p>
                      </div>
                    </div>
                    <span className="text-[18px] font-medium text-slate-900 tabular-nums">
                      {item.value.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top 10 ranking — scroll + resize + multiselect clicável */}
        <div className="bg-white rounded-[10px] border border-linha flex flex-col overflow-hidden" style={{ resize: "vertical", minHeight: 200, maxHeight: 640, height: 390 }}>
          <div className="px-5 pt-5 pb-3 flex-shrink-0 flex items-center justify-between border-b border-slate-100">
            <p className="text-[13px] font-semibold text-slate-900">Top 10 — Valor Pendente</p>
            {filterMatriculas.length > 0 && (
              <button
                onClick={() => setFilterMatriculas([])}
                className="text-[11px] text-amber-600 hover:text-amber-800 flex items-center gap-1"
              >
                <X size={10} />
                Limpar seleção
              </button>
            )}
          </div>
          <div
            className="flex-1 overflow-y-auto px-5 pb-4"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
          >
            {loadingMetrics ? (
              <div className="space-y-4 pt-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (metrics?.ranking ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 pt-3">Nenhum dado disponível.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(metrics?.ranking ?? []).map((item, idx) => {
                  const maxVal = metrics!.ranking[0].valor_pendente || 1;
                  const pct = Math.max(2, Math.round((item.valor_pendente / maxVal) * 100));
                  const isTop3 = idx < 3;
                  const isSelected = filterMatriculas.includes(item.matricula);
                  return (
                    <button
                      key={item.matricula}
                      onClick={() => {
                        setFilterMatriculas((prev) =>
                          prev.includes(item.matricula)
                            ? prev.filter((m) => m !== item.matricula)
                            : [...prev, item.matricula]
                        );
                      }}
                      className={`w-full text-left py-2.5 px-2 -mx-2 rounded-lg transition-colors ${
                        isSelected ? "bg-amber-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {isTop3 ? (
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${isSelected ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700"}`}>
                            {idx + 1}
                          </span>
                        ) : (
                          <span className={`w-5 text-center text-[11px] flex-shrink-0 ${isSelected ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
                            {idx + 1}
                          </span>
                        )}
                        <span className={`text-[12px] truncate flex-1 ${isSelected ? "font-semibold text-amber-800" : isTop3 ? "font-semibold text-slate-800" : "text-aco"}`}>
                          {item.nome || item.matricula}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[12px] font-semibold tabular-nums ${isSelected ? "text-amber-700" : "text-slate-900"}`}>
                            {formatBRL(item.valor_pendente)}
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            ({item.qtd_pendente})
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-linha rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isSelected ? "bg-amber-500" : isTop3 ? "bg-amber-400" : "bg-amber-300"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-linha p-4">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Serial search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aco-claro" />
            <input
              type="text"
              placeholder="Serial (separar por vírgula)"
              value={filterSerial}
              onChange={(e) => setFilterSerial(e.target.value)}
              className="pl-7 pr-3 h-8 text-xs border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro w-52"
            />
            {filterSerial && (
              <button onClick={() => setFilterSerial("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X size={11} className="text-aco-claro" />
              </button>
            )}
          </div>

          {/* Serviço GDIS */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aco-claro" />
            <input
              type="text"
              placeholder="Serviço GDIS"
              value={filterServicoGdis}
              onChange={(e) => setFilterServicoGdis(e.target.value)}
              className="pl-7 pr-3 h-8 text-xs border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro w-40"
            />
            {filterServicoGdis && (
              <button onClick={() => setFilterServicoGdis("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X size={11} className="text-aco-claro" />
              </button>
            )}
          </div>

          <ColabMultiSelect
            colabs={allColabs}
            selected={filterMatriculas}
            onChange={setFilterMatriculas}
          />
          <MultiSelectSearch
            label="Supervisor"
            options={supervisorOptions}
            selected={filterSupervisores}
            onChange={setFilterSupervisores}
          />
          <MultiSelectSearch
            label="Status"
            options={["PENDENTE", "CONCLUIDO"]}
            selected={filterStatus}
            onChange={setFilterStatus}
          />
          <MultiSelectSearch
            label="Material"
            options={materialSapOptions}
            selected={filterMaterialSap}
            onChange={setFilterMaterialSap}
            placeholder="Buscar por código ou material..."
          />

          {/* Date ranges */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-aco-claro">Atrib.</span>
            <input
              type="date"
              value={atribuicaoInicio}
              onChange={(e) => setAtribuicaoInicio(e.target.value)}
              className="h-8 px-2 text-xs border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
            />
            <span className="text-xs text-aco-claro">até</span>
            <input
              type="date"
              value={atribuicaoFim}
              onChange={(e) => setAtribuicaoFim(e.target.value)}
              className="h-8 px-2 text-xs border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-aco-claro">Conclusão</span>
            <input
              type="date"
              value={conclusaoInicio}
              onChange={(e) => setConclusaoInicio(e.target.value)}
              className="h-8 px-2 text-xs border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
            />
            <span className="text-xs text-aco-claro">até</span>
            <input
              type="date"
              value={conclusaoFim}
              onChange={(e) => setConclusaoFim(e.target.value)}
              className="h-8 px-2 text-xs border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 h-8 px-3 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <X size={11} />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-linha overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ tableLayout: "fixed", minWidth: 860 }}>
            <colgroup><col style={{ width: 96 }} /><col style={{ width: 120 }} /><col style={{ width: 180 }} /><col style={{ width: 140 }} /><col style={{ width: 110 }} /><col style={{ width: 90 }} /><col style={{ width: 64 }} /><col style={{ width: 96 }} /><col style={{ width: 72 }} /></colgroup>
            <thead className="bg-nevoa border-b border-linha">
              <tr>
                {SORTABLE_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-left font-semibold text-aco uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-tinta select-none overflow-hidden"
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {getSortIcon(col.key)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left font-semibold text-aco uppercase tracking-wide">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nevoa">
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: SORTABLE_COLS.length + 1 }).map((_, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <div className="h-3 bg-slate-100 rounded w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.length === 0
                ? (
                    <tr>
                      <td colSpan={SORTABLE_COLS.length + 1} className="px-3 py-12 text-center text-aco-claro">
                        Nenhum medidor encontrado.
                      </td>
                    </tr>
                  )
                : rows.map((row) => {
                    const isPendente = row["Concluído/Pendente"] === "PENDENTE";
                    const dias = row["DIAS DE ATRIBUIÇÃO"] as number | null;
                    return (
                      <tr key={row.id} className="hover:bg-nevoa transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-tinta">
                          {formatDateBR(row["Data"] as string)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis font-codigo text-tinta">
                          {row["Serial"] as string}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-tinta">
                          {row["COLABORADOR"] as string}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-tinta">
                          {(row["SUPERVISOR"] as string) || "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-tinta">
                          {(row["SERVIÇO GDIS"] as string) || "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                          <StatusMedidor status={isPendente ? "pendente" : "concluido"} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-right">
                          {dias != null ? (
                            <span
                              className={`font-semibold ${
                                dias > 90 ? "text-red-700"
                                : dias > 60 ? "text-red-500"
                                : dias > 30 ? "text-orange-500"
                                : "text-tinta"
                              }`}
                            >
                              {dias}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis text-tinta">
                          {formatDateBR(row["Data da conclusão"] as string)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => openModal(row)}
                              className="p-1 text-aco-claro hover:text-sinal transition-colors rounded"
                              title="Ver / editar"
                            >
                              <Eye size={14} />
                            </button>
                            {isPendente && canEdit && (
                              <button
                                onClick={() => { setGdisTarget({ id: row.id, serial: row["Serial"] as string }); setGdisInput(""); setGdisError(null); }}
                                className="p-1 text-aco-claro hover:text-emerald-600 transition-colors rounded"
                                title="Vincular nº de serviço"
                              >
                                <Link2 size={14} />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => setDeleteTarget({ id: row.id, serial: row["Serial"] as string })}
                                className="p-1 text-aco-claro hover:text-red-600 transition-colors rounded"
                                title="Excluir medidor"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-nevoa">
          <p className="text-xs text-aco-claro">
            Exibindo {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
            {Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("pt-BR")}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded hover:bg-nevoa disabled:opacity-40 transition-colors"
            >
              <ChevronsLeft size={14} className="text-aco" />
            </button>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded hover:bg-nevoa disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} className="text-aco" />
            </button>
            <span className="text-xs text-aco px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded hover:bg-nevoa disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={14} className="text-aco" />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded hover:bg-nevoa disabled:opacity-40 transition-colors"
            >
              <ChevronsRight size={14} className="text-aco" />
            </button>
          </div>
        </div>
      </div>

      {/* Sort Modal */}
      {showSortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-tinta">Ordenação</h3>
              <button onClick={() => setShowSortModal(false)}>
                <X size={16} className="text-aco-claro" />
              </button>
            </div>
            <p className="text-xs text-aco mb-3">
              Clique nos campos para alternar entre: nenhum → crescente → decrescente.
            </p>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {SORTABLE_COLS.map((col) => {
                const s = sorts.find((s) => s.column === col.key);
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-nevoa transition-colors text-sm"
                  >
                    <span className={s ? "text-sinal font-medium" : "text-tinta"}>
                      {col.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-aco-claro">
                      {s ? (s.ascending ? "Crescente" : "Decrescente") : ""}
                      {getSortIcon(col.key)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setSorts([]); setShowSortModal(false); }}
                className="flex-1 py-2 text-xs font-medium text-aco border border-linha rounded-lg hover:bg-nevoa"
              >
                Limpar
              </button>
              <button
                onClick={() => setShowSortModal(false)}
                className="flex-1 py-2 text-xs font-medium text-white bg-sinal rounded-lg hover:bg-sinal-forte"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-tinta text-sm">Excluir medidor</h3>
                <p className="text-xs text-aco mt-1">
                  Excluir o medidor serial{" "}
                  <span className="font-codigo font-semibold text-tinta">{deleteTarget.serial}</span>?
                  {" "}Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="text-xs text-red-600 mb-3 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                disabled={quickDeleting}
                className="px-4 py-2 text-xs font-medium text-aco border border-linha rounded-lg hover:bg-nevoa transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleQuickDelete}
                disabled={quickDeleting}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 size={12} />
                {quickDeleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline GDIS Modal */}
      {gdisTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Link2 size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-tinta text-sm">Vincular Serviço</h3>
                <p className="text-xs text-aco mt-1">
                  Serial: <span className="font-codigo font-semibold text-tinta">{gdisTarget.serial}</span>
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-aco block mb-1">Número do Serviço GDIS</label>
              <input
                autoFocus
                type="text"
                placeholder="ex: 123456789"
                value={gdisInput}
                onChange={(e) => setGdisInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGdisInline(); }}
                className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro font-codigo"
              />
              <p className="text-[10px] text-aco-claro mt-1">O status será alterado para <strong>CONCLUÍDO</strong> automaticamente.</p>
            </div>
            {gdisError && (
              <p className="text-xs text-red-600 mb-3 bg-red-50 rounded-lg px-3 py-2">{gdisError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setGdisTarget(null); setGdisInput(""); setGdisError(null); }}
                disabled={gdisSubmitting}
                className="px-4 py-2 text-xs font-medium text-aco border border-linha rounded-lg hover:bg-nevoa transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGdisInline}
                disabled={gdisSubmitting || !gdisInput.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Link2 size={12} />
                {gdisSubmitting ? "Salvando..." : "Vincular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-nevoa">
              <div>
                <h3 className="font-semibold text-tinta">Detalhes do Medidor</h3>
                <p className="text-xs text-aco-claro font-codigo mt-0.5">
                  Serial: {modalRow["Serial"] as string}
                </p>
              </div>
              <button onClick={closeModal}>
                <X size={16} className="text-aco-claro" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {/* Read-only info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Supervisor", editSupervisor || "—"],
                  ["Equipamento", modalRow["EQUIPAMENTO"] || "—"],
                  ["Dias Atribuído", modalRow["DIAS DE ATRIBUIÇÃO"] ?? "—"],
                  ["Valor", (() => {
                    const t = allTipos.find((t) => t.cod_sap === editMaterialSap);
                    return t ? formatBRL(t.valor) : (modalRow["VALOR"] != null ? formatBRL(modalRow["VALOR"] as number) : "—");
                  })()],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-[10px] uppercase tracking-wide text-aco-claro font-medium mb-0.5">{label}</p>
                    <p className="text-sm text-tinta font-medium">{String(value ?? "—")}</p>
                  </div>
                ))}
              </div>

              {/* Editable fields */}
              {canEdit && (
              <div className="border-t border-nevoa pt-3 space-y-3">
                <p className="text-xs font-semibold text-aco uppercase tracking-wide">Editar</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-aco block mb-1">Serial</label>
                    <input
                      type="text"
                      value={editSerial}
                      onChange={(e) => setEditSerial(e.target.value)}
                      className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro font-codigo"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-aco block mb-1">Material SAP</label>
                    <select
                      value={editMaterialSap}
                      onChange={(e) => setEditMaterialSap(e.target.value)}
                      className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro bg-white"
                    >
                      <option value="">— Selecione —</option>
                      {allTipos.length === 0 && editMaterialSap && (
                        <option value={editMaterialSap}>{editMaterialSap}</option>
                      )}
                      {allTipos.map((t) => (
                        <option key={t.cod_sap} value={t.cod_sap}>
                          {t.cod_sap} — {t.tipo}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const t = allTipos.find((t) => t.cod_sap === editMaterialSap);
                      return t ? (
                        <p className="text-[10px] text-aco-claro mt-0.5">
                          Ligação: <span className="capitalize font-medium text-aco">{t.ligacao}</span>
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-aco block mb-1">Serviço GDIS</label>
                  <input
                    type="text"
                    value={editServicoGdis}
                    onChange={(e) => setEditServicoGdis(e.target.value)}
                    placeholder="ex: 123456789"
                    className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-aco block mb-1">Data de Atribuição</label>
                    <input
                      type="date"
                      value={editData}
                      onChange={(e) => setEditData(e.target.value)}
                      className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-aco block mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro bg-white"
                    >
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="CONCLUIDO">CONCLUIDO</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-aco block mb-1">Data de Conclusão</label>
                  <input
                    type="date"
                    value={editDataConclusao}
                    onChange={(e) => setEditDataConclusao(e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
                  />
                </div>

                <div className="relative">
                  <label className="text-xs text-aco block mb-1">Colaborador</label>
                  <input
                    type="text"
                    placeholder="Buscar por nome ou matrícula..."
                    value={colabSearch}
                    onChange={(e) => handleColabSearch(e.target.value)}
                    className="w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro"
                  />
                  <p className="text-[10px] text-aco-claro mt-0.5">Matrícula selecionada: {editMatricula || "—"}</p>
                  {colabSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-white border border-linha rounded-lg shadow-lg mt-0.5 max-h-40 overflow-y-auto">
                      {colabSuggestions.map((c) => (
                        <button
                          key={c.matricula}
                          onClick={() => selectColab(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-nevoa transition-colors"
                        >
                          <span className="font-medium">{c.nome}</span>
                          <span className="text-aco-claro ml-2">{c.matricula}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Reatribuição history */}
              {!loadingModal && reatribuicao?.anterior && (
                <div className="bg-nevoa rounded-lg p-3 border border-linha">
                  <p className="text-[10px] uppercase tracking-wide text-aco-claro font-medium mb-1">
                    Histórico de Reatribuição
                  </p>
                  <p className="text-xs text-tinta">
                    Anterior: <strong>{reatribuicao.anterior.nome}</strong> ({reatribuicao.anterior.matricula})
                  </p>
                  <p className="text-xs text-aco-claro">
                    Atribuído em {formatDateBR(reatribuicao.anterior.data)} · Reatribuído em{" "}
                    {formatDateBR(reatribuicao.anterior.data_reatribuicao)}
                  </p>
                </div>
              )}

              {/* Log de atividades */}
              <div className="border-t border-nevoa pt-3">
                <p className="text-xs font-semibold text-aco uppercase tracking-wide mb-2">Log de Atividades</p>
                {loadingModal ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
                  </div>
                ) : medidorLogs.length === 0 ? (
                  <p className="text-xs text-aco-claro">Nenhum evento registrado.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[7px] top-0 bottom-0 w-px bg-linha" />
                    <div className="space-y-0">
                      {medidorLogs.map((log) => {
                        const cfg = LOG_EVENTO_CONFIG[log.evento] ?? LOG_EVENTO_CONFIG["EDITADO"];
                        return (
                          <div key={log.id} className="flex gap-3 pb-3 relative">
                            <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 border-2 border-white ring-1 ${cfg.ring} ${cfg.bg} z-10`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                                <span className="text-[10px] text-aco-claro">
                                  {new Date(log.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              </div>
                              {log.descricao && (
                                <p className="text-[11px] text-aco mt-0.5 break-words">{log.descricao}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-5 border-t border-nevoa">
              {canEdit ? (
                <button
                  onClick={handleDeleteRow}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-medium text-aco border border-linha rounded-lg hover:bg-nevoa transition-colors"
                >
                  {canEdit ? "Cancelar" : "Fechar"}
                </button>
                {canEdit && (
                  <button
                    onClick={saveModal}
                    disabled={saving}
                    className="px-4 py-2 text-xs font-medium text-white bg-sinal rounded-lg hover:bg-sinal-forte transition-colors disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
