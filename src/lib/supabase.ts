import { createClient } from '@supabase/supabase-js';

/**
 * Dois projetos Supabase:
 *
 * - `supabase` → CENTRAL-NEO (principal): login, colaboradores, acessos, fechamento.
 * - `supabaseTraceone` → TRACEONE (emprestado): só medidores. Tem sessão própria,
 *   aberta com o mesmo e-mail e senha da NEO (lib/auth.ts), porque a RLS dos
 *   medidores depende do papel do usuário no TraceOne.
 */
export const supabase = createClient(
  import.meta.env.VITE_NEO_SUPABASE_URL as string,
  import.meta.env.VITE_NEO_SUPABASE_ANON_KEY as string,
);

export const supabaseTraceone = createClient(
  import.meta.env.VITE_TRACEONE_SUPABASE_URL as string,
  import.meta.env.VITE_TRACEONE_SUPABASE_ANON_KEY as string,
  { auth: { storageKey: 'neo-traceone-auth', detectSessionInUrl: false } },
);

// ─── Tipos base ──────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'GESTOR' | 'SUPERVISOR' | 'ALMOXARIFADO' | 'DESPACHANTE';
export type StatusMedidor = 'PENDENTE' | 'CONCLUIDO';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoMedidor {
  cod_sap: string;
  tipo: string;
  ligacao: 'direto' | 'indireto';
  valor: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Colaborador {
  matricula: string;
  nome: string;
  supervisor?: string;
  gc?: string;
  go?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Medidor {
  id: string;
  data: string;               // date de atribuição
  material_sap: string;       // FK tipos_de_medidores
  serial: string;
  matricula: string;          // FK colaboradores
  servico_gdis?: string;      // FK servicos_report, preenchido pelo matching
  status: StatusMedidor;
  data_conclusao?: string;
  servico_campo?: string;
  equipe?: string;
  atualizacao: string;
  created_at: string;
}

export interface ServicoReport {
  servico: string;
  matricula?: string;         // FK colaboradores
  termino: string;
  cod_serv?: string;
  tipo_serv?: string;
  imported_at: string;
}

export type StatusConferencia = 'PENDENTE' | 'CONFERIDO' | 'AGUARDANDO_VINCULACAO';

export interface ServicoReportConferencia extends ServicoReport {
  status_conferencia: StatusConferencia;
  medidor_serial_vinculado?: string | null;
  conferido_em?: string | null;
  serial_buscado?: string | null;
}

// Alias específico para registros AGUARDANDO_VINCULACAO
export type ServicoReportAguardando = ServicoReportConferencia & {
  serial_buscado: string;
};

export interface MedidorCompleto {
  id: string;
  Data: string;
  'Material SAP': string;
  Serial: string;
  MATRICULA: string;
  COLABORADOR: string;
  SUPERVISOR?: string;
  'SERVIÇO GDIS'?: string;
  'Concluído/Pendente': StatusMedidor;
  VALOR: number;
  EQUIPAMENTO: string;
  'DIAS DE ATRIBUIÇÃO': number;
  'Data da conclusão'?: string;
  ATUALIZAÇÃO: string;
  'SERVIÇO CAMPO'?: string;
  EQUIPE?: string;
  reatribuido_de_id?: string | null;
  reatribuido_para_id?: string | null;
  data_reatribuicao?: string | null;
}

export interface MatchCandidato {
  medidor_id: string;
  candidatos: number;
}
