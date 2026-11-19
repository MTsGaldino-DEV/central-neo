/**
 * lib/fechamentoFluxo.ts — listas (NSIS/NSRI), etapas e colunas da fila de fechamento (puro, testável em Node)
 *
 * No fluxo novo as colunas acumulam conforme a etapa (A fechar → … → Concluída) e a
 * coluna Etapa fica sempre por último. O histórico mantém as colunas de hoje.
 */
import type { Etapa } from './fechamento';

export type ColunaFluxo =
  | 'servico' | 'tipo_serv' | 'localidade' | 'termino' | 'equipes'
  | 'nsmps' | 'nsprs' | 'valor_lancamento' | 'valor_pago' | 'data_lancamento_sf' | 'faturas' | 'observacao' | 'etapa';

export const COLUNAS_FLUXO: { id: ColunaFluxo; rotulo: string; numero?: boolean }[] = [
  { id: 'servico', rotulo: 'N° Serviço' },
  { id: 'tipo_serv', rotulo: 'Tipo' },
  { id: 'localidade', rotulo: 'Localidade' },
  { id: 'termino', rotulo: 'DT execução' },
  { id: 'equipes', rotulo: 'Equipe' },
  { id: 'nsmps', rotulo: 'NSMP' },
  { id: 'nsprs', rotulo: 'NSPR/NSMC' },
  { id: 'valor_lancamento', rotulo: 'Lançamento Salesforce', numero: true },
  { id: 'valor_pago', rotulo: 'Valor pago', numero: true },
  { id: 'data_lancamento_sf', rotulo: 'Data lançamento SF' },
  { id: 'faturas', rotulo: 'Apropriação' },
  { id: 'observacao', rotulo: 'Observação' },
  { id: 'etapa', rotulo: 'Etapa' },
];

const BASE: ColunaFluxo[] = ['servico', 'tipo_serv', 'localidade', 'termino'];
const APOS_NSMP: ColunaFluxo[] = ['equipes', 'nsmps'];
const APOS_NSPR: ColunaFluxo[] = ['nsprs', 'valor_pago'];

/** Colunas de hoje, usadas pelo histórico (nunca localidade nem data de lançamento). */
const COLUNAS_HISTORICO: ColunaFluxo[] = [
  'servico', 'tipo_serv', 'nsmps', 'equipes', 'nsprs', 'termino', 'valor_lancamento', 'valor_pago', 'faturas', 'observacao', 'etapa',
];

/** A fila de fechamento separa NSIS e NSRI: cada lista tem o próprio fluxo. */
export type ListaFechamento = 'NSIS' | 'NSRI';

/**
 * Etapas do fluxo de cada lista. A NSRI não tem NSPR: a NSMC (que vale como NSPR) e o valor pago
 * entram em "Em revisão" e ela vai direto para o Salesforce.
 */
export function etapasDaLista(lista: ListaFechamento): Etapa[] {
  return lista === 'NSRI'
    ? ['A_FECHAR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA']
    : ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA'];
}

/** Rótulo da coluna na lista: a coluna NSPR/NSMC vira "NSPR" na NSIS e "NSMC" na NSRI. */
export function rotuloColuna(id: ColunaFluxo, lista?: ListaFechamento): string {
  if (id === 'nsprs' && lista) return lista === 'NSRI' ? 'NSMC' : 'NSPR';
  return COLUNAS_FLUXO.find((c) => c.id === id)?.rotulo ?? id;
}

/**
 * Colunas que a fila mostra. `historico` = a lista tem NSIS históricas. As etapas que só existem
 * no histórico (Gerar NSMP, Aguardando fatura, Sem cobrança) usam o conjunto histórico sempre.
 * Com `lista`, a coluna Tipo sai (a lista já é de um tipo só) e, na NSRI, o NSMP sai também: o número
 * informado é a NSMC, gravada no NSMP e no NSPR, e aparece na coluna NSMC.
 */
export function colunasVisiveis(etapa: Etapa | 'TODAS', historico: boolean, lista?: ListaFechamento): ColunaFluxo[] {
  const colunas = colunasDaEtapa(etapa, historico);
  if (!lista) return colunas;
  return colunas.filter((c) => c !== 'tipo_serv' && !(lista === 'NSRI' && c === 'nsmps'));
}

function colunasDaEtapa(etapa: Etapa | 'TODAS', historico: boolean): ColunaFluxo[] {
  // Aguardando NSPR: o NSPR, o lançamento, o valor pago e a apropriação ainda não existem (entram nas etapas seguintes),
  // mesmo quando a NSIS veio do histórico
  if (etapa === 'AGUARDANDO_NSPR') return [...BASE, ...APOS_NSMP, 'etapa'];
  if (historico) return [...COLUNAS_HISTORICO];
  switch (etapa) {
    case 'A_FECHAR': return [...BASE, 'observacao', 'etapa'];
    case 'AGUARDANDO_SALESFORCE': return [...BASE, ...APOS_NSMP, ...APOS_NSPR, 'etapa'];
    case 'AGUARDANDO_APROPRIACAO': return [...BASE, ...APOS_NSMP, ...APOS_NSPR, 'data_lancamento_sf', 'etapa'];
    case 'FATURADA': return [...BASE, ...APOS_NSMP, ...APOS_NSPR, 'data_lancamento_sf', 'faturas', 'etapa'];
    // Todas: tudo, menos o valor de lançamento Salesforce (não é mais usado nesta aba)
    case 'TODAS': return COLUNAS_FLUXO.map((c) => c.id).filter((id) => id !== 'valor_lancamento');
    default: return [...COLUNAS_HISTORICO];
  }
}
