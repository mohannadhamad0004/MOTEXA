// The page inside the 3D viewer's WebView (iframe on web): three.js from the jsDelivr CDN (pinned), GLTFLoader + meshopt decoder,
// OrbitControls, RoomEnvironment reflections, ACES tone mapping, physically based lights (three's default since r155).
// Protocol (JSON): app -> page  window.car3d({type:"state", state}) | {type:"asset", key, b64}
//                  page -> app  {type:"ready"} | {type:"need", keys} | {type:"shown"} | {type:"error", message}
// The page asks for the model file it has not been sent yet and keeps the parsed model for its lifetime; colour and extras
// changes only touch materials / visibility.
//
// PAINT: only the meshes under the model's paintNodes whose material is one of paintMaterials get a NEW MeshPhysicalMaterial
// (metallic car paint with clearcoat, keeping the original normal map); every other mesh using the same material (wheels,
// lights, interior) keeps the original.
// EXTRAS: rear wing / roof rack are low-poly boxes; anchors from ray casts down onto the painted body (wing: 10 % of the length
// in from the rear; rack: on the roof's highest point, ~26 % of the length), plus the per-model offsets.
export const THREE_VERSION = "0.160.1";

export const CAR3D_HTML = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;overflow:hidden;touch-action:none;background:transparent}canvas{display:block;width:100%;height:100%}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"}}</script>
</head><body>
<script>
function post(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,"*");}
window.__q=[];window.car3d=function(m){window.__q.push(m);};
window.addEventListener("message",function(e){if(typeof e.data!=="string")return;try{window.car3d(JSON.parse(e.data));}catch(_){}});
window.addEventListener("error",function(e){post({type:"error",message:String(e.message||"error")});});
setTimeout(function(){if(!window.__booted)post({type:"error",message:"offline"});},15000);
</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
window.__booted = true;

var assets = {}, parsed = {}, state = null, car = null, shownOnce = false;

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
var pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
var key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 8, 5); scene.add(key);

var camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 200);
var controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.8; controls.zoomSpeed = 0.8;
controls.enablePan = false; controls.maxPolarAngle = Math.PI * 0.49; controls.autoRotateSpeed = 1.2;
var home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

// contact shadow: a soft radial blob under the car (no shadow maps: cheap on phones)
function blobTexture() {
  var c = document.createElement("canvas"); c.width = c.height = 128;
  var x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.75)"); g.addColorStop(0.55, "rgba(0,0,0,0.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; scene.add(shadow);

var loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
function b64buf(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function parse(k) {
  if (!parsed[k]) parsed[k] = new Promise(function (res, rej) { loader.parse(b64buf(assets[k]), "", res, rej); });
  return parsed[k];
}

// ---- extras ----
var accMat = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1e, metalness: 0.3, roughness: 0.35, clearcoat: 0.6 });
function box(w, h, d, x, y, z, rx) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), accMat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; return m; }
function surfaceY(meshes, z, top) {
  var hit = new THREE.Raycaster(new THREE.Vector3(0, top + 1, z), new THREE.Vector3(0, -1, 0)).intersectObjects(meshes, false)[0];
  return hit ? hit.point.y : null;
}
function makeWing(W, o) {
  var g = new THREE.Group(), s = o.scale, h = 0.16 * s, w = W * 0.9 * s;
  g.add(box(0.05 * s, h, 0.1 * s, -w * 0.3, h / 2, 0));
  g.add(box(0.05 * s, h, 0.1 * s, w * 0.3, h / 2, 0));
  g.add(box(w, 0.035 * s, 0.3 * s, 0, h, -0.03, -0.1));
  g.add(box(0.03 * s, 0.12 * s, 0.32 * s, -w / 2, h + 0.02, -0.03));
  g.add(box(0.03 * s, 0.12 * s, 0.32 * s, w / 2, h + 0.02, -0.03));
  return g;
}
function makeRack(W, len, o) {
  var g = new THREE.Group(), s = o.scale, w = W * 0.62 * s, r = 0.045 * s, foot = 0.06 * s;
  len *= s;
  [-1, 1].forEach(function (side) {
    g.add(box(r, r, len, side * w / 2, foot + r / 2, 0));
    g.add(box(r * 1.3, foot, r * 2, side * w / 2, foot / 2, len / 2 - r));
    g.add(box(r * 1.3, foot, r * 2, side * w / 2, foot / 2, -len / 2 + r));
  });
  [-0.33, 0, 0.33].forEach(function (f) { g.add(box(w, r * 0.7, r * 1.2, 0, foot + r, f * len)); });
  return g;
}

// ---- build (once per model file) ----
async function build(s) {
  var m = s.model, gltf = await parse(s.file);
  var root = gltf.scene.clone(true);
  root.rotation.y = m.rotateY || 0;
  var group = new THREE.Group(); group.add(root);
  group.updateMatrixWorld(true);
  var bb = new THREE.Box3().setFromObject(root), size = bb.getSize(new THREE.Vector3());
  var k = m.lengthM / Math.max(size.x, size.z);
  root.scale.multiplyScalar(k);
  group.updateMatrixWorld(true);
  bb.setFromObject(root);
  var c = bb.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -bb.min.y + (m.groundOffset || 0), -c.z);
  group.updateMatrixWorld(true);

  // paint: a fresh material on the body only
  var paint = [], body = [];
  m.paintNodes.forEach(function (n) {
    var node = root.getObjectByName(n); if (!node) return;
    node.traverse(function (o) {
      if (!o.isMesh) return;
      body.push(o);
      if (m.paintMaterials.indexOf(o.material.name) < 0) return;
      var src = o.material;
      o.material = new THREE.MeshPhysicalMaterial({ name: src.name + " (paint)", color: s.color, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, normalMap: src.normalMap || null, side: src.side });
      paint.push(o.material);
    });
  });

  // extras, anchored on the painted body
  var bodyBox = new THREE.Box3(); body.forEach(function (o) { bodyBox.expandByObject(o); });
  if (bodyBox.isEmpty()) bodyBox.setFromObject(root);
  var bs = bodyBox.getSize(new THREE.Vector3()), L = bs.z, W = bs.x, top = bodyBox.max.y, targets = body.length ? body : [root];
  var wing = null, rack = null;
  var zr = bodyBox.min.z + 0.1 * L, yr = surfaceY(targets, zr, top);
  if (yr !== null) { wing = makeWing(W, m.wing); wing.position.set(m.wing.x, yr + m.wing.y, zr + m.wing.z); group.add(wing); }
  var ys = [];
  for (var i = 0; i <= 40; i++) { var z = bodyBox.min.z + (i / 40) * L; ys.push({ z: z, y: surfaceY(targets, z, top) }); }
  var roof = Math.max.apply(null, ys.map(function (p) { return p.y === null ? -1e9 : p.y; }));
  var run = ys.filter(function (p) { return p.y !== null && p.y >= roof - 0.035; });
  if (run.length) {
    // real roofs curve: centre on the highest point, length capped at ~26 % of the car (a ~1.2 m rack on a 4.6 m car)
    var peak = ys.reduce(function (a, p) { return p.y !== null && p.y > a.y ? p : a; }, { y: -1e9, z: 0 });
    var len = Math.min((run[run.length - 1].z - run[0].z) * 0.85, 0.26 * L);
    rack = makeRack(W, len, m.rack);
    rack.position.set(m.rack.x, roof + m.rack.y, peak.z + m.rack.z); group.add(rack);
  }

  var all = new THREE.Box3().setFromObject(root), as = all.getSize(new THREE.Vector3());
  shadow.scale.set(as.x * 1.35, as.z * 1.2, 1);

  // camera: fit the bounding sphere into the narrower field of view
  var r = as.length() / 2, vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  var d = (r / Math.sin(Math.min(vf, hf) / 2)) * 0.92;
  home.target.set(0, as.y * 0.4, 0);
  home.pos.copy(new THREE.Vector3(-0.62, 0.32, 0.78).normalize().multiplyScalar(d)).add(home.target);
  camera.position.copy(home.pos); controls.target.copy(home.target);
  controls.minDistance = d * 0.45; controls.maxDistance = d * 1.8;
  camera.near = d / 50; camera.far = d * 10; camera.updateProjectionMatrix();

  if (car) scene.remove(car.group);
  scene.add(group);
  return { file: s.file, group: group, paint: paint, wing: wing, rack: rack };
}

var building = null;
async function apply() {
  var s = state; if (!s) return;
  scene.background = new THREE.Color(s.bg);
  controls.enabled = !!s.interactive;
  controls.autoRotate = !s.reduced && !!s.autoRotate;
  if (!car || car.file !== s.file) {
    if (!assets[s.file]) { post({ type: "need", keys: [s.file] }); return; }
    if (building) return;
    try { building = build(s); car = await building; } catch (e) { post({ type: "error", message: String(e && e.message || e) }); return; } finally { building = null; }
    s = state;
  }
  car.paint.forEach(function (p) { p.color.set(s.color); });
  if (car.wing) car.wing.visible = !!s.wing;
  if (car.rack) car.rack.visible = !!s.rack;
  if (!shownOnce) { shownOnce = true; post({ type: "shown" }); }
}
function handle(m) {
  if (!m || typeof m !== "object") return;
  if (m.type === "state" && m.state && typeof m.state === "object") { state = m.state; apply(); }
  else if (m.type === "asset" && typeof m.key === "string" && typeof m.b64 === "string") { assets[m.key] = m.b64; apply(); }
}
var q = window.__q; window.car3d = handle; q.forEach(handle);

// double tap (or double click) resets the view
function reset() { camera.position.copy(home.pos); controls.target.copy(home.target); controls.update(); }
var lastTap = 0, downAt = null;
renderer.domElement.addEventListener("pointerdown", function (e) { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener("pointerup", function (e) {
  if (!state || !state.interactive || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
  var now = Date.now(); if (now - lastTap < 320) { reset(); lastTap = 0; } else lastTap = now;
});
window.addEventListener("resize", function () { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
renderer.setAnimationLoop(function () { if (document.hidden) return; controls.update(); renderer.render(scene, camera); });
post({ type: "ready" });
</script>
</body></html>`;
