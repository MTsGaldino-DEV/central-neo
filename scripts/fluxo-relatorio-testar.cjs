// Leitura do relatório do GDIS: filtro da coluna Resp. (CONTRATADA e MULTIFUNCIONAL entram).
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const XLSX = require('xlsx');

// Transpila o módulo .ts na hora e resolve './fechamentoFormato' pelo mesmo caminho.
const srcDir = path.join(__dirname, '..', 'src', 'lib');
const cache = {};
function carregar(arquivo) {
  if (cache[arquivo]) return cache[arquivo].exports;
  const js = ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  cache[arquivo] = mod;
  const req = (id) => {
    if (id === 'xlsx') return XLSX;
    if (id.startsWith('./')) return carregar(path.join(srcDir, `${id.slice(2)}.ts`));
    return require(id);
  };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, req);
  return mod.exports;
}
const { lerRelatorioNsis, RESP_ACEITOS } = carregar(path.join(srcDir, 'fechamentoPlanilhas.ts'));

assert.deepEqual(RESP_ACEITOS, ['CONTRATADA', 'MULTIFUNCIONAL']);

// ─── Planilha em memória imitando o relatório ──────────────────────────────
const cabecalho = ['Serviço', 'Referência', 'Endereço', 'Pedido', 'Término', 'Resp', 'Matrícula', 'Nome',
  'Tempo Deslocamento', 'Tempo Execução', 'Atendimento Prazo Legal', 'Tipo de Serv.', 'Observação', 'Tipo', 'Referência'];
const linha = (servico, resp) => [String(servico), '1234 CENTRO', 'RUA A, 10', '13/10/2026 08:00', '13/10/2026 12:20',
  resp, 'ab123', 'FULANO', '00:10', '00:40', 'SIM', 'NSIS', 'obs', 'U', 'LOCAL X'];
const dados = [
  ['Serviços Executados - Completo'],
  ['No período de'],
  ['01/10/2026'],
  ['a'],
  ['31/10/2026'],
  [],
  cabecalho,
  linha(100000001, 'CONTRATADA'),
  linha(100000002, 'MULTIFUNCIONAL'),
  linha(100000003, 'multifuncional '),
  linha(100000004, 'TERCEIRO'),
  linha(100000005, ''),
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dados), 'Relatorio');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const r = lerRelatorioNsis(ab);
assert.equal(r.erro, undefined, `erro inesperado: ${r.erro}`);
assert.equal(r.totalLinhas, 5);
assert.deepEqual(r.linhas.map((l) => l.servico), ['100000001', '100000002', '100000003']);
assert.deepEqual(r.linhas.map((l) => l.resp), ['CONTRATADA', 'MULTIFUNCIONAL', 'MULTIFUNCIONAL'],
  'resp gravado em maiúsculas e sem espaços');

const motivos = Object.fromEntries(r.ignoradas.map((i) => [i.motivo, i.qtd]));
assert.deepEqual(motivos, { 'Responsável TERCEIRO': 1, 'Responsável vazio': 1 });

console.log('OK: Resp CONTRATADA e MULTIFUNCIONAL entram; TERCEIRO e vazio ficam ignorados.');
