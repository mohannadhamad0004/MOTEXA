// Cross-workflow acceptance tests. Provider HTTP is mocked; fitting and the six-view renderer are real.
// All database mutations require the isolated schema runner. Extracted stock geometry is a labelled test fixture only.
import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync,rmSync} from "node:fs";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import express from "express";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import {Document,NodeIO} from "@gltf-transform/core";
import {prisma} from "../src/prisma.js";
import partsRoutes from "../src/routes/parts.routes.js";
import catalogRoutes from "../src/routes/catalog.routes.js";
import {createAccessory3DRouter} from "../src/routes/accessory3d.routes.js";
import {createVehicleModelRouter} from "../src/routes/vehicle3d-management.routes.js";
import {createVehicleCatalogRouter} from "../src/routes/vehicle-catalog.routes.js";
import {createVehicle3DRouter} from "../src/routes/vehicle3d.routes.js";
import {createAccessory3DProcessor,createAccessory3DService,modelWithZones} from "../src/services/accessory3d.js";
import {createPartMapService} from "../src/services/car-part-map.js";
import {createMeshyClient} from "../src/services/meshy-client.js";
import {createGarageService} from "../src/services/garage.js";
import {createCatalogRequestService} from "../src/services/vehicle-catalog-requests.js";
import {createTaxonomyService} from "../src/services/vehicle-taxonomy.js";
import {createVehicleModelService} from "../src/services/vehicle3d-management.js";
import {createImportService} from "../src/services/vehicle3d-imports.js";
import {mockVehicleGLB} from "../src/services/vehicle3d-generation.js";
import {publishedVehicleModels,assetHash,publicModelPath} from "../src/services/vehicle3d-revisions.js";
import {isPublic3DAsset} from "../src/services/vehicle3d-public-assets.js";
import {REPO_ROOT,catalogFiles,readManifest,atomicWrite} from "../src/services/vehicle3d-catalog.js";
import {privatePath,removePrivate} from "../src/services/vehicle3d-private-assets.js";
import {removeStoredFiles} from "../src/uploads/providerFiles.js";

after(()=>prisma.$disconnect());
test("A/B/C/E/F: authoritative 3D lifecycle, real fitting, publication, management and IDOR",async t=>{
 assert.ok(process.env.MOTEXA_TEST_SCHEMA,"Use scripts/test-vehicle3d-suite.mjs; this test never writes to the development schema.");
 const [shop,otherShop,admin,customer,otherCustomer,towAdmin]=Array.from({length:6},()=>randomUUID()) as [string,string,string,string,string,string];
 const users=[shop,otherShop,admin,customer,otherCustomer,towAdmin],ownedKeys:string[]=[],requestIds:string[]=[],importIds:string[]=[];
 const before=new Map([...catalogFiles(readManifest()).keys()].map(f=>[f,readFileSync(f,"utf8")]));
 const e36=await prisma.vehicleGeneration.findFirstOrThrow({where:{model3dKey:"bmw-3-series-e36"},include:{vehicle:true}});
 const e36Before={model3dKey:e36.model3dKey,isPublished:e36.isPublished,modelSourceUrl:e36.modelSourceUrl,modelLicense:e36.modelLicense};
 const revisionBefore=await prisma.vehicle3DRevision.findUniqueOrThrow({where:{key:e36.model3dKey!}});
 const mapBefore=await prisma.carPartMap.findUniqueOrThrow({where:{model3dKey:e36.model3dKey!}});
 const e36Glb=readFileSync(publicModelPath(e36.model3dKey!));
 const dir=path.join(REPO_ROOT,".private/3d-lifecycle",`fixture-${randomUUID()}`);mkdirSync(dir,{recursive:true});
 let productId="",accessoryId="",knownGenerationId="",createdVehicleId="",createdBrandId="";
 let target=e36;
 const app=express();app.use("/api",partsRoutes);app.use("/api",createAccessory3DRouter());app.use("/api",createVehicleModelRouter());app.use("/api",createVehicleCatalogRouter());app.use("/api",createVehicle3DRouter());app.use("/api/catalog",catalogRoutes);
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 const call=async(method:string,route:string,uid:string|null,body?:unknown)=>{
  const token=uid?jwt.sign({sessionVersion:0},process.env.JWT_SECRET!,{subject:uid,expiresIn:"10m",algorithm:"HS256"}):null;
  const res=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/api${route}`,{method,headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,data:res.headers.get("content-type")?.includes("json")?await res.json() as any:Buffer.from(await res.arrayBuffer())};
 };
 const jpg=(color:string)=>sharp({create:{width:48,height:48,channels:3,background:color}}).jpeg().toBuffer().then(b=>b.toString("base64"));
 const requests=createCatalogRequestService(),tax=createTaxonomyService(),models=createVehicleModelService();
 try{
  for(const [id,role]of [[shop,"PARTS_PROVIDER"],[otherShop,"PARTS_PROVIDER"],[admin,"ADMIN"],[customer,"CUSTOMER"],[otherCustomer,"CUSTOMER"],[towAdmin,"ADMIN"]] as const)await prisma.user.create({data:{id,email:`${id}@lifecycle-fixture.invalid`,fullName:"Isolated 3D fixture",passwordHash:"no-login",role,status:"ACTIVE"}});
  await prisma.adminPermission.create({data:{adminId:admin,permission:"MANAGE_SPARE_PARTS"}});await prisma.adminPermission.create({data:{adminId:towAdmin,permission:"MANAGE_TOWING"}});
  for(const uid of [shop,otherShop])await prisma.partsShopProfile.create({data:{userId:uid,shopName:"Isolated fixture shop",phone:"0",city:"Nablus",verificationStatus:"APPROVED"}});
  await createGarageService().create(customer,{make:e36.vehicle.make,model:e36.vehicle.model,year:e36.yearFrom,generationId:e36.id});

  await t.test("B: existing BMW generation without 3D is selectable, linked, deduplicated and grouped",async()=>{
   const g=await prisma.vehicleGeneration.findFirstOrThrow({where:{isActive:true,isPublished:false,vehicle:{make:"BMW",model:"3 Series"}},include:{vehicle:true}});knownGenerationId=g.id;
   const count=await prisma.vehicleGeneration.count();
   const car=await createGarageService().create(customer,{make:g.vehicle.make,model:g.vehicle.model,year:g.yearFrom,generationId:g.id});
   const first=await requests.create(customer,{garageCarId:car.id}),again=await requests.create(customer,{garageCarId:car.id});requestIds.push(first.id);
   assert.equal(first.id,again.id);assert.equal(first.generationId,g.id);assert.equal(first.garageCarId,car.id);assert.equal(first.taxonomyState,"EXISTING_MANAGED_GENERATION");assert.equal(first.vehicle3dMissing,true);
   const second=await requests.create(otherCustomer,{make:g.vehicle.make,model:g.vehicle.model,year:g.yearFrom,generationId:g.id});requestIds.push(second.id);
   assert.equal(second.generationId,g.id);assert.equal(await prisma.vehicleGeneration.count(),count);
   assert.equal((await requests.list(admin,true)).find(r=>r.id===first.id)?.demandCount,2);
   assert.equal((await call("GET",`/catalog/vehicle-requests/${first.id}`,otherCustomer)).status,404);
  });
  await t.test("C: unknown taxonomy remains unlinked until admin attaches one canonical generation",async()=>{
   const name="UnknownFixture"+randomUUID().slice(0,7),r=await requests.create(customer,{make:name,model:"Prototype",year:2005,trim:"test",notes:"Synthetic request"});requestIds.push(r.id);assert.equal(r.generationId,null);
   for(const view of ["front","rear","left","right"])assert.equal((await call("PUT",`/catalog/vehicle-requests/${r.id}/photos/${view}`,customer,{dataBase64:await jpg("blue")})).status,200);
   await requests.fromSubmission(customer,r.submissionId,true);
   const b=await tax.brand(admin,null,{name,aliases:[name.toLowerCase()]});createdBrandId=b.id;const v=await tax.model(admin,null,{brandId:b.id,model:"Prototype",yearFrom:2000,yearTo:2010});createdVehicleId=v.id;
   const g=await tax.generation(admin,null,{vehicleId:v.id,code:"A",yearFrom:2000,yearTo:2010});await requests.correct(admin,r.id,{generationId:g.id,year:2005});
   assert.equal((await requests.get(customer,r.id)).generationId,g.id);assert.equal(await prisma.vehicleGeneration.count({where:{vehicleId:v.id}}),1);
   await requests.approveInitial(admin,r.id,{});assert.equal((await requests.get(customer,r.id)).requestStatus,"APPROVED_FOR_GENERATION");
  });

  await t.test("prepare a clearly synthetic published fixture car with a separately mapped rear bumper",async()=>{
   const io=new NodeIO(),doc=await io.readBinary(await mockVehicleGLB()),body=doc.getRoot().listNodes().find(n=>n.getName().includes("body"))!,prim=body.getMesh()!.listPrimitives()[0]!,positions=prim.getAttribute("POSITION")!,array=positions.getArray()!;
   // The fixture's body ends at the bumper joint; there are no hidden overlaps or forced-fit flags.
   const rear=doc.createPrimitive().setIndices(prim.getIndices()!.clone()).setAttribute("POSITION",positions.clone()).setMaterial(prim.getMaterial());
   const rearArray=new Float32Array(Array.from(array as Float32Array));for(let i=2;i<rearArray.length;i+=3)rearArray[i]=rearArray[i]!<0?-2.25:-1.85;rear.getAttribute("POSITION")!.setArray(rearArray);
   const shortened=new Float32Array(Array.from(array as Float32Array));for(let i=2;i<shortened.length;i+=3)shortened[i]=shortened[i]!<0?-1.85:2.25;positions.setArray(shortened);
   const scene=doc.getRoot().listScenes()[0]!;scene.addChild(doc.createNode("fixture_rear_bumper").setMesh(doc.createMesh("fixture_rear_bumper").addPrimitive(rear)));
   for(const n of [...doc.getRoot().listNodes(),...doc.getRoot().listMeshes(),...doc.getRoot().listMaterials()])if(n.getName().includes("MOCK"))n.setName(n.getName().replace("MOCK_generic","Fixture"));
   const gen=await tax.generation(admin,null,{vehicleId:createdVehicleId,code:"Fixture",yearFrom:2011,yearTo:2020}),imports=createImportService();
   const candidate=await imports.upload(admin,{generationId:gen.id,dataBase64:Buffer.from(await io.writeBinary(doc)).toString("base64"),source:"Procedural test fixture, not a production vehicle",author:"MOTEXA test",license:"Test fixture only",lengthM:4.5});importIds.push(candidate.id);
   const ready=await imports.validate(admin,candidate.id,{}),published=await imports.publish(admin,candidate.id,{visuallyVerified:true,validationVersion:(ready.validation as any).validatedAt});ownedKeys.push(published.publishedModel3dKey!);
   target=await prisma.vehicleGeneration.findUniqueOrThrow({where:{id:gen.id},include:{vehicle:true}});
   const map=await prisma.carPartMap.findUniqueOrThrow({where:{model3dKey:target.model3dKey!}}),ids=(map.pieces as {id:string;name:string}[]).filter(p=>/fixture_rear_bumper/.test(p.name)).map(p=>p.id);assert.ok(ids.length);
   await createPartMapService().confirm(admin,target.model3dKey!,{modelSha256:map.modelSha256,map:{REAR_BUMPER:ids}});
   await createGarageService().create(customer,{make:target.vehicle.make,model:target.vehicle.model,year:target.yearFrom,generationId:target.id});
  });

  assert.equal(target.vehicleId,createdVehicleId,"Fixture setup failed; never run the synthetic acceptance case against the real E36.");
  await t.test("A: shop rear bumper → approve → mocked Start → real auto-fit → review → publish → customer eligibility",async()=>{
   const productPhoto=(await sharp(randomBytes(256*256*3),{raw:{width:256,height:256,channels:3}}).jpeg().toBuffer()).toString("base64");
   const response=await call("POST","/parts/me/products",shop,{name:"Rear bumper lifecycle fixture",brand:"Fixture",partNumber:randomUUID(),price:950,stock:1,category:"BODY",condition:"NEW",isUniversal:false,fitments:[{make:target.vehicle.make,model:target.vehicle.model,yearFrom:target.yearFrom,yearTo:target.yearTo,generationId:target.id}],image:{name:"synthetic-fixture.jpg",dataBase64:productPhoto}});
   assert.equal(response.status,201,JSON.stringify(response.data));productId=response.data.product.id;
   const s=`/parts/me/products/${productId}/accessory-3d`;
   writeFileSync(path.join(dir,"config.json"),JSON.stringify(await modelWithZones(target.model3dKey!)));writeFileSync(path.join(dir,"kit.json"),JSON.stringify({type:"REAR_BUMPER"}));
   await promisify(execFile)(process.execPath,[path.join(REPO_ROOT,"backend/scripts/accessory-fit-check.mjs"),`--car=${publicModelPath(target.model3dKey!)}`,`--config=${path.join(dir,"config.json")}`,`--kit=${path.join(dir,"kit.json")}`,`--out=${dir}`,"--views=fixturepart"],{windowsHide:true,timeout:120000});
   const pieces=JSON.parse(readFileSync(path.join(dir,"fixture-part.json"),"utf8")) as {positions:number[];normals:number[]|null;indices:number[]}[];
   const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene("TEST_FIXTURE_ONLY");let minX=Infinity,maxX=-Infinity;
   for(const p of pieces){for(let i=0;i<p.positions.length;i+=3){minX=Math.min(minX,p.positions[i]!);maxX=Math.max(maxX,p.positions[i]!);}const primitive=doc.createPrimitive().setAttribute("POSITION",doc.createAccessor().setType("VEC3").setArray(new Float32Array(p.positions)).setBuffer(buffer)).setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(p.indices)).setBuffer(buffer)).setMaterial(doc.createMaterial("Fixture only").setBaseColorFactor([.4,.45,.5,1]).setDoubleSided(true));if(p.normals)primitive.setAttribute("NORMAL",doc.createAccessor().setType("VEC3").setArray(new Float32Array(p.normals)).setBuffer(buffer));scene.addChild(doc.createNode("Fixture only").setMesh(doc.createMesh().addPrimitive(primitive)));}
   const output=Buffer.from(await new NodeIO().writeBinary(doc));
   writeFileSync(path.join(REPO_ROOT,".private/3d-lifecycle/rear-fixture.glb"),output);writeFileSync(path.join(REPO_ROOT,".private/3d-lifecycle/rear-fixture-config.json"),readFileSync(path.join(dir,"config.json")));writeFileSync(path.join(REPO_ROOT,".private/3d-lifecycle/rear-fixture-kit.json"),JSON.stringify({type:"REAR_BUMPER",size:{widthMm:Math.round((maxX-minX)*1000)}}));
   const visibility=await promisify(execFile)(process.execPath,[path.join(REPO_ROOT,"backend/scripts/accessory-fit-check.mjs"),`--car=${publicModelPath(target.model3dKey!)}`,`--config=${path.join(dir,"config.json")}`,`--part=${path.join(REPO_ROOT,".private/3d-lifecycle/rear-fixture.glb")}`,`--kit=${path.join(REPO_ROOT,".private/3d-lifecycle/rear-fixture-kit.json")}`,`--out=${path.join(dir,"visibility")}`,"--views=visibility"],{windowsHide:true,timeout:120000});
   const checked=JSON.parse(visibility.stdout.trim().split("\n").pop()!).fit.stockVisibility;assert.ok(checked.meshes>1);assert.equal(checked.allHidden,true);assert.equal(checked.restored,true);assert.equal(checked.recaptured,true);
   assert.equal((await call("PUT",s,shop,{accessoryType:"REAR_BUMPER",fitsGenerationIds:[target.id],installedGenerationId:target.id,widthMm:Math.round((maxX-minX)*1000),fitmentNotes:"Synthetic test geometry, never a real product"})).status,200);
   for(const color of ["red","blue"])assert.equal((await call("POST",s+"/photos/PART",shop,{dataBase64:await jpg(color)})).status,201);
   assert.equal((await call("POST",s+"/photos/INSTALLED",shop,{dataBase64:await jpg("green")})).status,201);assert.equal((await call("POST",s+"/submit",shop,{consent:true})).status,200);
   accessoryId=(await call("GET",s,shop)).data.accessory.id;const a=`/admin/parts/accessory-3d/${accessoryId}`;
   assert.equal((await call("GET","/admin/parts/accessory-3d",admin)).data.accessories.some((r:any)=>r.id===accessoryId),true);
   let creates=0;const client=createMeshyClient({key:"fixture-never-live",maxBytes:8*1048576,fetcher:(async(_url,o)=>{if(o?.method==="POST"){creates++;const images=JSON.parse(String(o.body)).image_urls;const photos=await prisma.productAccessory3DPhoto.findMany({where:{accessoryId,kind:"PART"},orderBy:{sortOrder:"asc"}});assert.deepEqual(images,photos.map(p=>`data:image/jpeg;base64,${readFileSync(privatePath(p.path)).toString("base64")}`));return Response.json({result:"fixture-task"},{status:202});}if(String(_url).startsWith("https://assets.meshy.ai"))return new Response(output);return Response.json({id:"fixture-task",status:"SUCCEEDED",progress:100,model_urls:{glb:"https://assets.meshy.ai/fixture.glb"}});}) as typeof fetch});
   assert.equal((await call("POST",a+"/approve",admin)).status,200);assert.equal(creates,0);
   process.env.VEHICLE3D_MODE="real";process.env.MESHY_ALLOW_PAID_GENERATION="1";process.env.MESHY_API_KEY="fixture-never-live";
   const starts=await Promise.all([call("POST",a+"/start",admin,{confirmPaid:true}),call("POST",a+"/start",admin,{confirmPaid:true})]);assert.ok(starts.every(r=>r.status===202));
   await createAccessory3DProcessor({client,allowPaid:true})(accessoryId);await prisma.productAccessory3D.update({where:{id:accessoryId},data:{nextPollAt:new Date(0)}});await createAccessory3DProcessor({client,allowPaid:true})(accessoryId);
   let ready=(await call("GET",a,admin)).data.accessory;assert.equal(ready.status,"READY_FOR_FINAL_REVIEW",ready.failureReason??"");assert.ok(ready.preview,ready.failureReason??"");assert.equal(creates,1);assert.equal(ready.fits[0].fit.code,"FIT_REVIEW_REQUIRED");assert.equal(ready.review.publication.canPublish,false);
   assert.equal((await call("PUT",`/admin/parts/auto-fits/${accessoryId}/${target.id}`,admin,{adj:null})).status,200);
   assert.equal((await call("POST",a+"/publish",admin,{visuallyVerified:true,modelRevision:ready.modelRevision})).data.code,"STALE_VISUAL_REVIEW");
   assert.equal((await call("POST",a+"/preview",admin,{generationId:target.id})).status,200);ready=(await call("GET",a,admin)).data.accessory;
   assert.equal((await call("POST",a+"/publish",admin,{visuallyVerified:true,modelRevision:ready.modelRevision})).status,200);
   const view=(await call("GET",`/catalog/products/${productId}/accessory-3d?generationId=${target.id}`,customer)).data.accessory;assert.equal(view.parts[0].allowed,true);assert.ok(view.parts[0].autoFit);assert.equal(await isPublic3DAsset(view.model.file),true);
   assert.equal((await call("GET",`/catalog/products/${productId}/accessory-3d/garage`,customer)).data.cars.some((c:any)=>c.allowed),true);
  });

  assert.ok(accessoryId,"Accessory setup failed; stop dependent management checks.");
  await t.test("permissions/IDOR: customer and other shop cannot manage generation, fits or private assets",async()=>{
   const a=`/admin/parts/accessory-3d/${accessoryId}`,s=`/parts/me/products/${productId}/accessory-3d`;
   for(const uid of [null,customer,shop,otherShop,towAdmin])for(const route of [a,a+"/assets/model"] )assert.equal((await call("GET",route,uid)).status,uid?403:401);
   for(const uid of [customer,shop,towAdmin])for(const action of ["approve","start","publish","refit","unpublish","discard-candidate"])assert.equal((await call("POST",a+"/"+action,uid,{confirmPaid:true})).status,403);
   assert.equal((await call("GET",s,otherShop)).status,404);assert.equal((await call("GET",s+"/assets/model",customer)).status,403);assert.equal((await call("PUT",`/catalog/products/${productId}/accessory-3d/adjust`,customer,{adj:{x:0,y:0,z:0,rx:0,ry:0,s:1}})).status,403);
  });
  await t.test("F: list/preview/refit, unpublish/reactivate, published deletion refusal and safe private discard",async()=>{
   const a=`/admin/parts/accessory-3d/${accessoryId}`;assert.equal((await call("GET",a+"/assets/model",admin)).status,200);assert.equal((await call("POST",a+"/refit",admin)).status,200);
   assert.equal((await call("POST",a+"/unpublish",admin)).status,200);assert.equal((await call("GET",`/catalog/products/${productId}/accessory-3d?generationId=${target.id}`,customer)).data.accessory.model,null);
   assert.equal((await call("POST",a+"/reactivate",admin)).data.code,"FIT_REVIEW_REQUIRED");
   assert.equal((await call("PUT",`/admin/parts/auto-fits/${accessoryId}/${target.id}`,admin,{adj:null})).status,200);
   assert.equal((await call("POST",a+"/reactivate",admin)).status,200);assert.equal((await call("POST",a+"/discard-candidate",admin)).data.code,"DELETE_BLOCKED");assert.equal((await call("DELETE",`/parts/me/products/${productId}`,shop)).data.code,"DELETE_BLOCKED");
   const privateProduct=await prisma.partsProduct.create({data:{shopId:(await prisma.partsShopProfile.findUniqueOrThrow({where:{userId:shop}})).id,name:"Failed candidate fixture",brand:"Fixture",partNumber:randomUUID(),partNumberNormalized:randomUUID(),price:1,category:"BODY"}});
   const svc=createAccessory3DService(),draft=await svc.save(shop,privateProduct.id,{accessoryType:"WING",fitsGenerationIds:[target.id],widthMm:1300});
   await prisma.productAccessory3D.update({where:{id:draft.id},data:{status:"APPROVED_FOR_GENERATION",generationStage:"FAILED",generationErrorCode:"GENERATION_FAILED",creditsUsed:1}});
   assert.equal((await call("POST",`/admin/parts/accessory-3d/${draft.id}/discard-candidate`,admin)).status,200);assert.equal((await prisma.productAccessory3D.findUniqueOrThrow({where:{id:draft.id}})).creditsUsed,1);
  });
  await t.test("E: vehicle list/config/preview/deactivate/reactivate/replacement and hard-delete refusal",async()=>{
   const key=e36.model3dKey!;assert.ok((await models.list(admin)).some(m=>m.key===key));
   for(const uid of [null,customer,shop,towAdmin])assert.equal((await call("GET","/admin/parts/vehicle-3d-models",uid)).status,uid?403:401);
   assert.equal((await call("GET",`/admin/parts/vehicle-3d-models/${key}/model`,admin)).status,200);
   const hash=assetHash(key),m=await models.get(admin,key),edited=await models.configure(admin,key,{revision:m.revision,config:{paintNodes:m.viewerConfig&&[]}});assert.equal(edited.revision,m.revision+1);assert.equal(assetHash(key),hash);
   await assert.rejects(models.configure(admin,key,{revision:m.revision,config:{lengthM:4.5}}),{code:"CATALOG_REVISION_STALE"});
   const off=await models.publication(admin,key,{revision:edited.revision,published:false});assert.equal(await isPublic3DAsset(key+".glb"),false);assert.ok(!(await publishedVehicleModels()).some(m=>m.key===key));
   await models.publication(admin,key,{revision:off.revision,published:true});assert.equal(await isPublic3DAsset(key+".glb"),true);const impact=await models.deleteImpact(admin,key);assert.equal(impact.current,true);assert.ok(impact.partMaps>=1);await assert.rejects(models.deleteModel(admin,key,{}),{code:"CONFIRM_REQUIRED"});
   const io=new NodeIO(),doc=await io.readBinary(await mockVehicleGLB());for(const n of [...doc.getRoot().listNodes(),...doc.getRoot().listMeshes(),...doc.getRoot().listMaterials()])n.setName("Fixture");const bytes=Buffer.from(await io.writeBinary(doc)),imports=createImportService();
   const candidate=await imports.upload(admin,{generationId:e36.id,dataBase64:bytes.toString("base64"),source:"Isolated replacement test fixture",author:"Fixture",license:"Test fixture only",lengthM:4.5});importIds.push(candidate.id);
   assert.equal((await prisma.vehicleGeneration.findUniqueOrThrow({where:{id:e36.id}})).model3dKey,key);const ready=await imports.validate(admin,candidate.id,{});assert.equal(assetHash(key),hash);
   const promoted=await imports.publish(admin,candidate.id,{visuallyVerified:true,validationVersion:(ready.validation as any).validatedAt,replaceExistingKey:key});ownedKeys.push(promoted.publishedModel3dKey!);assert.notEqual(promoted.publishedModel3dKey,key);
   // replace = the old model is deleted (file + rows); the new one is the only model of this car
   assert.equal(existsSync(publicModelPath(key)),false);assert.equal(await prisma.vehicle3DRevision.count({where:{key}}),0);assert.equal(await prisma.carPartMap.count({where:{model3dKey:key}}),0);
   assert.equal((await prisma.vehicleGeneration.findUniqueOrThrow({where:{id:e36.id}})).model3dKey,promoted.publishedModel3dKey);assert.equal(Object.values(readManifest()).some(e=>e.file===key),false);
   // delete = permanent and audited, even while published
   const newKey=promoted.publishedModel3dKey!;const deleted=await models.deleteModel(admin,newKey,{confirm:true}) as {impact:{published:boolean}};assert.equal(deleted.impact.published,true);
   assert.equal(existsSync(publicModelPath(newKey)),false);assert.equal(await prisma.vehicle3DRevision.count({where:{key:newKey}}),0);assert.equal((await prisma.vehicleGeneration.findUniqueOrThrow({where:{id:e36.id}})).model3dKey,null);
   assert.ok(await prisma.auditLog.findFirst({where:{action:"VEHICLE3D_MODEL_DELETED",targetId:newKey}}));assert.ok(!(await publishedVehicleModels()).some(m=>m.key===newKey||m.key===key));
  });
 }finally{
  await new Promise<void>(r=>server.close(()=>r()));
  for(const [f,text]of before)atomicWrite(f,text);
  if(!existsSync(publicModelPath(e36.model3dKey!)))writeFileSync(publicModelPath(e36.model3dKey!),e36Glb);
  await prisma.vehicleGeneration.update({where:{id:e36.id},data:e36Before});if(!await prisma.vehicle3DRevision.findUnique({where:{key:e36.model3dKey!}}))await prisma.vehicle3DRevision.create({data:revisionBefore as never});await prisma.vehicle3DRevision.update({where:{key:e36.model3dKey!},data:{revision:revisionBefore.revision,viewerConfig:revisionBefore.viewerConfig as object,metadata:revisionBefore.metadata as object}});
  if(!await prisma.carPartMap.findUnique({where:{model3dKey:e36.model3dKey!}}))await prisma.carPartMap.create({data:mapBefore as never});
  await prisma.carPartMap.update({where:{model3dKey:e36.model3dKey!},data:{map:mapBefore.map as object,confirmedAt:mapBefore.confirmedAt,confirmedByUserId:mapBefore.confirmedByUserId}});
  const parts=await prisma.productAccessory3D.findMany({where:{shopId:{in:(await prisma.partsShopProfile.findMany({where:{userId:{in:[shop,otherShop]}},select:{id:true}})).map(s=>s.id)}},include:{photos:true}});
  for(const a of parts){for(const key of [a.privateModelPath,a.rawModelPath,...a.photos.map(p=>p.path),...Object.values(((a.preview??{})as any).views??{})])if(typeof key==="string")removePrivate(key);if(a.publishedFile){const file=path.join(REPO_ROOT,"backend/public/3d/accessories",a.publishedFile+".glb");if(existsSync(file))unlinkSync(file);}}
  for(const r of await prisma.vehicle3DImport.findMany({where:{id:{in:importIds}}})){removePrivate(r.rawModelPath);removePrivate(r.privateModelPath);}await prisma.vehicle3DImport.deleteMany({where:{id:{in:importIds}}});
  for(const key of ownedKeys){await prisma.vehicle3DRevision.deleteMany({where:{key}});await prisma.carPartMap.deleteMany({where:{model3dKey:key}});if(existsSync(publicModelPath(key)))unlinkSync(publicModelPath(key));}
  const files=await prisma.providerFile.findMany({where:{ownerUserId:{in:users}},select:{storageKey:true}});await removeStoredFiles(files.map(f=>f.storageKey));
  await prisma.partsProduct.deleteMany({where:{shop:{userId:{in:[shop,otherShop]}}}});await prisma.partsShopProfile.deleteMany({where:{userId:{in:[shop,otherShop]}}});
  await prisma.vehicleCatalogRequest.deleteMany({where:{submission:{userId:{in:[customer,otherCustomer]}}}});const subs=await prisma.vehicle3DSubmission.findMany({where:{userId:{in:[customer,otherCustomer]}}});for(const s of subs)for(const key of [s.frontPhotoPath,s.rearPhotoPath,s.leftPhotoPath,s.rightPhotoPath])removePrivate(key);
  await prisma.vehicle3DSubmission.deleteMany({where:{userId:{in:[customer,otherCustomer]}}});await prisma.customerGarageCar.deleteMany({where:{userId:{in:users}}});
  if(createdVehicleId){await prisma.vehicleGeneration.deleteMany({where:{vehicleId:createdVehicleId}});await prisma.vehicle.delete({where:{id:createdVehicleId}});}if(createdBrandId)await prisma.vehicleBrand.delete({where:{id:createdBrandId}});
  await prisma.notification.deleteMany({where:{userId:{in:users}}});await prisma.auditLog.deleteMany({where:{actorId:{in:users}}});await prisma.adminPermission.deleteMany({where:{adminId:{in:users}}});await prisma.user.deleteMany({where:{id:{in:users}}});
  if(path.dirname(dir)===path.join(REPO_ROOT,".private/3d-lifecycle"))rmSync(dir,{recursive:true,force:true});
 }
});
