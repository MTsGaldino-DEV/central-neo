// Menu lateral: lembra as seções fechadas; sem armazenamento, começa tudo aberto.
const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {lerRecolhidas,gravarRecolhidas}=require('../src/lib/secoesRecolhidas.ts');
const mem=new Map(),arm={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
assert.deepEqual([...lerRecolhidas(arm)],[]);
gravarRecolhidas(new Set(['TraceOne · Medidores']),arm);
assert.deepEqual([...lerRecolhidas(arm)],['TraceOne · Medidores']);assert.ok(mem.has('neo-menu-recolhidas'));
const quebrado={getItem(){throw new Error('bloqueado')},setItem(){throw new Error('bloqueado')}};
assert.deepEqual([...lerRecolhidas(quebrado)],[]);assert.doesNotThrow(()=>gravarRecolhidas(new Set(['x']),quebrado));
mem.set('neo-menu-recolhidas','{ruim');assert.deepEqual([...lerRecolhidas(arm)],[]);
mem.set('neo-menu-recolhidas','{"a":1}');assert.deepEqual([...lerRecolhidas(arm)],[]);
assert.deepEqual([...lerRecolhidas()],[]);   // Node sem localStorage
console.log('OK: seções do menu lembradas.');
