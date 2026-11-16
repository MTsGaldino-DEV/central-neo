import { infoEtapa, type Etapa } from '@/lib/fechamento';

/**
 * Selo da etapa na grade da fila: pílula com fundo e borda suaves, sem bolinha, como o
 * EtapaBadge da lista de Instalações do Visão de Dono. Cores equivalentes às de lá
 * (Em revisão = primeira etapa, azul; NSPR laranja; Salesforce verde-água; apropriação índigo; concluída verde).
 */
const SELO: Record<Etapa, { cor: string; bg: string; borda: string }> = {
  A_FECHAR: { cor: '#1d4ed8', bg: '#eff6ff', borda: '#bfdbfe' },
  AGUARDANDO_NSMP: { cor: '#7c3aed', bg: '#faf5ff', borda: '#ddd6fe' },
  AGUARDANDO_NSPR: { cor: '#c2410c', bg: '#fff7ed', borda: '#fed7aa' },
  AGUARDANDO_SALESFORCE: { cor: '#0f766e', bg: '#f0fdfa', borda: '#99f6e4' },
  AGUARDANDO_APROPRIACAO: { cor: '#4338ca', bg: '#eef2ff', borda: '#c7d2fe' },
  AGUARDANDO_FATURA: { cor: '#854d0e', bg: '#fef9c3', borda: '#fde68a' },
  FATURADA: { cor: '#15803d', bg: '#f0fdf4', borda: '#bbf7d0' },
  SEM_COBRANCA: { cor: '#64748b', bg: '#f8fafc', borda: '#e2e8f0' },
};

export default function EtapaChip({ etapa, curto = false, selo = false }: { etapa: Etapa; curto?: boolean; selo?: boolean }) {
  const e = infoEtapa(etapa);
  if (selo) {
    const s = SELO[e.id];
    return (
      <span className="inline-block rounded-full border px-2 py-[3px] text-[11px] font-bold whitespace-nowrap"
        style={{ background: s.bg, color: s.cor, borderColor: s.borda }}>
        {curto ? e.curto : e.nome}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${e.classe}`}>
      <span className={`size-1.5 rounded-full ${e.marca}`} />
      {curto ? e.curto : e.nome}
    </span>
  );
}
