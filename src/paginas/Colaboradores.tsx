import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Loader2, AlertTriangle, X, KeyRound, UserCheck, Check, Trash2 } from 'lucide-react';
import {
  listarColaboradores, salvarColaborador, excluirColaborador, cpfValido, formatarCpf, soNumeros, CAMPOS_VAZIOS,
  type ColaboradorNeo, type CamposColaborador,
} from '@/lib/colaboradores';
import { criarLogin, definirSenha } from '@/lib/neo';

/**
 * Cadastro único de pessoas. Daqui saem os logins de todos os sistemas:
 * um colaborador ganha login quando o ADMIN cria e-mail e senha para ele.
 */
export default function Colaboradores() {
  const [lista, setLista] = useState<ColaboradorNeo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [login, setLogin] = useState<'' | 'com' | 'sem'>('');
  const [aberto, setAberto] = useState<ColaboradorNeo | 'novo' | null>(null);
  const [limite, setLimite] = useState(100);

  async function carregar() {
    try {
      setLista(await listarColaboradores());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }
  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const num = soNumeros(busca);
    return (lista ?? []).filter((c) => {
      if (situacao === 'ativos' && !c.ativo) return false;
      if (situacao === 'inativos' && c.ativo) return false;
      if (login === 'com' && !c.usuario_id) return false;
      if (login === 'sem' && c.usuario_id) return false;
      if (!t) return true;
      const alvo = `${c.nome} ${c.matricula_cemig ?? ''} ${c.matricula_engelmig ?? ''} ${c.email ?? ''} ${c.equipe ?? ''} ${c.supervisor ?? ''}`
        .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return alvo.includes(t) || (num.length >= 3 && (c.cpf ?? '').includes(num));
    });
  }, [lista, busca, situacao, login]);

  const comLogin = (lista ?? []).filter((c) => c.usuario_id).length;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-xl font-extrabold tracking-tight">Colaboradores</h2>
          <p className="text-sm text-aco">
            Cadastro único de pessoas: dados, matrículas e login para todos os sistemas.
            {lista && <> {lista.length} cadastros, {comLogin} com login.</>}
          </p>
        </div>
        <button onClick={() => setAberto('novo')} className="h-9 px-3 rounded-lg bg-sinal text-white text-sm font-bold flex items-center gap-1.5 hover:bg-sinal-forte">
          <Plus size={15} /> Novo colaborador
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aco-claro" />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(100); }}
            placeholder="Nome, matrícula, CPF, e-mail, equipe…"
            className="w-full h-9 pl-9 pr-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal" />
        </div>
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} className="h-9 px-2 text-sm border border-linha rounded-lg bg-white">
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <select value={login} onChange={(e) => setLogin(e.target.value as typeof login)} className="h-9 px-2 text-sm border border-linha rounded-lg bg-white">
          <option value="">Com ou sem login</option>
          <option value="com">Com login</option>
          <option value="sem">Sem login</option>
        </select>
        {lista && <span className="text-xs text-aco">{filtrados.length} encontrados</span>}
      </div>

      {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{erro}</div>}

      <div className="bg-white border border-linha rounded-2xl overflow-hidden">
        {!lista ? (
          <div className="py-12 flex items-center justify-center gap-2 text-aco"><Loader2 size={16} className="animate-spin" /> Carregando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-aco border-b border-linha bg-nevoa/60">
                  <th className="px-4 py-3 font-bold">Nome</th>
                  <th className="px-3 py-3 font-bold">Matr. CEMIG</th>
                  <th className="px-3 py-3 font-bold">Matr. Engelmig</th>
                  <th className="px-3 py-3 font-bold">CPF</th>
                  <th className="px-3 py-3 font-bold">Equipe · cargo</th>
                  <th className="px-3 py-3 font-bold">Supervisor</th>
                  <th className="px-4 py-3 font-bold">Login</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-aco">Nenhum colaborador encontrado.</td></tr>
                )}
                {filtrados.slice(0, limite).map((c) => (
                  <tr key={c.id} onClick={() => setAberto(c)}
                    className={`border-b border-linha last:border-0 cursor-pointer hover:bg-sinal-fundo/50 ${c.ativo ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-2.5 font-semibold">{c.nome}</td>
                    <td className="px-3 py-2.5 font-codigo text-aco">{c.matricula_cemig ?? '—'}</td>
                    <td className="px-3 py-2.5 font-codigo text-aco">{c.matricula_engelmig ?? '—'}</td>
                    <td className="px-3 py-2.5 font-codigo text-aco whitespace-nowrap">{formatarCpf(c.cpf, true)}</td>
                    <td className="px-3 py-2.5 text-aco">{[c.equipe, c.cargo].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-3 py-2.5 text-aco">{c.supervisor ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {c.usuario_id
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-concluido"><UserCheck size={13} /> {c.email}</span>
                        : <span className="text-xs text-aco-claro">sem login</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length > limite && (
              <button onClick={() => setLimite((l) => l + 200)} className="w-full py-3 text-sm font-semibold text-sinal hover:bg-sinal-fundo border-t border-linha">
                Mostrar mais ({filtrados.length - limite} restantes)
              </button>
            )}
          </div>
        )}
      </div>

      {aberto && (
        <ModalColaborador
          colaborador={aberto === 'novo' ? null : aberto}
          onFechar={() => setAberto(null)}
          onSalvo={async (c) => {
            // recarrega e reabre o mesmo cadastro já atualizado (ex.: depois de criar o login)
            const l = await listarColaboradores().catch(() => null);
            if (l) setLista(l);
            const id = c?.id ?? (aberto !== 'novo' ? aberto?.id : undefined);
            setAberto(l?.find((x) => x.id === id) ?? c);
          }}
          onExcluido={async () => { setAberto(null); await carregar(); }}
        />
      )}
    </div>
  );
}

function ModalColaborador({ colaborador, onFechar, onSalvo, onExcluido }: {
  colaborador: ColaboradorNeo | null;
  onFechar: () => void;
  onSalvo: (c: ColaboradorNeo | null) => Promise<void>;
  onExcluido: () => Promise<void>;
}) {
  const inicial: CamposColaborador = colaborador ? { ...CAMPOS_VAZIOS, ...colaborador } : CAMPOS_VAZIOS;
  const [c, setC] = useState<CamposColaborador>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // criar o login grava o e-mail no cadastro: traz para o formulário aberto
  useEffect(() => {
    if (colaborador?.email) setC((x) => ({ ...x, email: colaborador.email }));
  }, [colaborador?.email]);

  const mudar = (campo: keyof CamposColaborador, valor: string | boolean | null) =>
    setC((x) => ({ ...x, [campo]: typeof valor === 'string' ? (valor === '' ? null : valor) : valor }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    if (!c.nome?.trim()) return setErro('Informe o nome.');
    if (c.cpf && !cpfValido(c.cpf)) return setErro('CPF inválido: confira os números.');
    setSalvando(true);
    try {
      const salvo = await salvarColaborador(colaborador?.id ?? null, { ...c, nome: c.nome.trim(), cpf: c.cpf ? soNumeros(c.cpf) : null });
      setOk('Cadastro salvo.');
      await onSalvo(salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!colaborador) return;
    if (!confirm(`Excluir o cadastro de ${colaborador.nome}? Prefira marcar como inativo para manter o histórico.`)) return;
    try {
      await excluirColaborador(colaborador.id);
      await onExcluido();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao excluir.');
    }
  }

  const campo = 'w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
  const texto = (k: keyof CamposColaborador) => (c[k] as string | null) ?? '';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-linha">
          <div>
            <h3 className="font-bold">{colaborador ? colaborador.nome : 'Novo colaborador'}</h3>
            {colaborador && <p className="text-[11px] text-aco">Atualizado em {new Date(colaborador.atualizado_em).toLocaleString('pt-BR')}</p>}
          </div>
          <button onClick={onFechar} className="text-aco-claro hover:text-tinta"><X size={18} /></button>
        </div>

        <form onSubmit={salvar} className="p-5 space-y-5">
          {erro && <p className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}
          {ok && <p className="text-xs text-concluido bg-concluido-fundo rounded-lg px-3 py-2">{ok}</p>}

          <Grupo titulo="Identificação">
            <Campo rotulo="Nome completo" largo><input autoFocus value={texto('nome')} onChange={(e) => mudar('nome', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="CPF">
              <input value={c.cpf ? formatarCpfDigitando(c.cpf) : ''} onChange={(e) => mudar('cpf', soNumeros(e.target.value).slice(0, 11))}
                inputMode="numeric" placeholder="000.000.000-00" className={`${campo} font-codigo`} />
            </Campo>
            <Campo rotulo="Matrícula CEMIG"><input value={texto('matricula_cemig')} onChange={(e) => mudar('matricula_cemig', e.target.value)} placeholder="e000000" className={`${campo} font-codigo`} /></Campo>
            <Campo rotulo="Matrícula Engelmig"><input value={texto('matricula_engelmig')} onChange={(e) => mudar('matricula_engelmig', e.target.value)} className={`${campo} font-codigo`} /></Campo>
          </Grupo>

          <Grupo titulo="Contato">
            <Campo rotulo="E-mail"><input type="email" value={texto('email')} onChange={(e) => mudar('email', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="Telefone"><input value={texto('telefone')} onChange={(e) => mudar('telefone', e.target.value)} inputMode="tel" className={campo} /></Campo>
          </Grupo>

          <Grupo titulo="Trabalho">
            <Campo rotulo="Cargo"><input value={texto('cargo')} onChange={(e) => mudar('cargo', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="Equipe"><input value={texto('equipe')} onChange={(e) => mudar('equipe', e.target.value)} className={`${campo} font-codigo`} /></Campo>
            <Campo rotulo="Base / lotação"><input value={texto('base')} onChange={(e) => mudar('base', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="Supervisor"><input value={texto('supervisor')} onChange={(e) => mudar('supervisor', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="GC (gerente de contrato)"><input value={texto('gc')} onChange={(e) => mudar('gc', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="GO (gerente de operação)"><input value={texto('go')} onChange={(e) => mudar('go', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="Admissão"><input type="date" value={texto('data_admissao')} onChange={(e) => mudar('data_admissao', e.target.value)} className={campo} /></Campo>
            <Campo rotulo="Desligamento"><input type="date" value={texto('data_desligamento')} onChange={(e) => mudar('data_desligamento', e.target.value)} className={campo} /></Campo>
          </Grupo>

          <Grupo titulo="Situação">
            <Campo rotulo="Observação" largo><input value={texto('observacao')} onChange={(e) => mudar('observacao', e.target.value)} className={campo} /></Campo>
            <label className="flex items-center gap-2 text-sm self-end h-9 cursor-pointer select-none">
              <input type="checkbox" checked={c.ativo} onChange={(e) => mudar('ativo', e.target.checked)} className="accent-sinal" /> Ativo
            </label>
          </Grupo>

          <div className="flex items-center gap-2 pt-1">
            {colaborador && !colaborador.usuario_id && (
              <button type="button" onClick={excluir} className="h-9 px-3 text-xs font-semibold text-erro flex items-center gap-1.5 hover:underline">
                <Trash2 size={13} /> Excluir cadastro
              </button>
            )}
            <span className="flex-1" />
            <button type="button" onClick={onFechar} className="h-9 px-4 text-sm font-semibold text-aco border border-linha rounded-lg">Fechar</button>
            <button type="submit" disabled={salvando} className="h-9 px-4 text-sm font-bold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-1.5">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar cadastro
            </button>
          </div>
        </form>

        {colaborador && <SecaoLogin colaborador={colaborador} onAlterado={() => onSalvo(null)} />}
      </div>
    </div>
  );
}

/** Formata enquanto digita: 123.456.789-01 */
function formatarCpfDigitando(v: string) {
  const c = soNumeros(v);
  return [c.slice(0, 3), c.slice(3, 6), c.slice(6, 9)].filter(Boolean).join('.') + (c.length > 9 ? `-${c.slice(9)}` : '');
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[11px] font-bold uppercase tracking-widest text-aco-claro mb-2">{titulo}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </fieldset>
  );
}

function Campo({ rotulo, largo, children }: { rotulo: string; largo?: boolean; children: ReactNode }) {
  return (
    <div className={largo ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold text-aco mb-1">{rotulo}</label>
      {children}
    </div>
  );
}

/** Login do colaborador: criar (e-mail + senha) ou redefinir a senha. */
function SecaoLogin({ colaborador, onAlterado }: { colaborador: ColaboradorNeo; onAlterado: () => Promise<void> }) {
  const [email, setEmail] = useState(colaborador.email ?? '');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const temLogin = !!colaborador.usuario_id;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    setSalvando(true);
    try {
      if (temLogin) {
        await definirSenha(colaborador.usuario_id!, senha);
        setOk('Senha redefinida. Passe a nova senha para a pessoa; ela pode trocar depois pelo menu.');
      } else {
        await criarLogin({ email: email.trim(), senha, colaborador_id: colaborador.id });
        setOk('Login criado. Agora libere os módulos em "Logins e acessos".');
        await onAlterado();
      }
      setSenha('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha.');
    } finally {
      setSalvando(false);
    }
  }

  const campo = 'h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
  return (
    <form onSubmit={enviar} className="px-5 py-4 border-t border-linha bg-nevoa/60 rounded-b-2xl">
      <p className="text-[11px] font-bold uppercase tracking-widest text-aco-claro mb-2 flex items-center gap-1.5"><KeyRound size={12} /> Login</p>
      {temLogin ? (
        <p className="text-sm mb-3">
          Entra com <strong>{colaborador.email}</strong>.{' '}
          <Link to="/acessos" className="text-sinal font-semibold hover:underline">Ver acessos e módulos</Link>
        </p>
      ) : (
        <p className="text-sm text-aco mb-3">Sem login. Crie e-mail e senha para a pessoa entrar na Central NEO.</p>
      )}
      {erro && <p className="mb-2 text-xs text-erro">{erro}</p>}
      {ok && <p className="mb-2 text-xs text-concluido">{ok}</p>}
      <div className="flex flex-wrap items-end gap-2">
        {!temLogin && (
          <div>
            <label className="block text-[11px] font-semibold text-aco mb-1">E-mail de login</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${campo} w-64`} />
          </div>
        )}
        <div>
          <label className="block text-[11px] font-semibold text-aco mb-1">{temLogin ? 'Nova senha' : 'Senha inicial'}</label>
          <input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" className={`${campo} w-44`} />
        </div>
        <button type="submit" disabled={salvando} className="h-9 px-4 text-sm font-bold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50 flex items-center gap-1.5">
          {salvando && <Loader2 size={14} className="animate-spin" />}{temLogin ? 'Redefinir senha' : 'Criar login'}
        </button>
      </div>
    </form>
  );
}
