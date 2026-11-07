// Generic candidate/submission renderer. Never changes production assets.
import {createRequire} from 'node:module';import {resolve,sep} from 'node:path';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {ROOT,loadTS,hash} from './vehicle-audit-lib.mjs';
import {AUDIT_ORIGIN,resolveLocalThree,localizeViewerHtml,localResponse} from './vehicle-audit-local.mjs';
import {createHash} from 'node:crypto';
const require=createRequire(resolve(ROOT,'mobile/package.json'));const {chromium}=require('@playwright/test');
const file=resolve(process.argv[2]),lengthM=Number(process.argv[3]);
const arg=n=>process.argv.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3);
const out=arg('out')?resolve(arg('out')):null;if(out&&!out.startsWith(resolve(ROOT)+sep)&&out!==resolve(ROOT))throw Error('Output must be within the repository');
if(arg('color')&&!/^#[0-9a-f]{6}$/i.test(arg('color')))throw Error('Invalid paint color');
const none={x:0,y:0,z:0,scale:1};
const config=arg('config')?JSON.parse(readFileSync(arg('config'),'utf8')):{key:'check',generation:'Private model',lengthM,rotateY:0,groundOffset:0,paintNodes:[],paintMaterials:[],rimsSwappable:false,wing:none,rack:none,credit:{title:'',author:'',url:'',license:'Private'}};
const {parseCarModel,modelForViewer}=loadTS(resolve(ROOT,'mobile/src/features/car3d/modelConfig.ts'));
if(!parseCarModel(config))throw Error('Invalid viewer configuration');
const protocol=modelForViewer(config);
const threeDir=resolveLocalThree(ROOT,'0.160.1',process.env.VEHICLE3D_THREE_DIR||resolve(ROOT,'.private/three-r160/package'));
const {CAR3D_HTML}=loadTS(resolve(ROOT,'mobile/src/features/car3d/sceneHtml.ts'));
const hook=`window.checkVehicle=async function(model){
 renderer.setAnimationLoop(null);controls.autoRotate=false;controls.enableDamping=false;
 var gltf=await loader.loadAsync('/asset.glb');parsed['check.glb']=Promise.resolve(gltf);
 var originalModel=Object.assign({},model,{paintNodes:[],paintMaterials:[],bakedPaint:undefined});
 var original=await build({file:'check.glb',model:originalModel,color:'#8b9baa'});
 function materials(group){var result={};group.traverse(function(o){if(o.isMesh)result[o.userData.pi]={name:o.name,mat:o.material.name,color:o.material.color?.getHexString(),opacity:o.material.opacity,map:o.material.map?.uuid||null};});return result;}
 var before=materials(original.group);
 car=await build({file:'check.glb',model:model,color:'${arg('color')||'#8b9baa'}'});
 var after=materials(car.group),protectedChanged=[],painted=0,unchanged=0;
 car.group.traverse(function(o){if(!o.isMesh)return;var previous=before[o.userData.pi],current=after[o.userData.pi];if(!previous)return;
   if(car.paint.indexOf(o.material)>=0){painted++;if(/glass|window|windshield|tyre|tire|wheel|rim|light|lamp|interior|seat|dashboard/i.test(previous.name+' '+previous.mat))protectedChanged.push(previous.name||previous.mat);}
   else if(JSON.stringify(previous)===JSON.stringify(current))unchanged++;
   else if(!model.bakedPaint)throw Error('Unrelated geometry was recolored');
 });
 if(protectedChanged.length)throw Error('Protected surfaces were selected for body paint');
 var paintTest={supported:painted>0||!!model.bakedPaint,paintedMeshes:painted,unchangedMeshes:unchanged,protectedChanged:protectedChanged,
   method:model.bakedPaint?'baked_texture_requires_visual_review':'production_material_comparison',visualSurfaceReviewRequired:true};
 if(car.wing)car.wing.visible=false;if(car.rack)car.rack.visible=false;car.group.updateMatrixWorld(true);
 var box=new THREE.Box3().setFromObject(car.group.children[0],true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 if(![size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0))throw Error('Empty viewer');
 scene.background=new THREE.Color('#d9dde1');
 var plane=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xc5c9cd,roughness:1}));plane.rotation.x=-Math.PI/2;plane.position.y=-.01;scene.add(plane);
 const distance=size.length()/2/Math.sin(THREE.MathUtils.degToRad(camera.fov)/2)*1.15;
 window.checkView=function(direction){camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));camera.near=distance/1000;camera.far=distance*100;camera.updateProjectionMatrix();camera.lookAt(center);renderer.render(scene,camera);return {triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};};
 var wheelMeshes=[];car.group.children[0].traverse(function(o){if(o.isMesh&&o.material&&/c63rin|llanta|tire|wheel/i.test(o.material.name)){var b=new THREE.Box3().setFromObject(o,true);wheelMeshes.push({name:o.name,material:o.material.name,center:b.getCenter(new THREE.Vector3()).toArray(),dimensions:b.getSize(new THREE.Vector3()).toArray()});}});
 return {valid:true,dimensions:size.toArray(),boundsMin:box.min.toArray(),paintMaterialsApplied:car.paint.length,paintTest,animations:gltf.animations.length,wheelMeshes};
};window.checkReady=true;`;
const html=localizeViewerHtml(CAR3D_HTML).replace('post({ type: "ready" });',hook+'\npost({ type: "ready" });');
const browser=await chromium.launch({headless:true,channel:'chrome'});const remoteRequests=[];
try{
 const page=await browser.newPage({viewport:{width:900,height:650}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const r=localResponse(route.request().url(),{html,assetPath:file,threeDir});if(r.blocked){remoteRequests.push(new URL(route.request().url()).origin);return route.abort();}return route.fulfill(r);});
 await page.goto(AUDIT_ORIGIN+'/');await page.waitForFunction(()=>window.checkReady===true);
 const result=await page.evaluate(m=>window.checkVehicle(m),protocol);
 const views=[['front',[0,.14,1]],['front-three-quarter',[-.7,.35,1]],['left-side',[-1,.14,0]],['rear-three-quarter',[-.7,.35,-1]],['rear',[0,.14,-1]],['top-three-quarter',[-.7,1.1,1]]];
 const screenshots=[];if(out)mkdirSync(out,{recursive:true});
 for(const[name,direction]of views){const stats=await page.evaluate(d=>window.checkView(d),direction);if(out){const p=resolve(out,name+'.png');await page.screenshot({path:p});screenshots.push({name,sha256:hash(p),...stats});}}
 if(errors.length||remoteRequests.length)throw Error('Viewer errors or unexpected remote requests');
 const evidence={...result,views:6,assetSha256:hash(file),configuration:config,forwardedModel:protocol,configurationSha256:createHash('sha256').update(JSON.stringify(config)).digest('hex'),viewerSha256:hash(resolve(ROOT,'mobile/src/features/car3d/sceneHtml.ts')),hookSha256:hash(resolve(ROOT,'mobile/src/features/car3d/useCar3D.ts')),serializerSha256:hash(resolve(ROOT,'mobile/src/features/car3d/modelConfig.ts')),rendererSha256:hash(new URL(import.meta.url)),threeVersion:'0.160.1',screenshots,remoteRequests};
 if(out)writeFileSync(resolve(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(out?{valid:true,views:6,out,assetSha256:evidence.assetSha256,stats:result}:{valid:true,views:6,paintTest:result.paintTest}));
}finally{await browser.close();}
