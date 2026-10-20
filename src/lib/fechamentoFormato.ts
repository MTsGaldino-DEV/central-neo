/**
 * lib/fechamentoFormato.ts — Conversões de texto do fechamento, sem dependências
 * (não puxa a biblioteca de planilhas para a tela inicial).
 */

/** "0,32" ou "0.32" ou 0.32 → 0.32. Vazio → null. */
export function lerNumero(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Padroniza a apropriação/fatura: "83809" → "AP 83809", "AP100644" → "AP 100644".
 * Sem isso a mesma fatura aparece separada no comparativo.
 */
export function normalizarAP(v: string): string {
  const s = v.trim().toUpperCase().replace(/\s+/g, ' ');
  if (/^\d+$/.test(s)) return `AP ${s}`;
  return s.replace(/\bAP\s*(?=\d)/g, 'AP ');
}
