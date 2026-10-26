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

// O localStorage também guarda a sessão de login: o cache do Faturamento fica limitado.
const MAXIMO = 20;

export function gravarCache<T>(chave: string, dados: T, armazenamento?: Pick<Storage,'setItem'> & Partial<Pick<Storage,'getItem'|'removeItem'|'key'|'length'>>): void {
  try {
    const arm = armazenamento ?? globalThis.localStorage;
    arm.setItem(PREFIXO + chave, JSON.stringify({ dados, salvoEm: Date.now() }));
    if (!arm.key || !arm.removeItem || !arm.getItem || arm.length == null) return;
    const nossas: { k: string; em: number }[] = [];
    for (let i = 0; i < arm.length; i++) {
      const k = arm.key(i);
      if (!k?.startsWith(PREFIXO)) continue;
      let em = 0;
      try { em = JSON.parse(arm.getItem(k) ?? '{}').salvoEm ?? 0; } catch { /* entrada ruim sai primeiro */ }
      nossas.push({ k, em: k === PREFIXO + chave ? Infinity : em });
    }
    nossas.sort((a, b) => a.em - b.em).slice(0, Math.max(nossas.length - MAXIMO, 0)).forEach(({ k }) => arm.removeItem!(k));
  } catch { /* sem cache */ }
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
