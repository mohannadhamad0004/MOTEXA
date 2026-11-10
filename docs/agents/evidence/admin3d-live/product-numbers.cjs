const {mobile,login,api,db,save,path}=require('./common.cjs');
(async()=>{
 const s=await login('shop'),id='374b952b-d584-4acb-94b2-52deb95ef408',c=await db(),out={};
 const before=(await c.query('SELECT price,stock FROM "PartsProduct" WHERE id=$1',[id])).rows[0];
 const b=await mobile('@playwright/test').chromium.launch({channel:'chrome',headless:true});
 try{
 const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(20000);await p.addInitScript(t=>sessionStorage.setItem('motexa_access_token',t),s.token);
 p.on('request',r=>{if(r.method()==='PATCH'&&r.url().includes('/products/'+id)){const v=r.postDataJSON();out.submitted={price:v.price,stock:v.stock}}});
 await p.goto('http://127.0.0.1:8085/provider/parts/products/edit/'+id);
 await p.getByText('Next',{exact:true}).click();await p.getByText('Next',{exact:true}).click();
 await p.getByLabel('Price (\u20aa)',{exact:true}).fill('12abc');await p.getByLabel('Stock quantity',{exact:true}).fill('1.9');
 out.entered={price:'12abc',stock:'1.9'};await p.screenshot({path:path.join(__dirname,'C-02-malformed-input.png'),fullPage:true});
 await p.getByText('Next',{exact:true}).click();
 console.log('after Next',await p.locator('body').innerText());
 const response=p.waitForResponse(r=>r.url().includes('/products/'+id)&&r.request().method()==='PATCH');
 await p.getByText('Save changes',{exact:true}).click();out.saveStatus=(await response).status();
 out.persisted=(await c.query('SELECT price,stock FROM "PartsProduct" WHERE id=$1',[id])).rows[0];
 }catch(e){out.error=e.message;console.log(e.message)}finally{
 out.restoreStatus=(await api(s,'/parts/me/products/'+id,'PATCH',{price:Number(before.price),stock:before.stock})).status;
 out.restored=(await c.query('SELECT price,stock FROM "PartsProduct" WHERE id=$1',[id])).rows[0];out.before=before;save('C-02-live',out);console.log(JSON.stringify(out));await c.end();await b.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
