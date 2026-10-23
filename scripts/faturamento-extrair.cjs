// Extração reproduzível: pdftotext -layout para ordem/contagem, -raw para células.
// Uso: node scripts/faturamento-extrair.cjs <pasta com tabela11/12[-raw].txt> <xlsx>
// Antes: python scripts/faturamento-validar-pdf.py. Nunca reescreve migrations.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const [pasta, arquivo] = process.argv.slice(2);
const wb = XLSX.readFile(arquivo);
const linhas = XLSX.utils.sheet_to_json(wb.Sheets.US_Servico);
const todos = [], pendentes = [], validacao = [];
const geometria=JSON.parse(fs.readFileSync('docs/faturamento-celulas-pdf.json','utf8'));
for (const tabela of ['12', '11']) {
  const layout = fs.readFileSync(path.join(pasta, `tabela${tabela}.txt`), 'utf8');
  const raw = fs.readFileSync(path.join(pasta, `tabela${tabela}-raw.txt`), 'utf8');
  const padrao = tabela === '12' ? 'RC\\d{2}' : '(?:[0-9A-Z]\\.[0-9A-Z]{2}|[A-Z]{2}\\d{2})';
  const codigos = [...layout.matchAll(new RegExp(`^\\s*(${padrao})(?=\\s|$)`, 'gm'))].map(m => m[1]);
  const marcas = [...raw.matchAll(new RegExp(`^(${padrao})(?=\\s|$)`, 'gm'))];
  if (JSON.stringify(codigos) !== JSON.stringify(marcas.map(m => m[1]))) throw Error(`Ordem/contagem diferente na tabela ${tabela}`);
  const fatoresLayout = [...layout.matchAll(/\b\d+,\d{6}\b/g)].map(m => m[0]).sort();
  const fatoresRaw = [...raw.matchAll(/\b\d+,\d{6}\b/g)].map(m => m[0]).sort();
  if (JSON.stringify(fatoresLayout) !== JSON.stringify(fatoresRaw)) throw Error(`Valores diferentes nas extrações da tabela ${tabela}`);
  for (let i=0;i<marcas.length;i++) {
    const codigo = marcas[i][1];
    const bloco = raw.slice(marcas[i].index + codigo.length, marcas[i+1]?.index ?? raw.indexOf('NOTA 1:')).trim();
    const pares = [...bloco.matchAll(/(?<![\d,])(\d+,\d{6}|0) +(\d+,\d{6}|0)(?![\d,])/g)];
    const par = pares.length === 1 || (pares.length === 2 && !bloco.slice(pares[0].index, pares[1].index).includes('\n')) ? pares[0] : null;
    const csc = par ? Number(par[1].replace(',','.')) : null;
    const cod = par ? Number(par[2].replace(',','.')) : null;
    const amostras = linhas.filter(l => tabela === '12' ? l.tipo_serv.trim() === codigo : l.codserv.trim() === codigo && !todos.some(c => c.tabela==='12' && c.codigo===l.tipo_serv.trim()));
    const batem = amostras.filter(l => par && [csc,cod].some(f => [1,0.7].some(u => Math.abs(Math.round(f*(l.qtdurbanohn*u+l.qtdruralhn*(u===1?1.2:0.9))*1e6)/1e6-l.ustotal)<=0.0000011)));
    const celula=geometria.celulas.find(c=>c.tabela===tabela&&c.codigo===codigo);
    if(!celula)throw Error('Código ausente na validação por coordenadas: '+codigo);
    if(celula.csc!==csc||celula.cod!==cod)throw Error('Fatores diferentes entre texto e células do PDF: '+tabela+'/'+codigo);
    const validado = !!par && celula.csc!==null && celula.cod!==null;
    const notaRefs = [...new Set([...bloco.matchAll(/NOTA\s+(\d+)/g)].map(m=>m[1]))];
    const notas = notaRefs.map(n => raw.match(new RegExp(`NOTA ${n}:[\\s\\S]*?(?=NOTA \\d+:|$)`))?.[0]?.trim() ?? `NOTA ${n}: texto não presente neste PDF`).join('\n');
    const descricao = bloco.slice(0,par?.index ?? bloco.length).replace(/CLASSIFICAÇÃO:.*|Classificação:.*/g,'').trim();
    const item = { tabela,codigo,descricao,como_lancar: descricao.match(/1 por[^\n]*(?:\n[^\n]*)?/)?.[0] ?? (tabela==='12'?'Por atendimento':null),
      fator_original:validado?csc:null,fator_cod_original:validado?cod:null,fator_csc:validado?csc:null,fator_cod:validado?cod:null,
      rural: tabela==='11'?bloco.match(/(?:\d+,\d{6}|0) +(1,2|0) +(0,7|1|0)\b/)?.[1]??null:null,
      moto: tabela==='11'?bloco.match(/(?:\d+,\d{6}|0) +(1,2|0) +(0,7|1|0)\b/)?.[2]??null:null,
      nota:notas||null,validado,origem:`${tabela==='11'?'Código':'Nota'} de Serviço Unificado.pdf; página ${celula.pagina}; células CSC/COD conferidas por posição e texto; ${batem.length}/${amostras.length} créditos reproduzidos na fatura 9844 (diagnóstico, não validação do contrato)` };
    todos.push(item);
    if (!validado) pendentes.push({tabela,codigo,motivo:'Fator não numérico: NOTA 10 sem texto neste PDF',linhas:amostras.length});
    validacao.push({tabela,codigo,csc,cod,pagina:celula.pagina,amostras:amostras.length,batem:batem.length,validado});
  }
}
// Catálogo candidato para revisão e criação de UMA NOVA migration, sem sobrescrever a carga aplicada.
fs.writeFileSync(path.join(pasta,'contrato-validado.json'),JSON.stringify(todos,null,2));
fs.mkdirSync('docs',{recursive:true});
fs.writeFileSync('docs/faturamento-validacao-contrato.json',JSON.stringify({validacao,pendentes},null,2));
console.log(JSON.stringify({codigos:todos.length,validados:todos.filter(c=>c.validado).length,pendentes}));
