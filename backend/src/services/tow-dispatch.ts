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
import { haversineKm, inBox } from "../geo.js";
import { expiredDocuments, noExpiredDocument } from "./truck-eligibility.js";
import { adminIds, notify } from "./provider-onboarding.js";
import { randomBytes } from "node:crypto";
import { parseUpload, removeStoredFile, storeFile } from "../uploads/providerFiles.js";
import { createPasswordResetStore, requestPasswordReset } from "./password-reset.service.js";
import { sendDriverInviteEmail } from "./email.service.js";

const EMAIL_TAKEN = "This email cannot be used for a new driver. Use another email."; // neutral: never says whether the address is registered
export class DispatchError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;
export const WORKING = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] as const;
export const LIVE_MS = 2 * 60_000;
/** How long a new offer waits for an answer (TOW_OFFER_MINUTES, default 3). */
export const offerMs = () => Math.max(1, Number(process.env.TOW_OFFER_MINUTES) || 3) * 60_000;
export const newDeadline = () => new Date(Date.now() + offerMs());
/** The exact trail is private to the job: it is deleted when the job ends (only the distance summary stays). */
export const dropTrail = (requestId: string) => prisma.towJobTrail.deleteMany({ where: { requestId } });
/** The job ended or moved on: delete its trail and forget the driver's last point, so a later job never shows it. */
export async function endTrail(tx: Prisma.TransactionClient, requestId: string, driverId: string | null) {
  await tx.towJobTrail.deleteMany({ where: { requestId } });
  if (driverId) await tx.towDriver.update({ where: { id: driverId }, data: { lastLat: null, lastLng: null, lastAt: null } });
}
export type DriverStatus = "FREE" | "BUSY" | "OFFLINE" | "NO_TRUCK" | "UNAPPROVED";

const truckReady = { verificationStatus: "APPROVED" as const, operationalStatus: "AVAILABLE" as const, archivedAt: null, ...noExpiredDocument() };
const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

/** FREE / BUSY / OFFLINE / NO_TRUCK (no truck that may take work), from what is stored. */
export async function driverStatus(db: Tx | typeof prisma, d: { id: string; offline: boolean; truckId: string | null; approval: string }): Promise<DriverStatus> {
  if (d.approval !== "APPROVED") return "UNAPPROVED"; // licence not approved (or suspended): never FREE
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

/** One photo / licence file of a driver (replaces the previous one of the same purpose). The licence stays private. */
async function putDriverFile(tx: Tx, ownerUserId: string, driverId: string, purpose: "DRIVER_PHOTO" | "DRIVER_LICENCE", input: unknown, stored: string[]) {
  const parsed = parseUpload(input, "file");
  if ("error" in parsed) throw new DispatchError(400, `${purpose === "DRIVER_PHOTO" ? "Driver photo" : "Licence photo"}: ${parsed.error}`);
  const f = parsed.file;
  const key = await storeFile(f);
  stored.push(key);
  const old = await tx.providerFile.findMany({ where: { towDriverId: driverId, purpose }, select: { id: true, storageKey: true } });
  if (old.length) await tx.providerFile.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  await tx.providerFile.create({
    data: { ownerUserId, towDriverId: driverId, purpose, visibility: purpose === "DRIVER_PHOTO" ? "PUBLIC" : "PRIVATE", originalName: f.originalName, mimeType: f.mimeType, sizeBytes: f.buffer.length, storageKey: key, sha256: f.sha256 },
  });
  return old.map((o) => o.storageKey);
}
const licenceOk = (v: unknown): v is string => typeof v === "string" && v.trim().length >= 4 && v.trim().length <= 40;

/** The driver gets a code by email to set his own password (the password-recovery flow, with an invitation text). */
export async function inviteDriver(email: string, company: string) {
  await requestPasswordReset(email, createPasswordResetStore(prisma), (m) => sendDriverInviteEmail({ ...m, company }));
}

/**
 * The owner adds a driver: a new TOW_DRIVER login (full name, email, phone, licence number + photo, optional photo / truck) or,
 * with `self: true`, himself ("I drive too"). Without `password` the driver is invited by email and sets it himself.
 * Every new driver starts PENDING until a tow admin approves the licence.
 */
export async function addDriver(ownerUserId: string, b: any) {
  const c = await ownCompany(ownerUserId);
  if (c.verificationStatus !== "APPROVED") throw new DispatchError(403, "Your company must be approved before adding drivers.");
  const phone = typeof b?.phone === "string" ? b.phone.trim() : "";
  if (!phoneOk(phone)) throw new DispatchError(400, "A valid phone number is required.");
  if (!licenceOk(b?.licenceNumber)) throw new DispatchError(400, "The licence number is required (4–40 characters).");
  if (!b?.licencePhoto) throw new DispatchError(400, "A photo of the driving licence is required.");
  const t = await ownTruck(c.id, b?.truckId);
  if (t?.takenBy) throw new DispatchError(409, "That truck already has a driver.");
  const self = b?.self === true;
  let fullName = "", email = "", passwordHash = "";
  if (!self) {
    fullName = typeof b?.fullName === "string" ? b.fullName.trim() : "";
    email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
    if (fullName.length < 3 || fullName.length > 80) throw new DispatchError(400, "The driver's full name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DispatchError(400, "A valid email is required (the driver signs in with it).");
    if (b?.password !== undefined && !passwordOk(b.password)) throw new DispatchError(400, PASSWORD_RULE);
    if (await prisma.user.findUnique({ where: { email } })) throw new DispatchError(409, EMAIL_TAKEN);
    // no password given: a random one nobody knows; the driver sets his own through the emailed code
    passwordHash = await argon2.hash(b.password ?? randomBytes(24).toString("base64url") + "Aa1!", { type: argon2.argon2id });
  } else if (await prisma.towDriver.findUnique({ where: { userId: ownerUserId } })) throw new DispatchError(409, "You are already one of your drivers.");
  const stored: string[] = [];
  try {
    const d = await prisma.$transaction(async (tx) => {
      const userId = self ? ownerUserId : (await tx.user.create({ data: { email, fullName, role: "TOW_DRIVER", status: "ACTIVE", passwordHash } })).id;
      const row = await tx.towDriver.create({ data: { userId, companyId: c.id, phone, licenceNumber: b.licenceNumber.trim(), truckId: t?.truck.id ?? null } });
      await putDriverFile(tx, ownerUserId, row.id, "DRIVER_LICENCE", b.licencePhoto, stored);
      if (b?.photo) await putDriverFile(tx, ownerUserId, row.id, "DRIVER_PHOTO", b.photo, stored);
      await tx.auditLog.create({ data: { actorId: ownerUserId, action: "TOW_DRIVER_ADDED", targetId: row.id, details: { companyId: c.id, self } } });
      return row;
    });
    if (!self && b.password === undefined) {
      const company = await prisma.towCompanyProfile.findUniqueOrThrow({ where: { id: c.id }, select: { companyName: true } });
      await inviteDriver(email, company.companyName).catch((e) => console.error("Driver invite email failed:", e));
    }
    // super admins and tow admins
    await notify(await adminIds("TOW"), B("Driver licence to review", "رخصة سائق بانتظار المراجعة"), B("A tow company added a driver.", "أضافت شركة سحب سائقًا."));
    return d;
  } catch (e) {
    await Promise.all(stored.map((k) => removeStoredFile(k)));
    if ((e as { code?: string }).code === "P2002") throw new DispatchError(409, EMAIL_TAKEN); // lost a race with another sign-up
    throw e;
  }
}

/** The owner sends the driver a new code (he never set a password yet, or lost it). */
export async function resendInvite(ownerUserId: string, driverId: string) {
  const c = await ownCompany(ownerUserId);
  const d = await prisma.towDriver.findFirst({ where: { id: driverId, companyId: c.id }, include: { user: { select: { email: true } }, company: { select: { companyName: true } } } });
  if (!d || d.userId === ownerUserId) throw new DispatchError(404, "Driver not found.");
  try {
    await inviteDriver(d.user.email, d.company.companyName);
  } catch (e) {
    console.error("Driver invite email failed:", e);
    throw new DispatchError(502, "The email could not be sent right now. Try again in a minute.");
  }
}

/** The owner changes a driver's phone / truck / offline switch / licence number, or replaces his photo or licence (a licence change = review again). */
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
    if ((t?.truck.id ?? null) !== d.truckId && await prisma.towRequest.count({ where: { driverId: d.id, status: { in: [...WORKING] } } })) throw new DispatchError(409, "Change the truck after the current job.");
    data.truckId = t?.truck.id ?? null;
  }
  if (b?.offline !== undefined) {
    if (typeof b.offline !== "boolean") throw new DispatchError(400, "offline must be true or false.");
    data.offline = b.offline;
  }
  if (b?.licenceNumber !== undefined) {
    if (!licenceOk(b.licenceNumber)) throw new DispatchError(400, "The licence number is required (4–40 characters).");
    data.licenceNumber = b.licenceNumber.trim();
  }
  if ((b?.licenceNumber !== undefined || b?.licencePhoto) && d.approval !== "SUSPENDED") Object.assign(data, { approval: "PENDING", approvalReason: null });
  // changes requested (PENDING + reason): a new photo or phone is the company's resubmission too, not only a licence edit (T-02)
  else if (d.approval === "PENDING" && d.approvalReason && (b?.photo || b?.phone !== undefined)) data.approvalReason = null;
  const stored: string[] = [];
  let old: string[] = [];
  try {
    const out = await prisma.$transaction(async (tx) => {
      if (b?.photo) old = old.concat(await putDriverFile(tx, ownerUserId, d.id, "DRIVER_PHOTO", b.photo, stored));
      if (b?.licencePhoto) old = old.concat(await putDriverFile(tx, ownerUserId, d.id, "DRIVER_LICENCE", b.licencePhoto, stored));
      const row = await tx.towDriver.update({ where: { id: d.id }, data });
      const changed = [...Object.keys(data), ...(b?.photo ? ["photo"] : []), ...(b?.licencePhoto ? ["licencePhoto"] : [])];
      await tx.auditLog.create({ data: { actorId: ownerUserId, action: "TOW_DRIVER_UPDATED", targetId: d.id, details: { changed } } }); // field names only: no phone / licence values in the log
      return row;
    });
    await Promise.all(old.map((k) => removeStoredFile(k)));
    return out;
  } catch (e) {
    await Promise.all(stored.map((k) => removeStoredFile(k)));
    throw e;
  }
}

/** Tow admin: correct a driver's name, phone or licence number. Validated and audited (field names only); the company is told. */
export async function adminUpdateDriver(adminId: string, driverId: string, b: any) {
  const d = await prisma.towDriver.findUnique({ where: { id: driverId }, include: { company: { select: { userId: true } } } });
  if (!d) throw new DispatchError(404, "Driver not found.");
  const data: Prisma.TowDriverUncheckedUpdateInput = {};
  let fullName: string | undefined;
  if (b?.name !== undefined) {
    if (typeof b.name !== "string" || b.name.trim().length < 2 || b.name.trim().length > 80) throw new DispatchError(400, "The name must be 2–80 characters.");
    fullName = b.name.trim();
  }
  if (b?.phone !== undefined) {
    if (!phoneOk(b.phone)) throw new DispatchError(400, "A valid phone number is required.");
    data.phone = b.phone.trim();
  }
  if (b?.licenceNumber !== undefined) {
    if (!licenceOk(b.licenceNumber)) throw new DispatchError(400, "The licence number is required (4–40 characters).");
    data.licenceNumber = b.licenceNumber.trim();
  }
  const changed = [...(fullName !== undefined ? ["name"] : []), ...Object.keys(data)];
  if (!changed.length) throw new DispatchError(400, "Nothing to change.");
  await prisma.$transaction(async (tx) => {
    if (fullName !== undefined) await tx.user.update({ where: { id: d.userId }, data: { fullName } });
    if (Object.keys(data).length) await tx.towDriver.update({ where: { id: d.id }, data });
    await tx.auditLog.create({ data: { actorId: adminId, action: "TOW_DRIVER_ADMIN_UPDATED", targetId: d.id, details: { changed } } });
  });
  await notify([d.company.userId, d.userId], B("Driver details corrected", "تم تصحيح بيانات السائق"), B("MOTEXA corrected this driver's details.", "صحّحت موتكسا بيانات السائق."));
}

/** Tow admin: approve / reject (reason) a driver's licence, or suspend him. Audited; the company and the driver are told. */
export async function reviewDriver(adminId: string, driverId: string, decision: unknown, reason: unknown) {
  // REQUEST_CHANGES keeps the driver PENDING with the reason set; the company's licence edit clears it and resubmits.
  const changes = decision === "REQUEST_CHANGES";
  const to = decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : decision === "SUSPEND" ? "SUSPENDED" : changes ? "PENDING" : null;
  if (!to) throw new DispatchError(400, "decision must be APPROVE, REJECT, REQUEST_CHANGES or SUSPEND.");
  const why = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null;
  if (to !== "APPROVED" && !why) throw new DispatchError(400, "A reason is required.");
  const d = await prisma.towDriver.findUnique({ where: { id: driverId }, include: { company: { select: { userId: true } } } });
  if (!d) throw new DispatchError(404, "Driver not found.");
  if (changes && d.approval !== "PENDING") throw new DispatchError(409, "Changes can only be requested while the licence is pending review.");
  if (to === "APPROVED" && !(await prisma.providerFile.count({ where: { towDriverId: d.id, purpose: "DRIVER_LICENCE" } }))) throw new DispatchError(409, "This driver has no licence photo.");
  await prisma.$transaction(async (tx) => {
    await tx.towDriver.update({ where: { id: d.id }, data: { approval: to, approvalReason: to === "APPROVED" ? null : why, reviewedById: adminId, reviewedAt: new Date(), ...(to === "SUSPENDED" ? { offline: true } : {}) } });
    await tx.auditLog.create({ data: { actorId: adminId, action: changes ? "TOW_DRIVER_CHANGES_REQUESTED" : `TOW_DRIVER_${to}`, targetId: d.id, details: { reason: why } } });
  });
  const T: Record<string, [[string, string], [string, string]]> = {
    APPROVED: [B("Driver approved", "تمت الموافقة على السائق"), B("The driver's licence was approved.", "تمت الموافقة على رخصة السائق.")],
    REJECTED: [B("Driver licence rejected", "تم رفض رخصة السائق"), B(why ?? "", why ?? "")],
    PENDING: [B("Driver changes requested", "طُلب تعديل بيانات السائق"), B(why ?? "", why ?? "")],
    SUSPENDED: [B("Driver suspended", "تم إيقاف السائق"), B(why ?? "", why ?? "")],
  };
  await notify([d.company.userId, d.userId], ...T[to]);
}

// ------------------------------------------------------------------ ratings (real reviews only)

/** { avg (1 decimal) | null, count } from the stored reviews. */
export async function ratingOf(where: { driverId?: string; companyId?: string }) {
  const a = await prisma.towReview.aggregate({ where, _avg: { stars: true }, _count: { stars: true } });
  return { avg: a._avg.stars === null ? null : Math.round(a._avg.stars * 10) / 10, count: a._count.stars };
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
  let driverId = r.requestedDriverId ?? (r.choiceMode === "NEAREST" ? r.driverId : null);
  await prisma.towRequest.updateMany({ where: { id: r.id, status: "REQUESTED" }, data: { offerExpiresAt: newDeadline() } });
  // "choose a company": the company assigns; no choice recorded (older requests): the only free driver gets it
  if (!driverId && r.choiceMode !== "COMPANY") {
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
  if (r.status !== "REQUESTED" && r.status !== "ACCEPTED" && r.status !== "EN_ROUTE") throw new DispatchError(409, "A job can be reassigned until towing starts.");
  if (r.driverId === driverId) return r;
  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.towDriver.findFirst({ where: { id: driverId, companyId: c.id, user: { status: "ACTIVE" } } });
    if (!d) throw new DispatchError(404, "Driver not found.");
    if ((await driverStatus(tx, d)) !== "FREE") throw new DispatchError(409, "This driver is not free right now.");
    // an accepted job goes back to "waiting for the driver": the old truck is released, the new driver accepts with his own
    const moved = await tx.towRequest.updateMany({
      where: { id: r.id, status: r.status, driverId: r.driverId },
      data: { driverId: d.id, status: "REQUESTED", offerExpiresAt: newDeadline(), acceptedAt: null, enRouteAt: null, arrivedAt: null, loadingAt: null, assignedTruckId: null, assignedTruckType: null, assignedTruckMake: null, assignedTruckModel: null, assignedTruckYear: null },
    });
    if (!moved.count) throw new DispatchError(409, "The job changed meanwhile. Refresh and try again.");
    if (r.status !== "REQUESTED") await releaseTruck(tx, r.assignedTruckId);
    await endTrail(tx, r.id, r.driverId);
    await tx.auditLog.create({ data: { actorId: ownerUserId, action: "TOW_JOB_ASSIGNED", targetId: r.id, details: { from: r.driverId, to: d.id } } });
    return { d, row: await tx.towRequest.findUniqueOrThrow({ where: { id: r.id } }) };
  });
  if (updated.d.userId !== ownerUserId) await notify([updated.d.userId], B("New tow job", "مهمة سحب جديدة"), B("Your company gave you a job. Accept or decline it.", "أسندت إليك شركتك مهمة. اقبلها أو ارفضها."));
  const first = updated.d.userId ? (await prisma.user.findUniqueOrThrow({ where: { id: updated.d.userId }, select: { fullName: true } })).fullName.trim().split(/\s+/)[0] : "";
  await notify([r.customerId], r.status === "REQUESTED" ? B("A driver was assigned", "تم تعيين سائق") : B("Your driver was changed", "تم تغيير سائقك"), B(`${first} is your new driver once he accepts. Open the job to see his card.`, `${first} سائقك الجديد بعد قبوله. افتح المهمة لترى بطاقته.`));
  if (r.driverId && r.status !== "REQUESTED") {
    const old = await prisma.towDriver.findUnique({ where: { id: r.driverId }, select: { userId: true } });
    if (old && old.userId !== ownerUserId) await notify([old.userId], B("A job was moved to another driver", "تم نقل مهمة إلى سائق آخر"), B("Your company reassigned the job.", "أعادت شركتك إسناد المهمة."));
  }
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
  if (d.approval !== "APPROVED") throw new DispatchError(403, "Your licence is not approved yet.");
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

export type DriverStep = "EN_ROUTE" | "ARRIVED" | "LOADING" | "IN_PROGRESS" | "DELIVERED" | "COMPLETED";
/** What the job must look like for each step (strictly in this order; nothing is skipped or undone). */
const STEP: Record<DriverStep, { where: Prisma.TowRequestWhereInput; data: (now: Date) => Prisma.TowRequestUpdateManyMutationInput; title: [string, string] }> = {
  EN_ROUTE: { where: { status: "ACCEPTED" }, data: (n) => ({ status: "EN_ROUTE", enRouteAt: n }), title: B("Your driver is on the way", "سائقك في الطريق") },
  ARRIVED: { where: { status: "EN_ROUTE", arrivedAt: null }, data: (n) => ({ arrivedAt: n }), title: B("Your driver has arrived", "وصل سائقك") },
  LOADING: { where: { status: "EN_ROUTE", arrivedAt: { not: null }, loadingAt: null }, data: (n) => ({ loadingAt: n }), title: B("Loading your car", "يتم تحميل سيارتك") },
  IN_PROGRESS: { where: { status: "EN_ROUTE", loadingAt: { not: null } }, data: (n) => ({ status: "IN_PROGRESS", inProgressAt: n }), title: B("Towing started", "بدأ السحب") },
  DELIVERED: { where: { status: "IN_PROGRESS", deliveredAt: null }, data: (n) => ({ deliveredAt: n }), title: B("Your car was delivered", "تم تسليم سيارتك") },
  COMPLETED: { where: { status: "IN_PROGRESS", deliveredAt: { not: null } }, data: (n) => ({ status: "COMPLETED", completedAt: n }), title: B("Tow completed", "اكتمل السحب") },
};
/** The stage the customer's status bar shows. */
export function stageOf(r: { status: string; arrivedAt: Date | null; loadingAt: Date | null; deliveredAt: Date | null }) {
  if (r.status === "EN_ROUTE") return r.loadingAt ? "LOADING" : r.arrivedAt ? "ARRIVED" : "ON_THE_WAY";
  if (r.status === "IN_PROGRESS") return r.deliveredAt ? "DELIVERED" : "TOWING";
  return r.status;
}
export async function driverMove(userId: string, requestId: string, to: DriverStep) {
  const step = STEP[to];
  if (!step) throw new DispatchError(400, `status must be one of ${Object.keys(STEP).join(", ")}.`);
  const { d, r } = await myJob(userId, requestId);
  if (d.approval === "SUSPENDED") throw new DispatchError(403, "Your driver account is suspended. Contact your company.");
  await prisma.$transaction(async (tx) => {
    const moved = await tx.towRequest.updateMany({ where: { id: r.id, driverId: d.id, ...step.where }, data: step.data(new Date()) });
    if (!moved.count) throw new DispatchError(409, `This job can't move to ${to.toLowerCase().replace("_", " ")} now.`);
    if (to === "COMPLETED") {
      await releaseTruck(tx, r.assignedTruckId);
      await endTrail(tx, r.id, r.driverId);
    }
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
    await endTrail(tx, r.id, r.driverId);
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
  const p = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
  // metres since his previous point of THIS job (a jump from an older job's last point is not counted)
  const prev = await prisma.towJobTrail.findFirst({ where: { requestId: r.id }, orderBy: { at: "desc" } });
  const moved = prev ? Math.round(haversineKm(prev, p) * 1000) : 0;
  await prisma.$transaction([
    prisma.towDriver.update({ where: { id: d.id }, data: { lastLat: p.lat, lastLng: p.lng, lastAt: new Date() } }),
    prisma.towJobTrail.create({ data: { requestId: r.id, lat: p.lat, lng: p.lng } }),
    prisma.$executeRaw`UPDATE "TowRequest" SET "distanceMeters" = COALESCE("distanceMeters", 0) + ${moved >= 10 && moved < 2000 ? moved : 0} WHERE "id" = ${r.id}`,
  ]);
  // keep the trail short: the newest 300 points
  const extra = await prisma.towJobTrail.findMany({ where: { requestId: r.id }, orderBy: { at: "desc" }, skip: 300, select: { id: true } });
  if (extra.length) await prisma.towJobTrail.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
}

export async function setOffline(userId: string, offline: unknown) {
  if (typeof offline !== "boolean") throw new DispatchError(400, "offline must be true or false.");
  const d = await myDriver(userId);
  return prisma.towDriver.update({ where: { id: d.id }, data: { offline } });
}
