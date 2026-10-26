import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2, Lock, LogOut } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import { temModulo, type Modulo } from '@/lib/neo';
import { sair } from '@/lib/auth';
import ConectarTraceone from '@/paginas/traceone/ConectarTraceone';
import { isAdmin } from '@/lib/permissions';
import Shell from '@/components/Shell';
import NeoLogo from '@/components/NeoLogo';
import Login from '@/paginas/Login';
import ResetSenha from '@/paginas/ResetSenha';
import Inicio from '@/paginas/Inicio';
import Acessos from '@/paginas/Acessos';

// Cada tela vira um pedaço separado do bundle: só baixa quando é aberta
const ListaMedidores = lazy(() => import('@/paginas/traceone/Lista'));
const Lancamento = lazy(() => import('@/paginas/traceone/Lancamento'));
const Importacao = lazy(() => import('@/paginas/traceone/Importacao'));
const Conferencia = lazy(() => import('@/paginas/traceone/Conferencia'));
const Conferencia45 = lazy(() => import('@/paginas/traceone/Conferencia45'));
const Backup = lazy(() => import('@/paginas/traceone/Backup'));
const FilaFechamento = lazy(() => import('@/paginas/fechamento/Fila'));
const ImportarFechamento = lazy(() => import('@/paginas/fechamento/Importar'));
const TabelaValores = lazy(() => import('@/paginas/fechamento/TabelaValores'));
const PainelFechamento = lazy(() => import('@/paginas/fechamento/Painel'));
const Colaboradores = lazy(() => import('@/paginas/Colaboradores'));
const ContratoFat = lazy(() => import('@/paginas/faturamento/Contrato'));
const ImportarFat = lazy(() => import('@/paginas/faturamento/Importar'));
const ConferenciaFat = lazy(() => import('@/paginas/faturamento/Conferencia'));
const PainelFat = lazy(() => import('@/paginas/faturamento/Painel'));
const FaturasFat = lazy(() => import('@/paginas/faturamento/Faturas'));
const DocumentacaoFat = lazy(() => import('@/paginas/faturamento/Documentacao'));

function Carregando() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-noite-degrade">
      <NeoLogo tema="escuro" className="h-10 w-auto" />
      <Loader2 size={18} className="animate-spin text-white/50" />
    </div>
  );
}

function SemAcesso() {
  const { session, erro } = useSessao();
  return (
    <div className="h-full flex items-center justify-center p-6 bg-nevoa">
      <div className="max-w-sm text-center">
        <span className="mx-auto size-12 rounded-2xl bg-sinal-fundo text-sinal flex items-center justify-center"><Lock size={22} /></span>
        <h2 className="text-lg font-extrabold mt-4">Seu acesso à Central NEO ainda não foi liberado</h2>
        <p className="text-sm text-aco mt-2">
          {erro ?? <>Você entrou como <strong>{session?.user.email}</strong>. Peça a um administrador da NEO para liberar seu acesso.</>}
        </p>
        <button onClick={() => sair()} className="mt-6 h-10 px-4 rounded-xl border border-linha bg-white text-sm font-semibold inline-flex items-center gap-2">
          <LogOut size={15} /> Sair
        </button>
      </div>
    </div>
  );
}

/** Logado e com acesso ativo na NEO. */
function Protegido() {
  const { carregando, session, acesso } = useSessao();
  if (carregando) return <Carregando />;
  if (!session) return <Navigate to="/login" replace />;
  if (!acesso?.ativo) return <SemAcesso />;
  return (
    <Shell>
      <Suspense fallback={<div className="p-10 flex justify-center text-aco"><Loader2 size={18} className="animate-spin" /></div>}>
        <Outlet />
      </Suspense>
    </Shell>
  );
}

function ExigeModulo({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const { acesso } = useSessao();
  return temModulo(acesso, modulo) ? <>{children}</> : <Navigate to="/" replace />;
}

/** Medidores moram no TraceOne: precisa da sessão de lá aberta. */
function ExigeTraceone({ children }: { children: ReactNode }) {
  const { traceone } = useSessao();
  if (traceone === 'verificando') return <div className="p-10 flex justify-center text-aco"><Loader2 size={18} className="animate-spin" /></div>;
  return traceone === 'conectado' ? <>{children}</> : <ConectarTraceone />;
}

function ExigeAdminNeo({ children }: { children: ReactNode }) {
  const { acesso } = useSessao();
  return acesso?.papel === 'ADMIN' ? <>{children}</> : <Navigate to="/" replace />;
}

/** Telas de escrita do TraceOne: o despachante só vê a lista, como no TraceOne. */
function NaoDespachante({ children }: { children: ReactNode }) {
  const { profile } = useSessao();
  return profile?.role === 'DESPACHANTE' ? <Navigate to="/traceone" replace /> : <>{children}</>;
}

function SoAdminTraceone({ children }: { children: ReactNode }) {
  const { profile } = useSessao();
  return isAdmin(profile?.role) ? <>{children}</> : <Navigate to="/traceone" replace />;
}

/** Link antigo do "Resumo": vai para o Painel mantendo fatura e período. */
function ParaPainel() {
  const { search } = useLocation();
  return <Navigate to={`/faturamento/painel${search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-senha" element={<ResetSenha />} />
      <Route element={<Protegido />}>
        <Route index element={<Inicio />} />
        <Route path="traceone" element={<ExigeModulo modulo="traceone"><ExigeTraceone><Outlet /></ExigeTraceone></ExigeModulo>}>
          <Route index element={<ListaMedidores />} />
          <Route path="lancamento" element={<ExigeAdminNeo><NaoDespachante><Lancamento /></NaoDespachante></ExigeAdminNeo>} />
          <Route path="importacao" element={<ExigeAdminNeo><NaoDespachante><Importacao /></NaoDespachante></ExigeAdminNeo>} />
          <Route path="conferencia" element={<ExigeAdminNeo><NaoDespachante><Conferencia /></NaoDespachante></ExigeAdminNeo>} />
          <Route path="conferencia-45dias" element={<ExigeAdminNeo><NaoDespachante><Conferencia45 /></NaoDespachante></ExigeAdminNeo>} />
          <Route path="backup" element={<ExigeAdminNeo><SoAdminTraceone><Backup /></SoAdminTraceone></ExigeAdminNeo>} />
        </Route>
        <Route path="fechamento" element={<ExigeModulo modulo="fechamento"><Outlet /></ExigeModulo>}>
          <Route index element={<FilaFechamento />} />
          <Route path="importar" element={<ImportarFechamento />} />
          <Route path="tabela" element={<TabelaValores />} />
          <Route path="painel" element={<PainelFechamento />} />
        </Route>
        <Route path="faturamento" element={<ExigeModulo modulo="faturamento"><Outlet /></ExigeModulo>}>
          <Route index element={<FaturasFat />} />
          <Route path="conferencia" element={<ConferenciaFat />} />
          <Route path="tabelas" element={<ContratoFat />} />
          <Route path="importar" element={<ImportarFat />} />
          <Route path="painel" element={<PainelFat />} />
          <Route path="resumo" element={<ParaPainel />} />
          <Route path="documentacao" element={<DocumentacaoFat />} />
          <Route path="documentacao/:pagina" element={<DocumentacaoFat />} />
        </Route>
        <Route path="acessos" element={<ExigeAdminNeo><Acessos /></ExigeAdminNeo>} />
        <Route path="colaboradores" element={<ExigeAdminNeo><Colaboradores /></ExigeAdminNeo>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
