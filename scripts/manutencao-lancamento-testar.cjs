// Regras do lançamento de cobrança da Manutenção (funções puras); não acessa banco.
const fs = require('fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, f);
const {
  FATORES, FATORES_NOVOS, fatorPadrao, textoFator, calcularValor, totalPedido, agruparLancamentos, ratearPago,
} = require('../src/lib/fechamentoCobranca.ts');

// ─── Fator ──────────────────────────────────────────────────────────────────
assert.deepEqual(FATORES.map((f) => f.valor), [1, 1.2, 1.4]);
assert.deepEqual(FATORES_NOVOS.map((f) => f.valor), [1, 1.2], 'fluxo novo: só Urbano e CSC e Rural e CSC');
assert.deepEqual(FATORES_NOVOS.map((f) => f.rotulo), ['Urbano e CSC', 'Rural e CSC']);
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

// ─── Gravação do fluxo novo, com o Supabase simulado em memória ─────────────
const caminhoSupabase = require.resolve('../src/lib/supabase.ts');
let bd = { neo_nsis_itens: [], neo_nsis: [] };
const escritasBd = [];
let falharInsert = false;
function consulta(tabela) {
  const q = { op: 'select', filtros: [], patch: null, linhas: null, selecionar: false, unico: false };
  const api = {
    select() { q.selecionar = true; return api; },
    update(patch) { q.op = 'update'; q.patch = patch; return api; },
    insert(linhas) { q.op = 'insert'; q.linhas = linhas; return api; },
    upsert(linhas) { q.op = 'upsert'; q.linhas = linhas; return api; },
    delete() { q.op = 'delete'; return api; },
    eq(c, v) { q.filtros.push((r) => r[c] === v); return api; },
    in(c, vs) { q.filtros.push((r) => vs.includes(r[c])); return api; },
    order() { return api; },
    single() { q.unico = true; return api; },
    then(ok, falha) {
      const alvo = bd[tabela];
      const casa = (r) => q.filtros.every((f) => f(r));
      let data = null;
      if (q.op !== 'select') escritasBd.push({ tabela, op: q.op, patch: q.patch, linhas: q.linhas });
      if (q.op === 'insert' && falharInsert) return Promise.resolve({ data: null, error: { message: 'erro simulado' } }).then(ok, falha);
      if (q.op === 'update') { data = alvo.filter(casa); data.forEach((r) => Object.assign(r, q.patch)); }
      else if (q.op === 'insert') { data = q.linhas.map((l, i) => ({ id: 'novo-' + (alvo.length + i), ...l })); alvo.push(...data); }
      else if (q.op === 'upsert') { for (const l of q.linhas) Object.assign(alvo.find((r) => r.id === l.id), l); data = q.linhas; }
      else if (q.op === 'delete') { bd[tabela] = alvo.filter((r) => !casa(r)); }
      else data = alvo.filter(casa);
      return Promise.resolve({ data: q.unico ? data?.[0] ?? null : q.selecionar || q.op === 'select' ? data : null, error: null }).then(ok, falha);
    },
  };
  return api;
}
require.cache[caminhoSupabase] = { id: caminhoSupabase, filename: caminhoSupabase, loaded: true, exports: { supabase: { from: consulta } } };
const lib = require('../src/lib/fechamento.ts');
const novoItem = (id, extra = {}) => ({
  id, servico: 'S1', descricao: 'Item ' + id, codigo: '7040' + id, quantidade: 1, fator: 1, fator_unitario: 0.1, equipe: '4404', valor_inicial: 0.1, us_adicional: null,
  nsmp: 'M1', nspr: null, valor_final: null, fatura: null, observacao: null, ...extra,
});
const comoNsis = (extra = {}) => ({ servico: 'S1', tipo_serv: 'NSIS', ...extra });
const semEscrita = async (acao, mensagem) => {
  const antes = escritasBd.length;
  await assert.rejects(acao, mensagem);
  assert.equal(escritasBd.length, antes, 'a validação falha antes de gravar qualquer coisa');
};

(async () => {
  // Desfazer etapa 2: some a NSPR e o valor pago de todos os códigos; o resto fica
  bd = {
    neo_nsis_itens: [novoItem('1', { nspr: 'P1', valor_final: 0.1, fatura: 'AP 1' }), novoItem('2', { nspr: 'P1', valor_final: 0.2, fatura: 'AP 1' })],
    neo_nsis: [{ servico: 'S1', data_lancamento_sf: '2026-11-05', supervisor_equipe: 'Ana' }],
  };
  await lib.desfazerNspr(bd.neo_nsis_itens);
  assert.deepEqual(bd.neo_nsis_itens.map((i) => [i.nspr, i.valor_final, i.nsmp, i.fatura]), [[null, null, 'M1', 'AP 1'], [null, null, 'M1', 'AP 1']], 'só NSPR e valor pago saem');

  // Desfazer etapa 3: some a data do Salesforce
  await lib.desfazerLancamentoSf('S1');
  assert.equal(bd.neo_nsis[0].data_lancamento_sf, null);
  assert.equal(bd.neo_nsis[0].supervisor_equipe, 'Ana', 'o supervisor fica');

  // Desfazer etapa 4: some a AP, a NSPR fica
  bd.neo_nsis_itens.forEach((i) => { i.nspr = 'P1'; });
  await lib.desfazerApropriacao(bd.neo_nsis_itens);
  assert.deepEqual(bd.neo_nsis_itens.map((i) => [i.fatura, i.nspr]), [[null, 'P1'], [null, 'P1']]);

  // Etapa 1 valida antes de gravar: nada é gravado se falta algo
  bd = { neo_nsis_itens: [], neo_nsis: [{ servico: 'S1', supervisor_equipe: null }] };
  const campos = {
    descricao: 'Cruzeta', codigo: '704001', quantidade: 1, fator: 1, fator_unitario: 0.1, valor_inicial: 0.1, us_adicional: null,
    equipe: null, nsmp: null, nspr: null, valor_final: null, fatura: null, observacao: null,
  };
  await semEscrita(() => lib.fecharEtapa1(comoNsis(), { itens: [], equipe: '4404', nsmp: 'M1', supervisor: null, valorPagoUS: null }), /ao menos um código/);
  await semEscrita(() => lib.fecharEtapa1(comoNsis(), { itens: [campos], equipe: ' ', nsmp: 'M1', supervisor: null, valorPagoUS: null }), /equipe/);
  await semEscrita(() => lib.fecharEtapa1(comoNsis(), { itens: [campos], equipe: '4404', nsmp: '', supervisor: null, valorPagoUS: null }), /NSMP/);
  await semEscrita(() => lib.fecharEtapa1(comoNsis({ tipo_serv: 'NSRI' }), { itens: [campos], equipe: '4404', nsmp: 'C1', supervisor: null, valorPagoUS: null }), /valor pago/);
  await lib.fecharEtapa1(comoNsis({ tipo_serv: 'NSRI' }), {
    itens: [campos, { ...campos, codigo: '704002', valor_inicial: 0.3 }], equipe: '4404', nsmp: 'C1', supervisor: 'Pedro', valorPagoUS: 0,
  });
  assert.deepEqual(bd.neo_nsis_itens.map((i) => [i.nsmp, i.equipe, i.valor_final, i.nspr]), [['C1', '4404', 0, null], ['C1', '4404', 0, null]], 'NSRI: NSMC, valor pago zero aceito, sem NSPR');
  assert.equal(bd.neo_nsis[0].supervisor_equipe, 'Pedro');
  assert.equal(bd.neo_nsis[0].fluxo_novo, true, 'a etapa 1 marca a NSIS como fluxo novo');

  // Ordem das gravações: primeiro a NSIS (fluxo_novo e supervisor), depois os itens
  bd = { neo_nsis_itens: [], neo_nsis: [{ servico: 'S1', fluxo_novo: false, supervisor_equipe: null }] };
  escritasBd.length = 0;
  await lib.fecharEtapa1(comoNsis(), { itens: [campos], equipe: '4404', nsmp: 'M1', supervisor: ' Vinícius ', valorPagoUS: null });
  assert.deepEqual(escritasBd.map((e) => [e.tabela, e.op]), [['neo_nsis', 'update'], ['neo_nsis_itens', 'insert']], 'neo_nsis antes dos itens');
  assert.deepEqual(escritasBd[0].patch, { fluxo_novo: true, supervisor_equipe: 'Vinícius' });
  assert.equal(bd.neo_nsis_itens.length, 1);

  // Se os itens falharem: erro claro e nenhum item parcial (a NSIS fica sem itens, ainda em "A fechar")
  bd = { neo_nsis_itens: [], neo_nsis: [{ servico: 'S1', fluxo_novo: false, supervisor_equipe: null }] };
  falharInsert = true;
  await assert.rejects(
    () => lib.fecharEtapa1(comoNsis(), { itens: [campos, { ...campos, codigo: '704002' }], equipe: '4404', nsmp: 'M1', supervisor: null, valorPagoUS: null }),
    /^Error: Falha ao salvar os códigos: erro simulado/,
  );
  falharInsert = false;
  assert.equal(bd.neo_nsis_itens.length, 0, 'nenhum item parcial');

  // Regra de fluxo novo: marcada no banco, ou A fechar sem itens e sem "sem cobrança"
  const reg = (extra) => lib.ehFluxoNovo({ fluxo_novo: false, etapa: 'A_FECHAR', qtd_itens: 0, sem_cobranca: false, ...extra });
  assert.equal(reg({}), true, 'histórica sem itens em A fechar conta como fluxo novo');
  assert.equal(reg({ fluxo_novo: true, etapa: 'AGUARDANDO_NSPR', qtd_itens: 2 }), true);
  assert.equal(reg({ etapa: 'AGUARDANDO_FATURA', qtd_itens: 1 }), false, 'histórica com itens segue o layout antigo');
  assert.equal(reg({ qtd_itens: 1 }), false);
  assert.equal(reg({ etapa: 'SEM_COBRANCA', sem_cobranca: true }), false);
  assert.equal(reg({ sem_cobranca: true }), false);
  assert.equal(lib.ehFluxoNovo({ fluxo_novo: false, etapa: 'A_FECHAR', qtd_itens: 3, sem_cobranca: false }, 0), true, 'a quantidade de itens da janela prevalece');

  // NSPR e AP vazias, valor inválido, data vazia ou futura: recusadas sem gravar
  const itensNspr = [novoItem('1')];
  bd = { neo_nsis_itens: itensNspr, neo_nsis: [{ servico: 'S1', data_lancamento_sf: null }] };
  await semEscrita(() => lib.informarNspr(itensNspr, ' ', 1), /NSPR/);
  await semEscrita(() => lib.informarNspr(itensNspr, 'P1', Number.NaN), /valor pago/);
  await semEscrita(() => lib.informarApropriacao(itensNspr, ' '), /apropriação/);
  await semEscrita(() => lib.informarLancamentoSf('S1', ''), /Informe a data/);
  await semEscrita(() => lib.informarLancamentoSf('S1', '2099-01-01'), /futura/);
  await semEscrita(() => lib.informarLancamentoSf('S1', '2026-02-31'), /inválida/);
  await lib.informarNspr(itensNspr, 'P1', 0);
  assert.deepEqual([itensNspr[0].nspr, itensNspr[0].valor_final], ['P1', 0], 'valor pago zero é aceito');
  await lib.informarLancamentoSf('S1', '2026-11-05');
  assert.equal(bd.neo_nsis[0].data_lancamento_sf, '2026-11-05');
  await lib.informarApropriacao(itensNspr, '83809');
  assert.equal(itensNspr[0].fatura, 'AP 83809');

  // Corrigir a etapa 1 depois da NSPR: atualiza no lugar, apaga o que saiu, copia NSPR e AP para o novo e refaz o rateio do total pago
  bd = {
    neo_nsis_itens: [novoItem('1', { nspr: 'P1', valor_final: 0.1, fatura: 'AP 9' }), novoItem('2', { nspr: 'P1', valor_final: 0.2, fatura: 'AP 9', valor_inicial: 0.2 })],
    neo_nsis: [{ servico: 'S1', supervisor_equipe: 'Ana' }],
  };
  const atuais = [...bd.neo_nsis_itens];
  await lib.corrigirEtapa1(comoNsis(), atuais, {
    itens: [
      { id: '1', descricao: 'Item 1', codigo: '70401', quantidade: 2, fator: 1.2, fator_unitario: 0.1, valor_inicial: 0.24 },
      { descricao: 'Novo', codigo: '704009', quantidade: 1, fator: 1.2, fator_unitario: 0.06, valor_inicial: 0.072 },
    ],
    equipe: '4052', nsmp: 'M2', supervisor: 'Elton', valorPagoUS: null,
  });
  assert.deepEqual(bd.neo_nsis_itens.map((i) => i.codigo), ['70401', '704009'], 'o item 2 saiu e o novo entrou');
  assert.ok(bd.neo_nsis_itens.every((i) => i.equipe === '4052' && i.nsmp === 'M2' && i.nspr === 'P1' && i.fatura === 'AP 9'), 'equipe e NSMP novas; NSPR e AP seguem');
  assert.equal(Math.round(bd.neo_nsis_itens.reduce((s, i) => s + i.valor_final, 0) * 10000) / 10000, 0.3, 'o total pago continua o mesmo');
  assert.equal(bd.neo_nsis[0].supervisor_equipe, 'Elton');

  console.log('OK: fator, valor do código, agrupamento por NSMP, rateio do valor pago e gravação das etapas do fluxo novo.');
})().catch((e) => { console.error(e); process.exitCode = 1; });

