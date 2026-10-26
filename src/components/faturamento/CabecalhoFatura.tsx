import { useCallback, useRef, useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { tempoRelativo } from '../../lib/cacheTela';
import { rotuloPeriodo, SeletorPeriodo, useFecharFora, type PeriodoFat } from './SeletorPeriodo';

const parte = 'border-b-2 border-dashed border-sinal text-sinal hover:text-sinal-forte focus-visible:outline-2 focus-visible:outline-sinal';

/** Título-filtro das telas de Faturamento: "Fatura 9844 ▾ · jul – set / 2026 ▾". */
export function CabecalhoFatura({ faturas, fatura, periodo, onFatura, onPeriodo, salvoEm, atualizando, onRecarregar, acoes, rotulo, permitirTodas = true }: {
  faturas: { id: string; inicio: string; fim: string }[]; fatura: string | null; periodo: PeriodoFat;
  onFatura: (id: string | null) => void; onPeriodo: (p: PeriodoFat) => void;
  salvoEm: number | null; atualizando: boolean; onRecarregar: () => void; acoes?: ReactNode; rotulo: string;
  /** false onde somar todas as faturas pesa demais (Conferência). */
  permitirTodas?: boolean;
}) {
  const [aberto, setAberto] = useState<'fatura' | 'periodo' | null>(null);
  const caixaFatura = useRef<HTMLDivElement>(null), caixaPeriodo = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => setAberto(null), []);
  useFecharFora(caixaFatura, aberto === 'fatura', fechar);
  useFecharFora(caixaPeriodo, aberto === 'periodo', fechar);
  const referencia = faturas[0]?.fim ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-linha bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-wide text-aco uppercase">{rotulo}</p>
        <h1 className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-lg font-extrabold text-tinta sm:text-xl">
          <span>Fatura</span>
          <span ref={caixaFatura} className="relative">
            <button type="button" className={`font-codigo ${parte}`} aria-haspopup="listbox" aria-expanded={aberto === 'fatura'}
              onClick={() => setAberto(a => a === 'fatura' ? null : 'fatura')}>{fatura ?? 'todas'} ▾</button>
            {aberto === 'fatura' && (
              <ul role="listbox" aria-label="Escolher fatura" className="absolute left-0 z-30 mt-2 max-h-72 w-56 overflow-auto rounded-xl border border-linha bg-white p-1 text-sm font-semibold shadow-lg">
                {[...(permitirTodas ? [{ id: null as string | null, texto: 'Todas as faturas', sub: 'soma do período' }] : []), ...faturas.map(f => ({ id: f.id as string | null, texto: `Fatura ${f.id}`, sub: rotuloPeriodo({ de: f.inicio, ate: f.fim }) }))].map(o => (
                  <li key={o.id ?? 'todas'} role="option" aria-selected={o.id === fatura}>
                    <button type="button" onClick={() => { onFatura(o.id); setAberto(null); }}
                      className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-sinal-fundo ${o.id === fatura ? 'text-sinal' : 'text-tinta'}`}>
                      <span>{o.texto}</span><span className="text-[11px] font-normal text-aco">{o.sub}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
          <span className="font-semibold text-aco-claro">·</span>
          <span ref={caixaPeriodo} className="relative">
            <button type="button" className={parte} aria-haspopup="dialog" aria-expanded={aberto === 'periodo'}
              onClick={() => setAberto(a => a === 'periodo' ? null : 'periodo')}>{rotuloPeriodo(periodo)} ▾</button>
            {aberto === 'periodo' && (
              <div className="absolute left-0 z-30 mt-2 text-base font-normal">
                <SeletorPeriodo {...periodo} referencia={referencia} onChange={p => { onPeriodo(p); setAberto(null); }} />
              </div>
            )}
          </span>
        </h1>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" onClick={onRecarregar} disabled={atualizando}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-aco hover:bg-nevoa disabled:opacity-70" title="Atualizar agora">
          {atualizando ? 'atualizando…' : salvoEm ? `atualizado ${tempoRelativo(salvoEm)}` : 'atualizar'}
          <RotateCw className={`size-3.5 ${atualizando ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
        </button>
        {acoes}
      </div>
    </div>
  );
}
