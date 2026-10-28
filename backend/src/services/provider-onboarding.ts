// Provider onboarding (tow companies and parts shops): ONE set of rules for both kinds.
// Pattern follows the mechanic onboarding: register -> DRAFT -> fill in -> submit -> admin review -> NEEDS_CHANGES / APPROVED / REJECTED.
// PENDING in the enum means "submitted, waiting for review".
import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { canonicalCity } from "../cities.js";
import { type ParsedUpload } from "../uploads/providerFiles.js";

export type Kind = "TOW" | "PARTS";
export const ROLE_OF: Record<Kind, "TOW_PROVIDER" | "PARTS_PROVIDER"> = { TOW: "TOW_PROVIDER", PARTS: "PARTS_PROVIDER" };
export const PERMISSION_OF: Record<Kind, "MANAGE_TOWING" | "MANAGE_SPARE_PARTS"> = { TOW: "MANAGE_TOWING", PARTS: "MANAGE_SPARE_PARTS" };
export const PURPOSE_OF: Record<Kind, "TOW_COMPANY_DOCUMENT" | "PARTS_SHOP_DOCUMENT"> = { TOW: "TOW_COMPANY_DOCUMENT", PARTS: "PARTS_SHOP_DOCUMENT" };

/** Documents the owner uploads for the business itself. Vehicle documents belong to each truck (existing truck endpoints). */
export const COMPANY_DOC_KINDS: Record<Kind, readonly string[]> = {
  TOW: ["COMMERCIAL_REGISTRATION", "OWNER_ID", "DRIVER_LICENCE"],
  PARTS: ["COMMERCIAL_REGISTRATION", "TRADE_LICENCE", "OWNER_ID"],
};

export const EDITABLE = ["DRAFT", "NEEDS_CHANGES"] as const;
export const isEditable = (s: string) => (EDITABLE as readonly string[]).includes(s);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
export const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---------------------------------------------------------------- application load / shape
export const towInclude = {
  user: { select: { id: true, fullName: true, email: true } },
  files: { orderBy: { createdAt: "asc" } },
  trucks: { include: { files: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.TowCompanyProfileInclude;
export const shopInclude = {
  user: { select: { id: true, fullName: true, email: true } },
  files: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.PartsShopProfileInclude;

export type TowApp = Prisma.TowCompanyProfileGetPayload<{ include: typeof towInclude }>;
export type ShopApp = Prisma.PartsShopProfileGetPayload<{ include: typeof shopInclude }>;
export type App = { kind: "TOW"; row: TowApp } | { kind: "PARTS"; row: ShopApp };

export async function loadApp(kind: Kind, where: { id?: string; userId?: string }): Promise<App | null> {
  if (kind === "TOW") {
    const row = await prisma.towCompanyProfile.findFirst({ where, include: towInclude });
    return row ? { kind, row } : null;
  }
  const row = await prisma.partsShopProfile.findFirst({ where, include: shopInclude });
  return row ? { kind, row } : null;
}

const fileUri = (f: { id: string; visibility: string }) => `/files/${f.visibility === "PUBLIC" ? "public" : "private"}/${f.id}`;

type FileRow = TowApp["files"][number];
export const shapeFile = (f: FileRow) => ({
  id: f.id,
  kind: f.docKind ?? f.purpose,
  purpose: f.purpose,
  fileName: f.originalName,
  mimeType: f.mimeType,
  sizeBytes: f.sizeBytes,
  expiresAt: f.expiresAt ? f.expiresAt.toISOString() : null,
  status: f.reviewStatus,
  reason: f.reviewReason,
  uri: fileUri(f),
  createdAt: f.createdAt.toISOString(),
});

const companyDocs = (app: App) => app.row.files.filter((f) => f.purpose === PURPOSE_OF[app.kind] && !f.messageId);

const truckDocFiles = (t: TowApp["trucks"][number]) => t.files.filter((f) => ["TRUCK_PHOTO", "TRUCK_REGISTRATION", "TRUCK_INSURANCE", "TRUCK_OPERATING_LICENSE"].includes(f.purpose));

export function shapeTrucks(app: TowApp) {
  return app.trucks.map((t) => ({
    id: t.id,
    plate: t.plateNumber,
    type: t.truckType,
    make: t.make,
    model: t.model,
    year: t.year,
    baseLat: t.baseLat,
    baseLng: t.baseLng,
    locationAddress: t.locationAddress,
    verification: t.verificationStatus,
    documents: truckDocFiles(t).map(shapeFile),
  }));
}

export function shapeInfo(app: App) {
  if (app.kind === "TOW") {
    const c = app.row;
    return {
      name: c.companyName,
      nameAr: c.companyNameAr,
      ownerName: c.ownerName ?? c.user.fullName,
      phone: c.phone,
      city: c.city,
      address: c.address,
      serviceCities: c.serviceCities,
      baseLat: c.baseLat,
      baseLng: c.baseLng,
      open24h: c.open24h,
      workingHours: c.workingHours,
      truckTypes: c.truckTypes,
      truckCountClaimed: c.truckCountClaimed,
      description: c.description,
    };
  }
  const s = app.row;
  return {
    name: s.shopName,
    nameAr: s.shopNameAr,
    ownerName: s.ownerName ?? s.user.fullName,
    phone: s.phone,
    city: s.city,
    address: s.address,
    baseLat: s.baseLat,
    baseLng: s.baseLng,
    brandName: s.brandName,
    branchName: s.branchName,
    locationAddress: s.locationAddress,
    locationSource: s.locationSource,
    categories: s.categories,
    brands: s.brands,
    workingHours: s.workingHours,
  };
}

// ---------------------------------------------------------------- the approval checklist (enforced by the server)
export type CheckItem = { key: string; ok: boolean; detail?: string };

export function checklist(app: App): CheckItem[] {
  const items: CheckItem[] = [];
  const row = app.row;
  items.push({ key: "phone", ok: /^\+?[0-9 ()-]{8,24}$/.test(row.phone ?? "") });
  items.push({ key: "location", ok: row.baseLat !== null && row.baseLng !== null });
  const docs = companyDocs(app);
  for (const kind of COMPANY_DOC_KINDS[app.kind]) {
    const d = docs.find((f) => f.docKind === kind);
    items.push({ key: `doc:${kind}`, ok: d?.reviewStatus === "ACCEPTED", detail: d ? d.reviewStatus : "MISSING" });
  }
  if (app.kind === "TOW") {
    const good = app.row.trucks.filter(truckQualifies);
    items.push({ key: "truck", ok: good.length > 0, detail: `${good.length}/${app.row.trucks.length}` });
  } else {
    items.push({ key: "category", ok: app.row.categories.length > 0 });
  }
  return items;
}

/** A truck counts when its photo and vehicle licence are ACCEPTED, plus its insurance or (new signup) its operating licence. */
export function truckQualifies(t: TowApp["trucks"][number]) {
  const ok = (purpose: string) => t.files.some((f) => f.purpose === purpose && f.reviewStatus === "ACCEPTED");
  return ok("TRUCK_PHOTO") && ok("TRUCK_REGISTRATION") && (ok("TRUCK_INSURANCE") || ok("TRUCK_OPERATING_LICENSE"));
}

/** What the owner still has to provide before submitting (completeness, not the admin's judgement). */
export function missingForSubmit(app: App): string[] {
  const out: string[] = [];
  const r = app.row as TowApp & ShopApp;
  if (!r.phone || !/^\+?[0-9 ()-]{8,24}$/.test(r.phone)) out.push("phone");
  if (!r.city) out.push("city");
  if (r.baseLat === null || r.baseLng === null) out.push("location");
  const docs = companyDocs(app);
  for (const kind of COMPANY_DOC_KINDS[app.kind]) if (!docs.some((f) => f.docKind === kind)) out.push(`doc:${kind}`);
  if (app.kind === "TOW") {
    const t = app.row as TowApp;
    if (!t.ownerName) out.push("ownerName");
    if (!t.open24h && !t.workingHours) out.push("workingHours");
    if (!t.serviceCities.length) out.push("serviceCities");
    if (!t.truckTypes.length) out.push("truckTypes");
    const has = (x: TowApp["trucks"][number], p: string) => x.files.some((f) => f.purpose === p);
    const complete = t.trucks.filter((x) => has(x, "TRUCK_PHOTO") && has(x, "TRUCK_REGISTRATION") && (has(x, "TRUCK_INSURANCE") || has(x, "TRUCK_OPERATING_LICENSE")));
    if (!complete.length) out.push("truck");
  } else {
    const s = app.row as ShopApp;
    if (!s.ownerName) out.push("ownerName");
    if (!s.address) out.push("address");
    if (!s.categories.length) out.push("category");
    if (!s.workingHours) out.push("workingHours");
  }
  if (app.kind === "PARTS" && !app.row.files.some((f) => f.purpose === "PARTS_SHOP_DOCUMENT" && f.docKind === "STOREFRONT_PHOTO")) out.push("doc:STOREFRONT_PHOTO");
  return out;
}

// ---------------------------------------------------------------- uploads: JPEG, PNG or PDF, max 5 MB, sniffed from the bytes
export const MAX_DOC_BYTES = 5 * 1024 * 1024;
const MAX_B64 = Math.ceil((MAX_DOC_BYTES * 4) / 3) + 8;

export function parseDocUpload(input: unknown, allowPdf = true): ParsedUpload {
  const o = input as { name?: unknown; dataBase64?: unknown } | null;
  if (!o || typeof o.dataBase64 !== "string" || !o.dataBase64) return fail(400, "File data is missing.");
  if (o.dataBase64.length > MAX_B64) return fail(400, "Each file must be a JPEG, PNG or PDF of at most 5 MB.");
  const buffer = Buffer.from(o.dataBase64, "base64");
  if (!buffer.length || buffer.length > MAX_DOC_BYTES) return fail(400, "Each file must be a JPEG, PNG or PDF of at most 5 MB.");
  let mime: string, ext: string;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) [mime, ext] = ["image/jpeg", "jpg"];
  else if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) [mime, ext] = ["image/png", "png"];
  else if (allowPdf && buffer.subarray(0, 5).toString("latin1") === "%PDF-") [mime, ext] = ["application/pdf", "pdf"];
  else return fail(400, allowPdf ? "Only JPEG, PNG or PDF files are accepted." : "Only JPEG or PNG images are accepted.");
  const base = typeof o.name === "string" ? (o.name.split(/[\\/]/).pop() ?? "") : "";
  const originalName = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120) || `file.${ext}`;
  return { buffer, mimeType: mime, ext, originalName, sha256: createHash("sha256").update(buffer).digest("hex") };
}

export function parseExpiryDate(v: unknown): Date | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(400, "Expiry date must use YYYY-MM-DD.");
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return fail(400, "Expiry date is not a real calendar date.");
  return d;
}

export function readPoint(b: any, latKey: string, lngKey: string): { lat: number | null; lng: number | null } {
  const lat = b[latKey];
  const lng = b[lngKey];
  if (lat === null && lng === null) return { lat: null, lng: null };
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return fail(400, "Location is invalid.");
  return { lat, lng };
}

export const cleanCities = (v: unknown, max = 10): string[] => {
  if (!Array.isArray(v)) return fail(400, "Cities must be a list.");
  const out: string[] = [];
  for (const x of v) {
    const c = canonicalCity(x);
    if (!c) return fail(400, "Unknown city. Choose from the list.");
    if (!out.includes(c)) out.push(c);
  }
  if (out.length > max) return fail(400, `Choose at most ${max} cities.`);
  return out;
};

// ---------------------------------------------------------------- notifications + messages
/** Notification text is stored as "English||العربية"; the app shows the part for the current language. */
const both = (en: string, ar: string) => `${en}||${ar}`;

export async function notify(userIds: string[], title: [string, string], body: [string, string]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title: both(...title), body: both(...body) })) });
}

/** Active admins of the department + every active super admin. */
export async function adminIds(kind: Kind): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ role: "SUPER_ADMIN" }, { role: "ADMIN", adminPermissions: { some: { permission: PERMISSION_OF[kind] } } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export const threadWhere = (app: App): Prisma.ProviderMessageWhereInput => (app.kind === "TOW" ? { towCompanyId: app.row.id } : { partsShopId: app.row.id });

export async function postMessage(app: App, input: { authorUserId: string | null; role: "PROVIDER" | "ADMIN" | "SYSTEM"; body: string; file?: ParsedUpload; storageKey?: string }) {
  const where = app.kind === "TOW" ? { towCompanyId: app.row.id } : { partsShopId: app.row.id };
  const msg = await prisma.providerMessage.create({
    data: {
      ...where,
      authorUserId: input.authorUserId,
      authorRole: input.role,
      body: input.body,
      // the author has obviously read their own message
      ...(input.role === "PROVIDER" ? { readByProviderAt: new Date() } : input.role === "ADMIN" ? { readByAdminAt: new Date() } : {}),
    },
  });
  if (input.file && input.storageKey) {
    await prisma.providerFile.create({
      data: {
        ownerUserId: app.row.userId,
        purpose: "MESSAGE_ATTACHMENT",
        visibility: "PRIVATE",
        ...where,
        messageId: msg.id,
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
        sizeBytes: input.file.buffer.length,
        storageKey: input.storageKey,
        sha256: input.file.sha256,
      },
    });
  }
  return msg;
}

export async function loadThread(app: App) {
  const rows = await prisma.providerMessage.findMany({
    where: threadWhere(app),
    include: { attachments: true, author: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  return rows.map((m) => ({
    id: m.id,
    from: m.authorRole,
    author: m.authorRole === "SYSTEM" ? "MOTEXA" : (m.author?.fullName ?? "MOTEXA"),
    body: m.body,
    at: m.createdAt.toISOString(),
    attachments: m.attachments.map((a) => ({ id: a.id, fileName: a.originalName, mimeType: a.mimeType, uri: fileUri(a) })),
  }));
}

export const audit = (actorId: string | null, action: string, targetId: string, details: Prisma.InputJsonValue = {}) =>
  prisma.auditLog.create({ data: { actorId, action, targetId, details } });

export async function timeline(targetId: string) {
  const rows = await prisma.auditLog.findMany({ where: { targetId, action: { startsWith: "PROVIDER_" } }, orderBy: { createdAt: "asc" }, take: 100 });
  const ids = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, role: true } });
  const by = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    at: r.createdAt.toISOString(),
    action: r.action.replace("PROVIDER_", ""),
    actor: (r.actorId && by.get(r.actorId)?.fullName) || "MOTEXA",
    details: r.details,
  }));
}

// ---------------------------------------------------------------- gate: provider actions only after APPROVED
/** Use after requireAuth. The provider can log in and prepare the application, but cannot act as a provider until approved. */
export async function requireApprovedProvider(_req: Request, res: Response, next: NextFunction) {
  try {
    const u = res.locals.authUser as { id: string; role: string } | undefined;
    let status: string | undefined;
    if (u?.role === "TOW_PROVIDER") status = (await prisma.towCompanyProfile.findUnique({ where: { userId: u.id }, select: { verificationStatus: true } }))?.verificationStatus;
    else if (u?.role === "PARTS_PROVIDER") status = (await prisma.partsShopProfile.findUnique({ where: { userId: u.id }, select: { verificationStatus: true } }))?.verificationStatus;
    if (status !== "APPROVED") {
      res.status(403).json({ success: false, message: "Your application has not been approved yet." });
      return;
    }
    next();
  } catch (e) {
    console.error("Approved provider check error:", e);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

export function sendError(res: Response, e: unknown, label: string) {
  if (e instanceof HttpError) return res.status(e.status).json({ success: false, message: e.message });
  console.error(label, e);
  return res.status(500).json({ success: false, message: "Internal server error." });
}
