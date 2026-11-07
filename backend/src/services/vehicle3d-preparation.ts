// Shared implementation extracted from scripts/optimize-3d.ts. Preparation never publishes assets.
import {Logger, getBounds, type Document, type Node} from "@gltf-transform/core";
import {dedup, meshopt, prune, simplify, textureCompress, weld} from "@gltf-transform/functions";
import {MeshoptEncoder, MeshoptSimplifier} from "meshoptimizer";
import sharp from "sharp";
import {readSafeGLB, fail} from "./vehicle3d-validation.js";
import {MAX_SOURCE_BYTES} from "./sketchfab-client.js";
export const FINAL_MODEL_BYTES=8*1024*1024;
const LENGTH_M: Record<string, number> = {
  "toyota|corolla": 4.6, "toyota|yaris": 3.9, "toyota|camry": 4.85, "toyota|rav4": 4.6, "toyota|hilux": 5.3, "toyota|land cruiser": 4.95, "toyota|prius": 4.5, "toyota|c-hr": 4.36,
  "hyundai|elantra": 4.6, "hyundai|accent": 4.3, "hyundai|i10": 3.65, "hyundai|i20": 4.0, "hyundai|i30": 4.3, "hyundai|tucson": 4.5, "hyundai|santa fe": 4.7, "hyundai|sonata": 4.85, "hyundai|kona": 4.2,
  "kia|picanto": 3.6, "kia|rio": 4.1, "kia|cerato": 4.55, "kia|sportage": 4.5, "kia|sorento": 4.75, "kia|niro": 4.35, "kia|stonic": 4.14, "kia|optima": 4.85,
  "volkswagen|golf": 4.25, "volkswagen|polo": 4.0, "volkswagen|passat": 4.8, "volkswagen|jetta": 4.65, "volkswagen|tiguan": 4.5, "volkswagen|caddy": 4.4, "volkswagen|transporter": 4.9,
  "skoda|octavia": 4.65, "skoda|fabia": 4.0, "skoda|superb": 4.85, "skoda|kodiaq": 4.7, "skoda|karoq": 4.38,
  "mercedes-benz|a-class": 4.3, "mercedes-benz|c-class": 4.7, "mercedes-benz|e-class": 4.9, "mercedes-benz|s-class": 5.15, "mercedes-benz|vito": 5.0, "mercedes-benz|sprinter": 5.9,
  "bmw|1 series": 4.3, "bmw|3 series": 4.65, "bmw|5 series": 4.9, "bmw|x1": 4.45, "bmw|x3": 4.7, "bmw|x5": 4.9,
  "peugeot|208": 4.05, "peugeot|301": 4.44, "peugeot|308": 4.3, "peugeot|2008": 4.2, "peugeot|3008": 4.45, "peugeot|partner": 4.4,
  "renault|clio": 4.05, "renault|megane": 4.35, "renault|kangoo": 4.3, "renault|captur": 4.2, "renault|symbol": 4.26,
  "mitsubishi|outlander": 4.7, "mitsubishi|asx": 4.3, "mitsubishi|attrage": 4.3, "mitsubishi|l200": 5.3, "mitsubishi|lancer": 4.57, "mitsubishi|pajero": 4.9,
  "nissan|sunny": 4.45, "nissan|micra": 3.85, "nissan|qashqai": 4.4, "nissan|x-trail": 4.65, "nissan|juke": 4.2, "nissan|navara": 5.25,
  "ford|transit": 5.5, "ford|kuga": 4.55, "ford|ranger": 5.35, "ford|focus": 4.4, "ford|fiesta": 4.0,
  "seat|ibiza": 4.06, "seat|leon": 4.3, "seat|arona": 4.14, "seat|ateca": 4.36,
  "audi|a3": 4.3, "audi|a4": 4.75, "audi|a6": 4.95, "audi|q3": 4.4, "audi|q5": 4.65, "audi|q7": 5.05,
  "opel|corsa": 4.05, "opel|astra": 4.37, "opel|mokka": 4.25, "opel|insignia": 4.85,
};

// "EXT_Calipers2" -> ext, calipers; "carPaint.004" -> car, paint (trailing numbers dropped)
const words = (s: string) => new Set(s.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).map((w) => w.replace(/\d+$/, "")).filter(Boolean));
const any = (w: Set<string>, list: string[]) => list.some((x) => w.has(x));
const INTERIOR = ["interior", "int", "seat", "seats", "seatbelt", "belt", "belts", "dashboard", "dash", "steering", "steeringwheel", "carpet", "pedal", "pedals", "headliner", "console", "speaker", "gearstick", "gearshift", "shifter", "handbrake", "inside", "upholstery", "armrest", "headrest"];
const SCENERY = ["plane", "ground", "floor", "backdrop", "studio", "platform", "turntable", "environment", "background", "shadowplane", "garage"];
const NOT_PAINT = ["glass", "window", "windows", "windshield", "windscreen", "chrome", "trim", "rubber", "tire", "tyre", "tires", "tyres", "rim", "rims", "wheel", "wheels", "light", "lights", "lamp", "plate", "black", "plastic", "mirror", "grille", "grill", "interior", "int", "badge", "logo", "emblem", "brake", "brakes", "caliper", "calipers", "disc", "discs", "exhaust", "carbon", "matte", "housing", "gauge", "gauges", "needle", "needles", "wireframe", "edge", "alu", "aluminium", "metal", "lightplate", "salon", "steer", "movsteer", "details", "detail", "tertiary", "pneu", "mirrors", "lamps", "headlight", "taillight", "number", "license", "licence"];
const PAINT = ["paint", "carpaint", "body", "bodywork", "exterior", "chassis", "karosserie", "shell", "pintura", "kuzov", "colour", "color"];
/** "Color_M01", "Color.002": converter colour slots, not paint */
const GENERIC_COLOR = /^colou?r[\s_.-]*[a-z]?\d*$/i;
const WHEEL = ["wheel", "wheels", "tire", "tyre", "rim", "rims"];
const FRONT = ["headlight", "headlights", "headlamp", "headlamps", "head", "grille", "grill", "front", "frontbumper", "radiator"];
const REAR = ["taillight", "taillights", "taillamp", "tail", "rear", "back", "exhaust", "trunk", "boot"];

const vertexCount = (n: Node) => {
  let v = 0;
  n.traverse((c) => c.getMesh()?.listPrimitives().forEach((p) => (v += p.getAttribute("POSITION")?.getCount() ?? 0)));
  return v;
};

function strip(doc: Document, key: string) {
  const interior = key.startsWith("seat-") ? INTERIOR.filter((x) => x !== "seat") : INTERIOR; // "SEAT Ibiza" is not a seat
  const total = vertexCount((doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]) as unknown as Node) || 1;
  const hits = new Set<Node>();
  for (const n of doc.getRoot().listNodes()) {
    const mats = n.getMesh()?.listPrimitives().map((p) => p.getMaterial()?.getName() ?? "") ?? [];
    const own = words(`${n.getName()} ${n.getMesh()?.getName() ?? ""}`);
    if (any(own, interior) || any(own, SCENERY) || (mats.length > 0 && mats.every((m) => any(words(m), interior)))) hits.add(n);
  }
  const top = [...hits].filter((n) => { for (let p = n.getParentNode(); p; p = p.getParentNode()) if (hits.has(p)) return false; return true; });
  // never the car itself: if the "interior" adds up to over half the vertices, the names are lying -> remove nothing ("check")
  if (top.reduce((v, n) => v + vertexCount(n), 0) > total / 2) return -1;
  for (const n of top) {
    n.traverse((c) => c !== n && c.dispose());
    n.dispose();
  }
  return top.length;
}

/** Paint = materials named like body paint (not glass / chrome / tyres ...); else the biggest plain coloured one ("check"). */
function findPaint(doc: Document): { names: string[]; sure: boolean } {
  const mats = doc.getRoot().listMaterials();
  const named = mats.filter((m) => { const w = words(m.getName()); return any(w, PAINT) && !any(w, NOT_PAINT) && !GENERIC_COLOR.test(m.getName()); });
  if (named.length) return { names: named.map((m) => m.getName()), sure: true };
  if (mats.length < 3) return { names: [], sure: false }; // one texture atlas: painting it would paint the lights too
  const tris = new Map<string, number>();
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const m = p.getMaterial();
      if (!m || m.getAlphaMode() === "BLEND" || any(words(m.getName()), NOT_PAINT)) continue;
      const [r, g, b] = m.getBaseColorFactor();
      if (0.2126 * r + 0.7152 * g + 0.0722 * b < 0.04) continue; // black plastic / tyres
      tris.set(m.getName(), (tris.get(m.getName()) ?? 0) + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")?.getCount() ?? 0) / 3);
    }
  const best = [...tris.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? { names: [best[0]], sure: false } : { names: [], sure: false };
}

/** Turn about Y that puts the front at +Z, from where the head- vs tail-light named parts sit along the long axis. */
function findFront(doc: Document): { rotateY: number; sure: boolean } {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const bb = getBounds(scene);
  const alongX = bb.max[0] - bb.min[0] > bb.max[2] - bb.min[2];
  const axis = alongX ? 0 : 2;
  let front = 0, rear = 0, nf = 0, nr = 0;
  for (const n of doc.getRoot().listNodes()) {
    if (!n.getMesh()) continue;
    const w = words(`${n.getName()} ${n.getMesh()!.getName()} ${n.getMesh()!.listPrimitives().map((p) => p.getMaterial()?.getName() ?? "").join(" ")}`);
    const b = getBounds(n);
    const c = (b.min[axis] + b.max[axis]) / 2;
    if (!Number.isFinite(c)) continue;
    if (any(w, FRONT) && !any(w, REAR)) (front += c), nf++;
    else if (any(w, REAR) && !any(w, FRONT)) (rear += c), nr++;
  }
  const sure = nf > 0 && nr > 0;
  const plus = sure ? front / nf > rear / nr : true; // no clue: assume +, mark check
  // three.js: rotation.y = t sends +X to (cos t, 0, -sin t)
  const rotateY = alongX ? (plus ? -Math.PI / 2 : Math.PI / 2) : plus ? 0 : Math.PI;
  return { rotateY, sure };
}

const wheelsSeparate = (doc: Document) => doc.getRoot().listNodes().filter((n) => n.getMesh() && any(words(`${n.getName()} ${n.getMesh()!.getName()}`), WHEEL)).length >= 4;


export const vehicleLength=(make:string,model:string)=>LENGTH_M[`${make}|${model}`.toLowerCase()]??4.5;
export async function optimizeVehicleSource(bytes:Buffer,key:string) {
  await MeshoptEncoder.ready;await MeshoptSimplifier.ready;
  const safe=await readSafeGLB(bytes,2_000_000,{maxBytes:MAX_SOURCE_BYTES,textureSize:8192,pixels:128_000_000});
  const io=safe.io.registerDependencies({"meshopt.encoder":MeshoptEncoder});
  let doc=safe.doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const removed=strip(doc,key),paint=findPaint(doc),front=findFront(doc),rims=wheelsSeparate(doc);
  let output:Buffer=Buffer.alloc(0);
  for(const size of [1024,512,0]) {
    if(size!==1024){doc=(await io.readBinary(bytes)).setLogger(new Logger(Logger.Verbosity.ERROR));strip(doc,key);}
    const thin=size===0?[simplify({simplifier:MeshoptSimplifier,ratio:0.5,error:0.001})]:[];
    await doc.transform(prune(),dedup(),weld(),...thin,textureCompress({encoder:sharp,targetFormat:"webp",resize:[size||512,size||512],quality:82}),meshopt({encoder:MeshoptEncoder,level:"medium"}),prune());
    output=Buffer.from(await io.writeBinary(doc));if(output.length<=FINAL_MODEL_BYTES)break;
  }
  if(output.length>FINAL_MODEL_BYTES)return fail("FINAL_ASSET_TOO_LARGE","The optimized model is larger than 8 MiB.",422);
  return {bytes:output,paintMaterials:paint.names,paintCertain:paint.sure,rotateY:front.rotateY,rimsSwappable:rims,
    report:{bytesBefore:bytes.length,bytesAfter:output.length,textures:doc.getRoot().listTextures().length,removed:Math.max(0,removed),
      warnings:[...(removed<0?["Interior kept: names are ambiguous."]:[]),...(!paint.sure?["Paint segmentation requires review; automatic recoloring is disabled."]:[]),...(!front.sure?["Front direction requires visual confirmation."]:[])]}};
}
