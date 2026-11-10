import { prisma } from "../prisma.js";
import { hasPhoto } from "../uploads/providerFiles.js";
import { noExpiredDocument } from "./truck-eligibility.js";
import { Vehicle3DError } from "./vehicle3d-validation.js";
import { createHash } from "node:crypto";
import { modelWithZones, accessoryLifecycle } from "./accessory3d.js";
import { modelFileSha } from "./car-part-map.js";
import { accessoryTargets, fitEligibility } from "./accessory-autofit.js";

export type PortalArea = "tow" | "parts";
export const activeTow = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] as const;
export async function portalOwner(uid: string, area: PortalArea) {
  const p = area === "tow" ? await prisma.towCompanyProfile.findUnique({ where: { userId: uid } }) : await prisma.partsShopProfile.findUnique({ where: { userId: uid } });
  if (!p) throw new Vehicle3DError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  return p;
}
export async function providerSummary(uid: string, area: PortalArea) {
  const p = await portalOwner(uid, area);
  if (area === "tow") {
    const where = { companyId: p.id };
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const [jobs, fleet, available, drivers, recent, offline, busy, free, doneToday] = await Promise.all([
      prisma.towRequest.groupBy({ by: ["status"], where, _count: true }),
      prisma.truck.groupBy({ by: ["verificationStatus"], where: { ...where, archivedAt: null }, _count: true }),
      prisma.truck.count({ where: { ...where, archivedAt: null, verificationStatus: "APPROVED", operationalStatus: "AVAILABLE", ...noExpiredDocument(), towRequests: { none: { status: { in: [...activeTow] } } } } }),
      prisma.towDriver.count({ where }),
      prisma.towRequest.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 4, select: { id: true, status: true, pickupAddress: true, updatedAt: true } }),
      prisma.towDriver.count({where:{...where,offline:true}}),
      prisma.towDriver.count({where:{...where,offline:false,jobs:{some:{status:{in:[...activeTow]}}}}}),
      prisma.towDriver.count({where:{...where,offline:false,user:{status:"ACTIVE"},jobs:{none:{status:{in:[...activeTow]}}},truck:{is:{archivedAt:null,verificationStatus:"APPROVED",operationalStatus:"AVAILABLE",...noExpiredDocument()}}}}),
      prisma.towRequest.count({ where: { ...where, status: "COMPLETED", completedAt: { gte: dayStart } } }),
    ]);
    const counts = Object.fromEntries(jobs.map(x => [x.status, x._count]));
    return { identity: { id: p.id, name: "companyName" in p ? p.companyName : "", city: p.city, status: p.verificationStatus },
      metrics: { requests: jobs.reduce((n,x) => n+x._count,0), newRequests: counts.REQUESTED ?? 0, activeJobs: activeTow.reduce((n,s)=>n+(counts[s]??0),0), completedJobs: counts.COMPLETED??0, cancelledJobs: counts.CANCELLED??0, declinedJobs: counts.DECLINED??0, trucks: fleet.reduce((n,x)=>n+x._count,0), approvedTrucks: fleet.find(x=>x.verificationStatus==="APPROVED")?._count??0, availableTrucks: available, drivers, offlineDrivers:offline,busyDrivers:busy,freeDrivers:free, completedToday: doneToday },
      recent: recent.map(r=>({ id:r.id,title:r.pickupAddress,status:r.status,updatedAt:r.updatedAt,kind:"tow" })) };
  }
  const where = { shopId: p.id };
  const [total, visible, hidden, photos, stock, orders, inquiries, models, modelProducts, fitted, recent] = await Promise.all([
    prisma.partsProduct.count({where}),
    prisma.partsProduct.count({where:{...where,isHidden:false,shop:{verificationStatus:"APPROVED"},...hasPhoto}}),
    prisma.partsProduct.count({where:{...where,isHidden:true}}),
    prisma.partsProduct.count({where:{...where,...hasPhoto}}),
    prisma.$queryRaw<{ units: bigint; reserved: bigint; low: bigint; out: bigint }[]>`SELECT COALESCE(SUM(stock),0)::bigint AS units, COALESCE(SUM("reservedStock"),0)::bigint AS reserved, COUNT(*) FILTER (WHERE stock - "reservedStock" BETWEEN 1 AND 5) AS low, COUNT(*) FILTER (WHERE stock - "reservedStock" <= 0) AS out FROM "PartsProduct" WHERE "shopId" = ${p.id}`,
    prisma.partsOrder.groupBy({by:["status"],where,_count:true}),
    prisma.partInquiry.groupBy({by:["status"],where,_count:true}),
    prisma.productAccessory3D.groupBy({by:["status"],where,_count:true}),
    prisma.partsProduct.count({where:{...where,accessory3d:{some:{status:"PUBLISHED",deactivatedAt:null,publishedFile:{not:null}}}}}),
    prisma.partsProduct.count({where:{...where,OR:[{isUniversal:true},{fitments:{some:{}}}]}}),
    prisma.partsOrder.findMany({where,orderBy:[{updatedAt:"desc"},{id:"desc"}],take:4,select:{id:true,status:true,updatedAt:true,items:{take:1,select:{name:true}}}}),
  ]);
  const counts=Object.fromEntries(orders.map(x=>[x.status,x._count]));
  const s=stock[0];
  return {identity:{id:p.id,name:"shopName" in p?p.shopName:"",city:p.city,status:p.verificationStatus},metrics:{products:total,visibleProducts:visible,hiddenProducts:hidden,missingPhotos:total-photos,stockUnits:Number(s.units),reservedUnits:Number(s.reserved),availableUnits:Number(s.units-s.reserved),lowStock:Number(s.low),outOfStock:Number(s.out),pendingOrders:orders.filter(x=>!["DELIVERED","PICKED_UP","CANCELLED","REJECTED"].includes(x.status)).reduce((n,x)=>n+x._count,0),completedOrders:(counts.DELIVERED??0)+(counts.PICKED_UP??0),openInquiries:inquiries.filter(x=>x.status!=="CLOSED").reduce((n,x)=>n+x._count,0),products3d:modelProducts,without3d:total-modelProducts,pending3d:models.filter(x=>!["DRAFT","PUBLISHED","REJECTED"].includes(x.status)).reduce((n,x)=>n+x._count,0),fitmentCovered:fitted},recent:recent.map(r=>({id:r.id,title:r.items[0]?.name??r.id,status:r.status,updatedAt:r.updatedAt,kind:"order"}))};
}

export async function shopProfile(uid:string) {
  const s=await prisma.partsShopProfile.findUniqueOrThrow({where:{userId:uid}});
  return {id:s.id,name:s.shopName,nameAr:s.shopNameAr,city:s.city,address:s.address,workingHours:s.workingHours,baseLat:s.baseLat,baseLng:s.baseLng,categories:s.categories,brandName:s.brandName,branchName:s.branchName,status:s.verificationStatus};
}
export async function updateShopProfile(uid:string,body:Record<string,unknown>) {
  const s=await portalOwner(uid,"parts");
  const allowed=["address","workingHours","baseLat","baseLng"];
  if(Object.keys(body).some(k=>!allowed.includes(k))) throw new Vehicle3DError(400,"INVALID_FIELD","Only address, working hours and location can be edited here.");
  const data: {address?:string|null;workingHours?:string|null;baseLat?:number|null;baseLng?:number|null;locationSource?:string}={};
  for(const k of ["address","workingHours"] as const) if(k in body){const v=body[k];if(v!==null&&(typeof v!=="string"||v.length>300))throw new Vehicle3DError(400,"INVALID_FIELD","Enter text up to 300 characters.");data[k]=typeof v==="string"?v.trim()||null:null;}
  if("baseLat" in body||"baseLng" in body){const {baseLat:lat,baseLng:lng}=body;if(lat===null&&lng===null){data.baseLat=null;data.baseLng=null;}else if(typeof lat==="number"&&typeof lng==="number"&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=29&&lat<=34&&lng>=34&&lng<=36){data.baseLat=lat;data.baseLng=lng;data.locationSource="manual";}else throw new Vehicle3DError(400,"INVALID_LOCATION","Choose a location in the service area.");}
  if(!Object.keys(data).length)throw new Vehicle3DError(400,"INVALID_FIELD","Nothing to update.");
  await prisma.$transaction(async tx=>{await tx.partsShopProfile.update({where:{id:s.id},data});await tx.auditLog.create({data:{actorId:uid,action:"PARTS_SHOP_PROFILE_EDITED",targetId:s.id,details:{fields:Object.keys(data)}}});});
  return shopProfile(uid);
}

/** Bounded product page, including all kit parts. Never issue one request per product. */
export async function shop3dProducts(uid:string,page:number,q:string,submissions=false,productId?:string){
  const shop=await portalOwner(uid,"parts"),where={shopId:shop.id,...(productId?{id:productId}:{}),...(q?{name:{contains:q,mode:"insensitive" as const}}:{}),...(submissions?{accessory3d:{some:{}}}:{})};
  const [total,products]=await Promise.all([prisma.partsProduct.count({where}),prisma.partsProduct.findMany({where,orderBy:[{updatedAt:"desc"},{id:"desc"}],skip:(page-1)*12,take:12,include:{accessory3d:{include:{fits:{include:{generation:{include:{vehicle:true}}}},autoFits:true}}}})]);
  const output=[];
  for(const p of products){const parts=[];for(const a of p.accessory3d){const generations=[];
    for(const g of await accessoryTargets(a.id)){
      const fit=a.autoFits.find(f=>f.generationId===g.id),eligibility=await fitEligibility(a.id,g.id,a.privateModelPath),model=g.model3dKey?await modelWithZones(g.model3dKey):null;
      const label=a.accessoryType==="WING"?"SPOILER":a.accessoryType==="RIMS"?"WHEELS":a.accessoryType;
      generations.push({id:g.id,name:g.vehicle.make+" "+g.nameEn,nameAr:g.vehicle.makeAr+" "+g.nameAr,model3dKey:g.model3dKey,has3d:g.isPublished&&!!model,replacement:(model as {partMap?:Record<string,unknown>}|null)?.partMap?.[label]?label:null,fitState:eligibility.allowed?fit?.approvedAt?"VERIFIED":"COMPUTED":!fit?"NOT_COMPUTED":eligibility.code==="FIT_FAILED"?"FAILED":"STALE",approvedAt:eligibility.allowed?fit?.approvedAt??null:null,autoFit:eligibility.autoFit});
    }
    parts.push({id:a.id,part:a.kitPart,type:a.accessoryType,status:a.status,lifecycleState:accessoryLifecycle(a),hasModel:!!a.privateModelPath,published:a.status==="PUBLISHED"&&!a.deactivatedAt&&!!a.publishedFile,validated:!!a.validation,updatedAt:a.updatedAt,reviewNotes:a.reviewNotes,generations});
  }output.push({id:p.id,name:p.name,category:p.category,updatedAt:p.updatedAt,parts});}
  return {page,hasMore:page*12<total,total,products:output};
}
