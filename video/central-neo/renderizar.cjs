const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('../../.tmp-faturamento/browser/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'.tmp-faturamento/video-central-neo'),out=path.join(root,'entregas/central-neo');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(work,'revisao'),{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.json':'application/json'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');let file=url.pathname.startsWith('/assets/')?path.join(work,url.pathname.slice(1)):path.join(__dirname,'motion.html');if(!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)});
(async()=>{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--force-color-profile=srgb']});
 let encoder;
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>{throw e});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.evaluate(()=>window.ready);
  const times=[1.8,6,12,17,24,31,37.5,42,46.5,52,58,65,72,77,86.2];
  for(const t of times){await page.evaluate(t=>renderFrame(t),t);await page.screenshot({path:path.join(work,'revisao',String(t).replace('.','-')+'.png')});}
  console.log('PRÉVIAS PRONTAS',path.join(work,'revisao'));
  if(process.argv.includes('--previa'))return;
  const duration=88.607313,fps=30,total=Math.ceil(duration*fps);
  const silent=path.join(work,'imagem.mp4');
  const log=fs.openSync(path.join(work,'ffmpeg-imagem.log'),'w');
  encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','warning','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','ignore',log],windowsHide:true});
  encoder.on('error',e=>console.error(e));
  const began=Date.now();
  for(let f=0;f<total;f++){
   await page.evaluate(t=>renderFrame(t),f/fps);
   const frame=await page.screenshot({type:'jpeg',quality:96});
   if(!encoder.stdin.write(frame))await once(encoder.stdin,'drain');
   if(f%300===0)console.log('RENDER',Math.round(f/total*100)+'%',`${((Date.now()-began)/1000).toFixed(0)}s`);
  }
  encoder.stdin.end();const [code]=await once(encoder,'close');if(code!==0)throw Error('FFmpeg terminou com código '+code);
  fs.closeSync(log);console.log('IMAGEM PRONTA',silent);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
