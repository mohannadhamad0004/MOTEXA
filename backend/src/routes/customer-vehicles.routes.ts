import {prepareVehiclePhoto} from '../services/vehicle-photo.js';
import {Router,type Response} from 'express';
import {prisma} from '../prisma.js';
import {fail} from '../services/mechanic-policy.js';
import type {Prisma} from '../generated/prisma/client.js';

const router=Router();
const fields={photoUpdatedAt:true,id:true,make:true,model:true,year:true,fuel:true,isActive:true,version:true,createdAt:true,updatedAt:true} as const;
function data(body:Record<string,unknown>){
 const text=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(400,'Complete the required vehicle details.');return value.trim();};
 const make=text(body.make,50),model=text(body.model,60),year=Number(body.year),fuel=text(body.fuel,20);
 if(!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1||!['PETROL','DIESEL','HYBRID','ELECTRIC'].includes(fuel))fail(400,'Choose a valid model year and fuel type.');
 return {make,model,year,fuel};
}
async function lockOwner(tx:Prisma.TransactionClient,res:Response){const customerId=res.locals.authUser.id as string;await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${customerId} FOR UPDATE`;const u=await tx.user.findUnique({where:{id:customerId},select:{status:true,role:true}});if(!u||u.status!=='ACTIVE'||u.role!=='CUSTOMER')fail(403,'Your account cannot perform this action.');return customerId;}
function version(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)fail(400,'Refresh this vehicle before changing it.');return value;}
router.get('/',async(_req,res)=>{const vehicles=await prisma.customerVehicle.findMany({where:{customerId:res.locals.authUser.id,archivedAt:null},select:fields,orderBy:[{createdAt:'asc'},{id:'asc'}],take:50});res.json({success:true,vehicles});});
router.post('/',async(req,res)=>{
 const values=data(req.body??{}),clientVehicleId=req.body?.clientVehicleId;
 const photo=await prepareVehiclePhoto(req.body?.photoBase64);
 if(typeof clientVehicleId!=='string'||clientVehicleId.length<8||clientVehicleId.length>80)fail(400,'A valid save key is required.');
 const vehicle=await prisma.$transaction(async tx=>{const customerId=await lockOwner(tx,res),existing=await tx.customerVehicle.findUnique({where:{customerId_clientVehicleId:{customerId,clientVehicleId}}});
  if(existing){if(existing.archivedAt||existing.photoDigest!==(photo?.digest??null)||Object.entries(values).some(([key,value])=>existing[key as keyof typeof values]!==value))fail(409,'This save key belongs to different or removed vehicle details.');return tx.customerVehicle.findUnique({where:{id:existing.id},select:fields});}
  if(await tx.customerVehicle.count({where:{customerId,archivedAt:null}})>=50)fail(400,'Your garage has reached its vehicle limit.');
  await tx.customerVehicle.updateMany({where:{customerId,isActive:true},data:{isActive:false}});
  const created=await tx.customerVehicle.create({data:{customerId,...values,clientVehicleId,isActive:true,...(photo?{photoBytes:photo.bytes,photoDigest:photo.digest,photoUpdatedAt:new Date()}:{})},select:fields});await tx.auditLog.create({data:{actorId:customerId,targetId:created.id,action:'CUSTOMER_VEHICLE_ADDED'}});return created;
 });res.status(201).json({success:true,vehicle});
});
router.get('/:id/photo',async(req,res)=>{const vehicle=await prisma.customerVehicle.findFirst({where:{id:String(req.params.id),customerId:res.locals.authUser.id,archivedAt:null},select:{photoBytes:true,photoUpdatedAt:true}});if(!vehicle?.photoBytes)fail(404,'Vehicle photo not found.');res.setHeader('Cache-Control','no-store');res.json({success:true,photo:{dataUri:'data:image/jpeg;base64,'+Buffer.from(vehicle.photoBytes).toString('base64'),updatedAt:vehicle.photoUpdatedAt}});});
router.post('/:id/select',async(req,res)=>{
 const id=String(req.params.id),vehicle=await prisma.$transaction(async tx=>{const customerId=await lockOwner(tx,res),selected=await tx.customerVehicle.findFirst({where:{id,customerId,archivedAt:null},select:fields});if(!selected)fail(404,'This vehicle is not in your garage.');await tx.customerVehicle.updateMany({where:{customerId,isActive:true},data:{isActive:false}});return tx.customerVehicle.update({where:{id},data:{isActive:true},select:fields});});res.json({success:true,vehicle});
});
router.patch('/:id',async(req,res)=>{
 const values=data(req.body??{}),expected=version(req.body?.version),id=String(req.params.id);
 if(req.body?.photoRemove===true&&req.body?.photoBase64!==undefined)fail(400,'Choose a photo or remove it, not both.');
 const photo=await prepareVehiclePhoto(req.body?.photoBase64);
 const vehicle=await prisma.$transaction(async tx=>{const customerId=await lockOwner(tx,res),old=await tx.customerVehicle.findFirst({where:{id,customerId,archivedAt:null}});if(!old)fail(404,'This vehicle is not in your garage.');if(old.version!==expected)fail(409,'The vehicle changed. Refresh before editing again.');const updated=await tx.customerVehicle.update({where:{id},data:{...values,version:{increment:1},...(photo?{photoBytes:photo.bytes,photoDigest:photo.digest,photoUpdatedAt:new Date()}:req.body?.photoRemove===true?{photoBytes:null,photoDigest:null,photoUpdatedAt:null}:{})},select:fields});await tx.auditLog.create({data:{actorId:customerId,targetId:id,action:'CUSTOMER_VEHICLE_UPDATED'}});return updated;});res.json({success:true,vehicle});
});
router.delete('/:id',async(req,res)=>{
 const expected=version(req.body?.version),id=String(req.params.id);
 const vehicles=await prisma.$transaction(async tx=>{const customerId=await lockOwner(tx,res),old=await tx.customerVehicle.findFirst({where:{id,customerId,archivedAt:null}});if(!old)fail(404,'This vehicle is not in your garage.');if(old.version!==expected)fail(409,'The vehicle changed. Refresh before removing it.');await tx.customerVehicle.update({where:{id},data:{archivedAt:new Date(),isActive:false,version:{increment:1}}});if(old.isActive){const next=await tx.customerVehicle.findFirst({where:{customerId,archivedAt:null},orderBy:[{createdAt:'asc'},{id:'asc'}]});if(next)await tx.customerVehicle.update({where:{id:next.id},data:{isActive:true}});}await tx.auditLog.create({data:{actorId:customerId,targetId:id,action:'CUSTOMER_VEHICLE_REMOVED'}});return tx.customerVehicle.findMany({where:{customerId,archivedAt:null},select:fields,orderBy:[{createdAt:'asc'},{id:'asc'}]});});res.json({success:true,vehicles});
});
export default router;
