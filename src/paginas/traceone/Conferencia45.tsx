
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Link2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Undo2,
  Search,
} from "lucide-react";
import {
  getMedidoresConferencia45Dias,
  getConferencia45DiasOcultos,
  ocultarMedidor45Dias,
  reverterOcultarMedidor45Dias,
  vincularServicoGdisMedidor,
} from "@/lib/api";
import type {
  MedidorConferencia45Dias,
  MedidorConferencia45DiasOculto,
} from "@/lib/api";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 100;

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastMsg {
  id: number;
  type: "success" | "error" | "info";
  text: string;
}

let toastCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((type: ToastMsg["type"], text: string) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return { toasts, addToast };
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────
interface RowProps {
  medidor: MedidorConferencia45Dias;
  onVinculado: (id: string) => void;
  onOcultar: (id: string) => void;
  addToast: (type: "success" | "error" | "info", text: string) => void;
  ocultando: boolean;
}

function MedidorRow({ medidor, onVinculado, onOcultar, addToast, ocultando }: RowProps) {
  const [servicoGdis, setServicoGdis] = useState(medidor.servicoGdis ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const dataFormatada = (() => {
    try {
      return new Date(medidor.data).toLocaleDateString("pt-BR");
    } catch {
      return medidor.data;
    }
  })();

  const jaVinculado = !!medidor.servicoGdis;

  const handleVincular = useCallback(async () => {
    const s = servicoGdis.trim();
    if (!s || s === medidor.servicoGdis) return;
    setSalvando(true);
    setErro(null);
    try {
      await vincularServicoGdisMedidor(medidor.id, s);
      addToast("success", `✅ Serviço GDIS ${s} vinculado ao medidor ${medidor.serial}`);
      onVinculado(medidor.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao vincular.");
    } finally {
      setSalvando(false);
    }
  }, [servicoGdis, medidor.id, medidor.servicoGdis, medidor.serial, addToast, onVinculado]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVincular();
    }
  };

  const diasClasse =
    medidor.dias > 90
      ? "text-red-700 bg-red-50 border-red-200"
      : medidor.dias > 60
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-700 bg-slate-50 border-slate-200";

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-black rounded-md border ${diasClasse}`}>
          {medidor.dias} dias
        </span>
      </td>

      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{dataFormatada}</td>

      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-codigo text-sm font-bold text-slate-800">{medidor.serial}</span>
      </td>

      <td className="px-4 py-3 text-xs text-slate-600 font-codigo whitespace-nowrap">
        {medidor.matricula || <span className="text-slate-300">—</span>}
      </td>

      <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate">
        {medidor.colaborador || <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={servicoGdis}
            onChange={(e) => {
              setServicoGdis(e.target.value);
              setErro(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Nº serviço GDIS"
            className={`w-40 px-3 py-1.5 border rounded-lg text-xs font-codigo font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              erro
                ? "border-red-400 focus:ring-red-300 bg-red-50"
                : jaVinculado
                ? "border-emerald-300 bg-emerald-50 focus:ring-emerald-300"
                : "border-slate-300 focus:ring-sinal-claro focus:border-sinal-claro"
            }`}
          />
          <button
            type="button"
            onClick={handleVincular}
            disabled={!servicoGdis.trim() || servicoGdis.trim() === medidor.servicoGdis || salvando}
            title="Vincular (ou Enter)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sinal text-white text-xs font-bold rounded-lg hover:bg-sinal-forte transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
          >
            {salvando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            {salvando ? "…" : jaVinculado ? "Atualizar" : "Vincular"}
          </button>
          <button
            type="button"
            onClick={() => onOcultar(medidor.id)}
            disabled={ocultando}
            title="Ocultar (medidor não encontrado no GDIS) — fica oculto para toda a equipe"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 bg-slate-100 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {ocultando ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
          </button>
        </div>
        {erro && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle size={11} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-600 font-semibold leading-tight">{erro}</p>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Linha da seção "Aguardando verificação" ─────────────────────────────────
interface OcultoRowProps {
  medidor: MedidorConferencia45DiasOculto;
  onReverter: (id: string) => void;
  revertendo: boolean;
}

function OcultoRow({ medidor, onReverter, revertendo }: OcultoRowProps) {
  const dataFormatada = (() => {
    try {
      return new Date(medidor.data).toLocaleDateString("pt-BR");
    } catch {
      return medidor.data;
    }
  })();

  const ocultadoEmFormatado = (() => {
    try {
      return new Date(medidor.ocultadoEm).toLocaleDateString("pt-BR");
    } catch {
      return "";
    }
  })();

  return (
    <tr className="border-b border-amber-100 hover:bg-amber-50/30 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-black rounded-md border text-amber-700 bg-amber-50 border-amber-200">
          {medidor.dias} dias
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{dataFormatada}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-codigo text-sm font-bold text-slate-800">{medidor.serial}</span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 font-codigo whitespace-nowrap">
        {medidor.matricula || <span className="text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate">
        {medidor.colaborador || <span className="text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
        <span className="font-semibold">{medidor.ocultadoPor}</span>
        <span className="text-slate-400 ml-1.5">{ocultadoEmFormatado}</span>
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => onReverter(medidor.id)}
          disabled={revertendo}
          title="Voltar para a lista de conferência"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          {revertendo ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
          Reverter
        </button>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Conferencia45DiasPage() {
  const [medidores, setMedidores] = useState<MedidorConferencia45Dias[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [diasAscending, setDiasAscending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocultos, setOcultos] = useState<MedidorConferencia45DiasOculto[]>([]);
  const [mexendoId, setMexendoId] = useState<string | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [serialFilter, setSerialFilter] = useState("");

  const { toasts, addToast } = useToasts();

  // Debounce: só busca 400ms depois de parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => {
      setSerialFilter(serialInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [serialInput]);

  // A lista já vem do banco sem os ocultos, então a paginação bate com a tela.
  const load = useCallback(async (p: number, ascending: boolean, serial: string) => {
    setLoading(true);
    setError(null);
    try {
      const [lista, listaOcultos] = await Promise.all([
        getMedidoresConferencia45Dias(p, PAGE_SIZE, ascending, 45, serial),
        getConferencia45DiasOcultos(),
      ]);
      setMedidores(lista.data);
      setTotal(lista.total);
      setOcultos(listaOcultos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, diasAscending, serialFilter);
  }, [page, diasAscending, serialFilter, load]);

  const handleToggleSort = () => {
    setDiasAscending((prev) => !prev);
    setPage(1);
  };

  const handleVinculado = useCallback((id: string) => {
    setMedidores((prev) => prev.filter((m) => m.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const handleOcultar = useCallback(
    async (id: string) => {
      const alvo = medidores.find((m) => m.id === id);
      setMexendoId(id);
      try {
        await ocultarMedidor45Dias(id);
        addToast("info", `Medidor ${alvo?.serial ?? ""} ocultado para toda a equipe.`);
        await load(page, diasAscending, serialFilter);
      } catch (err) {
        addToast("error", err instanceof Error ? err.message : "Erro ao ocultar.");
      } finally {
        setMexendoId(null);
      }
    },
    [medidores, addToast, load, page, diasAscending, serialFilter]
  );

  const handleReverter = useCallback(
    async (id: string) => {
      const alvo = ocultos.find((m) => m.id === id);
      setMexendoId(id);
      try {
        await reverterOcultarMedidor45Dias(id);
        addToast("info", `Medidor ${alvo?.serial ?? ""} voltou para a conferência.`);
        await load(page, diasAscending, serialFilter);
      } catch (err) {
        addToast("error", err instanceof Error ? err.message : "Erro ao reverter.");
      } finally {
        setMexendoId(null);
      }
    },
    [ocultos, addToast, load, page, diasAscending, serialFilter]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reload = () => load(page, diasAscending, serialFilter);

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
          <h2 className="text-sm font-bold text-slate-900">Conferência de Medidores +45 dias</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Medidores pendentes há mais de 45 dias. Consulte no GDIS e informe o número do serviço.
          </p>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            placeholder="Buscar serial…"
            className="w-48 h-9 pl-8 pr-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-1 focus:ring-sinal-claro font-codigo"
          />
        </div>

        {total > 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Pendentes +45 dias</p>
            <p className="text-lg font-black text-slate-900 leading-tight">{total}</p>
          </div>
        )}

        <button
          type="button"
          onClick={reload}
          disabled={loading}
          title="Recarregar"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Carregando…</span>
          </div>
        )}

        {error && (
          <div className="m-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold">Erro ao carregar</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {!loading && !error && medidores.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <CheckCircle2 size={32} className="text-emerald-400" />
            <p className="text-sm font-bold text-slate-600">Nenhum medidor +45 dias pendente!</p>
          </div>
        )}

        {!loading && medidores.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    <button
                      type="button"
                      onClick={handleToggleSort}
                      className="flex items-center gap-1 hover:text-slate-800 transition-colors"
                      title="Ordenar por dias de atribuição"
                    >
                      Dias
                      {diasAscending ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Data Atribuição
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Serial
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Matrícula
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Colaborador
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Serviço GDIS
                  </th>
                </tr>
              </thead>
              <tbody>
                {medidores.map((m) => (
                  <MedidorRow
                    key={m.id}
                    medidor={m}
                    onVinculado={handleVinculado}
                    onOcultar={handleOcultar}
                    addToast={addToast}
                    ocultando={mexendoId === m.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          label="medidores"
        />

        {/* ════════ SEÇÃO: AGUARDANDO VERIFICAÇÃO (ocultados) ════════ */}
        {ocultos.length > 0 && (
          <section className="border-t border-slate-200">
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <EyeOff size={13} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Aguardando verificação
              </span>
              <span className="ml-1 text-xs text-amber-500">
                — serviço não encontrado no GDIS, oculto para toda a equipe
              </span>
              <span className="ml-auto text-xs text-amber-500">
                {ocultos.length} medidor{ocultos.length !== 1 ? "es" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-amber-50/60 border-b border-amber-100">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide whitespace-nowrap">
                      Dias
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Data Atribuição
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Serial
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Matrícula
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Colaborador
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide whitespace-nowrap">
                      Ocultado por
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ocultos.map((m) => (
                    <OcultoRow
                      key={m.id}
                      medidor={m}
                      onReverter={handleReverter}
                      revertendo={mexendoId === m.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
