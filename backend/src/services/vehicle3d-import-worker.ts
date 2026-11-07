import {existsSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {prisma} from "../prisma.js";
import type {Prisma} from "../generated/prisma/client.js";
import {createSketchfabClient} from "./sketchfab-client.js";
import {convertSketchfabAsset} from "./vehicle3d-archive.js";
import {optimizeVehicleSource} from "./vehicle3d-preparation.js";
import {createImportService} from "./vehicle3d-imports.js";
import {IMPORT_ERRORS} from "./vehicle3d-import-state.js";
import {privatePath,storePrivate,removePrivate,removeImportPreparation} from "./vehicle3d-private-assets.js";
import {requirePartsActor} from "./vehicle-taxonomy.js";
import {fail} from "./vehicle3d-validation.js";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Options={client?:ReturnType<typeof createSketchfabClient>;convert?:typeof convertSketchfabAsset;optimize?:typeof optimizeVehicleSource;validate?:ReturnType<typeof createImportService>["validate"]};
/** One durable job at a time per process. PostgreSQL leases also protect multiple backend processes.
 * A crash before the optimized checkpoint safely repeats a free download; later restarts reuse the private checkpoint. */
export function createSketchfabProcessor(options:Options={}) {
 return async(onlyId:string|null=null)=>{
  const token=randomUUID(),now=new Date();
  const claimed=await prisma.$transaction(async tx=>{
   const rows=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Vehicle3DImport" WHERE "sourceProvider"='SKETCHFAB'
     AND "importStage" IN ('QUEUED','DOWNLOADING','CONVERTING','OPTIMIZING','VALIDATING','GENERATING_PART_MAP')
     AND (${onlyId}::text IS NULL OR "id"=${onlyId}) AND ("leaseUntil" IS NULL OR "leaseUntil"<${now})
     ORDER BY "queuedAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
   if(!rows.length)return null;
   return tx.vehicle3DImport.update({where:{id:rows[0]!.id},data:{leaseToken:token,leaseUntil:new Date(Date.now()+120000)},include:{generation:{include:{vehicle:true}}}});
  });
  if(!claimed)return;
  let stage="DOWNLOADING";
  const update=async(data:Prisma.Vehicle3DImportUpdateManyMutationInput)=>{
   const changed=await prisma.vehicle3DImport.updateMany({where:{id:claimed.id,leaseToken:token,status:{not:"PUBLISHED"},importStage:{not:"DISCARDED"}},data});
   if(!changed.count)return fail("IMPORT_DISCARDED","This attempt is no longer current.",409);
  };
  const step=async(status:string)=>{stage=status;await update({status:"DRAFT",importStage:status,errorCode:null});};
  const heartbeat=setInterval(()=>{void update({leaseUntil:new Date(Date.now()+120000)}).catch(()=>{});},20000);heartbeat.unref();
  let transient:string|null=null;
  try {
   await prisma.$transaction(tx=>requirePartsActor(tx,claimed.uploadedByUserId));
   const previous=claimed.sourceMetadata as any;
   if(previous?.pendingRawPath!==claimed.rawModelPath)removeImportPreparation(previous?.pendingRawPath);
   if(previous?.pendingPreparedPath!==claimed.privateModelPath)removeImportPreparation(previous?.pendingPreparedPath);
   let config:any=claimed.viewerConfig??{};
   if(!existsSync(privatePath(claimed.rawModelPath))){
    await step("DOWNLOADING");
    const client=options.client??createSketchfabClient(),inspection=await client.inspect(claimed.sourceUrl);
    const downloaded=await client.download(inspection);
    const duplicate=await prisma.vehicle3DImport.findFirst({where:{id:{not:claimed.id},sourceProvider:"SKETCHFAB",sourceMetadata:{path:["sourceSha256"],equals:downloaded.sourceSha256}},select:{id:true}});
    if(duplicate)return fail("DUPLICATE_IMPORT","This Sketchfab model has already been imported.",409);
    await step("CONVERTING");const converted=await(options.convert??convertSketchfabAsset)(downloaded.bytes);
    await step("OPTIMIZING");const optimized=await(options.optimize??optimizeVehicleSource)(converted,`import-${claimed.id}`);
    transient=`${randomUUID()}.glb`;
    await update({sourceMetadata:json({...previous,pendingRawPath:transient})});
    storePrivate(optimized.bytes,"glb",transient);
    config={...config,rotateY:optimized.rotateY,paintMaterials:optimized.paintCertain?optimized.paintMaterials:[],rimsSwappable:optimized.rimsSwappable};
    const metadata={...downloaded.metadata,downloadedAt:downloaded.downloadedAt,downloadSource:downloaded.downloadSource,
      sourceSha256:downloaded.sourceSha256,originalDownloadedBytes:downloaded.bytes.length,format:downloaded.format,optimization:optimized.report};
    await update({rawModelPath:transient,viewerConfig:json(config),sourceMetadata:json(metadata),author:downloaded.metadata.author,license:downloaded.metadata.license,sourceUrl:downloaded.metadata.url});
    transient=null;
   }
   await step("VALIDATING");
   const {key:_key,generation:_generation,credit:_credit,...settings}=config;
   await(options.validate??createImportService().validate)(claimed.uploadedByUserId,claimed.id,settings,token);
  }catch(e){
   const proposed=(e as any)?.code;
   const code=typeof proposed==="string"&&IMPORT_ERRORS[proposed]?proposed:stage==="DOWNLOADING"?"DOWNLOAD_FAILED":stage==="CONVERTING"?"CONVERSION_FAILED":stage==="OPTIMIZING"?"OPTIMIZATION_FAILED":"VALIDATION_REJECTED";
   await prisma.$transaction(async tx=>{
    const changed=await tx.vehicle3DImport.updateMany({where:{id:claimed.id,leaseToken:token,status:{not:"PUBLISHED"},importStage:{not:"DISCARDED"}},data:{status:"FAILED",importStage:"FAILED",errorCode:code,leaseToken:null,leaseUntil:null,finishedAt:new Date()}});
    if(changed.count)await tx.auditLog.create({data:{actorId:claimed.uploadedByUserId,action:"VEHICLE3D_IMPORT_FAILED",targetId:claimed.id,details:{code,stage}}});
   });
  }finally{clearInterval(heartbeat);removePrivate(transient);}
 };
}
export const processNextSketchfabImport=(id:string|null=null)=>createSketchfabProcessor()(id);
