import { Router } from "express";
import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireCustomer } from "../middleware/auth.middleware.js";
import { notify, adminIds } from "../services/provider-onboarding.js";
import { DispatchError } from "../services/tow-dispatch.js";

// Chat, review and "report a problem" of one tow job.
//  Chat (customer <-> assigned driver, in-app only; the company owner may read):
//    GET|POST /requests/tow/:id/messages   the customer      GET|POST /driver/jobs/:id/messages   the driver
//    GET /tow/me/requests/:id/messages     the company owner (read only)
//  POST /requests/tow/:id/review   1–5 stars + comment, once, after COMPLETED; counts for the driver and the company.
//  POST /requests/tow/:id/report   "Report a problem"; tow admins read it (GET /admin/tow/reports in tow-admin routes).
const router = Router();
const json = express.json({ limit: "8kb" });
const ACTIVE_CHAT = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
const uid = (res: any) => (res.locals.authUser as { id: string; role: string }).id;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const send = (res: any, e: unknown, label: string) => {
  if (e instanceof DispatchError) return res.status(e.code).json({ success: false, message: e.message });
  console.error(`${label}:`, e);
  return res.status(500).json({ success: false, message: "Internal server error." });
};

type Who = "CUSTOMER" | "DRIVER" | "COMPANY";
/** The job, if this user is its customer, its driver or its company's owner. */
async function jobFor(userId: string, jobId: string, who: Who) {
  const r = await prisma.towRequest.findUnique({ where: { id: jobId }, include: { driver: { select: { userId: true, user: { select: { fullName: true } } } }, company: { select: { userId: true } } } });
  const ok = r && ((who === "CUSTOMER" && r.customerId === userId) || (who === "DRIVER" && r.driver?.userId === userId) || (who === "COMPANY" && r.company.userId === userId));
  if (!ok) throw new DispatchError(404, "Job not found.");
  return r;
}
const shape = (m: { id: string; authorUserId: string; body: string; createdAt: Date }, me: string, r: { customerId: string }) => ({
  id: m.id, body: m.body, at: m.createdAt, mine: m.authorUserId === me, from: m.authorUserId === r.customerId ? "CUSTOMER" : "DRIVER",
});

async function list(res: any, who: Who, jobId: string) {
  const r = await jobFor(uid(res), jobId, who);
  const after = typeof res.req.query.after === "string" ? new Date(res.req.query.after) : null;
  const rows = await prisma.towRequestMessage.findMany({ where: { requestId: r.id, ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}) }, orderBy: { createdAt: "asc" }, take: 200 });
  return res.json({ success: true, canPost: who !== "COMPANY" && !!r.driverId && ACTIVE_CHAT.includes(r.status), messages: rows.map((m) => shape(m, uid(res), r)) });
}
async function post(res: any, who: Who, jobId: string, body: unknown) {
  const r = await jobFor(uid(res), jobId, who);
  const text = str(body, 1000);
  if (!text) throw new DispatchError(400, "Write a message first.");
  if (!r.driverId || !ACTIVE_CHAT.includes(r.status)) throw new DispatchError(409, "Chat is open while the job is active.");
  const m = await prisma.towRequestMessage.create({ data: { requestId: r.id, authorUserId: uid(res), body: text } });
  const to = who === "CUSTOMER" ? r.driver!.userId : r.customerId;
  await notify([to], who === "CUSTOMER" ? ["New message from your customer", "رسالة جديدة من الزبون"] : [`New message from ${r.driver!.user.fullName.split(/\s+/)[0]}`, "رسالة جديدة من سائقك"], [text.slice(0, 120), text.slice(0, 120)]);
  return res.status(201).json({ success: true, message: shape(m, uid(res), r) });
}

const customer = [requireAuth, requireCustomer];
const driverOrCompany = [requireAuth];
router.get("/requests/tow/:id/messages", ...customer, (req, res) => list(res, "CUSTOMER", String(req.params.id)).catch((e) => send(res, e, "Tow chat list")));
router.post("/requests/tow/:id/messages", ...customer, json, (req, res) => post(res, "CUSTOMER", String(req.params.id), req.body?.body).catch((e) => send(res, e, "Tow chat post")));
router.get("/driver/jobs/:id/messages", ...driverOrCompany, (req, res) => list(res, "DRIVER", String(req.params.id)).catch((e) => send(res, e, "Tow chat list")));
router.post("/driver/jobs/:id/messages", ...driverOrCompany, json, (req, res) => post(res, "DRIVER", String(req.params.id), req.body?.body).catch((e) => send(res, e, "Tow chat post")));
router.get("/tow/me/requests/:id/messages", ...driverOrCompany, (req, res) => list(res, "COMPANY", String(req.params.id)).catch((e) => send(res, e, "Tow chat list")));

router.post("/requests/tow/:id/review", ...customer, json, async (req, res) => {
  try {
    const r = await jobFor(uid(res), String(req.params.id), "CUSTOMER");
    if (r.status !== "COMPLETED" || !r.driverId) throw new DispatchError(409, "You can rate a tow after it is completed.");
    const stars = req.body?.stars;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new DispatchError(400, "stars must be a whole number from 1 to 5.");
    const comment = str(req.body?.comment, 500) || null;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.towReview.create({ data: { requestId: r.id, customerId: r.customerId, driverId: r.driverId!, companyId: r.companyId, stars, comment } });
        await tx.auditLog.create({ data: { actorId: uid(res), action: "TOW_REVIEW_ADDED", targetId: r.id, details: { stars } } });
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new DispatchError(409, "You already rated this tow.");
      throw e;
    }
    await notify([r.driver!.userId, r.company.userId], ["You got a new rating", "لديك تقييم جديد"], [`${stars} / 5`, `${stars} / 5`]);
    return res.status(201).json({ success: true });
  } catch (e) {
    return send(res, e, "Tow review error");
  }
});

router.post("/requests/tow/:id/report", ...customer, json, async (req, res) => {
  try {
    const r = await jobFor(uid(res), String(req.params.id), "CUSTOMER");
    if (r.status === "REQUESTED") throw new DispatchError(409, "There is nothing to report yet.");
    const body = str(req.body?.body, 1000);
    if (body.length < 5) throw new DispatchError(400, "Please describe the problem (at least 5 characters).");
    const row = await prisma.towReport.create({ data: { requestId: r.id, reporterId: uid(res), body } });
    await prisma.auditLog.create({ data: { actorId: uid(res), action: "TOW_REPORT_ADDED", targetId: r.id, details: { reportId: row.id } } });
    await notify(await adminIds("TOW"), ["A tow was reported", "تم الإبلاغ عن مشكلة في سحب"], [body.slice(0, 120), body.slice(0, 120)]);
    return res.status(201).json({ success: true });
  } catch (e) {
    return send(res, e, "Tow report error");
  }
});

export default router;
