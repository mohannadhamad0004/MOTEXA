const {mobile,login,api,save,path}=require('./common.cjs');
(async()=>{
 const b=await mobile('@playwright/test').chromium.launch({channel:'chrome',headless:true});
 const out={};
 async function page(role,route){const s=await login(role),ctx=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await ctx.addInitScript(t=>sessionStorage.setItem('motexa_access_token',t),s.token);const p=await ctx.newPage();p.setDefaultTimeout(20000);await p.goto('http://127.0.0.1:8085'+route,{timeout:60000});return {p,s,ctx};}
 async function capture(p,id){await p.screenshot({path:path.join(__dirname,id+'.png'),fullPage:true});return {text:await p.locator('body').innerText(),inputs:await p.locator('input,textarea').evaluateAll(xs=>xs.map(x=>({value:x.value,placeholder:x.getAttribute('placeholder'),type:x.type,label:x.getAttribute('aria-label')})))};}
 try{
 {const {p,ctx}=await page('admin.parts','/dept/vehicles');await p.getByText('Add generation',{exact:true}).click();out.A02=await capture(p,'A-02-generation-form');await ctx.close();console.log('A02',JSON.stringify(out.A02));}
 {const {p,ctx}=await page('admin.tow','/admin/requests');await p.waitForTimeout(4000);out.D04=await capture(p,'D-04-admin-requests');await ctx.close();console.log('D04',JSON.stringify(out.D04));}
 {const {p,ctx}=await page('admin.parts','/dept/accessory3d/caeb5d60-6561-49e7-8770-2db3fabe4b4b');await p.getByText('3D final review',{exact:true}).waitFor();out.B02=await capture(p,'B-02-successful-candidate');await ctx.close();console.log('B02',JSON.stringify(out.B02));}
 {const {p,ctx}=await page('shop','/provider/parts/accessory-3d/40c385e7-9e22-447c-98ba-d3427347b7ab');await p.getByText('Save details',{exact:true}).waitFor();out.C03before=await capture(p,'C-03-size-form');const fields=p.locator('input[inputmode="decimal"],input[inputmode="numeric"]');console.log('C03 inputs',JSON.stringify(out.C03before.inputs));if(await fields.count()){await fields.first().fill('\u0661\u0665\u0660\u0660');out.C03={entered:'\u0661\u0665\u0660\u0660',actual:await fields.first().inputValue()};await p.screenshot({path:path.join(__dirname,'C-03-digits.png'),fullPage:true});}await ctx.close();}
 }catch(e){out.error=e.message;console.log('ERROR',e.message)}finally{save('browser-forms',out);await b.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
