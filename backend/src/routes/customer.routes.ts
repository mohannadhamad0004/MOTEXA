import customerVehicleRoutes from './customer-vehicles.routes.js';
import {Router,type Request,type Response,type NextFunction} from 'express';
import argon2 from 'argon2';
import {prisma} from '../prisma.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {fail,MechanicError} from '../services/mechanic-policy.js';

const router=Router(),attempts=new Map<string,{at:number;count:number}>();
function str(v:unknown,max:number,min=1){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(400,'Complete the required details.');return v.trim();}
router.post('/register',async(req,res)=>{
 const now=Date.now();for(const [k,v] of attempts)if(now-v.at>3600000)attempts.delete(k);
 const key=req.ip||'unknown',entry=attempts.get(key)||{at:now,count:0};if(entry.count>=20||(!attempts.has(key)&&attempts.size>=10000))fail(429,'Too many attempts. Try again later.');entry.count++;attempts.set(key,entry);
 const fullName=str(req.body?.fullName,120,2),email=str(req.body?.email,254).toLowerCase(),password=req.body?.password,phoneNumber=str(req.body?.phoneNumber,30,8);
 if(!/^\+?[\d\s()-]{8,30}$/.test(phoneNumber))fail(400,'Enter a valid contact number.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<10||password.length>128||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))fail(400,'Use a valid email and a password of 10–128 characters with letters and numbers.');
 const passwordHash=await argon2.hash(password);
 const user=await prisma.user.create({data:{fullName,email,phoneNumber,passwordHash,role:'CUSTOMER',status:'ACTIVE'},select:{id:true,fullName:true,role:true,sessionVersion:true}});
 res.status(201).json({success:true,user:{id:user.id,fullName:user.fullName,role:user.role}});
});
router.use(requireAuth,(req,res,next)=>{if(res.locals.authUser.role!=='CUSTOMER')return next(new MechanicError(403,'This workspace is for car owners.'));next();});
router.get('/account',async(_req,res)=>{const account=await prisma.user.findUnique({where:{id:res.locals.authUser.id},select:{fullName:true,email:true,phoneNumber:true}});res.json({success:true,account});});
router.patch('/account',async(req,res)=>{
 const b=req.body;if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['fullName','phoneNumber'].includes(k)))fail(400,'Only your name and contact number can be changed here.');
 const fullName=str(b.fullName,120,2).replace(/\s+/g,' '),phoneNumber=str(b.phoneNumber,30,8);
 if(/[\u0000-\u001f\u007f]/.test(fullName)||!/^\+?[\d\s()-]{8,30}$/.test(phoneNumber))fail(400,'Enter a valid name and contact number.');
 const account=await prisma.$transaction(async tx=>{const customerId=res.locals.authUser.id as string;const changed=await tx.user.updateMany({where:{id:customerId,role:'CUSTOMER',status:'ACTIVE'},data:{fullName,phoneNumber}});if(!changed.count)fail(409,'Your account access changed. Sign in again.');await tx.auditLog.create({data:{actorId:customerId,targetId:customerId,action:'CUSTOMER_ACCOUNT_UPDATED',details:{fields:['fullName','phoneNumber']}}});return tx.user.findUnique({where:{id:customerId},select:{fullName:true,email:true,phoneNumber:true}});});
 res.json({success:true,account});
});
router.use('/vehicles',customerVehicleRoutes);
router.get('/mechanics',async(req,res)=>{
 const mode=str(req.query.mode??'WORKSHOP',20),city=typeof req.query.city==='string'?req.query.city.trim().slice(0,80):'';
 if(!['WORKSHOP','ON_SITE','ONLINE'].includes(mode))fail(400,'Choose a service type.');
 const profiles=await prisma.mechanicProfile.findMany({where:{verificationStatus:'VERIFIED',user:{role:'MECHANIC',status:'ACTIVE'},...(mode==='WORKSHOP'?{offersWorkshop:true}:mode==='ON_SITE'?{offersOnSite:true}:{offersOnline:true}),...(city?mode==='ON_SITE'?{OR:[{city:{contains:city,mode:'insensitive'}},{coverageAreas:{has:city}}]}:{city:{contains:city,mode:'insensitive'}}:{})},select:{userId:true,city:true,workshopName:true,workshopAddress:true,workshopLatitude:true,workshopLongitude:true,coverageAreas:true,specializations:true,yearsOfExperience:true,offersWorkshop:true,offersOnSite:true,offersOnline:true,user:{select:{fullName:true}}},orderBy:{userId:'asc'},take:100});
 res.json({success:true,mechanics:profiles});
});
router.get('/mechanics/:id',async(req,res)=>{
 const mode=str(req.query.mode??'WORKSHOP',20);if(!['WORKSHOP','ON_SITE','ONLINE'].includes(mode))fail(400,'Choose a service type.');
 const mechanic=await prisma.mechanicProfile.findFirst({where:{userId:String(req.params.id),verificationStatus:'VERIFIED',user:{role:'MECHANIC',status:'ACTIVE'},...(mode==='WORKSHOP'?{offersWorkshop:true}:mode==='ON_SITE'?{offersOnSite:true}:{offersOnline:true})},select:{userId:true,city:true,workshopName:true,workshopAddress:true,workshopLatitude:true,workshopLongitude:true,coverageAreas:true,specializations:true,yearsOfExperience:true,experienceSummary:true,offersWorkshop:true,offersOnSite:true,offersOnline:true,user:{select:{fullName:true}}}});
 if(!mechanic)fail(404,'This mechanic is no longer available for the selected service.');res.json({success:true,mechanic});
});
router.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(err instanceof MechanicError){res.status(err.status).json({success:false,message:err.message});return;}if((err as {code?:string})?.code==='P2002'){res.status(409).json({success:false,message:'This email or save key is already in use.'});return;}console.error('Customer operation failed',{name:err instanceof Error?err.name:'unknown'});res.status(500).json({success:false,message:'Could not complete the operation.'});});
export default router;
