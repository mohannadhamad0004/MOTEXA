// The page inside the 3D viewer's WebView (iframe on web): three.js from the jsDelivr CDN (pinned), GLTFLoader + meshopt decoder,
// OrbitControls, RoomEnvironment reflections, ACES tone mapping, physically based lights (three's default since r155).
// Protocol (JSON): app -> page  window.car3d({type:"state", state}) | {type:"asset", key, b64}
//                  page -> app  {type:"ready"} | {type:"need", keys} | {type:"shown"} | {type:"error", message}
// The page asks for the model file it has not been sent yet and keeps the parsed model for its lifetime; colour and extras
// changes only touch materials / visibility.
//
// PAINT: only the meshes under the model's paintNodes (none listed = the whole car) whose material is one of paintMaterials get a NEW MeshPhysicalMaterial
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

// ---- BODYKIT TEST: split a body zone off the car, fit a separate part into it ----
var dbgMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function eachVert(obj, fn) {
  obj.updateMatrixWorld(true); var v = new THREE.Vector3();
  obj.traverse(function (o) { if (!o.isMesh) return; var p = o.geometry.attributes.position; for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); fn(v); } });
}
function exactBox(obj) { var b = new THREE.Box3(); eachVert(obj, function (v) { b.expandByPoint(v); }); return b; }
/** The part of the named meshes inside box (world space) becomes its own mesh (same material, same transform). Triangles that cross a
 *  face of the box are CUT exactly there (position / normal / uv interpolated): the car's nose is a few big triangles, so whole-triangle
 *  picking could not separate a bumper from the headlights above it. Both halves share the cut line, so there is no gap. */
function splitZone(root, names, box) {
  var parts = [], tb = new THREE.Box3(), meshes = [], mn = box.min.toArray(), mx = box.max.toArray();
  root.traverse(function (o) { if (o.isMesh && names.indexOf(o.name) >= 0) meshes.push(o); });
  var lerpV = function (A, B, t) { var r = { w: [0, 0, 0], k: {} }, i, n; for (i = 0; i < 3; i++) r.w[i] = A.w[i] + (B.w[i] - A.w[i]) * t; for (n in A.k) { r.k[n] = []; for (i = 0; i < A.k[n].length; i++) r.k[n].push(A.k[n][i] + (B.k[n][i] - A.k[n][i]) * t); } return r; };
  // one plane: keep d = (w[ax] - val) * sgn >= 0 as "in"; returns the polygon halves (points on the plane belong to both)
  var cut = function (poly, ax, val, sgn) {
    var inn = [], out = [];
    for (var i = 0; i < poly.length; i++) {
      var A = poly[i], B = poly[(i + 1) % poly.length], da = (A.w[ax] - val) * sgn, db = (B.w[ax] - val) * sgn;
      if (da >= 0) inn.push(A); if (da <= 0) out.push(A);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) { var I = lerpV(A, B, da / (da - db)); inn.push(I); out.push(I); }
    }
    return { inn: inn, out: out };
  };
  meshes.forEach(function (o) {
    var g = o.geometry, ix = g.index ? g.index.array : null, n = ix ? ix.length : g.attributes.position.count, names2 = Object.keys(g.attributes), mw = o.matrixWorld, pos = g.attributes.position;
    var vert = function (i) { var v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mw), r = { w: v.toArray(), k: {} }; names2.forEach(function (nm) { var at = g.attributes[nm], c = []; for (var j = 0; j < at.itemSize; j++) c.push([at.getX, at.getY, at.getZ, at.getW][j].call(at, i)); r.k[nm] = c; }); return r; };
    var inP = [], outP = [], inside = 0;
    for (var i = 0; i < n; i += 3) {
      var poly = [vert(ix ? ix[i] : i), vert(ix ? ix[i + 1] : i + 1), vert(ix ? ix[i + 2] : i + 2)], rest = [];
      for (var ax = 0; ax < 3 && poly.length >= 3; ax++) {
        var c1 = cut(poly, ax, mn[ax], 1); if (c1.out.length >= 3) rest.push(c1.out); poly = c1.inn; if (poly.length < 3) break;
        var c2 = cut(poly, ax, mx[ax], -1); if (c2.out.length >= 3) rest.push(c2.out); poly = c2.inn;
      }
      if (poly.length >= 3) { inP.push(poly); inside++; }
      rest.forEach(function (r) { outP.push(r); });
    }
    if (!inP.length) return;
    var build = function (polys, grow) {
      var geo = new THREE.BufferGeometry(), arr = {}, cnt = 0;
      names2.forEach(function (nm) { arr[nm] = []; });
      polys.forEach(function (pl) {
        for (var t = 1; t < pl.length - 1; t++) [pl[0], pl[t], pl[t + 1]].forEach(function (v) {
          names2.forEach(function (nm) { for (var j = 0; j < v.k[nm].length; j++) arr[nm].push(v.k[nm][j]); });
          if (grow) tb.expandByPoint(new THREE.Vector3(v.w[0], v.w[1], v.w[2]));
          cnt++;
        });
      });
      names2.forEach(function (nm) { geo.setAttribute(nm, new THREE.BufferAttribute(new Float32Array(arr[nm]), g.attributes[nm].itemSize)); });
      return { geo: geo, tris: cnt / 3 };
    };
    var gi = build(inP, true), go = build(outP, false);
    var zm = new THREE.Mesh(gi.geo, o.material); zm.name = o.name + "_zone";
    zm.position.copy(o.position); zm.quaternion.copy(o.quaternion); zm.scale.copy(o.scale);
    o.parent.add(zm); o.geometry = go.geo;
    parts.push({ orig: o, zm: zm, mat: o.material, tris: gi.tris, of: n / 3 });
  });
  return { parts: parts, box: tb, names: meshes.map(function (o) { return o.name; }) };
}
/** Auto-fit: longest axis = width, front towards +Z (the middle sticks out further than the ends), uniform scale to the zone's width,
 *  at most 15 % extra per axis for height / depth, front-bottom-centre on the zone's front-bottom-centre. Hand-fit (adj) goes on top. */
async function buildPart(file, T) {
  var gl = await parse(file), root = gl.scene.clone(true), orient = new THREE.Group(), inner = new THREE.Group(), fit = new THREE.Group();
  orient.add(root); inner.add(orient); fit.add(inner);
  var b = exactBox(orient), sz = b.getSize(new THREE.Vector3()), turned = 0, flipped = false;
  if (sz.z > sz.x) { orient.rotation.y = Math.PI / 2; turned = 90; b = exactBox(orient); sz = b.getSize(new THREE.Vector3()); }
  var cx = (b.min.x + b.max.x) / 2, cS = 0, cN = 0, eS = 0, eN = 0;
  eachVert(orient, function (v) { var dx = Math.abs(v.x - cx) / sz.x; if (dx < 0.1) { cS += v.z; cN++; } else if (dx > 0.4) { eS += v.z; eN++; } });
  if (cN && eN && cS / cN < eS / eN) { orient.rotation.y += Math.PI; flipped = true; b = exactBox(orient); }
  orient.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -b.max.z);
  var ts = T.getSize(new THREE.Vector3()), u = ts.x / sz.x;
  var fy = clamp(ts.y / (sz.y * u), 0.85, 1.15), fz = clamp(ts.z / (sz.z * u), 0.85, 1.15);
  inner.scale.set(u, u * fy, u * fz);
  var anchor = new THREE.Vector3((T.min.x + T.max.x) / 2, T.min.y, T.max.z);
  var mats = [], tally = new Map(); root.traverse(function (o) { if (o.isMesh) { mats.push({ o: o, orig: o.material }); tally.set(o.material, (tally.get(o.material) || 0) + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count)); } });
  var mainMat = null; tally.forEach(function (n, mt) { if (!mainMat || n > tally.get(mainMat)) mainMat = mt; });
  mats.forEach(function (e) { e.main = e.orig === mainMat; });
  var round = function (n) { return Math.round(n * 1000) / 1000; };
  var info = { srcSize: [round(sz.x), round(sz.y), round(sz.z)], turnedDeg: turned, flipped180: flipped, zoneBumper: ts.toArray().map(round), uniform: round(u), extraY: round(fy), extraZ: round(fz), anchor: anchor.toArray().map(round) };
  info.mainMaterial = mainMat && mainMat.name; return { fit: fit, anchor: anchor, mats: mats, paint: null, info: info };
}

// ---- build (once per model file) ----
async function build(s) {
  var m = s.model, gltf = await parse(s.file);
  var root = gltf.scene.clone(true);
  if (m.preRotateX) {
    var source = root, tilt = new THREE.Group(); tilt.rotation.x = m.preRotateX; tilt.add(source);
    root = new THREE.Group(); root.add(tilt);
  }
  root.rotation.y = m.rotateY || 0;
  var group = new THREE.Group(); group.add(root);
  group.updateMatrixWorld(true);
  if (m.keepBox) { // drop loose parts lying outside the car (model units, after rotateY)
    var kb = m.keepBox, drop = [], cc = new THREE.Vector3();
    root.traverse(function (o) { if (!o.isMesh) return; new THREE.Box3().setFromObject(o).getCenter(cc); if (cc.y < kb.y[0] || cc.y > kb.y[1] || cc.z < kb.z[0] || cc.z > kb.z[1] || (kb.names && kb.names.indexOf(o.name) >= 0)) drop.push(o); });
    drop.forEach(function (o) { o.parent.remove(o); });
    group.updateMatrixWorld(true);
  }
  var bb = new THREE.Box3().setFromObject(root), size = bb.getSize(new THREE.Vector3());
  var k = m.lengthM / Math.max(size.x, size.z);
  root.scale.multiplyScalar(k);
  group.updateMatrixWorld(true);
  bb.setFromObject(root);
  var c = bb.getCenter(new THREE.Vector3());
  if (m.centerX !== undefined) c.x = m.centerX * k; // loose / one-sided parts (a single mirror) would shift a bounding-box centre
  root.position.set(-c.x, -bb.min.y + (m.groundOffset || 0), -c.z);
  group.updateMatrixWorld(true);

  // baked paint: ONE shared material for the whole car (the paint is in the photo texture); texels in the paint's hue window are
  // re-coloured, keeping their light / shade, everything else (glass, tyres, chrome, lights, reflections) is left alone
  var tint = null;
  if (m.bakedPaint) {
    var bp = m.bakedPaint, srcMat = null; tint = { value: new THREE.Color(s.color) };
    root.traverse(function (o) { if (o.isMesh && !srcMat) srcMat = o.material; });
    var baked = srcMat.clone(), f1 = function (n) { return n.toFixed(3); };
    baked.onBeforeCompile = function (sh) {
      sh.uniforms.uTint = tint;
      sh.fragmentShader = "uniform vec3 uTint;\\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\\n" +
        "{ vec3 sc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.4545));" +
        " float mx = max(sc.r, max(sc.g, sc.b)), mn = min(sc.r, min(sc.g, sc.b)), d = mx - mn, sat = d / max(mx, 0.001), h = 0.0;" +
        " if (d > 0.0001) { if (mx == sc.r) h = mod((sc.g - sc.b) / d, 6.0); else if (mx == sc.g) h = (sc.b - sc.r) / d + 2.0; else h = (sc.r - sc.g) / d + 4.0; }" +
        " h *= 60.0;" +
        " float inHue = smoothstep(" + f1(bp.hue[0] - 15) + ", " + f1(bp.hue[0]) + ", h) * (1.0 - smoothstep(" + f1(bp.hue[1]) + ", " + f1(bp.hue[1] + 15) + ", h));" +
        " float k = inHue * smoothstep(" + f1(bp.sat * 0.5) + ", " + f1(bp.sat) + ", sat) * smoothstep(0.03, 0.08, mx);" +
        " float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));" +
        " diffuseColor.rgb = mix(diffuseColor.rgb, uTint * clamp(lum / " + f1(bp.ref) + ", 0.0, 1.8), k); }");
    };
    baked.customProgramCacheKey = function () { return "bakedPaint"; };
    root.traverse(function (o) { if (o.isMesh) o.material = baked; });
  }

  // paint: a fresh material on the body only
  var paint = [], body = [];
  // no paintNodes = the whole car (the paint materials alone pick the body)
  (m.paintNodes.length ? m.paintNodes.map(function (n) { return root.getObjectByName(n); }) : [root]).forEach(function (node) {
    if (!node) return;
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

  // body-kit zone (fractions of the car's bounding box; y from the ground, front = +Z)
  var zone = null, zc = m.zones && m.zones.frontBumper;
  if (zc) {
    var rb = new THREE.Box3().setFromObject(root), rs = rb.getSize(new THREE.Vector3()), zf = zc.box;
    var zbox = new THREE.Box3(new THREE.Vector3(rb.min.x + zf.x[0] * rs.x, rb.min.y + zf.y[0] * rs.y, rb.min.z + zf.z[0] * rs.z), new THREE.Vector3(rb.min.x + zf.x[1] * rs.x, rb.min.y + zf.y[1] * rs.y, rb.min.z + zf.z[1] * rs.z));
    zone = splitZone(root, zc.meshes, zbox); zone.zbox = zbox;
    if (!zone.parts.length) zone = null;
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
  return { file: s.file, group: group, paint: paint, wing: wing, rack: rack, tint: tint, zone: zone, part: null, partP: null };
}

// BODYKIT TEST: show / hide the part, paint it like the car, hand-fit; the original zone is hidden while the part is on
function kitApply(s) {
  var z = car.zone, k = s.kit;
  if (!z) return;
  if (k && k.bumper && !car.part && !car.partP) {
    if (!assets[k.file]) post({ type: "need", keys: [k.file] });
    else {
      var c = car; car.partP = buildPart(k.file, z.box.isEmpty() ? z.zbox : z.box).then(function (p) { c.group.add(p.fit); c.part = p; post({ type: "fit", info: p.info }); if (c === car) kitApply(state); },
        function (e) { post({ type: "error", message: "bumper: " + String(e && e.message || e) }); });
    }
  }
  var on = !!(k && k.bumper && car.part);
  z.parts.forEach(function (p) { p.zm.visible = !on; p.zm.material = s.debug ? dbgMat : p.mat; });
  var pt = car.part; if (!pt) return;
  pt.fit.visible = on;
  var a = k && k.adj || { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1 };
  pt.fit.position.set(pt.anchor.x + a.x, pt.anchor.y + a.y, pt.anchor.z + a.z); pt.fit.rotation.set(a.rx, a.ry, 0); pt.fit.scale.setScalar(a.s);
  if (k && k.paintMatch) {
    if (!pt.paint) pt.paint = new THREE.MeshPhysicalMaterial({ color: s.color, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
    pt.paint.color.set(s.color);
    pt.mats.forEach(function (e) { e.o.material = e.main ? pt.paint : e.orig; });
  } else pt.mats.forEach(function (e) { e.o.material = e.orig; });
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
  if (car.tint) car.tint.value.set(s.color);
  kitApply(s);
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
window.__dbg = { THREE: THREE, scene: scene, camera: camera, controls: controls, home: home, handle: handle, state: function () { return state; }, car: function () { return car; } };
post({ type: "ready" });
</script>
</body></html>`;
