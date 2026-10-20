
import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  ClipboardCopy,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  ClipboardCheck,
  ChevronRight,
  Clock,
  SearchCheck,
  Pencil,
  Undo2,
  Trash2,
  Download,
} from "lucide-react";
import {
  getServicosConferencia,
  getServicosAguardandoVinculacao,
  verificarVinculacoesPendentes,
  vincularServicoMedidor,
  reverterServicoPendente,
  deleteServicoReport,
  ServicoVinculadoError,
} from "@/lib/api";
import type {
  ServicoReportConferencia,
  ServicoReportAguardando,
} from "@/lib/supabase";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 200;

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastMsg {
  id: number;
  type: "success" | "error" | "info";
  text: string;
}

let toastCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback(
    (type: ToastMsg["type"], text: string) => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000
      );
    },
    []
  );

  return { toasts, addToast };
}

// ─── Linha da tabela de conferência ──────────────────────────────────────────
interface RowProps {
  servico: ServicoReportConferencia;
  onVinculado: (servicoId: string) => void;
  onAguardando: (servicoId: string) => void;
  onExcluido: (servicoId: string) => void;
  onDesatualizado: () => void;
  addToast: (type: "success" | "error" | "info", text: string) => void;
  isNext: boolean;
  copyBtnRef?: (el: HTMLButtonElement | null) => void;
}

function ConferenciaRow({
  servico,
  onVinculado,
  onAguardando,
  onExcluido,
  onDesatualizado,
  addToast,
  isNext,
  copyBtnRef,
}: RowProps) {
  const [serial, setSerial] = useState("");
  const [vinculando, setVinculando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const serialInputRef = useRef<HTMLInputElement>(null);
  const copyBtnLocalRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    copyBtnRef?.(copyBtnLocalRef.current);
  });

  const handleCopiar = () => {
    navigator.clipboard.writeText(servico.servico).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      serialInputRef.current?.focus();
    });
  };

  const handleVincular = useCallback(async () => {
    const s = serial.trim();
    if (!s) return;
    setVinculando(true);
    setErro(null);
    try {
      const result = await vincularServicoMedidor(servico.servico, s);
      if (result.ok) {
        if (result.aguardando) {
          addToast(
            "info",
            `⏳ Serial ${s} não encontrado. Serviço ${servico.servico} aguardando vinculação.`
          );
          onAguardando(servico.servico);
        } else {
          addToast(
            "success",
            `✅ ${result.nome ?? result.serial} vinculado ao serviço ${servico.servico}`
          );
          onVinculado(servico.servico);
        }
      } else {
        setErro(result.error ?? "Erro desconhecido.");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao vincular.");
    } finally {
      setVinculando(false);
    }
  }, [serial, servico.servico, addToast, onVinculado, onAguardando]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVincular();
    }
  };

  const handleExcluir = async () => {
    if (!confirm(`Excluir o serviço ${servico.servico}? Use quando o medidor não é nosso. Esta ação não pode ser desfeita.`)) return;
    setExcluindo(true);
    setErro(null);
    try {
      await deleteServicoReport(servico.servico);
      addToast("info", `Serviço ${servico.servico} excluído.`);
      onExcluido(servico.servico);
    } catch (err) {
      if (err instanceof ServicoVinculadoError) {
        // A lista estava desatualizada: o medidor entrou no sistema depois do carregamento.
        addToast("error", `${err.message} Lista atualizada.`);
        onDesatualizado();
        return;
      }
      setErro(err instanceof Error ? err.message : "Erro ao excluir.");
      setExcluindo(false);
    }
  };

  const terminoFormatado = (() => {
    try {
      return new Date(servico.termino).toLocaleDateString("pt-BR");
    } catch {
      return servico.termino;
    }
  })();

  return (
    <tr
      className={`border-b border-slate-100 transition-colors ${
        isNext ? "bg-sinal-fundo/40" : "hover:bg-slate-100"
      }`}
    >
      {/* Nº Serviço */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {isNext && <ChevronRight size={14} className="text-sinal shrink-0" />}
          <span className="font-codigo text-sm font-bold text-slate-800">
            {servico.servico}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-codigo">{terminoFormatado}</span>
      </td>

      {/* Matrícula */}
      <td className="px-4 py-3 text-xs text-slate-600 font-codigo whitespace-nowrap">
        {servico.matricula ?? <span className="text-slate-300">—</span>}
      </td>

      {/* Tipo Serv */}
      <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">
        {servico.tipo_serv ?? <span className="text-slate-300">—</span>}
      </td>

      {/* Copiar */}
      <td className="px-3 py-3 whitespace-nowrap">
        <button
          ref={(el) => {
            copyBtnLocalRef.current = el as HTMLButtonElement;
            copyBtnRef?.(el);
          }}
          id={`copy-btn-${servico.servico}`}
          type="button"
          onClick={handleCopiar}
          title="Copiar Nº do Serviço"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
            copied
              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-sinal-fundo hover:text-sinal-forte hover:border-sinal-claro"
          }`}
        >
          {copied ? (
            <><ClipboardCheck size={13} /> Copiado!</>
          ) : (
            <><ClipboardCopy size={13} /> Copiar</>
          )}
        </button>
      </td>

      {/* Campo serial + Vincular */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={serialInputRef}
            id={`serial-input-${servico.servico}`}
            type="text"
            value={serial}
            onChange={(e) => {
              setSerial(e.target.value);
              setErro(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Serial do medidor"
            className={`w-44 px-3 py-1.5 border rounded-lg text-xs font-codigo font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              erro
                ? "border-red-400 focus:ring-red-300 bg-red-50"
                : "border-slate-300 focus:ring-sinal-claro focus:border-sinal-claro"
            }`}
          />
          <button
            id={`vincular-btn-${servico.servico}`}
            type="button"
            onClick={handleVincular}
            disabled={!serial.trim() || vinculando}
            title="Vincular (ou Enter)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sinal text-white text-xs font-bold rounded-lg hover:bg-sinal-forte transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
          >
            {vinculando ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Link2 size={13} />
            )}
            {vinculando ? "…" : "Vincular"}
          </button>
          <button
            id={`excluir-btn-${servico.servico}`}
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            title="Excluir (medidor não é nosso)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-red-600 bg-red-50 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {excluindo ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
        {erro && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle size={11} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-600 font-semibold leading-tight">
              {erro}
            </p>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Linha da tabela de Aguardando Vinculação ─────────────────────────────────
interface AguardandoRowProps {
  servico: ServicoReportAguardando;
  onVinculado: (servicoId: string) => void;
  onRevertido: (servicoId: string) => void;
  onExcluido: (servicoId: string) => void;
  onDesatualizado: () => void;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

function AguardandoRow({ servico, onVinculado, onRevertido, onExcluido, onDesatualizado, addToast }: AguardandoRowProps) {
  const [editando, setEditando] = useState(false);
  const [novoSerial, setNovoSerial] = useState(servico.serial_buscado);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const terminoFormatado = (() => {
    try { return new Date(servico.termino).toLocaleDateString("pt-BR"); } catch { return servico.termino; }
  })();

  const importadoFormatado = (() => {
    try { return new Date(servico.imported_at).toLocaleDateString("pt-BR"); } catch { return servico.imported_at; }
  })();

  const handleEditar = () => {
    setNovoSerial(servico.serial_buscado);
    setErro(null);
    setEditando(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleCorrigir = async () => {
    const s = novoSerial.trim();
    if (!s || s === servico.serial_buscado) { setEditando(false); return; }
    setSalvando(true);
    setErro(null);
    try {
      const result = await vincularServicoMedidor(servico.servico, s);
      if (result.ok) {
        if (result.aguardando) {
          addToast("info", `Serial atualizado para ${s}. Ainda aguardando entrada no sistema.`);
          servico.serial_buscado = s; // atualiza localmente
          setEditando(false);
        } else {
          addToast("success", `✅ ${result.nome ?? result.serial} vinculado ao serviço ${servico.servico}`);
          onVinculado(servico.servico);
        }
      } else {
        setErro(result.error ?? "Erro desconhecido.");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao vincular.");
    } finally {
      setSalvando(false);
    }
  };

  const handleReverter = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await reverterServicoPendente(servico.servico);
      addToast("info", `Serviço ${servico.servico} retornou para a fila de conferência.`);
      onRevertido(servico.servico);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao reverter.");
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!confirm(`Excluir o serviço ${servico.servico}? Use quando o medidor não é nosso. Esta ação não pode ser desfeita.`)) return;
    setExcluindo(true);
    setErro(null);
    try {
      await deleteServicoReport(servico.servico);
      addToast("info", `Serviço ${servico.servico} excluído.`);
      onExcluido(servico.servico);
    } catch (err) {
      if (err instanceof ServicoVinculadoError) {
        // A lista estava desatualizada: o medidor entrou no sistema depois do carregamento.
        addToast("error", `${err.message} Lista atualizada.`);
        onDesatualizado();
        return;
      }
      setErro(err instanceof Error ? err.message : "Erro ao excluir.");
      setExcluindo(false);
    }
  };

  return (
    <tr className="border-b border-amber-100 hover:bg-amber-100/70 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-codigo text-sm font-bold text-slate-800">{servico.servico}</span>
        <span className="block text-xs text-slate-400 font-codigo">{terminoFormatado}</span>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        {editando ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={novoSerial}
              onChange={(e) => { setNovoSerial(e.target.value); setErro(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCorrigir(); if (e.key === "Escape") setEditando(false); }}
              className="w-40 px-2 py-1 border border-sinal-claro rounded-lg text-xs font-codigo font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sinal-claro"
            />
            <button
              onClick={handleCorrigir}
              disabled={salvando || !novoSerial.trim()}
              className="px-2.5 py-1 bg-sinal text-white text-xs font-bold rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-1"
            >
              {salvando ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
              {salvando ? "…" : "OK"}
            </button>
            <button onClick={() => setEditando(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X size={13} />
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-codigo font-bold rounded-md border border-amber-200">
            {servico.serial_buscado}
          </span>
        )}
        {erro && <p className="text-[11px] text-red-600 mt-1 font-semibold">{erro}</p>}
      </td>

      <td className="px-4 py-3 text-xs text-slate-600 font-codigo whitespace-nowrap">
        {servico.matricula ?? <span className="text-slate-300">—</span>}
      </td>

      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
        {importadoFormatado}
      </td>

      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button
            onClick={handleEditar}
            disabled={salvando || editando}
            title="Corrigir serial"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-sinal-forte bg-sinal-fundo border border-sinal-fundo rounded-lg hover:bg-sinal-fundo disabled:opacity-40 transition-colors"
          >
            <Pencil size={11} />
            Corrigir
          </button>
          <button
            onClick={handleReverter}
            disabled={salvando || editando}
            title="Voltar para fila de conferência"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            {salvando ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
            Reverter
          </button>
          <button
            onClick={handleExcluir}
            disabled={salvando || editando || excluindo}
            title="Excluir (medidor não é nosso)"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
          >
            {excluindo ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ConferenciaPage() {
  // ── Estado: lista PENDENTE ────────────────────────────────────────────────
  const [servicos, setServicos] = useState<ServicoReportConferencia[]>([]);
  const [totalServicos, setTotalServicos] = useState(0);
  const [pageServicos, setPageServicos] = useState(1);
  const [loadingServicos, setLoadingServicos] = useState(true);
  const [errorServicos, setErrorServicos] = useState<string | null>(null);

  // ── Estado: lista AGUARDANDO ──────────────────────────────────────────────
  const [aguardando, setAguardando] = useState<ServicoReportAguardando[]>([]);
  const [totalAguardando, setTotalAguardando] = useState(0);
  const [pageAguardando, setPageAguardando] = useState(1);
  const [loadingAguardando, setLoadingAguardando] = useState(true);
  const [errorAguardando, setErrorAguardando] = useState<string | null>(null);
  const [exportandoAguardando, setExportandoAguardando] = useState(false);

  // ── Estado: verificação ───────────────────────────────────────────────────
  const [verificando, setVerificando] = useState(false);

  const { toasts, addToast } = useToasts();
  const copyBtnRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadServicos = useCallback(async (page: number) => {
    setLoadingServicos(true);
    setErrorServicos(null);
    try {
      const { data, total, page: paginaEfetiva } = await getServicosConferencia(page, PAGE_SIZE);
      setServicos(data);
      setTotalServicos(total);
      if (paginaEfetiva !== page) setPageServicos(paginaEfetiva);
    } catch (err) {
      setErrorServicos(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoadingServicos(false);
    }
  }, []);

  const loadAguardando = useCallback(async (page: number) => {
    setLoadingAguardando(true);
    setErrorAguardando(null);
    try {
      const { data, total, page: paginaEfetiva } = await getServicosAguardandoVinculacao(page, PAGE_SIZE);
      setAguardando(data);
      setTotalAguardando(total);
      if (paginaEfetiva !== page) setPageAguardando(paginaEfetiva);
    } catch (err) {
      setErrorAguardando(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoadingAguardando(false);
    }
  }, []);

  const reloadAll = useCallback(() => {
    loadServicos(pageServicos);
    loadAguardando(pageAguardando);
  }, [loadServicos, loadAguardando, pageServicos, pageAguardando]);

  const handleExportarAguardando = useCallback(async () => {
    setExportandoAguardando(true);
    try {
      const { data } = await getServicosAguardandoVinculacao(1, Math.max(totalAguardando, 1));
      const planilha = data.map((s) => ({
        "Nº Serviço": s.servico,
        "Término": s.termino ? new Date(s.termino).toLocaleDateString("pt-BR") : "",
        "Serial Buscado": s.serial_buscado,
        "Matrícula": s.matricula ?? "",
        "Importado em": s.imported_at ? new Date(s.imported_at).toLocaleDateString("pt-BR") : "",
      }));
      const ws = XLSX.utils.json_to_sheet(planilha);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Aguardando vinculação");
      XLSX.writeFile(wb, `aguardando_vinculacao_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Erro ao exportar.");
    } finally {
      setExportandoAguardando(false);
    }
  }, [totalAguardando, addToast]);

  useEffect(() => { loadServicos(pageServicos); }, [pageServicos, loadServicos]);
  useEffect(() => { loadAguardando(pageAguardando); }, [pageAguardando, loadAguardando]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVinculado = useCallback((servicoId: string) => {
    setServicos((prev) => {
      const idx = prev.findIndex((s) => s.servico === servicoId);
      const next = prev.filter((s) => s.servico !== servicoId);
      const nextServico = prev[idx + 1] ?? prev[idx - 1];
      if (nextServico) {
        setTimeout(() => {
          const btn = copyBtnRefs.current.get(nextServico.servico);
          btn?.focus();
        }, 50);
      }
      return next;
    });
    setTotalServicos((t) => Math.max(0, t - 1));
  }, []);

  const handleExcluido = useCallback((servicoId: string) => {
    setServicos((prev) => prev.filter((s) => s.servico !== servicoId));
    setTotalServicos((t) => Math.max(0, t - 1));
  }, []);

  const handleAguardando = useCallback(
    (servicoId: string) => {
      setServicos((prev) => prev.filter((s) => s.servico !== servicoId));
      setTotalServicos((t) => Math.max(0, t - 1));
      setTotalAguardando((t) => t + 1);
      loadAguardando(pageAguardando);
    },
    [loadAguardando, pageAguardando]
  );

  const handleVinculadoDeAguardando = useCallback((servicoId: string) => {
    setAguardando((prev) => prev.filter((s) => s.servico !== servicoId));
    setTotalAguardando((t) => Math.max(0, t - 1));
  }, []);

  const handleExcluidoDeAguardando = useCallback((servicoId: string) => {
    setAguardando((prev) => prev.filter((s) => s.servico !== servicoId));
    setTotalAguardando((t) => Math.max(0, t - 1));
  }, []);

  const handleRevertido = useCallback((servicoId: string) => {
    setAguardando((prev) => prev.filter((s) => s.servico !== servicoId));
    setTotalAguardando((t) => Math.max(0, t - 1));
    setTotalServicos((t) => t + 1);
    loadServicos(pageServicos);
  }, [loadServicos, pageServicos]);

  const handleVerificar = async () => {
    setVerificando(true);
    try {
      const vinculados = await verificarVinculacoesPendentes();
      if (vinculados > 0) {
        addToast(
          "success",
          `✅ ${vinculados} vinculação${vinculados !== 1 ? "ões" : ""} resolvida${vinculados !== 1 ? "s" : ""} automaticamente!`
        );
      } else {
        addToast("info", "Nenhuma vinculação pendente pôde ser resolvida agora.");
      }
      reloadAll();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Erro ao verificar.");
    } finally {
      setVerificando(false);
    }
  };

  const totalPagesServicos = Math.max(1, Math.ceil(totalServicos / PAGE_SIZE));
  const totalPagesAguardando = Math.max(1, Math.ceil(totalAguardando / PAGE_SIZE));
  const isLoading = loadingServicos || loadingAguardando;

  return (
    <div className="flex flex-col h-full">
      {/* ── Toasts ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold pointer-events-auto transition-all ${
              t.type === "success"
                ? "bg-emerald-600 text-white"
                : t.type === "info"
                ? "bg-sinal text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : t.type === "info" ? (
              <Clock size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            {t.text}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4 flex-shrink-0">
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-900">Conferência de Serviços</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Para cada serviço, abra no GDIS, anote o serial do medidor e informe abaixo.
          </p>
        </div>

        {/* Contadores */}
        <div className="flex items-center gap-4">
          {totalServicos > 0 && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Pendentes</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {totalServicos}
              </p>
            </div>
          )}
          {totalAguardando > 0 && (
            <div className="text-right">
              <p className="text-xs text-amber-600">Aguardando</p>
              <p className="text-lg font-black text-amber-700 leading-tight">
                {totalAguardando}
              </p>
            </div>
          )}
        </div>

        {/* Botão Verificar */}
        {totalAguardando > 0 && (
          <button
            id="btn-verificar-pendentes"
            type="button"
            onClick={handleVerificar}
            disabled={verificando}
            title="Tentar resolver vinculações aguardando"
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {verificando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <SearchCheck size={14} />
            )}
            {verificando ? "Verificando…" : "Verificar vinculações"}
          </button>
        )}

        {/* Reload */}
        <button
          id="btn-reload-conferencia"
          onClick={reloadAll}
          disabled={isLoading}
          title="Recarregar"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200">

        {/* ════════ SEÇÃO 1: PENDENTES ════════ */}
        <section>
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sinal" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Pendentes de conferência
            </span>
            {!loadingServicos && (
              <span className="ml-auto text-xs text-slate-400">
                {totalServicos} serviço{totalServicos !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loadingServicos && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Carregando…</span>
            </div>
          )}

          {errorServicos && (
            <div className="m-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold">Erro ao carregar</p>
                <p className="text-xs text-red-600 mt-0.5">{errorServicos}</p>
              </div>
              <button onClick={() => setErrorServicos(null)} className="text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            </div>
          )}

          {!loadingServicos && !errorServicos && servicos.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <p className="text-sm font-bold text-slate-600">Tudo conferido!</p>
              <p className="text-xs">Não há serviços pendentes nesta página.</p>
            </div>
          )}

          {!loadingServicos && servicos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Nº Serviço / Data
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Matrícula
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Tipo Serv.
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Copiar
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Serial do Medidor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((s, idx) => (
                    <ConferenciaRow
                      key={s.servico}
                      servico={s}
                      onVinculado={handleVinculado}
                      onAguardando={handleAguardando}
                      onExcluido={handleExcluido}
                      onDesatualizado={reloadAll}
                      addToast={addToast}
                      isNext={idx === 0}
                      copyBtnRef={(el) => copyBtnRefs.current.set(s.servico, el)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={pageServicos}
            totalPages={totalPagesServicos}
            totalItems={totalServicos}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setPageServicos(p)}
            label="serviços"
          />
        </section>

        {/* ════════ SEÇÃO 2: AGUARDANDO VINCULAÇÃO ════════ */}
        {(totalAguardando > 0 || loadingAguardando) && (
          <section>
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <Clock size={13} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Aguardando vinculação
              </span>
              <span className="ml-1 text-xs text-amber-500">
                — serial informado, mas medidor ainda não entrou no sistema
              </span>
              {!loadingAguardando && (
                <span className="text-xs text-amber-500">
                  {totalAguardando} serviço{totalAguardando !== 1 ? "s" : ""}
                </span>
              )}
              <button
                type="button"
                onClick={handleExportarAguardando}
                disabled={exportandoAguardando || totalAguardando === 0}
                title="Exportar para Excel"
                className="ml-auto p-1.5 text-amber-600 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-40"
              >
                {exportandoAguardando ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </button>
            </div>

            {loadingAguardando && (
              <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Carregando…</span>
              </div>
            )}

            {errorAguardando && (
              <div className="m-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold">Erro ao carregar</p>
                  <p className="text-xs text-red-600 mt-0.5">{errorAguardando}</p>
                </div>
                <button onClick={() => setErrorAguardando(null)} className="text-red-400 hover:text-red-600">
                  <X size={14} />
                </button>
              </div>
            )}

            {!loadingAguardando && aguardando.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-amber-50/60 border-b border-amber-100">
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide whitespace-nowrap">
                        Nº Serviço / Término
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                        Serial Buscado
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                        Matrícula
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                        Importado em
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aguardando.map((s) => (
                      <AguardandoRow
                        key={s.servico}
                        servico={s}
                        onVinculado={handleVinculadoDeAguardando}
                        onRevertido={handleRevertido}
                        onExcluido={handleExcluidoDeAguardando}
                        onDesatualizado={reloadAll}
                        addToast={addToast}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination
              page={pageAguardando}
              totalPages={totalPagesAguardando}
              totalItems={totalAguardando}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setPageAguardando(p)}
              label="aguardando"
            />
          </section>
        )}
      </div>
    </div>
  );
}
