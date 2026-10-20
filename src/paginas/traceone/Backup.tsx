
import { useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, Loader2, X } from "lucide-react";
import { gerarBackupCompleto, TABELAS_BACKUP } from "@/lib/api";

function nomeArquivo() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `neo-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupPage() {
  const [gerando, setGerando] = useState(false);
  const [atual, setAtual] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Record<string, number>>({});
  const [concluido, setConcluido] = useState<{ arquivo: string; tamanho: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBaixar = async () => {
    setGerando(true);
    setError(null);
    setConcluido(null);
    setLinhas({});
    try {
      const backup = await gerarBackupCompleto((tabela, n) => {
        setAtual(tabela);
        setLinhas((prev) => ({ ...prev, [tabela]: n }));
      });

      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
      const arquivo = nomeArquivo();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = arquivo;
      a.click();
      URL.revokeObjectURL(url);

      setConcluido({ arquivo, tamanho: blob.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar o backup.");
    } finally {
      setGerando(false);
      setAtual(null);
    }
  };

  const totalLinhas = Object.values(linhas).reduce((s, n) => s + n, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4 flex-shrink-0">
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-900">Backup</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Baixa todas as tabelas do sistema num arquivo JSON. Pode levar alguns minutos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleBaixar}
          disabled={gerando}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {gerando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {gerando ? "Gerando…" : "Baixar backup"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold">Erro ao gerar o backup</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {concluido && (
          <div className="m-4 flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Backup baixado</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {concluido.arquivo} · {totalLinhas.toLocaleString("pt-BR")} linhas · {formatarTamanho(concluido.tamanho)}
              </p>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Tabela</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Linhas</th>
            </tr>
          </thead>
          <tbody>
            {TABELAS_BACKUP.map(({ tabela }) => (
              <tr key={tabela} className="border-b border-slate-100">
                <td className="px-4 py-3 text-xs text-slate-700 font-codigo">
                  <span className="inline-flex items-center gap-2">
                    {atual === tabela ? (
                      <Loader2 size={13} className="animate-spin text-slate-400" />
                    ) : (
                      <DatabaseBackup size={13} className="text-slate-300" />
                    )}
                    {tabela}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 font-codigo text-right">
                  {linhas[tabela] !== undefined ? linhas[tabela].toLocaleString("pt-BR") : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
