// Isolated UI fixtures only: all API calls intercepted, no account/DB/provider writes or external downloads.
/* global __dirname */
// Reuses a retained production GLB for actual production-renderer preview; never restores retired assets.
const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {serveExport}=require('./static-export.cjs');
const STATIC=process.env.WEB_DIR?path.resolve(process.env.WEB_DIR):null;
const ROOT=path.resolve(__dirname,'../../..'),OUT=process.env.MOTEXA_UI_OUT||path.join(ROOT,'docs/3d/sketchfab-import'),BASE=STATIC?'http://motexa-ui.local':process.env.WEB||'http://localhost:8085';
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/3d/models.json'),'utf8')),entry=manifest['bmw-3-series-e36'],config=entry.viewerConfig;
const glb=fs.readFileSync(path.join(ROOT,'backend/public/3d',entry.file+'.glb'));
const generation={id:'fixture-generation',code:'E36',nameEn:'3 Series E36',nameAr:'الفئة الثالثة E36',yearFrom:1990,yearTo:2000,isActive:true,isPublished:true,model3dKey:entry.file};
const taxonomy={brands:[{id:'fixture-brand',name:'BMW',nameAr:'بي إم دبليو',aliases:[],isActive:true}],vehicles:[{id:'fixture-model',brandId:'fixture-brand',make:'BMW',displayMake:'BMW',makeAr:'بي إم دبليو',model:'3 Series',modelAr:'الفئة الثالثة',yearFrom:1990,yearTo:2000,isActive:true,generations:[generation]}]};
const inspection={uid:'a'.repeat(32),title:'UI fixture · '+entry.title,author:entry.author,authorUrl:entry.authorUrl??null,url:entry.url,thumbnail:null,license:entry.license,licenseUrl:'https://creativecommons.org/licenses/by/4.0/',licenseClass:'CC BY',downloadable:true,allowed:true,refusalCode:null,inspectedAt:'2026-11-07T12:00:00Z',duplicate:null};
const gate={verdict:'FULL',problems:[],warnings:[],limited:{},text:[],checks:{wheels:[1,2,3,4]}};
const fixture={id:'fixture-import',generationId:generation.id,status:'READY',progress:100,errorCode:null,make:'BMW',model:'3 Series',code:'E36',yearFrom:1990,yearTo:2000,source:'Sketchfab',author:entry.author,license:entry.license,sourceUrl:entry.url,provenance:{...inspection,downloadedAt:'2026-11-07T12:01:00Z',downloadSource:'https://api.sketchfab.com/v3/models/'+inspection.uid+'/download',sourceSha256:'a'.repeat(64),originalDownloadedBytes:glb.length,preparedSha256:'b'.repeat(64),optimization:{warnings:[],bytesBefore:glb.length,bytesAfter:glb.length,removed:0}},hasModel:true,hasRawModel:true,viewerConfig:config,validation:{valid:true,validatedAt:'fixture-revision',bytes:glb.length,triangles:40000,dimensions:[1.8,1.4,4.5],accessoryGate:gate,partMap:{sha256:'b'.repeat(64),proposal:{WHEELS:{ids:['m1c0'],confidence:.9,by:'name+shape'}},pieces:120}},existingModel3dKey:null,publishedModel3dKey:null};
async function theme(p,ar,dark){
 const applied=await p.evaluate(({ar,dark})=>{let f;for(const el of document.querySelectorAll('*')){const k=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));if(k){f=el[k];break;}}while(f?.return)f=f.return;const stack=[f];let language=false,theme=false;while(stack.length){const n=stack.pop();if(!n)continue;const v=n.memoizedProps?.value;if(v?.setLanguage&&!language){v.setLanguage(ar?'ar':'en');language=true;}if(v?.setMode&&!theme){v.setMode(dark?'dark':'light');theme=true;}if(n.child)stack.push(n.child);if(n.sibling)stack.push(n.sibling);}return{language,theme};},{ar,dark});assert.ok(applied.language&&applied.theme);await p.waitForTimeout(250);
}
async function go(p,route){if(STATIC){await p.goto(BASE+route);await p.waitForFunction(()=>{for(const el of document.querySelectorAll('*'))if(Object.keys(el).some(k=>k.startsWith('__reactFiber$')))return true;return false;});}else await p.evaluate(r=>{window.history.pushState({},'',r);window.dispatchEvent(new PopStateEvent('popstate'));},route);await p.waitForTimeout(650);}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
 try{for(const ar of [false,true])for(const dark of [false,true]){
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});let record=structuredClone(fixture),inspected=structuredClone(inspection),writes=[];
  await ctx.addInitScript(()=>{if(window!==window.top)return;sessionStorage.setItem('motexa_access_token','isolated-ui-fixture');window.__shown=false;window.addEventListener('message',e=>{try{if(JSON.parse(e.data).type==='shown')window.__shown=true;}catch{}});});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.includes('/api/')){
    const q=u.pathname.slice(u.pathname.indexOf('/api/')+4),method=route.request().method();let body={success:true};
    if(method!=='GET'){writes.push({method,path:q});if(!q.endsWith('/sketchfab/inspect'))throw Error('Unexpected fixture mutation: '+q);body={inspection:inspected};}
    else if(q==='/auth/me')body={success:true,user:{id:'fixture-user',fullName:'UI fixture',role:'ADMIN',status:'ACTIVE',adminPermissions:[{permission:'MANAGE_SPARE_PARTS'}]}};
    else if(q==='/catalog/garage')body={cars:[]};
    else if(q==='/catalog/3d-models')body={revision:'a'.repeat(64),activeKeys:[entry.file],models:[config]};
    else if(q==='/admin/parts/vehicles')body=taxonomy;
    else if(q.endsWith('/vehicle-3d-imports/fixture-import/model'))return route.fulfill({body:glb,contentType:'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});
    else if(q.endsWith('/vehicle-3d-imports/fixture-import'))body={import:record};
    else if(q.endsWith('/vehicle-3d-imports'))body={imports:[record]};
    return route.fulfill({json:body,headers:{'access-control-allow-origin':'*'}});
   }
   if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('/three@0.160.1/')){const suffix=u.pathname.split('/three@0.160.1/')[1];if(suffix&&!suffix.includes('..'))return route.fulfill({body:fs.readFileSync(path.join(ROOT,'.private/three-r160/package',suffix)),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});}
   if(STATIC&&u.origin===BASE)return serveExport(route,STATIC);
   if(!STATIC&&['localhost','127.0.0.1'].includes(u.hostname))return route.continue();return route.abort();
  });
  const shot=async(name)=>{
   await theme(p,ar,dark);
   // Dismiss only the existing department layout's development warning; do not alter its owner's code.
   const knownToast=p.locator('div[role="button"]').filter({hasText:/Invalid style property of/}).locator('button').last();
   if(await knownToast.isVisible())await knownToast.click();
   const text=await p.locator('body').innerText();assert.doesNotMatch(text,/\?{4,}|\uFFFD/,'Broken text encoding');if(ar)assert.match(text,/[\u0600-\u06ff]/);
   const overflow=await p.evaluate(()=>({document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(overflow.document<=390&&overflow.body<=390,JSON.stringify(overflow));assert.deepEqual(errors,[]);
   const file=`${name}-${ar?'ar':'en'}-${dark?'dark':'light'}.png`;await p.screenshot({path:path.join(OUT,file),fullPage:true});results.push({file,overflow,errors:[...errors],fixture:true});console.log('PASS',file);
  };
  await p.goto(BASE+'/dept/vehicles/imports/new',{timeout:120000});await p.getByText('Import from Sketchfab',{exact:true}).waitFor({timeout:120000});await theme(p,ar,dark);
  await shot('01-form');
  const field=p.getByRole('textbox',{name:ar?'رابط النموذج من Sketchfab':'Sketchfab model URL'});await field.fill(entry.url);assert.equal(await field.evaluate(e=>getComputedStyle(e).direction),'ltr');
  const inspect=p.getByRole('button',{name:ar?'فحص الرابط':'Inspect link',exact:true});await inspect.click();await p.getByText(inspection.title,{exact:true}).waitFor();await p.getByText(inspection.title,{exact:true}).scrollIntoViewIfNeeded();await shot('02-inspection');
  // Assert Arabic text alignment in the actual rendered inspection card.
  if(ar)assert.equal(await p.getByText(inspection.title,{exact:true}).evaluate(e=>getComputedStyle(e).textAlign),'right');
  record={...structuredClone(fixture),status:'OPTIMIZING',progress:55,hasModel:false,validation:null};await go(p,'/dept/vehicles/imports/fixture-import');await p.getByRole('progressbar').waitFor();await shot('03-progress');
  record=structuredClone(fixture);await go(p,'/dept/vehicles/imports/new');await go(p,'/dept/vehicles/imports/fixture-import');await p.locator('iframe').scrollIntoViewIfNeeded();await p.waitForFunction(()=>window.__shown,null,{timeout:30000});await shot('04-review-original');
  const paint=p.getByRole('button',{name:ar?'تجربة الطلاء الأحمر':'Test red paint',exact:true});await paint.scrollIntoViewIfNeeded();await paint.click();await p.waitForTimeout(600);await p.locator('iframe').scrollIntoViewIfNeeded();await shot('04-review-paint');
  record={...structuredClone(fixture),status:'PUBLISHED',publishedModel3dKey:entry.file};await go(p,'/dept/vehicles/imports/new');await go(p,'/dept/vehicles/imports/fixture-import');await p.getByRole('button',{name:ar?'تأكيد خريطة القطع':'Confirm part map',exact:true}).scrollIntoViewIfNeeded();await shot('05-published');
  inspected={...inspection,license:'CC BY-NC 4.0 (UI fixture)',allowed:false,licenseClass:null,refusalCode:'LICENSE_NOT_ALLOWED'};await go(p,'/dept/vehicles/imports/new');await p.getByRole('textbox',{name:ar?'رابط النموذج من Sketchfab':'Sketchfab model URL'}).fill(entry.url);await p.getByRole('button',{name:ar?'فحص الرابط':'Inspect link',exact:true}).click();const refusal=p.getByText(ar?/لا يمكن استيراد هذا النموذج/:/This model cannot be imported/);await refusal.waitFor();await refusal.scrollIntoViewIfNeeded();await shot('06-error');
  for(const [name,value]of [['07-not-downloadable',{...inspection,allowed:false,downloadable:false,refusalCode:'NOT_DOWNLOADABLE'}],['08-duplicate',{...inspection,duplicate:{importId:'fixture-import',name:'Existing fixture import'}}]]){
   inspected=value;await go(p,'/dept/vehicles/imports/new');await theme(p,ar,dark);
   await p.getByRole('textbox',{name:ar?'رابط النموذج من Sketchfab':'Sketchfab model URL'}).fill(entry.url);
   await p.getByRole('button',{name:ar?'فحص الرابط':'Inspect link',exact:true}).click();
   await p.getByText(inspection.title,{exact:true}).waitFor();await p.getByText(inspection.title,{exact:true}).scrollIntoViewIfNeeded();
   assert.equal(await p.getByRole('button',{name:ar?'استيراد للمراجعة الخاصة':'Import for private review',exact:true}).isDisabled(),true);
   await shot(name);
  }
  assert.equal(writes.length,4);await ctx.close();
 }}finally{await browser.close();fs.writeFileSync(path.join(OUT,'ui-results.json'),JSON.stringify({evidence:'Mocked UI states using a retained production model; no live Sketchfab import.',results},null,2)+'\n');}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
