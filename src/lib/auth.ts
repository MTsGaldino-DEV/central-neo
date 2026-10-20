/**
 * lib/auth.ts — Login da Central NEO
 *
 * O login é o da NEO (projeto central-neo). Para os medidores, a NEO abre por
 * baixo uma segunda sessão no TraceOne com o mesmo e-mail e senha. Se a senha
 * do TraceOne for diferente, a tela de medidores pede para conectar uma vez.
 */
import { supabase, supabaseTraceone } from './supabase';

export async function entrar(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
  }
  // Espera a conexão com o TraceOne (no máximo 6 s), para ela não se perder se a
  // página recarregar logo em seguida. Se falhar, os medidores pedem a senha de lá.
  await Promise.race([
    conectarTraceone(email, senha).catch(() => {}),
    new Promise((ok) => setTimeout(ok, 6000)),
  ]);
}

/** Abre a sessão do TraceOne (medidores). */
export async function conectarTraceone(email: string, senha: string): Promise<void> {
  const { error } = await supabaseTraceone.auth.signInWithPassword({ email, password: senha });
  if (error) {
    throw new Error(error.message === 'Invalid login credentials'
      ? 'Senha do TraceOne incorreta. Se você já mudou a senha lá, use a do TraceOne.'
      : error.message);
  }
}

export async function sair(): Promise<void> {
  await Promise.allSettled([supabaseTraceone.auth.signOut(), supabase.auth.signOut()]);
}

export async function pedirRedefinicaoSenha(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-senha`,
  });
  if (error) throw new Error(error.message);
}

/**
 * Troca a própria senha na NEO e, se houver sessão no TraceOne, lá também,
 * para as duas continuarem iguais.
 * Retorna se o TraceOne foi atualizado.
 */
export async function trocarMinhaSenha(atual: string, nova: string): Promise<{ traceone: 'atualizado' | 'sem-sessao' | 'falhou' }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('Sessão inválida');

  const { error: erroReauth } = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
  if (erroReauth) throw new Error('Senha atual incorreta');

  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) throw new Error(error.message);

  return { traceone: await sincronizarSenhaTraceone(user.email, nova) };
}

/** Depois de definir uma nova senha na NEO, leva a mesma senha para o TraceOne, se conectado. */
export async function sincronizarSenhaTraceone(email: string, nova: string): Promise<'atualizado' | 'sem-sessao' | 'falhou'> {
  const { data } = await supabaseTraceone.auth.getSession();
  if (!data.session || data.session.user.email?.toLowerCase() !== email.toLowerCase()) return 'sem-sessao';
  const { error } = await supabaseTraceone.auth.updateUser({ password: nova });
  return error ? 'falhou' : 'atualizado';
}
