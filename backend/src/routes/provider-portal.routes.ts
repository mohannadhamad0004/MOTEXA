import express, { Router, type Request, type Response } from "express";
import { createReadStream } from "node:fs";
import { requireAuth, requireTowProvider, requirePartsProvider } from "../middleware/auth.middleware.js";
import { requireApprovedProvider } from "../services/provider-onboarding.js";
import { providerSummary, portalOwner, shopProfile, updateShopProfile, shop3dProducts, type PortalArea } from "../services/provider-portal.js";
import { deleteMedia, listMedia, mediaFile, uploadMedia } from "../services/provider-media.js";
import { Vehicle3DError } from "../services/vehicle3d-validation.js";
import { freeDrivers } from "../services/tow-dispatch.js";
import { prisma } from "../prisma.js";

const router=Router();
const handle=(work:(req:Request,res:Response)=>Promise<unknown>)=>async(req:Request,res:Response)=>{try{await work(req,res);}catch(e){if(e instanceof Vehicle3DError){res.status(e.status).json({message:e.message,code:e.code});return;}console.error("Provider portal request failed.");res.status(500).json({message:"Could not complete the provider request."});}};
const uid=(res:Response)=>res.locals.authUser.id as string;
for(const area of ["tow","parts"] as PortalArea[]){
  const guards=[requireAuth,area==="tow"?requireTowProvider:requirePartsProvider],base=`/${area}/me/portal`;
  router.get(base+"/summary",...guards,handle(async(_req,res)=>{res.setHeader("Cache-Control","private, no-store");res.json(await providerSummary(uid(res),area));}));
  router.get(base+"/identity",...guards,handle(async(_req,res)=>{const p=await portalOwner(uid(res),area);res.json({id:p.id,name:"companyName" in p?p.companyName:p.shopName});}));
  router.get(base+"/media",...guards,handle(async(_req,res)=>res.json({media:await listMedia(uid(res),area)})));
  router.post(base+"/media",...guards,requireApprovedProvider,express.json({limit:"29mb"}),handle(async(req,res)=>res.status(201).json({media:await uploadMedia(uid(res),area,req.body??{})})));
  router.delete(base+"/media/:id",...guards,requireApprovedProvider,handle(async(req,res)=>{await deleteMedia(uid(res),area,String(req.params.id));res.json({success:true});}));
  router.get(base+"/media/:id/asset",...guards,handle(async(req,res)=>{await portalOwner(uid(res),area);await stream(req,res,String(req.params.id),uid(res));}));
}
router.get("/parts/me/portal/profile",requireAuth,requirePartsProvider,handle(async(_req,res)=>res.json({shop:await shopProfile(uid(res))})));
router.get("/tow/me/portal/public-drivers",requireAuth,requireTowProvider,handle(async(_req,res)=>{const p=await portalOwner(uid(res),"tow");const drivers=p.verificationStatus==="APPROVED"?await freeDrivers(prisma,p.id):[];res.json({drivers:drivers.map(d=>({id:d.id,firstName:d.user.fullName.trim().split(/\s+/)[0],truck:d.truck?{make:d.truck.make,model:d.truck.model}:null}))});}));
router.patch("/parts/me/portal/profile",requireAuth,requirePartsProvider,requireApprovedProvider,express.json({limit:"8kb"}),handle(async(req,res)=>res.json({shop:await updateShopProfile(uid(res),req.body??{})})));
router.get("/parts/me/portal/3d",requireAuth,requirePartsProvider,handle(async(req,res)=>{const page=Number(req.query.page??1);if(!Number.isSafeInteger(page)||page<1||page>10000){res.status(400).json({message:"Invalid page."});return;}res.setHeader("Cache-Control","private, no-store");res.json(await shop3dProducts(uid(res),page,String(req.query.q??"").slice(0,100),req.query.submissions==="1"));}));
router.get("/parts/me/portal/3d/:productId",requireAuth,requirePartsProvider,handle(async(req,res)=>{const result=await shop3dProducts(uid(res),1,"",false,String(req.params.productId));if(!result.products.length){res.status(404).json({message:"Product not found."});return;}res.setHeader("Cache-Control","private, no-store");res.json(result.products[0]);}));
router.get("/catalog/provider-media/:id",handle(async(req,res)=>stream(req,res,String(req.params.id))));
async function stream(req:Request,res:Response,id:string,owner?:string){
  const m=await mediaFile(id,owner);res.setHeader("Content-Type",m.mime);res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Cache-Control","private, no-store");res.setHeader("Accept-Ranges","bytes");
  const range=req.headers.range;if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=m.size-1;if(match){if(!match[1]&&match[2])start=Math.max(0,m.size-Number(match[2]));else{start=Number(match[1]);end=match[2]?Number(match[2]):end;}}if(!match||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=m.size||end>=m.size){res.setHeader("Content-Range",`bytes */${m.size}`);res.status(416).end();return;}res.status(206);res.setHeader("Content-Range",`bytes ${start}-${end}/${m.size}`);res.setHeader("Content-Length",end-start+1);createReadStream(m.file,{start,end}).on("error",()=>res.destroy()).pipe(res);return;}
  res.setHeader("Content-Length",m.size);createReadStream(m.file).on("error",()=>res.destroy()).pipe(res);
}
export default router;
