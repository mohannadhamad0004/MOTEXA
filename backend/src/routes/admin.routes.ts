import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.middleware.js";

const router=Router();
router.use(requireAuth,requireSuperAdmin);
router.get("/",(_req,res)=>{
 const user=res.locals.authUser;
 res.json({success:true,message:"Super Admin access granted.",user:{id:user.id,role:user.role}});
});

router.get("/dashboard",async(_req,res)=>{
 try{
  const now=new Date();
  const [administrators,mechanics,pendingMechanics,pendingInvitations,partsProviders,towProviders,suspendedAdministrators,expiredInvitations]=await Promise.all([
   prisma.user.count({where:{role:"ADMIN",status:"ACTIVE"}}),
   prisma.user.count({where:{role:"MECHANIC"}}),
   prisma.mechanicProfile.count({where:{verificationStatus:"PENDING"}}),
   prisma.adminInvitation.count({where:{status:"PENDING",expiresAt:{gt:now}}}),
   prisma.user.count({where:{role:"PARTS_PROVIDER"}}),
   prisma.user.count({where:{role:"TOW_PROVIDER"}}),
   prisma.user.count({where:{role:"ADMIN",status:"SUSPENDED"}}),
   prisma.adminInvitation.count({where:{status:"PENDING",expiresAt:{lte:now}}}),
  ]);
  res.json({success:true,stats:{administrators,mechanics,pendingMechanics,pendingInvitations,partsProviders,towProviders,suspendedAdministrators,expiredInvitations}});
 }catch(error){console.error("Dashboard statistics error:",error);res.status(500).json({success:false,message:"Failed to load dashboard statistics."});}
});

router.get("/providers",async(_req,res)=>{
 try{
  const providers=await prisma.user.findMany({where:{role:{in:["MECHANIC","PARTS_PROVIDER","TOW_PROVIDER"]}},select:{id:true,fullName:true,email:true,role:true,status:true,mechanicProfile:{select:{verificationStatus:true}}},orderBy:{createdAt:"desc"}});
  res.json({success:true,providers});
 }catch{res.status(500).json({success:false,message:"Failed to load providers."});}
});

/** A bounded, redacted event feed. Existing authentication and Super Admin guards apply. */
router.get("/activity",async(req,res)=>{
 const limit=req.query.limit===undefined?6:Number(req.query.limit);
 const cursor=req.query.cursor;
 const scope=req.query.scope??"all";
 if(typeof scope!=="string"||!["all","administrators","mechanics","parts","towing"].includes(scope))return res.status(400).json({success:false,message:"Invalid activity scope."});
 if((req.query.limit!==undefined&&typeof req.query.limit!=="string")||!Number.isInteger(limit)||limit<1||limit>20||(cursor!==undefined&&(typeof cursor!=="string"||!/^[0-9a-f-]{36}$/i.test(cursor)))){
  return res.status(400).json({success:false,message:"Invalid activity pagination."});
 }
 try{
  const logs=await prisma.auditLog.findMany({
   where:{OR:(scope==="all"?["ADMIN_","MECHANIC_","PARTS_","TOWING_"]:[scope==="administrators"?"ADMIN_":scope==="mechanics"?"MECHANIC_":scope==="parts"?"PARTS_":"TOWING_"]).map(prefix=>({action:{startsWith:prefix}}))},
   orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit+1,
   ...(typeof cursor==="string"?{cursor:{id:cursor},skip:1}:{}),
   select:{id:true,actorId:true,action:true,targetId:true,details:true,createdAt:true},
  });
  const page=logs.slice(0,limit),ids=[...new Set(page.flatMap(log=>[log.actorId,log.targetId].filter((id):id is string=>!!id)))];
  const users=ids.length?await prisma.user.findMany({where:{id:{in:ids}},select:{id:true,fullName:true}}):[];
  const names=new Map(users.map(user=>[user.id,user.fullName]));
  const activity=page.map(log=>{
   const details=log.details&&typeof log.details==="object"&&!Array.isArray(log.details)?log.details:{};
   const fullName=typeof details.fullName==="string"?details.fullName:null;
   return {id:log.id,action:log.action,createdAt:log.createdAt,
    actorName:log.actorId?names.get(log.actorId)??null:null,
    subjectName:fullName??(log.targetId?names.get(log.targetId)??null:null),
    permission:typeof details.permission==="string"?details.permission:null,
   };
  });
  return res.json({success:true,activity,nextCursor:logs.length>limit?page[page.length-1].id:null});
 }catch(error){console.error("Admin activity error:",error);return res.status(500).json({success:false,message:"Failed to load activity."});}
});
export default router;
