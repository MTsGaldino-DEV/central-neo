// Conferência por serviço: consultas ao banco e exportação para negociação.
import { supabase } from './supabase';
import { TIPOS_TURMA_FAT } from './faturamentoPlanilhas';
import { fraseServico, MOTIVOS_FAT } from './faturamentoTexto';

export type SituacaoServicoFat = 'OK'|'A_MENOS'|'A_MAIS'|'FORA_CONTRATO'|'CONFERIDO';
export interface ServicoFat {
  fatura:string; numserv:string; qtd_linhas:number; codigos:string[]; codigo_principal:string|null;
  tipo_serv:string; tabela:string|null; cidade:string|null; tipo_turma:string|null; numvei:string|null; ident_turma:string|null;
  creditado:number; pago_comparado:number; multas:number; estorno:number; devido:number|null;
  fator_aplicado:string|null; moto:boolean|null; bate:boolean; parcial:boolean; rc_por_atendimento:boolean; diferenca:number|null;
  situacao:SituacaoServicoFat; motivo:string|null; observacao_manual:string|null; conferido_por:string|null; conferido_em:string|null;
  revisao_desatualizada:boolean; situacao_calculo:Exclude<SituacaoServicoFat,'CONFERIDO'>; contexto:unknown[];
  tem_1ns:boolean; tem_562:boolean; multado:boolean; na_manutencao:boolean; manutencao_com_valor:boolean;
  /** Pago = devido × 1,2 (ACIMA) ou ÷ 1,2 (ABAIXO): fator rural/COD trocado. */
  fator_12?:'ACIMA'|'ABAIXO'|null;
}
export interface LinhaServicoFat {
  id:string; codserv:string; tipo_serv:string; tabela:string|null; urbano:number; rural:number; creditado:number; glosa:number;
  devido_csc:number|null; devido_cod:number|null; moto_csc:number|null; moto_cod:number|null; justificativa:string|null; observacoes:string;
  /** Despacho pela lista do COD; área pela Fatura Completa; horas/US-h/multiplicador só no homem-hora. */
  despacho?:'CSC'|'COD'; area?:'URBANO'|'RURAL'|null; horas?:number|null; us_hora?:number|null; multiplicador?:number|null;
}
export type LadoFat = 'a_menos'|'a_mais'|'todos';
export interface LadoResumoFat { us:number; servicos:number; por_motivo:Record<string,{us:number;servicos:number}> }
export interface LadosFat { a_menos:LadoResumoFat; a_mais:LadoResumoFat }
export interface GrupoTotaisFat { valor:string|null; servicos:number; creditado:number; devido:number|null; multas:number; saldo?:number }
export interface TotaisFat {
  fatura:string; inicio:string; fim:string; importado_em:string; calculado_em?:string;
  linhas:number; servicos:number; creditado:number; pago_com_fator:number; multas:number; estorno:number; devido:number; diferenca:number;
  sem_fator_servicos:number; parciais:number; saldo_a_receber:number; pago_a_mais:number;
  a_menos:{servicos:number; us:number; pago:number; devido:number; com_1ns:number; por_motivo:Record<string,{us:number;servicos:number}>};
  a_mais:{servicos:number; us:number; pago:number; devido:number; c562:{servicos:number; us:number}; por_motivo:Record<string,{us:number;servicos:number}>};
  fora_contrato:number;
  funil:{importados:number; equipe_identificada:number; codigo_no_contrato:number; valor_confere:number; conferidos:number};
  grupos:{tipo_turma:GrupoTotaisFat[]; codserv:GrupoTotaisFat[]; cidade:GrupoTotaisFat[]};
  ajustes:{debito:number; credito:number; itens:{tipo:string; observacao:string; valor:number}[]};
}

/** Filtros da lista: texto, listas (estilo Excel), faixas numéricas e a ordem. */
export type FiltrosListaFat = Record<string, string | string[] | number | { coluna: string; dir: 'asc' | 'desc' }>;
export type ColunaFiltroFat = 'situacao'|'tipo_serv'|'codigos'|'numvei'|'tipo_turma'|'cidade'|'motivo';
export interface ItemManutencaoFat { codigo:string|null; operacao:string|null; atividade:string|null; descricao:string|null; quantidade:number; valor:number }
export interface EventoFat { tipo:'IMPORTADA'|'CONFERIDO'|'DESCONFERIDO'; observacao:string|null; usuario_nome:string|null; data:string }

export async function listarServicosFat(filtros: FiltrosListaFat, pagina: number, limite = 50): Promise<{total:number; soma?:number; servicos:ServicoFat[]; lados:LadosFat}> {
  const { data, error } = await supabase.rpc('neo_fat_servicos_listar', { p_filtros: filtros, p_offset: pagina * limite, p_limite: limite });
  if (error) throw error;
  return data;
}
/** Valores de uma coluna com a contagem, respeitando os outros filtros (como o filtro do Excel). */
export async function valoresColunaFat(filtros: FiltrosListaFat, coluna: ColunaFiltroFat, busca?: string): Promise<{valor:string|null; n:number}[]> {
  const { data, error } = await supabase.rpc('neo_fat_servicos_valores', { p_filtros: filtros, p_coluna: coluna, p_busca: busca || null });
  if (error) throw error;
  return data ?? [];
}
/** O que a Manutenção (antigo Fechamento de Notas) tem lançado para o serviço; não entra na soma. */
export async function manutencaoServicoFat(numserv: string): Promise<{existe:boolean; itens:ItemManutencaoFat[]}> {
  const { data, error } = await supabase.rpc('neo_fat_servico_manutencao', { p_numserv: numserv });
  if (error) throw error;
  return { existe: !!data?.existe, itens: (data?.itens ?? []).map((i: ItemManutencaoFat) => ({ ...i, quantidade: Number(i.quantidade), valor: Number(i.valor) })) };
}
export async function historicoServicoFat(fatura: string, numserv: string): Promise<EventoFat[]> {
  const { data, error } = await supabase.rpc('neo_fat_servico_historico', { p_fatura: fatura, p_numserv: numserv });
  if (error) throw error;
  return data ?? [];
}
/** Valor da US mais recente do apostilamento; null se não houver. */
export async function valorUsFat(): Promise<{valor:number; vigencia:string} | null> {
  const { data, error } = await supabase.rpc('neo_fat_valor_us');
  if (error) throw error;
  return data ? { valor: Number(data.valor), vigencia: String(data.vigencia) } : null;
}
export async function avaliarDocFat(pagina: string, util: boolean): Promise<void> {
  const { error } = await supabase.rpc('neo_doc_avaliar', { p_pagina: pagina, p_util: util });
  if (error) throw error;
}
export async function linhasServicoFat(fatura: string, numserv: string): Promise<LinhaServicoFat[]> {
  const { data, error } = await supabase.rpc('neo_fat_servico_linhas', { p_fatura: fatura, p_numserv: numserv });
  if (error) throw error;
  return data ?? [];
}
export async function conferirServicoFat(fatura: string, numserv: string, observacao: string): Promise<void> {
  const { error } = await supabase.rpc('neo_fat_conferir_servico', { p_fatura: fatura, p_numserv: numserv, p_observacao: observacao });
  if (error) throw error;
}
export async function desconferirServicoFat(fatura: string, numserv: string): Promise<void> {
  const { error } = await supabase.rpc('neo_fat_desconferir_servico', { p_fatura: fatura, p_numserv: numserv });
  if (error) throw error;
}
/** Recalcula fatura a fatura o que ficou desatualizado (cada chamada cabe no tempo limite) e lê o painel. */
export async function painelFat(): Promise<TotaisFat[]> {
  const { data: velhas, error: erroVelhas } = await supabase.rpc('neo_fat_faturas_desatualizadas');
  if (erroVelhas) throw erroVelhas;
  for (const fatura of (velhas ?? []) as string[]) {
    const { error } = await supabase.rpc('neo_fat_atualizar_totais', { p_fatura: fatura });
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc('neo_fat_painel');
  if (error) throw error;
  return data ?? [];
}

const SITUACOES_XLSX: Record<string,string> = { OK:'Confere', A_MENOS:'Pagou a menos', A_MAIS:'Pagou a mais', FORA_CONTRATO:'Fora do contrato', CONFERIDO:'Conferido' };
/** XLSX da lista como está filtrada na Conferência (todas as páginas), valores em US. */
export async function exportarListaFat(filtros: FiltrosListaFat, fatura: string): Promise<void> {
  const X = await import('xlsx');
  const lista: ServicoFat[] = [];
  for (let pagina = 0; ; pagina++) {
    const r = await listarServicosFat(filtros, pagina, 1000);
    lista.push(...r.servicos);
    if (!r.servicos.length || lista.length >= r.total) break;
  }
  const w = X.utils.book_new();
  X.utils.book_append_sheet(w, X.utils.json_to_sheet(lista.map(s => ({
    'Situação': SITUACOES_XLSX[s.situacao] ?? s.situacao, 'Nº serviço': s.numserv, 'Tipo serv.': s.tipo_serv, 'Códigos': s.codigos.join(', '),
    'Frota': s.numvei ?? '', 'Tipo frota': TIPOS_TURMA_FAT[s.tipo_turma ?? ''] ?? s.tipo_turma ?? '', 'Cidade': s.cidade ?? '',
    'Pago (US)': s.pago_comparado, 'Devido (US)': s.devido, 'Diferença (US)': s.diferenca, 'Multa (US)': s.multas,
    'Motivo': MOTIVOS_FAT[s.motivo ?? ''] ?? '', 'Contém 1.NS': s.tem_1ns ? 'sim' : 'não', 'Na Manutenção': s.na_manutencao ? 'sim' : 'não',
  }))), 'Conferência');
  X.writeFile(w, `conferencia-fatura-${fatura}.xlsx`);
}

/** XLSX com tudo o que foi pago a menos e a mais (sem os conferidos), uma aba para cada lado. */
export async function exportarNegociacaoFat(fatura: string): Promise<void> {
  const X = await import('xlsx');
  const w = X.utils.book_new();
  for (const [lado, aba] of [['a_menos','Pagou a menos'],['a_mais','Pagou a mais']] as const) {
    const lista: ServicoFat[] = [];
    for (let pagina = 0; ; pagina++) {
      const r = await listarServicosFat({ fatura, lado }, pagina, 1000);
      lista.push(...r.servicos);
      if (!r.servicos.length || lista.length >= r.total) break;
    }
    X.utils.book_append_sheet(w, X.utils.json_to_sheet(lista.map(s => ({
      'Serviço': s.numserv, 'Códigos': s.codigos.join(', '),
      'Equipe': TIPOS_TURMA_FAT[s.tipo_turma ?? ''] ?? s.tipo_turma ?? '', 'Frota': s.numvei ?? '', 'Cidade': s.cidade ?? '',
      'Deveria (US)': s.devido, 'Pagou (US)': s.pago_comparado, 'Diferença (US)': s.diferenca,
      'Motivo': MOTIVOS_FAT[s.motivo ?? ''] ?? '', 'Explicação': fraseServico(s),
    }))), aba);
  }
  X.writeFile(w, `negociacao-fatura-${fatura}.xlsx`);
}
