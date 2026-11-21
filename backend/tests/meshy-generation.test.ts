import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {existsSync,readFileSync,readdirSync,unlinkSync,rmSync} from "node:fs";
import path from "node:path";
import sharp from "sharp";
import express from "express";
import {prisma} from "../src/prisma.js";
import {createMeshyClient,MeshyError,parseMeshyTask} from "../src/services/meshy-client.js";
import {createVehicle3DProcessor,mockVehicleGLB} from "../src/services/vehicle3d-generation.js";
import {createSubmissionService,PRIVATE_3D_DIR,privatePath} from "../src/services/vehicle3d-submissions.js";
import {catalogFiles,readManifest,atomicWrite,REPO_ROOT} from "../src/services/vehicle3d-catalog.js";
import {createVehicle3DRouter} from "../src/routes/vehicle3d.routes.js";
import {NodeIO} from "@gltf-transform/core";
import {generationMode,paidGenerationEnabled,requireFixtureRuntime} from "../src/services/generation-runtime.js";
after(()=>prisma.$disconnect());
const json=(body:unknown,status=200,headers?:Record<string,string>)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json",...headers}});
test("normal runtime always selects real providers and refuses test geometry",()=>{
 const keys=["NODE_ENV","NODE_TEST_CONTEXT","VEHICLE3D_MODE","MESHY_ALLOW_PAID_GENERATION"],before=keys.map(k=>process.env[k]);
 try{
  process.env.NODE_ENV="development";process.env.VEHICLE3D_MODE="mock";delete process.env.MESHY_ALLOW_PAID_GENERATION;
  assert.equal(generationMode(),"meshy");assert.equal(paidGenerationEnabled(),true);assert.throws(requireFixtureRuntime,{code:"TEST_FIXTURE_ONLY"});
  process.env.NODE_ENV="test";delete process.env.NODE_TEST_CONTEXT;assert.equal(generationMode(),"meshy");assert.throws(requireFixtureRuntime,{code:"TEST_FIXTURE_ONLY"});
  process.env.NODE_TEST_CONTEXT="child-v8";assert.equal(generationMode(),"mock");assert.equal(paidGenerationEnabled(),false);requireFixtureRuntime();
 }finally{for(const[k,i]of keys.map((k,i)=>[k,i]as const)){if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];}}
});
test("Meshy client uses four private data URIs, backend bearer auth, and strictly parses the documented contract",async()=>{
  const calls:{url:string;options:RequestInit|undefined}[]=[];
  const fetcher=(async(url,options)=>{calls.push({url:String(url),options});return json({result:"opaque-provider-task"},202);}) as typeof fetch;
  const client=createMeshyClient({key:"test-key-never-log",fetcher,maxBytes:1024});
  assert.equal(await client.create([0,1,2,3].map(i=>`data:image/jpeg;base64,${i}`)),"opaque-provider-task");
  assert.equal(calls.length,1);assert.equal(calls[0]!.url,"https://api.meshy.ai/openapi/v1/multi-image-to-3d");
  const body=JSON.parse(calls[0]!.options!.body as string);assert.equal(body.image_urls.length,4);assert.equal(body.ai_model,"meshy-7.1");assert.equal(body.should_remesh,true);assert.equal(body.texture_resolution,"2k");assert.deepEqual(body.target_formats,["glb"]);assert.ok(!JSON.stringify(body).includes("test-key"));
  assert.equal(parseMeshyTask({id:"id",status:"IN_PROGRESS",progress:37},"id").progress,37);
  assert.equal(parseMeshyTask({id:"id",status:"PENDING"},"id").progress,null);
  assert.throws(()=>parseMeshyTask({id:"other",status:"SUCCEEDED"},"id"),/MALFORMED/);
  assert.throws(()=>parseMeshyTask({id:"id",status:"MADE_UP"},"id"),/MALFORMED/);
});
test("provider auth, credits, missing task, rate limits, timeouts and malformed responses are sanitized",async()=>{
  for(const[status,code]of [[401,"PROVIDER_AUTH"],[402,"PROVIDER_CREDITS"],[404,"PROVIDER_TASK_NOT_FOUND"],[429,"PROVIDER_RATE_LIMIT"]]as const){
    const client=createMeshyClient({key:"private-test-key",maxBytes:100,fetcher:(async()=>json({message:"secret signed URL should never appear"},status,{"retry-after":"25"}))as typeof fetch});
    await assert.rejects(client.get("task"),(e:any)=>e.code===code&&!e.message.includes("signed")&&(status!==429||e.retryable&&e.retryAfterSeconds===25));
  }
  await assert.rejects(createMeshyClient({maxBytes:10}).get("id"),/KEY_MISSING/);
  await assert.rejects(createMeshyClient({key:"fake",maxBytes:10,fetcher:(async()=>{throw Error("private network URL");})as typeof fetch}).get("id"),(e:any)=>e.code==="PROVIDER_TIMEOUT"&&e.retryable);
  await assert.rejects(createMeshyClient({key:"fake",maxBytes:10,fetcher:(async()=>new Response("not-json"))as typeof fetch}).get("id"),/MALFORMED/);
  const tooLarge=createMeshyClient({key:"fake",maxBytes:4,fetcher:(async()=>new Response(new Uint8Array(8)))as typeof fetch});
  await assert.rejects(tooLarge.download("https://assets.meshy.ai/model.glb"),/DOWNLOAD_TOO_LARGE/);
});
async function fixture(work:(f:{uid:string;carId:string;id:string;admin:string;service:ReturnType<typeof createSubmissionService>;due:()=>Promise<void>})=>Promise<void>){
  const before=new Map([...catalogFiles(readManifest()).keys()].map(p=>[p,readFileSync(p,"utf8")]));
  const publicBefore=new Set(readdirSync(path.join(REPO_ROOT,"backend/public/3d")));
  const storageBefore=new Set(existsSync(PRIVATE_3D_DIR)?readdirSync(PRIVATE_3D_DIR):[]);
  const uid=randomUUID(),admin=randomUUID(),vid=randomUUID(),gid=randomUUID(),carId=randomUUID();
  const old={mode:process.env.VEHICLE3D_MODE,allow:process.env.MESHY_ALLOW_PAID_GENERATION,key:process.env.MESHY_API_KEY};
  process.env.VEHICLE3D_MODE="real";process.env.MESHY_ALLOW_PAID_GENERATION="1";process.env.MESHY_API_KEY="mock-http-only-no-network";
  try{
    for(const[id,role]of [[uid,"CUSTOMER"],[admin,"ADMIN"]]as const)await prisma.user.create({data:{id,email:`${id}@meshy-test.invalid`,fullName:"Private identity must not be published",passwordHash:"no-login",role,status:"ACTIVE"}});
    await prisma.adminPermission.create({data:{adminId:admin,permission:"MANAGE_SPARE_PARTS"}});
    await prisma.vehicleBrand.create({data:{id:vid,name:vid,nameAr:vid,normalizedName:vid}});
    await prisma.vehicle.create({data:{brandId:vid,id:vid,make:vid,model:"Test",makeAr:"Test",modelAr:"Test",makeNormalized:vid,modelNormalized:"test",yearFrom:2000,yearTo:2030}});
    await prisma.vehicleGeneration.create({data:{id:gid,vehicleId:vid,code:"Test",nameEn:"Test",nameAr:"Test",yearFrom:2000,yearTo:2030}});
    await prisma.customerGarageCar.create({data:{id:carId,userId:uid,make:vid,model:"Test",year:2010,generationId:gid}});
    const service=createSubmissionService(),s=await service.create(uid,carId);
    for(const[view,color]of [["front","red"],["rear","blue"],["left","green"],["right","white"]]){
      const jpg=await sharp({create:{width:40,height:40,channels:3,background:color!}}).jpeg().toBuffer();await service.photo(uid,s.id,view!,jpg.toString("base64"));
    }
    await prisma.vehicle3DSubmission.update({where:{id:s.id},data:{initialApprovedAt:new Date(),initialApprovedByUserId:admin}});
    await work({uid,carId,id:s.id,admin,service,due:async()=>{await prisma.vehicle3DSubmission.update({where:{id:s.id},data:{nextPollAt:new Date(0)}});}});
  }finally{
    for(const[k,v]of Object.entries({VEHICLE3D_MODE:old.mode,MESHY_ALLOW_PAID_GENERATION:old.allow,MESHY_API_KEY:old.key})){if(v===undefined)delete process.env[k];else process.env[k]=v;}
    for(const[p,text]of before)atomicWrite(p,text);
    for(const p of readdirSync(path.join(REPO_ROOT,"backend/public/3d")))if(!publicBefore.has(p))unlinkSync(path.join(REPO_ROOT,"backend/public/3d",p));
    if(existsSync(PRIVATE_3D_DIR))for(const p of readdirSync(PRIVATE_3D_DIR))if(!storageBefore.has(p))rmSync(path.join(PRIVATE_3D_DIR,p),{recursive:true,force:true}); // also a background segmentation temp folder
    await prisma.vehicle3DRevision.deleteMany({where:{generationId:gid}});await prisma.vehicle3DSubmission.deleteMany({where:{userId:uid}});await prisma.customerGarageCar.deleteMany({where:{id:carId}});await prisma.vehicleGeneration.deleteMany({where:{id:gid}});await prisma.vehicle.deleteMany({where:{id:vid}});await prisma.vehicleBrand.deleteMany({where:{id:vid}});
    await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:[uid,admin]}},{targetId:gid}]}});await prisma.adminPermission.deleteMany({where:{adminId:admin}});await prisma.user.deleteMany({where:{id:{in:[uid,admin]}}});
  }
}
test("real job lifecycle is idempotent, survives processor restart, downloads/prepares privately and promotes without private provenance",async()=>fixture(async f=>{
  let creates=0,polls=0,downloads=0;const task="private-task-that-must-not-be-public";
  const doc=await new NodeIO().readBinary(await mockVehicleGLB());
  doc.getRoot().setExtras({customer:f.uid,task});doc.getRoot().listMeshes()[0]!.setName(task).setExtras({privateCustomer:f.uid});
  const bytes=Buffer.from(await new NodeIO().writeBinary(doc));
  const client=createMeshyClient({key:"fake",maxBytes:8*1048576,fetcher:(async(url,options)=>{
    if(options?.method==="POST"){creates++;const data=JSON.parse(options.body as string);assert.equal(data.image_urls.length,4);return json({result:task},202);}
    if(String(url).startsWith("https://assets.meshy.ai/")){downloads++;assert.equal(options?.headers,undefined);return new Response(bytes);}
    polls++;return json({id:task,status:polls===1?"IN_PROGRESS":"SUCCEEDED",progress:polls===1?34:100,model_urls:polls===1?{}:{glb:"https://assets.meshy.ai/output.glb?private-signature"},created_at:Date.now()-5000,started_at:Date.now()-3000,finished_at:polls>1?Date.now():0});
  })as typeof fetch});
  const generated=await Promise.all([f.service.generate(f.uid,f.id,true,f.admin),f.service.generate(f.uid,f.id,true,f.admin)]);
  assert.equal(generated[0]!.generationRevision,1);assert.equal(generated[1]!.generationRevision,1);
  await createVehicle3DProcessor({client,allowPaid:true})(f.id);assert.equal(creates,1);
  await f.due();await createVehicle3DProcessor({client,allowPaid:true})(f.id);
  assert.equal((await f.service.get(f.uid,f.id)).providerProgress,34);
  await f.due();await createVehicle3DProcessor({client,allowPaid:true})(f.id);
  const ready=await f.service.get(f.uid,f.id);assert.equal(ready.status,"READY",ready.failureReason??"");assert.equal(creates,1);assert.equal(downloads,1);
  assert.ok(!JSON.stringify(ready).includes(task));assert.ok(!JSON.stringify(ready).includes("signature"));assert.ok(ready.hasModel);
  const row=(await prisma.vehicle3DSubmission.findUnique({where:{id:f.id}}))!;assert.equal(row.providerTaskId,task);assert.ok(row.rawModelPath);assert.ok(row.privateModelPath);
  const prepared=(await f.service.asset(f.uid,f.id,"model")).bytes.toString("utf8");assert.ok(!prepared.includes(task));assert.ok(!prepared.includes(f.uid));
  assert.equal(await prisma.vehicleGeneration.count({where:{id:row.generationId!,model3dKey:{not:null}}}),0);
  await assert.rejects(f.service.submit(f.uid,f.id,false));await f.service.submit(f.uid,f.id,true);
  const result=await f.service.approve(f.admin,f.id,{notes:"All photos and orientation verified",visuallyVerified:true,modelRevision:ready.modelRevision});assert.equal(result.status,"APPROVED");
  const publicText=JSON.stringify(readManifest());assert.ok(!publicText.includes(task));assert.ok(!publicText.includes(f.uid));assert.ok(!publicText.includes(f.id));
  const app=express();app.use("/api",createVehicle3DRouter(f.service,{auth:(_req,res,next)=>{res.locals.authUser={id:f.admin,role:"ADMIN",status:"ACTIVE"};next();},customer:(_req,_res,next)=>next(),admin:(_req,_res,next)=>next()}));
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  try{const response=await fetch(`http://127.0.0.1:${(server.address()as{port:number}).port}/api/catalog/3d-models`);const catalog=await response.json()as any;
    assert.ok(catalog.models.some((m:any)=>m.key===result.approvedModel3dKey));assert.match(catalog.revision,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(catalog).includes(task));
  }finally{await new Promise<void>(r=>server.close(()=>r()));}
}));
test("real mode needs a key and explicit paid opt-in; failed POST cannot auto-repeat on restart",async()=>fixture(async f=>{
  delete process.env.MESHY_API_KEY;await assert.rejects(f.service.generate(f.uid,f.id,true,f.admin),(e:any)=>e.code==="PROVIDER_KEY_MISSING");
  process.env.MESHY_API_KEY="fake";delete process.env.MESHY_ALLOW_PAID_GENERATION;await assert.rejects(f.service.generate(f.uid,f.id,true,f.admin),(e:any)=>e.code==="LIVE_OPT_IN_REQUIRED");
  process.env.MESHY_ALLOW_PAID_GENERATION="1";await f.service.generate(f.uid,f.id,true,f.admin);
  await prisma.vehicle3DSubmission.update({where:{id:f.id},data:{generationStage:"REQUESTING",leaseUntil:new Date(0)}});
  let calls=0;const client=createMeshyClient({key:"fake",maxBytes:100,fetcher:(async()=>{calls++;throw Error();})as typeof fetch});
  await createVehicle3DProcessor({client,allowPaid:true})(f.id);
  assert.equal(calls,0);assert.equal((await f.service.get(f.uid,f.id)).generationErrorCode,"PROVIDER_REQUEST_UNCONFIRMED");
}));
test("provider failures, auth errors, missing tasks, malformed responses and invalid GLBs fail safely",async t=>{
  for(const kind of ["auth","provider-failed","missing-task","malformed","bad-glb"]){await t.test(kind,async()=>fixture(async f=>{
    await f.service.generate(f.uid,f.id,true,f.admin);
    const client=createMeshyClient({key:"fake",maxBytes:100000,fetcher:(async(url,options)=>{
      if(options?.method==="POST")return kind==="auth"?json({},401):json({result:"task"},202);
      if(String(url).includes("assets.meshy.ai"))return new Response("invalid GLB");
      if(kind==="missing-task")return json({},404);
      if(kind==="malformed")return json({id:"task",status:"UNKNOWN"});
      return json({id:"task",status:kind==="provider-failed"?"FAILED":"SUCCEEDED",task_error:kind==="provider-failed"?{type:"invalid_input",message:"private provider detail"}:null,model_urls:{glb:"https://assets.meshy.ai/model.glb"}});
    })as typeof fetch});
    await createVehicle3DProcessor({client,allowPaid:true})(f.id);
    if(kind!=="auth"){await f.due();await createVehicle3DProcessor({client,allowPaid:true})(f.id);}
    const s=await f.service.get(f.uid,f.id);assert.equal(s.status,"FAILED");assert.ok(!s.hasModel);assert.ok(s.generationErrorCode);
    if(kind==="provider-failed"){const row=await prisma.vehicle3DSubmission.findUnique({where:{id:f.id}});assert.equal((row?.sourceMetadata as any)?.providerFailureType,"invalid_input");assert.ok(!JSON.stringify(s).includes("private provider detail"));}
    await assert.rejects(f.service.submit(f.uid,f.id,true));
  }));}
});
test("rate limit and polling timeout resume the same task; deletion prevents late output from becoming visible",async()=>fixture(async f=>{
  await f.service.generate(f.uid,f.id,true,f.admin);let calls=0,deleteDuringPoll=false,downloads=0;
  const client=createMeshyClient({key:"fake",maxBytes:1000,fetcher:(async(_url,options)=>{
    if(options?.method==="POST")return json({result:"same-task"},202);
    if(String(_url).includes("assets.meshy.ai")){downloads++;return new Response("should never be downloaded");}
    if(deleteDuringPoll){await f.service.delete(f.uid,f.id);return json({id:"same-task",status:"SUCCEEDED",model_urls:{glb:"https://assets.meshy.ai/late.glb"}});}
    calls++;if(calls===1)return json({},429,{"retry-after":"30"});if(calls===2)throw new Error("timeout");return json({id:"same-task",status:"IN_PROGRESS",progress:49});
  })as typeof fetch});
  await createVehicle3DProcessor({client,allowPaid:true})(f.id);
  for(let i=0;i<3;i++){await f.due();await createVehicle3DProcessor({client,allowPaid:true})(f.id);assert.equal((await f.service.get(f.uid,f.id)).status,"PROCESSING");}
  assert.equal((await f.service.get(f.uid,f.id)).providerProgress,49);
  deleteDuringPoll=true;await f.due();await createVehicle3DProcessor({client,allowPaid:true})(f.id);await assert.rejects(f.service.get(f.uid,f.id));assert.equal(downloads,0);
}));
test("retry after fixing provider authorization resumes the saved task instead of creating a new paid job",async()=>fixture(async f=>{
  await f.service.generate(f.uid,f.id,true,f.admin);let creates=0,authorized=false;
  const client=createMeshyClient({key:"fake",maxBytes:1000,fetcher:(async(_url,options)=>{
    if(options?.method==="POST"){creates++;return json({result:"known-task"},202);}
    return authorized?json({id:"known-task",status:"IN_PROGRESS",progress:52}):json({},401);
  })as typeof fetch});
  await createVehicle3DProcessor({client,allowPaid:true})(f.id);await f.due();await createVehicle3DProcessor({client,allowPaid:true})(f.id);
  assert.equal((await f.service.get(f.uid,f.id)).status,"FAILED");
  authorized=true;const resumed=await f.service.generate(f.uid,f.id,true,f.admin);assert.equal(resumed.generationRevision,1);
  await createVehicle3DProcessor({client,allowPaid:true})(f.id);assert.equal(creates,1);assert.equal((await f.service.get(f.uid,f.id)).providerProgress,52);
}));

test("admin revalidation, regeneration request and customer reset preserve consent boundaries",async()=>fixture(async f=>{
  await f.service.generate(f.uid,f.id,true,f.admin);
  await assert.rejects(f.service.validate(f.admin,f.id),/Wait for generation/);
  const bytes=await mockVehicleGLB();
  const client=createMeshyClient({key:"fake",maxBytes:100000,fetcher:(async(url,options)=>{
    if(options?.method==="POST")return json({result:"review-task"},202);
    if(String(url).includes("assets.meshy.ai"))return new Response(bytes);
    return json({id:"review-task",status:"SUCCEEDED",model_urls:{glb:"https://assets.meshy.ai/review.glb"}});
  })as typeof fetch});
  await createVehicle3DProcessor({client,allowPaid:true})(f.id);await f.due();await createVehicle3DProcessor({client,allowPaid:true})(f.id);
  await f.service.submit(f.uid,f.id,true);
  const checked=await f.service.validate(f.admin,f.id,{rotateY:Math.PI});assert.equal(checked.status,"SUBMITTED");
  await assert.rejects(f.service.requestRegeneration(f.admin,f.id,""));
  const returned=await f.service.requestRegeneration(f.admin,f.id,"Please replace the blurred front photo");assert.equal(returned.status,"REJECTED");
  const draft=await f.service.regenerate(f.uid,f.id);assert.equal(draft.status,"DRAFT");assert.equal(draft.hasModel,false);assert.equal(draft.catalogConsentAt,null);
  const row=(await prisma.vehicle3DSubmission.findUnique({where:{id:f.id}}))!;assert.equal(row.providerTaskId,null);assert.ok(Array.isArray(row.generationHistory));
  await assert.rejects(f.service.regenerate(f.uid,f.id));
}));
