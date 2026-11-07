import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireCustomer, requireTowAdmin, requireTowProvider } from "../middleware/auth.middleware.js";
import { freeDriversNear } from "../services/tow-cards.js";
import { notify } from "../services/provider-onboarding.js";
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
  ratingOf,
  resendInvite,
  releaseTruck,
  reviewDriver,
  setOffline,
  stageOf,
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
// adding / editing a driver carries his photo and licence photo (base64, up to 5 MB each)
const withPhotos = express.json({ limit: "14mb" });
const driverSide = [requireAuth, json];
const companySide = [requireAuth, requireTowProvider, requireApprovedProvider, json];
const companyPhotos = [requireAuth, requireTowProvider, requireApprovedProvider, withPhotos];

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
  stage: stageOf(r),
  arrivedAt: r.arrivedAt,
  loadingAt: r.loadingAt,
  deliveredAt: r.deliveredAt,
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
  times: { acceptedAt: r.acceptedAt, enRouteAt: r.enRouteAt, arrivedAt: r.arrivedAt, loadingAt: r.loadingAt, deliveredAt: r.deliveredAt, inProgressAt: r.inProgressAt, completedAt: r.completedAt, cancelledAt: r.cancelledAt },
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
        approval: d.approval,
        approvalReason: d.approvalReason,
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
    const rows = await prisma.towDriver.findMany({ where: { companyId: c.id }, include: { user: { select: { fullName: true, email: true, status: true } }, truck: true, files: { select: { id: true, purpose: true } } }, orderBy: { createdAt: "asc" } });
    const drivers = [];
    for (const d of rows) {
      const job = await prisma.towRequest.findFirst({ where: { driverId: d.id, status: { in: ["REQUESTED", ...WORKING] } }, orderBy: { updatedAt: "desc" }, include: { customer: { select: { fullName: true } } } });
      drivers.push({
        id: d.id,
        name: d.user.fullName,
        email: d.user.email,
        isOwner: d.userId === me(res),
        phone: d.phone,
        licenceNumber: d.licenceNumber,
        approval: d.approval,
        approvalReason: d.approvalReason,
        photoUri: d.files.find((f) => f.purpose === "DRIVER_PHOTO") ? `/files/public/${d.files.find((f) => f.purpose === "DRIVER_PHOTO")!.id}` : null,
        licenceUri: d.files.find((f) => f.purpose === "DRIVER_LICENCE") ? `/files/private/${d.files.find((f) => f.purpose === "DRIVER_LICENCE")!.id}` : null,
        rating: await ratingOf({ driverId: d.id }),
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
router.post("/tow/me/drivers", ...companyPhotos, async (req, res) => {
  try {
    const d = await addDriver(me(res), req.body);
    return res.status(201).json({ success: true, driverId: d.id });
  } catch (e) {
    return send(res, e, "Add driver error");
  }
});
router.patch("/tow/me/drivers/:id", ...companyPhotos, async (req, res) => {
  try {
    await updateDriver(me(res), id(req.params.id), req.body);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Update driver error");
  }
});
router.post("/tow/me/drivers/:id/invite", ...companySide, async (req, res) => {
  try {
    await resendInvite(me(res), id(req.params.id));
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Driver invite error");
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
    return res.json({ success: true, drivers: await freeDriversNear(null, c.id) });
  } catch (e) {
    return send(res, e, "Company drivers error");
  }
});

// =====================================================================
// Customer: FREE drivers near me (card + rounded pin + distance)
// =====================================================================
router.get("/catalog/tow/drivers", requireAuth, requireCustomer, async (req, res) => {
  try {
    const lat = Number(req.query.lat), lng = Number(req.query.lng);
    const from = req.query.lat !== undefined && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    const drivers = (await freeDriversNear(from)).map(({ _companyId, ...d }) => d);
    return res.json({ success: true, drivers });
  } catch (e) {
    return send(res, e, "Nearby drivers error");
  }
});

// =====================================================================
// Tow admins: licence review (read + decide)
// =====================================================================
router.get("/admin/tow/drivers", requireAuth, requireTowAdmin, async (req, res) => {
  try {
    const st = typeof req.query.status === "string" ? req.query.status : "";
    const rows = await prisma.towDriver.findMany({
      where: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(st) ? { approval: st as never } : {},
      include: { user: { select: { fullName: true, email: true } }, company: { select: { id: true, companyName: true } }, files: { select: { id: true, purpose: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({
      success: true,
      drivers: rows.map((d) => ({
        id: d.id, name: d.user.fullName, email: d.user.email, phone: d.phone, licenceNumber: d.licenceNumber, approval: d.approval, approvalReason: d.approvalReason, createdAt: d.createdAt,
        company: { id: d.company.id, name: d.company.companyName },
        photoUri: d.files.find((f) => f.purpose === "DRIVER_PHOTO") ? `/files/public/${d.files.find((f) => f.purpose === "DRIVER_PHOTO")!.id}` : null,
        licenceUri: d.files.find((f) => f.purpose === "DRIVER_LICENCE") ? `/files/private/${d.files.find((f) => f.purpose === "DRIVER_LICENCE")!.id}` : null,
      })),
    });
  } catch (e) {
    return send(res, e, "Admin drivers error");
  }
});
router.post("/admin/tow/drivers/:id/review", requireAuth, requireTowAdmin, json, async (req, res) => {
  try {
    await reviewDriver(me(res), id(req.params.id), req.body?.decision, req.body?.reason);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Admin driver review error");
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
    // the exact trail exists only while the job is active; afterwards only the distance summary is kept
    const trail = await prisma.towJobTrail.findMany({ where: { requestId: r.id }, orderBy: { at: "asc" }, take: 300, select: { lat: true, lng: true, at: true } });
    const reports = await prisma.towReport.findMany({ where: { requestId: r.id }, orderBy: { createdAt: "desc" }, select: { id: true, body: true, closedAt: true, createdAt: true } });
    const review = await prisma.towReview.findUnique({ where: { requestId: r.id }, select: { stars: true, comment: true } });
    return res.json({ success: true, job: { ...jobView(r), cancelledBy: r.cancelledBy, choiceMode: r.choiceMode, distanceMeters: r.distanceMeters, trail, reports, review } });
  } catch (e) {
    return send(res, e, "Admin tow job error");
  }
});

// history with filters: ?status= &companyId= &driverId= &from=YYYY-MM-DD &to=YYYY-MM-DD
router.get("/admin/tow/jobs", requireAuth, requireTowAdmin, async (req, res) => {
  try {
    const q = req.query;
    const statuses = ["REQUESTED", "ACCEPTED", "DECLINED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
    const date = (v: unknown, end: boolean) => {
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
      const d = new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    if (q.status !== undefined && q.status !== "" && !statuses.includes(String(q.status))) throw new DispatchError(400, "Invalid status filter.");
    const where: Prisma.TowRequestWhereInput = {
      ...(q.status ? { status: String(q.status) as never } : {}),
      ...(typeof q.companyId === "string" && q.companyId ? { companyId: q.companyId } : {}),
      ...(typeof q.driverId === "string" && q.driverId ? { driverId: q.driverId } : {}),
      ...(date(q.from, false) || date(q.to, true) ? { createdAt: { ...(date(q.from, false) ? { gte: date(q.from, false) } : {}), ...(date(q.to, true) ? { lte: date(q.to, true) } : {}) } } : {}),
    };
    const rows = await prisma.towRequest.findMany({ where, include: { ...jobInclude, reports: { select: { id: true, closedAt: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
    return res.json({ success: true, jobs: rows.map((r) => ({ ...jobView(r), cancelledBy: r.cancelledBy, distanceMeters: r.distanceMeters, openReports: r.reports.filter((x) => !x.closedAt).length })) });
  } catch (e) {
    return send(res, e, "Admin tow history error");
  }
});

// cancel any open job with a reason (audited; the truck is released; customer, driver and company are told)
router.post("/admin/tow/jobs/:id/cancel", requireAuth, requireTowAdmin, json, async (req, res) => {
  try {
    const why = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
    if (why.length < 3) throw new DispatchError(400, "A reason is required.");
    const r = await prisma.towRequest.findUnique({ where: { id: id(req.params.id) }, include: { driver: { select: { userId: true } }, company: { select: { userId: true } } } });
    if (!r) throw new DispatchError(404, "Job not found.");
    await prisma.$transaction(async (tx) => {
      const moved = await tx.towRequest.updateMany({ where: { id: r.id, status: { in: ["REQUESTED", ...WORKING] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "ADMIN", cancelReason: why } });
      if (!moved.count) throw new DispatchError(409, "Only an open job can be cancelled.");
      await releaseTruck(tx, r.assignedTruckId);
      await tx.towJobTrail.deleteMany({ where: { requestId: r.id } });
      await tx.auditLog.create({ data: { actorId: me(res), action: "TOW_REQUEST_CANCELLED", targetId: r.id, details: { by: "ADMIN", reason: why } } });
    });
    await notify([r.customerId, r.company.userId, ...(r.driver ? [r.driver.userId] : [])], ["A tow was cancelled by MOTEXA", "ألغت موتكسا طلب سحب"], [why, why]);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Admin tow cancel error");
  }
});

// "Report a problem" from customers
router.get("/admin/tow/reports", requireAuth, requireTowAdmin, async (req, res) => {
  try {
    const open = req.query.open === "1";
    const rows = await prisma.towReport.findMany({
      where: open ? { closedAt: null } : {},
      include: { request: { select: { id: true, status: true, company: { select: { id: true, companyName: true } }, driver: { select: { id: true, user: { select: { fullName: true } } } }, customer: { select: { fullName: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({ success: true, reports: rows.map((x) => ({ id: x.id, body: x.body, createdAt: x.createdAt, closedAt: x.closedAt, job: { id: x.request.id, status: x.request.status, company: x.request.company.companyName, driver: x.request.driver?.user.fullName ?? null, customerFirstName: firstName(x.request.customer.fullName) } })) });
  } catch (e) {
    return send(res, e, "Admin tow reports error");
  }
});
router.post("/admin/tow/reports/:id/close", requireAuth, requireTowAdmin, json, async (req, res) => {
  try {
    const done = await prisma.towReport.updateMany({ where: { id: id(req.params.id), closedAt: null }, data: { closedAt: new Date() } });
    if (!done.count) throw new DispatchError(404, "Open report not found.");
    await prisma.auditLog.create({ data: { actorId: me(res), action: "TOW_REPORT_CLOSED", targetId: id(req.params.id), details: {} } });
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Admin tow report close error");
  }
});

// =====================================================================
// Company: real stats from its own jobs and reviews
// =====================================================================
router.get("/tow/me/stats", ...companySide, async (_req, res) => {
  try {
    const c = await companyOf(res);
    const by = await prisma.towRequest.groupBy({ by: ["status"], where: { companyId: c.id }, _count: { _all: true } });
    const n = (s: string) => by.find((x) => x.status === s)?._count._all ?? 0;
    const timeouts = await prisma.towRequest.count({ where: { companyId: c.id, cancelledBy: "SYSTEM" } });
    const dist = await prisma.towRequest.aggregate({ where: { companyId: c.id, status: "COMPLETED" }, _sum: { distanceMeters: true } });
    const drivers = await prisma.towDriver.findMany({ where: { companyId: c.id }, include: { user: { select: { fullName: true } } } });
    const per = [];
    for (const d of drivers) per.push({ id: d.id, name: d.user.fullName, completed: await prisma.towRequest.count({ where: { driverId: d.id, status: "COMPLETED" } }), rating: await ratingOf({ driverId: d.id }) });
    return res.json({ success: true, stats: { total: by.reduce((a, x) => a + x._count._all, 0), completed: n("COMPLETED"), cancelled: n("CANCELLED"), declined: n("DECLINED"), open: n("REQUESTED") + n("ACCEPTED") + n("EN_ROUTE") + n("IN_PROGRESS"), timeouts, distanceKm: Math.round((dist._sum.distanceMeters ?? 0) / 100) / 10, rating: await ratingOf({ companyId: c.id }), drivers: per } });
  } catch (e) {
    return send(res, e, "Company stats error");
  }
});

export default router;
