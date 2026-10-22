import { supabase } from './supabase';

export interface ContratoFat {
  tabela: string; codigo: string; descricao: string; como_lancar: string | null;
  fator_original: number | null; fator_cod_original: number | null;
  fator_csc: number | null; fator_cod: number | null;
  rural: string | null; moto: string | null; nota: string | null;
  ativo: boolean; validado: boolean; origem: string;
}
export async function contratosFat(): Promise<ContratoFat[]> {
  const { data, error } = await supabase.from('neo_fat_contrato').select('*').order('tabela').order('codigo');
  if (error) throw error;
  return data ?? [];
}
export async function acertarContratoFat(c: ContratoFat, csc: number, cod: number, ativo: boolean, motivo: string) {
  const { error } = await supabase.rpc('neo_fat_acertar_contrato', { p_tabela:c.tabela,p_codigo:c.codigo,p_csc:csc,p_cod:cod,p_ativo:ativo,p_motivo:motivo });
  if (error) throw error;
}
export interface HistoricoFat { id:string; motivo:string; data:string; usuario:string; anterior:ContratoFat; novo:ContratoFat }
export async function historicoFat(c: ContratoFat): Promise<HistoricoFat[]> {
  const {data,error} = await supabase.from('neo_fat_contrato_historico').select('*').eq('tabela',c.tabela).eq('codigo',c.codigo).order('data',{ascending:false});
  if(error) throw error;
  return data ?? [];
}
export const usFat = (n: number | null | undefined) => n == null ? '—' : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:6,maximumFractionDigits:6});
export const erroFat = (e: unknown) => e instanceof Error ? e.message : (e as {message?:string})?.message ?? 'Não foi possível concluir a operação.';
