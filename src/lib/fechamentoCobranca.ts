/**
 * lib/fechamentoCobranca.ts — regras do lançamento de cobrança da Manutenção (puro, testável em Node)
 *
 * Uma NSIS pode ter vários códigos. Os códigos que saem na mesma NSMP formam um lançamento,
 * com uma só NSPR e uma só AP. No banco cada código continua sendo uma linha de neo_nsis_itens.
 * Fator = 1 + 0,2 se rural + 0,2 se COD (a mesma soma do Faturamento).
 */

export type Fator = 1 | 1.2 | 1.4;

export const FATORES: { valor: Fator; rotulo: string; legenda: string }[] = [
  { valor: 1, rotulo: '× 1,0', legenda: 'Urbano e CSC' },
  { valor: 1.2, rotulo: '× 1,2', legenda: 'Rural ou COD' },
  { valor: 1.4, rotulo: '× 1,4', legenda: 'Rural e COD' },
];

const quatroCasas = (v: number) => Math.round(v * 10000) / 10000;

/** Fator sugerido ao abrir o lançamento: a zona está no relatório, o despacho quem fecha informa. */
export function fatorPadrao(zona: string | null | undefined): Fator {
  return zona === 'R' ? 1.2 : 1;
}

export function textoFator(fator: number): string {
  return fator.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Valor pedido para um código: fator do código × quantidade × fator de rural/COD. */
export function calcularValor(fatorCodigo: number, quantidade: number, fator: number): number {
  return quatroCasas(fatorCodigo * quantidade * fator);
}

export function totalPedido(itens: { valor_inicial: number | null }[]): number {
  return quatroCasas(itens.reduce((soma, it) => soma + (it.valor_inicial ?? 0), 0));
}

interface ItemDoLancamento {
  id: string;
  nsmp: string | null;
  nspr: string | null;
  fatura: string | null;
  valor_inicial: number | null;
  valor_final: number | null;
}

export interface Lancamento<T extends ItemDoLancamento> {
  chave: string;
  nsmp: string | null;
  nspr: string | null;
  fatura: string | null;
  itens: T[];
  pedido: number;
  pago: number;
  /** tem NSPR, mas falta o valor pago de algum código */
  semValorPago: boolean;
  /** valor pago informado e diferente do pedido */
  divergente: boolean;
}

/**
 * Junta os códigos que têm a mesma NSMP, NSPR e AP, na ordem em que apareceram.
 * Os que ainda não têm NSMP formam um lançamento só: a próxima NSMP vale para todos.
 * NSPR ou AP diferentes na mesma NSMP ficam separados para o dado não ser escondido.
 */
export function agruparLancamentos<T extends ItemDoLancamento>(itens: T[]): Lancamento<T>[] {
  const grupos = new Map<string, T[]>();
  for (const it of itens) {
    const chave = JSON.stringify([it.nsmp, it.nspr, it.fatura]);
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(it);
    else grupos.set(chave, [it]);
  }
  return [...grupos].map(([chave, doGrupo]) => {
    const { nsmp, nspr, fatura } = doGrupo[0];
    const pedido = totalPedido(doGrupo);
    const pago = quatroCasas(doGrupo.reduce((soma, it) => soma + (it.valor_final ?? 0), 0));
    const semValorPago = nspr !== null && doGrupo.some((it) => it.valor_final === null);
    return {
      chave, nsmp, nspr, fatura, itens: doGrupo, pedido, pago, semValorPago,
      divergente: nspr !== null && !semValorPago && pago !== pedido,
    };
  });
}

/**
 * A CEMIG devolve um valor pago para a NSMP inteira; os códigos dividem esse valor
 * na proporção do que foi pedido. O último absorve a sobra do arredondamento, para a
 * soma continuar igual ao valor informado. Sem pedido, o valor fica no primeiro código.
 */
export function ratearPago(itens: { id: string; valor_inicial: number | null }[], total: number | null): { id: string; valor_final: number | null }[] {
  if (total === null) return itens.map(({ id }) => ({ id, valor_final: null }));
  const pedido = totalPedido(itens);
  if (pedido === 0) return itens.map(({ id }, i) => ({ id, valor_final: i === 0 ? total : 0 }));
  let distribuido = 0;
  return itens.map(({ id, valor_inicial }, i) => {
    const parte = i === itens.length - 1
      ? quatroCasas(total - distribuido)
      : quatroCasas(total * (valor_inicial ?? 0) / pedido);
    distribuido = quatroCasas(distribuido + parte);
    return { id, valor_final: parte };
  });
}
