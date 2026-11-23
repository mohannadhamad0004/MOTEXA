import {Router,type Request,type Response,type NextFunction} from 'express';
import type {Prisma} from '../generated/prisma/client.js';
import {prisma} from '../prisma.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {fail,MechanicError} from '../services/mechanic-policy.js';

class MechanicBusyError extends MechanicError {readonly code='MECHANIC_BUSY';constructor(){super(409,'Complete the current accepted or in-progress service before accepting another request. This request is still waiting.');}}
const router=Router();
router.use(requireAuth);
const select={id:true,customerId:true,mechanicId:true,mode:true,title:true,description:true,vehicle:true,vehicleId:true,contactNumber:true,address:true,status:true,version:true,decisionNote:true,createdAt:true,updatedAt:true,customer:{select:{fullName:true}},mechanic:{select:{fullName:true}}} as const;
function field(value:unknown,max:number,min=0){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail(400,'Complete the required request details.');return value.trim();}
function role(res:Response,expected:string){if(res.locals.authUser.role!==expected)fail(403,'This action is not available for this account.');return res.locals.authUser.id as string;}
async function lockedMechanic(tx:Prisma.TransactionClient,id:string){
 await tx.$queryRaw`SELECT "id" FROM "MechanicProfile" WHERE "userId"=${id} FOR UPDATE`;
 const profile=await tx.mechanicProfile.findUnique({where:{userId:id},include:{user:{select:{status:true,role:true}}}});
 if(!profile||profile.user.role!=='MECHANIC'||profile.user.status!=='ACTIVE'||profile.verificationStatus!=='VERIFIED')fail(403,'The mechanic must be active and approved.');
 return profile;
}
router.post('/',async(req,res)=>{
 const customerId=role(res,'CUSTOMER');
 const mechanicId=field(req.body?.mechanicId,100,1),mode=field(req.body?.mode,20,1),title=field(req.body?.title,120,3),description=field(req.body?.description,2000,5),vehicle=field(req.body?.vehicle,120,2),contactNumber=field(req.body?.contactNumber,30,8),address=field(req.body?.address??'',300),clientRequestId=field(req.body?.clientRequestId,80,8);
 if(!['WORKSHOP','ON_SITE','ONLINE'].includes(mode)||!/^\+?[\d\s()-]{8,30}$/.test(contactNumber)||(mode==='ON_SITE'&&!address))fail(400,'Choose a valid service, contact number and service address.');
 const vehicleId=req.body?.vehicleId==null?null:field(req.body.vehicleId,100,1);
 const data=await prisma.$transaction(async tx=>{
  const profile=await lockedMechanic(tx,mechanicId);
  if(!(mode==='WORKSHOP'?profile.offersWorkshop:mode==='ON_SITE'?profile.offersOnSite:profile.offersOnline))fail(400,'This mechanic does not offer the selected service.');
  const existing=await tx.serviceRequest.findUnique({where:{customerId_clientRequestId:{customerId,clientRequestId}},select});
  if(existing){if(existing.vehicleId!==vehicleId||existing.mechanicId!==mechanicId||existing.mode!==mode||existing.title!==title||existing.description!==description||(!vehicleId&&existing.vehicle!==vehicle)||existing.contactNumber!==contactNumber||existing.address!==address)fail(409,'The request key already belongs to different details.');return existing;}
  let vehicleSnapshot=vehicle;
  if(vehicleId){await tx.$queryRaw`SELECT "id" FROM "CustomerVehicle" WHERE "id"=${vehicleId} FOR SHARE`;const saved=await tx.customerVehicle.findFirst({where:{id:vehicleId,customerId,archivedAt:null}});if(!saved)fail(404,'Choose a saved vehicle from your garage.');vehicleSnapshot=saved.make+' '+saved.model+' · '+saved.year;}
  const request=await tx.serviceRequest.create({data:{customerId,mechanicId,mode,title,description,vehicle:vehicleSnapshot,vehicleId,contactNumber,address,clientRequestId},select});
  await tx.notification.create({data:{userId:mechanicId,relatedUserId:customerId,kind:'SERVICE_REQUEST_NEW',title:'New service request',body:title}});
  await tx.auditLog.create({data:{actorId:customerId,targetId:request.id,action:'SERVICE_REQUEST_CREATED',details:{mechanicId,mode}}});
  return request;
 });
 res.status(201).json({success:true,request:data});
});
router.get('/mechanic',async(_req,res)=>{
 const mechanicId=role(res,'MECHANIC');
 const result=await prisma.$transaction(async tx=>{
  await lockedMechanic(tx,mechanicId);
  const [requests,groups]=await Promise.all([tx.serviceRequest.findMany({where:{mechanicId},select,orderBy:[{createdAt:'desc'},{id:'desc'}],take:100}),tx.serviceRequest.groupBy({by:['status'],where:{mechanicId},_count:{_all:true}})]);
  return {requests,counts:Object.fromEntries(groups.map(g=>[g.status,g._count._all])),limit:100};
 });
 res.json({success:true,...result});
});
router.get('/customer',async(_req,res)=>{
 const customerId=role(res,'CUSTOMER');
 res.json({success:true,requests:await prisma.serviceRequest.findMany({where:{customerId},select,orderBy:{createdAt:'desc'},take:100})});
});
router.post('/:id/action',async(req,res)=>{
 const mechanicId=role(res,'MECHANIC'),action=req.body?.action;
 const transitions:Record<string,[string,string]>={ACCEPT:['NEW','ACCEPTED'],DECLINE:['NEW','DECLINED'],START:['ACCEPTED','IN_PROGRESS'],COMPLETE:['IN_PROGRESS','COMPLETED']};
 if(typeof action!=='string'||!transitions[action]||!Number.isInteger(req.body?.version))fail(400,'Choose a valid request action.');
 const note=field(req.body?.note??'',500);
 if(action==='DECLINE'&&note.length<3)fail(400,'Add a reason for declining the request.');
 const request=await prisma.$transaction(async tx=>{
  await lockedMechanic(tx,mechanicId);
  const id=String(req.params.id);
  await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id"=${id} AND "mechanicId"=${mechanicId} FOR UPDATE`;
  const current=await tx.serviceRequest.findFirst({where:{id,mechanicId},select});
  if(!current)fail(404,'Request not found.');
  if(current.version!==req.body.version||current.status!==transitions[action][0])fail(409,'The request changed. Refresh before continuing.');
  // lockedMechanic serializes capacity decisions across different requests and sessions.
  if(action==='ACCEPT'&&await tx.serviceRequest.count({where:{mechanicId,status:{in:['ACCEPTED','IN_PROGRESS']},id:{not:id}}}))throw new MechanicBusyError();
  const updated=await tx.serviceRequest.update({where:{id},data:{status:transitions[action][1],version:{increment:1},...(action==='DECLINE'?{decisionNote:note}:{})},select});
  if(action==='START'||action==='COMPLETE')await tx.workshopJourney.updateMany({where:{requestId:id},data:{state:'STOPPED',sharing:false,session:null,latitude:null,longitude:null,accuracy:null,positionAt:null}});
  await tx.auditLog.create({data:{actorId:mechanicId,targetId:id,action:'SERVICE_REQUEST_'+action,details:{from:current.status,to:updated.status,note}}});
  await tx.notification.create({data:{userId:current.customerId,relatedUserId:mechanicId,kind:'SERVICE_REQUEST_'+action,title:'Service request updated',body:current.title+' · '+updated.status+(note?' · '+note:'')}});
  return updated;
 });
 res.json({success:true,request});
});
router.post('/:id/cancel',async(req,res)=>{
 const customerId=role(res,'CUSTOMER');
 if(!Number.isInteger(req.body?.version))fail(400,'Provide the current request version.');
 const request=await prisma.$transaction(async tx=>{
  const id=String(req.params.id);
  await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id"=${id} AND "customerId"=${customerId} FOR UPDATE`;
  const current=await tx.serviceRequest.findFirst({where:{id,customerId},select});
  if(!current)fail(404,'Request not found.');
  if(current.status!=='NEW'||current.version!==req.body.version)fail(409,'Only a current new request can be cancelled.');
  const updated=await tx.serviceRequest.update({where:{id},data:{status:'CANCELLED',version:{increment:1}},select});
  await tx.auditLog.create({data:{actorId:customerId,targetId:id,action:'SERVICE_REQUEST_CANCELLED'}});
  await tx.notification.create({data:{userId:current.mechanicId,relatedUserId:customerId,kind:'SERVICE_REQUEST_CANCELLED',title:'Service request cancelled',body:current.title}});
  return updated;
 });
 res.json({success:true,request});
});
router.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
 if(error instanceof MechanicBusyError){res.status(409).json({success:false,code:error.code,message:error.message});return;}
 if((error as {code?:string}|null)?.code==='P2002'&&(JSON.stringify((error as {meta?:unknown}).meta)||'').includes('ServiceRequest_one_active_mechanic')){const busy=new MechanicBusyError();res.status(409).json({success:false,code:busy.code,message:busy.message});return;}
 if(error instanceof MechanicError){res.status(error.status).json({success:false,message:error.message});return;}
 if((error as {code?:string}|null)?.code==='P2002'){res.status(409).json({success:false,message:'The request already exists. Refresh before retrying.'});return;}
 console.error('Service request operation failed',{name:error instanceof Error?error.name:'unknown'});res.status(500).json({success:false,message:'Could not complete the service request operation.'});
});
export default router;

