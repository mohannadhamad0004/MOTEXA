import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync,existsSync,unlinkSync} from "node:fs";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import {NodeIO} from "@gltf-transform/core";
import {prisma} from "../src/prisma.js";
import {createSketchfabClient} from "../src/services/sketchfab-client.js";
import {createImportService} from "../src/services/vehicle3d-imports.js";
import {createSketchfabProcessor} from "../src/services/vehicle3d-import-worker.js";
import {createTaxonomyService} from "../src/services/vehicle-taxonomy.js";
import {createVehicleCatalogRouter} from "../src/routes/vehicle-catalog.routes.js";
import {createVehicle3DRouter} from "../src/routes/vehicle3d.routes.js";
import {mockVehicleGLB} from "../src/services/vehicle3d-generation.js";
import {createGarageService} from "../src/services/garage.js";
import {catalogFiles,readManifest,atomicWrite,REPO_ROOT} from "../src/services/vehicle3d-catalog.js";
import {privatePath,removePrivate} from "../src/services/vehicle3d-private-assets.js";
import {confirmedPartMaps,createPartMapService} from "../src/services/car-part-map.js";

test("Sketchfab persistent workflow, real preparation/viewer, auth, publication and Garage (isolated mocked source)",async t=>{
 const users=Array.from({length:6},()=>randomUUID()),[admin,towAdmin,customer,partsShop,towProvider,otherAdmin]=users as [string,string,string,string,string,string];
 const prefix=`LinkFixture${randomUUID().slice(0,8)}`,sourceUid=randomUUID().replaceAll("-",""),url=`https://sketchfab.com/3d-models/${sourceUid}`;
 const before=new Map([...catalogFiles(readManifest()).keys()].map(f=>[f,readFileSync(f,"utf8")]));const keys:string[]=[];
 let brandId="",vehicleId="",generationId="",otherGenerationId="",id="",downloads=0,apiCalls=0;
 const d=await new NodeIO().readBinary(await mockVehicleGLB());for(const n of d.getRoot().listNodes())n.setName(n.getName().replace("MOCK_generic","Fixture"));for(const n of d.getRoot().listMeshes())n.setName(n.getName().replace("MOCK_generic","Fixture"));for(const m of d.getRoot().listMaterials())m.setName(m.getName().replace("MOCK_generic","Fixture"));const bytes=Buffer.from(await new NodeIO().writeBinary(d));
 const client=createSketchfabClient({token:"test-credential-never-live",fetcher:(async(request)=>{
  apiCalls++;const u=String(request);if(u.includes("/archives/")){downloads++;return new Response(bytes,{headers:{"content-type":"model/gltf-binary"}});}
  if(u.endsWith("/download"))return Response.json({glb:{url:"https://sketchfab-prod-media.s3.amazonaws.com/archives/test?signature=never-serialize",size:bytes.length}});
  return Response.json({uid:sourceUid,name:"Isolated test car",viewerUrl:url,user:{displayName:"Test fixture artist"},isDownloadable:true,license:{slug:"by",label:"CC BY 4.0",url:"https://creativecommons.org/licenses/by/4.0/"}});
 }) as typeof fetch});
 const service=createImportService(client),tax=createTaxonomyService(),processor=createSketchfabProcessor({client});
 const app=express();app.use("/api",createVehicleCatalogRouter(service));app.use("/api",createVehicle3DRouter());
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 const call=async(method:string,route:string,uid:string|null,body?:unknown)=>{
  const token=uid?jwt.sign({sessionVersion:0},process.env.JWT_SECRET!,{subject:uid,algorithm:"HS256",expiresIn:"5m"}):null;
  const r=await fetch(`http://127.0.0.1:${(server.address()as any).port}/api${route}`,{method,headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},...(body===undefined||method==="GET"?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:r.headers.get("content-type")?.includes("json")?await r.json()as any:Buffer.from(await r.arrayBuffer()),cache:r.headers.get("cache-control")};
 };
 const base="/admin/parts/vehicle-3d-imports";
 try{
  for(const[uid,role]of [[admin,"ADMIN"],[towAdmin,"ADMIN"],[customer,"CUSTOMER"],[partsShop,"PARTS_PROVIDER"],[towProvider,"TOW_PROVIDER"],[otherAdmin,"ADMIN"]]as const)await prisma.user.create({data:{id:uid,email:`${uid}@link-fixture.test`,fullName:"Isolated link fixture",passwordHash:"no-login",role,status:"ACTIVE"}});
  for(const uid of [admin,otherAdmin])await prisma.adminPermission.create({data:{adminId:uid,permission:"MANAGE_SPARE_PARTS"}});await prisma.adminPermission.create({data:{adminId:towAdmin,permission:"MANAGE_TOWING"}});
  const brand=await tax.brand(admin,null,{name:prefix});brandId=brand.id;const vehicle=await tax.model(admin,null,{brandId,model:"Fixture",yearFrom:2000,yearTo:2020});vehicleId=vehicle.id;
  generationId=(await tax.generation(admin,null,{vehicleId,code:"A",yearFrom:2000,yearTo:2010})).id;otherGenerationId=(await tax.generation(admin,null,{vehicleId,code:"B",yearFrom:2011,yearTo:2020})).id;
  await t.test("all action/private endpoints require Parts Admin; unauthorized calls never reach Sketchfab",async()=>{
   const count=apiCalls;
   for(const uid of [null,towAdmin,customer,partsShop,towProvider])for(const[method,route]of [["POST",`${base}/sketchfab/inspect`],["POST",`${base}/sketchfab`],["GET",`${base}/${randomUUID()}`],["GET",`${base}/${randomUUID()}/model`],["POST",`${base}/${randomUUID()}/publish`],["POST",`${base}/${randomUUID()}/discard`],["POST",`${base}/${randomUUID()}/retry`]])assert.equal((await call(method!,route!,uid,{url})).status,uid?403:401);
   assert.equal(apiCalls,count);
  });
  await t.test("inspect persists audit only, never downloads; concurrent queue attempts reserve one UID",async()=>{
   const r=await call("POST",`${base}/sketchfab/inspect`,admin,{url});assert.equal(r.status,200);assert.equal(r.data.inspection.allowed,true);assert.equal(downloads,0);
   const result=await Promise.allSettled([service.queue(admin,{url,generationId}),service.queue(admin,{url,generationId})]);
   assert.equal(result.filter(r=>r.status==="fulfilled").length,1,JSON.stringify(result.map(r=>r.status==="rejected"?r.reason.message:r.value.id)));assert.equal((result.find(r=>r.status==="rejected") as PromiseRejectedResult).reason.code,"DUPLICATE_IMPORT");
   id=(result.find(r=>r.status==="fulfilled") as PromiseFulfilledResult<any>).value.id;
   assert.equal((await service.get(admin,id)).status,"QUEUED");assert.equal(downloads,0);
   assert.equal((await service.inspect(admin,url)).duplicate?.importId,id);
   assert.doesNotMatch(JSON.stringify(await service.get(admin,id)),/test-credential|signature|storage|rawModelPath|leaseToken/);
  });
  await t.test("worker lease prevents duplicate processors; real optimization/validation/part-map reach review privately",async()=>{
   const raw=await prisma.vehicle3DImport.findUniqueOrThrow({where:{id}});
   assert.equal(existsSync(privatePath(raw.rawModelPath)),false);
   await Promise.all([processor(id),processor(id)]);
   const r=await service.get(admin,id);assert.equal(r.status,"READY",JSON.stringify(r));assert.equal(downloads,1);assert.equal(r.progress,100);assert.equal(r.validation?.valid,true);
   assert.ok(r.validation?.accessoryGate);assert.equal(r.validation.partMap.sha256,r.validation.sha256);
   const asset=await call("GET",`${base}/${id}/model`,admin);assert.equal(asset.status,200);assert.equal(asset.cache,"private, no-store");
   const row=await prisma.vehicle3DImport.findUniqueOrThrow({where:{id}});assert.ok(row.privateModelPath);assert.equal(existsSync(path.join(REPO_ROOT,"backend/public/3d",`${row.id}.glb`)),false);
  });
  let modelKey="",revision="";
  await t.test("quality/visual/hash gates hold; publication is idempotent and transfers the exact proposal",async()=>{
   const r=await service.get(admin,id);revision=(await call("GET","/catalog/3d-models",customer)).data.revision;
   await assert.rejects(service.publish(admin,id,{}),{code:"VISUAL_REVIEW_REQUIRED"});
   await assert.rejects(service.publish(admin,id,{visuallyVerified:true,validationVersion:"stale"}),{code:"STALE_VALIDATION"});
   const [published,repeated]=await Promise.all([service.publish(admin,id,{visuallyVerified:true,validationVersion:r.validation.validatedAt}),service.publish(otherAdmin,id,{visuallyVerified:true,validationVersion:r.validation.validatedAt})]);
   modelKey=published.publishedModel3dKey;keys.push(modelKey);assert.equal(repeated.publishedModel3dKey,modelKey);
   assert.equal((await service.publish(otherAdmin,id,{visuallyVerified:true})).publishedModel3dKey,modelKey);
   assert.equal((await prisma.vehicleGeneration.findUniqueOrThrow({where:{id:generationId}})).model3dKey,modelKey);
   assert.equal((await prisma.vehicleGeneration.findUniqueOrThrow({where:{id:otherGenerationId}})).model3dKey,null);
   const map=await prisma.carPartMap.findUniqueOrThrow({where:{model3dKey:modelKey}});assert.equal(map.modelSha256,r.validation.sha256);assert.equal(map.confirmedAt,null);
   assert.equal((await confirmedPartMaps([modelKey])).size,0);
   await assert.rejects(service.discard(admin,id),{code:"IMPORT_PUBLISHED"});await assert.rejects(service.queue(admin,{url,generationId}),{code:"DUPLICATE_IMPORT"});
  });
  await t.test("matching Garage resolves new published model through production runtime catalog; credits contain real fixture evidence only",async()=>{
   await createGarageService().create(customer,{make:prefix,model:"Fixture",year:2005,generationId});
   const car=await createGarageService().getMyCar(customer);assert.equal(car?.generation?.model3dKey,modelKey);
   const runtime=await call("GET","/catalog/3d-models",customer);assert.notEqual(runtime.data.revision,revision);assert.ok(runtime.data.activeKeys.includes(modelKey));assert.ok(runtime.data.models.some((m:any)=>m.key===modelKey));
   assert.doesNotMatch(JSON.stringify(runtime.data),/test-credential|never-serialize|rawModelPath|leaseToken/);
   assert.match(readFileSync(path.join(REPO_ROOT,"docs/3d/CREDITS.md"),"utf8"),/Test fixture artist/);
   const map=await prisma.carPartMap.findUniqueOrThrow({where:{model3dKey:modelKey}});await createPartMapService().confirm(admin,modelKey,{modelSha256:map.modelSha256,map:{}});assert.equal((await confirmedPartMaps([modelKey])).size,1);
  });
  await t.test("restart recovery uses persisted optimized checkpoint; stale lease and discard suppress late results",async()=>{
   const source=await prisma.vehicle3DImport.findUniqueOrThrow({where:{id}}),cloneId=randomUUID();
   const raw=await service.asset(admin,id);const {storePrivate}=await import("../src/services/vehicle3d-private-assets.js");const cloneRaw=storePrivate(raw,"glb");
   await prisma.vehicle3DImport.create({data:{id:cloneId,generationId:otherGenerationId,uploadedByUserId:admin,status:"DRAFT",importStage:"VALIDATING",sourceProvider:"SKETCHFAB",sourceUid:randomUUID().replaceAll("-",""),sourceMetadata:source.sourceMetadata!,source:"Sketchfab",sourceUrl:url,author:source.author,license:source.license,rawModelPath:cloneRaw,viewerConfig:source.viewerConfig!,leaseToken:"expired",leaseUntil:new Date(0)}});
   const previous=downloads;await processor(cloneId);assert.equal(downloads,previous);assert.equal((await service.get(admin,cloneId)).status,"READY");
   const clone=await prisma.vehicle3DImport.findUniqueOrThrow({where:{id:cloneId}});await service.discard(admin,cloneId);await service.discard(admin,cloneId);assert.equal(existsSync(privatePath(cloneRaw)),false);assert.equal(existsSync(privatePath(clone.privateModelPath!)),false);assert.equal((await service.get(admin,cloneId)).status,"DISCARDED");
   const failedId=randomUUID();await prisma.vehicle3DImport.create({data:{id:failedId,generationId:otherGenerationId,uploadedByUserId:admin,status:"DRAFT",importStage:"QUEUED",sourceProvider:"SKETCHFAB",sourceUid:randomUUID().replaceAll("-",""),source:"Sketchfab",sourceUrl:url,author:"Test fixture",license:"CC BY",rawModelPath:`${randomUUID()}.glb`}});
   const {digest}=await import("../src/services/vehicle3d-validation.js");
   const distinctSource={...client,download:async(inspection:any)=>{const downloaded=await client.download(inspection),bytes=Buffer.concat([downloaded.bytes,Buffer.from("isolated malformed conversion fixture")]);return {...downloaded,bytes,sourceSha256:digest(bytes)};}};
   await createSketchfabProcessor({client:distinctSource,convert:async()=>{throw new Error("private-filesystem-stack");}})(failedId);const failed=await service.get(admin,failedId);assert.equal(failed.status,"FAILED");assert.equal(failed.errorCode,"CONVERSION_FAILED");assert.doesNotMatch(JSON.stringify(failed),/private-filesystem-stack/);
   assert.equal((await service.retry(admin,failedId)).status,"QUEUED");await service.discard(admin,failedId);await processor(failedId);assert.equal((await service.get(admin,failedId)).status,"DISCARDED");
  });
 }finally{
  await new Promise<void>(r=>server.close(()=>r()));
  for(const[file,text]of before)atomicWrite(file,text);
  const rows=await prisma.vehicle3DImport.findMany({where:{uploadedByUserId:{in:users}}});for(const r of rows){removePrivate(r.rawModelPath);removePrivate(r.privateModelPath);if(r.publishedModel3dKey&&!keys.includes(r.publishedModel3dKey))keys.push(r.publishedModel3dKey);}
  await prisma.carPartMap.deleteMany({where:{model3dKey:{in:keys}}});for(const key of keys){const file=path.join(REPO_ROOT,"backend/public/3d",key+".glb");if(existsSync(file))unlinkSync(file);}
  await prisma.customerGarageCar.deleteMany({where:{userId:{in:users}}});await prisma.vehicle3DImport.deleteMany({where:{uploadedByUserId:{in:users}}});
  if(vehicleId){await prisma.vehicleGeneration.deleteMany({where:{vehicleId}});await prisma.vehicle.delete({where:{id:vehicleId}});}if(brandId)await prisma.vehicleBrand.delete({where:{id:brandId}});
  await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:users}},{targetId:{in:keys}}]}});await prisma.adminPermission.deleteMany({where:{adminId:{in:users}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();
 }
});
