import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireCustomer, requireTowAdmin, requireTowProvider } from "../middleware/auth.middleware.js";
import { requireApprovedProvider } from "../services/provider-onboarding.js";
import {
  DispatchError,
  DriverStep,
  WORKING,
  addDriver,
  assign,
  driverAccept,
  driverCancel,
  driverDecline,
  driverMove,
  driverPing,
  driverStatus,
  freeDrivers,
  livePoint,
  myDriver,
  setOffline,
  updateDriver,
} from "../services/tow-dispatch.js";

// Tow drivers and live jobs (rules in services/tow-dispatch.ts).
//  - /api/driver/*                       the signed-in driver (TOW_DRIVER, or an owner who drives): his jobs, status, location.
//  - /api/tow/me/drivers, /assign, /live the company owner: drivers, (re)assignment, the live map of its active jobs.
//  - /api/catalog/tow/companies/:id/drivers  customers: the company's FREE drivers (first name + truck type only).
//  - /api/admin/tow/active-jobs, /jobs/:id   tow admins, read only.
// Privacy: customers see a driver's first name and, during their own job, his live point; never his phone or plate.
const router = Router();
const json = express.json({ limit: "16kb" });
const driverSide = [requireAuth, json];
const companySide = [requireAuth, requireTowProvider, requireApprovedProvider, json];

const send = (res: any, e: unknown, label: string) => {
  if (e instanceof DispatchError) return res.status(e.code).json({ success: false, message: e.message });
  console.error(`${label}:`, e);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
const me = (res: any) => (res.locals.authUser as { id: string }).id;
const id = (v: unknown) => String(v);
const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

const jobInclude = {
  customer: { select: { fullName: true } },
  company: { select: { id: true, companyName: true, baseLat: true, baseLng: true } },
  driver: { select: { id: true, lastLat: true, lastLng: true, lastAt: true, user: { select: { fullName: true } } } },
} satisfies Prisma.TowRequestInclude;
type Job = Prisma.TowRequestGetPayload<{ include: typeof jobInclude }>;
const point = (lat: number | null, lng: number | null) => (lat !== null && lng !== null ? { lat, lng } : null);

/** One job as the driver / the company / an admin sees it (the customer's first name, car, note, points, live point). */
const jobView = (r: Job) => ({
  id: r.id,
  status: r.status,
  arrivedAt: r.arrivedAt,
  customer: { firstName: firstName(r.customer.fullName) },
  // the phone the customer typed for this request, for the company's own staff
  contactPhone: r.contactPhone,
  vehicle: { make: r.vehicleMake, model: r.vehicleModel, year: r.vehicleYear },
  problemType: r.problemType,
  notes: r.notes,
  pickupAddress: r.pickupAddress,
  dropoffAddress: r.dropoffAddress,
  pickup: point(r.pickupLat, r.pickupLng),
  dropoff: point(r.dropoffLat, r.dropoffLng),
  company: { id: r.company.id, name: r.company.companyName, base: point(r.company.baseLat, r.company.baseLng) },
  driver: r.driver ? { id: r.driver.id, name: r.driver.user.fullName, live: WORKING.includes(r.status as never) ? livePoint(r.driver) : null } : null,
  cancelReason: r.cancelReason,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  times: { acceptedAt: r.acceptedAt, enRouteAt: r.enRouteAt, arrivedAt: r.arrivedAt, inProgressAt: r.inProgressAt, completedAt: r.completedAt, cancelledAt: r.cancelledAt },
});

// =====================================================================
// Driver
// =====================================================================
router.get("/driver/me", ...driverSide, async (_req, res) => {
  try {
    const d = await myDriver(me(res));
    const jobs = await prisma.towRequest.findMany({
      where: { driverId: d.id, OR: [{ status: { in: ["REQUESTED", ...WORKING] } }, { updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }] },
      include: jobInclude,
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return res.json({
      success: true,
      driver: {
        id: d.id,
        name: d.user.fullName,
        phone: d.phone,
        company: d.company.companyName,
        status: await driverStatus(prisma, d),
        offline: d.offline,
        truck: d.truck ? { id: d.truck.id, plate: d.truck.plateNumber, type: d.truck.truckType, make: d.truck.make, model: d.truck.model } : null,
      },
      jobs: jobs.map(jobView),
    });
  } catch (e) {
    return send(res, e, "Driver me error");
  }
});
router.put("/driver/me/availability", ...driverSide, async (req, res) => {
  try {
    await setOffline(me(res), req.body?.offline);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Driver availability error");
  }
});
const ownJob = async (res: any, jobId: string) => {
  const d = await myDriver(me(res));
  const r = await prisma.towRequest.findFirst({ where: { id: jobId, driverId: d.id }, include: jobInclude });
  if (!r) throw new DispatchError(404, "Job not found.");
  return r;
};
router.get("/driver/jobs/:id", ...driverSide, async (req, res) => {
  try {
    return res.json({ success: true, job: jobView(await ownJob(res, id(req.params.id))) });
  } catch (e) {
    return send(res, e, "Driver job error");
  }
});
router.post("/driver/jobs/:id/accept", ...driverSide, async (req, res) => {
  try {
    await driverAccept(me(res), id(req.params.id));
    return res.json({ success: true, job: jobView(await ownJob(res, id(req.params.id))) });
  } catch (e) {
    return send(res, e, "Driver accept error");
  }
});
router.post("/driver/jobs/:id/decline", ...driverSide, async (req, res) => {
  try {
    await driverDecline(me(res), id(req.params.id), req.body?.reason);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Driver decline error");
  }
});
router.post("/driver/jobs/:id/status", ...driverSide, async (req, res) => {
  try {
    await driverMove(me(res), id(req.params.id), req.body?.to as DriverStep);
    return res.json({ success: true, job: jobView(await ownJob(res, id(req.params.id))) });
  } catch (e) {
    return send(res, e, "Driver status error");
  }
});
router.post("/driver/jobs/:id/cancel", ...driverSide, async (req, res) => {
  try {
    await driverCancel(me(res), id(req.params.id), req.body?.reason);
    return res.json({ success: true, job: jobView(await ownJob(res, id(req.params.id))) });
  } catch (e) {
    return send(res, e, "Driver cancel error");
  }
});
router.post("/driver/jobs/:id/location", ...driverSide, async (req, res) => {
  try {
    await driverPing(me(res), id(req.params.id), req.body?.lat, req.body?.lng);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Driver location error");
  }
});

// =====================================================================
// Company owner
// =====================================================================
const companyOf = async (res: any) => {
  const c = await prisma.towCompanyProfile.findUnique({ where: { userId: me(res) }, select: { id: true } });
  if (!c) throw new DispatchError(404, "No tow company is linked to this account.");
  return c;
};

router.get("/tow/me/drivers", ...companySide, async (_req, res) => {
  try {
    const c = await companyOf(res);
    const rows = await prisma.towDriver.findMany({ where: { companyId: c.id }, include: { user: { select: { fullName: true, email: true, status: true } }, truck: true }, orderBy: { createdAt: "asc" } });
    const drivers = [];
    for (const d of rows) {
      const job = await prisma.towRequest.findFirst({ where: { driverId: d.id, status: { in: ["REQUESTED", ...WORKING] } }, orderBy: { updatedAt: "desc" }, include: { customer: { select: { fullName: true } } } });
      drivers.push({
        id: d.id,
        name: d.user.fullName,
        email: d.user.email,
        isOwner: d.userId === me(res),
        phone: d.phone,
        offline: d.offline,
        status: await driverStatus(prisma, d),
        truck: d.truck ? { id: d.truck.id, plate: d.truck.plateNumber, type: d.truck.truckType } : null,
        job: job ? { id: job.id, status: job.status, customerFirstName: firstName(job.customer.fullName) } : null,
        live: livePoint(d),
      });
    }
    return res.json({ success: true, drivers });
  } catch (e) {
    return send(res, e, "Company drivers error");
  }
});
router.post("/tow/me/drivers", ...companySide, async (req, res) => {
  try {
    const d = await addDriver(me(res), req.body);
    return res.status(201).json({ success: true, driverId: d.id });
  } catch (e) {
    return send(res, e, "Add driver error");
  }
});
router.patch("/tow/me/drivers/:id", ...companySide, async (req, res) => {
  try {
    await updateDriver(me(res), id(req.params.id), req.body);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Update driver error");
  }
});
router.post("/tow/me/requests/:id/assign", ...companySide, async (req, res) => {
  try {
    const driverId = typeof req.body?.driverId === "string" ? req.body.driverId : "";
    if (!driverId) throw new DispatchError(400, "driverId is required.");
    await assign(me(res), id(req.params.id), driverId);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Assign error");
  }
});
// every active job of the company with its driver's live point (the company's Live map)
router.get("/tow/me/live", ...companySide, async (_req, res) => {
  try {
    const c = await companyOf(res);
    const rows = await prisma.towRequest.findMany({ where: { companyId: c.id, status: { in: ["REQUESTED", ...WORKING] } }, include: jobInclude, orderBy: { updatedAt: "desc" }, take: 100 });
    return res.json({ success: true, jobs: rows.map(jobView) });
  } catch (e) {
    return send(res, e, "Company live error");
  }
});

// =====================================================================
// Customer: the company's free drivers (to request one directly)
// =====================================================================
router.get("/catalog/tow/companies/:id/drivers", requireAuth, requireCustomer, async (req, res) => {
  try {
    const c = await prisma.towCompanyProfile.findFirst({ where: { id: id(req.params.id), verificationStatus: "APPROVED" }, select: { id: true } });
    if (!c) throw new DispatchError(404, "Company not found.");
    const free = await freeDrivers(prisma, c.id);
    return res.json({ success: true, drivers: free.map((d) => ({ id: d.id, firstName: firstName(d.user.fullName), truck: d.truck ? { type: d.truck.truckType, make: d.truck.make, model: d.truck.model } : null })) });
  } catch (e) {
    return send(res, e, "Company drivers error");
  }
});

// =====================================================================
// Tow admins (read only)
// =====================================================================
router.get("/admin/tow/active-jobs", requireAuth, requireTowAdmin, async (_req, res) => {
  try {
    const rows = await prisma.towRequest.findMany({ where: { status: { in: ["REQUESTED", ...WORKING] } }, include: jobInclude, orderBy: { updatedAt: "desc" }, take: 200 });
    return res.json({ success: true, jobs: rows.map(jobView) });
  } catch (e) {
    return send(res, e, "Admin active tows error");
  }
});
router.get("/admin/tow/jobs/:id", requireAuth, requireTowAdmin, async (req, res) => {
  try {
    const r = await prisma.towRequest.findUnique({ where: { id: id(req.params.id) }, include: jobInclude });
    if (!r) throw new DispatchError(404, "Job not found.");
    return res.json({ success: true, job: jobView(r) });
  } catch (e) {
    return send(res, e, "Admin tow job error");
  }
});

export default router;
