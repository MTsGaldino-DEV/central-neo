// Textos da conferência por serviço, soma de totais e cache; puro, sem banco.
const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {fraseServico,notaCalculo,somarTotais,variacao,MOTIVOS_FAT,SITUACOES_SERVICO_FAT}=require('../src/lib/faturamentoTexto.ts');
const base={situacao_calculo:'A_MENOS',devido:0.0234,creditado:0.0164,codigo_principal:'5.14',tipo_turma:'D',fator_aplicado:'CSC',moto:false,rc_por_atendimento:false,qtd_linhas:1,parcial:false};
assert.equal(fraseServico({...base,motivo:'MOTO_INDEVIDO'}),
 'Deveria pagar 0,023400 (5.14, fator normal) e pagou 0,016400: aplicaram o desconto de Moto 0,7 numa equipe Multifuncional.');
assert.equal(fraseServico({...base,motivo:'RC_NAO_PAGO',codigo_principal:'RC07',rc_por_atendimento:true,qtd_linhas:2,creditado:0,devido:0.0912}),
 'RC07 deveria ser pago uma vez (0,091200), mas nenhuma das 2 linhas do atendimento recebeu crédito.');
assert.equal(fraseServico({...base,situacao_calculo:'OK',motivo:null,creditado:0.0234}),'Pago conforme o contrato.');
assert.equal(fraseServico({...base,situacao_calculo:'OK',motivo:null,creditado:0,multas:0.0234}),
 'Glosado: a multa de 0,023400 cobre o valor devido. Multas ficam fora do saldo.');
assert.match(fraseServico({...base,motivo:'OUTRA'}),/^Deveria pagar 0,023400 .* e pagou 0,016400\.$/);
assert.match(fraseServico({...base,situacao_calculo:'A_MAIS',motivo:'FATOR_MAIOR',creditado:0.03}),/acima do contrato\.$/);
assert.match(fraseServico({...base,situacao_calculo:'FORA_CONTRATO',motivo:null,devido:null}),/fora do contrato/);
assert.equal(notaCalculo({...base,rc_por_atendimento:true,codigo_principal:'RC07'},['5.14','7.42']),
 'RC07 pago uma vez por atendimento; os códigos 5.14 e 7.42 só indicam o trabalho feito.');
assert.equal(notaCalculo({...base,qtd_linhas:2},['7.15','7.10']),'Pagamento por código: cada código (7.15 e 7.10) é pago na sua linha.');
assert.ok(fraseServico({...base,parcial:true,motivo:'OUTRA'}).endsWith(' Parte dos códigos não tem fator no contrato.'));
// parcial compara só o que tem fator
assert.match(fraseServico({...base,motivo:'FATOR_MENOR',creditado:0.05,pago_comparado:0.0164,parcial:true}),/pagou 0,016400/);
const t=(n,o)=>({fatura:n,inicio:'2026-0'+(n==='9799'?'6':'9')+'-01',fim:'2026-0'+(n==='9799'?'7':'9')+'-30',linhas:1,servicos:1,creditado:o,multas:0,estorno:0,devido:o,diferenca:0,sem_fator_servicos:0,parciais:0,saldo_a_receber:o,pago_a_mais:0,
 a_menos:{servicos:1,por_motivo:{OUTRA:{us:o,servicos:1}}},a_mais:{servicos:0,por_motivo:{}},
 funil:{importados:1,equipe_identificada:1,codigo_no_contrato:1,valor_confere:0,conferidos:0},
 grupos:{tipo_turma:[{valor:'M',servicos:1,creditado:o,devido:o,multas:0}],codserv:[],cidade:[]},ajustes:{debito:0,credito:0,itens:[]}});
const s=somarTotais([t('9799',1),t('9844',2)]);
assert.equal(s.fatura,'9799, 9844');assert.equal(s.inicio,'2026-06-01');assert.equal(s.fim,'2026-09-30');
assert.equal(s.saldo_a_receber,3);assert.equal(s.a_menos.por_motivo.OUTRA.servicos,2);assert.equal(s.a_menos.por_motivo.OUTRA.us,3);
assert.equal(s.funil.importados,2);
assert.deepEqual(s.grupos.tipo_turma,[{valor:'M',servicos:2,creditado:3,devido:3,multas:0}]);
assert.equal(somarTotais([]).servicos,0);
assert.equal(variacao(903.33,871.05).toFixed(1),'3.7');assert.equal(variacao(1,0),null);
assert.equal(Object.keys(MOTIVOS_FAT).length,6);assert.equal(SITUACOES_SERVICO_FAT.A_MENOS,'Pagou a menos');
console.log('OK: textos e soma de totais.');
