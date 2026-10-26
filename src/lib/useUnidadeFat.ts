import { useSearchParams } from 'react-router-dom';
import { valorUsFat } from './faturamentoServicos';
import type { UnidadeFat } from './faturamentoTexto';
import { useDadosComCache } from './useDadosComCache';

/** R$ ou US nas telas do Faturamento: abre em R$, `?unidade=us` troca. Sem valor da US, fica em US. */
export function useUnidadeFat() {
  const [p, setP] = useSearchParams();
  const valor = useDadosComCache('valor-us', valorUsFat, [], true, 'Faturamento › valor da US');
  const taxa = valor.dados?.valor ?? null;
  const unidade: UnidadeFat = p.get('unidade') === 'us' || !taxa ? 'us' : 'reais';
  const mudar = (u: UnidadeFat) => {
    const q = new URLSearchParams(p);
    if (u === 'us') q.set('unidade', 'us'); else q.delete('unidade');
    setP(q, { replace: true });
  };
  return { unidade, taxa, vigencia: valor.dados?.vigencia ?? null, mudar };
}
