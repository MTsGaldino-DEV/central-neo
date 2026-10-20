/**
 * lib/neo.ts — Logins e acesso à Central NEO (módulos por usuário)
 *
 * O login é da Central NEO (projeto central-neo). Quem pode entrar, e em quais
 * módulos, fica em neo_acessos. A proteção de verdade é a RLS do banco; aqui é
 * só para a tela não mostrar o que o usuário não pode usar.
 * Criar login e trocar senha de outra pessoa passa pela Edge Function
 * admin-usuarios (precisa da service_role, que não vem para o navegador).
 */
import { supabase } from './supabase';

export type Modulo = 'traceone' | 'fechamento';
export type PapelNeo = 'ADMIN' | 'USUARIO';

export const MODULOS: { id: Modulo; nome: string; descricao: string }[] = [
  { id: 'traceone', nome: 'TraceOne', descricao: 'Controle de medidores' },
  { id: 'fechamento', nome: 'Fechamento de Notas', descricao: 'NSIS → NSMP → NSPR → fatura' },
];

export interface AcessoNeo {
  user_id: string;
  papel: PapelNeo;
  modulos: Modulo[];
  ativo: boolean;
}

/** Acesso do usuário logado; null quando ele não foi liberado na NEO. */
export async function getMeuAcesso(userId: string): Promise<AcessoNeo | null> {
  const { data, error } = await supabase
    .from('neo_acessos')
    .select('user_id, papel, modulos, ativo')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Falha ao carregar seu acesso: ' + error.message);
  return (data as AcessoNeo | null) ?? null;
}

export interface CadastroResumo {
  id: string;
  nome: string;
  matricula_cemig: string | null;
  matricula_engelmig: string | null;
}

/** Cadastro de colaborador ligado ao login (cada um lê o próprio). */
export async function getMeuCadastro(userId: string): Promise<CadastroResumo | null> {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id, nome, matricula_cemig, matricula_engelmig')
    .eq('usuario_id', userId)
    .maybeSingle();
  if (error) throw new Error('Falha ao carregar seu cadastro: ' + error.message);
  return (data as CadastroResumo | null) ?? null;
}

export function temModulo(acesso: AcessoNeo | null, modulo: Modulo): boolean {
  if (!acesso?.ativo) return false;
  return acesso.papel === 'ADMIN' || acesso.modulos.includes(modulo);
}

export interface UsuarioNeo {
  id: string;
  email: string;
  nome: string;
  colaborador_id: string | null;
  matricula_cemig: string | null;
  ultimo_acesso: string | null;
  bloqueado: boolean;
  papel: PapelNeo | null;
  modulos: Modulo[];
  ativo: boolean;
}

/** Todos os logins, com o cadastro e o acesso NEO de cada um (só ADMIN). */
export async function listarUsuarios(): Promise<UsuarioNeo[]> {
  const { data, error } = await supabase.rpc('neo_listar_usuarios');
  if (error) throw new Error('Falha ao listar usuários: ' + error.message);
  return (data ?? []) as UsuarioNeo[];
}

export async function salvarAcesso(
  userId: string,
  patch: { papel: PapelNeo; modulos: Modulo[]; ativo: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('neo_acessos')
    .upsert({ user_id: userId, ...patch, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error('Falha ao salvar acesso: ' + error.message);
}

export async function removerAcesso(userId: string): Promise<void> {
  const { error } = await supabase.from('neo_acessos').delete().eq('user_id', userId);
  if (error) throw new Error('Falha ao remover acesso: ' + error.message);
}

// ─── Administração de logins (Edge Function admin-usuarios) ─────────────────

async function chamarAdmin(corpo: Record<string, unknown>): Promise<{ usuario_id?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: corpo });
  if (error) {
    // a função devolve { erro } com status 4xx; o supabase-js põe a resposta em error.context
    let msg = error.message;
    try {
      const r = await (error as { context?: Response }).context?.json();
      if (r?.erro) msg = r.erro;
    } catch { /* mantém a mensagem original */ }
    throw new Error(msg);
  }
  return (data ?? {}) as { usuario_id?: string };
}

/** Cria o login. Com colaborador_id liga ao cadastro existente; sem ele cria um cadastro com o nome. */
export async function criarLogin(p: { email: string; senha: string; colaborador_id?: string | null; nome?: string }): Promise<string> {
  const r = await chamarAdmin({ acao: 'criar', ...p });
  return r.usuario_id ?? '';
}

export async function definirSenha(usuarioId: string, senha: string): Promise<void> {
  await chamarAdmin({ acao: 'senha', usuario_id: usuarioId, senha });
}

export async function bloquearLogin(usuarioId: string, bloquear: boolean): Promise<void> {
  await chamarAdmin({ acao: 'bloquear', usuario_id: usuarioId, bloquear });
}
