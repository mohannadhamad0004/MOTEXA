import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { AUDIT, inspectAsset, triangles, dimensions, validBounds, duplicates, inventory } from '../scripts/vehicle-audit-lib.mjs';

test('triangle counts distinguish triangles, strips, fans and non-triangle primitives', () => {
  assert.equal(triangles(4, 9), 3); assert.equal(triangles(5, 6), 4); assert.equal(triangles(6, 6), 4);
  assert.equal(triangles(1, 10), 0); assert.equal(triangles(5, 1), 0);
});
test('invalid/empty bounds cannot become valid measurements', () => {
  assert.equal(validBounds({min:[],max:[]}),false);
  assert.equal(dimensions({min:[0,0,0],max:[NaN,1,1]}),null);
  assert.equal(dimensions({min:[1,0,0],max:[0,1,1]}),null);
  assert.deepEqual(dimensions({min:[-1,0,1],max:[2,4,6]}),[3,4,5]);
});
test('duplicate mappings retain every generation and ignore absent values', () => {
  assert.deepEqual(duplicates([{key:'a',file:'x'},{key:'b',file:'x'},{key:'c',file:null}], 'file'),[{value:'x',keys:['a','b']}]);
});
test('repository inventory lists only models that exist and never assumes visual PASS', () => {
  const {entries} = inventory();
  assert.ok(entries.every(e=>e.status === 'UNCERTAIN'));
  assert.ok(!entries.some(e=>e.manifest?.finalStatus === 'REMOVED' || e.manifest?.finalStatus === 'REJECT'));
  for (const k of ['toyota-corolla-e100','bmw-3-series-e46']) assert.ok(!entries.find(e=>e.key===k)?.manifest, k); // deleted models leave no catalog entry
});
test('inspection uses world transforms, preserves hierarchy, and records a content hash', async () => {
  mkdirSync(resolve(AUDIT,'test-fixtures'),{recursive:true});
  const dir=mkdtempSync(resolve(AUDIT,'test-fixtures/run-'));
  const doc=new Document(), buffer=doc.createBuffer();
  const positions=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,2,0,0,0,1,0])).setBuffer(buffer);
  const mesh=doc.createMesh('Wheel mesh').addPrimitive(doc.createPrimitive().setAttribute('POSITION',positions));
  const child=doc.createNode('wheel').setMesh(mesh).setTranslation([0,2,0]);
  const parent=doc.createNode('body-parent').setTranslation([10,0,0]).addChild(child);
  doc.createScene().addChild(parent);
  const path=resolve(dir,'fixture.glb'); await new NodeIO().write(path,doc);
  const result=await inspectAsset(path);
  assert.equal(result.loaded,true); assert.equal(result.triangles,1); assert.equal(result.vertices,3);
  assert.deepEqual(result.bounds,{min:[10,2,0],max:[12,3,0]});
  assert.equal(result.wheelLike.length,1); assert.match(result.sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.hierarchy.find(n=>n.name==='wheel').parent,result.hierarchy.find(n=>n.name==='body-parent').index);
  const again=await inspectAsset(path); assert.equal(result.sha256,again.sha256);
  const bad=resolve(dir,'broken.glb'); writeFileSync(bad,'not a model');
  assert.equal((await inspectAsset(bad)).loaded,false);
  assert.equal((await inspectAsset(resolve(dir,'missing.glb'))).missing,true);
});
