import { Link, useSearchParams } from 'react-router-dom';

/** Chave "Resumo | Conferência" do detalhe da fatura; mantém fatura e período. */
export function AlternarFatura({ atual }: { atual: 'resumo' | 'conferencia' }) {
  const [p] = useSearchParams();
  const manter = new URLSearchParams();
  for (const k of ['fatura', 'de', 'ate']) { const v = p.get(k); if (v) manter.set(k, v); }
  const q = manter.toString() ? `?${manter}` : '';
  return (
    <nav aria-label="Detalhe da fatura" className="inline-flex rounded-xl bg-linha/60 p-0.5">
      {(['resumo', 'conferencia'] as const).map(a => (
        <Link key={a} to={`/faturamento/${a}${q}`} aria-current={a === atual ? 'page' : undefined}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${a === atual ? 'bg-white text-sinal shadow-sm' : 'text-aco hover:text-tinta'}`}>
          {a === 'resumo' ? 'Resumo' : 'Conferência'}
        </Link>
      ))}
    </nav>
  );
}
