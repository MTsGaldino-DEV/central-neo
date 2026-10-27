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
// acionamento, término e área (homem-hora e zona)
const v779=completa.vinculos.find(v=>v.numserv==='246015779');
assert.equal(v779.acionamento,'2026-09-17T06:23:00');assert.equal(v779.termino,'2026-09-17T08:36:00');
assert.deepEqual(completa.vinculos.reduce((c,v)=>(c[v.area]=(c[v.area]||0)+1,c),{}),{U:17137,R:4764,S:9});
const sint=lerFaturaCompleta(arquivo([{numserv:1,veiculo:7,dh_aciona:'17/09/2026 06:23',dh_terreal:46282.25,cod_tip_area:'r'},{numserv:2,veiculo:7,dh_aciona:null,dh_terreal:'',cod_tip_area:null}])).vinculos;
assert.equal(sint[0].acionamento,'2026-09-17T06:23:00');assert.equal(sint[0].termino,'2026-09-17T06:00:00');assert.equal(sint[0].area,'R');
assert.equal(sint[1].acionamento,null);assert.equal(sint[1].termino,null);assert.equal(sint[1].area,null);
const rep=lerFaturaCompleta(arquivo([{numserv:1,veiculo:7,dh_aciona:'17/09/2026 06:23'},{numserv:1,veiculo:7,dh_aciona:'18/09/2026 07:00'}])).vinculos;
assert.equal(rep.length,1);assert.equal(rep[0].acionamento,'2026-09-17T06:23:00');
console.log('OK: acionamento, término e área da Fatura Completa.');
// importação segura: hash do arquivo, linhas idênticas e resumo antes/depois
(async()=>{
  const {hashArquivo,linhasDuplicadas,resumoImportacao}=require('../src/lib/faturamentoPlanilhas.ts');
  const buf=fs.readFileSync(path.join(dir,nomes.find(n=>n.startsWith('Resumo_Fat_9844'))));
  const h1=await hashArquivo(buf),h2=await hashArquivo(buf);assert.equal(h1,h2);assert.match(h1,/^[0-9a-f]{64}$/);
  assert.notEqual(await hashArquivo(Buffer.concat([buf,Buffer.from([0])])),h1);
  assert.deepEqual(linhasDuplicadas([{a:1,b:2},{b:2,a:1},{a:1,b:3}]).map(g=>g.length),[2]);
  assert.deepEqual(linhasDuplicadas([{numserv:'1',codserv:'7.15'},{numserv:'1',codserv:'7.10'}]),[]);
  // o id técnico da linha é único por construção: duplicidade compara o resto
  assert.deepEqual(linhasDuplicadas([{idapropriacaotemposervico:1,numserv:'1',codserv:'7.15',ustotal:0.1},{idapropriacaotemposervico:2,numserv:'1',codserv:'7.15',ustotal:0.1}]).map(g=>g.length),[2]);
  const r=resumoImportacao(resumida,completa);
  assert.equal(r.linhas,27389);assert.equal(r.servicos,21910);assert.equal(r.creditado.toFixed(6),'917.112183');assert.equal(r.multas.toFixed(6),'21.226389');
  console.log('Duplicadas na 9844:',linhasDuplicadas(resumida.abas.US_Servico).length,'grupos');
  console.log('OK: hash, duplicidade e resumo da importação.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
