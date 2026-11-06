// Accessory auto-fit rules (sceneHtml FIT_RULES_JS, the exact code the viewer runs): body type from the rear profile, where the feet go,
// the mount width, and the one uniform scale.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {resolve} from 'node:path';
const require=createRequire(import.meta.url);const ts=require('typescript');const fs=require('node:fs');
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,spec=>load(resolve(file,'..',spec+'.ts')));return exports;}
const {FIT_RULES_JS,CAR3D_HTML}=load(resolve('src/features/car3d/sceneHtml.ts'));
const R=new Function(FIT_RULES_JS+';return {rearDeck,mountZ,band,bodyWidth,fitScale,fitVersion,FIT_VERSIONS,FIT_MAX_H};')();
// a centreline profile from the rear: [z0, z1, y] segments, sampled every 4 cm (y = height above the ground, metres)
const prof=(L,segs)=>{const out=[];for(let z=0;z<=L+1e-9;z+=0.04){const s=segs.find(([a,b])=>z>=a&&z<b);out.push({z,y:s?(typeof s[2]==='function'?s[2](z):s[2]):null});}return out;};
const lerp=(z0,y0,z1,y1)=>z=>y0+(y1-y0)*(z-z0)/(z1-z0);
const L=4.6,H=1.4;
const sedan=prof(L,[[0,0.05,0.55],[0.05,0.95,lerp(0.05,0.98,0.95,1.02)],[0.95,1.6,lerp(0.95,1.02,1.6,1.38)],[1.6,3.2,1.4],[3.2,4.0,lerp(3.2,1.38,4.0,0.95)],[4.0,4.6,0.85]]);
const hatch=prof(4.1,[[0,0.05,0.6],[0.05,0.45,lerp(0.05,0.95,0.45,1.36)],[0.45,2.9,lerp(0.45,1.37,2.9,1.45)],[2.9,3.5,lerp(2.9,1.42,3.5,0.95)],[3.5,4.1,0.85]]);
const van=prof(5,[[0,0.15,0.4],[0.15,4.0,1.79],[4.0,5,lerp(4.0,1.5,5,1.0)]]);
const pickup=prof(5.3,[[0,0.05,0.7],[0.05,1.7,0.62],[1.7,1.8,1.0],[1.8,3.2,1.78],[3.2,5.3,lerp(3.2,1.7,5.3,1.0)]]);

test('the viewer page embeds the exact rules the tests run',()=>assert.ok(CAR3D_HTML.includes(FIT_RULES_JS)));

test('body type from the rear profile: sedan (boot lid), hatch / SUV / van (tailgate top), pickup (bed)',()=>{
 const s=R.rearDeck(sedan,H,L);assert.equal(s.body,'sedan');assert.ok(Math.abs(s.edgeZ-0.08)<0.05,'lid rear edge');assert.ok(Math.abs(s.frontZ-0.95)<0.06,'rear window base');
 const h=R.rearDeck(hatch,1.58,4.1);assert.equal(h.body,'hatch');assert.ok(h.edgeZ>0.3&&h.edgeZ<0.6,'top of the tailgate');
 const v=R.rearDeck(van,1.8,5);assert.equal(v.body,'hatch');assert.ok(v.edgeZ<0.25);
 assert.equal(R.rearDeck(pickup,1.8,5.3).body,'pickup');
 assert.equal(R.rearDeck([{z:0,y:null}],H,L),null);
});

test('feet: sedan wing 10 % into the lid (never over its edge, never past its middle), lip spoiler 3 %, hatch just in front of the roof edge',()=>{
 const d={body:'sedan',edgeZ:0.1,frontZ:1.1};
 assert.ok(Math.abs(R.mountZ(d,'WING',0.02)-0.2)<1e-9);          // 10 % of a 1 m lid
 assert.ok(Math.abs(R.mountZ(d,'WING',0.2)-0.32)<1e-9);          // a long foot stays fully on the lid
 assert.ok(Math.abs(R.mountZ(d,'WING',0.9)-0.6)<1e-9);           // at most the middle of the lid
 assert.ok(Math.abs(R.mountZ(d,'SPOILER',0.005)-0.13)<1e-9);
 assert.ok(Math.abs(R.mountZ({body:'hatch',edgeZ:0.4,frontZ:1.6},'WING',0.1)-0.53)<1e-9);
});

test('mount width: the run around the middle within tolerance, not the sides it curves into; body width',()=>{
 const row=[-0.9,-0.7,-0.5,-0.3,0,0.3,0.5,0.7,0.9].map((x,i)=>({x,y:[null,0.8,0.95,1.0,1.02,1.0,0.95,0.8,null][i]}));
 assert.deepEqual(R.band(row,0,1.02,0.1),{min:-0.5,max:0.5});
 assert.equal(R.band(row,0,1.4,0.05),null);
 assert.ok(Math.abs(R.bodyWidth(row,0.5)-1.4)<1e-9);
});

test('one uniform scale: blade 92 % of the mount, feet inside 85 %, never wider than the body, real width if smaller, height cap',()=>{
 let f=R.fitScale({span:2,feetOuter:1,height:0.4,mountW:1.4,bodyW:1.7,realW:0,maxH:0.45});assert.equal(f.by,'mount');assert.ok(Math.abs(f.u*2-1.288)<1e-9);
 f=R.fitScale({span:2,feetOuter:2,height:0.4,mountW:1.4,bodyW:1.7,realW:0,maxH:0.45});assert.equal(f.by,'feet');assert.ok(Math.abs(f.u*2-1.19)<1e-9);
 f=R.fitScale({span:2,feetOuter:1,height:0.4,mountW:1.4,bodyW:1.7,realW:1.1,maxH:0.45});assert.equal(f.by,'real');
 f=R.fitScale({span:2,feetOuter:1,height:2,mountW:1.4,bodyW:1.7,realW:0,maxH:0.45});assert.equal(f.by,'height');assert.ok(Math.abs(f.u*2-0.45)<1e-9);
 f=R.fitScale({span:2,feetOuter:1,height:0.4,mountW:1.9,bodyW:1.5,realW:0,maxH:0});assert.equal(f.by,'body');assert.ok(f.u*2<=1.5);
 assert.equal(R.fitVersion('RIMS'),R.FIT_VERSIONS.rims);assert.equal(R.fitVersion('ROOF_RACK'),R.FIT_VERSIONS.wings);assert.equal(R.fitVersion('FRONT_LIP'),R.FIT_VERSIONS.other);assert.ok(R.FIT_MAX_H.WING>R.FIT_MAX_H.SPOILER);
});
