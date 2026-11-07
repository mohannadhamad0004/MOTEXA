import {randomUUID} from "node:crypto";
import {existsSync} from "node:fs";
import {prisma} from "../prisma.js";
import type {Prisma} from "../generated/prisma/client.js";
import {createSketchfabClient,assertImportAllowed} from "./sketchfab-client.js";
import {existingSketchfab,importInclude,importShape,IMPORT_RUNNING} from "./vehicle3d-import-state.js";
import {catalogLock,field,requirePartsActor,yearField} from "./vehicle-taxonomy.js";
import {privatePath,removePrivate,removeImportPreparation} from "./vehicle3d-private-assets.js";
import {vehicleLength} from "./vehicle3d-preparation.js";
import {fail,parseCarModel} from "./vehicle3d-validation.js";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export function linkImportActions(client=createSketchfabClient()) {
 return {
  queueValidation:async(uid:string,id:string,config:any={})=>prisma.$transaction(async tx=>{
   await requirePartsActor(tx,uid);await tx.$queryRaw`SELECT "id" FROM "Vehicle3DImport" WHERE "id"=${id} FOR UPDATE`;
   const r=await tx.vehicle3DImport.findUnique({where:{id},include:importInclude});if(!r)return fail("IMPORT_NOT_FOUND","Import not found.",404);
   if(r.status==="PUBLISHED"||r.importStage==="DISCARDED")return fail("IMPORT_BUSY","This import is immutable.",409);
   if(IMPORT_RUNNING.includes(r.importStage??""))return fail("IMPORT_BUSY","This import is still being prepared.",409);
   if(!existsSync(privatePath(r.rawModelPath)))return fail("MODEL_REQUIRED","Retry the download before validation.",409);
   const allowed=["lengthM","preRotateX","rotateY","groundOffset","paintNodes","paintMaterials","bakedPaint","centerX","keepBox","zones","rimsSwappable","wing","rack"];
   if(!config||typeof config!=="object"||Array.isArray(config)||Object.keys(config).some(k=>!allowed.includes(k)))return fail("CONFIG_INVALID","Unsupported viewer setting.");
   const none={x:0,y:0,z:0,scale:1},checked=parseCarModel({key:`manual-${id}`,generation:`${r.generation.vehicle.make} ${r.generation.vehicle.model} ${r.generation.code}`,rotateY:0,groundOffset:0,paintNodes:[],paintMaterials:[],rimsSwappable:false,wing:none,rack:none,...(r.viewerConfig as any),...config,credit:{title:(r.sourceMetadata as any)?.title,author:r.author,url:r.sourceUrl??"",license:r.license}});
   if(!checked)return fail("CONFIG_INVALID","Invalid viewer configuration.");
   const row=await tx.vehicle3DImport.update({where:{id},data:{viewerConfig:json(checked),status:"DRAFT",importStage:"QUEUED",errorCode:null,leaseToken:null,leaseUntil:null,queuedAt:new Date(),finishedAt:null,visuallyVerifiedAt:null},include:importInclude});
   await tx.auditLog.create({data:{actorId:uid,action:"VEHICLE3D_IMPORT_REVALIDATE_QUEUED",targetId:id}});return importShape(row);
  }),
  inspect:async(uid:string,url:unknown)=>{
   await prisma.$transaction(tx=>requirePartsActor(tx,uid));
   const metadata=await client.inspect(url);
   return prisma.$transaction(async tx=>{
    await requirePartsActor(tx,uid);const duplicate=await existingSketchfab(tx,metadata.uid);
    await tx.auditLog.create({data:{actorId:uid,action:"VEHICLE3D_SKETCHFAB_INSPECT",targetId:metadata.uid,details:{allowed:metadata.allowed,refusalCode:metadata.refusalCode,duplicate:!!duplicate}}});
    return {...metadata,duplicate};
   });
  },
  queue:async(uid:string,input:any)=>{
   await prisma.$transaction(tx=>requirePartsActor(tx,uid));
   const metadata=await client.inspect(input?.url);assertImportAllowed(metadata);
   return prisma.$transaction(async tx=>{
    await requirePartsActor(tx,uid);await catalogLock(tx);
    const duplicate=await existingSketchfab(tx,metadata.uid);if(duplicate)return fail("DUPLICATE_IMPORT","This Sketchfab model has already been imported.",409);
    const g=await tx.vehicleGeneration.findUnique({where:{id:field(input.generationId,"generation")},include:{vehicle:{include:{brand:true}}}});
    if(!g?.isActive||!g.vehicle.isActive||!g.vehicle.brand?.isActive)return fail("GENERATION_REQUIRED","Choose an active managed generation.");
    const from=yearField(input.yearFrom??g.yearFrom),to=yearField(input.yearTo??g.yearTo);
    if(from>to||from!==g.yearFrom||to!==g.yearTo)return fail("GENERATION_YEARS","Use the selected generation's production years, or edit it in the managed catalog.");
    const row=await tx.vehicle3DImport.create({data:{generationId:g.id,uploadedByUserId:uid,status:"DRAFT",importStage:"QUEUED",queuedAt:new Date(),
      sourceProvider:"SKETCHFAB",sourceUid:metadata.uid,sourceMetadata:json(metadata),source:"Sketchfab",sourceUrl:metadata.url,
      author:metadata.author,license:metadata.license,rawModelPath:`${randomUUID()}.glb`,viewerConfig:{lengthM:vehicleLength(g.vehicle.make,g.vehicle.model)}},include:importInclude});
    await tx.auditLog.create({data:{actorId:uid,action:"VEHICLE3D_IMPORT_QUEUED",targetId:row.id,details:{sourceUid:metadata.uid,generationId:g.id}}});return importShape(row);
   });
  },
  retry:async(uid:string,id:string)=>prisma.$transaction(async tx=>{
   await requirePartsActor(tx,uid);await tx.$queryRaw`SELECT "id" FROM "Vehicle3DImport" WHERE "id"=${id} FOR UPDATE`;
   const r=await tx.vehicle3DImport.findUnique({where:{id}});if(!r)return fail("IMPORT_NOT_FOUND","Import not found.",404);
   if(r.sourceProvider!=="SKETCHFAB"||(r.importStage??r.status)!=="FAILED")return fail("IMPORT_BUSY","Only failed Sketchfab imports can be retried.",409);
   const row=await tx.vehicle3DImport.update({where:{id},data:{status:"DRAFT",importStage:"QUEUED",errorCode:null,queuedAt:new Date(),finishedAt:null,leaseToken:null,leaseUntil:null},include:importInclude});
   await tx.auditLog.create({data:{actorId:uid,action:"VEHICLE3D_IMPORT_RETRY",targetId:id}});return importShape(row);
  }),
  discard:async(uid:string,id:string)=>{
   const result=await prisma.$transaction(async tx=>{
    await requirePartsActor(tx,uid);await tx.$queryRaw`SELECT "id" FROM "Vehicle3DImport" WHERE "id"=${id} FOR UPDATE`;
    const r=await tx.vehicle3DImport.findUnique({where:{id},include:importInclude});if(!r)return fail("IMPORT_NOT_FOUND","Import not found.",404);
    if(r.status==="PUBLISHED"||r.publishedModel3dKey)return fail("IMPORT_PUBLISHED","Published imports cannot be discarded.",409);
    const row=await tx.vehicle3DImport.update({where:{id},data:{status:"FAILED",importStage:"DISCARDED",leaseToken:null,leaseUntil:null,errorCode:null,finishedAt:new Date(),visuallyVerifiedAt:null},include:importInclude});
    if(r.importStage!=="DISCARDED")await tx.auditLog.create({data:{actorId:uid,action:"VEHICLE3D_IMPORT_DISCARD",targetId:id}});
    return {row,raw:r.rawModelPath,prepared:r.privateModelPath};
   });
   // Only the keys owned by this row; never taxonomy or public catalog paths. Repeated discard can finish interrupted cleanup.
   removePrivate(result.raw);removePrivate(result.prepared);const metadata=result.row.sourceMetadata as any;
   removeImportPreparation(metadata?.pendingRawPath);removeImportPreparation(metadata?.pendingPreparedPath);return importShape(result.row);
  }
 };
}
