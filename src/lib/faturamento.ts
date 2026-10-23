import { supabase } from './supabase';
import { ABAS_FAT, type LeituraFat, type RegistroFat } from './faturamentoPlanilhas';

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

export interface FaturaFat { id:string; arquivo:string; inicio:string; fim:string; importado_em:string }
export async function faturasFat():Promise<FaturaFat[]> {
  const {data,error}=await supabase.from('neo_fat_faturas').select('*').order('fim',{ascending:false});if(error)throw error;return data??[];
}
export async function importarFat(l:LeituraFat,arquivo:string,inicio:string,fim:string,progresso:(s:string)=>void){
  const contagens=Object.fromEntries(ABAS_FAT.map(a=>[a,l.abas[a].length]));
  const {data:id,error}=await supabase.rpc('neo_fat_iniciar',{p_fatura:l.fatura,p_arquivo:arquivo,p_inicio:inicio,p_fim:fim,p_contagens:contagens});if(error)throw error;
  for(const aba of ABAS_FAT)for(let i=0;i<l.abas[aba].length;i+=1000){
    progresso(`${aba}: ${Math.min(i+1000,l.abas[aba].length)} de ${l.abas[aba].length}`);
    const {error}=await supabase.rpc('neo_fat_enviar_lote',{p_importacao:id,p_aba:aba,p_numero:i/1000,p_dados:l.abas[aba].slice(i,i+1000)});if(error)throw error;
  }
  progresso('Concluindo a importação…');const {error:falha}=await supabase.rpc('neo_fat_finalizar',{p_importacao:id});if(falha)throw falha;
}
export async function importarVinculosFat(fatura:string,linhas:RegistroFat[]){
  // Uma chamada mantém o vínculo completo da planilha na mesma transação.
  const {error}=await supabase.rpc('neo_fat_importar_vinculos',{p_fatura:fatura,p_linhas:linhas});if(error)throw error;
}
