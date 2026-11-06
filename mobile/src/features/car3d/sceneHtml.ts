// The page inside the 3D viewer's WebView (iframe on web): three.js from the jsDelivr CDN (pinned), GLTFLoader + meshopt decoder,
// OrbitControls, RoomEnvironment reflections, ACES tone mapping, physically based lights (three's default since r155).
// Protocol (JSON): app -> page  window.car3d({type:"state", state}) | {type:"asset", key, b64}
//                  page -> app  {type:"ready"} | {type:"need", keys} | {type:"shown"} | {type:"error", message}
// The page asks for the model file it has not been sent yet and keeps the parsed model for its lifetime; colour and accessory
// changes only touch materials / visibility (new tuned zones rebuild the car from the parsed file, keeping the camera).
//
// PAINT: only the meshes under the model's paintNodes (none listed = the whole car) whose material is one of paintMaterials get a NEW MeshPhysicalMaterial
// (metallic car paint with clearcoat, keeping the original normal map); every other mesh using the same material (wheels,
// lights, interior) keeps the original.
// ZONE PREVIEW (Parts Admin zone editor, state.zonePreview = TYPE): what an accessory of that type hides is painted red, where it
// goes is a green box. The draft zones come in state.model.zones, so the admin sees each change before saving.
export const THREE_VERSION = "0.160.1";

// PART MAP AUTO-LABEL (proposal only; the Parts Admin confirms it in /dept/accessory-zones). Pure, no three.js: also run by the tests.
// pieces = [{ id: "m<mesh>c<component>", name, mat, tris, b: [x0, y0, z0, x1, y1, z1] }], b in fractions of the car's box (x across,
// y up from the ground, z 0 = rear / 1 = front); D = the car's size in metres [W, H, L]. -> { LABEL: { ids, confidence, by } }.
// A name only counts when the piece is most of its mesh (one exported body mesh named "bumper_R_trim" holds the whole shell), and a
// piece is only proposed when its position / size fits the label too.
export const PART_RULES_JS = String.raw`
var PART_LABELS = ["FRONT_BUMPER", "REAR_BUMPER", "SPOILER", "SIDE_SKIRTS", "MIRRORS", "WHEELS", "ROOF_RAILS"];
var PART_WORDS = {
  FRONT_BUMPER: /bump|stoss|valance|paragol|(?<![a-z])lip(?![a-z])/i, REAR_BUMPER: /bump|stoss|valance|paragol|diffus/i,
  SPOILER: /spoiler|(?<![a-z])wing|ducktail|(?<![a-z])lip(?![a-z])|heckfl|aileron|becquet/i, SIDE_SKIRTS: /skirt|(?<![a-z])sill|schweller|marchepied/i,
  MIRRORS: /(?<!int)mirror|spiegel|retrov|espejo|miroir/i, WHEELS: /wheel|(?<![a-z])rim|tire|tyre|felg|llant|reifen|rueda|jante|pneu|(?<![a-z])roda(?![a-z])/i,
  ROOF_RAILS: /roof.?rail|(?<![a-z])rails?(?![a-z])|(?<![a-z])rack|reling|dachtr/i
};
var NOT_BODY = /interior|seat|dash|engine|motor|gauge|needle|steer|radio|door.?panel|carpet|glass|window|light|lamp|signal|repeater|indicator|brake|disc|caliper|susp|exhaust|chassis|underbody|floor|plate|logo|letter|emblem|badge/i;
var MECHANICAL = /engine|motor|exhaust|diff|susp|fuel|tank|radiator|cool|subframe|shaft|strut|hub|transmission|gearbox/i;
var NOT_WHEEL_PART = /steer|lenk|volant|spare|brake|disc|caliper|bremse|hub|susp|engine|motor|exhaust|strut|coil|shaft|swaybar|subframe/i;
function partShape(L, b, D) {
  var w = b[3] - b[0], h = b[4] - b[1], l = b[5] - b[2], cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
  if (L === "FRONT_BUMPER") return b[5] > 0.96 && b[2] > 0.72 && w > 0.6 && b[1] < 0.3 && b[4] < 0.62 && Math.abs(cx - 0.5) < 0.1;
  if (L === "REAR_BUMPER") return b[2] < 0.04 && b[5] < 0.28 && w > 0.6 && b[1] < 0.3 && b[4] < 0.62 && Math.abs(cx - 0.5) < 0.1;
  if (L === "SPOILER") return b[2] < 0.16 && b[5] < 0.3 && b[1] > 0.6 && w > 0.45 && w < 0.97 && l * D[2] < 0.5 && h * D[1] < 0.3 && Math.abs(cx - 0.5) < 0.06;
  if (L === "SIDE_SKIRTS") return l > 0.3 && l < 0.8 && b[1] < 0.2 && b[4] < 0.4 && w * D[0] < 0.3 && (b[0] < 0.08 || b[3] > 0.92) && b[2] > 0.08 && b[5] < 0.92;
  if (L === "MIRRORS") return w * D[0] < 0.3 && l * D[2] < 0.35 && h * D[1] < 0.25 && b[1] > 0.5 && b[4] < 0.85 && cz > 0.45 && cz < 0.8 && (b[0] < 0.07 || b[3] > 0.93);
  if (L === "WHEELS") { var dh = h * D[1], dl = l * D[2]; return dh > 0.25 && dh < 1.1 && Math.abs(dh - dl) < 0.2 * Math.max(dh, dl) && w * D[0] < 0.45 && b[1] < 0.15 && (cx < 0.3 || cx > 0.7) && (cz < 0.42 || cz > 0.58); }
  if (L === "ROOF_RAILS") return b[1] > 0.8 && l > 0.25 && w < 0.15 && h * D[1] < 0.15 && (b[0] < 0.3 || b[3] > 0.7);
  return false;
}
function autoLabel(pieces, D) {
  var out = {}, meshTris = {}, mesh = function (p) { return p.id.split("c")[0]; };
  pieces.forEach(function (p) { meshTris[mesh(p)] = (meshTris[mesh(p)] || 0) + p.tris; });
  var named = function (p, L) {
    var nm = p.name + " " + p.mat; if (!PART_WORDS[L].test(nm) || p.tris < 0.5 * meshTris[mesh(p)]) return false;
    var tk = nm.toLowerCase().split(/[^a-z0-9]+/), f = tk.some(function (t) { return /^(f\d?|front|fr|vorne|avant)$/.test(t); }), r = tk.some(function (t) { return /^(r\d?|rear|rr|back|hinten|arriere)$/.test(t); });
    return !(L === "FRONT_BUMPER" && r && !f) && !(L === "REAR_BUMPER" && f && !r);
  };
  PART_LABELS.forEach(function (L) {
    var hits = [], corners = 0;
    pieces.forEach(function (p) {
      if (p.tris < 8 || !partShape(L, p.b, D)) return;
      var nm = named(p, L); if (!nm && (L === "WHEELS" ? NOT_WHEEL_PART : NOT_BODY).test(p.name + " " + p.mat)) return;
      hits.push({ p: p, conf: nm ? 0.9 : 0.6 });
    });
    if (L === "WHEELS") { // the biggest round piece per corner is the wheel; everything inside its box goes with it (rim, tyre, nuts), brakes stay
      var best = {}; hits.forEach(function (h) { var q = ((h.p.b[0] + h.p.b[3]) < 1 ? "L" : "R") + ((h.p.b[2] + h.p.b[5]) < 1 ? "r" : "f"); if (!best[q] || h.p.b[4] - h.p.b[1] > best[q].p.b[4] - best[q].p.b[1]) best[q] = h; });
      hits = []; Object.keys(best).forEach(function (q) { var B = best[q].p.b, e = 0.01; corners++;
        pieces.forEach(function (p) { if (p.b[0] >= B[0] - e && p.b[1] >= B[1] - e && p.b[2] >= B[2] - e && p.b[3] <= B[3] + e && p.b[4] <= B[4] + e && p.b[5] <= B[5] + e && !NOT_WHEEL_PART.test(p.name + " " + p.mat)) hits.push({ p: p, conf: best[q].conf }); }); });
    }
    if (hits.length && (L === "FRONT_BUMPER" || L === "REAR_BUMPER" || L === "SPOILER")) { // what sits inside goes with it (grille insert, fog lights, 3rd brake light)
      var B = [1, 1, 1, 0, 0, 0], e2 = 0.005, have = {};
      hits.forEach(function (h) { have[h.p.id] = 1; for (var i = 0; i < 3; i++) { B[i] = Math.min(B[i], h.p.b[i]); B[i + 3] = Math.max(B[i + 3], h.p.b[i + 3]); } });
      pieces.forEach(function (p) { if (!have[p.id] && p.b[0] >= B[0] - e2 && p.b[1] >= B[1] - e2 && p.b[2] >= B[2] - e2 && p.b[3] <= B[3] + e2 && p.b[4] <= B[4] + e2 && p.b[5] <= B[5] + e2 && !MECHANICAL.test(p.name + " " + p.mat)) hits.push({ p: p, conf: 0.6, inside: true }); });
    }
    if (!hits.length) return;
    var main = hits.filter(function (h) { return !h.inside; });
    var conf = main.reduce(function (a, h) { return a + h.conf; }, 0) / main.length, l = 0, r = 0;
    hits.forEach(function (h) { if (h.p.b[0] + h.p.b[3] < 1) l = 1; else r = 1; });
    if (L === "MIRRORS" || L === "SIDE_SKIRTS" || L === "ROOF_RAILS") { if (l + r < 2) conf *= 0.5; }
    else if (L === "WHEELS") conf *= corners / 4;
    else if (main.length > 2) conf *= 0.8;
    out[L] = { ids: hits.map(function (h) { return h.p.id; }), confidence: Math.round(conf * 100) / 100, by: hits.some(function (h) { return h.conf > 0.8; }) ? "name+shape" : "shape" };
  });
  return out;
}
`;

// Shared deterministic rim geometry rules; no renderer or model-specific settings.
export const RIM_RULES_JS = String.raw`
function rimMedian(a) { var b=a.slice().sort(function(x,y){return x-y;}); return b.length ? b[Math.floor(b.length/2)] : null; }
function rimArchEstimate(samples) {
  var a=samples.filter(Number.isFinite), m=rimMedian(a); if(a.length<5) return {value:null,confidence:0};
  var mad=rimMedian(a.map(function(x){return Math.abs(x-m);})), tol=Math.max(0.008,Math.min(0.025,3*mad));
  var good=a.filter(function(x){return Math.abs(x-m)<=tol;});
  return good.length<5 || good.length<a.length*0.6 ? {value:null,confidence:0} : {value:rimMedian(good),confidence:Math.min(1,good.length/12)*(good.length/a.length)};
}
function rimOffsetSearch(gap, safe, override) {
  var target=0.005, warnings=[], desired=gap===null?0:gap-target;
  if(gap===null) warnings.push("ARCH_UNCERTAIN");
  if(typeof override==="number") { desired=override; warnings.push("ADMIN_INSET_OVERRIDE"); }
  var d=Math.max(-0.04,Math.min(0.04,desired)); if(Math.abs(desired-d)>1e-8) warnings.push("OFFSET_CLAMPED");
  for(var i=0;i<=20;i++) { var x=d*(1-i/20); if(safe(x)) { if(i) warnings.push("INNER_CLEARANCE_LIMITED"); if(!x && desired) warnings.push("USED_STOCK_OFFSET"); return {offset:x,warnings:warnings}; } }
  warnings.push("USED_STOCK_OFFSET","INNER_CLEARANCE_LIMITED"); return {offset:0,warnings:warnings,unsafe:true};
}
// Jacobi eigensolver for a real symmetric 3x3 covariance. Sorted eigenvectors; deterministic sweep order.
function rimPCA(points) {
  var c=[0,0,0], n=points.length; if(n<12)return null;
  points.forEach(function(p){for(var i=0;i<3;i++)c[i]+=p[i]/n;});
  var a=[[0,0,0],[0,0,0],[0,0,0]], v=[[1,0,0],[0,1,0],[0,0,1]];
  points.forEach(function(p){for(var i=0;i<3;i++)for(var j=0;j<3;j++)a[i][j]+=(p[i]-c[i])*(p[j]-c[j])/n;});
  for(var k=0;k<24;k++) { var p=0,q=1; [[0,2],[1,2]].forEach(function(ij){if(Math.abs(a[ij[0]][ij[1]])>Math.abs(a[p][q])){p=ij[0];q=ij[1];}});
    if(Math.abs(a[p][q])<1e-12)break;
    var ang=0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]), cs=Math.cos(ang), sn=Math.sin(ang), ap=a[p][p], aq=a[q][q], off=a[p][q];
    for(var j=0;j<3;j++)if(j!==p&&j!==q){var x=a[j][p],y=a[j][q];a[j][p]=a[p][j]=cs*x-sn*y;a[j][q]=a[q][j]=sn*x+cs*y;}
    a[p][p]=cs*cs*ap-2*sn*cs*off+sn*sn*aq;a[q][q]=sn*sn*ap+2*sn*cs*off+cs*cs*aq;a[p][q]=a[q][p]=0;
    for(var j=0;j<3;j++){var x=v[j][p],y=v[j][q];v[j][p]=cs*x-sn*y;v[j][q]=sn*x+cs*y;}
  }
  var ix=[0,1,2].sort(function(i,j){return a[i][i]-a[j][j];});
  return {center:c,axis:ix.map(function(i){return [v[0][i],v[1][i],v[2][i]];}),values:ix.map(function(i){return a[i][i];})};
}
`;

// AUTO-FIT RULES (pure, no three.js: also run by the tests). Fit versions per fitter group: bump only the group whose fitter changed, so only
// that group's stored fits are recomputed (approved / admin-corrected fits of other groups stay). Both objects are JSON: the server parses them.
export const FIT_RULES_JS = String.raw`
var FIT_VERSIONS = {"rims": 5, "wings": 2, "bumpers": 2, "other": 2};
// wings = the add-on fitter (wing, spoiler, roof rack); every type not listed is "other"
var FIT_GROUPS = {"RIMS": "rims", "WING": "wings", "SPOILER": "wings", "ROOF_RACK": "wings", "FRONT_BUMPER": "bumpers", "REAR_BUMPER": "bumpers"};
function fitVersion(type) { return FIT_VERSIONS[FIT_GROUPS[type] || "other"]; }
/** Highest a part may stand above its mount surface (metres): the scale comes down to respect it. */
var FIT_MAX_H = { WING: 0.45, SPOILER: 0.15, ROOF_RACK: 0.3 };
/** The rear of the car from its centreline profile: tops seen from above, from the rear to the front (z, y = height above the ground in
 *  metres, y null = nothing there); H, L = the car's height and length. sedan: a boot lid between the rear edge and the rear window;
 *  hatch (hatchback, SUV, van, estate): the roof runs (almost) to the rear, a wing goes on the top edge of the tailgate; pickup: a long
 *  low bed behind the cab (no rear wing by default). */
function rearDeck(profile, H, L) {
  var q = profile.filter(function (s) { return s.y !== null; }); if (q.length < 8) return null;
  // a hole in the mesh (a dip far below both sides within 16 cm) is not part of the shape
  var p = q.filter(function (s, i) { var l = q.slice(Math.max(0, i - 4), i), r = q.slice(i + 1, i + 5), mx = function (a) { return a.length ? Math.max.apply(null, a.map(function (t) { return t.y; })) : -1e9; };
    return !(l.length && r.length && s.y < Math.min(mx(l), mx(r)) - 0.2 * H); });
  var z0 = p[0].z, mid = p.filter(function (s) { return s.z > z0 + 0.3 * L && s.z < z0 + 0.75 * L; }); if (!mid.length) return null;
  var roof = Math.max.apply(null, mid.map(function (s) { return s.y; })), iw = -1, i;
  H = Math.min(H, roof); // a stray tall object in the file must not stretch every height rule
  p = p.filter(function (s) { return s.y <= roof + 0.1 * H; }); // nor an antenna / fin standing over the roof
  for (i = 0; i < p.length; i++) if (p[i].y > roof - 0.12 * H) { iw = i; break; }
  var sl = function (k) { return (p[k + 1].y - p[k].y) / Math.max(p[k + 1].z - p[k].z, 1e-6); };
  // hatch: the top of the tailgate = the first point at roof height, past any still-steep glass / curve
  var hatch = function (k) { while (k < p.length - 2 && sl(k) > 0.6) k++; return { body: "hatch", edgeZ: p[k].z, frontZ: p[k].z + 0.3 * L, y: p[k].y, roofY: roof }; };
  if (iw < 1) return hatch(0);
  var bed = 0; for (i = 0; i < iw; i++) if (p[i].y < 0.62 * H) bed += p[i + 1].z - p[i].z;
  if (bed > 0.2 * L) return { body: "pickup", edgeZ: p[0].z, frontZ: p[iw].z, y: null, roofY: roof };
  var b = iw; while (b > 0 && sl(b - 1) > 0.35) b--;                                                   // down the rear window
  var e = b; while (e > 0 && Math.abs(sl(e - 1)) < 0.35 && p[e - 1].y > p[b].y - 0.08 * H) e--;      // back along the lid
  if (p[b].z - p[e].z < 0.04 * L) return hatch(iw);
  return { body: "sedan", edgeZ: p[e].z, frontZ: p[b].z, y: p[e].y, roofY: roof };
}
/** Where the feet go along the car: sedan wing 10 % of the lid in front of its rear edge (lip spoiler 3 %), never so close that a foot
 *  hangs over the edge, never past the middle of the lid; hatch: just in front of the roof's rear edge (top of the tailgate). */
function mountZ(deck, type, footHalf) {
  if (deck.body === "sedan") { var len = deck.frontZ - deck.edgeZ, spoiler = type === "SPOILER";
    return deck.edgeZ + Math.min(Math.max((spoiler ? 0.03 : 0.1) * len, footHalf + (spoiler ? 0.01 : 0.02)), 0.5 * len); }
  return deck.edgeZ + footHalf + 0.03;
}
/** The run around the middle whose top stays within tol of yRef (the lid / roof itself, not the sides it curves down into).
 *  samples = [{ x, y }] across the car, in order. */
function band(samples, xc, yRef, tol) {
  var ok = function (s) { return s.y !== null && Math.abs(s.y - yRef) <= tol; }, c = 0;
  samples.forEach(function (s, i) { if (Math.abs(s.x - xc) < Math.abs(samples[c].x - xc)) c = i; });
  if (!ok(samples[c])) return null;
  var l = c, r = c; while (l > 0 && ok(samples[l - 1])) l--; while (r < samples.length - 1 && ok(samples[r + 1])) r++;
  return { min: samples[l].x, max: samples[r].x };
}
/** The body's width at this cross-section (tops higher than yMin). */
function bodyWidth(samples, yMin) { var h = samples.filter(function (s) { return s.y !== null && s.y >= yMin; }); return h.length ? h[h.length - 1].x - h[0].x : 0; }
/** One uniform scale, the smallest of: blade 92 % of the mount width, feet inside 85 % of it, never wider than 98 % of the body there,
 *  the shop's real width when that is smaller, the height cap. by = which rule decided. */
function fitScale(p) {
  var c = { mount: 0.92 * p.mountW / p.span, body: 0.98 * p.bodyW / p.span };
  if (p.feetOuter > 0) c.feet = 0.85 * p.mountW / p.feetOuter;
  if (p.realW > 0) c.real = p.realW / p.span;
  if (p.maxH > 0 && p.height > 0) c.height = p.maxH / p.height;
  var u = Infinity, by = null; Object.keys(c).forEach(function (k) { if (c[k] > 0 && c[k] < u) { u = c[k]; by = k; } });
  return { u: u, by: by };
}
`;

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
${PART_RULES_JS}
${FIT_RULES_JS}
${RIM_RULES_JS}

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

// ray cast straight down onto the given meshes: the highest surface at (0, z)
function surfaceY(meshes, z, top) {
  var hit = new THREE.Raycaster(new THREE.Vector3(0, top + 1, z), new THREE.Vector3(0, -1, 0)).intersectObjects(meshes, false)[0];
  return hit ? hit.point.y : null;
}

// ---- ACCESSORIES: a shop's real part (its own GLB) fitted onto the car ----
// Body-kit parts (bumpers, side skirts) REPLACE their zone: the car's own triangles inside the zone are split off at load and hidden while
// the part is on. Add-ons are attached; wing / spoiler / roof rack / mirror covers / rims also hide the car's OWN part (stock spoiler,
// rails, mirrors, rims): the zone's "replace" (mesh names hidden whole, or a box cut like a bumper), else separate stock meshes found by
// name (rims: the wheel meshes that are not tyres). Lip, diffuser and flares never hide anything.
// Zones: model.zones[TYPE] = { meshes?: [...], box?: {x,y,z}, replace?: { meshes?, box? } } (fractions of the car's bounding box, y from
// the ground, z: 0 = rear, 1 = front), admin-tuned per car model; without one the defaults below are used. Real size scales add-ons.
var KIT = {
  FRONT_BUMPER: { replace: true, end: 1, box: { x: [0, 1], y: [0, 0.45], z: [0.88, 1] }, named: /bump|stoss|paragol/i },
  REAR_BUMPER: { replace: true, end: -1, box: { x: [0, 1], y: [0, 0.45], z: [0, 0.12] }, named: /bump|stoss|paragol/i },
  SIDE_SKIRTS: { replace: true, end: 0, box: null, named: /skirt|sill|schweller|marchepied/i },
  FRONT_LIP: { end: 1, box: { x: [0, 1], y: [0, 0.45], z: [0.94, 1] } },
  REAR_DIFFUSER: { end: -1, box: { x: [0, 1], y: [0, 0.45], z: [0, 0.06] } },
  FENDER_FLARES: { never: true }, RIMS: { stock: "rims" }, MIRROR_COVERS: { stock: "mirrors" },
  WING: { stock: "rear", named: /spoiler|wing|aileron|heckfl|becquet/i }, SPOILER: { stock: "rear", named: /spoiler|wing|aileron|heckfl|becquet/i },
  ROOF_RACK: { stock: "roof", named: /roof.?rail|rail|rack|reling|dachtr/i }
};
KIT.FRONT_LIP.never = KIT.REAR_DIFFUSER.never = true;
// rim only as a word start: a body mesh named "bumper_R_trim" is not a wheel
var WHEEL = /wheel|(?<![a-z])rim|tire|tyre|felg|llant|reifen|rueda|jante|pneu|(?<![a-z])roda(?![a-z])/i, NOT_WHEEL = /steer|lenk|volant|spare|brake|disc|caliper|bremse|freio|pinza|etrier/i, TYRE = /tire|tyre|reifen|pneu|rubber|gomma/i;
var MIRROR = /mirror|spiegel|retrov|espejo|miroir/i;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function eachVert(obj, fn) {
  obj.updateMatrixWorld(true); var v = new THREE.Vector3();
  obj.traverse(function (o) { if (!o.isMesh || !o.visible) return; var p = o.geometry.attributes.position; for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); fn(v, o); } });
}
function exactBox(obj) { var b = new THREE.Box3(); eachVert(obj, function (v) { b.expandByPoint(v); }); return b; }
function fracBox(rb, f) {
  var s = rb.getSize(new THREE.Vector3());
  return new THREE.Box3(new THREE.Vector3(rb.min.x + f.x[0] * s.x, rb.min.y + f.y[0] * s.y, rb.min.z + f.z[0] * s.z), new THREE.Vector3(rb.min.x + f.x[1] * s.x, rb.min.y + f.y[1] * s.y, rb.min.z + f.z[1] * s.z));
}
/** The part of the given meshes inside box (world space) becomes its own mesh (same material, same transform). Triangles that cross a
 *  face of the box are CUT exactly there (position / normal / uv interpolated): a car's nose is often a few big triangles, so
 *  whole-triangle picking could not separate a bumper from the headlights above it. Both halves share the cut line: no gap. */
function splitZone(meshes, box) {
  var parts = [], tb = new THREE.Box3(), mn = box.min.toArray(), mx = box.max.toArray();
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
    o.updateMatrixWorld(true);
    var g = o.geometry, ix = g.index ? g.index.array : null, n = ix ? ix.length : g.attributes.position.count, names2 = Object.keys(g.attributes), mw = o.matrixWorld, pos = g.attributes.position;
    if (!new THREE.Box3().setFromObject(o).intersectsBox(box)) return;
    var vert = function (i) { var v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mw), r = { w: v.toArray(), k: {} }; names2.forEach(function (nm) { var at = g.attributes[nm], c = []; for (var j = 0; j < at.itemSize; j++) c.push([at.getX, at.getY, at.getZ, at.getW][j].call(at, i)); r.k[nm] = c; }); return r; };
    var inP = [], outP = [];
    for (var i = 0; i < n; i += 3) {
      var poly = [vert(ix ? ix[i] : i), vert(ix ? ix[i + 1] : i + 1), vert(ix ? ix[i + 2] : i + 2)], rest = [];
      for (var ax = 0; ax < 3 && poly.length >= 3; ax++) {
        var c1 = cut(poly, ax, mn[ax], 1); if (c1.out.length >= 3) rest.push(c1.out); poly = c1.inn; if (poly.length < 3) break;
        var c2 = cut(poly, ax, mx[ax], -1); if (c2.out.length >= 3) rest.push(c2.out); poly = c2.inn;
      }
      if (poly.length >= 3) inP.push(poly);
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
    parts.push({ orig: o.name, zm: zm, tris: gi.tris, of: n / 3 });
  });
  return { parts: parts, box: tb };
}
/** The 4 wheels: vertices of wheel-like meshes (by mesh or material name) bucketed into quadrants, so one combined wheel mesh also
 *  works. A wheel stands on the ground, so its tyre radius = centre height. Without wheel meshes: typical positions. */
function findWheels(root, rb, only) {
  var c = rb.getCenter(new THREE.Vector3()), s = rb.getSize(new THREE.Vector3()), q = [0, 1, 2, 3].map(function () { return new THREE.Box3(); }), meshes = only || [];
  if (!only) root.traverse(function (o) { if (o.isMesh && (WHEEL.test(o.name) || WHEEL.test(o.material.name || "")) && !NOT_WHEEL.test(o.name + " " + (o.material.name || ""))) meshes.push(o); });
  // only the outer quarter each side: a mesh named "roda" may also hold the steering / spare wheel; one tyre mesh may hold all four
  meshes.forEach(function (o) { eachVert(o, function (v) { if (v.y < rb.min.y + s.y * 0.6 && Math.abs(v.x - c.x) > s.x * 0.25) q[(v.x > c.x ? 1 : 0) + (v.z > c.z ? 2 : 0)].expandByPoint(v); }); });
  var found = q.every(function (b) { return !b.isEmpty() && b.getSize(new THREE.Vector3()).y > s.y * 0.15; });
  if (!found && !only) { // no names: the round pieces standing on the ground at the corners (tyres / one-piece wheels)
    var round = []; root.traverse(function (o) { if (!o.isMesh) return; var b = new THREE.Box3().setFromObject(o), z = b.getSize(new THREE.Vector3());
      if (b.min.y < rb.min.y + 0.04 * s.y && z.y > 0.18 * s.y && z.y < 0.6 * s.y && z.x < 0.2 * s.x && Math.abs(z.y - z.z) < 0.2 * z.y && Math.abs(b.getCenter(new THREE.Vector3()).x - c.x) > 0.25 * s.x) round.push(o); });
    if (round.length >= 4) { var g = findWheels(root, rb, round); if (g.found) return g; }
  }
  var list = q.map(function (b, i) {
    var side = i & 1 ? 1 : -1, front = i & 2 ? 1 : -1, ctr;
    if (found) ctr = b.getCenter(new THREE.Vector3());
    else { var r0 = 0.32 * s.z / 4.5; ctr = new THREE.Vector3(c.x + side * (s.x / 2 - 0.12 * s.x), rb.min.y + r0, c.z + front * s.z * 0.33); }
    var bs = found ? b.getSize(new THREE.Vector3()) : null;
    return { side: side, front: front, center: ctr, r: ctr.y - rb.min.y, rimR: bs ? Math.max(bs.y, bs.z) / 2 : (ctr.y - rb.min.y) * 0.65, outer: found ? (side > 0 ? b.max.x : b.min.x) : c.x + side * s.x / 2 };
  });
  return { found: found, list: list, meshes: meshes };
}
function zoneBox(car, type) {
  var t = car.tuned[type] || {}, k = KIT[type];
  if (t.box) return fracBox(car.rb, t.box);
  if (k.box) return fracBox(car.rb, k.box);
  if (type === "SIDE_SKIRTS") { // between the wheels, lower 15 %
    var w = car.wheels.list, rear = Math.max(w[0].center.z, w[1].center.z), front = Math.min(w[2].center.z, w[3].center.z), r = w[0].r, s = car.rb.getSize(new THREE.Vector3());
    return new THREE.Box3(new THREE.Vector3(car.rb.min.x, car.rb.min.y, rear + r * 1.05), new THREE.Vector3(car.rb.max.x, car.rb.min.y + 0.15 * s.y, front - r * 1.05));
  }
  return null;
}
// ---- PART MAP: the car in pieces = its meshes split again into connected components (vertices welded by world position, 1 mm).
// Piece id "m<i>c<j>": i = the mesh's index in the loaded file's traversal (set before anything is removed), j = the component's order of
// first triangle. Same file + same code = same ids, so a map confirmed by the Parts Admin is only served for that file's sha256.
// A confirmed map (model.partMap = { LABEL: [ids] }) splits the mapped triangles off into one mesh per label at load; an accessory
// hides its label's meshes while on (PART_OF) and is fitted to their bounds. Labels without pieces fall back to the zones below.
var PART_OF = { WING: "SPOILER", SPOILER: "SPOILER", FRONT_BUMPER: "FRONT_BUMPER", REAR_BUMPER: "REAR_BUMPER", SIDE_SKIRTS: "SIDE_SKIRTS",
  MIRROR_COVERS: "MIRRORS", RIMS: "WHEELS", ROOF_RACK: "ROOF_RAILS", FRONT_LIP: "FRONT_BUMPER", REAR_DIFFUSER: "REAR_BUMPER" };
var SEG = new WeakMap();
function triVert(g, t, j) { return g.index ? g.index.array[t * 3 + j] : t * 3 + j; }
function segment(o) {
  if (SEG.has(o)) return SEG.get(o);
  o.updateMatrixWorld(true);
  var g = o.geometry, p = g.attributes.position, nt = Math.floor((g.index ? g.index.count : p.count) / 3), weld = new Map(), wid = new Int32Array(p.count), wp = new Float32Array(p.count * 3), v = new THREE.Vector3(), i, t;
  for (i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z;
    var k = Math.round(v.x * 1000) + "," + Math.round(v.y * 1000) + "," + Math.round(v.z * 1000), w = weld.get(k); if (w === undefined) { w = weld.size; weld.set(k, w); } wid[i] = w;
  }
  var par = new Int32Array(weld.size); for (i = 0; i < par.length; i++) par[i] = i;
  var find = function (a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }, join = function (a, b) { a = find(a); b = find(b); if (a !== b) par[b] = a; };
  for (t = 0; t < nt; t++) { join(wid[triVert(g, t, 0)], wid[triVert(g, t, 1)]); join(wid[triVert(g, t, 0)], wid[triVert(g, t, 2)]); }
  var tri = new Int32Array(nt), num = new Map(), boxes = [], tris = [];
  for (t = 0; t < nt; t++) {
    var r = find(wid[triVert(g, t, 0)]), c = num.get(r); if (c === undefined) { c = num.size; num.set(r, c); boxes.push(new THREE.Box3()); tris.push(0); }
    tri[t] = c; tris[c]++; for (var j = 0; j < 3; j++) { var vi = triVert(g, t, j); boxes[c].expandByPoint(v.set(wp[vi * 3], wp[vi * 3 + 1], wp[vi * 3 + 2])); }
  }
  var seg = { tri: tri, boxes: boxes, tris: tris }; SEG.set(o, seg); return seg;
}
function carMeshes(car) { var l = []; car.root.traverse(function (o) { if (o.isMesh && o.userData.pi !== undefined) l.push(o); }); return l; }
/** Every piece of the car (ids, names, triangle counts, bounds as fractions of the car's box) for the auto-labeller and the database. */
function carPieces(car) {
  var rb = car.rb, s = rb.getSize(new THREE.Vector3()), f = function (n) { return Math.round(n * 1e4) / 1e4; }, out = [];
  carMeshes(car).forEach(function (o) { var seg = segment(o);
    seg.boxes.forEach(function (b, c) { out.push({ id: "m" + o.userData.pi + "c" + c, name: o.name, mat: o.userData.mat, tris: seg.tris[c],
      b: [f((b.min.x - rb.min.x) / s.x), f((b.min.y - rb.min.y) / s.y), f((b.min.z - rb.min.z) / s.z), f((b.max.x - rb.min.x) / s.x), f((b.max.y - rb.min.y) / s.y), f((b.max.z - rb.min.z) / s.z)] }); }); });
  return { pieces: out, dims: s.toArray().map(function (n) { return Math.round(n * 1000) / 1000; }) };
}
/** A new geometry holding only the vertices of these indices (attributes as floats, like splitZone). */
function subGeo(g, idx) {
  var map = new Map(), order = [], ni = new Uint32Array(idx.length), out = new THREE.BufferGeometry();
  for (var i = 0; i < idx.length; i++) { var n = map.get(idx[i]); if (n === undefined) { n = order.length; map.set(idx[i], n); order.push(idx[i]); } ni[i] = n; }
  Object.keys(g.attributes).forEach(function (k) { var a = g.attributes[k], sz = a.itemSize, get = [a.getX, a.getY, a.getZ, a.getW], arr = new Float32Array(order.length * sz);
    for (var j = 0; j < order.length; j++) for (var c = 0; c < sz; c++) arr[j * sz + c] = get[c].call(a, order[j]);
    out.setAttribute(k, new THREE.BufferAttribute(arr, sz)); });
  out.setIndex(new THREE.BufferAttribute(ni, 1)); return out;
}
/** Split a confirmed map's pieces off into one mesh per label (same material and transform). Returns { LABEL: [meshes] }. */
function applyPartMap(car, labels) {
  var want = new Map(), parts = {};
  Object.keys(labels || {}).forEach(function (L) { (labels[L] || []).forEach(function (id) { var m = /^m(\\d+)c(\\d+)$/.exec(id); if (!m) return; if (!want.has(+m[1])) want.set(+m[1], new Map()); want.get(+m[1]).set(+m[2], L); }); });
  carMeshes(car).forEach(function (o) {
    var sel = want.get(o.userData.pi); if (!sel) return;
    var seg = segment(o), g = o.geometry, idx = {}, rest = [];
    for (var t = 0; t < seg.tri.length; t++) { var L = sel.get(seg.tri[t]), arr = L ? (idx[L] = idx[L] || []) : rest; arr.push(triVert(g, t, 0), triVert(g, t, 1), triVert(g, t, 2)); }
    Object.keys(idx).forEach(function (L) { var pm = new THREE.Mesh(subGeo(g, idx[L]), o.material); pm.name = o.name + "_" + L; pm.userData.label = L;
      pm.position.copy(o.position); pm.quaternion.copy(o.quaternion); pm.scale.copy(o.scale); o.parent.add(pm); (parts[L] = parts[L] || []).push(pm); });
    o.geometry = subGeo(g, rest);
  });
  car.root.updateMatrixWorld(true);
  return parts;
}
function boxOf(list) { var b = new THREE.Box3(); list.forEach(function (o) { b.union(exactBox(o)); }); return b; }

/** The outside mirrors: the part map's MIRRORS, else a tuned box (its vertices, split left / right), else mirror-named meshes high up near the sides. */
function mirrors(car) {
  var s = car.rb.getSize(new THREE.Vector3()), mc = car.rb.getCenter(new THREE.Vector3()), sides = [new THREE.Box3(), new THREE.Box3()], meshes = [], t = car.tuned.MIRROR_COVERS || {};
  if (car.parts.MIRRORS) { car.parts.MIRRORS.forEach(function (m) { eachVert(m, function (v) { sides[v.x > mc.x ? 1 : 0].expandByPoint(v); }); }); return { sides: sides, meshes: car.parts.MIRRORS }; }
  if (t.box) { var tb = fracBox(car.rb, t.box); eachVert(car.root, function (v) { if (tb.containsPoint(v)) sides[v.x > mc.x ? 1 : 0].expandByPoint(v); }); }
  else car.root.traverse(function (m) { if (!m.isMesh || !MIRROR.test(m.name + " " + (m.material.name || ""))) return; var b = new THREE.Box3().setFromObject(m), bc = b.getCenter(new THREE.Vector3()), bs = b.getSize(new THREE.Vector3());
    if (bc.y > car.rb.min.y + 0.45 * s.y && Math.abs(bc.x - mc.x) > 0.3 * s.x && bs.z < 0.2 * s.z) { sides[bc.x > mc.x ? 1 : 0].union(b); meshes.push(m); } });
  return { sides: sides, meshes: meshes };
}
/** An add-on's stock part when the model has it as separate meshes (no tuned replace zone): rims, mirrors, a named spoiler / rails. */
function stockMeshes(car, type) {
  var k = KIT[type], s = car.rb.getSize(new THREE.Vector3()), out = [];
  if (k.stock === "rims") return car.wheels.found ? car.wheels.meshes.slice() : [];
  if (k.stock === "mirrors") return mirrors(car).meshes;
  car.root.traverse(function (o) {
    if (!o.isMesh || !k.named.test(o.name) || WHEEL.test(o.name)) return; var c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    if (k.stock === "rear" ? c.z < car.rb.min.z + 0.3 * s.z && c.y > car.rb.min.y + 0.5 * s.y : c.y > car.rb.min.y + 0.75 * s.y) out.push(o);
  });
  return out;
}
/** What an accessory hides while it is on: { hide: meshes, T: their box (fit target for body kits), box, how }, or null (nothing).
 *  Body kits: their fit zone. Add-ons: their replace zone, else separate stock meshes. A box cuts separate named meshes when they really
 *  hold the zone, else the painted shell (triangles split exactly at the box faces); small meshes lying entirely inside go with it.
 *  Once per car + type (the car is rebuilt when its zones change). */
function replaceZone(car, type) {
  if (type in car.zones) return car.zones[type];
  if (type === "RIMS") { // the stock rims and tyres measured per wheel (fitRims says which stock tyres stay); brakes stay
    var wp = wheelParts(car), rh = [], rT = new THREE.Box3();
    if (wp) rimPieces(car).sources.forEach(function (s) { rh.push(s.mesh); rT.expandByObject(s.mesh); });
    return (car.zones[type] = rh.length ? { hide: rh, T: rT, box: rT.clone(), how: car.parts.WHEELS ? "part map wheels" : "wheel analysis" } : null);
  }
  // a confirmed part map: hide exactly the car's own pieces of this kind (lip / diffuser only take the bumper's position, see buildAccessory)
  var pm = car.parts[PART_OF[type]];
  if (pm && type !== "FRONT_LIP" && type !== "REAR_DIFFUSER") {
    var ph = pm.slice(), pb = boxOf(pm); // rims: the whole wheel; fitRims says which stock tyres stay
    return (car.zones[type] = ph.length ? { hide: ph, T: pb, box: pb.clone(), how: "part map" } : null);
  }
  var k = KIT[type], t = k.replace ? car.tuned[type] || {} : (car.tuned[type] || {}).replace, hide = [], T = new THREE.Box3(), L = car.rb.getSize(new THREE.Vector3()).z, how;
  var all = []; car.root.traverse(function (o) { if (o.isMesh) all.push(o); });
  var whole = function (list, h) { list.forEach(function (o) { hide.push(o); T.expandByObject(o); }); return (car.zones[type] = hide.length ? { hide: hide, T: T, box: T.clone(), how: h } : null); };
  if (k.never) return (car.zones[type] = null);
  if (!k.replace && !t) return whole(stockMeshes(car, type), "stock meshes");
  if (!k.replace && !t.box) return whole(all.filter(function (o) { return t.meshes.indexOf(o.name) >= 0; }), "tuned meshes");
  var box = k.replace ? zoneBox(car, type) : fracBox(car.rb, t.box), rims = type === "RIMS";
  var named = t.meshes || !k.named ? [] : all.filter(function (o) {
    if (!k.named.test(o.name)) return false; var b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3());
    return sz.z < 0.3 * L && b.getCenter(new THREE.Vector3()).z > box.min.z - 0.05 * L && b.getCenter(new THREE.Vector3()).z < box.max.z + 0.05 * L;
  });
  // only a real separate part counts: the named meshes hold more of the zone than the painted body shell does (an E36 has fog lights
  // and a plate named 'bumper_...' while its bumper skin is part of the body mesh: that one must be cut)
  var inZone = function (list) { var n = 0; list.forEach(function (o) { eachVert(o, function (v) { if (box.containsPoint(v)) n++; }); }); return n; };
  var shell = car.paintMeshes.filter(function (o) { return named.indexOf(o) < 0; });
  if (named.length && inZone(named) > inZone(shell)) { how = "separate meshes"; named.forEach(function (o) { hide.push(o); T.expandByObject(o); }); }
  else {
    var cutList = t.meshes ? all.filter(function (o) { return t.meshes.indexOf(o.name) >= 0; }) : rims ? car.wheels.meshes : car.paintMeshes.length ? car.paintMeshes : all.filter(function (o) { return car.wheels.meshes.indexOf(o) < 0; });
    var z = splitZone(cutList, box); how = t.meshes ? "tuned zone" : t.box ? "tuned box" : "computed box";
    z.parts.forEach(function (p) { hide.push(p.zm); }); T.copy(z.box);
  }
  all.forEach(function (o) { if (hide.indexOf(o) < 0 && (rims || car.wheels.meshes.indexOf(o) < 0) && box.containsBox(new THREE.Box3().setFromObject(o))) hide.push(o); });
  if (T.isEmpty()) T.copy(box); else T.intersect(box);
  return (car.zones[type] = { hide: hide, T: T, box: box, how: how });
}
/** Body vertices in the box: the real outline of the bumper there (for lips / diffusers). */
function bodyIn(car, box) {
  var b = new THREE.Box3(); (car.paintMeshes.length ? car.paintMeshes : [car.root]).forEach(function (m) { eachVert(m, function (v) { if (box.containsPoint(v)) b.expandByPoint(v); }); });
  return b.isEmpty() ? box : b;
}
/** Orient a loose part: its longest horizontal axis along 'long' ("x" = across the car, "z" = along it; "axle" = thinnest axis across,
 *  for rims). For end parts the middle sticks out further than the ends, which tells front from back. Then the pivot is moved to the origin. */
function orientPart(src, long, end, pivotY) {
  var orient = new THREE.Group(); orient.add(src);
  var b = exactBox(orient), sz = b.getSize(new THREE.Vector3()), turned = 0, flipped = false;
  if (long === "axle") {
    if (sz.z < sz.x && sz.z < sz.y) { orient.rotation.y = Math.PI / 2; turned = 90; } else if (sz.y < sz.x && sz.y < sz.z) { orient.rotation.z = Math.PI / 2; turned = 90; }
  } else if ((long === "x" && sz.z > sz.x) || (long === "z" && sz.x > sz.z)) { orient.rotation.y = Math.PI / 2; turned = 90; }
  b = exactBox(orient); sz = b.getSize(new THREE.Vector3());
  if (end && long === "x") {
    var cx = (b.min.x + b.max.x) / 2, cS = 0, cN = 0, eS = 0, eN = 0;
    eachVert(orient, function (v) { var dx = Math.abs(v.x - cx) / sz.x; if (dx < 0.1) { cS += v.z; cN++; } else if (dx > 0.4) { eS += v.z; eN++; } });
    if (cN && eN && (cS / cN - eS / eN) * end < 0) { orient.rotation.y += Math.PI; flipped = true; b = exactBox(orient); }
  }
  var py = pivotY === "top" ? b.max.y : pivotY === "mid" ? (b.min.y + b.max.y) / 2 : b.min.y, pz = end > 0 ? b.max.z : end < 0 ? b.min.z : (b.min.z + b.max.z) / 2;
  orient.position.set(-(b.min.x + b.max.x) / 2, -py, -pz);
  var holder = new THREE.Group(); holder.add(orient);
  return { node: holder, size: sz, turned: turned, flipped: flipped };
}
var round3 = function (n) { return Math.round(n * 1000) / 1000; };
// ---- AUTO-FIT: every accessory placed from the car's real geometry by ONE function, fitAccessory(car, src, type, size, zone) ----
// Result (stored per accessory x generation by the server, replayed as kit.fit while its group's fit version matches):
//   { version, type, orient: [long, end, pivot], placements: [{ pos, sc, rot, side }], shadows: [{ x, y, z, w, d }], info }
// Wing / spoiler / roof rack: measure the mount surface (rear deck by body type, or the roof), the part's feet (its lowest 5 %, left /
// right), scale it to the mount, follow the slope, then ray-cast every foot point down and lower the part until the closest one touches;
// roll so both feet touch. Front lip / diffuser: under the bumper, rays UP until its top touches the bumper's bottom edge.
var GLASS = /glass|window|scheibe|vitre|windscreen/i;
var FOOT_SHADOW = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.6, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
var SHADOW_GEO = new THREE.PlaneGeometry(1, 1);
var RAY = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
var r4 = function (n) { return Math.round(n * 1e4) / 1e4; };
/** What a part can rest on: visible car meshes except glass, wheels and the stock part this accessory hides (ray casts ignore visibility). */
var RAY_MAT = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
/** Ray targets: double-sided stand-ins sharing the meshes' geometry (some files have single-sided panels with flipped normals, which a
 *  ray would pass straight through); the car's own materials are not touched. */
function contactMeshes(car, hide, glass) {
  var l = []; car.root.updateMatrixWorld(true);
  car.root.traverse(function (o) { if (o.isMesh && o.visible && hide.indexOf(o) < 0 && car.wheels.meshes.indexOf(o) < 0 && (glass || !GLASS.test(o.name + " " + (o.material.name || "")))) {
    var p = new THREE.Mesh(o.geometry, RAY_MAT); p.matrixAutoUpdate = false; p.matrixWorld.copy(o.matrixWorld); l.push(p); } });
  return l;
}
function hitY(meshes, x, z, fromY, up) { RAY.set(new THREE.Vector3(x, fromY, z), up ? UP : DOWN); var h = RAY.intersectObjects(meshes, false)[0]; return h ? h.point.y : null; }
/** The rear deck (FIT_RULES rearDeck) from the centreline seen from above, in world units (glass counts for the outline). */
function measureRear(car, meshes) {
  var rb = car.rb, s = rb.getSize(new THREE.Vector3()), cx = (rb.min.x + rb.max.x) / 2, prof = [];
  for (var i = 0; i <= 120; i++) { var z = rb.min.z + (i / 120) * s.z, y = topMed(meshes, cx, z, rb.max.y + 1); prof.push({ z: z, y: y === null ? null : y - rb.min.y }); }
  var d = rearDeck(prof, s.y, s.z); if (!d) return null;
  if (d.y !== null) d.y += rb.min.y; d.roofY += rb.min.y; return d;
}
/** The top at (x, z) as the median of three rays 15 cm apart across the car: a thin antenna / fin is not the body. */
function topMed(meshes, x, z, fromY) { var v = [-0.15, 0, 0.15].map(function (dx) { return hitY(meshes, x + dx, z, fromY); }).filter(function (y) { return y !== null; }).sort(function (p, q) { return p - q; });
  return v.length < 2 ? null : v[v.length === 3 ? 1 : 0]; }
function across(car, meshes, z) { var rb = car.rb, out = []; for (var i = 0; i <= 80; i++) { var x = rb.min.x + (i / 80) * (rb.max.x - rb.min.x); out.push({ x: x, y: topMed(meshes, x, z, rb.max.y + 1) }); } return out; }
/** The part's feet (its lowest 5 %; top 5 % when up) in its own space, left / right, with up to 48 points each for the contact rays. */
function partFeet(node, up) {
  var b = exactBox(node), h = b.max.y - b.min.y, cx = (b.min.x + b.max.x) / 2, sides = [{ box: new THREE.Box3(), all: [] }, { box: new THREE.Box3(), all: [] }];
  eachVert(node, function (v) { if (up ? v.y > b.max.y - 0.05 * h : v.y < b.min.y + 0.05 * h) { var sd = sides[v.x < cx ? 0 : 1]; sd.box.expandByPoint(v); sd.all.push(v.clone()); } });
  var two = sides.every(function (sd) { return sd.all.length; }) && sides[1].box.min.x - sides[0].box.max.x > 0.2 * (b.max.x - b.min.x);
  var feet = two ? sides : [{ box: sides[0].box.clone().union(sides[1].box), all: sides[0].all.concat(sides[1].all) }];
  feet.forEach(function (f) { var st = Math.max(1, Math.floor(f.all.length / 48)); f.pts = f.all.filter(function (_, i) { return i % st === 0; }); delete f.all; });
  return { feet: feet, box: b };
}
/** Gap (metres) from each foot to the surface below it (above it when up): the closest of its points; null = nothing under it. */
function contact(node, feet, meshes, up) {
  node.updateMatrixWorld(true);
  return feet.map(function (f) { var g = null; f.pts.forEach(function (q) { var w = q.clone().applyMatrix4(node.matrixWorld), y = hitY(meshes, w.x, w.z, up ? w.y - 0.5 : w.y + 0.05, up); // up: from well below (nothing under a car), so a top already inside the body counts as negative
    if (y !== null) { var d = up ? y - w.y : w.y - y; g = g === null ? d : Math.min(g, d); } }); return g; });
}
var minOf = function (a) { var v = a.filter(function (x) { return x !== null; }); return v.length ? Math.min.apply(null, v) : null; };
function fitOnTop(car, src, type, size, zone, info) {
  var rb = car.rb, s = rb.getSize(new THREE.Vector3()), cx = (rb.min.x + rb.max.x) / 2, meshes = contactMeshes(car, zone ? zone.hide : []);
  var o = orientPart(src(), "x", 0, "bottom"), node = o.node, f = partFeet(node, false), pb = f.box;
  var span = pb.max.x - pb.min.x, height = pb.max.y - pb.min.y, footD = Math.max.apply(null, f.feet.map(function (ft) { return ft.box.max.z - ft.box.min.z; }));
  var feetOuter = f.feet.length > 1 ? f.feet[1].box.max.x - f.feet[0].box.min.x : 0, deck = null, zM = null, tol = 0.1 * s.y, mapped = zone && zone.how === "part map" ? zone.T : null;
  if (type === "ROOF_RACK") { zM = mapped ? (mapped.min.z + mapped.max.z) / 2 : car.roofAt ? car.roofAt.z : null; tol = 0.04 * s.y; if (zM === null) throw new Error("no roof found on this car model"); }
  else {
    deck = measureRear(car, contactMeshes(car, zone ? zone.hide : [], true)); if (!deck) throw new Error("no rear deck found on this car model");
    info.body = deck.body; if (deck.body === "pickup") throw new Error("pickup: no rear wing / spoiler by default");
  }
  var u = 1, fs = null, bnd = null, row = null, yRef = null;
  for (var pass = 0; pass < 2; pass++) { // the foot depth depends on the scale, the mount width on where the feet go
    if (deck) zM = mountZ(deck, type, footD * u / 2);
    for (var nudge of [0, 0.05, -0.05, 0.1]) { // a hole in the mesh right there: step a few cm along the car
      row = across(car, meshes, zM + nudge); yRef = topMed(meshes, cx, zM + nudge, rb.max.y + 1);
      if (yRef !== null && (bnd = band(row, cx, yRef, tol))) { zM += nudge; break; }
    }
    if (!bnd) throw new Error("no mount surface found on this car model");
    fs = fitScale({ span: span, feetOuter: feetOuter, height: height, mountW: bnd.max - bnd.min, bodyW: bodyWidth(row, rb.min.y + 0.35 * s.y), realW: size.widthMm > 0 ? size.widthMm / 1000 : 0, maxH: FIT_MAX_H[type] });
    u = fs.u;
  }
  // slope along the car: the lid under a sedan wing's feet, else just ahead of the feet (behind them a roof / lid rounds off); at most 10 deg
  var za = deck && deck.body === "sedan" && type === "WING" ? zM - 0.08 : zM, zb = zM + 0.16;
  var y1 = topMed(meshes, cx, za, rb.max.y + 1), y2 = topMed(meshes, cx, zb, rb.max.y + 1), pitch = y1 !== null && y2 !== null ? clamp(Math.atan2(y2 - y1, zb - za), -0.17, 0.17) : 0;
  node.scale.setScalar(u); node.rotation.set(-pitch, 0, 0); node.position.set(0, 0, 0); node.updateMatrixWorld(true);
  var fc = new THREE.Vector3(); f.feet.forEach(function (ft) { fc.add(ft.box.getCenter(new THREE.Vector3())); }); fc.divideScalar(f.feet.length); fc.y = pb.min.y; fc.applyMatrix4(node.matrixWorld);
  node.position.set((bnd.min + bnd.max) / 2 - fc.x, yRef + 0.05 - fc.y, zM - fc.z); // feet 5 cm above the surface, then down until they touch
  var drop = function () { var m = minOf(contact(node, f.feet, meshes, false)); if (m === null) throw new Error("the part's feet are not over the car body"); node.position.y -= m; };
  drop();
  if (deck && deck.body === "sedan") { // a boot-lid wing never hangs out behind the car: slide it forward (feet stay on the front half of the lid)
    var back = rb.min.z - exactBox(node).min.z, room = deck.edgeZ + 0.5 * (deck.frontZ - deck.edgeZ) - zM;
    if (back > 0) { var sh = Math.min(back, Math.max(room, 0)); node.position.z += sh; zM += sh; node.position.y += 0.05; drop(); info.movedForwardM = round3(sh); }
  }
  if (f.feet.length > 1) { // roll (at most ~3.4 deg) so the second foot touches too
    var g = contact(node, f.feet, meshes, false), cL = f.feet[0].box.getCenter(new THREE.Vector3()).applyMatrix4(node.matrixWorld), cR = f.feet[1].box.getCenter(new THREE.Vector3()).applyMatrix4(node.matrixWorld);
    if (g[0] !== null && g[1] !== null && Math.abs(g[1] - g[0]) > 0.001) { node.rotation.z = clamp(-(g[1] - g[0]) / Math.max(cR.x - cL.x, 0.1), -0.06, 0.06); drop(); }
  }
  var gaps = contact(node, f.feet, meshes, false), top = exactBox(node).max.y, outline = contactMeshes(car, zone ? zone.hide : [], true);
  f.feet.forEach(function (ft) { // the feet must rest on the outside of the car, not on something under glass (a cabin shelf)
    var c = ft.box.getCenter(new THREE.Vector3()); c.y = ft.box.min.y; c.applyMatrix4(node.matrixWorld);
    var yo = hitY(outline, c.x, c.z, rb.max.y + 1); if (yo !== null && yo - c.y > 0.03) throw new Error("no solid mount surface here: the feet would sit under glass");
  });
  info.mount = { body: deck ? deck.body : "roof", fromRearM: round3(zM - rb.min.z), widthM: round3(bnd.max - bnd.min), bodyWidthM: round3(bodyWidth(row, rb.min.y + 0.35 * s.y)), scaleBy: fs.by };
  info.feet = f.feet.length; info.feetGapMm = gaps.map(function (x) { return x === null ? null : Math.round(x * 10000) / 10; });
  info.pitchDeg = round3(-node.rotation.x * 180 / Math.PI); info.rollDeg = round3(node.rotation.z * 180 / Math.PI);
  info.spanM = round3(span * u); info.heightAboveM = round3(top - yRef); info.overhangM = round3(Math.max(0, rb.min.z - exactBox(node).min.z)); // behind the car
  return { o: o, placements: [{ pos: node.position.toArray().map(r4), sc: node.scale.toArray().map(r4), rot: [r4(node.rotation.x), 0, r4(node.rotation.z)], side: 1 }],
    orient: ["x", 0, "bottom"], shadows: f.feet.map(function (ft) { var c = ft.box.getCenter(new THREE.Vector3()); return { x: r4(c.x), y: r4(ft.box.min.y), z: r4(c.z), w: r4(ft.box.max.x - ft.box.min.x), d: r4(ft.box.max.z - ft.box.min.z) }; }) };
}
function fitUnder(car, src, type, size, info) {
  var bump = car.parts[PART_OF[type]], T = bump ? boxOf(bump) : bodyIn(car, zoneBox(car, type)), end = KIT[type].end, meshes = contactMeshes(car, []);
  var o = orientPart(src(), "x", end, "top"), node = o.node, f = partFeet(node, true), u = (size.widthMm > 0 ? size.widthMm / 1000 : (T.max.x - T.min.x) * 0.96) / o.size.x;
  node.scale.setScalar(u); node.position.set((T.min.x + T.max.x) / 2, T.min.y - 0.05, end > 0 ? T.max.z : T.min.z);
  var m = minOf(contact(node, f.feet, meshes, true)); if (m === null) throw new Error("no bumper edge above the part");
  node.position.y += m; info.topGapMm = contact(node, f.feet, meshes, true).map(function (x) { return x === null ? null : Math.round(x * 10000) / 10; });
  return { o: o, placements: [{ pos: node.position.toArray().map(r4), sc: node.scale.toArray().map(r4), rot: [0, 0, 0], side: 1 }], orient: ["x", end, "top"], shadows: [] };
}
// ---- BUMPERS ("replace" fit): the new bumper takes exactly the place of the car's own bumper from its CONFIRMED part map ----
// Width matched by one uniform scale, at most +-5 % stretch in height / depth, top edge on the stock top edge, face on the stock face.
// Then the edge gaps: the stock bumper's seam (where it met fenders, lights, bonnet / boot line) against the new bumper, as you would see it.
var BUMPER_MAX_GAP_MM = 10, BUMPER_MAX_DEEPER_MM = 30;
var LIGHTISH = /light|lamp|lens|signal|indicator|fog|blinker|reflector/i;
function worldTris(node) { // every triangle of the placed part, world space
  node.updateMatrixWorld(true); var out = [];
  node.traverse(function (o) { if (!o.isMesh || o.userData.shadow) return; var g = o.geometry, p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count;
    var at = function (i) { return new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(i) : i).applyMatrix4(o.matrixWorld); };
    for (var i = 0; i + 2 < n; i += 3) out.push(new THREE.Triangle(at(i), at(i + 1), at(i + 2))); });
  return out;
}
/** Visible edge gaps (mm) per region between where the stock bumper met the car and the new bumper; p90 and max. */
function bumperGaps(car, zone, node) {
  var T = zone.T, ts = T.getSize(new THREE.Vector3()), cx = (T.min.x + T.max.x) / 2, near = T.clone().expandByScalar(0.06), C = 0.01, key = function (v) { return Math.round(v.x / C) + "," + Math.round(v.y / C) + "," + Math.round(v.z / C); };
  // the car around the hole: vertices of the visible meshes near the stock bumper, hashed on a 1 cm grid (with the mesh they belong to)
  var grid = new Map();
  car.root.traverse(function (o) { if (!o.isMesh || !o.visible || zone.hide.indexOf(o) >= 0 || car.wheels.meshes.indexOf(o) >= 0) return;
    eachVert(o, function (v) { if (near.containsPoint(v)) grid.set(key(v), o); }); });
  // seam = stock bumper vertices within ~2 cm of the car around it (its edge against fenders, lights, bonnet / boot line)
  var seam = [];
  zone.hide.forEach(function (h) { eachVert(h, function (v) {
    var x = Math.round(v.x / C), y = Math.round(v.y / C), z = Math.round(v.z / C), hit = null;
    for (var dx = -2; dx <= 2 && !hit; dx++) for (var dy = -2; dy <= 2 && !hit; dy++) for (var dz = -2; dz <= 2 && !hit; dz++) hit = grid.get((x + dx) + "," + (y + dy) + "," + (z + dz)) || null;
    if (hit) seam.push({ p: v.clone(), by: hit }); }); });
  var step = Math.max(1, Math.floor(seam.length / 500)); seam = seam.filter(function (_, i) { return i % step === 0; });
  // the VISIBLE gap: the new bumper's triangles flattened onto the plane you look at that edge from (front / rear view for the bonnet,
  // boot and light lines, side view for fenders and wheel arches), only within +-20 cm of the seam in depth; a covered seam point = 0 mm
  var tris = worldTris(node), G = 0.03, views = {}, cp = new THREE.Vector3(), regions = {}, worst = [];
  var view = function (ax) { // ax = the axis you look along; 2D grid of the flattened triangles (with their depth range)
    if (views[ax]) return views[ax];
    var u = ax === "z" ? "x" : "z", cells = new Map(), flat = tris.map(function (t) { var f = t.clone(); [f.a, f.b, f.c].forEach(function (v) { v[ax] = 0; }); return f; });
    tris.forEach(function (t, i) { var lo = Math.min(t.a[u], t.b[u], t.c[u]), hi = Math.max(t.a[u], t.b[u], t.c[u]), ylo = Math.min(t.a.y, t.b.y, t.c.y), yhi = Math.max(t.a.y, t.b.y, t.c.y);
      flat[i].d = [Math.min(t.a[ax], t.b[ax], t.c[ax]), Math.max(t.a[ax], t.b[ax], t.c[ax])];
      for (var a2 = Math.floor(lo / G); a2 <= Math.floor(hi / G); a2++) for (var c2 = Math.floor(ylo / G); c2 <= Math.floor(yhi / G); c2++) {
        var k = a2 + "," + c2, l = cells.get(k); if (!l) cells.set(k, l = []); if (l.length < 6000) l.push(i); } });
    return (views[ax] = { u: u, cells: cells, flat: flat });
  };
  seam.forEach(function (s) {
    var name = s.by.name + " " + (s.by.material.name || ""), region = LIGHTISH.test(name) ? "lights" : s.p.y > T.max.y - 0.25 * ts.y ? "bonnetBootLine" : Math.abs(s.p.x - cx) > 0.3 * ts.x ? "fendersArches" : "other";
    var ax = region === "fendersArches" ? "x" : "z", V = view(ax), q = s.p.clone(); q[ax] = 0;
    var gu = Math.floor(s.p[V.u] / G), gy = Math.floor(s.p.y / G), best = Infinity, seen = new Set();
    for (var a2 = -2; a2 <= 2; a2++) for (var c2 = -2; c2 <= 2; c2++) (V.cells.get((gu + a2) + "," + (gy + c2)) || []).forEach(function (i) {
      if (seen.has(i)) return; seen.add(i); var f = V.flat[i]; if (f.d[1] < s.p[ax] - 0.2 || f.d[0] > s.p[ax] + 0.2) return;
      f.closestPointToPoint(q, cp); best = Math.min(best, cp.distanceTo(q)); });
    var mmv = best === Infinity ? 60 : Math.min(best * 1000, 60); (regions[region] = regions[region] || []).push(mmv); // > 6 cm counts as 60 mm
    if (mmv > BUMPER_MAX_GAP_MM) worst.push({ region: region, mm: Math.round(mmv), at: s.p.toArray().map(round3), by: s.by.name });
  });
  var out = {}; Object.keys(regions).forEach(function (r) { var v = regions[r].sort(function (p, q) { return p - q; });
    out[r] = { n: v.length, p90: Math.round(v[Math.floor(0.9 * (v.length - 1))] * 10) / 10, max: Math.round(v[v.length - 1] * 10) / 10 }; });
  Object.defineProperty(out, "worst", { value: worst.sort(function (a, b) { return b.mm - a.mm; }).slice(0, 12) }); // for the evidence, not the stored fit
  return out;
}
function fitBumper(car, src, type, zone, info, force) {
  var front = type === "FRONT_BUMPER", end = KIT[type].end;
  if (!zone || zone.how !== "part map") throw new Error("no confirmed " + (front ? "front" : "rear") + " bumper in this car's part map: 3D preview not available for this car");
  var T = zone.T, ts = T.getSize(new THREE.Vector3()), o = orientPart(src(), "x", end, "top"), node = o.node;
  var u = ts.x / o.size.x, sy = clamp(ts.y / (o.size.y * u), 0.95, 1.05), sz = clamp(ts.z / (o.size.z * u), 0.95, 1.05);
  node.scale.set(u, u * sy, u * sz); node.position.set((T.min.x + T.max.x) / 2, T.max.y, end > 0 ? T.max.z : T.min.z);
  var B = exactBox(node), deeper = Math.max(0, front ? T.min.z - B.min.z : B.max.z - T.max.z) * 1000;
  info.zone = { how: zone.how, size: ts.toArray().map(round3), hidden: zone.hide.length };
  info.stretch = [1, round3(sy), round3(sz)]; info.deeperThanStockMm = Math.round(deeper);
  info.gapsMm = bumperGaps(car, zone, node); info.worstSeamPoints = info.gapsMm.worst;
  var bad = Object.keys(info.gapsMm).filter(function (r) { return info.gapsMm[r].n >= 5 && info.gapsMm[r].p90 > BUMPER_MAX_GAP_MM; });
  if (bad.length || deeper > BUMPER_MAX_DEEPER_MM) {
    var why = bad.map(function (r) { return r + " gap " + info.gapsMm[r].p90 + " mm"; }); if (deeper > BUMPER_MAX_DEEPER_MM) why.push("reaches " + Math.round(deeper) + " mm into the body");
    var msg = "this bumper does not fit this car cleanly (" + why.join(", ") + ")";
    if (force) info.wouldFail = msg; else { var e = new Error(msg); e.info = info; throw e; } // force: evidence renders only
  }
  return { o: o, placements: [{ pos: node.position.toArray().map(r4), sc: node.scale.toArray().map(r4), rot: [0, 0, 0], side: 1 }], orient: ["x", end, "top"], shadows: [] };
}
// ---- RIMS: one rim part used x4 ----
// wheelParts(car): per wheel (findWheels: confirmed part map WHEELS, else named wheel meshes, else round pieces standing on the ground)
// every car mesh lying wholly inside that wheel's cylinder, sorted into tyre (named, or a ring reaching the tread), brake (named, or
// sitting inboard of the spokes: never hidden) and rim (the rest). Measured: the tyre's outer radius, tread width / centre, outer face
// and the inner edge of its outer sidewall; the stock rim's radius and face. A wheel without a separate tyre is all "rim".
// fitRims: the stock rim hidden, the new rim (same diameter as the stock one, or scaled by the product's inches / the stock inches) placed
// on the axle with its face where the stock face was, facing outward (mirrored left / right). The stock tyre stays when it is its own
// piece and the rim size did not change; else a tyre is built in code (stock outer diameter and width) around the new rim.
// Wheel inset (Parts Admin, the car's RIMS zone wheelInsetMm {front, rear}): while rims are on, the whole wheel (rim + tyre) moves inward
// by that much per axle, for models whose stock wheels stand outside the fenders. A kept stock tyre is moved with it (only when its mesh
// is one wheel side / axle and uniquely named), else that car gets built tyres. Measured per wheel: the stock tyre face vs the fender
// (tyreToFenderMm, < 0 = outside), and the suggested inset per axle that puts the tyre face flush with the fender.
// Fit errors: less than 2 cm of sidewall left, or the rim face past the tyre face, or past the wheel arch further out than the stock wheel
// (some models already sit their stock wheels outside the arch: that clearance is reported, not refused).
var RIM_FINISH = { silver: [0xc9ccd0, 1, 0.32], black: [0x1c1d1f, 0.55, 0.42], gunmetal: [0x4a4e54, 0.9, 0.38], chrome: [0xf1f3f5, 1, 0.06] };
var TYRE_MAT = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.92, metalness: 0 });
/** A tyre along the x axis: a lathed rounded profile from the rim edge (ri) to the tread (ro), width w. */
function tyreGeometry(ri, ro, w) {
  var pts = [], k = Math.min(0.35 * (ro - ri), 0.3 * w), seg = 6, i, a;
  var arc = function (cx, cy, a0, a1) { for (i = 0; i <= seg; i++) { a = a0 + (a1 - a0) * i / seg; pts.push(new THREE.Vector2(cx + k * Math.cos(a), cy + k * Math.sin(a))); } };
  pts.push(new THREE.Vector2(ri, -w / 2 * 0.9));
  arc(ro - k, -w / 2 + k, -Math.PI / 2, 0); arc(ro - k, w / 2 - k, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(ri, w / 2 * 0.9));
  var g = new THREE.LatheGeometry(pts, 48); g.rotateZ(-Math.PI / 2); // lathe axis y -> x (the axle)
  return g;
}
// RIMS-only extraction. Original geometry, visibility and transforms are never edited.
// The temporary residuals preserve non-wheel triangles in shared meshes while rims are on.
function rimPieces(car) {
  if(car.rimPieces)return car.rimPieces;
  var root=car.root, mid=car.rb.getCenter(new THREE.Vector3()), sz=car.rb.getSize(new THREE.Vector3()), corners=[[],[],[],[]], sources=[];
  var confirmed=car.parts.WHEELS, proposal=car.rimProposal, ids=new Set(proposal?proposal.ids:[]), fallback=!confirmed&&!ids.size;
  var named=fallback?findWheels(root,car.rb).meshes:[], meshes=[]; root.updateMatrixWorld(true);
  root.traverse(function(m){if(m.isMesh&&m.visible)meshes.push(m);});
  meshes.forEach(function(m,mi){
    var mapped=confirmed&&confirmed.indexOf(m)>=0, proposed=!confirmed&&ids.size&&m.userData.pi!==undefined;
    if(!mapped&&!proposed&&named.indexOf(m)<0)return;
    var g=m.geometry, nt=(g.index?g.index.count:g.attributes.position.count)/3, seg=proposed?segment(m):null, buckets=[[],[],[],[]], rest=[], vs=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
    for(var t=0;t<nt;t++){
      var eligible=mapped || (proposed?ids.has("m"+m.userData.pi+"c"+seg.tri[t]):named.indexOf(m)>=0), center=new THREE.Vector3(), ti=[];
      for(var j=0;j<3;j++){var vi=triVert(g,t,j);ti.push(vi);vs[j].fromBufferAttribute(g.attributes.position,vi).applyMatrix4(m.matrixWorld);center.add(vs[j]);}center.multiplyScalar(1/3);
      if(center.y>car.rb.min.y+sz.y*0.6||Math.abs(center.x-mid.x)<sz.x*0.22)eligible=false;
      var corner=(center.x>mid.x?1:0)+(center.z>mid.z?2:0); (eligible?buckets[corner]:rest).push.apply(eligible?buckets[corner]:rest,ti);
    }
    if(!buckets.some(function(x){return x.length;}))return;
    var source={mesh:m,rest:rest,pieces:[]};sources.push(source);
    buckets.forEach(function(ix,i){if(!ix.length)return;
      var obj=new THREE.Mesh(subGeo(g,ix),m.material);obj.geometry.applyMatrix4(m.matrixWorld);obj.name="rimPiece_"+mi+"_"+i;
      var box=exactBox(obj), d=box.getSize(new THREE.Vector3());
      // A shell/bumper cannot become a wheel merely because its name contains 'rim'.
      if(d.y<0.08||d.y>1.15||d.z>1.25||d.x>0.85){source.rest.push.apply(source.rest,ix);obj.geometry.dispose();return;}
      var piece={obj:obj,source:source,indices:ix,id:obj.name,box:box};corners[i].push(piece);source.pieces.push(piece);
    });
  });
  return car.rimPieces={corners:corners,sources:sources,via:confirmed?"confirmed":ids.size?"proposal":"deterministic"};
}
function rimPoints(pieces) {
  var out=[], seen=new Set(); pieces.forEach(function(e){eachVert(e.obj,function(v){var k=Math.round(v.x*10000)+","+Math.round(v.y*10000)+","+Math.round(v.z*10000);if(!seen.has(k)){seen.add(k);out.push(v.toArray());}});});return out;
}
function wheelParts(car) {
  if(car.wheelParts)return car.wheelParts;
  var data=rimPieces(car);
  return car.wheelParts=data.corners.map(function(pieces,i){
    var side=i&1?1:-1, front=i&2?1:-1, q={wheel:(front>0?"F":"R")+(side>0?"R":"L"),side:side,front:front,pieces:pieces,warnings:[],tyre:[],rim:[],brake:[]};
    if(!pieces.length){q.refusal="NO_WHEEL_GEOMETRY";return q;}
    var rubber=pieces.filter(function(e){return TYRE.test(e.obj.material.name||"")||TYRE.test(e.source.mesh.name);});
    var pts=rimPoints(rubber.length?rubber:pieces), pca=rimPCA(pts);if(!pca){q.refusal="AXLE_UNRESOLVABLE";return q;}
    var axis=new THREE.Vector3().fromArray(pca.axis[0]);if(axis.x*side<0)axis.negate();
    var up=new THREE.Vector3(0,1,0).addScaledVector(axis,-axis.y).normalize(), tangent=new THREE.Vector3().crossVectors(axis,up).normalize();
    var ranges=[axis,up,tangent].map(function(v){var lo=Infinity,hi=-Infinity;pts.forEach(function(p){var d=v.x*p[0]+v.y*p[1]+v.z*p[2];lo=Math.min(lo,d);hi=Math.max(hi,d);});return [lo,hi];});
    var center=new THREE.Vector3();[axis,up,tangent].forEach(function(v,j){center.addScaledVector(v,(ranges[j][0]+ranges[j][1])/2);});
    var diam=(ranges[1][1]-ranges[1][0]+ranges[2][1]-ranges[2][0])/2, width=ranges[0][1]-ranges[0][0];
    var circular=Math.min(ranges[1][1]-ranges[1][0],ranges[2][1]-ranges[2][0])/Math.max(ranges[1][1]-ranges[1][0],ranges[2][1]-ranges[2][0]);
    var confidence=Math.min(1,Math.max(0,1-pca.values[0]/pca.values[1]))*circular;
    Object.assign(q,{center:center,axis:axis,up:up,tangent:tangent,ro:diam/2,tw:width,axleConfidence:confidence});
    if(confidence<0.5||circular<0.8||width<0.08||width>0.5||diam<0.3||diam>1.1||Math.abs(axis.y)>0.5){q.refusal="AXLE_UNRESOLVABLE";q.warnings.push("LOW_AXLE_CONFIDENCE");return q;}
    if(confidence<0.72)q.warnings.push("LOW_AXLE_CONFIDENCE");
    var measure=function(e){var lo=Infinity,hi=-Infinity,rmin=Infinity,rmax=0;eachVert(e.obj,function(v){var d=v.clone().sub(center),ax=d.dot(axis),r=Math.sqrt(Math.max(0,d.lengthSq()-ax*ax));lo=Math.min(lo,ax);hi=Math.max(hi,ax);rmin=Math.min(rmin,r);rmax=Math.max(rmax,r);});return {lo:lo,hi:hi,rmin:rmin,rmax:rmax};};
    pieces.forEach(function(e){e.measure=measure(e);var m=e.measure,n=e.source.mesh.name+" "+(e.obj.material.name||"");
      if(NOT_WHEEL.test(n)||/hub|susp|shaft/i.test(n))q.brake.push(e);
      else if(m.rmin>0.52*q.ro&&m.rmax>0.91*q.ro)q.tyre.push(e);else q.rim.push(e);
    });
    // A reliable tyre is a hollow outer ring, regardless of a misleading material name.
    var ring=q.tyre.length?q.tyre:pieces.filter(function(e){return q.brake.indexOf(e)<0;});
    var outer=-Infinity,inner=Infinity;ring.forEach(function(e){outer=Math.max(outer,e.measure.hi);inner=Math.min(inner,e.measure.lo);});
    q.outer=outer;q.inner=inner;q.tw=outer-inner;q.cAx=(outer+inner)/2;
    q.faceInner=q.tyre.length?Math.min.apply(null,q.tyre.map(function(e){return e.measure.rmin;})):q.ro*0.7;
    q.rimR=q.rim.length?Math.max.apply(null,q.rim.map(function(e){return e.measure.rmax;})):q.faceInner;
    q.rimR=Math.min(q.rimR,q.faceInner+0.012);q.rimFace=q.rim.length?Math.min(outer,Math.max.apply(null,q.rim.map(function(e){return e.measure.hi;}))):outer-0.01;
    q.rimWidth=q.rim.length?Math.max.apply(null,q.rim.map(function(e){return e.measure.hi;}))-Math.min.apply(null,q.rim.map(function(e){return e.measure.lo;})):null;
    return q;
  });
}
function rimBodyTargets(car) {
  if(car.rimBody)return car.rimBody;
  var result=[], excluded=new Set();Object.keys(car.parts).forEach(function(k){(car.parts[k]||[]).forEach(function(m){excluded.add(m);});});
  car.paintMeshes.forEach(function(m){var name=m.name+" "+(m.material.name||"");
    if(!m.visible||excluded.has(m)||NOT_BODY.test(name)||MIRROR.test(name)||/spoiler|wing|rack|accessory|ground|plane|wheel|tyre|tire/i.test(name))return;
    var b=exactBox(m),d=b.getSize(new THREE.Vector3());if(d.y<0.08||d.z<0.3)return;
    var proxy=new THREE.Mesh(m.geometry,RAY_MAT);proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(m.matrixWorld);result.push(proxy);
  });return car.rimBody=result;
}
function rimArch(car,q) {
  var targets=rimBodyTargets(car), samples=[];
  // Each sample follows the measured axle; samples span the upper arch, not global vehicle width.
  [45,60,75,90,105,120,135].forEach(function(deg){[1.06,1.14,1.23].forEach(function(rad){
    var a=deg*Math.PI/180, p=q.center.clone().addScaledVector(q.up,Math.sin(a)*q.ro*rad).addScaledVector(q.tangent,Math.cos(a)*q.ro*rad);
    RAY.set(p.clone().addScaledVector(q.axis,0.65),q.axis.clone().negate());RAY.far=1.2;
    var hits=RAY.intersectObjects(targets,false).filter(function(h){var ax=h.point.clone().sub(q.center).dot(q.axis);return Math.abs(ax-q.outer)<0.22&&h.point.y>q.center.y;});
    if(hits.length)samples.push(hits[0].point.clone().sub(q.center).dot(q.axis));
  });});RAY.far=Infinity;
  var estimate=rimArchEstimate(samples);estimate.samples=samples;return estimate;
}
function rimSafety(car,q,rad,width,face,shift) {
  // Brake/hub/suspension clearance in the wheel frame. Reject newly introduced overlap, never hide a separate brake.
  var bad=false, back=face-width+shift;
  car.root.traverse(function(m){if(!m.isMesh||!m.visible||bad)return;var n=m.name+" "+(m.material.name||"");if(!/brake|disc|caliper|hub|susp|strut|shaft|freio/i.test(n))return;
    eachVert(m,function(v){var d=v.clone().sub(q.center),ax=d.dot(q.axis),r=Math.sqrt(Math.max(0,d.lengthSq()-ax*ax));
      if(r<rad*0.85&&r>rad*0.2&&ax>back+0.003&&ax<face+shift-0.006&&ax<=face-width+0.003)bad=true;
      if(r>q.faceInner&&r<q.ro&&ax>q.inner+shift&&ax<q.outer+shift&&!(ax>q.inner&&ax<q.outer))bad=true;
    });
  });if(bad)return false;
  // Swept tyre surface rays catch new body/inner-arch crossings between stock and candidate.
  if(Math.abs(shift)>0.0001){var targets=rimBodyTargets(car), dir=q.axis.clone().multiplyScalar(Math.sign(shift));
    for(var i=0;i<24;i++){var a=i*Math.PI/12;for(var j=0;j<3;j++){
      var p=q.center.clone().addScaledVector(q.up,q.ro*Math.sin(a)).addScaledVector(q.tangent,q.ro*Math.cos(a)).addScaledVector(q.axis,q.inner+(q.outer-q.inner)*j/2);
      RAY.set(p,dir);RAY.far=Math.abs(shift)+0.001;if(RAY.intersectObjects(targets,false).length){RAY.far=Infinity;return false;}
    }}RAY.far=Infinity;
  }return true;
}
function fitRims(car,src,size,zone,info) {
  var P=wheelParts(car),o=orientPart(src(),"axle",0,"mid"),pb=exactBox(o.node),pw=pb.max.x-pb.min.x,pc=(pb.min.x+pb.max.x)/2,R=0,sx=0,n=0;
  eachVert(o.node,function(v){R=Math.max(R,Math.hypot(v.y,v.z));});
  eachVert(o.node,function(v){var r=Math.hypot(v.y,v.z);if(r>0.3*R&&r<0.75*R){sx+=v.x-pc;n++;}});var face=n&&sx/n<0?-1:1;
  var placements=[],tyres=[],per=[],active=[],kept=[],offsets=[], inset=(car.tuned.RIMS||{}).wheelInsetMm;
  P.forEach(function(q){
    var report={wheel:q.wheel,stockOuterGapMm:null,targetInsetMm:5,appliedAxleOffsetMm:0,finalOuterGapMm:null,axleConfidence:q.axleConfidence||0,archConfidence:0,tyreMode:"stock",warnings:q.warnings.slice(),refusal:q.refusal||null};per.push(report);if(q.refusal)return;
    var arch=rimArch(car,q),gap=arch.value===null?null:arch.value-q.outer,stockIn=(2*q.rimR-0.025)/0.0254, want=size.rimInches>0?size.rimInches:stockIn;
    var rad=want*0.0254/2+0.0125,u=rad/R,ux=Math.min(u,(q.tw-0.02)/pw),width=pw*ux,fa=Math.min(q.rimFace,q.outer-0.004),keep=q.tyre.length>0&&Math.abs(rad-q.rimR)<=0.006;
    Object.assign(report,{center:q.center.toArray(),axle:q.axis.toArray(),stockOuterGapMm:gap===null?null:round3(gap*1000),archConfidence:arch.confidence,archSamples:arch.samples.length,tyreOuterMm:round3(q.ro*2000),tyreWidthMm:round3(q.tw*1000),stockRimMm:round3(q.rimR*2000),stockRimWidthMm:q.rimWidth===null?null:round3(q.rimWidth*1000),stockRimInches:round3(stockIn),rimMm:round3(rad*2000),rimWidthMm:round3(width*1000),innerFaceMm:round3(q.inner*1000),outerFaceMm:round3(q.outer*1000),sidewallMm:round3((q.ro-rad)*1000),faceInsetMm:round3((q.outer-fa)*1000),gapToTyreMm:keep?round3((q.faceInner-rad)*1000):0,brakesKept:q.brake.length});
    if(rad>q.ro-0.02||width<=0||!Number.isFinite(u)){report.refusal="RIM_EXCEEDS_TYRE";return;}
    var override=inset?-(q.front>0?inset.front:inset.rear)/1000:undefined;
    var search=rimOffsetSearch(gap,function(d){if(arch.value!==null&&gap-d<0&&Math.abs(d)>1e-7)return false;return rimSafety(car,q,rad,width,fa,d);},override),d=search.offset;
    report.warnings.push.apply(report.warnings,search.warnings);report.appliedAxleOffsetMm=round3(d*1000);report.finalOuterGapMm=gap===null?null:round3((gap-d)*1000);
    report.tyreMode=keep?"retained":"generated";report.tyre=keep?"stock":"built (one-piece wheel or changed size)";if(!keep)report.warnings.push("FALLBACK_TYRE");
    var rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),q.axis),euler=new THREE.Euler().setFromQuaternion(rotation),pos=q.center.clone().addScaledVector(q.axis,fa-width/2+d-pc*ux*face);
    placements.push({wheel:q.wheel,pos:pos.toArray().map(r4),sc:[r4(ux*face),r4(u),r4(u)],rot:[euler.x,euler.y,euler.z],side:q.side});active.push(q.wheel);offsets.push({wheel:q.wheel,delta:q.axis.clone().multiplyScalar(d).toArray()});
    if(keep)q.tyre.forEach(function(e){kept.push(e.id);});
    else tyres.push({c:q.center.clone().addScaledVector(q.axis,q.cAx+d).toArray(),ri:rad-0.012,ro:q.ro,w:q.tw,rot:[euler.x,euler.y,euler.z],wheel:q.wheel});
  });
  info.wheels=per;info.faceSign=face;info.wheelSource=rimPieces(car).via;
  if(!placements.length){var err=new Error(per.map(function(w){return w.wheel+": "+w.refusal;}).join("; "));err.info=info;throw err;}
  return {o:o,placements:placements,orient:["axle",0,"mid"],shadows:[],tyres:tyres,keep:[],hideMore:[],shift:[],rimRuntime:{active:active,kept:kept,offsets:offsets}};
}
// Build an ON-only overlay from the stable extraction. Residual body and unsolved wheels remain exactly at stock transforms.
function rimRuntime(car,f,group) {
  var P=wheelParts(car),data=rimPieces(car),hidden=[],moving=[],selected=new Set(f.rimRuntime.active),kept=new Set(f.rimRuntime.kept);
  data.sources.forEach(function(source){var rest=source.rest.slice(), changed=false;
    source.pieces.forEach(function(e){var q=P.find(function(w){return w.pieces.indexOf(e)>=0;});
      if(!selected.has(q.wheel)||q.brake.indexOf(e)>=0){rest.push.apply(rest,e.indices);return;}changed=true;
      if(kept.has(e.id)){var clone=e.obj.clone();var offset=f.rimRuntime.offsets.find(function(x){return x.wheel===q.wheel;});clone.position.fromArray(offset.delta);clone.userData.shadow=true;group.add(clone);moving.push(clone);}
    });
    if(!changed)return;hidden.push(source.mesh);
    if(rest.length){var m=new THREE.Mesh(subGeo(source.mesh.geometry,rest),source.mesh.material);m.geometry.applyMatrix4(source.mesh.matrixWorld);m.userData.shadow=true;group.add(m);}
  });return {hide:hidden,moving:moving};
}
function fitAccessory(car, src, type, size, zone) {
  var k = KIT[type], s = car.rb.getSize(new THREE.Vector3()), W = s.x, info = { type: type, fitVersion: fitVersion(type) }, pl = [], o, u, T, r, orient;
  var mm = function (v) { return typeof v === "number" && v > 0 ? v / 1000 : 0; };
  var add = function (pos, sc, side) { pl.push({ pos: pos.toArray().map(r4), sc: sc.toArray().map(r4), rot: [0, 0, 0], side: side }); };
  var stretch = function (o, T, u, ax) { return clamp(T.getSize(new THREE.Vector3())[ax] / (o.size[ax] * u), 0.85, 1.15); };
  if (zone && !k.replace) info.replaces = { how: zone.how, hidden: zone.hide.length };
  if (type === "RIMS") r = fitRims(car, src, size, zone, info);
  else if (type === "FRONT_BUMPER" || type === "REAR_BUMPER") r = fitBumper(car, src, type, zone, info, size.forceFit === true);
  else if (type === "WING" || type === "SPOILER" || type === "ROOF_RACK") r = fitOnTop(car, src, type, size, zone, info);
  else if (type === "FRONT_LIP" || type === "REAR_DIFFUSER") r = fitUnder(car, src, type, size, info);
  if (r) { o = r.o; pl = r.placements; orient = r.orient; }
  else if (k.replace) {
    T = zone.T; var ts = T.getSize(new THREE.Vector3()), tc = T.getCenter(new THREE.Vector3());
    info.zone = { how: zone.how, size: ts.toArray().map(round3), hidden: zone.hide.length };
    if (type === "SIDE_SKIRTS") { // along the sill, between the wheels (the removed skirts' bounds)
      orient = ["z", 0, "bottom"]; o = orientPart(src(), "z", 0, "bottom"); u = ts.z / o.size.z;
      if (o.size.x > 0.5 * W) add(new THREE.Vector3(tc.x, T.min.y, tc.z), new THREE.Vector3(u * stretch(o, T, u, "x"), u * stretch(o, T, u, "y"), u), 1);
      else [-1, 1].forEach(function (side) { add(new THREE.Vector3(side > 0 ? T.max.x - o.size.x * u / 2 : T.min.x + o.size.x * u / 2, T.min.y, tc.z), new THREE.Vector3(u * side, u * stretch(o, T, u, "y"), u), side); });
    } else { // bumpers meet the hood / lights / boot lid at their TOP edge; the bottom (ground clearance, lip) differs per design
      orient = ["x", k.end, "top"]; o = orientPart(src(), "x", k.end, "top"); u = ts.x / o.size.x;
      add(new THREE.Vector3(tc.x, T.max.y, k.end > 0 ? T.max.z : T.min.z), new THREE.Vector3(u, u * stretch(o, T, u, "y"), u * stretch(o, T, u, "z")), 1);
    }
    if (mm(size.widthMm)) info.realWidthVsZone = round3(mm(size.widthMm) / (type === "SIDE_SKIRTS" ? ts.z : ts.x));
  } else if (type === "FENDER_FLARES") {
    orient = ["z", 0, "mid"]; o = orientPart(src(), "z", 0, "mid"); var w0 = car.wheels.list[0]; u = (mm(size.lengthMm) || w0.r * 2.5) / o.size.z;
    car.wheels.list.forEach(function (w) { add(new THREE.Vector3(w.outer + w.side * o.size.x * u * 0.3, w.center.y, w.center.z), new THREE.Vector3(u * w.side, u, u), w.side); });
  } else if (type === "MIRROR_COVERS") { // the outside mirror housings (part map, tuned box or mirror-named meshes), one per side
    var sides = mirrors(car).sides; if (sides.some(function (b) { return b.isEmpty(); })) throw new Error("no mirrors found on this car model (tune a MIRROR_COVERS box)");
    orient = ["x", 0, "mid"]; o = orientPart(src(), "x", 0, "mid");
    sides.forEach(function (b, i) { var side = i ? 1 : -1, uu = (mm(size.widthMm) || b.getSize(new THREE.Vector3()).x) / o.size.x; add(b.getCenter(new THREE.Vector3()), new THREE.Vector3(uu * side, uu, uu), side); });
  } else throw new Error("unknown accessory " + type);
  info.copies = pl.length; info.turnedDeg = o.turned; info.flipped180 = o.flipped; info.partSize = o.size.toArray().map(round3); info.scale = round3(Math.abs(pl[0].sc[0]));
  info.nonUniform = [round3(pl[0].sc[1] / Math.abs(pl[0].sc[0])), round3(pl[0].sc[2] / Math.abs(pl[0].sc[0]))];
  return { version: fitVersion(type), type: type, orient: orient, placements: pl, shadows: r ? r.shadows : [], tyres: r && r.tyres || [], keep: r && r.keep || [], hideMore: r && r.hideMore || [], shift: r && r.shift || [], ...(r && r.rimRuntime ? {rimRuntime:r.rimRuntime} : {}), info: info };
}
function validFit(f, type) {
  return !!f && f.version === fitVersion(type) && f.type === type && Array.isArray(f.orient) && f.orient.length === 3 && Array.isArray(f.placements) && f.placements.length > 0 && f.placements.length <= 4
    && f.placements.every(function (p) { return [p.pos, p.sc, p.rot].every(function (a) { return Array.isArray(a) && a.length === 3 && a.every(function (n) { return typeof n === "number" && isFinite(n) && Math.abs(n) < 50; }); }) && (p.side === 1 || p.side === -1); })
    && (!f.tyres || (Array.isArray(f.tyres) && f.tyres.length <= 4)) && (!f.keep || (Array.isArray(f.keep) && f.keep.length <= 40)) && (!f.hideMore || (Array.isArray(f.hideMore) && f.hideMore.length <= 60 && f.hideMore.every(function (n) { return typeof n === "string"; })))
    && (!f.shift || (Array.isArray(f.shift) && f.shift.length <= 40 && f.shift.every(function (x) { return Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number" && Math.abs(x[1]) <= 0.05; })));
}
/** Build the fitted accessory: the stored fit for this accessory x car (kit.fit) when it is current, else fitAccessory now. */
async function buildAccessory(car, kit) {
  var type = kit.type, gl = await parse(kit.file), src = function () { return gl.scene.clone(true); };
  var zone = replaceZone(car, type); // before the fit: a hidden stock spoiler / rail is not a mount surface
  var stored = validFit(kit.fit, type), f = stored ? kit.fit : fitAccessory(car, src, type, kit.size || {}, zone);
  var group = new THREE.Group(); group.name = "accessory_" + type;
  var place = f.placements.map(function (p) {
    var o = orientPart(src(), f.orient[0], f.orient[1], f.orient[2]);
    (f.shadows || []).forEach(function (sh) { // a soft contact shadow under each foot, so the part looks bolted on
      var m = new THREE.Mesh(SHADOW_GEO, FOOT_SHADOW); m.userData.shadow = true; m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
      m.position.set(sh.x, sh.y + 0.002 / Math.abs(p.sc[1]), sh.z); m.scale.set(sh.w * 1.8, sh.d * 1.8, 1); o.node.add(m); });
    group.add(o.node); return { o: o, side: p.side, base: p };
  });
  (f.tyres || []).forEach(function (ty) { var m = new THREE.Mesh(tyreGeometry(ty.ri, ty.ro, ty.w), TYRE_MAT); m.position.fromArray(ty.c); if(ty.rot)m.rotation.fromArray(ty.rot); m.userData.shadow = true; group.add(m); }); // built tyres (not painted / finished)
  if (zone && f.keep && f.keep.length) zone = Object.assign({}, zone, { hide: zone.hide.filter(function (o) { return f.keep.indexOf(o.name) < 0; }) }); // the stock tyres stay
  if (zone && f.hideMore && f.hideMore.length) { var more = []; car.root.traverse(function (o) { if (o.isMesh && f.hideMore.indexOf(o.name) >= 0 && zone.hide.indexOf(o) < 0) more.push(o); }); zone = Object.assign({}, zone, { hide: zone.hide.concat(more) }); } // rims: pieces that would clash with the new spokes
  var shifts = []; (f.shift || []).forEach(function (x) { car.root.traverse(function (o) { if (!o.isMesh || o.name !== x[0]) return;
    var p0 = o.getWorldPosition(new THREE.Vector3()), a = o.parent.worldToLocal(p0.clone()), b = o.parent.worldToLocal(p0.clone().add(new THREE.Vector3(x[1], 0, 0)));
    shifts.push({ o: o, orig: o.position.clone(), d: b.sub(a) }); }); });
  if(type === "RIMS" && f.rimRuntime) { var rr=rimRuntime(car,f,group); zone={hide:rr.hide,T:car.rb.clone(),box:car.rb.clone(),how:"runtime wheels"}; }
  var mats = [], tally = new Map(); group.traverse(function (m) { if (m.isMesh && !m.userData.shadow) { mats.push({ o: m, orig: m.material }); tally.set(m.material.uuid, (tally.get(m.material.uuid) || 0) + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count)); } });
  var mainId = null; tally.forEach(function (n, id) { if (!mainId || n > tally.get(mainId)) mainId = id; });
  mats.forEach(function (e) { e.main = e.orig.uuid === mainId; });
  var info = Object.assign({}, f.info, { stored: stored });
  return { key: kit.type + "|" + kit.file, group: group, place: place, zone: zone, mats: mats, paint: null, info: info, fit: f, shifts: shifts };
}

// ---- build (once per model file) ----
async function build(s) {
  var m = s.model, gltf = await parse(s.file);
  var root = gltf.scene.clone(true), pi = 0;
  root.traverse(function (o) { if (o.isMesh) { o.userData.pi = pi++; o.userData.mat = o.material.name || ""; } }); // piece ids: before keepBox drops anything
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
  var paint = [], body = [], paintMeshes = [];
  // no paintNodes = the whole car (the paint materials alone pick the body)
  (m.paintNodes.length ? m.paintNodes.map(function (n) { return root.getObjectByName(n); }) : [root]).forEach(function (node) {
    if (!node) return;
    node.traverse(function (o) {
      if (!o.isMesh) return;
      body.push(o);
      if (m.paintMaterials.indexOf(o.material.name) < 0) return;
      var src = o.material;
      o.material = new THREE.MeshPhysicalMaterial({ name: src.name + " (paint)", color: s.color, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, normalMap: src.normalMap || null, side: src.side });
      paint.push(o.material); paintMeshes.push(o);
    });
  });

  // accessory anchors, on the painted body
  var bodyBox = new THREE.Box3(); body.forEach(function (o) { bodyBox.expandByObject(o); });
  if (bodyBox.isEmpty()) bodyBox.setFromObject(root);
  var bs = bodyBox.getSize(new THREE.Vector3()), L = bs.z, W = bs.x, top = bodyBox.max.y, targets = body.length ? body : [root];
  var zr = bodyBox.min.z + 0.1 * L, yr = surfaceY(targets, zr, top);
  var ys = [];
  for (var i = 0; i <= 40; i++) { var z = bodyBox.min.z + (i / 40) * L; ys.push({ z: z, y: surfaceY(targets, z, top) }); }
  var roof = Math.max.apply(null, ys.map(function (p) { return p.y === null ? -1e9 : p.y; }));
  // real roofs curve: the rack sits on the highest point
  var peak = ys.reduce(function (a, p) { return p.y !== null && p.y > a.y ? p : a; }, { y: -1e9, z: 0 }), hasRoof = peak.y > -1e9;

  // accessory anchors: the car's box, wheels, wing (10 % in from the rear) / lip spoiler (3 %) / roof peak
  // confirmed part map (not in the Parts Admin editor, which shows the whole car in pieces)
  var parts = !s.partEdit && m.partMap ? applyPartMap({ root: root }, m.partMap) : {};
  var rb = new THREE.Box3().setFromObject(root), wheels = parts.WHEELS ? findWheels(root, rb, parts.WHEELS) : findWheels(root, rb), wingAt = null, spoilerAt = null, roofAt = null;
  if (parts.WHEELS && !wheels.found) wheels = findWheels(root, rb);
  if (yr !== null) wingAt = new THREE.Vector3(0, yr, zr);
  var zs = bodyBox.min.z + 0.03 * L, ysp = surfaceY(targets, zs, top); if (ysp !== null) spoilerAt = new THREE.Vector3(0, ysp, zs);
  if (hasRoof) roofAt = new THREE.Vector3(0, roof, peak.z);

  var all = new THREE.Box3().setFromObject(root), as = all.getSize(new THREE.Vector3());
  shadow.scale.set(as.x * 1.35, as.z * 1.2, 1);

  // camera: fit the bounding sphere into the narrower field of view (a rebuild of the same file keeps the viewer's camera)
  var keepView = car && car.file === s.file, r = as.length() / 2, vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  var d = (r / Math.sin(Math.min(vf, hf) / 2)) * 0.92;
  home.target.set(0, as.y * 0.4, 0);
  home.pos.copy(new THREE.Vector3(-0.62, 0.32, 0.78).normalize().multiplyScalar(d)).add(home.target);
  if (!keepView) { camera.position.copy(home.pos); controls.target.copy(home.target); }
  controls.minDistance = d * 0.45; controls.maxDistance = d * 1.8;
  camera.near = d / 50; camera.far = d * 10; camera.updateProjectionMatrix();

  if (car) scene.remove(car.group);
  scene.add(group);
  return { file: s.file, zkey: carKey(s), rimProposal: m.rimProposal || null, parts: parts, edit: null, group: group, root: root, paint: paint, paintMeshes: paintMeshes, tint: tint, rb: rb, wheels: wheels, wingAt: wingAt, spoilerAt: spoilerAt, roofAt: roofAt, tuned: m.zones || {}, zones: {}, acc: null, accs: {}, accP: {}, accFail: {}, prev: null };
}

function addAdj(a, b) { var ok = function (v) { return typeof v === "number" && isFinite(v); };
  if (!b || typeof b !== "object") return a; return { x: a.x + (ok(b.x) ? b.x : 0), y: a.y + (ok(b.y) ? b.y : 0), z: a.z + (ok(b.z) ? b.z : 0), rx: a.rx + (ok(b.rx) ? b.rx : 0), ry: a.ry + (ok(b.ry) ? b.ry : 0), s: a.s * (ok(b.s) && b.s > 0 ? b.s : 1) }; }
// The accessories of state.kits (state.kit = one; a body kit = its front + rear bumper, each switched on / off on its own): each built on
// first use, the stock part it replaces hidden while it is on (back when off), the auto-fit then the Parts Admin's correction (baseAdj)
// then the customer's Adjust (adj; x / ry mirrored for left-side copies); "paint to match" = the car's own paint material.
function kitList(s) {
  var l = Array.isArray(s.kits) ? s.kits.slice(0, 4) : s.kit ? [s.kit] : [];
  return l.filter(function (k) { return k && typeof k.type === "string" && KIT[k.type] && typeof k.file === "string"; });
}
function kitApply(s) {
  var ks = kitList(s), want = {}; ks.forEach(function (k) { want[k.type + "|" + k.file] = k; });
  Object.keys(car.accs).forEach(function (key) { if (want[key]) return; var a = car.accs[key];
    car.group.remove(a.group); if (a.zone) a.zone.hide.forEach(function (o) { o.visible = true; }); (a.shifts || []).forEach(function (x) { x.o.position.copy(x.orig); }); delete car.accs[key]; if (car.acc === a) car.acc = null; });
  ks.forEach(function (k) {
    var key = k.type + "|" + k.file, a = car.accs[key];
    if (!a) {
      if (!assets[k.file]) { post({ type: "need", keys: [k.file] }); return; }
      if (car.accP[key] || car.accFail[key]) return; // a part that could not be fitted on this car is not tried again
      var c = car; c.accP[key] = true;
      buildAccessory(c, k).then(function (b) { if (c !== car || !c.accP[key]) return; delete c.accP[key]; c.accs[key] = b; c.acc = c.acc || b; c.group.add(b.group); post({ type: "fit", kitType: k.type, info: b.info, fit: b.info.stored ? null : b.fit }); kitApply(state); },
        function (e) { delete c.accP[key]; c.accFail[key] = true; post({ type: "fitError", kitType: k.type, message: String(e && e.message || e), info: e && e.info || null }); });
      return;
    }
    if (a.zone) a.zone.hide.forEach(function (o) { o.visible = false; });
    (a.shifts || []).forEach(function (x) { x.o.position.copy(x.orig).add(x.d); }); // rims: the wheel inset moves the kept stock tyres
    var j = addAdj(addAdj({ x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1 }, k.baseAdj), k.adj);
    a.place.forEach(function (p) { var n = p.o.node, b = p.base; n.position.set(b.pos[0] + j.x * p.side, b.pos[1] + j.y, b.pos[2] + j.z); n.rotation.set(b.rot[0] + j.rx, b.rot[1] + j.ry * p.side, b.rot[2]); n.scale.fromArray(b.sc).multiplyScalar(j.s); });
    if (k.type === "RIMS") { // rims: the shop's finish on the main material, never the car's paint
      var fin = RIM_FINISH[String(k.finish || "silver").toLowerCase()]; // the shop's finish; silver when the shop gave none
      if (fin && !a.finish) a.finish = new THREE.MeshStandardMaterial({ color: fin[0], metalness: fin[1], roughness: fin[2], side: THREE.DoubleSide });
      a.mats.forEach(function (e) { e.o.material = e.main && fin ? a.finish : e.orig; });
    } else if (k.paintMatch) {
      // the car's OWN paint material (same metalness / roughness / clearcoat), without its normal map (other UVs); one recipe for cars without one
      if (!a.paint) { a.paint = car.paint.length ? car.paint[0].clone() : new THREE.MeshPhysicalMaterial({ metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }); a.paint.normalMap = null; a.paint.side = THREE.DoubleSide; a.paint.needsUpdate = true; }
      a.paint.color.set(s.color);
      a.mats.forEach(function (e) { e.o.material = e.main ? a.paint : e.orig; });
    } else a.mats.forEach(function (e) { e.o.material = e.orig; });
  });
}
// ---- zone preview (Parts Admin): red = the car's own part that will be hidden, green = where the accessory goes ----
var RED = new THREE.MeshBasicMaterial({ color: 0xe53935, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
var GREEN = new THREE.MeshBasicMaterial({ color: 0x2e9d4f, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
/** Where an accessory of this type is fitted (the same rules as buildAccessory, without a part). */
function fitBoxes(car, type) {
  var t = car.tuned[type] || {}, s = car.rb.getSize(new THREE.Vector3()), V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
  if (type === "RIMS" || type === "FENDER_FLARES") return car.wheels.list.map(function (w) { var r = type === "RIMS" ? w.rimR : w.r * 1.25; return new THREE.Box3().setFromCenterAndSize(V(w.outer - w.side * 0.06, w.center.y, w.center.z), V(0.12, 2 * r, 2 * r)); });
  if (type === "MIRROR_COVERS") return mirrors(car).sides.filter(function (b) { return !b.isEmpty(); });
  if (t.box) return [fracBox(car.rb, t.box)];
  var z = zoneBox(car, type); if (z) return [z];
  var a = type === "ROOF_RACK" ? car.roofAt : type === "WING" ? car.wingAt : car.spoilerAt;
  return a ? [new THREE.Box3(V(a.x - s.x * 0.42, a.y, a.z - 0.15), V(a.x + s.x * 0.42, a.y + 0.14, a.z + 0.15))] : [];
}
function previewApply(s) {
  var type = typeof s.zonePreview === "string" && KIT[s.zonePreview] ? s.zonePreview : null;
  if (car.prev && car.prev.type === type) return;
  if (car.prev) { car.prev.mats.forEach(function (e) { e.o.material = e.m; }); car.group.remove(car.prev.g); car.prev = null; }
  if (!type) return;
  var g = new THREE.Group(), mats = [], z = null, note = null;
  try { z = replaceZone(car, type); } catch (e) { note = String(e && e.message || e); }
  if (z) z.hide.forEach(function (o) { mats.push({ o: o, m: o.material }); o.material = RED; o.visible = true; });
  try { fitBoxes(car, type).forEach(function (b) { var c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), m = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), GREEN);
    m.position.copy(c); m.renderOrder = 2; g.add(m); g.add(new THREE.Box3Helper(b, 0x2e9d4f)); }); } catch (e) { note = note || String(e && e.message || e); }
  car.group.add(g); car.prev = { type: type, g: g, mats: mats };
  post({ type: "zone", info: { type: type, hidden: z ? z.hide.length : 0, how: z ? z.how : null, note: note } });
}
// ---- PART MAP EDITOR (Parts Admin, state.partEdit = { label, labels: { LABEL: [ids] } }): every piece coloured by its label (the chosen
// label bright, others dimmed, unlabelled grey); a tap posts { type: "pick", id }. On entry: { type: "pieces", count }.
var PART_COLORS = { FRONT_BUMPER: 0x1e88e5, REAR_BUMPER: 0x8e24aa, SPOILER: 0xe53935, SIDE_SKIRTS: 0xfb8c00, MIRRORS: 0x00acc1, WHEELS: 0x43a047, ROOF_RAILS: 0xc0a000 };
var EDIT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
function carKey(s) { return JSON.stringify([s.model.zones || {}, s.partEdit ? "edit" : s.model.partMap || null, s.model.rimProposal || null]); }
function editApply(s) {
  var pe = s.partEdit;
  if (!car.edit) {
    var meshes = carMeshes(car), n = 0; meshes.forEach(function (o) { n += segment(o).tris.length; }); // ids from the loaded geometry
    meshes.forEach(function (o) { o.geometry = o.geometry.clone(); o.geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 3), 3)); o.material = EDIT_MAT; });
    car.edit = { meshes: meshes, key: null };
    post({ type: "pieces", count: n });
  }
  var k = JSON.stringify(pe); if (car.edit.key === k) return; car.edit.key = k;
  var of = {}, grey = new THREE.Color(0xb7bbc0), c = new THREE.Color();
  Object.keys(pe.labels || {}).forEach(function (L) { (pe.labels[L] || []).forEach(function (id) { of[id] = L; }); });
  car.edit.meshes.forEach(function (o) {
    var seg = segment(o), g = o.geometry, col = g.attributes.color;
    for (var t = 0; t < seg.tri.length; t++) {
      var L = of["m" + o.userData.pi + "c" + seg.tri[t]];
      if (!L) c.copy(grey); else { c.setHex(PART_COLORS[L] || 0x666666); if (L !== pe.label) c.lerp(grey, 0.45); }
      for (var j = 0; j < 3; j++) col.setXYZ(triVert(g, t, j), c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  });
}
function pickPiece(e) {
  var r = renderer.domElement.getBoundingClientRect(), rc = new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  var hit = rc.intersectObjects(car.edit.meshes, false).filter(function (h) { return h.object.visible; })[0];
  if (hit) post({ type: "pick", id: "m" + hit.object.userData.pi + "c" + segment(hit.object).tri[hit.faceIndex] });
}
var building = null;
async function apply() {
  var s = state; if (!s) return;
  scene.background = new THREE.Color(s.bg);
  controls.enabled = !!s.interactive;
  controls.autoRotate = !s.reduced && !!s.autoRotate;
  if (!car || car.file !== s.file || car.zkey !== carKey(s)) {
    if (!assets[s.file]) { post({ type: "need", keys: [s.file] }); return; }
    if (building) return;
    try { building = build(s); car = await building; } catch (e) { post({ type: "error", message: String(e && e.message || e) }); return; } finally { building = null; }
    s = state;
  }
  car.paint.forEach(function (p) { p.color.set(s.color); });
  if (car.tint) car.tint.value.set(s.color);
  if (s.partEdit) editApply(s); else { kitApply(s); previewApply(s); }
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
  if (state.partEdit && car && car.edit) { pickPiece(e); return; } // editor: a tap selects a piece (no double-tap reset)
  var now = Date.now(); if (now - lastTap < 320) { reset(); lastTap = 0; } else lastTap = now;
});
window.addEventListener("resize", function () { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
renderer.setAnimationLoop(function () { if (document.hidden) return; controls.update(); renderer.render(scene, camera); });
window.__dbg = { THREE: THREE, scene: scene, camera: camera, controls: controls, home: home, handle: handle, state: function () { return state; }, car: function () { return car; } };
post({ type: "ready" });
</script>
</body></html>`;
