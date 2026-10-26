import { CORES, Simbolo } from '../NeoLogo';

const bloco = 'rounded-xl bg-linha/60 animate-pulse motion-reduce:animate-none';

/** Esqueleto da tela com o anel da NEO girando no centro, enquanto não há dados guardados. */
export function CarregandoNeo({ variante }: { variante: 'lista' | 'resumo' | 'conferencia' }) {
  return (
    <div className="relative" aria-busy="true" role="status">
      <span className="sr-only">Carregando dados do faturamento</span>
      <div className="space-y-4" aria-hidden="true">
        {variante === 'lista' && <>
          <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className={`${bloco} h-28`} />)}</div>
          <div className={`${bloco} h-48`} />
          <div className={`${bloco} h-24`} />
          {[0, 1].map(i => <div key={i} className={`${bloco} h-16`} />)}
        </>}
        {variante === 'resumo' && <>
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]"><div className="h-32 rounded-xl bg-noite/80 animate-pulse motion-reduce:animate-none" />{[0, 1, 2].map(i => <div key={i} className={`${bloco} h-32`} />)}</div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]"><div className={`${bloco} h-56`} /><div className={`${bloco} h-56`} /></div>
          <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className={`${bloco} h-40`} />)}</div>
        </>}
        {variante === 'conferencia' && <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-2"><div className={`${bloco} h-28`} />{[0, 1, 2, 3, 4].map(i => <div key={i} className={`${bloco} h-14`} />)}</div>
          <div className={`${bloco} h-64`} />
        </div>}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24" aria-hidden="true">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 px-6 py-4 shadow-sm">
          <svg viewBox="0 0 48 48" className="size-10 animate-spin [animation-duration:1.4s] motion-reduce:animate-none">
            <Simbolo ink={CORES.claro.ink} dot={CORES.claro.dot} />
          </svg>
          <span className="text-xs font-semibold text-aco">Buscando os números…</span>
        </div>
      </div>
    </div>
  );
}
