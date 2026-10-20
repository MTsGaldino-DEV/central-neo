import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, Gauge, ClipboardCheck, Receipt, MessageSquareWarning, Scale } from 'lucide-react';
import { entrar as entrarNeo, pedirRedefinicaoSenha } from '@/lib/auth';
import { DEFAULT_PASSWORD } from '@/lib/permissions';
import { useSessao } from '@/contexto/Sessao';
import NeoLogo from '@/components/NeoLogo';

const FRENTES = [
  { icone: Gauge, nome: 'Controle de medidores', ativo: true },
  { icone: ClipboardCheck, nome: 'Fechamento de notas de manutenção', ativo: true },
  { icone: Receipt, nome: 'Faturamento', ativo: false },
  { icone: MessageSquareWarning, nome: 'Notas de ouvidoria', ativo: false },
  { icone: Scale, nome: 'Conciliação de pagamentos CEMIG', ativo: false },
];

export default function Login() {
  const { session, carregando } = useSessao();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(
    new URLSearchParams(location.search).get('resetok') ? 'Senha definida. Entre com a nova senha.' : null
  );

  if (!carregando && session) return <Navigate to="/" replace />;

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEntrando(true);
    try {
      await entrarNeo(email.trim(), senha);
    } catch (err) {
      setEntrando(false);
      setErro(err instanceof Error ? err.message : 'Falha ao entrar.');
      return;
    }
    setEntrando(false);
    // Senha temporária padrão: obriga a definir a definitiva antes de usar
    if (senha === DEFAULT_PASSWORD) navigate('/reset-senha', { replace: true });
  }

  async function esqueci() {
    setErro(null);
    if (!email.trim()) {
      setErro('Digite seu e-mail acima para receber o link de redefinição.');
      return;
    }
    try {
      await pedirRedefinicaoSenha(email.trim());
      setAviso('Enviamos um link de redefinição para o seu e-mail.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o link.');
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-noite-degrade textura-aneis text-white p-12">
        <NeoLogo tema="escuro" className="h-10 w-auto self-start" />
        <div className="max-w-md">
          <p className="text-sinal-claro text-xs font-bold uppercase tracking-[0.2em] mb-4">Central NEO</p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Cada nota aberta,<br />até o último centavo fechado.
          </h1>
          <ul className="mt-10 space-y-3">
            {FRENTES.map(({ icone: Icone, nome, ativo }) => (
              <li key={nome} className={`flex items-center gap-3 text-sm ${ativo ? 'text-white' : 'text-white/40'}`}>
                <span className={`size-8 rounded-lg flex items-center justify-center ${ativo ? 'bg-white/10' : 'bg-white/5'}`}>
                  <Icone size={16} />
                </span>
                {nome}
                {!ativo && <span className="text-[10px] uppercase tracking-wider border border-white/15 rounded px-1.5 py-0.5">em breve</span>}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">Um login para todos os sistemas.</p>
      </aside>

      <main className="flex items-center justify-center p-6 bg-nevoa">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <NeoLogo className="h-9 w-auto mb-8 lg:hidden" />
          <h2 className="text-2xl font-extrabold tracking-tight">Entrar</h2>
          <p className="text-sm text-aco mt-1 mb-8">Entre com seu e-mail e senha da Central NEO.</p>

          {erro && <div className="mb-4 text-sm text-erro bg-erro-fundo border border-red-200 rounded-lg px-3 py-2">{erro}</div>}
          {aviso && <div className="mb-4 text-sm text-concluido bg-concluido-fundo border border-emerald-200 rounded-lg px-3 py-2">{aviso}</div>}

          <label className="block text-xs font-semibold text-aco mb-1.5" htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-linha bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />

          <label className="block text-xs font-semibold text-aco mb-1.5 mt-4" htmlFor="senha">Senha</label>
          <input id="senha" type="password" required autoComplete="current-password" value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-linha bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />

          <button type="submit" disabled={entrando}
            className="mt-6 w-full h-11 rounded-xl bg-sinal hover:bg-sinal-forte text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
            {entrando ? <Loader2 size={16} className="animate-spin" /> : <>Entrar <ArrowRight size={16} /></>}
          </button>

          <button type="button" onClick={esqueci} className="mt-4 text-xs font-semibold text-sinal hover:underline">
            Esqueci minha senha
          </button>
        </form>
      </main>
    </div>
  );
}
