// Provider side of the onboarding (TOW_PROVIDER / PARTS_PROVIDER), mounted at /api/provider (+ /api/notifications for everyone).
// Mounted BEFORE the global JSON parser: documents arrive as base64 and the body limit is raised after authentication.
//   GET  /onboarding              the whole application (status, info, documents, trucks, what is missing, flagged items, timeline)
//   GET  /onboarding/status       light version for the layout gate and badges
//   PUT  /onboarding/info         step 1 (saved on the server after each step; only while DRAFT or NEEDS_CHANGES)
//   POST /onboarding/documents    step 2 (JPEG / PNG / PDF, max 5 MB, private); DELETE /onboarding/documents/:id
//   POST /onboarding/submit       DRAFT / NEEDS_CHANGES -> PENDING (submitted)
//   GET/POST /messages            the thread with the department's admins (stays after approval)
// Trucks and their vehicle documents reuse the existing /api/tow/me/trucks endpoints.
import express, { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { canonicalCity } from "../cities.js";
import { CATEGORY_KEYS } from "../catalogCategories.js";
import { removeStoredFile, storeFile } from "../uploads/providerFiles.js";
import {
  COMPANY_DOC_KINDS,
  PURPOSE_OF,
  adminIds,
  audit,
  cleanCities,
  fail,
  isEditable,
  loadApp,
  loadThread,
  missingForSubmit,
  notify,
  parseDocUpload,
  parseExpiryDate,
  postMessage,
  readPoint,
  sendError,
  shapeFile,
  shapeInfo,
  shapeTrucks,
  text,
  threadWhere,
  timeline,
  type App,
  type Kind,
} from "../services/provider-onboarding.js";

const router = Router();
router.use(requireAuth, express.json({ limit: "25mb" }));

const TRUCK_TYPES = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"];
const PHONE = /^\+?[0-9 ()-]{8,24}$/;

async function mine(res: any): Promise<App> {
  const u = res.locals.authUser as { id: string; role: string };
  const kind: Kind | null = u.role === "TOW_PROVIDER" ? "TOW" : u.role === "PARTS_PROVIDER" ? "PARTS" : null;
  if (!kind) return fail(403, "Tow company or parts shop access required.");
  const app = await loadApp(kind, { userId: u.id });
  return app ?? fail(404, "No application is linked to this account.");
}

const unreadForProvider = (app: App) => prisma.providerMessage.count({ where: { ...threadWhere(app), authorRole: { not: "PROVIDER" }, readByProviderAt: null } });

async function view(app: App) {
  const r = app.row;
  const docs = r.files.filter((f) => f.purpose === PURPOSE_OF[app.kind] && !f.messageId).map(shapeFile);
  const base = {
    kind: app.kind,
    id: r.id,
    status: r.verificationStatus,
    rejectionReason: r.rejectionReason,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    submissionVersion: r.submissionVersion,
    flaggedFields: r.flaggedFields,
    owner: { fullName: r.user.fullName, email: r.user.email },
    info: shapeInfo(app),
    requiredDocuments: COMPANY_DOC_KINDS[app.kind],
    documents: docs,
    trucks: app.kind === "TOW" ? shapeTrucks(app.row) : [],
    missing: missingForSubmit(app),
    unreadMessages: await unreadForProvider(app),
    timeline: await timeline(r.id),
  };
  return base;
}

router.get("/onboarding", async (_req, res) => {
  try {
    return res.json({ success: true, application: await view(await mine(res)) });
  } catch (e) {
    return sendError(res, e, "Onboarding load error");
  }
});

router.get("/onboarding/status", async (_req, res) => {
  try {
    const app = await mine(res);
    const userId = app.row.userId;
    const [unreadMessages, unreadNotifications] = await Promise.all([unreadForProvider(app), prisma.notification.count({ where: { userId, readAt: null } })]);
    return res.json({ success: true, status: { kind: app.kind, id: app.row.id, status: app.row.verificationStatus, unreadMessages, unreadNotifications } });
  } catch (e) {
    return sendError(res, e, "Onboarding status error");
  }
});

// ---------------------------------------------------------------- step 1
router.put("/onboarding/info", async (req, res) => {
  try {
    const app = await mine(res);
    if (!isEditable(app.row.verificationStatus)) return fail(409, "This application cannot be edited in its current state.");
    const b = req.body ?? {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    const common: Record<string, unknown> = {};
    if (has("phone")) {
      const v = text(b.phone, 24);
      if (!PHONE.test(v)) return fail(400, "Phone number is invalid.");
      common.phone = v;
    }
    if (has("city")) {
      const c = canonicalCity(b.city);
      if (!c) return fail(400, "Choose a city from the list.");
      common.city = c;
    }
    if (has("address")) common.address = text(b.address, 200) || null;
    if (has("ownerName")) {
      const v = text(b.ownerName, 120);
      if (v.length < 3) return fail(400, "Owner name is required.");
      common.ownerName = v;
    }
    const name = has("name") ? text(b.name, 120) : null;
    if (name !== null && name.length < 2) return fail(400, "Business name is required.");
    const nameAr = has("nameAr") ? text(b.nameAr, 120) || null : undefined;
    let point: { lat: number | null; lng: number | null } | null = null;
    if (has("baseLat") || has("baseLng")) point = readPoint(b, "baseLat", "baseLng");
    if (has("workingHours")) common.workingHours = text(b.workingHours, 100) || null;

    if (app.kind === "TOW") {
      const data: Record<string, unknown> = { ...common };
      if (name !== null) data.companyName = name;
      if (nameAr !== undefined) data.companyNameAr = nameAr;
      if (has("serviceCities")) data.serviceCities = cleanCities(b.serviceCities);
      if (has("open24h")) {
        if (typeof b.open24h !== "boolean") return fail(400, "open24h must be true or false.");
        data.open24h = b.open24h;
        if (b.open24h) data.workingHours = "24/7";
      }
      if (has("truckTypes")) {
        if (!Array.isArray(b.truckTypes) || b.truckTypes.some((x: unknown) => !TRUCK_TYPES.includes(x as string))) return fail(400, "Truck types are invalid.");
        data.truckTypes = [...new Set(b.truckTypes as string[])];
      }
      if (has("truckCountClaimed")) {
        const n = b.truckCountClaimed;
        if (n !== null && !(Number.isInteger(n) && n >= 1 && n <= 500)) return fail(400, "Number of trucks must be between 1 and 500.");
        data.truckCountClaimed = n;
      }
      if (has("description")) data.description = text(b.description, 600) || null;
      if (point) [data.baseLat, data.baseLng] = [point.lat, point.lng];
      await prisma.towCompanyProfile.update({ where: { id: app.row.id }, data });
    } else {
      const data: Record<string, unknown> = { ...common };
      if (name !== null) data.shopName = name;
      if (nameAr !== undefined) data.shopNameAr = nameAr;
      if (has("categories")) {
        if (!Array.isArray(b.categories) || b.categories.length > 30 || b.categories.some((x: unknown) => !CATEGORY_KEYS.includes(x as string))) return fail(400, "Categories are invalid.");
        data.categories = [...new Set(b.categories as string[])];
      }
      if (has("brands")) {
        if (!Array.isArray(b.brands) || b.brands.length > 15) return fail(400, "Choose at most 15 brands.");
        data.brands = [...new Set((b.brands as unknown[]).map((x) => text(x, 40)).filter(Boolean))];
      }
      if (point) [data.baseLat, data.baseLng] = [point.lat, point.lng];
      await prisma.partsShopProfile.update({ where: { id: app.row.id }, data });
    }
    return res.json({ success: true, application: await view((await mine(res))!) });
  } catch (e) {
    return sendError(res, e, "Onboarding info error");
  }
});

// ---------------------------------------------------------------- step 2
router.post("/onboarding/documents", async (req, res) => {
  let storageKey: string | null = null;
  try {
    const app = await mine(res);
    if (!isEditable(app.row.verificationStatus)) return fail(409, "This application cannot be edited in its current state.");
    const kind = String(req.body?.kind ?? "");
    const photo = app.kind === "PARTS" && kind === "STOREFRONT_PHOTO";
    if (!photo && !COMPANY_DOC_KINDS[app.kind].includes(kind)) return fail(400, "Unknown document type.");
    const file = parseDocUpload(req.body, !photo);
    const expiresAt = parseExpiryDate(req.body?.expiresAt);
    const old = app.row.files.filter((f) => f.docKind === kind && f.purpose === PURPOSE_OF[app.kind] && !f.messageId);
    storageKey = await storeFile(file);
    const owner = app.kind === "TOW" ? { towCompanyId: app.row.id } : { partsShopId: app.row.id };
    const created = await prisma.$transaction(async (tx) => {
      if (old.length) await tx.providerFile.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      return tx.providerFile.create({
        data: {
          ownerUserId: app.row.userId,
          purpose: PURPOSE_OF[app.kind],
          visibility: "PRIVATE",
          ...owner,
          label: kind,
          docKind: kind,
          originalName: file.originalName,
          mimeType: file.mimeType,
          sizeBytes: file.buffer.length,
          storageKey: storageKey!,
          sha256: file.sha256,
          expiresAt,
        },
      });
    });
    await Promise.all(old.map((o) => removeStoredFile(o.storageKey)));
    await audit(app.row.userId, "PROVIDER_DOC_UPLOADED", app.row.id, { kind });
    return res.status(201).json({ success: true, document: shapeFile(created) });
  } catch (e) {
    if (storageKey) await removeStoredFile(storageKey);
    return sendError(res, e, "Onboarding document error");
  }
});

router.delete("/onboarding/documents/:id", async (req, res) => {
  try {
    const app = await mine(res);
    if (!isEditable(app.row.verificationStatus)) return fail(409, "This application cannot be edited in its current state.");
    const f = app.row.files.find((x) => x.id === String(req.params.id) && x.purpose === PURPOSE_OF[app.kind] && !x.messageId);
    if (!f) return fail(404, "Document not found.");
    await prisma.providerFile.delete({ where: { id: f.id } });
    await removeStoredFile(f.storageKey);
    await audit(app.row.userId, "PROVIDER_DOC_REMOVED", app.row.id, { kind: f.docKind });
    return res.json({ success: true });
  } catch (e) {
    return sendError(res, e, "Onboarding document delete error");
  }
});

// ---------------------------------------------------------------- submit / resubmit
router.post("/onboarding/submit", async (_req, res) => {
  try {
    const app = await mine(res);
    const status = app.row.verificationStatus;
    if (!isEditable(status)) return fail(409, "This application has already been submitted.");
    const missing = missingForSubmit(app);
    if (missing.length) return res.status(400).json({ success: false, message: "Complete every required item before submitting.", missing });
    // a document the reviewer rejected must be replaced before resubmitting
    const rejected = app.row.files.filter((f) => f.reviewStatus === "REJECTED" && !f.messageId).map((f) => f.docKind ?? f.purpose);
    const truckRejected = app.kind === "TOW" ? app.row.trucks.flatMap((t) => t.files.filter((f) => f.reviewStatus === "REJECTED").map((f) => f.purpose)) : [];
    if (rejected.length || truckRejected.length)
      return res.status(400).json({ success: false, message: "Replace the rejected documents before resubmitting.", missing: [...rejected, ...truckRejected].map((k) => `rejected:${k}`) });
    const resubmit = status === "NEEDS_CHANGES";
    const where = { id: app.row.id };
    const data = { verificationStatus: "PENDING" as const, submittedAt: new Date(), submissionVersion: { increment: 1 }, flaggedFields: [], rejectionReason: null };
    if (app.kind === "TOW") await prisma.towCompanyProfile.update({ where, data });
    else await prisma.partsShopProfile.update({ where, data });
    await audit(app.row.userId, resubmit ? "PROVIDER_RESUBMITTED" : "PROVIDER_SUBMITTED", app.row.id, { kind: app.kind });
    const fresh = (await loadApp(app.kind, where))!;
    await postMessage(fresh, {
      authorUserId: null,
      role: "SYSTEM",
      body: resubmit ? "The application was resubmitted for review.||تمت إعادة إرسال الطلب للمراجعة." : "The application was submitted for review.||تم إرسال الطلب للمراجعة.",
    });
    const name = shapeInfo(fresh).name;
    await notify(await adminIds(app.kind), [resubmit ? "Application resubmitted" : "New application", resubmit ? "أُعيد إرسال طلب" : "طلب جديد"], [`${name} is waiting for review.`, `${name} بانتظار المراجعة.`]);
    return res.json({ success: true, application: await view(fresh) });
  } catch (e) {
    return sendError(res, e, "Onboarding submit error");
  }
});

// ---------------------------------------------------------------- messages
router.get("/messages", async (_req, res) => {
  try {
    const app = await mine(res);
    return res.json({ success: true, messages: await loadThread(app), unread: await unreadForProvider(app) });
  } catch (e) {
    return sendError(res, e, "Messages load error");
  }
});

router.post("/messages/read", async (_req, res) => {
  try {
    const app = await mine(res);
    await prisma.providerMessage.updateMany({ where: { ...threadWhere(app), authorRole: { not: "PROVIDER" }, readByProviderAt: null }, data: { readByProviderAt: new Date() } });
    return res.json({ success: true });
  } catch (e) {
    return sendError(res, e, "Messages read error");
  }
});

router.post("/messages", async (req, res) => {
  let storageKey: string | null = null;
  try {
    const app = await mine(res);
    const body = text(req.body?.body, 2000);
    const hasFile = req.body?.attachment !== undefined && req.body?.attachment !== null;
    if (!body && !hasFile) return fail(400, "Write a message or attach a file.");
    const file = hasFile ? parseDocUpload(req.body.attachment) : undefined;
    if (file) storageKey = await storeFile(file);
    const msg = await postMessage(app, { authorUserId: app.row.userId, role: "PROVIDER", body: body || "📎", file, storageKey: storageKey ?? undefined });
    const name = shapeInfo(app).name;
    await notify(await adminIds(app.kind), ["New message", "رسالة جديدة"], [`${name}: ${body.slice(0, 80) || "attachment"}`, `${name}: ${body.slice(0, 80) || "مرفق"}`]);
    return res.status(201).json({ success: true, id: msg.id, messages: await loadThread(app) });
  } catch (e) {
    if (storageKey) await removeStoredFile(storageKey);
    return sendError(res, e, "Message error");
  }
});

export default router;

// ---------------------------------------------------------------- notifications (any signed-in user; Diala's Notification model)
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, express.json());

notificationsRouter.get("/", async (_req, res) => {
  try {
    const u = res.locals.authUser as { id: string };
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.notification.count({ where: { userId: u.id, readAt: null } }),
    ]);
    return res.json({ success: true, unread, notifications: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, readAt: n.readAt, createdAt: n.createdAt })) });
  } catch (e) {
    return sendError(res, e, "Notifications error");
  }
});

notificationsRouter.post("/read-all", async (_req, res) => {
  try {
    const u = res.locals.authUser as { id: string };
    await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return res.json({ success: true });
  } catch (e) {
    return sendError(res, e, "Notifications read error");
  }
});
