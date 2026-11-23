const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {createRequire}=require('module');
const mobile=path.resolve(__dirname,'..');
const {chromium}=createRequire(mobile+'/package.json')('@playwright/test');
const root=path.join(mobile,'dist-uiux'),output=path.join(mobile,'test-results/launch');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 else if(!path.extname(file))file+='.html';
 if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.css':'text/css'})[path.extname(file)]||'application/octet-stream');
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge'}),base='http://127.0.0.1:'+server.address().port;
 const errors=[],calls=[],results=[];
 try{
  for(const [width,height] of [[320,740],[390,844],[430,932],[595,700],[768,1024],[1440,900]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/api/**',r=>{calls.push(r.request().url());return r.abort();});
   await p.goto(base);await p.getByRole('button',{name:'Next',exact:true}).waitFor();
   await p.getByTestId('launch-photo-ready').waitFor();
   await p.waitForFunction(()=>{
     const photo=document.querySelector('[data-testid="launch-photo-ready"] img');
     if(!photo)return false;
     const rect=photo.parentElement.getBoundingClientRect();
     return rect.width>250&&rect.height>300;
   });
   await p.evaluate(()=>document.fonts.ready);
   const vehicleVisible=await p.getByTestId("launch-photo-ready").evaluate(el=>{const box=el.getBoundingClientRect(),image=el.querySelector("img").parentElement.getBoundingClientRect();return image.top+image.height*.51>=box.top&&image.top+image.height*.90<=box.bottom;});
   assert.equal(vehicleVisible,true,"Vehicle crop must stay inside the photograph at "+width);
   await p.screenshot({path:path.join(output,'launch-'+width+'-en-light.png')});
   if(width===390){
     const photoBox=await p.getByTestId("launch-photo-ready").boundingBox();
     const touch=await context.newCDPSession(p);
     await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:photoBox.x+photoBox.width*.82,y:photoBox.y+photoBox.height*.45}]});
     for(let n=1;n<=10;n++)await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:photoBox.x+photoBox.width*(.82-.62*n/10),y:photoBox.y+photoBox.height*.45}]});
     await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
     await p.waitForFunction(()=>document.querySelector('[aria-label="Slide 2"]')?.getAttribute('aria-selected')==='true');
     await p.getByRole('tab',{name:'Slide 1',exact:true}).click();
   }
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await p.getByRole('button',{name:'التبديل إلى العربية',exact:true}).click();
   await p.getByText('عالمٌ من العناية.',{exact:true}).waitFor();
   if(width===390){
     const photoBox=await p.getByTestId("launch-photo-ready").boundingBox();
     const touch=await context.newCDPSession(p);
     await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:photoBox.x+photoBox.width*.20,y:photoBox.y+photoBox.height*.45}]});
     for(let n=1;n<=10;n++)await touch.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:photoBox.x+photoBox.width*(.20+.62*n/10),y:photoBox.y+photoBox.height*.45}]});
     await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
     await p.waitForFunction(()=>document.querySelector('[aria-label="الشريحة 2"]')?.getAttribute('aria-selected')==='true');
     await p.getByRole('tab',{name:'الشريحة 1',exact:true}).click();
   }
   await p.screenshot({path:path.join(output,'launch-'+width+'-ar-light.png')});
   await p.getByRole('button',{name:'تفعيل المظهر الليلي',exact:true}).click();
   await p.screenshot({path:path.join(output,'launch-'+width+'-ar-dark.png')});
   await p.reload();await p.getByText('عالمٌ من العناية.',{exact:true}).waitFor();
   await p.getByRole('button',{name:'تفعيل المظهر الفاتح',exact:true}).waitFor();
   assert.equal(await p.evaluate(()=>localStorage.getItem('motexa_language')),'ar');
   assert.equal(await p.evaluate(()=>localStorage.getItem('motexa_appearance')),'dark');
   for(let i=1;i<=4;i++){
    await p.getByRole('tab',{name:'الشريحة '+i,exact:true}).click();
    await p.waitForFunction(index=>document.querySelector('[aria-label="الشريحة '+index+'"]')?.getAttribute('aria-selected')==='true',i);
   }
   await p.screenshot({path:path.join(output,'launch-'+width+'-last-chapter.png')});
   assert.equal(await p.getByText('اكتشف MOTEXA',{exact:true}).count(),0);
   await p.getByRole('button',{name:'ابدأ الآن',exact:true}).click();
   await p.waitForURL('**/choose-role');
   await p.getByRole('radiogroup',{name:'اختر دورك',exact:true}).waitFor();
   await p.screenshot({path:path.join(output,'roles-'+width+'-ar-dark.png')});
   await p.goto(base);await p.getByRole('button',{name:'تخطّي المقدمة',exact:true}).click();
   await p.waitForURL('**/choose-role');
   results.push({width,height,ar:true,en:true,light:true,dark:true,preferencePersistence:true,slides:true,getStarted:true,skip:true,documentOverflow:false});
   await context.close();
  }
  // Check the regular-motion branch separately from reduced-motion visual snapshots.
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);await p.getByTestId('launch-photo-ready').waitFor();
  await p.waitForFunction(()=>{const photo=document.querySelector('[data-testid="launch-photo-ready"]')?.firstElementChild;const transform=photo?getComputedStyle(photo).transform:"none";const scale=Number(transform.match(/matrix\(([^,]+)/)?.[1]);return scale>1.002&&scale<=1.07;});
  await p.getByRole('button',{name:'Next',exact:true}).click();
  await p.getByText('Behind every journey.',{exact:true}).waitFor();
  await p.getByRole('button',{name:'Skip introduction',exact:true}).click();await p.waitForURL('**/choose-role');await context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(calls,[]);
  const report={note:'Actual exported React Native web UI. No backend fixtures, authentication requests or database mutations are used for this public launch journey. Native splash and Android device performance remain unverified.',results,regularMotionNavigation:true,errors,apiCalls:calls};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
