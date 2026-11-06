import type { ReactNode } from 'react';
import type { Estado } from '@/lib/disponibilidadeRegras';

export function Pilula({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={ativa} onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors motion-reduce:transition-none ${ativa ? 'border-sinal bg-sinal-fundo text-sinal-forte' : 'border-linha bg-white text-aco hover:border-aco-claro hover:text-tinta'}`}>
      {children}
    </button>
  );
}

const CORES_ESTADO = {
  ok: { texto: 'text-concluido', ponto: 'bg-concluido-marca' },
  atencao: { texto: 'text-pendente', ponto: 'bg-pendente-marca' },
  critico: { texto: 'text-erro', ponto: 'bg-erro-marca' },
};

/** Status sempre com ponto e texto, nunca só a cor. */
export function SeloEstado({ estado, grande = false }: { estado: Estado; grande?: boolean }) {
  const c = CORES_ESTADO[estado.tom];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-bold ${c.texto} ${grande ? 'text-xl' : 'text-[13px]'}`}>
      <i className={`shrink-0 rounded-full ${c.ponto} ${grande ? 'size-3' : 'size-2'}`} aria-hidden="true" />{estado.texto}
    </span>
  );
}

/** Faixa de números do topo da conferência. */
export function FaixaResumo({ children }: { children: ReactNode }) {
  return <section className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-linha bg-white md:grid-cols-[1.5fr_1fr_1fr_1fr]">{children}</section>;
}

export function ItemResumo({ rotulo, valor, nota, cor = '', largo = false, barra }: {
  rotulo: string; valor: ReactNode; nota?: string; cor?: string; largo?: boolean; barra?: number;
}) {
  return (
    <div className={`min-w-0 border-t border-linha px-4 py-3.5 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0 ${largo ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="mb-0.5 text-xs font-semibold text-aco">{rotulo}</p>
      <p className={`text-2xl font-extrabold leading-tight tabular-nums ${cor}`}>{valor}</p>
      {nota && <p className="text-xs text-aco">{nota}</p>}
      {barra !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded bg-linha"><i className="block h-full rounded bg-sinal transition-[width] motion-reduce:transition-none" style={{ width: `${barra * 100}%` }} /></div>}
    </div>
  );
}
