// Colunas da fila de NSIS por etapa (funções puras); não acessa banco.
const fs = require('fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, f);
const { COLUNAS_FLUXO, colunasVisiveis } = require('../src/lib/fechamentoFluxo.ts');

// ─── Rótulos ────────────────────────────────────────────────────────────────
assert.deepEqual(
  COLUNAS_FLUXO.map((c) => [c.id, c.rotulo]),
  [
    ['servico', 'N° Serviço'], ['tipo_serv', 'Tipo'], ['localidade', 'Localidade'], ['termino', 'DT execução'],
    ['equipes', 'Equipe'], ['nsmps', 'NSMP'], ['nsprs', 'NSPR/NSMC'],
    ['valor_lancamento', 'Lançamento Salesforce'], ['valor_pago', 'Valor pago'], ['data_lancamento_sf', 'Data lançamento SF'],
    ['faturas', 'Apropriação'], ['observacao', 'Observação'], ['etapa', 'Etapa'],
  ],
  'COLUNAS_FLUXO com os rótulos da spec',
);

// ─── Fluxo novo: colunas acumulam por etapa, Etapa sempre por último ───────
const novo = (etapa) => colunasVisiveis(etapa, false);

assert.deepEqual(novo('A_FECHAR'), ['servico', 'tipo_serv', 'localidade', 'termino', 'observacao', 'etapa']);
assert.deepEqual(novo('AGUARDANDO_NSPR'), ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'nsmps', 'etapa']);
assert.deepEqual(novo('AGUARDANDO_SALESFORCE'),
  ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'nsmps', 'nsprs', 'valor_pago', 'etapa']);
assert.deepEqual(novo('AGUARDANDO_APROPRIACAO'),
  ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'nsmps', 'nsprs', 'valor_pago', 'data_lancamento_sf', 'etapa']);
assert.deepEqual(novo('FATURADA'),
  ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'nsmps', 'nsprs', 'valor_pago', 'data_lancamento_sf', 'faturas', 'etapa']);
assert.deepEqual(novo('TODAS'), COLUNAS_FLUXO.map((c) => c.id).filter((id) => id !== 'valor_lancamento'), 'Todas mostra todas as colunas, menos o Lançamento Salesforce');

// Observação do GDIS só na primeira etapa (A fechar) e em Todas
for (const etapa of ['AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA']) {
  assert.ok(!novo(etapa).includes('observacao'), `${etapa}: sem Observação`);
}
assert.ok(novo('A_FECHAR').includes('observacao'), 'A fechar mostra a Observação');
assert.ok(novo('TODAS').includes('observacao'), 'Todas mostra a Observação');

for (const etapa of ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA', 'TODAS']) {
  const c = novo(etapa);
  assert.equal(c[c.length - 1], 'etapa', `${etapa}: Etapa fica por último`);
}

// ─── Histórico: as colunas de hoje, sem localidade nem data de lançamento ──
const HOJE = ['servico', 'tipo_serv', 'nsmps', 'equipes', 'nsprs', 'termino', 'valor_lancamento', 'valor_pago', 'faturas', 'observacao', 'etapa'];
for (const etapa of ['A_FECHAR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA', 'TODAS']) {
  assert.deepEqual(colunasVisiveis(etapa, true), HOJE, `${etapa} histórico: colunas de hoje`);
}
// Aguardando NSPR: NSPR, lançamento, valor pago e apropriação ainda não existem, nem no histórico
assert.deepEqual(colunasVisiveis('AGUARDANDO_NSPR', true), colunasVisiveis('AGUARDANDO_NSPR', false), 'NSPR: mesmas colunas no histórico');
assert.ok(!colunasVisiveis('TODAS', true).includes('data_lancamento_sf'), 'histórico não tem data de lançamento');
assert.ok(!colunasVisiveis('TODAS', true).includes('localidade'), 'histórico não tem localidade');

// Etapas só do histórico usam o conjunto histórico mesmo sem a marca
for (const etapa of ['AGUARDANDO_NSMP', 'AGUARDANDO_FATURA', 'SEM_COBRANCA']) {
  assert.deepEqual(colunasVisiveis(etapa, false), HOJE, `${etapa}: conjunto histórico`);
}

// ─── Listas NSIS / NSRI (19/11/2026): etapas próprias, sem coluna Tipo; NSRI sem NSMP (o número é a NSMC) ──
const { etapasDaLista, rotuloColuna } = require('../src/lib/fechamentoFluxo.ts');
assert.deepEqual(etapasDaLista('NSIS'), ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA']);
assert.deepEqual(etapasDaLista('NSRI'), ['A_FECHAR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA'], 'NSRI não tem NSPR');
assert.equal(rotuloColuna('nsprs', 'NSIS'), 'NSPR');
assert.equal(rotuloColuna('nsprs', 'NSRI'), 'NSMC');
assert.equal(rotuloColuna('nsprs'), 'NSPR/NSMC', 'sem lista, rótulo antigo');
for (const etapa of ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'FATURADA', 'TODAS']) {
  for (const hist of [false, true]) {
    assert.ok(!colunasVisiveis(etapa, hist, 'NSIS').includes('tipo_serv'), `${etapa}: lista sem coluna Tipo`);
    assert.ok(!colunasVisiveis(etapa, hist, 'NSRI').includes('nsmps'), `${etapa}: NSRI sem NSMP`);
  }
}
assert.deepEqual(colunasVisiveis('AGUARDANDO_SALESFORCE', false, 'NSRI'),
  ['servico', 'localidade', 'termino', 'equipes', 'nsprs', 'valor_pago', 'etapa']);
assert.deepEqual(colunasVisiveis('AGUARDANDO_SALESFORCE', false, 'NSIS'),
  ['servico', 'localidade', 'termino', 'equipes', 'nsmps', 'nsprs', 'valor_pago', 'etapa']);

console.log('OK: colunas da fila por etapa (fluxo novo, histórico e listas NSIS/NSRI).');
