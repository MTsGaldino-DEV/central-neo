/**
 * lib/fechamento.ts — Manutenção (antigo Fechamento de Notas): notas de NSIS
 *
 * Ciclo de uma NSIS finalizada no GDIS. Fluxo novo (neo_nsis.fluxo_novo = true):
 *   A_FECHAR               → códigos, equipe e NSMP (NSRI: NSMC e valor pago)
 *   AGUARDANDO_NSPR        → NSMP gerada, falta a CEMIG confirmar (NSPR + valor pago); a NSRI pula esta etapa
 *   AGUARDANDO_SALESFORCE  → falta a data de lançamento no Salesforce
 *   AGUARDANDO_APROPRIACAO → lançada, falta a apropriação (AP)
 *   FATURADA ("Concluída") → com a AP registrada
 *   SEM_COBRANCA           → não há o que pedir
 * Só o histórico (fluxo_novo = false) usa AGUARDANDO_NSMP ("Gerar NSMP") e AGUARDANDO_FATURA.
 * A etapa é calculada no banco (view neo_vw_nsis); o fluxo novo usa os campos da NSIS e os itens.
 */
import { supabase } from './supabase';
import { ratearPago, textoFator } from './fechamentoCobranca';
import { normalizarAP } from './fechamentoFormato';
import type { LinhaRelatorioNsis, LinhaHistorico } from './fechamentoPlanilhas';
import type { ColunaFluxo } from './fechamentoFluxo';

export { lerNumero, normalizarAP } from './fechamentoFormato';
export type { LinhaRelatorioNsis, LinhaHistorico, LeituraRelatorio, LeituraHistorico } from './fechamentoPlanilhas';

export type Etapa =
  | 'A_FECHAR'
  | 'AGUARDANDO_NSMP'
  | 'AGUARDANDO_NSPR'
  | 'AGUARDANDO_SALESFORCE'
  | 'AGUARDANDO_APROPRIACAO'
  | 'AGUARDANDO_FATURA'
  | 'FATURADA'
  | 'SEM_COBRANCA';

export const ETAPAS: { id: Etapa; nome: string; curto: string; classe: string; marca: string }[] = [
  { id: 'A_FECHAR', nome: 'A fechar', curto: 'A fechar', classe: 'text-etapa-fechar bg-etapa-fechar-fundo', marca: 'bg-etapa-fechar' },
  { id: 'AGUARDANDO_NSMP', nome: 'Aguardando NSMP', curto: 'Gerar NSMP', classe: 'text-etapa-nsmp bg-etapa-nsmp-fundo', marca: 'bg-etapa-nsmp' },
  { id: 'AGUARDANDO_NSPR', nome: 'Aguardando NSPR', curto: 'Aguard. NSPR', classe: 'text-etapa-nspr bg-etapa-nspr-fundo', marca: 'bg-etapa-nspr' },
  { id: 'AGUARDANDO_SALESFORCE', nome: 'Aguardando Salesforce', curto: 'Aguard. Salesforce', classe: 'text-etapa-salesforce bg-etapa-salesforce-fundo', marca: 'bg-etapa-salesforce' },
  { id: 'AGUARDANDO_APROPRIACAO', nome: 'Aguardando apropriação', curto: 'Aguard. apropriação', classe: 'text-etapa-apropriacao bg-etapa-apropriacao-fundo', marca: 'bg-etapa-apropriacao' },
  { id: 'AGUARDANDO_FATURA', nome: 'Aguardando fatura', curto: 'Aguard. fatura', classe: 'text-etapa-fatura bg-etapa-fatura-fundo', marca: 'bg-etapa-fatura' },
  { id: 'FATURADA', nome: 'Concluída', curto: 'Concluída', classe: 'text-etapa-faturada bg-etapa-faturada-fundo', marca: 'bg-etapa-faturada' },
  { id: 'SEM_COBRANCA', nome: 'Sem cobrança', curto: 'Sem cobrança', classe: 'text-etapa-sem bg-etapa-sem-fundo', marca: 'bg-etapa-sem' },
];

export function infoEtapa(etapa: Etapa) {
  return ETAPAS.find((e) => e.id === etapa) ?? ETAPAS[0];
}

export interface Nsis {
  servico: string;
  /** "Tipo de Serv." do GDIS: NSIS, NSRI, MULTIFUNCIONAL… */
  tipo_serv: string;
  referencia: string | null;
  localidade: string | null;
  endereco: string | null;
  pedido_em: string | null;
  termino: string | null;
  resp: string | null;
  matricula: string | null;
  nome: string | null;
  tempo_deslocamento: string | null;
  tempo_execucao: string | null;
  prazo_legal: string | null;
  observacao: string | null;
  zona: string | null;
  referencia_local: string | null;
  sem_cobranca: boolean;
  motivo_sem_cobranca: string | null;
  origem: 'RELATORIO' | 'HISTORICO' | 'MANUAL';
  importado_em: string;
  atualizado_em: string;
  qtd_itens: number;
  valor_inicial_total: number;
  valor_final_total: number;
  itens_sem_nsmp: number;
  itens_sem_nspr: number;
  itens_sem_fatura: number;
  itens_divergentes: number;
  itens_sem_valor_pago: number;
  nsmps: string | null;
  nsprs: string | null;
  faturas: string | null;
  equipes: string | null;
  etapa: Etapa;
  /** valor da US (R$) vigente na data de execução; null sem data ou sem vigência cadastrada */
  valor_us_reais: number | null;
  valor_inicial_reais_total: number;
  valor_final_reais_total: number;
  /** da tabela localidade → supervisor; null se a localidade não estiver cadastrada */
  supervisor: string | null;
  /** true = NSIS do fluxo novo (NSMP → NSPR → Salesforce → apropriação); false = histórico */
  fluxo_novo: boolean;
  /** supervisor gravado ao informar a equipe (ou à mão); só no fluxo novo */
  supervisor_equipe: string | null;
  /** data de lançamento no Salesforce, YYYY-MM-DD */
  data_lancamento_sf: string | null;
}

/**
 * Uma NSIS segue o fluxo novo quando está marcada no banco ou quando está em "A fechar" sem nenhum item
 * (e sem "sem cobrança"): não há histórico a preservar. Ao salvar a etapa 1 ela é marcada fluxo_novo = true.
 * `qtdItens` permite usar a lista de itens já carregada na janela em vez do total da view.
 */
export function ehFluxoNovo(
  n: Pick<Nsis, 'fluxo_novo' | 'etapa' | 'qtd_itens' | 'sem_cobranca'>,
  qtdItens: number = n.qtd_itens,
): boolean {
  return n.fluxo_novo || (!n.sem_cobranca && n.etapa === 'A_FECHAR' && qtdItens === 0);
}

export interface ItemNsis {
  id: string;
  servico: string;
  descricao: string;
  codigo: string | null;
  /** quantidade executada do código (vãos, árvores, peças…) */
  quantidade: number;
  /** 1,0 urbano e CSC; 1,2 rural ou COD; 1,4 rural e COD */
  fator: number;
  /** valor do código no momento do pedido; acertos posteriores não mudam o item */
  fator_unitario: number | null;
  equipe: string | null;
  valor_inicial: number | null;
  us_adicional: number | null;
  nsmp: string | null;
  nspr: string | null;
  valor_final: number | null;
  fatura: string | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type ItemNsisCampos = Omit<ItemNsis, 'id' | 'servico' | 'criado_em' | 'atualizado_em'>;

// numeric chega do PostgREST como número, mas a view soma em numeric e o
// count em bigint — normalizamos tudo para number.
const NUMERICOS_NSIS = [
  'qtd_itens', 'valor_inicial_total', 'valor_final_total', 'itens_sem_nsmp',
  'itens_sem_nspr', 'itens_sem_fatura', 'itens_divergentes', 'itens_sem_valor_pago',
  'valor_inicial_reais_total', 'valor_final_reais_total',
] as const;

function normalizarNsis(r: Record<string, unknown>): Nsis {
  const n = { ...r } as Record<string, unknown>;
  for (const c of NUMERICOS_NSIS) n[c] = Number(n[c] ?? 0);
  n.valor_us_reais = n.valor_us_reais === null || n.valor_us_reais === undefined ? null : Number(n.valor_us_reais);
  return n as unknown as Nsis;
}

function normalizarItem(r: Record<string, unknown>): ItemNsis {
  const i = { ...r } as Record<string, unknown>;
  for (const c of ['valor_inicial', 'us_adicional', 'valor_final', 'fator_unitario']) {
    i[c] = i[c] === null || i[c] === undefined ? null : Number(i[c]);
  }
  i.quantidade = Number(i.quantidade ?? 1);
  i.fator = Number(i.fator ?? 1);
  return i as unknown as ItemNsis;
}

// ─── Formatação ──────────────────────────────────────────────────────────────

/** Valor em US (unidade de serviço), com vírgula. */
export function formatarUS(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const max = Math.max(casas, (String(v).split('.')[1] ?? '').length);
  // até 3 casas para valores em US; mais só quando pedido (fatores da Tabela 03 têm 4)
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, Math.min(max, 3)) });
}

/** Valor em reais: R$ 1.234,56. */
export function formatarReais(v: number | null | undefined, compacto = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (compacto && Math.abs(v) >= 1000) {
    return 'R$ ' + v.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  }
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** R$ de um valor em US, com o valor da US da data de execução (mesma conta do banco). */
export function emReais(us: number | null | undefined, valorUS: number | null | undefined): number | null {
  if (us === null || us === undefined || valorUS === null || valorUS === undefined) return null;
  return Math.round(us * valorUS * 100) / 100;
}

export function formatarData(iso: string | null | undefined, comHora = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // 00:00 é data sem hora (veio da planilha): não mostra a hora
  if (comHora && d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) === '00:00') comHora = false;
  return d.toLocaleString('pt-BR', comHora
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }
    : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

// ─── Consulta ───────────────────────────────────────────────────────────────

export interface FiltrosNsis {
  etapa?: Etapa | 'TODAS';
  busca?: string;
  localidade?: string;
  /** DIVERGENTE = pago ≠ pedido; SEM_VALOR = tem NSPR mas o valor pago não foi informado. */
  alerta?: 'DIVERGENTE' | 'SEM_VALOR' | null;
  /** data de execução (Término), YYYY-MM-DD, inclusive, no fuso de Brasília */
  de?: string;
  ate?: string;
  equipe?: string;
  /** "Tipo de Serv." do GDIS */
  tipo?: string;
  /** código da Tabela 03 de algum item (vem do painel, "O que mais pedimos") */
  codigo?: string;
  ordem?: 'termino_desc' | 'termino_asc' | 'servico';
  /** filtro por coluna da lista (estilo Excel): valores exatos; '—' = vazio; termino usa dias YYYY-MM-DD */
  colunas?: Partial<Record<ColunaFluxo, string[]>>;
  /** ordem por coluna; substitui a ordem padrão */
  ordemColuna?: { coluna: ColunaFluxo; dir: 'asc' | 'desc' } | null;
}

/** Coluna da lista → coluna da view neo_vw_nsis. */
const COLUNA_VIEW: Record<ColunaFluxo, string> = {
  servico: 'servico', tipo_serv: 'tipo_serv', localidade: 'localidade', termino: 'termino', equipes: 'equipes',
  supervisor: 'supervisor', nsmps: 'nsmps', nsprs: 'nsprs', valor_lancamento: 'valor_inicial_total',
  valor_pago: 'valor_final_total', data_lancamento_sf: 'data_lancamento_sf', faturas: 'faturas',
  observacao: 'observacao', etapa: 'etapa',
};

/** Texto que representa "vazio" na lista de valores de uma coluna. */
export const VALOR_VAZIO = '—';

/** Colunas numéricas: só ordenam, não têm lista de valores. */
const COLUNAS_NUMERICAS: ColunaFluxo[] = ['valor_lancamento', 'valor_pago'];

/** Dia seguinte (YYYY-MM-DD), para o "até" incluir o dia inteiro. */
function diaSeguinte(d: string): string {
  const [a, m, dia] = d.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, dia + 1));
  return x.toISOString().slice(0, 10);
}

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

/** Texto entre aspas para o filtro "or" do PostgREST (vírgula, parênteses e aspas quebram a sintaxe). */
const aspas = (v: string) => `"${v.replace(/[\\"]/g, '\\$&')}"`;

function aplicarFiltros<Q extends { eq: Function; ilike: Function; or: Function; gt: Function; gte: Function; lt: Function; order: Function; in: Function }>(
  query: Q,
  f: FiltrosNsis,
  semOrdem = false
): Q {
  let q = query;
  if (f.etapa && f.etapa !== 'TODAS') q = q.eq('etapa', f.etapa);
  if (f.localidade?.trim()) q = q.ilike('localidade', `${f.localidade.trim()}%`);
  if (f.tipo?.trim()) q = q.eq('tipo_serv', f.tipo.trim());
  if (f.de && DATA_VALIDA.test(f.de)) q = q.gte('termino', `${f.de}T00:00:00-03:00`);
  if (f.ate && DATA_VALIDA.test(f.ate)) q = q.lt('termino', `${diaSeguinte(f.ate)}T00:00:00-03:00`);
  if (f.codigo?.trim()) q = q.ilike('codigos', `%${f.codigo.trim().replace(/[,()%]/g, '')}%`);
  if (f.equipe?.trim()) q = q.ilike('equipes', `%${f.equipe.trim().replace(/[,()%]/g, '')}%`);
  if (f.alerta === 'DIVERGENTE') q = q.gt('itens_divergentes', 0);
  if (f.alerta === 'SEM_VALOR') q = q.gt('itens_sem_valor_pago', 0);
  // vírgula e parênteses quebram a sintaxe do filtro "or" do PostgREST
  const termo = f.busca?.trim().replace(/[,()]/g, ' ').trim();
  if (termo) {
    const p = `%${termo}%`;
    q = q.or(
      [`servico.ilike.${p}`, `observacao.ilike.${p}`, `endereco.ilike.${p}`, `nsmps.ilike.${p}`,
        `nsprs.ilike.${p}`, `faturas.ilike.${p}`, `equipes.ilike.${p}`, `nome.ilike.${p}`, `supervisor.ilike.${p}`].join(',')
    );
  }
  // filtros por coluna: cada coluna aplica .in() (ou .or() quando entra vazio ou dia de execução)
  for (const [coluna, valores] of Object.entries(f.colunas ?? {}) as [ColunaFluxo, string[] | undefined][]) {
    if (!valores?.length || !(coluna in COLUNA_VIEW)) continue;
    const col = COLUNA_VIEW[coluna];
    const vazio = valores.includes(VALOR_VAZIO);
    const reais = valores.filter((v) => v !== VALOR_VAZIO);
    if (coluna === 'termino') {
      const partes = reais.filter((d) => DATA_VALIDA.test(d))
        .map((d) => `and(termino.gte.${d}T00:00:00-03:00,termino.lt.${diaSeguinte(d)}T00:00:00-03:00)`);
      if (vazio) partes.push('termino.is.null');
      if (partes.length) q = q.or(partes.join(','));
    } else if (vazio) {
      // coluna de data não aceita texto vazio
      const partes = [`${col}.is.null`, ...(coluna === 'data_lancamento_sf' ? [] : [`${col}.eq.""`])];
      if (reais.length) partes.push(`${col}.in.(${reais.map(aspas).join(',')})`);
      q = q.or(partes.join(','));
    } else if (reais.length) {
      q = q.in(col, reais);
    }
  }
  if (semOrdem) return q;
  if (f.ordemColuna && f.ordemColuna.coluna in COLUNA_VIEW) {
    const col = COLUNA_VIEW[f.ordemColuna.coluna];
    if (col === 'servico') return q.order('servico', { ascending: f.ordemColuna.dir === 'asc' });
    return q.order(col, { ascending: f.ordemColuna.dir === 'asc', nullsFirst: false }).order('servico', { ascending: true });
  }
  const ordem = f.ordem ?? 'termino_desc';
  if (ordem === 'servico') q = q.order('servico', { ascending: true });
  else q = q.order('termino', { ascending: ordem === 'termino_asc', nullsFirst: false }).order('servico', { ascending: true });
  return q;
}

/** Página da fila de NSIS. Refaz na página 1 se a lista encolheu (PGRST103). */
export async function listarNsis(
  filtros: FiltrosNsis,
  page = 1,
  pageSize = 50
): Promise<{ data: Nsis[]; total: number; page: number }> {
  const consultar = (p: number) => {
    const from = (p - 1) * pageSize;
    return aplicarFiltros(supabase.from('neo_vw_nsis').select('*', { count: 'exact' }), filtros)
      .range(from, from + pageSize - 1);
  };
  let pagina = page;
  let { data, error, count } = await consultar(pagina);
  if (error?.code === 'PGRST103' && pagina !== 1) {
    pagina = 1;
    ({ data, error, count } = await consultar(pagina));
  }
  if (error) throw new Error('Falha ao carregar a fila: ' + error.message);
  return { data: (data ?? []).map(normalizarNsis), total: count ?? 0, page: pagina };
}

/** Algum filtro além da etapa? (aí as contagens por etapa precisam seguir o filtro) */
export function temFiltro(f: FiltrosNsis): boolean {
  const colunas = Object.values(f.colunas ?? {}).some((v) => !!v?.length);
  return !!(f.busca?.trim() || f.localidade?.trim() || f.alerta || f.de || f.ate || f.equipe?.trim() || f.tipo?.trim() || f.codigo?.trim() || colunas);
}

/** Quantas NSIS em cada etapa, respeitando os filtros (menos a etapa). */
export async function contarPorEtapa(f: FiltrosNsis): Promise<{ etapas: Partial<Record<Etapa, number>>; total: number }> {
  const base = { ...f, etapa: 'TODAS' as const };
  const contar = async (etapa: Etapa | 'TODAS') => {
    const { count, error } = await aplicarFiltros(
      supabase.from('neo_vw_nsis').select('servico', { count: 'exact', head: true }), { ...base, etapa }, true
    );
    if (error) throw new Error('Falha ao contar: ' + error.message);
    return count ?? 0;
  };
  const [total, ...porEtapa] = await Promise.all([contar('TODAS'), ...ETAPAS.map((e) => contar(e.id))]);
  return { total, etapas: Object.fromEntries(ETAPAS.map((e, i) => [e.id, porEtapa[i]])) };
}

/** Dia (YYYY-MM-DD, fuso de Brasília) de um instante ISO. */
function diaDe(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Valores distintos de uma coluna da lista para o filtro do cabeçalho. Respeita os outros filtros
 * (inclusive a etapa), menos o da própria coluna. Vazio entra como '—' no fim da lista.
 */
export async function valoresDaColuna(coluna: ColunaFluxo, filtros: FiltrosNsis): Promise<string[]> {
  const col = COLUNA_VIEW[coluna];
  const colunas = { ...(filtros.colunas ?? {}) };
  delete colunas[coluna];
  const base: FiltrosNsis = { ...filtros, colunas, ordemColuna: null };
  const numerica = COLUNAS_NUMERICAS.includes(coluna);

  const vistos = new Set<string>();
  let temVazio = false;
  for (let pagina = 0; pagina < 20; pagina++) {
    const from = pagina * 1000;
    const { data, error } = await aplicarFiltros(supabase.from('neo_vw_nsis').select(col), base, true)
      .order('servico', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error('Falha ao carregar os valores da coluna: ' + error.message);
    const linhas = (data ?? []) as unknown as Record<string, unknown>[];
    for (const l of linhas) {
      const bruto = l[col];
      if (bruto === null || bruto === undefined || bruto === '') { temVazio = true; continue; }
      vistos.add(coluna === 'termino' ? diaDe(String(bruto)) : String(bruto));
    }
    if (linhas.length < 1000) break;
  }
  vistos.delete('');
  const lista = [...vistos].sort((a, b) => numerica
    ? Number(a) - Number(b)
    : a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
  if (temVazio) lista.push(VALOR_VAZIO);
  return lista;
}

/** Tipos de serviço que existem na base (opções do filtro). */
export async function listarTiposServico(): Promise<string[]> {
  const { data, error } = await supabase.rpc('neo_tipos_servico');
  if (error) throw new Error('Falha ao carregar os tipos de serviço: ' + error.message);
  return ((data ?? []) as string[]).filter(Boolean);
}

export interface ResumoFechamento {
  etapas: Partial<Record<Etapa, number>>;
  total: number;
  divergentes: number;
  semValorPago: number;
  valorPedido: number;
  valorPago: number;
  /** Só itens com pedido e pago informados: base do "pago − pedido". */
  valorPedidoConfirmado: number;
  valorPagoConfirmado: number;
  valorPedidoReais: number;
  valorPagoReais: number;
  valorPedidoConfirmadoReais: number;
  valorPagoConfirmadoReais: number;
  /** itens com valor em US sem valor da US cadastrado para a data de execução */
  itensSemValorUS: number;
}

export async function getResumo(): Promise<ResumoFechamento> {
  const { data, error } = await supabase.rpc('neo_resumo_fechamento');
  if (error) throw new Error('Falha ao carregar o resumo: ' + error.message);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    etapas: (r.etapas ?? {}) as Partial<Record<Etapa, number>>,
    total: Number(r.total ?? 0),
    divergentes: Number(r.divergentes ?? 0),
    semValorPago: Number(r.sem_valor_pago ?? 0),
    valorPedido: Number(r.valor_pedido ?? 0),
    valorPago: Number(r.valor_pago ?? 0),
    valorPedidoConfirmado: Number(r.valor_pedido_confirmado ?? 0),
    valorPagoConfirmado: Number(r.valor_pago_confirmado ?? 0),
    valorPedidoReais: Number(r.valor_pedido_reais ?? 0),
    valorPagoReais: Number(r.valor_pago_reais ?? 0),
    valorPedidoConfirmadoReais: Number(r.valor_pedido_confirmado_reais ?? 0),
    valorPagoConfirmadoReais: Number(r.valor_pago_confirmado_reais ?? 0),
    itensSemValorUS: Number(r.itens_sem_valor_us ?? 0),
  };
}

export interface ResumoFatura {
  fatura: string;
  qtd_itens: number;
  qtd_nsis: number;
  valor_pedido: number;
  valor_pago: number;
  divergentes: number;
  sem_valor_pago: number;
  valor_pedido_reais: number;
  valor_pago_reais: number;
}

export async function getResumoFaturas(): Promise<ResumoFatura[]> {
  const { data, error } = await supabase.rpc('neo_resumo_faturas');
  if (error) throw new Error('Falha ao carregar as faturas: ' + error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    fatura: String(r.fatura),
    qtd_itens: Number(r.qtd_itens),
    qtd_nsis: Number(r.qtd_nsis),
    valor_pedido: Number(r.valor_pedido),
    valor_pago: Number(r.valor_pago),
    divergentes: Number(r.divergentes),
    sem_valor_pago: Number(r.sem_valor_pago),
    valor_pedido_reais: Number(r.valor_pedido_reais ?? 0),
    valor_pago_reais: Number(r.valor_pago_reais ?? 0),
  }));
}

export async function getNsis(servico: string): Promise<{ nsis: Nsis; itens: ItemNsis[] }> {
  const [{ data: n, error: e1 }, { data: it, error: e2 }] = await Promise.all([
    supabase.from('neo_vw_nsis').select('*').eq('servico', servico).single(),
    // códigos gravados juntos têm o mesmo criado_em: o código desempata a ordem
    supabase.from('neo_nsis_itens').select('*').eq('servico', servico).order('criado_em', { ascending: true }).order('codigo', { ascending: true }),
  ]);
  if (e1) throw new Error('Falha ao abrir a NSIS: ' + e1.message);
  if (e2) throw new Error('Falha ao carregar os itens: ' + e2.message);
  return { nsis: normalizarNsis(n), itens: (it ?? []).map(normalizarItem) };
}

// ─── Edição ─────────────────────────────────────────────────────────────────

/** Grava todos os códigos do lançamento de uma vez: ou entram todos, ou nenhum. */
export async function criarItens(servico: string, itens: (Partial<ItemNsisCampos> & { descricao: string })[]): Promise<void> {
  const { error } = await supabase.from('neo_nsis_itens').insert(itens.map((campos) => ({ servico, ...campos })));
  if (error) throw new Error('Falha ao salvar o lançamento: ' + error.message);
}

export async function atualizarItem(id: string, patch: Partial<ItemNsisCampos>): Promise<ItemNsis> {
  const { data, error } = await supabase
    .from('neo_nsis_itens')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error('Falha ao salvar o item: ' + error.message);
  return normalizarItem(data);
}

/** A mesma mudança em todos os códigos do lançamento (NSMP, AP). */
export async function atualizarItens(ids: string[], patch: Partial<ItemNsisCampos>): Promise<void> {
  const { data, error } = await supabase.from('neo_nsis_itens').update(patch).in('id', ids).select('id');
  if (error) throw new Error('Falha ao salvar o lançamento: ' + error.message);
  if ((data ?? []).length !== ids.length) throw new Error('Nem todos os códigos do lançamento foram salvos. Recarregue a NSIS e confira.');
}

/** NSPR e valor pago da NSMP inteira; o valor é dividido entre os códigos numa só gravação. */
export async function confirmarPago(itens: ItemNsis[], nspr: string, total: number | null): Promise<void> {
  const partes = ratearPago(itens, total);
  const linhas = itens.map((it, i) => ({ id: it.id, servico: it.servico, descricao: it.descricao, nspr, valor_final: partes[i].valor_final }));
  const { error } = await supabase.from('neo_nsis_itens').upsert(linhas, { onConflict: 'id' });
  if (error) throw new Error('Falha ao salvar a confirmação: ' + error.message);
}

// ─── Fluxo novo da fila ─────────────────────────────────────────────────────

/** Supervisor da frota da equipe (neo_disp_frotas); null se a equipe não for um número de frota conhecida. */
export async function supervisorDaEquipe(equipe: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('neo_supervisor_da_equipe', { p_equipe: equipe.trim() });
  if (error) throw new Error('Falha ao buscar o supervisor da equipe: ' + error.message);
  return (data as string | null) ?? null;
}

function valorPagoValido(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Etapa 1 do fluxo novo: grava os códigos com a mesma equipe e a mesma NSMP (NSRI: a NSMC, mesma coluna)
 * e o supervisor na NSIS, que passa a ser fluxo_novo = true (a NSIS histórica sem itens entra no fluxo novo aqui).
 * Na NSRI o valor pago também entra aqui e é rateado entre os códigos, sem NSPR.
 * Valida tudo antes de gravar qualquer coisa.
 */
export async function fecharEtapa1(
  nsis: Nsis,
  dados: { itens: ItemNsisCampos[]; equipe: string; nsmp: string; supervisor: string | null; valorPagoUS: number | null }
): Promise<void> {
  const equipe = dados.equipe.trim();
  const nsmp = dados.nsmp.trim();
  const nsri = nsis.tipo_serv === 'NSRI';
  if (dados.itens.length < 1) throw new Error('Informe ao menos um código.');
  if (!equipe) throw new Error('Informe o número da equipe.');
  if (!nsmp) throw new Error(nsri ? 'Informe a NSMC.' : 'Informe a NSMP.');
  if (nsri && !valorPagoValido(dados.valorPagoUS)) throw new Error('Informe o valor pago (zero é aceito).');

  const itens = dados.itens.map((it) => ({ ...it, equipe, nsmp }));
  if (nsri) {
    const partes = ratearPago(itens.map((it, i) => ({ id: String(i), valor_inicial: it.valor_inicial })), dados.valorPagoUS);
    partes.forEach((p, i) => { itens[i].valor_final = p.valor_final; });
  }

  // Primeiro a NSIS: marca o fluxo novo e grava o supervisor. Se os itens falharem em seguida (tudo-ou-nada),
  // a NSIS fica sem itens em "A fechar", que é o estado de antes.
  const { error } = await supabase
    .from('neo_nsis')
    .update({ fluxo_novo: true, supervisor_equipe: dados.supervisor?.trim() || null })
    .eq('servico', nsis.servico);
  if (error) throw new Error('Falha ao gravar a equipe e o supervisor: ' + error.message);

  try {
    await criarItens(nsis.servico, itens);
  } catch (e) {
    throw new Error('Falha ao salvar os códigos: ' + (e instanceof Error ? e.message.replace(/^Falha ao salvar o lançamento: /, '') : String(e)));
  }
}

/** Etapa 2 (NSIS que não é NSRI): NSPR e valor pago, em US, para a NSIS inteira. */
export async function informarNspr(itens: ItemNsis[], nspr: string, valorPagoUS: number): Promise<void> {
  const numero = nspr.trim();
  if (!numero) throw new Error('Informe a NSPR.');
  if (!valorPagoValido(valorPagoUS)) throw new Error('Informe o valor pago (zero é aceito).');
  if (itens.length < 1) throw new Error('A NSIS não tem códigos lançados.');
  await confirmarPago(itens, numero, valorPagoUS);
}

/** Etapa 3: data de lançamento no Salesforce (YYYY-MM-DD), não vazia e não futura (fuso de Brasília). */
export async function informarLancamentoSf(servico: string, data: string): Promise<void> {
  const dia = (data ?? '').trim();
  if (!dia) throw new Error('Informe a data de lançamento no Salesforce.');
  const [a, m, d] = dia.split('-').map(Number);
  const real = DATA_VALIDA.test(dia) && new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10) === dia;
  if (!real) throw new Error('Data de lançamento inválida.');
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (dia > hoje) throw new Error('A data de lançamento não pode ser futura.');
  const { error } = await supabase.from('neo_nsis').update({ data_lancamento_sf: dia }).eq('servico', servico);
  if (error) throw new Error('Falha ao salvar a data de lançamento: ' + error.message);
}

/** Etapa 4: apropriação (AP) em todos os códigos da NSIS. */
export async function informarApropriacao(itens: ItemNsis[], ap: string): Promise<void> {
  const numero = normalizarAP(ap);
  if (!numero) throw new Error('Informe a apropriação.');
  if (itens.length < 1) throw new Error('A NSIS não tem códigos lançados.');
  await atualizarItens(itens.map((it) => it.id), { fatura: numero });
}

/** Desfaz a etapa 2: apaga NSPR e valor pago de todos os códigos; a NSIS volta para "Aguardando NSPR". */
export async function desfazerNspr(itens: ItemNsis[]): Promise<void> {
  if (itens.length < 1) return;
  await atualizarItens(itens.map((it) => it.id), { nspr: null, valor_final: null });
}

/** Desfaz a etapa 3: apaga a data de lançamento no Salesforce; a NSIS volta para "Aguardando Salesforce". */
export async function desfazerLancamentoSf(servico: string): Promise<void> {
  const { error } = await supabase.from('neo_nsis').update({ data_lancamento_sf: null }).eq('servico', servico);
  if (error) throw new Error('Falha ao desfazer a data de lançamento: ' + error.message);
}

/** Desfaz a etapa 4: apaga a apropriação (AP) de todos os códigos; a NSIS volta para "Aguardando apropriação". */
export async function desfazerApropriacao(itens: ItemNsis[]): Promise<void> {
  if (itens.length < 1) return;
  await atualizarItens(itens.map((it) => it.id), { fatura: null });
}

/** O que a etapa 1 informa de cada código; NSPR, valor pago e AP não entram aqui. */
export type CamposEtapa1 = Pick<ItemNsisCampos, 'descricao' | 'codigo' | 'quantidade' | 'fator' | 'fator_unitario' | 'valor_inicial'>;

/**
 * Corrige a etapa 1 já salva: itens com `id` são atualizados no lugar (NSPR, valor pago e AP seguem com eles),
 * os que sumiram da lista são excluídos e os novos entram com a NSPR e a AP que a NSIS já tem.
 * O total pago que já existia é redistribuído entre os códigos finais; na NSRI vale o valor pago do formulário.
 */
export async function corrigirEtapa1(
  nsis: Nsis,
  atuais: ItemNsis[],
  dados: { itens: (CamposEtapa1 & { id?: string })[]; equipe: string; nsmp: string; supervisor: string | null; valorPagoUS: number | null }
): Promise<void> {
  const equipe = dados.equipe.trim();
  const nsmp = dados.nsmp.trim();
  const nsri = nsis.tipo_serv === 'NSRI';
  if (dados.itens.length < 1) throw new Error('Informe ao menos um código.');
  if (!equipe) throw new Error('Informe o número da equipe.');
  if (!nsmp) throw new Error(nsri ? 'Informe a NSMC.' : 'Informe a NSMP.');
  if (nsri && !valorPagoValido(dados.valorPagoUS)) throw new Error('Informe o valor pago (zero é aceito).');

  const nspr = atuais.find((it) => it.nspr)?.nspr ?? null;
  const fatura = atuais.find((it) => it.fatura)?.fatura ?? null;
  const totalPago = nsri ? dados.valorPagoUS : atuais.some((it) => it.valor_final !== null)
    ? Math.round(atuais.reduce((s, it) => s + (it.valor_final ?? 0), 0) * 10000) / 10000
    : null;

  const mantidos = new Set(dados.itens.flatMap((it) => (it.id ? [it.id] : [])));
  for (const it of atuais) if (!mantidos.has(it.id)) await excluirItem(it.id);
  const novos: ItemNsisCampos[] = [];
  for (const { id, ...campos } of dados.itens) {
    const comum = { ...campos, equipe, nsmp };
    if (id) await atualizarItem(id, comum);
    else novos.push({ ...comum, nspr, fatura, valor_final: null, us_adicional: null, observacao: null });
  }
  if (novos.length > 0) await criarItens(nsis.servico, novos);

  if (totalPago !== null && (nsri || nspr)) {
    const { data, error } = await supabase.from('neo_nsis_itens').select('*').eq('servico', nsis.servico).order('criado_em', { ascending: true }).order('codigo', { ascending: true });
    if (error) throw new Error('Falha ao recarregar os itens: ' + error.message);
    const finais = (data ?? []).map(normalizarItem);
    const partes = ratearPago(finais, totalPago);
    const linhas = finais.map((it, i) => ({ id: it.id, servico: it.servico, descricao: it.descricao, valor_final: partes[i].valor_final }));
    const { error: e2 } = await supabase.from('neo_nsis_itens').upsert(linhas, { onConflict: 'id' });
    if (e2) throw new Error('Falha ao redistribuir o valor pago: ' + e2.message);
  }

  const { error } = await supabase
    .from('neo_nsis')
    .update({ supervisor_equipe: dados.supervisor?.trim() || null })
    .eq('servico', nsis.servico);
  if (error) throw new Error('Os códigos foram salvos, mas falhou gravar o supervisor: ' + error.message);
}

export async function excluirItem(id: string): Promise<void> {
  const { error } = await supabase.from('neo_nsis_itens').delete().eq('id', id);
  if (error) throw new Error('Falha ao excluir o item: ' + error.message);
}

/** Só ADMIN (a função do banco confere): apaga a NSIS e os itens, guardando uma cópia em neo_nsis_log. */
export async function excluirNsis(servico: string): Promise<void> {
  const { error } = await supabase.rpc('neo_excluir_nsis', { p_servico: servico });
  if (error) throw new Error('Falha ao excluir a NSIS: ' + error.message);
}

/** Etapas do fluxo novo para onde um ADMIN pode voltar uma NSIS, na ordem do fluxo. */
export const ETAPAS_DE_DESTINO: Etapa[] = ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO'];

/** Só ADMIN (a função do banco confere): volta a NSIS do fluxo novo para uma etapa anterior e apaga o que as seguintes informaram. */
export async function moverEtapa(servico: string, etapa: Etapa): Promise<void> {
  const { error } = await supabase.rpc('neo_mover_etapa', { p_servico: servico, p_etapa: etapa });
  if (error) throw new Error('Falha ao mover a etapa: ' + error.message);
}

/** motivo = null reabre a NSIS. */
export async function definirSemCobranca(servico: string, motivo: string | null): Promise<void> {
  const { error } = await supabase
    .from('neo_nsis')
    .update({ sem_cobranca: motivo !== null, motivo_sem_cobranca: motivo })
    .eq('servico', servico);
  if (error) throw new Error('Falha ao atualizar a NSIS: ' + error.message);
}

/** NSIS que não veio em relatório (lançada à mão). */
export async function criarNsisManual(servico: string, observacao: string | null): Promise<void> {
  const { error } = await supabase
    .from('neo_nsis')
    .insert({ servico: servico.trim(), observacao, origem: 'MANUAL' });
  if (error) {
    if (error.code === '23505') throw new Error(`A NSIS ${servico} já está cadastrada.`);
    throw new Error('Falha ao criar a NSIS: ' + error.message);
  }
}

// ─── Importação: relatório "Serviços Executados" do GDIS ────────────────────

/** Quais serviços da lista já estão na base (para mostrar novas × atualizadas antes de importar). */
export async function servicosExistentes(servicos: string[]): Promise<Set<string>> {
  const existentes = new Set<string>();
  for (let i = 0; i < servicos.length; i += 200) {
    const { data, error } = await supabase.from('neo_nsis').select('servico').in('servico', servicos.slice(i, i + 200));
    if (error) throw new Error('Falha ao conferir serviços: ' + error.message);
    (data ?? []).forEach((r) => existentes.add((r as { servico: string }).servico));
  }
  return existentes;
}

export async function importarRelatorioNsis(
  linhas: LinhaRelatorioNsis[],
  onProgresso?: (feitos: number, total: number) => void
): Promise<{ novas: number; atualizadas: number }> {
  const total = { novas: 0, atualizadas: 0 };
  const LOTE = 200;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { data, error } = await supabase.rpc('neo_importar_nsis', { p_itens: linhas.slice(i, i + LOTE) });
    if (error) throw new Error('Falha ao importar: ' + error.message);
    const r = data as { novas: number; atualizadas: number };
    total.novas += r?.novas ?? 0;
    total.atualizadas += r?.atualizadas ?? 0;
    onProgresso?.(Math.min(i + LOTE, linhas.length), linhas.length);
  }
  return total;
}

// ─── Importação: planilha de controle (aba "MANUTENÇÃO - 211 NSIS") ────────

export async function importarHistorico(
  linhas: LinhaHistorico[],
  onProgresso?: (feitos: number, total: number) => void
): Promise<{ nsisCriadas: number; itensCriados: number; itensJaExistentes: number }> {
  const total = { nsisCriadas: 0, itensCriados: 0, itensJaExistentes: 0 };
  const LOTE = 300;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { data, error } = await supabase.rpc('neo_importar_historico', { p_itens: linhas.slice(i, i + LOTE) });
    if (error) throw new Error('Falha ao importar o histórico: ' + error.message);
    const r = data as { nsis_criadas: number; itens_criados: number; itens_ja_existentes: number };
    total.nsisCriadas += r?.nsis_criadas ?? 0;
    total.itensCriados += r?.itens_criados ?? 0;
    total.itensJaExistentes += r?.itens_ja_existentes ?? 0;
    onProgresso?.(Math.min(i + LOTE, linhas.length), linhas.length);
  }
  return total;
}

// ─── Exportação no formato da planilha de controle ──────────────────────────

export async function exportarFechamento(filtros: FiltrosNsis): Promise<void> {
  const nsis: Nsis[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await aplicarFiltros(supabase.from('neo_vw_nsis').select('*'), filtros)
      .range(from, from + 999);
    if (error) throw new Error('Falha ao exportar: ' + error.message);
    nsis.push(...(data ?? []).map(normalizarNsis));
    if ((data ?? []).length < 1000) break;
  }

  const itensPorServico = new Map<string, ItemNsis[]>();
  const servicos = nsis.map((n) => n.servico);
  for (let i = 0; i < servicos.length; i += 200) {
    const { data, error } = await supabase
      .from('neo_nsis_itens')
      .select('*')
      .in('servico', servicos.slice(i, i + 200))
      .order('criado_em', { ascending: true })
      .order('codigo', { ascending: true });
    if (error) throw new Error('Falha ao exportar os itens: ' + error.message);
    for (const it of (data ?? []).map(normalizarItem)) {
      const lista = itensPorServico.get(it.servico) ?? [];
      lista.push(it);
      itensPorServico.set(it.servico, lista);
    }
  }

  const linhas: Record<string, unknown>[] = [];
  for (const n of nsis) {
    const itens = itensPorServico.get(n.servico) ?? [];
    const base = {
      'Serviço': n.servico,
      'Tipo de Serv.': n.tipo_serv,
      'Supervisor': n.supervisor ?? '',
      'Localidade': n.localidade ?? '',
      'DT EXECUÇÃO': formatarData(n.termino),
      'Etapa': infoEtapa(n.etapa).nome,
      'Observação GDIS': n.observacao ?? '',
    };
    if (itens.length === 0) {
      linhas.push({ ...base, 'NSMP': '', 'Nº do equipe': '', 'Código': '', 'Qtd.': '', 'Tipo de Serviço': n.motivo_sem_cobranca ?? '',
        'VALOR INICIAL': '', 'NSPR': '', 'US ADICIONAL': '', 'VALOR FINAL': '', 'APROPRIAÇÃO/FATURA': '',
        'VALOR US (R$)': '', 'VALOR INICIAL (R$)': '', 'VALOR FINAL (R$)': '' });
      continue;
    }
    for (const it of itens) {
      linhas.push({
        ...base,
        'NSMP': it.nsmp ?? '',
        'Nº do equipe': it.equipe ?? '',
        'Código': it.codigo ?? '',
        'Qtd.': it.codigo ? it.quantidade : '',
        'Tipo de Serviço': it.descricao + (it.fator > 1 ? ` (fator ${textoFator(it.fator)})` : ''),
        'VALOR INICIAL': it.valor_inicial ?? '',
        'NSPR': it.nspr ?? '',
        'US ADICIONAL': it.us_adicional ?? '',
        'VALOR FINAL': it.valor_final ?? '',
        'APROPRIAÇÃO/FATURA': it.fatura ?? '',
        'VALOR US (R$)': n.valor_us_reais ?? '',
        'VALOR INICIAL (R$)': emReais(it.valor_inicial, n.valor_us_reais) ?? '',
        'VALOR FINAL (R$)': emReais(it.valor_final, n.valor_us_reais) ?? '',
      });
    }
  }

  const ordem = ['Serviço', 'NSMP', 'Nº do equipe', 'Código', 'Qtd.', 'Tipo de Serviço', 'VALOR INICIAL', 'NSPR', 'US ADICIONAL',
    'VALOR FINAL', 'DT EXECUÇÃO', 'APROPRIAÇÃO/FATURA', 'VALOR US (R$)', 'VALOR INICIAL (R$)', 'VALOR FINAL (R$)',
    'Tipo de Serv.', 'Supervisor', 'Localidade', 'Etapa', 'Observação GDIS'];
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(linhas, { header: ordem });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MANUTENÇÃO - 211 NSIS');
  const hoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `fechamento-nsis-${hoje}.xlsx`);
}
