// Erros em português: frase simples para todos, detalhes técnicos só no campo `tecnico`.
const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {traduzirErro}=require('../src/lib/erros.ts');
const tempo=traduzirErro({code:'57014',message:'canceling statement due to statement timeout'},'Conferência › lista › buscar no banco');
assert.equal(tempo.acao,'tentar');
assert.equal(tempo.mensagem,'Não foi possível carregar os dados. Aguarde alguns segundos e tente de novo.');
assert.match(tempo.tecnico,/57014/);assert.match(tempo.tecnico,/Conferência › lista/);
assert.doesNotMatch(tempo.mensagem,/statement/);
assert.equal(traduzirErro({code:'42501',message:'Sem acesso ao Faturamento.'}).acao,'avisar');
assert.match(traduzirErro(new TypeError('Failed to fetch')).mensagem,/^Sem conexão/);
assert.match(traduzirErro({message:'TypeError: Failed to fetch'}).mensagem,/^Sem conexão/);
const ja='A fatura 9844 já existe. Revise o antes e o depois e confirme a substituição.';
assert.equal(traduzirErro(Error(ja)).mensagem,ja);
assert.equal(traduzirErro(Error('Linha 3: falta numserv.')).acao,'corrigir');
assert.equal(traduzirErro({code:'P0001',message:'Escreva uma observação.'}).mensagem,'Escreva uma observação.');
// desconhecido: frase genérica, nada técnico na mensagem
const desconhecido=traduzirErro({code:'23505',message:'duplicate key value violates unique constraint'});
assert.equal(desconhecido.mensagem,'Algo deu errado. Tente de novo; se repetir, avise o administrador.');
assert.match(desconhecido.tecnico,/duplicate key/);
assert.equal(traduzirErro(null).mensagem,desconhecido.mensagem);
assert.equal(traduzirErro(new TypeError('x is undefined')).mensagem,desconhecido.mensagem);
console.log('OK: erros em português.');
