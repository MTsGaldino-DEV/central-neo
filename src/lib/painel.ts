/**
 * lib/painel.ts — Painel de gestão do fechamento de NSIS
 *
 * Tudo vem de uma RPC (neo_painel_fechamento). O período filtra pela data de
 * execução (Término); a parte "pendente" é sempre a foto de hoje.
 * Valores em R$ = US × valor da US vigente na data de execução (neo_valor_us).
 */
import { supabase } from './supabase';
import type { Etapa } from './fechamento';

export interface Par { us: number; reais: number }

export interface PainelTotais {
  nsis: number;
  semCobranca: number;
  faturadas: number;
  itens: number;
  pedido: Par;
  pago: Par;
  /** NSMP gerada, aguardando a CEMIG confirmar (NSPR) */
  aguardando: Par;
  /** item lançado sem NSMP ainda */
  aPedir: Par;
  pedidoConfirmado: Par;
  pagoConfirmado: Par;
  itensSemValorUS: number;
}

export interface PainelMes {
  mes: string; // YYYY-MM
  nsis: number;
  semCobranca: number;
  faturadas: number;
  pedido: Par;
  pago: Par;
}

export interface PainelEtapa { etapa: Etapa; nsis: number; valor: Par }
export interface PainelPendente { etapa: Etapa; faixa: string; nsis: number; valor: Par }
export interface PainelLocalidade { localidade: string; nsis: number; pedido: Par; pago: Par }
export interface PainelServico { codigo: string | null; descricao: string; itens: number; pedido: Par }
export interface PainelEquipe { equipe: string; nsis: number; itens: number; pedido: Par }

export interface Painel {
  totais: PainelTotais;
  meses: PainelMes[];
  etapas: PainelEtapa[];
  pendentes: PainelPendente[];
  localidades: PainelLocalidade[];
  servicos: PainelServico[];
  equipes: PainelEquipe[];
  qualidade: { semData: number; dataFutura: number; primeiraVigencia: string | null };
  periodoDisponivel: { inicio: string | null; fim: string | null };
}

export const FAIXAS_IDADE = ['0–30 dias', '31–60 dias', '61–90 dias', '91–180 dias', 'mais de 180 dias', 'sem data'];

type Bruto = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);
const par = (r: Bruto, base: string): Par => ({ us: n(r[`${base}_us`]), reais: n(r[`${base}_reais`]) });

export async function getPainel(inicio: string, fim: string): Promise<Painel> {
  const { data, error } = await supabase.rpc('neo_painel_fechamento', { p_inicio: inicio, p_fim: fim });
  if (error) throw new Error('Falha ao carregar o painel: ' + error.message);
  const d = (data ?? {}) as Bruto;
  const t = (d.totais ?? {}) as Bruto;
  const lista = (k: string) => (d[k] ?? []) as Bruto[];
  const q = (d.qualidade ?? {}) as Bruto;
  const p = (d.periodo_disponivel ?? {}) as Bruto;

  return {
    totais: {
      nsis: n(t.nsis),
      semCobranca: n(t.sem_cobranca),
      faturadas: n(t.faturadas),
      itens: n(t.itens),
      pedido: par(t, 'pedido'),
      pago: par(t, 'pago'),
      aguardando: par(t, 'aguardando'),
      aPedir: par(t, 'a_pedir'),
      pedidoConfirmado: par(t, 'pedido_confirmado'),
      pagoConfirmado: par(t, 'pago_confirmado'),
      itensSemValorUS: n(t.itens_sem_valor_us),
    },
    meses: lista('meses').map((m) => ({
      mes: String(m.mes),
      nsis: n(m.nsis),
      semCobranca: n(m.sem_cobranca),
      faturadas: n(m.faturadas),
      pedido: par(m, 'pedido'),
      pago: par(m, 'pago'),
    })),
    etapas: lista('etapas').map((e) => ({
      etapa: e.etapa as Etapa, nsis: n(e.nsis), valor: { us: n(e.valor_us), reais: n(e.valor_reais) },
    })),
    pendentes: lista('pendentes').map((e) => ({
      etapa: e.etapa as Etapa, faixa: String(e.faixa), nsis: n(e.nsis), valor: { us: n(e.valor_us), reais: n(e.valor_reais) },
    })),
    localidades: lista('localidades').map((l) => ({
      localidade: String(l.localidade), nsis: n(l.nsis), pedido: par(l, 'pedido'), pago: par(l, 'pago'),
    })),
    servicos: lista('servicos').map((s) => ({
      codigo: (s.codigo as string | null) ?? null, descricao: String(s.descricao ?? ''), itens: n(s.itens), pedido: par(s, 'pedido'),
    })),
    equipes: lista('equipes').map((e) => ({
      equipe: String(e.equipe), nsis: n(e.nsis), itens: n(e.itens), pedido: par(e, 'pedido'),
    })),
    qualidade: {
      semData: n(q.sem_data),
      dataFutura: n(q.data_futura),
      primeiraVigencia: (q.primeira_vigencia as string | null) ?? null,
    },
    periodoDisponivel: { inicio: (p.inicio as string | null) ?? null, fim: (p.fim as string | null) ?? null },
  };
}

// ─── Valor da US em reais (apostilamento) ───────────────────────────────────

export interface ValorUS {
  vigencia_inicio: string; // YYYY-MM-DD
  valor_reais: number;
  descricao: string | null;
  atualizado_em: string;
}

export async function listarValoresUS(): Promise<ValorUS[]> {
  const { data, error } = await supabase
    .from('neo_valor_us')
    .select('vigencia_inicio, valor_reais, descricao, atualizado_em')
    .order('vigencia_inicio', { ascending: false });
  if (error) throw new Error('Falha ao carregar o valor da US: ' + error.message);
  return (data ?? []).map((r) => ({ ...(r as ValorUS), valor_reais: Number((r as ValorUS).valor_reais) }));
}

/** Cria ou altera a vigência. `anterior` = data original, quando a data foi mudada na edição. */
export async function salvarValorUS(v: { vigencia_inicio: string; valor_reais: number; descricao: string | null }, anterior?: string): Promise<void> {
  if (anterior && anterior !== v.vigencia_inicio) {
    const { error } = await supabase.from('neo_valor_us').update(v).eq('vigencia_inicio', anterior);
    if (error) throw new Error(error.code === '23505' ? 'Já existe um valor com essa data de início.' : 'Falha ao salvar: ' + error.message);
    return;
  }
  const { error } = await supabase.from('neo_valor_us').upsert(v, { onConflict: 'vigencia_inicio' });
  if (error) throw new Error('Falha ao salvar: ' + error.message);
}

export async function excluirValorUS(vigencia: string): Promise<void> {
  const { error } = await supabase.from('neo_valor_us').delete().eq('vigencia_inicio', vigencia);
  if (error) throw new Error('Falha ao excluir: ' + error.message);
}
