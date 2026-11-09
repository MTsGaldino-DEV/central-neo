import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Download, Plus, Loader2, RefreshCw, FileSpreadsheet, AlertTriangle, ChevronRight, X, Inbox, CalendarRange, FilterX, ArrowUp, ArrowDown,
} from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import EtapaChip from '@/components/fechamento/EtapaChip';
import FiltroColuna from '@/components/fechamento/FiltroColuna';
import PainelNsis from './PainelNsis';
import {
  listarNsis, getResumo, getResumoFaturas, exportarFechamento, criarNsisManual, formatarUS, formatarReais, formatarData,
  contarPorEtapa, temFiltro, listarTiposServico, valoresDaColuna, infoEtapa,
  type Etapa, type Nsis, type ResumoFechamento, type ResumoFatura, type FiltrosNsis,
} from '@/lib/fechamento';
import { COLUNAS_FLUXO, colunasVisiveis, type ColunaFluxo } from '@/lib/fechamentoFluxo';

const POR_PAGINA = 50;

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Atalhos de período para a data de execução. */
const ATALHOS: { id: string; nome: string; faixa: () => [string, string] }[] = [
  { id: 'mes', nome: 'Este mês', faixa: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)]; } },
  { id: 'mes-passado', nome: 'Mês passado', faixa: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))]; } },
  { id: '30', nome: 'Últimos 30 dias', faixa: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 29)), iso(h)]; } },
  { id: '90', nome: 'Últimos 90 dias', faixa: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 89)), iso(h)]; } },
  { id: 'ano', nome: 'Este ano', faixa: () => { const h = new Date(); return [`${h.getFullYear()}-01-01`, iso(h)]; } },
  { id: 'ano-passado', nome: 'Ano passado', faixa: () => { const a = new Date().getFullYear() - 1; return [`${a}-01-01`, `${a}-12-31`]; } },
];

const dataBR = (d: string) => d.split('-').reverse().join('/');

/** Etapas do fluxo novo (as demais só existem no histórico). */
const ETAPAS_FLUXO: Etapa[] = ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA'];
/** Etapas só do histórico: o chip só aparece com NSIS nelas (ou quando é a etapa aberta). */
const ETAPAS_HISTORICO: Etapa[] = ['AGUARDANDO_NSMP', 'AGUARDANDO_FATURA', 'SEM_COBRANCA'];
const ETAPAS_HISTORICO_ESCONDIVEIS: Etapa[] = ['AGUARDANDO_NSMP', 'AGUARDANDO_FATURA'];

/** Colunas de valor só ordenam: não têm lista de valores para filtrar. */
const COLUNAS_SEM_LISTA: ColunaFluxo[] = ['valor_lancamento', 'valor_pago'];

/** Filtro por coluna na URL: ?col.tipo_serv=NSIS|NSRI (cada valor escapado com encodeURIComponent). */
function lerColunas(params: URLSearchParams): Partial<Record<ColunaFluxo, string[]>> {
  const colunas: Partial<Record<ColunaFluxo, string[]>> = {};
  for (const c of COLUNAS_FLUXO) {
    if (COLUNAS_SEM_LISTA.includes(c.id)) continue;
    const bruto = params.get(`col.${c.id}`);
    if (!bruto) continue;
    const valores = bruto.split('|').map((v) => { try { return decodeURIComponent(v); } catch { return v; } }).filter(Boolean);
    if (valores.length) colunas[c.id] = valores;
  }
  return colunas;
}

/** Ordem por coluna na URL: ?ordcol=termino:desc */
function lerOrdemColuna(params: URLSearchParams): FiltrosNsis['ordemColuna'] {
  const [coluna, dir] = (params.get('ordcol') ?? '').split(':');
  if (!COLUNAS_FLUXO.some((c) => c.id === coluna) || (dir !== 'asc' && dir !== 'desc')) return null;
  return { coluna: coluna as ColunaFluxo, dir };
}

/** Texto de um valor de coluna na lista do filtro e nos chips. */
function textoValor(coluna: ColunaFluxo, v: string): string {
  if (coluna === 'etapa' && v !== '—') return infoEtapa(v as Etapa).nome;
  if ((coluna === 'termino' || coluna === 'data_lancamento_sf') && /^d{4}-d{2}-d{2}$/.test(v)) return dataBR(v);
  return v;
}

export default function FilaFechamento() {
  const [params, setParams] = useSearchParams();
  const etapa = (params.get('etapa') as Etapa | 'TODAS' | null) ?? 'A_FECHAR';
  const visao = params.get('visao') === 'faturas' ? 'faturas' : 'nsis';
  const aberta = params.get('nsis');

  // Os filtros ficam na URL: dá para voltar, recarregar e chegar pelo Painel já filtrado
  const filtros: FiltrosNsis = {
    etapa,
    busca: params.get('q') ?? '',
    localidade: params.get('loc') ?? '',
    equipe: params.get('equipe') ?? '',
    tipo: params.get('tipo') ?? '',
    codigo: params.get('codigo') ?? '',
    de: params.get('de') ?? '',
    ate: params.get('ate') ?? '',
    alerta: (params.get('alerta') as FiltrosNsis['alerta']) || null,
    ordem: (params.get('ordem') as FiltrosNsis['ordem']) || 'termino_asc',
    colunas: lerColunas(params),
    ordemColuna: lerOrdemColuna(params),
  };
  const filtrado = temFiltro(filtros);
  const chaveFiltros = JSON.stringify(filtros);

  const [busca, setBusca] = useState(filtros.busca ?? '');
  const [localidade, setLocalidade] = useState(filtros.localidade ?? '');
  const [equipe, setEquipe] = useState(filtros.equipe ?? '');
  const [pagina, setPagina] = useState(1);

  const [linhas, setLinhas] = useState<Nsis[]>([]);
  const [total, setTotal] = useState(0);
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [contagens, setContagens] = useState<{ etapas: Partial<Record<Etapa, number>>; total: number } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [tipos, setTipos] = useState<string[]>([]);
  // valores de cada coluna, carregados quando o menu abre (null = carregando)
  const [valoresCol, setValoresCol] = useState<Partial<Record<ColunaFluxo, string[] | null>>>({});

  // Colunas por etapa: fluxo novo mostra o que a etapa já tem; histórico e listas mistas, o conjunto de hoje
  const colunas: ColunaFluxo[] = etapa === 'TODAS'
    ? colunasVisiveis('TODAS', false)
    : (linhas.length > 0 ? linhas.every((n) => n.fluxo_novo) : ETAPAS_FLUXO.includes(etapa))
      ? colunasVisiveis(etapa, false)
      : colunasVisiveis(etapa, true);

  useEffect(() => { listarTiposServico().then(setTipos).catch(() => {}); }, []);

  // campos de texto acompanham a URL quando ela muda por fora (voltar, link do Painel, "limpar")
  useEffect(() => {
    setBusca(params.get('q') ?? '');
    setLocalidade(params.get('loc') ?? '');
    setEquipe(params.get('equipe') ?? '');
  }, [params]);

  const carregar = useCallback(async (p = pagina) => {
    setCarregando(true);
    setErro(null);
    try {
      const [r, res, cont] = await Promise.all([
        listarNsis(filtros, p, POR_PAGINA),
        getResumo(),
        filtrado ? contarPorEtapa(filtros) : Promise.resolve(null),
      ]);
      setLinhas(r.data);
      setTotal(r.total);
      setPagina(r.page);
      setResumo(res);
      setContagens(cont);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFiltros, pagina]);

  useEffect(() => { if (visao === 'nsis') carregar(); }, [carregar, visao]);
  // Na visão por fatura a lista não carrega, mas os cartões e as contagens sim
  useEffect(() => { if (visao === 'faturas') getResumo().then(setResumo).catch(() => {}); }, [visao]);

  /** Muda vários parâmetros de uma vez; null apaga. Filtro novo volta para a página 1. */
  function mudarParams(mudancas: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === '') p.delete(chave); else p.set(chave, valor);
    }
    if (!('nsis' in mudancas)) setPagina(1);
    setParams(p, { replace: !('nsis' in mudancas) });
  }
  const mudarParam = (chave: string, valor: string | null) => mudarParams({ [chave]: valor });

  function trocarEtapa(e: Etapa | 'TODAS') {
    mudarParams({ etapa: e, visao: null });
  }

  function aplicarTextos(e?: FormEvent) {
    e?.preventDefault();
    mudarParams({ q: busca.trim(), loc: localidade.trim(), equipe: equipe.trim() });
  }

  function limparFiltros() {
    const colunasNulas = Object.fromEntries(COLUNAS_FLUXO.map((c) => [`col.${c.id}`, null]));
    mudarParams({ q: null, loc: null, equipe: null, tipo: null, codigo: null, de: null, ate: null, alerta: null, ...colunasNulas });
  }

  function abrirColuna(c: ColunaFluxo) {
    setValoresCol((v) => ({ ...v, [c]: null }));
    valoresDaColuna(c, filtros)
      .then((lista) => setValoresCol((v) => ({ ...v, [c]: lista })))
      .catch((e) => {
        setValoresCol((v) => ({ ...v, [c]: [] }));
        setErro(e instanceof Error ? e.message : 'Falha ao carregar os valores da coluna.');
      });
  }

  function filtrarColuna(c: ColunaFluxo, valores: string[]) {
    mudarParam(`col.${c}`, valores.length ? valores.map(encodeURIComponent).join('|') : null);
  }

  /** Clicar de novo na ordem já ativa da coluna volta à ordem padrão. */
  function ordenarColuna(c: ColunaFluxo, dir: 'asc' | 'desc') {
    const atual = filtros.ordemColuna;
    mudarParam('ordcol', atual && atual.coluna === c && atual.dir === dir ? null : `${c}:${dir}`);
  }

  async function exportar() {
    setExportando(true);
    try {
      await exportarFechamento(filtros);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao exportar.');
    } finally {
      setExportando(false);
    }
  }

  const contagem = (e: Etapa) => (contagens ?? resumo)?.etapas[e] ?? 0;
  const totalGeral = contagens?.total ?? resumo?.total ?? 0;
  const diferenca = resumo ? resumo.valorPagoConfirmado - resumo.valorPedidoConfirmado : 0;
  const diferencaReais = resumo ? resumo.valorPagoConfirmadoReais - resumo.valorPedidoConfirmadoReais : 0;
  const verAlerta = (a: FiltrosNsis['alerta']) => mudarParams({ alerta: a ?? null, etapa: 'TODAS', visao: null });

  // chips dos filtros ativos
  const chips: { rotulo: ReactNode; limpar: Record<string, null> }[] = [];
  if (filtros.de || filtros.ate) {
    chips.push({
      rotulo: <>Execução {filtros.de && filtros.ate ? <>de <b>{dataBR(filtros.de)}</b> a <b>{dataBR(filtros.ate)}</b></>
        : filtros.de ? <>a partir de <b>{dataBR(filtros.de)}</b></> : <>até <b>{dataBR(filtros.ate!)}</b></>}</>,
      limpar: { de: null, ate: null },
    });
  }
  if (filtros.codigo) chips.push({ rotulo: <>Código <b className="font-codigo">{filtros.codigo}</b></>, limpar: { codigo: null } });
  if (filtros.tipo) chips.push({ rotulo: <>Tipo <b>{filtros.tipo}</b></>, limpar: { tipo: null } });
  if (filtros.busca) chips.push({ rotulo: <>Busca: <b>{filtros.busca}</b></>, limpar: { q: null } });
  if (filtros.localidade) chips.push({ rotulo: <>Localidade <b>{filtros.localidade}</b></>, limpar: { loc: null } });
  if (filtros.equipe) chips.push({ rotulo: <>Equipe <b>{filtros.equipe}</b></>, limpar: { equipe: null } });
  for (const c of COLUNAS_FLUXO) {
    const v = filtros.colunas?.[c.id];
    if (!v?.length) continue;
    const mostrados = v.slice(0, 2).map((x) => textoValor(c.id, x)).join(', ');
    chips.push({
      rotulo: <>{c.rotulo}: <b>{mostrados}{v.length > 2 ? ` +${v.length - 2}` : ''}</b></>,
      limpar: { [`col.${c.id}`]: null },
    });
  }
  if (filtros.alerta) chips.push({ rotulo: <b>{filtros.alerta === 'DIVERGENTE' ? 'Pago ≠ pedido' : 'NSPR sem valor pago'}</b>, limpar: { alerta: null } });

  const campo = 'h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-xl font-extrabold tracking-tight">Manutenção · fila de NSIS</h2>
          <p className="text-sm text-aco">Leia o que foi feito, peça o pagamento (NSMP) e acompanhe até a fatura.</p>
        </div>
        <button onClick={() => setNovaAberta(true)} className="h-9 px-3 rounded-lg border border-linha bg-white text-sm font-semibold flex items-center gap-1.5 hover:border-sinal hover:text-sinal">
          <Plus size={15} /> NSIS avulsa
        </button>
        <button onClick={exportar} disabled={exportando} className="h-9 px-3 rounded-lg border border-linha bg-white text-sm font-semibold flex items-center gap-1.5 hover:border-sinal hover:text-sinal disabled:opacity-50"
          title={filtrado ? 'Exporta só o que está filtrado' : 'Exporta a etapa selecionada'}>
          {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exportar Excel
        </button>
        <Link to="/fechamento/importar" className="h-9 px-3 rounded-lg bg-sinal text-white text-sm font-bold flex items-center gap-1.5 hover:bg-sinal-forte">
          <FileSpreadsheet size={15} /> Importar relatório
        </Link>
      </div>

      {/* Pedido × pago (visão geral, sem filtros) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador rotulo="Pedido à CEMIG" valor={formatarReais(resumo?.valorPedidoReais ?? 0)}
          detalhe={`${formatarUS(resumo?.valorPedido ?? 0)} US · NSMP geradas`} />
        <Indicador rotulo="Pago pela CEMIG" valor={formatarReais(resumo?.valorPagoReais ?? 0)}
          detalhe={`${formatarUS(resumo?.valorPago ?? 0)} US · NSPR recebidas`} />
        <Indicador
          rotulo="Pago − pedido"
          valor={`${diferencaReais > 0 ? '+' : ''}${formatarReais(diferencaReais)}`}
          detalhe={`${diferenca > 0 ? '+' : ''}${formatarUS(diferenca)} US · itens com pedido e pago`}
          destaque={Math.abs(diferencaReais) > 0.005 ? (diferencaReais < 0 ? 'erro' : 'ok') : undefined}
        />
        <div className="bg-white border border-linha rounded-2xl px-4 py-3 h-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-aco">Alertas de pagamento</p>
          <button onClick={() => verAlerta('DIVERGENTE')} className="mt-1.5 w-full flex items-baseline justify-between gap-2 text-left hover:underline">
            <span className="text-xs text-aco">Pago ≠ pedido</span>
            <span className={`text-lg font-extrabold ${(resumo?.divergentes ?? 0) > 0 ? 'text-cobre' : 'text-aco-claro'}`}>{resumo?.divergentes ?? 0}</span>
          </button>
          <button onClick={() => verAlerta('SEM_VALOR')} className="w-full flex items-baseline justify-between gap-2 text-left hover:underline">
            <span className="text-xs text-aco">NSPR sem valor pago</span>
            <span className={`text-lg font-extrabold ${(resumo?.semValorPago ?? 0) > 0 ? 'text-pendente' : 'text-aco-claro'}`}>{resumo?.semValorPago ?? 0}</span>
          </button>
        </div>
      </div>
      {(resumo?.itensSemValorUS ?? 0) > 0 && (
        <p className="-mt-3 text-[11px] text-aco-claro">
          Valores em R$ pela US vigente na data de execução. {resumo!.itensSemValorUS.toLocaleString('pt-BR')} itens executados antes do primeiro valor de US cadastrado
          ficam fora do R$: <Link to="/fechamento/tabela" className="underline">cadastrar valores da US</Link>.
        </p>
      )}

      {/* Etapas do fluxo */}
      <div className="bg-white border border-linha rounded-2xl p-1.5 flex flex-nowrap items-center gap-1 overflow-x-auto">
        {[...ETAPAS_FLUXO, 'SEPARADOR' as const, ...ETAPAS_HISTORICO].map((id, i) => {
          if (id === 'SEPARADOR') return <span key={id} className="w-px h-6 bg-linha mx-2 shrink-0" />;
          const e = infoEtapa(id);
          const ativa = visao === 'nsis' && etapa === e.id;
          const historica = ETAPAS_HISTORICO.includes(e.id);
          // chips só do histórico somem quando vazios (a menos que sejam a etapa aberta)
          if (ETAPAS_HISTORICO_ESCONDIVEIS.includes(e.id) && !ativa && contagem(e.id) === 0) return null;
          return (
            <div key={e.id} className="flex items-center shrink-0">
              {i > 0 && !historica && <ChevronRight size={13} className="text-aco-claro/60" />}
              <button onClick={() => trocarEtapa(e.id)} title={historica ? `${e.nome} (histórico)` : e.nome}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${ativa ? `${e.classe} ring-1 ring-current/20` : 'text-aco hover:bg-nevoa'}`}>
                <span className={`size-2 rounded-full ${e.marca}`} />
                {e.curto}
                <span className={`min-w-6 px-1.5 rounded-full text-xs ${ativa ? 'bg-white/70' : 'bg-nevoa'}`}>{contagem(e.id)}</span>
              </button>
            </div>
          );
        })}
        <span className="flex-1 min-w-2" />
        <button onClick={() => trocarEtapa('TODAS')} className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-xl text-sm font-semibold ${visao === 'nsis' && etapa === 'TODAS' ? 'bg-sinal-fundo text-sinal' : 'text-aco hover:bg-nevoa'}`}>
          Todas <span className="text-xs">{totalGeral}</span>
        </button>
      </div>

      <div className="flex gap-1 bg-white border border-linha rounded-xl p-1 w-fit">
        <button onClick={() => mudarParam('visao', null)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${visao === 'nsis' ? 'bg-sinal text-white' : 'text-aco hover:bg-nevoa'}`}>
          Por NSIS
        </button>
        <button onClick={() => mudarParam('visao', 'faturas')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${visao === 'faturas' ? 'bg-sinal text-white' : 'text-aco hover:bg-nevoa'}`}>
          Por fatura (pedido × pago)
        </button>
      </div>

      {visao === 'faturas' ? (
        <PorFatura onAbrirFatura={(ap) => {
          const p = new URLSearchParams();
          p.set('etapa', 'TODAS');
          p.set('q', ap);
          setParams(p, { replace: true });
        }} />
      ) : (
        <>
          {/* Filtros */}
          <form onSubmit={aplicarTextos} className="bg-white border border-linha rounded-2xl p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[11px] font-semibold text-aco mb-1">Busca</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aco-claro" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)}
                    placeholder="Serviço, NSMP, NSPR, AP, equipe, supervisor ou texto…" className={`${campo} w-full pl-9`} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-aco mb-1 flex items-center gap-1"><CalendarRange size={12} /> Data de execução</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={filtros.de} max={filtros.ate || undefined} onChange={(e) => mudarParam('de', e.target.value)}
                    className={`${campo} w-[150px] ${filtros.de ? 'border-sinal' : ''}`} aria-label="Execução de" />
                  <span className="text-xs text-aco">até</span>
                  <input type="date" value={filtros.ate} min={filtros.de || undefined} onChange={(e) => mudarParam('ate', e.target.value)}
                    className={`${campo} w-[150px] ${filtros.ate ? 'border-sinal' : ''}`} aria-label="Execução até" />
                  <select value="" onChange={(e) => {
                    const a = ATALHOS.find((x) => x.id === e.target.value);
                    if (a) { const [de, ate] = a.faixa(); mudarParams({ de, ate }); }
                  }} className={`${campo} px-2 text-aco`} aria-label="Atalhos de período">
                    <option value="">Atalhos…</option>
                    {ATALHOS.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-aco mb-1">Tipo do serviço</label>
                <select value={filtros.tipo ?? ''} onChange={(e) => mudarParam('tipo', e.target.value || null)}
                  className={`${campo} px-2 ${filtros.tipo ? 'border-sinal text-sinal font-semibold' : ''}`}>
                  <option value="">Todos</option>
                  {[...new Set([...tipos, ...(filtros.tipo ? [filtros.tipo] : [])])].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-aco mb-1">Localidade</label>
                <input value={localidade} onChange={(e) => setLocalidade(e.target.value.replace(/\D/g, '').slice(0, 4))} onBlur={() => aplicarTextos()}
                  placeholder="0000" inputMode="numeric" className={`${campo} w-24 font-codigo`} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-aco mb-1">Equipe</label>
                <input value={equipe} onChange={(e) => setEquipe(e.target.value)} onBlur={() => aplicarTextos()}
                  placeholder="Nº da equipe" className={`${campo} w-32 font-codigo`} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-aco mb-1">Pagamento</label>
                <select value={filtros.alerta ?? ''} onChange={(e) => mudarParam('alerta', e.target.value || null)}
                  className={`${campo} px-2 ${filtros.alerta ? 'border-cobre text-cobre font-semibold' : ''}`}>
                  <option value="">Todos</option>
                  <option value="DIVERGENTE">Pago diferente do pedido</option>
                  <option value="SEM_VALOR">NSPR sem valor pago</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-aco mb-1">Ordem</label>
                <select value={filtros.ordem} onChange={(e) => mudarParams({ ordem: e.target.value === 'termino_asc' ? null : e.target.value, ordcol: null })}
                  className={`${campo} px-2`}>
                  <option value="termino_asc">Execução mais antiga primeiro</option>
                  <option value="termino_desc">Execução mais recente primeiro</option>
                  <option value="servico">Nº do serviço</option>
                </select>
              </div>
              <span className="flex-1" />
              <button type="submit" className="h-9 px-4 rounded-lg bg-sinal text-white text-sm font-bold hover:bg-sinal-forte">Filtrar</button>
              <button type="button" onClick={() => carregar()} className="h-9 w-9 flex items-center justify-center border border-linha rounded-lg bg-white text-aco hover:text-sinal" title="Atualizar">
                <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
              </button>
            </div>
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-linha">
                {chips.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-sinal-fundo text-sinal-forte text-xs">
                    {c.rotulo}
                    <button type="button" onClick={() => mudarParams(c.limpar)} className="p-0.5 rounded-full hover:bg-white/70" aria-label="Remover filtro"><X size={12} /></button>
                  </span>
                ))}
                <button type="button" onClick={limparFiltros} className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-aco hover:text-erro">
                  <FilterX size={13} /> Limpar filtros
                </button>
                <span className="flex-1" />
                <span className="text-xs text-aco"><b className="text-tinta">{totalGeral.toLocaleString('pt-BR')}</b> NSIS com esses filtros (todas as etapas)</span>
              </div>
            )}
          </form>

          {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{erro}</div>}

          {/* Tabela: grade estilo Excel, igual à lista de Instalações do Visão de Dono */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#e2e8f0] text-xs text-[#64748b]">
              <b className="text-tinta">{total.toLocaleString('pt-BR')}</b> NSIS
            </div>
            <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[200px]">
              <table className={`grade-nsis w-full ${colunas.length > 6 ? 'min-w-[1180px]' : ''} border-separate border-spacing-0 text-xs text-left`}>
                <thead>
                  <tr>
                    {colunas.map((id) => {
                      const def = COLUNAS_FLUXO.find((c) => c.id === id)!;
                      const ordemDaColuna = filtros.ordemColuna?.coluna === id ? filtros.ordemColuna.dir : null;
                      const selecionados = filtros.colunas?.[id];
                      return (
                        <th key={id} className={`${def.numero ? 'text-right' : ''} ${id === 'observacao' ? 'min-w-[260px]' : ''} ${id === 'etapa' ? 'grade-fixa-cab' : ''}`}>
                          <div className={`flex items-center gap-1.5 ${def.numero ? 'justify-end' : ''}`}>
                            <span>{def.rotulo}</span>
                            {ordemDaColuna === 'asc' && <ArrowUp size={11} className="text-sinal" aria-hidden="true" />}
                            {ordemDaColuna === 'desc' && <ArrowDown size={11} className="text-sinal" aria-hidden="true" />}
                            <FiltroColuna
                              coluna={def}
                              valores={valoresCol[id] ?? null}
                              selecionados={selecionados}
                              ordem={ordemDaColuna}
                              ativo={!!selecionados?.length}
                              semLista={COLUNAS_SEM_LISTA.includes(id)}
                              formatar={(v) => textoValor(id, v)}
                              onAbrir={() => abrirColuna(id)}
                              onOrdenar={(dir) => ordenarColuna(id, dir)}
                              onFiltrar={(v) => filtrarColuna(id, v)}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {!carregando && linhas.length === 0 && (
                    <tr className="sem-hover"><td colSpan={colunas.length} className="!py-9 text-center !text-aco-claro !whitespace-normal">
                      <Inbox size={28} className="mx-auto text-aco-claro mb-2" />
                      {etapa === 'A_FECHAR' && !filtrado ? 'Nenhuma NSIS a fechar. Importe o relatório da semana.' : 'Nenhuma NSIS encontrada com esses filtros.'}
                    </td></tr>
                  )}
                  {carregando && linhas.length === 0 && (
                    <tr className="sem-hover"><td colSpan={colunas.length} className="!py-9 text-center !text-aco-claro">
                      <Loader2 size={16} className="animate-spin inline mr-2 align-text-bottom" /> Carregando…
                    </td></tr>
                  )}
                  {linhas.map((n) => (
                    <tr key={n.servico} onClick={() => mudarParam('nsis', n.servico)}
                      className={aberta === n.servico ? 'selecionada' : ''}>
                      {colunas.map((id) => <Celula key={id} id={id} n={n} localidadeVisivel={colunas.includes('localidade')} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={pagina} totalPages={Math.ceil(total / POR_PAGINA)} totalItems={total}
            pageSize={POR_PAGINA} onPageChange={setPagina} label="NSIS" />
        </>
      )}

      {aberta && (
        <PainelNsis servico={aberta} onFechar={() => mudarParam('nsis', null)} onAlterado={() => carregar()} />
      )}
      {novaAberta && <ModalNovaNsis onFechar={() => setNovaAberta(false)} onCriada={(s) => { setNovaAberta(false); mudarParam('nsis', s); carregar(); }} />}
    </div>
  );
}

/** Célula de uma coluna da lista; sem dado mostra —. */
function Celula({ id, n, localidadeVisivel }: { id: ColunaFluxo; n: Nsis; localidadeVisivel: boolean }) {
  const vazio = <span className="text-[#94a3b8]">—</span>;
  switch (id) {
    case 'servico': return <td className="font-codigo font-bold text-[#0f2544]">{n.servico}</td>;
    case 'tipo_serv': return <td className="font-bold">{n.tipo_serv}</td>;
    case 'localidade': return <td className="font-codigo">{n.localidade ?? vazio}</td>;
    case 'nsmps': return <td className="!text-[#7c3aed]"><Numeros valor={n.nsmps} falta={n.qtd_itens > 0 && n.itens_sem_nsmp > 0} /></td>;
    case 'equipes': return <td><Numeros valor={n.equipes} falta={false} /></td>;
    case 'supervisor': return (
      <td>
        {n.supervisor ?? vazio}
        {!localidadeVisivel && <span className="block text-[11px] text-[#64748b]">Loc. <span className="font-codigo">{n.localidade ?? '—'}</span></span>}
      </td>
    );
    case 'nsprs': return <td className="!text-[#15803d]"><Numeros valor={n.nsprs} falta={n.qtd_itens > 0 && !!n.nsmps && n.itens_sem_nspr > 0} /></td>;
    case 'termino': return <td className="!text-[#64748b]">{formatarData(n.termino)}</td>;
    case 'valor_lancamento': return (
      <td className="text-right tabular-nums">
        {n.qtd_itens ? <>
          <span className="font-bold">{formatarUS(n.valor_inicial_total)}</span>
          {n.valor_us_reais !== null && <span className="block text-[11px] text-[#64748b]">{formatarReais(n.valor_inicial_reais_total)}</span>}
        </> : vazio}
      </td>
    );
    case 'valor_pago': return (
      <td className={`text-right tabular-nums ${n.itens_divergentes > 0 ? '!text-erro' : ''}`}>
        {n.qtd_itens - n.itens_sem_nsmp - n.itens_sem_nspr > 0 ? <>
          <span className="font-bold">{formatarUS(n.valor_final_total)}</span>
          {n.valor_us_reais !== null && <span className={`block text-[11px] ${n.itens_divergentes > 0 ? '' : 'text-[#64748b]'}`}>{formatarReais(n.valor_final_reais_total)}</span>}
        </> : vazio}
        {n.itens_sem_valor_pago > 0 && <span className="block text-[10px] font-bold text-pendente">sem valor pago</span>}
      </td>
    );
    // data pura (YYYY-MM-DD): formatarData deslocaria um dia pelo fuso
    case 'data_lancamento_sf': return <td className="!text-[#64748b]">{n.data_lancamento_sf ? dataBR(n.data_lancamento_sf.slice(0, 10)) : vazio}</td>;
    case 'faturas': return <td className="!text-[#1d4ed8]"><Numeros valor={n.faturas} falta={n.qtd_itens > 0 && !!n.nsprs && n.itens_sem_fatura > 0} /></td>;
    case 'observacao': return (
      <td className="!whitespace-normal">
        {n.observacao
          ? <span className="line-clamp-2">{n.observacao}</span>
          : n.qtd_itens === 0 && <span className="text-pendente text-xs font-semibold">sem observação no GDIS</span>}
        {n.qtd_itens > 0 && <span className="block text-[11px] text-[#64748b] mt-0.5">{n.qtd_itens} item{n.qtd_itens > 1 ? 's' : ''}</span>}
      </td>
    );
    case 'etapa': return <td className="grade-fixa"><EtapaChip etapa={n.etapa} curto /></td>;
  }
}

/** NSMP / NSPR / equipe / AP da NSIS: um número por linha; "falta" quando algum item ainda não tem. */
function Numeros({ valor, falta }: { valor: string | null; falta: boolean }) {
  const lista = valor ? valor.split(', ') : [];
  return (
    <div className="font-codigo text-[13px] font-semibold leading-5 whitespace-nowrap">
      {lista.map((v) => <span key={v} className="block">{v}</span>)}
      {falta && <span className="block font-sans text-[10px] font-bold text-pendente">{lista.length ? '+ falta' : 'falta'}</span>}
      {!lista.length && !falta && <span className="text-aco-claro font-normal">—</span>}
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe: string; destaque?: 'erro' | 'ok' | 'cobre' }) {
  const cor = destaque === 'erro' ? 'text-erro' : destaque === 'ok' ? 'text-concluido' : destaque === 'cobre' ? 'text-cobre' : 'text-tinta';
  return (
    <div className="bg-white border border-linha rounded-2xl px-4 py-3 h-full">
      <p className="text-[11px] font-bold uppercase tracking-wider text-aco">{rotulo}</p>
      <p className={`text-2xl font-extrabold tracking-tight mt-1 ${cor}`}>{valor}</p>
      <p className="text-[11px] text-aco-claro">{detalhe}</p>
    </div>
  );
}

function PorFatura({ onAbrirFatura }: { onAbrirFatura: (ap: string) => void }) {
  const [faturas, setFaturas] = useState<ResumoFatura[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getResumoFaturas().then(setFaturas).catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar.'));
  }, []);

  if (erro) return <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3">{erro}</div>;
  if (!faturas) return <div className="py-12 flex items-center justify-center gap-2 text-aco"><Loader2 size={16} className="animate-spin" /> Carregando…</div>;

  return (
    <div className="bg-white border border-linha rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-aco border-b border-linha bg-nevoa/60">
              <th className="px-4 py-3 font-bold">Fatura</th>
              <th className="px-3 py-3 font-bold text-right">NSIS</th>
              <th className="px-3 py-3 font-bold text-right">Itens</th>
              <th className="px-3 py-3 font-bold text-right">Pedido (US)</th>
              <th className="px-3 py-3 font-bold text-right">Pago (US)</th>
              <th className="px-3 py-3 font-bold text-right">Diferença</th>
              <th className="px-3 py-3 font-bold text-right">Pago (R$)</th>
              <th className="px-3 py-3 font-bold text-right">Pago ≠ pedido</th>
              <th className="px-4 py-3 font-bold text-right">Sem valor pago</th>
            </tr>
          </thead>
          <tbody>
            {faturas.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-aco">Nenhuma fatura registrada ainda.</td></tr>
            )}
            {faturas.map((f) => {
              const dif = f.valor_pago - f.valor_pedido;
              return (
                <tr key={f.fatura} onClick={() => onAbrirFatura(f.fatura)} className="border-b border-linha last:border-0 cursor-pointer hover:bg-sinal-fundo/50">
                  <td className="px-4 py-3 font-codigo font-semibold">{f.fatura}</td>
                  <td className="px-3 py-3 text-right">{f.qtd_nsis}</td>
                  <td className="px-3 py-3 text-right">{f.qtd_itens}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatarUS(f.valor_pedido)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatarUS(f.valor_pago)}</td>
                  <td className={`px-3 py-3 text-right font-bold ${dif < -0.0001 ? 'text-erro' : dif > 0.0001 ? 'text-concluido' : 'text-aco-claro'}`}>
                    {Math.abs(dif) < 0.0001 ? '—' : `${dif > 0 ? '+' : ''}${formatarUS(dif)}`}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {f.valor_pago_reais ? formatarReais(f.valor_pago_reais) : <span className="text-aco-claro">—</span>}
                  </td>
                  <td className={`px-3 py-3 text-right ${f.divergentes ? 'text-cobre font-bold' : 'text-aco-claro'}`}>{f.divergentes || '—'}</td>
                  <td className={`px-4 py-3 text-right ${f.sem_valor_pago ? 'text-pendente font-bold' : 'text-aco-claro'}`}>{f.sem_valor_pago || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModalNovaNsis({ onFechar, onCriada }: { onFechar: () => void; onCriada: (servico: string) => void }) {
  const [servico, setServico] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!/^\d+$/.test(servico.trim())) return setErro('Informe o número do serviço (só números).');
    setSalvando(true);
    try {
      await criarNsisManual(servico.trim(), observacao.trim() || null);
      onCriada(servico.trim());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao criar.');
      setSalvando(false);
    }
  }

  const campo = 'w-full h-10 px-3 text-sm border border-linha rounded-lg focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">NSIS avulsa</h3>
          <button type="button" onClick={onFechar} className="text-aco-claro hover:text-tinta"><X size={16} /></button>
        </div>
        <p className="text-xs text-aco">Para uma NSIS que não veio no relatório importado. O ideal é importar o relatório do GDIS, que traz todos os dados.</p>
        {erro && <p className="text-xs text-erro bg-erro-fundo rounded-lg px-3 py-2">{erro}</p>}
        <div><label className="block text-xs font-semibold text-aco mb-1">Nº do serviço</label>
          <input autoFocus value={servico} onChange={(e) => setServico(e.target.value)} className={`${campo} font-codigo`} /></div>
        <div><label className="block text-xs font-semibold text-aco mb-1">O que foi feito (observação)</label>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 h-9 text-sm font-semibold text-aco border border-linha rounded-lg">Cancelar</button>
          <button type="submit" disabled={salvando} className="px-4 h-9 text-sm font-bold text-white bg-sinal rounded-lg disabled:opacity-50">Criar</button>
        </div>
      </form>
    </div>
  );
}
