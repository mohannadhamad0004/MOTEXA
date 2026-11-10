import {readFileSync,writeFileSync,unlinkSync} from "node:fs";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {prisma} from "../prisma.js";
import type {Prisma} from "../generated/prisma/client.js";
import {normalizeVehicle,parseCarModel,MAX_MODEL_BYTES,fail,digest} from "./vehicle3d-validation.js";
import {privatePath,storePrivate,removePrivate,PRIVATE_3D_DIR} from "./vehicle3d-private-assets.js";
import {stageCatalogPromotion,recoverCatalogJournal} from "./vehicle3d-promotion.js";
import {REPO_ROOT,type ViewerConfig} from "./vehicle3d-catalog.js";
import {field,requirePartsActor,catalogLock} from "./vehicle-taxonomy.js";
import {accessoryGate,autoSegment,segmentFile} from "./car-part-map.js";
import {importInclude,importShape,IMPORT_RUNNING} from "./vehicle3d-import-state.js";
import {linkImportActions} from "./vehicle3d-link-imports.js";
import {FINAL_MODEL_BYTES} from "./vehicle3d-preparation.js";
import {createSketchfabClient} from "./sketchfab-client.js";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const include=importInclude,shape=importShape;
export function createImportService(client=createSketchfabClient()){
 const get=async(uid:string,id:string)=>{await prisma.$transaction(tx=>requirePartsActor(tx,uid));return await prisma.vehicle3DImport.findUnique({where:{id},include})??fail("IMPORT_NOT_FOUND","Import not found.",404);};
 return {
  ...linkImportActions(client),
  list:async(uid:string)=>{await prisma.$transaction(tx=>requirePartsActor(tx,uid));return(await prisma.vehicle3DImport.findMany({include,orderBy:{createdAt:"desc"},take:200})).map(shape);},
  get:async(uid:string,id:string)=>{const r=await get(uid,id),out=shape(r);const m=r.publishedModel3dKey?await prisma.carPartMap.findUnique({where:{model3dKey:r.publishedModel3dKey}}):null;return {...out,partMapStatus:m?m.modelSha256===(r.validation as any)?.sha256?m.confirmedAt?"CONFIRMED":"PROPOSED":"STALE":null};},
  upload:async(uid:string,input:any)=>{
   await prisma.$transaction(tx=>requirePartsActor(tx,uid));const g=await prisma.vehicleGeneration.findUnique({where:{id:field(input.generationId,"generation")},include:{vehicle:{include:{brand:true}}}});if(!g||!g.isActive||!g.vehicle.isActive||!g.vehicle.brand?.isActive)return fail("GENERATION_REQUIRED","Choose an active generation.");
   const source=field(input.source,"source/provenance",2000),author=field(input.author,"rights holder/author",200),license=field(input.license,"license or redistribution permission",500),sourceUrl=input.sourceUrl?field(input.sourceUrl,"source URL",1000):null;if(sourceUrl&&!/^https:\/\/[^\s]+$/.test(sourceUrl))return fail("INVALID_SOURCE","Use an HTTPS source URL.");
   if(typeof input.dataBase64!=="string"||input.dataBase64.length>Math.ceil(MAX_MODEL_BYTES/3)*4)return fail("MODEL_SIZE","Choose a GLB within the configured limit.");const bytes=Buffer.from(input.dataBase64,"base64");
   if(bytes.includes(Buffer.from("MOCK_generic"))||await prisma.vehicle3DSubmission.findFirst({where:{generationMode:"mock",validation:{path:["sha256"],equals:digest(bytes)}},select:{id:true}}))return fail("MOCK_NOT_PUBLISHABLE","Mock previews cannot be imported into the shared catalog.");
   try{await normalizeVehicle(bytes,Number(input.lengthM??4.5));}catch(e){if((e as Error).message!=="Model is not upright. Correct its orientation before review.")throw e;}

   const raw=storePrivate(bytes,"glb");try{const r=await prisma.$transaction(async tx=>{const r=await tx.vehicle3DImport.create({data:{generationId:g.id,uploadedByUserId:uid,rawModelPath:raw,source,author,license,sourceUrl,viewerConfig:{lengthM:Number(input.lengthM??4.5)}},include});await tx.auditLog.create({data:{actorId:uid,action:"VEHICLE3D_IMPORT_UPLOAD",targetId:r.id}});return r;});return shape(r);}catch(e){removePrivate(raw);throw e;}
  },
  validate:async(uid:string,id:string,input:any={},workerToken?:string)=>{
   const r=await get(uid,id);if(r.status==="PUBLISHED")return fail("IMPORT_PUBLISHED","Published imports are immutable.",409);
   if(r.importStage==="DISCARDED")return fail("IMPORT_DISCARDED","This import has been discarded.",409);
   if(IMPORT_RUNNING.includes(r.importStage??r.status)&&r.leaseToken!==workerToken)return fail("IMPORT_BUSY","This import is still being prepared.",409);
   const lengthM=Number(input.lengthM??(r.viewerConfig as any)?.lengthM??4.5),none={x:0,y:0,z:0,scale:1};
   const rawConfig={key:`manual-${id}`,generation:`${r.generation.vehicle.make} ${r.generation.vehicle.model} ${r.generation.code}`,lengthM,rotateY:0,preRotateX:0,groundOffset:0,paintNodes:[],paintMaterials:[],rimsSwappable:false,wing:none,rack:none,...input,credit:{title:(r.sourceMetadata as any)?.title??`${r.generation.vehicle.model} ${r.generation.code}`,author:r.author,url:r.sourceUrl??"",license:r.license}};
   if(Object.keys(input).some(k=>!["lengthM","preRotateX","rotateY","groundOffset","paintNodes","paintMaterials","bakedPaint","centerX","keepBox","zones","rimsSwappable","wing","rack"].includes(k)))return fail("CONFIG_INVALID","Unsupported viewer setting.");
   const checked=parseCarModel(rawConfig);if(!checked)return fail("CONFIG_INVALID","Invalid viewer configuration.");
   // Source corrections are baked into prepared geometry exactly once. Other viewer settings remain configuration.
   const normalized=await normalizeVehicle(readFileSync(privatePath(r.rawModelPath)),lengthM,{preRotateX:checked.preRotateX,rotateY:checked.rotateY});
   if(r.sourceProvider==="SKETCHFAB"&&normalized.bytes.length>FINAL_MODEL_BYTES)return fail("FINAL_ASSET_TOO_LARGE","The optimized model is larger than 8 MiB.",422);
   const config:ViewerConfig={...checked,preRotateX:0,rotateY:0};const prepared=`${randomUUID()}.glb`,configFile=path.join(PRIVATE_3D_DIR,prepared+".config.json");
   if(r.sourceProvider==="SKETCHFAB"){
    const changed=await prisma.vehicle3DImport.updateMany({where:{id,leaseToken:workerToken??null,importStage:{not:"DISCARDED"},status:{not:"PUBLISHED"}},data:{sourceMetadata:json({...r.sourceMetadata as any,pendingPreparedPath:prepared})}});
    if(!changed.count)return fail("IMPORT_BUSY","This attempt is no longer current.",409);
   }
   storePrivate(normalized.bytes,"glb",prepared);
   try{
    writeFileSync(configFile,JSON.stringify(config));const viewerRun=await promisify(execFile)(process.execPath,[path.join(REPO_ROOT,"backend/scripts/vehicle3d-viewer-check.mjs"),privatePath(prepared),String(lengthM),`--config=${configFile}`],{timeout:65000,windowsHide:true});
    const viewerEvidence=JSON.parse(viewerRun.stdout.trim());if(viewerEvidence.valid!==true)return fail("VALIDATION_REJECTED","The production viewer rejected this asset.",422);
    // accessory quality gate (FULL / LIMITED / REJECTED) from the prepared model's own segmentation, shown before publishing
    if(workerToken){const changed=await prisma.vehicle3DImport.updateMany({where:{id,leaseToken:workerToken,importStage:{not:"DISCARDED"}},data:{importStage:"GENERATING_PART_MAP"}});if(!changed.count)return fail("IMPORT_DISCARDED","This attempt is no longer current.",409);}
    const seg=await segmentFile(privatePath(prepared),{...config,key:`manual-${id}`}).catch(()=>null);const gate=seg?accessoryGate(seg.pieces,seg.dims,seg.proposal):null;
    if(!seg)return fail("VALIDATION_REJECTED","Part detection and quality validation could not complete.",422);
    const updated=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT "id" FROM "Vehicle3DImport" WHERE "id"=${id} FOR UPDATE`;const current=await tx.vehicle3DImport.findUniqueOrThrow({where:{id}});if(current.status==="PUBLISHED"||current.importStage==="DISCARDED"||workerToken&&current.leaseToken!==workerToken)return fail("IMPORT_BUSY","This attempt is no longer current.",409);const row=await tx.vehicle3DImport.update({where:{id},data:{sourceMetadata:r.sourceProvider==="SKETCHFAB"?json({...r.sourceMetadata as any,pendingRawPath:null,pendingPreparedPath:null}):undefined,status:"READY",importStage:r.sourceProvider==="SKETCHFAB"?"READY":null,privateModelPath:prepared,viewerConfig:json(config),errorCode:gate?.verdict==="REJECTED"?"VALIDATION_REJECTED":null,finishedAt:new Date(),leaseToken:null,leaseUntil:null,validation:json({...normalized.report,accessoryGate:gate,partMap:seg?{...seg,sha256:normalized.report.sha256,segmentedAt:new Date().toISOString()}:null,validatedAt:new Date().toISOString(),sourceOrientation:{preRotateX:checked.preRotateX??0,rotateY:checked.rotateY},viewer:viewerEvidence}),visuallyVerifiedAt:null},include});await tx.auditLog.create({data:{actorId:uid,action:"VEHICLE3D_IMPORT_VALIDATE",targetId:id}});return{row,previous:current.privateModelPath};});removePrivate(updated.previous);return shape(updated.row);
   }catch(e){removePrivate(prepared);throw e;}finally{try{unlinkSync(configFile);}catch{}}
  },
  asset:async(uid:string,id:string)=>{const r=await get(uid,id);if(r.importStage==="DISCARDED"||!r.privateModelPath)return fail("MODEL_REQUIRED","Validate this model first.",409);return readFileSync(privatePath(r.privateModelPath));},
  publish:async(uid:string,id:string,input:any)=>{
   if(input.visuallyVerified!==true)return fail("VISUAL_REVIEW_REQUIRED","Explicit visual verification is required.");
   let published:string|null=null;
   try{const out=await prisma.$transaction(async tx=>{await requirePartsActor(tx,uid);await catalogLock(tx);await recoverCatalogJournal(tx);await tx.$queryRaw`SELECT "id" FROM "Vehicle3DImport" WHERE "id"=${id} FOR UPDATE`;const r=await tx.vehicle3DImport.findUniqueOrThrow({where:{id},include});
    if(r.status==="PUBLISHED")return shape(r);
    if(r.status!=="READY"||!r.privateModelPath||(r.validation as any)?.valid!==true)return fail("IMPORT_NOT_READY","Validate this import before publishing.",409);if((r.validation as any)?.accessoryGate?.verdict==="REJECTED")return fail("MODEL_REJECTED","This model failed the accessory quality gate: "+((r.validation as any).accessoryGate.text??[]).join("; ")+". Fix the model or its settings and validate again.",409);
    if(r.sourceProvider==="SKETCHFAB"&&(!(r.sourceMetadata as any)?.allowed||!(r.validation as any)?.accessoryGate||(r.validation as any)?.partMap?.sha256!==(r.validation as any)?.sha256))return fail("VALIDATION_REJECTED","Source evidence and quality validation are required.",409);
    if(input.validationVersion!==(r.validation as any).validatedAt)return fail("STALE_VALIDATION","The model changed. Reload and visually verify the current preview.",409);
    const g=await tx.vehicleGeneration.findUniqueOrThrow({where:{id:r.generationId},include:{vehicle:{include:{brand:true}}}});if(!g.isActive||!g.vehicle.isActive||!g.vehicle.brand?.isActive)return fail("INACTIVE","Activate the taxonomy before publishing.");
    const bytes=readFileSync(privatePath(r.privateModelPath)),normalized=await normalizeVehicle(bytes,(r.viewerConfig as any).lengthM);if(digest(bytes)!==(r.validation as any).sha256)return fail("ASSET_CHANGED","Validate the changed model again.");
    if(r.sourceProvider==="SKETCHFAB"&&bytes.length>FINAL_MODEL_BYTES)return fail("FINAL_ASSET_TOO_LARGE","The optimized model is larger than 8 MiB.",422);
    if(r.sourceProvider==="SKETCHFAB"&&g.model3dKey&&(g.model3dKey!==input.replaceExistingKey))return fail("PUBLICATION_CONFLICT","The current model changed. Reload before confirming replacement.",409);
    const key=`manual-${r.generationId}-${(r.validation as any).sha256.slice(0,16)}`,config={...(r.viewerConfig as ViewerConfig),key};
    const provenance=r.sourceMetadata as any;
    await stageCatalogPromotion(tx,{generationId:r.generationId,entry:{key,file:key,make:g.vehicle.make,model:g.vehicle.model,code:g.code,...config.credit,inApp:true,finalStatus:"PASS_VARIANT",source:r.source,viewerConfig:config,
      ...(r.sourceProvider==="SKETCHFAB"?{sourceUid:r.sourceUid,authorUrl:provenance.authorUrl,licenseUrl:provenance.licenseUrl,sourceMetadata:provenance,preparedSha256:(r.validation as any).sha256}: {})},bytes,expectedExistingKey:input.replaceExistingKey,importId:id,actorId:uid});
    const seg=(r.validation as any).partMap;
    if(seg?.sha256===(r.validation as any).sha256)await tx.carPartMap.create({data:{model3dKey:key,modelSha256:seg.sha256,pieces:seg.pieces,dims:seg.dims,proposal:seg.proposal,segmentedAt:new Date(seg.segmentedAt),map:seg.map??undefined,confirmedAt:seg.confirmedAt?new Date(seg.confirmedAt):null,confirmedByUserId:seg.confirmedByUserId??null}});
    const saved=await tx.vehicle3DImport.update({where:{id},data:{status:"PUBLISHED",importStage:r.sourceProvider==="SKETCHFAB"?"PUBLISHED":null,publishedModel3dKey:key,visuallyVerifiedAt:new Date(),reviewNotes:typeof input.notes==="string"?input.notes.slice(0,2000):null},include});return shape(saved);
   },{timeout:90000});published=out.publishedModel3dKey;return out;}finally{await prisma.$transaction(async tx=>{await catalogLock(tx);await recoverCatalogJournal(tx);});if(published)void autoSegment(published);}
  }
 };
}
