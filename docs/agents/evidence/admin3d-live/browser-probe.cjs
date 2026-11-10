const {mobile,login,save,path}=require('./common.cjs');
(async()=>{
 const browser=await mobile('@playwright/test').chromium.launch({channel:'chrome',headless:true});
 try{
 const s=await login('admin.parts');const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await ctx.addInitScript(token=>sessionStorage.setItem('motexa_access_token',token),s.token);
 const p=await ctx.newPage();const events=[];
 p.on('response',r=>{if(r.url().includes('/api/'))events.push({url:r.url().replace(/\?.*/,''),status:r.status()})});
 p.on('pageerror',e=>events.push({error:e.message.slice(0,300)}));
 p.on('requestfailed',r=>events.push({failed:r.url().slice(0,180),error:r.failure()?.errorText}));
 p.on('console',m=>{if(m.type()==='error')events.push({console:m.text().slice(0,300)})});
 await p.goto('http://127.0.0.1:8081/dept/vehicles',{timeout:90000});
 await p.waitForTimeout(20000);
 const out={url:p.url(),text:(await p.locator('body').innerText()).slice(0,5000),inputs:await p.locator('input').count(),events};save('browser-probe',out);console.log(JSON.stringify(out));
 await p.screenshot({path:path.join(__dirname,'browser-probe.png')});
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
