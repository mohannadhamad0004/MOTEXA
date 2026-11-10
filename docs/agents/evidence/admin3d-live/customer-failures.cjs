// Chromium blocks selected network URLs; no mocked responses or database changes.
const {mobile,login,save,path}=require('./common.cjs');
(async()=>{const s=await login('customer'),b=await mobile('@playwright/test').chromium.launch({channel:'chrome',headless:true}),out={};try{
for(const [id,pattern] of [['F02','*://*/api/catalog/products/*/accessory-3d*'],['F03','*://*/api/catalog/accessory-3d/photos/*']]){
 const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(t=>sessionStorage.setItem('motexa_access_token',t),s.token);const p=await ctx.newPage(),events=[];
 p.on('requestfailed',r=>{if(r.url().includes('/api/'))events.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText})});
 p.on('response',r=>{if(r.url().includes('/api/catalog/'))events.push({path:new URL(r.url()).pathname,status:r.status()})});
 const cdp=await ctx.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:[pattern]});
 await p.goto('http://127.0.0.1:8085/customer/parts/b79d66c1-f153-478f-86e4-5d9a954707ac');await p.waitForTimeout(9000);
 out[id]={fault:'Browser network denial (no response stubbing)',pattern,text:await p.locator('body').innerText(),events};await p.screenshot({path:path.join(__dirname,id+'-network-failure.png'),fullPage:true});
 await cdp.send('Network.setBlockedURLs',{urls:[]});await p.reload();await p.waitForTimeout(5000);out[id].recoveredText=await p.locator('body').innerText();await ctx.close();console.log(id,JSON.stringify(out[id]));
}save('F-02-F-03-live',out);
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
