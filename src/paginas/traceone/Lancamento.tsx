
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "@/lib/navegacao";
import {
  Plus,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  User,
  CalendarDays,
  Barcode,
  Package,
  ShieldAlert,
  RefreshCw,
  Clock,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import {
  getColaboradores,
  createMedidores,
  getTiposMedidores,
  verificarMedidorAtribuido,
  reatribuirMedidor,
} from "@/lib/api";
import type { ConflictoInfo } from "@/lib/api";
import type { Colaborador, TipoMedidor } from "@/lib/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const [year, month, day] = clean.split("-");
  return `${day}-${month}-${year}`;
}

type SerialStatus = "idle" | "checking" | "ok" | "conflict";

// ─── SAP Material search component ───────────────────────────────────────────
interface SapSearchProps {
  tipos: TipoMedidor[];
  selected: TipoMedidor | null;
  onSelect: (t: TipoMedidor | null) => void;
}

function SapSearch({ tipos, selected, onSelect }: SapSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() =>
    tipos.filter(
      (t) =>
        t.cod_sap.includes(query.trim()) ||
        t.tipo.toLowerCase().includes(query.toLowerCase())
    ),
    [tipos, query]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1) {
        onSelect(filtered[0]);
        setQuery("");
        setOpen(false);
      } else {
        const exact = filtered.find((t) => t.cod_sap === query.trim());
        if (exact) { onSelect(exact); setQuery(""); setOpen(false); }
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Material SAP</label>
      {selected ? (
        <div className="flex items-center gap-3 p-3 bg-sinal-fundo border border-sinal-fundo rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-sinal flex items-center justify-center shrink-0">
            <Package size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">{selected.cod_sap}</p>
            <p className="text-xs text-slate-600 truncate">{selected.tipo}</p>
            <p className="text-xs text-sinal font-semibold mt-0.5">
              {selected.ligacao === "direto" ? "Ligação Direta" : "Ligação Indireta"} · R$ {selected.valor.toFixed(2)}
            </p>
          </div>
          <button type="button" onClick={() => { onSelect(null); setQuery(""); }}
            className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors text-slate-400">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={inputRef} type="text" value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)} onKeyDown={handleKeyDown}
              placeholder="Digite o código SAP e pressione Enter..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sinal focus:border-sinal transition-all"
            />
          </div>
          {open && query.length > 0 && (
            <div className="absolute z-30 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {filtered.length === 0
                ? <p className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum material encontrado</p>
                : filtered.map((t) => (
                  <button key={t.cod_sap} type="button"
                    onMouseDown={(e) => { e.preventDefault(); onSelect(t); setQuery(""); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-sinal-fundo transition-colors text-left">
                    <span className="font-codigo text-sm font-bold text-sinal w-16 shrink-0">{t.cod_sap}</span>
                    <span className="text-sm text-slate-700 truncate flex-1">{t.tipo}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${t.ligacao === "direto" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                      {t.ligacao === "direto" ? "Direto" : "Indireto"}
                    </span>
                  </button>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Colaborador search component ─────────────────────────────────────────────
interface ColabSearchProps {
  colaboradores: Colaborador[];
  selected: Colaborador | null;
  onSelect: (c: Colaborador | null) => void;
}

function ColabSearch({ colaboradores, selected, onSelect }: ColabSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() =>
    colaboradores.filter(
      (c) =>
        c.matricula.toLowerCase().includes(query.toLowerCase()) ||
        c.nome.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10),
    [colaboradores, query]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1) {
        onSelect(filtered[0]);
        setQuery("");
        setOpen(false);
      } else {
        const exact = filtered.find((c) => c.matricula.toLowerCase() === query.trim().toLowerCase());
        if (exact) { onSelect(exact); setQuery(""); setOpen(false); }
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Colaborador / Matrícula</label>
      {selected ? (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <User size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">{selected.nome}</p>
            <p className="text-xs font-codigo text-slate-500">{selected.matricula}</p>
            {selected.supervisor && <p className="text-xs text-emerald-600 font-semibold mt-0.5">Supervisor: {selected.supervisor}</p>}
          </div>
          <button type="button" onClick={() => onSelect(null)}
            className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors text-slate-400">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)} onKeyDown={handleKeyDown}
              placeholder="Buscar por matrícula ou nome..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
          {open && query.length > 0 && (
            <div className="absolute z-30 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {filtered.length === 0
                ? <p className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum colaborador encontrado</p>
                : filtered.map((c) => (
                  <button key={c.matricula} type="button"
                    onMouseDown={(e) => { e.preventDefault(); onSelect(c); setQuery(""); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <User size={14} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{c.nome}</p>
                      <p className="text-xs font-codigo text-slate-500">{c.matricula}</p>
                    </div>
                    {c.supervisor && <span className="text-xs font-medium text-slate-400 shrink-0">{c.supervisor}</span>}
                  </button>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal de Conflito de Reatribuição ───────────────────────────────────────
interface ModalConflitoProps {
  conflito: ConflictoInfo;
  novaMatricula: string | null;
  nomeNovaMatricula: string | null;
  onConfirmar: () => Promise<void>;
  onCancelar: () => void;
  confirmando: boolean;
  totalConflitos: number;
  indexAtual: number;
}

function ModalConflitoReatribuicao({
  conflito, novaMatricula, nomeNovaMatricula,
  onConfirmar, onCancelar, confirmando, totalConflitos, indexAtual,
}: ModalConflitoProps) {
  const mesmaMatricula = novaMatricula === conflito.matricula_atual;

  return (
    <div className="fixed inset-0 bg-tinta/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-900">Medidor já atribuído</h3>
            {totalConflitos > 1 && (
              <p className="text-xs text-amber-600 mt-0.5">Conflito {indexAtual + 1} de {totalConflitos}</p>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <Barcode size={16} className="text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 font-semibold">Serial:</span>
            <span className="text-sm font-codigo font-bold text-slate-900">{conflito.serial}</span>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Atribuição atual</p>
            <div className="flex items-center gap-2">
              <User size={14} className="text-red-500 shrink-0" />
              <span className="text-sm font-bold text-red-900">{conflito.nome_colaborador}</span>
              <span className="text-xs font-codigo text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{conflito.matricula_atual}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-red-700">
              <span className="flex items-center gap-1"><CalendarDays size={12} /> Desde {formatDateBR(conflito.data_atribuicao)}</span>
              <span className="flex items-center gap-1 font-bold"><Clock size={12} /> {conflito.dias_atribuido} dia{conflito.dias_atribuido !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {!mesmaMatricula && novaMatricula && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                  <ArrowRight size={14} className="text-sinal" /> Reatribuir para
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">Nova atribuição</p>
                <div className="flex items-center gap-2">
                  <User size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-sm font-bold text-emerald-900">{nomeNovaMatricula}</span>
                  <span className="text-xs font-codigo text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">{novaMatricula}</span>
                </div>
              </div>
            </>
          )}

          {mesmaMatricula && (
            <div className="p-3 bg-sinal-fundo border border-sinal-fundo rounded-xl">
              <p className="text-xs text-sinal-forte font-semibold">
                ⚠️ Este medidor já está atribuído ao mesmo colaborador selecionado. Remova o serial da lista ou selecione outro colaborador.
              </p>
            </div>
          )}

          {!novaMatricula && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-600 font-semibold">Selecione um colaborador para reatribuir este medidor.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button type="button" onClick={onCancelar} disabled={confirmando}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50">
            Remover da lista
          </button>
          <button type="button" onClick={onConfirmar}
            disabled={confirmando || !novaMatricula || mesmaMatricula}
            className="flex-1 px-4 py-2.5 bg-amber-600 text-white font-bold text-sm rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {confirmando
              ? <><Loader2 size={15} className="animate-spin" /> Reatribuindo...</>
              : <><RefreshCw size={15} /> Confirmar Reatribuição</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LancamentoManualPage() {
  const router = useRouter();

  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [dataAtribuicao, setDataAtribuicao] = useState(new Date().toISOString().split("T")[0]);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoMedidor | null>(null);
  const [serialInput, setSerialInput] = useState("");

  const serials = useMemo(() =>
    serialInput.split(",").map((s) => s.trim()).filter((s) => s.length > 0),
    [serialInput]
  );

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [tipos, setTipos] = useState<TipoMedidor[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ count: number; reatribuidos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-serial verification state
  const [serialStatuses, setSerialStatuses] = useState<Record<string, SerialStatus>>({});
  const [serialConflicts, setSerialConflicts] = useState<Record<string, ConflictoInfo>>({});
  const [serialsReatribuidos, setSerialsReatribuidos] = useState<string[]>([]);
  const [confirmandoReatribuicao, setConfirmandoReatribuicao] = useState(false);
  const [modalConflito, setModalConflito] = useState<ConflictoInfo | null>(null);

  const verifiedRef = useRef(new Set<string>());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Derived: active conflicts not yet resolved
  const conflitosAtivos = useMemo(
    () => Object.values(serialConflicts).filter((c) => !serialsReatribuidos.includes(c.serial)),
    [serialConflicts, serialsReatribuidos]
  );

  useEffect(() => {
    getColaboradores().then(setColaboradores).catch(console.error);
    getTiposMedidores(false).then(setTipos).catch(console.error);
  }, []);

  // ─── Clean up status when serials change ──────────────────────────────────
  const serialsKey = serials.join(",");
  useEffect(() => {
    const serialSet = new Set(serials);
    setSerialStatuses((prev) => {
      const next: Record<string, SerialStatus> = {};
      serials.forEach((s) => { if (prev[s]) next[s] = prev[s]; });
      return next;
    });
    setSerialConflicts((prev) => {
      const next: Record<string, ConflictoInfo> = {};
      serials.forEach((s) => { if (prev[s]) next[s] = prev[s]; });
      return next;
    });
    for (const s of [...verifiedRef.current]) {
      if (!serialSet.has(s)) verifiedRef.current.delete(s);
    }
  }, [serialsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Debounced verification after typing ───────────────────────────────────
  const reatribuidosKey = serialsReatribuidos.join(",");
  useEffect(() => {
    if (serials.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      for (const s of serials) {
        if (verifiedRef.current.has(s) || serialsReatribuidos.includes(s)) continue;
        setSerialStatuses((prev) => ({ ...prev, [s]: "checking" }));
        try {
          const conflict = await verificarMedidorAtribuido(s);
          verifiedRef.current.add(s);
          if (conflict) {
            setSerialStatuses((prev) => ({ ...prev, [s]: "conflict" }));
            setSerialConflicts((prev) => ({ ...prev, [s]: conflict }));
          } else {
            setSerialStatuses((prev) => ({ ...prev, [s]: "ok" }));
          }
        } catch {
          verifiedRef.current.add(s);
          setSerialStatuses((prev) => ({ ...prev, [s]: "ok" }));
        }
      }
    }, 700);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [serialsKey, reatribuidosKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Reatribuição ─────────────────────────────────────────────────────────
  const handleConfirmarReatribuicao = async () => {
    if (!modalConflito || !colaborador || !tipoSelecionado) return;
    setConfirmandoReatribuicao(true);
    try {
      await reatribuirMedidor({
        serial: modalConflito.serial,
        novaMatricula: colaborador.matricula,
        sapMaterialId: tipoSelecionado.cod_sap,
      });
      setSerialsReatribuidos((prev) => [...prev, modalConflito.serial]);
      setSerialStatuses((prev) => ({ ...prev, [modalConflito.serial]: "ok" }));
      setSerialConflicts((prev) => {
        const next = { ...prev };
        delete next[modalConflito.serial];
        return next;
      });
      setModalConflito(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reatribuir medidor.");
      setModalConflito(null);
    } finally {
      setConfirmandoReatribuicao(false);
    }
  };

  const handleCancelarReatribuicao = () => {
    if (!modalConflito) return;
    const novosSerials = serials.filter((s) => s !== modalConflito.serial);
    setSerialInput(novosSerials.join(", "));
    setModalConflito(null);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const serialsParaInserir = serials.filter((s) => !serialsReatribuidos.includes(s));
  const temConflitosNaoResolvidos = conflitosAtivos.length > 0;

  const canSubmit =
    colaborador &&
    dataAtribuicao &&
    tipoSelecionado &&
    (serialsParaInserir.length > 0 || serialsReatribuidos.length > 0) &&
    !temConflitosNaoResolvidos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let inserted = 0;
      if (serialsParaInserir.length > 0) {
        const payloads = serialsParaInserir.map((serial) => ({
          data: dataAtribuicao,
          material_sap: tipoSelecionado!.cod_sap,
          serial,
          matricula: colaborador!.matricula,
        }));
        await createMedidores(payloads);
        inserted = serialsParaInserir.length;
      }

      setSuccess({ count: inserted + serialsReatribuidos.length, reatribuidos: serialsReatribuidos.length });
      setSerialInput("");
      setTipoSelecionado(null);
      setSerialsReatribuidos([]);
      setSerialStatuses({});
      setSerialConflicts({});
      verifiedRef.current.clear();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("idx_medidor_serial_pendente_unico") || msg.includes("duplicate key")) {
        setError("Um ou mais seriais já estão atribuídos e pendentes. Verifique os seriais destacados e resolva os conflitos antes de salvar.");
      } else {
        setError(msg || "Erro ao salvar lançamentos.");
      }
    } finally {
      setSaving(false);
    }
  };

  const hasAnyChecking = Object.values(serialStatuses).some((s) => s === "checking");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-tinta">Lançamento Manual</h2>
        <p className="text-sm text-aco mt-0.5">Atribua medidores a um colaborador de uma vez só</p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold">Lançamento realizado com sucesso!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {success.count} medidor{success.count > 1 ? "es processados" : " processado"}
              {success.reatribuidos > 0 && ` (${success.reatribuidos} reatribuído${success.reatribuidos > 1 ? "s" : ""})`}.
            </p>
          </div>
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-500 hover:text-emerald-700"><X size={16} /></button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold">Erro ao lançar</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800">Dados do Lançamento</h3>
        </div>

        <div className="p-6 space-y-6">
          {/* 1 - Colaborador */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-sinal text-white flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <span className="text-sm font-bold text-slate-700">Colaborador</span>
            </div>
            <ColabSearch colaboradores={colaboradores} selected={colaborador} onSelect={setColaborador} />
          </div>

          <div className="border-t border-slate-100" />

          {/* 2 - Data */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-sinal text-white flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <span className="text-sm font-bold text-slate-700">Data de Atribuição</span>
            </div>
            <div className="relative">
              <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="date" value={dataAtribuicao} onChange={(e) => setDataAtribuicao(e.target.value)} required
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sinal focus:border-sinal transition-all"
              />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* 3 - Material SAP */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-sinal text-white flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <span className="text-sm font-bold text-slate-700">Material SAP</span>
            </div>
            <SapSearch tipos={tipos} selected={tipoSelecionado} onSelect={setTipoSelecionado} />
          </div>

          <div className="border-t border-slate-100" />

          {/* 4 - Seriais */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-sinal text-white flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <span className="text-sm font-bold text-slate-700">Números de Série</span>
              {hasAnyChecking && (
                <span className="flex items-center gap-1.5 text-xs text-sinal font-semibold ml-auto">
                  <Loader2 size={12} className="animate-spin" /> Verificando...
                </span>
              )}
            </div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
              Seriais (separados por vírgula)
            </label>
            <div className="relative">
              <Barcode size={15} className="absolute left-3 top-3.5 text-slate-400" />
              <textarea
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="AMN258018041, AMN258018045, AMN258018188..."
                rows={4}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-codigo font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sinal focus:border-sinal transition-all resize-none"
              />
            </div>

            {/* Serial chips with status */}
            {serials.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">
                    {serials.length} medidor{serials.length > 1 ? "es" : ""}
                    {serialsReatribuidos.length > 0 && (
                      <span className="ml-1.5 text-amber-600">({serialsReatribuidos.length} reatribuído{serialsReatribuidos.length > 1 ? "s" : ""})</span>
                    )}
                  </span>
                  <button type="button"
                    onClick={() => { setSerialInput(""); setSerialsReatribuidos([]); setSerialStatuses({}); setSerialConflicts({}); verifiedRef.current.clear(); }}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
                    <Trash2 size={12} /> Limpar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {serials.map((s, i) => {
                    const status = serialStatuses[s] ?? "idle";
                    const conflito = serialConflicts[s];
                    const reatribuido = serialsReatribuidos.includes(s);

                    let chipClass = "bg-white border-slate-200 text-slate-700";
                    let badgeClass = "bg-sinal";
                    let badgeContent: React.ReactNode = i + 1;

                    if (status === "checking") {
                      chipClass = "bg-sinal-fundo border-sinal-fundo text-sinal-forte";
                      badgeClass = "bg-sinal-claro";
                      badgeContent = <Loader2 size={8} className="animate-spin" />;
                    } else if (reatribuido) {
                      chipClass = "bg-emerald-50 border-emerald-300 text-emerald-700";
                      badgeClass = "bg-emerald-500";
                      badgeContent = <CheckCircle size={8} />;
                    } else if (status === "ok") {
                      chipClass = "bg-emerald-50 border-emerald-200 text-emerald-700";
                      badgeClass = "bg-emerald-500";
                      badgeContent = "✓";
                    } else if (status === "conflict" && conflito) {
                      chipClass = "bg-amber-50 border-amber-400 text-amber-800 shadow-sm";
                      badgeClass = "bg-amber-500";
                      badgeContent = "!";
                    }

                    return (
                      <div key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-codigo font-semibold ${chipClass}`}>
                        <span className={`w-4 h-4 text-white text-[9px] rounded-full flex items-center justify-center font-bold shrink-0 ${badgeClass}`}>
                          {badgeContent}
                        </span>
                        {s}
                        {status === "conflict" && conflito && !reatribuido && (
                          <button
                            type="button"
                            onClick={() => setModalConflito(conflito)}
                            className="ml-1 flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded-full transition-colors border border-amber-300"
                          >
                            <RefreshCw size={9} /> Reatribuir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Conflict summary banner */}
                {conflitosAtivos.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
                    <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-800">
                        {conflitosAtivos.length} serial{conflitosAtivos.length > 1 ? "is" : ""} já atribuído{conflitosAtivos.length > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Clique em "Reatribuir" em cada serial para resolver o conflito antes de salvar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalConflito(conflitosAtivos[0])}
                      className="text-xs font-bold text-amber-800 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      Resolver
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer + Submit */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          {canSubmit && (
            <div className="mb-4 p-3 bg-sinal/5 border border-sinal/10 rounded-xl text-sm text-slate-700">
              <p className="font-semibold text-sinal mb-1">Resumo do lançamento</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                <span><b>Colaborador:</b> {colaborador?.nome}</span>
                <span><b>Matrícula:</b> {colaborador?.matricula}</span>
                <span><b>Data:</b> {dataAtribuicao}</span>
                <span><b>Material:</b> {tipoSelecionado?.cod_sap} — {tipoSelecionado?.tipo}</span>
                <span className="col-span-2">
                  <b>Medidores:</b> {serialsParaInserir.length} novo{serialsParaInserir.length !== 1 ? "s" : ""}
                  {serialsReatribuidos.length > 0 && `, ${serialsReatribuidos.length} reatribuído${serialsReatribuidos.length !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
          )}

          {temConflitosNaoResolvidos && (
            <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-semibold text-amber-800">
                ⚠️ Resolva todos os conflitos antes de salvar.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => router.push("/traceone")}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={!canSubmit || saving}
              className="flex-1 px-4 py-2.5 bg-sinal text-white font-bold text-sm rounded-xl hover:bg-sinal-forte transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                : <><Plus size={16} /> Lançar {serialsParaInserir.length + serialsReatribuidos.length > 0
                  ? `${serialsParaInserir.length + serialsReatribuidos.length} medidor${serialsParaInserir.length + serialsReatribuidos.length > 1 ? "es" : ""}`
                  : "Medidores"}</>
              }
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Conflito */}
      {modalConflito && (
        <ModalConflitoReatribuicao
          conflito={modalConflito}
          novaMatricula={colaborador?.matricula ?? null}
          nomeNovaMatricula={colaborador?.nome ?? null}
          onConfirmar={handleConfirmarReatribuicao}
          onCancelar={handleCancelarReatribuicao}
          confirmando={confirmandoReatribuicao}
          totalConflitos={conflitosAtivos.length}
          indexAtual={0}
        />
      )}
    </div>
  );
}
