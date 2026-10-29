import type { TotaisFat } from '@/lib/faturamentoServicos';
import { MOTIVOS_FAT, valorFat, type UnidadeFat } from '@/lib/faturamentoTexto';

const numero = (n: number) => n.toLocaleString('pt-BR');
type Lado = 'todos' | 'a_menos' | 'a_mais' | 'glosados';
interface Fatia { id: string; rotulo: string; servicos: number; us: number; cor: string }

// Nomes curtos para a legenda da barra; o nome completo fica na dica (title).
const CURTO: Record<string, string> = {
  FATOR_MENOR: 'Fator menor', OUTRA: 'Outra', RC_NAO_PAGO: 'RC não pago', GLOSA_PARCIAL: 'Glosa parcial',
  MOTO_INDEVIDO: 'Moto indevido', FATOR_MAIOR: 'Fator maior', RC_VARIAS_LINHAS: 'RC em várias linhas',
};
const TONS_MENOS = ['bg-erro', 'bg-erro-marca', 'bg-red-300', 'bg-red-200'];

/** Painel (Matheus, 29/10/2026): faixa escura com o total e três cards de diferença com uma barra por motivo. */
export function CardsLados({ totais, unidade, taxa, onVer }: {
  totais: TotaisFat; unidade: UnidadeFat; taxa: number | null; onVer: (lado: Lado) => void;
}) {
  const v = (us: number, sinal = false) => valorFat(us, unidade, taxa, sinal);
  const menos = totais.a_menos, mais = totais.a_mais;
  const glosados = totais.glosados ?? { servicos: 0, us: 0, devido: 0, glosa: 0 };
  const c562 = mais.c562 ?? { servicos: 0, us: 0 };
  let tom = 0;
  const fatiasMenos: Fatia[] = Object.entries(menos.por_motivo).sort((a, b) => b[1].us - a[1].us).map(([m, x]) => ({
    id: m, rotulo: CURTO[m] ?? MOTIVOS_FAT[m] ?? m, servicos: x.servicos, us: x.us,
    cor: m === 'GLOSA_PARCIAL' ? 'bg-glosa-marca' : TONS_MENOS[Math.min(tom++, TONS_MENOS.length - 1)],
  }));
  const fatiasMais: Fatia[] = [
    { id: 'c562', rotulo: 'Com 5.62', servicos: c562.servicos, us: c562.us, cor: 'bg-concluido' },
    { id: 'outros', rotulo: 'Outros', servicos: mais.servicos - c562.servicos, us: (mais.us ?? 0) - c562.us, cor: 'bg-emerald-300' },
  ].filter(f => f.servicos > 0);
  const mini = 'block text-xs font-semibold text-white/70';

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => onVer('todos')} disabled={!totais.servicos} aria-label={`Pagou no total: ver os ${numero(totais.servicos)} serviços`}
        className="flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-2xl bg-noite-alto px-5 py-4 text-left text-white tabular-nums hover:bg-noite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sinal disabled:cursor-default sm:px-6">
        <span className="block">
          <span className="block text-xs font-bold text-sinal-claro">Pagou no total</span>
          <span className="block text-[28px] leading-tight font-extrabold tracking-tight">{v(totais.creditado)}</span>
        </span>
        <span className="flex flex-wrap gap-x-7 gap-y-2">
          <span className="block"><span className={mini}>Contrato prevê</span><b className="text-base font-extrabold">{v(totais.devido)}</b></span>
          <span className="block"><span className={mini}>Multas</span><b className="text-base font-extrabold">{v(-Math.abs(totais.multas), true)}</b></span>
          <span className="block"><span className={mini}>Serviços</span><b className="text-base font-extrabold">{numero(totais.servicos)}</b></span>
        </span>
      </button>

      <div className="grid gap-3 md:grid-cols-3">
        <Card rotulo="Pagou a menos" cor="text-erro" servicos={menos.servicos} valor={v(-(menos.us ?? totais.saldo_a_receber), true)}
          fatias={fatiasMenos} v={v} onClick={() => onVer('a_menos')} />
        <Card rotulo="Pagou a mais" cor="text-concluido" servicos={mais.servicos} valor={v(mais.us ?? totais.pago_a_mais, true)}
          fatias={fatiasMais} v={v} onClick={() => onVer('a_mais')} />
        <Card rotulo="Glosados" cor="text-glosa" servicos={glosados.servicos} valor={v(-glosados.us, true)}
          fatias={glosados.servicos ? [{ id: 'glosa', rotulo: '', servicos: glosados.servicos, us: glosados.us, cor: 'bg-glosa-marca' }] : []}
          legenda={<>Glosa lançada · contrato prevê {v(glosados.devido)}</>} v={v} onClick={() => onVer('glosados')} />
      </div>
    </div>
  );
}

function Card({ rotulo, cor, servicos, valor, fatias, legenda, v, onClick }: {
  rotulo: string; cor: string; servicos: number; valor: string; fatias: Fatia[]; legenda?: React.ReactNode;
  v: (us: number, sinal?: boolean) => string; onClick: () => void;
}) {
  const soma = fatias.reduce((s, f) => s + Math.abs(f.us), 0);
  return (
    <button type="button" onClick={onClick} disabled={!servicos} aria-label={`${rotulo}: ver os ${numero(servicos)} serviços`}
      className="flex w-full flex-col justify-start rounded-2xl border border-linha bg-white px-5 py-4 text-left tabular-nums hover:border-aco-claro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sinal disabled:cursor-default">
      <span className="flex items-baseline justify-between gap-2 text-xs font-bold">
        <span className={cor}>{rotulo}</span><span className="text-aco">{numero(servicos)} serviços</span>
      </span>
      <span className={`mt-1.5 mb-2.5 block text-[26px] leading-tight font-extrabold tracking-tight ${cor}`}>{valor}</span>
      <span className="flex h-2 overflow-hidden rounded-full bg-nevoa" aria-hidden="true">
        {soma > 0 && fatias.map(f => <span key={f.id} className={`block h-full ${f.cor}`} style={{ width: `${Math.abs(f.us) / soma * 100}%` }}
          title={`${f.rotulo || rotulo}: ${numero(f.servicos)} serviços · ${v(f.us)}`} />)}
      </span>
      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-aco">
        {legenda ?? fatias.map(f => (
          <span key={f.id} className="inline-flex items-center gap-1" title={`${MOTIVOS_FAT[f.id] ?? f.rotulo}: ${v(f.us)}`}>
            <i className={`inline-block size-2 rounded-sm ${f.cor}`} aria-hidden="true" />{f.rotulo} · {numero(f.servicos)}
          </span>
        ))}
        {!legenda && !fatias.length && <span>Nenhum serviço</span>}
      </span>
    </button>
  );
}
