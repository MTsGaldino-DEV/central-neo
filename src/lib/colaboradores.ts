/**
 * lib/colaboradores.ts — Cadastro único de pessoas da Central NEO
 *
 * Cada colaborador pode (ou não) ter login. O cadastro é a fonte única para
 * todos os sistemas: CPF, matrículas CEMIG e Engelmig, equipe, cargo…
 * Só o ADMIN NEO lê e edita (RLS); cada um lê o próprio cadastro.
 */
import { supabase } from './supabase';

export interface ColaboradorNeo {
  id: string;
  nome: string;
  cpf: string | null;
  matricula_cemig: string | null;
  matricula_engelmig: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  equipe: string | null;
  supervisor: string | null;
  gc: string | null;
  go: string | null;
  base: string | null;
  data_admissao: string | null;
  data_desligamento: string | null;
  ativo: boolean;
  observacao: string | null;
  usuario_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type CamposColaborador = Omit<ColaboradorNeo, 'id' | 'usuario_id' | 'criado_em' | 'atualizado_em'>;

export const CAMPOS_VAZIOS: CamposColaborador = {
  nome: '', cpf: null, matricula_cemig: null, matricula_engelmig: null, email: null, telefone: null,
  cargo: null, equipe: null, supervisor: null, gc: null, go: null, base: null,
  data_admissao: null, data_desligamento: null, ativo: true, observacao: null,
};

/** São poucas centenas: carrega tudo e filtra na tela. */
export async function listarColaboradores(): Promise<ColaboradorNeo[]> {
  const todos: ColaboradorNeo[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('colaboradores').select('*').order('nome').range(from, from + 999);
    if (error) throw new Error('Falha ao carregar colaboradores: ' + error.message);
    todos.push(...((data ?? []) as ColaboradorNeo[]));
    if ((data ?? []).length < 1000) break;
  }
  return todos;
}

function traduzirErro(msg: string, code?: string): string {
  if (code === '23505') {
    if (msg.includes('cpf')) return 'Já existe um colaborador com esse CPF.';
    if (msg.includes('matricula_cemig')) return 'Já existe um colaborador com essa matrícula CEMIG.';
    if (msg.includes('matricula_engelmig')) return 'Já existe um colaborador com essa matrícula Engelmig.';
    if (msg.includes('email')) return 'Já existe um colaborador com esse e-mail.';
    return 'Já existe um colaborador com esses dados.';
  }
  if (code === '23514' && msg.includes('cpf')) return 'CPF inválido: informe os 11 números.';
  return msg;
}

export async function salvarColaborador(id: string | null, campos: CamposColaborador): Promise<ColaboradorNeo> {
  const q = id
    ? supabase.from('colaboradores').update(campos).eq('id', id).select().single()
    : supabase.from('colaboradores').insert(campos).select().single();
  const { data, error } = await q;
  if (error) throw new Error(traduzirErro(error.message, error.code));
  return data as ColaboradorNeo;
}

export async function excluirColaborador(id: string): Promise<void> {
  const { error } = await supabase.from('colaboradores').delete().eq('id', id);
  if (error) throw new Error('Falha ao excluir: ' + error.message);
}

// ─── CPF ─────────────────────────────────────────────────────────────────────

export function soNumeros(v: string): string {
  return v.replace(/\D/g, '');
}

/** Confere os dígitos verificadores. */
export function cpfValido(v: string): boolean {
  const c = soNumeros(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(c[n])) return false;
  }
  return true;
}

export function formatarCpf(v: string | null, mascarar = false): string {
  if (!v) return '—';
  const c = soNumeros(v).padStart(11, '0');
  const f = `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  return mascarar ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : f;
}
