import { useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, LayoutDashboard, PlusCircle, UploadCloud, CheckSquare, AlarmClockCheck, DatabaseBackup,
  ClipboardList, FileSpreadsheet, Table2, BarChart3, Receipt, MessageSquareWarning, Scale, Users, KeyRound, LogOut, Contact,
  Menu, X, type LucideIcon,
} from 'lucide-react';
import NeoLogo from './NeoLogo';
import { useSessao } from '@/contexto/Sessao';
import { temModulo } from '@/lib/neo';
import { sair as encerrarSessao, trocarMinhaSenha } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

interface ItemNav { label: string; href: string; icon: LucideIcon; fim?: boolean }
interface SecaoNav { titulo: string; itens: ItemNav[]; emBreve?: boolean }

const EM_BREVE: ItemNav[] = [
  { label: 'Notas de Ouvidoria', href: '#', icon: MessageSquareWarning },
  { label: 'Conciliação CEMIG', href: '#', icon: Scale },
];

export function useSecoesNav(): SecaoNav[] {
  const { acesso, profile } = useSessao();
  const secoes: SecaoNav[] = [{ titulo: '', itens: [{ label: 'Início', href: '/', icon: Home, fim: true }] }];

  if (temModulo(acesso, 'traceone')) {
    // Na NEO o TraceOne é só a ferramenta de pesquisa/edição da lista; o resto fica para o ADMIN NEO
    const adminNeo = acesso?.papel === 'ADMIN';
    const despachante = profile?.role === 'DESPACHANTE';
    const itens: ItemNav[] = [{ label: 'Lista de Medidores', href: '/traceone', icon: LayoutDashboard, fim: true }];
    if (adminNeo && !despachante) {
      itens.push(
        { label: 'Lançamento Manual', href: '/traceone/lancamento', icon: PlusCircle },
        { label: 'Importar Relatório', href: '/traceone/importacao', icon: UploadCloud },
        { label: 'Conferência', href: '/traceone/conferencia', icon: CheckSquare },
        { label: 'Conferência +45 dias', href: '/traceone/conferencia-45dias', icon: AlarmClockCheck },
      );
    }
    if (adminNeo && isAdmin(profile?.role)) itens.push({ label: 'Backup', href: '/traceone/backup', icon: DatabaseBackup });
    secoes.push({ titulo: 'TraceOne · Medidores', itens });
  }

  if (temModulo(acesso, 'fechamento')) {
    secoes.push({
      titulo: 'Fechamento de Notas',
      itens: [
        { label: 'Painel', href: '/fechamento/painel', icon: BarChart3 },
        { label: 'Fila de NSIS', href: '/fechamento', icon: ClipboardList, fim: true },
        { label: 'Importar', href: '/fechamento/importar', icon: FileSpreadsheet },
        { label: 'Tabela de valores', href: '/fechamento/tabela', icon: Table2 },
      ],
    });
  }

  if (temModulo(acesso, 'faturamento')) {
    secoes.push({ titulo: 'Faturamento', itens: [
      { label: 'Importar fatura', href: '/faturamento/importar', icon: FileSpreadsheet },
      { label: 'Tabelas do contrato', href: '/faturamento/tabelas', icon: Receipt },
    ] });
  }
  secoes.push({ titulo: 'Em breve', itens: EM_BREVE, emBreve: true });

  if (acesso?.papel === 'ADMIN') {
    secoes.push({
      titulo: 'Administração',
      itens: [
        { label: 'Colaboradores', href: '/colaboradores', icon: Contact },
        { label: 'Logins e acessos', href: '/acessos', icon: Users },
      ],
    });
  }
  return secoes;
}

function tituloDaRota(secoes: SecaoNav[], pathname: string) {
  let melhor: { item: ItemNav; secao: string } | null = null;
  for (const s of secoes) {
    if (s.emBreve) continue;
    for (const item of s.itens) {
      const casa = pathname === item.href || (!item.fim && pathname.startsWith(item.href + '/'));
      if (casa && (!melhor || item.href.length > melhor.item.href.length)) melhor = { item, secao: s.titulo };
    }
  }
  return melhor;
}

export default function Shell({ children }: { children: ReactNode }) {
  const { session, cadastro, acesso } = useSessao();
  const secoes = useSecoesNav();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalSenha, setModalSenha] = useState(false);

  const atual = tituloDaRota(secoes, pathname);
  const nome = cadastro?.nome ?? session?.user.email ?? '';

  async function sair() {
    await encerrarSessao();
    navigate('/login', { replace: true });
  }

  const barra = (
    <aside className="w-64 shrink-0 h-full bg-noite-degrade text-white flex flex-col">
      <div className="h-16 flex items-center justify-between px-5 border-b border-white/5">
        <NeoLogo tema="escuro" className="h-7 w-auto" />
        <button className="lg:hidden text-white/60 hover:text-white" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {secoes.map((s) => (
          <div key={s.titulo || 'raiz'}>
            {s.titulo && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{s.titulo}</p>
            )}
            <div className="space-y-0.5">
              {s.itens.map((item) => {
                const Icone = item.icon;
                if (s.emBreve) {
                  return (
                    <div key={item.label} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/30 cursor-default" title="Em breve">
                      <Icone size={16} />
                      {item.label}
                    </div>
                  );
                }
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.fim}
                    onClick={() => setMenuAberto(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sinal text-white shadow-[inset_3px_0_0_var(--color-sinal-claro)]'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    <Icone size={16} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="size-8 rounded-full bg-sinal flex items-center justify-center text-xs font-bold uppercase">
            {nome.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{nome}</p>
            <p className="text-[11px] text-white/45">{acesso?.papel === 'ADMIN' ? 'Administrador NEO' : 'Usuário NEO'}</p>
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <button onClick={() => setModalSenha(true)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded-md">
            <KeyRound size={13} /> Senha
          </button>
          <button onClick={sair} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded-md">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="h-full flex">
      <div className="hidden lg:block h-full">{barra}</div>
      {menuAberto && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {barra}
          <div className="flex-1 bg-black/40" onClick={() => setMenuAberto(false)} />
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-linha flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button className="lg:hidden text-aco" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          {atual?.secao && <span className="hidden sm:inline text-xs font-semibold text-aco-claro">{atual.secao} /</span>}
          <h1 className="text-sm font-bold text-tinta truncate">{atual?.item.label ?? 'Central NEO'}</h1>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>

      {modalSenha && <ModalSenha onFechar={() => setModalSenha(false)} />}
    </div>
  );
}

function ModalSenha({ onFechar }: { onFechar: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova.length < 6) return setErro('A nova senha precisa ter pelo menos 6 caracteres.');
    if (nova !== confirmacao) return setErro('As senhas não conferem.');
    setSalvando(true);
    try {
      const r = await trocarMinhaSenha(atual, nova);
      setOk(r.traceone === 'atualizado' ? 'Senha alterada na Central NEO e no TraceOne.'
        : r.traceone === 'falhou' ? 'Senha alterada na Central NEO. No TraceOne não foi possível: troque lá também.'
        : 'Senha alterada.');
      setTimeout(onFechar, 2200);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao trocar a senha.');
    } finally {
      setSalvando(false);
    }
  }

  const campo = 'w-full h-9 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-linha">
          <h3 className="text-sm font-bold">Alterar senha</h3>
          <button type="button" onClick={onFechar} className="text-aco-claro hover:text-tinta"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {erro && <div className="text-xs text-erro bg-erro-fundo border border-red-200 rounded-lg px-3 py-2">{erro}</div>}
          {ok && <div className="text-xs text-concluido bg-concluido-fundo border border-emerald-200 rounded-lg px-3 py-2">{ok}</div>}
          <div><label className="text-xs text-aco block mb-1">Senha atual</label>
            <input type="password" required autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className={campo} /></div>
          <div><label className="text-xs text-aco block mb-1">Nova senha</label>
            <input type="password" required minLength={6} autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className={campo} /></div>
          <div><label className="text-xs text-aco block mb-1">Confirmar nova senha</label>
            <input type="password" required autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={campo} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-semibold text-aco border border-linha rounded-lg hover:bg-nevoa">Cancelar</button>
            <button type="submit" disabled={salvando} className="px-4 py-2 text-xs font-semibold text-white bg-sinal rounded-lg hover:bg-sinal-forte disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
