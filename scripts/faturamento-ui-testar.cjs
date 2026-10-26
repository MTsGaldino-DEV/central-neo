// Interface real + arquivos reais, com Supabase interceptado (nenhuma escrita remota).
// Instale Playwright fora do app: npm install --prefix .tmp-faturamento/browser playwright
// Rode com `npm run dev` aberto (ou NEO_TEST_URL apontando para o app).
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const {chromium}=require('../.tmp-faturamento/browser/node_modules/playwright');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const api=new URL(env.VITE_NEO_SUPABASE_URL),id='00000000-0000-0000-0000-000000000001';
const usuario={id,email:'teste@example.invalid',aud:'authenticated',role:'authenticated'};
const sessao={access_token:'teste-local',refresh_token:'teste-local',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:usuario};
const dir=path.resolve('Comparação de fatura'),arquivos=fs.readdirSync(dir),saida=path.resolve('.tmp-faturamento');
const arqResumida=path.join(dir,arquivos.find(n=>n.startsWith('Resumo_Fat_9844'))),arqCompleta=path.join(dir,arquivos.find(n=>n.startsWith('RelatorioDadosFatura9844')));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const urlBase=(process.env.NEO_TEST_URL||'http://127.0.0.1:5173').replace(/\/$/,'');
const postgres=require('../../traceone/frontend/node_modules/postgres');
(async()=>{
 // Respostas reais do banco, lidas numa transação desfeita no fim (o painel grava totais, que voltam).
 const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
 const real={};
 try{
   await sql.begin(async t=>{
     const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
     await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
     real.contrato=await t`select * from neo_fat_contrato`;
     await t`select neo_fat_atualizar_totais('9844')`;
     real.painel=(await t`select neo_fat_painel() d`)[0].d;
     real.valorUs=(await t`select neo_fat_valor_us() d`)[0].d;
     real.manutencao={};for(const n of ['246101137','245579601'])real.manutencao[n]=(await t`select neo_fat_servico_manutencao(${n}) d`)[0].d;
     real.historico=(await t`select neo_fat_servico_historico('9844','246101137') d`)[0].d;
     for(const lado of ['a_menos','a_mais','todos'])real[lado]=(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado})},0,50) d`)[0].d;
     real.linhas=(await t`select neo_fat_servico_linhas('9844',${real.a_menos.servicos[0].numserv}) d`)[0].d;
     throw new Error('rollback');
   });
 }catch(e){if(e.message!=='rollback')throw e;}finally{await sql.end();}
 const estado={painel:'real',lista:'real',hashes:'nenhum',faturas:'existe',desatualizadas:[],valorUs:'real'},chamadasLista=[],chamadasValores=[],avaliacoes=[],totaisPedidos=[],lotes=[],falhas=[];let finalizou=false,iniciou=false,registrou=null;
 const browser=await chromium.launch({channel:'chrome',headless:true});let page;
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
 await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:'sb-'+api.hostname.split('.')[0]+'-auth-token',value:sessao});
 const listar=f=>{
   const base=real[f.p_filtros.lado==='a_menos'||f.p_filtros.lado==='a_mais'?f.p_filtros.lado:'todos'];
   if(estado.lista==='vazio')return {...base,total:0,servicos:[],lados:{...base.lados,a_menos:{us:0,servicos:0,por_motivo:{}}}};
   if(estado.lista==='manutencao')return {...base,servicos:[{...base.servicos[0],numserv:'245579601',na_manutencao:true,manutencao_com_valor:true}]};
   if(estado.lista!=='exportar')return base;
   const n=Math.max(Math.min(f.p_limite,1500-f.p_offset),0),modelo=base.servicos[0]??real.a_menos.servicos[0];
   return {...base,total:1500,servicos:Array.from({length:n},(_,i)=>({...modelo,numserv:String(9e8+f.p_offset+i)}))};
 };
 await context.route('**/*.supabase.co/**',async route=>{
   const url=new URL(route.request().url()),recurso=url.pathname.split('/').pop(),dados=()=>route.request().postDataJSON();
   let corpo=[];
   if(url.hostname!==api.hostname)throw Error('A tela tentou acessar outro projeto Supabase.');
   if(recurso==='neo_fat_faturas'&&estado.faturas==='falha')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'falha simulada'})});
   if(recurso==='user')corpo=usuario;
   else if(recurso==='neo_acessos')corpo={user_id:id,papel:'ADMIN',modulos:['faturamento'],ativo:true};
   else if(recurso==='colaboradores')corpo={id,nome:'Revisão da interface'};
   else if(recurso==='neo_fat_faturas'&&estado.faturas==='vazio')corpo=[];
   else if(recurso==='neo_fat_faturas')corpo=[{id:'9844',arquivo:'resumo.xlsx',inicio:'2026-09-02',fim:'2026-10-01',importado_em:'2026-10-22T12:00:00Z',
     hash_resumida:estado.hashes==='iguais'?hash(arqResumida):'antigo',hash_completa:estado.hashes==='iguais'?hash(arqCompleta):'antigo'}];
   else if(recurso==='neo_fat_painel')corpo=estado.painel==='vazio'?[]:real.painel;
   else if(recurso==='neo_fat_faturas_desatualizadas')corpo=estado.desatualizadas;
   else if(recurso==='neo_fat_servicos_listar'){const f=dados();chamadasLista.push({lado:f.p_filtros.lado,offset:f.p_offset,modo:estado.lista,fatura:f.p_filtros.fatura,filtros:f.p_filtros});corpo=listar(f);}
   else if(recurso==='neo_fat_servico_linhas')corpo=real.linhas;
   else if(recurso==='neo_fat_valor_us')corpo=estado.valorUs==='nenhum'?null:real.valorUs;
   else if(recurso==='neo_fat_servicos_valores'){const f=dados();chamadasValores.push(f);corpo=[{valor:'ALPERCATA',n:2},{valor:'COLUNA',n:1}];}
   else if(recurso==='neo_fat_servico_manutencao')corpo=real.manutencao[dados().p_numserv]??{existe:false,itens:[]};
   else if(recurso==='neo_fat_servico_historico')corpo=real.historico;
   else if(recurso==='neo_doc_avaliar'){avaliacoes.push(dados());corpo=null;}
   else if(['neo_fat_conferir_servico','neo_fat_desconferir_servico'].includes(recurso))corpo=null;
   else if(recurso==='neo_fat_iniciar_completa'){
     iniciou=true;const p=dados();assert.equal(p.p_fatura,'9844');assert.equal(p.p_contagens.Servico,21910);assert.equal(p.p_inicio,'2026-09-02');assert.equal(p.p_fim,'2026-10-01');corpo=id;
   }else if(recurso==='neo_fat_enviar_lote'){lotes.push(dados());corpo=null;}
   else if(recurso==='neo_fat_finalizar_completa'){finalizou=true;corpo=null;}
   else if(recurso==='neo_fat_registrar_hashes'){registrou=dados();corpo=null;}
   else if(recurso==='neo_fat_atualizar_totais'){totaisPedidos.push(dados().p_fatura);corpo=real.painel[0];}
   else if(recurso==='neo_fat_contrato')corpo=real.contrato;
   else if(recurso==='neo_fat_config')corpo={moto_urbano:0.7,rural:1.2};
   else if(recurso==='neo_fat_contrato_historico')corpo=[];
   else throw Error('Requisição inesperada: '+recurso);
   await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-49/50'},body:JSON.stringify(corpo)});
 });
 page=await context.newPage();page.on('pageerror',e=>falhas.push(e.message));
 const chamadasListaF=()=>chamadasLista.map(c=>c.filtros);
 const cabe=async nome=>{const fora=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth?[]:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).slice(-4).map(e=>e.tagName+'.'+String(e.className).slice(0,80)+' '+Math.round(e.getBoundingClientRect().right)));assert(!fora.length,`${nome} estoura a largura no celular: ${fora.join(' | ')}`);};
 const foto=nome=>page.screenshot({path:path.join(saida,nome+'.png'),fullPage:true});

 // Lista de faturas
 estado.desatualizadas=['9844'];
 await page.goto(urlBase+'/faturamento');
 await page.getByRole('heading',{name:'Faturas da CEMIG'}).waitFor();
 await page.getByText('Atual',{exact:true}).waitFor();
 for(const r of ['Pago pela CEMIG','Pago a menos · soma dos saldos','Multas aplicadas'])assert.equal(await page.getByText(r,{exact:false}).count()>0,true,r);
 await page.getByText('atualizado agora').waitFor();assert(totaisPedidos.length>0&&totaisPedidos.every(x=>x==='9844'),'recálculo: '+totaisPedidos);   // StrictMode do dev monta duas vezesestado.desatualizadas=[];
 await foto('lista-desktop');
 estado.painel='vazio';await page.reload();
 await page.getByText('Nenhuma fatura importada ainda.').waitFor();estado.painel='real';
 // Link antigo vai para a Conferência
 await page.goto(urlBase+'/faturamento?fatura=9844');
 await page.waitForURL(u=>u.pathname==='/faturamento/conferencia'&&u.search==='?fatura=9844');

 // Painel (antigo Resumo): dois cards, pílulas de período e R$ | US
 await page.goto(urlBase+'/faturamento/resumo?fatura=9844');
 await page.waitForURL(u=>u.pathname==='/faturamento/painel'&&u.searchParams.get('fatura')==='9844');
 await page.getByRole('heading',{name:'Painel do faturamento'}).waitFor();
 assert.equal(await page.getByRole('navigation',{name:'Detalhe da fatura'}).count(),0,'ainda tem o botão Resumo | Conferência');
 assert.equal(await page.getByText('Diferença · pago − devido').count(),0);
 assert.equal(await page.locator('input[type=date]').count(),0);
 await page.getByText('Pagou a menos',{exact:true}).first().waitFor();
 await page.getByText('Pagou a mais',{exact:true}).first().waitFor();
 await page.getByText('−R$ 22.076,19').first().waitFor();
 await page.getByText('1 US = R$ 2.964,33').first().waitFor();
 await page.getByText('são 5.62 pago como RC inteiro',{exact:false}).first().waitFor();
 await page.getByRole('button',{name:'US',exact:true}).click();
 await page.waitForURL(u=>u.searchParams.get('unidade')==='us');
 await page.getByText('−7,447278 US').first().waitFor();
 await foto('painel-desktop');
 // Funil até os divergentes, explicação no "i" e resumo do gráfico no mouse
 const larguras=await page.locator('[data-etapa]').evaluateAll(l=>l.map(e=>e.getBoundingClientRect().width));
 assert.equal(larguras.length,5,'etapas do funil: '+larguras.length);
 for(let i=1;i<larguras.length;i++)assert(larguras[i]<larguras[i-1],'funil não estreita: '+larguras.join(', '));
 await page.getByRole('button',{name:'O que é fora do contrato'}).hover();
 await page.getByText('Serviços com código que não tem valor na tabela do contrato',{exact:false}).waitFor();
 await page.getByRole('button',{name:'O que é divergentes'}).hover();
 await page.getByText('Serviços em que a CEMIG pagou diferente do que o contrato prevê',{exact:false}).waitFor();
 await page.locator('[data-grafico-fatura="9844"]').hover();
 const balao=page.getByRole('tooltip');await balao.waitFor();
 await balao.getByText('A menos · 106').waitFor();await balao.getByText('A mais · 172').waitFor();
 assert.notEqual(await balao.getByText('A menos · 106').evaluate(e=>e.getBoundingClientRect().top),await balao.getByText('A mais · 172').evaluate(e=>e.getBoundingClientRect().top),'resumo do gráfico numa linha só');
 await page.goto(urlBase+'/faturamento/painel');
 assert.equal(await page.getByRole('button',{name:'3 meses'}).getAttribute('aria-pressed'),'true');
 estado.valorUs='nenhum';await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('neo-fat:valor-us')).forEach(k=>localStorage.removeItem(k)));
 await page.reload();await page.getByRole('heading',{name:'Painel do faturamento'}).waitFor();
 await page.locator('button[title="Valor da US não encontrado"]').waitFor();assert(await page.getByRole('button',{name:'R$',exact:true}).isDisabled(),'R$ sem valor da US');
 await page.getByText('US',{exact:false}).first().waitFor();estado.valorUs='real';

 // Conferência sem ?fatura e sem cache: nenhuma consulta de todas as faturas; sem opção "todas"
 await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('neo-fat:')).forEach(k=>localStorage.removeItem(k)));
 chamadasLista.length=0;
 await page.goto(urlBase+'/faturamento/conferencia');
 await page.getByRole('heading',{name:'Conferência'}).waitFor();
 await page.getByRole('columnheader',{name:/Cidade/}).waitFor();
 assert(chamadasLista.length>0&&chamadasLista.every(c=>c.fatura==='9844'),'consulta sem fatura: '+JSON.stringify(chamadasLista));
 await page.getByRole('button',{name:/^Fatura 9844/}).click();
 assert.equal(await page.getByRole('option',{name:/Todas as faturas/}).count(),0);
 await page.keyboard.press('Escape');
 // Lista em colunas com filtro estilo Excel
 await page.goto(urlBase+'/faturamento/conferencia?fatura=9844');
 await page.getByRole('columnheader',{name:/Motivo/}).waitFor();
 const cabecalhos=(await page.getByRole('columnheader').allTextContents()).map(t=>t.replace(/\s+/g,' ').trim());
 assert.deepEqual(cabecalhos,['Situação','Nº serviço','Tipo serv.','Códigos','Frota','Tipo frota','Cidade','Pago','Devido','Diferença','Multa','Motivo']);
 chamadasValores.length=0;
 await page.getByRole('button',{name:'Filtrar Cidade'}).click();
 const menu=page.getByRole('dialog',{name:'Filtro de Cidade'});await menu.waitFor();
 await menu.getByText('ALPERCATA').waitFor();
 assert(chamadasValores.some(c=>c.p_coluna==='cidade'),'lista de valores não pedida');
 await menu.getByRole('checkbox',{name:'(Selecionar tudo)'}).uncheck();
 await menu.getByRole('checkbox',{name:/ALPERCATA/}).check();
 chamadasLista.length=0;await menu.getByRole('button',{name:'OK'}).click();
 await page.waitForURL(u=>u.searchParams.getAll('cidades').join()==='ALPERCATA');
 await page.waitForFunction(()=>true);
 assert(chamadasListaF().some(f=>JSON.stringify(f.cidades)==='["ALPERCATA"]'),'filtro de cidade não enviado');
 await page.getByRole('button',{name:'Remover filtro Cidade'}).click();
 await page.waitForURL(u=>!u.searchParams.has('cidades'));
 chamadasLista.length=0;await page.getByRole('button',{name:/Contém 1.NS/}).click();
 await page.waitForURL(u=>u.searchParams.get('tem_1ns')==='sim');
 await page.waitForFunction(()=>true);
 assert(chamadasListaF().some(f=>f.tem_1ns==='sim'),'Contém 1.NS não enviado');
 await page.getByRole('button',{name:'Limpar todos'}).click();await page.waitForURL(u=>!u.searchParams.has('tem_1ns'));
 assert(await page.locator('[title="Tem 1.NS e não foi encontrado na Manutenção"]').count()>0,'sem o aviso de 1.NS fora da Manutenção');
 // Janela fecha por Esc, Cancelar e X
 const primeiro=page.getByRole('button',{name:'Abrir serviço '+real.a_menos.servicos[0].numserv});
 await primeiro.click();await page.getByRole('dialog').waitFor();
 await page.getByRole('dialog').getByText('O que aconteceu').waitFor();
 await foto('conferencia-janela');
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 await primeiro.click();await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await primeiro.click();await page.getByRole('dialog').getByRole('button',{name:'Fechar'}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await foto('conferencia-desktop');
 // Janela do serviço: identificação, fatores, 1.NS na tabela e cruzamento com a Manutenção
 assert.equal(real.a_menos.servicos[0].numserv,'246101137','o primeiro pago a menos mudou');
 await primeiro.click();const jan=page.getByRole('dialog');await jan.waitFor();
 for(const t of ['Nº do serviço','Tipo do serviço','Nº de frota','Tipo da frota','Multifuncional','Rural × 1,2','Histórico'])await jan.getByText(t,{exact:true}).first().waitFor();
 await jan.getByText('Não encontrado na Manutenção.').waitFor();
 await jan.getByText('8180',{exact:true}).first().waitFor();
 assert.equal(await jan.getByText('Devido CSC',{exact:false}).count(),0,'ainda mostra Devido CSC · COD · Moto');
 assert.equal(await jan.getByText('Moto',{exact:true}).count(),0,'etiqueta Moto na janela');
 await jan.getByRole('cell',{name:'1.NS',exact:true}).waitFor();
 assert.equal(await jan.getByText('Pago pela Manutenção',{exact:false}).count(),0,'bloco da Manutenção sem valor');
 await foto('janela-servico');await page.keyboard.press('Escape');await jan.waitFor({state:'detached'});
 estado.lista='manutencao';await page.reload();
 await page.getByRole('button',{name:'Abrir serviço 245579601'}).click();await jan.waitFor();
 await jan.getByText('Pago pela Manutenção',{exact:false}).waitFor();await jan.getByText('sem código',{exact:true}).waitFor();
 assert.equal(await jan.getByText('Observação da equipe',{exact:false}).count(),0);
 await foto('janela-manutencao');await page.keyboard.press('Escape');estado.lista='real';await page.reload();
 // Exportações percorrem as páginas
 estado.lista='exportar';chamadasLista.length=0;
 const [baixado]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.getByRole('button',{name:'Exportar para negociação'}).click()]);
 assert.equal(baixado.suggestedFilename(),'negociacao-fatura-9844.xlsx');
 const exp=chamadasLista.filter(c=>c.modo==='exportar').map(c=>`${c.lado}:${c.offset}`);
 for(const c of ['a_menos:0','a_menos:1000','a_mais:0','a_mais:1000'])assert(exp.includes(c),`exportação sem ${c}: ${exp}`);
 chamadasLista.length=0;
 const [planilha]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.getByRole('button',{name:'Exportar para Excel'}).click()]);
 assert.equal(planilha.suggestedFilename(),'conferencia-fatura-9844.xlsx');
 const exp2=chamadasLista.filter(c=>c.modo==='exportar').map(c=>c.offset);assert.deepEqual(exp2,[0,1000]);
 estado.lista='vazio';await page.reload();
 await page.getByText('Nada pago a menos nesta fatura.',{exact:false}).waitFor();estado.lista='real';

 // Tabelas do contrato: Moto calculado
 await page.goto(urlBase+'/faturamento/tabelas');
 await page.getByLabel('Buscar código ou descrição').fill('1.13');
 await page.getByRole('button',{name:'1.13',exact:true}).waitFor();
 assert(await page.getByRole('cell',{name:'0,137718',exact:true}).isVisible());
 assert(await page.getByRole('cell',{name:'0,165261',exact:true}).isVisible());
 await page.getByLabel('Buscar código ou descrição').fill('6.01');
 await page.locator('tr[data-codigo="6.01"]').getByText('sem desconto').waitFor();
 await foto('contrato-moto');

 // Documentação abre no tema pelo link
 await page.goto(urlBase+'/faturamento/documentacao#rc-codigo');
 await page.locator('#rc-codigo').getByText('245530193 · 5.14').waitFor();
 assert(await page.locator('#rc-codigo').getByText('245530193 · 5.14').isVisible());

 // Celular: nenhuma rota estoura a largura
 await page.setViewportSize({width:390,height:844});
 for(const rota of ['/faturamento','/faturamento/painel?fatura=9844','/faturamento/conferencia?fatura=9844','/faturamento/tabelas','/faturamento/documentacao','/faturamento/importar']){
   await page.goto(urlBase+rota);await page.waitForLoadState('networkidle');await page.waitForTimeout(300);await cabe(rota);
   await foto('celular-'+(rota.split('/')[2]?.split('?')[0]||'lista'));
 }
 await page.goto(urlBase+'/faturamento/conferencia?fatura=9844');await page.getByRole('button',{name:'Abrir serviço '+real.a_menos.servicos[0].numserv}).click();await page.getByRole('dialog').waitFor();
 const larg=await page.getByRole('dialog').evaluate(e=>e.getBoundingClientRect().width);assert(larg>=380,`janela com ${larg}px no celular`);
 await foto('celular-janela');await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1100});

 // Importação: fatura existente pede confirmação digitando o número; idêntica avisa "nada mudou"
 estado.hashes='antigos';estado.faturas='falha';
 await page.goto(urlBase+'/faturamento/importar');
 await page.getByRole('heading',{name:'Uma fatura. As duas origens.'}).waitFor();
 const semLista=page.getByText('A importação fica bloqueada até conferir as faturas já importadas.',{exact:false});
 await semLista.waitFor();
 await page.getByLabel('Fatura Resumida',{exact:true}).setInputFiles(arqResumida);
 await page.getByText('27.389 linhas de faturamento',{exact:false}).waitFor({timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('input[aria-label="Fatura Completa"]').disabled);
 await page.getByLabel('Fatura Completa',{exact:true}).setInputFiles(arqCompleta);
 await page.getByText('Todos os serviços têm uma equipe identificada.').waitFor({timeout:45000});
 assert(await semLista.isVisible(),'aviso da lista de faturas sumiu');
 assert(await page.getByRole('button',{name:'Importar fatura e equipes'}).isDisabled(),'importa sem conferir as faturas existentes');
 estado.faturas='vazio';await page.getByRole('button',{name:'Tentar de novo'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Importar fatura e equipes')&&!b.disabled));
 estado.faturas='existe';   // outra pessoa importou a 9844 depois que a tela abriu
 await page.getByRole('button',{name:'Importar fatura e equipes'}).click();
 const janela=page.getByRole('dialog');await janela.getByText('Digite o número da fatura para confirmar').waitFor();
 assert(!iniciou,'começou a importar sem confirmar a substituição');
 const substituir=janela.getByRole('button',{name:'Substituir fatura'});
 assert(await substituir.isDisabled());await janela.getByRole('textbox').fill('984');assert(await substituir.isDisabled());
 await janela.getByRole('textbox').fill('9844');assert(await substituir.isEnabled());
 await foto('importar-confirmar');
 estado.hashes='iguais';await substituir.click();
 await page.getByText('Fatura importada e equipes vinculadas').waitFor({timeout:120000});
 assert(finalizou);assert.equal(lotes.filter(l=>l.p_aba==='Servico').reduce((n,l)=>n+l.p_dados.length,0),21910);
 assert.equal(lotes.filter(l=>l.p_aba==='US_Servico').reduce((n,l)=>n+l.p_dados.length,0),27389);
 assert.deepEqual(registrou,{p_fatura:'9844',p_hash_resumida:hash(arqResumida),p_hash_completa:hash(arqCompleta)});
 await page.getByRole('button',{name:'Remover Fatura Completa'}).click();
 await page.waitForFunction(()=>!document.querySelector('input[aria-label="Fatura Completa"]').disabled);
 await page.getByLabel('Fatura Completa',{exact:true}).setInputFiles(arqCompleta);
 await page.getByText('Nada mudou.',{exact:false}).waitFor({timeout:45000});
 assert(await page.getByRole('button',{name:'Nada mudou'}).isDisabled());
 await foto('importar-identico');
 // Arquivo trocado: rejeição orienta qual origem deve ser anexada.
 await page.getByRole('button',{name:'Remover Fatura Completa'}).click();
 await page.getByLabel('Fatura Completa',{exact:true}).setInputFiles(arqResumida);
 await page.getByRole('alert').filter({hasText:'Selecione a Fatura Completa'}).waitFor({timeout:120000});
 assert.deepEqual(falhas,[]);
 console.log('OK: lista, vazio, link antigo, painel com dois cards e R$ ou US, janela (Esc/Cancelar/X), exportação paginada, conferência vazia, Moto no contrato, documentação, celular 390 px e importação segura. APIs simuladas, sem escrita remota.');
 }catch(e){if(page){await page.screenshot({path:path.join(saida,'ui-falha.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-3000));}throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
