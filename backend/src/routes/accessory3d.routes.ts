// Feature 2 endpoints (mounted at /api, before the global JSON parser; every route carries its own guards and body limit).
//   Shop      /parts/me/products/:productId/accessory-3d[...]   PARTS_PROVIDER, own shop, approved shop for writes
//   Admin     /admin/parts/accessory-3d[...], /admin/parts/accessory-zones[...], /admin/parts/part-maps[...], /admin/parts/auto-fits[...], /admin/parts/shops/:id/accessory-3d-credits
//   Customer  /catalog/products/:productId/accessory-3d[...], /catalog/accessory-3d/photos/:photoId
import express, { Router, type Request, type Response } from "express";
import { requireAuth, requireCustomer, requirePartsAdmin, requirePartsProvider } from "../middleware/auth.middleware.js";
import { requireApprovedProvider } from "../services/provider-onboarding.js";
import { createAccessory3DService, parseKitPart } from "../services/accessory3d.js";
import { createPartMapService } from "../services/car-part-map.js";
import { autoFitAccessory, createAutoFitService } from "../services/accessory-autofit.js";
import { Vehicle3DError } from "../services/vehicle3d-validation.js";

export function createAccessory3DRouter(service = createAccessory3DService(), partMaps = createPartMapService(), autoFits = createAutoFitService(), guards = { auth: requireAuth, provider: requirePartsProvider, approved: requireApprovedProvider, admin: requirePartsAdmin, customer: requireCustomer }) {
  const router = Router();
  const handle = (work: (req: Request, res: Response, uid: string) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { await work(req, res, res.locals.authUser.id); }
    catch (error) {
      if (error instanceof Vehicle3DError) { res.status(error.status).json({ success: false, code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) }); return; }
      console.error("Accessory 3D request failed."); // no details: storage paths / provider data never leave the server
      res.status(500).json({ success: false, message: "Could not complete the 3D accessory request." });
    }
  };
  const json = express.json({ limit: "8kb" }), photoJson = express.json({ limit: "7mb" });
  const shop = [guards.auth, guards.provider], shopWrite = [...shop, guards.approved], admin = [guards.auth, guards.admin], customer = [guards.auth, guards.customer];
  const p = (req: Request, k = "productId") => String(req.params[k]);
  /** ?part=FRONT|REAR: a body kit's bumper (default MAIN, every other product) */
  const part = (req: Request) => parseKitPart(req.query.part);
  const sendPrivate = (res: Response, file: { bytes: Buffer; mime: string }) => {
    res.setHeader("Cache-Control", "private, no-store"); res.setHeader("X-Content-Type-Options", "nosniff"); res.type(file.mime).send(file.bytes);
  };

  const s = "/parts/me/products/:productId/accessory-3d";
  router.get(s, ...shop, handle(async (req, res, uid) => res.json(await service.get(uid, p(req), part(req)))));
  router.put(s, ...shopWrite, json, handle(async (req, res, uid) => res.json({ accessory: await service.save(uid, p(req), req.body ?? {}, part(req)) })));
  router.delete(s, ...shopWrite, handle(async (req, res, uid) => { await service.remove(uid, p(req), part(req)); res.json({ success: true }); }));
  router.post(s + "/photos/:kind", ...shopWrite, photoJson, handle(async (req, res, uid) => res.status(201).json({ accessory: await service.addPhoto(uid, p(req), String(req.params.kind).toUpperCase(), req.body?.dataBase64, part(req)) })));
  router.delete(s + "/photos/:photoId", ...shopWrite, handle(async (req, res, uid) => res.json({ accessory: await service.removePhoto(uid, p(req), p(req, "photoId"), part(req)) })));
  router.post(s + "/submit", ...shopWrite, json, handle(async (req, res, uid) => res.json({ accessory: await service.submit(uid, p(req), req.body?.consent, part(req)) })));
  router.post(s + "/revise", ...shopWrite, handle(async (req, res, uid) => res.json({ accessory: await service.revise(uid, p(req), part(req)) })));
  router.get(s + "/assets/:asset", ...shop, handle(async (req, res, uid) => sendPrivate(res, await service.asset(uid, p(req), String(req.params.asset), false, part(req)))));

  const a = "/admin/parts/accessory-3d";
  router.get(a, ...admin, handle(async (_req, res) => res.json({ accessories: await service.adminList() })));
  router.get(a + "/:id", ...admin, handle(async (req, res) => res.json({ accessory: await service.adminGet(p(req, "id")) })));
  router.get(a + "/:id/assets/:asset", ...admin, handle(async (req, res) => sendPrivate(res, await service.asset(null, p(req, "id"), String(req.params.asset), true))));
  router.post(a + "/:id/approve", ...admin, handle(async (req, res, uid) => res.json({ accessory: await service.approve(uid, p(req, "id")) })));
  router.post(a + "/:id/reject", ...admin, json, handle(async (req, res, uid) => res.json({ accessory: await service.reject(uid, p(req, "id"), req.body?.notes) })));
  router.post(a + "/:id/start", ...admin, json, handle(async (req, res, uid) => res.status(202).json({ accessory: await service.start(uid, p(req, "id"), req.body?.confirmPaid) })));
  router.post(a + "/:id/preview", ...admin, json, handle(async (req, res, uid) => res.json({ accessory: await service.preview(uid, p(req, "id"), req.body?.generationId) })));
  router.post(a + "/:id/regenerate", ...admin, json, handle(async (req, res, uid) => res.json({ accessory: await service.regenerate(uid, p(req, "id"), req.body?.notes) })));
  router.post(a + "/:id/publish", ...admin, json, handle(async (req, res, uid) => {
    const accessory = await service.publish(uid, p(req, "id"), req.body ?? {}); void autoFitAccessory(p(req, "id")); // fit once per fitting generation, in the background
    res.json({ accessory });
  }));
  router.put("/admin/parts/shops/:id/accessory-3d-credits", ...admin, json, handle(async (req, res, uid) => res.json({ shop: await service.setCredits(uid, p(req, "id"), req.body?.monthlyCredits) })));
  router.get("/admin/parts/accessory-zones", ...admin, handle(async (_req, res) => res.json({ models: await service.zones() })));
  router.put("/admin/parts/accessory-zones/:key/:type", ...admin, json, handle(async (req, res, uid) => res.json({ zone: await service.setZone(uid, p(req, "key"), p(req, "type"), req.body?.zone ?? null) })));
  // part maps: list (+ background segmentation of new / changed files), one car, re-segment now, confirm / unconfirm
  const mapJson = express.json({ limit: "256kb" });
  router.get("/admin/parts/part-maps", ...admin, handle(async (_req, res) => res.json({ models: await partMaps.list() })));
  router.get("/admin/parts/part-maps/:key", ...admin, handle(async (req, res) => res.json({ partMap: await partMaps.get(p(req, "key")) })));
  router.post("/admin/parts/part-maps/:key/segment", ...admin, handle(async (req, res, uid) => res.json({ partMap: await partMaps.segment(uid, p(req, "key")) })));
  router.put("/admin/parts/part-maps/:key", ...admin, mapJson, handle(async (req, res, uid) => res.json({ partMap: await partMaps.confirm(uid, p(req, "key"), req.body ?? {}) })));

  // auto-fits on one car model: list (+ background computing), approve with an optional correction (adj null = reset to auto-fit)
  router.get("/admin/parts/auto-fits", ...admin, handle(async (req, res) => res.json({ fits: await autoFits.list(String(req.query.model3dKey ?? "")) })));
  router.put("/admin/parts/auto-fits/:accessoryId/:generationId", ...admin, json, handle(async (req, res, uid) => res.json({ fit: await autoFits.approve(uid, p(req, "accessoryId"), p(req, "generationId"), req.body ?? {}) })));

  const c = "/catalog/products/:productId/accessory-3d";
  router.get(c, guards.auth, handle(async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json({ accessory: await service.forProduct(p(req), typeof req.query.generationId === "string" ? req.query.generationId : null) }); }));
  router.get(c + "/adjust", ...customer, handle(async (req, res, uid) => res.json({ adj: await service.getAdjust(uid, p(req), part(req)) })));
  router.put(c + "/adjust", ...customer, json, handle(async (req, res, uid) => res.json({ adj: await service.putAdjust(uid, p(req), req.body?.adj, part(req)) })));
  router.get("/catalog/accessory-3d/photos/:photoId", guards.auth, handle(async (req, res) => {
    res.setHeader("Cache-Control", "private, max-age=3600"); res.setHeader("X-Content-Type-Options", "nosniff"); res.type("image/jpeg").send(await service.installedPhoto(p(req, "photoId")));
  }));
  return router;
}
export default createAccessory3DRouter();
