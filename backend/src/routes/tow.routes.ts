import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireTowAdmin, requireTowProvider } from "../middleware/auth.middleware.js";

// Tow companies + trucks. Mounted at /api.
//  - /api/tow/me/*        TOW_PROVIDER, always scoped to the caller's own company.
//  - /api/admin/tow/*     SUPER_ADMIN or ADMIN + MANAGE_TOWING. Admins decide only; they never edit data.
// Truck photos/documents are NOT stored yet (later step): document lists are returned empty.
const router = Router();

const TRUCK_TYPES = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"] as const;
const OPERATIONAL = ["AVAILABLE", "BUSY", "OUT_OF_SERVICE"] as const;
const DECISIONS = ["APPROVED", "REJECTED"] as const;
const FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;
type Decision = (typeof DECISIONS)[number];

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
  prisma.towCompanyProfile.findFirst({ where, include: { user: { select: { fullName: true, email: true } } } });
type CompanyRow = NonNullable<Awaited<ReturnType<typeof loadCompany>>>;

const shapeCompany = (c: CompanyRow) => ({
  id: c.id,
  companyName: c.companyName,
  contactName: c.user.fullName,
  ownerEmail: c.user.email,
  phone: c.phone,
  city: c.city,
  address: c.address,
  licenceNumber: c.licenceNumber,
  verificationStatus: c.verificationStatus,
  rejectionReason: c.rejectionReason,
  documents: [] as never[],
});

type TruckRow = Awaited<ReturnType<typeof prisma.truck.findMany>>[number];
const shapeTruck = (t: TruckRow, history: unknown[] = []) => ({
  id: t.id,
  companyId: t.companyId,
  plateNumber: t.plateNumber,
  make: t.make,
  model: t.model,
  year: t.year,
  truckType: t.truckType,
  verificationStatus: t.verificationStatus,
  operationalStatus: t.operationalStatus,
  rejectionReason: t.rejectionReason,
  photoUri: null,
  documents: [] as never[],
  history,
});

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

async function trucksWithHistory(trucks: TruckRow[]) {
  const h = await historyFor(trucks.map((t) => t.id));
  return trucks.map((t) => shapeTruck(t, h.get(t.id) ?? []));
}

// ---- vehicle input ----

type Vehicle = { plateNumber: string; make: string; model: string; year: number | null; truckType: (typeof TRUCK_TYPES)[number] };

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
  if (has("truckType")) {
    if (!TRUCK_TYPES.includes(body.truckType)) return { error: "Truck type is invalid." };
    data.truckType = body.truckType;
  }
  if (full) {
    for (const k of ["plateNumber", "make", "model", "truckType"] as const) if (data[k] === undefined) return { error: `${k} is required.` };
    if (data.year === undefined) data.year = null;
  } else if (!Object.keys(data).length) {
    return { error: "No vehicle fields to update." };
  }
  return { data };
}

const plateTaken = async (plate: string, exceptId?: string) =>
  !!(await prisma.truck.findFirst({
    where: { plateNumber: { equals: plate, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  }));

// =====================================================================
// Tow company (TOW_PROVIDER)
// =====================================================================
const provider = [requireAuth, requireTowProvider];

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

router.get("/tow/me/trucks", ...provider, async (_req, res) => {
  try {
    const c = await myCompany(res);
    if (!c) return;
    const trucks = await prisma.truck.findMany({ where: { companyId: c.id }, orderBy: { createdAt: "asc" } });
    return res.json({ success: true, trucks: await trucksWithHistory(trucks) });
  } catch (e) {
    return fail(res, "Tow trucks error", e);
  }
});

/** 404 (not 403) for a truck that belongs to another company, so ids can't be probed. */
async function ownTruck(req: any, res: any) {
  const c = await myCompany(res);
  if (!c) return null;
  const t = await prisma.truck.findFirst({ where: { id: idParam(req.params.id), companyId: c.id } });
  if (!t) {
    bad(res, 404, "Truck not found.");
    return null;
  }
  return t;
}

router.get("/tow/me/trucks/:id", ...provider, async (req, res) => {
  try {
    const t = await ownTruck(req, res);
    if (!t) return;
    return res.json({ success: true, truck: (await trucksWithHistory([t]))[0] });
  } catch (e) {
    return fail(res, "Tow truck error", e);
  }
});

router.post("/tow/me/trucks", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const c = await myCompany(res);
    if (!c) return;
    if (c.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    const parsed = parseVehicle(req.body, true);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const v = parsed.data as Vehicle;
    if (await plateTaken(v.plateNumber)) return bad(res, 409, "A truck with this plate already exists.");

    // Status fields are never taken from the body: always PENDING / OUT_OF_SERVICE.
    const truck = await prisma.$transaction(async (tx) => {
      const created = await tx.truck.create({
        data: { ...v, companyId: c.id, verificationStatus: "PENDING", operationalStatus: "OUT_OF_SERVICE" },
      });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: "TOW_TRUCK_CREATED", targetId: created.id, details: { plateNumber: created.plateNumber } },
      });
      return created;
    });
    return res.status(201).json({ success: true, truck: (await trucksWithHistory([truck]))[0] });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return bad(res, 409, "A truck with this plate already exists.");
    return fail(res, "Tow truck create error", e);
  }
});

router.patch("/tow/me/trucks/:id", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const t = await ownTruck(req, res);
    if (!t) return;
    const owner = await loadCompany({ id: t.companyId });
    if (owner?.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    const parsed = parseVehicle(req.body, false);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const data = parsed.data;

    const changed = (Object.keys(data) as (keyof Vehicle)[]).filter((k) => data[k] !== t[k]);
    if (!changed.length) return res.json({ success: true, truck: (await trucksWithHistory([t]))[0] });
    if (data.plateNumber && data.plateNumber.toLowerCase() !== t.plateNumber.toLowerCase() && (await plateTaken(data.plateNumber, t.id)))
      return bad(res, 409, "A truck with this plate already exists.");

    // Changing vehicle details sends an approved/rejected truck back to review.
    const resubmit = t.verificationStatus !== "PENDING";
    const [updated] = await prisma.$transaction([
      prisma.truck.update({
        where: { id: t.id },
        data: {
          ...data,
          ...(resubmit ? { verificationStatus: "PENDING" as const, rejectionReason: null, reviewedById: null, reviewedAt: null } : {}),
        },
      }),
      log(actor.id, "TOW_TRUCK_EDITED", t.id, { fields: changed, resubmitted: resubmit }),
    ]);
    return res.json({ success: true, truck: (await trucksWithHistory([updated]))[0] });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return bad(res, 409, "A truck with this plate already exists.");
    return fail(res, "Tow truck update error", e);
  }
});

router.patch("/tow/me/trucks/:id/status", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const t = await ownTruck(req, res);
    if (!t) return;
    const next = req.body?.operationalStatus;
    if (!OPERATIONAL.includes(next)) return bad(res, 400, "Operational status is invalid.");
    if (t.verificationStatus !== "APPROVED") return bad(res, 409, "Only an approved truck can change its operational status.");

    const [updated] = await prisma.$transaction([
      prisma.truck.update({ where: { id: t.id }, data: { operationalStatus: next } }),
      log(actor.id, "TOW_TRUCK_STATUS_CHANGED", t.id, { from: t.operationalStatus, to: next }),
    ]);
    return res.json({ success: true, truck: (await trucksWithHistory([updated]))[0] });
  } catch (e) {
    return fail(res, "Tow truck status error", e);
  }
});

router.delete("/tow/me/trucks/:id", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const t = await ownTruck(req, res);
    if (!t) return;
    if (t.operationalStatus === "BUSY") return bad(res, 409, "This truck is engaged in a service and cannot be removed.");

    await prisma.$transaction([
      log(actor.id, "TOW_TRUCK_REMOVED", t.id, { plateNumber: t.plateNumber }),
      prisma.truck.delete({ where: { id: t.id } }),
    ]);
    return res.json({ success: true });
  } catch (e) {
    return fail(res, "Tow truck delete error", e);
  }
});

// =====================================================================
// Admin (SUPER_ADMIN or ADMIN + MANAGE_TOWING): decisions only
// =====================================================================
const admin = [requireAuth, requireTowAdmin];

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
      include: { user: { select: { fullName: true, email: true } }, trucks: { select: { verificationStatus: true } } },
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
    const trucks = await prisma.truck.findMany({
      where: q ? { plateNumber: { contains: q, mode: "insensitive" } } : {},
      orderBy: { createdAt: "asc" },
    });
    return res.json({ success: true, trucks: trucks.map((t) => shapeTruck(t)) });
  } catch (e) {
    return fail(res, "Tow admin trucks error", e);
  }
});

router.get("/admin/tow/companies/:id", ...admin, async (req, res) => {
  try {
    const c = await loadCompany({ id: idParam(req.params.id) });
    if (!c) return bad(res, 404, "Company not found.");
    const trucks = await prisma.truck.findMany({ where: { companyId: c.id }, orderBy: { createdAt: "asc" } });
    return res.json({ success: true, company: shapeCompany(c), trucks: await trucksWithHistory(trucks) });
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
    const t = await prisma.truck.findUnique({ where: { id: idParam(req.params.id) } });
    if (!t) return bad(res, 404, "Truck not found.");

    const [updated] = await prisma.$transaction([
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
    return res.json({ success: true, truck: (await trucksWithHistory([updated]))[0] });
  } catch (e) {
    return fail(res, "Tow truck decision error", e);
  }
});

export default router;
