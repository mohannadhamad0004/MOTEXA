import express, { Router, type Request, type Response } from "express";
import { requireCustomer } from "../middleware/auth.middleware.js";
import { createGarageService, GarageError } from "../services/garage.js";

// Mounted behind catalog's requireAuth. Customer guard is per route, not for the rest of catalog.
export function createGarageRouter(service = createGarageService()) {
  const router = Router();
  const handle = (work: (req: Request, res: Response, userId: string) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { await work(req, res, res.locals.authUser.id); }
    catch (error) {
      if (error instanceof GarageError) { res.status(error.status).json({ success: false, code: error.code, message: error.message }); return; }
      console.error("Garage error:", error);
      res.status(500).json({ success: false, message: "Internal server error." });
    }
  };
  const json = express.json({ limit: "4kb" });
  router.get("/garage", requireCustomer, handle(async (_req, res, uid) => res.json({ success: true, cars: await service.list(uid) })));
  router.post("/garage", requireCustomer, json, handle(async (req, res, uid) => res.status(201).json({ success: true, car: await service.create(uid, req.body) })));
  router.patch("/garage/:id", requireCustomer, json, handle(async (req, res, uid) => res.json({ success: true, car: await service.update(uid, String(req.params.id), req.body) })));
  router.delete("/garage/:id", requireCustomer, handle(async (req, res, uid) => { await service.delete(uid, String(req.params.id)); res.json({ success: true }); }));
  router.post("/garage/:id/activate", requireCustomer, handle(async (req, res, uid) => res.json({ success: true, car: await service.activate(uid, String(req.params.id)) })));
  router.get("/my-car", requireCustomer, handle(async (_req, res, uid) => res.json({ success: true, car: await service.getMyCar(uid) })));
  router.put("/my-car", requireCustomer, json, handle(async (req, res, uid) => res.json({ success: true, car: await service.putMyCar(uid, req.body) })));
  router.delete("/my-car", requireCustomer, handle(async (_req, res, uid) => res.json({ success: true, car: await service.deleteMyCar(uid) })));
  return router;
}
