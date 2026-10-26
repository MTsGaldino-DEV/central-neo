import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCAVEIS = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Janela centralizada com fundo escurecido. Fecha pelo X, por "Cancelar", pela tecla Esc
 * ou clicando fora. Prende o foco dentro e devolve ao elemento de origem ao fechar.
 */
export function JanelaModal({ aberta, titulo, onFechar, rodape, largura = 'md', children }: {
  aberta: boolean; titulo: ReactNode; onFechar: () => void; rodape?: ReactNode; largura?: 'md' | 'lg'; children: ReactNode;
}) {
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    if (!aberta) return;
    const origem = document.activeElement as HTMLElement | null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focaveis = () => [...(caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])];
    (caixa.current?.querySelector<HTMLElement>('[data-autofoco]') ?? caixa.current)?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar.current(); return; }
      if (e.key !== 'Tab') return;
      const f = focaveis();
      if (!f.length) { e.preventDefault(); return; }
      const [primeiro, ultimo] = [f[0], f[f.length - 1]];
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === caixa.current)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = rolagem; origem?.focus?.(); };
  }, [aberta]);

  if (!aberta) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-noite/60 p-0 sm:items-center sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
        className={`flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl ${largura === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}>
        <header className="flex items-start gap-3 border-b border-linha px-5 py-4">
          <h2 id={id} className="min-w-0 flex-1 text-base font-extrabold text-tinta">{titulo}</h2>
          <button type="button" aria-label="Fechar" onClick={onFechar}
            className="-mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-aco hover:bg-nevoa hover:text-tinta focus-visible:outline-2 focus-visible:outline-sinal">
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-linha px-5 py-3">
          <button type="button" onClick={onFechar}
            className="rounded-lg border border-linha px-4 py-2 text-sm font-bold text-aco hover:bg-nevoa focus-visible:outline-2 focus-visible:outline-sinal">Cancelar</button>
          {rodape}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
