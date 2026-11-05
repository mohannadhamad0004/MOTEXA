import {prisma} from "../prisma.js";
import type {Prisma} from "../generated/prisma/client.js";
import {createSubmissionService,submissionShape,type Runner} from "./vehicle3d-submissions.js";
import {VIEWS} from "./vehicle3d-private-assets.js";
import {field,yearField,requirePartsActor} from "./vehicle-taxonomy.js";
import {fail} from "./vehicle3d-validation.js";
import {activeModels} from "./vehicle3d-catalog.js";
type Tx=Prisma.TransactionClient;
const include={submission:{include:{generation:true}}} as const;
export function requestState(r:any){const s=r.submission;if(r.reviewState!=="APPROVED")return r.reviewState;if(s.status==="APPROVED")return "PUBLISHED";if(s.status==="REJECTED")return "REJECTED";if(s.status==="FAILED")return "GENERATION_FAILED";if(s.status==="READY")return "READY_FOR_FINAL_REVIEW";if(s.status==="SUBMITTED")return "FINAL_REVIEW";if(s.status==="PROCESSING")return s.generationStage==="PREPARING"?"PREPARING":"GENERATING";return "APPROVED_FOR_GENERATION";}
function shape(r:any){return {...submissionShape(r.submission),id:r.id,submissionId:r.submissionId,requestedMake:r.requestedMake,requestedModel:r.requestedModel,requestedYear:r.requestedYear,requestedGeneration:r.requestedGeneration,trim:r.trim,notes:r.notes,requestStatus:requestState(r),initialReviewState:r.reviewState,initialReviewNotes:r.reviewNotes,existingModel3dKey:r.submission.generation?.model3dKey??null,consentAt:r.consentAt};}
export function createCatalogRequestService(run:Runner=fn=>prisma.$transaction(fn,{timeout:90000})){
 const owned=async(tx:Tx,uid:string,id:string,admin=false)=>{if(admin)await requirePartsActor(tx,uid);await tx.$queryRaw`SELECT s."id" FROM "Vehicle3DSubmission" s JOIN "VehicleCatalogRequest" r ON r."submissionId"=s."id" WHERE r."id"=${id} FOR UPDATE OF s`;const r=await tx.vehicleCatalogRequest.findFirst({where:{id,...(!admin?{submission:{userId:uid,deletedAt:null}}:{submission:{deletedAt:null}})},include});if(!r)return fail("REQUEST_NOT_FOUND","Vehicle request not found.",404);await tx.$queryRaw`SELECT "id" FROM "Vehicle3DSubmission" WHERE "id"=${r.submissionId} FOR UPDATE`;return r;};
 const audit=(tx:Tx,uid:string,action:string,id:string)=>tx.auditLog.create({data:{actorId:uid,action:`VEHICLE_REQUEST_${action}`,targetId:id}});
 const ensure=async(tx:Tx,s:any)=>tx.vehicleCatalogRequest.upsert({where:{submissionId:s.id},create:{submissionId:s.id,requestedMake:s.make,requestedModel:s.model,requestedYear:s.year},update:{},include});
 return {
  create:(uid:string,input:any)=>run(async tx=>{
   const make=field(input.make,"brand"),model=field(input.model,"model"),year=yearField(input.year);
   await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${uid} FOR UPDATE`;
   if(await tx.customerGarageCar.count({where:{userId:uid}})>=10)return fail("GARAGE_LIMIT_REACHED","Your Garage already has 10 cars. Remove an unneeded car first.",409);
   if(await tx.vehicleCatalogRequest.count({where:{submission:{userId:uid},createdAt:{gte:new Date(Date.now()-86400000)}}})>=10)return fail("REQUEST_LIMIT","Maximum 10 vehicle requests per day.",429);
   const car=await tx.customerGarageCar.create({data:{userId:uid,make,model,year,isActive:await tx.customerGarageCar.count({where:{userId:uid}})===0}});
   const s=await tx.vehicle3DSubmission.create({data:{userId:uid,garageCarId:car.id,make,model,year,generationName:""}});
   const r=await tx.vehicleCatalogRequest.create({data:{submissionId:s.id,requestedMake:make,requestedModel:model,requestedYear:year,requestedGeneration:optional(input.generation),trim:optional(input.trim),notes:optional(input.notes,2000)},include});
   await audit(tx,uid,"CREATE",r.id);return shape(r);
  }),
  fromSubmission:(uid:string,submissionId:string,consent:unknown)=>run(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "Vehicle3DSubmission" WHERE "id"=${submissionId} AND "userId"=${uid} FOR UPDATE`;
   const s=await tx.vehicle3DSubmission.findFirst({where:{id:submissionId,userId:uid,deletedAt:null}});if(!s)return fail("REQUEST_NOT_FOUND","Submission not found.",404);
   const r=await ensure(tx,s);if(r.reviewState==="PENDING_REVIEW")return shape(r);
   if(r.reviewState!=="DRAFT"||!["DRAFT","FAILED","READY"].includes(s.status))return fail("REQUEST_LOCKED","This request is already under review.",409);
   if(consent!==true)return fail("CONSENT_REQUIRED","Confirm photo processing and sharing permission.");
   if(VIEWS.some(v=>!s[`${v}PhotoPath`]))return fail("PHOTOS_REQUIRED","Upload all four guided photos first.");
   const updated=await tx.vehicleCatalogRequest.update({where:{id:r.id},data:{reviewState:"PENDING_REVIEW",submittedAt:new Date(),consentAt:new Date()},include});await audit(tx,uid,"SUBMIT",r.id);return shape(updated);
  }),
  edit:(uid:string,id:string,input:any)=>run(async tx=>{const r=await owned(tx,uid,id);if(r.reviewState!=="DRAFT")return fail("REQUEST_LOCKED","Only a draft can be edited.",409);const make=field(input.make,"brand"),model=field(input.model,"model"),year=yearField(input.year);await tx.vehicle3DSubmission.update({where:{id:r.submissionId},data:{make,model,year}});const saved=await tx.vehicleCatalogRequest.update({where:{id},data:{requestedMake:make,requestedModel:model,requestedYear:year,requestedGeneration:optional(input.generation),trim:optional(input.trim),notes:optional(input.notes,2000)},include});await audit(tx,uid,"EDIT",id);return shape(saved);}),
  list:(uid:string,admin=false)=>run(async tx=>{if(admin)await requirePartsActor(tx,uid);return (await tx.vehicleCatalogRequest.findMany({where:{submission:{deletedAt:null,...(!admin?{userId:uid}:{})}},include,orderBy:{createdAt:"desc"},take:200})).map(shape);}),
  get:(uid:string,id:string,admin=false)=>run(async tx=>shape(await owned(tx,uid,id,admin))),
  correct:(uid:string,id:string,input:any)=>run(async tx=>{
   const r=await owned(tx,uid,id,true);if(r.reviewState!=="PENDING_REVIEW")return fail("REVIEW_CONFLICT","Only pending requests can be corrected.",409);
   const g=await tx.vehicleGeneration.findUnique({where:{id:field(input.generationId,"generation")},include:{vehicle:{include:{brand:true}}}});
   if(!g||!g.isActive||!g.vehicle.isActive||!g.vehicle.brand?.isActive)return fail("GENERATION_REQUIRED","Choose an active generation, model and brand.");
   const year=yearField(input.year??r.submission.year);if(year<g.yearFrom||year>g.yearTo)return fail("YEAR_MISMATCH","The vehicle year must fall inside the selected production period.");
   const lengthM=input.lengthM===undefined?r.submission.lengthM:Number(input.lengthM);if(!Number.isFinite(lengthM)||lengthM<2.5||lengthM>8)return fail("INVALID_LENGTH","Vehicle length must be 2.5?8 metres.");
   await tx.vehicle3DSubmission.update({where:{id:r.submissionId},data:{make:g.vehicle.make,model:g.vehicle.model,year,generationId:g.id,generationName:g.nameEn,lengthM}});await audit(tx,uid,"CORRECT",id);return shape(await tx.vehicleCatalogRequest.findUniqueOrThrow({where:{id},include}));
  }),
  approveInitial:(uid:string,id:string,input:any)=>run(async tx=>{
   const r=await owned(tx,uid,id,true);if(r.reviewState!=="PENDING_REVIEW"||!r.consentAt||!r.submission.generationId)return fail("REVIEW_CONFLICT","Assign a matching generation and obtain customer consent first.",409);
   if(r.submission.userId===uid)return fail("SELF_REVIEW","You cannot approve your own request.",403);
   const g=await tx.vehicleGeneration.findUniqueOrThrow({where:{id:r.submission.generationId},include:{vehicle:{include:{brand:true}}}});
   if(!g.isActive||!g.vehicle.isActive||!g.vehicle.brand?.isActive||g.vehicle.make!==r.submission.make||g.vehicle.model!==r.submission.model||r.submission.year<g.yearFrom||r.submission.year>g.yearTo)return fail("GENERATION_MISMATCH","Review the selected taxonomy and year again.");
   if(g.model3dKey&&activeModels().some(m=>m.key===g.model3dKey)&&input.existingModelKey!==g.model3dKey)return fail("EXISTING_MODEL","This car already has a shared model. Explicitly acknowledge the existing key before requesting a replacement.",409);
   await tx.vehicle3DSubmission.update({where:{id:r.submissionId},data:{initialApprovedAt:new Date(),initialApprovedByUserId:uid}});
   const updated=await tx.vehicleCatalogRequest.update({where:{id},data:{reviewState:"APPROVED",reviewedAt:new Date(),reviewedByUserId:uid,reviewNotes:optional(input.notes,2000)},include});await audit(tx,uid,"INITIAL_APPROVE",id);return shape(updated);
  }),
  rejectInitial:(uid:string,id:string,notes:unknown)=>run(async tx=>{const r=await owned(tx,uid,id,true);if(r.reviewState!=="PENDING_REVIEW"||r.submission.userId===uid)return fail("REVIEW_CONFLICT","Only another customer's pending request can be rejected.",409);const updated=await tx.vehicleCatalogRequest.update({where:{id},data:{reviewState:"REJECTED",reviewNotes:field(notes,"rejection reason",2000),reviewedByUserId:uid,reviewedAt:new Date()},include});await tx.vehicle3DSubmission.update({where:{id:r.submissionId},data:{status:"REJECTED",initialApprovedAt:null,initialApprovedByUserId:null}});await audit(tx,uid,"INITIAL_REJECT",id);return shape(updated);}),
  start:async(uid:string,id:string)=>{const r=await run(tx=>owned(tx,uid,id,true));if(r.reviewState!=="APPROVED")return fail("INITIAL_REVIEW_REQUIRED","Initial Parts Admin approval is required.",409);return createSubmissionService(run).generate(r.submission.userId,r.submissionId,true,uid);},
  finalReview:async(uid:string,id:string)=>{const r=await run(tx=>owned(tx,uid,id,true));if(r.reviewState!=="APPROVED"||!r.consentAt)return fail("CONSENT_REQUIRED","Initial approval and sharing consent are required.");if(r.submission.status==="SUBMITTED")return shape(r);await createSubmissionService(run).submit(r.submission.userId,r.submissionId,true);return run(async tx=>shape(await owned(tx,uid,id,true)));},
  regenerate:(uid:string,id:string)=>run(async tx=>{const r=await owned(tx,uid,id,true);if(r.reviewState!=="APPROVED"||!r.consentAt)return fail("REVIEW_CONFLICT","Only an initially approved request can be regenerated.",409);const nested:Runner=fn=>fn(tx);await createSubmissionService(nested).regenerate(r.submission.userId,r.submissionId);await tx.vehicle3DSubmission.update({where:{id:r.submissionId},data:{initialApprovedAt:new Date(),initialApprovedByUserId:uid}});return shape(await tx.vehicleCatalogRequest.update({where:{id},data:{reviewState:"APPROVED",consentAt:r.consentAt},include}));})
 };
}
const optional=(v:unknown,max=100)=>v==null||v===""?null:field(v,"optional details",max);
