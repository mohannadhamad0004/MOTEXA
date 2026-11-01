// Tow dispatch: drivers of a tow company and who does which job. Rules (anything else is refused):
//  - A driver is FREE / BUSY / OFFLINE. OFFLINE is the driver's switch; BUSY is computed (a job ACCEPTED, EN_ROUTE or IN_PROGRESS);
//    FREE also needs a linked truck that may take work (APPROVED, AVAILABLE, not archived, no expired document).
//  - A request to the company is auto-assigned when exactly one driver is FREE; otherwise the owner assigns it.
//  - A request to a specific (FREE) driver goes straight to that driver; the company is notified and sees everything.
//  - The assigned driver accepts (claims his truck) or declines (back to the company), then: On the way -> Arrived -> Towing ->
//    Completed, or Cancel with a reason. Only he moves the job and sends its location.
//  - The owner can (re)assign while the job has not started (REQUESTED / ACCEPTED); a reassigned accepted job frees the old truck.
// Every change notifies the customer and the company (and the driver when a job is given to him).
import argon2 from "argon2";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { inBox } from "../geo.js";
import { expiredDocuments, noExpiredDocument } from "./truck-eligibility.js";
import { notify } from "./provider-onboarding.js";

export class DispatchError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;
export const WORKING = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] as const;
export const LIVE_MS = 2 * 60_000;
export type DriverStatus = "FREE" | "BUSY" | "OFFLINE" | "NO_TRUCK";

const truckReady = { verificationStatus: "APPROVED" as const, operationalStatus: "AVAILABLE" as const, archivedAt: null, ...noExpiredDocument() };
const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

/** FREE / BUSY / OFFLINE / NO_TRUCK (no truck that may take work), from what is stored. */
export async function driverStatus(db: Tx | typeof prisma, d: { id: string; offline: boolean; truckId: string | null }): Promise<DriverStatus> {
  if (d.offline) return "OFFLINE";
  if (await db.towRequest.count({ where: { driverId: d.id, status: { in: [...WORKING] } } })) return "BUSY";
  if (!d.truckId || !(await db.truck.count({ where: { id: d.truckId, ...truckReady } }))) return "NO_TRUCK";
  return "FREE";
}
export async function freeDrivers(db: Tx | typeof prisma, companyId: string) {
  const all = await db.towDriver.findMany({ where: { companyId, offline: false, user: { status: "ACTIVE" } }, include: { user: { select: { fullName: true } }, truck: true } });
  const out: typeof all = [];
  for (const d of all) if ((await driverStatus(db, d)) === "FREE") out.push(d);
  return out;
}

/** The driver's last point, with `stale` when older than 2 minutes (shown as "last seen"). */
export const livePoint = (d: { lastLat: number | null; lastLng: number | null; lastAt: Date | null } | null) =>
  d && d.lastLat !== null && d.lastLng !== null && d.lastAt ? { lat: d.lastLat, lng: d.lastLng, at: d.lastAt.toISOString(), stale: Date.now() - d.lastAt.getTime() > LIVE_MS } : null;

async function ownerOf(companyId: string) {
  return (await prisma.towCompanyProfile.findUniqueOrThrow({ where: { id: companyId }, select: { userId: true } })).userId;
}
const B = (en: string, ar: string) => [en, ar] as [string, string];

// ------------------------------------------------------------------ drivers (company owner)

const PASSWORD_RULE = "The password needs 8–128 characters with uppercase, lowercase, a number and a symbol.";
export const passwordOk = (p: unknown): p is string =>
  typeof p === "string" && p.length >= 8 && p.length <= 128 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^\w\s]/.test(p);
const phoneOk = (v: unknown): v is string => typeof v === "string" && /^\+?[0-9 ()-]{8,24}$/.test(v.trim());

async function ownCompany(ownerUserId: string) {
  const c = await prisma.towCompanyProfile.findUnique({ where: { userId: ownerUserId }, select: { id: true, userId: true, verificationStatus: true } });
  if (!c) throw new DispatchError(404, "No tow company is linked to this account.");
  return c;
}
async function ownTruck(companyId: string, truckId: unknown) {
  if (truckId === null || truckId === undefined || truckId === "") return null;
  if (typeof truckId !== "string") throw new DispatchError(400, "truckId is invalid.");
  const t = await prisma.truck.findFirst({ where: { id: truckId, companyId, archivedAt: null } });
  if (!t) throw new DispatchError(404, "Truck not found.");
  const other = await prisma.towDriver.findFirst({ where: { truckId: t.id }, select: { id: true } });
  return { truck: t, takenBy: other?.id ?? null };
}

/**
 * The owner adds a driver: a new TOW_DRIVER login (email + a password he sets, same rules as other accounts) or, with
 * `self: true`, himself ("I drive too", no new login).
 */
export async function addDriver(ownerUserId: string, b: any) {
  const c = await ownCompany(ownerUserId);
  if (c.verificationStatus !== "APPROVED") throw new DispatchError(403, "Your company must be approved before adding drivers.");
  const phone = typeof b?.phone === "string" ? b.phone.trim() : "";
  if (!phoneOk(phone)) throw new DispatchError(400, "A valid phone number is required.");
  const t = await ownTruck(c.id, b?.truckId);
  if (t?.takenBy) throw new DispatchError(409, "That truck already has a driver.");
  if (b?.self === true) {
    if (await prisma.towDriver.findUnique({ where: { userId: ownerUserId } })) throw new DispatchError(409, "You are already one of your drivers.");
    return prisma.towDriver.create({ data: { userId: ownerUserId, companyId: c.id, phone, truckId: t?.truck.id ?? null } });
  }
  const fullName = typeof b?.fullName === "string" ? b.fullName.trim() : "";
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  if (fullName.length < 3 || fullName.length > 80) throw new DispatchError(400, "The driver's full name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DispatchError(400, "A valid email is required (the driver signs in with it).");
  if (!passwordOk(b?.password)) throw new DispatchError(400, PASSWORD_RULE);
  if (await prisma.user.findUnique({ where: { email } })) throw new DispatchError(409, "An account with this email already exists.");
  const passwordHash = await argon2.hash(b.password, { type: argon2.argon2id });
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, fullName, role: "TOW_DRIVER", status: "ACTIVE", passwordHash } });
    const d = await tx.towDriver.create({ data: { userId: user.id, companyId: c.id, phone, truckId: t?.truck.id ?? null } });
    await tx.auditLog.create({ data: { actorId: ownerUserId, action: "TOW_DRIVER_ADDED", targetId: d.id, details: { companyId: c.id } } });
    return d;
  });
}

/** The owner changes a driver's phone / truck / offline switch. */
export async function updateDriver(ownerUserId: string, driverId: string, b: any) {
  const c = await ownCompany(ownerUserId);
  const d = await prisma.towDriver.findFirst({ where: { id: driverId, companyId: c.id } });
  if (!d) throw new DispatchError(404, "Driver not found.");
  const data: Prisma.TowDriverUncheckedUpdateInput = {};
  if (b?.phone !== undefined) {
    if (!phoneOk(b.phone)) throw new DispatchError(400, "A valid phone number is required.");
    data.phone = b.phone.trim();
  }
  if (b?.truckId !== undefined) {
    const t = await ownTruck(c.id, b.truckId);
    if (t?.takenBy && t.takenBy !== d.id) throw new DispatchError(409, "That truck already has a driver.");
    if (await prisma.towRequest.count({ where: { driverId: d.id, status: { in: [...WORKING] } } })) throw new DispatchError(409, "Change the truck after the current job.");
    data.truckId = t?.truck.id ?? null;
  }
  if (b?.offline !== undefined) {
    if (typeof b.offline !== "boolean") throw new DispatchError(400, "offline must be true or false.");
    data.offline = b.offline;
  }
  return prisma.towDriver.update({ where: { id: d.id }, data });
}

// ------------------------------------------------------------------ new requests

/** Inside the request's creation: a specific driver must be one of the company's FREE drivers. */
export async function checkRequestedDriver(tx: Tx, companyId: string, driverId: string) {
  const d = await tx.towDriver.findFirst({ where: { id: driverId, companyId, user: { status: "ACTIVE" } } });
  if (!d || (await driverStatus(tx, d)) !== "FREE") throw new DispatchError(409, "This driver is not free right now. Choose another driver or the company.");
  return d;
}

/** After a request is created: route it (specific driver / the only free driver / the company) and notify. */
export async function routeNewRequest(requestId: string) {
  const r = await prisma.towRequest.findUniqueOrThrow({ where: { id: requestId }, include: { company: { select: { userId: true } } } });
  let driverId = r.requestedDriverId;
  if (!driverId) {
    const free = await freeDrivers(prisma, r.companyId);
    if (free.length === 1) {
      driverId = free[0].id;
      await prisma.towRequest.updateMany({ where: { id: r.id, status: "REQUESTED", driverId: null }, data: { driverId } });
    }
  }
  const driverUser = driverId ? (await prisma.towDriver.findUnique({ where: { id: driverId }, select: { userId: true } }))?.userId : null;
  await notify([r.company.userId], B("New tow request", "طلب سحب جديد"), r.requestedDriverId ? B("A customer asked one of your drivers directly.", "طلب زبون أحد سائقيك مباشرة.") : driverId ? B("It was given to your only free driver.", "أُسند إلى سائقك المتاح الوحيد.") : B("Assign it to a free driver.", "أسنده إلى سائق متاح."));
  if (driverUser && driverUser !== r.company.userId) await notify([driverUser], B("New tow job", "مهمة سحب جديدة"), B("Open MOTEXA to accept or decline.", "افتح موتكسا للقبول أو الرفض."));
}

// ------------------------------------------------------------------ company: assign / transfer

export async function assign(ownerUserId: string, requestId: string, driverId: string) {
  const c = await ownCompany(ownerUserId);
  const r = await prisma.towRequest.findFirst({ where: { id: requestId, companyId: c.id } });
  if (!r) throw new DispatchError(404, "Request not found.");
  if (r.status !== "REQUESTED" && r.status !== "ACCEPTED") throw new DispatchError(409, "A job can be (re)assigned only before the driver is on the way.");
  if (r.driverId === driverId) return r;
  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.towDriver.findFirst({ where: { id: driverId, companyId: c.id, user: { status: "ACTIVE" } } });
    if (!d) throw new DispatchError(404, "Driver not found.");
    if ((await driverStatus(tx, d)) !== "FREE") throw new DispatchError(409, "This driver is not free right now.");
    // an accepted job goes back to "waiting for the driver": the old truck is released, the new driver accepts with his own
    const moved = await tx.towRequest.updateMany({
      where: { id: r.id, status: r.status, driverId: r.driverId },
      data: { driverId: d.id, status: "REQUESTED", acceptedAt: null, assignedTruckId: null, assignedTruckType: null, assignedTruckMake: null, assignedTruckModel: null, assignedTruckYear: null },
    });
    if (!moved.count) throw new DispatchError(409, "The job changed meanwhile. Refresh and try again.");
    if (r.status === "ACCEPTED") await releaseTruck(tx, r.assignedTruckId);
    await tx.auditLog.create({ data: { actorId: ownerUserId, action: "TOW_JOB_ASSIGNED", targetId: r.id, details: { from: r.driverId, to: d.id } } });
    return { d, row: await tx.towRequest.findUniqueOrThrow({ where: { id: r.id } }) };
  });
  if (updated.d.userId !== ownerUserId) await notify([updated.d.userId], B("New tow job", "مهمة سحب جديدة"), B("Your company gave you a job. Accept or decline it.", "أسندت إليك شركتك مهمة. اقبلها أو ارفضها."));
  await notify([r.customerId], B("A driver was assigned", "تم تعيين سائق"), B("Your tow request has a driver now.", "أصبح لطلب السحب سائق."));
  return updated.row;
}

/** Same rule as the company endpoints: an ended job gives its truck back (AVAILABLE only if it may still work). */
export async function releaseTruck(tx: Tx, truckId: string | null) {
  if (!truckId) return;
  const t = await tx.truck.findUnique({ where: { id: truckId }, select: { verificationStatus: true, archivedAt: true, files: { select: { purpose: true, expiresAt: true } } } });
  if (!t) return;
  const ok = t.verificationStatus === "APPROVED" && !t.archivedAt && expiredDocuments(t.files).length === 0;
  await tx.truck.updateMany({ where: { id: truckId, operationalStatus: "BUSY" }, data: { operationalStatus: ok ? "AVAILABLE" : "OUT_OF_SERVICE" } });
}

// ------------------------------------------------------------------ driver: his jobs

export async function myDriver(userId: string) {
  const d = await prisma.towDriver.findUnique({ where: { userId }, include: { company: { select: { id: true, userId: true, companyName: true, verificationStatus: true } }, truck: true, user: { select: { fullName: true, status: true } } } });
  if (!d || d.user.status !== "ACTIVE") throw new DispatchError(403, "Driver access required.");
  if (d.company.verificationStatus !== "APPROVED") throw new DispatchError(403, "Your company is not approved.");
  return d;
}
async function myJob(userId: string, requestId: string) {
  const d = await myDriver(userId);
  const r = await prisma.towRequest.findFirst({ where: { id: requestId, driverId: d.id } });
  if (!r) throw new DispatchError(404, "Job not found.");
  return { d, r };
}
const tell = async (r: { customerId: string; companyId: string }, driverUserId: string, title: [string, string], body: [string, string]) => {
  const owner = await ownerOf(r.companyId);
  await notify([r.customerId, ...(owner !== driverUserId ? [owner] : [])], title, body);
};

export async function driverAccept(userId: string, requestId: string) {
  const { d, r } = await myJob(userId, requestId);
  if (r.status !== "REQUESTED") throw new DispatchError(409, "This job is no longer waiting for you.");
  if (!d.truckId) throw new DispatchError(409, "You have no truck linked. Ask your company to link one.");
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.truck.updateMany({ where: { id: d.truckId!, companyId: d.companyId, ...truckReady }, data: { operationalStatus: "BUSY" } });
    if (!claimed.count) throw new DispatchError(409, "Your truck can't take work right now (not available, not approved or a document expired).");
    const t = await tx.truck.findUniqueOrThrow({ where: { id: d.truckId! } });
    const moved = await tx.towRequest.updateMany({
      where: { id: r.id, driverId: d.id, status: "REQUESTED" },
      data: { status: "ACCEPTED", acceptedAt: new Date(), assignedTruckId: t.id, assignedTruckType: t.truckType, assignedTruckMake: t.make, assignedTruckModel: t.model, assignedTruckYear: t.year },
    });
    if (!moved.count) throw new DispatchError(409, "This job is no longer waiting for you."); // rolls the truck claim back
    await tx.auditLog.create({ data: { actorId: userId, action: "TOW_REQUEST_ACCEPTED", targetId: r.id, details: { driverId: d.id, truckId: t.id } } });
  });
  await tell(r, userId, B("Your tow is accepted", "تم قبول طلب السحب"), B(`${firstName(d.user.fullName)} is your driver.`, `${firstName(d.user.fullName)} هو سائقك.`));
}

export async function driverDecline(userId: string, requestId: string, reason: unknown) {
  const { d, r } = await myJob(userId, requestId);
  const why = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null;
  if (!why) throw new DispatchError(400, "Give your company a reason.");
  const moved = await prisma.towRequest.updateMany({ where: { id: r.id, driverId: d.id, status: "REQUESTED" }, data: { driverId: null } });
  if (!moved.count) throw new DispatchError(409, "Only a job you have not accepted yet can be declined.");
  await prisma.auditLog.create({ data: { actorId: userId, action: "TOW_JOB_DRIVER_DECLINED", targetId: r.id, details: { driverId: d.id, reason: why } } });
  const owner = await ownerOf(r.companyId);
  if (owner !== userId) await notify([owner], B("A driver declined a job", "رفض سائق مهمة"), B(`${firstName(d.user.fullName)}: ${why}. Assign it to another driver.`, `${firstName(d.user.fullName)}: ${why}. أسندها إلى سائق آخر.`));
}

export type DriverStep = "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED";
const STEP: Record<DriverStep, { from: "ACCEPTED" | "EN_ROUTE" | "IN_PROGRESS"; title: [string, string] }> = {
  EN_ROUTE: { from: "ACCEPTED", title: B("Your driver is on the way", "سائقك في الطريق") },
  ARRIVED: { from: "EN_ROUTE", title: B("Your driver has arrived", "وصل سائقك") },
  IN_PROGRESS: { from: "EN_ROUTE", title: B("Towing started", "بدأ السحب") },
  COMPLETED: { from: "IN_PROGRESS", title: B("Tow completed", "اكتمل السحب") },
};
export async function driverMove(userId: string, requestId: string, to: DriverStep) {
  const step = STEP[to];
  if (!step) throw new DispatchError(400, "status must be EN_ROUTE, ARRIVED, IN_PROGRESS or COMPLETED.");
  const { d, r } = await myJob(userId, requestId);
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const data: Prisma.TowRequestUpdateManyMutationInput =
      to === "ARRIVED" ? { arrivedAt: now } : to === "EN_ROUTE" ? { status: "EN_ROUTE", enRouteAt: now } : to === "IN_PROGRESS" ? { status: "IN_PROGRESS", inProgressAt: now } : { status: "COMPLETED", completedAt: now };
    const moved = await tx.towRequest.updateMany({ where: { id: r.id, driverId: d.id, status: step.from, ...(to === "ARRIVED" ? { arrivedAt: null } : {}) }, data });
    if (!moved.count) throw new DispatchError(409, `This job can't move to ${to.toLowerCase().replace("_", " ")} now.`);
    if (to === "COMPLETED") await releaseTruck(tx, r.assignedTruckId);
    await tx.auditLog.create({ data: { actorId: userId, action: `TOW_REQUEST_${to}`, targetId: r.id, details: { driverId: d.id } } });
  });
  await tell(r, userId, step.title, B(`${firstName(d.user.fullName)} updated your tow.`, `حدّث ${firstName(d.user.fullName)} طلب السحب.`));
}

export async function driverCancel(userId: string, requestId: string, reason: unknown) {
  const { d, r } = await myJob(userId, requestId);
  const why = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null;
  if (!why) throw new DispatchError(400, "A reason is required to cancel.");
  await prisma.$transaction(async (tx) => {
    const moved = await tx.towRequest.updateMany({ where: { id: r.id, driverId: d.id, status: { in: ["ACCEPTED", "EN_ROUTE"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "COMPANY", cancelReason: why } });
    if (!moved.count) throw new DispatchError(409, "Only a job that is accepted or on the way can be cancelled.");
    await releaseTruck(tx, r.assignedTruckId);
    await tx.auditLog.create({ data: { actorId: userId, action: "TOW_REQUEST_CANCELLED", targetId: r.id, details: { by: "DRIVER", driverId: d.id, reason: why } } });
  });
  await tell(r, userId, B("Your tow was cancelled", "تم إلغاء طلب السحب"), B(why, why));
}

/** The driver's position while his job is active and his job screen is open (ignored more often than every 5 s). */
export async function driverPing(userId: string, requestId: string, lat: unknown, lng: unknown) {
  if (typeof lat !== "number" || typeof lng !== "number" || !inBox(lat, lng)) throw new DispatchError(400, "Invalid location.");
  const { d, r } = await myJob(userId, requestId);
  if (!WORKING.includes(r.status as never)) throw new DispatchError(409, "Location is shared only during an active job.");
  if (d.lastAt && Date.now() - d.lastAt.getTime() < 5000) return;
  await prisma.towDriver.update({ where: { id: d.id }, data: { lastLat: Math.round(lat * 1e5) / 1e5, lastLng: Math.round(lng * 1e5) / 1e5, lastAt: new Date() } });
}

export async function setOffline(userId: string, offline: unknown) {
  if (typeof offline !== "boolean") throw new DispatchError(400, "offline must be true or false.");
  const d = await myDriver(userId);
  return prisma.towDriver.update({ where: { id: d.id }, data: { offline } });
}
