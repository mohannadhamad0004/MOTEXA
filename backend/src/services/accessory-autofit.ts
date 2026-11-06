// Accessory auto-fit per (accessory x vehicle generation): computed ONCE by the real viewer (sceneHtml fitAccessory, headless via
// scripts/accessory-fit-check.mjs --views=fit), stored, replayed by the app as kit.fit. It stays current while the part file, the car file +
// its runtime config (zones, confirmed part map) and the viewer's fit version for its type's group (FIT_VERSIONS: rims / wings / bumpers /
// other) are unchanged; otherwise it is computed again. Bumping one group never touches the stored (approved, corrected) fits of another.
// The Parts Admin approves it or stores a correction (adj); customers' own Adjust goes on top.
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { modelFileSha } from "./car-part-map.js";
import { REPO_ROOT } from "./vehicle3d-catalog.js";
import { PRIVATE_3D_DIR, privatePath } from "./vehicle3d-private-assets.js";
import { digest, fail } from "./vehicle3d-validation.js";

type Adj = { x: number; y: number; z: number; rx: number; ry: number; s: number };
/** The viewer's fit version for an accessory type (sceneHtml.ts FIT_VERSIONS + FIT_GROUPS are the single source; the server only compares). */
export function fitVersion(type: string): number {
  const src = readFileSync(path.join(REPO_ROOT, "mobile/src/features/car3d/sceneHtml.ts"), "utf8");
  const obj = (name: string) => JSON.parse(new RegExp(`var ${name} = (\\{[^}]*\\});`).exec(src)?.[1] ?? "{}") as Record<string, unknown>;
  const v = obj("FIT_VERSIONS")[String(obj("FIT_GROUPS")[type] ?? "other")];
  return typeof v === "number" ? v : 0;
}
const typeOf = (fit: unknown) => String((fit as { type?: unknown } | null)?.type ?? "");
const partRevision = (privateModelPath: string | null) => digest(Buffer.from(privateModelPath ?? "")).slice(0, 16); // = accessory3d modelRevision
/** The car as the app sees it: file + runtime config (zones, confirmed part map). */
async function carRevision(key: string, type: string): Promise<string | null> {
  const { modelWithZones } = await import("./accessory3d.js"); // lazy: accessory3d imports this module
  const sha = modelFileSha(key), m = await modelWithZones(key);
  return sha && m ? revisionOf(sha, m, type) : null;
}
/** The car as a fitter of this type sees it: file + runtime config. The RIMS zone (wheel inset) only counts for rims, so setting it
 *  never makes another type's stored (approved, corrected) fit on that car stale. */
export function revisionOf(sha: string, model: unknown, type: string): string {
  const m = model as { zones?: Record<string, unknown>; rimProposal?: unknown };
  const { rimProposal: _proposal, ...base } = m;
  const view = type === "RIMS" ? m : !base.zones?.RIMS ? base : { ...base, zones: Object.fromEntries(Object.entries(base.zones).filter(([k]) => k !== "RIMS")) };
  return createHash("sha256").update(sha + JSON.stringify(view)).digest("hex");
}
const num = (v: unknown, lim: number) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim;
const triple = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every(n => num(n, 50));
/** Exact shape of a viewer fit (it is replayed into the viewer, so nothing else gets through). */
export function validFit(f: unknown, version = fitVersion(typeOf(f))): boolean {
  const x = f as Record<string, unknown>;
  // a part that does not fit this car is stored too (computed once), with the viewer's reason
  if (x && typeof x === "object" && x.version === version && typeof x.type === "string" && typeof x.failed === "string") return x.failed.length <= 500 && JSON.stringify(f).length <= 20_000;
  return !!x && typeof x === "object" && x.version === version && typeof x.type === "string" && Array.isArray(x.orient) && x.orient.length === 3
    && Array.isArray(x.placements) && x.placements.length >= 1 && x.placements.length <= 4
    && x.placements.every((p: Record<string, unknown>) => triple(p.pos) && triple(p.sc) && triple(p.rot) && (p.side === 1 || p.side === -1))
    && Array.isArray(x.shadows) && x.shadows.length <= 4 && x.shadows.every((s: Record<string, unknown>) => ["x", "y", "z", "w", "d"].every(k => num(s[k], 50)))
    && (x.shift === undefined || (Array.isArray(x.shift) && x.shift.length <= 40 && x.shift.every((e: unknown) => Array.isArray(e) && typeof e[0] === "string" && num(e[1], 0.05))))
    && JSON.stringify(f).length <= 20_000;
}
export function parseAdj(v: unknown): Adj | null {
  const a = v as Record<string, unknown>;
  if (!a || typeof a !== "object" || !num(a.x, 0.5) || !num(a.y, 0.5) || !num(a.z, 0.5) || !num(a.rx, 0.8) || !num(a.ry, 0.8) || !(typeof a.s === "number" && a.s >= 0.8 && a.s <= 1.25)) return null;
  return { x: a.x as number, y: a.y as number, z: a.z as number, rx: a.rx as number, ry: a.ry as number, s: a.s as number };
}

/** Run the real viewer's fit for this accessory file on this car (headless, no screenshots). */
async function computeFit(type: string, size: Record<string, number | null>, privateModelPath: string, key: string) {
  const { modelWithZones } = await import("./accessory3d.js");
  const model = await modelWithZones(key); if (!model) return fail("NO_3D_CAR", "That generation has no published 3D car model.", 409);
  const dir = path.join(PRIVATE_3D_DIR, `tmp-fit-${randomUUID()}`); mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(dir, "config.json"), JSON.stringify(model)); writeFileSync(path.join(dir, "kit.json"), JSON.stringify({ type, size }));
    const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../../scripts/accessory-fit-check.mjs", import.meta.url)),
      `--car=${path.join(REPO_ROOT, "backend/public/3d", key + ".glb")}`, `--config=${path.join(dir, "config.json")}`, `--part=${privatePath(privateModelPath)}`,
      `--kit=${path.join(dir, "kit.json")}`, `--out=${dir}`, "--views=fit"], { timeout: 120_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout.trim().split("\n").pop()!).autofit as unknown;
  } catch (e) { // the viewer refused the fit (a bumper that does not fit this car cleanly, a pickup, no mount surface...)
    const why = /Error: ([^\n\r]*)/.exec(String((e as { stderr?: string }).stderr ?? ""))?.[1];
    if (why && !/ENOENT|Timeout|browser/i.test(why)) return { version: fitVersion(type), type, failed: why.slice(0, 500) };
    throw e;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

type Acc = { id: string; accessoryType: string; privateModelPath: string | null; widthMm: number | null; lengthMm: number | null; rimInches: number | null };
/** Store a computed fit. Already current = kept as is (computed once, the admin's correction stays); else replaced and back to unreviewed. */
export async function saveFit(a: Acc, generationId: string, key: string, fit: unknown) {
  const version = fitVersion(a.accessoryType); if (!validFit(fit, version)) return fail("INVALID_FIT", "The viewer returned an invalid fit.", 500);
  const carRev = await carRevision(key, a.accessoryType); if (!carRev) return fail("NO_3D_CAR", "That generation has no published 3D car model.", 409);
  const data = { model3dKey: key, carRevision: carRev, partRevision: partRevision(a.privateModelPath), fitVersion: version, fit: fit as Prisma.InputJsonValue };
  const old = await prisma.accessoryAutoFit.findUnique({ where: { accessoryId_generationId: { accessoryId: a.id, generationId } } });
  if (old && old.carRevision === data.carRevision && old.partRevision === data.partRevision && old.fitVersion === version) return old;
  return prisma.accessoryAutoFit.upsert({ where: { accessoryId_generationId: { accessoryId: a.id, generationId } }, create: { accessoryId: a.id, generationId, ...data },
    update: { ...data, adj: Prisma.DbNull, approvedAt: null, approvedByUserId: null } });
}
/** Is this stored fit still the one the app would compute? */
async function current(r: { carRevision: string; partRevision: string; fitVersion: number; model3dKey: string; fit: unknown }, privateModelPath: string | null) {
  return r.fitVersion === fitVersion(typeOf(r.fit)) && r.partRevision === partRevision(privateModelPath) && r.carRevision === await carRevision(r.model3dKey, typeOf(r.fit));
}

/** The generations an accessory is fitted on: its chosen ones, or for a "Universal by size" rim every published generation with a 3D car. */
type Gen = { model3dKey: string | null; isPublished: boolean; nameEn: string; vehicle?: { make: string } };
async function fittedOn<G extends Gen>(a: { accessoryType: string; product: { isUniversal: boolean }; fits: { generationId: string; generation: G }[] }, key?: string): Promise<{ generationId: string; generation: G }[]> {
  if (a.accessoryType !== "RIMS" || !a.product.isUniversal) return a.fits.filter(f => !key || f.generation.model3dKey === key);
  const gens = await prisma.vehicleGeneration.findMany({ where: { model3dKey: key ?? { not: null }, isPublished: true }, include: { vehicle: true } });
  return gens.map(g => ({ generationId: g.id, generation: g as unknown as G })); // findMany includes vehicle: a superset of every G used here
}

const running = new Map<string, Promise<unknown>>();
/** Background: fit this accessory on every generation it fits that has a published 3D car (missing or stale fits only). */
export function autoFitAccessory(accessoryId: string) {
  if (!running.has(accessoryId)) running.set(accessoryId, (async () => {
    const a = await prisma.productAccessory3D.findUnique({ where: { id: accessoryId }, include: { product: { select: { isUniversal: true } }, fits: { include: { generation: true } }, autoFits: true } });
    if (!a?.privateModelPath) return;
    for (const f of await fittedOn(a)) {
      const key = f.generation.model3dKey; if (!key || !f.generation.isPublished) continue;
      const row = a.autoFits.find(r => r.generationId === f.generationId);
      if (row && await current(row, a.privateModelPath)) continue;
      try { await saveFit(a, f.generationId, key, await computeFit(a.accessoryType, { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, a.privateModelPath, key)); }
      catch { console.error(`Accessory auto-fit failed for ${accessoryId} on ${key}.`); }
    }
  })().finally(() => running.delete(accessoryId)));
  return running.get(accessoryId)!;
}

export function createAutoFitService() {
  return {
    /** Accessories (published / in final review) on this car model, with their stored fit; missing or stale fits are computed in the background. */
    list: async (key: string) => {
      const rows = await prisma.productAccessory3D.findMany({ where: { status: { in: ["PUBLISHED", "READY_FOR_FINAL_REVIEW"] }, OR: [{ fits: { some: { generation: { model3dKey: key, isPublished: true } } } }, { accessoryType: "RIMS", product: { isUniversal: true } }] },
        include: { product: { select: { name: true, isUniversal: true } }, fits: { where: { generation: { model3dKey: key } }, include: { generation: { include: { vehicle: true } } } }, autoFits: true } });
      const out = [];
      for (const a of rows) for (const f of await fittedOn(a, key)) {
        const r = a.autoFits.find(x => x.generationId === f.generationId), ok = !!r && await current(r, a.privateModelPath);
        if (!ok) void autoFitAccessory(a.id);
        out.push({ accessoryId: a.id, productId: a.productId, productName: a.product?.name ?? "", kitPart: a.kitPart, type: a.accessoryType, status: a.status,
          file: a.status === "PUBLISHED" && a.publishedFile ? `accessories/${a.publishedFile}.glb` : null, size: { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches },
          generation: { id: f.generationId, name: `${f.generation.vehicle.make} ${f.generation.nameEn}` }, finish: a.rimFinish,
          fit: ok && r ? { fit: r.fit, adj: r.adj, approvedAt: r.approvedAt } : null, computing: !ok });
      }
      return out;
    },
    /** The Parts Admin approves the fit, with an optional correction (adj null = the pure auto-fit, "Reset to auto-fit"). */
    approve: async (uid: string, accessoryId: string, generationId: string, body: { adj?: unknown }) => {
      const r = await prisma.accessoryAutoFit.findUnique({ where: { accessoryId_generationId: { accessoryId, generationId } }, include: { accessory: { select: { privateModelPath: true } } } });
      if (!r || !await current(r, r.accessory.privateModelPath)) return fail("FIT_NOT_READY", "The fit is being computed. Try again in a moment.", 409);
      const adj = body.adj === null || body.adj === undefined ? null : parseAdj(body.adj);
      if (body.adj && !adj) return fail("INVALID_ADJUST", "Adjustments are limited to ±0.5 m, ±45° and 80-125 % scale.");
      await prisma.auditLog.create({ data: { actorId: uid, action: "ACCESSORY3D_FIT_APPROVED", targetId: accessoryId, details: { generationId, adj } } });
      const u = await prisma.accessoryAutoFit.update({ where: { accessoryId_generationId: { accessoryId, generationId } }, data: { adj: adj ?? Prisma.DbNull, approvedAt: new Date(), approvedByUserId: uid } });
      return { fit: u.fit, adj: u.adj, approvedAt: u.approvedAt };
    },
    /** For a customer's generation: the current stored fit + the admin's correction, or null (the app fits live). */
    forCustomer: async (accessoryId: string, generationId: string, privateModelPath: string | null) => {
      const r = await prisma.accessoryAutoFit.findUnique({ where: { accessoryId_generationId: { accessoryId, generationId } } });
      return r && await current(r, privateModelPath) && !(r.fit as { failed?: string }).failed ? { fit: r.fit, adj: r.adj } : null; // a failed fit: the app shows its own fit error
    },
  };
}
