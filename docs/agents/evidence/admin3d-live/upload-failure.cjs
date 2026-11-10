const {mobile,login,fs,path,ROOT,save,db}=require('./common.cjs');
(async()=>{const s=await login('admin.parts'),b=await mobile('@playwright/test').chromium.launch({channel:'chrome',headless:true}),c=await db(),out={};
try{
 const before=(await c.query('SELECT count(*)::int AS n FROM "Vehicle3DImport"')).rows[0].n;
 const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(20000);await p.addInitScript(t=>sessionStorage.setItem('motexa_access_token',t),s.token);await p.goto('http://127.0.0.1:8085/dept/vehicles?section=imports');
 await p.getByRole('button',{name:'Generation',exact:true}).click();await p.getByLabel('Search').fill('E53');await p.getByText('BMW X5 E53 (1999\u20132006)',{exact:true}).click();
 const entry=Object.values(JSON.parse(fs.readFileSync(path.join(ROOT,'docs/3d/models.json'),'utf8'))).find(x=>x.file==='bmw-x5-e53');
 await p.getByLabel('Source / provenance',{exact:true}).fill(entry.title);await p.getByLabel('Author / rights holder',{exact:true}).fill(entry.author);await p.getByLabel('License / redistribution permission',{exact:true}).fill(entry.license);await p.getByLabel('Source HTTPS URL (optional)',{exact:true}).fill('http://example.com/invalid-protocol');
 const chooser=p.waitForEvent('filechooser');await p.getByText('Choose GLB',{exact:true}).click();await (await chooser).setFiles(path.join(ROOT,'backend/public/3d/bmw-x5-e53.glb'));
 const response=p.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/vehicle-3d-imports'));await p.getByText('Upload for technical validation',{exact:true}).click();const r=await response;out.api={status:r.status(),body:await r.json()};
 await p.getByText('Upload failed. Choose a valid GLB within the backend size limit and verify provenance fields.',{exact:true}).waitFor();out.uiMessage=await p.getByText('Upload failed.',{exact:false}).innerText();await p.screenshot({path:path.join(__dirname,'A-05-upload-failure.png'),fullPage:true});out.importCountBefore=before;out.importCountAfter=(await c.query('SELECT count(*)::int AS n FROM "Vehicle3DImport"')).rows[0].n;
}catch(e){out.error=e.message}finally{save('A-05-live',out);console.log(JSON.stringify(out));await c.end();await b.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
