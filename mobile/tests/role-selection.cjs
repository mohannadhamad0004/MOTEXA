const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {createRequire}=require('module');
const mobile=path.resolve(__dirname,'..');
const {chromium}=createRequire(mobile+'/package.json')('@playwright/test');
const root=path.join(mobile,'dist-uiux'),output=path.join(mobile,'test-results/role-selection');fs.mkdirSync(output,{recursive:true});
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
 const errors=[],apiCalls=[],results=[];
 try{
  for(const [width,height] of [[320,740],[390,844],[595,700]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
   p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiCalls.push(r.url());});
   await p.goto(base+'/choose-role');
   for(const ar of [false,true]){
    if(ar){await p.getByRole('button',{name:'التبديل إلى العربية',exact:true}).click();await p.getByRole('button',{name:'تفعيل المظهر الليلي',exact:true}).click();}
    const mainLabel=ar?'اختر دورك للمتابعة':'Choose your role to continue';
    const mainButton=()=>p.getByRole('button',{name:new RegExp('^'+mainLabel)});
    await mainButton().waitFor();assert.equal(await mainButton().isDisabled(),true);
    await p.evaluate(()=>document.fonts.ready);
    await p.screenshot({path:path.join(output,'roles-'+width+'-'+(ar?'ar-dark':'en-light')+'.png')});
    const roles=[['Car Owner','مالك المركبة','customer'],['Mechanic','ميكانيكي','mechanic'],['Spare Parts Provider','مزود قطع غيار','parts'],['Towing Provider','مزود خدمة سحب','towing']];
    for(const [en,arabic,key] of roles){
     const name=ar?arabic:en,radio=p.getByRole('radio',{name,exact:true});
     await radio.click();assert.equal(await radio.getAttribute('aria-checked'),'true');
     await radio.click();assert.equal(await radio.getAttribute('aria-checked'),'false');
     assert.equal(await mainButton().isDisabled(),true);
     await radio.click();
     if(key==='mechanic'){
       assert.equal(await radio.evaluate(el=>getComputedStyle(el).outlineStyle),'none','Pointer selection should not add a second border');
       await p.screenshot({path:path.join(output,'roles-'+width+'-'+(ar?'ar-dark':'en-light')+'-selected.png')});
       if(width===390){await p.keyboard.press('Tab');await radio.focus();assert.equal(await radio.evaluate(el=>getComputedStyle(el).outlineStyle),'solid','Keyboard focus must remain visible');}
     }
     await p.getByRole('button',{name:new RegExp('^'+(ar?'المتابعة بصفتك ':'Continue as ')+name)}).click();
     await p.waitForURL(url=>url.pathname==='/auth/login'&&url.searchParams.get('selectedRole')===key);
     await p.goto(base+'/choose-role');
     await mainButton().waitFor();assert.equal(await mainButton().isDisabled(),true);
    }
    const admins=[['Super Admin','المشرف العام','super-admin'],['Mechanics Admin','مسؤول الميكانيكيين','mechanics-admin'],['Spare Parts Admin','مسؤول قطع الغيار','parts-admin'],['Towing Admin','مسؤول خدمات السحب','towing-admin']];
    for(const [en,arabic,key] of admins){
     await p.getByRole('button',{name:ar?'فتح أدوار الإدارة':'Open administration roles',exact:true}).click();
     const name=ar?arabic:en,radio=p.getByRole('radio',{name,exact:true});
     await radio.click();assert.equal(await radio.getAttribute('aria-checked'),'true');
     if(key==='mechanics-admin')await p.screenshot({path:path.join(output,'admin-roles-'+width+'-'+(ar?'ar-dark':'en-light')+'.png')});
     await p.getByRole('button',{name:new RegExp('^'+(ar?'المتابعة بصفتك ':'Continue as ')+name)}).click();
     await p.waitForURL(url=>url.pathname==='/auth/login'&&url.searchParams.get('selectedRole')===key);
     await p.goto(base+'/choose-role');await mainButton().waitFor();
    }
    await p.getByRole('button',{name:ar?'فتح أدوار الإدارة':'Open administration roles',exact:true}).click();
    await p.getByRole('button',{name:ar?'إغلاق':'Close',exact:true}).click();
    await p.getByRole('radiogroup',{name:ar?'اختر دورك':'Choose your role',exact:true}).waitFor();
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    results.push({width,height,language:ar?'ar':'en',appearance:ar?'dark':'light',publicRoleRoutes:4,adminRoleRoutes:4,deselect:true,disabledWithoutSelection:true,closeAdministration:true,horizontalOverflow:false});
   }
   await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(apiCalls,[]);
  const report={note:'Actual role selection UI; verifies selection and routing only. Does not submit credentials or simulate authorization. Existing backend permissions unchanged.',results,errors,apiCalls};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
