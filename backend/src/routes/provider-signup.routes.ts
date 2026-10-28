// Tow company signup in ONE request (steps 1-5 of the app flow). The mobile app keeps the whole application in memory and sends it here
// at the end, so there is never a half-created provider:
//   1. the whole body is validated first (nothing is written yet),
//   2. every file is written to storage,
//   3. the user, company, trucks and file rows are created in ONE database transaction,
//   4. if anything fails, the transaction rolls back and the files from step 2 are deleted.
// The result is a normal ACTIVE account whose company application is PENDING (submitted, waiting for the Tow Admin). It is never
// approved here and cannot receive requests until a Tow Admin approves it (requireApprovedProvider).
// Mounted BEFORE the global JSON parser: the body carries base64 files and has its own (larger) limit, applied after the rate limit.
import express, { Router, type NextFunction, type Request, type Response } from "express";
import argon2 from "argon2";
import { prisma } from "../prisma.js";
import { canonicalCity } from "../cities.js";
import { GEO_BOX_MESSAGE, inBox } from "../geo.js";
import { CATEGORY_KEYS } from "../catalogCategories.js";
import { type ParsedUpload, parseUpload, removeStoredFiles, storeFile } from "../uploads/providerFiles.js";
import {
  COMPANY_DOC_KINDS,
  HttpError,
  adminIds,
  audit,
  fail,
  loadApp,
  notify,
  parseDocUpload,
  parseExpiryDate,
  postMessage,
  sendError,
  text,
} from "../services/provider-onboarding.js";

const attempts = new Map<string, { start: number; count: number }>();
function limit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, v] of attempts) if (now - v.start > 3600000) attempts.delete(key);
  const key = req.ip || "unknown";
  const v = attempts.get(key) || { start: now, count: 0 };
  if (v.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) {
    res.status(429).json({ success: false, message: "Too many registration attempts. Try again later." });
    return;
  }
  v.count++;
  attempts.set(key, v);
  next();
}

const MAX_TRUCKS = 10;
const TRUCK_TYPES = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"] as const;
const SOURCES = ["current_location", "manual"] as const;
type TruckType = (typeof TRUCK_TYPES)[number];

type Place = { lat: number; lng: number; address: string | null; source: string | null };
const readPlace = (v: unknown, label: string): Place => {
  const o = v as { lat?: unknown; lng?: unknown; address?: unknown; source?: unknown } | null;
  if (!o || typeof o.lat !== "number" || typeof o.lng !== "number" || !Number.isFinite(o.lat) || !Number.isFinite(o.lng) || (o.lat === 0 && o.lng === 0)) return fail(400, `${label}: a confirmed location is required.`);
  if (!inBox(o.lat, o.lng)) return fail(400, `${label}: ${GEO_BOX_MESSAGE}`);
  const address = text(o.address, 200) || null;
  const source = typeof o.source === "string" && (SOURCES as readonly string[]).includes(o.source) ? o.source : null;
  return { lat: o.lat, lng: o.lng, address, source };
};

/** A document file with a clear message about which one failed. */
const readDoc = (v: unknown, label: string, allowPdf = true): ParsedUpload => {
  try {
    return parseDocUpload(v, allowPdf);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, `${label}: ${e.message}`);
    throw e;
  }
};
const readPhoto = (v: unknown, label: string): ParsedUpload => {
  const r = parseUpload(v, "truck-photo.jpg");
  return "error" in r ? fail(400, `${label}: ${r.error}`) : r.file;
};
/** Required expiry date, YYYY-MM-DD, today or later. */
const readExpiry = (v: unknown, label: string): Date => {
  let d: Date | null;
  try {
    d = parseExpiryDate(v);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, `${label}: ${e.message}`);
    throw e;
  }
  if (!d) return fail(400, `${label}: the expiry date is required.`);
  const now = new Date();
  if (d.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) return fail(400, `${label}: this document has already expired.`);
  return d;
};

const router = Router();

router.post("/tow-signup", limit, express.json({ limit: "40mb" }), async (req, res) => {
  const written: string[] = [];
  try {
    const b = req.body ?? {};
    // ---------- 1. validate everything first
    const fullName = text(b.fullName, 120);
    const businessName = text(b.businessName, 120);
    const email = text(b.email, 254).toLowerCase();
    const phone = text(b.phoneNumber, 24);
    const address = text(b.address, 200);
    const city = canonicalCity(b.city);
    const password = b.password;
    if (
      fullName.length < 3 ||
      businessName.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\+?[0-9 ()-]{8,24}$/.test(phone) ||
      address.length < 3 ||
      !city ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^\w\s]/.test(password)
    )
      return fail(400, "Check the company details. The password needs 8–128 characters with uppercase, lowercase, a number and a symbol.");
    if (b.acceptTerms !== true) return fail(400, "Accept the terms to continue.");

    const hq = readPlace(b.location, "Company location");

    if (!Array.isArray(b.trucks) || b.trucks.length < 1) return fail(400, "Add at least one tow truck.");
    if (b.trucks.length > MAX_TRUCKS) return fail(400, `You can register at most ${MAX_TRUCKS} trucks at once.`);

    type TruckIn = { localId: string; plate: string; make: string; model: string; type: TruckType; place: Place; photo: ParsedUpload; registration: ParsedUpload; registrationExpiry: Date; license: ParsedUpload; licenseExpiry: Date };
    const trucks: TruckIn[] = [];
    for (const [i, raw] of (b.trucks as any[]).entries()) {
      const n = `Truck ${i + 1}`;
      const plate = text(raw?.plateNumber, 20);
      const make = text(raw?.make, 60);
      const model = text(raw?.model, 60);
      const type = raw?.truckType as TruckType;
      const localId = text(raw?.localId, 80);
      if (!localId || trucks.some((t) => t.localId === localId)) return fail(400, `${n}: invalid truck reference.`);
      if (!plate) return fail(400, `${n}: the plate number is required.`);
      if (trucks.some((t) => t.plate.toLowerCase() === plate.toLowerCase())) return fail(409, `${n}: the plate ${plate} is listed twice.`);
      if (!make || !model) return fail(400, `${n}: make and model are required.`);
      if (!TRUCK_TYPES.includes(type)) return fail(400, `${n}: the truck type is invalid.`);
      trucks.push({
        localId,
        plate,
        make,
        model,
        type,
        place: readPlace(raw?.location, `${n} (${plate}) location`),
        photo: readPhoto(raw?.photo, `${n} (${plate}) photo`),
        registration: readDoc(raw?.registration, `${n} (${plate}) registration`),
        registrationExpiry: readExpiry(raw?.registration?.expiresAt, `${n} (${plate}) registration`),
        license: readDoc(raw?.license, `${n} (${plate}) operating licence`),
        licenseExpiry: readExpiry(raw?.license?.expiresAt, `${n} (${plate}) operating licence`),
      });
    }

    const docKinds = COMPANY_DOC_KINDS.TOW;
    const companyDocs = docKinds.map((kind) => ({ kind, file: readDoc(b.companyDocuments?.[kind], `Company document ${kind}`) }));

    // plates are unique across the platform: say which one is taken before writing anything
    const taken = await prisma.truck.findFirst({ where: { OR: trucks.map((t) => ({ plateNumber: { equals: t.plate, mode: "insensitive" as const } })) }, select: { plateNumber: true } });
    if (taken) return fail(409, `A truck with the plate ${taken.plateNumber} already exists.`);

    const passwordHash = await argon2.hash(password);

    // ---------- 2. write the files (the rows are created together in step 3)
    const stored = async (f: ParsedUpload) => {
      const key = await storeFile(f);
      written.push(key);
      return key;
    };
    const fileData = (f: ParsedUpload, key: string) => ({ originalName: f.originalName, mimeType: f.mimeType, sizeBytes: f.buffer.length, storageKey: key, sha256: f.sha256 });
    const companyKeys = await Promise.all(companyDocs.map((d) => stored(d.file)));
    const truckKeys: { photo: string; registration: string; license: string }[] = [];
    for (const t of trucks) truckKeys.push({ photo: await stored(t.photo), registration: await stored(t.registration), license: await stored(t.license) });

    // ---------- 3. one transaction: nothing exists unless everything does
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          role: "TOW_PROVIDER",
          status: "ACTIVE",
          towCompanyProfile: {
            create: {
              companyName: businessName,
              ownerName: fullName,
              phone,
              city,
              address,
              baseLat: hq.lat,
              baseLng: hq.lng,
              truckTypes: [...new Set(trucks.map((t) => t.type))],
              truckCountClaimed: trucks.length,
              verificationStatus: "PENDING", // submitted, waiting for the Tow Admin; never auto-approved
              submittedAt: new Date(),
              submissionVersion: 1,
            },
          },
        },
        select: { id: true, towCompanyProfile: { select: { id: true } } },
      });
      const companyId = user.towCompanyProfile!.id;
      for (const [i, d] of companyDocs.entries())
        await tx.providerFile.create({
          data: { ownerUserId: user.id, purpose: "TOW_COMPANY_DOCUMENT", visibility: "PRIVATE", towCompanyId: companyId, label: d.kind, docKind: d.kind, ...fileData(d.file, companyKeys[i]) },
        });
      for (const [i, t] of trucks.entries()) {
        const k = truckKeys[i];
        await tx.truck.create({
          data: {
            companyId,
            plateNumber: t.plate,
            make: t.make,
            model: t.model,
            truckType: t.type,
            baseLat: t.place.lat,
            baseLng: t.place.lng,
            locationAddress: t.place.address,
            locationSource: t.place.source,
            verificationStatus: "PENDING",
            operationalStatus: "OUT_OF_SERVICE",
            files: {
              create: [
                { owner: { connect: { id: user.id } }, purpose: "TRUCK_PHOTO", visibility: "PUBLIC", ...fileData(t.photo, k.photo) },
                { owner: { connect: { id: user.id } }, purpose: "TRUCK_REGISTRATION", visibility: "PRIVATE", expiresAt: t.registrationExpiry, ...fileData(t.registration, k.registration) },
                { owner: { connect: { id: user.id } }, purpose: "TRUCK_OPERATING_LICENSE", visibility: "PRIVATE", expiresAt: t.licenseExpiry, ...fileData(t.license, k.license) },
              ],
            },
          },
        });
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: "PROVIDER_REGISTERED", targetId: companyId, details: { kind: "TOW", via: "signup", trucks: trucks.length } } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PROVIDER_SUBMITTED", targetId: companyId, details: { kind: "TOW" } } });
      return { userId: user.id, companyId };
    });

    // ---------- 4. after commit: the thread note and the admins' notification (the application already exists even if these fail)
    try {
      const app = await loadApp("TOW", { id: created.companyId });
      if (app) {
        await postMessage(app, { authorUserId: null, role: "SYSTEM", body: "The application was submitted for review.||تم إرسال الطلب للمراجعة." });
        await notify(await adminIds("TOW"), ["New application", "طلب جديد"], [`${businessName} is waiting for review.`, `${businessName} بانتظار المراجعة.`]);
      }
    } catch (e) {
      console.error("Tow signup follow-up failed:", e);
    }
    return res.status(201).json({
      success: true,
      userId: created.userId,
      status: "PENDING",
      message: "Application submitted. The MOTEXA Tow Admin will review it before your company can receive requests.",
    });
  } catch (e) {
    await removeStoredFiles(written);
    // a duplicate email stays vague on purpose (same wording as the plain registration)
    if ((e as { code?: string })?.code === "P2002") {
      const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "");
      if (/plate/i.test(target)) return res.status(409).json({ success: false, message: "One of the plates already exists." });
      return res.status(409).json({ success: false, message: "Unable to create this account. If you registered before, sign in." });
    }
    return sendError(res, e, "Tow signup failed");
  }
});

// ---------------------------------------------------------------- parts shop signup (same pattern: validate, write files, one transaction)
const PARTS_DOCS = [
  { kind: "COMMERCIAL_REGISTRATION", pdf: true },
  { kind: "TRADE_LICENCE", pdf: true },
  { kind: "OWNER_ID", pdf: true },
  { kind: "STOREFRONT_PHOTO", pdf: false }, // an image only, as in the onboarding upload
] as const;
/** Optional label: absent or empty = null; anything else must be text. */
const optLabel = (v: unknown, label: string): string | null => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return fail(400, `${label} must be text.`);
  const t = v.trim().slice(0, 120);
  return t || null;
};

router.post("/parts-signup", limit, express.json({ limit: "25mb" }), async (req, res) => {
  const written: string[] = [];
  try {
    const b = req.body ?? {};
    // ---------- 1. validate everything first
    const ownerName = text(b.ownerName, 120);
    const shopName = text(b.shopName, 120);
    const email = text(b.email, 254).toLowerCase();
    const phone = text(b.phoneNumber, 24);
    const address = text(b.address, 200);
    const city = canonicalCity(b.city);
    const password = b.password;
    if (
      ownerName.length < 3 ||
      shopName.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\+?[0-9 ()-]{8,24}$/.test(phone) ||
      address.length < 3 ||
      !city ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^\w\s]/.test(password)
    )
      return fail(400, "Check the shop details. The password needs 8–128 characters with uppercase, lowercase, a number and a symbol.");
    if (b.acceptTerms !== true) return fail(400, "Accept the terms to continue.");
    const brandName = optLabel(b.brandName, "Brand name");
    const branchName = optLabel(b.branchName, "Branch name");
    const place = readPlace(b.location, "Shop location");
    // the shop's categories: at least one, every key must exist in the parts catalogue (the same check as the onboarding screen)
    if (!Array.isArray(b.categories) || b.categories.length < 1) return fail(400, "Choose at least one category.");
    if (b.categories.length > 30 || b.categories.some((x: unknown) => !CATEGORY_KEYS.includes(x as string))) return fail(400, "Categories are invalid.");
    const categories = [...new Set(b.categories as string[])];
    const docs = PARTS_DOCS.map(({ kind, pdf }) => ({ kind, file: readDoc(b.businessDocuments?.[kind], `Document ${kind}`, pdf) }));
    const passwordHash = await argon2.hash(password);

    // ---------- 2. write the files, 3. one transaction
    const keys: string[] = [];
    for (const d of docs) {
      const key = await storeFile(d.file);
      written.push(key);
      keys.push(key);
    }
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: ownerName,
          email,
          passwordHash,
          role: "PARTS_PROVIDER",
          status: "ACTIVE",
          partsShopProfile: {
            create: {
              shopName,
              ownerName,
              phone,
              city,
              address,
              baseLat: place.lat,
              baseLng: place.lng,
              locationAddress: place.address,
              locationSource: place.source,
              brandName,
              branchName,
              categories,
              verificationStatus: "PENDING", // submitted, waiting for the Parts Admin; never auto-approved
              submittedAt: new Date(),
              submissionVersion: 1,
            },
          },
        },
        select: { id: true, partsShopProfile: { select: { id: true } } },
      });
      const shopId = user.partsShopProfile!.id;
      for (const [i, d] of docs.entries())
        await tx.providerFile.create({
          data: {
            ownerUserId: user.id,
            purpose: "PARTS_SHOP_DOCUMENT",
            visibility: "PRIVATE",
            partsShopId: shopId,
            label: d.kind,
            docKind: d.kind,
            originalName: d.file.originalName,
            mimeType: d.file.mimeType,
            sizeBytes: d.file.buffer.length,
            storageKey: keys[i],
            sha256: d.file.sha256,
          },
        });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PROVIDER_REGISTERED", targetId: shopId, details: { kind: "PARTS", via: "signup" } } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "PROVIDER_SUBMITTED", targetId: shopId, details: { kind: "PARTS" } } });
      return { userId: user.id, shopId };
    });

    // ---------- 4. after commit: the thread note and the admins' notification
    try {
      const app = await loadApp("PARTS", { id: created.shopId });
      if (app) {
        await postMessage(app, { authorUserId: null, role: "SYSTEM", body: "The application was submitted for review.||تم إرسال الطلب للمراجعة." });
        await notify(await adminIds("PARTS"), ["New application", "طلب جديد"], [`${shopName} is waiting for review.`, `${shopName} بانتظار المراجعة.`]);
      }
    } catch (e) {
      console.error("Parts signup follow-up failed:", e);
    }
    return res.status(201).json({ success: true, userId: created.userId, status: "PENDING", message: "Application submitted. The MOTEXA Parts Admin will review it before your shop can publish parts." });
  } catch (e) {
    await removeStoredFiles(written);
    if ((e as { code?: string })?.code === "P2002") return res.status(409).json({ success: false, message: "Unable to create this account. If you registered before, sign in." });
    return sendError(res, e, "Parts signup failed");
  }
});

export default router;
