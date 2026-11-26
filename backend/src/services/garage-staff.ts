// Garages = the tow company pattern for mechanics. An APPROVED garage owner (GARAGE_OWNER) adds his mechanics: each one is a NEW
// MECHANIC login (never an existing account, so nobody is an independent and a garage mechanic at once) that starts PENDING until a
// mechanics admin approves his ID photo, exactly like tow drivers and their licence. Rules here (anything else is refused):
//  - status: UNAPPROVED (not approved / suspended) | OFFLINE (his switch) | BUSY (an accepted .. in-progress job) | FREE;
//  - Online = his latest point is shared with the garage and the mechanics admins (~every 60 s, services/presence.ts); Offline clears it;
//  - the owner assigns a garage request to a FREE mechanic with the request's skill ("nearest available" suggested), may reassign it
//    until the mechanic is on the way, or declines it.
// Every change notifies the people concerned and writes an audit row.
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { MECHANIC_SKILLS } from "../mechanicSkills.js";
import { parseUpload, removeStoredFile, storeFile } from "../uploads/providerFiles.js";
import { createPasswordResetStore, requestPasswordReset } from "./password-reset.service.js";
import { sendGarageMechanicInviteEmail } from "./email.service.js";
import { adminIds, notify } from "./provider-onboarding.js";
import { PASSWORD_RULE, passwordOk } from "./tow-dispatch.js";
import { dutyPoint, nearestFirst, presenceOf, tooSoon } from "./presence.js";

type Tx = Prisma.TransactionClient;
export class GarageError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}
const B = (en: string, ar: string) => [en, ar] as [string, string];
const EMAIL_TAKEN = "This email cannot be used for a new mechanic. Use another email."; // neutral: never says whether it is registered
const phoneOk = (v: unknown): v is string => typeof v === "string" && /^\+?[0-9 ()-]{8,24}$/.test(v.trim());
/** an accepted job that is not finished: the mechanic is BUSY and his live point matters */
export const JOB_ACTIVE = ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] as const;

export function cleanSkills(v: unknown): string[] {
  if (!Array.isArray(v) || !v.length || v.some((x) => !(MECHANIC_SKILLS as readonly string[]).includes(x as string))) throw new GarageError(400, "Choose the mechanic's skills from the list.");
  return MECHANIC_SKILLS.filter((s) => (v as string[]).includes(s));
}

export async function ownGarage(ownerUserId: string) {
  const g = await prisma.garageProfile.findUnique({ where: { userId: ownerUserId }, select: { id: true, userId: true, verificationStatus: true, garageName: true, baseLat: true, baseLng: true } });
  if (!g) throw new GarageError(404, "No garage is linked to this account.");
  return g;
}

export type GarageMechanicStatus = "FREE" | "BUSY" | "OFFLINE" | "UNAPPROVED";
export async function garageMechanicStatus(db: Tx | typeof prisma, m: { userId: string; offline: boolean; approval: string }): Promise<GarageMechanicStatus> {
  if (m.approval !== "APPROVED") return "UNAPPROVED";
  if (m.offline) return "OFFLINE";
  if (await db.mechanicRequest.count({ where: { mechanicUserId: m.userId, status: { in: [...JOB_ACTIVE] } } })) return "BUSY";
  return "FREE";
}

/** One photo / ID file of a garage mechanic (replaces the previous one of the same purpose). The ID stays private. */
async function putFile(tx: Tx, ownerUserId: string, garageMechanicId: string, purpose: "GARAGE_MECHANIC_PHOTO" | "GARAGE_MECHANIC_ID", input: unknown, stored: string[]) {
  const parsed = parseUpload(input, "file");
  if ("error" in parsed) throw new GarageError(400, `${purpose === "GARAGE_MECHANIC_PHOTO" ? "Photo" : "ID photo"}: ${parsed.error}`);
  const f = parsed.file;
  const key = await storeFile(f);
  stored.push(key);
  const old = await tx.providerFile.findMany({ where: { garageMechanicId, purpose }, select: { id: true, storageKey: true } });
  if (old.length) await tx.providerFile.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  await tx.providerFile.create({
    data: { ownerUserId, garageMechanicId, purpose, visibility: purpose === "GARAGE_MECHANIC_PHOTO" ? "PUBLIC" : "PRIVATE", originalName: f.originalName, mimeType: f.mimeType, sizeBytes: f.buffer.length, storageKey: key, sha256: f.sha256 },
  });
  return old.map((o) => o.storageKey);
}

async function invite(email: string, garage: string) {
  await requestPasswordReset(email, createPasswordResetStore(prisma), (m) => sendGarageMechanicInviteEmail({ ...m, company: garage }));
}

/**
 * The owner of an APPROVED garage adds a mechanic: a NEW MECHANIC login (full name, email, phone, skills, ID photo, optional photo).
 * Without `password` the mechanic is invited by email to set it himself. He starts PENDING until a mechanics admin approves the ID.
 */
export async function addGarageMechanic(ownerUserId: string, b: any) {
  const g = await ownGarage(ownerUserId);
  if (g.verificationStatus !== "APPROVED") throw new GarageError(403, "Your garage must be approved before adding mechanics.");
  const fullName = typeof b?.fullName === "string" ? b.fullName.trim() : "";
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = typeof b?.phone === "string" ? b.phone.trim() : "";
  if (fullName.length < 3 || fullName.length > 80) throw new GarageError(400, "The mechanic's full name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GarageError(400, "A valid email is required (the mechanic signs in with it).");
  if (!phoneOk(phone)) throw new GarageError(400, "A valid phone number is required.");
  const skills = cleanSkills(b?.skills);
  if (!b?.idPhoto) throw new GarageError(400, "A photo of the mechanic's ID is required.");
  if (b?.password !== undefined && !passwordOk(b.password)) throw new GarageError(400, PASSWORD_RULE);
  if (await prisma.user.findUnique({ where: { email } })) throw new GarageError(409, EMAIL_TAKEN);
  const passwordHash = await argon2.hash(b.password ?? randomBytes(24).toString("base64url") + "Aa1!", { type: argon2.argon2id });
  const stored: string[] = [];
  try {
    const m = await prisma.$transaction(async (tx) => {
      // the one place a garage creates an account (auth-security source scan allowlist): always a MECHANIC of this garage
      const user = await tx.user.create({ data: { email, fullName, role: "MECHANIC", status: "ACTIVE", passwordHash } });
      const row = await tx.garageMechanic.create({ data: { userId: user.id, garageId: g.id, phone, skills } });
      await putFile(tx, ownerUserId, row.id, "GARAGE_MECHANIC_ID", b.idPhoto, stored);
      if (b?.photo) await putFile(tx, ownerUserId, row.id, "GARAGE_MECHANIC_PHOTO", b.photo, stored);
      await tx.auditLog.create({ data: { actorId: ownerUserId, action: "GARAGE_MECHANIC_ADDED", targetId: row.id, details: { garageId: g.id } } });
      return row;
    });
    if (b.password === undefined) await invite(email, g.garageName).catch((e) => console.error("Garage mechanic invite email failed:", e));
    await notify(await adminIds("GARAGE"), B("Garage mechanic to review", "ميكانيكي كراج بانتظار المراجعة"), B(`${g.garageName} added a mechanic.`, `أضاف ${g.garageName} ميكانيكيًا.`));
    return m;
  } catch (e) {
    await Promise.all(stored.map((k) => removeStoredFile(k)));
    if ((e as { code?: string }).code === "P2002") throw new GarageError(409, EMAIL_TAKEN);
    throw e;
  }
}

export async function resendGarageInvite(ownerUserId: string, id: string) {
  const g = await ownGarage(ownerUserId);
  const m = await prisma.garageMechanic.findFirst({ where: { id, garageId: g.id }, include: { user: { select: { email: true } } } });
  if (!m) throw new GarageError(404, "Mechanic not found.");
  try {
    await invite(m.user.email, g.garageName);
  } catch (e) {
    console.error("Garage mechanic invite email failed:", e);
    throw new GarageError(502, "The email could not be sent right now. Try again in a minute.");
  }
}

/** The owner changes a mechanic's phone / skills or replaces his photo / ID (a new ID = review again, unless suspended). */
export async function updateGarageMechanic(ownerUserId: string, id: string, b: any) {
  const g = await ownGarage(ownerUserId);
  const m = await prisma.garageMechanic.findFirst({ where: { id, garageId: g.id } });
  if (!m) throw new GarageError(404, "Mechanic not found.");
  const data: Prisma.GarageMechanicUncheckedUpdateInput = {};
  if (b?.phone !== undefined) {
    if (!phoneOk(b.phone)) throw new GarageError(400, "A valid phone number is required.");
    data.phone = b.phone.trim();
  }
  if (b?.skills !== undefined) data.skills = cleanSkills(b.skills);
  if (b?.idPhoto && m.approval !== "SUSPENDED") Object.assign(data, { approval: "PENDING", approvalReason: null });
  else if (m.approval === "PENDING" && m.approvalReason && (b?.photo || b?.phone !== undefined)) data.approvalReason = null;
  const stored: string[] = [];
  let old: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      if (b?.photo) old = old.concat(await putFile(tx, ownerUserId, m.id, "GARAGE_MECHANIC_PHOTO", b.photo, stored));
      if (b?.idPhoto) old = old.concat(await putFile(tx, ownerUserId, m.id, "GARAGE_MECHANIC_ID", b.idPhoto, stored));
      await tx.garageMechanic.update({ where: { id: m.id }, data });
      const changed = [...Object.keys(data), ...(b?.photo ? ["photo"] : []), ...(b?.idPhoto ? ["idPhoto"] : [])];
      await tx.auditLog.create({ data: { actorId: ownerUserId, action: "GARAGE_MECHANIC_UPDATED", targetId: m.id, details: { changed } } }); // field names only
    });
    await Promise.all(old.map((k) => removeStoredFile(k)));
  } catch (e) {
    await Promise.all(stored.map((k) => removeStoredFile(k)));
    throw e;
  }
}

/** Mechanics admin: approve / reject (reason) the mechanic's ID, request changes (stays PENDING with a reason) or suspend. */
export async function reviewGarageMechanic(adminId: string, id: string, decision: unknown, reason: unknown) {
  const changes = decision === "REQUEST_CHANGES";
  const to = decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : decision === "SUSPEND" ? "SUSPENDED" : changes ? "PENDING" : null;
  if (!to) throw new GarageError(400, "decision must be APPROVE, REJECT, REQUEST_CHANGES or SUSPEND.");
  const why = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null;
  if (to !== "APPROVED" && !why) throw new GarageError(400, "A reason is required.");
  const m = await prisma.garageMechanic.findUnique({ where: { id }, include: { garage: { select: { userId: true, verificationStatus: true } } } });
  if (!m) throw new GarageError(404, "Mechanic not found.");
  if (changes && m.approval !== "PENDING") throw new GarageError(409, "Changes can only be requested while the mechanic is pending review.");
  if (to === "APPROVED" && !(await prisma.providerFile.count({ where: { garageMechanicId: m.id, purpose: "GARAGE_MECHANIC_ID" } }))) throw new GarageError(409, "This mechanic has no ID photo.");
  await prisma.$transaction(async (tx) => {
    // suspended: offline at once and his point forgotten
    await tx.garageMechanic.update({ where: { id: m.id }, data: { approval: to, approvalReason: to === "APPROVED" ? null : why, reviewedById: adminId, reviewedAt: new Date(), ...(to === "SUSPENDED" || to === "REJECTED" ? { offline: true, lastLat: null, lastLng: null, lastAt: null } : {}) } });
    await tx.auditLog.create({ data: { actorId: adminId, action: changes ? "GARAGE_MECHANIC_CHANGES_REQUESTED" : `GARAGE_MECHANIC_${to}`, targetId: m.id, details: { reason: why } } });
  });
  const T: Record<string, [[string, string], [string, string]]> = {
    APPROVED: [B("Mechanic approved", "تمت الموافقة على الميكانيكي"), B("The mechanic can now go online and take jobs.", "يمكن للميكانيكي الآن الاتصال واستلام المهام.")],
    REJECTED: [B("Mechanic rejected", "تم رفض الميكانيكي"), B(why ?? "", why ?? "")],
    PENDING: [B("Mechanic changes requested", "طُلب تعديل بيانات الميكانيكي"), B(why ?? "", why ?? "")],
    SUSPENDED: [B("Mechanic suspended", "تم إيقاف الميكانيكي"), B(why ?? "", why ?? "")],
  };
  await notify([m.garage.userId, m.userId], ...T[to]);
}

// ------------------------------------------------------------------ the garage mechanic himself: Online / Offline + his point
export async function myGarageMechanic(userId: string) {
  return prisma.garageMechanic.findUnique({ where: { userId }, include: { garage: { select: { id: true, garageName: true, garageNameAr: true, verificationStatus: true, userId: true } } } });
}

export async function setGarageMechanicOffline(userId: string, offline: unknown) {
  if (typeof offline !== "boolean") throw new GarageError(400, "offline must be true or false.");
  const m = await myGarageMechanic(userId);
  if (!m) throw new GarageError(404, "Only a garage mechanic has an Online switch.");
  if (!offline && m.approval !== "APPROVED") throw new GarageError(409, "You can go online once MOTEXA approves you.");
  const onJob = offline && (await prisma.mechanicRequest.count({ where: { mechanicUserId: userId, status: { in: [...JOB_ACTIVE] } } })) > 0;
  await prisma.garageMechanic.update({ where: { id: m.id }, data: { offline, ...(offline && !onJob ? { lastLat: null, lastLng: null, lastAt: null } : {}) } });
}

/** While Online (about every 60 s): only his latest point is stored; refused while Offline or not approved. */
export async function garageDutyPing(userId: string, lat: unknown, lng: unknown) {
  const p = dutyPoint(lat, lng);
  if (!p) throw new GarageError(400, "Invalid location.");
  const m = await myGarageMechanic(userId);
  if (!m) throw new GarageError(404, "Only a garage mechanic shares his location while online.");
  if (m.approval !== "APPROVED") throw new GarageError(409, "You are not approved yet, so your location is not shared.");
  if (m.offline) throw new GarageError(409, "Go online to share your location.");
  if (tooSoon(m.lastAt)) return { stored: false };
  await prisma.garageMechanic.update({ where: { id: m.id }, data: { lastLat: p.lat, lastLng: p.lng, lastAt: new Date() } });
  return { stored: true };
}

// ------------------------------------------------------------------ the owner: nearest available, assign, decline
/** The garage's FREE approved mechanics (with `skill` when given), nearest to `to` first (fresh live point, else the garage). */
export async function nearestGarageMechanics(garageId: string, to: { lat: number; lng: number } | null, skill?: string | null) {
  const g = await prisma.garageProfile.findUniqueOrThrow({ where: { id: garageId }, select: { baseLat: true, baseLng: true } });
  const rows = await prisma.garageMechanic.findMany({ where: { garageId, approval: "APPROVED", offline: false, user: { status: "ACTIVE" }, ...(skill ? { skills: { has: skill } } : {}) }, include: { user: { select: { fullName: true } } } });
  const free: typeof rows = [];
  for (const m of rows) if ((await garageMechanicStatus(prisma, m)) === "FREE") free.push(m);
  const base = g.baseLat !== null && g.baseLng !== null ? { lat: g.baseLat, lng: g.baseLng } : null;
  return nearestFirst(free, to, (m) => ({ live: presenceOf(m), base })).map(({ item: m, distanceKm, source }) => ({ id: m.id, name: m.user.fullName, skills: m.skills, distanceKm, source }));
}

/** The owner gives a garage request to one of his FREE mechanics (or moves it before the mechanic is on the way). */
export async function assignGarageRequest(ownerUserId: string, requestId: string, garageMechanicId: string) {
  const g = await ownGarage(ownerUserId);
  const r = await prisma.mechanicRequest.findFirst({ where: { id: requestId, garageId: g.id } });
  if (!r) throw new GarageError(404, "Request not found.");
  if (r.status !== "REQUESTED" && r.status !== "ACCEPTED") throw new GarageError(409, "A request can be (re)assigned until the mechanic is on the way.");
  const m = await prisma.garageMechanic.findFirst({ where: { id: garageMechanicId, garageId: g.id, user: { status: "ACTIVE" } } });
  if (!m) throw new GarageError(404, "Mechanic not found.");
  if (r.mechanicUserId === m.userId) return;
  if ((await garageMechanicStatus(prisma, m)) !== "FREE") throw new GarageError(409, "This mechanic is not free right now.");
  if (r.skill && !m.skills.includes(r.skill)) throw new GarageError(409, "This mechanic does not have the skill the customer asked for.");
  await prisma.$transaction(async (tx) => {
    const moved = await tx.mechanicRequest.updateMany({
      where: { id: r.id, status: r.status, mechanicUserId: r.mechanicUserId },
      data: { mechanicUserId: m.userId, assignedAt: new Date(), status: "REQUESTED", acceptedAt: null, liveLat: null, liveLng: null, liveAt: null },
    });
    if (!moved.count) throw new GarageError(409, "The request changed meanwhile. Refresh and try again.");
    await tx.mechanicJobTrail.deleteMany({ where: { requestId: r.id } });
    await tx.auditLog.create({ data: { actorId: ownerUserId, action: "MECHANIC_REQUEST_ASSIGNED", targetId: r.id, details: { from: r.mechanicUserId, to: m.userId, garageId: g.id } } });
  });
  await notify([m.userId], B("New job from your garage", "مهمة جديدة من كراجك"), B("Open MOTEXA to accept or decline it.", "افتح موتكسا للقبول أو الرفض."));
  if (r.mechanicUserId) await notify([r.mechanicUserId], B("A job was moved to another mechanic", "تم نقل مهمة إلى ميكانيكي آخر"), B("Your garage reassigned the job.", "أعاد كراجك إسناد المهمة."));
  await notify([r.customerId], B("A mechanic was assigned", "تم تعيين ميكانيكي"), B(`${g.garageName} gave your request to one of its mechanics.`, `أسند ${g.garageName} طلبك إلى أحد ميكانيكييه.`));
}

/** The owner declines a garage request that no mechanic accepted yet. */
export async function declineGarageRequest(ownerUserId: string, requestId: string, reason: unknown) {
  const g = await ownGarage(ownerUserId);
  const why = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null;
  const r = await prisma.mechanicRequest.findFirst({ where: { id: requestId, garageId: g.id } });
  if (!r) throw new GarageError(404, "Request not found.");
  await prisma.$transaction(async (tx) => {
    const done = await tx.mechanicRequest.updateMany({ where: { id: r.id, status: "REQUESTED" }, data: { status: "DECLINED", declinedAt: new Date(), declineReason: why } });
    if (!done.count) throw new GarageError(409, "Only a request no mechanic accepted yet can be declined.");
    await tx.auditLog.create({ data: { actorId: ownerUserId, action: "MECHANIC_REQUEST_DECLINED", targetId: r.id, details: { by: "GARAGE", reason: why } } });
  });
  await notify([r.customerId, ...(r.mechanicUserId ? [r.mechanicUserId] : [])], B("Request declined", "تم رفض الطلب"), B(`${g.garageName} cannot take this request.`, `لا يستطيع ${g.garageName} قبول هذا الطلب.`));
}
