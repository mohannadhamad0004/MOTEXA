import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { CITY_CENTRES, haversineKm, readPair } from "../geo.js";
import { requireAuth, requireCustomer } from "../middleware/auth.middleware.js";
import { errorBody } from "../services/error-codes.js";
import { notify } from "../services/provider-onboarding.js";
import { DUTY_STALE_MS, dutyPoint } from "../services/presence.js";
import { JOB_ACTIVE } from "../services/garage-staff.js";
import { publicMechanic, skillsOf } from "./catalog-mechanics.routes.js";

// Mechanic service requests. A customer asks ONE mechanic (independent, or a garage mechanic) or a GARAGE (its owner assigns one of his
// mechanics: services/garage-staff.ts); the mechanic accepts, (on site) goes on the way and arrives, starts and completes.
//  - /api/requests/mechanic/*  CUSTOMER (GET /:id is also open to the receiving mechanic)
//  - /api/mechanic/requests/*  MECHANIC, only the requests given to him
// The garage owner's endpoints are in garages.routes.ts, the mechanics admin's in mechanics-admin.routes.ts (same views).
//
// State machine (anything else is 409). Every transition is one atomic conditional update + an AuditLog row + notifications.
//   REQUESTED -> ACCEPTED (mechanic) | DECLINED (independent mechanic, or the garage owner) | back to the garage (a garage mechanic
//                declines: the owner assigns someone else)
//   ACCEPTED  -> EN_ROUTE -> ARRIVED -> IN_PROGRESS   on site (the mechanic comes to the customer)
//   ACCEPTED  -> IN_PROGRESS                          workshop visit (and requests older than the service mode)
//   IN_PROGRESS -> COMPLETED
//   REQUESTED | ACCEPTED -> CANCELLED (customer)
// PRIVACY
//  - Before accepting (and after the job): the mechanic / garage owner / admin get the customer's FIRST name, the car, the problem, the
//    nearest city and the pin rounded to 0.01 deg (~1 km), marked approximate; never the address or the phone.
//  - During the active job (ACCEPTED .. IN_PROGRESS) the assigned mechanic and his garage owner get the exact address, pin and the phone
//    the customer typed; the app draws the route to it.
//  - The customer sees the mechanic's live point ONLY on his own request while the mechanic is on the way / arrived. The mechanic's
//    path (MechanicJobTrail) is kept only during the active job and deleted with his live point when the job ends.
//  - The customer never sees the mechanic's phone, email or credentials; a garage mechanic is shown by first name with his garage.
const router = Router();

const OPEN = ["REQUESTED", ...JOB_ACTIVE] as const;
const MAX_OPEN_PER_PROVIDER = 3;
const STATUSES = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED", "DECLINED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];
const MODES = ["ON_SITE", "WORKSHOP"] as const;

class HttpError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const optional = (v: unknown) => v === undefined || v === null || v === "";
const send = (res: any, e: unknown, label: string) => {
  if (e instanceof HttpError || (e instanceof Error && "code" in e && typeof (e as { code: unknown }).code === "number")) return res.status((e as HttpError).code).json(errorBody(e.message));
  console.error(`${label}:`, e);
  return res.status(500).json(errorBody("Internal server error."));
};
const log = (tx: Prisma.TransactionClient, actorId: string, action: string, targetId: string, details: object = {}) =>
  tx.auditLog.create({ data: { actorId, action, targetId, details } });
const phoneOk = (v: string) => /^[0-9+()\-\s]{6,20}$/.test(v) && v.replace(/\D/g, "").length >= 5;
const round6 = (n: number | null) => (n === null ? null : Math.round(n * 1e6) / 1e6);
const B = (en: string, ar: string) => [en, ar] as [string, string];
const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

const customerSide = [requireAuth, requireCustomer, express.json()];
const mechanicSide = [
  requireAuth,
  (_req: any, res: any, next: any) => (res.locals.authUser?.role === "MECHANIC" ? next() : res.status(403).json({ success: false, message: "Mechanic access required." })),
  express.json(),
];

/** Who may work on requests: an independent public mechanic, or an APPROVED garage mechanic of an APPROVED garage (account ACTIVE). */
export const workingMechanic: Prisma.UserWhereInput = {
  role: "MECHANIC",
  status: "ACTIVE",
  OR: [{ mechanicProfile: { is: { verificationStatus: "VERIFIED" } } }, { garageMechanic: { is: { approval: "APPROVED", garage: { verificationStatus: "APPROVED" } } } }],
};

export const include = {
  customer: { select: { id: true, fullName: true } }, // never the email
  mechanic: { select: { id: true, fullName: true, mechanicProfile: { select: { workshopName: true, city: true } }, garageMechanic: { select: { id: true } } } }, // never phone/email
  garage: { select: { id: true, garageName: true, garageNameAr: true, city: true, userId: true } },
} satisfies Prisma.MechanicRequestInclude;
export type Row = Prisma.MechanicRequestGetPayload<{ include: typeof include }>;

const timeline = (r: Row) =>
  (
    [
      ["REQUESTED", r.requestedAt],
      ["ACCEPTED", r.acceptedAt],
      ["DECLINED", r.declinedAt],
      ["EN_ROUTE", r.enRouteAt],
      ["ARRIVED", r.arrivedAt],
      ["IN_PROGRESS", r.startedAt],
      ["COMPLETED", r.completedAt],
      ["CANCELLED", r.cancelledAt],
    ] as [string, Date | null][]
  )
    .filter(([, at]) => !!at)
    .map(([status, at]) => ({ status, at }));

const livePoint = (r: Row) => (r.liveLat !== null && r.liveLng !== null && r.liveAt ? { lat: r.liveLat, lng: r.liveLng, at: r.liveAt.toISOString(), stale: Date.now() - r.liveAt.getTime() > DUTY_STALE_MS } : null);

const common = (r: Row) => ({
  id: r.id,
  status: r.status,
  serviceMode: r.serviceMode,
  skill: r.skill,
  vehicle: { make: r.carMake, model: r.carModel, year: r.carYear },
  problemDescription: r.problemDescription,
  preferredTime: r.preferredTime,
  location: { text: r.locationText, point: r.locationLat !== null && r.locationLng !== null ? { lat: r.locationLat, lng: r.locationLng } : null },
  contactPhone: r.contactPhone, // null unless the customer typed one
  garage: r.garage ? { id: r.garage.id, name: r.garage.garageName, nameAr: r.garage.garageNameAr } : null,
  assignedAt: r.assignedAt,
  declineReason: r.declineReason,
  cancelReason: r.cancelReason, // set when MOTEXA (admin) cancelled: both sides see why
  cancelledBy: r.cancelledBy,
  timeline: timeline(r),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** the customer sees the mechanic's live point only while he is on the way / has arrived (on his own request) */
export const FOLLOW = new Set(["EN_ROUTE", "ARRIVED"]);
export const customerView = (r: Row) => ({
  ...common(r),
  mechanic: r.mechanic
    ? r.mechanic.garageMechanic
      ? { id: r.mechanic.id, name: firstName(r.mechanic.fullName), workshopName: r.garage?.garageName ?? null, city: r.garage?.city ?? null, garageMechanic: true }
      : { id: r.mechanic.id, name: r.mechanic.fullName, workshopName: r.mechanic.mechanicProfile?.workshopName || null, city: r.mechanic.mechanicProfile?.city ?? null, garageMechanic: false }
    : null,
  live: FOLLOW.has(r.status) ? livePoint(r) : null,
  canCancel: r.status === "REQUESTED" || r.status === "ACCEPTED",
});
export const REVEALED = new Set<string>(JOB_ACTIVE); // the active job only
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Nearest service city to a point (within 30 km), for the "area" a mechanic sees before accepting. */
export const nearestCity = (p: { lat: number; lng: number }) => {
  let best: string | null = null, km = 30;
  for (const [name, c] of Object.entries(CITY_CENTRES)) { const d = haversineKm(p, c); if (d < km) { km = d; best = name; } }
  return best;
};
/** The mechanic's view (also the garage owner's and the admin's location rule). */
export const mechanicView = (r: Row) => {
  // Name: first name only until a mechanic accepts; full name from then on (kept in history after the job ends).
  const customerName = r.acceptedAt ? r.customer.fullName : firstName(r.customer.fullName);
  const view = { ...common(r), customerName, mechanicName: r.mechanic?.fullName ?? null, mechanicUserId: r.mechanicUserId, live: REVEALED.has(r.status) ? livePoint(r) : null };
  if (REVEALED.has(r.status) && r.acceptedAt) return { ...view, location: { ...view.location, approximate: false } };
  const p = view.location.point;
  return {
    ...view,
    location: { text: null, area: p ? nearestCity(p) : null, point: p ? { lat: round2(p.lat), lng: round2(p.lng) } : null, approximate: true },
    contactPhone: null,
  };
};

const statusFilter = (q: unknown) => {
  if (q === undefined || q === "") return undefined;
  if (typeof q !== "string" || !STATUSES.includes(q as never)) throw new HttpError(400, "Invalid status filter.");
  return q as Status;
};

/** The job ended (completed, declined, cancelled, reassigned): its path and the live point are deleted (only the dates stay). */
export async function endMechanicTrail(tx: Prisma.TransactionClient, requestId: string) {
  await tx.mechanicJobTrail.deleteMany({ where: { requestId } });
  await tx.mechanicRequest.update({ where: { id: requestId }, data: { liveLat: null, liveLng: null, liveAt: null } });
}

/** The customer and, for a garage request, the owner (minus the actor) */
async function tellCustomerSide(r: { customerId: string; garageId: string | null }, actorId: string, title: [string, string], body: [string, string]) {
  await notify([r.customerId], title, body);
  if (r.garageId) {
    const owner = (await prisma.garageProfile.findUnique({ where: { id: r.garageId }, select: { userId: true } }))?.userId;
    if (owner && owner !== actorId) await notify([owner], title, body);
  }
}

// =====================================================================
// Customer
// =====================================================================

// Body: mechanicId (a public independent mechanic or an approved garage mechanic) OR garageId (an approved garage), serviceMode
// ON_SITE | WORKSHOP (a pin is required on site), skill?, car, problem, locationText, locationLat/Lng, preferredTime?, contactPhone?
router.post("/requests/mechanic", ...customerSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const b = req.body ?? {};
    const mechanicId = text(b.mechanicId, 64);
    const garageId = text(b.garageId, 64);
    const skill = optional(b.skill) ? null : text(b.skill, 80);
    const carMake = text(b.carMake, 60);
    const carModel = text(b.carModel, 60);
    const problemDescription = text(b.problemDescription, 1000);
    const locationText = text(b.locationText, 300);
    const preferredTime = optional(b.preferredTime) ? null : text(b.preferredTime, 100);
    const contactPhone = optional(b.contactPhone) ? null : text(b.contactPhone, 20);
    if (!mechanicId === !garageId) throw new HttpError(400, "Choose one mechanic or one garage.");
    if (!MODES.includes(b.serviceMode)) throw new HttpError(400, "Choose where the work happens: on site (the mechanic comes to you) or at the workshop.");
    const serviceMode = b.serviceMode as (typeof MODES)[number];
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
    // on site the mechanic drives to the customer: his current GPS position (or a pin he set) is required
    if (serviceMode === "ON_SITE" && (point.lat === null || point.lng === null)) throw new HttpError(400, "For an on-site visit, share your current location or set it on the map.");

    const created = await prisma.$transaction(async (tx) => {
      let target: { mechanicUserId: string | null; garageId: string | null; ownerUserId: string | null };
      if (mechanicId) {
        const m = await tx.user.findFirst({
          where: { id: mechanicId, OR: [{ ...publicMechanic }, { ...workingMechanic, garageMechanic: { is: { approval: "APPROVED", garage: { verificationStatus: "APPROVED" } } } }] },
          select: { id: true, mechanicProfile: { select: { specializations: true, verificationStatus: true } }, garageMechanic: { select: { skills: true, garageId: true, garage: { select: { userId: true } } } } },
        });
        if (!m) throw new HttpError(404, "Mechanic not found.");
        const gm = m.garageMechanic;
        const skills = gm ? gm.skills : skillsOf(m.mechanicProfile!.specializations);
        if (skill && !skills.includes(skill)) throw new HttpError(400, "This mechanic does not offer that skill.");
        target = { mechanicUserId: m.id, garageId: gm?.garageId ?? null, ownerUserId: gm?.garage.userId ?? null };
      } else {
        const g = await tx.garageProfile.findFirst({ where: { id: garageId!, verificationStatus: "APPROVED", user: { status: "ACTIVE" } }, select: { id: true, userId: true, services: true } });
        if (!g) throw new HttpError(404, "Garage not found.");
        if (skill && !g.services.includes(skill)) throw new HttpError(400, "This garage does not offer that service.");
        target = { mechanicUserId: null, garageId: g.id, ownerUserId: g.userId };
      }
      const same = target.mechanicUserId ? { mechanicUserId: target.mechanicUserId } : { garageId: target.garageId!, mechanicUserId: null };
      const open = await tx.mechanicRequest.count({ where: { customerId: me.id, ...same, status: { in: [...OPEN] } } });
      if (open >= MAX_OPEN_PER_PROVIDER) throw new HttpError(409, `You already have ${MAX_OPEN_PER_PROVIDER} open requests here. Wait for one to finish or cancel one.`);
      const row = await tx.mechanicRequest.create({
        data: {
          customerId: me.id,
          mechanicUserId: target.mechanicUserId,
          garageId: target.garageId,
          assignedAt: target.mechanicUserId && target.garageId ? new Date() : null,
          serviceMode,
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
      await log(tx, me.id, "MECHANIC_REQUEST_CREATED", row.id, { mechanicUserId: target.mechanicUserId, garageId: target.garageId, skill, serviceMode });
      return { id: row.id, ...target };
    });
    if (created.mechanicUserId) await notify([created.mechanicUserId], B("New mechanic request", "طلب ميكانيكي جديد"), B("Open MOTEXA to accept or decline it.", "افتح موتكسا للقبول أو الرفض."));
    if (created.ownerUserId)
      await notify([created.ownerUserId], B("New request for your garage", "طلب جديد لكراجك"), created.mechanicUserId ? B("A customer asked one of your mechanics directly.", "طلب زبون أحد ميكانيكييك مباشرة.") : B("Assign it to one of your mechanics.", "أسنده إلى أحد ميكانيكييك."));
    const row = await prisma.mechanicRequest.findUniqueOrThrow({ where: { id: created.id }, include });
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
    const r = await prisma.mechanicRequest.findFirst({ where: { id, customerId: me.id }, select: { id: true, mechanicUserId: true, garageId: true, customerId: true } });
    if (!r) throw new HttpError(404, "Request not found.");
    await prisma.$transaction(async (tx) => {
      const done = await tx.mechanicRequest.updateMany({ where: { id, customerId: me.id, status: { in: ["REQUESTED", "ACCEPTED"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "CUSTOMER" } });
      if (!done.count) throw new HttpError(409, "This request can no longer be cancelled.");
      await endMechanicTrail(tx, id);
      await log(tx, me.id, "MECHANIC_REQUEST_CANCELLED", id, { by: "CUSTOMER" });
    });
    if (r.mechanicUserId) await notify([r.mechanicUserId], B("A request was cancelled", "تم إلغاء طلب"), B("The customer cancelled the request.", "ألغى الزبون الطلب."));
    await tellCustomerSide({ customerId: me.id, garageId: r.garageId }, me.id, B("A request was cancelled", "تم إلغاء طلب"), B("The customer cancelled the request.", "ألغى الزبون الطلب.")).catch(() => undefined);
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

/** from: the statuses the request may be in; stamp: the timestamp column to set; onSite: only for an ON_SITE job. */
const STEPS: Record<string, { from: Status[]; to: Status; stamp: string; onSite?: boolean; title: [string, string]; body: [string, string] }> = {
  accept: { from: ["REQUESTED"], to: "ACCEPTED", stamp: "acceptedAt", title: B("Your request was accepted", "تم قبول طلبك"), body: B("The mechanic accepted your request.", "قبل الميكانيكي طلبك.") },
  "en-route": { from: ["ACCEPTED"], to: "EN_ROUTE", stamp: "enRouteAt", onSite: true, title: B("Your mechanic is on the way", "الميكانيكي في الطريق إليك"), body: B("Open the request to follow him on the map.", "افتح الطلب لتتابعه على الخريطة.") },
  arrived: { from: ["EN_ROUTE"], to: "ARRIVED", stamp: "arrivedAt", onSite: true, title: B("Your mechanic has arrived", "وصل الميكانيكي"), body: B("The mechanic is at your location.", "الميكانيكي في موقعك.") },
  start: { from: ["ACCEPTED", "ARRIVED"], to: "IN_PROGRESS", stamp: "startedAt", title: B("Work started", "بدأ العمل"), body: B("The mechanic started working on your car.", "بدأ الميكانيكي العمل على سيارتك.") },
  complete: { from: ["IN_PROGRESS"], to: "COMPLETED", stamp: "completedAt", title: B("Work completed", "اكتمل العمل"), body: B("The mechanic marked the job as completed.", "أنهى الميكانيكي المهمة.") },
  decline: { from: ["REQUESTED"], to: "DECLINED", stamp: "declinedAt", title: B("Request declined", "تم رفض الطلب"), body: B("The mechanic cannot take this request.", "لا يستطيع الميكانيكي قبول هذا الطلب.") },
};
const ENDS = new Set<Status>(["COMPLETED", "DECLINED", "CANCELLED"]);

const ownRequest = async (me: string, id: string) => {
  const r = await prisma.mechanicRequest.findFirst({ where: { id, mechanicUserId: me } });
  if (!r) throw new HttpError(404, "Request not found.");
  // a mechanic who is no longer allowed to work (suspended, account not active, garage not approved) cannot answer
  if (!(await prisma.user.findFirst({ where: { id: me, ...workingMechanic }, select: { id: true } }))) throw new HttpError(403, "Your mechanic account is not active, so you cannot answer requests.");
  return r;
};

for (const [name, step] of Object.entries(STEPS)) {
  router.post(`/mechanic/requests/:id/${name}`, ...mechanicSide, async (req, res) => {
    try {
      const me = res.locals.authUser as { id: string };
      const id = String(req.params.id);
      const reason = name === "decline" ? (optional(req.body?.reason) ? null : text(req.body.reason, 500)) : null;
      const r = await ownRequest(me.id, id);
      if (step.onSite && r.serviceMode !== "ON_SITE") throw new HttpError(409, "Only an on-site job has the On the way and Arrived steps.");
      // on site, the work starts after arriving; a workshop visit (or an older request) starts straight after accepting
      const from = name === "start" ? (r.serviceMode === "ON_SITE" ? (["ARRIVED"] as Status[]) : (["ACCEPTED"] as Status[])) : step.from;
      // a garage mechanic who declines gives the request back to his garage (the owner assigns someone else)
      const backToGarage = name === "decline" && !!r.garageId && !!(await prisma.garageMechanic.findUnique({ where: { userId: me.id }, select: { id: true } }));
      await prisma.$transaction(async (tx) => {
        const done = await tx.mechanicRequest.updateMany({
          where: { id, mechanicUserId: me.id, status: { in: from } },
          data: backToGarage ? { mechanicUserId: null, assignedAt: null } : { status: step.to, [step.stamp]: new Date(), ...(name === "decline" ? { declineReason: reason } : {}) },
        });
        if (!done.count) throw new HttpError(409, `This request is not in the right state to ${name.replace("-", " ")} (it must be ${from.join(" or ")}).`);
        if (ENDS.has(step.to) && !backToGarage) await endMechanicTrail(tx, id);
        await log(tx, me.id, backToGarage ? "MECHANIC_REQUEST_RETURNED" : `MECHANIC_REQUEST_${step.to}`, id, name === "decline" ? { reason } : {});
      });
      if (backToGarage) {
        const owner = (await prisma.garageProfile.findUnique({ where: { id: r.garageId! }, select: { userId: true } }))?.userId;
        if (owner) await notify([owner], B("A mechanic gave a request back", "أعاد ميكانيكي طلبًا"), B("Assign it to another mechanic.", "أسنده إلى ميكانيكي آخر."));
      } else await tellCustomerSide(r, me.id, step.title, reason ? [reason, reason] : step.body);
      return res.json({ success: true, request: mechanicView(await prisma.mechanicRequest.findUniqueOrThrow({ where: { id }, include })) });
    } catch (e) {
      return send(res, e, `Mechanic request ${name} error`);
    }
  });
}

/**
 * The assigned mechanic's position during an ON-SITE job (sent every ~10 s while his job screen is open, foreground only; ignored more
 * often than every 5 s): stored as the request's live point + a short path (newest 300), both deleted when the job ends.
 */
router.post("/mechanic/requests/:id/location", ...mechanicSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const p = dutyPoint(req.body?.lat, req.body?.lng);
    if (!p) throw new HttpError(400, "Invalid location.");
    const r = await ownRequest(me.id, String(req.params.id));
    if (r.serviceMode !== "ON_SITE" || !(JOB_ACTIVE as readonly string[]).includes(r.status)) throw new HttpError(409, "Location is shared only during an active on-site job.");
    if (r.liveAt && Date.now() - r.liveAt.getTime() < 5000) return res.json({ success: true, stored: false });
    await prisma.$transaction([
      prisma.mechanicRequest.update({ where: { id: r.id }, data: { liveLat: p.lat, liveLng: p.lng, liveAt: new Date() } }),
      prisma.mechanicJobTrail.create({ data: { requestId: r.id, lat: p.lat, lng: p.lng } }),
    ]);
    const extra = await prisma.mechanicJobTrail.findMany({ where: { requestId: r.id }, orderBy: { at: "desc" }, skip: 300, select: { id: true } });
    if (extra.length) await prisma.mechanicJobTrail.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    return res.json({ success: true, stored: true });
  } catch (e) {
    return send(res, e, "Mechanic job location error");
  }
});

export default router;
