const h = require('../admin3d-live/common.cjs');
const assert = require('node:assert/strict');
const outDir = __dirname;
const save = (name, data) => h.fs.writeFileSync(h.path.join(outDir, name + '.json'), JSON.stringify(data, null, 2));
async function page(browser, session, route) {
  const p = await browser.newPage({viewport:{width:390,height:844}});
  await p.addInitScript(token => {
    if (window !== top) return;
    sessionStorage.setItem('motexa_access_token', token);
    window.__viewerMessages = [];
    addEventListener('message', e => { try { const m=JSON.parse(e.data); if(m.type)window.__viewerMessages.push(m); } catch {} });
  }, session.token);
  await p.goto('http://127.0.0.1:8085' + route, {waitUntil:'domcontentloaded',timeout:60000});
  return p;
}
async function appearance(p, lang, mode) {
  await p.waitForFunction(() => [...document.querySelectorAll('*')].some(el=>Object.keys(el).some(k=>k.startsWith('__reactFiber$'))));
  const result = await p.evaluate(({lang,mode}) => {
    let f; for (const el of document.querySelectorAll('*')) { const k=Object.keys(el).find(k=>k.startsWith('__reactFiber$')); if(k){f=el[k];break;} }
    while(f?.return)f=f.return;
    const stack=[f]; let language=false,theme=false;
    while(stack.length){const n=stack.pop();if(!n)continue;const v=n.memoizedProps?.value;
      if(v?.setLanguage&&!language){v.setLanguage(lang);language=true;}
      if(v?.setMode&&!theme){v.setMode(mode);theme=true;}
      if(n.child)stack.push(n.child);if(n.sibling)stack.push(n.sibling);
    } return {language,theme};
  },{lang,mode});
  assert.ok(result.language&&result.theme); await p.waitForTimeout(350);
}
async function capture(p, name) {
  await p.screenshot({path:h.path.join(outDir,name+'.png'),fullPage:true});
  return {text:await p.locator('body').innerText(),overflow:await p.evaluate(()=>document.documentElement.scrollWidth>390),viewer:await p.evaluate(()=>window.__viewerMessages?.map(m=>({type:m.type,pieces:m.pieces,message:m.message})).slice(-8))};
}
module.exports={...h,assert,save,outDir,page,appearance,capture};
