// Regras do lançamento de cobrança da Manutenção (funções puras); não acessa banco.
const fs = require('fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, f);
const {
  FATORES, fatorPadrao, textoFator, calcularValor, totalPedido, agruparLancamentos, ratearPago,
} = require('../src/lib/fechamentoCobranca.ts');

// ─── Fator ──────────────────────────────────────────────────────────────────
assert.deepEqual(FATORES.map((f) => f.valor), [1, 1.2, 1.4]);
assert.equal(fatorPadrao('R'), 1.2, 'zona rural abre em 1,2');
assert.equal(fatorPadrao('U'), 1, 'zona urbana abre em 1,0');
assert.equal(fatorPadrao(null), 1, 'sem zona abre em 1,0');
assert.equal(textoFator(1), '1,0');
assert.equal(textoFator(1.4), '1,4');

// ─── Valor do código, com quatro casas como no banco ───────────────────────
assert.equal(calcularValor(0.0567, 1, 1), 0.0567);
assert.equal(calcularValor(0.0567, 2, 1.2), 0.1361, '0,0567 × 2 × 1,2 = 0,13608');
assert.equal(calcularValor(0.1, 3, 1.4), 0.42, 'sem erro de ponto flutuante');

// ─── Total pedido: soma sem resíduo de ponto flutuante ─────────────────────
assert.equal(totalPedido([{ valor_inicial: 0.1 }, { valor_inicial: 0.2 }]), 0.3);
assert.equal(totalPedido([{ valor_inicial: 0.5 }, { valor_inicial: null }]), 0.5, 'item sem valor conta zero');

// ─── Agrupamento: códigos da mesma NSMP formam um lançamento ───────────────
const item = (id, nsmp = null, nspr = null, fatura = null, valor_inicial = 0.1, valor_final = null) =>
  ({ id, nsmp, nspr, fatura, valor_inicial, valor_final });

let g = agruparLancamentos([item('a'), item('b')]);
assert.equal(g.length, 1, 'sem NSMP: os códigos pendentes ficam juntos');
assert.deepEqual(g[0].itens.map((i) => i.id), ['a', 'b']);
assert.equal(g[0].nsmp, null);

g = agruparLancamentos([item('a', '1', 'P', 'AP 1'), item('b', '2', null), item('c', '1', 'P', 'AP 1'), item('d')]);
assert.deepEqual(g.map((l) => l.itens.map((i) => i.id)), [['a', 'c'], ['b'], ['d']], 'agrupa por NSMP na ordem de chegada');
assert.equal(g[0].nsmp, '1');
assert.equal(g[0].nspr, 'P');
assert.equal(g[0].fatura, 'AP 1');

g = agruparLancamentos([item('a', '1', 'P'), item('b', '1', 'Q')]);
assert.equal(g.length, 2, 'NSPR diferente na mesma NSMP aparece separado, sem esconder o dado');

g = agruparLancamentos([item('a', '1', 'P', null, 0.1, 0.1), item('b', '1', 'P', null, 0.2, 0.25)]);
assert.equal(g[0].pedido, 0.3);
assert.equal(g[0].pago, 0.35);
assert.equal(g[0].semValorPago, false);
assert.equal(g[0].divergente, true);

g = agruparLancamentos([item('a', '1', 'P', null, 0.1, 0.1), item('b', '1', 'P', null, 0.2, 0.2)]);
assert.equal(g[0].divergente, false, 'pago igual ao pedido não diverge');

g = agruparLancamentos([item('a', '1', 'P', null, 0.1, 0.1), item('b', '1', 'P', null, 0.2, null)]);
assert.equal(g[0].semValorPago, true, 'um código sem valor deixa o lançamento sem valor pago');
assert.equal(g[0].divergente, false);

assert.deepEqual(agruparLancamentos([]), []);

// ─── Rateio do valor pago da NSPR entre os códigos ─────────────────────────
const soma = (r) => Math.round(r.reduce((s, x) => s + x.valor_final, 0) * 10000) / 10000;

assert.deepEqual(
  ratearPago([{ id: 'a', valor_inicial: 0.1 }, { id: 'b', valor_inicial: 0.2 }], 0.3),
  [{ id: 'a', valor_final: 0.1 }, { id: 'b', valor_final: 0.2 }],
  'pago igual ao pedido: cada código recebe exatamente o que pediu',
);

let r = ratearPago([{ id: 'a', valor_inicial: 0.1 }, { id: 'b', valor_inicial: 0.3 }], 0.2);
assert.deepEqual(r, [{ id: 'a', valor_final: 0.05 }, { id: 'b', valor_final: 0.15 }], 'pago menor: proporcional ao pedido');

r = ratearPago([{ id: 'a', valor_inicial: 0.1 }, { id: 'b', valor_inicial: 0.1 }, { id: 'c', valor_inicial: 0.1 }], 0.1);
assert.equal(soma(r), 0.1, 'o arredondamento não muda o total pago');
assert.deepEqual(r.map((x) => x.valor_final), [0.0333, 0.0333, 0.0334], 'o último absorve a sobra do arredondamento');

r = ratearPago([{ id: 'a', valor_inicial: null }, { id: 'b', valor_inicial: null }], 0.5);
assert.deepEqual(r, [{ id: 'a', valor_final: 0.5 }, { id: 'b', valor_final: 0 }], 'sem pedido: o valor fica no primeiro código');

assert.deepEqual(ratearPago([{ id: 'a', valor_inicial: 0.1 }], 0.07), [{ id: 'a', valor_final: 0.07 }], 'um código recebe o total');

assert.deepEqual(
  ratearPago([{ id: 'a', valor_inicial: 0.1 }, { id: 'b', valor_inicial: 0.2 }], null),
  [{ id: 'a', valor_final: null }, { id: 'b', valor_final: null }],
  'NSPR sem valor informado continua sem valor',
);

assert.deepEqual(
  ratearPago([{ id: 'a', valor_inicial: 0.1 }, { id: 'b', valor_inicial: 0.2 }], 0),
  [{ id: 'a', valor_final: 0 }, { id: 'b', valor_final: 0 }],
  'pago zero é um valor, não falta de valor',
);

console.log('OK: fator, valor do código, agrupamento por NSMP e rateio do valor pago.');
