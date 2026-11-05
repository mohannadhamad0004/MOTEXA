import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {resolve} from 'node:path';
const require=createRequire(import.meta.url);const ts=require('typescript');const fs=require('node:fs');
// Compile pure production modules, resolving only their local relative imports.
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,spec=>load(resolve(file,'..',spec+'.ts')));return exports;}
const {parseCarModel,modelForViewer}=load(resolve('src/features/car3d/modelConfig.ts'));
const {parseCatalog,offlineCatalog,CATALOG_CACHE_TTL}=load(resolve('src/features/car3d/runtimeCatalog.ts'));
const {CAR_MODELS}=load(resolve('src/features/car3d/models.ts'));
const full={...structuredClone(CAR_MODELS[0]),preRotateX:-Math.PI/2,rotateY:Math.PI,groundOffset:.03,centerX:0,
 bakedPaint:{hue:[10,80],sat:.2,ref:.35},keepBox:{y:[-1,2],z:[-3,3],names:['detached']},
 zones:{frontBumper:{meshes:['bumper'],box:{x:[0,1],y:[0,.4],z:[.7,1]}}},wing:{x:.1,y:.2,z:.3,scale:.9},rack:{x:0,y:.2,z:0,scale:1.1}};
test('every viewer configuration field survives validated runtime data and the actual hook serializer',()=>{
 const parsed=parseCarModel(full);assert.ok(parsed);const forwarded=modelForViewer(parsed);
 for(const key of ['lengthM','preRotateX','rotateY','groundOffset','paintNodes','paintMaterials','bakedPaint','centerX','keepBox','zones','wing','rack'])assert.deepEqual(forwarded[key],full[key],key);
 assert.match(fs.readFileSync('src/features/car3d/useCar3D.ts','utf8'),/model:\s*modelForViewer\(m\)/);
 const html=fs.readFileSync('src/features/car3d/sceneHtml.ts','utf8');for(const key of Object.keys(forwarded))assert.ok(html.includes('m.'+key),key);
});
test('malformed and unsafe runtime configuration is rejected without crashing',()=>{
 for(const patch of [{lengthM:NaN},{lengthM:0},{key:'../../private'},{preRotateX:Infinity},{wing:{x:0}},{paintMaterials:[{}]},{keepBox:{y:[2,1],z:[0,1]}},{credit:{...full.credit,url:'javascript:alert(1)'}}])assert.equal(parseCarModel({...full,...patch}),null);
 for(const built of CAR_MODELS)assert.ok(parseCarModel(built),built.key);
});
test('server active keys control merging, remove duplicates and never resurrect known removals offline',()=>{
 const revision='a'.repeat(64),now=1000000000;
 const parsed=parseCatalog({revision,activeKeys:[full.key],models:[full]},now,CAR_MODELS);assert.ok(parsed);assert.equal(parsed.models.length,1);assert.equal(parsed.models[0].rotateY,Math.PI);
 const fallback=parseCatalog({revision,activeKeys:[full.key],models:[]},now,CAR_MODELS);assert.equal(fallback.models.length,1);
 const removed=parseCatalog({revision,activeKeys:[],models:[full]},now,CAR_MODELS);assert.deepEqual(offlineCatalog(removed,CAR_MODELS,now),[]);
 assert.equal(parseCatalog({revision,models:[full,full]}),null);
 assert.deepEqual(offlineCatalog(parsed,CAR_MODELS,now+CATALOG_CACHE_TTL+1),[]);
 assert.deepEqual(offlineCatalog(null,CAR_MODELS,now),[]);
 assert.equal(parseCatalog({revision:'bad',models:[full]}),null);
});
