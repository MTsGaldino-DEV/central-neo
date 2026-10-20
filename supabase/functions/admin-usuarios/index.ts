// Central NEO — administração de logins (só ADMIN NEO).
//
// Criar login e trocar senha exigem a service_role, que nunca vai para o
// navegador. A tela chama esta função com o token do usuário; aqui conferimos
// se ele é ADMIN NEO e só então usamos a service_role.
//
// Ações (POST JSON):
//   { acao: 'criar',    email, senha, colaborador_id?, nome? }  → cria o login e liga ao cadastro
//   { acao: 'senha',    usuario_id, senha }                     → define nova senha
//   { acao: 'bloquear', usuario_id, bloquear: boolean }         → bloqueia/desbloqueia o login
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Quem está chamando é ADMIN NEO?
  const doUsuario = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: admin, error: erroAdmin } = await doUsuario.rpc('neo_is_admin');
  if (erroAdmin || admin !== true) return resposta({ erro: 'Apenas administradores da Central NEO.' }, 403);

  const adm = createClient(url, servico, { auth: { persistSession: false } });
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: 'Corpo inválido.' }, 400);
  }

  const senhaValida = (s: unknown) => typeof s === 'string' && s.length >= 6;

  if (corpo.acao === 'criar') {
    const email = String(corpo.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta({ erro: 'E-mail inválido.' }, 400);
    if (!senhaValida(corpo.senha)) return resposta({ erro: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);

    const { data, error } = await adm.auth.admin.createUser({ email, password: corpo.senha as string, email_confirm: true });
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message);
      return resposta({ erro: jaExiste ? 'Já existe um login com esse e-mail.' : error.message }, 400);
    }
    const usuarioId = data.user.id;

    // Liga ao cadastro do colaborador (ou cria um cadastro mínimo)
    if (corpo.colaborador_id) {
      const { error: e } = await adm.from('colaboradores')
        .update({ usuario_id: usuarioId, email }).eq('id', corpo.colaborador_id);
      if (e) return resposta({ erro: 'Login criado, mas falhou ao ligar ao cadastro: ' + e.message, usuario_id: usuarioId }, 500);
    } else {
      const nome = String(corpo.nome ?? '').trim() || email.split('@')[0];
      const { error: e } = await adm.from('colaboradores').insert({ nome, email, usuario_id: usuarioId });
      if (e) return resposta({ erro: 'Login criado, mas falhou ao criar o cadastro: ' + e.message, usuario_id: usuarioId }, 500);
    }
    return resposta({ ok: true, usuario_id: usuarioId });
  }

  if (corpo.acao === 'senha') {
    if (!senhaValida(corpo.senha)) return resposta({ erro: 'A senha precisa ter pelo menos 6 caracteres.' }, 400);
    const { error } = await adm.auth.admin.updateUserById(String(corpo.usuario_id), { password: corpo.senha as string });
    if (error) return resposta({ erro: error.message }, 400);
    return resposta({ ok: true });
  }

  if (corpo.acao === 'bloquear') {
    const { data: eu } = await doUsuario.auth.getUser();
    if (eu.user?.id === corpo.usuario_id) return resposta({ erro: 'Você não pode bloquear o próprio login.' }, 400);
    const { error } = await adm.auth.admin.updateUserById(String(corpo.usuario_id), {
      ban_duration: corpo.bloquear ? '876000h' : 'none',
    });
    if (error) return resposta({ erro: error.message }, 400);
    return resposta({ ok: true });
  }

  return resposta({ erro: 'Ação desconhecida.' }, 400);
});
