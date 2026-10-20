type Status = "pendente" | "revisao" | "concluido" | "erro";

type StatusMedidorProps = {
  status: Status;
  rotulo?: string;
  className?: string;
};

const ROTULO_PADRAO: Record<Status, string> = {
  pendente: "PENDENTE",
  revisao: "REVISÃO",
  concluido: "CONCLUÍDO",
  erro: "ERRO",
};

const CLASSES: Record<Status, string> = {
  pendente: "text-pendente bg-pendente-fundo",
  revisao: "text-revisao bg-revisao-fundo",
  concluido: "text-concluido bg-concluido-fundo",
  erro: "text-erro bg-erro-fundo",
};

const MARCA: Record<Status, string> = {
  pendente: "text-pendente-marca",
  revisao: "text-revisao-marca",
  concluido: "text-concluido-marca",
  erro: "text-erro-marca",
};

function Marcador({ status }: { status: Status }) {
  const comum = {
    viewBox: "0 0 12 12",
    className: `size-3 shrink-0 ${MARCA[status]}`,
    "aria-hidden": true,
  } as const;

  // Pendente: anel vazio
  if (status === "pendente") {
    return (
      <svg {...comum} fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="6" r="3.5" />
      </svg>
    );
  }

  // Revisão: dois anéis lado a lado (caso ambíguo, mais de um candidato)
  if (status === "revisao") {
    return (
      <svg {...comum} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="3.6" cy="6" r="2.6" />
        <circle cx="8.4" cy="6" r="2.6" />
      </svg>
    );
  }

  // Concluído: ponto cheio
  if (status === "concluido") {
    return (
      <svg {...comum} fill="currentColor">
        <circle cx="6" cy="6" r="3.5" />
      </svg>
    );
  }

  // Erro: anel com barra
  return (
    <svg {...comum} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="3.5" />
      <line x1="3.5" y1="8.5" x2="8.5" y2="3.5" />
    </svg>
  );
}

export function StatusMedidor({ status, rotulo, className }: StatusMedidorProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${CLASSES[status]} ${className ?? ""}`}
    >
      <Marcador status={status} />
      {rotulo ?? ROTULO_PADRAO[status]}
    </span>
  );
}

export default StatusMedidor;
