import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, ShieldCheck, Check, AlertTriangle, UserPlus, KeyRound, Lock, Unlock, X } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import {
  listarUsuarios, salvarAcesso, removerAcesso, criarLogin, definirSenha, bloquearLogin, MODULOS,
  type UsuarioNeo, type Modulo, type PapelNeo,
} from '@/lib/neo';

/**
 * Logins da Central NEO e o que cada um pode usar. O login é único: no futuro,
 * os outros sistemas (TraceOne, Central NEC, Warefly) entram com ele também.
 */
export default function Acessos() {
  const { session } = useSessao();
  const [usuarios, setUsuarios] = useState<UsuarioNeo[] | null>(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [senhaDe, setSenhaDe] = useState<UsuarioNeo | null>(null);

  async function carregar() {
    try {
      setUsuarios(await listarUsuarios());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }
  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (usuarios ?? []).filter((u) => !t || u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)
      || (u.matricula_cemig ?? '').includes(t));
  }, [usuarios, busca]);

  async function executar(u: UsuarioNeo, acao: () => Promise<void>) {
    setSalvando(u.id);
    setErro(null);
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(null);
    }
  }

  const alterar = (u: UsuarioNeo, patch: Partial<{ papel: PapelNeo; modulos: Modulo[]; ativo: boolean }>) =>
    executar(u, () => salvarAcesso(u.id, {
      papel: patch.papel ?? u.papel ?? 'USUARIO',
      modulos: patch.modulos ?? u.modulos,
      ativo: patch.ativo ?? (u.papel ? u.ativo : true),
    }));

  function revogar(u: UsuarioNeo) {
    if (!confirm(`Remover o acesso de ${u.nome} à Central NEO? O login continua existindo.`)) return;
    executar(u, () => removerAcesso(u.id));
  }

  function bloquear(u: UsuarioNeo) {
    const msg = u.bloqueado
      ? `Desbloquear o login de ${u.nome}?`
      : `Bloquear o login de ${u.nome}? A pessoa não consegue mais entrar até ser desbloqueada.`;
    if (!confirm(msg)) return;
    executar(u, () => bloquearLogin(u.id, !u.bloqueado));
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-xl font-extrabold tracking-tight">Logins e acessos</h2>
          <p className="text-sm text-aco">
            Um login por pessoa. Aqui você cria logins, redefine senhas e escolhe os módulos da NEO.
            Os dados da pessoa ficam em <Link to="/colaboradores" className="text-sinal font-semibold hover:underline">Colaboradores</Link>.
          </p>
        </div>
        <button onClick={() => setNovo(true)} className="h-9 px-3 rounded-lg bg-sinal text-white text-sm font-bold flex items-center gap-1.5 hover:bg-sinal-forte">
          <UserPlus size={15} /> Novo login
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aco-claro" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou matrícula"
          className="w-full h-9 pl-9 pr-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
      </div>

      {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{erro}</div>}

      {!usuarios ? (
        <div className="py-12 flex items-center justify-center gap-2 text-aco"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
      ) : (
        <div className="bg-white border border-linha rounded-2xl overflow-hidden divide-y divide-linha">
          {filtrados.map((u) => {
            const eu = u.id === session?.user.id;
            const liberado = !!u.papel;
            return (
              <div key={u.id} className={`px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${liberado && u.ativo && !u.bloqueado ? '' : 'bg-nevoa/50'}`}>
                <div className="flex-1 min-w-[240px]">
                  <p className="text-sm font-bold flex flex-wrap items-center gap-2">
                    {u.nome}
                    {u.papel === 'ADMIN' && <span className="text-[10px] font-bold text-sinal bg-sinal-fundo rounded px-1.5 py-0.5 flex items-center gap-1"><ShieldCheck size={11} /> ADMIN NEO</span>}
                    {u.bloqueado && <span className="text-[10px] font-bold text-erro bg-erro-fundo rounded px-1.5 py-0.5 flex items-center gap-1"><Lock size={10} /> bloqueado</span>}
                    {eu && <span className="text-[10px] text-aco">(você)</span>}
                  </p>
                  <p className="text-xs text-aco">
                    {u.email}
                    {u.matricula_cemig && <> · <span className="font-codigo">{u.matricula_cemig}</span></>}
                    {' · '}{u.ultimo_acesso ? `último acesso ${new Date(u.ultimo_acesso).toLocaleDateString('pt-BR')}` : 'nunca entrou'}
                  </p>
                </div>

                {liberado ? (
                  <>
                    <div className="flex gap-1.5">
                      {MODULOS.map((m) => {
                        const tem = u.papel === 'ADMIN' || u.modulos.includes(m.id);
                        return (
                          <button key={m.id} disabled={u.papel === 'ADMIN' || salvando === u.id}
                            onClick={() => alterar(u, { modulos: tem ? u.modulos.filter((x) => x !== m.id) : [...u.modulos, m.id] })}
                            title={u.papel === 'ADMIN' ? 'Administrador vê todos os módulos' : m.descricao}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${tem ? 'bg-sinal-fundo border-sinal/30 text-sinal' : 'bg-white border-linha text-aco'}`}>
                            {tem && <Check size={12} />}{m.nome}
                          </button>
                        );
                      })}
                    </div>
                    <select value={u.papel ?? 'USUARIO'} disabled={eu || salvando === u.id}
                      onChange={(e) => alterar(u, { papel: e.target.value as PapelNeo })}
                      className="h-8 px-2 text-xs border border-linha rounded-lg bg-white">
                      <option value="USUARIO">Usuário</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </>
                ) : (
                  <button onClick={() => alterar(u, { papel: 'USUARIO', modulos: [], ativo: true })} disabled={salvando === u.id}
                    className="h-8 px-3 rounded-lg text-xs font-bold bg-sinal text-white hover:bg-sinal-forte disabled:opacity-50">
                    Liberar acesso à NEO
                  </button>
                )}

                <div className="flex items-center gap-1">
                  <button onClick={() => setSenhaDe(u)} title="Redefinir senha" className="p-1.5 rounded-lg text-aco-claro hover:text-sinal hover:bg-sinal-fundo"><KeyRound size={15} /></button>
                  {!eu && (
                    <button onClick={() => bloquear(u)} title={u.bloqueado ? 'Desbloquear login' : 'Bloquear login'}
                      className="p-1.5 rounded-lg text-aco-claro hover:text-erro hover:bg-erro-fundo">
                      {u.bloqueado ? <Unlock size={15} /> : <Lock size={15} />}
                    </button>
                  )}
                  {liberado && !eu && (
                    <button onClick={() => revogar(u)} disabled={salvando === u.id} className="ml-1 text-xs font-semibold text-erro hover:underline">Remover da NEO</button>
                  )}
                  {salvando === u.id && <Loader2 size={14} className="animate-spin text-aco ml-1" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {novo && <ModalNovoLogin onFechar={() => setNovo(false)} onCriado={async () => { setNovo(false); await carregar(); }} />}
      {senhaDe && <ModalSenha usuario={senhaDe} onFechar={() => setSenhaDe(null)} />}
    </div>
  );
}

const campo = 'w-full h-10 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';

function ModalNovoLogin({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro('Informe o nome.');
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    setSalvando(true);
    try {
      await criarLogin({ email: email.trim(), senha, nome: nome.trim() });
      await onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao criar.');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Novo login</h3>
          <button type="button" onClick={onFechar} className="text-aco-claro hover:text-tinta"><X size={16} /></button>
        </div>
        <p className="text-xs text-aco">
          Cria o login e um cadastro com o nome. Se a pessoa já está em Colaboradores, crie o login por lá para ligar ao cadastro existente.
        </p>
        {erro && <p className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}
        <div><label className="block text-xs font-semibold text-aco mb-1">Nome completo</label>
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} className={campo} /></div>
        <div><label className="block text-xs font-semibold text-aco mb-1">E-mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} /></div>
        <div><label className="block text-xs font-semibold text-aco mb-1">Senha inicial</label>
          <input type="text" required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" className={campo} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 h-9 text-sm font-semibold text-aco border border-linha rounded-lg">Cancelar</button>
          <button type="submit" disabled={salvando} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg disabled:opacity-50 flex items-center gap-1.5">
            {salvando && <Loader2 size={14} className="animate-spin" />} Criar login
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalSenha({ usuario, onFechar }: { usuario: UsuarioNeo; onFechar: () => void }) {
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    setSalvando(true);
    try {
      await definirSenha(usuario.id, senha);
      setOk(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Redefinir senha</h3>
          <button type="button" onClick={onFechar} className="text-aco-claro hover:text-tinta"><X size={16} /></button>
        </div>
        <p className="text-xs text-aco">{usuario.nome} · {usuario.email}</p>
        {erro && <p className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}
        {ok ? (
          <>
            <p className="text-xs text-concluido bg-concluido-fundo rounded-lg px-3 py-2">Senha redefinida. Passe a nova senha para a pessoa.</p>
            <div className="flex justify-end"><button type="button" onClick={onFechar} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg">Fechar</button></div>
          </>
        ) : (
          <>
            <div><label className="block text-xs font-semibold text-aco mb-1">Nova senha</label>
              <input type="text" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" className={campo} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onFechar} className="px-4 h-9 text-sm font-semibold text-aco border border-linha rounded-lg">Cancelar</button>
              <button type="submit" disabled={salvando} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
