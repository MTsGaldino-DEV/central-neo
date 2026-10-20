/**
 * Logo da Central NEO (Núcleo de Eficiência Operacional).
 *
 * O símbolo é um anel aberto com um ponto preenchendo a abertura: a nota
 * pendente que se fecha quando o pagamento entra. Por isso o "O" de NEO é o
 * próprio símbolo.
 *
 *   <NeoLogo tema="escuro" className="h-8 w-auto" />   // barra lateral, login
 *   <NeoLogo variante="simbolo" className="size-8" />   // só o símbolo
 */
type Tema = 'claro' | 'escuro' | 'mono';

export const CORES: Record<Tema, { ink: string; dot: string }> = {
  claro: { ink: '#0b1f24', dot: '#0b7285' },
  escuro: { ink: '#ffffff', dot: '#3bc9db' },
  mono: { ink: 'currentColor', dot: 'currentColor' },
};

// Anel: r=15, circunferência ≈ 94,25. O traço cobre ~298° e deixa a abertura
// no canto superior direito, onde fica o ponto.
export function Simbolo({ ink, dot, x = 0, y = 0, escala = 1 }: { ink: string; dot: string; x?: number; y?: number; escala?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <circle cx="24" cy="24" r="15" fill="none" stroke={ink} strokeWidth="6.5"
        strokeDasharray="76 100" strokeLinecap="round" />
      <circle cx="36.3" cy="15.4" r="5" fill={dot} />
    </g>
  );
}

export function NeoLogo({
  variante = 'completo',
  tema = 'claro',
  className,
}: {
  variante?: 'completo' | 'simbolo';
  tema?: Tema;
  className?: string;
}) {
  const { ink, dot } = CORES[tema];

  if (variante === 'simbolo') {
    return (
      <svg viewBox="0 0 48 48" role="img" aria-label="Central NEO" className={className}>
        <Simbolo ink={ink} dot={dot} />
      </svg>
    );
  }

  // "NE" em texto + o símbolo no lugar do "O", na altura das maiúsculas
  return (
    <svg viewBox="0 0 96 48" role="img" aria-label="Central NEO" className={className}>
      <text x="0" y="38" fill={ink} fontFamily="Manrope, sans-serif" fontWeight="800"
        fontSize="40" letterSpacing="-1">NE</text>
      <Simbolo ink={ink} dot={dot} x={50} y={3.5} escala={0.85} />
    </svg>
  );
}

export default NeoLogo;
