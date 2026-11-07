import { readFileSync, unlinkSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { createMeshyClient, MeshyError } from "./meshy-client.js";
import { Vehicle3DError } from "./vehicle3d-validation.js";
import { prisma } from "../prisma.js";
import { VIEWS, privatePath, storePrivate, recoverCatalogJournal } from "./vehicle3d-submissions.js";
import { MAX_MODEL_BYTES, normalizeVehicle, verifyViewer } from "./vehicle3d-validation.js";
import { cleanPreviewTemp, processNextAccessory3DJob } from "./accessory3d.js";

/** A deliberately generic preview for testing the workflow. Never claimed to reconstruct photos. */
export async function mockVehicleGLB() {
  const { Document } = await import("@gltf-transform/core");
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene();
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, l: number, color: [number, number, number, number]) => {
    const points = [-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1];
    const positions = new Float32Array(points.map((v,i) => v * [w/2,h/2,l/2][i%3]! + [x,y,z][i%3]!));
    const indices = new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]);
    const primitive = doc.createPrimitive().setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer))
      .setMaterial(doc.createMaterial(name).setBaseColorFactor(color).setDoubleSided(true));
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
  };
  box("MOCK_generic_body",0,.65,0,1.8,.65,4.5,[.45,.5,.6,1]);
  box("MOCK_generic_cabin",0,1.15,-.2,1.5,.6,2.1,[.15,.2,.3,1]);
  for (const x of [-.85,.85]) for (const z of [-1.4,1.4]) box("MOCK_generic_wheel",x,.3,z,.3,.6,.6,[.05,.05,.05,1]);
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

export { createMeshyClient, MeshyError } from "./meshy-client.js";
// Compatibility export for the existing download-host security tests.
export const downloadMeshyGLB = (value: unknown) => createMeshyClient({key:process.env.MESHY_API_KEY,maxBytes:MAX_MODEL_BYTES}).download(value);

type ProcessorOptions = { client?: ReturnType<typeof createMeshyClient>; allowPaid?: boolean; now?: () => Date };
export function createVehicle3DProcessor(options: ProcessorOptions = {}) {
  const client=options.client ?? createMeshyClient({key:process.env.MESHY_API_KEY,maxBytes:MAX_MODEL_BYTES});
  const now=options.now ?? (()=>new Date());
  return async function processJob(onlyId: string | null = null) {
    const claimed=await prisma.$transaction(async tx=>{
      const rows=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Vehicle3DSubmission" WHERE "status"='PROCESSING' AND "deletedAt" IS NULL
        AND (${onlyId}::text IS NULL OR "id"=${onlyId}) AND ("nextPollAt" IS NULL OR "nextPollAt"<=${now()})
        AND ("leaseUntil" IS NULL OR "leaseUntil"<${now()}) ORDER BY "updatedAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if(!rows[0])return null;
      const s=(await tx.vehicle3DSubmission.findUnique({where:{id:rows[0].id}}))!;
      if(s.generationStage==="REQUESTING" && !s.providerTaskId && s.generationMode!=="mock"){
        await tx.vehicle3DSubmission.update({where:{id:s.id},data:{status:"FAILED",generationStage:"FAILED",generationErrorCode:"PROVIDER_REQUEST_UNCONFIRMED",failureReason:"Provider request was not confirmed. Inspect your Meshy account before explicitly retrying.",leaseToken:null,leaseUntil:null}});
        await tx.auditLog.create({data:{actorId:s.userId,action:"VEHICLE3D_REQUEST_UNCONFIRMED",targetId:s.id}});return null;
      }
      const token=randomUUID();
      const claimed=await tx.vehicle3DSubmission.update({where:{id:s.id},data:{leaseToken:token,leaseUntil:new Date(now().getTime()+180000),generationStage:s.rawModelPath?"PREPARING":s.providerTaskId?"GENERATING":"REQUESTING"}});
      await tx.auditLog.create({data:{actorId:s.userId,action:"VEHICLE3D_JOB_CLAIMED",targetId:s.id,details:{revision:s.generationRevision}}});
      return claimed;
    });
    if(!claimed)return;
    const s=claimed;
    const update=async(data: Prisma.Vehicle3DSubmissionUpdateManyMutationInput,action: string)=>prisma.$transaction(async tx=>{
      const r=await tx.vehicle3DSubmission.updateMany({where:{id:s.id,status:"PROCESSING",leaseToken:s.leaseToken},data});
      if(r.count)await tx.auditLog.create({data:{actorId:s.userId,action:`VEHICLE3D_${action}`,targetId:s.id,details:{revision:s.generationRevision}}});
      return r.count===1;
    });
    const release={leaseToken:null,leaseUntil:null};
    const remove=(key: string|null)=>{if(key){try{unlinkSync(privatePath(key));}catch{}}};
    let newRaw: string|null=null,newPrepared: string|null=null;
    try{
      if(!s.initialApprovedAt||!s.initialApprovedByUserId)throw new MeshyError("INITIAL_REVIEW_REQUIRED");
      if(s.processingStartedAt && now().getTime()-s.processingStartedAt.getTime()>3600000)throw new MeshyError("PROVIDER_JOB_TIMEOUT");
      if(s.generationMode!=="mock" && !s.rawModelPath && !s.providerTaskId){
        if(!s.liveAuthorizedAt || !(options.allowPaid ?? (process.env.MESHY_ALLOW_PAID_GENERATION==="1" && process.env.VEHICLE3D_MODE==="real")))throw new MeshyError("LIVE_OPT_IN_REQUIRED");
        const images=VIEWS.map(v=>`data:image/jpeg;base64,${readFileSync(privatePath(s[`${v}PhotoPath`]!)).toString("base64")}`);
        const task=await client.create(images);
        await update({providerTaskId:task,provider:"MESHY",providerState:"PENDING",generationStage:"GENERATING",lastProviderCheckAt:now(),nextPollAt:new Date(now().getTime()+10000),...release},"PROVIDER_TASK_CREATED");return;
      }
      let raw=s.rawModelPath;
      if(!raw){
        let bytes: Buffer;
        if(s.generationMode==="mock")bytes=await mockVehicleGLB();
        else{
          const task=await client.get(s.providerTaskId!);
          const metadata={providerState:task.status,providerProgress:task.progress,providerCreatedAt:task.createdAt,providerStartedAt:task.startedAt,providerFinishedAt:task.finishedAt,lastProviderCheckAt:now(),generationErrorCode:null,failureReason:null};
          if(task.status==="FAILED" || task.status==="CANCELED"){
            await update({...metadata,status:"FAILED",generationStage:"FAILED",generationErrorCode:task.status==="FAILED"?"PROVIDER_GENERATION_FAILED":"PROVIDER_CANCELED",failureReason:"The provider could not complete this generation. Review the photos and retry.",sourceMetadata:{...(s.sourceMetadata as Record<string,Prisma.InputJsonValue>??{}),providerFailureType:task.errorCode??null},...release},"PROVIDER_FAILED");return;
          }
          if(task.status!=="SUCCEEDED"){
            await update({...metadata,generationStage:"GENERATING",nextPollAt:new Date(now().getTime()+10000),...release},"PROVIDER_CHECKED");return;
          }
          if(!await update({...metadata,generationStage:"DOWNLOADING"},"PROVIDER_SUCCEEDED"))return;
          bytes=await client.download(task.glb);
        }
        raw=storePrivate(bytes,"glb");newRaw=raw;
        if(!await update({rawModelPath:raw,generationStage:"PREPARING",providerState:"SUCCEEDED",...(s.generationMode==="mock"?{providerFinishedAt:now()}:{} )},"PREPARATION_START")){remove(raw);return;}
        newRaw=null;
      }
      const config=(s.preparationConfig??{}) as {preRotateX?:number;rotateY?:number};
      const normalized=await normalizeVehicle(readFileSync(privatePath(raw)),s.lengthM,{...config,stripPrivateMetadata:true});
      const prepared=storePrivate(normalized.bytes,"glb");newPrepared=prepared;
      const viewer=await verifyViewer(privatePath(prepared),s.lengthM);
      if(!await update({privateModelPath:prepared,status:"READY",generationStage:"READY",generationErrorCode:null,failureReason:null,nextPollAt:null,
        validation:{...normalized.report,viewer,validatedAt:now().toISOString()},sourceMetadata:{generatedBy:s.generationMode==="mock"?"MOCK":"Meshy",mock:s.generationMode==="mock",generatedAt:now().toISOString(),photoRevision:s.generationRevision},...release},"GENERATION_READY")){remove(prepared);return;}
      newPrepared=null;
    }catch(error){
      remove(newRaw);remove(newPrepared);
      const e=error instanceof MeshyError?error:new MeshyError(error instanceof Vehicle3DError?error.code:"PREPARATION_FAILED");
      if(e.retryable && s.providerTaskId){
        await update({generationErrorCode:e.code,failureReason:"Waiting to retry a recoverable provider request.",nextPollAt:new Date(now().getTime()+e.retryAfterSeconds*1000),...release},"PROVIDER_RETRY_SCHEDULED");
      }else await update({status:"FAILED",generationStage:"FAILED",generationErrorCode:e.code,
        failureReason:error instanceof Vehicle3DError?error.message:e.code==="PROVIDER_REQUEST_UNCONFIRMED"||e.code==="PROVIDER_TIMEOUT"?"Provider request could not be confirmed. Inspect your Meshy account before explicitly retrying.":`Generation stopped (${e.code}). Check configuration/photos before retrying.`,...release},"GENERATION_FAILED");
    }
  };
}
export const processNextVehicle3DJob=(id: string|null=null)=>createVehicle3DProcessor()(id);
export async function startVehicle3DWorker(){
  const {processNextSketchfabImport}=await import("./vehicle3d-import-worker.js");
  await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`;await recoverCatalogJournal(tx);});
  cleanPreviewTemp();
  let running=false;
  // one loop for both pipelines: Garage vehicles (Feature 1) and shop accessories (Feature 2)
  const timer=setInterval(async()=>{if(running)return;running=true;
    try{await processNextVehicle3DJob();}catch{console.error("Vehicle 3D worker could not process a job.");}
    try{await processNextSketchfabImport();}catch{console.error("Vehicle import worker could not process a job.");}
    try{await processNextAccessory3DJob();}catch{console.error("Accessory 3D worker could not process a job.");}
    finally{running=false;}},5000);
  timer.unref();return()=>clearInterval(timer);
}
