// Stock-derived E36 rear geometry is a diagnostic fixture, never a real shop product.
// It overlaps the remaining car body: keep that clearance rejection factual.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {Document,NodeIO} from '@gltf-transform/core';
import {ROOT} from '../scripts/vehicle-audit-lib.mjs';

const car=resolve(ROOT,'backend/public/3d/bmw-3-series-e36.glb');
const config=resolve(ROOT,'docs/3d/rims-general/bmw-3-series-e36/config.json');
const out=resolve(ROOT,'backend/.private/e36-rear-clearance-test');
const skip=[car,config,resolve(ROOT,'.private/three-r160/package')].some(f=>!existsSync(f))?'E36, confirmed map or local Three.js missing':false;
function render(views,extra=[]){
 const text=execFileSync(process.execPath,[resolve(ROOT,'backend/scripts/accessory-fit-check.mjs'),`--car=${car}`,`--config=${config}`,`--out=${out}`,`--views=${views}`,...extra],{encoding:'utf8',windowsHide:true,timeout:180000,stdio:['ignore','pipe','pipe']});
 return JSON.parse(text.trim().split('\n').pop());
}
test('stock-derived real E36 rear bumper fails clearance, with finite seam metrics and no publishable fit',{skip},async()=>{
 mkdirSync(out,{recursive:true});
 try{
  const kitPath=resolve(out,'kit.json');writeFileSync(kitPath,JSON.stringify({type:'REAR_BUMPER'}));
  render('fixturepart',[`--kit=${kitPath}`]);
  const pieces=JSON.parse(readFileSync(resolve(out,'fixture-part.json'),'utf8'));
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('STOCK_DERIVED_DIAGNOSTIC_ONLY');
  let minX=Infinity,maxX=-Infinity;
  for(const p of pieces){
   for(let i=0;i<p.positions.length;i+=3){minX=Math.min(minX,p.positions[i]);maxX=Math.max(maxX,p.positions[i]);}
   const primitive=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(p.positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(p.indices)).setBuffer(buffer))
    .setMaterial(doc.createMaterial('Diagnostic only').setDoubleSided(true));
   if(p.normals)primitive.setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(p.normals)).setBuffer(buffer));
   scene.addChild(doc.createNode('Diagnostic only').setMesh(doc.createMesh().addPrimitive(primitive)));
  }
  const part=resolve(out,'stock-derived-rear.glb');writeFileSync(part,await new NodeIO().writeBinary(doc));
  writeFileSync(kitPath,JSON.stringify({type:'REAR_BUMPER',size:{widthMm:Math.round((maxX-minX)*1000)}}));
  const r=render('qa',[`--kit=${kitPath}`,`--part=${part}`]);
  assert.match(r.fit.refused??'',/does not look fitted on this car/);
  assert.equal(r.fit.qa.ok,false);assert.equal(r.fit.qa.tier,'REFUSED');
  assert.ok(r.fit.qa.clipMm>r.fit.qa.limitMm||r.fit.qa.gapMm>r.fit.qa.limitMm);
  assert.ok(Object.values(r.fit.gapsMm).every(g=>Number.isFinite(g.p90)&&Number.isFinite(g.max)));
  assert.equal(r.autofit,null);
  const evidence=JSON.parse(readFileSync(resolve(out,'fit-evidence.json'),'utf8'));
  const evidenceDir=resolve(ROOT,'docs/3d/lifecycle');mkdirSync(evidenceDir,{recursive:true});
  writeFileSync(resolve(evidenceDir,'real-e36-rear-refusal.json'),JSON.stringify({fixture:'Stock-derived E36 rear diagnostic geometry. Not a shop product or a passed real fit.',...evidence},null,2)+'\n');
 }finally{if(out===resolve(ROOT,'backend/.private/e36-rear-clearance-test'))rmSync(out,{recursive:true,force:true});}
});
