import {mkdirSync,existsSync,readFileSync,writeFileSync,unlinkSync} from "node:fs";
import path from "node:path";
import type {Prisma} from "../generated/prisma/client.js";
import {REPO_ROOT,atomicWrite,catalogFiles,readManifest,safeKey,type ModelMetadata} from "./vehicle3d-catalog.js";
import {fail} from "./vehicle3d-validation.js";
import {genKey} from "../generations.js";
const storage=path.join(REPO_ROOT,"backend/storage/vehicle3d"),JOURNAL=path.join(storage,"promotion-journal.json");
/** Caller holds the catalog advisory lock; commit this together with the originating approval. */
export async function stageCatalogPromotion(tx:Prisma.TransactionClient,input:{generationId:string;entry:ModelMetadata;bytes:Buffer;expectedExistingKey?:unknown;submissionId?:string;importId?:string;actorId?:string}){
  const gen=await tx.vehicleGeneration.findUnique({where:{id:input.generationId},include:{vehicle:{include:{brand:true}}}});
  if(!gen)return fail("GENERATION_REQUIRED","Catalog generation does not exist.");
  if(!gen.isActive||!gen.vehicle.isActive||!gen.vehicle.brand?.isActive)return fail("INACTIVE","Activate the brand, model and generation before publication.",409);
  if(gen.model3dKey && gen.model3dKey!==input.expectedExistingKey)return fail("EXISTING_MODEL","Explicit replacement of the current model is required.",409);
  const e=input.entry;
  if(!safeKey(e.file)||e.viewerConfig?.key!==e.file)return fail("INVALID_KEY","Invalid catalog configuration.");
  const shared=path.join(REPO_ROOT,"backend/public/3d",e.file+".glb"),manifest=readManifest();
  if(existsSync(shared)||Object.values(manifest).some(m=>m.file===e.file))return fail("DUPLICATE_PROMOTION","This model is already published.",409);
  const manifestKey=Object.entries(manifest).find(([,m])=>m.file===gen.model3dKey)?.[0]??genKey(gen.vehicle.make,gen.vehicle.model,gen.code);
  if(manifest[manifestKey])e.previousCatalogMetadata=manifest[manifestKey];
  manifest[manifestKey]=e;
  const files=catalogFiles(manifest),before=[...files.keys()].map(file=>[file,readFileSync(file,"utf8")]);
  mkdirSync(storage,{recursive:true});
  atomicWrite(JOURNAL,JSON.stringify({submissionId:input.submissionId,importId:input.importId,generationId:gen.id,key:e.file,shared,before}));
  writeFileSync(shared,input.bytes,{flag:"wx"});
  for(const[file,text]of files)atomicWrite(file,text);
  await tx.vehicleGeneration.update({where:{id:gen.id},data:{isPublished:true,model3dKey:e.file,modelSourceUrl:e.url||null,modelLicense:e.license}});
  await tx.auditLog.create({data:{actorId:input.actorId??null,action:"VEHICLE3D_CATALOG_PROMOTE",targetId:gen.id,details:{model3dKey:e.file,previousModel3dKey:gen.model3dKey,submissionId:input.submissionId??null,importId:input.importId??null}}});
}
export async function recoverCatalogJournal(tx:Prisma.TransactionClient){
  if(!existsSync(JOURNAL))return;
  const saved=JSON.parse(readFileSync(JOURNAL,"utf8"));
  const sub=saved.submissionId?await tx.vehicle3DSubmission.findUnique({where:{id:saved.submissionId}}):null;
  const gen=saved.generationId?await tx.vehicleGeneration.findUnique({where:{id:saved.generationId}}):null;
  const imported=saved.importId?await tx.vehicle3DImport.findUnique({where:{id:saved.importId}}):null;
  const committed=saved.importId?imported?.status==="PUBLISHED"&&imported.publishedModel3dKey===saved.key:saved.submissionId?sub?.status==="APPROVED"&&sub.approvedModel3dKey===saved.key:gen?.model3dKey===saved.key;
  if(!committed){for(const[file,text]of saved.before)atomicWrite(file,text);if(existsSync(saved.shared))unlinkSync(saved.shared);}
  unlinkSync(JOURNAL);
}
