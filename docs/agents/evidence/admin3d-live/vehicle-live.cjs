const {login,api,save,mobile,path}=require('./common.cjs');
(async()=>{
 const s=await login('admin.parts'),customer=await login('customer');
 const key='bmw-x5-e53',base='/admin/parts/vehicle-3d-models/'+key;
 const before=(await api(s,base)).body.model,out={key,generationId:before.generationId};
 if(!before.published)throw Error('Expected published starting model');
 try{
 const deactivated=await api(s,'/admin/parts/vehicles/generations/'+before.generationId,'PATCH',{isActive:false});
 if(deactivated.status!==200)throw Error('Generation deactivation failed '+deactivated.status);
 const taxonomy=(await api(s,'/admin/parts/vehicles')).body;
 const gen=taxonomy.vehicles.flatMap(v=>v.generations).find(g=>g.id===before.generationId);
 const managed=(await api(s,base)).body.model;
 const runtime=(await api(customer,'/catalog/3d-models')).body;
 out.A01={taxonomy:{isActive:gen.isActive,isPublished:gen.isPublished,model3dKey:gen.model3dKey},managementPublished:managed.published,runtimeIncludesKey:runtime.activeKeys.includes(key)};
 const b=await mobile('@playwright/test').chromium.launch({channel:'chrome',headless:true});
 try{const p=await b.newPage({viewport:{width:390,height:844}});await p.addInitScript(t=>sessionStorage.setItem('motexa_access_token',t),s.token);await p.goto('http://127.0.0.1:8085/dept/vehicles');await p.getByLabel('Search brand, model or generation').fill('E53');await p.waitForTimeout(500);out.A01.screenText=await p.locator('body').innerText();await p.screenshot({path:path.join(__dirname,'A-01-inactive-generation.png'),fullPage:true});}finally{await b.close()}
 }finally{out.taxonomyRestore=await api(s,'/admin/parts/vehicles/generations/'+before.generationId,'PATCH',{isActive:true});out.taxonomyRestore={status:out.taxonomyRestore.status};save('A-01-A-03',out)}
 let current=(await api(s,base)).body.model;
 try{
 const hidden=await api(s,base+'/publication','POST',{revision:current.revision,published:false});if(hidden.status!==200)throw Error('Hide failed '+hidden.status);
 const map=await api(s,'/admin/parts/part-maps/'+key);
 const models=(await api(customer,'/catalog/3d-models')).body;
 out.A03={hideStatus:hidden.status,map,runtimeIncludesKey:models.activeKeys.includes(key)};
 }finally{current=(await api(s,base)).body.model;out.publicationRestore={status:(await api(s,base+'/publication','POST',{revision:current.revision,published:true})).status};save('A-01-A-03',out)}
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e.message);process.exitCode=1});
