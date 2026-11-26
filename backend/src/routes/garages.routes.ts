// Garages (= the tow company pattern for mechanics; rules in services/garage-staff.ts). Mounted under /api, before the global JSON parser.
//  - /garage/me/*                      the APPROVED garage owner: profile, his mechanics (add / edit / invite), requests (assign with
//                                      "nearest available", decline), the live map of his online mechanics and active jobs
//  - /mechanic/me/duty|availability|location   a garage mechanic: his status, the Online switch, his point while Online (~60 s)
//  - /admin/garages/mechanics[/:id/review]     mechanics admins: ID review of garage mechanics
//  - /admin/mechanics/live                     mechanics admins: online garage mechanics + active mechanic jobs on one map
//  - /catalog/garages[/:id]                    customers: approved garages (rounded pin) and their approved mechanics (first name)
// Privacy: customers get a garage's pin rounded to 3 decimals and its mechanics' first names, never a live point (only the mechanic
// assigned to THEIR active job, in the request's own view). Owners and admins see live points only while the mechanic is Online.
import express, { Router } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireCustomer, requireGarageOwner, requireMechanicsAdmin } from "../middleware/auth.middleware.js";
import { round3 } from "../geo.js";
import { MECHANIC_SKILLS } from "../mechanicSkills.js";
import { canonicalCity } from "../cities.js";
import { errorBody } from "../services/error-codes.js";
import { requireApprovedProvider } from "../services/provider-onboarding.js";
import { presenceOf } from "../services/presence.js";
import {
  GarageError,
  JOB_ACTIVE,
  addGarageMechanic,
  assignGarageRequest,
  cleanSkills,
  declineGarageRequest,
  garageDutyPing,
  garageMechanicStatus,
  myGarageMechanic,
  nearestGarageMechanics,
  ownGarage,
  resendGarageInvite,
  reviewGarageMechanic,
  setGarageMechanicOffline,
  updateGarageMechanic,
} from "../services/garage-staff.js";
import { distanceTo, exactKmTo, readPoint } from "./catalog.routes.js";
import { include, mechanicView } from "./mechanic-requests.routes.js";

const router = Router();
const json = express.json({ limit: "16kb" });
const withPhotos = express.json({ limit: "14mb" }); // a mechanic's photo + ID photo (base64, up to 5 MB each)
const ownerSide = [requireAuth, requireGarageOwner, requireApprovedProvider, json];
const ownerPhotos = [requireAuth, requireGarageOwner, requireApprovedProvider, withPhotos];
const mechanicSide = [requireAuth, (_req: any, res: any, next: any) => (res.locals.authUser?.role === "MECHANIC" ? next() : res.status(403).json(errorBody("Mechanic access required."))), json];
const adminSide = [requireAuth, requireMechanicsAdmin, json];

const send = (res: any, e: unknown, label: string) => {
  if (e instanceof GarageError) return res.status(e.code).json(errorBody(e.message));
  console.error(`${label}:`, e);
  return res.status(500).json(errorBody("Internal server error."));
};
const me = (res: any) => (res.locals.authUser as { id: string }).id;
const id = (v: unknown) => String(v);
const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;
const fileUri = (f: { id: string; visibility: string }) => `/files/${f.visibility === "PUBLIC" ? "public" : "private"}/${f.id}`;
const OPEN = ["REQUESTED", ...JOB_ACTIVE] as const;

const staffInclude = {
  user: { select: { fullName: true, email: true, status: true } },
  files: { select: { id: true, purpose: true, visibility: true } },
  garage: { select: { id: true, garageName: true } },
} satisfies Prisma.GarageMechanicInclude;
type Staff = Prisma.GarageMechanicGetPayload<{ include: typeof staffInclude }>;
/** one garage mechanic as his owner / a mechanics admin sees him (phone and ID only for them) */
async function staffView(m: Staff) {
  const job = await prisma.mechanicRequest.findFirst({ where: { mechanicUserId: m.userId, status: { in: [...OPEN] } }, orderBy: { updatedAt: "desc" }, include: { customer: { select: { fullName: true } } } });
  const photo = m.files.find((f) => f.purpose === "GARAGE_MECHANIC_PHOTO"), idFile = m.files.find((f) => f.purpose === "GARAGE_MECHANIC_ID");
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.fullName,
    email: m.user.email,
    phone: m.phone,
    skills: m.skills,
    garage: { id: m.garage.id, name: m.garage.garageName },
    approval: m.approval,
    approvalReason: m.approvalReason,
    offline: m.offline,
    status: await garageMechanicStatus(prisma, m),
    photoUri: photo ? fileUri(photo) : null,
    idUri: idFile ? fileUri(idFile) : null,
    job: job ? { id: job.id, status: job.status, customerFirstName: firstName(job.customer.fullName) } : null,
    live: m.offline ? null : presenceOf(m),
    createdAt: m.createdAt,
  };
}

// =====================================================================
// Garage owner
// =====================================================================
router.get("/garage/me", ...ownerSide, async (_req, res) => {
  try {
    const g = await ownGarage(me(res));
    const row = await prisma.garageProfile.findUniqueOrThrow({ where: { id: g.id } });
    const [mechanics, waiting, active] = await Promise.all([
      prisma.garageMechanic.findMany({ where: { garageId: g.id }, select: { userId: true, offline: true, approval: true } }),
      prisma.mechanicRequest.count({ where: { garageId: g.id, status: "REQUESTED", mechanicUserId: null } }),
      prisma.mechanicRequest.count({ where: { garageId: g.id, status: { in: [...JOB_ACTIVE] } } }),
    ]);
    const statuses = await Promise.all(mechanics.map((m) => garageMechanicStatus(prisma, m)));
    const n = (s: string) => statuses.filter((x) => x === s).length;
    return res.json({
      success: true,
      garage: { id: row.id, name: row.garageName, nameAr: row.garageNameAr, phone: row.phone, city: row.city, address: row.address, description: row.description, workingHours: row.workingHours, open24h: row.open24h, services: row.services, base: row.baseLat !== null && row.baseLng !== null ? { lat: row.baseLat, lng: row.baseLng } : null },
      counts: { mechanics: mechanics.length, free: n("FREE"), busy: n("BUSY"), offline: n("OFFLINE"), unapproved: n("UNAPPROVED"), toAssign: waiting, activeJobs: active },
    });
  } catch (e) {
    return send(res, e, "Garage me error");
  }
});

// the public profile text the owner edits himself (never a verification field)
router.patch("/garage/me", ...ownerSide, async (req, res) => {
  try {
    const g = await ownGarage(me(res));
    const b = req.body ?? {}, data: Prisma.GarageProfileUpdateInput = {};
    if (b.description !== undefined) data.description = typeof b.description === "string" ? b.description.trim().slice(0, 600) || null : null;
    if (b.workingHours !== undefined) data.workingHours = typeof b.workingHours === "string" ? b.workingHours.trim().slice(0, 100) || null : null;
    if (b.open24h !== undefined) {
      if (typeof b.open24h !== "boolean") throw new GarageError(400, "open24h must be true or false.");
      data.open24h = b.open24h;
    }
    if (b.services !== undefined) data.services = cleanSkills(b.services);
    if (!Object.keys(data).length) throw new GarageError(400, "Nothing to change.");
    await prisma.garageProfile.update({ where: { id: g.id }, data });
    await prisma.auditLog.create({ data: { actorId: me(res), action: "GARAGE_PROFILE_UPDATED", targetId: g.id, details: { changed: Object.keys(data) } } });
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Garage update error");
  }
});

router.get("/garage/me/mechanics", ...ownerSide, async (_req, res) => {
  try {
    const g = await ownGarage(me(res));
    const rows = await prisma.garageMechanic.findMany({ where: { garageId: g.id }, include: staffInclude, orderBy: { createdAt: "asc" } });
    return res.json({ success: true, mechanics: await Promise.all(rows.map(staffView)) });
  } catch (e) {
    return send(res, e, "Garage mechanics error");
  }
});
router.post("/garage/me/mechanics", ...ownerPhotos, async (req, res) => {
  try {
    const m = await addGarageMechanic(me(res), req.body);
    return res.status(201).json({ success: true, mechanicId: m.id });
  } catch (e) {
    return send(res, e, "Add garage mechanic error");
  }
});
router.patch("/garage/me/mechanics/:id", ...ownerPhotos, async (req, res) => {
  try {
    await updateGarageMechanic(me(res), id(req.params.id), req.body);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Update garage mechanic error");
  }
});
router.post("/garage/me/mechanics/:id/invite", ...ownerSide, async (req, res) => {
  try {
    await resendGarageInvite(me(res), id(req.params.id));
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Garage mechanic invite error");
  }
});

// ?scope=open (default) | history
router.get("/garage/me/requests", ...ownerSide, async (req, res) => {
  try {
    const g = await ownGarage(me(res));
    const history = req.query.scope === "history";
    const rows = await prisma.mechanicRequest.findMany({
      where: { garageId: g.id, status: history ? { in: ["COMPLETED", "DECLINED", "CANCELLED"] } : { in: [...OPEN] } },
      include,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return res.json({ success: true, requests: rows.map(mechanicView) });
  } catch (e) {
    return send(res, e, "Garage requests error");
  }
});

/** one request as the owner sees it (the mechanic's location rule) + "nearest available" while it can be (re)assigned */
router.get("/garage/me/requests/:id", ...ownerSide, async (req, res) => {
  try {
    const g = await ownGarage(me(res));
    const row = await prisma.mechanicRequest.findFirst({ where: { id: id(req.params.id), garageId: g.id }, include });
    if (!row) throw new GarageError(404, "Request not found.");
    const assignable = row.status === "REQUESTED" || row.status === "ACCEPTED";
    // the distance is measured to the customer's pin (the owner only sees it rounded before acceptance; the order stays the same)
    const to = row.locationLat !== null && row.locationLng !== null ? { lat: row.locationLat, lng: row.locationLng } : null;
    return res.json({ success: true, request: mechanicView(row), suggestions: assignable ? await nearestGarageMechanics(g.id, to, row.skill) : [] });
  } catch (e) {
    return send(res, e, "Garage request error");
  }
});
router.post("/garage/me/requests/:id/assign", ...ownerSide, async (req, res) => {
  try {
    const mechanicId = typeof req.body?.mechanicId === "string" ? req.body.mechanicId : "";
    if (!mechanicId) throw new GarageError(400, "mechanicId is required.");
    await assignGarageRequest(me(res), id(req.params.id), mechanicId);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Garage assign error");
  }
});
router.post("/garage/me/requests/:id/decline", ...ownerSide, async (req, res) => {
  try {
    await declineGarageRequest(me(res), id(req.params.id), req.body?.reason);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Garage decline error");
  }
});

// the owner's live map: his online mechanics (latest point) and the garage's active jobs
router.get("/garage/me/live", ...ownerSide, async (_req, res) => {
  try {
    const g = await ownGarage(me(res));
    const [staff, jobs] = await Promise.all([
      prisma.garageMechanic.findMany({ where: { garageId: g.id, approval: "APPROVED", offline: false }, include: staffInclude }),
      prisma.mechanicRequest.findMany({ where: { garageId: g.id, status: { in: [...OPEN] } }, include, orderBy: { updatedAt: "desc" }, take: 100 }),
    ]);
    return res.json({ success: true, base: g.baseLat !== null && g.baseLng !== null ? { lat: g.baseLat, lng: g.baseLng } : null, mechanics: await Promise.all(staff.map(staffView)), jobs: jobs.map(mechanicView) });
  } catch (e) {
    return send(res, e, "Garage live error");
  }
});

// =====================================================================
// Garage mechanic: status, Online switch, his point while Online
// =====================================================================
router.get("/mechanic/me/duty", ...mechanicSide, async (_req, res) => {
  try {
    const m = await myGarageMechanic(me(res));
    if (!m) return res.json({ success: true, duty: null }); // an independent mechanic: no garage, no Online switch
    return res.json({
      success: true,
      duty: { id: m.id, garage: { id: m.garage.id, name: m.garage.garageName, nameAr: m.garage.garageNameAr }, skills: m.skills, offline: m.offline, approval: m.approval, approvalReason: m.approvalReason, status: await garageMechanicStatus(prisma, m), live: m.offline ? null : presenceOf(m) },
    });
  } catch (e) {
    return send(res, e, "Mechanic duty error");
  }
});
router.put("/mechanic/me/availability", ...mechanicSide, async (req, res) => {
  try {
    await setGarageMechanicOffline(me(res), req.body?.offline);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Mechanic availability error");
  }
});
router.post("/mechanic/me/location", ...mechanicSide, async (req, res) => {
  try {
    return res.json({ success: true, ...(await garageDutyPing(me(res), req.body?.lat, req.body?.lng)) });
  } catch (e) {
    return send(res, e, "Mechanic duty location error");
  }
});

// =====================================================================
// Mechanics admins
// =====================================================================
// ?approval=PENDING (default) | APPROVED | REJECTED | SUSPENDED | ALL
router.get("/admin/garages/mechanics", ...adminSide, async (req, res) => {
  try {
    const a = typeof req.query.approval === "string" ? req.query.approval : "PENDING";
    if (!["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "ALL"].includes(a)) throw new GarageError(400, "Invalid approval filter.");
    const rows = await prisma.garageMechanic.findMany({ where: a === "ALL" ? {} : { approval: a as never }, include: staffInclude, orderBy: { createdAt: "desc" }, take: 200 });
    return res.json({ success: true, mechanics: await Promise.all(rows.map(staffView)) });
  } catch (e) {
    return send(res, e, "Admin garage mechanics error");
  }
});
router.post("/admin/garages/mechanics/:id/review", ...adminSide, async (req, res) => {
  try {
    await reviewGarageMechanic(me(res), id(req.params.id), req.body?.decision, req.body?.reason);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Admin garage mechanic review error");
  }
});
// one map: every online approved garage mechanic (latest point) + every active mechanic job (the mechanic's location rule)
router.get("/admin/mechanics/live", ...adminSide, async (_req, res) => {
  try {
    const [staff, jobs] = await Promise.all([
      prisma.garageMechanic.findMany({ where: { approval: "APPROVED", offline: false, garage: { verificationStatus: "APPROVED" } }, include: staffInclude, take: 500 }),
      prisma.mechanicRequest.findMany({ where: { status: { in: [...OPEN] } }, include, orderBy: { updatedAt: "desc" }, take: 200 }),
    ]);
    return res.json({ success: true, mechanics: await Promise.all(staff.map(staffView)), jobs: jobs.map(mechanicView) });
  } catch (e) {
    return send(res, e, "Admin mechanics live error");
  }
});

// =====================================================================
// Customers: approved garages and their mechanics
// =====================================================================
const customerSide = [requireAuth, requireCustomer];
const publicGarage = { verificationStatus: "APPROVED", user: { status: "ACTIVE" } } satisfies Prisma.GarageProfileWhereInput;
const garageSelect = {
  id: true, garageName: true, garageNameAr: true, city: true, address: true, description: true, workingHours: true, open24h: true, services: true, baseLat: true, baseLng: true,
  mechanics: { where: { approval: "APPROVED", user: { status: "ACTIVE" } }, select: { userId: true, offline: true, approval: true, skills: true, user: { select: { fullName: true } }, files: { where: { purpose: "GARAGE_MECHANIC_PHOTO" }, select: { id: true } } } },
} satisfies Prisma.GarageProfileSelect;
type PublicGarage = Prisma.GarageProfileGetPayload<{ select: typeof garageSelect }>;
async function garageCard(g: PublicGarage, from: { lat: number; lng: number } | null, detail = false) {
  const statuses = await Promise.all(g.mechanics.map((m) => garageMechanicStatus(prisma, m)));
  return {
    id: g.id,
    name: g.garageName,
    nameAr: g.garageNameAr,
    city: g.city,
    services: MECHANIC_SKILLS.filter((s) => g.services.includes(s)),
    workingHours: g.open24h ? "24/7" : g.workingHours,
    open24h: g.open24h,
    pin: g.baseLat !== null && g.baseLng !== null ? { lat: round3(g.baseLat)!, lng: round3(g.baseLng)! } : null, // rounded (~100 m)
    mechanicsCount: g.mechanics.length,
    freeCount: statuses.filter((s) => s === "FREE").length,
    ...(from ? distanceTo(from, { city: g.city, baseLat: g.baseLat, baseLng: g.baseLng }) : {}),
    ...(detail
      ? {
          description: g.description,
          address: g.address,
          mechanics: g.mechanics.map((m, i) => ({ id: m.userId, name: firstName(m.user.fullName), skills: MECHANIC_SKILLS.filter((s) => m.skills.includes(s)), free: statuses[i] === "FREE", photoUri: m.files[0] ? `/files/public/${m.files[0].id}` : null })),
        }
      : {}),
  };
}

// ?q= (name) &city= &skill= &lat=&lng= (nearest first when given)
router.get("/catalog/garages", ...customerSide, async (req, res) => {
  try {
    const point = readPoint(req.query);
    if (typeof point === "string") throw new GarageError(400, point);
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const cityRaw = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const city = cityRaw ? canonicalCity(cityRaw) : null;
    if (cityRaw && !city) throw new GarageError(400, "Unknown city. Choose from the city list.");
    const skill = typeof req.query.skill === "string" && req.query.skill ? req.query.skill : "";
    if (skill && !(MECHANIC_SKILLS as readonly string[]).includes(skill)) throw new GarageError(400, "Unknown skill.");
    const rows = await prisma.garageProfile.findMany({
      where: { ...publicGarage, ...(city ? { city } : {}), ...(skill ? { services: { has: skill } } : {}), ...(q ? { OR: [{ garageName: { contains: q, mode: "insensitive" } }, { garageNameAr: { contains: q, mode: "insensitive" } }] } : {}) },
      select: garageSelect,
      take: 200,
    });
    const sorted = point ? rows.map((g) => ({ g, km: exactKmTo(point, { city: g.city, baseLat: g.baseLat, baseLng: g.baseLng }) ?? Infinity })).sort((a, b) => a.km - b.km).map((x) => x.g) : rows.sort((a, b) => a.garageName.localeCompare(b.garageName));
    return res.json({ success: true, garages: await Promise.all(sorted.map((g) => garageCard(g, point))) });
  } catch (e) {
    return send(res, e, "Catalog garages error");
  }
});
router.get("/catalog/garages/:id", ...customerSide, async (req, res) => {
  try {
    const point = readPoint(req.query);
    if (typeof point === "string") throw new GarageError(400, point);
    const g = await prisma.garageProfile.findFirst({ where: { id: id(req.params.id), ...publicGarage }, select: garageSelect });
    if (!g) throw new GarageError(404, "Garage not found.");
    return res.json({ success: true, garage: await garageCard(g, point, true) });
  } catch (e) {
    return send(res, e, "Catalog garage error");
  }
});

export default router;
