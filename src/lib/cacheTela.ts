// Últimos dados vistos em cada tela, para abrir na hora e atualizar por baixo.
// Armazenamento bloqueado (aba anônima, cota) só desliga o cache: nunca quebra a tela.
const PREFIXO = 'neo-fat:';

export function lerCache<T>(chave: string, armazenamento?: Pick<Storage,'getItem'>): { dados: T; salvoEm: number } | null {
  try {
    const texto = (armazenamento ?? globalThis.localStorage).getItem(PREFIXO + chave);
    if (!texto) return null;
    const v = JSON.parse(texto);
    return v && typeof v.salvoEm === 'number' && 'dados' in v ? v : null;
  } catch { return null; }
}

export function gravarCache<T>(chave: string, dados: T, armazenamento?: Pick<Storage,'setItem'>): void {
  try { (armazenamento ?? globalThis.localStorage).setItem(PREFIXO + chave, JSON.stringify({ dados, salvoEm: Date.now() })); } catch { /* sem cache */ }
}

export function tempoRelativo(ms: number, agora = Date.now()): string {
  const min = Math.floor((agora - ms) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}
