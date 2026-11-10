// Browser evidence uses intercepted API fixtures only; no account, Garage, provider or database writes.
/* global __dirname */
const {chromium}=require('@playwright/test');
const {serveExport}=require('./static-export.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../..'),OUT=process.env.UI_OUT?path.resolve(process.env.UI_OUT):path.join(ROOT,'docs/3d/lifecycle/ui');
const STATIC=process.env.WEB_DIR?path.resolve(process.env.WEB_DIR):null,BASE=STATIC?'http://motexa-ui.local':process.env.WEB||'http://localhost:8085';
const entry=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/3d/models.json'),'utf8'))['bmw-3-series-e36'];
const wing=JSON.parse(fs.readFileSync(path.join(ROOT,'.private/3d-lifecycle/ui-accessory.json'),'utf8'));
const publicWing={...wing,file:`accessories/${wing.file}.glb`};
const config={...entry.viewerConfig,...JSON.parse(fs.readFileSync(path.join(ROOT,'docs/3d/rims-general/bmw-3-series-e36/config.json'),'utf8')),credit:{title:entry.title,author:entry.author,url:entry.url,license:entry.license}};
const glb=fs.readFileSync(path.join(ROOT,'backend/public/3d',entry.file+'.glb'));
const gen={id:'fixture-generation',code:'E36',nameEn:'3 Series E36',nameAr:'الفئة الثالثة E36',yearFrom:1990,yearTo:2000,isActive:true,isPublished:true,model3dKey:entry.file};
const missing={...gen,id:'fixture-missing',code:'F30',nameEn:'3 Series F30',nameAr:'الفئة الثالثة F30',yearFrom:2012,yearTo:2019,isPublished:false,model3dKey:null};
const vehicles=[{id:'fixture-model',brandId:'fixture-brand',make:'BMW',displayMake:'BMW',makeAr:'بي إم دبليو',model:'3 Series',modelAr:'الفئة الثالثة',yearFrom:1990,yearTo:2019,isActive:true,generations:[gen,missing]}];
const taxonomy={brands:[{id:'fixture-brand',name:'BMW',nameAr:'بي إم دبليو',aliases:[],isActive:true}],vehicles};
const now='2026-11-08T12:00:00.000Z';
const cars=[{id:'fixture-car',make:'BMW',model:'3 Series',year:1995,generationId:gen.id,generation:gen,isActive:true,nickname:null,color:null,createdAt:now,updatedAt:now},{id:'missing-car',make:'BMW',model:'3 Series',year:2015,generationId:missing.id,generation:missing,isActive:false,nickname:null,color:null,createdAt:now,updatedAt:now}];
const request={id:'fixture-request',submissionId:'fixture-submission',garageCarId:'missing-car',make:'BMW',model:'3 Series',year:2015,generationId:missing.id,generationName:missing.nameEn,requestedMake:'BMW',requestedModel:'3 Series',requestedYear:2015,requestedGeneration:'F30',trim:null,notes:'Browser fixture',requestStatus:'PENDING_REVIEW',initialReviewState:'PENDING_REVIEW',initialReviewNotes:null,consentAt:now,createdAt:now,updatedAt:now,status:'DRAFT',photos:{front:true,rear:true,left:true,right:true},hasModel:false,provider:null,providerState:null,providerProgress:null,generationStage:'NONE',failureReason:null,reviewNotes:null,validation:null,lengthM:4.5,photoRevision:'fixture',modelRevision:'fixture',vehicle3dMissing:true,demandCount:2};
const accessory={id:'fixture-accessory',productId:'fixture-product',kitPart:'MAIN',accessoryType:'WING',status:'DRAFT',lifecycleState:'DRAFT',revision:1,creditsUsed:0,size:{widthMm:1300,heightMm:null,depthMm:null,lengthMm:null,rimInches:null},rim:null,fitsGenerationIds:[gen.id],installedGenerationId:gen.id,installed360:false,installedApproved:false,partPhotos:[{id:'photo-one'},{id:'photo-two'}],installedPhotos:[{id:'photo-installed'}],fitmentNotes:'Browser fixture',reviewNotes:null,submittedAt:null,generationMode:null,provider:null,providerState:null,providerProgress:null,generationStage:'NONE',generationErrorCode:null,failureReason:null,hasModel:false,validation:null,preview:null,modelRevision:'fixture',mock:false,published:false,updatedAt:now,resumable:false,deactivatedAt:null,product:{name:'Wing · UI fixture',brand:'Fixture',partNumber:'TEST',category:'EXTERIOR_ACCESSORIES',shop:{id:'fixture-shop',shopName:'Shop · UI fixture'}},creditsThisMonth:0,monthlyCredits:5,mode:'real',paidEnabled:false,fits:[{id:gen.id,name:'BMW 3 Series E36',nameAr:'بي إم دبليو الفئة الثالثة E36',years:[1990,2000],has3d:true,fit:{allowed:true,code:null,autoFit:{fit:wing.fit,adj:wing.adj}}}],productName:'Wing · UI fixture',productBrand:'Fixture',shopName:'Shop · UI fixture',shopId:'fixture-shop',cars:[{id:gen.id,name:'BMW E36',nameAr:'بي إم دبليو E36'}]};
const model={key:entry.file,generationId:gen.id,make:'BMW',model:'3 Series',code:'E36',yearFrom:1990,yearTo:2000,published:true,current:true,revision:1,sha256:'a'.repeat(64),bytes:glb.length,viewerConfig:config,source:'LEGACY_CATALOG',provenance:entry,validation:{valid:true},qualityGate:null,partMapStatus:'CONFIRMED',paintSupport:true,createdAt:now,updatedAt:now,references:{garage:2,partMaps:1,autoFits:1},canDelete:false,importId:null,submissionId:null};
// Existing automated UI fixture, updated to the server's explicit readiness contract. Never normal app data.
accessory.review={model:{generated:true,exists:true,optimized:true,validation:'PASSED',reason:null},targets:[{generationId:gen.id,model3dKey:entry.file,name:'BMW E36',nameAr:'بي إم دبليو E36',has3d:true,semanticPart:'REAR_BUMPER',partMap:'CONFIRMED',fit:{state:'PASSED',current:true,approvedAt:null,reason:null},previewCurrent:false}],publication:{state:'PRIVATE_CANDIDATE',canPublish:false,blockers:[{code:'FIT_REVIEW_REQUIRED',message:'Review and approve the current fit.'}]},canRetryProcessing:false};
async function theme(p,ar,dark){const applied=await p.evaluate(({ar,dark})=>{let f;for(const el of document.querySelectorAll('*')){const k=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));if(k){f=el[k];break;}}while(f?.return)f=f.return;const stack=[f];let language=false,theme=false;while(stack.length){const n=stack.pop();if(!n)continue;const v=n.memoizedProps?.value;if(v?.setLanguage&&!language){v.setLanguage(ar?'ar':'en');language=true;}if(v?.setMode&&!theme){v.setMode(dark?'dark':'light');theme=true;}if(n.child)stack.push(n.child);if(n.sibling)stack.push(n.sibling);}return{language,theme};},{ar,dark});assert.ok(applied.language&&applied.theme);await p.waitForTimeout(250);}
async function go(p,route){await p.goto(BASE+route,{timeout:60000});await p.waitForFunction(()=>{for(const el of document.querySelectorAll('*'))if(Object.keys(el).some(k=>k.startsWith('__reactFiber$')))return true;return false;});await p.waitForTimeout(650);}
async function main(){fs.mkdirSync(OUT,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];let activePage;
try{for(const ar of (process.env.UI_LANG?[process.env.UI_LANG==='ar']:[false,true]))for(const dark of (process.env.UI_THEME?[process.env.UI_THEME==='dark']:[false,true]))for(const role of (process.env.UI_ROLES?.split(',')??['PARTS_PROVIDER','ADMIN','CUSTOMER'])){
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});let a=structuredClone(accessory),m=structuredClone(model),writes=[];
 await ctx.addInitScript(()=>{if(window!==top)return;sessionStorage.setItem('motexa_access_token','isolated-ui-fixture');window.__shown=false;window.__viewerMessages=[];addEventListener('message',e=>{try{const x=JSON.parse(e.data);window.__viewerMessages.push(x);if(x.type==='shown')window.__shown=true;}catch{}});});
 const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(30000);activePage=p;p.on('pageerror',e=>errors.push(e.message));
 if(process.env.DEBUG3D)p.on('console',e=>{if(e.type()==='error')console.log('BROWSER',e.text().slice(0,500));});
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url()),method=route.request().method();
  if(u.pathname.endsWith('/3d/'+entry.file+'.glb'))return route.fulfill({body:glb,contentType:'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});
  if(u.pathname.endsWith('/3d/accessories/'+wing.file+'.glb'))return route.fulfill({body:fs.readFileSync(path.join(ROOT,'backend/public/3d/accessories',wing.file+'.glb')),contentType:'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});
  if(u.pathname.includes('/api/')){const q=u.pathname.slice(u.pathname.indexOf('/api/')+4);let body={success:true};
   if(process.env.DEBUG3D)console.log(method,q);
   if(method!=='GET'){
    const payload=route.request().postDataJSON();writes.push({method,path:q,body:payload});
    if(q.endsWith('/config')){assert.equal(payload.revision,m.revision);const next={...m.viewerConfig,...payload.config};for(const k of Object.keys(next))if(next[k]===null)delete next[k];m={...m,revision:m.revision+1,viewerConfig:next};body={model:m};}
    else if(q.endsWith('/publication')){assert.equal(payload.revision,m.revision);m={...m,revision:m.revision+1,published:payload.published};body={model:m};}
    else if(q.startsWith('/admin/parts/accessory-3d/fixture-accessory/')){
     const action=q.split('/').pop();assert.ok(['approve','start','refit','preview','publish','unpublish','reactivate','discard-candidate'].includes(action),'Unexpected accessory action '+action);
     if(action==='preview'){a.review.targets[0].previewCurrent=true;a.review.publication={state:'READY_FOR_FINAL_REVIEW',canPublish:true,blockers:[]};}
     if(action==='publish'){assert.equal(payload.visuallyVerified,true);assert.equal(payload.modelRevision,a.modelRevision);a={...a,status:'PUBLISHED',published:true,lifecycleState:'PUBLISHED'};a.review.publication={state:'PUBLISHED',canPublish:false,blockers:[],file:publicWing.file};}
     if(action==='start')assert.equal(a.status,'APPROVED_FOR_GENERATION');
     a={...a,revision:a.revision+1,...(action==='approve'?{status:'APPROVED_FOR_GENERATION',lifecycleState:'APPROVED_FOR_GENERATION',mode:'mock'}:action==='start'?{status:'GENERATING',lifecycleState:'GENERATING',provider:'MOCK',providerState:'IN_PROGRESS',providerProgress:45,generationStage:'GENERATING'}:action==='unpublish'?{deactivatedAt:now,lifecycleState:'UNPUBLISHED'}:action==='reactivate'?{deactivatedAt:null,lifecycleState:'PUBLISHED'}:action==='discard-candidate'?{hasModel:false,status:'APPROVED_FOR_GENERATION',lifecycleState:'APPROVED_FOR_GENERATION'}:{})};body={accessory:a};
    }else if(q.startsWith('/admin/parts/auto-fits/')){assert.equal(method,'PUT');a.review.targets[0].fit.state=payload.needsCorrection?'NEEDS_CORRECTION':'APPROVED';a.review.targets[0].fit.approvedAt=payload.needsCorrection?null:now;body={fit:{fit:wing.fit,adj:null,approvedAt:a.review.targets[0].fit.approvedAt}};}
    else throw Error('Unexpected fixture write: '+q);
   }
   else if(q==='/auth/me')body={success:true,user:{id:'fixture-user',fullName:'Browser fixture',email:'fixture@motexa.test',role,status:'ACTIVE',adminPermissions:[{permission:'MANAGE_SPARE_PARTS'}]}};
   else if(q==='/provider/onboarding/status')body={status:{kind:'parts',id:'fixture-shop',status:'APPROVED',unreadMessages:0,unreadNotifications:0}};
   else if(q==='/parts/me/portal/identity')body={id:'fixture-shop',name:'Shop · UI fixture'};
   else if(q==='/catalog/garage')body={cars};
   else if(q==='/catalog/vehicle-list')body={vehicles};
   else if(q==='/catalog/3d-models')body={revision:String(m.revision).padStart(64,'a'),activeKeys:m.published?[entry.file]:[],models:m.published?[m.viewerConfig]:[]};
   else if(q==='/admin/parts/vehicles')body=taxonomy;
   else if(q==='/admin/parts/part-maps')body={models:[{key:entry.file,name:'BMW E36',status:'confirmed',pieces:100,confirmedAt:now,proposalSummary:{},mapSummary:{},gate:null}]};
   else if(q==='/admin/parts/auto-fits')body={fits:[{accessoryId:a.id,productId:a.productId,productName:a.productName,type:'WING',status:a.status,file:a.status==='PUBLISHED'?publicWing.file:null,hasModel:true,modelRevision:a.modelRevision,size:a.size,generation:{id:gen.id,name:'BMW E36'},fit:{fit:wing.fit,adj:wing.adj,approvedAt:a.review.targets[0].fit.approvedAt},computing:false}]};
   else if(q==='/admin/parts/part-maps/'+entry.file)body={partMap:{key:entry.file,status:'proposed',modelSha256:'a'.repeat(64),pieces:100,map:{},proposal:{},confirmedAt:null}};
   else if(q.includes('/suggestions'))body={generations:[{...missing,make:'BMW',model:'3 Series'}]};
   else if(q.includes('/vehicle-requests'))body=q.endsWith('/fixture-request')?{request}:{requests:[request]};
   else if(q==='/admin/parts/vehicle-3d-models')body={models:[m]};
   else if(q.endsWith('/'+entry.file+'/model'))return route.fulfill({body:glb,contentType:'model/gltf-binary'});
   else if(q.includes('/vehicle-3d-models/'))body={model:m};
   else if(q==='/admin/parts/accessory-3d')body={accessories:[a]};
   else if(q==='/admin/parts/accessory-3d/fixture-accessory')body={accessory:a};
   else if(q==='/parts/me/products/fixture-product/accessory-3d')body={eligible:true,category:'EXTERIOR_ACCESSORIES',isUniversal:false,productName:a.productName,accessory:a,parts:[{part:'MAIN',type:'WING',status:a.status}],sizeRanges:{WING:{field:'widthMm',min:500,max:2200}}};
   else if(q.includes('/assets/model'))return route.fulfill({body:fs.readFileSync(path.join(ROOT,'backend/public/3d/accessories',wing.file+'.glb')),contentType:'model/gltf-binary'});
   else if(q.includes('/assets/')||q.includes('/photos/'))return route.fulfill({body:fs.readFileSync(path.join(ROOT,'docs/3d/sketchfab-import/05-published-en-light.png')),contentType:'image/png'});
   else if(q.endsWith('/accessory-3d/garage'))body={cars:cars.map((c,i)=>({carId:c.id,make:c.make,model:c.model,year:c.year,isActive:c.isActive,generationId:c.generationId,allowed:i===0,reason:i===0?null:'NO_VEHICLE_3D'}))};
   else if(q.includes('/catalog/products/')&&q.endsWith('/accessory-3d'))body={accessory:{type:'WING',fits:[{id:gen.id,nameEn:gen.nameEn,nameAr:gen.nameAr}],model:publicWing,installed:null,parts:[{part:'MAIN',type:'WING',fitsIds:[gen.id],model:publicWing,autoFit:{fit:wing.fit,adj:wing.adj},allowed:true,reason:null}]}};
   else if(q==='/catalog/parts/fixture-product')body={product:{id:'fixture-product',name:'Wing · UI fixture',brand:'Fixture',partNumber:'TEST',price:120,stock:'IN',available:5,category:'EXTERIOR_ACCESSORIES',condition:'NEW',partType:null,imageUri:null,fitments:[{make:'BMW',model:'3 Series',yearFrom:1990,yearTo:2000,generationId:gen.id}],shop:{id:'fixture-shop',name:'Shop · UI fixture',city:'NABLUS'},model3d:{kit:false,parts:[{part:'MAIN',type:'WING'}],generationIds:[gen.id]}}};
   else if(q.includes('/vehicle-3d-submissions'))body={submissions:[]};
   return route.fulfill({json:body,headers:{'access-control-allow-origin':'*'}});
  }
  if(u.pathname.endsWith('/3d/'+entry.file+'.glb'))return route.fulfill({body:glb,contentType:'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});
  if(u.pathname.endsWith('/3d/accessories/'+wing.file+'.glb'))return route.fulfill({body:fs.readFileSync(path.join(ROOT,'backend/public/3d/accessories',wing.file+'.glb')),contentType:'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});
  if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('/three@0.160.1/')){const suffix=u.pathname.split('/three@0.160.1/')[1];if(!suffix.includes('..'))return route.fulfill({body:fs.readFileSync(path.join(ROOT,'.private/three-r160/package',suffix)),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});}
  if(STATIC&&u.origin===BASE)return serveExport(route,STATIC);
  if(!STATIC&&['localhost','127.0.0.1'].includes(u.hostname))return route.continue();return route.abort();
 });
 const shot=async(name,focus)=>{await theme(p,ar,dark);if(focus)await focus.scrollIntoViewIfNeeded();const toast=p.locator('div[role="button"]').filter({hasText:/Invalid style property of/}).locator('button').last();if(await toast.isVisible())await toast.click();const text=await p.locator('body').innerText();assert.doesNotMatch(text,/\?{4,}|\uFFFD/,'Broken text encoding');if(ar){assert.match(text,/[\u0600-\u06ff]/);assert.ok(await p.locator('body').evaluate(el=>[...el.querySelectorAll('*')].some(n=>/[\u0600-\u06ff]/.test(n.textContent)&&getComputedStyle(n).textAlign==='right')),'Arabic text must align right');}const overflow=await p.evaluate(()=>({document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(overflow.document<=390&&overflow.body<=390,JSON.stringify(overflow));assert.deepEqual(errors,[]);const file=`${name}-${ar?'ar':'en'}-${dark?'dark':'light'}.png`;await p.screenshot({path:path.join(OUT,file),fullPage:true});results.push({file,overflow,errors:[...errors],encoding:'pass',rtl:ar?'right-aligned Arabic':'English',fixture:true});console.log('PASS',file);};
 const action=async(label,suffix)=>{const [res]=await Promise.all([p.waitForResponse(r=>new URL(r.url()).pathname.endsWith(suffix)&&r.request().method()!=='GET'),p.getByRole('button',{name:label,exact:true}).click()]);assert.equal(res.status(),200);await p.waitForTimeout(400);};
 if(role==='PARTS_PROVIDER'){
  await p.goto(BASE+'/provider/parts/accessory-3d/fixture-product',{timeout:120000});await p.getByRole('button',{name:'Submit for 3D',exact:true}).waitFor({timeout:30000});await shot('01-shop-request');
  await shot('01-shop-part-photos',p.getByText(ar?'٥. صور القطعة منفردة (٢–٤)':'5. Photos of the loose part (2–4)',{exact:true}));
  await shot('01-shop-submit',p.getByRole('button',{name:ar?'إرسال لإنشاء ثلاثي الأبعاد':'Submit for 3D',exact:true}));
  a={...a,status:'PENDING_REVIEW',lifecycleState:'PENDING_REVIEW',submittedAt:now};await go(p,'/provider/parts/accessory-3d/fixture-product');await shot('02-shop-status');
 }else if(role==='ADMIN'&&process.env.UI_FINAL_REVIEW_ONLY){
  a={...a,accessoryType:'REAR_BUMPER',providerTaskId:'ui-existing-task',status:'READY_FOR_FINAL_REVIEW',lifecycleState:'READY_FOR_FINAL_REVIEW',generationMode:'meshy',provider:'MESHY',providerState:'SUCCEEDED',generationStage:'READY',hasModel:true};
  const publish=()=>p.getByRole('button',{name:ar?'اعتماد ونشر النموذج ثلاثي الأبعاد':'Approve & Publish 3D Model',exact:true});
  a.review.targets[0].partMap='MISSING';await go(p,'/dept/accessory3d/fixture-accessory');await theme(p,ar,dark);assert.ok(await publish().isDisabled());await shot('review-01-missing-part-map');
  await p.getByRole('button',{name:ar?'فتح خريطة القطع':'Open part map',exact:true}).click();await p.waitForURL(/mode=parts/);assert.equal(new URL(p.url()).searchParams.get('label'),'REAR_BUMPER');assert.equal(new URL(p.url()).searchParams.get('model3dKey'),entry.file);await shot('review-02-part-map-selection');
  a.accessoryType='WING';a.review.targets[0].semanticPart='WING';a.review.targets[0].partMap='NOT_REQUIRED';a.review.targets[0].fit.state='NOT_RUN';await go(p,'/dept/accessory3d/fixture-accessory');await theme(p,ar,dark);await p.getByRole('button',{name:ar?'تشغيل التركيب التلقائي':'Run automatic fit',exact:true}).waitFor();assert.ok(await publish().isDisabled());await shot('review-03-run-fit');
  a.review.targets[0].fit.state='NEEDS_CORRECTION';await go(p,'/dept/accessory3d/fixture-accessory');await theme(p,ar,dark);await p.getByRole('button',{name:ar?'فتح تصحيحات التركيب':'Open fit corrections',exact:true}).waitFor();await shot('review-04-needs-correction');
  a.review.targets[0].fit.state='PASSED';await go(p,'/dept/accessory3d/fixture-accessory');await theme(p,ar,dark);await shot('review-05-fit-passed-unapproved');await p.getByRole('button',{name:ar?'مراجعة التركيب':'Review fit',exact:true}).click();await p.waitForURL(/mode=fits/);assert.equal(new URL(p.url()).searchParams.get('accessoryId'),a.id);assert.equal(new URL(p.url()).searchParams.get('generationId'),gen.id);await theme(p,ar,dark);await p.waitForFunction(()=>window.__shown,null,{timeout:60000});await shot('review-06-private-fit-preview');
  const approve=p.getByRole('button',{name:ar?'اعتماد التركيب':'Approve fit',exact:true});assert.ok(await approve.isDisabled());await shot('review-06-fit-approval-controls',approve);await p.getByRole('checkbox',{name:ar?'راجعت القطعة المُنشأة على هذه السيارة.':'I reviewed the generated part on this vehicle.',exact:true}).click();await action(ar?'اعتماد التركيب':'Approve fit','/preview');
  await go(p,'/dept/accessory3d/fixture-accessory');await theme(p,ar,dark);await shot('review-07-ready-to-publish',publish());await p.getByRole('checkbox').click();await publish().click();await p.getByText(ar?'هل تريد نشر هذا النموذج؟':'Publish this 3D model?',{exact:true}).waitFor();await shot('review-08-publish-confirmation');await action(ar?'تأكيد النشر':'Confirm publication','/publish');await shot('review-09-published');assert.equal(await publish().count(),0);await p.getByRole('button',{name:ar?'عرض النموذج المنشور':'View published model',exact:true}).waitFor();await p.getByRole('button',{name:ar?'العرض على سيارة متوافقة':'View on compatible car',exact:true}).waitFor();assert.equal(writes.some(w=>w.path.endsWith('/start')),false);
 }else if(role==='ADMIN'){
  a={...a,status:'PENDING_REVIEW',lifecycleState:'PENDING_REVIEW'};await p.goto(BASE+'/dept/3d/requests',{timeout:120000});await p.getByText('3D Requests',{exact:true}).waitFor({timeout:120000});await shot('03-admin-requests');
  await go(p,'/dept/3d');await shot('03-admin-workspace');
  await go(p,'/dept/accessory3d');await shot('03-admin-request-list');
  await go(p,'/dept/accessory3d/fixture-accessory');await theme(p,ar,dark);
  await action(ar?'الموافقة على إنشاء النموذج':'Approve for 3D generation','/approve');
  assert.equal(writes.some(w=>w.path.endsWith('/start')),false,'Approval must not start generation');await shot('04-approved-awaiting-start');
  await action(ar?'بدء إنشاء النموذج':'Start 3D Generation','/start');await shot('04-generation-progress');
  await go(p,'/dept/3d/vehicles');await shot('05-vehicle-list');await go(p,'/dept/3d/vehicles/'+entry.file);await shot('06-vehicle-detail');await shot('06-vehicle-edit',p.getByText(ar?'إعدادات العارض':'Viewer configuration',{exact:true}));
  await shot('06-vehicle-save-controls',p.getByRole('button',{name:ar?'التحقق وحفظ الإعدادات':'Validate and save configuration',exact:true}));
  await action(ar?'التحقق وحفظ الإعدادات':'Validate and save configuration','/config');
  await action(ar?'تعطيل / إلغاء النشر':'Deactivate / unpublish','/publication');await shot('06-vehicle-unpublished');
  await action(ar?'إعادة نشر النموذج المعتمد':'Reactivate reviewed model','/publication');
  await p.evaluate(()=>window.__shown=false);await p.getByRole('button',{name:ar?'معاينة النموذج':'Preview model',exact:true}).click();await p.waitForFunction(()=>window.__shown,null,{timeout:60000});await shot('06-vehicle-preview');
  a={...a,status:'READY_FOR_FINAL_REVIEW',lifecycleState:'READY_FOR_FINAL_REVIEW',providerState:'SUCCEEDED',providerProgress:100,generationStage:'READY',hasModel:true,validation:{valid:true,triangles:1000,bytes:100000}};await go(p,'/dept/3d/accessories');await shot('07-accessory-list');await go(p,'/dept/accessory3d/fixture-accessory');await shot('08-accessory-detail');
  a.review.targets[0].fit.state='NOT_RUN';await go(p,'/dept/accessory3d/fixture-accessory');await theme(p,ar,dark);await action(ar?'تشغيل التركيب التلقائي':'Run automatic fit','/refit');
  await p.evaluate(()=>window.__shown=false);await p.getByRole('button',{name:ar?'معاينة النموذج المُنشأ':'Preview generated model',exact:true}).click();await p.waitForFunction(()=>window.__shown,null,{timeout:60000});await shot('08-accessory-preview');
  a={...a,status:'PUBLISHED',lifecycleState:'PUBLISHED',published:true};await go(p,'/dept/3d/accessories');await go(p,'/dept/accessory3d/fixture-accessory');
  await action(ar?'إلغاء نشر النموذج':'Unpublish model','/unpublish');await shot('08-accessory-unpublished');await action(ar?'إعادة نشر النموذج':'Reactivate model','/reactivate');
  assert.equal(writes.length,8,'Approve, explicit Start, save, two vehicle publication actions, refit and two accessory publication actions');
  await go(p,'/dept/accessory-zones?mode=fits&key='+entry.file);await theme(p,ar,dark);
  await p.getByRole('button',{name:ar?'Wing · UI fixture · جناح خلفي':'Wing · UI fixture · Rear wing',exact:true}).click();await p.waitForFunction(()=>window.__shown,null,{timeout:60000});await shot('08-accessory-fit-review');
  a={...a,status:'APPROVED_FOR_GENERATION',lifecycleState:'FAILED',hasModel:false,generationStage:'FAILED',generationErrorCode:'GENERATION_FAILED',failureReason:'Provider failure · UI fixture'};await go(p,'/dept/3d/accessories');await go(p,'/dept/accessory3d/fixture-accessory');await shot('12-generation-error');
 }else{
  await p.goto(BASE+'/customer/vehicle-requests/new',{timeout:120000});await p.getByRole('textbox',{name:'Brand / manufacturer'}).waitFor({timeout:120000});await shot('09-missing-car-request');await go(p,'/customer/vehicle-requests/new?garageCarId=missing-car');await shot('10-existing-generation-request');await go(p,'/customer/vehicle-requests/fixture-request');await shot('10-existing-generation-status');
  await go(p,'/customer/parts/fixture-product');await theme(p,ar,dark);const view=p.getByRole('button',{name:ar?'اعرضها على سيارتي':'View on my car',exact:true});await view.waitFor();await shot('11-view-on-car-action',view);await view.click();await p.waitForFunction(()=>window.__shown&&window.__viewerMessages.some(m=>m.type==='fit'),null,{timeout:60000});await shot('11-customer-viewer');
  assert.deepEqual(await p.evaluate(()=>window.__viewerMessages.filter(m=>m.type==='fitError')),[]);
  await p.getByRole('button',{name:ar?'على سيارتي':'On my car',exact:true}).click();await shot('11-customer-accessory-off');
  await p.getByRole('button',{name:ar?'اعرضها على سيارتي':'Show on my car',exact:true}).click();
  assert.equal(writes.length,0,'Preview must never mutate Garage');
 }
 await ctx.close();
}}catch(e){if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:path.join(ROOT,'.private/3d-lifecycle/ui-failure.png'),fullPage:true});fs.writeFileSync(path.join(ROOT,'.private/3d-lifecycle/ui-failure.txt'),await activePage.locator('body').innerText());fs.writeFileSync(path.join(ROOT,'.private/3d-lifecycle/ui-messages.json'),JSON.stringify(await activePage.evaluate(()=>window.__viewerMessages),null,2));}throw e;}finally{await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({evidence:'Intercepted UI fixtures at 390px. Retained E36 and wing render in the production viewer. These captures do not prove live generation or fit approval.',results},null,2)+'\n');}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
