import { usFat } from '../../lib/faturamentoTexto';

/** Três barrinhas (pago, devido, multas) da lista de faturas; `maximo` deixa as faturas na mesma escala. */
export function MiniBarras({ pago, devido, multas, maximo }: { pago: number; devido: number; multas: number; maximo?: number }) {
  const topo = maximo || Math.max(pago, devido, multas, 1e-9);
  const barras = [[pago, 'bg-sinal'], [devido, 'bg-aco-claro'], [multas, 'bg-erro-marca']] as const;
  return (
    <div className="flex h-8 w-10 shrink-0 items-end gap-0.5" role="img"
      aria-label={`Pago ${usFat(pago)}, devido ${usFat(devido)}, multas ${usFat(multas)}`}>
      {barras.map(([v, cor], i) => <div key={i} className={`flex-1 rounded-t-[2px] ${cor}`} style={{ height: `${Math.max(v / topo * 100, v > 0 ? 6 : 0)}%` }} />)}
    </div>
  );
}
