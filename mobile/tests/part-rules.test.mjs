// Part-map auto-label rules (sceneHtml PART_RULES_JS, the exact code the viewer runs) and the app-side map parser.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {resolve} from 'node:path';
const require=createRequire(import.meta.url);const ts=require('typescript');const fs=require('node:fs');
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,spec=>load(resolve(file,'..',spec+'.ts')));return exports;}
const {PART_RULES_JS,CAR3D_HTML}=load(resolve('src/features/car3d/sceneHtml.ts'));
const {parsePartMap,parseCarModel,modelForViewer}=load(resolve('src/features/car3d/modelConfig.ts'));
const {CAR_MODELS}=load(resolve('src/features/car3d/models.ts'));
const autoLabel=new Function(PART_RULES_JS+';return autoLabel;')();
const D=[1.8,1.4,4.5];// a sedan, metres
// b = [x0,y0,z0,x1,y1,z1] in fractions of the car box (z 0 = rear)
const P=(id,b,o={})=>({id,name:o.name??'body',mat:o.mat??'paint',tris:o.tris??500,b});
const body=P('m0c0',[0,0.1,0,1,1,1],{tris:20000});

test('the viewer page embeds the exact rules the tests run',()=>assert.ok(CAR3D_HTML.includes(PART_RULES_JS)));

test('shape rules: spoiler on the rear deck, bumpers at the ends, skirts, mirrors, wheels, rails',()=>{
 const pieces=[body,
  P('m0c1',[0.15,0.7,0.01,0.85,0.8,0.08]),                      // stock spoiler
  P('m0c2',[0.05,0.1,0.9,0.95,0.34,1]),                          // front bumper
  P('m0c3',[0.04,0.13,0,0.96,0.44,0.17]),                        // rear bumper
  P('m0c4',[0.01,0.06,0.3,0.06,0.2,0.75]),P('m0c5',[0.94,0.06,0.3,0.99,0.2,0.75]),     // skirts
  P('m1c0',[0,0.65,0.59,0.09,0.75,0.63],{name:'door_mirror'}),P('m1c1',[0.91,0.65,0.59,1,0.75,0.63],{name:'door_mirror'}),
  P('m2c0',[0.02,0.01,0.15,0.16,0.47,0.29]),P('m2c1',[0.84,0.01,0.15,0.98,0.47,0.29]),P('m2c2',[0.02,0.01,0.76,0.16,0.47,0.9]),P('m2c3',[0.84,0.01,0.76,0.98,0.47,0.9]),
  P('m2c4',[0.05,0.1,0.18,0.12,0.38,0.26],{name:'rim_nut',tris:40}),                      // inside a wheel: goes with it
  P('m3c0',[0.05,0.15,0.18,0.12,0.38,0.26],{name:'brake_disc',tris:300}),                  // inside a wheel but a brake: stays
  P('m4c0',[0.1,0.95,0.3,0.14,1,0.7]),P('m4c1',[0.86,0.95,0.3,0.9,1,0.7]),                 // roof rails
  P('m5c0',[0.4,0.75,0.02,0.6,0.77,0.03],{name:'third_brakelight',tris:96}),              // sits inside the spoiler: goes with it
 ];
 const r=autoLabel(pieces,D);
 assert.deepEqual(r.SPOILER.ids,['m0c1','m5c0']);
 assert.deepEqual(r.FRONT_BUMPER.ids,['m0c2']);
 assert.deepEqual(r.REAR_BUMPER.ids,['m0c3']);
 assert.deepEqual(r.SIDE_SKIRTS.ids.sort(),['m0c4','m0c5']);
 assert.deepEqual(r.MIRRORS.ids.sort(),['m1c0','m1c1']);
 assert.deepEqual(r.WHEELS.ids.filter(i=>i.startsWith('m2')).sort(),['m2c0','m2c1','m2c2','m2c3','m2c4']);
 assert.ok(!r.WHEELS.ids.includes('m3c0'),'brakes are not wheels');
 assert.deepEqual(r.ROOF_RAILS.ids.sort(),['m4c0','m4c1']);
 assert.equal(r.WHEELS.confidence,0.6);assert.equal(r.SIDE_SKIRTS.confidence,0.6);
 assert.ok(!Object.values(r).some(v=>v.ids.includes('m0c0')),'the body shell is never a part');
});

test('names only count for a piece that is most of its mesh, and only where the shape fits',()=>{
 // one exported body mesh called "bumper_R_trim" holding the whole shell (E36): the name proves nothing about its small pieces
 const shell=P('m0c0',[0,0.1,0,1,1,1],{name:'E36_bumper_R_trim',tris:20000}),bumper=P('m0c1',[0.04,0.13,0,0.96,0.44,0.17],{name:'E36_bumper_R_trim',tris:900});
 let r=autoLabel([shell,bumper],D);
 assert.deepEqual(r.REAR_BUMPER,{ids:['m0c1'],confidence:0.6,by:'shape'});
 // a separate mesh really named rear bumper: name + shape
 r=autoLabel([body,P('m7c0',[0.04,0.13,0,0.96,0.44,0.17],{name:'bumper_rear'})],D);
 assert.deepEqual(r.REAR_BUMPER,{ids:['m7c0'],confidence:0.9,by:'name+shape'});
 // a front-named bumper at the rear is not proposed as the rear bumper's name evidence
 r=autoLabel([body,P('m7c0',[0.04,0.13,0,0.96,0.44,0.17],{name:'bumper_F'})],D);assert.equal(r.REAR_BUMPER.by,'shape');
 // a spoiler-named piece in the wrong place is not a spoiler
 r=autoLabel([body,P('m8c0',[0.3,0.2,0.5,0.7,0.3,0.6],{name:'spoiler'})],D);assert.equal(r.SPOILER,undefined);
 // glass / lights in a spoiler-shaped box are not proposed without a name
 r=autoLabel([body,P('m9c0',[0.15,0.7,0.01,0.85,0.8,0.08],{mat:'rear_glass'})],D);assert.equal(r.SPOILER,undefined);
});

test('one side only lowers the confidence of paired parts; missing wheels lower it per corner',()=>{
 const r=autoLabel([body,P('m1c0',[0,0.65,0.59,0.09,0.75,0.63],{name:'mirror_L'}),P('m2c0',[0.02,0.01,0.15,0.16,0.47,0.29])],D);
 assert.equal(r.MIRRORS.confidence,0.45);assert.equal(r.WHEELS.confidence,0.15);
});

test('a one-piece (AI / scan) car gets no proposal: it stays on the zone cut',()=>assert.deepEqual(autoLabel([P('m0c0',[0,0,0,1,1,1],{tris:90000})],D),{}));

test('part maps: strict ids and labels; forwarded to the viewer',()=>{
 assert.deepEqual(parsePartMap({SPOILER:['m109c1','m109c1','m113c0'],WHEELS:[]}),{SPOILER:['m109c1','m113c0']});
 for(const bad of [{WING:['m1c1']},{SPOILER:['109']},{SPOILER:'m1c1'},{SPOILER:['m1c1;alert(1)']},[],null])assert.equal(parsePartMap(bad),null,JSON.stringify(bad));
 const m=parseCarModel({...CAR_MODELS[0],partMap:{SPOILER:['m1c2']}});assert.deepEqual(modelForViewer(m).partMap,{SPOILER:['m1c2']});
 assert.equal(parseCarModel({...CAR_MODELS[0],partMap:{SPOILER:['x']}}),null);
});
