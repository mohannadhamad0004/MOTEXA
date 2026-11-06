import {activeAncestry} from "../services/vehicle-taxonomy.js";
import {createCatalogRequestService} from "../services/vehicle-catalog-requests.js";
import express, { Router, type Request, type Response } from "express";
import { requireAuth, requireCustomer, requirePartsAdmin } from "../middleware/auth.middleware.js";
import { prisma } from "../prisma.js";
import { activeModels } from "../services/vehicle3d-catalog.js";
import { mergeZones } from "../services/accessory3d.js";
import { createHash } from "node:crypto";
import { createSubmissionService } from "../services/vehicle3d-submissions.js";
import { Vehicle3DError } from "../services/vehicle3d-validation.js";

export function createVehicle3DRouter(service = createSubmissionService(), guards = { auth: requireAuth, customer: requireCustomer, admin: requirePartsAdmin },requests=createCatalogRequestService()) {
  const router = Router();
  const handle = (work: (req: Request, res: Response, uid: string) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { await work(req, res, res.locals.authUser.id); }
    catch (error) {
      if (error instanceof Vehicle3DError) { res.status(error.status).json({ success: false, code: error.code, message: error.message }); return; }
      // Avoid accidental storage/provider/token leakage from low-level exception messages.
      res.status(500).json({ success: false, message: "Could not complete the 3D request." });
    }
  };
  router.use(guards.auth);
  router.get("/catalog/3d-models", handle(async (_req, res) => {
    // Crash-safe visibility: catalog files alone never publish an uncommitted promotion.
    const rows = await prisma.vehicleGeneration.findMany({ where: { ...activeAncestry,isPublished:true,model3dKey: { not: null } }, select: { model3dKey: true } });
    const keys = new Set(rows.map(r => r.model3dKey));
    // admin-tuned accessory zones (DB) ride along, so a fixed zone reaches the app without a rebuild
    const models=await mergeZones(activeModels().filter(m=>keys.has(m.key)));
    const revision=createHash("sha256").update(JSON.stringify(models)).digest("hex");
    res.setHeader("Cache-Control", "no-store"); res.json({revision,activeKeys:models.map(m=>m.key),models});
  }));
  const c = "/catalog/vehicle-3d-submissions", a = "/admin/parts/vehicle-3d-submissions";
  const json = express.json({ limit: "8kb" }), photoJson = express.json({ limit: "7mb" });
  router.get(c, guards.customer, handle(async (_req,res,uid) => res.json({ submissions: await service.list(uid) })));
  router.post(c, guards.customer, json, handle(async (req,res,uid) => {
    if (typeof req.body?.garageCarId !== "string") throw new Vehicle3DError(400,"GARAGE_CAR_REQUIRED","Choose a Garage car.");
    res.status(201).json({ submission: await service.create(uid, req.body.garageCarId) });
  }));
  router.get(c+"/:id", guards.customer, handle(async (req,res,uid) => res.json({ submission: await service.get(uid,String(req.params.id)) })));
  router.put(c+"/:id/photos/:view", guards.customer, photoJson, handle(async (req,res,uid) => res.json({ submission: await service.photo(uid,String(req.params.id),String(req.params.view),req.body?.dataBase64) })));
  router.post(c+"/:id/generate", guards.customer, json, handle(async (req,res,uid) => res.status(202).json({ submission: await requests.fromSubmission(uid,String(req.params.id),req.body?.processingConsent===true&&req.body?.redistributionConsent===true) })));
  router.post(c+"/:id/submit", guards.customer, json, handle(async (req,res,uid) => res.json({ submission: await service.submit(uid,String(req.params.id),req.body?.redistributionConsent) })));
  router.post(c+"/:id/regenerate",guards.customer,json,handle(async(req,res,uid)=>res.json({submission:await service.regenerate(uid,String(req.params.id))})));
  router.delete(c+"/:id", guards.customer, handle(async (req,res,uid) => { await service.delete(uid,String(req.params.id));res.json({ success:true }); }));
  const asset = (admin: boolean) => handle(async (req,res,uid) => {
    const file = await service.asset(uid,String(req.params.id),String(req.params.asset),admin);
    res.setHeader("Cache-Control","private, no-store");res.setHeader("X-Content-Type-Options","nosniff");
    res.type(file.mime).send(file.bytes);
  });
  router.get(c+"/:id/assets/:asset", guards.customer, asset(false));
  router.get(a, guards.admin, handle(async (_req,res) => res.json({ submissions: await service.adminList() })));
  router.get(a+"/:id", guards.admin, handle(async (req,res) => res.json({ submission: await service.adminGet(String(req.params.id)) })));
  router.get(a+"/:id/assets/:asset", guards.admin, asset(true));
  router.post(a+"/:id/approve", guards.admin, json, handle(async (req,res,uid) => res.json({ submission: await service.approve(uid,String(req.params.id),req.body ?? {}) })));
  router.post(a+"/:id/reject", guards.admin, json, handle(async (req,res,uid) => res.json({ submission: await service.reject(uid,String(req.params.id),req.body?.notes) })));
  router.post(a+"/:id/validate",guards.admin,json,handle(async(req,res,uid)=>res.json({submission:await service.validate(uid,String(req.params.id),req.body?.config)})));
  router.post(a+"/:id/request-regeneration",guards.admin,json,handle(async(req,res,uid)=>res.json({submission:await service.requestRegeneration(uid,String(req.params.id),req.body?.notes)})));
  return router;
}
export default createVehicle3DRouter();
