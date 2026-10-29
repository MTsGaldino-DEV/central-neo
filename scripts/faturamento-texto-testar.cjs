// Textos da conferência por serviço, soma de totais e cache; puro, sem banco.
const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {fraseServico,notaCalculo,somarTotais,variacao,MOTIVOS_FAT,SITUACOES_SERVICO_FAT}=require('../src/lib/faturamentoTexto.ts');
const base={situacao_calculo:'A_MENOS',devido:0.0234,creditado:0.0164,codigo_principal:'5.14',tipo_turma:'D',fator_aplicado:'CSC',moto:false,rc_por_atendimento:false,qtd_linhas:1,parcial:false};
assert.equal(fraseServico({...base,motivo:'MOTO_INDEVIDO'}),
 'Deveria pagar 0,023400 (5.14, fator normal) e pagou 0,016400: aplicaram o desconto de Moto 0,7 numa equipe Multifuncional.');
assert.equal(fraseServico({...base,motivo:'RC_NAO_PAGO',codigo_principal:'RC07',rc_por_atendimento:true,qtd_linhas:2,creditado:0,devido:0.0912}),
 'RC07 deveria ser pago uma vez (0,091200), mas nenhuma das 2 linhas do atendimento recebeu crédito.');
assert.equal(fraseServico({...base,motivo:'RC_NAO_PAGO',codigo_principal:'RC08',rc_por_atendimento:true,qtd_linhas:1,creditado:0,devido:0.139901}),
 'RC08 deveria ser pago uma vez (0,139901), mas a linha do atendimento não recebeu crédito.');
assert.equal(fraseServico({...base,situacao_calculo:'OK',motivo:null,creditado:0.0234}),'Pago conforme o contrato.');
assert.equal(fraseServico({...base,situacao_calculo:'OK',motivo:null,creditado:0,multas:0.0234}),
 'A CEMIG não pagou e glosou 0,023400, o valor do contrato: confere.');
assert.match(fraseServico({...base,motivo:'OUTRA'}),/^Deveria pagar 0,023400 .* e pagou 0,016400\.$/);
assert.match(fraseServico({...base,situacao_calculo:'A_MAIS',motivo:'FATOR_MAIOR',creditado:0.03}),/acima do contrato\.$/);
assert.match(fraseServico({...base,situacao_calculo:'FORA_CONTRATO',motivo:null,devido:null}),/fora do contrato/);
// glosa com nada pago (048): menor que o contrato → falta o resto (246310816); quantidade zerada → conferir à mão
assert.equal(fraseServico({...base,situacao_calculo:'A_CONFERIR',motivo:'GLOSA_SEM_QUANTIDADE',creditado:0,devido:0,multas:0.498877}),
 'A CEMIG glosou 0,498877 e zerou a quantidade: não dá para calcular o contrato. Confira à mão pela linha do código.');
assert.equal(fraseServico({...base,situacao_calculo:'A_CONFERIR',motivo:'GLOSA_ACIMA',creditado:0,devido:0.01,multas:0.02}),
 'A CEMIG glosou 0,020000, mais que o contrato (0,010000). Confira à mão.');
assert.equal(fraseServico({...base,motivo:'GLOSA_PARCIAL',codigo_principal:'5.63',creditado:0,pago_comparado:0,devido:0.004388,multas:0.003657}),
 'A CEMIG glosou 0,003657 de 0,004388 (5.63) e não pagou o resto: faltam 0,000731.');
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
assert.equal(Object.keys(MOTIVOS_FAT).length,9);assert.equal(SITUACOES_SERVICO_FAT.A_CONFERIR,'Conferir à mão');assert.equal(SITUACOES_SERVICO_FAT.A_MENOS,'Pagou a menos');
// cache dos últimos dados: armazenamento bloqueado ou corrompido não quebra a tela
const {lerCache,gravarCache,tempoRelativo}=require('../src/lib/cacheTela.ts');
const mem=new Map(),arm={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
gravarCache('painel',{a:1},arm);assert.deepEqual(lerCache('painel',arm).dados,{a:1});
assert.ok(mem.has('neo-fat:painel'));assert.equal(typeof lerCache('painel',arm).salvoEm,'number');
assert.equal(lerCache('outra',arm),null);
const quebrado={getItem(){throw new Error('bloqueado')},setItem(){throw new Error('bloqueado')}};
assert.equal(lerCache('painel',quebrado),null);assert.doesNotThrow(()=>gravarCache('painel',{a:1},quebrado));
mem.set('neo-fat:ruim','{nao json');assert.equal(lerCache('ruim',arm),null);
assert.equal(lerCache('painel'),null);assert.doesNotThrow(()=>gravarCache('painel',{a:1}));   // Node sem localStorage
assert.equal(tempoRelativo(0,30_000),'agora');assert.equal(tempoRelativo(0,120_000),'há 2 min');
assert.equal(tempoRelativo(0,3*3600_000),'há 3 h');assert.equal(tempoRelativo(0,2*86400_000),'há 2 dias');
assert.equal(tempoRelativo(0,86400_000),'há 1 dia');
// cache com limite: não enche o localStorage (que guarda também a sessão de login)
const loja=new Map(),armLoja={getItem:k=>loja.get(k)??null,setItem:(k,v)=>loja.set(k,v),removeItem:k=>loja.delete(k),key:i=>[...loja.keys()][i]??null,get length(){return loja.size;}};
loja.set('sb-auth-token','sessao');
for(let i=0;i<40;i++)gravarCache('servicos:'+i,{i},armLoja);
const chavesFat=[...loja.keys()].filter(k=>k.startsWith('neo-fat:'));
assert.ok(chavesFat.length<=20,`cache com ${chavesFat.length} chaves`);
assert.ok(loja.has('neo-fat:servicos:39'));assert.equal(loja.get('sb-auth-token'),'sessao');
console.log('OK: textos, soma de totais e cache.');
// período do cabeçalho (sem input de data nativo)
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
const {rotuloPeriodo,atalhoPeriodo}=require('../src/components/faturamento/SeletorPeriodo.tsx');
assert.equal(rotuloPeriodo({de:'2026-07-01',ate:'2026-09-30'}),'jul – set / 2026');
assert.equal(rotuloPeriodo({de:'2026-09-01',ate:'2026-09-30'}),'set / 2026');
assert.equal(rotuloPeriodo({de:'2025-11-01',ate:'2026-01-31'}),'nov/2025 – jan/2026');
assert.equal(rotuloPeriodo({de:'',ate:''}),'todo o período');
assert.deepEqual(atalhoPeriodo('3m','2026-10-01'),{de:'2026-08-01',ate:'2026-10-31'});
assert.deepEqual(atalhoPeriodo('mes','2026-02-10'),{de:'2026-02-01',ate:'2026-02-28'});
assert.deepEqual(atalhoPeriodo('6m','2026-03-15'),{de:'2025-10-01',ate:'2026-03-31'});
assert.deepEqual(atalhoPeriodo('ano','2026-03-15'),{de:'2026-01-01',ate:'2026-12-31'});
console.log('OK: período do cabeçalho.');
// fator e valor Moto da tabela do contrato (mesma regra urbana da migration 023)
const {valorMoto}=require('../src/lib/faturamentoMoto.ts');
assert.deepEqual(valorMoto({tabela:'11',moto:'1',fator_csc:0.0234,fator_cod:0.03},0.7),{fator:1,csc:0.0234,cod:0.03,semDesconto:true,naoPaga:false});
assert.deepEqual(valorMoto({tabela:'11',moto:'0',fator_csc:0.0234,fator_cod:0.03},0.7),{fator:0,csc:null,cod:null,semDesconto:false,naoPaga:true});
const vm=valorMoto({tabela:'11',moto:'0,7',fator_csc:0.0234,fator_cod:null},0.7);
assert.equal(vm.fator,0.7);assert.equal(vm.csc.toFixed(6),'0.016380');assert.equal(vm.cod,null);
assert.equal(valorMoto({tabela:'12',moto:null,fator_csc:0.0912,fator_cod:0.1},0.7).fator,0.7);
assert.equal(valorMoto({tabela:'12',moto:'1',fator_csc:0.0912,fator_cod:0.1},0.7).fator,0.7);   // exceção só vale na Tabela 11
console.log('OK: valor Moto do contrato.');
// valores em R$ ou US (rodada 2): um valor da US para todo o Faturamento
{
const {valorFat,outraUnidadeFat,somarTotais:somar}=require('../src/lib/faturamentoTexto.ts');
assert.equal(valorFat(-7.447278,'reais',2964.33,true),'−R$ 22.076,19');
assert.equal(valorFat(17.001786,'us',2964.33,true),'+17,001786 US');
assert.equal(valorFat(5.1968,'reais',2964.33),'R$ 15.405,03');
assert.ok(valorFat(1,'reais',null).endsWith(' US'),'sem valor da US cai em US');
assert.ok(outraUnidadeFat(0.3288,'reais',2964.33).endsWith(' US'));
assert.equal(outraUnidadeFat(1,'us',2964.33),'R$ 2.964,33');
assert.equal(outraUnidadeFat(1,'reais',null),null);
assert.equal(valorFat(null,'reais',2964.33),'—');
const lado=(n,o)=>({servicos:n,us:o,pago:o,devido:2*o,por_motivo:{}});
const tt=(f,o)=>({...somar([]),fatura:f,inicio:'2026-09-01',fim:'2026-09-30',importado_em:'x',fora_contrato:o,
  a_menos:{...lado(1,o),com_1ns:o},a_mais:{...lado(2,o),c562:{servicos:o,us:o}}});
const st=somar([tt('1',1),tt('2',2)]);
assert.equal(st.a_menos.pago,3);assert.equal(st.a_menos.devido,6);assert.equal(st.a_menos.us,3);assert.equal(st.a_menos.com_1ns,3);
assert.equal(st.a_mais.c562.servicos,3);assert.equal(st.a_mais.c562.us,3);assert.equal(st.fora_contrato,3);
console.log('OK: valores em R$ ou US e totais por lado.');
}
// Fator pago sobre a base do contrato (CSC urbano × 1,0)
{
const {baseServicoFat,fatorSobreBaseFat}=require('../src/lib/faturamentoFator.ts');
const contrato=[{tabela:'11',codigo:'5.14',fator_csc:0.1},{tabela:'12',codigo:'RC08',fator_csc:0.116584},{tabela:'11',codigo:'1.62',fator_csc:null}];
const b1=baseServicoFat([{codserv:'5.14',tabela:'11',urbano:0,rural:2}],contrato,false);
assert.equal(Math.round(b1*1e6)/1e6,0.2);assert.equal(fatorSobreBaseFat(0.24,b1),1.2);assert.equal(fatorSobreBaseFat(0.28,b1),1.4);
// RC por atendimento: um RC, mesmo com duas linhas
const b2=baseServicoFat([{codserv:'RC08',tabela:'12',urbano:1,rural:0},{codserv:'RC08',tabela:'12',urbano:1,rural:0}],contrato,true);
assert.equal(b2,0.116584);assert.equal(fatorSobreBaseFat(0.139901,b2),1.2);
// linha real do RC: código do trabalho (1.02) e o RC no tipo do serviço (246480975: RC06 rural pago como COD rural)
const rc06=[...contrato,{tabela:'12',codigo:'RC06',fator_csc:0.113918},{tabela:'11',codigo:'1.02',fator_csc:0.066858}];
const b4=baseServicoFat([{codserv:'1.02',tipo_serv:'RC06',tabela:'12',urbano:0,rural:1}],rc06,true);
assert.equal(b4,0.113918);assert.equal(fatorSobreBaseFat(0.136702,b4),1.2);assert.equal(fatorSobreBaseFat(0.164041,b4),1.44);
// homem-hora: horas × US/h
const b3=baseServicoFat([{codserv:'1.62',tabela:'11',urbano:0,rural:0,horas:2.216667,us_hora:0.1097}],contrato,false);
assert.equal(fatorSobreBaseFat(0.243168,b3),1);assert.equal(fatorSobreBaseFat(0.340436,b3),1.4);
assert.equal(baseServicoFat([{codserv:'X',tabela:'11',urbano:1,rural:0}],contrato,false),null);
assert.equal(fatorSobreBaseFat(0,b1),0);assert.equal(fatorSobreBaseFat(1,null),null);
console.log('OK: fator pago sobre a base do contrato.');
}
