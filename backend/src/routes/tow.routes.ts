import { canonicalCity } from "../cities.js";
import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireTowAdmin, requireTowProvider } from "../middleware/auth.middleware.js";
import {
  type ParsedUpload,
  filePath,
  parseExpiry,
  parseUpload,
  removeStoredFiles,
  storeFile,
} from "../uploads/providerFiles.js";

// Tow companies + trucks. Mounted at /api, BEFORE the global JSON parser: the provider routes carry base64
// images and parse their own (larger) body, and only after the caller has been authenticated.
//  - /api/tow/me/*        TOW_PROVIDER, always scoped to the caller's own company.
//  - /api/admin/tow/*     SUPER_ADMIN or ADMIN + MANAGE_TOWING. Admins decide only; they never edit data.
// Truck files (photo, registration, insurance) are stored via ProviderFile; see storage/providerFiles.ts.
const router = Router();

const TRUCK_TYPES = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"] as const;
const OPERATIONAL = ["AVAILABLE", "BUSY", "OUT_OF_SERVICE"] as const;
const DECISIONS = ["APPROVED", "REJECTED"] as const;
const FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;
type Decision = (typeof DECISIONS)[number];

const DOC_KINDS = { REGISTRATION: "TRUCK_REGISTRATION", INSURANCE: "TRUCK_INSURANCE" } as const;
type DocKind = keyof typeof DOC_KINDS;
const PURPOSE_KIND: Record<string, DocKind> = { TRUCK_REGISTRATION: "REGISTRATION", TRUCK_INSURANCE: "INSURANCE" };

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idParam = (v: unknown) => String(v);
const bad = (res: any, code: number, message: string) => res.status(code).json({ success: false, message });
const fail = (res: any, label: string, error: unknown) => {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: "Internal server error." });
};

const log = (actorId: string, action: string, targetId: string, details: object = {}) =>
  prisma.auditLog.create({ data: { actorId, action, targetId, details } });

// ---- shaping ----

const loadCompany = (where: { id?: string; userId?: string }) =>
  prisma.towCompanyProfile.findFirst({
    where,
    include: {
      user: { select: { fullName: true, email: true } },
      files: { where: { purpose: "TOW_COMPANY_DOCUMENT" }, orderBy: { createdAt: "asc" } },
    },
  });
type CompanyRow = NonNullable<Awaited<ReturnType<typeof loadCompany>>>;

const shapeCompany = (c: CompanyRow) => ({
  id: c.id,
  companyName: c.companyName,
  contactName: c.user.fullName,
  ownerEmail: c.user.email,
  phone: c.phone,
  city: c.city,
  address: c.address,
  description: c.description,
  serviceCities: c.serviceCities,
  workingHours: c.workingHours,
  licenceNumber: c.licenceNumber,
  verificationStatus: c.verificationStatus,
  rejectionReason: c.rejectionReason,
  documents: c.files.map((f) => ({ kind: f.label ?? "Document", fileName: f.originalName, uri: filePath(f) })),
});

/** A truck is on an active job while it is the assigned truck of an ACCEPTED, EN_ROUTE or IN_PROGRESS tow request. */
const ACTIVE_JOB = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] as const;
const loadTrucks = (where: Prisma.TruckWhereInput) =>
  prisma.truck.findMany({
    where,
    include: { files: true, towRequests: { where: { status: { in: [...ACTIVE_JOB] } }, select: { id: true }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
type TruckRow = Awaited<ReturnType<typeof loadTrucks>>[number];

/** What an admin needs before approving: the photo and both documents. */
const missingFor = (t: TruckRow) => {
  const have = new Set(t.files.map((f) => f.purpose));
  const out: string[] = [];
  if (!have.has("TRUCK_PHOTO")) out.push("truck photo");
  if (!have.has("TRUCK_REGISTRATION")) out.push("registration document");
  if (!have.has("TRUCK_INSURANCE")) out.push("insurance document");
  return out;
};

const shapeTruck = (t: TruckRow, history: unknown[] = []) => {
  const photo = t.files.find((f) => f.purpose === "TRUCK_PHOTO");
  const now = Date.now();
  return {
    id: t.id,
    companyId: t.companyId,
    plateNumber: t.plateNumber,
    make: t.make,
    model: t.model,
    year: t.year,
    truckType: t.truckType,
    maxWeightKg: t.maxWeightKg,
    verificationStatus: t.verificationStatus,
    operationalStatus: t.operationalStatus,
    rejectionReason: t.rejectionReason,
    hasActiveJob: t.towRequests.length > 0,
    photoUri: photo ? filePath(photo) : null,
    documents: t.files
      .filter((f) => f.purpose in PURPOSE_KIND)
      .map((f) => ({
        kind: PURPOSE_KIND[f.purpose],
        fileName: f.originalName,
        uri: filePath(f),
        expiresAt: f.expiresAt ? f.expiresAt.toISOString() : null,
        expired: !!f.expiresAt && f.expiresAt.getTime() < now, // flagged only; never auto-rejects
      })),
    missingForApproval: missingFor(t),
    history,
  };
};

/** History comes from AuditLog. Edits only appear when they sent the truck back for review. */
async function historyFor(truckIds: string[]) {
  const out = new Map<string, { at: Date; actor: string; action: string; reason?: string }[]>();
  if (!truckIds.length) return out;
  const rows = await prisma.auditLog.findMany({
    where: { targetId: { in: truckIds }, action: { startsWith: "TOW_TRUCK_" } },
    orderBy: { createdAt: "asc" },
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const users = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } });
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  for (const r of rows) {
    const d = (r.details ?? {}) as { reason?: string | null; resubmitted?: boolean };
    const action =
      r.action === "TOW_TRUCK_CREATED" || (r.action === "TOW_TRUCK_EDITED" && d.resubmitted)
        ? "SUBMITTED"
        : r.action === "TOW_TRUCK_APPROVED"
          ? "APPROVED"
          : r.action === "TOW_TRUCK_REJECTED"
            ? "REJECTED"
            : null;
    if (!action || !r.targetId) continue;
    const list = out.get(r.targetId) ?? [];
    list.push({
      at: r.createdAt,
      actor: (r.actorId && names.get(r.actorId)) || "MOTEXA",
      action,
      ...(action === "REJECTED" && d.reason ? { reason: d.reason } : {}),
    });
    out.set(r.targetId, list);
  }
  return out;
}

/** Company-level decisions (approve / reject with reason) from AuditLog, with the admin's real name. */
async function companyHistory(companyId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { targetId: companyId, action: { in: ["TOW_COMPANY_APPROVED", "TOW_COMPANY_REJECTED"] } },
    orderBy: { createdAt: "asc" },
  });
  const ids = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => {
    const approved = r.action === "TOW_COMPANY_APPROVED";
    const reason = ((r.details ?? {}) as { reason?: string | null }).reason;
    return {
      at: r.createdAt,
      actor: (r.actorId && names.get(r.actorId)) || "MOTEXA",
      action: approved ? "APPROVED" : "REJECTED",
      ...(!approved && reason ? { reason } : {}),
    };
  });
}

async function trucksWithHistory(trucks: TruckRow[]) {
  const h = await historyFor(trucks.map((t) => t.id));
  return trucks.map((t) => shapeTruck(t, h.get(t.id) ?? []));
}

const oneTruck = async (id: string) => (await trucksWithHistory(await loadTrucks({ id })))[0];

// ---- vehicle input ----

type Vehicle = { plateNumber: string; make: string; model: string; year: number | null; truckType: (typeof TRUCK_TYPES)[number]; maxWeightKg: number | null };

/** Returns the validated fields that were sent, or an error message. `full` requires all of them. */
function parseVehicle(body: any, full: boolean): { data: Partial<Vehicle> } | { error: string } {
  const data: Partial<Vehicle> = {};
  const has = (k: string) => body && Object.prototype.hasOwnProperty.call(body, k);

  if (has("plateNumber")) {
    const v = text(body.plateNumber, 20);
    if (!v) return { error: "Plate number is required." };
    data.plateNumber = v;
  }
  if (has("make")) {
    const v = text(body.make, 60);
    if (!v) return { error: "Make is required." };
    data.make = v;
  }
  if (has("model")) {
    const v = text(body.model, 60);
    if (!v) return { error: "Model is required." };
    data.model = v;
  }
  if (has("year")) {
    const y = body.year;
    if (y !== null && !(Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1)) return { error: "Year is invalid." };
    data.year = y;
  }
  if (has("maxWeightKg")) {
    const w = body.maxWeightKg;
    if (w !== null && !(Number.isInteger(w) && w >= 500 && w <= 60000)) return { error: "Max load must be a whole number of kg between 500 and 60000." };
    data.maxWeightKg = w;
  }
  if (has("truckType")) {
    if (!TRUCK_TYPES.includes(body.truckType)) return { error: "Truck type is invalid." };
    data.truckType = body.truckType;
  }
  if (full) {
    for (const k of ["plateNumber", "make", "model", "truckType"] as const) if (data[k] === undefined) return { error: `${k} is required.` };
    if (data.year === undefined) data.year = null;
    if (data.maxWeightKg === undefined) data.maxWeightKg = null;
  }
  return { data };
}

const plateTaken = async (plate: string, exceptId?: string) =>
  !!(await prisma.truck.findFirst({
    where: { plateNumber: { equals: plate, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  }));

// ---- file input: { photo?: {name,dataBase64}, documents?: [{kind, name?, dataBase64?, expiresAt?}] } ----

type DocChange = { kind: DocKind; file: ParsedUpload | null; expiry: { set: boolean; date: Date | null } };
type FileInput = { photo: ParsedUpload | null; docs: DocChange[] };

function parseFiles(body: any): FileInput | { error: string } {
  const out: FileInput = { photo: null, docs: [] };
  if (body?.photo !== undefined && body.photo !== null) {
    const p = parseUpload(body.photo, "truck-photo");
    if ("error" in p) return { error: `Truck photo: ${p.error}` };
    out.photo = p.file;
  }
  if (body?.documents !== undefined) {
    if (!Array.isArray(body.documents) || body.documents.length > 2) return { error: "Documents are invalid." };
    for (const d of body.documents as any[]) {
      const kind = d?.kind as DocKind;
      if (!(kind in DOC_KINDS)) return { error: "Document kind must be REGISTRATION or INSURANCE." };
      if (out.docs.some((x) => x.kind === kind)) return { error: `Duplicate ${kind} document.` };
      let file: ParsedUpload | null = null;
      if (d.dataBase64 !== undefined && d.dataBase64 !== null) {
        const p = parseUpload(d, `${kind.toLowerCase()}.jpg`);
        if ("error" in p) return { error: `${kind} document: ${p.error}` };
        file = p.file;
      }
      const hasExpiry = Object.prototype.hasOwnProperty.call(d, "expiresAt");
      const e = parseExpiry(d.expiresAt);
      if ("error" in e) return { error: `${kind} document: ${e.error}` };
      if (!file && !hasExpiry) return { error: `${kind} document has no file or expiry date.` };
      out.docs.push({ kind, file, expiry: { set: hasExpiry, date: e.date } });
    }
  }
  return out;
}

// =====================================================================
// Tow company (TOW_PROVIDER)
// =====================================================================
const provider = [requireAuth, requireTowProvider, express.json({ limit: "25mb" })];

/** A rejected company can't create or edit trucks (a pending one can: it prepares its fleet before approval). */
const REJECTED_MSG = "Your company application was rejected. You cannot add or edit trucks.";

async function myCompany(res: any) {
  const user = res.locals.authUser as { id: string };
  const c = await loadCompany({ userId: user.id });
  if (!c) bad(res, 404, "No tow company is linked to this account.");
  return c;
}

router.get("/tow/me/company", ...provider, async (_req, res) => {
  try {
    const c = await myCompany(res);
    if (!c) return;
    return res.json({ success: true, company: shapeCompany(c) });
  } catch (e) {
    return fail(res, "Tow company error", e);
  }
});

/**
 * Public profile text. These are not verification fields, so the status is never touched. Only the fields sent
 * change; companyName, licence number, phone and city are not editable here.
 */
router.patch("/tow/me/company", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const c = await myCompany(res);
    if (!c) return;
    if (c.verificationStatus === "REJECTED") return bad(res, 403, "Your company application was rejected. You cannot edit the profile.");
    const b = req.body ?? {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    const data: Prisma.TowCompanyProfileUpdateInput = {};
    const optText = (k: string, max: number, label: string) => {
      const v = b[k];
      if (v === null || v === "") return null;
      if (typeof v !== "string") throw new Error(`${label} must be text.`);
      if (v.trim().length > max) throw new Error(`${label} is too long (max ${max} characters).`);
      return v.trim() || null;
    };
    try {
      if (has("description")) data.description = optText("description", 600, "Description");
      if (has("address")) data.address = optText("address", 200, "Address");
      if (has("workingHours")) data.workingHours = optText("workingHours", 100, "Working hours");
    } catch (e) {
      return bad(res, 400, (e as Error).message);
    }
    if (has("serviceCities")) {
      if (!Array.isArray(b.serviceCities)) return bad(res, 400, "serviceCities must be a list.");
      const cities: string[] = [];
      for (const v of b.serviceCities) {
        const name = canonicalCity(v);
        if (!name) return bad(res, 400, "Unknown city in serviceCities. Choose from the list.");
        if (!cities.includes(name)) cities.push(name);
      }
      if (cities.length > 10) return bad(res, 400, "Choose at most 10 service cities.");
      data.serviceCities = cities;
    }
    const fields = Object.keys(data);
    if (!fields.length) return bad(res, 400, "Nothing to update.");
    await prisma.$transaction(async (tx) => {
      await tx.towCompanyProfile.update({ where: { id: c.id }, data });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "TOW_COMPANY_PROFILE_UPDATED", targetId: c.id, details: { fields } } });
    });
    const fresh = await loadCompany({ id: c.id });
    return res.json({ success: true, company: shapeCompany(fresh!) });
  } catch (e) {
    return fail(res, "Tow company update error", e);
  }
});

router.get("/tow/me/trucks", ...provider, async (_req, res) => {
  try {
    const c = await myCompany(res);
    if (!c) return;
    return res.json({ success: true, trucks: await trucksWithHistory(await loadTrucks({ companyId: c.id })) });
  } catch (e) {
    return fail(res, "Tow trucks error", e);
  }
});

/** 404 (not 403) for a truck that belongs to another company, so ids can't be probed. */
async function ownTruck(req: any, res: any) {
  const c = await myCompany(res);
  if (!c) return null;
  const [t] = await loadTrucks({ id: idParam(req.params.id), companyId: c.id });
  if (!t) {
    bad(res, 404, "Truck not found.");
    return null;
  }
  return { company: c, truck: t };
}

router.get("/tow/me/trucks/:id", ...provider, async (req, res) => {
  try {
    const own = await ownTruck(req, res);
    if (!own) return;
    return res.json({ success: true, truck: (await trucksWithHistory([own.truck]))[0] });
  } catch (e) {
    return fail(res, "Tow truck error", e);
  }
});

router.post("/tow/me/trucks", ...provider, async (req, res) => {
  const written: string[] = [];
  try {
    const actor = res.locals.authUser as { id: string };
    const c = await myCompany(res);
    if (!c) return;
    if (c.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    const parsed = parseVehicle(req.body, true);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const v = parsed.data as Vehicle;
    const files = parseFiles(req.body);
    if ("error" in files) return bad(res, 400, files.error);
    for (const d of files.docs) if (!d.file) return bad(res, 400, `A new truck needs the ${d.kind} file, not only a date.`);
    if (await plateTaken(v.plateNumber)) return bad(res, 409, "A truck with this plate already exists.");

    // Write the files first; the rows are created in one transaction with the truck.
    const rows: Prisma.ProviderFileCreateWithoutTruckInput[] = [];
    const add = async (purpose: "TRUCK_PHOTO" | "TRUCK_REGISTRATION" | "TRUCK_INSURANCE", f: ParsedUpload, expiresAt: Date | null) => {
      const storageKey = await storeFile(f);
      written.push(storageKey);
      rows.push({
        owner: { connect: { id: actor.id } },
        purpose,
        visibility: purpose === "TRUCK_PHOTO" ? "PUBLIC" : "PRIVATE",
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.buffer.length,
        storageKey,
        sha256: f.sha256,
        expiresAt,
      });
    };
    if (files.photo) await add("TRUCK_PHOTO", files.photo, null);
    for (const d of files.docs) await add(DOC_KINDS[d.kind], d.file!, d.expiry.date);

    // Status fields are never taken from the body: always PENDING / OUT_OF_SERVICE.
    const truck = await prisma.$transaction(async (tx) => {
      const created = await tx.truck.create({
        data: { ...v, companyId: c.id, verificationStatus: "PENDING", operationalStatus: "OUT_OF_SERVICE", files: { create: rows } },
      });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: "TOW_TRUCK_CREATED", targetId: created.id, details: { plateNumber: created.plateNumber, files: rows.length } },
      });
      return created;
    });
    return res.status(201).json({ success: true, truck: await oneTruck(truck.id) });
  } catch (e) {
    await removeStoredFiles(written);
    if ((e as { code?: string })?.code === "P2002") return bad(res, 409, "A truck with this plate already exists.");
    return fail(res, "Tow truck create error", e);
  }
});

router.patch("/tow/me/trucks/:id", ...provider, async (req, res) => {
  const written: string[] = [];
  try {
    const actor = res.locals.authUser as { id: string };
    const own = await ownTruck(req, res);
    if (!own) return;
    if (own.company.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    const t = own.truck;
    if (t.towRequests.length) return bad(res, 409, "This truck is on an active job. It cannot be edited until the job ends.");
    const parsed = parseVehicle(req.body, false);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const data = parsed.data;
    const files = parseFiles(req.body);
    if ("error" in files) return bad(res, 400, files.error);
    if (!Object.keys(data).length && !files.photo && !files.docs.length) return bad(res, 400, "Nothing to update.");

    const changedVehicle = (Object.keys(data) as (keyof Vehicle)[]).filter((k) => data[k] !== t[k]);
    if (data.plateNumber && data.plateNumber.toLowerCase() !== t.plateNumber.toLowerCase() && (await plateTaken(data.plateNumber, t.id)))
      return bad(res, 409, "A truck with this plate already exists.");

    // Work out which files really change. An expiry sent without a file only counts when the date differs.
    const byPurpose = new Map(t.files.map((f) => [f.purpose, f]));
    const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
    type Op = { purpose: "TRUCK_PHOTO" | "TRUCK_REGISTRATION" | "TRUCK_INSURANCE"; file: ParsedUpload | null; expiresAt: Date | null; storageKey?: string };
    const ops: Op[] = [];
    if (files.photo) ops.push({ purpose: "TRUCK_PHOTO", file: files.photo, expiresAt: null });
    for (const d of files.docs) {
      const purpose = DOC_KINDS[d.kind];
      const existing = byPurpose.get(purpose);
      if (d.file) ops.push({ purpose, file: d.file, expiresAt: d.expiry.set ? d.expiry.date : (existing?.expiresAt ?? null) });
      else {
        if (!existing) return bad(res, 400, `There is no ${d.kind} document to update yet. Send the file.`);
        if (day(existing.expiresAt) !== day(d.expiry.date)) ops.push({ purpose, file: null, expiresAt: d.expiry.date });
      }
    }

    if (!changedVehicle.length && !ops.length) return res.json({ success: true, truck: (await trucksWithHistory([t]))[0] });

    for (const op of ops) {
      if (!op.file) continue;
      const storageKey = await storeFile(op.file);
      written.push(storageKey);
      op.storageKey = storageKey;
    }

    // Changing vehicle details, the photo or a document sends an approved/rejected truck back to review.
    const resubmit = t.verificationStatus !== "PENDING";
    const oldKeys: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const op of ops) {
        const existing = byPurpose.get(op.purpose);
        if (op.file) {
          if (existing) {
            await tx.providerFile.delete({ where: { id: existing.id } });
            oldKeys.push(existing.storageKey);
          }
          await tx.providerFile.create({
            data: {
              ownerUserId: actor.id,
              truckId: t.id,
              purpose: op.purpose,
              visibility: op.purpose === "TRUCK_PHOTO" ? "PUBLIC" : "PRIVATE",
              originalName: op.file.originalName,
              mimeType: op.file.mimeType,
              sizeBytes: op.file.buffer.length,
              storageKey: op.storageKey!,
              sha256: op.file.sha256,
              expiresAt: op.expiresAt,
            },
          });
        } else if (existing) {
          await tx.providerFile.update({ where: { id: existing.id }, data: { expiresAt: op.expiresAt } });
        }
      }
      await tx.truck.update({
        where: { id: t.id },
        data: {
          ...data,
          ...(resubmit ? { verificationStatus: "PENDING" as const, rejectionReason: null, reviewedById: null, reviewedAt: null } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "TOW_TRUCK_EDITED",
          targetId: t.id,
          details: { fields: [...changedVehicle, ...ops.map((o) => (o.file ? `file:${o.purpose}` : `expiry:${o.purpose}`))], resubmitted: resubmit },
        },
      });
    });
    await removeStoredFiles(oldKeys); // exact replaced files only
    return res.json({ success: true, truck: await oneTruck(t.id) });
  } catch (e) {
    await removeStoredFiles(written);
    if ((e as { code?: string })?.code === "P2002") return bad(res, 409, "A truck with this plate already exists.");
    return fail(res, "Tow truck update error", e);
  }
});

router.patch("/tow/me/trucks/:id/status", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const own = await ownTruck(req, res);
    if (!own) return;
    const t = own.truck;
    const next = req.body?.operationalStatus;
    if (!OPERATIONAL.includes(next)) return bad(res, 400, "Operational status is invalid.");
    if (t.verificationStatus !== "APPROVED") return bad(res, 409, "Only an approved truck can change its operational status.");
    if (t.towRequests.length) return bad(res, 409, "This truck is on an active job. Its status changes when the job ends.");

    await prisma.$transaction([
      prisma.truck.update({ where: { id: t.id }, data: { operationalStatus: next } }),
      log(actor.id, "TOW_TRUCK_STATUS_CHANGED", t.id, { from: t.operationalStatus, to: next }),
    ]);
    return res.json({ success: true, truck: await oneTruck(t.id) });
  } catch (e) {
    return fail(res, "Tow truck status error", e);
  }
});

router.delete("/tow/me/trucks/:id", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const own = await ownTruck(req, res);
    if (!own) return;
    const t = own.truck;
    if (t.operationalStatus === "BUSY" || t.towRequests.length) return bad(res, 409, "This truck is engaged in a service and cannot be removed.");

    const keys = t.files.map((f) => f.storageKey);
    await prisma.$transaction([
      log(actor.id, "TOW_TRUCK_REMOVED", t.id, { plateNumber: t.plateNumber, files: keys.length }),
      prisma.truck.delete({ where: { id: t.id } }), // file rows go with it (cascade)
    ]);
    await removeStoredFiles(keys); // exactly this truck's files
    return res.json({ success: true });
  } catch (e) {
    return fail(res, "Tow truck delete error", e);
  }
});

// =====================================================================
// Admin (SUPER_ADMIN or ADMIN + MANAGE_TOWING): decisions only
// =====================================================================
const admin = [requireAuth, requireTowAdmin, express.json()];

// List. ?status=PENDING|APPROVED|REJECTED (company) & ?q= (company name or any truck plate)
router.get("/admin/tow/companies", ...admin, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !FILTERS.includes(status as never)) return bad(res, 400, "Invalid status filter.");
    const q = text(req.query.q, 100);

    const companies = await prisma.towCompanyProfile.findMany({
      where: {
        ...(status ? { verificationStatus: status as (typeof FILTERS)[number] } : {}),
        ...(q
          ? {
              OR: [
                { companyName: { contains: q, mode: "insensitive" } },
                { trucks: { some: { plateNumber: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { fullName: true, email: true } },
        files: { where: { purpose: "TOW_COMPANY_DOCUMENT" }, orderBy: { createdAt: "asc" } },
        trucks: { select: { verificationStatus: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({
      success: true,
      companies: companies.map(({ trucks, ...c }) => ({
        ...shapeCompany(c),
        truckCount: trucks.length,
        pendingTruckCount: trucks.filter((t) => t.verificationStatus === "PENDING").length,
      })),
    });
  } catch (e) {
    return fail(res, "Tow admin list error", e);
  }
});

// Flat truck list (for plate / type search on the list screen). ?q= plate
router.get("/admin/tow/trucks", ...admin, async (req, res) => {
  try {
    const q = text(req.query.q, 20);
    const trucks = await loadTrucks(q ? { plateNumber: { contains: q, mode: "insensitive" } } : {});
    return res.json({ success: true, trucks: trucks.map((t) => shapeTruck(t)) });
  } catch (e) {
    return fail(res, "Tow admin trucks error", e);
  }
});

router.get("/admin/tow/companies/:id", ...admin, async (req, res) => {
  try {
    const c = await loadCompany({ id: idParam(req.params.id) });
    if (!c) return bad(res, 404, "Company not found.");
    return res.json({
      success: true,
      company: shapeCompany(c),
      companyHistory: await companyHistory(c.id),
      trucks: await trucksWithHistory(await loadTrucks({ companyId: c.id })),
    });
  } catch (e) {
    return fail(res, "Tow admin company error", e);
  }
});

/** Shared body check: { decision: APPROVED|REJECTED, reason? }, reason required for REJECTED. */
function parseDecision(body: any): { decision: Decision; reason: string | null } | { error: string } {
  const decision = body?.decision;
  if (!DECISIONS.includes(decision)) return { error: "Decision must be APPROVED or REJECTED." };
  const reason = text(body?.reason, 1000);
  if (decision === "REJECTED" && !reason) return { error: "A rejection reason is required." };
  return { decision, reason: decision === "REJECTED" ? reason : null };
}

router.patch("/admin/tow/companies/:id/decision", ...admin, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const parsed = parseDecision(req.body);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const c = await prisma.towCompanyProfile.findUnique({ where: { id: idParam(req.params.id) }, select: { id: true } });
    if (!c) return bad(res, 404, "Company not found.");

    await prisma.$transaction([
      prisma.towCompanyProfile.update({
        where: { id: c.id },
        data: { verificationStatus: parsed.decision, rejectionReason: parsed.reason, reviewedById: actor.id, reviewedAt: new Date() },
      }),
      log(actor.id, `TOW_COMPANY_${parsed.decision}`, c.id, { reason: parsed.reason }),
    ]);
    const updated = await loadCompany({ id: c.id });
    return res.json({ success: true, company: shapeCompany(updated!) });
  } catch (e) {
    return fail(res, "Tow company decision error", e);
  }
});

router.patch("/admin/tow/trucks/:id/decision", ...admin, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const parsed = parseDecision(req.body);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const [t] = await loadTrucks({ id: idParam(req.params.id) });
    if (!t) return bad(res, 404, "Truck not found.");

    // Approval needs the photo and both documents. Expired documents don't block (they are flagged); rejecting is always allowed.
    if (parsed.decision === "APPROVED") {
      const missing = missingFor(t);
      if (missing.length) return bad(res, 409, `Cannot approve this truck. Missing: ${missing.join(", ")}.`);
    }

    await prisma.$transaction([
      prisma.truck.update({
        where: { id: t.id },
        data: {
          verificationStatus: parsed.decision,
          rejectionReason: parsed.reason,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          // A rejected truck can't stay marked as available for work.
          ...(parsed.decision === "REJECTED" ? { operationalStatus: "OUT_OF_SERVICE" as const } : {}),
        },
      }),
      log(actor.id, `TOW_TRUCK_${parsed.decision}`, t.id, { reason: parsed.reason }),
    ]);
    return res.json({ success: true, truck: await oneTruck(t.id) });
  } catch (e) {
    return fail(res, "Tow truck decision error", e);
  }
});

export default router;
