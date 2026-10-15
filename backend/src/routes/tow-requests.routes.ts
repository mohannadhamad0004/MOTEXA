import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireCustomer, requireTowProvider } from "../middleware/auth.middleware.js";

// Tow requests: a customer asks one approved tow company for a tow; the company accepts with one of its trucks.
//  - /api/requests/tow/*     CUSTOMER, only their own requests.
//  - /api/tow/me/requests/*  TOW_PROVIDER, only their own company's requests.
//
// State machine (anything else is 409). Every transition is one atomic conditional update + an AuditLog row.
//   REQUESTED  -> ACCEPTED     company  (picks its own APPROVED + AVAILABLE truck; the truck becomes BUSY)
//   REQUESTED  -> DECLINED     company  (reason required)
//   ACCEPTED   -> EN_ROUTE     company
//   EN_ROUTE   -> IN_PROGRESS  company
//   IN_PROGRESS-> COMPLETED    company  (the truck is released)
//   REQUESTED | ACCEPTED -> CANCELLED   customer (reason optional)
//   ACCEPTED   -> CANCELLED    company  (reason required; the truck is released)
// A released truck becomes AVAILABLE only if it is still APPROVED, otherwise OUT_OF_SERVICE.
// Privacy: the company sees the customer's NAME and what they typed (phone, addresses); never the email.
// The customer never sees plates, the company's phone, or documents.
const router = Router();

const ACTIVE = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] as const;
const STATUSES = ["REQUESTED", "ACCEPTED", "DECLINED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];
/** What the company may move an accepted job to, and the status it must come from. */
const NEXT: Record<string, { from: Status; stamp: "enRouteAt" | "inProgressAt" | "completedAt" }> = {
  EN_ROUTE: { from: "ACCEPTED", stamp: "enRouteAt" },
  IN_PROGRESS: { from: "EN_ROUTE", stamp: "inProgressAt" },
  COMPLETED: { from: "IN_PROGRESS", stamp: "completedAt" },
};

class HttpError extends Error {
  constructor(public code: number, message: string, public extra: object = {}) {
    super(message);
  }
}
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idParam = (v: unknown) => String(v);
const send = (res: any, e: unknown, label: string) => {
  if (e instanceof HttpError) return res.status(e.code).json({ success: false, message: e.message, ...e.extra });
  console.error(`${label}:`, e);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
const log = (tx: Prisma.TransactionClient, actorId: string, action: string, targetId: string, details: object = {}) =>
  tx.auditLog.create({ data: { actorId, action, targetId, details } });

const customerSide = [requireAuth, requireCustomer, express.json()];
const companySide = [requireAuth, requireTowProvider, express.json()];

const include = {
  company: { select: { id: true, companyName: true, city: true, verificationStatus: true } },
  customer: { select: { id: true, fullName: true } }, // never the email
  assignedTruck: { select: { id: true, plateNumber: true } },
};
type Row = Prisma.TowRequestGetPayload<{ include: typeof include }>;

const timeline = (r: Row) =>
  (
    [
      ["REQUESTED", r.createdAt],
      ["ACCEPTED", r.acceptedAt],
      ["DECLINED", r.declinedAt],
      ["EN_ROUTE", r.enRouteAt],
      ["IN_PROGRESS", r.inProgressAt],
      ["COMPLETED", r.completedAt],
      ["CANCELLED", r.cancelledAt],
    ] as [string, Date | null][]
  )
    .filter(([, at]) => !!at)
    .map(([status, at]) => ({ status, at }));

const truckSnapshot = (r: Row) =>
  r.assignedTruckType ? { type: r.assignedTruckType, make: r.assignedTruckMake, model: r.assignedTruckModel, year: r.assignedTruckYear } : null;

const common = (r: Row) => ({
  id: r.id,
  status: r.status,
  pickupAddress: r.pickupAddress,
  dropoffAddress: r.dropoffAddress,
  contactPhone: r.contactPhone,
  vehicle: { make: r.vehicleMake, model: r.vehicleModel, year: r.vehicleYear },
  notes: r.notes,
  declineReason: r.declineReason,
  cancelReason: r.cancelReason,
  cancelledBy: r.cancelledBy,
  timeline: timeline(r),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** What the customer sees: company name/city, the assigned truck WITHOUT a plate. */
const customerView = (r: Row) => ({
  ...common(r),
  company: { id: r.company.id, name: r.company.companyName, city: r.company.city },
  truck: truckSnapshot(r),
  canCancel: r.status === "REQUESTED" || r.status === "ACCEPTED",
});

/** What the company sees: the customer's name (not email) and its own truck, plate included. */
const companyView = (r: Row) => ({
  ...common(r),
  customerName: r.customer.fullName,
  truck: truckSnapshot(r) ? { ...truckSnapshot(r), id: r.assignedTruck?.id ?? null, plateNumber: r.assignedTruck?.plateNumber ?? null } : null,
});

const statusFilter = (q: unknown) => {
  if (q === undefined || q === "") return undefined;
  if (typeof q !== "string" || !STATUSES.includes(q as never)) throw new HttpError(400, "Invalid status filter.");
  return q as Status;
};

/** Gives the truck back after a job ends or is cancelled. Only a truck still marked BUSY is touched. */
async function releaseTruck(tx: Prisma.TransactionClient, truckId: string | null) {
  if (!truckId) return;
  const truck = await tx.truck.findUnique({ where: { id: truckId }, select: { verificationStatus: true } });
  if (!truck) return;
  await tx.truck.updateMany({
    where: { id: truckId, operationalStatus: "BUSY" },
    data: { operationalStatus: truck.verificationStatus === "APPROVED" ? "AVAILABLE" : "OUT_OF_SERVICE" },
  });
}

// =====================================================================
// Customer
// =====================================================================

const phoneOk = (v: string) => /^[0-9+()\-\s]{6,20}$/.test(v) && v.replace(/\D/g, "").length >= 5;

router.post("/requests/tow", ...customerSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const b = req.body ?? {};
    const companyId = text(b.companyId, 64);
    const pickupAddress = text(b.pickupAddress, 300);
    const dropoffAddress = text(b.dropoffAddress, 300);
    const contactPhone = text(b.contactPhone, 20);
    const vehicleMake = text(b.vehicleMake, 60);
    const vehicleModel = text(b.vehicleModel, 60);
    const notes = b.notes === undefined || b.notes === null || b.notes === "" ? null : text(b.notes, 500);
    if (!companyId) throw new HttpError(400, "companyId is required.");
    if (!pickupAddress || pickupAddress.length < 3) throw new HttpError(400, "Pickup address is required.");
    if (!dropoffAddress || dropoffAddress.length < 3) throw new HttpError(400, "Destination address is required.");
    if (!contactPhone || !phoneOk(contactPhone)) throw new HttpError(400, "A valid contact phone number is required.");
    if (!vehicleMake || !vehicleModel) throw new HttpError(400, "Car make and model are required.");
    const y = b.vehicleYear;
    if (y !== undefined && y !== null && !(Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1)) throw new HttpError(400, "Car year is invalid.");

    const id = await prisma.$transaction(async (tx) => {
      const company = await tx.towCompanyProfile.findFirst({ where: { id: companyId, verificationStatus: "APPROVED" }, select: { id: true } });
      if (!company) throw new HttpError(404, "Company not found.");
      const available = await tx.truck.count({ where: { companyId: company.id, verificationStatus: "APPROVED", operationalStatus: "AVAILABLE" } });
      if (!available) throw new HttpError(409, "This company has no available truck right now.");
      const active = await tx.towRequest.findFirst({ where: { customerId: me.id, companyId: company.id, status: { in: [...ACTIVE] } }, select: { id: true } });
      if (active) throw new HttpError(409, "You already have an active request with this company.", { existingRequestId: active.id });
      const created = await tx.towRequest.create({
        data: { customerId: me.id, companyId: company.id, pickupAddress, dropoffAddress, contactPhone, vehicleMake, vehicleModel, vehicleYear: y ?? null, notes },
      });
      await log(tx, me.id, "TOW_REQUEST_CREATED", created.id, { companyId: company.id });
      return created.id;
    });
    const row = await prisma.towRequest.findUniqueOrThrow({ where: { id }, include });
    return res.status(201).json({ success: true, request: customerView(row) });
  } catch (e) {
    return send(res, e, "Tow request create error");
  }
});

router.get("/requests/tow", ...customerSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const status = statusFilter(req.query.status);
    const rows = await prisma.towRequest.findMany({ where: { customerId: me.id, ...(status ? { status } : {}) }, include, orderBy: { updatedAt: "desc" }, take: 100 });
    return res.json({ success: true, requests: rows.map(customerView) });
  } catch (e) {
    return send(res, e, "Tow requests list error");
  }
});

const ownRequest = async (res: any, id: string) => {
  const me = res.locals.authUser as { id: string };
  const row = await prisma.towRequest.findFirst({ where: { id, customerId: me.id }, include });
  if (!row) throw new HttpError(404, "Request not found.");
  return row;
};

router.get("/requests/tow/:id", ...customerSide, async (req, res) => {
  try {
    return res.json({ success: true, request: customerView(await ownRequest(res, idParam(req.params.id))) });
  } catch (e) {
    return send(res, e, "Tow request error");
  }
});

router.patch("/requests/tow/:id/cancel", ...customerSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const reason = req.body?.reason === undefined || req.body.reason === null || req.body.reason === "" ? null : text(req.body.reason, 500);
    const current = await ownRequest(res, idParam(req.params.id));
    await prisma.$transaction(async (tx) => {
      // Atomic on the status we read: a request that moved on in the meantime (e.g. EN_ROUTE) is refused.
      const done = await tx.towRequest.updateMany({
        where: { id: current.id, customerId: me.id, status: { in: ["REQUESTED", "ACCEPTED"] } },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "CUSTOMER", cancelReason: reason },
      });
      if (!done.count) throw new HttpError(409, "This request can no longer be cancelled.");
      const fresh = await tx.towRequest.findUniqueOrThrow({ where: { id: current.id }, select: { assignedTruckId: true } });
      await releaseTruck(tx, fresh.assignedTruckId);
      await log(tx, me.id, "TOW_REQUEST_CANCELLED", current.id, { by: "CUSTOMER", reason });
    });
    return res.json({ success: true, request: customerView(await ownRequest(res, current.id)) });
  } catch (e) {
    return send(res, e, "Tow request cancel error");
  }
});

// =====================================================================
// Tow company
// =====================================================================

async function myCompany(res: any) {
  const me = res.locals.authUser as { id: string };
  const c = await prisma.towCompanyProfile.findUnique({ where: { userId: me.id }, select: { id: true, verificationStatus: true } });
  if (!c) throw new HttpError(404, "No tow company is linked to this account.");
  return c;
}
const companyRequest = async (res: any, id: string) => {
  const company = await myCompany(res);
  const row = await prisma.towRequest.findFirst({ where: { id, companyId: company.id }, include });
  if (!row) throw new HttpError(404, "Request not found.");
  return { company, row };
};
const REJECTED_MSG = "Your company application was rejected. You cannot accept or decline new requests.";

router.get("/tow/me/requests", ...companySide, async (req, res) => {
  try {
    const company = await myCompany(res);
    const status = statusFilter(req.query.status);
    const rows = await prisma.towRequest.findMany({ where: { companyId: company.id, ...(status ? { status } : {}) }, include, orderBy: { updatedAt: "desc" }, take: 100 });
    return res.json({ success: true, requests: rows.map(companyView) });
  } catch (e) {
    return send(res, e, "Company requests list error");
  }
});

router.get("/tow/me/requests/:id", ...companySide, async (req, res) => {
  try {
    const { row } = await companyRequest(res, idParam(req.params.id));
    return res.json({ success: true, request: companyView(row) });
  } catch (e) {
    return send(res, e, "Company request error");
  }
});

router.patch("/tow/me/requests/:id/accept", ...companySide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const { company, row } = await companyRequest(res, idParam(req.params.id));
    if (company.verificationStatus === "REJECTED") throw new HttpError(403, REJECTED_MSG);
    const truckId = text(req.body?.truckId, 64);
    if (!truckId) throw new HttpError(400, "truckId is required.");
    await prisma.$transaction(async (tx) => {
      // Another company's truck looks like it does not exist.
      const truck = await tx.truck.findFirst({ where: { id: truckId, companyId: company.id } });
      if (!truck) throw new HttpError(404, "Truck not found.");
      // Atomic claim: only an APPROVED + AVAILABLE truck can be taken, and only once.
      const claimed = await tx.truck.updateMany({
        where: { id: truck.id, companyId: company.id, verificationStatus: "APPROVED", operationalStatus: "AVAILABLE" },
        data: { operationalStatus: "BUSY" },
      });
      if (!claimed.count) throw new HttpError(409, "This truck is not available. Choose an approved, available truck.");
      const moved = await tx.towRequest.updateMany({
        where: { id: row.id, companyId: company.id, status: "REQUESTED" },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          assignedTruckId: truck.id,
          assignedTruckType: truck.truckType,
          assignedTruckMake: truck.make,
          assignedTruckModel: truck.model,
          assignedTruckYear: truck.year,
        },
      });
      if (!moved.count) throw new HttpError(409, "This request is no longer waiting for an answer."); // rolls the truck claim back
      await log(tx, me.id, "TOW_REQUEST_ACCEPTED", row.id, { truckId: truck.id });
    });
    return res.json({ success: true, request: companyView((await companyRequest(res, row.id)).row) });
  } catch (e) {
    return send(res, e, "Tow request accept error");
  }
});

router.patch("/tow/me/requests/:id/decline", ...companySide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const { company, row } = await companyRequest(res, idParam(req.params.id));
    if (company.verificationStatus === "REJECTED") throw new HttpError(403, REJECTED_MSG);
    const reason = text(req.body?.reason, 500);
    if (!reason) throw new HttpError(400, "A reason is required to decline.");
    await prisma.$transaction(async (tx) => {
      const done = await tx.towRequest.updateMany({ where: { id: row.id, companyId: company.id, status: "REQUESTED" }, data: { status: "DECLINED", declinedAt: new Date(), declineReason: reason } });
      if (!done.count) throw new HttpError(409, "This request is no longer waiting for an answer.");
      await log(tx, me.id, "TOW_REQUEST_DECLINED", row.id, { reason });
    });
    return res.json({ success: true, request: companyView((await companyRequest(res, row.id)).row) });
  } catch (e) {
    return send(res, e, "Tow request decline error");
  }
});

router.patch("/tow/me/requests/:id/status", ...companySide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const { row } = await companyRequest(res, idParam(req.params.id));
    const to = req.body?.status;
    const step = typeof to === "string" ? NEXT[to] : undefined;
    if (!step) throw new HttpError(400, "status must be EN_ROUTE, IN_PROGRESS or COMPLETED.");
    await prisma.$transaction(async (tx) => {
      const done = await tx.towRequest.updateMany({ where: { id: row.id, companyId: row.companyId, status: step.from }, data: { status: to as Status, [step.stamp]: new Date() } });
      if (!done.count) throw new HttpError(409, `A request can only move to ${to} from ${step.from}.`);
      if (to === "COMPLETED") await releaseTruck(tx, row.assignedTruckId);
      await log(tx, me.id, `TOW_REQUEST_${to}`, row.id, {});
    });
    return res.json({ success: true, request: companyView((await companyRequest(res, row.id)).row) });
  } catch (e) {
    return send(res, e, "Tow request status error");
  }
});

// The company may cancel an ACCEPTED job (before it is on the way). Reason required; the truck is released.
router.patch("/tow/me/requests/:id/cancel", ...companySide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const { row } = await companyRequest(res, idParam(req.params.id));
    const reason = text(req.body?.reason, 500);
    if (!reason) throw new HttpError(400, "A reason is required to cancel.");
    await prisma.$transaction(async (tx) => {
      const done = await tx.towRequest.updateMany({
        where: { id: row.id, companyId: row.companyId, status: "ACCEPTED" },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "COMPANY", cancelReason: reason },
      });
      if (!done.count) throw new HttpError(409, "Only an accepted request that is not yet on the way can be cancelled.");
      await releaseTruck(tx, row.assignedTruckId);
      await log(tx, me.id, "TOW_REQUEST_CANCELLED", row.id, { by: "COMPANY", reason });
    });
    return res.json({ success: true, request: companyView((await companyRequest(res, row.id)).row) });
  } catch (e) {
    return send(res, e, "Tow request company cancel error");
  }
});

export default router;
