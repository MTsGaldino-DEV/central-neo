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
    ['servico', 'N° Serviço'], ['tipo_serv', 'Tipo do serviço'], ['localidade', 'Localidade'], ['termino', 'DT execução'],
    ['equipes', 'Equipe'], ['supervisor', 'Supervisor'], ['nsmps', 'NSMP'], ['nsprs', 'NSPR'],
    ['valor_lancamento', 'Lançamento Salesforce'], ['valor_pago', 'Valor pago'], ['data_lancamento_sf', 'Data lançamento SF'],
    ['faturas', 'Apropriação'], ['observacao', 'Observação'], ['etapa', 'Etapa'],
  ],
  'COLUNAS_FLUXO com os rótulos da spec',
);

// ─── Fluxo novo: colunas acumulam por etapa, Etapa sempre por último ───────
const novo = (etapa) => colunasVisiveis(etapa, false);

assert.deepEqual(novo('A_FECHAR'), ['servico', 'tipo_serv', 'localidade', 'termino', 'etapa']);
assert.deepEqual(novo('AGUARDANDO_NSPR'), ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'supervisor', 'nsmps', 'etapa']);
assert.deepEqual(novo('AGUARDANDO_SALESFORCE'),
  ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'supervisor', 'nsmps', 'nsprs', 'valor_pago', 'etapa']);
assert.deepEqual(novo('AGUARDANDO_APROPRIACAO'),
  ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'supervisor', 'nsmps', 'nsprs', 'valor_pago', 'data_lancamento_sf', 'etapa']);
assert.deepEqual(novo('FATURADA'),
  ['servico', 'tipo_serv', 'localidade', 'termino', 'equipes', 'supervisor', 'nsmps', 'nsprs', 'valor_pago', 'data_lancamento_sf', 'faturas', 'etapa']);
assert.deepEqual(novo('TODAS'), COLUNAS_FLUXO.map((c) => c.id), 'Todas mostra todas as colunas');

for (const etapa of ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA', 'TODAS']) {
  const c = novo(etapa);
  assert.equal(c[c.length - 1], 'etapa', `${etapa}: Etapa fica por último`);
}

// ─── Histórico: as colunas de hoje, sem localidade nem data de lançamento ──
const HOJE = ['servico', 'tipo_serv', 'nsmps', 'equipes', 'supervisor', 'nsprs', 'termino', 'valor_lancamento', 'valor_pago', 'faturas', 'observacao', 'etapa'];
for (const etapa of ['A_FECHAR', 'AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_APROPRIACAO', 'FATURADA', 'TODAS']) {
  assert.deepEqual(colunasVisiveis(etapa, true), HOJE, `${etapa} histórico: colunas de hoje`);
}
assert.ok(!colunasVisiveis('TODAS', true).includes('data_lancamento_sf'), 'histórico não tem data de lançamento');
assert.ok(!colunasVisiveis('TODAS', true).includes('localidade'), 'histórico não tem localidade');

// Etapas só do histórico usam o conjunto histórico mesmo sem a marca
for (const etapa of ['AGUARDANDO_NSMP', 'AGUARDANDO_FATURA', 'SEM_COBRANCA']) {
  assert.deepEqual(colunasVisiveis(etapa, false), HOJE, `${etapa}: conjunto histórico`);
}

console.log('OK: colunas da fila por etapa (fluxo novo e histórico).');
