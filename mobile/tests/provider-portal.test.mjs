import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitLabel,replacementLabel} from '../src/features/accessory3d/fitPresentation.ts';
import {providerLinks,providerPath} from '../src/features/provider/portal/navigation.ts';
test('fit labels distinguish a current verified fit, stale fit and failed fit in both languages',()=>{
 const en=(e,a)=>e,ar=(e,a)=>a;
 assert.match(fitLabel('VERIFIED',en),/verified/);assert.match(fitLabel('STALE',en),/updating/);assert.match(fitLabel('FAILED',en),/Does not fit/);
 for(const state of ['NOT_COMPUTED','STALE','FAILED','VERIFIED','COMPUTED'])assert.notEqual(fitLabel(state,en),fitLabel(state,ar));
 assert.equal(replacementLabel('SPOILER',en),'Stock spoiler');assert.match(replacementLabel(null,en),/No verified/);
});
test('provider navigation stays inside its portal and excludes unsupported reviews and earnings',()=>{
 for(const area of ['tow','parts']){const paths=providerLinks[area].map(n=>providerPath(area,n.path));assert.equal(new Set(paths).size,paths.length);assert.ok(paths.every(p=>p.startsWith(`/provider/${area}`)));assert.ok(providerLinks[area].every(n=>n.en&&n.ar));assert.ok(paths.every(p=>!p.includes('reviews')&&!p.includes('earnings')));}
});
