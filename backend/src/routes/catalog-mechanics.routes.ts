import { Router } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { canonicalCity } from "../cities.js";
import { MECHANIC_SKILLS } from "../mechanicSkills.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { errorBody } from "../services/error-codes.js";
import { distanceTo, readPoint, text } from "./catalog.routes.js";

// Customer catalog of mechanics. Mounted under /api/catalog (see server.ts).
//
// WHO IS PUBLIC (one rule, `publicMechanic`, also used by mechanic requests): a MECHANIC whose account is ACTIVE and whose
// MechanicProfile is VERIFIED (the mechanics admin approved it after the documents + interview review). Approval covers all of
// the specializations the mechanic listed, so those are the skills customers see. Garages (later) add their mechanics here.
// PRIVACY: responses are built from an explicit field list. Never returned: phone, email, national id, documents, review or
// interview notes.
const router = Router();
router.use(requireAuth);

const PAGE_SIZE = 20;
const bad = (res: any, code: number, message: string) => res.status(code).json(errorBody(message));
const fail = (res: any, label: string, error: unknown) => {
  console.error(`${label}:`, error);
  return res.status(500).json(errorBody("Internal server error."));
};

/** The only mechanics a customer may ever see or send a request to. */
export const publicMechanic: Prisma.UserWhereInput = {
  role: "MECHANIC",
  status: "ACTIVE",
  mechanicProfile: { is: { verificationStatus: "VERIFIED" } },
};

/** The approved skills of a public mechanic, in the fixed catalog order (unknown names are never shown). */
export const skillsOf = (specializations: string[]) => MECHANIC_SKILLS.filter((s) => specializations.includes(s));

const select = {
  id: true,
  fullName: true,
  mechanicProfile: { select: { workshopName: true, workshopAddress: true, city: true, specializations: true, yearsOfExperience: true } },
} satisfies Prisma.UserSelect;
type Row = Prisma.UserGetPayload<{ select: typeof select }>;

const shape = (u: Row, detail = false) => {
  const p = u.mechanicProfile!;
  return {
    id: u.id,
    name: u.fullName,
    workshopName: p.workshopName || null,
    city: p.city,
    skills: skillsOf(p.specializations),
    yearsOfExperience: p.yearsOfExperience,
    ...(detail ? { workshopAddress: p.workshopAddress || null } : {}),
  };
};

// ?q= (name or workshop) &city= &skill= &lat=&lng= (both or none) &sort=name|nearest &page=
// With a position every row gets distanceKm + distanceSource ("base" = workshop coordinates, "city" = city centre).
// MOTEXA stores no workshop coordinates yet, so today the source is always "city".
router.get("/mechanics", async (req, res) => {
  try {
    const q = text(req.query.q, 100);
    const cityRaw = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const city = cityRaw ? canonicalCity(cityRaw) : null;
    if (cityRaw && !city) return bad(res, 400, "Unknown city. Choose from the city list.");
    const skill = typeof req.query.skill === "string" ? req.query.skill : "";
    if (skill && !MECHANIC_SKILLS.includes(skill as never)) return bad(res, 400, `skill must be one of: ${MECHANIC_SKILLS.join(", ")}.`);
    const point = readPoint(req.query);
    if (typeof point === "string") return bad(res, 400, point);
    const sort = typeof req.query.sort === "string" ? req.query.sort : point ? "nearest" : "name";
    if (sort !== "name" && sort !== "nearest") return bad(res, 400, "sort must be one of: name, nearest.");
    if (sort === "nearest" && !point) return bad(res, 400, "sort=nearest needs lat and lng.");
    const pageRaw = typeof req.query.page === "string" ? req.query.page : "1";
    const page = Number(pageRaw);
    if (!/^\d+$/.test(pageRaw) || page < 1 || page > 10_000) return bad(res, 400, "page must be a positive whole number.");

    const rows = await prisma.user.findMany({
      where: {
        ...publicMechanic,
        mechanicProfile: {
          is: {
            verificationStatus: "VERIFIED",
            ...(skill ? { specializations: { has: skill } } : {}),
            ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
          },
        },
        ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { mechanicProfile: { is: { workshopName: { contains: q, mode: "insensitive" } } } }] } : {}),
      },
      select,
    });
    const all = rows
      .map((u) => ({ ...shape(u), ...(point ? distanceTo(point, { city: u.mechanicProfile!.city ?? "", baseLat: null, baseLng: null }) : {}) }))
      .sort((a, b) => {
        const km = (x: object) => (x as { distanceKm?: number | null }).distanceKm ?? Infinity;
        const byDistance = sort === "nearest" ? km(a) - km(b) : 0;
        return (Number.isNaN(byDistance) ? 0 : byDistance) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      });
    return res.json({ success: true, mechanics: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pageSize: PAGE_SIZE, total: all.length, hasMore: page * PAGE_SIZE < all.length });
  } catch (e) {
    return fail(res, "Catalog mechanics error", e);
  }
});

// The fixed skills, each with the number of public mechanics who hold it (zero is listed too).
router.get("/mechanic-skills", async (_req, res) => {
  try {
    const rows = await prisma.mechanicProfile.findMany({ where: { verificationStatus: "VERIFIED", user: { role: "MECHANIC", status: "ACTIVE" } }, select: { specializations: true } });
    const count = new Map<string, number>();
    for (const r of rows) for (const s of skillsOf(r.specializations)) count.set(s, (count.get(s) ?? 0) + 1);
    return res.json({ success: true, skills: MECHANIC_SKILLS.map((key) => ({ key, count: count.get(key) ?? 0 })) });
  } catch (e) {
    return fail(res, "Catalog mechanic skills error", e);
  }
});

router.get("/mechanics/:id", async (req, res) => {
  try {
    const point = readPoint(req.query);
    if (typeof point === "string") return bad(res, 400, point);
    const u = await prisma.user.findFirst({ where: { id: String(req.params.id), ...publicMechanic }, select });
    if (!u) return bad(res, 404, "Mechanic not found.");
    return res.json({ success: true, mechanic: { ...shape(u, true), ...(point ? distanceTo(point, { city: u.mechanicProfile!.city ?? "", baseLat: null, baseLng: null }) : {}) } });
  } catch (e) {
    return fail(res, "Catalog mechanic error", e);
  }
});

export default router;
