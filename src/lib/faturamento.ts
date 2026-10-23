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

export interface FaturaFat { id:string; arquivo:string; arquivo_completo:string|null; inicio:string; fim:string; importado_em:string }
export async function faturasFat():Promise<FaturaFat[]> {
  const {data,error}=await supabase.from('neo_fat_faturas').select('*').order('fim',{ascending:false});if(error)throw error;return data??[];
}
export async function importarFat(l:LeituraFat,arquivo:string,completa:LeituraCompletaFat,arquivoCompleto:string,progresso:(s:string,percentual:number)=>void){
  cruzarFaturas(l,completa);
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
  progresso('Importação concluída.',100);
}
export async function importarVinculosFat(fatura:string,linhas:RegistroFat[]){
  // Uma chamada mantém o vínculo completo da planilha na mesma transação.
  const {error}=await supabase.rpc('neo_fat_importar_vinculos',{p_fatura:fatura,p_linhas:linhas});if(error)throw error;
}

export interface LinhaFat {
 tipo_turma:string|null;numvei:string|null;ident_turma:string|null;
 fatura:string;id:string;numserv:string;tipo_serv:string;codserv:string;cidade:string;tabela:string|null;
 urbano:number;rural:number;fator_csc:number|null;fator_cod:number|null;fator_aplicado:string|null;
 devido_referencia:number|null;devido_csc:number|null;devido_cod:number|null;moto_csc:number|null;moto_cod:number|null;
 creditado:number;glosa:number;diferenca:number|null;situacao:string;situacao_calculo:string;
 justificativa:string|null;observacoes:string;observacao_manual:string|null;conferido_por:string|null;conferido_em:string|null;
 revisao_desatualizada:boolean;liquido_servico:number;soma_csc:number;soma_cod:number;qtd_servico:number;
}
export const SITUACOES_FAT=['OK','DIVERGENTE','MOTO_PROVAVEL','CODIGO_FORA_CONTRATO','REVISAR_RC_MULTILINHA','CONFERIDO'];
export async function linhasFat(p:URLSearchParams,pagina=0,limite=50){
 const {data,error}=await supabase.rpc('neo_fat_listar',{
   p_filtros:Object.fromEntries(p),p_offset:pagina*limite,p_limite:limite,
 });if(error)throw error;
 return data as {linhas:LinhaFat[];total:number};
}
export async function conferirFat(l:LinhaFat,observacao:string){const {error}=await supabase.rpc('neo_fat_conferir',{p_fatura:l.fatura,p_linha:l.id,p_observacao:observacao});if(error)throw error;}
export async function exportarFat(p:URLSearchParams){
 const X=await import('xlsx');const filtro=new URLSearchParams(p);filtro.set('situacao','DIVERGENTE');let pagina=0;const lista:LinhaFat[]=[];
 for(;;){const r=await linhasFat(filtro,pagina++,1000);lista.push(...r.linhas);if(lista.length>=r.total)break;}
 const w=X.utils.book_new();X.utils.book_append_sheet(w,X.utils.json_to_sheet(lista),'Divergências');X.writeFile(w,'faturamento-divergencias.xlsx');
}
