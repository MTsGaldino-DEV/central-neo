// Filtros da Conferência na URL: atalho, listas de coluna (estilo Excel), botões, faixas e ordem.
const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {estadoDaUrl,urlDoEstado,filtrosDoEstado,COLUNAS_CONFERENCIA}=require('../src/lib/filtrosConferencia.ts');
const u=s=>new URLSearchParams(s);
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=9844&atalho=a_mais&cidades=A&cidades=B&tem_1ns=sim&ordem=numserv.asc'))),
  {fatura:'9844',lado:'a_mais',cidades:['A','B'],tem_1ns:'sim',ordem:{coluna:'numserv',dir:'asc'}});
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=9844'))),{fatura:'9844',lado:'a_menos'});
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=1&atalho=fora'))),{fatura:'1',lado:'todos',situacoes:['FORA_CONTRATO']});
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=1&atalho=confere'))),{fatura:'1',lado:'todos',situacoes:['OK']});
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=1&atalho=conferidos'))),{fatura:'1',lado:'todos',situacoes:['CONFERIDO'],conferidos:'somente'});
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=1&atalho=todos&situacoes=A_MAIS'))),{fatura:'1',lado:'todos',situacoes:['A_MAIS']});
// faixas numéricas em US e a busca no número do serviço
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=1&diferenca_max=-0.3&pago_min=0&q=2461'))),{fatura:'1',lado:'a_menos',diferenca_max:-0.3,pago_min:0,q:'2461'});
// valores inválidos são ignorados
assert.deepEqual(filtrosDoEstado(estadoDaUrl(u('fatura=1&ordem=x.lado&tem_1ns=talvez&pago_min=abc&atalho=zzz'))),{fatura:'1',lado:'a_menos'});
// ida e volta pela URL, mantendo o que não é filtro (unidade)
const e=estadoDaUrl(u('fatura=9844&atalho=todos&cidades=A&cidades=B&codigos=1.NS&multado=nao&devido_min=0.1&ordem=diferenca.desc&pagina=3'));
const volta=urlDoEstado(e,u('unidade=us&fatura=velha'));
assert.deepEqual(estadoDaUrl(volta),e);assert.equal(volta.get('unidade'),'us');
assert.deepEqual(urlDoEstado(estadoDaUrl(u('fatura=9844')),u('')).toString(),'fatura=9844');
assert.equal(COLUNAS_CONFERENCIA.length,12);
assert.deepEqual(COLUNAS_CONFERENCIA.map(c=>c.rotulo),['Situação','Nº serviço','Tipo serv.','Códigos','Frota','Tipo frota','Cidade','Pago','Devido','Diferença','Multa','Motivo']);
console.log('OK: filtros da Conferência na URL.');
