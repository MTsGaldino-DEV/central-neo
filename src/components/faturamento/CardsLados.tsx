import { ArrowRight } from 'lucide-react';
import type { TotaisFat } from '@/lib/faturamentoServicos';
import { MOTIVOS_FAT, outraUnidadeFat, valorFat, type UnidadeFat } from '@/lib/faturamentoTexto';

const numero = (n: number) => n.toLocaleString('pt-BR');

/** Os três cards do Painel: o que a CEMIG pagou no total, a menos (principal) e a mais. */
export function CardsLados({ totais, unidade, taxa, onVer }: {
  totais: TotaisFat; unidade: UnidadeFat; taxa: number | null; onVer: (lado: 'todos' | 'a_menos' | 'a_mais') => void;
}) {
  const v = (us: number, sinal = false) => valorFat(us, unidade, taxa, sinal);
  const menos = totais.a_menos, mais = totais.a_mais;
  const c562 = mais.c562 ?? { servicos: 0, us: 0 };
  const motivos = Object.entries(menos.por_motivo).sort((a, b) => b[1].us - a[1].us);
  const etiqueta = 'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold';
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <section className="rounded-2xl border-2 border-sinal bg-white p-4 sm:p-5" aria-label="Pagou no total">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-extrabold tracking-wide text-sinal uppercase">Pagou no total</p>
          <p className="text-xs text-aco"><b className="text-tinta">{numero(totais.servicos)}</b> serviços</p>
        </div>
        <p className="mt-1 font-codigo text-3xl font-extrabold text-tinta xl:text-4xl">{v(totais.creditado)}</p>
        {outraUnidadeFat(totais.creditado, unidade, taxa) && <p className="font-codigo text-xs text-aco">{outraUnidadeFat(totais.creditado, unidade, taxa)}</p>}
        <p className="mt-2 text-sm text-tinta">Crédito da CEMIG na fatura, sem as glosas. O contrato prevê <b className="font-codigo">{v(totais.devido)}</b>.</p>
        {totais.multas !== 0 && <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`${etiqueta} bg-nevoa text-aco`}>multas {v(-Math.abs(totais.multas), true)} · fora do saldo</span>
        </div>}
        <button type="button" onClick={() => onVer('todos')} disabled={!totais.servicos}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sinal px-3 py-2 text-xs font-bold text-white hover:bg-sinal/90 disabled:opacity-50">
          Ver os {numero(totais.servicos)} serviços <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </section>

      <section className="rounded-2xl border-2 border-erro-marca bg-white p-4 sm:p-5" aria-label="Pagou a menos">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-extrabold tracking-wide text-erro uppercase">Pagou a menos</p>
          <p className="text-xs text-aco"><b className="text-tinta">{numero(menos.servicos)}</b> serviços</p>
        </div>
        <p className="mt-1 font-codigo text-3xl font-extrabold text-erro xl:text-4xl">{v(-(menos.us ?? totais.saldo_a_receber), true)}</p>
        {outraUnidadeFat(menos.us ?? totais.saldo_a_receber, unidade, taxa) && <p className="font-codigo text-xs text-aco">{outraUnidadeFat(menos.us ?? totais.saldo_a_receber, unidade, taxa)}</p>}
        <p className="mt-2 text-sm text-tinta">A CEMIG pagou <b className="font-codigo">{v(menos.pago ?? 0)}</b> e o contrato prevê <b className="font-codigo">{v(menos.devido ?? 0)}</b>.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {motivos.map(([m, x]) => <span key={m} className={`${etiqueta} bg-erro-fundo text-erro`}>{numero(x.servicos)} · {MOTIVOS_FAT[m] ?? m} · {v(-x.us, true)}</span>)}
          {(menos.com_1ns ?? 0) > 0 && <span className={`${etiqueta} bg-revisao-fundo text-revisao`}>{numero(menos.com_1ns)} com 1.NS</span>}
        </div>
        <button type="button" onClick={() => onVer('a_menos')} disabled={!menos.servicos}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-erro px-3 py-2 text-xs font-bold text-white hover:bg-erro/90 disabled:opacity-50">
          Ver os {numero(menos.servicos)} serviços <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </section>

      <section className="rounded-2xl border-2 border-concluido-marca bg-white p-4 sm:p-5" aria-label="Pagou a mais">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-extrabold tracking-wide text-concluido uppercase">Pagou a mais</p>
          <p className="text-xs text-aco"><b className="text-tinta">{numero(mais.servicos)}</b> serviços</p>
        </div>
        <p className="mt-1 font-codigo text-3xl font-extrabold text-concluido xl:text-4xl">{v(mais.us ?? totais.pago_a_mais, true)}</p>
        {outraUnidadeFat(mais.us ?? totais.pago_a_mais, unidade, taxa) && <p className="font-codigo text-xs text-aco">{outraUnidadeFat(mais.us ?? totais.pago_a_mais, unidade, taxa)}</p>}
        <p className="mt-2 text-sm text-tinta">A CEMIG pagou <b className="font-codigo">{v(mais.pago ?? 0)}</b> e o contrato prevê <b className="font-codigo">{v(mais.devido ?? 0)}</b>.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c562.servicos > 0 && <span className={`${etiqueta} bg-concluido-fundo text-concluido`}>{numero(c562.servicos)} são 5.62 pago como RC inteiro · {v(c562.us, true)}</span>}
          {mais.servicos - c562.servicos > 0 && <span className={`${etiqueta} bg-concluido-fundo/60 text-concluido`}>{numero(mais.servicos - c562.servicos)} outros · {v((mais.us ?? 0) - c562.us, true)}</span>}
        </div>
        <button type="button" onClick={() => onVer('a_mais')} disabled={!mais.servicos}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-concluido px-3 py-2 text-xs font-bold text-white hover:bg-concluido/90 disabled:opacity-50">
          Ver os {numero(mais.servicos)} serviços <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
