import {prisma} from "../prisma.js";
import type {Prisma} from "../generated/prisma/client.js";
import {fail} from "./vehicle3d-validation.js";
import {activeModels} from "./vehicle3d-catalog.js";
type Tx=Prisma.TransactionClient;
export const catalogNorm=(s:string)=>s.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
export const makeNorm=(s:string)=>["mercedes","mercedesbenz"].includes(catalogNorm(s))?"mercedesbenz":catalogNorm(s);
export const field=(v:unknown,label:string,max=80):string=>typeof v==="string"&&v.trim()&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v)?v.trim():fail("INVALID_FIELD",`Provide ${label} (maximum ${max} characters).`);
export const yearField=(v:unknown)=>typeof v==="number"&&Number.isInteger(v)&&v>=1886&&v<=new Date().getFullYear()+2?v:fail("INVALID_YEAR","Provide a valid manufacture year.");
export const activeAncestry={isActive:true,vehicle:{isActive:true,brand:{isActive:true}}} satisfies Prisma.VehicleGenerationWhereInput;
export function modelNorm(name:string,brand:{name:string;aliases:string[]}){let n=catalogNorm(name);for(const a of [brand.name,...brand.aliases].map(catalogNorm).filter(Boolean).sort((a,b)=>b.length-a.length)){if(n.startsWith(a)&&n.length>a.length){n=n.slice(a.length);break;}}return n;}
export const catalogLock=async(tx:Tx)=>{await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`;};
export async function requirePartsActor(tx:Tx,uid:string){const u=await tx.user.findUnique({where:{id:uid},include:{adminPermissions:true}});if(!u||u.status!=="ACTIVE"||!(u.role==="SUPER_ADMIN"||u.role==="ADMIN"&&u.adminPermissions.some(p=>p.permission==="MANAGE_SPARE_PARTS")))return fail("PARTS_ADMIN_REQUIRED","Parts Admin access required.",403);}
export async function publishedVehicleList(tx:Tx,all=false){
 const keys=activeModels().map(m=>m.key);
 const vehicles=await tx.vehicle.findMany({where:all?{}:{isActive:true,brand:{isActive:true},generations:{some:{isActive:true,isPublished:true,model3dKey:{in:keys}}}},include:{brand:true,generations:{where:all?{}:{isActive:true,isPublished:true,model3dKey:{in:keys}},orderBy:{yearFrom:"asc"}}},orderBy:[{make:"asc"},{model:"asc"}]});
 return vehicles.map(v=>({...v,displayMake:v.brand?.name??v.make,makeAr:v.brand?.nameAr??v.makeAr,...(!all?{yearFrom:Math.min(...v.generations.map(g=>g.yearFrom)),yearTo:Math.max(...v.generations.map(g=>g.yearTo))}:{})}));
}
export function createTaxonomyService(){
 const run=<T>(uid:string,fn:(tx:Tx)=>Promise<T>)=>prisma.$transaction(async tx=>{await requirePartsActor(tx,uid);await catalogLock(tx);return fn(tx);},{timeout:30000});
 const audit=(tx:Tx,uid:string,action:string,id:string)=>tx.auditLog.create({data:{actorId:uid,action:`VEHICLE_CATALOG_${action}`,targetId:id}});
 return {
  list:(uid:string)=>run(uid,async tx=>({brands:await tx.vehicleBrand.findMany({orderBy:{name:"asc"}}),vehicles:await publishedVehicleList(tx,true)})),
  suggestions:(uid:string,make:string,model:string,year:number)=>run(uid,async tx=>{
   const brands=await tx.vehicleBrand.findMany();const requested=makeNorm(make);const candidates=brands.filter(b=>makeNorm(b.name)===requested||b.aliases.some(a=>makeNorm(a)===requested));
   const models=await tx.vehicle.findMany({where:{brandId:{in:candidates.map(b=>b.id)}},include:{generations:true,brand:true}});
   const matching=models.filter(v=>v.brand&&modelNorm(v.model,v.brand)===modelNorm(model,v.brand));
   return {brands:candidates.length?candidates:brands.filter(b=>makeNorm(b.name).includes(requested)||requested.includes(makeNorm(b.name))),models:matching.length?matching:models,generations:matching.flatMap(v=>v.generations.filter(g=>g.yearFrom<=year&&g.yearTo>=year).map(g=>({...g,make:v.make,model:v.model}))),requiresAdminSelection:true};
  }),
  brand:(uid:string,id:string|null,input:any)=>run(uid,async tx=>{
   const old=id?await tx.vehicleBrand.findUnique({where:{id}}):null;if(id&&!old)return fail("NOT_FOUND","Brand not found.",404);
   const name=field(input.name??old?.name,"brand"),nameAr=field(input.nameAr??old?.nameAr??name,"Arabic brand name");
   const aliases=input.aliases===undefined?old?.aliases??[]:Array.isArray(input.aliases)&&input.aliases.length<=20?input.aliases.map((a:unknown)=>field(a,"alias")):fail("INVALID_ALIAS","Provide at most 20 aliases.");
   const norms=new Set([makeNorm(name),...aliases.map(makeNorm)]);const duplicate=(await tx.vehicleBrand.findMany()).find(b=>b.id!==id&&[makeNorm(b.name),...b.aliases.map(makeNorm)].some(n=>norms.has(n)));
   if(duplicate)return fail("DUPLICATE_BRAND",`Existing brand: ${duplicate.name}. Use the existing record.`,409);
   const data={name,nameAr,normalizedName:makeNorm(name),aliases,isActive:input.isActive===undefined?old?.isActive??true:bool(input.isActive)};
   const row=id?await tx.vehicleBrand.update({where:{id},data}):await tx.vehicleBrand.create({data});await audit(tx,uid,id?"BRAND_EDIT":"BRAND_CREATE",row.id);return row;
  }),
  model:(uid:string,id:string|null,input:any)=>run(uid,async tx=>{
   const old=id?await tx.vehicle.findUnique({where:{id},include:{generations:true}}):null;if(id&&!old)return fail("NOT_FOUND","Model not found.",404);
   const brand=await tx.vehicleBrand.findUnique({where:{id:field(input.brandId??old?.brandId,"brand")}});if(!brand)return fail("BRAND_REQUIRED","Choose a brand.");
   let requested=field(input.model??old?.model,"model");for(const alias of [brand.name,...brand.aliases].sort((a,b)=>b.length-a.length)){if(requested.toLowerCase().startsWith(alias.toLowerCase()+" ")){requested=requested.slice(alias.length).trim();break;}}const normalized=modelNorm(requested,brand);if(!normalized)return fail("INVALID_MODEL","Provide the model without only a brand name.");
   const match=(await tx.vehicle.findMany({where:{brandId:brand.id}})).find(v=>v.id!==id&&modelNorm(v.model,brand)===normalized);if(match)return fail("DUPLICATE_MODEL",`Existing model: ${match.model}. Use the existing record.`,409);
   if(old&&old.brandId!==brand.id&&await referencedModel(tx,old))return fail("MODEL_HISTORY","A referenced model cannot move brands; deactivate it and create the corrected model.",409);
   const make=old?.brandId===brand.id?old.make:(await tx.vehicle.findFirst({where:{brandId:brand.id}}))?.make??brand.name;
   const yearFrom=yearField(input.yearFrom??old?.yearFrom??1886),yearTo=yearField(input.yearTo??old?.yearTo??new Date().getFullYear()+1);if(yearFrom>yearTo)return fail("INVALID_YEAR_RANGE","Start year must not exceed end year.");
   if(old?.generations.some(g=>g.yearFrom<yearFrom||g.yearTo>yearTo))return fail("GENERATION_YEARS","Model years must include its generations.");
   const data={brandId:brand.id,make,makeAr:brand.nameAr,model:requested,modelAr:field(input.modelAr??old?.modelAr??requested,"Arabic model name"),makeNormalized:make.trim().toLowerCase().replace(/\s+/g," "),modelNormalized:requested.trim().toLowerCase().replace(/\s+/g," "),catalogNormalizedName:normalized,yearFrom,yearTo,isActive:input.isActive===undefined?old?.isActive??true:bool(input.isActive)};
   const row=id?await tx.vehicle.update({where:{id},data}):await tx.vehicle.create({data});await audit(tx,uid,id?"MODEL_EDIT":"MODEL_CREATE",row.id);return row;
  }),
  generation:(uid:string,id:string|null,input:any)=>run(uid,async tx=>{
   const old=id?await tx.vehicleGeneration.findUnique({where:{id}}):null;if(id&&!old)return fail("NOT_FOUND","Generation not found.",404);
   const vehicleId=field(input.vehicleId??old?.vehicleId,"model");if(old&&vehicleId!==old.vehicleId)return fail("GENERATION_PARENT","Create a new generation rather than moving its history.");
   const v=await tx.vehicle.findUnique({where:{id:vehicleId}});if(!v)return fail("MODEL_REQUIRED","Choose a model.");
   const code=field(input.code??old?.code,"generation code"),n=catalogNorm(code);
   const duplicate=(await tx.vehicleGeneration.findMany({where:{vehicleId}})).find(g=>g.id!==id&&catalogNorm(g.code)===n);if(duplicate)return fail("DUPLICATE_GENERATION",`Existing generation: ${duplicate.code}.`,409);
   const yearFrom=yearField(input.yearFrom??old?.yearFrom),yearTo=yearField(input.yearTo??old?.yearTo);if(yearFrom>yearTo)return fail("INVALID_YEAR_RANGE","Start year must not exceed end year.");
   if(old&&await tx.customerGarageCar.count({where:{generationId:id!,OR:[{year:{lt:yearFrom}},{year:{gt:yearTo}}]}}))return fail("GENERATION_HISTORY","The production period must include saved Garage years.",409);
   const data={vehicleId,code,catalogNormalizedCode:n,yearFrom,yearTo,nameEn:field(input.nameEn??old?.nameEn??`${v.model} ${code}`,"display name"),nameAr:field(input.nameAr??old?.nameAr??`${v.modelAr} ${code}`,"Arabic display name"),isActive:input.isActive===undefined?old?.isActive??true:bool(input.isActive)};
   const row=id?await tx.vehicleGeneration.update({where:{id},data}):await tx.vehicleGeneration.create({data});
   await tx.vehicle.update({where:{id:vehicleId},data:{yearFrom:Math.min(v.yearFrom,yearFrom),yearTo:Math.max(v.yearTo,yearTo)}});await audit(tx,uid,id?"GENERATION_EDIT":"GENERATION_CREATE",row.id);return row;
  }),
  remove:(uid:string,kind:string,id:string)=>run(uid,async tx=>{
   if(kind==="brands"){const b=await tx.vehicleBrand.findUnique({where:{id}});if(!b)return fail("NOT_FOUND","Brand not found.",404);if(await tx.vehicle.count({where:{brandId:id}})||await snapshotReferences(tx,b.name))return fail("REFERENCED","Deactivate this referenced brand instead.",409);await tx.vehicleBrand.delete({where:{id}});}
   else if(kind==="models"){const v=await tx.vehicle.findUnique({where:{id},include:{generations:true}});if(!v)return fail("NOT_FOUND","Model not found.",404);if(v.generations.length||await referencedModel(tx,v))return fail("REFERENCED","Deactivate this referenced model instead.",409);await tx.vehicle.delete({where:{id}});}
   else if(kind==="generations"){const g=await tx.vehicleGeneration.findUnique({where:{id},include:{vehicle:true}});if(!g)return fail("NOT_FOUND","Generation not found.",404);if(g.model3dKey||await referencedModel(tx,g.vehicle)||await tx.customerGarageCar.count({where:{generationId:id}})||await tx.vehicle3DSubmission.count({where:{generationId:id}})||await tx.vehicle3DImport.count({where:{generationId:id}})||await tx.partsFitment.count({where:{generationId:id}})||await tx.customerCar.count({where:{generationId:id}}))return fail("REFERENCED","Deactivate this referenced generation instead.",409);await tx.vehicleGeneration.delete({where:{id}});}
   else return fail("INVALID_KIND","Choose brands, models or generations.");await audit(tx,uid,"DELETE",id);return {success:true};
  })
 };
}
const bool=(v:unknown)=>typeof v==="boolean"?v:fail("INVALID_STATUS","Active status must be boolean.");
async function snapshotReferences(tx:Tx,make:string,model?:string){
 // String snapshots have no foreign keys. Include original requests and service
 // history so punctuation/alias corrections cannot make references disappear.
 const brands=await tx.vehicleBrand.findMany();
 const brand=brands.find(b=>[b.name,...b.aliases].some(a=>makeNorm(a)===makeNorm(make)));
 const names=new Set([make,...(brand?[brand.name,...brand.aliases]:[])].map(makeNorm));
 const normalizeModel=(name:string)=>modelNorm(name,{name:make,aliases:brand?[brand.name,...brand.aliases]:[]});
 const matches=(m:string,n:string)=>names.has(makeNorm(m))&&(!model||normalizeModel(n)===normalizeModel(model));
 const groups=await Promise.all([
  tx.customerGarageCar.findMany({select:{make:true,model:true}}),
  tx.customerCar.findMany({select:{make:true,model:true}}),
  tx.partsFitment.findMany({select:{make:true,model:true}}),
  tx.vehicle3DSubmission.findMany({select:{make:true,model:true}}),
  tx.vehicleCatalogRequest.findMany({select:{requestedMake:true,requestedModel:true}}).then(rows=>rows.map(r=>({make:r.requestedMake,model:r.requestedModel}))),
  tx.towRequest.findMany({select:{vehicleMake:true,vehicleModel:true}}).then(rows=>rows.map(r=>({make:r.vehicleMake,model:r.vehicleModel}))),
  tx.mechanicRequest.findMany({select:{carMake:true,carModel:true}}).then(rows=>rows.map(r=>({make:r.carMake,model:r.carModel}))),
 ]);
 return groups.flat().some(r=>matches(r.make,r.model))?1:0;
}
async function referencedModel(tx:Tx,v:{id:string;make:string;model:string}){
 if(await snapshotReferences(tx,v.make,v.model)>0)return true;
 const generations=await tx.vehicleGeneration.findMany({where:{vehicleId:v.id},select:{id:true,model3dKey:true}});
 const ids=generations.map(g=>g.id);
 return generations.some(g=>g.model3dKey)||await tx.customerGarageCar.count({where:{generationId:{in:ids}}})>0||await tx.customerCar.count({where:{generationId:{in:ids}}})>0||await tx.partsFitment.count({where:{generationId:{in:ids}}})>0||await tx.vehicle3DSubmission.count({where:{generationId:{in:ids}}})>0||await tx.vehicle3DImport.count({where:{generationId:{in:ids}}})>0;
}
