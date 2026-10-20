/**
 * lib/contrato.ts — Tabela de valores do contrato CEMIG (Anexo VI, Tabela 03)
 *
 * Regras que entram no cálculo do valor pedido (notas da Tabela 03):
 *   - valor = soma dos fatores das atividades executadas (fator × quantidade)
 *   - substituição = 1 retirada + 1 instalação
 *   - área rural = +20%
 */
import { supabase } from './supabase';

export interface CodigoContrato {
  codigo: string;
  tabela: string;
  operacao: string;
  atividade: string;
  unidade: string | null;
  descricao: string | null;
  fator_original: number | null;
  fator_us: number;
  ativo: boolean;
  atualizado_em: string;
  acertado: boolean;
  qtd_usos: number;
  ultimo_acerto: string | null;
}

export interface AcertoContrato {
  id: string;
  codigo: string;
  fator_anterior: number | null;
  fator_novo: number | null;
  motivo: string | null;
  alterado_em: string;
  alterado_por_nome: string | null;
}

export const ACRESCIMO_RURAL = 1.2;

function normalizar(r: Record<string, unknown>): CodigoContrato {
  return {
    ...(r as unknown as CodigoContrato),
    fator_original: r.fator_original === null ? null : Number(r.fator_original),
    fator_us: Number(r.fator_us),
    qtd_usos: Number(r.qtd_usos ?? 0),
  };
}

/** Os 155 códigos cabem numa consulta; guardamos em memória durante a sessão. */
let cache: Promise<CodigoContrato[]> | null = null;

export function listarContrato(forcar = false): Promise<CodigoContrato[]> {
  if (!cache || forcar) {
    cache = (async () => {
      const { data, error } = await supabase
        .from('neo_vw_contrato_itens')
        .select('*')
        .order('codigo', { ascending: true });
      if (error) {
        cache = null;
        throw new Error('Falha ao carregar a tabela de valores: ' + error.message);
      }
      return (data ?? []).map(normalizar);
    })();
  }
  return cache;
}

/** Valor pedido para um código: fator × quantidade, +20% se rural. */
export function calcularValor(fator: number, quantidade: number, rural: boolean): number {
  const v = fator * quantidade * (rural ? ACRESCIMO_RURAL : 1);
  return Math.round(v * 10000) / 10000;
}

/** Para uma instalação, a retirada da mesma atividade (substituição = retirada + instalação). */
export function retiradaPar(codigo: CodigoContrato, lista: CodigoContrato[]): CodigoContrato | null {
  if (codigo.operacao !== 'Instalar') return null;
  return lista.find((c) => c.operacao === 'Retirar' && c.atividade === codigo.atividade && c.ativo) ?? null;
}

/** Busca por código ou por qualquer palavra da atividade/descrição. */
export function filtrarCodigos(lista: CodigoContrato[], termo: string): CodigoContrato[] {
  const t = termo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  if (!t) return lista;
  const palavras = t.split(/\s+/);
  return lista.filter((c) => {
    const alvo = `${c.codigo} ${c.operacao} ${c.atividade} ${c.descricao ?? ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    return palavras.every((p) => alvo.includes(p));
  });
}

export async function acertarFator(codigo: string, fator: number, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('neo_acertar_fator', { p_codigo: codigo, p_fator: fator, p_motivo: motivo });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function definirAtivo(codigo: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('neo_contrato_itens').update({ ativo }).eq('codigo', codigo);
  if (error) throw new Error('Falha ao atualizar o código: ' + error.message);
  cache = null;
}

/** Código que não está na Tabela 03 publicada (aditivo, código novo da CEMIG). */
export async function criarCodigo(c: {
  codigo: string; operacao: string; atividade: string; unidade: string | null; descricao: string | null; fator_us: number;
}): Promise<void> {
  const { error } = await supabase.from('neo_contrato_itens').insert({ ...c, fator_original: null });
  if (error) {
    if (error.code === '23505') throw new Error(`O código ${c.codigo} já existe.`);
    throw new Error('Falha ao criar o código: ' + error.message);
  }
  cache = null;
}

export async function getHistorico(codigo: string): Promise<AcertoContrato[]> {
  const { data, error } = await supabase
    .from('neo_contrato_historico')
    .select('id, codigo, fator_anterior, fator_novo, motivo, alterado_em, alterado_por')
    .eq('codigo', codigo)
    .order('alterado_em', { ascending: false });
  if (error) throw new Error('Falha ao carregar o histórico: ' + error.message);
  const linhas = (data ?? []) as (Omit<AcertoContrato, 'alterado_por_nome'> & { alterado_por: string | null })[];

  // nome de quem acertou (o cadastro completo, com CPF, só o ADMIN lê)
  const ids = [...new Set(linhas.map((l) => l.alterado_por).filter(Boolean))] as string[];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await supabase.rpc('neo_nomes_usuarios', { p_ids: ids });
    ((perfis ?? []) as { id: string; nome: string }[]).forEach((p) => nomes.set(p.id, p.nome));
  }
  return linhas.map((l) => ({
    id: l.id,
    codigo: l.codigo,
    fator_anterior: l.fator_anterior === null ? null : Number(l.fator_anterior),
    fator_novo: l.fator_novo === null ? null : Number(l.fator_novo),
    motivo: l.motivo,
    alterado_em: l.alterado_em,
    alterado_por_nome: l.alterado_por ? nomes.get(l.alterado_por) ?? null : null,
  }));
}
