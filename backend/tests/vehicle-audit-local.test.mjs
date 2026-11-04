import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, AUDIT, loadTS } from '../scripts/vehicle-audit-lib.mjs';
import { REQUIRED_THREE_FILES, AUDIT_ORIGIN, validateThreeDirectory, resolveLocalThree, localizeViewerHtml, localResponse } from '../scripts/vehicle-audit-local.mjs';

mkdirSync(resolve(AUDIT,'test-fixtures'),{recursive:true});
const directory = mkdtempSync(resolve(AUDIT,'test-fixtures/local-routing-'));
// Routing fixtures only. These are intentionally NOT Three.js or vehicle-render evidence.
writeFileSync(resolve(directory,'package.json'),JSON.stringify({name:'three',version:'0.160.1'}));
for (const file of REQUIRED_THREE_FILES) {
  mkdirSync(dirname(resolve(directory,file)),{recursive:true});
  writeFileSync(resolve(directory,file),'export const routingFixture = true;');
}
const assetPath = resolve(directory,'fixture.glb'); writeFileSync(assetPath,'routing fixture');
const { CAR3D_HTML } = loadTS(resolve(ROOT,'mobile/src/features/car3d/sceneHtml.ts'));

test('production import map becomes exclusively local without changing mobile source',()=>{
  const html=localizeViewerHtml(CAR3D_HTML);
  assert.ok(html.includes('"three":"/vendor/three/build/three.module.js"'));
  assert.ok(html.includes('"three/addons/":"/vendor/three/examples/jsm/"'));
  assert.doesNotMatch(html,/https?:\/\//);
  assert.throws(()=>localizeViewerHtml(html+'<script src="https://example.com/a.js"></script>'),/remote URL/);
});
test('local resolver requires exact version and complete modules, without fetching',()=>{
  assert.equal(validateThreeDirectory(directory,'0.160.1'),directory);
  assert.throws(()=>validateThreeDirectory(directory,'0.170.0'),/requires/);
  assert.throws(()=>resolveLocalThree(resolve(directory,'empty-project'),'0.160.1'),/LOCAL_THREE_MISSING/);
  assert.equal(resolveLocalThree(ROOT,'0.160.1',directory),directory);
});
test('routing confines access to selected asset and local package modules',()=>{
  const options={html:'test',assetPath,threeDir:directory};
  assert.equal(localResponse(AUDIT_ORIGIN+'/',options).body,'test');
  assert.equal(localResponse(AUDIT_ORIGIN+'/asset.glb',options).body.toString(),'routing fixture');
  assert.equal(localResponse(AUDIT_ORIGIN+'/vendor/three/build/three.module.js',options).status,200);
  for(const path of ['/vendor/three/package.json','/backend/.env','/vendor/three/build/%2e%2e%2fpackage.json','/vendor/three/examples/jsm/missing.js']) assert.equal(localResponse(AUDIT_ORIGIN+path,options).status,404);
  for(const origin of ['https://cdn.jsdelivr.net','https://unpkg.com','https://cdnjs.cloudflare.com','https://threejs.org','https://example.com']) assert.equal(localResponse(origin+'/x.js',options).blocked,true);
});
test('Chrome loads an import-map module fully offline via the audit route',async()=>{
  const require=createRequire(resolve(ROOT,'mobile/package.json'));
  const {chromium}=require('@playwright/test');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const context=await browser.newContext({serviceWorkers:'block'});
    const urls=[];
    const html='<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js"}}</script><script type="module">import {routingFixture} from "three"; window.routingPassed = routingFixture;</script>';
    await context.route('**/*',async route=>{
      urls.push(route.request().url());
      const response=localResponse(route.request().url(),{html,assetPath,threeDir:directory});
      if(response.blocked) await route.abort('blockedbyclient'); else await route.fulfill(response);
    });
    const page=await context.newPage();
    await page.goto(AUDIT_ORIGIN+'/');
    await page.waitForFunction(()=>window.routingPassed === true,null,{timeout:5000});
    assert.equal(urls.length,2);
    assert.ok(urls.every(url=>url.startsWith(AUDIT_ORIGIN+'/')));
    await context.close();
  } finally {await browser.close();}
});
