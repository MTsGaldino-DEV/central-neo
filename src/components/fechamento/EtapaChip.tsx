import { infoEtapa, type Etapa } from '@/lib/fechamento';

export default function EtapaChip({ etapa, curto = false }: { etapa: Etapa; curto?: boolean }) {
  const e = infoEtapa(etapa);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${e.classe}`}>
      <span className={`size-1.5 rounded-full ${e.marca}`} />
      {curto ? e.curto : e.nome}
    </span>
  );
}
