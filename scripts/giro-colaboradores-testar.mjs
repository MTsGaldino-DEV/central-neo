// Teste puro do núcleo da função giro-colaboradores (sem rede, sem banco).
// Rodar: node --experimental-strip-types scripts/giro-colaboradores-testar.mjs
import assert from 'node:assert/strict';
import {
  COLUNAS_PERMITIDAS,
  segredoConfere,
  projetar,
  paginar,
} from '../supabase/functions/giro-colaboradores/nucleo.ts';

let falhas = 0;
function caso(nome, fn) {
  try {
    fn();
    console.log('ok   ' + nome);
  } catch (e) {
    falhas++;
    console.log('FALHA ' + nome + '\n     ' + e.message);
  }
}

const CONTRATO = [
  'id', 'nome', 'cpf', 'matricula_cemig', 'matricula_engelmig', 'cargo',
  'supervisor', 'base', 'data_admissao', 'data_desligamento', 'ativo', 'atualizado_em',
];
const PROIBIDAS = ['email', 'telefone', 'observacao', 'usuario_id', 'gc', 'go', 'equipe'];

const linhaCompleta = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'Fulano de Tal',
  cpf: '12345678901',
  matricula_cemig: 'e272662',
  matricula_engelmig: '4321',
  email: 'x@exemplo.invalido',
  telefone: '31999999999',
  cargo: 'Eletricista',
  equipe: 'EQ-1',
  supervisor: 'João da Silva',
  gc: 'Fulano GC',
  go: 'Fulano GO',
  base: 'Contagem',
  data_admissao: '2020-01-02',
  data_desligamento: null,
  ativo: true,
  observacao: 'texto interno',
  usuario_id: '22222222-2222-2222-2222-222222222222',
  criado_em: '2020-01-02T00:00:00Z',
  atualizado_em: '2026-11-01T10:00:00Z',
  criado_por: null,
  atualizado_por: null,
};

caso('COLUNAS_PERMITIDAS é exatamente o contrato de 12 colunas', () => {
  assert.deepEqual([...COLUNAS_PERMITIDAS].sort(), [...CONTRATO].sort());
});

caso('segredoConfere: segredo recebido nulo é recusado', () => {
  assert.equal(segredoConfere(null, 'x'), false);
});
caso('segredoConfere: segredo esperado vazio ou ausente recusa tudo', () => {
  assert.equal(segredoConfere('x', ''), false);
  assert.equal(segredoConfere('x', undefined), false);
  assert.equal(segredoConfere('', ''), false);
});
caso('segredoConfere: igual passa, diferente (mesmo tamanho ou não) falha', () => {
  assert.equal(segredoConfere('abc', 'abc'), true);
  assert.equal(segredoConfere('abd', 'abc'), false);
  assert.equal(segredoConfere('abcd', 'abc'), false);
  assert.equal(segredoConfere('ab', 'abc'), false);
});

caso('projetar devolve exatamente as 12 chaves do contrato', () => {
  const p = projetar(linhaCompleta);
  assert.deepEqual(Object.keys(p).sort(), [...CONTRATO].sort());
  for (const k of PROIBIDAS) assert.equal(k in p, false, 'vazou ' + k);
  assert.equal(p.nome, 'Fulano de Tal');
  assert.equal(p.matricula_engelmig, '4321');
});
caso('projetar transforma campos ausentes em null e mantém ativo booleano', () => {
  const p = projetar({ id: 'a', nome: 'B', ativo: true, atualizado_em: 't' });
  assert.equal(p.cpf, null);
  assert.equal(p.supervisor, null);
  assert.equal(p.data_desligamento, null);
  assert.equal(p.ativo, true);
});

function linhas(n) {
  return Array.from({ length: n }, (_, i) => ({ ...projetar({ ...linhaCompleta, id: 'id-' + (i + 1) }) }));
}
caso('paginar: 3 linhas com limite 2 devolve 2 e proxima = id da 2ª', () => {
  const r = paginar(linhas(3), 2, 10);
  assert.equal(r.linhas.length, 2);
  assert.equal(r.proxima, 'id-2');
  assert.equal(r.total, 10);
});
caso('paginar: 2 linhas com limite 2 devolve proxima nula', () => {
  const r = paginar(linhas(2), 2, 2);
  assert.equal(r.linhas.length, 2);
  assert.equal(r.proxima, null);
});
caso('paginar: lista vazia devolve proxima nula', () => {
  const r = paginar([], 500, 0);
  assert.equal(r.linhas.length, 0);
  assert.equal(r.proxima, null);
});

if (falhas) {
  console.log('\n' + falhas + ' falha(s)');
  process.exit(1);
}
console.log('\ntodos os casos passaram');
