import { useCallback, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { atalhoPeriodo, rotuloPeriodo, SeletorPeriodo, useFecharFora, type PeriodoFat } from './SeletorPeriodo';

const pilula = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sinal';
const cor = (ativo: boolean) => ativo ? 'border-sinal bg-sinal text-white' : 'border-linha bg-white text-tinta hover:border-sinal hover:text-sinal';
const ATALHOS = [['mes', 'Este mês'], ['3m', '3 meses'], ['6m', '6 meses'], ['ano', 'Ano']] as const;

/** Fatura e período em pílulas: "Fatura 9844 ▾ · Este mês · 3 meses · 6 meses · Ano · Período". */
export function PilulasPeriodo({ faturas, fatura, periodo, referencia, onFatura, onPeriodo, soFatura = false }: {
  faturas: { id: string; inicio: string; fim: string }[]; fatura: string | null; periodo: PeriodoFat; referencia: string;
  onFatura: (id: string) => void; onPeriodo: (p: PeriodoFat) => void;
  /** Conferência: só a escolha da fatura (uma por vez). */
  soFatura?: boolean;
}) {
  const [aberto, setAberto] = useState<'fatura' | 'periodo' | null>(null);
  const caixaFatura = useRef<HTMLDivElement>(null), caixaPeriodo = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => setAberto(null), []);
  useFecharFora(caixaFatura, aberto === 'fatura', fechar);
  useFecharFora(caixaPeriodo, aberto === 'periodo', fechar);
  const atalho = fatura ? null : ATALHOS.find(([a]) => { const x = atalhoPeriodo(a, referencia); return x.de === periodo.de && x.ate === periodo.ate; })?.[0] ?? null;
  const personalizado = !fatura && !atalho;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div ref={caixaFatura} className="relative">
        <button type="button" aria-haspopup="listbox" aria-expanded={aberto === 'fatura'} onClick={() => setAberto(a => a === 'fatura' ? null : 'fatura')}
          className={`${pilula} ${cor(!!fatura && !soFatura)}`}>Fatura <span className="font-codigo">{fatura ?? '—'}</span><ChevronDown className="size-3.5" aria-hidden="true" /></button>
        {aberto === 'fatura' && (
          <ul role="listbox" aria-label="Escolher fatura" className="absolute right-0 z-30 mt-2 max-h-72 w-56 overflow-auto rounded-xl border border-linha bg-white p-1 text-sm font-semibold shadow-lg">
            {faturas.map(f => (
              <li key={f.id} role="option" aria-selected={f.id === fatura}>
                <button type="button" onClick={() => { onFatura(f.id); setAberto(null); }}
                  className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-sinal-fundo ${f.id === fatura ? 'text-sinal' : 'text-tinta'}`}>
                  <span>Fatura {f.id}</span><span className="text-[11px] font-normal text-aco">{rotuloPeriodo({ de: f.inicio, ate: f.fim })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!soFatura && <>
        {ATALHOS.map(([a, rotulo]) => (
          <button key={a} type="button" aria-pressed={atalho === a} onClick={() => onPeriodo(atalhoPeriodo(a, referencia))}
            className={`${pilula} ${cor(atalho === a)}`}>{rotulo}</button>
        ))}
        <div ref={caixaPeriodo} className="relative">
          <button type="button" aria-haspopup="dialog" aria-expanded={aberto === 'periodo'} aria-pressed={personalizado}
            onClick={() => setAberto(a => a === 'periodo' ? null : 'periodo')} className={`${pilula} ${cor(personalizado)}`}>
            <CalendarDays className="size-3.5" aria-hidden="true" />{personalizado ? rotuloPeriodo(periodo) : 'Período'}
          </button>
          {aberto === 'periodo' && (
            <div className="absolute right-0 z-30 mt-2 text-base font-normal">
              <SeletorPeriodo {...periodo} referencia={referencia} onChange={x => { onPeriodo(x); setAberto(null); }} />
            </div>
          )}
        </div>
      </>}
    </div>
  );
}
