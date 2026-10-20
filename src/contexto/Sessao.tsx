import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseTraceone } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';
import { getMeuAcesso, getMeuCadastro, type AcessoNeo, type CadastroResumo } from '@/lib/neo';

export type StatusTraceone = 'verificando' | 'conectado' | 'desconectado';

interface SessaoValor {
  carregando: boolean;
  /** Sessão da Central NEO (login principal). */
  session: Session | null;
  /** Cadastro do colaborador ligado ao login. */
  cadastro: CadastroResumo | null;
  acesso: AcessoNeo | null;
  /** Conexão com o TraceOne (medidores). */
  traceone: StatusTraceone;
  /** Perfil do TraceOne: o papel dele define o que pode nos medidores (RLS de lá). */
  profile: Profile | null;
  erro: string | null;
  recarregar: () => Promise<void>;
  recarregarTraceone: () => Promise<void>;
}

const SessaoContext = createContext<SessaoValor | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [cadastro, setCadastro] = useState<CadastroResumo | null>(null);
  const [acesso, setAcesso] = useState<AcessoNeo | null>(null);
  const [traceone, setTraceone] = useState<StatusTraceone>('verificando');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const emailAtual = useRef<string | null>(null);

  async function carregarDados(s: Session | null) {
    setSession(s);
    emailAtual.current = s?.user.email?.toLowerCase() ?? null;
    setErro(null);
    if (!s) {
      setCadastro(null);
      setAcesso(null);
      setCarregando(false);
      return;
    }
    try {
      const [meuAcesso, meuCadastro] = await Promise.all([getMeuAcesso(s.user.id), getMeuCadastro(s.user.id)]);
      setAcesso(meuAcesso);
      setCadastro(meuCadastro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a sessão.');
    } finally {
      setCarregando(false);
    }
  }

  /** Sessão do TraceOne só vale se for da mesma pessoa logada na NEO. */
  async function carregarTraceone(s: Session | null) {
    const email = emailAtual.current;
    if (!s || !email) {
      setProfile(null);
      setTraceone('desconectado');
      return;
    }
    if (s.user.email?.toLowerCase() !== email) {
      await supabaseTraceone.auth.signOut();
      return;
    }
    const { data } = await supabaseTraceone.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setTraceone('conectado');
  }

  useEffect(() => {
    // NEO primeiro: a sessão do TraceOne é conferida contra o e-mail da NEO
    supabase.auth.getSession().then(async ({ data }) => {
      await carregarDados(data.session);
      const { data: t } = await supabaseTraceone.auth.getSession();
      await carregarTraceone(t.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, s) => {
      // TOKEN_REFRESHED não muda quem está logado: evita recarregar à toa
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        if (evento !== 'USER_UPDATED') setCarregando(true);
        // fora do callback: o supabase-js não pode ser chamado de dentro dele
        setTimeout(async () => {
          await carregarDados(s);
          const { data: t } = await supabaseTraceone.auth.getSession();
          await carregarTraceone(t.session);
        }, 0);
      } else {
        setSession(s);
      }
    });

    const { data: { subscription: subTraceone } } = supabaseTraceone.auth.onAuthStateChange((evento, s) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') {
        if (evento === 'SIGNED_IN') setTraceone('verificando');
        setTimeout(() => carregarTraceone(s), 0);
      }
    });

    return () => {
      subscription.unsubscribe();
      subTraceone.unsubscribe();
    };
  }, []);

  const recarregar = async () => {
    const { data } = await supabase.auth.getSession();
    await carregarDados(data.session);
  };

  const recarregarTraceone = async () => {
    const { data } = await supabaseTraceone.auth.getSession();
    await carregarTraceone(data.session);
  };

  return (
    <SessaoContext.Provider value={{ carregando, session, cadastro, acesso, traceone, profile, erro, recarregar, recarregarTraceone }}>
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao(): SessaoValor {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao fora do SessaoProvider');
  return ctx;
}
