import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Download, Plus, Loader2, RefreshCw, FileSpreadsheet, AlertTriangle, X, Copy, Check, Inbox, CalendarRange, FilterX, SlidersHorizontal, ArrowUp, ArrowDown, Trash2,
} from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import { Pagination } from '@/components/Pagination';
import { ListaSuspensa } from '@/components/ui/lista-suspensa';
import EtapaChip from '@/components/fechamento/EtapaChip';
import FiltroColuna from '@/components/fechamento/FiltroColuna';
import PainelNsis from './PainelNsis';
import {
  listarNsis, getResumo, exportarFechamento, criarNsisManual, formatarUS, formatarReais, formatarData,
  excluirNsis, contarPorEtapa, temFiltro, listarTiposServico, valoresDaColuna, infoEtapa, ehFluxoNovo, descricoesDosItens,
  type Etapa, type Nsis, type ResumoFechamento, type FiltrosNsis,
} from '@/lib/fechamento';
import { COLUNAS_FLUXO, colunasVisiveis, type ColunaFluxo } from '@/lib/fechamentoFluxo';
import { rotuloLocalidade } from '@/lib/localidades';

const POR_PAGINA = 50;

/** Uma página da lista já lida: as NSIS e as descrições dos itens (para a coluna Observação). */
interface PaginaLida { r: { data: Nsis[]; total: number; page: number }; descricoes: Record<string, string[]> }

async function lerPagina(filtros: FiltrosNsis, p: number): Promise<PaginaLida> {
  const r = await listarNsis(filtros, p, POR_PAGINA);
  // NSIS sem observação do GDIS mostram, na coluna Observação, a descrição dos itens
  const semObservacao = r.data.filter((n) => !n.observacao && n.qtd_itens > 0).map((n) => n.servico);
  const descricoes = await descricoesDosItens(semObservacao).catch(() => ({}));
  return { r, descricoes };
}

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

/** Colunas de valor e a observação (texto livre) só ordenam: não têm lista de valores para filtrar. */
const COLUNAS_SEM_LISTA: ColunaFluxo[] = ['valor_lancamento', 'valor_pago', 'observacao'];

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
  if (coluna === 'localidade' && v !== '—') return rotuloLocalidade(v);
  if ((coluna === 'termino' || coluna === 'data_lancamento_sf') && /^\d{4}-\d{2}-\d{2}$/.test(v)) return dataBR(v);
  return v;
}

export default function FilaFechamento() {
  const [params, setParams] = useSearchParams();
  const etapa = (params.get('etapa') as Etapa | 'TODAS' | null) ?? 'A_FECHAR';
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
    // a ordem vem do cabeçalho da coluna (ordemColuna); sem ela, execução mais recente primeiro
    ordem: 'termino_desc',
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
  const [excluindo, setExcluindo] = useState<string | null>(null); // serviço em exclusão
  const [novaAberta, setNovaAberta] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [descricoes, setDescricoes] = useState<Record<string, string[]>>({});
  const [tipos, setTipos] = useState<string[]>([]);
  // valores de cada coluna, carregados quando o menu abre (null = carregando)
  const [valoresCol, setValoresCol] = useState<Partial<Record<ColunaFluxo, string[] | null>>>({});

  // Colunas por etapa: fluxo novo mostra o que a etapa já tem; histórico e listas mistas, o conjunto de hoje
  const colunas: ColunaFluxo[] = etapa === 'TODAS'
    ? colunasVisiveis('TODAS', false)
    : (linhas.length > 0 ? linhas.every((n) => ehFluxoNovo(n)) : ETAPAS_FLUXO.includes(etapa))
      ? colunasVisiveis(etapa, false)
      : colunasVisiveis(etapa, true);

  useEffect(() => { listarTiposServico().then(setTipos).catch(() => {}); }, []);

  // campos de texto acompanham a URL quando ela muda por fora (voltar, link do Painel, "limpar")
  useEffect(() => {
    setBusca(params.get('q') ?? '');
    setLocalidade(params.get('loc') ?? '');
    setEquipe(params.get('equipe') ?? '');
  }, [params]);

  // Páginas já lidas, por filtros + página: trocar de etapa mostra na hora o que já veio (e atualiza por baixo)
  const cache = useRef(new Map<string, PaginaLida>());
  const pedido = useRef(0); // só o pedido mais recente mexe na tela
  const [versaoCache, setVersaoCache] = useState(0);

  const carregar = useCallback(async (p = pagina) => {
    const id = ++pedido.current;
    const chave = JSON.stringify([filtros, p]);
    const guardada = cache.current.get(chave);
    setErro(null);
    if (guardada) { mostrar(guardada); setCarregando(false); } else setCarregando(true);
    try {
      const [pag, res, cont] = await Promise.all([
        lerPagina(filtros, p),
        getResumo(),
        filtrado ? contarPorEtapa(filtros) : Promise.resolve(null),
      ]);
      if (cache.current.size > 80) cache.current.clear();
      cache.current.set(chave, pag);
      if (id !== pedido.current) return;
      mostrar(pag);
      setResumo(res);
      setContagens(cont);
    } catch (e) {
      if (id === pedido.current) setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      if (id === pedido.current) setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFiltros, pagina]);

  function mostrar(pag: PaginaLida) {
    setLinhas(pag.r.data);
    setDescricoes(pag.descricoes);
    setTotal(pag.r.total);
    setPagina(pag.r.page);
  }

  /** Depois de gravar ou atualizar à mão: esquece o que estava guardado e lê de novo. */
  function recarregar() {
    cache.current.clear();
    setVersaoCache((v) => v + 1);
    carregar();
  }

  useEffect(() => { carregar(); }, [carregar]);

  // Pré-carrega a 1ª página das outras etapas (mesmos filtros) depois que a atual chegou
  useEffect(() => {
    if (carregando) return;
    let cancelado = false;
    const alvos: (Etapa | 'TODAS')[] = [
      ...ETAPAS_FLUXO, 'TODAS', ...ETAPAS_HISTORICO.filter((e) => (resumo?.etapas[e] ?? 0) > 0),
    ];
    (async () => {
      for (const e of alvos) {
        if (cancelado) return;
        if (e === etapa) continue;
        const f = { ...filtros, etapa: e };
        const chave = JSON.stringify([f, 1]);
        if (cache.current.has(chave)) continue;
        try { cache.current.set(chave, await lerPagina(f, 1)); } catch { /* o clique carrega normalmente */ }
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFiltros, carregando, versaoCache]);

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

  /** Abre a janela da NSIS; "Ver detalhes" já deixa os detalhes da execução abertos. */
  function abrirPainel(servico: string, detalhes: boolean) {
    setDetalhesAbertos(detalhes);
    mudarParam('nsis', servico);
  }

  function trocarEtapa(e: Etapa | 'TODAS') {
    mudarParam('etapa', e);
  }

  function aplicarTextos(e?: FormEvent) {
    e?.preventDefault();
    mudarParams({ q: busca.trim(), loc: localidade.trim(), equipe: equipe.trim() });
  }

  function limparFiltros() {
    const colunasNulas = Object.fromEntries(COLUNAS_FLUXO.map((c) => [`col.${c.id}`, null]));
    mudarParams({ q: null, loc: null, equipe: null, tipo: null, codigo: null, de: null, ate: null, ...colunasNulas });
  }

  function abrirColuna(c: ColunaFluxo) {
    if (COLUNAS_SEM_LISTA.includes(c)) return; // só ordena: não busca milhares de valores
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

  /** Exclui a NSIS da linha (só ADMIN; o banco confere de novo). Pede confirmação e guarda cópia no registro de ações. */
  async function excluirLinha(n: Nsis) {
    if (excluindo) return;
    const itens = n.qtd_itens === 0 ? 'sem códigos lançados' : n.qtd_itens === 1 ? '1 código lançado' : `${n.qtd_itens} códigos lançados`;
    if (!confirm(`Excluir a NSIS ${n.servico} (${itens}) da fila?\n\nOs códigos lançados vão junto. Uma cópia fica guardada no registro de ações.`)) return;
    setExcluindo(n.servico);
    setErro(null);
    try {
      await excluirNsis(n.servico);
      if (aberta === n.servico) mudarParam('nsis', null);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao excluir a NSIS.');
    } finally {
      setExcluindo(null);
    }
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
  if (filtros.localidade) chips.push({ rotulo: <>Localidade <b>{rotuloLocalidade(filtros.localidade)}</b></>, limpar: { loc: null } });
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

  // filtros do painel recolhido (a busca tem o próprio campo)
  const filtrosExtras = chips.length - (filtros.busca ? 1 : 0);

  const campo = 'h-9 px-3 text-sm border border-linha rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sinal/30 focus:border-sinal';

  return (
    <div className="p-4 lg:p-6 space-y-3">
      {/* Barra de ferramentas: ação principal, busca e filtros recolhidos, como na lista de Instalações do Visão de Dono */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setNovaAberta(true)} className="h-10 px-4 rounded-lg bg-[#16a34a] text-white text-sm font-bold flex items-center gap-1.5 hover:bg-[#15803d]">
          <Plus size={15} /> NSIS avulsa
        </button>
        <form onSubmit={aplicarTextos} className="relative flex-1 min-w-[240px] max-w-[560px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aco-claro" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} onBlur={() => aplicarTextos()}
            placeholder="Buscar serviço, NSMP, NSPR, AP, equipe ou texto…" className={`${campo} !h-10 w-full pl-9`} />
        </form>
        <button type="button" onClick={() => setFiltrosAbertos((a) => !a)} aria-expanded={filtrosAbertos}
          className={`h-10 px-3 rounded-lg border text-sm font-semibold flex items-center gap-1.5 ${filtrosAbertos || filtrosExtras > 0 ? 'border-sinal text-sinal bg-sinal-fundo' : 'border-linha bg-white text-aco hover:border-sinal hover:text-sinal'}`}>
          <SlidersHorizontal size={15} /> Filtros
          {filtrosExtras > 0 && <span className="rounded-full bg-sinal text-white text-[11px] font-bold px-1.5">{filtrosExtras}</span>}
        </button>
        <span className="flex-1" />
        <Link to="/fechamento/importar" className="h-10 px-3 rounded-lg border border-linha bg-white text-aco text-sm font-semibold flex items-center gap-1.5 hover:border-sinal hover:text-sinal">
          <FileSpreadsheet size={15} /> Importar relatório
        </Link>
        <button onClick={exportar} disabled={exportando} className="h-10 px-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] text-sm font-bold flex items-center gap-1.5 hover:bg-[#dcfce7] disabled:opacity-50"
          title={filtrado ? 'Exporta só o que está filtrado' : 'Exporta a etapa selecionada'}>
          {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Baixar Excel
        </button>
      </div>

      {filtrosAbertos && (
        <form onSubmit={aplicarTextos} className="bg-white border border-[#e2e8f0] rounded-xl p-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-aco mb-1 flex items-center gap-1"><CalendarRange size={12} /> Data de execução</label>
            <div className="flex items-center gap-1.5">
              <input type="date" value={filtros.de} max={filtros.ate || undefined} onChange={(e) => mudarParam('de', e.target.value)}
                className={`${campo} w-[150px] ${filtros.de ? 'border-sinal' : ''}`} aria-label="Execução de" />
              <span className="text-xs text-aco">até</span>
              <input type="date" value={filtros.ate} min={filtros.de || undefined} onChange={(e) => mudarParam('ate', e.target.value)}
                className={`${campo} w-[150px] ${filtros.ate ? 'border-sinal' : ''}`} aria-label="Execução até" />
              <ListaSuspensa acao rotulo="Atalhos de período" placeholder="Atalhos…" valor="" opcoes={ATALHOS.map((a) => ({ valor: a.id, rotulo: a.nome }))}
                onChange={(id) => {
                  const a = ATALHOS.find((x) => x.id === id);
                  if (a) { const [de, ate] = a.faixa(); mudarParams({ de, ate }); }
                }} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-aco mb-1">Tipo do serviço</label>
            <ListaSuspensa rotulo="Tipo do serviço" valor={filtros.tipo ?? ''} ativo={!!filtros.tipo} className="min-w-[8.5rem]"
              opcoes={[{ valor: '', rotulo: 'Todos' }, ...[...new Set([...tipos, ...(filtros.tipo ? [filtros.tipo] : [])])].map((t) => ({ valor: t, rotulo: t }))]}
              onChange={(v) => mudarParam('tipo', v || null)} />
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
          <span className="flex-1" />
          <button type="button" onClick={recarregar} className="h-9 w-9 flex items-center justify-center border border-linha rounded-lg bg-white text-aco hover:text-sinal" title="Atualizar">
            <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
          </button>
        </form>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
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

      {/* Etapas do fluxo: pílulas com contador, como os filtros da lista de Instalações do Visão de Dono */}
      <div className="flex flex-wrap items-center gap-2">
        {[...ETAPAS_FLUXO, ...ETAPAS_HISTORICO].map((id) => {
          const e = infoEtapa(id);
          const ativa = etapa === e.id;
          const historica = ETAPAS_HISTORICO.includes(e.id);
          const n = contagem(e.id);
          // chips só do histórico somem quando vazios (a menos que sejam a etapa aberta)
          if (ETAPAS_HISTORICO_ESCONDIVEIS.includes(e.id) && !ativa && n === 0) return null;
          return (
            <PilulaEtapa key={e.id} ativa={ativa} rotulo={e.curto} n={n} titulo={historica ? `${e.nome} (histórico)` : e.nome}
              onClick={() => trocarEtapa(e.id)} />
          );
        })}
        <PilulaEtapa ativa={etapa === 'TODAS'} rotulo="Todas" n={totalGeral} titulo="Todas as etapas" onClick={() => trocarEtapa('TODAS')} />
      </div>

      <>
          {erro && <div className="text-sm text-erro bg-erro-fundo border border-red-200 rounded-xl p-3 flex gap-2"><AlertTriangle size={16} />{erro}</div>}

          {/* Tabela: grade estilo Excel, igual à lista de Instalações do Visão de Dono */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#e2e8f0] text-xs text-[#64748b]">
              <b className="text-tinta">{total.toLocaleString('pt-BR')}</b> NSIS
            </div>
            <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[200px]">
              <table className={`grade-nsis w-full border-separate border-spacing-0 text-xs text-left`}>
                <thead>
                  <tr>
                    {colunas.map((id) => {
                      const def = COLUNAS_FLUXO.find((c) => c.id === id)!;
                      const ordemDaColuna = filtros.ordemColuna?.coluna === id ? filtros.ordemColuna.dir : null;
                      const selecionados = filtros.colunas?.[id];
                      return (
                        <th key={id} className={`${def.numero ? 'text-right' : ''} ${id === 'observacao' ? 'min-w-[260px]' : ''}`}>
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
                              arvoreDatas={id === 'termino' || id === 'data_lancamento_sf'}
                              onAbrir={() => abrirColuna(id)}
                              onOrdenar={(dir) => ordenarColuna(id, dir)}
                              onFiltrar={(v) => filtrarColuna(id, v)}
                            />
                          </div>
                        </th>
                      );
                    })}
                    <th className="grade-fixa-cab text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {!carregando && linhas.length === 0 && (
                    <tr className="sem-hover"><td colSpan={colunas.length + 1} className="!py-9 text-center !text-aco-claro !whitespace-normal">
                      <Inbox size={28} className="mx-auto text-aco-claro mb-2" />
                      {etapa === 'A_FECHAR' && !filtrado ? 'Nenhuma NSIS em revisão. Importe o relatório da semana.' : 'Nenhuma NSIS encontrada com esses filtros.'}
                    </td></tr>
                  )}
                  {carregando && linhas.length === 0 && (
                    <tr className="sem-hover"><td colSpan={colunas.length + 1} className="!py-9 text-center !text-aco-claro">
                      <Loader2 size={16} className="animate-spin inline mr-2 align-text-bottom" /> Carregando…
                    </td></tr>
                  )}
                  {linhas.map((n) => (
                    <tr key={n.servico} onClick={() => {
                      // texto selecionado: a pessoa está copiando a célula, não abrindo a NSIS
                      if (window.getSelection()?.toString()) return;
                      abrirPainel(n.servico, false);
                    }}
                      className={`group ${aberta === n.servico ? 'selecionada' : ''}`}>
                      {colunas.map((id) => <Celula key={id} id={id} n={n} descricoes={descricoes[n.servico]} />)}
                      <td className="grade-fixa text-right cursor-default" onClick={(ev) => ev.stopPropagation()}>
                        <AcoesLinha n={n} onAbrir={(detalhes) => abrirPainel(n.servico, detalhes)} onExcluir={() => excluirLinha(n)} excluindo={excluindo === n.servico} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={pagina} totalPages={Math.ceil(total / POR_PAGINA)} totalItems={total}
            pageSize={POR_PAGINA} onPageChange={setPagina} label="NSIS" />
      </>

      {aberta && (
        <PainelNsis key={`${aberta}-${detalhesAbertos}`} servico={aberta} detalhesInicial={detalhesAbertos}
          onFechar={() => mudarParam('nsis', null)} onAlterado={recarregar} />
      )}
      {novaAberta && <ModalNovaNsis onFechar={() => setNovaAberta(false)} onCriada={(s) => { setNovaAberta(false); mudarParam('nsis', s); recarregar(); }} />}
    </div>
  );
}

/** Célula de uma coluna da lista; sem dado mostra —. */
function Celula({ id, n, descricoes }: { id: ColunaFluxo; n: Nsis; descricoes?: string[] }) {
  const vazio = <span className="text-[#94a3b8]">—</span>;
  switch (id) {
    case 'servico': return (
      <td className="font-codigo font-bold text-[#0f2544]">
        <span className="inline-flex items-center gap-1.5">{n.servico}<CopiarNumero valor={n.servico} /></span>
      </td>
    );
    case 'tipo_serv': return <td className="font-bold">{n.tipo_serv}</td>;
    case 'localidade': return <td title={n.localidade ? `Localidade ${n.localidade}` : undefined}>{n.localidade ? rotuloLocalidade(n.localidade) : vazio}</td>;
    case 'nsmps': return <td className="!text-[#7c3aed]"><Numeros valor={n.nsmps} falta={n.qtd_itens > 0 && n.itens_sem_nsmp > 0} /></td>;
    case 'equipes': return <td><Numeros valor={n.equipes} falta={false} /></td>;
    // NSRI: a NSMC é o NSPR (NSIS antigas guardavam só no NSMP)
    case 'nsprs': return <td className="!text-[#15803d]"><Numeros valor={n.nsprs ?? (n.tipo_serv === 'NSRI' ? n.nsmps : null)} falta={n.qtd_itens > 0 && !!n.nsmps && n.itens_sem_nspr > 0} /></td>;
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
      <td className="!whitespace-normal min-w-[260px]">
        {n.observacao
          ? <span className="line-clamp-2">{n.observacao}</span>
          : descricoes?.length
            ? <span className="line-clamp-2">{descricoes.join(' · ')}</span>
            : n.qtd_itens === 0 && <span className="text-pendente text-xs font-semibold">sem observação no GDIS</span>}
      </td>
    );
    case 'etapa': return <td><EtapaChip etapa={n.etapa} curto selo /></td>;
  }
}

/** Botão pequeno ao lado do número do serviço: copia o número sem abrir a janela da NSIS. */
function CopiarNumero({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar(ev: MouseEvent<HTMLButtonElement>) {
    ev.stopPropagation();
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // sem permissão da área de transferência (página sem HTTPS, por exemplo): cópia pelo campo de texto
      const campo = document.createElement('textarea');
      campo.value = valor;
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      document.execCommand('copy');
      campo.remove();
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <button type="button" onClick={copiar} title={copiado ? 'Copiado!' : 'Copiar número do serviço'} aria-label={`Copiar número do serviço ${valor}`}
      className={`inline-flex size-5 items-center justify-center rounded transition-opacity ${copiado ? 'text-concluido opacity-100' : 'text-[#94a3b8] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#f1f5f9] hover:text-[#0f2544]'}`}>
      {copiado ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/** Pílula de filtro de etapa: ativa em azul-marinho, com contador (some quando zero, como no Visão de Dono). */
function PilulaEtapa({ ativa, rotulo, n, titulo, onClick }: { ativa: boolean; rotulo: string; n: number; titulo: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={titulo} aria-pressed={ativa}
      className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors ${ativa ? 'border-[#0f2544] bg-[#0f2544] text-white' : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#cbd5e1] hover:text-[#0f2544]'}`}>
      {rotulo}
      {n > 0 && <span className={`rounded-full px-[7px] py-px text-[11px] font-bold ${ativa ? 'bg-white/25 text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>{n}</span>}
    </button>
  );
}

const BOTAO = 'rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap cursor-pointer';
const BOTAO_SEC = `${BOTAO} border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#cbd5e1] hover:text-[#0f2544]`;
const BOTAO_PRIM = `${BOTAO} bg-[#0f2544] text-white hover:bg-[#1b3a66]`;
const BOTAO_AZUL = `${BOTAO} bg-[#1d4ed8] text-white hover:bg-[#1e40af]`;

/**
 * Grupo de ações da linha, como na lista de Instalações do Visão de Dono: botão secundário "Ver detalhes"
 * e o botão da etapa (o que a pessoa faz agora). Ele abre a janela da NSIS, onde a etapa é preenchida.
 */
function AcoesLinha({ n, onAbrir, onExcluir, excluindo }: { n: Nsis; onAbrir: (detalhes: boolean) => void; onExcluir: () => void; excluindo: boolean }) {
  const { acesso } = useSessao();
  const detalhes = <button type="button" onClick={() => onAbrir(true)} className={BOTAO_SEC}>Ver detalhes</button>;
  const fazer = (rotulo: string, classe: string) => <button type="button" onClick={() => onAbrir(false)} className={classe}>{rotulo}</button>;
  let botoes: ReactNode;
  switch (n.etapa) {
    case 'A_FECHAR': botoes = fazer(ehFluxoNovo(n) ? 'Fechar →' : 'Abrir', BOTAO_PRIM); break;
    case 'AGUARDANDO_NSPR': botoes = <>{detalhes}{fazer('Informar NSPR', BOTAO_AZUL)}</>; break;
    case 'AGUARDANDO_SALESFORCE': botoes = <>{detalhes}{fazer('Informar Salesforce', BOTAO_AZUL)}</>; break;
    case 'AGUARDANDO_APROPRIACAO': botoes = <>{detalhes}{fazer('Informar apropriação', BOTAO_AZUL)}</>; break;
    default: botoes = detalhes;
  }
  return (
    <div className="flex items-center justify-end gap-1.5">
      {botoes}
      {acesso?.papel === 'ADMIN' && (
        <button type="button" onClick={onExcluir} disabled={excluindo} title="Excluir NSIS" aria-label={`Excluir a NSIS ${n.servico}`}
          className="inline-flex size-6 items-center justify-center rounded-md border border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] hover:border-erro hover:bg-erro-fundo hover:text-erro disabled:opacity-50">
          {excluindo ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      )}
    </div>
  );
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
