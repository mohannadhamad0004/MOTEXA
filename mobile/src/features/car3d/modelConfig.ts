import type { CarModel, Offset } from "./models";
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const number=(v:unknown,limit=100)=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=limit;
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=300&&v.every(s=>typeof s==="string"&&s.length<=200);
const offset=(v:unknown):v is Offset=>object(v)&&number(v.x)&&number(v.y)&&number(v.z)&&number(v.scale,10)&&Number(v.scale)>0;
const range=(v:unknown)=>Array.isArray(v)&&v.length===2&&v.every(n=>number(n,1e6))&&v[0]<=v[1];
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
  if(v.zones!==undefined){const z=v.zones;if(!object(z)||Object.keys(z).some(k=>k!=="frontBumper"))return null;m.zones={};if(z.frontBumper!==undefined){const f=z.frontBumper;if(!object(f)||!strings(f.meshes)||!object(f.box)||!["x","y","z"].every(k=>range((f.box as Record<string,unknown>)[k])))return null;m.zones.frontBumper={meshes:[...f.meshes],box:{x:[...(f.box.x as [number,number])],y:[...(f.box.y as [number,number])],z:[...(f.box.z as [number,number])]}};}}
  return m;
}
/** This exact function is used by the native/WebView path and protocol tests/audit. */
export function modelForViewer(m:CarModel){
  return {lengthM:m.lengthM,preRotateX:m.preRotateX,rotateY:m.rotateY,groundOffset:m.groundOffset,paintNodes:m.paintNodes,paintMaterials:m.paintMaterials,bakedPaint:m.bakedPaint,
    centerX:m.centerX,keepBox:m.keepBox,zones:m.zones,wing:m.wing,rack:m.rack};
}
