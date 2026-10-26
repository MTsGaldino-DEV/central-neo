import { useState } from 'react';
import { valorFat, type UnidadeFat } from '../../lib/faturamentoTexto';

export interface ItemGraficoFat {
  fatura: string; rotulo: string; pago: number; devido: number; multas: number;
  a_menos: { us: number; servicos: number }; a_mais: { us: number; servicos: number }; fora_contrato: number;
}

const SERIES = [
  { chave: 'pago', rotulo: 'Pago', cor: 'bg-sinal', ponto: 'bg-sinal-claro' },
  { chave: 'devido', rotulo: 'Devido', cor: 'bg-aco-claro', ponto: 'bg-aco-claro' },
  { chave: 'multas', rotulo: 'Multas', cor: 'bg-erro-marca', ponto: 'bg-erro-marca' },
] as const;
const numero = (n: number) => n.toLocaleString('pt-BR');

/** Barras agrupadas por fatura, em HTML; no mouse (ou foco), o resumo da fatura, uma informação por linha. */
export function GraficoFaturas({ itens, destaque, unidade, taxa }: { itens: ItemGraficoFat[]; destaque?: string; unidade: UnidadeFat; taxa: number | null }) {
  const [sobre, setSobre] = useState<string | null>(null);
  const maximo = Math.max(...itens.flatMap(i => [i.pago, i.devido, i.multas]), 0);
  const v = (n: number, sinal = false) => valorFat(n, unidade, taxa, sinal);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-tinta">Comparação entre faturas</h2>
        <div className="flex gap-3 text-[11px] text-aco" aria-hidden="true">
          {SERIES.map(s => <span key={s.chave} className="inline-flex items-center gap-1"><i className={`inline-block size-2 rounded-sm ${s.cor}`} />{s.rotulo}</span>)}
        </div>
      </div>
      {!itens.length || maximo === 0 ? <p className="py-8 text-center text-sm text-aco">Sem faturas para comparar.</p> : <>
        <div className="flex h-36 items-end gap-2 border-b border-linha px-1 sm:gap-4">
          {itens.map((i, n) => (
            <div key={i.fatura} data-grafico-fatura={i.fatura} tabIndex={0} aria-label={`Resumo da fatura ${i.fatura}`}
              onMouseEnter={() => setSobre(i.fatura)} onMouseLeave={() => setSobre(null)} onFocus={() => setSobre(i.fatura)} onBlur={() => setSobre(null)}
              className={`relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sinal ${sobre === i.fatura ? 'bg-sinal-fundo' : ''}`}>
              {SERIES.map(s => (
                <div key={s.chave} className={`w-full max-w-4 rounded-t-sm ${s.cor} ${destaque && destaque !== i.fatura ? 'opacity-60' : ''}`}
                  style={{ height: `${Math.max(i[s.chave] / maximo * 100, i[s.chave] > 0 ? 2 : 0)}%` }} />
              ))}
              {sobre === i.fatura && (
                <div role="tooltip" className={`absolute bottom-full z-30 mb-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl bg-noite px-3 py-2.5 text-xs text-white shadow-lg ${itens.length === 1 ? 'left-1/2 -translate-x-1/2' : n >= itens.length / 2 ? 'right-0' : 'left-0'}`}>
                  <p className="mb-1 font-extrabold">Fatura {i.fatura} · {i.rotulo}</p>
                  {SERIES.map(s => (
                    <div key={s.chave} className="flex justify-between gap-3 py-0.5">
                      <span className="inline-flex items-center gap-1.5"><i className={`inline-block size-2 rounded-sm ${s.ponto}`} />{s.rotulo}</span>
                      <b className="font-codigo">{v(i[s.chave])}</b>
                    </div>
                  ))}
                  <div className="my-1 border-t border-white/10" />
                  <div className="flex justify-between gap-3 py-0.5 text-red-300"><span>A menos · {numero(i.a_menos.servicos)}</span><b className="font-codigo">{v(-i.a_menos.us, true)}</b></div>
                  <div className="flex justify-between gap-3 py-0.5 text-emerald-300"><span>A mais · {numero(i.a_mais.servicos)}</span><b className="font-codigo">{v(i.a_mais.us, true)}</b></div>
                  <div className="flex justify-between gap-3 py-0.5 text-aco-claro"><span>Fora do contrato</span><b className="font-codigo">{numero(i.fora_contrato)}</b></div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 px-1 pt-1 sm:gap-4">
          {itens.map(i => (
            <span key={i.fatura} className={`flex-1 text-center font-codigo ${i.fatura === destaque ? 'text-sm font-bold text-tinta' : 'text-[11px] text-aco'}`}>{i.fatura}</span>
          ))}
        </div>
        <div className="sr-only"><table>
          <caption>Pago, devido e multas por fatura</caption>
          <thead><tr><th>Fatura</th><th>Pago</th><th>Devido</th><th>Multas</th><th>A menos</th><th>A mais</th></tr></thead>
          <tbody>{itens.map(i => <tr key={i.fatura}><td>{i.fatura}</td><td>{v(i.pago)}</td><td>{v(i.devido)}</td><td>{v(i.multas)}</td><td>{v(-i.a_menos.us, true)}</td><td>{v(i.a_mais.us, true)}</td></tr>)}</tbody>
        </table></div>
      </>}
    </div>
  );
}

/** Item do gráfico a partir dos totais de uma fatura. */
export const itemGraficoFat = (f: { fatura: string; inicio: string; fim: string; creditado: number; devido: number; multas: number;
  saldo_a_receber: number; pago_a_mais: number; fora_contrato?: number;
  a_menos: { servicos: number; us?: number }; a_mais: { servicos: number; us?: number } }, rotulo: string): ItemGraficoFat => ({
  fatura: f.fatura, rotulo, pago: f.creditado, devido: f.devido, multas: f.multas,
  a_menos: { us: f.a_menos.us ?? f.saldo_a_receber, servicos: f.a_menos.servicos },
  a_mais: { us: f.a_mais.us ?? f.pago_a_mais, servicos: f.a_mais.servicos }, fora_contrato: f.fora_contrato ?? 0,
});
