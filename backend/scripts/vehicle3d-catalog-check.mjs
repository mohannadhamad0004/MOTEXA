// Read-only integrity check, using the repository TypeScript registration hook.
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {prisma} from '../src/prisma.ts';
import {activeModels,readManifest,REPO_ROOT} from '../src/services/vehicle3d-catalog.ts';
import {parseCarModel} from '../../mobile/src/features/car3d/modelConfig.ts';
const hash=file=>createHash('sha256').update(readFileSync(path.join(REPO_ROOT,file))).digest('hex');
try{
 const manifest=readManifest(),models=activeModels(manifest),keys=new Set(models.map(m=>m.key));
 if(keys.size!==models.length||models.some(m=>!parseCarModel(m)))throw Error('Invalid or duplicate active viewer configuration.');
 if(Object.values(manifest).some(e=>e.inApp!==false&&!keys.has(e.file)))throw Error('Active metadata references a missing/invalid GLB.');
 const rows=await prisma.vehicleGeneration.findMany({where:{model3dKey:{not:null}},select:{model3dKey:true}});
 if(rows.some(r=>!keys.has(r.model3dKey)))throw Error('Generation points to an inactive/missing model.');
 if(models.some(m=>!rows.some(r=>r.model3dKey===m.key)))throw Error('Active model lacks a runtime generation mapping.');
 const revision=createHash('sha256').update(JSON.stringify(models)).digest('hex');
 const audit=JSON.parse(readFileSync(path.join(REPO_ROOT,'docs/3d/c63-audit.json'),'utf8'));
 if(hash('3d-source/manual/mercedes-c-class-w204/w204-c63-source.glb')!==audit.sourceSha256)throw Error('C63 source changed since review.');
 for(const evidence of [audit.neutral,audit.redPaint]){
  if(evidence.assetSha256!==audit.sourceSha256||evidence.views!==6||evidence.remoteRequests.length)throw Error('Invalid C63 audit evidence.');
  for(const [field,file]of [['serializerSha256','mobile/src/features/car3d/modelConfig.ts'],['hookSha256','mobile/src/features/car3d/useCar3D.ts'],['viewerSha256','mobile/src/features/car3d/sceneHtml.ts'],['rendererSha256','backend/scripts/vehicle3d-viewer-check.mjs']]){
   if(hash(file)!==evidence[field])throw Error('Viewer changed since C63 audit.');
  }
 }
 if(manifest['mercedes-c-class-w204'].inApp!==false||existsSync(path.join(REPO_ROOT,'backend/public/3d/mercedes-c-class-w204.glb')))throw Error('Rejected C63 must remain inactive.');
 console.log(JSON.stringify({valid:true,activeModels:models.length,mappedGenerations:rows.length,productionGLBs:readdirSync(path.join(REPO_ROOT,'backend/public/3d')).filter(f=>f.endsWith('.glb')).length,revision,c63HashBound:true,c63Active:false}));
}finally{await prisma.$disconnect();}
