import type { UnidadeFat } from '@/lib/faturamentoTexto';

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ | US", como no painel da Manutenção, com o valor da US usado na conversão. */
export function ChaveUnidade({ unidade, taxa, mudar, mostrarTaxa = true }: {
  unidade: UnidadeFat; taxa: number | null; mudar: (u: UnidadeFat) => void; mostrarTaxa?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 rounded-xl border border-linha bg-white p-1" role="group" aria-label="Unidade dos valores">
        {(['reais', 'us'] as UnidadeFat[]).map(u => (
          <button key={u} type="button" onClick={() => mudar(u)} aria-pressed={unidade === u}
            disabled={u === 'reais' && !taxa} title={u === 'reais' && !taxa ? 'Valor da US não encontrado' : undefined}
            className={`rounded-lg px-3 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${unidade === u ? 'bg-sinal text-white' : 'text-aco hover:bg-nevoa'}`}>
            {u === 'reais' ? 'R$' : 'US'}
          </button>
        ))}
      </div>
      {mostrarTaxa && taxa && <span className="text-xs whitespace-nowrap text-aco">1 US = {reais(taxa)}</span>}
    </div>
  );
}
