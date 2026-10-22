import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { readPair } from "../geo.js";
import { requireAuth, requireCustomer } from "../middleware/auth.middleware.js";
import { publicMechanic } from "./catalog-mechanics.routes.js";

// Mechanic service requests: a customer asks one public mechanic for help; the mechanic accepts, starts and completes.
//  - /api/requests/mechanic/*  CUSTOMER (GET /:id is also open to the receiving mechanic)
//  - /api/mechanic/requests/*  MECHANIC, only their own requests
//
// State machine (anything else is 409). Every transition is one atomic conditional update + an AuditLog row.
//   REQUESTED   -> ACCEPTED     mechanic
//   REQUESTED   -> DECLINED     mechanic (reason optional)
//   ACCEPTED    -> IN_PROGRESS  mechanic
//   IN_PROGRESS -> COMPLETED    mechanic
//   REQUESTED | ACCEPTED -> CANCELLED   customer
// Privacy: the mechanic sees the customer's NAME, the car, the problem, the location and the phone only if the
// customer typed one; never the email. The customer never sees the mechanic's phone, email or credentials.
const router = Router();

const OPEN = ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] as const;
const MAX_OPEN_PER_MECHANIC = 3;
const STATUSES = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

class HttpError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const optional = (v: unknown) => v === undefined || v === null || v === "";
const send = (res: any, e: unknown, label: string) => {
  if (e instanceof HttpError) return res.status(e.code).json({ success: false, message: e.message });
  console.error(`${label}:`, e);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
const log = (tx: Prisma.TransactionClient, actorId: string, action: string, targetId: string, details: object = {}) =>
  tx.auditLog.create({ data: { actorId, action, targetId, details } });
const phoneOk = (v: string) => /^[0-9+()\-\s]{6,20}$/.test(v) && v.replace(/\D/g, "").length >= 5;
const round6 = (n: number | null) => (n === null ? null : Math.round(n * 1e6) / 1e6);

const customerSide = [requireAuth, requireCustomer, express.json()];
const mechanicSide = [
  requireAuth,
  (_req: any, res: any, next: any) => (res.locals.authUser?.role === "MECHANIC" ? next() : res.status(403).json({ success: false, message: "Mechanic access required." })),
  express.json(),
];

const include = {
  customer: { select: { id: true, fullName: true } }, // never the email
  mechanic: { select: { id: true, fullName: true, mechanicApplication: { select: { workshopName: true, city: true } } } }, // never phone/email
};
type Row = Prisma.MechanicRequestGetPayload<{ include: typeof include }>;

const timeline = (r: Row) =>
  (
    [
      ["REQUESTED", r.requestedAt],
      ["ACCEPTED", r.acceptedAt],
      ["DECLINED", r.declinedAt],
      ["IN_PROGRESS", r.startedAt],
      ["COMPLETED", r.completedAt],
      ["CANCELLED", r.cancelledAt],
    ] as [string, Date | null][]
  )
    .filter(([, at]) => !!at)
    .map(([status, at]) => ({ status, at }));

const common = (r: Row) => ({
  id: r.id,
  status: r.status,
  skill: r.skill,
  vehicle: { make: r.carMake, model: r.carModel, year: r.carYear },
  problemDescription: r.problemDescription,
  preferredTime: r.preferredTime,
  location: { text: r.locationText, point: r.locationLat !== null && r.locationLng !== null ? { lat: r.locationLat, lng: r.locationLng } : null },
  contactPhone: r.contactPhone, // null unless the customer typed one
  declineReason: r.declineReason,
  timeline: timeline(r),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const customerView = (r: Row) => ({
  ...common(r),
  mechanic: { id: r.mechanic.id, name: r.mechanic.fullName, workshopName: r.mechanic.mechanicApplication?.workshopName ?? null, city: r.mechanic.mechanicApplication?.city ?? null },
  canCancel: r.status === "REQUESTED" || r.status === "ACCEPTED",
});
const mechanicView = (r: Row) => ({ ...common(r), customerName: r.customer.fullName });

const statusFilter = (q: unknown) => {
  if (q === undefined || q === "") return undefined;
  if (typeof q !== "string" || !STATUSES.includes(q as never)) throw new HttpError(400, "Invalid status filter.");
  return q as Status;
};

// =====================================================================
// Customer
// =====================================================================

router.post("/requests/mechanic", ...customerSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const b = req.body ?? {};
    const mechanicId = text(b.mechanicId, 64);
    const skill = optional(b.skill) ? null : text(b.skill, 80);
    const carMake = text(b.carMake, 60);
    const carModel = text(b.carModel, 60);
    const problemDescription = text(b.problemDescription, 1000);
    const locationText = text(b.locationText, 300);
    const preferredTime = optional(b.preferredTime) ? null : text(b.preferredTime, 100);
    const contactPhone = optional(b.contactPhone) ? null : text(b.contactPhone, 20);
    if (!mechanicId) throw new HttpError(400, "mechanicId is required.");
    if (!optional(b.skill) && !skill) throw new HttpError(400, "skill is invalid.");
    if (!carMake || !carModel) throw new HttpError(400, "Car make and model are required.");
    const y = b.carYear;
    if (!optional(y) && !(Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1)) throw new HttpError(400, "Car year is invalid.");
    if (!problemDescription || problemDescription.length < 10) throw new HttpError(400, "Describe the problem in at least 10 characters.");
    if (typeof b.problemDescription === "string" && b.problemDescription.trim().length > 1000) throw new HttpError(400, "The problem description is too long (1000 characters at most).");
    if (!locationText || locationText.length < 3) throw new HttpError(400, "Location is required.");
    if (!optional(b.contactPhone) && (!contactPhone || !phoneOk(contactPhone))) throw new HttpError(400, "The contact phone number is not valid.");
    const point = readPair(b, "locationLat", "locationLng", "Location");
    if ("error" in point) throw new HttpError(400, point.error);

    const id = await prisma.$transaction(async (tx) => {
      const mechanic = await tx.user.findFirst({
        where: { id: mechanicId, ...publicMechanic },
        select: { id: true, mechanicApplication: { select: { skills: { where: { status: "APPROVED" }, select: { name: true } } } } },
      });
      if (!mechanic) throw new HttpError(404, "Mechanic not found.");
      if (skill && !mechanic.mechanicApplication!.skills.some((s) => s.name === skill)) throw new HttpError(400, "This mechanic does not offer that skill.");
      const open = await tx.mechanicRequest.count({ where: { customerId: me.id, mechanicUserId: mechanic.id, status: { in: [...OPEN] } } });
      if (open >= MAX_OPEN_PER_MECHANIC) throw new HttpError(409, `You already have ${MAX_OPEN_PER_MECHANIC} open requests with this mechanic. Wait for one to finish or cancel one.`);
      const created = await tx.mechanicRequest.create({
        data: {
          customerId: me.id,
          mechanicUserId: mechanic.id,
          skill,
          carMake,
          carModel,
          carYear: optional(y) ? null : y,
          problemDescription,
          preferredTime,
          locationText,
          locationLat: round6(point.lat),
          locationLng: round6(point.lng),
          contactPhone,
        },
      });
      await log(tx, me.id, "MECHANIC_REQUEST_CREATED", created.id, { mechanicUserId: mechanic.id, skill });
      return created.id;
    });
    const row = await prisma.mechanicRequest.findUniqueOrThrow({ where: { id }, include });
    return res.status(201).json({ success: true, request: customerView(row) });
  } catch (e) {
    return send(res, e, "Mechanic request create error");
  }
});

router.get("/requests/mechanic/mine", ...customerSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const status = statusFilter(req.query.status);
    const rows = await prisma.mechanicRequest.findMany({ where: { customerId: me.id, ...(status ? { status } : {}) }, include, orderBy: { updatedAt: "desc" }, take: 100 });
    return res.json({ success: true, requests: rows.map(customerView) });
  } catch (e) {
    return send(res, e, "Mechanic requests list error");
  }
});

// The owner customer or the receiving mechanic; for anyone else the request does not exist.
router.get("/requests/mechanic/:id", requireAuth, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const row = await prisma.mechanicRequest.findFirst({ where: { id: String(req.params.id), OR: [{ customerId: me.id }, { mechanicUserId: me.id }] }, include });
    if (!row) throw new HttpError(404, "Request not found.");
    return res.json({ success: true, request: row.customerId === me.id ? customerView(row) : mechanicView(row) });
  } catch (e) {
    return send(res, e, "Mechanic request error");
  }
});

router.post("/requests/mechanic/:id/cancel", ...customerSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const id = String(req.params.id);
    if (!(await prisma.mechanicRequest.findFirst({ where: { id, customerId: me.id }, select: { id: true } }))) throw new HttpError(404, "Request not found.");
    await prisma.$transaction(async (tx) => {
      const done = await tx.mechanicRequest.updateMany({ where: { id, customerId: me.id, status: { in: ["REQUESTED", "ACCEPTED"] } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      if (!done.count) throw new HttpError(409, "This request can no longer be cancelled.");
      await log(tx, me.id, "MECHANIC_REQUEST_CANCELLED", id, { by: "CUSTOMER" });
    });
    return res.json({ success: true, request: customerView(await prisma.mechanicRequest.findUniqueOrThrow({ where: { id }, include })) });
  } catch (e) {
    return send(res, e, "Mechanic request cancel error");
  }
});

// =====================================================================
// Mechanic
// =====================================================================

router.get("/mechanic/requests", ...mechanicSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const status = statusFilter(req.query.status);
    const rows = await prisma.mechanicRequest.findMany({ where: { mechanicUserId: me.id, ...(status ? { status } : {}) }, include, orderBy: { updatedAt: "desc" }, take: 100 });
    return res.json({ success: true, requests: rows.map(mechanicView) });
  } catch (e) {
    return send(res, e, "Mechanic inbox error");
  }
});

/** from: the status the request must be in; stamp: the timestamp column to set. */
const STEPS = {
  accept: { from: "REQUESTED", to: "ACCEPTED", stamp: "acceptedAt" },
  decline: { from: "REQUESTED", to: "DECLINED", stamp: "declinedAt" },
  start: { from: "ACCEPTED", to: "IN_PROGRESS", stamp: "startedAt" },
  complete: { from: "IN_PROGRESS", to: "COMPLETED", stamp: "completedAt" },
} as const;

for (const [name, step] of Object.entries(STEPS)) {
  router.post(`/mechanic/requests/:id/${name}`, ...mechanicSide, async (req, res) => {
    try {
      const me = res.locals.authUser as { id: string };
      const id = String(req.params.id);
      const reason = name === "decline" ? (optional(req.body?.reason) ? null : text(req.body.reason, 500)) : null;
      if (!(await prisma.mechanicRequest.findFirst({ where: { id, mechanicUserId: me.id }, select: { id: true } }))) throw new HttpError(404, "Request not found.");
      // A mechanic who is no longer public (suspended, rejected, no approved skill) cannot work on requests.
      if (!(await prisma.user.findFirst({ where: { id: me.id, ...publicMechanic }, select: { id: true } }))) throw new HttpError(403, "Your mechanic account is not active, so you cannot answer requests.");
      await prisma.$transaction(async (tx) => {
        const done = await tx.mechanicRequest.updateMany({
          where: { id, mechanicUserId: me.id, status: step.from },
          data: { status: step.to, [step.stamp]: new Date(), ...(name === "decline" ? { declineReason: reason } : {}) },
        });
        if (!done.count) throw new HttpError(409, `This request is not in the right state to ${name} (it must be ${step.from}).`);
        await log(tx, me.id, `MECHANIC_REQUEST_${step.to}`, id, name === "decline" ? { reason } : {});
      });
      return res.json({ success: true, request: mechanicView(await prisma.mechanicRequest.findUniqueOrThrow({ where: { id }, include })) });
    } catch (e) {
      return send(res, e, `Mechanic request ${name} error`);
    }
  });
}

export default router;
