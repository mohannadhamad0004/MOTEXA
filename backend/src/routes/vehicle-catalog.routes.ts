import express,{Router,type Request,type Response} from "express";
import {requireAuth,requireCustomer,requirePartsAdmin} from "../middleware/auth.middleware.js";
import {createTaxonomyService} from "../services/vehicle-taxonomy.js";
import {createCatalogRequestService} from "../services/vehicle-catalog-requests.js";
import {createSubmissionService} from "../services/vehicle3d-submissions.js";
import {createImportService} from "../services/vehicle3d-imports.js";
import {Vehicle3DError} from "../services/vehicle3d-validation.js";
export function createVehicleCatalogRouter(){
 const router=Router(),tax=createTaxonomyService(),requests=createCatalogRequestService(),sub=createSubmissionService(),imports=createImportService();
 const c="/catalog/vehicle-requests",a="/admin/parts/vehicle-requests",v="/admin/parts/vehicles",i="/admin/parts/vehicle-3d-imports";
 router.use([c,a,v,i],requireAuth);const json=express.json({limit:"24kb"}),upload=express.json({limit:"29mb"}),photo=express.json({limit:"7mb"});
 const h=(fn:(req:Request,res:Response,uid:string)=>Promise<unknown>)=>async(req:Request,res:Response)=>{try{await fn(req,res,res.locals.authUser.id);}catch(e){if(e instanceof Vehicle3DError){res.status(e.status).json({success:false,code:e.code,message:e.message});return;}const code=(e as any)?.code;res.status(code==="P2002"||code==="P2003"?409:500).json({success:false,message:code==="P2002"?"A matching record already exists.":code==="P2003"?"This record has history. Deactivate it instead.":"Could not complete the vehicle catalog request."});}};
 router.get(c,requireCustomer,h(async(_q,r,u)=>r.json({requests:await requests.list(u)})));
 router.post(c,requireCustomer,json,h(async(q,r,u)=>r.status(201).json({request:await requests.create(u,q.body)})));
 router.get(c+"/:id",requireCustomer,h(async(q,r,u)=>r.json({request:await requests.get(u,String(q.params.id))})));
 router.patch(c+"/:id",requireCustomer,json,h(async(q,r,u)=>r.json({request:await requests.edit(u,String(q.params.id),q.body)})));
 router.post(c+"/:id/submit",requireCustomer,json,h(async(q,r,u)=>{const row=await requests.get(u,String(q.params.id));r.json({request:await requests.fromSubmission(u,row.submissionId,q.body?.consent)});}));
 router.put(c+"/:id/photos/:view",requireCustomer,photo,h(async(q,r,u)=>{const row=await requests.get(u,String(q.params.id));await sub.photo(u,row.submissionId,String(q.params.view),q.body?.dataBase64);r.json({request:await requests.get(u,row.id)});}));
 const asset=(admin:boolean)=>h(async(q,r,u)=>{const row=await requests.get(u,String(q.params.id),admin);const asset=await sub.asset(u,row.submissionId,String(q.params.asset),false===admin?false:true);r.setHeader("Cache-Control","private, no-store");r.setHeader("X-Content-Type-Options","nosniff");r.type(asset.mime).send(asset.bytes);});
 // Initial review photos are available to Parts Admin even while the underlying job is DRAFT.
 router.get(c+"/:id/assets/:asset",requireCustomer,asset(false));
 router.get(a,requirePartsAdmin,h(async(_q,r,u)=>r.json({requests:await requests.list(u,true)})));
 router.get(a+"/:id",requirePartsAdmin,h(async(q,r,u)=>r.json({request:await requests.get(u,String(q.params.id),true)})));
 router.get(a+"/:id/assets/:asset",requirePartsAdmin,asset(true));
 router.patch(a+"/:id",requirePartsAdmin,json,h(async(q,r,u)=>r.json({request:await requests.correct(u,String(q.params.id),q.body)})));
 router.post(a+"/:id/approve-initial",requirePartsAdmin,json,h(async(q,r,u)=>r.json({request:await requests.approveInitial(u,String(q.params.id),q.body)})));
 router.post(a+"/:id/reject-initial",requirePartsAdmin,json,h(async(q,r,u)=>r.json({request:await requests.rejectInitial(u,String(q.params.id),q.body?.notes)})));
 for(const [action,fn] of [["start-generation",requests.start],["final-review",requests.finalReview],["regenerate",requests.regenerate]] as const)router.post(a+"/:id/"+action,requirePartsAdmin,json,h(async(q,r,u)=>r.json({result:await fn(u,String(q.params.id))})));
 router.get(v,requirePartsAdmin,h(async(_q,r,u)=>r.json(await tax.list(u))));
 router.get(v+"/suggestions",requirePartsAdmin,h(async(q,r,u)=>r.json(await tax.suggestions(u,String(q.query.make??""),String(q.query.model??""),Number(q.query.year)))));
 for(const [kind,fn]of [["brands",tax.brand],["models",tax.model],["generations",tax.generation]]as const){
  router.post(v+"/"+kind,requirePartsAdmin,json,h(async(q,r,u)=>r.status(201).json({record:await fn(u,null,q.body)})));
  router.patch(v+"/"+kind+"/:id",requirePartsAdmin,json,h(async(q,r,u)=>r.json({record:await fn(u,String(q.params.id),q.body)})));
  router.delete(v+"/"+kind+"/:id",requirePartsAdmin,h(async(q,r,u)=>r.json(await tax.remove(u,kind,String(q.params.id)))));
 }
 router.get(i,requirePartsAdmin,h(async(_q,r,u)=>r.json({imports:await imports.list(u)})));
 router.post(i,requirePartsAdmin,upload,h(async(q,r,u)=>r.status(201).json({import:await imports.upload(u,q.body)})));
 router.get(i+"/:id",requirePartsAdmin,h(async(q,r,u)=>r.json({import:await imports.get(u,String(q.params.id))})));
 router.get(i+"/:id/model",requirePartsAdmin,h(async(q,r,u)=>{r.setHeader("Cache-Control","private, no-store");r.type("model/gltf-binary").send(await imports.asset(u,String(q.params.id)));}));
 router.post(i+"/:id/validate",requirePartsAdmin,json,h(async(q,r,u)=>r.json({import:await imports.validate(u,String(q.params.id),q.body?.config)})));
 router.post(i+"/:id/publish",requirePartsAdmin,json,h(async(q,r,u)=>r.json({import:await imports.publish(u,String(q.params.id),q.body)})));
 return router;
}
export default createVehicleCatalogRouter();
