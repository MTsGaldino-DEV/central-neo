// Estado da lista da Conferência guardado na URL (voltar, recarregar e compartilhar o link),
// e a tradução para os filtros do banco. Sem React, para testar em Node.
import type { ColunaFiltroFat, FiltrosListaFat } from './faturamentoServicos';

export type AtalhoConferencia = 'a_menos' | 'a_mais' | 'fora' | 'confere' | 'conferidos' | 'todos';
export const ATALHOS_CONFERENCIA: AtalhoConferencia[] = ['todos', 'a_menos', 'a_mais', 'fora', 'confere', 'conferidos'];
export type ChaveListaFat = 'situacoes' | 'tipos_serv' | 'codigos' | 'frotas' | 'tipos_turma' | 'cidades' | 'motivos';
export type BotaoFat = 'tem_1ns' | 'multado' | 'tem_562';
export type ChaveFaixaFat = 'pago' | 'devido' | 'diferenca' | 'multa';
type ColunaOrdemFat = 'situacao' | 'numserv' | 'tipo_serv' | 'codigos' | 'numvei' | 'tipo_turma' | 'cidade' | 'pago_comparado' | 'devido' | 'diferenca' | 'multas' | 'motivo';

export interface ColunaConferencia {
  id: ColunaOrdemFat; rotulo: string; numero?: boolean;
  /** filtro de lista (valores com contagem do banco) */
  lista?: { chave: ChaveListaFat; coluna: ColunaFiltroFat };
  /** filtro de faixa (maior que / menor que / entre), em US */
  faixa?: ChaveFaixaFat;
  /** busca por parte do texto */
  busca?: boolean;
}
export const COLUNAS_CONFERENCIA: ColunaConferencia[] = [
  { id: 'situacao', rotulo: 'Situação', lista: { chave: 'situacoes', coluna: 'situacao' } },
  { id: 'numserv', rotulo: 'Nº serviço', busca: true },
  { id: 'tipo_serv', rotulo: 'Tipo serv.', lista: { chave: 'tipos_serv', coluna: 'tipo_serv' } },
  { id: 'codigos', rotulo: 'Códigos', lista: { chave: 'codigos', coluna: 'codigos' } },
  { id: 'numvei', rotulo: 'Frota', lista: { chave: 'frotas', coluna: 'numvei' } },
  { id: 'tipo_turma', rotulo: 'Tipo frota', lista: { chave: 'tipos_turma', coluna: 'tipo_turma' } },
  { id: 'cidade', rotulo: 'Cidade', lista: { chave: 'cidades', coluna: 'cidade' } },
  { id: 'pago_comparado', rotulo: 'Pago', numero: true, faixa: 'pago' },
  { id: 'devido', rotulo: 'Devido', numero: true, faixa: 'devido' },
  { id: 'diferenca', rotulo: 'Diferença', numero: true, faixa: 'diferenca' },
  { id: 'multas', rotulo: 'Multa', numero: true, faixa: 'multa' },
  { id: 'motivo', rotulo: 'Motivo', lista: { chave: 'motivos', coluna: 'motivo' } },
];
const LISTAS = COLUNAS_CONFERENCIA.flatMap(c => c.lista ? [c.lista.chave] : []);
const FAIXAS = COLUNAS_CONFERENCIA.flatMap(c => c.faixa ? [c.faixa] : []);
const BOTOES: BotaoFat[] = ['tem_1ns', 'multado', 'tem_562'];
const ORDENS = COLUNAS_CONFERENCIA.map(c => c.id) as string[];

export interface EstadoConferencia {
  fatura: string | null;
  atalho: AtalhoConferencia;
  listas: Partial<Record<ChaveListaFat, string[]>>;
  botoes: Partial<Record<BotaoFat, 'sim' | 'nao'>>;
  faixas: Partial<Record<`${ChaveFaixaFat}_${'min' | 'max'}`, number>>;
  q: string | null;
  /** código principal (link "Por código" do Painel) */
  principal: string | null;
  ordem: { coluna: ColunaOrdemFat; dir: 'asc' | 'desc' } | null;
  pagina: number;
}

/** Número digitado no filtro: aceita "0,5", "1.234,56" e também "0.5". */
export function lerNumeroBr(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : undefined;
}

// Chaves da Conferência da rodada 1 (links salvos e o redirecionamento de /faturamento?situacao=).
const ANTIGAS = ['lado', 'visao', 'motivo', 'situacao', 'cidade', 'codserv', 'tipo_turma', 'tipo_serv'];
const SITUACAO_ATALHO: Record<string, AtalhoConferencia> = { FORA_CONTRATO: 'fora', CONFERIDO: 'conferidos', OK: 'confere' };

export function estadoDaUrl(p: URLSearchParams): EstadoConferencia {
  const atalho = p.get('atalho') as AtalhoConferencia | null;
  const situacaoAntiga = p.get('situacao');
  const atalhoAntigo: AtalhoConferencia = situacaoAntiga && SITUACAO_ATALHO[situacaoAntiga] ? SITUACAO_ATALHO[situacaoAntiga]
    : p.get('lado') === 'a_mais' ? 'a_mais' : p.get('visao') === 'todos' || situacaoAntiga ? 'todos' : 'a_menos';
  const e: EstadoConferencia = { fatura: p.get('fatura') || null, atalho: atalho && ATALHOS_CONFERENCIA.includes(atalho) ? atalho : atalhoAntigo,
    listas: {}, botoes: {}, faixas: {}, q: p.get('q')?.trim() || null, principal: p.get('codigo_principal')?.trim() || null, ordem: null, pagina: Math.max(Math.floor(Number(p.get('pagina'))) || 1, 1) };
  for (const k of LISTAS) { const v = p.getAll(k).filter(Boolean); if (v.length) e.listas[k] = v; }
  const antiga = (de: string, para: ChaveListaFat) => { const v = p.get(de)?.trim(); if (v && !e.listas[para]) e.listas[para] = [v]; };
  if (situacaoAntiga && !SITUACAO_ATALHO[situacaoAntiga]) antiga('situacao', 'situacoes');
  antiga('motivo', 'motivos'); antiga('cidade', 'cidades'); antiga('codserv', 'codigos'); antiga('tipo_turma', 'tipos_turma'); antiga('tipo_serv', 'tipos_serv');
  for (const k of BOTOES) { const v = p.get(k); if (v === 'sim' || v === 'nao') e.botoes[k] = v; }
  for (const f of FAIXAS) for (const lim of ['min', 'max'] as const) {
    const bruto = p.get(`${f}_${lim}`), n = bruto == null || bruto === '' ? NaN : Number(bruto);
    if (Number.isFinite(n)) e.faixas[`${f}_${lim}`] = n;
  }
  const [coluna, dir] = (p.get('ordem') ?? '').split('.');
  if (ORDENS.includes(coluna) && (dir === 'asc' || dir === 'desc')) e.ordem = { coluna: coluna as ColunaOrdemFat, dir };
  return e;
}

export function urlDoEstado(e: EstadoConferencia, base: URLSearchParams): URLSearchParams {
  const q = new URLSearchParams(base);
  for (const k of [...ANTIGAS, 'fatura', 'atalho', 'q', 'codigo_principal', 'ordem', 'pagina', ...LISTAS, ...BOTOES, ...FAIXAS.flatMap(f => [`${f}_min`, `${f}_max`])]) q.delete(k);
  if (e.fatura) q.set('fatura', e.fatura);
  if (e.atalho !== 'a_menos') q.set('atalho', e.atalho);
  for (const [k, v] of Object.entries(e.listas)) for (const x of v ?? []) q.append(k, x);
  for (const [k, v] of Object.entries(e.botoes)) if (v) q.set(k, v);
  for (const [k, v] of Object.entries(e.faixas)) if (v != null) q.set(k, String(v));
  if (e.q) q.set('q', e.q);
  if (e.principal) q.set('codigo_principal', e.principal);
  if (e.ordem) q.set('ordem', `${e.ordem.coluna}.${e.ordem.dir}`);
  if (e.pagina > 1) q.set('pagina', String(e.pagina));
  return q;
}

/** O que vai para `neo_fat_servicos_listar` e `neo_fat_servicos_valores`. */
export function filtrosDoEstado(e: EstadoConferencia): FiltrosListaFat {
  const f: FiltrosListaFat = {};
  if (e.fatura) f.fatura = e.fatura;
  f.lado = e.atalho === 'a_menos' || e.atalho === 'a_mais' ? e.atalho : 'todos';
  for (const [k, v] of Object.entries(e.listas)) if (v?.length) f[k] = v;
  if (e.atalho === 'fora') f.situacoes = ['FORA_CONTRATO'];
  if (e.atalho === 'confere') f.situacoes = ['OK'];
  if (e.atalho === 'conferidos') { f.situacoes = ['CONFERIDO']; f.conferidos = 'somente'; }
  for (const [k, v] of Object.entries(e.botoes)) if (v) f[k] = v;
  for (const [k, v] of Object.entries(e.faixas)) if (v != null) f[k] = v;
  if (e.q) f.q = e.q;
  if (e.principal) f.codigo_principal = e.principal;
  if (e.ordem) f.ordem = e.ordem;
  return f;
}

/** Quantos filtros de coluna/botão estão ligados (para "Limpar todos"). */
export const filtrosAtivos = (e: EstadoConferencia) =>
  Object.keys(e.listas).length + Object.keys(e.botoes).length + Object.keys(e.faixas).length + (e.q ? 1 : 0) + (e.principal ? 1 : 0);
