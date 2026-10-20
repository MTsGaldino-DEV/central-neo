import { useState, type FormEvent } from 'react';
import { Gauge, Loader2, PlugZap } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import { conectarTraceone } from '@/lib/auth';

/**
 * Os medidores moram no TraceOne. Normalmente a NEO conecta sozinha no login
 * (mesmo e-mail e senha). Esta tela aparece quando a senha do TraceOne é
 * diferente da senha da NEO, ou a sessão de lá expirou.
 */
export default function ConectarTraceone() {
  const { session, recarregarTraceone } = useSessao();
  const email = session?.user.email ?? '';
  const [senha, setSenha] = useState('');
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function conectar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setConectando(true);
    try {
      await conectarTraceone(email, senha);
      await recarregarTraceone();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao conectar.');
      setConectando(false);
    }
  }

  return (
    <div className="p-6 flex justify-center">
      <form onSubmit={conectar} className="w-full max-w-md bg-white border border-linha rounded-2xl p-6 mt-8">
        <span className="size-11 rounded-xl bg-sinal-fundo text-sinal flex items-center justify-center"><Gauge size={22} /></span>
        <h2 className="text-lg font-extrabold mt-4">Conectar ao TraceOne</h2>
        <p className="text-sm text-aco mt-1">
          Os medidores ficam no TraceOne. Entre uma vez com a sua senha de lá
          para ver e editar os medidores aqui na NEO.
        </p>
        {erro && <div className="mt-4 text-sm text-erro bg-erro-fundo border border-red-200 rounded-lg px-3 py-2">{erro}</div>}
        <label className="block text-xs font-semibold text-aco mb-1.5 mt-5">E-mail</label>
        <input value={email} disabled className="w-full h-10 px-3 rounded-lg border border-linha bg-nevoa text-sm text-aco" />
        <label className="block text-xs font-semibold text-aco mb-1.5 mt-3">Senha do TraceOne</label>
        <input type="password" autoFocus required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password"
          className="w-full h-10 px-3 rounded-lg border border-linha text-sm focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
        <button type="submit" disabled={conectando}
          className="mt-5 w-full h-10 rounded-lg bg-sinal hover:bg-sinal-forte text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          {conectando ? <Loader2 size={15} className="animate-spin" /> : <><PlugZap size={15} /> Conectar</>}
        </button>
        <p className="text-[11px] text-aco-claro mt-3">
          Dica: troque a senha pelo menu da NEO com o TraceOne conectado. Assim as duas ficam iguais e a conexão passa a ser automática.
        </p>
      </form>
    </div>
  );
}
