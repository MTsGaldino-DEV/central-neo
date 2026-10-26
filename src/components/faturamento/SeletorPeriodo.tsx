import { useEffect, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PeriodoFat { de: string; ate: string }

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const pad = (n: number) => String(n).padStart(2, '0');
const ultimoDia = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate();
const intervalo = (ano1: number, mes1: number, ano2: number, mes2: number): PeriodoFat =>
  ({ de: `${ano1}-${pad(mes1 + 1)}-01`, ate: `${ano2}-${pad(mes2 + 1)}-${pad(ultimoDia(ano2, mes2))}` });

/** "jul – set / 2026", "set / 2026" ou "nov/2025 – jan/2026". */
export function rotuloPeriodo({ de, ate }: PeriodoFat): string {
  if (!de || !ate) return 'todo o período';
  const [a1, m1] = [Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1];
  const [a2, m2] = [Number(ate.slice(0, 4)), Number(ate.slice(5, 7)) - 1];
  if (a1 === a2 && m1 === m2) return `${MESES[m1]} / ${a1}`;
  if (a1 === a2) return `${MESES[m1]} – ${MESES[m2]} / ${a1}`;
  return `${MESES[m1]}/${a1} – ${MESES[m2]}/${a2}`;
}

/** Atalhos contados a partir do mês de referência (o fim da fatura mais recente). */
export function atalhoPeriodo(atalho: 'mes' | '3m' | '6m' | 'ano', referencia: string): PeriodoFat {
  const ano = Number(referencia.slice(0, 4)), mes = Number(referencia.slice(5, 7)) - 1;
  if (atalho === 'ano') return intervalo(ano, 0, ano, 11);
  const voltar = { mes: 0, '3m': 2, '6m': 5 }[atalho];
  const inicio = new Date(ano, mes - voltar, 1);
  return intervalo(inicio.getFullYear(), inicio.getMonth(), ano, mes);
}

/** Fecha um popover com Esc ou clique fora do elemento. */
export function useFecharFora(ref: RefObject<HTMLElement | null>, aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fechar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('mousedown', clique);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', clique); document.removeEventListener('keydown', tecla); };
  }, [ref, aberto, fechar]);
}

/** Painel de período: atalhos e grade de meses; dois cliques definem o intervalo. */
export function SeletorPeriodo({ de, ate, referencia, onChange }: PeriodoFat & { referencia: string; onChange: (p: PeriodoFat) => void }) {
  const [ano, setAno] = useState(Number((ate || referencia).slice(0, 4)));
  const [primeiro, setPrimeiro] = useState<{ ano: number; mes: number } | null>(null);
  const chave = (a: number, m: number) => a * 12 + m;
  const deK = de ? chave(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1) : -1;
  const ateK = ate ? chave(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)) - 1) : -1;
  const atalhos = [['mes', 'Este mês'], ['3m', '3 meses'], ['6m', '6 meses'], ['ano', 'Ano']] as const;
  const ativo = atalhos.find(([a]) => { const p = atalhoPeriodo(a, referencia); return p.de === de && p.ate === ate; })?.[0];

  const escolher = (mes: number) => {
    if (!primeiro) { setPrimeiro({ ano, mes }); return; }
    const [x, y] = [chave(primeiro.ano, primeiro.mes), chave(ano, mes)].sort((p, q) => p - q);
    setPrimeiro(null);
    onChange(intervalo(Math.floor(x / 12), x % 12, Math.floor(y / 12), y % 12));
  };

  return (
    <div className="w-[300px] max-w-[calc(100vw-32px)] rounded-xl border border-linha bg-white p-3 shadow-lg">
      <div className="flex gap-0.5 rounded-lg bg-nevoa p-0.5" role="group" aria-label="Atalhos de período">
        {atalhos.map(([a, rotulo]) => (
          <button key={a} type="button" onClick={() => onChange(atalhoPeriodo(a, referencia))} aria-pressed={ativo === a}
            className={`flex-1 rounded-md px-1.5 py-1.5 text-xs font-bold whitespace-nowrap ${ativo === a ? 'bg-white text-sinal shadow-sm' : 'text-aco hover:text-tinta'}`}>{rotulo}</button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" aria-label="Ano anterior" onClick={() => setAno(a => a - 1)} className="grid size-7 place-items-center rounded-md text-aco hover:bg-nevoa"><ChevronLeft className="size-4" /></button>
        <span className="font-codigo text-sm font-bold">{ano}</span>
        <button type="button" aria-label="Próximo ano" onClick={() => setAno(a => a + 1)} className="grid size-7 place-items-center rounded-md text-aco hover:bg-nevoa"><ChevronRight className="size-4" /></button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {MESES.map((m, i) => {
          const k = chave(ano, i), marcado = primeiro ? k === chave(primeiro.ano, primeiro.mes) : k >= deK && k <= ateK;
          return (
            <button key={m} type="button" onClick={() => escolher(i)} aria-pressed={marcado}
              className={`rounded-md py-1.5 text-xs font-bold capitalize ${marcado ? 'bg-sinal text-white' : 'text-tinta hover:bg-sinal-fundo'}`}>{m}</button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-aco">{primeiro ? 'Agora clique no mês final.' : 'Clique no mês inicial e depois no final.'}</p>
    </div>
  );
}
