import * as XLSX from 'xlsx';

export const ABAS_FAT = ['US_Servico','US_Turma','Evento_Glosa','Glosa','Debito_Credito'] as const;
export type AbaFat = typeof ABAS_FAT[number];
export type RegistroFat = Record<string,string|number|null>;
export interface LeituraFat { fatura:string; abas: Record<AbaFat,RegistroFat[]>; creditado:number; glosa:number }
const NUMEROS = ['qtdurbanohn','qtdurbanohe','qtdruralhn','qtdruralhe','qtdhh','ushn','ushe','ushh','usmultas','usglosa','ustotal'];
const texto = (v:unknown) => String(v??'').trim();
function registros(ws:XLSX.WorkSheet): RegistroFat[] {
  return XLSX.utils.sheet_to_json<RegistroFat>(ws,{defval:null}).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k.trim().toLowerCase(),typeof v==='string'?v.trim():v])));
}
function exigir(r:RegistroFat,campos:string[],aba:string,linha:number) {
  for(const c of campos) if(r[c]===null||r[c]===undefined||r[c]==='') throw Error(`${aba}, linha ${linha}: falta ${c}.`);
}
export function lerFatura(buffer:ArrayBuffer|Uint8Array):LeituraFat {
  const wb=XLSX.read(buffer,{type:'array'});
  const abas={} as LeituraFat['abas'];let fatura='';const ids=new Set<string>();
  for(const aba of ABAS_FAT){
    if(!wb.Sheets[aba])throw Error(`Aba ${aba} não encontrada. Importe a fatura completa.`);
    abas[aba]=registros(wb.Sheets[aba]);
    for(const [i,r] of abas[aba].entries()){
      exigir(r,['idapropriacao'],aba,i+2);const id=texto(r.idapropriacao);
      if(!fatura)fatura=id;if(id!==fatura)throw Error('A planilha contém mais de uma fatura.');
      for(const k of ['idapropriacao','idapropriacaotemposervico','numserv','codserv','numvei','ident_turma']) if(r[k]!=null)r[k]=texto(r[k]);
      if(aba==='US_Servico'){
        exigir(r,['idapropriacaotemposervico','numserv','tipo_serv','codserv','cidade',...NUMEROS],aba,i+2);
        const chave=texto(r.idapropriacaotemposervico);if(ids.has(chave))throw Error(`Identificador duplicado: ${chave}.`);ids.add(chave);
        for(const k of NUMEROS){const v=r[k];const n=typeof v==='number'?v:Number(texto(v).replace(',','.'));if(!Number.isFinite(n))throw Error(`Linha ${i+2}: ${k} inválido.`);r[k]=n;}
        if(NUMEROS.slice(0,5).some(k=>Number(r[k])<0))throw Error(`Linha ${i+2}: quantidade negativa.`);
      }
    }
  }
  if(!abas.US_Servico.length)throw Error('A fatura não tem serviços.');
  const soma=(k:string)=>abas.US_Servico.reduce((v,r)=>v+Math.round(Number(r[k])*1e6),0)/1e6;
  return {fatura,abas,creditado:soma('ustotal'),glosa:soma('usglosa')};
}
export function lerVinculos(buffer:ArrayBuffer):RegistroFat[]{
  const wb=XLSX.read(buffer,{type:'array'});const lista=registros(wb.Sheets[wb.SheetNames[0]]);const ids=new Set<string>();
  if(!lista.length)throw Error('Planilha vazia.');
  return lista.map((r,i)=>{exigir(r,['numserv'],'Vínculos',i+2);if(!texto(r.numvei)&&!texto(r.ident_turma))throw Error(`Linha ${i+2}: informe numvei ou ident_turma.`);const numserv=texto(r.numserv);if(ids.has(numserv))throw Error(`Serviço duplicado: ${numserv}.`);ids.add(numserv);return{numserv,numvei:texto(r.numvei)||null,ident_turma:texto(r.ident_turma)||null};});
}
