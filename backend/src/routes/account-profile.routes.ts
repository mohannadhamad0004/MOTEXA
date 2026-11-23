import {Router} from 'express';
import {prisma} from '../prisma.js';
import {requireAuth} from '../middleware/auth.middleware.js';

const router=Router();
router.patch('/',requireAuth,async(req,res)=>{
 const actor=res.locals.authUser;
 if(!['SUPER_ADMIN','ADMIN'].includes(actor.role))return res.status(403).json({success:false,message:'Administrator account required.'});
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='fullName')||typeof body.fullName!=='string')return res.status(400).json({success:false,message:'Only fullName can be updated here.'});
 const fullName=body.fullName.trim().replace(/\s+/g,' ');
 if(fullName.length<2||fullName.length>120||/[\u0000-\u001f\u007f]/.test(body.fullName))return res.status(400).json({success:false,message:'Name must contain 2–120 characters and no control characters.'});
 try{
  const user=await prisma.$transaction(async tx=>{
   const changed=await tx.user.updateMany({where:{id:actor.id,status:'ACTIVE',role:actor.role},data:{fullName}});
   if(!changed.count)return null;
   const result=await tx.user.findUnique({where:{id:actor.id},select:{id:true,fullName:true,email:true,role:true,status:true,adminPermissions:{select:{permission:true}}}});
   await tx.auditLog.create({data:{actorId:actor.id,targetId:actor.id,action:'ADMIN_PROFILE_UPDATED',details:{fullName}}});
   return result;
  });
  if(!user)return res.status(409).json({success:false,message:'Account access changed. Sign in again.'});
  return res.json({success:true,user});
 }catch(error){console.error('Profile update failed:',error);return res.status(500).json({success:false,message:'Unable to update profile.'});}
});
export default router;
