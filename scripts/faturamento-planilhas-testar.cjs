// Parsers reais e casos de erro; não grava em banco.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),X=require('xlsx');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {lerFatura,lerFaturaCompleta,cruzarFaturas}=require('../src/lib/faturamentoPlanilhas.ts');
const dir=path.resolve(process.argv[2]||'Comparação de fatura');
const nomes=fs.readdirSync(dir);
const resumida=lerFatura(fs.readFileSync(path.join(dir,nomes.find(n=>n.startsWith('Resumo_Fat_9844')))));
const completa=lerFaturaCompleta(fs.readFileSync(path.join(dir,nomes.find(n=>n.startsWith('RelatorioDadosFatura9844')))));
assert.equal(completa.fatura,'9844');assert.equal(completa.inicio,'2026-09-02');assert.equal(completa.fim,'2026-10-01');
assert.deepEqual(cruzarFaturas(resumida,completa),{servicos:21910,porTipo:{D:9657,M:10311,U:1872,Q:70},semVinculo:0,ambiguos:0});
assert.throws(()=>cruzarFaturas(resumida,{...completa,fatura:'outra'}),/diferentes/);
const amostra={...resumida,abas:{...resumida.abas,US_Servico:[{numserv:'1'}],US_Turma:[{numvei:'7',ident_turma:'a',tipo_turma:'D'},{numvei:'7',ident_turma:'b',tipo_turma:'M'}]}};
const cruzar=v=>cruzarFaturas(amostra,{...completa,vinculos:[{numserv:'1',...v}]});
assert.equal(cruzar({numvei:'7',ident_turma:null}).ambiguos,1);
assert.equal(cruzar({numvei:'7',ident_turma:'b'}).porTipo.M,1);
assert.equal(cruzar({numvei:'8',ident_turma:'b'}).semVinculo,1);
assert.equal(cruzar({numvei:null,ident_turma:'b'}).porTipo.M,1);
assert.equal(cruzar({numvei:null,ident_turma:null}).semVinculo,1);
function arquivo(linhas){const w=X.utils.book_new();X.utils.book_append_sheet(w,X.utils.json_to_sheet([{idapropriacao:9844,data_inicio:46267,data_termino:46296}]),'Apropriação');X.utils.book_append_sheet(w,X.utils.json_to_sheet(linhas),'Serviço');return X.write(w,{type:'buffer',bookType:'xlsx'});}
assert.throws(()=>lerFaturaCompleta(arquivo([{numserv:1,veiculo:7},{numserv:1,veiculo:8}])),/vínculos diferentes/);
assert.equal(lerFaturaCompleta(arquivo([{numserv:1,veiculo:7},{numserv:1,veiculo:7}])).vinculos.length,1);
assert.throws(()=>lerFaturaCompleta(arquivo([{numserv:1,frota:7}])),/veiculo/);
assert.throws(()=>lerFaturaCompleta(arquivo([{numserv:null,veiculo:7}])),/numserv/);
console.log('OK: 21.910 serviços reais, quatro equipes, período, faturas incompatíveis, frota ambígua, turma/veículo incompatíveis e duplicidades.');
