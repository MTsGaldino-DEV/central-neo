import { usFat } from '../../lib/faturamentoTexto';

export interface ItemGraficoFat { fatura: string; pago: number; devido: number; multas: number }

const SERIES = [
  { chave: 'pago', rotulo: 'Pago', cor: 'bg-sinal' },
  { chave: 'devido', rotulo: 'Devido', cor: 'bg-aco-claro' },
  { chave: 'multas', rotulo: 'Multas', cor: 'bg-erro-marca' },
] as const;

/** Barras agrupadas por fatura, em HTML: legenda e rótulos com tamanho fixo, sem texto em SVG. */
export function GraficoFaturas({ itens, destaque }: { itens: ItemGraficoFat[]; destaque?: string }) {
  const maximo = Math.max(...itens.flatMap(i => [i.pago, i.devido, i.multas]), 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-tinta">Comparação entre faturas</h2>
        <div className="flex gap-3 text-[11px] text-aco" aria-hidden="true">
          {SERIES.map(s => <span key={s.chave} className="inline-flex items-center gap-1"><i className={`inline-block size-2 rounded-sm ${s.cor}`} />{s.rotulo}</span>)}
        </div>
      </div>
      {!itens.length || maximo === 0 ? <p className="py-8 text-center text-sm text-aco">Sem faturas para comparar.</p> : <>
        <div className="flex h-32 items-end gap-2 border-b border-linha px-1 sm:gap-4">
          {itens.map(i => (
            <div key={i.fatura} className="flex h-full flex-1 items-end justify-center gap-0.5"
              title={`Fatura ${i.fatura}: pago ${usFat(i.pago)} · devido ${usFat(i.devido)} · multas ${usFat(i.multas)}`}>
              {SERIES.map(s => (
                <div key={s.chave} className={`w-full max-w-4 rounded-t-sm ${s.cor} ${destaque && destaque !== i.fatura ? 'opacity-60' : ''}`}
                  style={{ height: `${Math.max(i[s.chave] / maximo * 100, i[s.chave] > 0 ? 2 : 0)}%` }} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-2 px-1 pt-1 sm:gap-4">
          {itens.map(i => (
            <span key={i.fatura} className={`flex-1 text-center font-codigo ${i.fatura === destaque ? 'text-sm font-bold text-tinta' : 'text-[11px] text-aco'}`}>{i.fatura}</span>
          ))}
        </div>
        <table className="sr-only">
          <caption>Pago, devido e multas por fatura, em US</caption>
          <thead><tr><th>Fatura</th><th>Pago</th><th>Devido</th><th>Multas</th></tr></thead>
          <tbody>{itens.map(i => <tr key={i.fatura}><td>{i.fatura}</td><td>{usFat(i.pago)}</td><td>{usFat(i.devido)}</td><td>{usFat(i.multas)}</td></tr>)}</tbody>
        </table>
      </>}
    </div>
  );
}
