import {Router,type Request,type Response,type NextFunction} from 'express';
import {randomUUID} from 'node:crypto';
import {prisma} from '../prisma.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {fail,MechanicError} from '../services/mechanic-policy.js';
import type {Prisma} from '../generated/prisma/client.js';
const router=Router();router.use(requireAuth,(_q,r,n)=>{r.setHeader('Cache-Control','no-store');n();});
function number(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(400,'Provide valid GPS coordinates.');return v;}
function point(b:any){return {latitude:number(b?.latitude,-90,90),longitude:number(b?.longitude,-180,180)};}
const locationSelect={workshopLatitude:true,workshopLongitude:true,workshopAddress:true,workshopName:true,city:true} as const;
router.get('/location',async(_q,r)=>{if(r.locals.authUser.role!=='MECHANIC')fail(403,'Mechanic account required.');const location=await prisma.mechanicProfile.findUnique({where:{userId:r.locals.authUser.id},select:locationSelect});r.json({success:true,location});});
router.put('/location',async(q,r)=>{
 if(r.locals.authUser.role!=='MECHANIC')fail(403,'Mechanic account required.');const p=point(q.body);
 const location=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT "id" FROM "MechanicProfile" WHERE "userId"=${r.locals.authUser.id} FOR UPDATE`;const profile=await tx.mechanicProfile.findUnique({where:{userId:r.locals.authUser.id}});if(!profile||profile.verificationStatus!=='VERIFIED'||!profile.offersWorkshop)fail(403,'An approved workshop is required.');return tx.mechanicProfile.update({where:{userId:profile.userId},data:{workshopLatitude:p.latitude,workshopLongitude:p.longitude},select:locationSelect});});r.json({success:true,location});
});
async function access(tx:Prisma.TransactionClient,r:Response,id:string,owner=false){
 const user=r.locals.authUser;const request=await tx.serviceRequest.findFirst({where:{id,mode:'WORKSHOP',...(user.role==='CUSTOMER'?{customerId:user.id}:user.role==='MECHANIC'&&!owner?{mechanicId:user.id}:{id:'__denied__'})},include:{mechanic:{select:{status:true,mechanicProfile:{select:{...locationSelect,verificationStatus:true}}}}}});
 if(!request)fail(404,'Workshop request not found.');return request;
}
function destination(profile:any){return profile?.workshopLatitude!=null&&profile?.workshopLongitude!=null?{latitude:profile.workshopLatitude,longitude:profile.workshopLongitude,name:profile.workshopName,address:profile.workshopAddress}:null;}
router.get('/requests/:id',async(q,r)=>{
 const result=await prisma.$transaction(async tx=>{const request=await access(tx,r,String(q.params.id)),journey=await tx.workshopJourney.findUnique({where:{requestId:request.id}}),live=request.status==='ACCEPTED'&&request.mechanic.status==='ACTIVE'&&request.mechanic.mechanicProfile?.verificationStatus==='VERIFIED',fresh=live&&journey?.state==='EN_ROUTE'&&journey.sharing&&journey.positionAt&&Date.now()-journey.positionAt.getTime()<45000&&Date.now()-journey.updatedAt.getTime()<45000;
 return {destination:journey?{latitude:journey.destinationLatitude,longitude:journey.destinationLongitude,name:request.mechanic.mechanicProfile?.workshopName,address:request.mechanic.mechanicProfile?.workshopAddress}:destination(request.mechanic.mechanicProfile),state:!live&&journey?.state==='EN_ROUTE'?'STOPPED':journey?.state||'NOT_STARTED',sharing:!!(live&&journey?.sharing),location:fresh?{latitude:journey!.latitude,longitude:journey!.longitude,accuracy:journey!.accuracy,capturedAt:journey!.positionAt}:null,arrivedAt:journey?.arrivedAt||null,...(r.locals.authUser.role==='CUSTOMER'?{session:live?journey?.session:null,sequence:journey?.sequence||0}:{})};});r.json({success:true,...result});
});
router.post('/requests/:id/:action',async(q,r)=>{
 if(r.locals.authUser.role!=='CUSTOMER')fail(403,'Only the request owner can change this journey.');const action=String(q.params.action);if(!['start','point','stop','arrive'].includes(action))fail(404,'Journey action not found.');
 const result=await prisma.$transaction(async tx=>{
  const id=String(q.params.id);await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id"=${id} AND "customerId"=${r.locals.authUser.id} FOR UPDATE`;const request=await access(tx,r,id,true);const journey=await tx.workshopJourney.findUnique({where:{requestId:id}});
  if(action==='stop'){if(journey?.session&&q.body?.session!==journey.session)fail(409,'Journey session changed. Refresh before stopping.');if(journey)await tx.workshopJourney.update({where:{requestId:id},data:{state:journey.state==='ARRIVED'?'ARRIVED':'STOPPED',sharing:false,latitude:null,longitude:null,accuracy:null,positionAt:null,session:null}});return {stopped:true};}
  if(request.status!=='ACCEPTED'||request.mechanic.status!=='ACTIVE'||request.mechanic.mechanicProfile?.verificationStatus!=='VERIFIED')fail(409,'The workshop journey is only available for an accepted request.');
  if(action==='start'){
   if(typeof q.body?.sharing!=='boolean')fail(400,'Choose whether to share your location.');if(journey?.state==='ARRIVED')fail(409,'Arrival has already been confirmed.');const d=journey?{latitude:journey.destinationLatitude,longitude:journey.destinationLongitude}:destination(request.mechanic.mechanicProfile);if(!d)fail(409,'The mechanic has not set the workshop location yet.');const session=randomUUID();await tx.workshopJourney.upsert({where:{requestId:id},create:{requestId:id,destinationLatitude:d.latitude,destinationLongitude:d.longitude,state:'EN_ROUTE',sharing:q.body.sharing,session},update:{state:'EN_ROUTE',sharing:q.body.sharing,session,sequence:0,latitude:null,longitude:null,accuracy:null,positionAt:null}});return {session,sequence:0};
  }
  if(!journey||journey.state!=='EN_ROUTE'||!journey.session||q.body?.session!==journey.session)fail(409,'Journey session expired. Start again.');
  if(action==='arrive'){const p=point(q.body);number(q.body?.accuracy,0,100);number(q.body?.capturedAt,Date.now()-60000,Date.now()+10000);const rad=(n:number)=>n*Math.PI/180;const h=Math.sin(rad(p.latitude-journey.destinationLatitude)/2)**2+Math.cos(rad(p.latitude))*Math.cos(rad(journey.destinationLatitude))*Math.sin(rad(p.longitude-journey.destinationLongitude)/2)**2;if(6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))>200)fail(400,'Confirm arrival near the workshop with accurate GPS.');await tx.workshopJourney.update({where:{requestId:id},data:{state:'ARRIVED',arrivedAt:new Date(),sharing:false,session:null,latitude:null,longitude:null,accuracy:null,positionAt:null}});await tx.auditLog.create({data:{actorId:request.customerId,targetId:id,action:'WORKSHOP_CUSTOMER_CONFIRMED_ARRIVAL'}});await tx.notification.create({data:{userId:request.mechanicId,relatedUserId:request.customerId,kind:'WORKSHOP_CUSTOMER_ARRIVED',title:'Customer confirmed arrival',body:request.title}});return {arrived:true};}
  if(!journey.sharing)fail(409,'Location sharing is off.');const p=point(q.body),accuracy=number(q.body?.accuracy,0,100);const capturedAt=number(q.body?.capturedAt,Date.now()-60000,Date.now()+10000);if(!Number.isSafeInteger(q.body?.sequence)||q.body.sequence<=journey.sequence||q.body.sequence>2147483647)fail(409,'An older location update was rejected.');
  if(journey.positionAt&&capturedAt<=journey.positionAt.getTime())fail(409,'An older location update was rejected.');if(journey.positionAt&&Date.now()-journey.updatedAt.getTime()<2000)fail(429,'Location updates are too frequent.');await tx.workshopJourney.update({where:{requestId:id},data:{...p,accuracy,positionAt:new Date(capturedAt),sequence:q.body.sequence}});return {saved:true};
 });r.json({success:true,...result});
});
router.use((e:unknown,_q:Request,r:Response,_n:NextFunction)=>{if(e instanceof MechanicError){r.status(e.status).json({success:false,message:e.message});return;}console.error('Workshop journey failed',{name:e instanceof Error?e.name:'unknown'});r.status(500).json({success:false,message:'Could not update the workshop journey.'});});
export default router;
