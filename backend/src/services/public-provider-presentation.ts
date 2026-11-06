import { prisma } from "../prisma.js";
import { mediaShape } from "./provider-media.js";

/** The exact same projection is used by catalog responses and provider customer previews. */
export async function publicProviderMedia(area:"tow"|"parts",id:string,truckIds:string[]=[]){
  const rows=await prisma.providerMedia.findMany({where:area==="tow"?{OR:[{towCompanyId:id},{truckId:{in:truckIds}}]}:{partsShopId:id},orderBy:[{createdAt:"desc"},{id:"desc"}],take:60});
  return rows.map(mediaShape);
}
