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
     real.painel=(await t`select neo_fat_painel() d`)[0].d;
     for(const lado of ['a_menos','a_mais','todos'])real[lado]=(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado})},0,50) d`)[0].d;
     real.linhas=(await t`select neo_fat_servico_linhas('9844',${real.a_menos.servicos[0].numserv}) d`)[0].d;
     throw new Error('rollback');
   });
 }catch(e){if(e.message!=='rollback')throw e;}finally{await sql.end();}
 const estado={painel:'real',lista:'real',hashes:'nenhum'},chamadasLista=[],lotes=[],falhas=[];let finalizou=false,registrou=null;
 const browser=await chromium.launch({channel:'chrome',headless:true});let page;
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
 await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:'sb-'+api.hostname.split('.')[0]+'-auth-token',value:sessao});
 const listar=f=>{
   const base=real[f.p_filtros.lado==='a_menos'||f.p_filtros.lado==='a_mais'?f.p_filtros.lado:'todos'];
   if(estado.lista==='vazio')return {...base,total:0,servicos:[],lados:{...base.lados,a_menos:{us:0,servicos:0,por_motivo:{}}}};
   if(estado.lista!=='exportar')return base;
   const n=Math.max(Math.min(f.p_limite,1500-f.p_offset),0),modelo=base.servicos[0]??real.a_menos.servicos[0];
   return {...base,total:1500,servicos:Array.from({length:n},(_,i)=>({...modelo,numserv:String(9e8+f.p_offset+i)}))};
 };
 await context.route('**/*.supabase.co/**',async route=>{
   const url=new URL(route.request().url()),recurso=url.pathname.split('/').pop(),dados=()=>route.request().postDataJSON();
   let corpo=[];
   if(url.hostname!==api.hostname)throw Error('A tela tentou acessar outro projeto Supabase.');
   if(recurso==='user')corpo=usuario;
   else if(recurso==='neo_acessos')corpo={user_id:id,papel:'ADMIN',modulos:['faturamento'],ativo:true};
   else if(recurso==='colaboradores')corpo={id,nome:'Revisão da interface'};
   else if(recurso==='neo_fat_faturas')corpo=[{id:'9844',arquivo:'resumo.xlsx',inicio:'2026-09-02',fim:'2026-10-01',importado_em:'2026-10-22T12:00:00Z',
     hash_resumida:estado.hashes==='iguais'?hash(arqResumida):'antigo',hash_completa:estado.hashes==='iguais'?hash(arqCompleta):'antigo'}];
   else if(recurso==='neo_fat_painel')corpo=estado.painel==='vazio'?[]:real.painel;
   else if(recurso==='neo_fat_servicos_listar'){const f=dados();chamadasLista.push({lado:f.p_filtros.lado,offset:f.p_offset,modo:estado.lista});corpo=listar(f);}
   else if(recurso==='neo_fat_servico_linhas')corpo=real.linhas;
   else if(['neo_fat_conferir_servico','neo_fat_desconferir_servico'].includes(recurso))corpo=null;
   else if(recurso==='neo_fat_iniciar_completa'){
     const p=dados();assert.equal(p.p_fatura,'9844');assert.equal(p.p_contagens.Servico,21910);assert.equal(p.p_inicio,'2026-09-02');assert.equal(p.p_fim,'2026-10-01');corpo=id;
   }else if(recurso==='neo_fat_enviar_lote'){lotes.push(dados());corpo=null;}
   else if(recurso==='neo_fat_finalizar_completa'){finalizou=true;corpo=null;}
   else if(recurso==='neo_fat_registrar_hashes'){registrou=dados();corpo=null;}
   else if(recurso==='neo_fat_atualizar_totais')corpo=real.painel[0];
   else if(recurso==='neo_fat_contrato')corpo=real.contrato;
   else if(recurso==='neo_fat_config')corpo={moto_urbano:0.7};
   else if(recurso==='neo_fat_contrato_historico')corpo=[];
   else throw Error('Requisição inesperada: '+recurso);
   await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-49/50'},body:JSON.stringify(corpo)});
 });
 page=await context.newPage();page.on('pageerror',e=>falhas.push(e.message));
 const cabe=async nome=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${nome} estoura a largura no celular`);};
 const foto=nome=>page.screenshot({path:path.join(saida,nome+'.png'),fullPage:true});

 // Lista de faturas
 await page.goto(urlBase+'/faturamento');
 await page.getByRole('heading',{name:'Faturas da CEMIG'}).waitFor();
 await page.getByText('Atual',{exact:true}).waitFor();
 for(const r of ['Pago pela CEMIG','Pago a menos · soma dos saldos','Multas aplicadas'])assert.equal(await page.getByText(r,{exact:false}).count()>0,true,r);
 await foto('lista-desktop');
 estado.painel='vazio';await page.reload();
 await page.getByText('Nenhuma fatura importada ainda.').waitFor();estado.painel='real';
 // Link antigo vai para a Conferência
 await page.goto(urlBase+'/faturamento?fatura=9844');
 await page.waitForURL(u=>u.pathname==='/faturamento/conferencia'&&u.search==='?fatura=9844');

 // Resumo: sem input de data nativo e legenda pequena
 await page.goto(urlBase+'/faturamento/resumo?fatura=9844');
 await page.getByText('Diferença · pago − devido').waitFor();
 assert.equal(await page.locator('input[type=date]').count(),0);
 const fonte=await page.getByText('Pago',{exact:true}).first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 assert(fonte<=12,`legenda com ${fonte}px`);
 await page.getByRole('button',{name:/jul|ago|set|out/}).first().click();
 await page.getByRole('group',{name:'Atalhos de período'}).waitFor();await page.keyboard.press('Escape');
 await foto('resumo-desktop');

 // Conferência: janela fecha por Esc, Cancelar e X
 await page.goto(urlBase+'/faturamento/conferencia?fatura=9844');
 await page.getByText('A receber · pagou a menos').waitFor();
 const primeiro=page.locator('main li button, li button').filter({hasText:real.a_menos.servicos[0].numserv}).first();
 await primeiro.click();await page.getByRole('dialog').waitFor();
 await page.getByRole('dialog').getByText('O que aconteceu').waitFor();
 await foto('conferencia-janela');
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 await primeiro.click();await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await primeiro.click();await page.getByRole('dialog').getByRole('button',{name:'Fechar'}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await foto('conferencia-desktop');
 // Exportação percorre as páginas dos dois lados
 estado.lista='exportar';chamadasLista.length=0;
 const [baixado]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.getByRole('button',{name:'Exportar para negociação'}).click()]);
 assert.equal(baixado.suggestedFilename(),'negociacao-fatura-9844.xlsx');
 const exp=chamadasLista.filter(c=>c.modo==='exportar').map(c=>`${c.lado}:${c.offset}`);
 for(const c of ['a_menos:0','a_menos:1000','a_mais:0','a_mais:1000'])assert(exp.includes(c),`exportação sem ${c}: ${exp}`);
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
 for(const rota of ['/faturamento','/faturamento/resumo?fatura=9844','/faturamento/conferencia?fatura=9844','/faturamento/tabelas','/faturamento/documentacao','/faturamento/importar']){
   await page.goto(urlBase+rota);await page.waitForLoadState('networkidle');await page.waitForTimeout(300);await cabe(rota);
   await foto('celular-'+(rota.split('/')[2]?.split('?')[0]||'lista'));
 }
 await page.goto(urlBase+'/faturamento/conferencia?fatura=9844');await primeiro.click();await page.getByRole('dialog').waitFor();
 const larg=await page.getByRole('dialog').evaluate(e=>e.getBoundingClientRect().width);assert(larg>=380,`janela com ${larg}px no celular`);
 await foto('celular-janela');await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1100});

 // Importação: fatura existente pede confirmação digitando o número; idêntica avisa "nada mudou"
 estado.hashes='antigos';
 await page.goto(urlBase+'/faturamento/importar');
 await page.getByRole('heading',{name:'Uma fatura. As duas origens.'}).waitFor();
 await page.getByLabel('Fatura Resumida',{exact:true}).setInputFiles(arqResumida);
 await page.getByText('27.389 linhas de faturamento',{exact:false}).waitFor({timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('input[aria-label="Fatura Completa"]').disabled);
 await page.getByLabel('Fatura Completa',{exact:true}).setInputFiles(arqCompleta);
 await page.getByText('Todos os serviços têm uma equipe identificada.').waitFor({timeout:45000});
 await page.getByRole('button',{name:'Revisar e substituir…'}).click();
 const janela=page.getByRole('dialog');await janela.getByText('Digite o número da fatura para confirmar').waitFor();
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
 console.log('OK: lista, vazio, link antigo, resumo sem data nativa e legenda pequena, janela (Esc/Cancelar/X), exportação paginada, conferência vazia, Moto no contrato, documentação, celular 390 px e importação segura. APIs simuladas, sem escrita remota.');
 }catch(e){if(page){await page.screenshot({path:path.join(saida,'ui-falha.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-3000));}throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
