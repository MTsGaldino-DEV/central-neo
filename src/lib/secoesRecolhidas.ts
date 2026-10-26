// Seções do menu lateral que o usuário fechou; fica só neste navegador. Sem acesso ao
// armazenamento (aba anônima, bloqueio), o menu começa todo aberto.
type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>;
const CHAVE = 'neo-menu-recolhidas';
const padrao = (): Armazenamento | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function lerRecolhidas(arm: Armazenamento | null = padrao()): Set<string> {
  try {
    const v: unknown = JSON.parse(arm?.getItem(CHAVE) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}

export function gravarRecolhidas(s: Set<string>, arm: Armazenamento | null = padrao()): void {
  try { arm?.setItem(CHAVE, JSON.stringify([...s])); } catch { /* sem armazenamento: só não lembra */ }
}
