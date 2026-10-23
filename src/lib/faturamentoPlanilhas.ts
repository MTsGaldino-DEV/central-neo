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
    if(!wb.Sheets[aba])throw Error(`Aba ${aba} não encontrada. Selecione a Fatura Resumida.`);
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

export interface VinculoServicoFat {
  numserv: string;
  numvei: string | null;
  ident_turma: string | null;
}

export interface LeituraCompletaFat {
  fatura: string;
  inicio: string;
  fim: string;
  vinculos: VinculoServicoFat[];
}

export const TIPOS_TURMA_FAT: Record<string, string> = {
  D: 'Multifuncional', M: 'Moto', U: 'Umpla', Q: 'Quarteto',
};

function dataDaPlanilha(valor: unknown): string {
  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = texto(valor);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  throw Error('Período não encontrado na aba Apropriação da Fatura Completa.');
}

/** Lê somente as abas necessárias, sem carregar endereços/equipes em outras abas. */
export function lerFaturaCompleta(buffer: ArrayBuffer | Uint8Array): LeituraCompletaFat {
  const wb = XLSX.read(buffer, { type: 'array', sheets: ['Serviço', 'Servico', 'Apropriação', 'Apropriacao'] });
  const ws = wb.Sheets['Serviço'] ?? wb.Sheets.Servico;
  const aprop = wb.Sheets['Apropriação'] ?? wb.Sheets.Apropriacao;
  if (!ws || !aprop) throw Error('Selecione a Fatura Completa com as abas Serviço e Apropriação.');
  const cabecalho = registros(aprop);
  if (cabecalho.length !== 1) throw Error('A Fatura Completa deve conter uma única apropriação.');
  exigir(cabecalho[0], ['idapropriacao', 'data_inicio', 'data_termino'], 'Apropriação', 2);
  const fatura = texto(cabecalho[0].idapropriacao);
  const inicio = dataDaPlanilha(cabecalho[0].data_inicio);
  const fim = dataDaPlanilha(cabecalho[0].data_termino);
  if (inicio > fim) throw Error('Período inválido na Fatura Completa.');
  const unicos = new Map<string, VinculoServicoFat>();
  for (const [i, r] of registros(ws).entries()) {
    exigir(r, ['numserv'], 'Serviço', i + 2);
    if (!('veiculo' in r)) throw Error('Coluna veiculo não encontrada na aba Serviço.');
    const vinculo = {
      numserv: texto(r.numserv),
      numvei: texto(r.veiculo) || null,
      ident_turma: texto(r.ident_turma) || null,
    };
    const anterior = unicos.get(vinculo.numserv);
    if (anterior && (anterior.numvei !== vinculo.numvei || anterior.ident_turma !== vinculo.ident_turma)) {
      throw Error(`O serviço ${vinculo.numserv} tem vínculos diferentes na Fatura Completa. Revise a origem.`);
    }
    unicos.set(vinculo.numserv, vinculo);
  }
  if (!unicos.size) throw Error('A aba Serviço da Fatura Completa está vazia.');
  return { fatura, inicio, fim, vinculos: [...unicos.values()] };
}

export interface CruzamentoFat {
  servicos: number;
  porTipo: Record<string, number>;
  semVinculo: number;
  ambiguos: number;
}

/** Veículo identifica a frota; ident_turma desempata seu tipo no atendimento. */
export function cruzarFaturas(resumida: LeituraFat, completa: LeituraCompletaFat): CruzamentoFat {
  if (resumida.fatura !== completa.fatura) {
    throw Error(`Os arquivos são de faturas diferentes: ${resumida.fatura} e ${completa.fatura}.`);
  }
  const vinculos = new Map(completa.vinculos.map(v => [v.numserv, v]));
  const porVeiculo = new Map<string, RegistroFat[]>();
  const porIdent = new Map<string, RegistroFat[]>();
  for (const turma of resumida.abas.US_Turma) {
    const veiculo = texto(turma.numvei), ident = texto(turma.ident_turma);
    porVeiculo.set(veiculo, [...porVeiculo.get(veiculo) ?? [], turma]);
    porIdent.set(ident, [...porIdent.get(ident) ?? [], turma]);
  }
  const servicos = new Set(resumida.abas.US_Servico.map(r => texto(r.numserv)));
  const resultado: CruzamentoFat = { servicos: servicos.size, porTipo: { D: 0, M: 0, U: 0, Q: 0 }, semVinculo: 0, ambiguos: 0 };
  for (const numserv of servicos) {
    const v = vinculos.get(numserv);
    const candidatas = !v ? [] : v.ident_turma
      ? (porIdent.get(v.ident_turma) ?? []).filter(t => !v.numvei || texto(t.numvei) === v.numvei)
      : porVeiculo.get(v.numvei ?? '') ?? [];
    const tipos = new Set(candidatas.map(t => texto(t.tipo_turma)));
    const tipo = [...tipos][0];
    if (!tipos.size || !TIPOS_TURMA_FAT[tipo]) resultado.semVinculo++;
    else if (tipos.size > 1) resultado.ambiguos++;
    else resultado.porTipo[tipo]++;
  }
  return resultado;
}
