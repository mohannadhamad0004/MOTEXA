import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const MAX_MODEL_BYTES = Math.min(20, Math.max(1, Number(process.env.VEHICLE3D_MAX_MB) || 8)) * 1024 * 1024;
export class Vehicle3DError extends Error {
  constructor(public status: number, public code: string, message: string, public issues?: { code: string; field: string; message: string }[]) { super(message); }
}
export const fail = (code: string, message: string, status = 400): never => { throw new Vehicle3DError(status, code, message); };
export const digest = (bytes: Buffer | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function stripGLBMetadata(bytes:Buffer){
  const length=bytes.readUInt32LE(12),data=JSON.parse(bytes.toString("utf8",20,20+length));
  const clean=(v:any)=>{if(!v||typeof v!=="object")return;delete v.extras;delete v.name;for(const child of Object.values(v))clean(child);};
  clean(data);delete data.asset.copyright;data.asset.generator="MOTEXA";
  const text=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,0x20);text.copy(padded);
  const rest=bytes.subarray(20+length),header=Buffer.alloc(20);header.write("glTF");header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+rest.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  return Buffer.concat([header,padded,rest]);
}
/** Reject external resources before parsing: validation must never fetch client-selected URLs. */
/** Reject external resources before parsing: validation must never fetch client-selected URLs. Shared by vehicles and accessories: self-contained, bounded resources/textures/geometry, finite triangles. */
export async function readSafeGLB(bytes: Buffer, maxTriangles: number, limits: {maxBytes?:number; textureSize?:number; pixels?:number} = {}) {
  if (!bytes.length || bytes.length > (limits.maxBytes ?? MAX_MODEL_BYTES)) return fail("INVALID_GLB", "Model exceeds the configured size limit.");
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length
    || bytes.readUInt32LE(16) !== 0x4e4f534a || bytes.readUInt32LE(12) > bytes.length - 20) return fail("INVALID_GLB", "Invalid GLB container.");
  let json: any;
  try { json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)).trim()); }
  catch { return fail("INVALID_GLB", "Invalid GLB JSON."); }
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some((r: any) => r.uri)) return fail("INVALID_GLB", "Model must be self-contained, with no resource URLs.");
  if (json.skins?.length || json.animations?.length) return fail("INVALID_GLB", "Animated or skinned models are not supported for catalog promotion.");
  if ((json.buffers ?? []).reduce((total:number,b:any)=>total+(Number.isSafeInteger(b.byteLength)&&b.byteLength>=0?b.byteLength:Infinity),0)>128*1024*1024)
    return fail("INVALID_GLB", "Decoded geometry exceeds the safe memory limit.");
  if ((json.buffers ?? []).some((b: any) => b.byteLength > 128 * 1024 * 1024) || (json.accessors ?? []).some((a: any) => a.count > 2_000_000)) return fail("INVALID_GLB", "Decoded geometry exceeds the safe memory limit.");
  const binStart = 20 + bytes.readUInt32LE(12) + 8;
  let pixels = 0;
  for (const image of json.images ?? []) {
    const view = json.bufferViews?.[image.bufferView];
    if (!view || !["image/jpeg", "image/png", "image/webp"].includes(image.mimeType)) return fail("INVALID_GLB", "Only embedded JPEG, PNG and WebP textures are supported.");
    const start = binStart + (view.byteOffset ?? 0), end = start + view.byteLength;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < binStart || end > bytes.length) return fail("INVALID_GLB", "Texture buffer is invalid.");
    try {
      const meta = await sharp(bytes.subarray(start,end), { limitInputPixels: limits.pixels ?? 32_000_000 }).metadata();
      if (!meta.width || !meta.height || meta.width > (limits.textureSize ?? 4096) || meta.height > (limits.textureSize ?? 4096)) throw new Error();
      pixels += meta.width * meta.height;
      if (pixels > (limits.pixels ?? 32_000_000)) throw new Error();
    } catch { return fail("INVALID_GLB", "Textures exceed safe decoding limits or cannot be loaded."); }
  }
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  let doc;
  try { doc = await io.readBinary(bytes); } catch { return fail("INVALID_GLB", "GLB could not be loaded."); }
  const scenes = doc.getRoot().listScenes();
  if (scenes.length !== 1 || !scenes[0]!.listChildren().length) return fail("INVALID_GLB", "Model must contain one nonempty scene.");
  const scene = scenes[0]!;
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute("POSITION"), array = pos?.getArray();
    if (!array || !Array.from(array).every(Number.isFinite) || p.getMode() !== 4) return fail("INVALID_GLB", "Only finite triangle geometry is supported.");
    const indices = p.getIndices()?.getArray();
    if (indices && Array.from(indices).some(i => i < 0 || i >= pos!.getCount())) return fail("INVALID_GLB", "Invalid geometry indices.");
    triangles += (p.getIndices()?.getCount() ?? pos!.getCount()) / 3;
  }
  if (!triangles || triangles > maxTriangles) return fail("INVALID_GLB", `Model needs nonzero geometry and at most ${maxTriangles.toLocaleString("en")} triangles.`);
  return { doc, io, scene, triangles };
}

export async function normalizeVehicle(bytes: Buffer, lengthM: number, options: {preRotateX?: number; rotateY?: number; stripPrivateMetadata?: boolean} = {}) {
  const { doc, io, scene, triangles } = await readSafeGLB(bytes, 500_000);
  if (!Number.isFinite(lengthM) || lengthM < 2.5 || lengthM > 8) return fail("INVALID_GLB", "Vehicle length must be between 2.5 and 8 metres.");
  const dimensions = () => {
    const b = getBounds(scene), size = b.max.map((v, i) => v - b.min[i]!);
    if (![...b.min, ...b.max, ...size].every(Number.isFinite) || size.some(v => v < 0.00001 || v > 1e7)) return fail("INVALID_GLB", "Invalid or extreme model bounds.");
    return { b, size };
  };
  const sourceBounds = dimensions();
  const correction = doc.createNode("MOTEXA_axis_correction");
  const rx=options.preRotateX??0, ry=options.rotateY??0;
  if (![rx,ry].every(n=>Number.isFinite(n)&&Math.abs(n)<=Math.PI*2)) return fail("INVALID_ORIENTATION", "Orientation must be a finite rotation within one turn.");
  for (const child of scene.listChildren()) {scene.removeChild(child);correction.addChild(child);}
  const tilt=doc.createNode("MOTEXA_source_up").setRotation([Math.sin(rx/2),0,0,Math.cos(rx/2)]);
  tilt.addChild(correction);scene.addChild(tilt);
  // Heading is applied outside the up-axis wrapper, matching the actual mobile viewer order.
  const heading=doc.createNode("MOTEXA_heading").setRotation([0,Math.sin(ry/2),0,Math.cos(ry/2)]);
  scene.removeChild(tilt);heading.addChild(tilt);scene.addChild(heading);
  let { size } = dimensions();
  if (size[1]! > Math.max(size[0]!, size[2]!) * 0.85) return fail("INVALID_GLB", "Model is not upright. Correct its orientation before review.");
  const wrapper = doc.createNode("MOTEXA_normalized_vehicle");
  for (const child of scene.listChildren()) { scene.removeChild(child); wrapper.addChild(child); }
  scene.addChild(wrapper);
  if (size[0]! > size[2]!) wrapper.setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  const current = dimensions(); size = current.size;
  const width = size[0]! / size[2]!, height = size[1]! / size[2]!;
  if (width < 0.2 || width > 0.85 || height < 0.15 || height > 0.85) return fail("INVALID_GLB", "Bounds do not have sensible vehicle proportions.");
  const scale = lengthM / size[2]!;
  if (scale < 1e-5 || scale > 1e5) return fail("INVALID_GLB", "Model scale is extreme.");
  wrapper.setScale([scale, scale, scale]);
  wrapper.setTranslation([-(current.b.min[0]! + current.b.max[0]!) * scale / 2, -current.b.min[1]! * scale,
    -(current.b.min[2]! + current.b.max[2]!) * scale / 2]);
  if (options.stripPrivateMetadata) {
    const asset=doc.getRoot().getAsset() as Record<string,unknown>;
    delete asset.extras;delete asset.copyright;asset.generator="MOTEXA private vehicle preparation";
    doc.getRoot().setExtras({});
    const collections=[doc.getRoot().listNodes(),doc.getRoot().listMeshes(),doc.getRoot().listMaterials(),doc.getRoot().listTextures(),doc.getRoot().listScenes(),doc.getRoot().listAccessors(),doc.getRoot().listBuffers()];
    for(const collection of collections)collection.forEach((p,i)=>{p.setExtras({});p.setName(`vehicle-${p.propertyType}-${i}`);});
  }
  const materials=doc.getRoot().listMaterials().map(m=>({alphaMode:m.getAlphaMode(),doubleSided:m.getDoubleSided()}));
  const warnings=["Vehicle identity, front direction, upright orientation, wheels, glazing and scenery require visual verification."];
  if (doc.getRoot().listNodes().filter(n=>n.getMesh()).length>150) warnings.push("Many separate mesh nodes: inspect for detached parts or scenery.");
  const encoded=Buffer.from(await io.writeBinary(doc));
  const output = options.stripPrivateMetadata?stripGLBMetadata(encoded):encoded;
  if (output.length > MAX_MODEL_BYTES) return fail("INVALID_GLB", "Normalized model exceeds the configured size limit.");
  const normalized = dimensions();
  return { bytes: output, report: { valid: true, sha256: digest(output), triangles: Math.floor(triangles), bytes: output.length,
    lengthM, dimensions: normalized.size, sourceDimensions:sourceBounds.size, textures:doc.getRoot().listTextures().length, materials:materials.length,
    transparentMaterials:materials.filter(m=>m.alphaMode!=="OPAQUE").length, animations:0,warnings,
    uprightProportions: true, uprightOrientation: "admin_visual_required", frontDirection:"admin_visual_required", visualVerificationRequired: true } };
}

/** A loose accessory part (shop photos -> provider, Feature 2): the same safety limits, then centred on x/z and standing on y = 0,
 *  names / extras / copyright stripped. No scaling or orientation guess here: the viewer fits it to the car (real size from the product). */
export async function normalizeAccessory(bytes: Buffer) {
  const { doc, io, scene, triangles } = await readSafeGLB(bytes, 300_000);
  const b = getBounds(scene), size = b.max.map((v, i) => v - b.min[i]!);
  if (![...b.min, ...b.max, ...size].every(Number.isFinite) || size.some(v => v < 0.00001 || v > 1e7)) return fail("INVALID_GLB", "Invalid or extreme model bounds.");
  const wrapper = doc.createNode("MOTEXA_accessory");
  for (const child of scene.listChildren()) { scene.removeChild(child); wrapper.addChild(child); }
  scene.addChild(wrapper);
  wrapper.setTranslation([-(b.min[0]! + b.max[0]!) / 2, -b.min[1]!, -(b.min[2]! + b.max[2]!) / 2]);
  const asset = doc.getRoot().getAsset() as Record<string, unknown>;
  delete asset.extras; delete asset.copyright;
  const output = stripGLBMetadata(Buffer.from(await io.writeBinary(doc)));
  if (output.length > MAX_MODEL_BYTES) return fail("INVALID_GLB", "Prepared part exceeds the configured size limit.");
  const materials = doc.getRoot().listMaterials();
  return { bytes: output, report: { valid: true, sha256: digest(output), triangles: Math.floor(triangles), bytes: output.length, dimensions: size,
    textures: doc.getRoot().listTextures().length, materials: materials.length, transparentMaterials: materials.filter(m => m.getAlphaMode() !== "OPAQUE").length,
    warnings: ["Part identity, shape, orientation and its fit on a matching car require visual verification in the six-view preview."], visualVerificationRequired: true } };
}

/** Render the same build/paint path used by the mobile viewer, with local pinned dependencies. */
export async function verifyViewer(file: string, lengthM: number) {
  try {
    const { stdout } = await promisify(execFile)(process.execPath,
      [fileURLToPath(new URL("../../scripts/vehicle3d-viewer-check.mjs", import.meta.url)), file, String(lengthM)],
      { timeout: 65_000, windowsHide: true, maxBuffer: 64 * 1024 });
    const result = JSON.parse(stdout.trim());
    if (!result.valid) throw new Error();
    return result as { valid: boolean; views: number };
  } catch { return fail("VIEWER_VALIDATION_FAILED", "The MOTEXA viewer could not render this model. Check the local Three.js r160/browser setup and model materials."); }
}

// Backend input boundary; parity with the mobile viewer parser is regression-tested.
import type {ViewerConfig as CarModel,Offset} from "./vehicle3d-catalog.js";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const number=(v:unknown,limit=100)=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=limit;
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=300&&v.every(s=>typeof s==="string"&&s.length<=200);
const offset=(v:unknown):v is Offset=>object(v)&&number(v.x)&&number(v.y)&&number(v.z)&&number(v.scale,10)&&Number(v.scale)>0;
const range=(v:unknown)=>Array.isArray(v)&&v.length===2&&v.every(n=>number(n,1e6))&&v[0]<=v[1];
/** Accessory types a shop can submit; also the keys of a model's tuned fitting zones. */
export const ACCESSORY_TYPES=["FRONT_BUMPER","REAR_BUMPER","SIDE_SKIRTS","FRONT_LIP","REAR_DIFFUSER","FENDER_FLARES","WING","SPOILER","ROOF_RACK","RIMS","MIRROR_COVERS"] as const;
export type AccessoryType=typeof ACCESSORY_TYPES[number];
export type ZoneBox={x:[number,number];y:[number,number];z:[number,number]};
/** replace = the car's OWN part hidden while an add-on of this type is on (stock spoiler, roof rails, mirrors, rims): mesh names hidden whole,
 *  a box cut out of the body (or out of the named meshes), or both. Bumpers / skirts always hide their fit zone and take no replace. */
/** wheelInsetMm (RIMS only): moves the whole wheel (tyre + rim) inward while rims are on, per axle, whole mm 0..40 (a model whose stock wheels stand outside the fenders) */
export type AccessoryZone={meshes?:string[];box?:ZoneBox;replace?:{meshes?:string[];box?:ZoneBox};wheelInsetMm?:{front:number;rear:number}};
const fraction=(v:unknown)=>Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=-0.5&&n<=1.5)&&v[0]<v[1];
/** A tuned zone: mesh names to cut and/or a box in fractions of the car's bounding box (y from the ground, z: 0 = rear, 1 = front). */
export function parseZone(f:unknown,nested=false):AccessoryZone|null{
  const keys=nested?["meshes","box"]:["meshes","box","replace","wheelInsetMm"];
  if(!object(f)||Object.keys(f).some(k=>!keys.includes(k))||(f.meshes===undefined&&f.box===undefined&&f.replace===undefined&&f.wheelInsetMm===undefined))return null;
  const zone:AccessoryZone={};
  if(f.meshes!==undefined){if(!strings(f.meshes)||!f.meshes.length)return null;zone.meshes=[...f.meshes];}
  if(f.box!==undefined){const b=f.box;if(!object(b)||!["x","y","z"].every(k=>fraction(b[k])))return null;zone.box={x:[...(b.x as [number,number])],y:[...(b.y as [number,number])],z:[...(b.z as [number,number])]};}
  if(f.replace!==undefined){const r=parseZone(f.replace,true);if(!r)return null;zone.replace=r as {meshes?:string[];box?:ZoneBox};}
  if(f.wheelInsetMm!==undefined){const w=f.wheelInsetMm,mm=(n:unknown)=>Number.isInteger(n)&&(n as number)>=0&&(n as number)<=40;if(!object(w)||Object.keys(w).some(k=>k!=="front"&&k!=="rear")||!mm(w.front)||!mm(w.rear))return null;zone.wheelInsetMm={front:w.front as number,rear:w.rear as number};}
  return zone;
}
/** Never spread untrusted server objects into the viewer protocol. Reject a whole malformed model. */
export function parseCarModel(v:unknown):CarModel|null{
  if(!object(v)||typeof v.key!=="string"||!/^[a-z0-9][a-z0-9-]{0,150}$/.test(v.key)||typeof v.generation!=="string"||v.generation.length>200||!number(v.lengthM,8)||Number(v.lengthM)<2.5
    ||!number(v.rotateY,Math.PI*2)||!number(v.groundOffset,2)||!strings(v.paintNodes)||!strings(v.paintMaterials)||typeof v.rimsSwappable!=="boolean"||!offset(v.wing)||!offset(v.rack)||!object(v.credit))return null;
  if(!["title","author","url","license"].every(k=>typeof (v.credit as Record<string,unknown>)[k]==="string"&&String((v.credit as Record<string,unknown>)[k]).length<=1000))return null;
  const url=String(v.credit.url);if(url&&!/^https:\/\/[^\s]+$/.test(url))return null;
  const m:CarModel={key:v.key,generation:v.generation,lengthM:Number(v.lengthM),rotateY:Number(v.rotateY),groundOffset:Number(v.groundOffset),paintNodes:[...v.paintNodes],paintMaterials:[...v.paintMaterials],rimsSwappable:v.rimsSwappable,
    wing:{x:v.wing.x,y:v.wing.y,z:v.wing.z,scale:v.wing.scale},rack:{x:v.rack.x,y:v.rack.y,z:v.rack.z,scale:v.rack.scale},
    credit:{title:String(v.credit.title),author:String(v.credit.author),url,license:String(v.credit.license)}};
  if(v.preRotateX!==undefined){if(!number(v.preRotateX,Math.PI*2))return null;m.preRotateX=Number(v.preRotateX);}
  if(v.centerX!==undefined){if(!number(v.centerX,1e6))return null;m.centerX=Number(v.centerX);}
  if(v.bakedPaint!==undefined){const b=v.bakedPaint;if(!object(b)||!range(b.hue)||(b.hue as number[]).some(h=>h<0||h>360)||!number(b.sat,1)||Number(b.sat)<0||!number(b.ref,1)||Number(b.ref)<=0)return null;m.bakedPaint={hue:[Number((b.hue as number[])[0]),Number((b.hue as number[])[1])],sat:Number(b.sat),ref:Number(b.ref)};}
  if(v.keepBox!==undefined){const b=v.keepBox;if(!object(b)||!range(b.y)||!range(b.z)||(b.names!==undefined&&!strings(b.names)))return null;m.keepBox={y:[...(b.y as [number,number])],z:[...(b.z as [number,number])],...(b.names?{names:[...(b.names as string[])]}:{})};}
  if(v.zones!==undefined){const z=v.zones;if(!object(z)||Object.keys(z).length>ACCESSORY_TYPES.length+1)return null;m.zones={};
    for(const[raw,f]of Object.entries(z)){const type=raw==="frontBumper"?"FRONT_BUMPER":raw;if(!(ACCESSORY_TYPES as readonly string[]).includes(type))return null;const zone=parseZone(f);if(!zone)return null;m.zones[type as AccessoryType]=zone;}}
  return m;
}
