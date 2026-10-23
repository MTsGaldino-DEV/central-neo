// Interface real + arquivos reais, com Supabase interceptado (nenhuma escrita remota).
// Instale Playwright fora do app: npm install --prefix .tmp-faturamento/browser playwright
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('../.tmp-faturamento/browser/node_modules/playwright');
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const api=new URL(env.VITE_NEO_SUPABASE_URL),id='00000000-0000-0000-0000-000000000001';
const usuario={id,email:'teste@example.invalid',aud:'authenticated',role:'authenticated'};
const sessao={access_token:'teste-local',refresh_token:'teste-local',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user:usuario};
const dir=path.resolve('Comparação de fatura'),arquivos=fs.readdirSync(dir),saida=path.resolve('.tmp-faturamento');
const urlBase=(process.env.NEO_TEST_URL||'http://127.0.0.1:5173').replace(/\/$/,'');
// Dados de leitura do banco da NEO; o navegador recebe respostas interceptadas.
const postgres=require('../../traceone/frontend/node_modules/postgres');
(async()=>{
 const sql=postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{}});
 let contrato,linhas;
 try{
   await sql.begin(async t=>{
     const [admin]=await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
     await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
     contrato=await t`select * from neo_fat_contrato`;
     linhas=await t`select * from neo_fat_conferencia where fatura='9844' order by id limit 50`;
     const [transposta]=await t`select * from neo_fat_conferencia where fatura='9844' and numserv='246450669' and codserv='8.82'`;
     linhas=[transposta,...linhas];
   });
 }finally{await sql.end();}
 const browser=await chromium.launch({channel:'chrome',headless:true});let page;
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:'sb-'+api.hostname.split('.')[0]+'-auth-token',value:sessao});
 const lotes=[],falhas=[];let finalizou=false;
 await context.route('**/*.supabase.co/**',async route=>{
   const url=new URL(route.request().url()),recurso=url.pathname.split('/').pop();
   let corpo=[];
   if(url.hostname!==api.hostname)throw Error('A tela tentou acessar outro projeto Supabase.');
   if(recurso==='user')corpo=usuario;
   else if(recurso==='neo_acessos')corpo={user_id:id,papel:'ADMIN',modulos:['faturamento'],ativo:true};
   else if(recurso==='colaboradores')corpo={id,nome:'Revisão da interface'};
   else if(recurso==='neo_fat_faturas')corpo=[{id:'9844',arquivo:'resumo.xlsx',inicio:'2026-09-02',fim:'2026-10-01'}];
   else if(recurso==='neo_fat_iniciar_completa'){
     const p=route.request().postDataJSON();assert.equal(p.p_fatura,'9844');assert.equal(p.p_contagens.Servico,21910);assert.equal(p.p_inicio,'2026-09-02');assert.equal(p.p_fim,'2026-10-01');corpo=id;
   }else if(recurso==='neo_fat_enviar_lote'){lotes.push(route.request().postDataJSON());corpo=null;}
   else if(recurso==='neo_fat_finalizar_completa'){finalizou=true;corpo=null;}
   else if(recurso==='neo_fat_contrato')corpo=contrato;
   else if(recurso==='neo_fat_listar'){
     const filtros=route.request().postDataJSON().p_filtros;
     const filtradas=filtros.tipo_turma?linhas.filter(l=>l.tipo_turma===filtros.tipo_turma):linhas;
     corpo={linhas:filtradas,total:filtradas.length};
   }
   else if(recurso==='neo_fat_contrato_historico')corpo=[];
   else throw Error('Requisição inesperada: '+recurso);
   await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-49/50'},body:JSON.stringify(corpo)});
 });
 page=await context.newPage();page.on('pageerror',e=>falhas.push(e.message));
 await page.goto(urlBase+'/faturamento/importar');
 await page.getByRole('heading',{name:'Uma fatura. As duas origens.'}).waitFor();
 await page.screenshot({path:path.join(saida,'importar-inicial.png'),fullPage:true});
 await page.getByLabel('Fatura Resumida',{exact:true}).setInputFiles(path.join(dir,arquivos.find(n=>n.startsWith('Resumo_Fat_9844'))));
 await page.getByText('27.389 linhas de faturamento',{exact:false}).waitFor({timeout:30000});console.log('Resumo lido.');
 assert.equal(await page.getByRole('button',{name:'Atualizar fatura e equipes'}).count(),0);
 await page.waitForFunction(()=>!document.querySelector('input[aria-label="Fatura Completa"]').disabled);
 await page.getByLabel('Fatura Completa',{exact:true}).setInputFiles(path.join(dir,arquivos.find(n=>n.startsWith('RelatorioDadosFatura9844'))));
 await page.getByText('Todos os serviços têm uma equipe identificada.').waitFor({timeout:45000});
 for(const valor of ['10.311','9.657','1.872'])assert(await page.getByText(valor,{exact:true}).isVisible());
 await page.screenshot({path:path.join(saida,'importar-previa-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Página estoura a largura no celular');
 await page.screenshot({path:path.join(saida,'importar-previa-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Atualizar fatura e equipes'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(saida,'importar-previa-mobile-final.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1100});
 await page.getByRole('button',{name:'Atualizar fatura e equipes'}).click();
 await page.getByText('Fatura importada e equipes vinculadas').waitFor({timeout:120000});
 assert(finalizou);assert.equal(lotes.filter(l=>l.p_aba==='Servico').reduce((n,l)=>n+l.p_dados.length,0),21910);
 assert.equal(lotes.filter(l=>l.p_aba==='US_Servico').reduce((n,l)=>n+l.p_dados.length,0),27389);
 await page.screenshot({path:path.join(saida,'importar-concluida.png'),fullPage:true});
 await page.getByRole('button',{name:'Remover Fatura Completa'}).click();
 assert.equal(await page.getByRole('button',{name:'Atualizar fatura e equipes'}).count(),0);
 // Arquivo trocado: rejeição orienta qual origem deve ser anexada.
 await page.getByLabel('Fatura Completa',{exact:true}).setInputFiles(path.join(dir,arquivos.find(n=>n.startsWith('Resumo_Fat_9844'))));
 await page.getByRole('alert').filter({hasText:'Selecione a Fatura Completa'}).waitFor({timeout:120000});
 await page.goto(urlBase+'/faturamento/tabelas');
 await page.getByLabel('Buscar código ou descrição').fill('1.13');
 await page.getByRole('button',{name:'1.13',exact:true}).waitFor();
 assert(await page.getByRole('cell',{name:'0,137718',exact:true}).isVisible());
 assert(await page.getByRole('cell',{name:'0,165261',exact:true}).isVisible());
 assert(await page.getByRole('cell',{name:'Validado',exact:true}).isVisible());
 await page.screenshot({path:path.join(saida,'contrato-1.13.png'),fullPage:true});
 await page.goto(urlBase+'/faturamento?fatura=9844');
 await page.getByRole('columnheader',{name:'Equipe / frota'}).waitFor();
 await page.locator('tbody tr').first().waitFor();
 await page.getByText('Transposição',{exact:true}).first().waitFor();
 const rcFora=page.locator('tbody tr').filter({hasText:'RC86'});
 if(await rcFora.count())assert.equal(await rcFora.getByText('Transposição',{exact:true}).count(),0);
 await page.locator('tbody tr').first().getByRole('button').click();
 await page.getByRole('dialog').getByText('Origem: Serviço da Fatura Completa × US_Turma da Fatura Resumida.').waitFor();
 await page.getByRole('dialog').getByText('RC substituído pelo código',{exact:true}).waitFor();
 await page.screenshot({path:path.join(saida,'conferencia-equipe.png'),fullPage:true});
 assert.deepEqual(falhas,[]);
 console.log('OK: Chrome, desktop/celular, dois arquivos reais, prévia das equipes, bloqueio com um arquivo, envio dos lotes, sucesso, remoção, arquivo errado e valores do 1.13. APIs simuladas, sem escrita remota.');
 }catch(e){if(page){await page.screenshot({path:path.join(saida,'ui-falha.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-4000));}throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
