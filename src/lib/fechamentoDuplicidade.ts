/**
 * lib/fechamentoDuplicidade.ts — NSMP, NSPR e NSMC repetidas em serviços diferentes.
 *
 * Cada número pertence a um só serviço. Comparação exata (após trim), sempre do mesmo tipo:
 *   NSMP = coluna nsmp de serviço que não é NSRI
 *   NSPR = coluna nspr de serviço que não é NSRI
 *   NSMC = coluna nsmp de serviço NSRI (a coluna nspr da NSRI repete a NSMC e não é comparada)
 * Itens do mesmo serviço com o mesmo número são o normal e não contam.
 * Não impede gravar: a fila pinta a linha e os formulários pedem confirmação.
 */
import { supabase } from './supabase';
import type { Nsis } from './fechamento';

export type TipoNumero = 'NSMP' | 'NSPR' | 'NSMC';

export interface Repeticao {
  tipo: TipoNumero;
  numero: string;
  /** os outros serviços com o mesmo número, em ordem */
  servicos: string[];
}

interface ItemLido {
  servico: string;
  nsmp: string | null;
  nspr: string | null;
  neo_nsis: { tipo_serv: string | null } | { tipo_serv: string | null }[] | null;
}

const LOTE = 200;

/** Tipo do número da etapa 1: a NSRI informa a NSMC; as demais, a NSMP. */
export function tipoDaPrimeiraEtapa(tipoServ: string | null | undefined): 'NSMP' | 'NSMC' {
  return tipoServ === 'NSRI' ? 'NSMC' : 'NSMP';
}

const chave = (tipo: TipoNumero, numero: string) => `${tipo}|${numero}`;

function tipoServDoItem(r: ItemLido): string | null {
  const n = Array.isArray(r.neo_nsis) ? r.neo_nsis[0] : r.neo_nsis;
  return n?.tipo_serv ?? null;
}

/** Os números de um item, já com o tipo: NSRI só tem a NSMC. */
function numerosDoItem(r: ItemLido): { tipo: TipoNumero; numero: string }[] {
  const nsmp = r.nsmp?.trim();
  const nspr = r.nspr?.trim();
  if (tipoServDoItem(r) === 'NSRI') return nsmp ? [{ tipo: 'NSMC', numero: nsmp }] : [];
  return [
    ...(nsmp ? [{ tipo: 'NSMP' as const, numero: nsmp }] : []),
    ...(nspr ? [{ tipo: 'NSPR' as const, numero: nspr }] : []),
  ];
}

/** Itens com algum desses números (nsmp em `nsmps` ou nspr em `nsprs`), com o tipo do serviço. */
async function itensComNumeros(nsmps: string[], nsprs: string[]): Promise<ItemLido[]> {
  const pedidos: PromiseLike<{ data: unknown; error: { message: string } | null }>[] = [];
  const buscar = (coluna: 'nsmp' | 'nspr', valores: string[]) => {
    for (let i = 0; i < valores.length; i += LOTE) {
      pedidos.push(
        supabase.from('neo_nsis_itens').select('servico, nsmp, nspr, neo_nsis!inner(tipo_serv)').in(coluna, valores.slice(i, i + LOTE)),
      );
    }
  };
  buscar('nsmp', nsmps);
  buscar('nspr', nsprs);
  const respostas = await Promise.all(pedidos);
  const itens: ItemLido[] = [];
  for (const { data, error } of respostas) {
    if (error) throw new Error('Falha ao conferir números repetidos: ' + error.message);
    itens.push(...((data ?? []) as ItemLido[]));
  }
  return itens;
}

/** Serviços que usam cada número (tipo|número → serviços). */
function servicosPorNumero(itens: ItemLido[]): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const it of itens) {
    for (const { tipo, numero } of numerosDoItem(it)) {
      const k = chave(tipo, numero);
      if (!mapa.has(k)) mapa.set(k, new Set());
      mapa.get(k)!.add(it.servico);
    }
  }
  return mapa;
}

/** Números de uma linha da fila (nsmps/nsprs vêm da view, separados por ", "). */
function numerosDaLinha(n: Nsis): { tipo: TipoNumero; numero: string }[] {
  const separar = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  if (n.tipo_serv === 'NSRI') return separar(n.nsmps).map((numero) => ({ tipo: 'NSMC' as const, numero }));
  return [
    ...separar(n.nsmps).map((numero) => ({ tipo: 'NSMP' as const, numero })),
    ...separar(n.nsprs).map((numero) => ({ tipo: 'NSPR' as const, numero })),
  ];
}

/** Para cada serviço da página, os números que também estão em outro serviço (só os que têm repetição). */
export async function duplicidadesDaPagina(linhas: Nsis[]): Promise<Record<string, Repeticao[]>> {
  const porLinha = linhas.map((n) => ({ servico: n.servico, numeros: numerosDaLinha(n) }));
  const nsmps = new Set<string>();
  const nsprs = new Set<string>();
  for (const { numeros } of porLinha) {
    for (const { tipo, numero } of numeros) (tipo === 'NSPR' ? nsprs : nsmps).add(numero);
  }
  if (nsmps.size === 0 && nsprs.size === 0) return {};

  const mapa = servicosPorNumero(await itensComNumeros([...nsmps], [...nsprs]));
  const resultado: Record<string, Repeticao[]> = {};
  for (const { servico, numeros } of porLinha) {
    const repeticoes: Repeticao[] = [];
    for (const { tipo, numero } of numeros) {
      const outros = [...(mapa.get(chave(tipo, numero)) ?? [])].filter((s) => s !== servico).sort();
      if (outros.length) repeticoes.push({ tipo, numero, servicos: outros });
    }
    if (repeticoes.length) resultado[servico] = repeticoes;
  }
  return resultado;
}

/** Outros serviços (fora `servicoAtual`) que já usam esse número do mesmo tipo. */
export async function outrosServicosCom(tipo: TipoNumero, numero: string, servicoAtual: string): Promise<string[]> {
  const valor = numero.trim();
  if (!valor) return [];
  const itens = await itensComNumeros(tipo === 'NSPR' ? [] : [valor], tipo === 'NSPR' ? [valor] : []);
  const servicos = servicosPorNumero(itens).get(chave(tipo, valor)) ?? new Set<string>();
  return [...servicos].filter((s) => s !== servicoAtual).sort();
}

/** "no serviço 1" / "nos serviços 1, 2 e mais 3" */
export function textoServicos(servicos: string[]): string {
  const mostrados = servicos.slice(0, 5).join(', ');
  const resto = servicos.length - 5;
  return `${servicos.length === 1 ? 'no serviço' : 'nos serviços'} ${mostrados}${resto > 0 ? ` e mais ${resto}` : ''}`;
}

/**
 * Antes de gravar: confere os números e, se algum já está em outro serviço, pergunta se lança mesmo assim.
 * true = pode gravar. Números vazios são ignorados (as validações do formulário cuidam deles).
 */
export async function confirmarSemDuplicidade(
  conferir: { tipo: TipoNumero; numero: string | null | undefined }[],
  servicoAtual: string,
): Promise<boolean> {
  const avisos: string[] = [];
  for (const { tipo, numero } of conferir) {
    const valor = numero?.trim();
    if (!valor) continue;
    const outros = await outrosServicosCom(tipo, valor, servicoAtual);
    if (outros.length) avisos.push(`A ${tipo} ${valor} já existe ${textoServicos(outros)}.`);
  }
  if (avisos.length === 0) return true;
  return confirm(`${avisos.join('\n')}\n\nCada número deve pertencer a um só serviço. Lançar mesmo assim?`);
}
