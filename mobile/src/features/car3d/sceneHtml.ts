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
var RIM_TARGET = 0.005, RIM_MAX_MOVE = 0.04; // the tyre face 5 mm inside the arch line (3-8 mm accepted), the whole wheel moved at most 40 mm
/** The whole-wheel move along its own axle (+ = out). gap = arch line - stock tyre face (+ = the tyre is inside). Target RIM_TARGET inside,
 *  clamped to 40 mm, then the largest move between that and stock that safe(move) allows; override (Parts Admin, metres) replaces the target. */
function rimOffsetSearch(gap, safe, override) {
  var warnings = [], desired;
  if (typeof override === "number") { desired = override; warnings.push("ADMIN_OVERRIDE"); }
  else if (gap === null) return { offset: 0, warnings: ["ARCH_NOT_MEASURED"] };
  else desired = gap - RIM_TARGET;
  var d = Math.max(-RIM_MAX_MOVE, Math.min(RIM_MAX_MOVE, desired)); if (Math.abs(desired - d) > 1e-6) warnings.push("MOVE_CLAMPED_40MM");
  if (Math.abs(d) < 0.0005) return { offset: 0, warnings: warnings };
  for (var i = 0; i < 20; i++) { var x = d * (1 - i / 20); if (safe(x)) { if (i) warnings.push("LIMITED_BY_CLEARANCE"); return { offset: x, warnings: warnings }; } }
  warnings.push("KEPT_STOCK_POSITION"); return { offset: 0, warnings: warnings };
}
/** The axle refined from a first guess: the direction across which the wheel is narrowest (a tyre is a short cylinder). PCA alone tilts with
 *  uneven vertex density (tread detail on one side); the narrowest width does not. Pattern search on yaw / pitch, 4 deg down to 0.05 deg. */
function rimNarrowestAxis(points, axis) {
  var step = Math.max(1, Math.floor(points.length / 20000)), P = []; for (var i = 0; i < points.length; i += step) P.push(points[i]);
  var dir = function (yaw, pitch) { return [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)]; };
  var width = function (v) { var lo = Infinity, hi = -Infinity; for (var j = 0; j < P.length; j++) { var d = v[0] * P[j][0] + v[1] * P[j][1] + v[2] * P[j][2]; if (d < lo) lo = d; if (d > hi) hi = d; } return hi - lo; };
  var s0 = axis[0] < 0 ? -1 : 1, a = [axis[0] * s0, axis[1] * s0, axis[2] * s0], yaw = Math.atan2(a[2], a[0]), pitch = Math.asin(Math.max(-1, Math.min(1, a[1]))), best = width(dir(yaw, pitch));
  for (var st = 4 * Math.PI / 180; st > 0.05 * Math.PI / 180; st /= 2) { var moved = true;
    while (moved) { moved = false; [[st, 0], [-st, 0], [0, st], [0, -st]].forEach(function (m) { var w = width(dir(yaw + m[0], pitch + m[1])); if (w < best - 1e-9) { best = w; yaw += m[0]; pitch += m[1]; moved = true; } }); } }
  var r = dir(yaw, pitch); return [r[0] * s0, r[1] * s0, r[2] * s0];
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
var FIT_VERSIONS = {"rims": 8, "wings": 4, "bumpers": 6, "other": 4};
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
  var reverse = long === "x-reverse"; if (reverse) long = "x";
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
  if (reverse) { orient.rotation.y += Math.PI; flipped = !flipped; b = exactBox(orient); }
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
// The bonnet / boot line: the car's own panel overlaps the bumper's top edge there, so a seam point can sit 2 cm from the part's projected edge
// with nothing visible behind (E36 front bumper: p90 16.6, max 21.8 mm, checked in close-ups). Every other region keeps 10 mm.
// ponytail: fixed 25 mm for this region; per-car seam rules if a car shows a real slot under the panel.
function seamLimit(region) { return region === "bonnetBootLine" ? 25 : BUMPER_MAX_GAP_MM; }
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
  var tris = worldTris(node), G = 0.03, views = {}, cp = new THREE.Vector3(), edgeLine = new THREE.Line3(), regions = {}, worst = [];
  var view = function (ax) { // ax = the axis you look along; 2D grid of the flattened triangles (with their depth range)
    if (views[ax]) return views[ax];
    var u = ax === "z" ? "x" : "z", cells = new Map(), flat = tris.map(function (t) { var f = t.clone(); [f.a, f.b, f.c].forEach(function (v) { v[ax] = 0; }); f.line = f.getArea() < 1e-12; return f; });
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
      // A triangle viewed edge-on becomes a line. Triangle.closestPointToPoint can return NaN for it; measure the projected edges explicitly.
      if (f.line) { [[f.a,f.b],[f.b,f.c],[f.c,f.a]].forEach(function (e) { edgeLine.set(e[0],e[1]).closestPointToPoint(q,true,cp); var d=cp.distanceTo(q); if(isFinite(d))best=Math.min(best,d); }); }
      else { f.closestPointToPoint(q, cp); var d=cp.distanceTo(q); if(isFinite(d))best=Math.min(best,d); } });
    var mmv = best === Infinity ? 60 : Math.min(best * 1000, 60); (regions[region] = regions[region] || []).push(mmv); // > 6 cm counts as 60 mm
    if (mmv > seamLimit(region)) worst.push({ region: region, mm: Math.round(mmv), at: s.p.toArray().map(round3), by: s.by.name });
  });
  var out = {}; Object.keys(regions).forEach(function (r) { var v = regions[r].sort(function (p, q) { return p - q; });
    out[r] = { n: v.length, p90: Math.round(v[Math.floor(0.9 * (v.length - 1))] * 10) / 10, max: Math.round(v[v.length - 1] * 10) / 10 }; });
  Object.defineProperty(out, "worst", { value: worst.sort(function (a, b) { return b.mm - a.mm; }).slice(0, 12) }); // for the evidence, not the stored fit
  return out;
}
/** Small stock pieces that sit in / on the stock bumper's space (headlight washers, brackets, fillers): they go with the stock bumper.
 *  A mesh counts when EVERY piece of it is small (< 20 cm) and inside the stock bumper's box grown by 5 cm, and it is not a light, glass,
 *  a wheel, a mechanical part or another mapped part; hidden by name, so every mesh of that name must qualify (names repeat in some files).
 *  (ponytail: whole meshes only; a bracket merged into a bigger mesh stays, its piece would have to be split off like the part map does) */
function coveredStock(car, zone) {
  var R = zone.T.clone().expandByScalar(0.05), sz = new THREE.Vector3(), ok = new Map();
  car.root.traverse(function (o) { if (!o.isMesh) return; var nm = o.name + " " + (o.material.name || "");
    var yes = o.visible && zone.hide.indexOf(o) < 0 && car.wheels.meshes.indexOf(o) < 0 && !o.userData.label && !LIGHTISH.test(nm) && !GLASS.test(nm) && !MECHANICAL.test(nm)
      && segment(o).boxes.every(function (b) { b.getSize(sz); return R.containsBox(b) && Math.max(sz.x, sz.y, sz.z) < 0.2; });
    ok.set(o.name, (ok.has(o.name) ? ok.get(o.name) : true) && yes); });
  var out = []; ok.forEach(function (v, k) { if (v && k) out.push(k); }); return out.slice(0, 40);
}
function fitBumper(car, src, type, zone, info, force, raw) { // raw (evidence only): the stock covered pieces stay, as before FIT-QA tiers
  var front = type === "FRONT_BUMPER", end = KIT[type].end;
  if (!zone || zone.how !== "part map") throw new Error("no confirmed " + (front ? "front" : "rear") + " bumper in this car's part map: 3D preview not available for this car");
  var covered = raw ? [] : coveredStock(car, zone); info.hidesWithStock = covered; // hidden with the stock bumper (buildAccessory: hideMore)
  var T = zone.T, ts = T.getSize(new THREE.Vector3());
  // A multi-mesh bumper's inner trim can reverse a vertex-density orientation guess. Choose from both headings by real seam geometry.
  var candidates = ["x", "x-reverse"].map(function (long) {
    var o = orientPart(src(), long, end, "top"), node = o.node, u = ts.x / o.size.x;
    var sy = clamp(ts.y / (o.size.y * u), 0.95, 1.05), sz = clamp(ts.z / (o.size.z * u), 0.95, 1.05);
    node.scale.set(u, u * sy, u * sz); node.position.set((T.min.x + T.max.x) / 2, T.max.y, end > 0 ? T.max.z : T.min.z);
    var B = exactBox(node), deeper = Math.max(0, front ? T.min.z - B.min.z : B.max.z - T.max.z) * 1000, gaps = bumperGaps(car, zone, node);
    var score = Math.max.apply(null, [deeper].concat(Object.keys(gaps).filter(function (k) { return gaps[k] && gaps[k].n >= 5; }).map(function (k) { return isFinite(gaps[k].p90) ? gaps[k].p90 : 1000; })));
    return { o: o, node: node, sy: sy, sz: sz, deeper: deeper, gaps: gaps, score: score, long: long };
  });
  var best = candidates[1].score + 0.01 < candidates[0].score ? candidates[1] : candidates[0];
  var o = best.o, node = best.node, sy = best.sy, sz = best.sz, deeper = best.deeper;
  info.zone = { how: zone.how, size: ts.toArray().map(round3), hidden: zone.hide.length };
  info.stretch = [1, round3(sy), round3(sz)]; info.deeperThanStockMm = Math.round(deeper);
  info.gapsMm = best.gaps; info.worstSeamPoints = info.gapsMm.worst;
  var bad = Object.keys(info.gapsMm).filter(function (r) { return info.gapsMm[r].n >= 5 && info.gapsMm[r].p90 > seamLimit(r); });
  if (bad.length || deeper > BUMPER_MAX_DEEPER_MM) {
    var why = bad.map(function (r) { return r + " gap " + info.gapsMm[r].p90 + " mm"; }); if (deeper > BUMPER_MAX_DEEPER_MM) why.push("reaches " + Math.round(deeper) + " mm into the body");
    var msg = "this bumper does not fit this car cleanly (" + why.join(", ") + ")";
    if (force) info.wouldFail = msg; else { var e = new Error(msg); e.info = info; throw e; } // force: evidence renders only
  }
  return { o: o, placements: [{ pos: node.position.toArray().map(r4), sc: node.scale.toArray().map(r4), rot: [0, 0, 0], side: 1 }], orient: [best.long, end, "top"], shadows: [], hideMore: covered };
}
// ---- RIMS: one rim part used x4, placed automatically on every car (no per-car settings) ----
// rimPieces(car): the four wheels. A seed only LOCATES each wheel (confirmed part map WHEELS, else the stored automatic proposal, else
// wheel-named meshes, else round pieces standing on the ground): centre, real axle and radius from its points. Then every connected piece
// of any car mesh lying wholly inside that wheel's cylinder is the wheel (tyre, rim, nuts, a wheel merged into the body mesh; a partial
// seed or a steered wheel works the same). Brake / hub / suspension / steering-wheel names are never taken. Original meshes are never
// edited: while rims are on, a shared mesh is hidden and its non-wheel triangles are drawn as a residual (rimRuntime).
// wheelParts(car): per wheel the axle (PCA of its points: steered / cambered wheels too), the tyre / rim / brake split (a ring reaching the
// tread = tyre; a piece inboard of the tyre centre and well inside the rim = brake, kept), tyre radius and faces, stock rim radius and face.
// fitRims: the new rim at the stock rim face, facing outward, same diameter (or the product's inches); the stock tyre kept when it is its own
// piece and the size is unchanged, else a tyre is built (stock outer size). Then each wheel on its own: the arch line (rimArch) and the
// whole wheel moved along its own axle so the tyre face sits 5 mm inside it (rimOffsetSearch: <= 40 mm, the largest move rimSafety allows);
// no arch line = stock position + a warning. A Parts Admin inset (RIMS zone wheelInsetMm, mm inward per axle) overrides the automatic move.
// Fit errors: a wheel that cannot be measured (all four must take the rim), or less than 2 cm of tyre sidewall left.
var RIM_FINISH = { silver: [0xc9ccd0, 1, 0.32], black: [0x1c1d1f, 0.55, 0.42], gunmetal: [0x4a4e54, 0.9, 0.38], chrome: [0xf1f3f5, 1, 0.06] };
var TYRE_MAT = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.92, metalness: 0 });
/** A tyre along the x axis: a lathed profile from the rim edge (ri) to the tread (ro), width w. prof = the stock tyre's outline (largest radius
 *  per twelfth of its width, inner face first): the built tyre then has exactly the stock tyre's shape; else a generic rounded one. */
function tyreGeometry(ri, ro, w, prof) {
  if (prof && prof.length === 12 && prof.every(function (r) { return r > ri; })) {
    var q = [new THREE.Vector2(ri, -w / 2)]; prof.forEach(function (r, k) { q.push(new THREE.Vector2(r * 0.998, -w / 2 + (k + 0.5) * w / 12)); }); q.push(new THREE.Vector2(ri, w / 2));
    var lg = new THREE.LatheGeometry(q, 48); lg.rotateZ(-Math.PI / 2); return lg;
  }
  var pts = [], k = Math.min(0.35 * (ro - ri), 0.3 * w), seg = 6, i, a;
  var arc = function (cx, cy, a0, a1) { for (i = 0; i <= seg; i++) { a = a0 + (a1 - a0) * i / seg; pts.push(new THREE.Vector2(cx + k * Math.cos(a), cy + k * Math.sin(a))); } };
  pts.push(new THREE.Vector2(ri, -w / 2 * 0.9));
  arc(ro - k, -w / 2 + k, -Math.PI / 2, 0); arc(ro - k, w / 2 - k, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(ri, w / 2 * 0.9));
  var g = new THREE.LatheGeometry(pts, 48); g.rotateZ(-Math.PI / 2); // lathe axis y -> x (the axle)
  return g;
}
function meshName(m) { return m.name + " " + (m.material && m.material.name || ""); }
function triCount(g) { return Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3); }
var round1 = function (n) { return Math.round(n * 10) / 10; };
/** A wheel's frame from its points: axle = least-variance direction (pointing out of the car), centre, radius (mean of the two round extents). */
function wheelFrame(pts, side) {
  var pca = rimPCA(pts); if (!pca) return null;
  var axis = new THREE.Vector3().fromArray(rimNarrowestAxis(pts, pca.axis[0])); if (axis.x * side < 0) axis.negate();
  var up = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize(), tangent = new THREE.Vector3().crossVectors(axis, up).normalize();
  var R = [axis, up, tangent].map(function (v) { var lo = Infinity, hi = -Infinity; pts.forEach(function (p) { var d = v.x * p[0] + v.y * p[1] + v.z * p[2]; if (d < lo) lo = d; if (d > hi) hi = d; }); return [lo, hi]; });
  var center = new THREE.Vector3(); [axis, up, tangent].forEach(function (v, j) { center.addScaledVector(v, (R[j][0] + R[j][1]) / 2); });
  var hu = R[1][1] - R[1][0], ht = R[2][1] - R[2][0], circular = Math.min(hu, ht) / Math.max(hu, ht);
  return { center: center, axis: axis, up: up, tangent: tangent, ro: (hu + ht) / 4, half: (R[0][1] - R[0][0]) / 2, circular: circular, confidence: clamp(1 - pca.values[0] / pca.values[1], 0, 1) * circular };
}
function rimPieces(car) {
  if (car.rimPieces) return car.rimPieces;
  var root = car.root, rb = car.rb, mid = rb.getCenter(new THREE.Vector3()), sz = rb.getSize(new THREE.Vector3()), v = new THREE.Vector3(), d = new THREE.Vector3();
  var confirmed = car.parts.WHEELS, ids = new Set(car.rimProposal ? car.rimProposal.ids : []), via = confirmed ? "confirmed" : ids.size ? "proposal" : "deterministic";
  var named = via === "deterministic" ? findWheels(root, rb).meshes : [], meshes = []; root.updateMatrixWorld(true);
  root.traverse(function (m) { if (m.isMesh && m.visible && m.geometry.attributes.position) meshes.push(m); });
  var low = function (p) { return p.y < rb.min.y + sz.y * 0.6 && Math.abs(p.x - mid.x) > sz.x * 0.22; };
  // 1. seed points per corner (rubber = tyre-named points: the cleanest ring)
  var seeds = [0, 1, 2, 3].map(function () { return { all: new Map(), rubber: new Map() }; });
  meshes.forEach(function (m) {
    var whole = (confirmed && confirmed.indexOf(m) >= 0) || named.indexOf(m) >= 0, seg = !whole && !confirmed && ids.size && m.userData.pi !== undefined ? segment(m) : null;
    if (!whole && !seg) return;
    var g = m.geometry, n = triCount(g), rub = TYRE.test(meshName(m));
    for (var t = 0; t < n; t++) { if (seg && !ids.has("m" + m.userData.pi + "c" + seg.tri[t])) continue;
      for (var j = 0; j < 3; j++) { v.fromBufferAttribute(g.attributes.position, triVert(g, t, j)).applyMatrix4(m.matrixWorld); if (!low(v)) continue;
        var s = seeds[(v.x > mid.x ? 1 : 0) + (v.z > mid.z ? 2 : 0)], k = Math.round(v.x * 1e4) + "," + Math.round(v.y * 1e4) + "," + Math.round(v.z * 1e4);
        s.all.set(k, v.toArray()); if (rub) s.rubber.set(k, v.toArray()); } }
  });
  // 2. each seed only locates its wheel: a cylinder round its axle, radius = the tyre (at least the centre's height above the ground)
  var cyl = seeds.map(function (s, i) {
    var pts = Array.from((s.rubber.size >= 24 ? s.rubber : s.all).values()), f = pts.length >= 12 ? wheelFrame(pts, i & 1 ? 1 : -1) : null;
    if (!f || f.confidence < 0.3) return null;
    var r = Math.max(f.ro, f.center.y - rb.min.y) * 1.03 + 0.005;
    // generous along the axle: a seed may be a thin slice of the tyre; outboard of a wheel there is only air inside its radius
    return { f: f, r2: r * r, lo: -f.half - 0.3, hi: f.half + 0.3, box: new THREE.Box3().setFromCenterAndSize(f.center, new THREE.Vector3(1, 1, 1).multiplyScalar(2 * (r + 0.3))) };
  });
  var rr = 0, inside = function (c, p) { d.subVectors(p, c.f.center); var ax = d.dot(c.f.axis); rr = d.lengthSq() - ax * ax; return ax >= c.lo && ax <= c.hi && rr <= c.r2; };
  var bits = function (x) { var n = 0; while (x) { n += x & 1; x >>= 1; } return n; };
  var near = function (b) { return cyl.some(function (c) { return c && b.intersectsBox(c.box); }); };
  // 3a. every connected piece of every mesh near a wheel: which cylinder holds it wholly, its radii, the sectors it covers, its axial span
  var cand = [], gr = function (w) { return Math.max(cyl[w].f.ro, cyl[w].f.center.y - rb.min.y); };
  meshes.forEach(function (m, mi) {
    if (NOT_WHEEL_PART.test(meshName(m)) || !near(new THREE.Box3().setFromObject(m))) return;
    var seg = segment(m), g = m.geometry, n = triCount(g), nc = seg.boxes.length, own = new Int8Array(nc).fill(-2), t;
    var rmin = new Float32Array(nc).fill(Infinity), rmax = new Float32Array(nc), arc = new Uint16Array(nc), amin = new Float32Array(nc).fill(Infinity), amax = new Float32Array(nc).fill(-Infinity);
    seg.boxes.forEach(function (b, c) { if (!near(b)) own[c] = -1; });
    for (t = 0; t < n; t++) { var c = seg.tri[t]; if (own[c] === -1) continue;
      for (var j = 0; j < 3 && own[c] !== -1; j++) { v.fromBufferAttribute(g.attributes.position, triVert(g, t, j)).applyMatrix4(m.matrixWorld);
        if (own[c] === -2) { own[c] = -1; for (var i = 0; i < 4; i++) if (cyl[i] && inside(cyl[i], v)) { own[c] = i; break; } }
        else if (!inside(cyl[own[c]], v)) own[c] = -1;
        if (own[c] >= 0) { var F = cyl[own[c]].f, ax = d.dot(F.axis); rmin[c] = Math.min(rmin[c], rr); rmax[c] = Math.max(rmax[c], rr); amin[c] = Math.min(amin[c], ax); amax[c] = Math.max(amax[c], ax);
          if (rr > 4e-4) arc[c] |= 1 << (Math.floor((Math.atan2(d.dot(F.tangent), d.dot(F.up)) + Math.PI) / (2 * Math.PI) * 12) % 12); } } }
    var inT = 0; for (var c4 = 0; c4 < nc; c4++) if (own[c4] >= 0) inT += seg.tris[c4];
    if (inT) cand.push({ m: m, mi: mi, seg: seg, n: n, own: own, rmin: rmin, rmax: rmax, arc: arc, amin: amin, amax: amax, wheelMesh: inT >= 0.5 * n });
  });
  // a tyre-like ring: reaches the tread, goes round, hollow (radii 0.52 / 0.91 of the tyre, squared)
  var ring = function (e, c) { var w = e.own[c], R2 = gr(w) * gr(w); return bits(e.arc[c]) >= 9 && e.rmin[c] > 0.27 * R2 && e.rmax[c] > 0.83 * R2; };
  // 3b. each wheel's tyre faces (along the seed axle) from its rings
  var face = [0, 1, 2, 3].map(function () { return { lo: Infinity, hi: -Infinity, bore: Infinity }; });
  cand.forEach(function (e) { for (var c = 0; c < e.own.length; c++) if (e.own[c] >= 0 && ring(e, c)) { var f = face[e.own[c]]; f.lo = Math.min(f.lo, e.amin[c]); f.hi = Math.max(f.hi, e.amax[c]); f.bore = Math.min(f.bore, e.rmin[c]); } });
  // 3c. the wheel: a wheel mesh (most of it inside the wheels: a tread of separate blocks) keeps every piece; in a mesh shared with the car a
  // piece must go round the wheel (rim, disc: 9 of 12 sectors) or sit at its centre (nuts, cap), or be a small part of the rim face (inside
  // the tyre's bore, in the outer quarter of the wheel: inserts, bolts). Calipers, brackets, liners and underbody bits stay with the car.
  var corners = [[], [], [], []], sources = [];
  cand.forEach(function (e) {
    var g = e.m.geometry, nc = e.own.length, t;
    if (!e.wheelMesh) for (var c3 = 0; c3 < nc; c3++) { var w3 = e.own[c3]; if (w3 < 0 || bits(e.arc[c3]) >= 9 || e.rmax[c3] < Math.pow(0.35 * gr(w3), 2)) continue;
      var F3 = face[w3], q3 = F3.hi - (F3.hi - F3.lo) / 4; if (!(F3.hi > F3.lo && e.rmax[c3] < F3.bore && e.amin[c3] > q3)) e.own[c3] = -1; }
    // per corner two pieces of this mesh: its tyre rings and the rest (rim, nuts, ...), so a mesh holding tyre and rim still keeps its tyre;
    // a tyre welded to its rim stays one piece (split unclear: a tyre is built)
    var buckets = [[], [], [], [], [], [], [], []], rest = [];
    for (t = 0; t < e.n; t++) { var c2 = e.seg.tri[t], w = e.own[c2];
      (w < 0 ? rest : buckets[w * 2 + (ring(e, c2) ? 1 : 0)]).push(triVert(g, t, 0), triVert(g, t, 1), triVert(g, t, 2)); }
    if (!buckets.some(function (x) { return x.length; })) return;
    var source = { mesh: e.m, rest: rest, pieces: [] }; sources.push(source);
    buckets.forEach(function (ix, b) { if (!ix.length) return;
      var obj = new THREE.Mesh(subGeo(g, ix), e.m.material); obj.geometry.applyMatrix4(e.m.matrixWorld); obj.name = "rimPiece_" + e.mi + "_" + (b >> 1) + (b & 1 ? "t" : "r");
      var piece = { obj: obj, source: source, indices: ix, id: obj.name, box: exactBox(obj) }; corners[b >> 1].push(piece); source.pieces.push(piece); });
  });
  return car.rimPieces = { corners: corners, sources: sources, via: via, seeded: cyl.map(function (c) { return !!c; }) };
}
function rimPoints(pieces) {
  var out=[], seen=new Set(); pieces.forEach(function(e){eachVert(e.obj,function(v){var k=Math.round(v.x*10000)+","+Math.round(v.y*10000)+","+Math.round(v.z*10000);if(!seen.has(k)){seen.add(k);out.push(v.toArray());}});});return out;
}
function wheelParts(car) {
  if (car.wheelParts) return car.wheelParts;
  var data = rimPieces(car), d = new THREE.Vector3();
  return car.wheelParts = data.corners.map(function (pieces, i) {
    var side = i & 1 ? 1 : -1, front = i & 2 ? 1 : -1, q = { wheel: (front > 0 ? "F" : "R") + (side > 0 ? "R" : "L"), side: side, front: front, pieces: pieces, warnings: [], tyre: [], rim: [], brake: [] };
    if (!pieces.length) { q.refusal = data.seeded[i] ? "NO_WHEEL_GEOMETRY" : "NO_WHEEL_FOUND"; return q; }
    // the axle from the tyre ring when there is one (the cleanest circle), else from every piece not named as a brake
    var rings = pieces.filter(function (e) { return /t$/.test(e.id) && !NOT_WHEEL.test(meshName(e.source.mesh)); }), pts = rimPoints(rings);
    if (pts.length < 24) pts = rimPoints(pieces.filter(function (e) { return !NOT_WHEEL.test(meshName(e.source.mesh)); }));
    var f = wheelFrame(pts, side);
    if (f) q.frame = { confidence: round3(f.confidence), circular: round3(f.circular), roMm: round1(f.ro * 1000), axisY: round3(f.axis.y), points: pts.length };
    if (!f || f.confidence < 0.5 || f.circular < 0.8 || f.ro < 0.15 || f.ro > 0.55 || Math.abs(f.axis.y) > 0.5) { q.refusal = "AXLE_NOT_MEASURABLE"; return q; }
    if (f.confidence < 0.72) q.warnings.push("LOW_AXLE_CONFIDENCE");
    Object.assign(q, { center: f.center, axis: f.axis, up: f.up, tangent: f.tangent, ro: f.ro, axleConfidence: round3(f.confidence), steerDeg: round1(Math.asin(clamp(Math.abs(f.axis.z), 0, 1)) * 180 / Math.PI) });
    pieces.forEach(function (e) { var lo = Infinity, hi = -Infinity, rmin = Infinity, rmax = 0, arc = new Uint8Array(12);
      eachVert(e.obj, function (p) { d.subVectors(p, f.center); var ax = d.dot(f.axis), r = Math.sqrt(Math.max(0, d.lengthSq() - ax * ax)); if (ax < lo) lo = ax; if (ax > hi) hi = ax; if (r < rmin) rmin = r; if (r > rmax) rmax = r;
        if (r > 0.02) arc[Math.floor((Math.atan2(d.dot(f.tangent), d.dot(f.up)) + Math.PI) / (2 * Math.PI) * 12) % 12] = 1; });
      e.measure = { lo: lo, hi: hi, rmin: rmin, rmax: rmax, arc: arc.reduce(function (a, b) { return a + b; }, 0) };
      if (NOT_WHEEL.test(meshName(e.source.mesh) + " " + (e.obj.material.name || ""))) q.brake.push(e);
      else if (rmin > 0.52 * q.ro && rmax > 0.91 * q.ro) q.tyre.push(e); else q.rim.push(e); });
    // the tread faces: the tyre ring, or (one-piece wheels) the pieces reaching the tread
    var tread = q.tyre.length ? q.tyre : q.rim.filter(function (e) { return e.measure.rmax > 0.9 * q.ro; }), outer = -Infinity, inner = Infinity;
    if (!tread.length) { q.refusal = "AXLE_NOT_MEASURABLE"; return q; }
    tread.forEach(function (e) { outer = Math.max(outer, e.measure.hi); inner = Math.min(inner, e.measure.lo); });
    q.outer = outer; q.inner = inner; q.tw = outer - inner; q.cAx = (outer + inner) / 2;
    // sideways (steering taken out, camber kept): the fender runs along the car, so the arch is measured across it; a steered tyre's
    // outermost point is a corner of its tread
    q.lat = new THREE.Vector3(f.axis.x, f.axis.y, 0).normalize(); q.latTangent = new THREE.Vector3().crossVectors(q.lat, f.up).normalize();
    var lo2 = Infinity, hi2 = -Infinity; tread.forEach(function (e) { eachVert(e.obj, function (p) { var a2 = d.subVectors(p, f.center).dot(q.lat); if (a2 < lo2) lo2 = a2; if (a2 > hi2) hi2 = a2; }); });
    q.outerLat = hi2; q.cLat = (hi2 + lo2) / 2; q.latPerAxle = f.axis.dot(q.lat); // sideways shift per metre moved along the axle
    q.profile = []; for (var b = 0; b < 12; b++) q.profile.push(0); // the tyre's real outline: largest radius per twelfth of its width
    tread.forEach(function (e) { eachVert(e.obj, function (p) { d.subVectors(p, f.center); var ax = d.dot(f.axis), k = clamp(Math.floor((ax - inner) / (outer - inner) * 12), 0, 11); q.profile[k] = Math.max(q.profile[k], Math.sqrt(Math.max(0, d.lengthSq() - ax * ax))); }); });
    if (q.tw < 0.06 || q.tw > 0.5) { q.refusal = "TYRE_NOT_MEASURABLE"; return q; }
    q.faceInner = q.tyre.length ? Math.min.apply(null, q.tyre.map(function (e) { return e.measure.rmin; })) : q.ro * 0.7;
    // brakes without a name: a disc / hub inboard of the tyre centre well inside the rim, or a caliper-like piece (a small arc of the wheel)
    // reaching back from the outer quarter (rim-face inserts and bolts sit in the outer quarter and go with the rim)
    q.rim = q.rim.filter(function (e) { var m = e.measure;
      if ((m.hi < q.cAx - 0.005 && m.rmax < 0.8 * q.faceInner) || (m.arc <= 3 && m.rmax > 0.35 * q.ro && m.lo < q.outer - q.tw / 4)) { q.brake.push(e); return false; } return true; });
    q.rimR = q.rim.length ? Math.max.apply(null, q.rim.map(function (e) { return e.measure.rmax; })) : q.faceInner;
    q.rimR = Math.min(q.rimR, q.faceInner + 0.012); q.rimFace = q.rim.length ? Math.min(outer, Math.max.apply(null, q.rim.map(function (e) { return e.measure.hi; }))) : outer - 0.01;
    q.rimWidth = q.rim.length ? Math.max.apply(null, q.rim.map(function (e) { return e.measure.hi; })) - Math.min.apply(null, q.rim.map(function (e) { return e.measure.lo; })) : null;
    return q;
  });
}
/** Per measured wheel, the car geometry around it as two ray targets (world space): body = the painted shell (the fender / arch), other =
 *  everything else that is not a wheel piece (brakes, hubs, suspension, liners). One pass over the car. */
function rimNear(car) {
  if (car.rimNear) return car.rimNear;
  var P = wheelParts(car), data = rimPieces(car), p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], restOf = new Map();
  data.sources.forEach(function (s) { restOf.set(s.mesh, s.rest); });
  var body = new Set(car.paintMeshes.filter(function (m) { var n = meshName(m); return !NOT_BODY.test(n) && !MIRROR.test(n); }));
  var near = P.map(function (q) { return q.refusal ? null : { box: new THREE.Box3().setFromCenterAndSize(q.center, new THREE.Vector3(1, 1, 1).multiplyScalar(2 * Math.max(1.8 * q.ro, 0.5))), body: [], other: [], bodyBy: [], otherBy: [], otherOwn: [] }; });
  var who = "", whoObj = null, push = function (arr, by, own) { for (var j = 0; j < 3; j++) arr.push(p[j].x, p[j].y, p[j].z); by.push(who); if (own) own.push(whoObj); };
  car.root.updateMatrixWorld(true);
  car.root.traverse(function (m) {
    if (!m.isMesh || !m.visible || !m.geometry.attributes.position) return;
    var mb = new THREE.Box3().setFromObject(m), hits = near.filter(function (n) { return n && mb.intersectsBox(n.box); }); if (!hits.length) return;
    var g = m.geometry, list = restOf.get(m), n = list ? list.length / 3 : triCount(g), isBody = body.size ? body.has(m) : true; who = meshName(m); whoObj = m;
    for (var t = 0; t < n; t++) {
      for (var j = 0; j < 3; j++) p[j].fromBufferAttribute(g.attributes.position, list ? list[t * 3 + j] : triVert(g, t, j)).applyMatrix4(m.matrixWorld);
      hits.forEach(function (h) { if (h.box.containsPoint(p[0]) || h.box.containsPoint(p[1]) || h.box.containsPoint(p[2])) isBody ? push(h.body, h.bodyBy) : push(h.other, h.otherBy, h.otherOwn); });
    }
  });
  P.forEach(function (q, i) { if (near[i]) q.brake.forEach(function (e) { var g = e.obj.geometry; who = meshName(e.source.mesh) + " (brake)"; whoObj = e; for (var t = 0; t < triCount(g); t++) { for (var j = 0; j < 3; j++) p[j].fromBufferAttribute(g.attributes.position, triVert(g, t, j)); push(near[i].other, near[i].otherBy, near[i].otherOwn); } }); });
  var mk = function (arr, by, own) { if (!arr.length) return null; var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(arr), 3)); var m = new THREE.Mesh(geo, RAY_MAT); m.updateMatrixWorld(true); m.userData.by = by; m.userData.own = own; return m; };
  return car.rimNear = near.map(function (n) { return n && { body: mk(n.body, n.bodyBy), other: mk(n.other, n.otherBy, n.otherOwn) }; });
}
/** The arch line of one wheel, as a sideways distance (q.lat) from the wheel centre: around the top of the arch (40-140 deg) rays come in
 *  from outside along the axle at growing radii; the first one that meets the painted body outboard of the tyre centre is the arch edge, and
 *  the outermost body point just above it (16 mm) is the line. Median of the angles, outliers dropped (rimArchEstimate). */
function rimArch(car, q, i) {
  var n = rimNear(car)[i], target = n && n.body, samples = [], p = new THREE.Vector3(), dir = q.lat.clone().negate();
  if (!target) return { value: null, confidence: 0, samples: samples };
  var hit = function (rr, a) { p.copy(q.center).addScaledVector(q.up, Math.sin(a) * rr).addScaledVector(q.latTangent, Math.cos(a) * rr).addScaledVector(q.lat, q.outerLat + 0.3);
    RAY.set(p, dir); RAY.far = 0.6; var h = RAY.intersectObject(target, false)[0]; return h ? h.point.sub(q.center).dot(q.lat) : null; };
  for (var deg = 40; deg <= 140; deg += 10) { var a = deg * Math.PI / 180;
    for (var k = 0; k <= 60; k++) { var rr = q.ro * (1 + k * 0.01), ax = hit(rr, a); if (ax === null || ax <= q.cLat) continue;
      for (var k2 = 1; k2 <= 4; k2++) { var a2 = hit(rr + 0.004 * k2, a); if (a2 !== null && a2 > ax) ax = a2; }
      samples.push(ax); break; } }
  RAY.far = Infinity; var est = rimArchEstimate(samples); est.samples = samples; return est;
}
/** How far the brake / hub / suspension inside the new rim pokes out in front of the rim's spokes (metres, <= 0 = hidden behind them) with the
 *  wheel moved d. depth[b] = how far the spokes' front surface sits back from the rim face at radius band b (twelfths of 85 % of the rim
 *  radius; null = no spokes there, or open deeper than half the rim width: a brake can show through). Points outboard of the stock rim face are not brakes. */
function rimBrakeOverlap(car, q, i, d, face, depth, rad, front) {
  var n = rimNear(car)[i]; if (!n || !n.other) return 0;
  var pos = n.other.geometry.attributes.position, v = new THREE.Vector3(), worst = -Infinity;
  for (var k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).sub(q.center); var ax = v.dot(q.axis), b = Math.floor(Math.sqrt(Math.max(0, v.lengthSq() - ax * ax)) / (0.85 * rad) * 12);
    if (ax > q.rimFace + 0.005 || b > 11 || depth[b] === null) continue; var o = ax - (face + d - depth[b]); if (front && o > 0.002) front.add(n.other.userData.own[Math.floor(k / 3)]); if (o > worst) { worst = o; rimBrakeOverlap.at = { band: b, ax: round3(ax - face), by: n.other.userData.by[Math.floor(k / 3)] }; } }
  return worst;
}
/** null when the whole wheel can move d along its axle (+ = out), else why not. The leading face of the tyre (outer face moving out, inner
 *  face moving in) is swept from stock to the new place: no body (arch / inner arch) or other part (suspension, liner) may be in the way.
 *  Moving in, the brake / hub may not reach further into the new rim's spokes than it does at the stock place. */
function rimSafety(car, q, i, d, face, depth, rad) {
  if (Math.abs(d) < 1e-4) return null;
  var n = rimNear(car)[i]; if (!n) return null;
  var targets = [n.body, n.other].filter(Boolean), dir = q.axis.clone().multiplyScalar(Math.sign(d)), p = new THREE.Vector3(), why = null, pts = [], w = (q.outer - q.inner) / 12;
  // the leading half of the tyre's outline (each slice 1 mm under its largest radius) and its leading face down to the rim edge
  for (var b = 0; b < 12; b++) if ((d > 0 ? b >= 6 : b < 6) && q.profile[b] > 0) pts.push([q.profile[b] - 0.001, q.inner + (b + (d > 0 ? 1 : 0)) * w]);
  var lead = d > 0 ? q.outer : q.inner, rf = q.profile[d > 0 ? 11 : 0] - 0.001; pts.push([(rf + q.faceInner) / 2, lead], [q.faceInner, lead]);
  var radii = pts.map(function (x) { return x[0]; });
  for (var s = 0; s < 36 && !why; s++) { var a = s * Math.PI / 18;
    for (var j = 0; j < pts.length && !why; j++) {
      p.copy(q.center).addScaledVector(q.up, Math.sin(a) * pts[j][0]).addScaledVector(q.tangent, Math.cos(a) * pts[j][0]).addScaledVector(q.axis, pts[j][1]);
      RAY.set(p, dir); RAY.far = Math.abs(d) + 0.002;
      var h = RAY.intersectObjects(targets, false).find(function (x) { return x.distance > 0.0015; });
      if (h) why = { code: h.object === n.body ? "ARCH_CONTACT" : "SUSPENSION_CONTACT", atDeg: s * 10, radius: round3(radii[j] / q.ro), afterMm: round1(h.distance * 1000), by: String(h.object.userData.by[h.faceIndex] || "").slice(0, 80) };
    } }
  RAY.far = Infinity; if (why) return why;
  if (d < 0) { var at0 = rimBrakeOverlap(car, q, i, 0, face, depth, rad), at = rimBrakeOverlap(car, q, i, d, face, depth, rad);
    if (at > Math.max(at0, 0) + 0.001) return { code: "BRAKE_CONTACT", intoSpokesMm: round1(at * 1000), atStockMm: round1(at0 * 1000), where: rimBrakeOverlap.at }; }
  return null;
}
function fitRims(car,src,size,zone,info) {
  var P = wheelParts(car), o = orientPart(src(), "axle", 0, "mid"), pb = exactBox(o.node), pw = pb.max.x - pb.min.x, pc = (pb.min.x + pb.max.x) / 2, R = 0, sx = 0, n = 0;
  eachVert(o.node, function (v) { R = Math.max(R, Math.hypot(v.y, v.z)); });
  eachVert(o.node, function (v) { var r = Math.hypot(v.y, v.z); if (r > 0.3 * R && r < 0.75 * R) { sx += v.x - pc; n++; } }); var face = n && sx / n < 0 ? -1 : 1; // the spokes stand out on the face side
  // the spokes' front surface per radius band, as a share of the rim's width back from its face: what a brake must stay behind
  var dish = []; for (var b = 0; b < 12; b++) dish.push(null); eachVert(o.node, function (v) { var k = Math.floor(Math.hypot(v.y, v.z) / (0.85 * R) * 12), x = Math.abs((face > 0 ? pb.max.x : pb.min.x) - v.x) / pw; if (k < 12) dish[k] = dish[k] === null ? x : Math.min(dish[k], x); });
  var placements = [], tyres = [], rings = [], per = [], active = [], kept = [], offsets = [], hideMore = [], hideBrakes = [], inset = (car.tuned.RIMS || {}).wheelInsetMm;
  P.forEach(function (q, i) {
    var w = { wheel: q.wheel, refusal: q.refusal || null, warnings: q.warnings.slice(), archGapBeforeMm: null, archGapAfterMm: null, movedMm: 0, axleConfidence: q.axleConfidence || 0, steerDeg: q.steerDeg || 0 };
    per.push(w); if (q.refusal) return;
    var stockIn = (2 * q.rimR - 0.025) / 0.0254, want = size.rimInches > 0 ? size.rimInches : stockIn;
    var rad = want * 0.0254 / 2 + 0.0125, u = rad / R, ux = Math.min(u, (q.tw - 0.02) / pw), width = pw * ux, fa = Math.min(q.rimFace, q.outer - 0.004), keep = q.tyre.length > 0 && Math.abs(rad - q.rimR) <= 0.006;
    Object.assign(w, { tyreOuterMm: round1(q.ro * 2000), tyreWidthMm: round1(q.tw * 1000), stockRimMm: round1(q.rimR * 2000), stockRimInches: round1(stockIn), rimMm: round1(rad * 2000), rimWidthMm: round1(width * 1000),
      sidewallMm: round1((q.ro - rad) * 1000), faceInsetMm: round1((q.outer - fa) * 1000), gapToTyreMm: keep ? round1((q.faceInner - rad) * 1000) : 0, brakesKept: q.brake.length, tyre: keep ? "stock" : "built" });
    if (rad > q.ro - 0.02 || width <= 0 || !isFinite(u)) { w.refusal = "RIM_EXCEEDS_TYRE"; return; }
    // gap and the search are sideways (arch line - the tyre's outermost point); the wheel then moves along its own axle: x / latPerAxle
    var arch = rimArch(car, q, i), gap = arch.value === null ? null : arch.value - q.outerLat, block = null, k = q.latPerAxle;
    var override = inset ? -(q.front > 0 ? inset.front : inset.rear) / 1000 : undefined;
    var depthW = dish.map(function (k) { return k === null || k > 0.5 ? null : k * width; });
    var s = rimOffsetSearch(gap, function (x) { var why = rimSafety(car, q, i, x / k, fa, depthW, rad); block = block || why; return !why; }, override), dd = s.offset / k;
    Object.assign(w, { archGapBeforeMm: gap === null ? null : round1(gap * 1000), archGapAfterMm: gap === null ? null : round1((gap - s.offset) * 1000), movedMm: round1(dd * 1000), archSamples: arch.samples.length, archConfidence: round3(arch.confidence), blockedBy: block });
    w.warnings.push.apply(w.warnings, s.warnings); if (!keep) w.warnings.push("BUILT_TYRE");
    // the same rim on both sides, turned (not mirrored) so its face points out of the car along the wheel's own axle
    var rot = new THREE.Quaternion(); if (q.side < 0) rot.setFromAxisAngle(UP, Math.PI); rot.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(q.side, 0, 0), q.axis));
    var e = new THREE.Euler().setFromQuaternion(rot), pos = q.center.clone().addScaledVector(q.axis, fa - width / 2 + dd).sub(new THREE.Vector3(pc * ux * face, 0, 0).applyQuaternion(rot));
    placements.push({ pos: pos.toArray().map(r4), sc: [r4(ux * face), r4(u), r4(u)], rot: [e.x, e.y, e.z], side: q.side }); active.push(q.wheel); offsets.push({ wheel: q.wheel, delta: q.axis.clone().multiplyScalar(dd).toArray().map(function (x) { return Math.round(x * 1e5) / 1e5; }) });
    // brake / hub parts that would stand in front of the new spokes (a deeper rim than the stock one) are hidden while the rims are on
    var front = new Set(); rimBrakeOverlap(car, q, i, dd, fa, depthW, rad, front);
    front.forEach(function (x) { if (x && x.isMesh) { if (x.name && hideMore.indexOf(x.name) < 0) hideMore.push(x.name); } else if (x && x.id) hideBrakes.push(x.id); });
    w.hiddenBrakeParts = front.size;
    if (keep) q.tyre.forEach(function (t) { kept.push(t.id); });
    else tyres.push({ c: q.center.clone().addScaledVector(q.axis, q.cAx + dd).toArray().map(r4), ri: r4(rad - 0.012), ro: r4(q.ro), w: r4(q.tw), rot: [e.x, e.y, e.z], prof: q.profile.map(r4) });
    // seams: a soft dark ring where the rim lip meets the tyre, and the arch's shadow behind the top of the tyre
    rings.push({ c: q.center.clone().addScaledVector(q.axis, fa + dd - 0.002).toArray().map(r4), rot: [e.x, e.y, e.z], ri: r4(rad - 0.003), ro: r4(rad + 0.016), a: 0.5 });
    rings.push({ c: q.center.clone().addScaledVector(q.axis, q.inner + dd).toArray().map(r4), rot: [e.x, e.y, e.z], ri: r4(q.ro * 0.97), ro: r4(q.ro * 1.3), a: 0.55, half: 1 });
  });
  info.wheels = per; info.faceSign = face; info.wheelSource = rimPieces(car).via; info.override = inset || null;
  if (per.some(function (w) { return w.refusal === "RIM_EXCEEDS_TYRE"; })) { var big = new Error("this rim size does not fit this car cleanly (less than 2 cm of tyre sidewall left)"); big.info = info; throw big; }
  if (placements.length < 4) { var err = new Error("no wheels found on this car model (" + per.filter(function (w) { return w.refusal; }).map(function (w) { return w.wheel + ": " + w.refusal; }).join(", ") + ")"); err.info = info; throw err; }
  return { o: o, placements: placements, orient: ["axle", 0, "mid"], shadows: [], tyres: tyres, rings: rings, keep: [], hideMore: hideMore.slice(0, 60), shift: [], rimRuntime: { active: active, kept: kept, offsets: offsets, hideBrakes: hideBrakes } };
}
// While rims are on: the measured wheels' pieces hidden (their source meshes hidden, the rest of a shared mesh drawn as a residual), kept stock
// tyres drawn moved with their wheel; brakes and refused wheels stay exactly at stock. Off = the group removed and the source meshes shown again.
function rimRuntime(car,f,group) {
  var P=wheelParts(car),data=rimPieces(car),hidden=[],moving=[],selected=new Set(f.rimRuntime.active),kept=new Set(f.rimRuntime.kept),gone=new Set(f.rimRuntime.hideBrakes||[]);
  data.sources.forEach(function(source){var rest=source.rest.slice(), changed=false;
    source.pieces.forEach(function(e){var q=P.find(function(w){return w.pieces.indexOf(e)>=0;});
      if(gone.has(e.id)){changed=true;return;}
      if(!selected.has(q.wheel)||q.brake.indexOf(e)>=0){rest.push.apply(rest,e.indices);return;}changed=true;
      if(kept.has(e.id)){var clone=e.obj.clone(),offset=f.rimRuntime.offsets.find(function(x){return x.wheel===q.wheel;});if(offset)clone.position.fromArray(offset.delta);clone.userData.shadow=true;clone.userData.tyre=true;group.add(clone);moving.push(clone);}
    });
    if(!changed)return;hidden.push(source.mesh);
    if(rest.length){var m=new THREE.Mesh(subGeo(source.mesh.geometry,rest),source.mesh.material);m.geometry.applyMatrix4(source.mesh.matrixWorld);m.userData.shadow=true;m.userData.residual=true;group.add(m);}
  });return {hide:hidden,moving:moving};
}
function fitAccessory(car, src, type, size, zone) {
  var k = KIT[type], s = car.rb.getSize(new THREE.Vector3()), W = s.x, info = { type: type, fitVersion: fitVersion(type) }, pl = [], o, u, T, r, orient;
  var mm = function (v) { return typeof v === "number" && v > 0 ? v / 1000 : 0; };
  var add = function (pos, sc, side) { pl.push({ pos: pos.toArray().map(r4), sc: sc.toArray().map(r4), rot: [0, 0, 0], side: side }); };
  var stretch = function (o, T, u, ax) { return clamp(T.getSize(new THREE.Vector3())[ax] / (o.size[ax] * u), 0.85, 1.15); };
  if (zone && !k.replace) info.replaces = { how: zone.how, hidden: zone.hide.length };
  if (type === "RIMS") r = fitRims(car, src, size, zone, info);
  else if (type === "FRONT_BUMPER" || type === "REAR_BUMPER") r = fitBumper(car, src, type, zone, info, size.forceFit === true, size.qaRaw === true);
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
  return { version: fitVersion(type), type: type, orient: orient, placements: pl, shadows: r ? r.shadows : [], tyres: r && r.tyres || [], keep: r && r.keep || [], hideMore: r && r.hideMore || [], shift: r && r.shift || [], ...(r && r.rings ? {rings:r.rings} : {}), ...(r && r.rimRuntime ? {rimRuntime:r.rimRuntime} : {}), info: info };
}
// ---- FIT QA (every type, the part exactly as drawn): does it look physically fitted? ----
// Samples spread over the whole placed part (area-weighted, deterministic) against the visible car around it (the stock part it replaces
// excluded; while rims are on, their residual meshes included): a sample is INSIDE the car when it lies behind the nearest car surface (by
// that surface's own normal) by more than QA_CLIP_MM. Contact = samples within QA_NEAR of the car (wheels never count as contact); each
// contact cluster is cut into 5 cm slices along its length and a slice's gap is its closest point: a foot or edge whose every slice
// touches is attached, a slice that stays QA_GAP_MM away somewhere along the edge floats there. A fit that fails is moved / scaled a
// little (<= 10 mm, +-2 %) and checked again; if nothing passes it is refused with the measured reason. Rims keep their own placement
// (arch / brake rules): they are measured, never moved. The contact clusters become soft seam ribbons (seams) on the part.
var QA_CLIP_MM = 2, QA_GAP_MM = 3, QA_NEAR = 0.015, QA_CELL = 0.04;
function qaSamples(node, budget) { // part-local points of every visible mesh of a placed node, area-weighted, plus its vertices
  node.updateMatrixWorld(true); var inv = new THREE.Matrix4().copy(node.matrixWorld).invert(), tris = [], area = 0, out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  node.traverse(function (m) { if (!m.isMesh || m.userData.seam || (m.userData.shadow && !m.userData.tyre)) return; var g = m.geometry, p = g.attributes.position, M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (var t = 0; t < triCount(g); t++) { a.fromBufferAttribute(p, triVert(g, t, 0)).applyMatrix4(M); b.fromBufferAttribute(p, triVert(g, t, 1)).applyMatrix4(M); c.fromBufferAttribute(p, triVert(g, t, 2)).applyMatrix4(M);
      var tr = new THREE.Triangle(a.clone(), b.clone(), c.clone()), ar = tr.getArea(); tris.push(tr); area += ar; } });
  var per = area / budget, lattice = [[1 / 3, 1 / 3], [0.1, 0.1], [0.8, 0.1], [0.1, 0.8], [0.45, 0.1], [0.1, 0.45], [0.45, 0.45], [0.7, 0.2], [0.2, 0.7], [0.25, 0.25]];
  tris.forEach(function (tr) { out.push(tr.a.clone()); // every corner (duplicates are harmless) and points inside big triangles
    var k = Math.min(lattice.length, Math.floor(tr.getArea() / per)); for (var i = 0; i < k; i++) { var u = lattice[i][0], v = lattice[i][1];
      out.push(new THREE.Vector3().copy(tr.a).multiplyScalar(1 - u - v).addScaledVector(tr.b, u).addScaledVector(tr.c, v)); } });
  var step = Math.max(1, Math.floor(out.length / (budget * 1.5))); return out.filter(function (_, i) { return i % step === 0; });
}
/** The car near a box as a 4 cm grid of world triangles (with vertex normals; wheel = inside a wheel's cylinder: clips, never a contact). */
function qaBody(car, box, skip, extra) {
  var cells = new Map(), tris = [], v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], nm = new THREE.Matrix3();
  var wheelAt = function (p) { return car.wheels.list.some(function (w) { return Math.hypot(p.y - w.center.y, p.z - w.center.z) < w.r * 1.04 && Math.abs(p.x - w.center.x) < 0.25; }); };
  var edge = new Set(), ek = function (p) { return Math.round(p.x * 100) + "," + Math.round(p.y * 100) + "," + Math.round(p.z * 100); };
  var add = function (m) { var g = m.geometry, P = g.attributes.position, N = g.attributes.normal; m.updateMatrixWorld(true); nm.getNormalMatrix(m.matrixWorld);
    if (!new THREE.Box3().setFromObject(m).intersectsBox(box)) return;
    // open edges (used by one triangle, vertices welded at 0.1 mm): where a panel ends (a fender edge a bumper tucks under)
    var cnt = new Map(), w = function (i) { v[0].fromBufferAttribute(P, i); return Math.round(v[0].x * 1e4) + "," + Math.round(v[0].y * 1e4) + "," + Math.round(v[0].z * 1e4); };
    for (var t0 = 0; t0 < triCount(g); t0++) { var ids = [w(triVert(g, t0, 0)), w(triVert(g, t0, 1)), w(triVert(g, t0, 2))];
      for (var e0 = 0; e0 < 3; e0++) { var a0 = ids[e0], b0 = ids[(e0 + 1) % 3], key0 = a0 < b0 ? a0 + "|" + b0 : b0 + "|" + a0; cnt.set(key0, (cnt.get(key0) || 0) + 1); } }
    cnt.forEach(function (c, key0) { if (c !== 1) return; key0.split("|").forEach(function (s0) { var q = s0.split(",").map(function (x) { return +x / 1e4; }); var wp = new THREE.Vector3(q[0], q[1], q[2]).applyMatrix4(m.matrixWorld); if (box.containsPoint(wp)) edge.add(ek(wp)); }); });
    for (var t = 0; t < triCount(g); t++) { for (var j = 0; j < 3; j++) { var k = triVert(g, t, j); v[j].fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld); if (N) n[j].fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); }
      var tb = new THREE.Box3().setFromPoints(v); if (!tb.intersectsBox(box)) continue;
      var tr = new THREE.Triangle(v[0].clone(), v[1].clone(), v[2].clone()), fn = tr.getNormal(new THREE.Vector3()), ns = N ? [n[0].clone(), n[1].clone(), n[2].clone()] : [fn, fn, fn];
      var id = tris.length; tris.push({ t: tr, n: ns, wheel: wheelAt(tr.getMidpoint(new THREE.Vector3())), by: m.name, id: id });
      for (var x = Math.floor(tb.min.x / QA_CELL); x <= Math.floor(tb.max.x / QA_CELL); x++) for (var y = Math.floor(tb.min.y / QA_CELL); y <= Math.floor(tb.max.y / QA_CELL); y++) for (var z = Math.floor(tb.min.z / QA_CELL); z <= Math.floor(tb.max.z / QA_CELL); z++) {
        var key = x + "," + y + "," + z, l = cells.get(key); if (!l) cells.set(key, l = []); l.push(id); } } };
  car.root.traverse(function (m) { if (m.isMesh && m.visible && skip.indexOf(m) < 0) add(m); });
  (extra || []).forEach(add);
  // can a viewer outside the car see this car triangle? a ray from it along its normal, straight up or out to the side escapes (cached)
  var occl = []; car.root.updateMatrixWorld(true); car.root.traverse(function (m) { if (m.isMesh && m.visible && skip.indexOf(m) < 0) { var pr = new THREE.Mesh(m.geometry, RAY_MAT); pr.matrixAutoUpdate = false; pr.matrixWorld.copy(m.matrixWorld); occl.push(pr); } });
  (extra || []).forEach(function (m) { var pr = new THREE.Mesh(m.geometry, RAY_MAT); pr.matrixAutoUpdate = false; pr.matrixWorld.copy(m.matrixWorld); occl.push(pr); });
  var partOccl = [], seenOut = new Map(), exterior = function (h) { if (seenOut.has(h.tri)) return seenOut.get(h.tri); var o = false;
    [h.n.clone(), UP.clone(), new THREE.Vector3(Math.sign(h.c.x) || 1, 0, 0)].forEach(function (dir) { if (o) return; RAY.set(h.c.clone().addScaledVector(dir, 0.004), dir); RAY.far = 4;
      // the part itself hides a crossing too (a tyre in front of the inner arch), but not within 5 cm: that is the part at its own crossing
      if (!RAY.intersectObjects(occl, false).length && !RAY.intersectObjects(partOccl, false).some(function (x) { return x.distance > 0.05; })) o = true; });
    RAY.far = Infinity; seenOut.set(h.tri, o); return o; };
  return { cells: cells, tris: tris, exterior: exterior, setPart: function (nodes) { partOccl = []; nodes.forEach(function (n) { n.updateMatrixWorld(true); n.traverse(function (m) { if (!m.isMesh) return; var pr = new THREE.Mesh(m.geometry, RAY_MAT); pr.matrixAutoUpdate = false; pr.matrixWorld.copy(m.matrixWorld); partOccl.push(pr); }); }); }, nearEdge: function (p) { var x = Math.round(p.x * 100), y = Math.round(p.y * 100), z = Math.round(p.z * 100);
    for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) for (var c = -1; c <= 1; c++) if (edge.has((x + a) + "," + (y + b) + "," + (z + c))) return true; return false; } };
}
/** Nearest car surface to p within 8 cm: { d (m, >= 0), s = signed (negative = behind the surface, inside), wheel, c, n } or null. */
function qaNearest(body, p) {
  var best = null, cp = new THREE.Vector3(), bc = new THREE.Vector3(), cx = Math.floor(p.x / QA_CELL), cy = Math.floor(p.y / QA_CELL), cz = Math.floor(p.z / QA_CELL), seen = new Set();
  for (var x = cx - 2; x <= cx + 2; x++) for (var y = cy - 2; y <= cy + 2; y++) for (var z = cz - 2; z <= cz + 2; z++) (body.cells.get(x + "," + y + "," + z) || []).forEach(function (id) {
    if (seen.has(id)) return; seen.add(id); var e = body.tris[id]; e.t.closestPointToPoint(p, cp); var d = cp.distanceTo(p); if (d > 0.08 || (best && d >= best.d)) return;
    THREE.Triangle.getBarycoord(cp, e.t.a, e.t.b, e.t.c, bc); var nn = new THREE.Vector3().addScaledVector(e.n[0], bc.x).addScaledVector(e.n[1], bc.y).addScaledVector(e.n[2], bc.z).normalize();
    best = { d: d, c: cp.clone(), n: nn, wheel: e.wheel, by: e.by, tri: e.id }; });
  if (best) best.s = best.d * (p.clone().sub(best.c).dot(best.n) < 0 ? -1 : 1);
  return best;
}
/** Measure the placed nodes: max clip (mm), max floating gap (mm) over every contact slice, and the contact clusters (for seams). */
function qaMeasure(body, nodes, samples, ignoreWheel) {
  var behind = [], front = [], contacts = [], total = 0;
  nodes.forEach(function (node, i) { node.updateMatrixWorld(true);
    samples[i].forEach(function (q) { var p = q.clone().applyMatrix4(node.matrixWorld), h = qaNearest(body, p); total++; if (!h || (ignoreWheel && h.wheel)) return;
      if (h.s < -QA_CLIP_MM / 1000) { if (!body.nearEdge(h.c)) behind.push({ p: p, d: -h.s, by: h.by, node: i, h: h }); }
      else { if (h.d <= 0.02) front.push({ p: p, node: i, c: h.c }); if (!h.wheel && h.d <= QA_NEAR) contacts.push({ p: p, d: Math.max(0, h.s), c: h.c, n: h.n, node: i }); } }); });
  // visible clipping: the part goes behind the car's surface right next to where it is in front of it (a crossing you can see), away from
  // the open edge of a panel (a bumper tucked under a fender edge is how it is built). Deeper hidden parts (behind a grille) do not count.
  var fg = new Map(), fk = function (p) { return Math.floor(p.x / 0.04) + "," + Math.floor(p.y / 0.04) + "," + Math.floor(p.z / 0.04); };
  front.forEach(function (f) { var k = fk(f.p), l = fg.get(k); if (!l) fg.set(k, l = []); l.push(f); });
  var clip = 0, clipN = 0, clipAt = null, cand = [];
  behind.forEach(function (b) { var x = Math.floor(b.p.x / 0.04), y = Math.floor(b.p.y / 0.04), z = Math.floor(b.p.z / 0.04), crossing = false;
    for (var a = -1; a <= 1 && !crossing; a++) for (var c = -1; c <= 1 && !crossing; c++) for (var e = -1; e <= 1 && !crossing; e++) (fg.get((x + a) + "," + (y + c) + "," + (z + e)) || []).forEach(function (f) { if (f.node === b.node && f.p.distanceToSquared(b.p) < 0.0016) crossing = crossing || (body.nearEdge(f.c) ? "tuck" : true); });
    if (crossing === true) cand.push(b); }); // a crossing right at the open edge of a panel = the part tucked under that edge (how it is built)
  // deepest first; a crossing only a camera inside the car could see does not count. At most 30 looked at
  // (ponytail: ray casts without a BVH are slow on big models; a BVH would allow every candidate)
  cand.sort(function (p, q) { return q.d - p.d; });
  var clipTop = []; // the visible crossings, deepest first (diagnosis: one per 10 cm, at most 4)
  for (var ci = 0; ci < cand.length && ci < 30 && clipTop.length < 4; ci++) if (!clipTop.some(function (x) { return cand[ci].p.distanceTo(x.p) < 0.1; }) && body.exterior(cand[ci].h)) { clipTop.push(cand[ci]); if (clipTop.length === 1) { clip = cand[ci].d; clipAt = { at: cand[ci].p.toArray().map(round3), by: String(cand[ci].by).slice(0, 60) }; } }
  clipN = cand.length;
  // a part mostly buried in the car (no visible crossing: nothing of it shows) is not fitted either: its deepest point counts
  if (behind.length > 0.5 * total) { var deep = behind.reduce(function (m, x) { return x.d > m.d ? x : m; }); if (deep.d > clip) { clip = deep.d; clipAt = { at: deep.p.toArray().map(round3), by: String(deep.by).slice(0, 60), buried: true }; } }
  // contact clusters: points within QA_NEAR of the car, linked within 6 cm (same placed copy)
  var lab = new Int32Array(contacts.length).fill(-1), clusters = [];
  for (var i = 0; i < contacts.length; i++) { if (lab[i] >= 0) continue; var cl = [i], k = 0; lab[i] = clusters.length;
    while (k < cl.length) { var a1 = contacts[cl[k++]]; for (var j = 0; j < contacts.length; j++) if (lab[j] < 0 && contacts[j].node === a1.node && contacts[j].p.distanceToSquared(a1.p) < 0.0036) { lab[j] = clusters.length; cl.push(j); } }
    clusters.push(cl.map(function (x) { return contacts[x]; })); }
  // floating: a cluster that touches nowhere floats by its closest point; a touching one is cut into 5 cm slices along its contact footprint
  // (points <= 6 mm) and each slice must touch (<= QA_GAP_MM) too: a corner or a heel lifting off counts, not just the measured points
  var gap = 0, worst = null, spots = []; // spots: every floating slice (diagnosis: the 4 widest, one per 10 cm)
  clusters.forEach(function (cl) {
    var mn = Math.min.apply(null, cl.map(function (c) { return c.d; }));
    if (mn > QA_GAP_MM / 1000) { spots.push({ d: mn, p: cl[0].p }); if (mn > gap) { gap = mn; worst = cl[0].p.toArray().map(round3); } return; }
    var fp = cl.filter(function (c) { return c.d <= 0.006; }), bx = new THREE.Box3(); fp.forEach(function (c) { bx.expandByPoint(c.p); });
    var sz = bx.getSize(new THREE.Vector3()), ax = sz.x >= sz.y && sz.x >= sz.z ? "x" : sz.y >= sz.z ? "y" : "z", sl = {};
    cl.forEach(function (c) { if (c.p[ax] < bx.min[ax] || c.p[ax] > bx.max[ax]) return; var s1 = Math.floor((c.p[ax] - bx.min[ax]) / 0.05); if (!sl[s1] || c.d < sl[s1].d) sl[s1] = c; });
    Object.keys(sl).forEach(function (s1) { if (sl[s1].d > QA_GAP_MM / 1000) spots.push(sl[s1]); if (sl[s1].d > gap) { gap = sl[s1].d; worst = sl[s1].p.toArray().map(round3); } }); });
  spots.sort(function (p, q) { return q.d - p.d; }); var gapTop = []; spots.forEach(function (c) { if (gapTop.length < 4 && !gapTop.some(function (x) { return c.p.distanceTo(x.p) < 0.1; })) gapTop.push(c); });
  return { clipMm: round1(clip * 1000), clipSamples: clipN, clipAt: clipAt, clipTop: clipTop.map(function (c) { return { mm: round1(c.d * 1000), at: c.p.toArray().map(round3), by: String(c.by).slice(0, 60) }; }), gapMm: round1(gap * 1000), gapAt: worst, gapTop: gapTop.map(function (c) { return { mm: round1(c.d * 1000), at: c.p.toArray().map(round3) }; }), samples: total, contacts: clusters.length, clusters: clusters };
}
// Tiers: PERFECT = clip <= 2 mm and gap <= 3 mm (a label only); GOOD (shown) = both <= 6 mm, or <= 0.5 % of the part's size when that is
// larger (one copy: a rim, a skirt, a whole bumper); worse = REFUSED. Only visible clipping counts (qaMeasure), so these are what you see.
var QA_GOOD_MM = 6, QA_GOOD_FRAC = 0.005;
function qaLimit(node) { var s = new THREE.Box3().setFromObject(node, true).getSize(new THREE.Vector3()); return round1(Math.max(QA_GOOD_MM, QA_GOOD_FRAC * Math.max(s.x, s.y, s.z) * 1000)); }
var qaPerfect = function (m) { return m.clipMm <= QA_CLIP_MM && m.gapMm <= QA_GAP_MM; };
var qaGood = function (m, lim) { return m.clipMm <= lim && m.gapMm <= lim; };
var qaTier = function (m, lim) { return qaPerfect(m) ? "PERFECT" : qaGood(m, lim) ? "GOOD" : "REFUSED"; };
var qaScore = function (m) { return Math.max(0, m.clipMm - QA_CLIP_MM) + Math.max(0, m.gapMm - QA_GAP_MM); };
// Bumper corners: each end of the part bent on its own (x / y / z, <= 15 mm), fading in from 40 % of the half width to the end (part space;
// w = [[x, y, z] for the -x end, [x, y, z] for the +x end] in metres, divided by the placement's scale).
function cornerT(x, hw) { var a = clamp((Math.abs(x) / hw - 0.4) / 0.6, 0, 1); return a * a * (3 - 2 * a); }
function warpPts(pts, w, hw, sc) { return pts.map(function (q) { var t = cornerT(q.x, hw), e = w[q.x < 0 ? 0 : 1]; return t ? new THREE.Vector3(q.x + e[0] * t / sc[0], q.y + e[1] * t / sc[1], q.z + e[2] * t / sc[2]) : q; }); }
function warpNode(node, w, hw, sc) {
  node.updateMatrixWorld(true); var inv = new THREE.Matrix4().copy(node.matrixWorld).invert(), v = new THREE.Vector3();
  node.traverse(function (m) { if (!m.isMesh || m.userData.shadow) return; var M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), Mi = M.clone().invert(), g = m.geometry.clone(), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); v.copy(warpPts([v], w, hw, sc)[0]).applyMatrix4(Mi); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeBoundingBox(); g.computeBoundingSphere(); m.geometry = g; });
}
/** Seam ribbons (part-local quads) along each contact cluster: 2 cm slices, the point closest to the car, 3 cm wide on the car's surface. */
function qaSeams(m, nodes) {
  var out = nodes.map(function () { return []; });
  m.clusters.forEach(function (cl) { var node = cl[0].node, bx = new THREE.Box3(); cl.forEach(function (c) { bx.expandByPoint(c.p); });
    var sz = bx.getSize(new THREE.Vector3()), ax = sz.x >= sz.y && sz.x >= sz.z ? "x" : sz.y >= sz.z ? "y" : "z", sl = {};
    cl.forEach(function (c) { if (c.d > 0.008) return; var s = Math.floor((c.p[ax] - bx.min[ax]) / 0.02); if (!sl[s] || c.d < sl[s].d) sl[s] = c; });
    var pts = Object.keys(sl).map(Number).sort(function (a, b) { return a - b; }).map(function (s) { return sl[s]; });
    if (pts.length === 1) pts = [{ c: pts[0].c.clone().add(new THREE.Vector3(0.01, 0, 0)), n: pts[0].n }, { c: pts[0].c.clone().add(new THREE.Vector3(-0.01, 0, 0)), n: pts[0].n }];
    var inv = new THREE.Matrix4().copy(nodes[node].matrixWorld).invert();
    for (var i = 0; i + 1 < pts.length && out[node].length < 32; i++) { var A = pts[i].c, B = pts[i + 1].c; if (A.distanceTo(B) > 0.06) continue;
      var n = pts[i].n.clone().add(pts[i + 1].n).normalize(), side = new THREE.Vector3().subVectors(B, A).cross(n).normalize().multiplyScalar(0.015), lift = n.clone().multiplyScalar(0.0015);
      out[node].push([A.clone().add(lift).sub(side), A.clone().add(lift).add(side), B.clone().add(lift).add(side), B.clone().add(lift).sub(side)].map(function (v) { return v.applyMatrix4(inv).toArray().map(r4); }).flat()); } });
  return out;
}
var SEAM_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide });
/** One soft ribbon mesh from seam quads [a,b,c,d] (part-local, b-c on one side): three rows of vertices, dark in the middle, clear at the edges. */
function seamMesh(quads) {
  var pos = [], col = [], idx = [], A = 0.42;
  quads.forEach(function (q) { var base = pos.length / 3, P = function (i) { return [q[i * 3], q[i * 3 + 1], q[i * 3 + 2]]; }, mid = function (i, j) { return P(i).map(function (x, k) { return (x + P(j)[k]) / 2; }); };
    [P(0), mid(0, 1), P(1), P(3), mid(3, 2), P(2)].forEach(function (v, k) { pos.push(v[0], v[1], v[2]); col.push(0, 0, 0, k % 3 === 1 ? A : 0); });
    idx.push(base, base + 1, base + 4, base, base + 4, base + 3, base + 1, base + 2, base + 5, base + 1, base + 5, base + 4); });
  var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
  var m = new THREE.Mesh(g, SEAM_MAT); m.userData.shadow = true; m.userData.seam = true; m.renderOrder = 2; return m;
}
/** A soft ring (rims: the rim lip in the tyre, the shadow in the arch behind the tyre): alpha a at radius ri fading to 0 at ro, facing +x. */
function softRing(ri, ro, a) {
  var g = new THREE.RingGeometry(ri, ro, 64, 1); g.rotateY(Math.PI / 2); var p = g.attributes.position, col = [];
  for (var i = 0; i < p.count; i++) { var r = Math.hypot(p.getY(i), p.getZ(i)); col.push(0, 0, 0, Math.abs(r - ri) < Math.abs(r - ro) ? a : 0); }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); var m = new THREE.Mesh(g, SEAM_MAT); m.userData.shadow = true; m.userData.seam = true; m.renderOrder = 2; return m;
}
/** QA of a fresh fit inside buildAccessory: measure, auto-correct (not rims), refuse; then the correction (baseAdj) as the admin set it. */
function fitQA(car, type, f, place, zone, group, baseAdj, noRefuse, raw) { // raw (evidence only): measured as placed, no auto-correct
  var nodes = place.map(function (p) { return p.o.node; }), skip = zone ? zone.hide.slice() : [], extra = [];
  group.traverse(function (o) { if (o.isMesh && o.userData.residual) extra.push(o); });
  if (type === "RIMS") group.traverse(function (o) { if (o.isMesh && o.userData.tyre) nodes.push(o); }); // built / kept tyres move with the rims
  var setPl = function (j, dx, dy, dz, s) { place.forEach(function (p) { var n = p.o.node, b = p.base; n.position.set(b.pos[0] + (j.x + dx) * p.side, b.pos[1] + j.y + dy, b.pos[2] + j.z + dz);
    n.rotation.set(b.rot[0] + j.rx, b.rot[1] + j.ry * p.side, b.rot[2]); n.scale.fromArray(b.sc).multiplyScalar(j.s * s); n.updateMatrixWorld(true); }); };
  var none = { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1 };
  setPl(none, 0, 0, 0, 1); var box = new THREE.Box3(); nodes.forEach(function (n) { box.expandByObject(n); }); box.expandByScalar(0.12);
  var body = qaBody(car, box, skip, extra); body.setPart(nodes); var samples = nodes.map(function (n) { return qaSamples(n, Math.round(2400 / nodes.length)); });
  // the car's OWN part measured the same way (stock wheels / stock bumper / stock spoiler...): when it already clips as deep, the model is the cause
  var stock = type === "RIMS" ? wheelParts(car).reduce(function (a, q) { return a.concat(q.tyre.concat(q.rim).map(function (e) { return e.obj; })); }, []) : zone ? zone.hide.filter(function (o) { return o.isMesh; }) : [];
  var IW = type === "RIMS", sm = stock.length ? qaMeasure(body, stock, stock.map(function (o) { return qaSamples(o, Math.round(2400 / stock.length)); }), IW) : null;
  var lim = qaLimit(nodes[0]), BUMPER = type === "FRONT_BUMPER" || type === "REAR_BUMPER", hw = place[0].o.size.x / 2, warpOf = function (w, sc) { return w ? [warpPts(samples[0], w, hw, sc || nodes[0].scale.toArray())].concat(samples.slice(1)) : samples; };
  var m0 = qaMeasure(body, nodes, samples, IW), best = { m: m0, d: [0, 0, 0, 1], w: null }, info = { clipMm: m0.clipMm, clipSamples: m0.clipSamples, clipAt: m0.clipAt, gapMm: m0.gapMm, samples: m0.samples, contacts: m0.contacts, gapAt: m0.gapAt, limitMm: lim };
  if (!raw && !qaPerfect(m0) && type !== "RIMS") { // auto-correct towards PERFECT: one axis at a time (a wing's base plate seats down / up to 10 mm), the two best together, scale
    var better = function (m) { var g = qaGood(m, lim), gb = qaGood(best.m, lim); return g !== gb ? g : qaScore(m) < qaScore(best.m) - 1e-6; }; // GOOD first, then closest to PERFECT
    var tryD = function (d) { setPl(none, d[0], d[1], d[2], d[3]); var m = qaMeasure(body, nodes, samples, IW); if (better(m)) best = { m: m, d: d, w: null }; return qaPerfect(m); };
    var axisBest = [0, 0, 0], done = false;
    for (var a = 0; a < 3 && !done; a++) { var ab = Infinity; [0.002, -0.002, 0.004, -0.004, 0.006, -0.006, 0.008, -0.008, 0.01, -0.01].forEach(function (mv) { if (done) return; var d = [0, 0, 0, 1]; d[a] = mv; setPl(none, d[0], d[1], d[2], 1); var m = qaMeasure(body, nodes, samples, IW);
      if (qaScore(m) < ab) { ab = qaScore(m); axisBest[a] = mv; } if (better(m)) best = { m: m, d: d, w: null }; if (qaPerfect(m)) done = true; }); }
    if (!done) done = tryD([axisBest[0], axisBest[1], axisBest[2], 1]);
    (BUMPER ? [1.01, 0.99, 1.02, 0.98, 1.03, 0.97] : [1.02, 0.98]).forEach(function (sc) { if (!done) done = tryD([best.d[0], best.d[1], best.d[2], sc]); }); // bumpers +-3 %
    if (BUMPER && !done) { // each corner on its own: x / y / z up to 15 mm, the best value per axis kept (-x end, +x end, again)
      setPl(none, best.d[0], best.d[1], best.d[2], best.d[3]); var w = [[0, 0, 0], [0, 0, 0]];
      for (var pass = 0; pass < 4 && !done; pass++) for (var sd = pass % 2, ax = 0; ax < 3 && !done; ax++) [0.005, -0.005, 0.01, -0.01, 0.015, -0.015].forEach(function (mv) { if (done) return;
        var t = w.map(function (e) { return e.slice(); }); t[sd][ax] = mv; var m = qaMeasure(body, nodes, warpOf(t), IW); if (better(m)) { best = { m: m, d: best.d, w: t }; w = t; } if (qaPerfect(m)) done = true; });
    }
    setPl(none, best.d[0], best.d[1], best.d[2], best.d[3]);
    if (qaGood(best.m, lim) && (best.w || best.d.some(function (x, i) { return x !== (i < 3 ? 0 : 1); }))) { // bake the correction into the fit
      f.placements = f.placements.map(function (p, i) { var n = nodes[i]; return Object.assign({}, p, { pos: n.position.toArray().map(r4), sc: n.scale.toArray().map(r4) }, i === 0 && best.w ? { warp: best.w.map(function (e) { return e.map(r4); }) } : {}); });
      place.forEach(function (p, i) { p.base = f.placements[i]; });
      if (best.w) warpNode(nodes[0], best.w, hw, f.placements[0].sc);
      info.corrected = { moveMm: best.d.slice(0, 3).map(function (x) { return round1(x * 1000); }), scale: best.d[3] }; if (best.w) info.corrected.cornersMm = best.w.map(function (e) { return e.map(function (x) { return round1(x * 1000); }); });
      info.clipMm = best.m.clipMm; info.gapMm = best.m.gapMm; info.clipAt = best.m.clipAt; info.gapAt = best.m.gapAt;
    }
  }
  if (type === "RIMS") { // the wheel-to-arch gap is meant to be there: a rim's contact is its lip in the tyre (built tyres sit 12 mm over it)
    var seat = Math.max(0, Math.max.apply(null, (f.info.wheels || []).map(function (w) { return w.gapToTyreMm || 0; })));
    best.m = Object.assign({}, m0, { gapMm: round1(seat) }); info.gapMm = best.m.gapMm; info.gapAt = null; info.contacts = 0; }
  if (sm) info.stock = { clipMm: sm.clipMm, clipAt: sm.clipAt };
  info.clipTop = best.m.clipTop || []; info.gapTop = best.m.gapTop || [];
  info.before = { clipMm: m0.clipMm, gapMm: type === "RIMS" ? info.gapMm : m0.gapMm, clipTop: m0.clipTop, gapTop: type === "RIMS" ? [] : m0.gapTop }; info.ok = qaGood(best.m, lim); info.tier = qaTier(best.m, lim);
  if (!info.ok) { info.clipMm = best.m.clipMm; info.gapMm = best.m.gapMm; info.clipAt = best.m.clipAt; info.gapAt = best.m.gapAt; info.bestTryMm = best.d.slice(0, 3).map(function (x) { return round1(x * 1000); }).concat([best.d[3]]); if (best.w) info.bestCornersMm = best.w.map(function (e) { return e.map(function (x) { return round1(x * 1000); }); }); } // the closest it gets
  f.info.qa = info;
  if (!info.ok) { var why = []; if (best.m.clipMm > lim) why.push("goes " + best.m.clipMm + " mm into the car body"); if (best.m.gapMm > lim) why.push("floats " + best.m.gapMm + " mm off the car along a contact edge");
    var msg = "this part does not look fitted on this car (" + why.join(", ") + "; limit " + lim + " mm)"; if (noRefuse) f.info.qa.wouldRefuse = msg; else { var err = new Error(msg); err.info = f.info; throw err; } }
  if (type !== "RIMS") { var seams = qaSeams(best.m, nodes.slice(0, place.length)); f.placements.forEach(function (p, i) { if (seams[i].length) p.seam = seams[i]; }); }
  if (baseAdj) { setPl(addAdj(none, baseAdj), 0, 0, 0, 1); var mc = qaMeasure(body, nodes, warpOf(f.placements[0].warp, f.placements[0].sc), IW); if (type === "RIMS") mc.gapMm = best.m.gapMm; f.info.qa.correction = { adj: baseAdj, clipMm: mc.clipMm, gapMm: mc.gapMm, ok: qaGood(mc, lim), tier: qaTier(mc, lim) }; }
  setPl(none, 0, 0, 0, 1);
}
/** A stored rims runtime (replayed from the server): which wheels take the rim, which stock tyre pieces stay, each wheel's move (<= 5 cm). */
function validRimRuntime(r) {
  var name = function (x) { return typeof x === "string" && x.length <= 40; };
  return !!r && Array.isArray(r.active) && r.active.length <= 4 && r.active.every(name) && Array.isArray(r.kept) && r.kept.length <= 400 && r.kept.every(name) && (r.hideBrakes === undefined || (Array.isArray(r.hideBrakes) && r.hideBrakes.length <= 200 && r.hideBrakes.every(name)))
    && Array.isArray(r.offsets) && r.offsets.length <= 4 && r.offsets.every(function (o) { return o && name(o.wheel) && Array.isArray(o.delta) && o.delta.length === 3 && o.delta.every(function (n) { return typeof n === "number" && isFinite(n) && Math.abs(n) <= 0.05; }); });
}
function validFit(f, type) {
  return !!f && f.version === fitVersion(type) && f.type === type && Array.isArray(f.orient) && f.orient.length === 3 && Array.isArray(f.placements) && f.placements.length > 0 && f.placements.length <= 4
    && f.placements.every(function (p) { return [p.pos, p.sc, p.rot].every(function (a) { return Array.isArray(a) && a.length === 3 && a.every(function (n) { return typeof n === "number" && isFinite(n) && Math.abs(n) < 50; }); }) && (p.side === 1 || p.side === -1); })
    && (!f.tyres || (Array.isArray(f.tyres) && f.tyres.length <= 4)) && (!f.keep || (Array.isArray(f.keep) && f.keep.length <= 40)) && (!f.hideMore || (Array.isArray(f.hideMore) && f.hideMore.length <= 60 && f.hideMore.every(function (n) { return typeof n === "string"; })))
    && (!f.shift || (Array.isArray(f.shift) && f.shift.length <= 40 && f.shift.every(function (x) { return Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number" && Math.abs(x[1]) <= 0.05; })))
    && (!f.rimRuntime || validRimRuntime(f.rimRuntime))
    && (!f.rings || (Array.isArray(f.rings) && f.rings.length <= 8 && f.rings.every(function (g) { return g && [g.c, g.rot].every(function (a) { return Array.isArray(a) && a.length === 3 && a.every(function (n) { return typeof n === "number" && isFinite(n) && Math.abs(n) < 50; }); }) && [g.ri, g.ro, g.a].every(function (n) { return typeof n === "number" && n >= 0 && n < 2; }); })))
    && f.placements.every(function (p) { return p.warp === undefined || (Array.isArray(p.warp) && p.warp.length === 2 && p.warp.every(function (e) { return Array.isArray(e) && e.length === 3 && e.every(function (n) { return typeof n === "number" && isFinite(n) && Math.abs(n) <= 0.016; }); })); })
    && f.placements.every(function (p) { return p.seam === undefined || (Array.isArray(p.seam) && p.seam.length <= 32 && p.seam.every(function (q) { return Array.isArray(q) && q.length === 12 && q.every(function (n) { return typeof n === "number" && isFinite(n) && Math.abs(n) < 100; }); })); });
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
  if (stored) place.forEach(function (p, i) { var w = f.placements[i].warp; if (w) warpNode(p.o.node, w, p.o.size.x / 2, f.placements[i].sc); }); // bumper corners (fitQA)
  (f.tyres || []).forEach(function (ty) { var m = new THREE.Mesh(tyreGeometry(ty.ri, ty.ro, ty.w, Array.isArray(ty.prof) && ty.prof.every(function (n) { return typeof n === "number" && n > 0 && n < 2; }) ? ty.prof : null), TYRE_MAT); m.position.fromArray(ty.c); if(ty.rot)m.rotation.fromArray(ty.rot); m.userData.shadow = true; m.userData.tyre = true; group.add(m); }); // built tyres (not painted / finished)
  (f.rings || []).forEach(function (g) { var m = softRing(g.ri, g.ro, g.a); if (g.half) { m.geometry.dispose(); m.geometry = new THREE.RingGeometry(g.ri, g.ro, 48, 1, 0, Math.PI); m.geometry.rotateY(Math.PI / 2); var p = m.geometry.attributes.position, col = []; for (var i = 0; i < p.count; i++) col.push(0, 0, 0, Math.abs(Math.hypot(p.getY(i), p.getZ(i)) - g.ri) < Math.abs(Math.hypot(p.getY(i), p.getZ(i)) - g.ro) ? g.a : 0); m.geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); }
    m.position.fromArray(g.c); m.rotation.fromArray(g.rot); group.add(m); }); // rims: soft seams (rim lip in the tyre, arch shadow over the tyre)
  if (zone && f.keep && f.keep.length) zone = Object.assign({}, zone, { hide: zone.hide.filter(function (o) { return f.keep.indexOf(o.name) < 0; }) }); // the stock tyres stay
  if (zone && f.hideMore && f.hideMore.length) { var more = []; car.root.traverse(function (o) { if (o.isMesh && f.hideMore.indexOf(o.name) >= 0 && zone.hide.indexOf(o) < 0) more.push(o); }); zone = Object.assign({}, zone, { hide: zone.hide.concat(more) }); } // rims: pieces that would clash with the new spokes
  var shifts = []; (f.shift || []).forEach(function (x) { car.root.traverse(function (o) { if (!o.isMesh || o.name !== x[0]) return;
    var p0 = o.getWorldPosition(new THREE.Vector3()), a = o.parent.worldToLocal(p0.clone()), b = o.parent.worldToLocal(p0.clone().add(new THREE.Vector3(x[1], 0, 0)));
    shifts.push({ o: o, orig: o.position.clone(), d: b.sub(a) }); }); });
  if(type === "RIMS" && f.rimRuntime) { var rr=rimRuntime(car,f,group), more2=[]; car.root.traverse(function (o) { if (o.isMesh && (f.hideMore || []).indexOf(o.name) >= 0 && rr.hide.indexOf(o) < 0) more2.push(o); }); zone={hide:rr.hide.concat(more2),T:car.rb.clone(),box:car.rb.clone(),how:"runtime wheels"}; }
  if (!stored) fitQA(car, type, f, place, zone, group, kit.baseAdj && typeof kit.baseAdj === "object" ? kit.baseAdj : null, kit.qaEvidence === true, !!(kit.size && kit.size.qaRaw === true)); // measures, may correct the placements, or throws the reason
  place.forEach(function (p, i) { var sm = f.placements[i].seam; if (sm && sm.length) p.o.node.add(seamMesh(sm)); }); // soft seams along every contact
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
  // stand on the real lowest point (the tyres on every catalog car): the loose box above counts rotated meshes' boxes and can reach far
  // below them (Fabia 198 mm, Corolla E170 80 mm, E36 12 mm of floating). Before the part map: piece boxes are measured after this.
  var low = new THREE.Box3().setFromObject(root, true).min.y - (m.groundOffset || 0);
  if (low > 0.0005) { root.position.y -= low; group.updateMatrixWorld(true); }

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
  car.stockVisibility = car.stockVisibility || new WeakMap();
  car.stockHidden = car.stockHidden || new Set();
  var hidden = new Set();
  var ks = kitList(s), want = {}; ks.forEach(function (k) { want[k.type + "|" + k.file] = k; });
  Object.keys(car.accs).forEach(function (key) { if (want[key]) return; var a = car.accs[key];
    car.group.remove(a.group); (a.shifts || []).forEach(function (x) { x.o.position.copy(x.orig); }); delete car.accs[key]; if (car.acc === a) car.acc = null; });
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
    if (a.zone) a.zone.hide.forEach(function (o) { hidden.add(o); });
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
  // Capture on the first hide and restore after the last replacement releases the object.
  // A later ON cycle must capture its current visibility again, including an already hidden stock piece.
  car.stockHidden.forEach(function (o) { if (!hidden.has(o)) { o.visible = car.stockVisibility.get(o); car.stockVisibility.delete(o); } });
  hidden.forEach(function (o) { if (!car.stockVisibility.has(o)) car.stockVisibility.set(o, o.visible); o.visible = false; });
  car.stockHidden = hidden;
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
  boxApply(pe.boxPts);
  var k = JSON.stringify([pe.label, pe.labels]); if (car.edit.key === k) return; car.edit.key = k;
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
function editHit(e) {
  var r = renderer.domElement.getBoundingClientRect(), rc = new THREE.Raycaster();
  rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  return rc.intersectObjects(car.edit.meshes, false).filter(function (h) { return h.object.visible; })[0];
}
function pickPiece(e) {
  var hit = editHit(e);
  if (hit) post({ type: "pick", id: "m" + hit.object.userData.pi + "c" + segment(hit.object).tri[hit.faceIndex] });
}
// Box mode (state.partEdit.boxPts = the tapped points, world space): a tap posts { type: "boxPt", p: [x, y, z] }; the points' min/max is the box
// (green); with 4 points every piece whose bounds lie inside it (2 % of the car's size tolerance) is posted as { type: "boxIds", ids }.
function boxPoint(e) { var hit = editHit(e); if (hit) post({ type: "boxPt", p: hit.point.toArray().map(function (n) { return Math.round(n * 1e4) / 1e4; }) }); }
function boxApply(pts) {
  var k = JSON.stringify(pts || null); if (car.edit.boxKey === k) return; car.edit.boxKey = k;
  if (car.edit.boxG) { car.group.remove(car.edit.boxG); car.edit.boxG = null; }
  if (!Array.isArray(pts) || !pts.length) return;
  var g = new THREE.Group(), b = new THREE.Box3(), s = car.rb.getSize(new THREE.Vector3()), dot = new THREE.SphereGeometry(Math.max(s.x, s.y, s.z) * 0.008, 12, 8);
  pts.forEach(function (p) { var v = new THREE.Vector3(p[0], p[1], p[2]), m = new THREE.Mesh(dot, RED); m.position.copy(v); m.renderOrder = 3; g.add(m); b.expandByPoint(v); });
  if (pts.length > 1) { var c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.005, 0.005, 0.005)), m = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), GREEN);
    m.position.copy(c); m.renderOrder = 2; g.add(m); g.add(new THREE.Box3Helper(b, 0x2e9d4f)); }
  car.group.add(g); car.edit.boxG = g;
  if (pts.length < 4) return;
  var tol = b.clone(); tol.min.addScaledVector(s, -0.02); tol.max.addScaledVector(s, 0.02);
  var ids = []; car.edit.meshes.forEach(function (o) { segment(o).boxes.forEach(function (pb, c) { if (tol.containsBox(pb)) ids.push("m" + o.userData.pi + "c" + c); }); });
  post({ type: "boxIds", ids: ids });
}
var building = null;
async function apply() {
  var s = state; if (!s) return;
  scene.background = new THREE.Color(s.bg);
  controls.enabled = !!s.interactive;
  controls.autoRotate = !s.reduced && !!s.autoRotate && !(s.partEdit && s.partEdit.boxPts); // paused in Box mode so taps land
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
  if (state.partEdit && car && car.edit) { if (state.partEdit.boxPts) boxPoint(e); else pickPiece(e); return; } // editor: a tap selects a piece (no double-tap reset)
  var now = Date.now(); if (now - lastTap < 320) { reset(); lastTap = 0; } else lastTap = now;
});
window.addEventListener("resize", function () { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
renderer.setAnimationLoop(function () { if (document.hidden) return; controls.update(); renderer.render(scene, camera); });
window.__dbg = { THREE: THREE, scene: scene, camera: camera, controls: controls, home: home, handle: handle, state: function () { return state; }, car: function () { return car; } };
post({ type: "ready" });
</script>
</body></html>`;
