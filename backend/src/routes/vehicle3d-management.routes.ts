import express, { Router } from "express";
import { requireAuth, requirePartsAdmin } from "../middleware/auth.middleware.js";
import { createVehicleModelService } from "../services/vehicle3d-management.js";
import { Vehicle3DError } from "../services/vehicle3d-validation.js";
import {readFileSync} from "node:fs";
import {publicModelPath} from "../services/vehicle3d-revisions.js";
export function createVehicleModelRouter(service = createVehicleModelService()) {
  const router = Router(), base = "/admin/parts/vehicle-3d-models";
  router.use(base, requireAuth, requirePartsAdmin, express.json({ limit: "32kb" }));
  const h = (fn: (uid: string, key: string, body: any) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { res.json(await fn(res.locals.authUser.id, String(req.params.key ?? ""), req.body ?? {})); }
    catch (e) { if (e instanceof Vehicle3DError) res.status(e.status).json({ success: false, code: e.code, message: e.message }); else res.status(500).json({ success: false, message: "Could not manage the vehicle 3D model." }); }
  };
  router.get(base, h(async uid => ({ models: await service.list(uid) })));
  router.get(base+"/:key/model",async(req,res)=>{try{const model=await service.get(res.locals.authUser.id,String(req.params.key));if(model.bytes===null){res.status(404).end();return;}res.setHeader("Cache-Control","private, no-store");res.setHeader("X-Content-Type-Options","nosniff");res.type("model/gltf-binary").send(readFileSync(publicModelPath(model.key)));}catch{res.status(404).end();}});
  router.get(base + "/:key", h(async (uid,key) => ({ model: await service.get(uid,key) })));
  router.patch(base + "/:key/config", h(async (uid,key,body) => ({ model: await service.configure(uid,key,body) })));
  router.post(base + "/:key/publication", h(async (uid,key,body) => ({ model: await service.publication(uid,key,body) })));
  router.delete(base + "/:key", h((uid,key) => service.remove(uid,key)));
  return router;
}
export default createVehicleModelRouter();
