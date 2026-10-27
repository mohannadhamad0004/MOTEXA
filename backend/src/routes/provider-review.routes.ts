// Department admins review provider applications. Two mounts of the same router:
//   /api/admin/providers/tow    requireTowAdmin    (SUPER_ADMIN or ADMIN + MANAGE_TOWING)
//   /api/admin/providers/parts  requirePartsAdmin  (SUPER_ADMIN or ADMIN + MANAGE_SPARE_PARTS)
// The approval checklist is enforced HERE: the app can disable the button, but the server refuses to approve until it passes.
import express, { Router, type RequestHandler } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requirePartsAdmin, requireTowAdmin } from "../middleware/auth.middleware.js";
import { removeStoredFile, storeFile } from "../uploads/providerFiles.js";
import {
  COMPANY_DOC_KINDS,
  PURPOSE_OF,
  audit,
  checklist,
  fail,
  loadApp,
  loadThread,
  notify,
  parseDocUpload,
  postMessage,
  sendError,
  shapeFile,
  shapeInfo,
  shapeTrucks,
  text,
  threadWhere,
  timeline,
  truckQualifies,
  type App,
  type Kind,
} from "../services/provider-onboarding.js";

const TABS = { NEW: "PENDING", NEEDS_CHANGES: "NEEDS_CHANGES", APPROVED: "APPROVED", REJECTED: "REJECTED" } as const;

// Fields a reviewer may flag besides documents (kept in sync with the onboarding form).
const FLAGGABLE = ["name", "nameAr", "ownerName", "phone", "city", "address", "location", "workingHours", "serviceCities", "truckTypes", "categories", "brands", "truck"];

export function createProviderReviewRouter(kind: Kind) {
  const router = Router();
  const guard: RequestHandler = kind === "TOW" ? requireTowAdmin : requirePartsAdmin;
  router.use(requireAuth, guard, express.json({ limit: "25mb" }));

  const table = () => (kind === "TOW" ? prisma.towCompanyProfile : prisma.partsShopProfile);
  const load = async (id: string): Promise<App> => (await loadApp(kind, { id })) ?? fail(404, "Application not found.");
  const unreadForAdmin = (app: App) => prisma.providerMessage.count({ where: { ...threadWhere(app), authorRole: "PROVIDER", readByAdminAt: null } });
  const actor = (res: any) => res.locals.authUser as { id: string };

  async function detail(app: App) {
    const r = app.row;
    const docs = r.files.filter((f) => f.purpose === PURPOSE_OF[kind] && !f.messageId).map(shapeFile);
    return {
      kind,
      id: r.id,
      status: r.verificationStatus,
      rejectionReason: r.rejectionReason,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      submissionVersion: r.submissionVersion,
      flaggedFields: r.flaggedFields,
      owner: { fullName: r.user.fullName, email: r.user.email },
      info: shapeInfo(app),
      requiredDocuments: COMPANY_DOC_KINDS[kind],
      documents: docs,
      trucks: kind === "TOW" ? shapeTrucks((app as { row: any }).row) : [],
      checklist: checklist(app),
      unreadMessages: await unreadForAdmin(app),
      timeline: await timeline(r.id),
    };
  }

  router.get("/counts", async (_req, res) => {
    try {
      const rows = await (table() as any).groupBy({ by: ["verificationStatus"], _count: { _all: true } });
      const n = (s: string) => rows.find((r: any) => r.verificationStatus === s)?._count._all ?? 0;
      const where = kind === "TOW" ? { towCompanyId: { not: null } } : { partsShopId: { not: null } };
      const unreadMessages = await prisma.providerMessage.count({ where: { ...where, authorRole: "PROVIDER", readByAdminAt: null } });
      return res.json({ success: true, counts: { NEW: n("PENDING"), NEEDS_CHANGES: n("NEEDS_CHANGES"), APPROVED: n("APPROVED"), REJECTED: n("REJECTED") }, unreadMessages });
    } catch (e) {
      return sendError(res, e, "Provider counts error");
    }
  });

  router.get("/applications", async (req, res) => {
    try {
      const tab = String(req.query.tab ?? "NEW") as keyof typeof TABS;
      if (!(tab in TABS)) return fail(400, "Unknown tab.");
      const status = TABS[tab];
      const rows = (await (table() as any).findMany({
        where: { verificationStatus: status },
        include: { user: { select: { fullName: true, email: true } }, files: { where: { messageId: null } } },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
      })) as any[];
      const out = [];
      for (const r of rows) {
        const app = { kind, row: r } as App;
        out.push({
          id: r.id,
          name: kind === "TOW" ? r.companyName : r.shopName,
          ownerName: r.ownerName ?? r.user.fullName,
          city: r.city,
          status: r.verificationStatus,
          submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
          documents: r.files.length,
          pendingDocuments: r.files.filter((f: any) => f.reviewStatus === "PENDING").length,
          unreadMessages: await unreadForAdmin(app),
        });
      }
      return res.json({ success: true, applications: out });
    } catch (e) {
      return sendError(res, e, "Provider list error");
    }
  });

  router.get("/applications/:id", async (req, res) => {
    try {
      return res.json({ success: true, application: await detail(await load(String(req.params.id))) });
    } catch (e) {
      return sendError(res, e, "Provider detail error");
    }
  });

  // ---- per-document decision
  router.patch("/applications/:id/documents/:docId", async (req, res) => {
    try {
      const app = await load(String(req.params.id));
      if (app.row.verificationStatus !== "PENDING") return fail(409, "Documents can be reviewed only while the application is waiting for review.");
      const status = req.body?.status;
      if (status !== "ACCEPTED" && status !== "REJECTED") return fail(400, "Status must be ACCEPTED or REJECTED.");
      const reason = text(req.body?.reason, 500);
      if (status === "REJECTED" && !reason) return fail(400, "A reason is required to reject a document.");
      const all = [...app.row.files, ...(kind === "TOW" ? (app.row as any).trucks.flatMap((t: any) => t.files) : [])];
      const f = all.find((x: any) => x.id === String(req.params.docId) && !x.messageId);
      if (!f) return fail(404, "Document not found.");
      await prisma.providerFile.update({ where: { id: f.id }, data: { reviewStatus: status, reviewReason: status === "REJECTED" ? reason : null, reviewedAt: new Date() } });
      await audit(actor(res).id, status === "ACCEPTED" ? "PROVIDER_DOC_ACCEPTED" : "PROVIDER_DOC_REJECTED", app.row.id, { kind: f.docKind ?? f.purpose, reason: reason || null });
      if (status === "REJECTED") {
        const name = shapeInfo(app).name;
        await notify([app.row.userId], ["A document was rejected", "تم رفض مستند"], [`${name}: ${reason}`, `${name}: ${reason}`]);
      }
      return res.json({ success: true, application: await detail(await load(app.row.id)) });
    } catch (e) {
      return sendError(res, e, "Provider document decision error");
    }
  });

  // ---- approve (checklist enforced)
  router.post("/applications/:id/approve", async (req, res) => {
    try {
      const app = await load(String(req.params.id));
      if (app.row.verificationStatus !== "PENDING") return fail(409, "Only an application waiting for review can be approved.");
      const failing = checklist(app).filter((c) => !c.ok);
      if (failing.length) return res.status(409).json({ success: false, message: "The approval checklist is not complete.", failing: failing.map((c) => c.key) });
      const who = actor(res).id;
      await prisma.$transaction(async (tx) => {
        const data = { verificationStatus: "APPROVED" as const, rejectionReason: null, flaggedFields: [], reviewedById: who, reviewedAt: new Date() };
        if (kind === "TOW") {
          await tx.towCompanyProfile.update({ where: { id: app.row.id }, data });
          // trucks whose photo, licence and insurance were all accepted go live with the company
          const ok = (app.row as any).trucks.filter(truckQualifies).map((t: any) => t.id);
          if (ok.length) await tx.truck.updateMany({ where: { id: { in: ok } }, data: { verificationStatus: "APPROVED", rejectionReason: null, reviewedById: who, reviewedAt: new Date() } });
        } else {
          await tx.partsShopProfile.update({ where: { id: app.row.id }, data });
        }
        await tx.auditLog.create({ data: { actorId: who, action: "PROVIDER_APPROVED", targetId: app.row.id, details: { kind } } });
      });
      const fresh = await load(app.row.id);
      await postMessage(fresh, { authorUserId: null, role: "SYSTEM", body: "Your application was approved. You can now receive requests.||تمت الموافقة على طلبك. يمكنك الآن استقبال الطلبات." });
      await notify([app.row.userId], ["Application approved", "تمت الموافقة على الطلب"], ["You can now receive requests.", "يمكنك الآن استقبال الطلبات."]);
      return res.json({ success: true, application: await detail(fresh) });
    } catch (e) {
      return sendError(res, e, "Provider approve error");
    }
  });

  // ---- request changes: flag fields / documents + a required message
  router.post("/applications/:id/request-changes", async (req, res) => {
    try {
      const app = await load(String(req.params.id));
      if (app.row.verificationStatus !== "PENDING") return fail(409, "Changes can be requested only while the application is waiting for review.");
      const message = text(req.body?.message, 1000);
      if (!message) return fail(400, "A message is required.");
      const fields: string[] = Array.isArray(req.body?.fields) ? req.body.fields.filter((x: unknown) => typeof x === "string" && FLAGGABLE.includes(x as string)) : [];
      const docIds: string[] = Array.isArray(req.body?.documentIds) ? req.body.documentIds.map(String) : [];
      const all = [...app.row.files, ...(kind === "TOW" ? (app.row as any).trucks.flatMap((t: any) => t.files) : [])].filter((x: any) => !x.messageId);
      const picked = all.filter((f: any) => docIds.includes(f.id));
      if (picked.length !== docIds.length) return fail(400, "A selected document does not belong to this application.");
      if (!fields.length && !picked.length) return fail(400, "Select at least one field or document to fix.");
      const who = actor(res).id;
      await prisma.$transaction(async (tx) => {
        if (picked.length)
          await tx.providerFile.updateMany({ where: { id: { in: picked.map((f: any) => f.id) } }, data: { reviewStatus: "REJECTED", reviewReason: message, reviewedAt: new Date() } });
        const flagged = [...new Set([...fields, ...picked.map((f: any) => `doc:${f.docKind ?? f.purpose}`)])];
        const data = { verificationStatus: "NEEDS_CHANGES" as const, flaggedFields: flagged };
        if (kind === "TOW") await tx.towCompanyProfile.update({ where: { id: app.row.id }, data });
        else await tx.partsShopProfile.update({ where: { id: app.row.id }, data });
        await tx.auditLog.create({ data: { actorId: who, action: "PROVIDER_CHANGES_REQUESTED", targetId: app.row.id, details: { kind, fields, documents: picked.map((f: any) => f.docKind ?? f.purpose), message } } });
      });
      const fresh = await load(app.row.id);
      await postMessage(fresh, { authorUserId: who, role: "ADMIN", body: message });
      await postMessage(fresh, { authorUserId: null, role: "SYSTEM", body: "Changes were requested. Fix the flagged items and resubmit.||طُلبت تعديلات. صحّح العناصر المحددة ثم أعد الإرسال." });
      await notify([app.row.userId], ["Changes requested", "مطلوب تعديلات"], [message.slice(0, 120), message.slice(0, 120)]);
      return res.json({ success: true, application: await detail(fresh) });
    } catch (e) {
      return sendError(res, e, "Provider request-changes error");
    }
  });

  // ---- reject (final)
  router.post("/applications/:id/reject", async (req, res) => {
    try {
      const app = await load(String(req.params.id));
      if (!["PENDING", "NEEDS_CHANGES"].includes(app.row.verificationStatus)) return fail(409, "This application cannot be rejected in its current state.");
      const reason = text(req.body?.reason, 1000);
      if (!reason) return fail(400, "A reason is required.");
      const who = actor(res).id;
      const data = { verificationStatus: "REJECTED" as const, rejectionReason: reason, flaggedFields: [], reviewedById: who, reviewedAt: new Date() };
      await prisma.$transaction([
        kind === "TOW" ? prisma.towCompanyProfile.update({ where: { id: app.row.id }, data }) : prisma.partsShopProfile.update({ where: { id: app.row.id }, data }),
        prisma.auditLog.create({ data: { actorId: who, action: "PROVIDER_REJECTED", targetId: app.row.id, details: { kind, reason } } }),
      ]);
      const fresh = await load(app.row.id);
      await postMessage(fresh, { authorUserId: who, role: "ADMIN", body: reason });
      await postMessage(fresh, { authorUserId: null, role: "SYSTEM", body: "The application was rejected.||تم رفض الطلب." });
      await notify([app.row.userId], ["Application rejected", "تم رفض الطلب"], [reason.slice(0, 120), reason.slice(0, 120)]);
      return res.json({ success: true, application: await detail(fresh) });
    } catch (e) {
      return sendError(res, e, "Provider reject error");
    }
  });

  // ---- messages
  router.get("/threads", async (_req, res) => {
    try {
      const key = kind === "TOW" ? "towCompanyId" : "partsShopId";
      const last = await prisma.providerMessage.groupBy({ by: [key], where: { [key]: { not: null } }, _max: { createdAt: true }, orderBy: { _max: { createdAt: "desc" } }, take: 100 } as any);
      const out = [];
      for (const g of last as any[]) {
        const app = await loadApp(kind, { id: g[key] });
        if (!app) continue;
        const lastMsg = await prisma.providerMessage.findFirst({ where: threadWhere(app), orderBy: { createdAt: "desc" } });
        out.push({
          id: app.row.id,
          name: shapeInfo(app).name,
          status: app.row.verificationStatus,
          last: lastMsg?.body ?? "",
          lastFrom: lastMsg?.authorRole ?? "SYSTEM",
          at: lastMsg?.createdAt.toISOString() ?? null,
          unread: await unreadForAdmin(app),
        });
      }
      return res.json({ success: true, threads: out });
    } catch (e) {
      return sendError(res, e, "Provider threads error");
    }
  });

  router.get("/applications/:id/messages", async (req, res) => {
    try {
      const app = await load(String(req.params.id));
      return res.json({ success: true, messages: await loadThread(app), unread: await unreadForAdmin(app) });
    } catch (e) {
      return sendError(res, e, "Provider messages error");
    }
  });

  router.post("/applications/:id/messages/read", async (req, res) => {
    try {
      const app = await load(String(req.params.id));
      await prisma.providerMessage.updateMany({ where: { ...threadWhere(app), authorRole: "PROVIDER", readByAdminAt: null }, data: { readByAdminAt: new Date() } });
      return res.json({ success: true });
    } catch (e) {
      return sendError(res, e, "Provider messages read error");
    }
  });

  router.post("/applications/:id/messages", async (req, res) => {
    let storageKey: string | null = null;
    try {
      const app = await load(String(req.params.id));
      const body = text(req.body?.body, 2000);
      const hasFile = req.body?.attachment !== undefined && req.body?.attachment !== null;
      if (!body && !hasFile) return fail(400, "Write a message or attach a file.");
      const file = hasFile ? parseDocUpload(req.body.attachment) : undefined;
      if (file) storageKey = await storeFile(file);
      await postMessage(app, { authorUserId: actor(res).id, role: "ADMIN", body: body || "📎", file, storageKey: storageKey ?? undefined });
      await notify([app.row.userId], ["New message from MOTEXA", "رسالة جديدة من MOTEXA"], [body.slice(0, 120) || "Attachment", body.slice(0, 120) || "مرفق"]);
      return res.status(201).json({ success: true, messages: await loadThread(app) });
    } catch (e) {
      if (storageKey) await removeStoredFile(storageKey);
      return sendError(res, e, "Provider message error");
    }
  });

  return router;
}

export const towReviewRouter = createProviderReviewRouter("TOW");
export const partsReviewRouter = createProviderReviewRouter("PARTS");
