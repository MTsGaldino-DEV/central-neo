import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { CONTESTAVEIS, MULTAVEIS, brlNegativo } from '@/lib/disponibilidadeRegras';

/** Motivos prontos e observação. Usado na lista do dia e na célula da grade. */
export function Motivos({ valor, causa, observacao, onEscolher, onLimpar }: {
  valor: number; causa?: string | null; observacao?: string | null;
  onEscolher: (causa: string, observacao: string | null) => void; onLimpar?: () => void;
}) {
  const [obs, setObs] = useState(observacao ?? '');
  const escolher = (c: string) => onEscolher(c, obs.trim() || null);
  const chip = (c: string, cor: string, ativo: string) => (
    <button key={c} type="button" onClick={() => escolher(c)} aria-pressed={causa === c}
      className={`rounded-full border bg-white px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none ${cor} ${causa === c ? ativo : ''}`}>{c}</button>
  );
  return (
    <div className="grid gap-3">
      <div>
        <h4 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#9c0006]">Multável <span className="font-semibold normal-case tracking-normal opacity-80">· {brlNegativo(valor)}</span></h4>
        <div className="flex flex-wrap gap-1.5">{MULTAVEIS.map(c => chip(c, 'border-[#ffc7ce] text-[#9c0006] hover:bg-[#ffc7ce]', 'bg-[#ffc7ce]'))}</div>
      </div>
      <div>
        <h4 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#7a4600]">Contestável <span className="font-semibold normal-case tracking-normal opacity-80">· R$ 0</span></h4>
        <div className="flex flex-wrap gap-1.5">{CONTESTAVEIS.map(c => chip(c, 'border-[#f5d76e] text-[#7a4600] hover:bg-[#ffeb9c]', 'bg-[#ffeb9c]'))}</div>
      </div>
      <Input value={obs} onChange={e => setObs(e.target.value)} aria-label="Observação" maxLength={500}
        placeholder="Observação (opcional): escreva antes de escolher o motivo" className="bg-white text-sm" />
      {onLimpar && <button type="button" onClick={onLimpar} className="justify-self-start text-xs font-semibold text-aco underline underline-offset-2 hover:text-tinta">Limpar marcação</button>}
    </div>
  );
}
