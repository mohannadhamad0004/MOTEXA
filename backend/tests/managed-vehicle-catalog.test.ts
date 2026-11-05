import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync,readdirSync,existsSync,unlinkSync} from "node:fs";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import {NodeIO} from "@gltf-transform/core";
import {prisma} from "../src/prisma.js";
import {createTaxonomyService,publishedVehicleList,catalogNorm,makeNorm} from "../src/services/vehicle-taxonomy.js";
import {createCatalogRequestService} from "../src/services/vehicle-catalog-requests.js";
import {createImportService} from "../src/services/vehicle3d-imports.js";
import {createSubmissionService,PRIVATE_3D_DIR} from "../src/services/vehicle3d-submissions.js";
import {createVehicle3DProcessor,mockVehicleGLB,createMeshyClient} from "../src/services/vehicle3d-generation.js";
import {createVehicleCatalogRouter} from "../src/routes/vehicle-catalog.routes.js";
import {createVehicle3DRouter} from "../src/routes/vehicle3d.routes.js";
import {createGarageService} from "../src/services/garage.js";
import {catalogFiles,readManifest,atomicWrite,REPO_ROOT} from "../src/services/vehicle3d-catalog.js";
import {parseCarModel} from "../src/services/vehicle3d-validation.js";

test("managed taxonomy, approved customer generation and reviewed manual import (isolated fixtures)",async t=>{
 const actor=randomUUID(),owner=randomUUID(),other=randomUUID(),prefix=`Fixture${randomUUID().slice(0,8)}`;
 const before=new Map([...catalogFiles(readManifest()).keys()].map(file=>[file,readFileSync(file,"utf8")]));
 const publicDir=path.join(REPO_ROOT,"backend/public/3d"),publicBefore=new Set(readdirSync(publicDir)),storageBefore=new Set(existsSync(PRIVATE_3D_DIR)?readdirSync(PRIVATE_3D_DIR):[]);
 const old={mode:process.env.VEHICLE3D_MODE,key:process.env.MESHY_API_KEY,allow:process.env.MESHY_ALLOW_PAID_GENERATION};
 let brandId="",modelId="",generationId="",overlapId="",requestId="",submissionId="",garageId="",publishedKey="";
 const tax=createTaxonomyService(),requests=createCatalogRequestService(),sub=createSubmissionService(),imports=createImportService();
 const app=express();app.use("/api",createVehicleCatalogRouter());app.use("/api",createVehicle3DRouter());
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 const call=async(method:string,route:string,body?:unknown,uid:string|null=owner)=>{
  const token=uid?jwt.sign({sessionVersion:0},process.env.JWT_SECRET!,{subject:uid,algorithm:"HS256",expiresIn:"5m"}):null;
  const r=await fetch(`http://127.0.0.1:${(server.address()as{port:number}).port}/api${route}`,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:r.headers.get("content-type")?.includes("json")?await r.json()as any:Buffer.from(await r.arrayBuffer())};
 };
 try{
  for(const[id,role]of [[actor,"ADMIN"],[owner,"CUSTOMER"],[other,"CUSTOMER"]]as const)await prisma.user.create({data:{id,email:`${id}@managed-catalog.test`,fullName:"Catalog test fixture",passwordHash:"no-login",role,status:"ACTIVE"}});
  await prisma.adminPermission.create({data:{adminId:actor,permission:"MANAGE_SPARE_PARTS"}});
  await t.test("Parts Admin creates brand/model/generations; customers cannot mutate taxonomy",async()=>{
   assert.equal((await call("POST","/admin/parts/vehicles/brands",{name:"Forbidden"})).status,403);
   const brand=await tax.brand(actor,null,{name:prefix,nameAr:prefix,aliases:[prefix.toLowerCase()]});brandId=brand.id;
   const model=await tax.model(actor,null,{brandId,model:"A8",yearFrom:2000,yearTo:2020});modelId=model.id;
   const gen=await tax.generation(actor,null,{vehicleId:modelId,code:"D4",yearFrom:2000,yearTo:2010});generationId=gen.id;
   overlapId=(await tax.generation(actor,null,{vehicleId:modelId,code:"D5",yearFrom:2008,yearTo:2020})).id;
  });
  await t.test("brand aliases/case/whitespace and model brand-prefix/punctuation do not create duplicates",async()=>{
   assert.equal(makeNorm(" Mercedes-Benz "),makeNorm("mercedes"));assert.equal(catalogNorm(" C Class "),catalogNorm("c-class"));
   await assert.rejects(tax.brand(actor,null,{name:`  ${prefix.toUpperCase()} `}),/Existing brand/);
   await assert.rejects(tax.model(actor,null,{brandId,model:`${prefix} A8`}),/Existing model/);
   await assert.rejects(tax.generation(actor,null,{vehicleId:modelId,code:" d 4 ",yearFrom:2000,yearTo:2010}),/Existing generation/);
  });
  await t.test("year suggestions preserve overlapping possibilities and require admin choice",async()=>{
   const suggested=await tax.suggestions(actor,prefix,"A8",2009);assert.equal(suggested.generations.length,2);assert.equal(suggested.requiresAdminSelection,true);
   assert.equal((await tax.suggestions(actor,prefix,"A8",2005)).generations.length,1);
  });
  await t.test("unpublished generation is absent from customer catalog; empty unreferenced taxonomy can be deleted",async()=>{
   assert.ok(!(await prisma.$transaction(tx=>publishedVehicleList(tx))).some(v=>v.id===modelId));
   const unused=await tax.brand(actor,null,{name:prefix+"Unused"});await tax.remove(actor,"brands",unused.id);assert.equal(await prisma.vehicleBrand.count({where:{id:unused.id}}),0);
  });
  await t.test("customer creates missing-car draft without knowing generation, and owns the pending Garage record",async()=>{
   const r=await call("POST","/catalog/vehicle-requests",{make:prefix,model:"A8",year:2005,notes:"Please verify the production period"});assert.equal(r.status,201);requestId=r.data.request.id;submissionId=r.data.request.submissionId;garageId=r.data.request.garageCarId;
   assert.equal(r.data.request.requestStatus,"DRAFT");assert.equal((await prisma.customerGarageCar.findUniqueOrThrow({where:{id:garageId}})).generationId,null);
  });
  await t.test("ownership, private asset authentication and Parts Admin access are enforced",async()=>{
   assert.equal((await call("GET",`/catalog/vehicle-requests/${requestId}`,undefined,other)).status,404);
   assert.equal((await call("GET",`/catalog/vehicle-requests/${requestId}/assets/front`,undefined,null)).status,401);
   assert.equal((await call("GET","/admin/parts/vehicle-requests")).status,403);
   assert.equal((await call("GET",`/admin/parts/vehicle-requests/${requestId}`,undefined,actor)).status,200);
  });
  await t.test("four guided photos and processing/sharing consent are required before review",async()=>{
   await assert.rejects(requests.fromSubmission(owner,submissionId,true),/four/);
   const jpg=(await sharp({create:{width:48,height:48,channels:3,background:"blue"}}).jpeg().toBuffer()).toString("base64");
   for(const view of ["front","rear","left","right"]){assert.equal((await call("PUT",`/catalog/vehicle-requests/${requestId}/photos/${view}`,{dataBase64:jpg})).status,200);}
   await assert.rejects(requests.fromSubmission(owner,submissionId,false),/consent|permission/i);
   const pending=await requests.fromSubmission(owner,submissionId,true);assert.equal(pending.requestStatus,"PENDING_REVIEW");
   assert.equal((await call("GET",`/admin/parts/vehicle-requests/${requestId}/assets/front`,undefined,actor)).status,200);
   assert.equal((await call("GET",`/catalog/vehicle-requests/${requestId}/assets/front`,undefined,other)).status,404);
   await assert.rejects(sub.photo(owner,submissionId,"front",jpg),/frozen/);
   await assert.rejects(requests.edit(owner,requestId,{make:prefix,model:"Other",year:2005}),/draft/);
  });
  let providerCreates=0;
  const document=await new NodeIO().readBinary(await mockVehicleGLB());for(const node of document.getRoot().listNodes())node.setName("FixtureGeometry");for(const mesh of document.getRoot().listMeshes())mesh.setName("FixtureGeometry");for(const material of document.getRoot().listMaterials())material.setName("FixtureMaterial");const bytes=Buffer.from(await new NodeIO().writeBinary(document));
  const client=createMeshyClient({key:"mocked-http",maxBytes:8*1048576,fetcher:(async(url,options)=>{
   if(options?.method==="POST"){providerCreates++;return new Response(JSON.stringify({result:"private-fixture-task"}),{status:202});}
   if(String(url).startsWith("https://assets.meshy.ai/"))return new Response(bytes);
   return new Response(JSON.stringify({id:"private-fixture-task",status:"SUCCEEDED",progress:100,model_urls:{glb:"https://assets.meshy.ai/fixture.glb"}}));
  })as typeof fetch});
  await t.test("generation service and worker cannot call Meshy before approval",async()=>{
   await assert.rejects(sub.generate(owner,submissionId,true,actor),/approve/);
   await prisma.vehicle3DSubmission.update({where:{id:submissionId},data:{status:"PROCESSING"}});await createVehicle3DProcessor({client,allowPaid:true})(submissionId);
   assert.equal(providerCreates,0);assert.equal((await sub.get(owner,submissionId)).generationErrorCode,"INITIAL_REVIEW_REQUIRED");
   await prisma.vehicle3DSubmission.update({where:{id:submissionId},data:{status:"DRAFT",generationErrorCode:null}});
  });
  await t.test("admin corrects year/taxonomy; approval establishes eligibility without spending credits",async()=>{
   await requests.correct(actor,requestId,{generationId,year:2005});await assert.rejects(requests.correct(actor,requestId,{generationId,year:2015}),/production/);
   const r=await requests.approveInitial(actor,requestId,{});assert.equal(r.requestStatus,"APPROVED_FOR_GENERATION");assert.equal(providerCreates,0);
   assert.equal((await requests.get(owner,requestId)).requestedYear,2005);
   assert.equal((await call("POST",`/catalog/vehicle-3d-submissions/${submissionId}/generate`,{processingConsent:true,redistributionConsent:true})).status,409);
  });
  await t.test("approved generation uses existing persistent worker; mocked real output stays private and previewable",async()=>{
   process.env.VEHICLE3D_MODE="real";process.env.MESHY_API_KEY="mocked-http";process.env.MESHY_ALLOW_PAID_GENERATION="1";
   await requests.start(actor,requestId);await createVehicle3DProcessor({client,allowPaid:true})(submissionId);assert.equal(providerCreates,1);
   await prisma.vehicle3DSubmission.update({where:{id:submissionId},data:{nextPollAt:new Date(0)}});await createVehicle3DProcessor({client,allowPaid:true})(submissionId);
   const ready=await requests.get(owner,requestId);assert.equal(ready.requestStatus,"READY_FOR_FINAL_REVIEW",ready.failureReason??"");assert.ok(ready.hasModel);
   assert.equal((await call("GET",`/catalog/vehicle-requests/${requestId}/assets/model`)).status,200);
   assert.equal((await call("GET",`/catalog/vehicle-requests/${requestId}/assets/model`,undefined,other)).status,404);
   assert.equal((await call("GET",`/catalog/vehicle-requests/${requestId}/assets/model`,undefined,null)).status,401);
   assert.ok(!JSON.stringify(ready).includes("private-fixture-task"));
  });
  await t.test("final review and explicit visual confirmation are mandatory",async()=>{
   await assert.rejects(sub.approve(actor,submissionId,{notes:"Reviewed",visuallyVerified:true}),/ready/);
   await requests.finalReview(actor,requestId);await assert.rejects(sub.approve(actor,submissionId,{notes:"Reviewed"}),/Verify/);
   assert.equal((await requests.get(owner,requestId)).requestStatus,"FINAL_REVIEW");
   await assert.rejects(sub.approve(actor,submissionId,{notes:"Old preview",visuallyVerified:true,modelRevision:"outdated-preview"}),/model changed/);
  });
  await t.test("publication expands the customer picker and links the SAME Garage car",async()=>{
   const approved=await sub.approve(actor,submissionId,{notes:"Fixture visual review",visuallyVerified:true,modelRevision:(await sub.get(owner,submissionId)).modelRevision});publishedKey=approved.approvedModel3dKey!;
   const list=await prisma.$transaction(tx=>publishedVehicleList(tx));assert.ok(list.some(v=>v.id===modelId&&v.generations.some(g=>g.id===generationId)));
   assert.equal((await requests.get(owner,requestId)).requestStatus,"PUBLISHED");assert.equal((await prisma.customerGarageCar.findUniqueOrThrow({where:{id:garageId}})).generationId,generationId);
   const selected=await createGarageService().create(other,{make:prefix,model:"A8",year:2005,generationId});assert.ok(selected.id);
   const runtime=await call("GET","/catalog/3d-models");assert.ok(runtime.data.models.some((m:any)=>m.key===publishedKey));assert.ok(!JSON.stringify(runtime.data).includes(owner));assert.ok(!JSON.stringify(runtime.data).includes("private-fixture-task"));
  });
  await t.test("referenced taxonomy cannot be deleted; inactive ancestry hides selection but preserves history editing",async()=>{
   for(const[k,id]of [["generations",generationId],["models",modelId],["brands",brandId]])await assert.rejects(tax.remove(actor,k!,id!),/Deactivate/);
   await tax.brand(actor,brandId,{isActive:false});assert.ok(!(await prisma.$transaction(tx=>publishedVehicleList(tx))).some(v=>v.id===modelId));
   await assert.rejects(createGarageService().create(other,{make:prefix,model:"A8",year:2005}),/selectable/);
   await createGarageService().update(owner,garageId,{nickname:"History retained"});assert.equal((await createGarageService().list(owner))[0]!.nickname,"History retained");
   await tax.brand(actor,brandId,{isActive:true});
  });
  await t.test("initial rejection blocks generation and exposes the reason only to its owner",async()=>{
   const draft=await requests.create(owner,{make:prefix,model:"A8",year:2006});const jpg=(await sharp({create:{width:40,height:40,channels:3,background:"white"}}).jpeg().toBuffer()).toString("base64");
   for(const v of ["front","rear","left","right"])await sub.photo(owner,draft.submissionId,v,jpg);
   await requests.fromSubmission(owner,draft.submissionId,true);await requests.rejectInitial(actor,draft.id,"Unusable photos");
   assert.equal((await requests.get(owner,draft.id)).initialReviewNotes,"Unusable photos");await assert.rejects(requests.start(actor,draft.id),/approval/);
   await sub.regenerate(owner,draft.submissionId);assert.equal((await requests.get(owner,draft.id)).requestStatus,"DRAFT");
  });
  await t.test("string-only service history and legacy generation IDs prevent hard deletion",async()=>{
   const historical=await tax.model(actor,null,{brandId,model:"Service-History"});
   const service=await prisma.mechanicRequest.create({data:{customerId:owner,mechanicUserId:actor,carMake:prefix.toUpperCase(),carModel:"service history",problemDescription:"Fixture",locationText:"Fixture"}});
   try{await assert.rejects(tax.remove(actor,"models",historical.id),/Deactivate/);}finally{await prisma.mechanicRequest.delete({where:{id:service.id}});await tax.remove(actor,"models",historical.id);}
   const unlinked=await tax.generation(actor,null,{vehicleId:modelId,code:"Legacy",yearFrom:2000,yearTo:2010});
   await prisma.customerCar.create({data:{userId:other,make:"Historical spelling",model:"Historical name",year:2005,generationId:unlinked.id}});
   try{await assert.rejects(tax.remove(actor,"generations",unlinked.id),/Deactivate/);}finally{await prisma.customerCar.delete({where:{userId:other}});await tax.remove(actor,"generations",unlinked.id).catch(()=>{});}
   // A brand referenced only by an unassigned customer's original text is retained.
   const historicalBrand=await tax.brand(actor,null,{name:prefix+"Snapshot",aliases:[prefix+"Alias"]});
   const snapshot=await prisma.customerCar.create({data:{userId:other,make:prefix+"Alias",model:"Unknown",year:2005}});
   try{await assert.rejects(tax.remove(actor,"brands",historicalBrand.id),/Deactivate/);}finally{await prisma.customerCar.delete({where:{userId:snapshot.userId}});await tax.remove(actor,"brands",historicalBrand.id);}
  });
  await t.test("manual uploads reject malformed and known mock GLBs and require Parts Admin",async()=>{
   const details={generationId,source:"Test-only synthetic fixture",author:"Test fixture",license:"Test-only permission"};
   await assert.rejects(imports.upload(actor,{...details,dataBase64:Buffer.from("invalid").toString("base64")}),/GLB/);
   await assert.rejects(imports.upload(actor,{...details,dataBase64:(await mockVehicleGLB()).toString("base64")}),/Mock/);
   await assert.rejects(imports.upload(owner,{...details,dataBase64:bytes.toString("base64")}),/Parts Admin/);
  });
  await t.test("private manual GLB validates through real viewer, requires visual verification and explicit replacement",async()=>{
   const uploaded=await imports.upload(actor,{generationId,source:"Test-only synthetic fixture",author:"Test fixture",license:"Test-only permission",dataBase64:bytes.toString("base64")});
   assert.equal((await call("GET",`/admin/parts/vehicle-3d-imports/${uploaded.id}/model`)).status,403);
   const checked=await imports.validate(actor,uploaded.id,{lengthM:4.5,paintMaterials:["FixtureMaterial"]});assert.equal(checked.status,"READY");assert.equal((await imports.asset(actor,uploaded.id)).subarray(0,4).toString(),"glTF");
   assert.ok(parseCarModel(checked.viewerConfig));await assert.rejects(imports.publish(actor,uploaded.id,{}),/visual/);
   await assert.rejects(imports.publish(actor,uploaded.id,{visuallyVerified:true,validationVersion:checked.validation.validatedAt}),/replacement/);
   const result=await imports.publish(actor,uploaded.id,{visuallyVerified:true,validationVersion:checked.validation.validatedAt,replaceExistingKey:publishedKey});assert.equal(result.status,"PUBLISHED");
   assert.equal((await prisma.vehicleGeneration.findUniqueOrThrow({where:{id:generationId}})).model3dKey,result.publishedModel3dKey);
  });
 }finally{
  await new Promise<void>(r=>server.close(()=>r()));
  for(const[k,v]of Object.entries({VEHICLE3D_MODE:old.mode,MESHY_API_KEY:old.key,MESHY_ALLOW_PAID_GENERATION:old.allow})){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  for(const[p,text]of before)atomicWrite(p,text);
  for(const p of readdirSync(publicDir))if(!publicBefore.has(p))unlinkSync(path.join(publicDir,p));
  if(existsSync(PRIVATE_3D_DIR))for(const p of readdirSync(PRIVATE_3D_DIR))if(!storageBefore.has(p))unlinkSync(path.join(PRIVATE_3D_DIR,p));
  const users=[owner,other,actor];await prisma.vehicleCatalogRequest.deleteMany({where:{submission:{userId:{in:users}}}});await prisma.vehicle3DSubmission.deleteMany({where:{userId:{in:users}}});await prisma.vehicle3DImport.deleteMany({where:{uploadedByUserId:actor}});await prisma.customerGarageCar.deleteMany({where:{userId:{in:users}}});
  if(modelId){await prisma.vehicleGeneration.deleteMany({where:{vehicleId:modelId}});await prisma.vehicle.deleteMany({where:{id:modelId}});}if(brandId)await prisma.vehicleBrand.deleteMany({where:{id:brandId}});
  await prisma.auditLog.deleteMany({where:{actorId:{in:users}}});await prisma.adminPermission.deleteMany({where:{adminId:actor}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();
 }
});
