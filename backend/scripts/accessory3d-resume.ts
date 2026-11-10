// Manual recovery of ONE existing paid task. The provider create method is deliberately disabled.
import {existsSync,statSync,writeFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {prisma} from "../src/prisma.js";
import {createMeshyClient,PROVIDER_DOWNLOAD_MAX_BYTES} from "../src/services/meshy-client.js";
import {createAccessory3DProcessor,createAccessory3DService,resumable} from "../src/services/accessory3d.js";
import {autoFitAccessory} from "../src/services/accessory-autofit.js";
import {privatePath} from "../src/services/vehicle3d-private-assets.js";
import {MAX_MODEL_BYTES} from "../src/services/vehicle3d-validation.js";
const arg=(key:string)=>process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3);
const result:Record<string,unknown>={manual:true,newTaskCreationDisabled:true,additionalCreditsConsumed:0,providerDownloadLimitBytes:PROVIDER_DOWNLOAD_MAX_BYTES,finalRuntimeLimitBytes:MAX_MODEL_BYTES};
try{
 const rows=await prisma.productAccessory3D.findMany({where:arg("request")?{id:arg("request")}:arg("task")?{providerTaskId:arg("task")}:{provider:"MESHY",generationErrorCode:"PROVIDER_ASSET_TOO_LARGE",providerTaskId:{not:null}},take:2});
 if(rows.length!==1)throw Error(`Expected one existing request; found ${rows.length}. Supply --request=ID or --task=ID.`);
 const row=rows[0]!;if(row.provider!=="MESHY"||row.generationMode!=="meshy"||!row.providerTaskId)throw Error("The selected request has no persisted real Meshy task.");
 result.requestId=row.id;result.providerTaskId=row.providerTaskId;result.originalCreditsUsed=row.creditsUsed;result.providerState=row.providerState;
 result.rawBytes=row.rawModelPath&&existsSync(privatePath(row.rawModelPath))?statSync(privatePath(row.rawModelPath)).size:null;
 console.log(JSON.stringify({...result,phase:"PRECHECK"}));
 if(process.argv.includes("--resume")){
  if(row.status!=="GENERATING"&&row.status!=="READY_FOR_FINAL_REVIEW"&&!resumable(row))throw Error("The request is not resumable. This command cannot start a new generation.");
  const real=createMeshyClient({key:process.env.MESHY_API_KEY,maxBytes:PROVIDER_DOWNLOAD_MAX_BYTES});
  const client={...real,create:async()=>{throw Error("New Meshy tasks are forbidden in this recovery command.");}};
  if(!row.rawModelPath||!existsSync(privatePath(row.rawModelPath))){const task=await client.get(row.providerTaskId);if(task.status!=="SUCCEEDED")throw Error(`Existing Meshy task is ${task.status}; no new task was created.`);result.providerState=task.status;}
  const admin=await prisma.user.findFirst({where:{status:"ACTIVE",OR:[{role:"SUPER_ADMIN"},{role:"ADMIN",adminPermissions:{some:{permission:"MANAGE_SPARE_PARTS"}}}]},select:{id:true}});
  if(!admin)throw Error("An active Parts Admin is required.");
  const service=createAccessory3DService();
  if(row.status!=="READY_FOR_FINAL_REVIEW"){
   await service.start(admin.id,row.id,false);
   await createAccessory3DProcessor({client})(row.id);
  }
  await autoFitAccessory(row.id);
  const after=await prisma.productAccessory3D.findUniqueOrThrow({where:{id:row.id}});
  if(after.providerTaskId!==row.providerTaskId||after.creditsUsed!==row.creditsUsed)throw Error("Task identity or recorded credits changed during recovery.");
  result.existingTaskReused=true;result.providerState=after.providerState;result.adminState=after.status;result.stage=after.generationStage;result.errorCode=after.generationErrorCode;result.failureReason=after.failureReason;
  result.rawBytes=after.rawModelPath&&existsSync(privatePath(after.rawModelPath))?statSync(privatePath(after.rawModelPath)).size:null;
  result.optimizedBytes=after.privateModelPath&&existsSync(privatePath(after.privateModelPath))?statSync(privatePath(after.privateModelPath)).size:null;
  result.validation=after.validation;result.processing=(after.sourceMetadata as {processing?:unknown}|null)?.processing??null;
  result.fit=await prisma.accessoryAutoFit.findMany({where:{accessoryId:row.id},select:{generationId:true,fit:true,approvedAt:true}});
  result.privatePreview={candidateReadable:!!after.privateModelPath&&existsSync(privatePath(after.privateModelPath)),sixViewPreviewPresent:!!after.preview,browserOpened:false};
  if(after.generationErrorCode)process.exitCode=1;
 }
}catch(e){result.errorCode=(e as {code?:string}).code??"RECOVERY_BLOCKED";result.error=(e as {code?:string}).code?"Recovery could not access the required database/provider resource.":(e as Error).message;process.exitCode=1;}
finally{
 const out=path.resolve("../.private/meshy-recovery");mkdirSync(out,{recursive:true});writeFileSync(path.join(out,"real-result.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));await prisma.$disconnect();
}
