import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

/** "?" que leva direto ao tema da Documentação daquela tela. */
export function AjudaFat({ tema }: { tema: string }) {
  return (
    <Link to={`/faturamento/documentacao#${tema}`} aria-label="Ajuda: como funciona esta tela" title="Como funciona esta tela"
      className="grid size-7 shrink-0 place-items-center rounded-full border border-linha bg-white text-sm font-extrabold text-sinal hover:border-sinal hover:bg-sinal-fundo focus-visible:outline-2 focus-visible:outline-sinal">?</Link>
  );
}

export function RodapeFat() {
  return (
    <footer className="mt-8 flex justify-center border-t border-linha pt-4">
      <Link to="/faturamento/documentacao" className="inline-flex items-center gap-1.5 text-xs font-semibold text-aco hover:text-sinal">
        <BookOpen className="size-3.5" aria-hidden="true" />Documentação · como funciona o faturamento
      </Link>
    </footer>
  );
}
