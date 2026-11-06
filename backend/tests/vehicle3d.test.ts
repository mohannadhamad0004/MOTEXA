import {createCatalogRequestService} from "../src/services/vehicle-catalog-requests.js";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/prisma.js";
import { createVehicle3DRouter } from "../src/routes/vehicle3d.routes.js";
import { createSubmissionService, storePrivate, privatePath, PRIVATE_3D_DIR, recoverCatalogJournal } from "../src/services/vehicle3d-submissions.js";
import { normalizeVehicle, verifyViewer } from "../src/services/vehicle3d-validation.js";
import { mockVehicleGLB, downloadMeshyGLB, processNextVehicle3DJob } from "../src/services/vehicle3d-generation.js";
import { REPO_ROOT, catalogFiles, readManifest, atomicWrite, activeModels } from "../src/services/vehicle3d-catalog.js";
import { genKey } from "../src/generations.js";

after(() => prisma.$disconnect());
test("cleanup metadata agrees with production, configurations, attribution and current DB pointers", async () => {
  const manifest = readManifest(), active = activeModels();
  const publicFiles = readdirSync(path.join(REPO_ROOT,"backend/public/3d")).filter(f => f.endsWith(".glb"));
  assert.equal(active.length,21); assert.equal(publicFiles.length,active.length);
  for (const e of Object.values(manifest)) {
    assert.equal(existsSync(path.join(REPO_ROOT,"backend/public/3d",`${e.file}.glb`)),e.inApp !== false);
    if (e.inApp !== false) { assert.ok(e.viewerConfig);assert.ok(e.license);assert.ok(e.author); }
  }
  const generated = catalogFiles(manifest);
  for (const [file,text] of generated) assert.equal(readFileSync(file,"utf8"),text);
  const stale = await prisma.vehicleGeneration.count({where:{model3dKey:{not:null,notIn:active.map(m=>m.key)}}});
  assert.equal(stale,0);
});
test("submission migration is additive", () => {
  const sql=readFileSync("prisma/migrations/20261104190000_vehicle_3d_submissions/migration.sql","utf8");
  assert.doesNotMatch(sql,/\b(DROP|RENAME)\b/i);assert.match(sql,/one_open_per_car/);
});
test("an interrupted uncommitted promotion restores catalog snapshots and removes only its new GLB", async () => {
  const file=path.join(REPO_ROOT,"backend/public/3d",`customer-recovery-${randomUUID()}.glb`);
  const files=catalogFiles(readManifest()),before=[...files.keys()].map(p=>[p,readFileSync(p,"utf8")]);
  const journal=path.join(PRIVATE_3D_DIR,"promotion-journal.json");
  mkdirSync(PRIVATE_3D_DIR,{recursive:true});
  assert.equal(existsSync(journal),false);
  atomicWrite(file,Buffer.from("incomplete publication"));
  atomicWrite(journal,JSON.stringify({submissionId:randomUUID(),shared:file,key:"recovery-fixture",before}));
  try {
    await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`;await recoverCatalogJournal(tx);});
    assert.equal(existsSync(journal),false);assert.equal(existsSync(file),false);
    for(const [p,text] of before)assert.equal(readFileSync(p!,"utf8"),text);
  } finally {if(existsSync(journal))unlinkSync(journal);if(existsSync(file))unlinkSync(file);}
});
test("technical validation rejects malformed containers and unsafe resources; normalizes a renderable GLB", async () => {
  await assert.rejects(normalizeVehicle(Buffer.from("not a GLB"),4.5),/Invalid GLB/);
  const normalized=await normalizeVehicle(await mockVehicleGLB(),4.7);
  assert.ok(Math.abs(normalized.report.dimensions[2]!-4.7)<.001);
  const key=storePrivate(normalized.bytes,"glb");
  try { assert.equal((await verifyViewer(privatePath(key),4.7)).views,6); } finally { unlinkSync(privatePath(key)); }
  await assert.rejects(downloadMeshyGLB("http://127.0.0.1:1/private"),/PROVIDER_ASSET_HOST_REJECTED/);
  await assert.rejects(downloadMeshyGLB("https://example.org/model.glb"),/PROVIDER_ASSET_HOST_REJECTED/);
});

test("durable mock job reaches a private READY preview, cannot submit, and deletes cleanly", async () => {
  const uid=randomUUID(),vid=randomUUID(),cid=randomUUID();
  const previousMode=process.env.VEHICLE3D_MODE;
  const service=createSubmissionService();let submissionId="";
  process.env.VEHICLE3D_MODE="mock";
  try {
    await prisma.user.create({data:{id:uid,email:`${uid}@vehicle3d-test.invalid`,fullName:"Mock worker fixture",passwordHash:"no-login",role:"CUSTOMER",status:"ACTIVE"}});
    await prisma.vehicle.create({data:{id:vid,make:vid,model:"Worker",makeAr:"Test",modelAr:"Test",makeNormalized:vid,modelNormalized:"worker",yearFrom:2000,yearTo:2030}});
    await prisma.customerGarageCar.create({data:{id:cid,userId:uid,make:vid,model:"Worker",year:2010}});
    const submission=await service.create(uid,cid);submissionId=submission.id;
    const jpg=await sharp({create:{width:40,height:40,channels:3,background:"blue"}}).jpeg().toBuffer();
    for(const view of ["front","rear","left","right"])await service.photo(uid,submissionId,view,jpg.toString("base64"));
    await prisma.user.update({where:{id:uid},data:{role:"ADMIN"}});
    await prisma.adminPermission.create({data:{adminId:uid,permission:"MANAGE_SPARE_PARTS"}});
    await prisma.vehicle3DSubmission.update({where:{id:submissionId},data:{initialApprovedAt:new Date(),initialApprovedByUserId:uid}});
    await service.generate(uid,submissionId,true,uid);
    await processNextVehicle3DJob(submissionId);
    const result=await service.get(uid,submissionId);
    assert.equal(result.status,"READY",result.failureReason??"");assert.equal(result.generationMode,"mock");assert.equal(result.hasModel,true);
    assert.ok((await service.asset(uid,submissionId,"model")).bytes.length>0);
    await assert.rejects(service.submit(uid,submissionId,true),(e:any)=>e.code==="MOCK_NOT_PUBLISHABLE");
    await service.delete(uid,submissionId);submissionId="";
    assert.equal(await prisma.vehicle3DSubmission.count({where:{garageCarId:cid}}),0);
  } finally {
    if(previousMode===undefined)delete process.env.VEHICLE3D_MODE;else process.env.VEHICLE3D_MODE=previousMode;
    if(submissionId)await service.delete(uid,submissionId);
    await prisma.customerGarageCar.deleteMany({where:{id:cid}});await prisma.vehicle.deleteMany({where:{id:vid}});
    await prisma.auditLog.deleteMany({where:{actorId:uid}});await prisma.user.deleteMany({where:{id:uid}});
  }
});

test("real authentication, Parts Admin authorization, private assets and catalog promotion", async t => {
  const ids: string[]=[]; const storageBefore=new Set(existsSync(PRIVATE_3D_DIR)?readdirSync(PRIVATE_3D_DIR):[]);
  const fileBefore=new Map([...catalogFiles(readManifest()).keys()].map(file=>[file,readFileSync(file,"utf8")]));
  const publicBefore=new Set(readdirSync(path.join(REPO_ROOT,"backend/public/3d")));
  const rollback=new Error("rollback-only fixtures");
  const users = [];
  try {
    for (const role of ["CUSTOMER","CUSTOMER","ADMIN","ADMIN"] as const) {
      const u=await prisma.user.create({data:{email:`${randomUUID()}@vehicle3d-test.invalid`,fullName:"Vehicle 3D test",passwordHash:"not-a-login",role,status:"ACTIVE"}});ids.push(u.id);users.push(u);
    }
    const [a,b,admin,otherAdmin]=users;
    await prisma.adminPermission.create({data:{adminId:admin!.id,permission:"MANAGE_SPARE_PARTS"}});
    const token=(id:string)=>jwt.sign({sessionVersion:0},process.env.JWT_SECRET!,{subject:id,algorithm:"HS256",expiresIn:"5m"});
    await prisma.$transaction(async tx=>{
      const key=randomUUID();
      const brand=await tx.vehicleBrand.create({data:{name:randomUUID(),nameAr:"Test",normalizedName:randomUUID()}});
      const vehicle=await tx.vehicle.create({data:{brandId:brand.id,make:`Test-${key}`,model:"Test",makeAr:"Test",modelAr:"Test",makeNormalized:key,modelNormalized:"test",yearFrom:2000,yearTo:2030}});
      const generation=await tx.vehicleGeneration.create({data:{vehicleId:vehicle.id,code:"G1",nameEn:"Test G1",nameAr:"Test G1",yearFrom:2000,yearTo:2030}});
      const generation2=await tx.vehicleGeneration.create({data:{vehicleId:vehicle.id,code:"G2",nameEn:"Test G2",nameAr:"Test G2",yearFrom:2000,yearTo:2030,model3dKey:"existing-good-model"}});
      const car=await tx.customerGarageCar.create({data:{userId:a!.id,make:vehicle.make,model:vehicle.model,year:2010,generationId:generation.id}});
      const service=createSubmissionService(work=>work(tx));
      const app=express();app.use("/api",createVehicle3DRouter(service,undefined,createCatalogRequestService(work=>work(tx))));
      const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
      const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
      const call=async (method:string,route:string,body?:unknown,userId:string|null=a!.id)=>{
        const res=await fetch(base+route,{method,headers:{"Content-Type":"application/json",...(userId?{Authorization:`Bearer ${token(userId)}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
        const data=res.headers.get("content-type")?.includes("json")?await res.json():await res.arrayBuffer();
        return {status:res.status,data,headers:res.headers};
      };
      const c="/catalog/vehicle-3d-submissions",ad="/admin/parts/vehicle-3d-submissions";
      let id="";
      const fixture=await normalizeVehicle(await mockVehicleGLB(),4.5);
      const ready=async(genId=generation.id,bytes=fixture.bytes)=>{
        const modelPath=storePrivate(bytes,"glb");
        return tx.vehicle3DSubmission.create({data:{userId:a!.id,garageCarId:car.id,make:vehicle.make,model:vehicle.model,generationId:genId,generationName:"Test",year:2010,
          initialApprovedAt:new Date(),initialApprovedByUserId:admin!.id,status:"SUBMITTED",submittedAt:new Date(),generationMode:"meshy",provider:"MESHY",providerState:"SUCCEEDED",providerTaskId:"private-provider-fixture",catalogConsentAt:new Date(),catalogConsentVersion:"catalog-share-v2",privateModelPath:modelPath,sourceMetadata:{origin:"integration-test",redistributionConsent:true}}});
      };
      try {
        await t.test("customer creates against own Garage car; repeated create returns same open submission",async()=>{
          const r=await call("POST",c,{garageCarId:car.id});assert.equal(r.status,201);id=r.data.submission.id;
          assert.equal((await call("POST",c,{garageCarId:car.id})).data.submission.id,id);
          assert.equal((await call("POST",c,{garageCarId:car.id},b!.id)).status,404);
        });
        await t.test("customer cannot access another user's submission or private assets",async()=>{
          for(const route of [`${c}/${id}`,`${c}/${id}/assets/front`,`${c}/${id}/assets/model`])assert.equal((await call("GET",route,undefined,b!.id)).status,404);
          assert.equal((await call("DELETE",`${c}/${id}`,undefined,b!.id)).status,404);
          assert.equal((await call("POST",`${c}/${id}/generate`,{processingConsent:true},b!.id)).status,404);
        });
        await t.test("private photo/model endpoints require authentication",async()=>{
          for(const p of [`${c}/${id}/assets/front`,`${c}/${id}/assets/model`,`${ad}/${id}/assets/model`])assert.equal((await call("GET",p,undefined,null)).status,401);
        });
        await t.test("customer cannot approve, list or inspect the Parts Admin queue; other admin lacks permission",async()=>{
          assert.equal((await call("POST",`${ad}/${id}/approve`,{})).status,403);
          assert.equal((await call("GET",ad)).status,403);
          assert.equal((await call("GET",`${ad}/${id}`)).status,403);
          assert.equal((await call("GET",ad,undefined,otherAdmin!.id)).status,403);
        });
        await t.test("guided photo upload validates bytes and serves private re-encoded image; no storage paths leak",async()=>{
          const jpg=await sharp({create:{width:40,height:40,channels:3,background:"red"}}).jpeg().toBuffer();
          assert.equal((await call("PUT",`${c}/${id}/photos/invalid`,{dataBase64:jpg.toString("base64")})).status,400);
          assert.equal((await call("PUT",`${c}/${id}/photos/front`,{dataBase64:Buffer.from("fake").toString("base64")})).status,400);
          for(const view of ["front","rear","left","right"]){
            const r=await call("PUT",`${c}/${id}/photos/${view}`,{dataBase64:jpg.toString("base64")});assert.equal(r.status,200);
            assert.doesNotMatch(JSON.stringify(r.data),/PhotoPath|privateModelPath|storage\\|storage\//);
          }
          const asset=await call("GET",`${c}/${id}/assets/front`);assert.equal(asset.status,200);assert.match(asset.headers.get("cache-control")!,/no-store/);
        });
        await t.test("generation requires consent, freezes photos and permits cancellation",async()=>{
          assert.equal((await call("POST",`${c}/${id}/generate`,{})).status,400);
          assert.equal((await call("POST",`${c}/${id}/generate`,{processingConsent:true,redistributionConsent:true})).status,202);
          assert.equal((await call("PUT",`${c}/${id}/photos/front`,{dataBase64:(await sharp({create:{width:40,height:40,channels:3,background:"red"}}).jpeg().toBuffer()).toString("base64")})).status,409);
          assert.equal((await call("DELETE",`${c}/${id}`)).status,409);
          await tx.vehicleCatalogRequest.updateMany({where:{submissionId:id},data:{reviewState:"DRAFT"}});
          assert.equal((await call("DELETE",`${c}/${id}`)).status,200);
          assert.equal((await call("GET",`${c}/${id}`)).status,404);
        });
        const submitted=await ready();id=submitted.id;
        await t.test("Parts Admin can list, inspect and fetch submitted private model",async()=>{
          assert.equal((await call("GET",ad,undefined,admin!.id)).status,200);
          assert.equal((await call("GET",`${ad}/${id}`,undefined,admin!.id)).data.submission.generationId,generation.id);
          assert.equal((await call("GET",`${ad}/${id}/assets/model`,undefined,admin!.id)).status,200);
        });
        await t.test("approval requires visual confirmation and attribution",async()=>{
          assert.equal((await call("POST",`${ad}/${id}/approve`,{notes:"Checked"},admin!.id)).status,400);
        });
        const approval={notes:"Verified all four photos and rendered model",visuallyVerified:true,modelRevision:(await service.get(a!.id,id)).modelRevision,attribution:"Integration fixture; no real publication"};
        await t.test("Parts Admin approves valid model and associates only the correct generation; generated metadata stays synchronized",async()=>{
          const response=await call("POST",`${ad}/${id}/approve`,approval,admin!.id);assert.equal(response.status,200,JSON.stringify(response.data));
          const modelKey=response.data.submission.approvedModel3dKey;
          assert.equal((await tx.vehicleGeneration.findUnique({where:{id:generation.id}}))!.model3dKey,modelKey);
          assert.equal((await tx.vehicleGeneration.findUnique({where:{id:generation2.id}}))!.model3dKey,"existing-good-model");
          assert.ok(existsSync(path.join(REPO_ROOT,"backend/public/3d",modelKey+".glb")));
          const entry=Object.values(readManifest()).find(e=>e.file===modelKey)!;assert.equal(entry.submissionId,undefined);assert.equal(entry.generatedBy,"Meshy");assert.ok(!JSON.stringify(entry).includes("private-provider-fixture"));assert.ok(!JSON.stringify(entry).includes(id));assert.equal(entry.viewerConfig!.key,modelKey);
          assert.equal(readManifest()[genKey(vehicle.make,vehicle.model,generation.code)]!.file,modelKey,"generation reseeding must retain promoted model");
        });
        await t.test("duplicate approval and deletion of approved model are blocked",async()=>{
          assert.equal((await call("POST",`${ad}/${id}/approve`,approval,admin!.id)).status,409);
          assert.equal((await call("DELETE",`${c}/${id}`)).status,409);
        });
        const invalid=await ready(generation2.id,Buffer.from("invalid glb"));
        const invalidApproval={...approval,modelRevision:(await service.get(a!.id,invalid.id)).modelRevision};
        await t.test("existing good model is not silently replaced; wrong replacement key is blocked",async()=>{
          for(const body of [approval,{...approval,replaceExistingKey:"incorrect-key"}])assert.equal((await call("POST",`${ad}/${invalid.id}/approve`,body,admin!.id)).status,409);
        });
        await t.test("invalid GLB cannot be approved even with explicit replacement",async()=>{
          const r=await call("POST",`${ad}/${invalid.id}/approve`,{...invalidApproval,replaceExistingKey:"existing-good-model"},admin!.id);
          assert.equal(r.status,400);assert.equal(r.data.code,"INVALID_GLB");
          assert.equal((await tx.vehicleGeneration.findUnique({where:{id:generation2.id}}))!.model3dKey,"existing-good-model");
        });
        await t.test("Parts Admin rejects with notes; rejection stays private and preserves model",async()=>{
          const r=await call("POST",`${ad}/${invalid.id}/reject`,{notes:"Vehicle identity mismatch"},admin!.id);assert.equal(r.status,200);assert.equal(r.data.submission.status,"REJECTED");
          assert.equal((await call("GET",`${c}/${invalid.id}`)).data.submission.reviewNotes,"Vehicle identity mismatch");
          assert.ok((await tx.vehicle3DSubmission.findUnique({where:{id:invalid.id}}))!.privateModelPath);
        });
        const explicit=await ready(generation2.id);
        await t.test("explicit replacement of a valid model works and records its previous key in the audit",async()=>{
          const response=await call("POST",`${ad}/${explicit.id}/approve`,{...approval,modelRevision:(await service.get(a!.id,explicit.id)).modelRevision,replaceExistingKey:"existing-good-model"},admin!.id);
          assert.equal(response.status,200,JSON.stringify(response.data));
          const audit=await tx.auditLog.findFirst({where:{targetId:explicit.id,action:"VEHICLE3D_APPROVE_REPLACE"}});
          assert.equal((audit!.details as any).previousModel3dKey,"existing-good-model");
          assert.equal((await tx.vehicleGeneration.findUnique({where:{id:generation2.id}}))!.model3dKey,response.data.submission.approvedModel3dKey);
        });
        const mock=await ready();await tx.vehicle3DSubmission.update({where:{id:mock.id},data:{status:"READY",generationMode:"mock"}});
        await t.test("mock preview cannot be submitted or promoted",async()=>{
          const r=await call("POST",`${c}/${mock.id}/submit`,{redistributionConsent:true});assert.equal(r.status,409);
          await tx.vehicle3DSubmission.update({where:{id:mock.id},data:{status:"SUBMITTED"}});
          assert.equal((await call("POST",`${ad}/${mock.id}/approve`,approval,admin!.id)).status,400);
          await tx.vehicle3DSubmission.update({where:{id:mock.id},data:{generationMode:"meshy",provider:"MOCK",sourceMetadata:{mock:true}}});
          assert.equal((await call("POST",`${ad}/${mock.id}/approve`,approval,admin!.id)).status,400,"changing only the public mode cannot make a mock promotable");
        });
      } finally { await new Promise<void>((r,e)=>server.close(err=>err?e(err):r())); }
      throw rollback;
    },{timeout:120_000});
  } catch(error) { if(error!==rollback)throw error; }
  finally {
    for(const [file,text] of fileBefore)atomicWrite(file,text);
    for(const file of readdirSync(path.join(REPO_ROOT,"backend/public/3d")))if(!publicBefore.has(file))unlinkSync(path.join(REPO_ROOT,"backend/public/3d",file));
    if(existsSync(PRIVATE_3D_DIR))for(const file of readdirSync(PRIVATE_3D_DIR))if(!storageBefore.has(file))rmSync(path.join(PRIVATE_3D_DIR,file),{recursive:true,force:true}); // also a background segmentation temp folder
    await prisma.adminPermission.deleteMany({where:{adminId:{in:ids}}});
    await prisma.user.deleteMany({where:{id:{in:ids}}});
  }
});
