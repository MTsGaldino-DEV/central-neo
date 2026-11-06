// Leitura e gravação da disponibilidade da frota no CENTRAL-NEO. A proteção de verdade é a RLS (migration 054).
import { supabase } from './supabase';
import type { ConfigDisp, Frota, Lancamento, Ocorrencia } from './disponibilidadeRegras';

export async function lerFrotas(): Promise<Frota[]> {
  const { data, error } = await supabase.from('neo_disp_frotas').select('*').eq('ativo', true).order('ordem');
  if (error) throw error;
  return (data ?? []) as Frota[];
}

/** `mes` de 0 a 11. */
export async function lerMes(ano: number, mes: number): Promise<Lancamento[]> {
  const { data, error } = await supabase.rpc('neo_disp_mes', { p_ano: ano, p_mes: mes + 1 });
  if (error) throw error;
  return (data ?? []) as Lancamento[];
}

export async function lerAno(ano: number): Promise<Ocorrencia[]> {
  const { data, error } = await supabase.rpc('neo_disp_ano', { p_ano: ano });
  if (error) throw error;
  return (data ?? []) as Ocorrencia[];
}

export async function lerConfig(): Promise<ConfigDisp> {
  const { data, error } = await supabase.from('neo_disp_config').select('valor_ocorrencia, meta_mensal').eq('id', 1).single();
  if (error) throw error;
  return { valor_ocorrencia: Number(data.valor_ocorrencia), meta_mensal: Number(data.meta_mensal) };
}

/** Só o ADMIN passa pela RLS; sem linha devolvida, a alteração foi recusada. */
export async function salvarMeta(meta: number): Promise<void> {
  const { data, error } = await supabase.from('neo_disp_config').update({ meta_mensal: meta }).eq('id', 1).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Só o administrador pode alterar a meta.');
}

export async function marcar(linhas: Lancamento[]): Promise<void> {
  const { error } = await supabase.from('neo_disp_lancamentos').upsert(linhas, { onConflict: 'dia,frota' });
  if (error) throw error;
}

export async function limpar(dia: string, frota: number): Promise<void> {
  const { error } = await supabase.from('neo_disp_lancamentos').delete().eq('dia', dia).eq('frota', frota);
  if (error) throw error;
}
