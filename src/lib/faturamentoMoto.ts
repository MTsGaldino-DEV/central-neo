// Valor Moto da tabela do contrato: mesma regra urbana do banco (migration 023/025).
import type { ContratoFat } from './faturamento';

export interface ValorMotoFat { fator: number | null; csc: number | null; cod: number | null; semDesconto: boolean; naoPaga: boolean }

/** Tabela 11 com moto '1' paga igual; com '0' não paga; o resto usa o fator global (neo_fat_config.moto_urbano). */
export function valorMoto(c: Pick<ContratoFat, 'tabela' | 'moto' | 'fator_csc' | 'fator_cod'>, motoUrbano: number): ValorMotoFat {
  if (c.tabela === '11' && c.moto === '0') return { fator: 0, csc: null, cod: null, semDesconto: false, naoPaga: true };
  const fator = c.tabela === '11' && c.moto === '1' ? 1 : motoUrbano;
  const aplicar = (v: number | null) => v == null ? null : fator === 1 ? Number(v) : Math.round(Number(v) * fator * 1e6) / 1e6;
  return { fator, csc: aplicar(c.fator_csc), cod: aplicar(c.fator_cod), semDesconto: fator === 1, naoPaga: false };
}
