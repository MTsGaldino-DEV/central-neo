// Captura a interface atual com respostas reais em transação somente leitura.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../.tmp-faturamento/browser/node_modules/playwright');
const postgres = require('../../../traceone/frontend/node_modules/postgres');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, '.tmp-faturamento/video-central-neo');
const assets = path.join(out, 'assets');
fs.mkdirSync(assets, {recursive:true});
const env = Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()]));
const sql = postgres(env.NEO_DATABASE_URL,{ssl:'require',prepare:false,onnotice:()=>{},connect_timeout:15});
const base = process.env.NEO_VIDEO_URL || 'http://127.0.0.1:5173';
(async()=>{
 for(const name of ['Manrope','JetBrainsMono']){
  const target=path.join(assets,name+'.ttf');
  if(!fs.existsSync(target)){
   const url=`https://raw.githubusercontent.com/google/fonts/main/ofl/${name.toLowerCase()}/${name}%5Bwght%5D.ttf`;
   const response=await fetch(url);if(!response.ok)throw Error('Falha ao baixar fonte '+name);
   fs.writeFileSync(target,Buffer.from(await response.arrayBuffer()));
  }
 }
 const real = await sql.begin('read only',async t=>{
  const [admin] = await t`select user_id from neo_acessos where papel='ADMIN' and ativo limit 1`;
  await t`select set_config('request.jwt.claim.sub',${admin.user_id},true)`;
  const r={};
  r.painel=(await t`select neo_fat_painel() d`)[0].d;
  r.valorUs=(await t`select neo_fat_valor_us() d`)[0].d;
  r.faturas=await t`select * from neo_fat_faturas order by fim desc`;
  for(const lado of ['a_menos','a_mais','todos'])r[lado]=(await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado})},0,50) d`)[0].d;
  // Exemplo com fatores contratuais identificados, sem depender do código 5.62.
  r.exemplo=r.a_menos.servicos.find(s=>s.numserv==='246445398') || r.a_menos.servicos.find(s=>!s.tem_1ns) || r.a_menos.servicos[0];
  r.contrato=await t`select * from neo_fat_contrato`;
  r.config=(await t`select * from neo_fat_config limit 1`)[0];
  r.linhas=(await t`select neo_fat_servico_linhas('9844',${r.exemplo.numserv}) d`)[0].d;
  r.historico=(await t`select neo_fat_servico_historico('9844',${r.exemplo.numserv}) d`)[0].d;
  r.manutencao=(await t`select neo_fat_servico_manutencao(${r.exemplo.numserv}) d`)[0].d;
  r.fila=await t`select * from neo_vw_nsis order by termino desc nulls last limit 50`;
  r.contagens=await t`select etapa,count(*)::int n from neo_vw_nsis group by etapa`;
  r.resumo=(await t`select neo_resumo_fechamento() d`)[0].d;
  r.tipos=(await t`select neo_tipos_servico() d`)[0].d;
  return r;
 });
 await sql.end();
 fs.writeFileSync(path.join(out,'dados-reais.json'),JSON.stringify(real,null,2));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const api=new URL(env.VITE_NEO_SUPABASE_URL),id='00000000-0000-0000-0000-000000000001';
  const user={id,email:'video@example.invalid',aud:'authenticated',role:'authenticated'};
  const session={access_token:'captura-local',refresh_token:'captura-local',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user};
  const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:'sb-'+api.hostname.split('.')[0]+'-auth-token',value:session});
  await context.route('**/*.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
   const data=req.method()==='POST'?req.postDataJSON():{};
   let body=[],count=50;
   if(url.hostname!==api.hostname)return route.fulfill({status:403,body:'blocked'});
   if(name==='user')body=user;
   else if(name==='neo_acessos')body={user_id:id,papel:'USUARIO',modulos:['fechamento','faturamento'],ativo:true};
   else if(name==='colaboradores')body={id,nome:'UEN 211'};
   else if(name==='neo_fat_painel')body=real.painel;
   else if(name==='neo_fat_faturas')body=real.faturas;
   else if(name==='neo_fat_faturas_desatualizadas')body=[];
   else if(name==='neo_fat_valor_us')body=real.valorUs;
   else if(name==='neo_fat_contrato')body=real.contrato;
   else if(name==='neo_fat_config')body=real.config;
   else if(name==='neo_resumo_fechamento')body=real.resumo;
   else if(name==='neo_fat_servicos_listar')body=real[data.p_filtros?.lado||'todos']||real.todos;
   else if(name==='neo_fat_servico_linhas')body=real.linhas;
   else if(name==='neo_fat_servico_historico')body=real.historico;
   else if(name==='neo_fat_servico_manutencao')body=real.manutencao;
   else if(name==='neo_fat_servicos_valores')body=[{valor:'ALPERCATA',n:2},{valor:'COLUNA',n:1}];
   else if(name==='neo_tipos_servico')body=real.tipos;
   else if(name==='neo_vw_nsis'){
    const etapa=url.searchParams.get('etapa')?.replace('eq.','');
    count=etapa?real.contagens.find(x=>x.etapa===etapa)?.n||0:real.contagens.reduce((n,x)=>n+x.n,0);
    body=real.fila;
   }
   else {console.log('Recurso sem captura:',name);body=[];}
   return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':`0-${Math.max(body?.length||1,1)-1}/${count}`},body:req.method()==='HEAD'?'':JSON.stringify(body)});
  });
  const page=await context.newPage();
  page.on('pageerror',e=>console.log('ERRO DA TELA:',e.message));
  const snap=async(name,url,heading)=>{
   await page.goto(base+url); await page.getByRole('heading',{name:heading,exact:true}).waitFor();
   await page.waitForTimeout(1700); await page.evaluate(()=>document.fonts.ready);
   // Oculta apenas seção de futuro e rótulo de sessão na composição de apresentação.
   await page.addStyleTag({content:'nav[aria-label="Menu"] > div:has([title="Em breve"]) {display:none!important} *{caret-color:transparent!important}'});
   await page.screenshot({path:path.join(assets,name+'.png')});
   console.log('CAPTURA',name);
  };
  await snap('manutencao','/fechamento','Fila de NSIS');
  await snap('painel','/faturamento/painel?fatura=9844','Painel do faturamento');
  await snap('conferencia','/faturamento/conferencia?fatura=9844','Conferência');
  await page.getByRole('button',{name:'Abrir serviço '+real.exemplo.numserv}).click();
  await page.getByRole('dialog').waitFor(); await page.waitForTimeout(700);
  await page.screenshot({path:path.join(assets,'detalhe.png')});
  await page.getByRole('dialog').screenshot({path:path.join(assets,'detalhe-card.png')});
  await snap('importar','/faturamento/importar','Importar fatura');
  const dir=path.join(root,'Comparação de fatura'),files=fs.readdirSync(dir);
  await page.locator('input[type=file]').nth(0).setInputFiles(path.join(dir,files.find(n=>n.startsWith('Resumo_Fat_9844'))));
  await page.getByText('Leitura concluída',{exact:true}).waitFor();
  await page.locator('input[type=file]').nth(1).setInputFiles(path.join(dir,files.find(n=>n.startsWith('RelatorioDadosFatura9844'))));
  await page.getByText('Serviços únicos',{exact:true}).waitFor();await page.waitForTimeout(500);
  await page.screenshot({path:path.join(assets,'importar-previa.png')});
  await page.goto(base+'/faturamento/conferencia?fatura=9844');await page.waitForTimeout(1300);
  await page.getByRole('button',{name:'Filtrar Cidade'}).click();await page.waitForTimeout(400);
  await page.screenshot({path:path.join(assets,'filtros.png')});
  fs.writeFileSync(path.join(out,'capturas.json'),JSON.stringify({fatura:'9844',servico:real.exemplo.numserv,geradoEm:new Date().toISOString(),somenteLeitura:true},null,2));
 }finally{await browser.close();}
 console.log('DADOS',JSON.stringify({exemplo:real.exemplo.numserv,servicos:real.painel[0].servicos,valorUs:real.valorUs}));
})().catch(async e=>{console.error(e.message);await sql.end().catch(()=>{});process.exitCode=1;});
