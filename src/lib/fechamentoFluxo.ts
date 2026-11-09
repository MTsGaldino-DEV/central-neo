/**
 * lib/fechamentoFluxo.ts — colunas da fila de NSIS por etapa (puro, testável em Node)
 *
 * No fluxo novo as colunas acumulam conforme a etapa (A fechar → … → Concluída) e a
 * coluna Etapa fica sempre por último. O histórico mantém as colunas de hoje.
 */
import type { Etapa } from './fechamento';

export type ColunaFluxo =
  | 'servico' | 'tipo_serv' | 'localidade' | 'termino' | 'equipes' | 'supervisor'
  | 'nsmps' | 'nsprs' | 'valor_lancamento' | 'valor_pago' | 'data_lancamento_sf' | 'faturas' | 'observacao' | 'etapa';

export const COLUNAS_FLUXO: { id: ColunaFluxo; rotulo: string; numero?: boolean }[] = [
  { id: 'servico', rotulo: 'N° Serviço' },
  { id: 'tipo_serv', rotulo: 'Tipo do serviço' },
  { id: 'localidade', rotulo: 'Localidade' },
  { id: 'termino', rotulo: 'DT execução' },
  { id: 'equipes', rotulo: 'Equipe' },
  { id: 'supervisor', rotulo: 'Supervisor' },
  { id: 'nsmps', rotulo: 'NSMP' },
  { id: 'nsprs', rotulo: 'NSPR' },
  { id: 'valor_lancamento', rotulo: 'Lançamento Salesforce', numero: true },
  { id: 'valor_pago', rotulo: 'Valor pago', numero: true },
  { id: 'data_lancamento_sf', rotulo: 'Data lançamento SF' },
  { id: 'faturas', rotulo: 'Apropriação' },
  { id: 'observacao', rotulo: 'Observação' },
  { id: 'etapa', rotulo: 'Etapa' },
];

const BASE: ColunaFluxo[] = ['servico', 'tipo_serv', 'localidade', 'termino'];
const APOS_NSMP: ColunaFluxo[] = ['equipes', 'supervisor', 'nsmps'];
const APOS_NSPR: ColunaFluxo[] = ['nsprs', 'valor_pago'];

/** Colunas de hoje, usadas pelo histórico (nunca localidade nem data de lançamento). */
const COLUNAS_HISTORICO: ColunaFluxo[] = [
  'servico', 'tipo_serv', 'nsmps', 'equipes', 'supervisor', 'nsprs', 'termino', 'valor_lancamento', 'valor_pago', 'faturas', 'observacao', 'etapa',
];

/**
 * Colunas que a fila mostra. `historico` = a lista tem NSIS históricas. As etapas que só existem
 * no histórico (Gerar NSMP, Aguardando fatura, Sem cobrança) usam o conjunto histórico sempre.
 */
export function colunasVisiveis(etapa: Etapa | 'TODAS', historico: boolean): ColunaFluxo[] {
  if (historico) return [...COLUNAS_HISTORICO];
  switch (etapa) {
    case 'A_FECHAR': return [...BASE, 'etapa'];
    case 'AGUARDANDO_NSPR': return [...BASE, ...APOS_NSMP, 'etapa'];
    case 'AGUARDANDO_SALESFORCE': return [...BASE, ...APOS_NSMP, ...APOS_NSPR, 'etapa'];
    case 'AGUARDANDO_APROPRIACAO': return [...BASE, ...APOS_NSMP, ...APOS_NSPR, 'data_lancamento_sf', 'etapa'];
    case 'FATURADA': return [...BASE, ...APOS_NSMP, ...APOS_NSPR, 'data_lancamento_sf', 'faturas', 'etapa'];
    case 'TODAS': return COLUNAS_FLUXO.map((c) => c.id);
    default: return [...COLUNAS_HISTORICO];
  }
}
