import { test,after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { prisma } from "../src/prisma.js";
import portal from "../src/routes/provider-portal.routes.js";
import parts from "../src/routes/parts.routes.js";
import tow from "../src/routes/tow.routes.js";
import accessory from "../src/routes/accessory3d.routes.js";
import catalog from "../src/routes/catalog.routes.js";
import { providerSummary } from "../src/services/provider-portal.js";
import { storeFile,removeStoredFile } from "../src/uploads/providerFiles.js";

test("provider portal HTTP: real role guards, tenant isolation, summaries, public media and protected shop fields",async()=>{
 const users:string[]=[],files:string[]=[],tag=randomUUID();
 const makeUser=async(role:"PARTS_PROVIDER"|"TOW_PROVIDER"|"CUSTOMER")=>{const u=await prisma.user.create({data:{fullName:"Portal test",email:`${randomUUID()}@portal.invalid`,passwordHash:"not-a-login",role,status:"ACTIVE"}});users.push(u.id);return u;};
 const shopUser=await makeUser("PARTS_PROVIDER"),otherUser=await makeUser("PARTS_PROVIDER"),towUser=await makeUser("TOW_PROVIDER"),customer=await makeUser("CUSTOMER");
 const app=express();app.use("/api",portal,tow,parts,accessory);app.use("/api/catalog",catalog);const server=app.listen(0,"127.0.0.1");await once(server,"listening");const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
 const request=async(uid:string|null,path:string,method="GET",body?:unknown,headers:Record<string,string>={})=>fetch(base+path,{method,headers:{...(uid?{Authorization:`Bearer ${jwt.sign({sub:uid},process.env.JWT_SECRET!,{expiresIn:"5m"})}`}:{}) ,"Content-Type":"application/json",...headers},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  const shop=await prisma.partsShopProfile.create({data:{userId:shopUser.id,shopName:"Portal test",phone:"0599000000",city:"Nablus",verificationStatus:"APPROVED"}}),other=await prisma.partsShopProfile.create({data:{userId:otherUser.id,shopName:"Other",phone:"0599000000",city:"Nablus",verificationStatus:"APPROVED"}}),company=await prisma.towCompanyProfile.create({data:{userId:towUser.id,companyName:"Portal tow",phone:"0599000000",city:"Nablus",verificationStatus:"APPROVED"}});
  const empty=await providerSummary(shopUser.id,"parts");assert.equal(empty.metrics.products,0);assert.deepEqual(empty.recent,[]);
  const product=await prisma.partsProduct.create({data:{shopId:shop.id,name:"Portal part",brand:"test",partNumber:tag,partNumberNormalized:tag,price:100,stock:7,reservedStock:3,category:"BODY",isUniversal:true}}),foreign=await prisma.partsProduct.create({data:{shopId:other.id,name:"Other part",brand:"test",partNumber:tag+"other",partNumberNormalized:tag+"other",price:100,stock:0}});
  const truck=await prisma.truck.create({data:{companyId:company.id,plateNumber:tag,make:"Test",model:"Truck",truckType:"FLATBED",verificationStatus:"APPROVED",operationalStatus:"AVAILABLE"}});
  for(const status of ["REQUESTED","IN_PROGRESS","COMPLETED","CANCELLED"] as const)await prisma.towRequest.create({data:{companyId:company.id,customerId:customer.id,status,pickupAddress:"Nablus",dropoffAddress:"Jenin",contactPhone:"0599000000",vehicleMake:"Test",vehicleModel:"Test",...(status==="IN_PROGRESS"?{assignedTruckId:truck.id}:{})}});
  let s=await providerSummary(shopUser.id,"parts");assert.equal(s.metrics.products,1);assert.equal(s.metrics.missingPhotos,1);assert.equal(s.metrics.visibleProducts,0);assert.equal(s.metrics.availableUnits,4);assert.equal(s.metrics.lowStock,1);assert.equal(s.metrics.reservedUnits,3);
  const ts=await providerSummary(towUser.id,"tow");assert.equal(ts.metrics.newRequests,1);assert.equal(ts.metrics.activeJobs,1);assert.equal(ts.metrics.completedJobs,1);assert.equal(ts.metrics.cancelledJobs,1);assert.equal(ts.metrics.availableTrucks,0,"an active job blocks operational availability");assert.equal(ts.recent.length,4);
  assert.equal((await request(null,"/parts/me/portal/summary")).status,401);
  for(const path of ["/parts/me/portal/summary","/tow/me/portal/summary","/parts/me/portal/3d"] )assert.equal((await request(customer.id,path)).status,403,path);
  assert.equal((await request(shopUser.id,`/parts/me/products/${foreign.id}`,"PATCH",{name:"intrusion"})).status,404);
  assert.equal((await request(otherUser.id,`/parts/me/portal/3d/${product.id}`)).status,404);
  assert.equal((await request(shopUser.id,`/tow/me/trucks/${truck.id}/status`,"PATCH",{operationalStatus:"AVAILABLE"})).status,403);
  assert.equal((await request(shopUser.id,"/admin/parts/accessory-3d")).status,403);
  assert.equal((await request(shopUser.id,"/admin/parts/accessory-3d/unknown/publish","POST",{})).status,403);
  assert.equal((await request(shopUser.id,"/admin/parts/part-maps/unknown","PUT",{})).status,403);
  assert.equal((await request(shopUser.id,"/parts/me/portal/profile","PATCH",{shopName:"Bypass",verificationStatus:"APPROVED"})).status,400);
  assert.equal((await request(shopUser.id,"/parts/me/portal/profile","PATCH",{workingHours:"08:00–17:00",address:"Nablus"})).status,200);
  const photo=await sharp({create:{width:256,height:256,channels:3,background:"#987654"}}).jpeg().toBuffer();
  const uploaded=await request(shopUser.id,"/parts/me/portal/media","POST",{slot:"COVER",dataBase64:photo.toString("base64")});assert.equal(uploaded.status,201);const media=(await uploaded.json()).media;
  const stored=await prisma.providerMedia.findUniqueOrThrow({where:{id:media.id}});files.push(stored.storageKey);
  const publicResponse=await request(null,media.uri);assert.equal(publicResponse.status,200);assert.equal(publicResponse.headers.get("content-type"),"image/jpeg");
  const shopPublic=await(await request(customer.id,`/catalog/shops/${shop.id}`)).json();assert.equal(shopPublic.shop.media[0].id,media.id,"customer and owner preview use the same media id");
  assert.equal((await request(otherUser.id,`/parts/me/portal/media/${media.id}`,"DELETE")).status,404);
  assert.equal((await request(towUser.id,"/tow/me/portal/media","POST",{slot:"VIDEO",truckId:randomUUID(),dataBase64:"AAAA"})).status,404);
  await prisma.partsShopProfile.update({where:{id:shop.id},data:{verificationStatus:"PENDING"}});
  assert.equal((await request(null,media.uri)).status,404,"unapproved business media is private");assert.equal((await request(shopUser.id,`/parts/me/portal/media/${media.id}/asset`)).status,200,"owner can still inspect it");
  assert.equal((await request(shopUser.id,"/parts/me/portal/media","POST",{slot:"COVER",dataBase64:photo.toString("base64")})).status,403);
  await prisma.partsShopProfile.update({where:{id:shop.id},data:{verificationStatus:"APPROVED"}});
  assert.equal((await request(shopUser.id,`/parts/me/portal/media/${media.id}`,"DELETE")).status,200);assert.equal((await request(null,media.uri)).status,404);
  const bytes=Buffer.alloc(3000);const image={buffer:bytes,mimeType:"image/jpeg",ext:"jpg",originalName:"fixture.jpg",sha256:tag};const key=await storeFile(image);files.push(key);
  await prisma.providerFile.create({data:{ownerUserId:shopUser.id,productId:product.id,purpose:"PRODUCT_IMAGE",visibility:"PUBLIC",originalName:"fixture.jpg",mimeType:"image/jpeg",sizeBytes:3000,storageKey:key,sha256:tag}});
  s=await providerSummary(shopUser.id,"parts");assert.equal(s.metrics.visibleProducts,1);assert.equal(s.metrics.missingPhotos,0);
  await prisma.partsProduct.update({where:{id:product.id},data:{isHidden:true}});assert.equal((await providerSummary(shopUser.id,"parts")).metrics.visibleProducts,0,"moderation still controls visibility");
  assert.equal((await request(shopUser.id,"/parts/me/products?page=0")).status,400);assert.equal((await request(shopUser.id,"/parts/me/portal/3d?page=0")).status,400);
 }finally{
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  await prisma.auditLog.deleteMany({where:{actorId:{in:users}}});await prisma.user.deleteMany({where:{id:{in:users}}});for(const key of files)await removeStoredFile(key);
 }
});

after(()=>prisma.$disconnect());
