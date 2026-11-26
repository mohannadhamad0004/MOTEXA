import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireMechanicsAdmin } from "../middleware/auth.middleware.js";
import { errorBody } from "../services/error-codes.js";
import { notify } from "../services/provider-onboarding.js";
import { endMechanicTrail, include, mechanicView, nearestCity } from "./mechanic-requests.routes.js";

// Mechanics admin supervision of mechanic requests (like the tow admin's jobs). Mounted under /api.
//  - GET  /admin/mechanics/stats                  counts for the admin home and the super admin dashboard
//  - GET  /admin/mechanics/requests?scope=active|history &status= &q=    newest activity first, 200 at most
//  - GET  /admin/mechanics/requests/:id           detail (every open is audited)
//  - POST /admin/mechanics/requests/:id/cancel    {reason} required; audited; customer + mechanic notified and shown the reason
// Access: SUPER_ADMIN or ADMIN + MANAGE_MECHANICS (requireMechanicsAdmin), enforced here, not only in the app.
// Privacy: the admin gets the SAME location rule as the mechanic (exact address, pin and phone only while the job is ACCEPTED /
// IN_PROGRESS; otherwise the nearest city and a pin rounded to ~1 km). The admin always sees the customer's full name (never the email).
// Garage requests: `garage` is set; `mechanic` is null until the owner assigns one of his mechanics.
const router = Router();
const guard = [requireAuth, requireMechanicsAdmin];

const ACTIVE = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] as const;
const HISTORY = ["COMPLETED", "DECLINED", "CANCELLED"] as const;
const STATUSES = [...ACTIVE, ...HISTORY];
const MAX = 200;

class HttpError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}
const send = (res: any, e: unknown, label: string) => {
  if (e instanceof HttpError) return res.status(e.code).json(errorBody(e.message));
  console.error(`${label}:`, e);
  return res.status(500).json(errorBody("Internal server error."));
};
const actor = (res: any) => (res.locals.authUser as { id: string }).id;

const adminView = (r: Prisma.MechanicRequestGetPayload<{ include: typeof include }>) => {
  const v = mechanicView(r);
  return {
    ...v,
    customerName: r.customer.fullName,
    customerId: r.customer.id,
    mechanic: r.mechanic
      ? { id: r.mechanic.id, name: r.mechanic.fullName, workshopName: r.mechanic.mechanicProfile?.workshopName || r.garage?.garageName || null, city: r.mechanic.mechanicProfile?.city ?? r.garage?.city ?? null }
      : { id: null, name: null, workshopName: r.garage?.garageName ?? null, city: r.garage?.city ?? null },
    // where the CAR is: the nearest city (≤ 30 km) to the customer's pin; null without a pin (never guessed from the mechanic's city,
    // which is mechanic.city). A customer may book a mechanic from another city, so the two can differ.
    city: v.location.point ? nearestCity(v.location.point) : null,
    active: (ACTIVE as readonly string[]).includes(r.status),
  };
};

router.get("/admin/mechanics/stats", ...guard, async (_req, res) => {
  try {
    const [byStatus, pendingApplications, verified, pendingGarages, approvedGarages, pendingGarageMechanics, onlineGarageMechanics] = await Promise.all([
      prisma.mechanicRequest.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.mechanicProfile.count({ where: { verificationStatus: "PENDING" } }),
      prisma.mechanicProfile.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.garageProfile.count({ where: { verificationStatus: "PENDING" } }),
      prisma.garageProfile.count({ where: { verificationStatus: "APPROVED" } }),
      prisma.garageMechanic.count({ where: { approval: "PENDING" } }),
      prisma.garageMechanic.count({ where: { approval: "APPROVED", offline: false } }),
    ]);
    const n = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
    return res.json({ success: true, stats: { activeRequests: ACTIVE.reduce((a, s) => a + n(s), 0), waiting: n("REQUESTED"), accepted: n("ACCEPTED"), onTheWay: n("EN_ROUTE") + n("ARRIVED"), inProgress: n("IN_PROGRESS"), pendingApplications, verifiedMechanics: verified,
      pendingGarages, approvedGarages, pendingGarageMechanics, onlineGarageMechanics } });
  } catch (e) {
    return send(res, e, "Mechanics admin stats error");
  }
});

router.get("/admin/mechanics/requests", ...guard, async (req, res) => {
  try {
    const scope = req.query.scope === "history" ? "history" : "active";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const group: readonly string[] = scope === "history" ? HISTORY : ACTIVE;
    if (status && !group.includes(status)) throw new HttpError(400, "Invalid status filter.");
    const rows = await prisma.mechanicRequest.findMany({ where: { status: { in: (status ? [status] : [...group]) as never } }, include, orderBy: { updatedAt: "desc" }, take: MAX });
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase().slice(0, 100) : "";
    // search = customer, mechanic or city (the city only: never the typed address)
    const all = rows.map(adminView).filter((r) => !q || [r.customerName, r.mechanic.name, r.mechanic.workshopName, r.city, r.mechanic.city].some((x) => x?.toLowerCase().includes(q)));
    return res.json({ success: true, requests: all.map((r) => ({ ...r, location: { area: r.location.area, approximate: r.location.approximate } })) }); // the list never carries the address or phone
  } catch (e) {
    return send(res, e, "Mechanics admin requests error");
  }
});

router.get("/admin/mechanics/requests/:id", ...guard, async (req, res) => {
  try {
    const row = await prisma.mechanicRequest.findUnique({ where: { id: String(req.params.id) }, include });
    if (!row) throw new HttpError(404, "Request not found.");
    const view = adminView(row);
    await prisma.auditLog.create({ data: { actorId: actor(res), action: "MECHANIC_REQUEST_ADMIN_VIEWED", targetId: row.id, details: { status: row.status, exactShown: !view.location.approximate } } });
    return res.json({ success: true, request: view });
  } catch (e) {
    return send(res, e, "Mechanics admin request error");
  }
});

router.post("/admin/mechanics/requests/:id/cancel", ...guard, express.json(), async (req, res) => {
  try {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
    if (reason.length < 3) throw new HttpError(400, "A reason is required.");
    const id = String(req.params.id);
    const r = await prisma.mechanicRequest.findUnique({ where: { id }, select: { customerId: true, mechanicUserId: true, garage: { select: { userId: true } } } });
    if (!r) throw new HttpError(404, "Request not found.");
    await prisma.$transaction(async (tx) => {
      const done = await tx.mechanicRequest.updateMany({ where: { id, status: { in: [...ACTIVE] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "ADMIN", cancelReason: reason } });
      if (!done.count) throw new HttpError(409, "Only an open request can be cancelled.");
      await endMechanicTrail(tx, id);
      await tx.auditLog.create({ data: { actorId: actor(res), action: "MECHANIC_REQUEST_CANCELLED", targetId: id, details: { by: "ADMIN", reason } } });
    });
    await notify([r.customerId, ...(r.mechanicUserId ? [r.mechanicUserId] : []), ...(r.garage ? [r.garage.userId] : [])], ["A mechanic request was cancelled by MOTEXA", "ألغت موتكسا طلب ميكانيكي"], [reason, reason]);
    return res.json({ success: true, request: adminView(await prisma.mechanicRequest.findUniqueOrThrow({ where: { id }, include })) });
  } catch (e) {
    return send(res, e, "Mechanics admin cancel error");
  }
});

export default router;
