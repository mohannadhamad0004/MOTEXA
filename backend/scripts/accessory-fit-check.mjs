// Renders a shop accessory fitted onto a catalog car with the REAL mobile viewer code (sceneHtml.ts: build + buildAccessory + kitApply),
// offline (local pinned Three.js), into PNGs. Used by the Parts Admin preview (six views) and the body-kit test (extra views).
//   node scripts/accessory-fit-check.mjs --car=<car.glb> --config=<viewerConfig.json> --part=<part.glb> --kit=<kit.json> --out=<dir> [--views=six|test] [--color=#rrggbb]
// kit.json = { type, size?, paintMatch?, adj?, baseAdj?, fit? } (fit = a stored auto-fit to replay). Prints {valid, fit, screenshots}. Never changes catalog files.
// --views=rims: both sides, 3/4 front, front-left wheel close-up, then the same with the rims OFF. --views=wheels: no images, the car's wheel pieces.
// --views=check: no images, the replaced zone's visible body vertices with the part on / off.
// --views=zone: no part, the Parts Admin zone preview of kit.type (red = hidden stock part, green = where the part goes).
// --views=segment: no part / kit, prints { pieces, dims, proposal } (the part-map segmentation + auto-label, written to <out>/pieces.json).
// --views=editor: no part, the Parts Admin part-map editor colours for --partmap (kit.json may name { label }).
// --views=kit --part2=<glb> --kit2=<json>: two parts at once through the real kitApply (a body kit's front + rear bumper), each switched
//   off and on again: the stock parts each one hides, per step.
// --partmap=<json>: a confirmed part map { LABEL: [piece ids] } added to the config (the app gets it from the server catalog).
import { createRequire } from 'node:module'; import { resolve, sep } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ROOT, loadTS, hash } from './vehicle-audit-lib.mjs';
import { AUDIT_ORIGIN, resolveLocalThree, localizeViewerHtml, localResponse } from './vehicle-audit-local.mjs';
const require = createRequire(resolve(ROOT, 'mobile/package.json')); const { chromium } = require('@playwright/test');
const arg = n => process.argv.find(a => a.startsWith('--' + n + '='))?.slice(n.length + 3);
const out = resolve(arg('out') ?? ''); if (!arg('out') || !(out + sep).startsWith(resolve(ROOT) + sep)) throw Error('--out must be within the repository');
const color = arg('color') ?? '#8b9baa'; if (!/^#[0-9a-f]{6}$/i.test(color)) throw Error('Invalid paint color');
const noPart = ['segment', 'editor', 'rimdiag'].includes(arg('views')), keepMap = arg('views') === 'rimdiag';
const carFile = resolve(arg('car')), partFile = noPart ? null : resolve(arg('part'));
const { parseCarModel, modelForViewer, ACCESSORY_TYPES } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/modelConfig.ts'));
const rawConfig = JSON.parse(readFileSync(arg('config'), 'utf8')); if (arg('partmap')) rawConfig.partMap = JSON.parse(readFileSync(arg('partmap'), 'utf8'));
const config = parseCarModel(rawConfig); if (!config) throw Error('Invalid viewer configuration');
const kit = arg('kit') ? JSON.parse(readFileSync(arg('kit'), 'utf8')) : {}; if (!noPart && !ACCESSORY_TYPES.includes(kit.type)) throw Error('Invalid accessory type');
const threeDir = resolveLocalThree(ROOT, '0.160.1', process.env.VEHICLE3D_THREE_DIR || resolve(ROOT, '.private/three-r160/package'));
const { CAR3D_HTML } = loadTS(resolve(ROOT, 'mobile/src/features/car3d/sceneHtml.ts'));
const hook = `window.fitCheck = async function (model, kit, color) {
  renderer.setAnimationLoop(null); controls.autoRotate = false; controls.enableDamping = false;
  parsed['car.glb'] = loader.loadAsync('/asset.glb'); if (!window.noPart) { parsed['part.glb'] = loader.loadAsync('/part.glb'); assets['part.glb'] = 'local'; }
  car = await build({ file: 'car.glb', model: model, color: color });
  scene.background = new THREE.Color('#d9dde1');
  var plane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xc5c9cd, roughness: 1 })); plane.rotation.x = -Math.PI / 2; plane.position.y = -0.01; scene.add(plane);
  var box = new THREE.Box3().setFromObject(car.root), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3()), dist = size.length() / 2 / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2) * 0.8;
  window.view = function (dir, target, d) { var t = target ? new THREE.Vector3().fromArray(target) : center; camera.position.copy(t).add(new THREE.Vector3().fromArray(dir).normalize().multiplyScalar(d || dist)); camera.near = (d || dist) / 1000; camera.far = dist * 100; camera.updateProjectionMatrix(); camera.lookAt(t); renderer.render(scene, camera); return { triangles: renderer.info.render.triangles }; };
  window.attach = async function (patch) {
    var k = Object.assign({ file: 'part.glb' }, kit, patch || {});
    if (!car.acc) { car.acc = await buildAccessory(car, k); car.group.add(car.acc.group); car.accs[car.acc.key] = car.acc; }
    state = { kit: k, color: color }; kitApply(state);
    var a = car.acc, zb = a.zone ? a.zone.T : new THREE.Box3().setFromObject(a.group);
    // the joint with the body on the camera (left) side: where a cut or a gap would show
    var gb = new THREE.Box3().setFromObject(a.group); a.info.partBox = gb.min.toArray().concat(gb.max.toArray()).map(function (n) { return Math.round(n * 10000) / 10000; });
    return { info: a.info, autofit: a.fit, edge: [zb.min.x, (zb.min.y + zb.max.y) / 2, a.info.type === 'REAR_BUMPER' ? zb.max.z : zb.min.z] };
  };
  window.detach = function () { if (car.acc) { car.acc.group.visible = false; if (car.acc.zone) car.acc.zone.hide.forEach(function (o) { o.visible = true; }); (car.acc.shifts || []).forEach(function (x) { x.o.position.copy(x.orig); }); } };
  // painted-body vertices still visible inside what the part hides (box shrunk 2 mm): 0 = no second bumper / stock spoiler shows
  window.zoneCheck = function () { var z = car.acc && car.acc.zone; if (!z) return null; var b = z.box.clone().expandByScalar(-0.002), n = 0;
    car.paintMeshes.concat(z.hide).forEach(function (m) { eachVert(m, function (v) { if (b.containsPoint(v)) n++; }); });
    return { visibleBodyVerticesInZone: n, hidden: z.hide.length, allHidden: z.hide.every(function (o) { return !o.visible; }), how: z.how }; };
  window.zonePreview = function (type) { previewApply({ zonePreview: type }); return car.prev ? { hidden: car.prev.mats.length } : null; };
  window.segmentCar = function () { var t0 = performance.now(), info = carPieces(car); return { pieces: info.pieces, dims: info.dims, meshes: carMeshes(car).length, ms: Math.round(performance.now() - t0), proposal: autoLabel(info.pieces, info.dims) }; };
  window.editView = function (labels, label) { state = { partEdit: { label: label, labels: labels }, model: model }; editApply(state); return { meshes: car.edit.meshes.length }; };
  // the mapped stock pieces: how many triangles of each label are on screen (visible meshes)
  window.partCheck = function () { var out = {}; Object.keys(car.parts).forEach(function (L) { out[L] = car.parts[L].filter(function (o) { return o.visible; }).reduce(function (n, o) { return n + o.geometry.index.count / 3; }, 0); }); return out; };
  // the centreline tops from the rear (for the auto-fit report / debugging): [{ z from rear, y above ground }]
  window.profile = function () { var m = contactMeshes(car, car.acc && car.acc.zone ? car.acc.zone.hide : [], true), rb = car.rb, s = rb.getSize(new THREE.Vector3()), out = [];
    for (var i = 0; i <= 120; i++) { var z = rb.min.z + (i / 120) * s.z, y = hitY(m, (rb.min.x + rb.max.x) / 2, z, rb.max.y + 1); out.push([Math.round((z - rb.min.z) * 1000) / 1000, y === null ? null : Math.round((y - rb.min.y) * 1000) / 1000]); }
    var who = {}; for (var j = 0; j <= 120; j += 6) { var zz = rb.min.z + (j / 120) * s.z; RAY.set(new THREE.Vector3((rb.min.x + rb.max.x) / 2, rb.max.y + 1, zz), DOWN); var h = RAY.intersectObjects(car.root.children, true)[0]; if (h) who[Math.round((zz - rb.min.z) * 100) / 100] = h.object.name + ' / ' + (h.object.material.name || ''); }
    return { H: s.y, L: s.z, p: out, who: who }; };
  // a body kit through the real kitApply: state.kits = [front, rear]; resolves when every part is built (or failed)
  window.kitStep = async function (kits) { parsed['part2.glb'] = parsed['part2.glb'] || loader.loadAsync('/part2.glb'); assets['part2.glb'] = 'local'; window.__fits = window.__fits || [];
    state = { kits: kits, color: '#8b9baa' }; kitApply(state);
    for (var i = 0; i < 600 && Object.keys(car.accP).length; i++) await new Promise(function (r) { setTimeout(r, 50); });
    kitApply(state); return { on: Object.keys(car.accs), parts: window.partCheck() }; };
  // the wheel pieces per corner: name, material, vertices, radial min / max from the wheel centre, x range (rims debugging)
  window.wheelPartsDiagnostic = function () { return wheelParts(car).map(function(q){return {wheel:q.wheel,pieces:q.pieces.map(function(e){var p=rimPCA(rimPoints([e]));return {name:e.source.mesh.name,mat:e.obj.material.name,axis:p&&p.axis[0],bounds:e.box.min.toArray().concat(e.box.max.toArray()),measure:e.measure};})};}); };
  // rims: a cut through one wheel's centre (plane across the car at the wheel), seen from the cut side close up: tyre face vs the fender line
  window.section = function (wi) { var q = wheelParts(car)[wi]; if (!q || q.refusal) { renderer.clippingPlanes = []; return null; }
    var T = q.tangent.clone(), top = q.center.clone().addScaledVector(q.up, q.ro * 0.97).addScaledVector(q.axis, q.outer);
    renderer.clippingPlanes = [new THREE.Plane(T.clone().negate(), q.center.dot(T))];
    var look = top.clone().addScaledVector(q.up, -q.ro * 0.45); camera.position.copy(look).addScaledVector(T, 1.9); camera.near = 0.05; camera.far = 50; camera.updateProjectionMatrix(); camera.lookAt(look);
    scene.overrideMaterial = window.__secMat || (window.__secMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide })); renderer.render(scene, camera); scene.overrideMaterial = null; renderer.clippingPlanes = [];
    return { wheel: q.wheel }; };
  // test aid: turn the front wheels (every mesh / triangle inside a front wheel's box) about the vertical through each wheel centre, like a
  // model exported with its wheels steered; nothing else moves
  window.steerFront = function (deg) { var c = car.rb.getCenter(new THREE.Vector3()), n = 0;
    car.wheels.list.filter(function (w) { return w.front > 0; }).forEach(function (w) {
      var box = new THREE.Box3().setFromCenterAndSize(w.center, new THREE.Vector3(0.6, 2 * w.r + 0.02, 2 * w.r + 0.02));
      var R = new THREE.Matrix4().makeTranslation(w.center.x, w.center.y, w.center.z).multiply(new THREE.Matrix4().makeRotationY(deg * Math.PI / 180)).multiply(new THREE.Matrix4().makeTranslation(-w.center.x, -w.center.y, -w.center.z));
      car.root.traverse(function (m) { if (!m.isMesh || !box.containsBox(new THREE.Box3().setFromObject(m))) return; m.updateMatrixWorld(true);
        m.geometry = m.geometry.clone(); m.geometry.applyMatrix4(new THREE.Matrix4().copy(m.matrixWorld).invert().multiply(R).multiply(m.matrixWorld)); SEG.delete(m); n++; }); });
    car.rimPieces = car.wheelParts = car.rimNear = null; return n; };
  window.rimDiagParts = function () { return wheelParts(car); }; window.rimDiagVia = function () { return rimPieces(car).via; };
  window.wheelProbe = function () { var W = car.wheels, ms = (car.parts.WHEELS || W.meshes), r3 = function (n) { return Math.round(n * 1000); };
    return { found: W.found, viaPartMap: !!car.parts.WHEELS, centres: W.list.map(function (w) { return w.center.toArray().map(r3).concat([r3(w.r)]); }),
      meshes: ms.map(function (m) { var w = null, bd = Infinity, rmin = Infinity, rmax = 0, x0 = Infinity, x1 = -Infinity, n = 0, c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
        W.list.forEach(function (q) { var d = Math.hypot(c.x - q.center.x, c.z - q.center.z); if (d < bd) { bd = d; w = q; } });
        eachVert(m, function (v) { var r = Math.hypot(v.y - w.center.y, v.z - w.center.z); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); n++; });
        return [m.name, m.material.name, n, (w.front > 0 ? 'F' : 'R') + (w.side > 0 ? 'R' : 'L'), r3(rmin), r3(rmax), r3(x0), r3(x1)]; }) }; };
  window.lowProbe = function () { var rb = car.rb, s = rb.getSize(new THREE.Vector3()), out = [], r3 = function (n) { return Math.round(n * 1000); };
    car.root.traverse(function (m) { if (!m.isMesh) return; var b = new THREE.Box3().setFromObject(m); if (b.min.y > rb.min.y + 0.6 * s.y || Math.abs(b.getCenter(new THREE.Vector3()).x) < 0.25 * s.x) return;
      out.push([m.name, m.material.name, m.geometry.attributes.position.count].concat(b.min.toArray().map(r3), b.max.toArray().map(r3))); }); return out; };
  window.recolor = function (c) { car.paint.forEach(function (p) { p.color.set(c); }); if (car.acc && car.acc.paint) car.acc.paint.color.set(c); };
  return { dimensions: size.toArray(), wheelsFound: car.wheels.found, mappedParts: Object.keys(car.parts), partMapIn: Object.keys(model.partMap || {}) };
}; window.fitReady = true;`;
const html = localizeViewerHtml(CAR3D_HTML).replace('post({ type: "ready" });', (noPart ? 'window.noPart = true;\n' : '') + hook +'\npost({ type: "ready" });');
const SIX = [['front', [0, .14, 1]], ['front-three-quarter', [-.7, .35, 1]], ['left-side', [-1, .14, 0]], ['rear-three-quarter', [-.7, .35, -1]], ['rear', [0, .14, -1]], ['top-three-quarter', [-.7, 1.1, 1]]];
const browser = await chromium.launch({ headless: true, channel: 'chrome' }); const errors = [], blocked = [];
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } }); page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === AUDIT_ORIGIN && url.pathname === '/part2.glb' && arg('part2')) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: readFileSync(resolve(arg('part2'))) });
    if (url.origin === AUDIT_ORIGIN && url.pathname === '/part.glb' && partFile) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: readFileSync(partFile) });
    const r = localResponse(route.request().url(), { html, assetPath: carFile, threeDir }); if (r.blocked) { blocked.push(url.origin); return route.abort(); } return route.fulfill(r);
  });
  await page.goto(AUDIT_ORIGIN + '/'); await page.waitForFunction(() => window.fitReady === true);
  const vm = modelForViewer(config); if (noPart && !keepMap) delete vm.partMap; // segment / editor: the whole car in pieces, as in the Parts Admin editor
  const car = await page.evaluate(([m, k, c]) => window.fitCheck(m, k, c), [vm, kit, color]);
  if (arg('steer')) car.steered = await page.evaluate(d => window.steerFront(d), Number(arg('steer')));
  mkdirSync(out, { recursive: true }); const shots = [];
  const shot = async (name, dir, target, d) => { await page.evaluate(([a, b, c]) => window.view(a, b, c), [dir, target ?? null, d ?? null]); const p = resolve(out, name + '.png'); await page.screenshot({ path: p }); shots.push({ name, sha256: hash(p) }); };
  let fit;
  if (arg('views') === 'segment') {
    const seg = await page.evaluate(() => window.segmentCar());
    writeFileSync(resolve(out, 'pieces.json'), JSON.stringify(seg) + '\n');
    fit = { info: { pieces: seg.pieces.length, meshes: seg.meshes, ms: seg.ms, dims: seg.dims, proposal: seg.proposal } };
  } else if (arg('views') === 'editor') {
    fit = { info: await page.evaluate(([m, l]) => window.editView(m, l), [config.partMap ?? {}, kit.label ?? 'SPOILER']) };
    await shot('editor-rear-34', SIX[3][1]); await shot('editor-front-34', SIX[1][1]); await shot('editor-side', SIX[2][1]);
  } else if (arg('views') === 'rear') { // rear add-ons (wing, spoiler, diffuser): rear 3/4, side, top, paint to match, edge close-ups
    await shot('a-original-rear-34', SIX[3][1]);
    fit = await page.evaluate(() => window.attach({ paintMatch: false }));
    const c = await page.evaluate(() => { const b = new window.__dbg.THREE.Box3().setFromObject(window.__dbg.car().acc.group); return { min: b.min.toArray(), max: b.max.toArray() }; });
    const mid = [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2], foot = [c.min[0] + 0.05, c.min[1] + 0.05, mid[2]];
    await shot('b-part-on-rear-34', SIX[3][1]); await shot('c-part-on-side', SIX[2][1]); await shot('d-part-on-top', [-.45, 1.3, -.7]);
    await page.evaluate(() => window.attach({ paintMatch: true })); await shot('e-paint-to-match-rear-34', SIX[3][1]);
    await page.evaluate(() => window.recolor('#c62828')); await shot('e2-paint-to-match-red-rear-34', SIX[3][1]); await page.evaluate(c => window.recolor(c), color);
    await page.evaluate(() => window.attach({ paintMatch: false }));
    await shot('g-part-on-stock-hidden-close', [-.35, .55, -1], mid, 2.2);
    await page.evaluate(() => { window.__dbg.car().acc.group.visible = false; }); await shot('g2-stock-hidden-part-invisible-close', [-.35, .55, -1], mid, 2.2); await page.evaluate(() => { window.__dbg.car().acc.group.visible = true; });
    await page.evaluate(() => window.detach()); await shot('h-part-off-stock-back-close', [-.35, .55, -1], mid, 2.2); await shot('h2-part-off-rear-34', SIX[3][1]);
    await page.evaluate(() => { window.__dbg.car().acc.group.visible = true; }); await page.evaluate(() => window.attach({ paintMatch: false }));
    await shot('f-edge-closeup-foot', [-1, .35, -.5], foot, 0.9); await shot('f2-edge-closeup-side', [-1, .08, 0], mid, 1.3); await shot('f3-edge-closeup-rear', [-.25, .2, -1], mid, 1.6);
  } else if (arg('views') === 'kit') {
    const k1 = { ...kit, file: 'part.glb' }, k2 = { ...JSON.parse(readFileSync(arg('kit2'), 'utf8')), file: 'part2.glb' };
    const both = await page.evaluate(k => window.kitStep(k), [k1, k2]); await shot('kit-both-on', SIX[1][1]); await shot('kit-both-on-rear', SIX[3][1]);
    const firstOff = await page.evaluate(k => window.kitStep(k), [k2]); await shot('kit-first-off', SIX[1][1]);
    const allOff = await page.evaluate(() => window.kitStep([]));
    fit = { info: { kit: { both, firstOff, allOff } } };
  } else if (arg('views') === 'rims') { // rims: both sides, 3/4 front, front-left wheel close-up, the same with the rims OFF (stock wheels back)
    await shot('before-front-three-quarter', SIX[1][1]); await shot('before-side', [-1, .1, 0]);
    fit = await page.evaluate(() => window.attach());
    fit.info.wheelDiagnostics = await page.evaluate(() => window.wheelPartsDiagnostic());
    const w = await page.evaluate(() => { const c = window.__dbg.car(), q = c.wheels.list.find(x => x.front > 0 && x.side < 0); return [q.center.x, q.center.y, q.center.z, q.r]; });
    await shot('on-left-side', [-1, .1, 0]); await shot('on-right-side', [1, .1, 0]); await shot('on-front-three-quarter', SIX[1][1]);
    await shot('on-wheel-closeup', [-1, .15, .35], w.slice(0, 3), w[3] * 4.2); await shot('on-rear', [0, .12, -1]);
    await page.evaluate(() => window.detach()); await shot('off-side', [-1, .1, 0]); await shot('off-front-three-quarter', SIX[1][1]); await shot('off-wheel-closeup', [-1, .15, .35], w.slice(0, 3), w[3] * 4.2); await shot('off-rear', [0, .12, -1]);
  } else if (arg('views') === 'section') { // rims: wheel cuts (FL, RL) off, then on
    const cut = async (name, wi) => { await page.evaluate(i => window.section(i), wi); const p = resolve(out, name + '.png'); await page.screenshot({ path: p }); shots.push({ name, sha256: hash(p) }); };
    await cut('section-FL-off', 2); await cut('section-RL-off', 0);
    fit = await page.evaluate(() => window.attach()); await cut('section-FL-on', 2); await cut('section-RL-on', 0);
  } else if (arg('views') === 'qa') { // FIT-QA: the fit (with its QA), one picture aimed at the part from the side that shows its joins
    fit = await page.evaluate(async () => { try { return await window.attach(); } catch (e) { return { refused: String(e && e.message || e), info: e && e.info || {} }; } });
    if (fit.refused) { fit.info = { ...fit.info, refused: fit.refused }; writeFileSync(resolve(out, 'fit-evidence.json'), JSON.stringify({ valid: true, car, fit: fit.info }, null, 2)); console.log(JSON.stringify({ valid: true, fit: fit.info, autofit: null, screenshots: [] })); process.exit(0); }
    const b = fit.info.partBox, c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], t = kit.type;
    const dir = { RIMS: [-0.8, 0.12, 0.55], WING: [-0.7, 0.45, -1], SPOILER: [-0.7, 0.45, -1], REAR_BUMPER: [-0.6, 0.25, -1], REAR_DIFFUSER: [-0.55, 0.05, -1],
      FRONT_BUMPER: [-0.6, 0.25, 1], FRONT_LIP: [-0.55, 0.05, 1], SIDE_SKIRTS: [-1, 0.12, 0.25], ROOF_RACK: [-0.6, 0.9, 0.5] }[t] ?? [-0.7, 0.35, 1];
    const big = Math.max(b[3] - b[0], b[5] - b[2]);
    await page.evaluate(([a, tg, d]) => window.view(a, tg, d), [dir, t === 'RIMS' ? null : c, t === 'RIMS' ? null : Math.max(1.6, big * 1.5)]);
    const p = resolve(out, 'qa.jpg'); await page.screenshot({ path: p, type: 'jpeg', quality: 72 }); shots.push({ name: 'qa', sha256: hash(p) });
    const spots = [['qa-clip', fit.info.qa?.clipAt?.at], ['qa-gap', fit.info.qa?.gapAt], ...(fit.info.qa?.clipTop ?? []).slice(1, 3).map((c, i) => ['qa-clip' + (i + 2), c.at])];
    for (const [nm, pt] of spots) if (pt && process.argv.includes('--qa-close')) { // close-ups at the worst points (and the next visible clip spots)
      await page.evaluate(([a, tg]) => window.view(a, tg, 0.7), [dir, pt]); const q = resolve(out, nm + '.jpg'); await page.screenshot({ path: q, type: 'jpeg', quality: 80 }); shots.push({ name: nm, sha256: hash(q) }); }
    for (const [nm, dir2, tg, d] of arg('spots') ? JSON.parse(readFileSync(arg('spots'), 'utf8')) : []) { // --spots=<json [[name, dir, target, dist]]>: extra close-ups
      await page.evaluate(([a, t2, dd]) => window.view(a, t2, dd), [dir2, tg, d]); const q = resolve(out, nm + '.jpg'); await page.screenshot({ path: q, type: 'jpeg', quality: 82 }); shots.push({ name: nm, sha256: hash(q) }); }
  } else if (arg('views') === 'rimdiag') { // no part, no throw: what wheelParts measured per wheel (rims debugging)
    fit = { info: await page.evaluate(() => { const P = window.rimDiagParts(); return { via: window.rimDiagVia(), wheels: P.map(q => ({ wheel: q.wheel, refusal: q.refusal || null, warnings: q.warnings, pieces: q.pieces.length, tyre: q.tyre.length, rim: q.rim.length, brake: q.brake.length, center: q.center && q.center.toArray().map(n => Math.round(n * 1000)), axis: q.axis && q.axis.toArray().map(n => Math.round(n * 1000) / 1000), ro: q.ro && Math.round(q.ro * 1000), tw: q.tw && Math.round(q.tw * 1000), conf: q.axleConfidence, pcs: q.pieces.map(e => [e.id, e.source.mesh.name.slice(0, 40), (e.obj.material.name || '').slice(0, 20), q.tyre.includes(e) ? 'T' : q.brake.includes(e) ? 'B' : 'R', e.measure && [e.measure.lo, e.measure.hi, e.measure.rmin, e.measure.rmax].map(n => Math.round(n * 1000)).concat([e.measure.arc]), e.obj.geometry.index.count / 3]), names: [...new Set(q.pieces.map(e => e.source.mesh.name + ' / ' + (e.obj.material.name || '')))].slice(0, 12) })) }; }) };
  } else if (arg('views') === 'wheels') { fit = { info: await page.evaluate(() => Object.assign(window.wheelProbe(), { low: window.lowProbe() })) }; // no part: the car's wheel pieces
  } else if (arg('views') === 'fit') { fit = await page.evaluate(() => window.attach()); // numbers only: the auto-fit to store
  } else if (arg('views') === 'profile') { fit = await page.evaluate(() => window.attach()); fit.info = { ...fit.info, profile: await page.evaluate(() => window.profile()) };
  } else if (arg('views') === 'check') { // numbers only: the replaced zone while the part is on, then off again
    fit = await page.evaluate(() => window.attach());
    const state = () => page.evaluate(() => { const z = window.zoneCheck(); return z && { ...z, parts: window.partCheck() }; }); // null: nothing replaced
    const on = await state(); await page.evaluate(() => window.detach()); const off = await state();
    fit.info = { ...fit.info, check: { on, off } };
  } else if (arg('views') === 'zone') {
    fit = { info: await page.evaluate(t => window.zonePreview(t), kit.type) };
    const z = await page.evaluate(() => { const T = window.__dbg.THREE, b = new T.Box3(); window.__dbg.car().prev.g.traverse(o => { if (o.isMesh) b.expandByObject(o); }); return b.isEmpty() ? null : b.getCenter(new T.Vector3()).toArray(); });
    for (const [n, d] of [SIX[1], SIX[3], SIX[2]]) await shot('zone-' + n, d);
    if (z) await shot('zone-close', [-.45, .6, z[2] > 0 ? 1 : -1], z, 2.4);
  } else if (arg('views') === 'test') {
    await shot('a-original-front-34', SIX[1][1]);
    fit = await page.evaluate(() => window.attach({ paintMatch: false }));
    await shot('b-part-on-front-34', SIX[1][1]); await shot('c-part-on-front', SIX[0][1]); await shot('d-part-on-side', SIX[2][1]);
    await page.evaluate(() => window.attach({ paintMatch: true })); await shot('e-paint-to-match-34', SIX[1][1]);
    await page.evaluate(() => window.recolor('#c62828')); await shot('e2-paint-to-match-red-34', SIX[1][1]);
    await shot('f-edge-closeup', [-1, .3, .7], fit.edge, 1.0); await shot('f2-edge-closeup-side', [-1, .05, 0], fit.edge, 0.9);
    await page.evaluate(c => window.recolor(c), color); await page.evaluate(() => window.attach({ paintMatch: false }));
  } else { fit = await page.evaluate(() => window.attach()); for (const [n, d] of SIX) await shot(n, d); }
  if (errors.length || blocked.length) throw Error('Viewer errors: ' + errors.join('; ') + (blocked.length ? ' remote: ' + blocked.join(',') : ''));
  const evidence = { valid: true, car, fit: fit.info, autofit: fit.autofit ?? null, kit, carSha256: hash(carFile), partSha256: partFile ? hash(partFile) : null, viewerSha256: hash(resolve(ROOT, 'mobile/src/features/car3d/sceneHtml.ts')), screenshots: shots };
  writeFileSync(resolve(out, 'fit-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ valid: true, fit: fit.info, autofit: fit.autofit ?? null, screenshots: shots.map(s => s.name) }));
} finally { await browser.close(); }
