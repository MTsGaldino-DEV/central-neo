// Extração reproduzível: pdftotext -layout para ordem/contagem, -raw para células.
// Uso: node scripts/faturamento-extrair.cjs <pasta com tabela11/12[-raw].txt> <xlsx>
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const [pasta, arquivo] = process.argv.slice(2);
const wb = XLSX.readFile(arquivo);
const linhas = XLSX.utils.sheet_to_json(wb.Sheets.US_Servico);
const todos = [], pendentes = [], validacao = [];
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
    const validado = !!par && batem.length > 0;
    const notaRefs = [...new Set([...bloco.matchAll(/NOTA\s+(\d+)/g)].map(m=>m[1]))];
    const notas = notaRefs.map(n => raw.match(new RegExp(`NOTA ${n}:[\\s\\S]*?(?=NOTA \\d+:|$)`))?.[0]?.trim() ?? `NOTA ${n}: texto não presente neste PDF`).join('\n');
    const descricao = bloco.slice(0,par?.index ?? bloco.length).replace(/CLASSIFICAÇÃO:.*|Classificação:.*/g,'').trim();
    const item = { tabela,codigo,descricao,como_lancar: descricao.match(/1 por[^\n]*(?:\n[^\n]*)?/)?.[0] ?? (tabela==='12'?'Por atendimento':null),
      fator_original:validado?csc:null,fator_cod_original:validado?cod:null,fator_csc:validado?csc:null,fator_cod:validado?cod:null,
      rural: tabela==='11'?bloco.match(/(?:\d+,\d{6}|0) +(1,2|0) +(0,7|1|0)\b/)?.[1]??null:null,
      moto: tabela==='11'?bloco.match(/(?:\d+,\d{6}|0) +(1,2|0) +(0,7|1|0)\b/)?.[2]??null:null,
      nota:notas||null,validado,origem:`${tabela==='11'?'Código':'Nota'} de Serviço Unificado.pdf; ordem layout/raw conferida; ${batem.length}/${amostras.length} créditos reproduzidos na fatura 9844` };
    todos.push(item);
    if (!validado) pendentes.push({tabela,codigo,motivo:!par?'Fatores não numéricos ou extração ambígua':amostras.length?'Nenhum crédito reproduzido':'Sem amostra na fatura',linhas:amostras.length});
    validacao.push({tabela,codigo,csc,cod,amostras:amostras.length,batem:batem.length,validado});
  }
}
const literal = v => v===null?'null':typeof v==='boolean'?String(v):typeof v==='number'?String(v):"'"+v.replace(/'/g,"''")+"'";
fs.writeFileSync('supabase/migrations/014_faturamento_carga.sql','-- Origem: PDFs Tabelas 11/12. Gerado por scripts/faturamento-extrair.cjs.\n-- Fatores sem reprodução na fatura ficam nulos; catálogo mantém precedência dos RCs.\ninsert into public.neo_fat_contrato ('+Object.keys(todos[0]).join(',')+') values\n'+todos.map(c=>'('+Object.values(c).map(literal).join(',')+')').join(',\n')+';\n');
fs.mkdirSync('docs',{recursive:true});
fs.writeFileSync('docs/faturamento-validacao-contrato.json',JSON.stringify({validacao,pendentes},null,2));
console.log(JSON.stringify({codigos:todos.length,validados:todos.filter(c=>c.validado).length,pendentes}));
