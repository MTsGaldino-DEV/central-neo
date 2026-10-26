import { useId, useState, type ReactNode } from 'react';

/** "i" pequeno que explica um termo ao passar o mouse ou focar; sem sublinhado no texto. */
export function DicaInfo({ rotulo, children, lado = 'direita' }: { rotulo: string; children: ReactNode; lado?: 'direita' | 'esquerda' }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex align-middle" onMouseEnter={() => setAberta(true)} onMouseLeave={() => setAberta(false)}>
      <button type="button" aria-label={`O que é ${rotulo}`} aria-describedby={aberta ? id : undefined}
        onFocus={() => setAberta(true)} onBlur={() => setAberta(false)} onClick={() => setAberta(a => !a)}
        className="ml-1 grid size-3.5 place-items-center rounded-full bg-nevoa text-[10px] font-extrabold text-aco hover:bg-linha focus-visible:outline-2 focus-visible:outline-sinal">i</button>
      {aberta && <span role="tooltip" id={id}
        className={`absolute top-5 z-30 w-64 rounded-xl bg-noite px-3 py-2.5 text-xs leading-relaxed font-medium text-linha shadow-lg ${lado === 'direita' ? 'right-0' : 'left-0'}`}>{children}</span>}
    </span>
  );
}
