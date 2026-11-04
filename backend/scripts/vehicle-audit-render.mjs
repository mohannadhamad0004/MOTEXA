// Six views through the actual MOTEXA viewer build function; no source asset writes.
// node backend/scripts/vehicle-audit-render.mjs [--key=...] [--original|--prepared] [--three-dir=<three@0.160.1 package>]
// Default captures BOTH versions. No CDN requests or network fallback.
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, AUDIT, loadTS, hash, json } from './vehicle-audit-lib.mjs';
import { AUDIT_ORIGIN, resolveLocalThree, localizeViewerHtml, localResponse } from './vehicle-audit-local.mjs';

const require = createRequire(resolve(ROOT, 'mobile/package.json'));
const { chromium } = require('@playwright/test');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const variants = process.argv.includes('--original') ? ['original'] : process.argv.includes('--prepared') ? ['prepared'] : ['prepared', 'original'];
if (process.argv.includes('--original') && process.argv.includes('--prepared')) throw new Error('Choose either --original or --prepared, or neither for both');
const selected = arg('key');
const stageA = process.argv.includes('--stage-a');
const fixes = stageA ? json(resolve(ROOT,'docs/3d/config-fixes.json')) : {};
const liveModels = loadTS(resolve(ROOT,'mobile/src/features/car3d/models.ts')).CAR_MODELS;
const renderFolder = stageA ? 'stage-a/renders' : 'renders';
const { CAR3D_HTML, THREE_VERSION } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/sceneHtml.ts'));
// Resume the completed inventory; never rerun the technical inspector here.
const entries = json(resolve(AUDIT, 'vehicle-model-audit.json')).entries.filter(e => e.scope === 'model-library' && (!selected || e.key === selected) && (!stageA || Object.hasOwn(fixes,e.key)));
if (!entries.length) throw new Error('No matching models');
const views = [
  ['front', [0, 0.14, 1]], ['front-three-quarter', [-0.7, 0.35, 1]], ['left-side', [-1, 0.14, 0]],
  ['rear-three-quarter', [-0.7, 0.35, -1]], ['rear', [0, 0.14, -1]], ['top-three-quarter', [-0.7, 1.1, 1]],
];
const hook = `
window.auditLoad = async function(model, url, original) {
  renderer.setAnimationLoop(null);
  controls.autoRotate = false; controls.enableDamping = false;
  scene.background = new THREE.Color('#d9dde1');
  var gltf = window.auditBuffer ? await loader.parseAsync(window.auditBuffer.buffer, '') : await loader.loadAsync(url);
  parsed[url] = Promise.resolve(gltf);
  if (original) {
    var root = gltf.scene.clone(true), group = new THREE.Group(); group.add(root);
    var b = new THREE.Box3().setFromObject(root, true), sz = b.getSize(new THREE.Vector3());
    var s = 4.6 / Math.max(sz.x, sz.y, sz.z); group.scale.setScalar(s); group.updateMatrixWorld(true);
    b.setFromObject(group, true); var c = b.getCenter(new THREE.Vector3()); group.position.set(-c.x, -b.min.y, -c.z);
    scene.add(group); car = {group:group};
  } else {
    car = await build({model:model, file:url, color:'#8b9baa'});
    if (car.wing) car.wing.visible = false; if (car.rack) car.rack.visible = false;
  }
  car.group.updateMatrixWorld(true);
  var box = new THREE.Box3().setFromObject(car.group.children[0], true);
  // Exclude disabled accessory meshes from framing; original uses its enclosing group.
  if (original) box.setFromObject(car.group, true);
  var size = box.getSize(new THREE.Vector3());
  if (![size.x,size.y,size.z].every(Number.isFinite) || size.length() === 0) throw new Error('Invalid rendered bounds');
  var plane = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({color:0xc5c9cd, roughness:1}));
  plane.rotation.x = -Math.PI/2; plane.position.y = -0.01; scene.add(plane);
  var target = box.getCenter(new THREE.Vector3());
  var distance = size.length()/2/Math.sin(THREE.MathUtils.degToRad(camera.fov)/2)*1.15;
  window.auditView = function(direction) {
    camera.position.copy(new THREE.Vector3(...direction).normalize().multiplyScalar(distance).add(target));
    camera.near = distance/1000; camera.far = distance*100; camera.updateProjectionMatrix(); camera.lookAt(target);
    renderer.render(scene,camera);
    return {camera:camera.position.toArray(),target:target.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  };
  return {dimensions:size.toArray(),animations:gltf.animations.map(a=>({name:a.name,duration:a.duration})),threeVersion:THREE.REVISION};
};
window.auditReady = true;
`;
const html = localizeViewerHtml(CAR3D_HTML).replace('</body>', '<div id="audit-label" style="position:absolute;left:12px;top:12px;font:16px sans-serif;color:#18212b;pointer-events:none"></div></body>')
  .replace('post({ type: "ready" });', `${hook}\npost({ type: "ready" });`);
mkdirSync(AUDIT, { recursive: true });
const run = { startedAt: new Date().toISOString(), variants, requestedModels: entries.length, requested: entries.length * variants.length, rendered: 0, results: [], blocker: null, remoteRequests: [],
  threeVersion: THREE_VERSION, threeSource: null, rendererSha256: hash(new URL(import.meta.url)),
  note: 'Rendering alone is not a visual classification. Headless desktop is not Android device verification.', viewerSha256: hash(resolve(ROOT, 'mobile/src/features/car3d/sceneHtml.ts')) };
const runPath = resolve(AUDIT, `${stageA ? 'stage-a-' : ''}local-render-run${selected ? '-' + selected : ''}${variants.length === 1 ? '-' + variants[0] : ''}.json`);
let browser;
try {
  const threeDir = resolveLocalThree(ROOT, THREE_VERSION, arg('three-dir'));
  run.threeSource = threeDir;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const e of entries) {
   for (const variant of variants) {
    const original = variant === 'original';
    const path = original ? e.originalAsset : e.currentAsset;
    if (!path || !existsSync(resolve(ROOT, path))) { run.results.push({ key: e.key, variant, error: 'Missing asset' }); continue; }
    const priorPath = resolve(AUDIT,renderFolder,e.key,variant,'evidence.json');
    if(!stageA && existsSync(priorPath)){const prior=json(priorPath);if(prior.sha256===hash(resolve(ROOT,path))&&prior.screenshots?.length===6&&prior.screenshots.every(s=>existsSync(resolve(AUDIT,s.path)))){run.results.push(prior);run.rendered++;continue;}}
    if(!browser.isConnected()) browser=await chromium.launch({channel:'chrome',headless:true});
    const context = await browser.newContext({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => errors.push(`${new URL(request.url()).hostname}: ${request.failure()?.errorText}`));
    await context.route('**/*', async route => {
      try {
        const requestUrl=new URL(route.request().url());

        const response = localResponse(route.request().url(), { html, assetPath: resolve(ROOT, path), threeDir });
        if (response.blocked) {
          run.remoteRequests.push(new URL(route.request().url()).origin);
          return route.abort('blockedbyclient');
        }
        await route.fulfill(response);
      } catch { await route.fulfill({ status: 500, body: 'Local audit resource unavailable' }); }
    });
    let booted = false;
    try {
      await page.goto(AUDIT_ORIGIN + '/');
      await page.waitForFunction(() => window.auditReady === true, null, { timeout: 25000 });
      booted = true;
      const model = (stageA ? liveModels.find(m=>m.key===e.key) : null) ?? e.configuration ?? { key:e.key, lengthM:e.manifest.lengthM, rotateY:e.manifest.rotateY, groundOffset:0, paintNodes:[],paintMaterials:e.manifest.paintMaterials,rimsSwappable:false,wing:{x:0,y:0,z:0,scale:1},rack:{x:0,y:0,z:0,scale:1} };
      if(stageA) Object.assign(model,fixes[e.key]);
      if(statSync(resolve(ROOT,path)).size > 50*1024*1024) {
        const bytes=readFileSync(resolve(ROOT,path));
        await page.evaluate(n=>{window.auditBuffer=new Uint8Array(n);},bytes.length);
        for(let offset=0;offset<bytes.length;offset+=1024*1024) await page.evaluate(({offset,b64})=>{const s=atob(b64);for(let i=0;i<s.length;i++)window.auditBuffer[offset+i]=s.charCodeAt(i);},{offset,b64:bytes.subarray(offset,offset+1024*1024).toString('base64')});
      }
      const stats = await page.evaluate(async ({model,original}) => Promise.race([
        window.auditLoad(model, '/asset.glb', original),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Model load/build exceeded 60 seconds')), 60000)),
      ]), {model,original});
      const dir = resolve(AUDIT, renderFolder, e.key, variant); mkdirSync(dir, {recursive:true});
      const screenshots = [];
      for (const [name, direction] of views) {
        const camera = await page.evaluate(({direction,label}) => { document.querySelector('#audit-label').textContent = label; return window.auditView(direction); }, {direction,label:`${e.key} · ${name} · ${original ? 'original' : 'MOTEXA'}`});
        await page.screenshot({ path: resolve(dir, `${name}.png`) });
        screenshots.push({name,path:`${renderFolder}/${e.key}/${variant}/${name}.png`,sha256:hash(resolve(dir,`${name}.png`)),...camera});
      }
      const evidence = { key:e.key, variant, sha256:hash(resolve(ROOT,path)), configuration:model, stats, screenshots, errors,
        viewerSha256:run.viewerSha256, rendererSha256:run.rendererSha256, threeVersion:THREE_VERSION };
      writeFileSync(resolve(dir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
      run.results.push(evidence); run.rendered++;
      console.log(`Rendered ${e.key} (${variant}): six views`);
    } catch (error) {
      run.results.push({key:e.key,variant,error:error.message,errors});
      // Dependency boot failure applies to all models. Do not misreport it as 120 broken cars.
      if (!booted) { run.blocker = `Viewer dependency startup failed: ${errors.join('; ') || error.message}`; break; }
    } finally { await context.close().catch(()=>{}); writeFileSync(runPath, JSON.stringify(run,null,2)+'\n'); }
   }
   if (run.blocker) break;
  }
} catch (error) { run.blocker = error.message; }
finally { if (browser) await browser.close().catch(()=>{}); run.finishedAt = new Date().toISOString(); writeFileSync(runPath, JSON.stringify(run,null,2)+'\n'); }
console.log(JSON.stringify({requested:run.requested,rendered:run.rendered,blocker:run.blocker}));
if (run.blocker || run.rendered !== run.requested) process.exitCode = 1;
