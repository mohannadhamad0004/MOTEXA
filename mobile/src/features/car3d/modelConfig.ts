import type { CarModel, Offset } from "./models";
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
/** The car's own parts an accessory can replace (sceneHtml PART_RULES_JS / PART_OF). */
export const PART_LABELS=["FRONT_BUMPER","REAR_BUMPER","SPOILER","SIDE_SKIRTS","MIRRORS","WHEELS","ROOF_RAILS"] as const;
export type PartLabel=typeof PART_LABELS[number];
/** A confirmed part map: label -> piece ids "m<mesh>c<component>" of one exact model file. */
export type PartMap=Partial<Record<PartLabel,string[]>>;
/** Cut mode: a bumper merged into the body, drawn by the Parts Admin as 8 world points (metres); the viewer clips the car inside their hull.
 *  sideGrow (metres, 0-0.2) = the admin's extra "Corner grow" on the bumper's two side faces. */
export const CUT_LABELS=["FRONT_BUMPER","REAR_BUMPER"] as const;
export type PartCut={pts:number[][];sideGrow?:number};
export type PartCuts=Partial<Record<typeof CUT_LABELS[number],PartCut>>;
export function parsePartCuts(v:unknown):PartCuts|null{
  if(!object(v)||Object.keys(v).some(k=>!(CUT_LABELS as readonly string[]).includes(k)))return null;
  const out:PartCuts={};
  for(const[k,c]of Object.entries(v)){
    if(!object(c)||Object.keys(c).some(x=>x!=="pts"&&x!=="sideGrow"))return null;const pts=c.pts;
    if(!Array.isArray(pts)||pts.length!==8||!pts.every(p=>Array.isArray(p)&&p.length===3&&p.every(n=>number(n,10))))return null;
    if(c.sideGrow!==undefined&&(!number(c.sideGrow,0.2)||Number(c.sideGrow)<0))return null;
    out[k as keyof PartCuts]={pts:pts.map(p=>(p as number[]).map(Number)),...(c.sideGrow?{sideGrow:Number(c.sideGrow)}:{})};}
  return out;
}
export function parsePartMap(v:unknown):PartMap|null{
  if(!object(v)||Object.keys(v).some(k=>!(PART_LABELS as readonly string[]).includes(k)))return null;
  const out:PartMap={};
  for(const[k,ids]of Object.entries(v)){if(!Array.isArray(ids)||ids.length>5000||!ids.every(i=>typeof i==="string"&&/^m\d{1,5}c\d{1,6}$/.test(i)))return null;if(ids.length)out[k as PartLabel]=[...new Set(ids as string[])];}
  return out;
}
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
  if(v.partMap!==undefined){const pm=parsePartMap(v.partMap);if(!pm)return null;m.partMap=pm;}
  if(v.partCuts!==undefined){const pc=parsePartCuts(v.partCuts);if(!pc)return null;if(Object.keys(pc).length)m.partCuts=pc;}
  if(v.rimProposal!==undefined){const p=v.rimProposal;if(!object(p)||!number(p.confidence,1)||Number(p.confidence)<0)return null;const pm=parsePartMap({WHEELS:p.ids});if(!pm?.WHEELS)return null;m.rimProposal={ids:pm.WHEELS,confidence:Number(p.confidence)};}
  return m;
}
/** This exact function is used by the native/WebView path and protocol tests/audit. */
export function modelForViewer(m:CarModel){
  return {lengthM:m.lengthM,preRotateX:m.preRotateX,rotateY:m.rotateY,groundOffset:m.groundOffset,paintNodes:m.paintNodes,paintMaterials:m.paintMaterials,bakedPaint:m.bakedPaint,
    centerX:m.centerX,keepBox:m.keepBox,zones:m.zones,partMap:m.partMap,...(m.partCuts?{partCuts:m.partCuts}:{}),...(m.rimProposal?{rimProposal:m.rimProposal}:{})};
}
/** A published shop accessory file (content-addressed, served under /api/3d/ only while its product is PUBLISHED). */
export const ACCESSORY_FILE=/^accessories\/acc-[a-f0-9]{16}\.glb$/;
