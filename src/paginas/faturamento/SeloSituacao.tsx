import { SITUACOES_SERVICO_FAT } from '@/lib/faturamentoTexto';

const CORES: Record<string, string> = {
  OK: 'bg-nevoa text-aco', A_MENOS: 'bg-erro-fundo text-erro', A_MAIS: 'bg-concluido-fundo text-concluido', GLOSADO: 'bg-glosa-fundo text-glosa',
  FORA_CONTRATO: 'bg-pendente-fundo text-pendente', CONFERIDO: 'bg-sinal-fundo text-sinal',
};

export function SeloSituacao({ situacao }: { situacao: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${CORES[situacao] ?? 'bg-nevoa text-aco'}`}>{SITUACOES_SERVICO_FAT[situacao] ?? situacao}</span>;
}
