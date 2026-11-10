import { prisma } from "../prisma.js";
import { activeAncestry } from "./vehicle-taxonomy.js";
import { safeKey } from "./vehicle3d-catalog.js";
/** Applied before static hosting to every GLB, including legacy names. No private candidate lives in this allowlist. */
export async function isPublic3DAsset(file:string){
  const accessory=/^accessories\/(acc-[a-f0-9]{16})\.glb$/.exec(file);
  if(accessory)return !!await prisma.productAccessory3D.findFirst({where:{publishedFile:accessory[1],status:"PUBLISHED",generationMode:"meshy",provider:"MESHY",providerState:"SUCCEEDED",providerTaskId:{not:null},deactivatedAt:null,product:{isHidden:false,shop:{verificationStatus:"APPROVED",user:{status:"ACTIVE"}}}},select:{id:true}});
  const key=file.endsWith(".glb")?file.slice(0,-4):"";
  if(!safeKey(key))return false;
  // Retained public revisions stay attributable while their generation remains published. Deactivation removes server access to all its revisions.
  if(await prisma.vehicle3DRevision.findFirst({where:{key,generation:{...activeAncestry,isPublished:true}},select:{key:true}}))return true;
  return !!await prisma.vehicleGeneration.findFirst({where:{...activeAncestry,isPublished:true,model3dKey:key},select:{id:true}});
}
