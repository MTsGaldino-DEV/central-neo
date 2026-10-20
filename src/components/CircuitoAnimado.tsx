import type { CSSProperties } from 'react';
import { CORES, Simbolo } from '@/components/NeoLogo';

/**
 * Fundo animado do login: trilhas de placa de circuito com pulsos de energia
 * correndo pelas trilhas, a maioria indo até o chip central, que leva o
 * símbolo da NEO.
 *
 * O desenho é gerado uma vez, com semente fixa: sai sempre igual, sem imagem
 * nem vídeo para baixar. Com "reduzir movimento" ligado no sistema, os pulsos
 * somem e fica só a placa parada. As animações ficam em index.css
 * (circuito-pulso, circuito-chegada, circuito-respira).
 *
 *   <CircuitoAnimado className="absolute inset-0 size-full" />
 */

const LARGURA = 800;
const ALTURA = 1000;
const PASSO = 20;
const COLUNAS = LARGURA / PASSO;
const LINHAS = ALTURA / PASSO;

// 8 rumos em sentido horário a partir do leste; os ímpares são as diagonais
const RUMOS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

type Ponto = [number, number];
type Chip = { c: number; l: number; w: number; h: number; nome: string; principal?: boolean };
type Pulso = { duracao: number; atraso: number; tamanho: number };
type Trilha = { pontos: Ponto[]; comprimento: number; doChip: boolean; pulso?: Pulso };

// Em células da grade. O principal fica à direita, longe do texto do login.
const CHIPS: Chip[] = [
  { c: 27, l: 11, w: 8, h: 8, nome: 'NEO', principal: true },
  { c: 30, l: 32, w: 5, h: 4, nome: 'U2' },
  { c: 19, l: 43, w: 4, h: 3, nome: 'U3' },
];

// mulberry32: aleatório determinístico, para a placa sair igual em todo carregamento
function semente(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gerarPlaca(): Trilha[] {
  const rnd = semente(20261020);
  const ocupado = new Set<string>();
  const chave = (c: number, l: number) => `${c},${l}`;
  const trilhas: Trilha[] = [];

  for (const chip of CHIPS)
    for (let c = chip.c; c <= chip.c + chip.w; c++)
      for (let l = chip.l; l <= chip.l + chip.h; l++) ocupado.add(chave(c, l));

  // Anda pela grade em trechos retos ligados por curvas de 45°, sem cruzar
  // outra trilha (diagonais marcam também o meio da célula, onde se cruzariam).
  function tracar(c: number, l: number, rumo: number, trechos: number): Ponto[] | null {
    const local = new Set<string>([chave(c, l)]);
    const livre = (k: string) => !ocupado.has(k) && !local.has(k);
    const pontos: Ponto[] = [[c, l]];
    let passos = 0;
    let giro = rnd() < 0.5 ? 1 : -1;

    trecho: for (let s = 0; s < trechos; s++) {
      const diagonal = rumo % 2 === 1;
      const n = diagonal ? 1 + Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 9);
      const [dc, dl] = RUMOS[rumo];
      for (let k = 0; k < n; k++) {
        const nc = c + dc;
        const nl = l + dl;
        const meio = chave(c + dc / 2, l + dl / 2);
        const fora = nc < 1 || nc >= COLUNAS || nl < 1 || nl >= LINHAS;
        if (fora || !livre(chave(nc, nl)) || (diagonal && !livre(meio))) {
          if (k > 0) pontos.push([c, l]);
          break trecho;
        }
        local.add(chave(nc, nl));
        if (diagonal) local.add(meio);
        c = nc;
        l = nl;
        passos++;
      }
      pontos.push([c, l]);
      // Saindo da diagonal: volta ao rumo anterior (degrau) ou completa os 90°
      if (diagonal && rnd() < 0.6) giro = -giro;
      rumo = (rumo + giro + 8) % 8;
    }

    if (passos < 6) return null;
    local.forEach((k) => ocupado.add(k));
    return pontos;
  }

  function adicionar(pontos: Ponto[], doChip: boolean) {
    let comprimento = 0;
    for (let i = 1; i < pontos.length; i++)
      comprimento += Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]) * PASSO;

    let pulso: Pulso | undefined;
    if (rnd() < (doChip ? 0.85 : 0.5)) {
      const velocidade = 55 + rnd() * 75; // px/s
      // O pulso percorre a trilha em 55% do ciclo; o resto é pausa
      const duracao = comprimento / velocidade / 0.55;
      pulso = { duracao, atraso: -rnd() * duracao, tamanho: Math.min(26 + rnd() * 34, comprimento / 2) };
    }
    trilhas.push({ pontos, comprimento, doChip, pulso });
  }

  // Primeiro os pinos dos chips (para não ficarem bloqueados); o pulso chega no chip
  for (const chip of CHIPS) {
    const pinos: [number, number, number][] = [];
    for (let c = chip.c + 1; c < chip.c + chip.w; c++) pinos.push([c, chip.l, 6], [c, chip.l + chip.h, 2]);
    for (let l = chip.l + 1; l < chip.l + chip.h; l++) pinos.push([chip.c, l, 4], [chip.c + chip.w, l, 0]);
    for (const [c, l, rumo] of pinos) {
      if (rnd() > 0.8) continue;
      const pontos = tracar(c, l, rumo, 3 + Math.floor(rnd() * 4));
      if (pontos) adicionar(pontos.reverse(), true);
    }
  }

  // Depois trilhas soltas, entre duas ilhas, preenchendo o resto da placa
  for (let t = 0; t < 500 && trilhas.length < 80; t++) {
    const c = 1 + Math.floor(rnd() * (COLUNAS - 1));
    const l = 1 + Math.floor(rnd() * (LINHAS - 1));
    if (ocupado.has(chave(c, l))) continue;
    const pontos = tracar(c, l, Math.floor(rnd() * 4) * 2, 2 + Math.floor(rnd() * 4));
    if (pontos) adicionar(rnd() < 0.5 ? pontos : pontos.reverse(), false);
  }

  return trilhas;
}

const TRILHAS = gerarPlaca();

const px = ([c, l]: Ponto): Ponto => [c * PASSO, l * PASSO];
const caminho = (pontos: Ponto[]) =>
  pontos.map((p, i) => `${i ? 'L' : 'M'}${px(p).join(' ')}`).join('');

function estiloPulso({ duracao, atraso, tamanho }: Pulso, comprimento: number) {
  return {
    '--pulso-de': tamanho,
    '--pulso-ate': -comprimento,
    strokeDasharray: `${tamanho} ${comprimento + tamanho}`,
    animation: `circuito-pulso ${duracao}s linear ${atraso}s infinite`,
  } as CSSProperties;
}

const estiloChegada = ({ duracao, atraso }: Pulso): CSSProperties => ({
  animation: `circuito-chegada ${duracao}s linear ${atraso}s infinite`,
});

export default function CircuitoAnimado({ className }: { className?: string }) {
  const comPulso = TRILHAS.filter((t): t is Trilha & { pulso: Pulso } => !!t.pulso);

  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Trilhas apagadas */}
      <g className="stroke-sinal/40" strokeWidth={2}>
        {TRILHAS.map((t, i) => <path key={i} d={caminho(t.pontos)} />)}
      </g>

      {/* Ilhas de cobre nas pontas soltas (a ponta do chip é o pino) */}
      <g className="fill-noite stroke-cobre/60" strokeWidth={1.6}>
        {TRILHAS.flatMap((t, i) => (t.doChip ? [t.pontos[0]] : [t.pontos[0], t.pontos[t.pontos.length - 1]])
          .map((p, j) => { const [x, y] = px(p); return <circle key={`${i}-${j}`} cx={x} cy={y} r={4.5} />; }))}
      </g>

      {/* Chips */}
      {CHIPS.map((chip) => {
        const x = chip.c * PASSO + 6;
        const y = chip.l * PASSO + 6;
        const w = chip.w * PASSO - 12;
        const h = chip.h * PASSO - 12;
        return (
          <g key={chip.nome}>
            <rect x={x} y={y} width={w} height={h} rx={6} className="fill-noite-alto stroke-sinal/70" strokeWidth={1.6} />
            <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={3} className="stroke-white/5" />
            <text x={x + 8} y={y + h - 8} className="fill-white/25 font-codigo" fontSize={9} letterSpacing={1}>{chip.nome}</text>
          </g>
        );
      })}
      <SimboloDoChip chip={CHIPS[0]} />

      {/* Pulsos de energia: um halo largo e um núcleo claro */}
      <g className="motion-reduce:hidden">
        {comPulso.map((t, i) => {
          const d = caminho(t.pontos);
          const [x, y] = px(t.pontos[t.pontos.length - 1]);
          return (
            <g key={i}>
              <g style={estiloPulso(t.pulso, t.comprimento)}>
                <path d={d} className="stroke-sinal-claro/20" strokeWidth={8} />
                <path d={d} className="stroke-sinal-claro" strokeWidth={2.2} />
              </g>
              <circle cx={x} cy={y} r={t.doChip ? 6 : 9} style={estiloChegada(t.pulso)}
                className={t.doChip ? 'fill-sinal-claro/60' : 'fill-cobre/50'} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Símbolo da NEO no chip principal, com o ponto "respirando"
function SimboloDoChip({ chip }: { chip: Chip }) {
  const escala = 1.6;
  const x = (chip.c + chip.w / 2) * PASSO - 24 * escala;
  const y = (chip.l + chip.h / 2) * PASSO - 24 * escala;
  return (
    <g>
      <circle cx={x + 36.3 * escala} cy={y + 15.4 * escala} r={16} className="fill-sinal-claro/40 motion-reduce:hidden"
        style={{ animation: 'circuito-respira 4.8s ease-in-out infinite' }} />
      <Simbolo {...CORES.escuro} x={x} y={y} escala={escala} />
    </g>
  );
}
