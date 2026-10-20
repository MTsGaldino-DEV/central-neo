import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sair, sincronizarSenhaTraceone } from '@/lib/auth';
import { DEFAULT_PASSWORD } from '@/lib/permissions';
import NeoLogo from '@/components/NeoLogo';

/** Define a senha definitiva: primeiro acesso (senha 123456) ou link de "esqueci minha senha". */
export default function ResetSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha === DEFAULT_PASSWORD) return setErro('Escolha uma senha diferente da senha temporária.');
    if (senha !== confirmacao) return setErro('As senhas não conferem.');
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setSalvando(false);
      return setErro(error.message);
    }
    // mesma senha no TraceOne (medidores), se a sessão de lá estiver aberta
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) await sincronizarSenhaTraceone(user.email, senha);
    await sair();
    navigate('/login?resetok=1', { replace: true });
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-nevoa">
      <form onSubmit={salvar} className="w-full max-w-sm bg-white border border-linha rounded-2xl p-7 shadow-sm">
        <NeoLogo className="h-8 w-auto mb-6" />
        <h2 className="text-xl font-extrabold tracking-tight">Defina sua senha</h2>
        <p className="text-sm text-aco mt-1 mb-6">É a senha do seu login único na Central NEO.</p>
        {erro && <div className="mb-4 text-sm text-erro bg-erro-fundo border border-red-200 rounded-lg px-3 py-2">{erro}</div>}
        <label className="block text-xs font-semibold text-aco mb-1.5">Nova senha</label>
        <input type="password" required minLength={6} autoComplete="new-password" value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full h-11 px-3.5 rounded-xl border border-linha text-sm focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
        <label className="block text-xs font-semibold text-aco mb-1.5 mt-4">Confirmar nova senha</label>
        <input type="password" required autoComplete="new-password" value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className="w-full h-11 px-3.5 rounded-xl border border-linha text-sm focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
        <button type="submit" disabled={salvando}
          className="mt-6 w-full h-11 rounded-xl bg-sinal hover:bg-sinal-forte text-white font-bold text-sm flex items-center justify-center disabled:opacity-60">
          {salvando ? <Loader2 size={16} className="animate-spin" /> : 'Salvar senha'}
        </button>
      </form>
    </div>
  );
}
