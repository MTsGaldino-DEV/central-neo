// Fator que a CEMIG pagou em relação à base do contrato (CSC urbano × 1,0): 1,0, 1,2 (rural ou
// COD), 1,4 (COD rural), 0,7 (Moto)… Sem React, para testar em Node.

export interface LinhaBaseFat {
  codserv: string; tabela: string | null; urbano: number; rural: number;
  horas?: number | null; us_hora?: number | null;
}
export interface ContratoBaseFat { tabela: string; codigo: string; fator_csc: number | null }

/** Valor do serviço como CSC urbano sem acréscimos; null quando nenhuma linha tem valor no contrato. */
export function baseServicoFat(linhas: LinhaBaseFat[], contrato: ContratoBaseFat[], rcPorAtendimento: boolean): number | null {
  const bases = linhas.map(l => {
    if (l.horas != null && l.us_hora != null) return Number(l.horas) * Number(l.us_hora);
    const c = contrato.find(x => x.codigo === l.codserv && x.tabela === l.tabela);
    if (c?.fator_csc == null) return null;
    const u = Number(l.urbano), r = Number(l.rural);
    return Number(c.fator_csc) * (l.tabela === '12' ? Math.min(u, 1) + Math.min(r, 1) : u + r);
  }).filter((b): b is number => b != null);
  if (!bases.length) return null;
  return rcPorAtendimento ? Math.max(...bases) : bases.reduce((a, b) => a + b, 0);
}

/** valor ÷ base, com 2 casas (1,2 / 1,4 / 0,84…); null sem base. */
export function fatorSobreBaseFat(valor: number | null, base: number | null): number | null {
  if (valor == null || base == null || base <= 0) return null;
  return Math.round(valor / base * 100) / 100;
}
