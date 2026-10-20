/**
 * lib/api.ts — Camada de acesso a dados via Supabase
 * Módulo Controle de Medidores
 */
// Tudo aqui é do TraceOne (medidores): usa o cliente do projeto TraceOne.
import { supabaseTraceone as supabase } from './supabase';
import type {
  Profile,
  TipoMedidor,
  Colaborador,
  Medidor,
  ServicoReport,
  ServicoReportConferencia,
  ServicoReportAguardando,
  MedidorCompleto,
  MatchCandidato,
} from './supabase';
import type { ItemLucas } from './planilhaLucas';

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

// ─── Tipos de Medidores ───────────────────────────────────────────────────────

export async function getTiposMedidores(apenasAtivos = true): Promise<TipoMedidor[]> {
  let query = supabase.from('tipos_de_medidores').select('*').order('tipo');
  if (apenasAtivos) query = query.eq('ativo', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TipoMedidor[];
}

export async function createTipoMedidor(
  payload: Omit<TipoMedidor, 'created_at' | 'updated_at'>
): Promise<TipoMedidor> {
  const { data, error } = await supabase
    .from('tipos_de_medidores')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TipoMedidor;
}

// ─── Colaboradores ────────────────────────────────────────────────────────────

export async function getColaboradores(search?: string): Promise<Colaborador[]> {
  let query = supabase.from('colaboradores').select('*').order('nome');
  if (search) {
    query = query.or(`matricula.ilike.%${search}%,nome.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Colaborador[];
}

export async function createColaborador(
  payload: Omit<Colaborador, 'created_at' | 'updated_at'>
): Promise<Colaborador> {
  const { data, error } = await supabase
    .from('colaboradores')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Colaborador;
}

export async function updateColaborador(
  matricula: string,
  patch: Partial<Omit<Colaborador, 'matricula' | 'created_at' | 'updated_at'>>
): Promise<Colaborador> {
  const { data, error } = await supabase
    .from('colaboradores')
    .update(patch)
    .eq('matricula', matricula)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Colaborador;
}

/** Quantos medidores estão vinculados a esta matrícula (bloqueiam a exclusão). */
export async function countMedidoresDoColaborador(matricula: string): Promise<number> {
  const { count, error } = await supabase
    .from('medidores_list')
    .select('id', { count: 'exact', head: true })
    .eq('matricula', matricula);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteColaborador(matricula: string): Promise<void> {
  const { error } = await supabase
    .from('colaboradores')
    .delete()
    .eq('matricula', matricula);
  if (error) {
    // 23503 = foreign_key_violation — há medidores/serviços apontando pra ele
    if (error.code === '23503') {
      throw new Error(
        'Este colaborador possui medidores ou serviços vinculados e não pode ser excluído. Marque-o como inativo.'
      );
    }
    throw new Error(error.message);
  }
}

// ─── Medidores ────────────────────────────────────────────────────────────────

export interface SortConfig {
  column: string; // display/safe name
  ascending: boolean;
}

export async function getSupervisores(): Promise<string[]> {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('supervisor')
    .not('supervisor', 'is', null)
    .order('supervisor');
  if (error) throw new Error(error.message);
  const unique = [...new Set((data ?? []).map((d: { supervisor: string }) => d.supervisor).filter(Boolean))];
  return unique as string[];
}

export async function getMedidoresCompleto(filters?: {
  matriculas?: string[];
  supervisores?: string[];
  servicoGdis?: string;
  serial?: string;
  status?: string[];
  atribuicaoInicio?: string;
  atribuicaoFim?: string;
  conclusaoInicio?: string;
  conclusaoFim?: string;
  materialSapCodes?: string[];
  diasMin?: number;
  sorts?: SortConfig[];
  page?: number;
  pageSize?: number;
}): Promise<{ data: MedidorCompleto[]; total: number }> {
  let query = supabase
    .from('vw_medidores_completo')
    .select('*', { count: 'exact' });

  if (filters?.sorts && filters.sorts.length > 0) {
    for (const sort of filters.sorts) {
      const dbCol = sort.column === 'Concluído/Pendente' ? '"Concluído/Pendente"' : sort.column;
      query = query.order(dbCol, { ascending: sort.ascending });
    }
  } else {
    query = query.order('Data', { ascending: false });
  }

  if (filters?.matriculas && filters.matriculas.length > 0) {
    query = query.in('MATRICULA', filters.matriculas);
  }
  if (filters?.supervisores && filters.supervisores.length > 0) {
    query = query.in('SUPERVISOR', filters.supervisores);
  }
  if (filters?.servicoGdis) {
    query = query.ilike('"SERVIÇO GDIS"', `%${filters.servicoGdis.trim()}%`);
  }
  if (filters?.serial) {
    const rawSerials = filters.serial.split(',').map((s) => s.trim()).filter(Boolean);
    if (rawSerials.length === 1) {
      query = query.ilike('"Serial"', `%${rawSerials[0]}%`);
    } else if (rawSerials.length > 1) {
      const orCondition = rawSerials.map((s) => `"Serial".ilike.%${s}%`).join(',');
      query = query.or(orCondition);
    }
  }
  if (filters?.status && filters.status.length > 0) {
    query = query.in('"Concluído/Pendente"', filters.status);
  }
  if (filters?.atribuicaoInicio) query = query.gte('Data', filters.atribuicaoInicio);
  if (filters?.atribuicaoFim) query = query.lte('Data', filters.atribuicaoFim);
  if (filters?.conclusaoInicio) query = query.gte('Data da conclusão', filters.conclusaoInicio);
  if (filters?.conclusaoFim) query = query.lte('Data da conclusão', filters.conclusaoFim);
  if (filters?.diasMin !== undefined) query = query.gt('"DIAS DE ATRIBUIÇÃO"', filters.diasMin);

  if (filters?.materialSapCodes && filters.materialSapCodes.length > 0) {
    query = query.in('Material SAP', filters.materialSapCodes);
  }

  if (filters?.page && filters?.pageSize) {
    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    query = query.range(from, to);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as MedidorCompleto[], total: count ?? 0 };
}

// Busca todos os registros de uma filtragem, paginando em blocos de 1000
// (limite máximo do PostgREST por requisição) até esgotar os resultados.
export async function getAllMedidoresCompleto(
  filters?: Omit<Parameters<typeof getMedidoresCompleto>[0], 'page' | 'pageSize'>
): Promise<MedidorCompleto[]> {
  const all: MedidorCompleto[] = [];
  const pageSize = 1000;
  let page = 1;

  while (true) {
    const { data } = await getMedidoresCompleto({ ...filters, page, pageSize });
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  return all;
}

export async function createMedidor(
  payload: Pick<Medidor, 'data' | 'material_sap' | 'serial' | 'matricula' | 'servico_campo' | 'equipe'>
): Promise<Medidor> {
  const { data, error } = await supabase
    .from('medidores_list')
    .insert({ ...payload, status: 'PENDENTE' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Medidor;
}

export async function createMedidores(
  payloads: Pick<Medidor, 'data' | 'material_sap' | 'serial' | 'matricula'>[]
): Promise<Medidor[]> {
  const rows = payloads.map((p) => ({ ...p, status: 'PENDENTE' as const }));
  const { data, error } = await supabase
    .from('medidores_list')
    .insert(rows)
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []) as Medidor[];
}

export type MedidorUpdatePayload = Partial<Omit<Medidor, 'servico_gdis' | 'data_conclusao'>> & {
  servico_gdis?: string | null;
  data_conclusao?: string | null;
};

/** O número do serviço GDIS informado não existe em servicos_report (ainda não foi importado). */
export class ServicoGdisInexistenteError extends Error {}

function traduzirErroFkServicoGdis(error: { code?: string; message: string }, servicoGdis: string | null | undefined): Error {
  if (error.code === '23503' && servicoGdis && error.message.includes('medidores_list_servico_gdis_fkey')) {
    return new ServicoGdisInexistenteError(
      `Serviço GDIS ${servicoGdis} não foi encontrado nos relatórios importados. Confira o número ou importe o relatório desse serviço antes de vincular.`
    );
  }
  return new Error(error.message);
}

/**
 * Cria o serviço em servicos_report se ele ainda não existe (vínculo manual
 * não depende de o serviço já ter vindo no relatório importado).
 */
async function garantirServicoReport(servico: string, serial?: string | null): Promise<void> {
  const { error } = await supabase.rpc('garantir_servico_report', {
    p_servico: servico,
    p_serial: serial ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateMedidor(id: string, payload: MedidorUpdatePayload): Promise<Medidor> {
  if (payload.servico_gdis) {
    await garantirServicoReport(payload.servico_gdis, payload.serial);
  }
  const { data, error } = await supabase
    .from('medidores_list')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw traduzirErroFkServicoGdis(error, payload.servico_gdis);
  return data as Medidor;
}

// ─── Logs de medidor ─────────────────────────────────────────────────────────

export interface MedidorLog {
  id: string;
  medidor_id: string;
  evento: string;
  descricao: string | null;
  created_at: string;
}

export async function getMedidorLogs(medidorId: string): Promise<MedidorLog[]> {
  const { data, error } = await supabase
    .from('medidor_logs')
    .select('*')
    .eq('medidor_id', medidorId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MedidorLog[];
}

export async function deleteMedidor(id: string): Promise<void> {
  const { error } = await supabase
    .from('medidores_list')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Serviços Report ──────────────────────────────────────────────────────────

export interface MatriculaNaoCadastrada {
  matricula: string;
  nome?: string;
}

/** Linha do relatorio GDIS. `nome` vem da planilha so para exibicao e nao e gravado. */
export type ServicoImportInput = Omit<ServicoReport, 'imported_at'> & { nome?: string };

export type ImportServicosResult =
  | { ok: true; imported: number }
  | { ok: false; matriculasNaoCadastradas: MatriculaNaoCadastrada[] };

/**
 * Matrícula iniciada em "C" é de terceiro: nunca entra no cadastro de
 * colaboradores, então não bloqueia a importação nem é gravada.
 */
function matriculaDeTerceiro(matricula?: string | null): boolean {
  return !!matricula && matricula.trim().toUpperCase().startsWith('C');
}

function normalizarMatricula(matricula?: string | null): string | null {
  const m = matricula?.trim().toLowerCase();
  if (!m || matriculaDeTerceiro(m)) return null;
  return m;
}

/** Colunas de servicos_report: `nome` vem da planilha mas não existe na tabela. */
function payloadServicos(rows: ServicoImportInput[]) {
  return rows.map((r) => ({
    servico: r.servico,
    matricula: normalizarMatricula(r.matricula),
    termino: r.termino,
    cod_serv: r.cod_serv,
    tipo_serv: r.tipo_serv,
  }));
}

/**
 * servicos_report.matricula e FK para colaboradores: uma unica matricula nao
 * cadastrada derruba o lote inteiro no banco, com erro incompreensivel. Entao
 * conferimos antes e, se faltar alguem, nao importamos nada e devolvemos quem
 * falta para a tela pedir o cadastro.
 */
export async function importServicos(
  rows: ServicoImportInput[]
): Promise<ImportServicosResult> {
  // guarda o nome da planilha por matricula, para identificar o colaborador no aviso
  const nomePorMatricula = new Map<string, string>();
  for (const r of rows) {
    const mat = normalizarMatricula(r.matricula);
    if (!mat) continue;
    const nome = r.nome?.trim();
    if (nome && !nomePorMatricula.has(mat)) nomePorMatricula.set(mat, nome);
  }

  const distintas = Array.from(
    new Set(
      rows
        .map((r) => normalizarMatricula(r.matricula))
        .filter((m): m is string => !!m)
    )
  );

  const conhecidas = new Set<string>();
  for (let i = 0; i < distintas.length; i += 200) {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('matricula')
      .in('matricula', distintas.slice(i, i + 200));
    if (error) throw new Error(error.message);
    (data ?? []).forEach((c) => conhecidas.add((c as { matricula: string }).matricula));
  }

  const faltantes = distintas.filter((m) => !conhecidas.has(m));
  if (faltantes.length > 0) {
    return {
      ok: false,
      matriculasNaoCadastradas: faltantes.map((matricula) => ({
        matricula,
        nome: nomePorMatricula.get(matricula),
      })),
    };
  }

  const payload = payloadServicos(rows);

  const { error } = await supabase
    .from('servicos_report')
    .upsert(payload, { onConflict: 'servico' });
  if (error) throw new Error(error.message);

  return { ok: true, imported: payload.length };
}

/**
 * Importa ignorando a trava de matrícula não cadastrada: quem não existe em
 * colaboradores entra sem matrícula. Restrito a SUPERVISOR, GESTOR e ADMIN —
 * a checagem de verdade é feita no banco, dentro da RPC.
 */
export async function importServicosForcado(
  rows: ServicoImportInput[]
): Promise<{ imported: number }> {
  const { data, error } = await supabase.rpc('importar_servicos_forcado', {
    p_itens: payloadServicos(rows),
  });
  if (error) throw new Error(error.message);
  return { imported: (data as number) ?? 0 };
}

// A lista pode encolher entre o carregamento e a troca de página (importação,
// vinculação automática, exclusão). Quando isso acontece o PostgREST devolve
// PGRST103 ("Requested range not satisfiable") em vez de uma página vazia, então
// refazemos a busca na primeira página e devolvemos a página efetiva.
async function buscarServicosPorStatus<T>(
  status: string,
  page: number,
  pageSize: number
): Promise<{ data: T[]; total: number; page: number }> {
  const consultar = (p: number) => {
    const from = (p - 1) * pageSize;
    return supabase
      .from('servicos_report')
      .select('*', { count: 'exact' })
      .eq('status_conferencia', status)
      .order('imported_at', { ascending: false })
      .range(from, from + pageSize - 1);
  };

  let paginaEfetiva = page;
  let { data, error, count } = await consultar(paginaEfetiva);

  if (error?.code === 'PGRST103' && paginaEfetiva !== 1) {
    paginaEfetiva = 1;
    ({ data, error, count } = await consultar(paginaEfetiva));
  }

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as T[], total: count ?? 0, page: paginaEfetiva };
}

export async function getServicosConferencia(
  page = 1,
  pageSize = 200
): Promise<{ data: ServicoReportConferencia[]; total: number; page: number }> {
  return buscarServicosPorStatus<ServicoReportConferencia>('PENDENTE', page, pageSize);
}

export async function getServicosAguardandoVinculacao(
  page = 1,
  pageSize = 200
): Promise<{ data: ServicoReportAguardando[]; total: number; page: number }> {
  return buscarServicosPorStatus<ServicoReportAguardando>('AGUARDANDO_VINCULACAO', page, pageSize);
}

/** Exclusão bloqueada porque o serviço já tem medidor vinculado (tela desatualizada). */
export class ServicoVinculadoError extends Error {}

export async function deleteServicoReport(servicoId: string): Promise<void> {
  // medidores_list.servico_gdis referencia servicos_report(servico) sem ON DELETE,
  // então excluir um serviço já vinculado estoura erro de chave estrangeira. Isso
  // acontece quando a tela está desatualizada e o medidor entrou no sistema depois.
  const { data: vinculados, error: erroConsulta } = await supabase
    .from('medidores_list')
    .select('serial')
    .eq('servico_gdis', servicoId)
    .limit(1);
  if (erroConsulta) throw new Error(erroConsulta.message);

  if (vinculados && vinculados.length > 0) {
    throw new ServicoVinculadoError(
      `Este serviço já foi vinculado ao medidor ${vinculados[0].serial} e não pode ser excluído.`
    );
  }

  const { error } = await supabase
    .from('servicos_report')
    .delete()
    .eq('servico', servicoId);
  if (error) {
    if (error.code === '23503') {
      throw new ServicoVinculadoError('Este serviço foi vinculado a um medidor agora há pouco e não pode ser excluído.');
    }
    throw new Error(error.message);
  }
}

export async function reverterServicoPendente(servicoId: string): Promise<void> {
  const { error } = await supabase
    .from('servicos_report')
    .update({ status_conferencia: 'PENDENTE', serial_buscado: null })
    .eq('servico', servicoId);
  if (error) throw new Error(error.message);
}

export async function verificarVinculacoesPendentes(): Promise<number> {
  const { data, error } = await supabase.rpc('verificar_vinculacoes_pendentes');
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export interface VincularResult {
  ok: boolean;
  aguardando?: boolean;
  error?: string;
  serial?: string;
  matricula?: string;
  nome?: string;
}

export async function vincularServicoMedidor(
  servicoId: string,
  serial: string
): Promise<VincularResult> {
  const { data, error } = await supabase.rpc('vincular_servico_medidor', {
    p_servico_id: servicoId,
    p_serial:     serial,
  });
  if (error) throw new Error(error.message);
  return data as VincularResult;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export async function runMatchMedidores(): Promise<MatchCandidato[]> {
  const { data, error } = await supabase.rpc('match_medidores');
  if (error) throw new Error(error.message);
  return (data ?? []) as MatchCandidato[];
}

// ─── Users/Profiles (Gestão de Usuários — ADMIN, GESTOR, SUPERVISOR) ─────────

export interface UserWithEmail extends Profile {
  email: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session) throw new Error('Sessão não encontrada');
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function getUsersWithEmail(): Promise<UserWithEmail[]> {
  const res = await fetch('/api/users', { headers: await authHeader() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Falha ao carregar usuários');
  return data.users as UserWithEmail[];
}

// Cria o usuário e envia um convite por email — o próprio usuário define a senha
// ao clicar no link. O admin nunca sabe/define a senha de ninguém.
export async function createUser(payload: {
  name: string;
  email: string;
  role: Profile['role'];
}): Promise<void> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Falha ao criar usuário');
}

export async function updateUserProfile(
  id: string,
  patch: { name?: string; email?: string; role?: Profile['role']; is_active?: boolean }
): Promise<void> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Falha ao atualizar usuário');
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
    headers: await authHeader(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Falha ao excluir usuário');
}

// Envia um email com link de redefinição de senha (usado tanto pelo "Esqueci
// minha senha" no login quanto pelo admin, na tela de Gestão de Usuários).
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-senha`,
  });
  if (error) throw new Error(error.message);
}

// Troca da própria senha: reautentica com a senha atual antes de aplicar a nova.
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Sessão inválida');

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) throw new Error('Senha atual incorreta');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// ─── Anti-Duplicidade / Reatribuição ─────────────────────────────────────────

export interface ConflictoInfo {
  serial: string;
  medidor_list_id: string;
  matricula_atual: string;
  nome_colaborador: string;
  data_atribuicao: string;
  dias_atribuido: number;
}

export interface ReatribuicaoHistorico {
  anterior?: {
    matricula: string;
    nome: string;
    data: string;
    data_reatribuicao: string;
  };
}

export async function verificarMedidorAtribuido(serial: string): Promise<ConflictoInfo | null> {
  const { data, error } = await supabase.rpc('verificar_medidor_atribuido', { p_serial: serial });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return { serial, ...data[0] } as ConflictoInfo;
}

export async function reatribuirMedidor(params: {
  serial: string;
  novaMatricula: string;
  sapMaterialId: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('reatribuir_medidor', {
    p_serial: params.serial,
    p_nova_matricula: params.novaMatricula,
    p_sap_material_id: params.sapMaterialId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getMedidorReatribuicaoInfo(medidorId: string): Promise<ReatribuicaoHistorico> {
  const { data: current, error: e1 } = await supabase
    .from('medidores_list')
    .select('reatribuido_de_id')
    .eq('id', medidorId)
    .single();

  if (e1 || !current?.reatribuido_de_id) return {};

  const { data: anterior } = await supabase
    .from('medidores_list')
    .select('matricula, data, data_reatribuicao')
    .eq('id', current.reatribuido_de_id)
    .single();

  if (!anterior) return {};

  const { data: colab } = await supabase
    .from('colaboradores')
    .select('nome')
    .eq('matricula', anterior.matricula)
    .single();

  return {
    anterior: {
      matricula: anterior.matricula,
      nome: colab?.nome ?? anterior.matricula,
      data: anterior.data,
      data_reatribuicao: anterior.data_reatribuicao,
    },
  };
}

// ─── Sync Atribuições (Planilha SAP) ────────────────────────────────────────

export interface MedidorParaSync {
  id: string;
  serial: string;
  matricula: string;
  material_sap: string;
  data: string;
}

export async function getMedidoresParaSync(): Promise<MedidorParaSync[]> {
  const result: MedidorParaSync[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('medidores_list')
      .select('id,serial,matricula,material_sap,data')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    result.push(...((data ?? []) as MedidorParaSync[]));
    if ((data ?? []).length < PAGE) break;
    from += PAGE;
  }
  return result;
}

export async function syncAtribuicoes(params: {
  updates: { id: string; patch: { matricula?: string; material_sap?: string; data?: string } }[];
  deletes: string[];
}): Promise<{ updated: number; deleted: number }> {
  let updated = 0;
  let deleted = 0;

  for (const { id, patch } of params.updates) {
    const { error } = await supabase.from('medidores_list').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    updated++;
  }

  const BATCH = 100;
  for (let i = 0; i < params.deletes.length; i += BATCH) {
    const batch = params.deletes.slice(i, i + BATCH);
    const { error } = await supabase.from('medidores_list').delete().in('id', batch);
    if (error) throw new Error(error.message);
    deleted += batch.length;
  }

  return { updated, deleted };
}

// ─── Planilha PC ──────────────────────────────────────────────────────────────

/** Estado atual de um medidor, para cruzar com a Planilha PC. */
export interface MedidorParaPC {
  id: string;
  serial: string;
  status: 'PENDENTE' | 'CONCLUIDO';
  servico_gdis: string | null;
  data: string;                    // data de atribuição
  data_conclusao: string | null;
  matricula: string;
}

/** Uma vinculação a aplicar: medidor ← serviço + data de instalação. */
export interface ItemPC {
  medidor_id: string;
  serial: string;
  servico: string;
  data_fim: string;                // YYYY-MM-DD
  tipo_serv: string;
  matricula: string;
}

export interface ResultadoPC {
  servicos_criados: number;
  medidores_atualizados: number;
  servicos_conferidos: number;
}

export async function getMedidoresParaPC(): Promise<MedidorParaPC[]> {
  const result: MedidorParaPC[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('medidores_list')
      .select('id,serial,status,servico_gdis,data,data_conclusao,matricula')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    result.push(...((data ?? []) as MedidorParaPC[]));
    if ((data ?? []).length < PAGE) break;
    from += PAGE;
  }
  return result;
}

/**
 * Aplica as vinculações em lotes. O RPC cria os serviços que ainda não existem
 * em servicos_report antes de vincular, então a FK de servico_gdis é satisfeita.
 */
export async function importarPlanilhaPC(
  itens: ItemPC[],
  onProgress?: (feitos: number, total: number) => void
): Promise<ResultadoPC> {
  const total: ResultadoPC = {
    servicos_criados: 0,
    medidores_atualizados: 0,
    servicos_conferidos: 0,
  };
  const BATCH = 500;
  for (let i = 0; i < itens.length; i += BATCH) {
    const lote = itens.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc('importar_planilha_pc', { p_itens: lote });
    if (error) throw new Error(error.message);
    const r = data as ResultadoPC;
    total.servicos_criados += r?.servicos_criados ?? 0;
    total.medidores_atualizados += r?.medidores_atualizados ?? 0;
    total.servicos_conferidos += r?.servicos_conferidos ?? 0;
    onProgress?.(Math.min(i + BATCH, itens.length), itens.length);
  }
  return total;
}

// ─── Planilha Lucas ───────────────────────────────────────────────────────────

export interface ResultadoLucas {
  medidores_criados: number;
  datas_corrigidas: number;
  servicos_criados: number;
  servicos_conferidos: number;
}

/**
 * Aplica o plano em lotes. O RPC reconfere no banco se o serial ainda não
 * existe e se a data ainda é a genérica, então reenviar não duplica nada.
 */
export async function importarPlanilhaLucas(
  itens: ItemLucas[],
  onProgress?: (feitos: number, total: number) => void
): Promise<ResultadoLucas> {
  const total: ResultadoLucas = {
    medidores_criados: 0,
    datas_corrigidas: 0,
    servicos_criados: 0,
    servicos_conferidos: 0,
  };
  const BATCH = 500;
  for (let i = 0; i < itens.length; i += BATCH) {
    const lote = itens.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc('importar_planilha_lucas', { p_itens: lote });
    if (error) throw new Error(error.message);
    const r = data as ResultadoLucas;
    total.medidores_criados += r?.medidores_criados ?? 0;
    total.datas_corrigidas += r?.datas_corrigidas ?? 0;
    total.servicos_criados += r?.servicos_criados ?? 0;
    total.servicos_conferidos += r?.servicos_conferidos ?? 0;
    onProgress?.(Math.min(i + BATCH, itens.length), itens.length);
  }
  return total;
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export interface DashboardMetrics {
  total: number;
  pendentes: number;
  concluidos: number;
  valorPendente: number;
  valorConcluido: number;
  valorTotal: number;
  mediaDiasPendentes: number;
  acima45dias: number;
  ranking: RankingItem[];
}

export interface RankingItem {
  matricula: string;
  nome: string;
  qtd_pendente: number;
  valor_pendente: number;
}

export interface MetricsFilters {
  matriculas?: string[];
  supervisores?: string[];
  servicoGdis?: string;
  serial?: string;
  status?: string[];
  atribuicaoInicio?: string;
  atribuicaoFim?: string;
  conclusaoInicio?: string;
  conclusaoFim?: string;
  materialSapCodes?: string[];
  /** Só conta medidores com mais de N dias de atribuição. */
  diasMin?: number;
}

/**
 * Métricas do dashboard, agregadas no banco.
 *
 * Antes isso era feito no cliente, baixando a tabela toda em páginas de 1000
 * sem ORDER BY — o que devolvia linhas repetidas e omitia outras, errando as
 * contagens. Agora é uma chamada só, e os filtros de supervisor e de dias
 * mínimos também entram na conta.
 */
export async function getMedidoresMetrics(filters?: MetricsFilters): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc('get_medidores_metrics', {
    p_matriculas: filters?.matriculas?.length ? filters.matriculas : null,
    p_supervisores: filters?.supervisores?.length ? filters.supervisores : null,
    p_status: filters?.status?.length ? filters.status : null,
    p_servico_gdis: filters?.servicoGdis?.trim() || null,
    p_serial: filters?.serial?.trim() || null,
    p_atribuicao_inicio: filters?.atribuicaoInicio || null,
    p_atribuicao_fim: filters?.atribuicaoFim || null,
    p_conclusao_inicio: filters?.conclusaoInicio || null,
    p_conclusao_fim: filters?.conclusaoFim || null,
    p_material_sap_codes: filters?.materialSapCodes?.length ? filters.materialSapCodes : null,
    p_dias_min: filters?.diasMin ?? null,
  });
  if (error) throw new Error(error.message);

  const m = (data as { metrics: Record<string, number>; ranking: RankingItem[] } | null);
  const met = m?.metrics ?? ({} as Record<string, number>);
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));

  return {
    total: num(met.total),
    pendentes: num(met.pendentes),
    concluidos: num(met.concluidos),
    valorPendente: num(met.valor_pendente),
    valorConcluido: num(met.valor_concluido),
    valorTotal: num(met.valor_total),
    mediaDiasPendentes: num(met.media_dias_pendentes),
    acima45dias: num(met.acima_45),
    ranking: (m?.ranking ?? []).map((r) => ({
      matricula: r.matricula,
      nome: r.nome,
      qtd_pendente: num(r.qtd_pendente),
      valor_pendente: num(r.valor_pendente),
    })),
  };
}

export interface MedidorConferencia45Dias {
  id: string;
  matricula: string;
  colaborador: string;
  servicoGdis: string | null;
  serial: string;
  dias: number;
  data: string;
}

/** Um medidor ocultado da conferência, com o rastro de quem ocultou. */
export interface MedidorConferencia45DiasOculto extends MedidorConferencia45Dias {
  ocultadoPor: string;
  ocultadoEm: string;
}

/**
 * Lista da conferência +45 dias, já sem os medidores ocultados — a exclusão
 * acontece no banco para a paginação bater com o que aparece na tela.
 */
export async function getMedidoresConferencia45Dias(
  page = 1,
  pageSize = 100,
  diasAscending = false,
  diasLimite = 45,
  serial?: string
): Promise<{ data: MedidorConferencia45Dias[]; total: number }> {
  const { data, error } = await supabase.rpc('get_conferencia_45dias', {
    p_page: page,
    p_page_size: pageSize,
    p_asc: diasAscending,
    p_dias: diasLimite,
    p_serial: serial?.trim() || null,
  });
  if (error) throw new Error(error.message);
  const r = data as { data: MedidorConferencia45Dias[]; total: number } | null;
  return { data: r?.data ?? [], total: r?.total ?? 0 };
}

/** Os ocultados são compartilhados: todo mundo vê a mesma lista. */
export async function getConferencia45DiasOcultos(
  diasLimite = 45
): Promise<MedidorConferencia45DiasOculto[]> {
  const { data, error } = await supabase.rpc('get_conferencia_45dias_ocultos', {
    p_dias: diasLimite,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MedidorConferencia45DiasOculto[];
}

export async function ocultarMedidor45Dias(medidorId: string): Promise<void> {
  const { error } = await supabase
    .from('conferencia_45dias_ocultos')
    .upsert({ medidor_id: medidorId }, { onConflict: 'medidor_id' });
  if (error) throw new Error(error.message);
}

export async function reverterOcultarMedidor45Dias(medidorId: string): Promise<void> {
  const { error } = await supabase
    .from('conferencia_45dias_ocultos')
    .delete()
    .eq('medidor_id', medidorId);
  if (error) throw new Error(error.message);
}

export async function vincularServicoGdisMedidor(id: string, servicoGdis: string | null): Promise<void> {
  if (servicoGdis) {
    await garantirServicoReport(servicoGdis);
  }
  const { error } = await supabase
    .from('medidores_list')
    .update({
      servico_gdis: servicoGdis,
      status: 'CONCLUIDO',
      data_conclusao: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id);
  if (error) throw traduzirErroFkServicoGdis(error, servicoGdis);
}

// ─── Duplicidade: dois critérios ─────────────────────────────────────────────
// SERVICO — um serviço do GDIS puxou mais de um medidor diferente.
// SERIAL  — o mesmo medidor aparece em mais de uma linha (duplicata literal ou
//           vinculado a dois serviços distintos).
// TC e chave de aferição ficam de fora dos dois: podem dividir serviço com o
// medidor legitimamente.

export type TipoDuplicidade = 'SERVICO' | 'SERIAL';

export interface DuplicidadeMedidor {
  tipo: TipoDuplicidade;
  /** O que define o grupo: o serviço (tipo SERVICO) ou o serial (tipo SERIAL). */
  chave: string;
  servicoGdis: string | null;
  id: string;
  serial: string;
  matricula: string;
  colaborador: string;
  status: "PENDENTE" | "CONCLUIDO";
  data: string;
  dataConclusao: string | null;
  dias: number;
}

/**
 * Log de grupos já revisados. O snapshot é do momento da revisão: num grupo
 * SERVICO são os seriais em conflito, num grupo SERIAL são os serviços.
 */
export interface DuplicidadeRevisado {
  tipo: TipoDuplicidade;
  chave: string;
  itensConflitantes: string[];
  revisadoPor: string;
  revisadoEm: string;
}

export async function getDuplicidadeMedidores(): Promise<DuplicidadeMedidor[]> {
  const { data, error } = await supabase.rpc('get_duplicidade_medidores');
  if (error) throw new Error(error.message);
  return (data ?? []) as DuplicidadeMedidor[];
}

export async function getDuplicidadeRevisados(): Promise<DuplicidadeRevisado[]> {
  const { data, error } = await supabase.rpc('get_duplicidade_revisados');
  if (error) throw new Error(error.message);
  return (data ?? []) as DuplicidadeRevisado[];
}

export async function marcarDuplicidadeRevisado(
  tipo: TipoDuplicidade,
  chave: string
): Promise<void> {
  const { error } = await supabase.rpc('marcar_duplicidade_revisado', {
    p_tipo:  tipo,
    p_chave: chave,
  });
  if (error) throw new Error(error.message);
}

export async function reverterDuplicidadeRevisado(
  tipo: TipoDuplicidade,
  chave: string
): Promise<void> {
  const { error } = await supabase
    .from('duplicidade_revisados')
    .delete()
    .eq('tipo', tipo)
    .eq('chave', chave);
  if (error) throw new Error(error.message);
}

/**
 * Exclui uma das linhas de um serial duplicado. Recusa (erro do banco) se for
 * a única linha daquele serial — essa trava mora na RPC, não aqui, porque a
 * tela pode estar desatualizada. Devolve quantas linhas sobraram.
 *
 * Destrutivo: leva junto os medidor_logs da linha, por ON DELETE CASCADE.
 */
export async function excluirMedidorDuplicado(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('excluir_medidor_duplicado', { p_id: id });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/**
 * Desvincula um medidor de um serviço GDIS incorreto (caso de duplicidade) e
 * o devolve para PENDENTE, para que possa ser conferido de novo com o serial
 * correto. Diferente de vincularServicoGdisMedidor: não marca como concluído.
 *
 * Numa duplicidade por serial isso não resolve o conflito: o serial continua
 * repetido. Serve pro caso de vínculo errado, não pra linha sobrando.
 */
export async function desvincularDuplicidadeMedidor(id: string): Promise<void> {
  const { error } = await supabase
    .from('medidores_list')
    .update({
      servico_gdis: null,
      status: 'PENDENTE',
      data_conclusao: null,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Recuperação do incidente: medidores com serial reconstruído (ADMIN) ──────

export interface RecuperacaoPendenteItem {
  medidorId: string;
  tipo: "SEM_SERIAL" | "AMBIGUO";
  candidatosSerial: string[] | null;
  serialAtual: string;
  matricula: string;
  colaborador: string;
  materialSap: string;
  tipoEquipamento: string;
  servicoGdis: string | null;
  status: "PENDENTE" | "CONCLUIDO";
  data: string;
  criadoEm: string;
}

export async function getRecuperacaoPendente(): Promise<RecuperacaoPendenteItem[]> {
  const { data, error } = await supabase.rpc('get_recuperacao_pendente');
  if (error) throw new Error(error.message);
  return (data ?? []) as RecuperacaoPendenteItem[];
}

/** Checagem antes de gravar um serial digitado à mão na Recuperação. */
export async function serialEmOutroMedidor(serial: string, medidorId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('medidores_list')
    .select('id')
    .eq('serial', serial)
    .neq('id', medidorId)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Retorna true se o serial já existia em outra linha (grava mesmo assim). */
export async function resolverRecuperacaoPendente(medidorId: string, serialCorreto: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('resolver_recuperacao_pendente', {
    p_medidor_id: medidorId,
    p_serial_correto: serialCorreto,
  });
  if (error) throw new Error(error.message);
  return !!data;
}

// ─── Serviços da Conferência pendentes de vínculo, para a Automação GDIS ──────
// Só a fila PENDENTE. AGUARDANDO_VINCULACAO já foi conferido e está esperando
// vínculo manual — fica só na aba Conferência, não volta pra automação.

export interface ServicoConferenciaAutomacao {
  servico: string;
  matricula: string | null;
}

export async function getServicosConferenciaParaAutomacao(): Promise<ServicoConferenciaAutomacao[]> {
  const result: ServicoConferenciaAutomacao[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('servicos_report')
      .select('servico,matricula')
      .eq('status_conferencia', 'PENDENTE')
      .order('servico', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    result.push(...((data ?? []) as ServicoConferenciaAutomacao[]));
    if ((data ?? []).length < PAGE) break;
    from += PAGE;
  }
  return result;
}

// ─── Histórico das rodadas da Automação GDIS (ADMIN) ─────────────────────────

export type ResultadoAutomacao = 'ENCONTRADO' | 'GRAVADO' | 'CONFLITO' | 'VAZIO' | 'ERRO' | 'AGUARDANDO';
export type OrigemAutomacao = 'RECUPERACAO' | 'CONFERENCIA';

export interface AutomacaoLogEntrada {
  execucaoId: string;
  /** Identidade da linha dentro da rodada: "rec:<medidorId>" ou "conf:<servico>". */
  chaveItem: string;
  origem: OrigemAutomacao;
  /** Só existe pra origem RECUPERACAO — item de CONFERENCIA ainda não tem medidor. */
  medidorId?: string | null;
  servicoGdis: string | null;
  matricula: string | null;
  colaborador?: string | null;
  tipoEquipamento?: string | null;
  serialAnterior?: string | null;
  serialEncontrado: string | null;
  resultado: ResultadoAutomacao;
  observacao: string | null;
  modo: 'AUTOMATICO' | 'MANUAL';
}

export interface AutomacaoExecucao {
  execucaoId: string;
  inicio: string;
  fim: string;
  total: number;
  gravados: number;
  conflitos: number;
  vazios: number;
  erros: number;
  encontrados: number;
  aguardando: number;
  executadoPor: string;
}

export interface AutomacaoExecucaoItem {
  origem: OrigemAutomacao;
  servicoGdis: string | null;
  matricula: string | null;
  colaborador: string | null;
  tipoEquipamento: string | null;
  serialAnterior: string | null;
  serialEncontrado: string | null;
  resultado: ResultadoAutomacao;
  observacao: string | null;
  modo: 'AUTOMATICO' | 'MANUAL';
  criadoEm: string;
}

/**
 * Registra o desfecho de uma linha. A mesma chave na mesma rodada evolui de
 * ENCONTRADO para GRAVADO/CONFLITO/AGUARDANDO em vez de virar duas linhas.
 */
export async function registrarAutomacaoLog(entrada: AutomacaoLogEntrada): Promise<void> {
  const { error } = await supabase.from('automacao_gdis_log').upsert(
    {
      execucao_id: entrada.execucaoId,
      chave_item: entrada.chaveItem,
      origem: entrada.origem,
      medidor_id: entrada.medidorId ?? null,
      servico_gdis: entrada.servicoGdis,
      matricula: entrada.matricula,
      colaborador: entrada.colaborador,
      tipo_equipamento: entrada.tipoEquipamento ?? null,
      serial_anterior: entrada.serialAnterior ?? null,
      serial_encontrado: entrada.serialEncontrado,
      resultado: entrada.resultado,
      observacao: entrada.observacao,
      modo: entrada.modo,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'execucao_id,chave_item' }
  );
  if (error) throw new Error(error.message);
}

export async function getAutomacaoExecucoes(): Promise<AutomacaoExecucao[]> {
  const { data, error } = await supabase.rpc('get_automacao_execucoes');
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomacaoExecucao[];
}

export async function getAutomacaoExecucaoItens(execucaoId: string): Promise<AutomacaoExecucaoItem[]> {
  const { data, error } = await supabase.rpc('get_automacao_execucao_itens', {
    p_execucao_id: execucaoId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomacaoExecucaoItem[];
}

export interface MedidorAcima45Dias {
  matricula: string;
  colaborador: string;
  servicoGdis: string | null;
  serial: string;
  valor: number;
  dias: number;
  data: string;
}

export async function getMedidoresAcima45Dias(
  filters?: MetricsFilters,
  diasLimite = 45
): Promise<MedidorAcima45Dias[]> {
  const rows: MedidorAcima45Dias[] = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    let query = supabase
      .from('vw_medidores_completo')
      .select('"MATRICULA","COLABORADOR","SERVIÇO GDIS","Serial","VALOR","DIAS DE ATRIBUIÇÃO","Data"')
      .eq('"Concluído/Pendente"', 'PENDENTE')
      .gt('"DIAS DE ATRIBUIÇÃO"', diasLimite)
      .range(from, from + PAGE - 1);

    if (filters?.matriculas && filters.matriculas.length > 0) query = query.in('MATRICULA', filters.matriculas);
    if (filters?.supervisores && filters.supervisores.length > 0) query = query.in('SUPERVISOR', filters.supervisores);
    if (filters?.servicoGdis) query = query.ilike('"SERVIÇO GDIS"', `%${filters.servicoGdis.trim()}%`);
    if (filters?.serial) {
      const rawSerials = filters.serial.split(',').map(s => s.trim()).filter(Boolean);
      if (rawSerials.length === 1) query = query.ilike('"Serial"', `%${rawSerials[0]}%`);
      else if (rawSerials.length > 1) query = query.or(rawSerials.map(s => `"Serial".ilike.%${s}%`).join(','));
    }
    if (filters?.atribuicaoInicio) query = query.gte('Data', filters.atribuicaoInicio);
    if (filters?.atribuicaoFim) query = query.lte('Data', filters.atribuicaoFim);
    if (filters?.conclusaoInicio) query = query.gte('Data da conclusão', filters.conclusaoInicio);
    if (filters?.conclusaoFim) query = query.lte('Data da conclusão', filters.conclusaoFim);
    if (filters?.materialSapCodes && filters.materialSapCodes.length > 0) {
      query = query.in('Material SAP', filters.materialSapCodes);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      rows.push({
        matricula: (row as any)['MATRICULA'] ?? '',
        colaborador: (row as any)['COLABORADOR'] ?? '',
        servicoGdis: (row as any)['SERVIÇO GDIS'] ?? null,
        serial: (row as any)['Serial'] ?? '',
        valor: typeof (row as any)['VALOR'] === 'number' ? (row as any)['VALOR'] : 0,
        dias: typeof (row as any)['DIAS DE ATRIBUIÇÃO'] === 'number' ? (row as any)['DIAS DE ATRIBUIÇÃO'] : 0,
        data: (row as any)['Data'] ?? '',
      });
    }
    if ((data ?? []).length < PAGE) break;
    from += PAGE;
  }

  return rows.sort((a, b) => b.dias - a.dias);
}


// ─── Backup completo do banco (ADMIN) ─────────────────────────────────────────
// Gerado no navegador, tabela por tabela, com a sessão do próprio admin (a RLS
// libera leitura de tudo pra ADMIN). Não dá pra ser rota na Vercel: o JSON
// passa do limite de 4,5 MB de resposta. Tabela nova no banco precisa entrar
// nesta lista pra sair no backup.

export const TABELAS_BACKUP: { tabela: string; ordem: string[] }[] = [
  { tabela: 'profiles', ordem: ['id'] },
  { tabela: 'colaboradores', ordem: ['matricula'] },
  { tabela: 'tipos_de_medidores', ordem: ['cod_sap'] },
  { tabela: 'medidores_list', ordem: ['id'] },
  { tabela: 'medidor_logs', ordem: ['id'] },
  { tabela: 'servicos_report', ordem: ['servico'] },
  { tabela: 'conferencia_45dias_ocultos', ordem: ['medidor_id'] },
  { tabela: 'duplicidade_revisados', ordem: ['tipo', 'chave'] },
  { tabela: 'medidor_recuperacao_pendente', ordem: ['medidor_id'] },
  { tabela: 'automacao_gdis_log', ordem: ['id'] },
];

export interface BackupCompleto {
  geradoEm: string;
  tabelas: Record<string, unknown[]>;
}

export async function gerarBackupCompleto(
  onProgresso?: (tabela: string, linhas: number) => void
): Promise<BackupCompleto> {
  const tabelas: Record<string, unknown[]> = {};
  const PAGE = 1000;
  for (const { tabela, ordem } of TABELAS_BACKUP) {
    const linhas: unknown[] = [];
    let from = 0;
    while (true) {
      let query = supabase.from(tabela).select('*');
      for (const col of ordem) query = query.order(col, { ascending: true });
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) throw new Error(`${tabela}: ${error.message}`);
      linhas.push(...(data ?? []));
      onProgresso?.(tabela, linhas.length);
      if ((data ?? []).length < PAGE) break;
      from += PAGE;
    }
    tabelas[tabela] = linhas;
  }
  return { geradoEm: new Date().toISOString(), tabelas };
}
