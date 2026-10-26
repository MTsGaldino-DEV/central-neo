import { supabase } from './supabase';
import { ABAS_FAT, cruzarFaturas, type LeituraCompletaFat, type LeituraFat, type RegistroFat } from './faturamentoPlanilhas';

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
export async function configFat(): Promise<{ moto_urbano: number }> {
  const { data, error } = await supabase.from('neo_fat_config').select('moto_urbano').single();
  if (error) throw error;
  return { moto_urbano: Number(data.moto_urbano) };
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
export { usFat } from './faturamentoTexto';
export const erroFat = (e: unknown) => e instanceof Error ? e.message : (e as {message?:string})?.message ?? 'Não foi possível concluir a operação.';

export interface FaturaFat { id:string; arquivo:string; arquivo_completo:string|null; inicio:string; fim:string; importado_em:string; hash_resumida:string|null; hash_completa:string|null }
export async function faturasFat():Promise<FaturaFat[]> {
  const {data,error}=await supabase.from('neo_fat_faturas').select('*').order('fim',{ascending:false});if(error)throw error;return data??[];
}
export async function importarFat(l:LeituraFat,arquivo:string,completa:LeituraCompletaFat,arquivoCompleto:string,progresso:(s:string,percentual:number)=>void,hashes?:{resumida:string;completa:string},substituir=false){
  cruzarFaturas(l,completa);
  // Substituir uma fatura existente só com confirmação explícita de quem importa.
  const {data:ja,error:erroJa}=await supabase.from('neo_fat_faturas').select('id').eq('id',l.fatura);if(erroJa)throw erroJa;
  if(ja?.length&&!substituir)throw Error(`A fatura ${l.fatura} já existe. Revise o antes e o depois e confirme a substituição.`);
  const abas:Record<string,RegistroFat[]>={...l.abas,Servico:completa.vinculos.map(v=>({...v,idapropriacao:completa.fatura}))};
  const contagens=Object.fromEntries(Object.entries(abas).map(([a,linhas])=>[a,linhas.length]));
  const total=Object.values(contagens).reduce((a,b)=>a+b,0);let enviados=0;
  const {data:id,error}=await supabase.rpc('neo_fat_iniciar_completa',{p_fatura:l.fatura,p_arquivo:arquivo,p_arquivo_completo:arquivoCompleto,p_inicio:completa.inicio,p_fim:completa.fim,p_contagens:contagens});if(error)throw error;
  for(const aba of [...ABAS_FAT,'Servico'])for(let i=0;i<abas[aba].length;i+=1000){
    const lote=abas[aba].slice(i,i+1000);
    const {error}=await supabase.rpc('neo_fat_enviar_lote',{p_importacao:id,p_aba:aba,p_numero:i/1000,p_dados:lote});if(error)throw error;
    enviados+=lote.length;progresso(`Enviando ${aba==='Servico'?'vínculos das equipes':aba}…`,Math.round(enviados/total*95));
  }
  progresso('Concluindo a fatura e o cruzamento das equipes…',97);const {error:falha}=await supabase.rpc('neo_fat_finalizar_completa',{p_importacao:id});if(falha)throw falha;
  if(hashes){const {error:e}=await supabase.rpc('neo_fat_registrar_hashes',{p_fatura:l.fatura,p_hash_resumida:hashes.resumida,p_hash_completa:hashes.completa});if(e)throw e;}
  progresso('Recalculando os totais da fatura…',99);const {error:totais}=await supabase.rpc('neo_fat_atualizar_totais',{p_fatura:l.fatura});if(totais)throw totais;
  progresso('Importação concluída.',100);
}
export async function importarVinculosFat(fatura:string,linhas:RegistroFat[]){
  // Uma chamada mantém o vínculo completo da planilha na mesma transação.
  const {error}=await supabase.rpc('neo_fat_importar_vinculos',{p_fatura:fatura,p_linhas:linhas});if(error)throw error;
}

