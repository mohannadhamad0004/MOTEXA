// Part maps: each catalog car split into pieces (meshes, then connected components) by the REAL viewer code (headless, via
// scripts/accessory-fit-check.mjs --views=segment), auto-labelled (proposal), confirmed by the Parts Admin (/dept/accessory-zones).
// Piece ids belong to one exact model file: the app gets a map only when it is confirmed and the file's sha256 still matches.
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { REPO_ROOT, activeModels } from "./vehicle3d-catalog.js";
import { PRIVATE_3D_DIR } from "./vehicle3d-private-assets.js";
import { fail } from "./vehicle3d-validation.js";

export const PART_LABELS = ["FRONT_BUMPER", "REAR_BUMPER", "SPOILER", "SIDE_SKIRTS", "MIRRORS", "WHEELS", "ROOF_RAILS"] as const;
export type PartMap = Partial<Record<(typeof PART_LABELS)[number], string[]>>;
type Piece = { id: string; name: string; mat: string; tris: number; b: number[] };
type Proposal = Partial<Record<(typeof PART_LABELS)[number], { ids: string[]; confidence: number; by: string }>>;

const carFile = (key: string) => path.join(REPO_ROOT, "backend/public/3d", `${key}.glb`);
const shas = new Map<string, { mtimeMs: number; size: number; sha: string }>();
/** sha256 of the served model file (cached by mtime + size). */
export function modelFileSha(key: string): string | null {
  const f = carFile(key); if (!existsSync(f)) return null;
  const st = statSync(f), c = shas.get(key); if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) return c.sha;
  const sha = createHash("sha256").update(readFileSync(f)).digest("hex"); shas.set(key, { mtimeMs: st.mtimeMs, size: st.size, sha }); return sha;
}

/** A map from the editor: known labels, unique ids that exist in this file's pieces. */
export function parsePartMap(v: unknown, pieceIds: Set<string>): PartMap | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: PartMap = {};
  for (const [k, ids] of Object.entries(v)) {
    if (!(PART_LABELS as readonly string[]).includes(k) || !Array.isArray(ids) || ids.length > 5000 || !ids.every(i => typeof i === "string" && pieceIds.has(i))) return null;
    if (ids.length) out[k as keyof PartMap] = [...new Set(ids as string[])];
  }
  const all = Object.values(out).flat(); if (new Set(all).size !== all.length) return null; // one label per piece
  return out;
}

/** Segment + auto-label any car model file (a catalog file, or a private import before it is published) in the real viewer (headless). */
export async function segmentFile(file: string, config: unknown): Promise<{ pieces: Piece[]; dims: number[]; proposal: Proposal }> {
  const dir = path.join(PRIVATE_3D_DIR, `tmp-segment-${randomUUID()}`); mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(dir, "config.json"), JSON.stringify(config));
    await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../../scripts/accessory-fit-check.mjs", import.meta.url)),
      `--car=${file}`, `--config=${path.join(dir, "config.json")}`, `--out=${dir}`, "--views=segment"], { timeout: 180_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const r = JSON.parse(readFileSync(path.join(dir, "pieces.json"), "utf8"));
    return { pieces: r.pieces, dims: r.dims, proposal: r.proposal };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
/** Segment + auto-label one catalog car. */
export async function segmentModel(key: string): Promise<{ sha: string; pieces: Piece[]; dims: number[]; proposal: Proposal }> {
  const m = activeModels().find(x => x.key === key); const sha = modelFileSha(key);
  if (!m || !sha) return fail("NO_3D_CAR", "This car model is not in the active catalog.", 404);
  const r = await segmentFile(carFile(key), m);
  if (modelFileSha(key) !== sha) return fail("MODEL_CHANGED", "The model file changed while it was being segmented. Try again.", 409);
  return { sha, ...r };
}

// ---- ACCESSORY QUALITY GATE for a car model (before it is published, and for every catalog car): from its segmentation only ----
// Realistic size (length / width / height, wheel diameter), four wheels found as separate pieces and standing on the ground, and which
// stock parts the automatic part map can split off. Rejected = the model itself is wrong (size, wheels in the air); Limited = some
// accessory types cannot work on it (each with the reason); Full = every type can. Bumpers still need the Parts Admin to confirm the map.
export const GATE_TYPES = ["FRONT_BUMPER", "REAR_BUMPER", "FRONT_LIP", "REAR_DIFFUSER", "SIDE_SKIRTS", "WING", "SPOILER", "ROOF_RACK", "RIMS", "MIRROR_COVERS"] as const;
type GateType = (typeof GATE_TYPES)[number];
/** Problems (the model is rejected) and limits (a type cannot work) as codes the app translates; text = the same in English. */
export type GateProblem = { code: "LENGTH" | "WIDTH" | "HEIGHT" | "SHAPE" | "WHEEL_SIZE" | "WHEELS_IN_AIR"; value: number; range?: [number, number] };
export type GateLimit = "NOT_SEPARATE" | "WHEELS_NOT_FOUND" | "NEEDS_WHEELS" | "SINGLE_PIECE";
export type Gate = { verdict: "FULL" | "LIMITED" | "REJECTED"; problems: GateProblem[]; warnings: GateProblem[]; limited: Partial<Record<GateType, GateLimit>>; text: string[]; checks: Record<string, unknown> };
const LIMIT_TEXT: Record<GateLimit, string> = { NOT_SEPARATE: "not a separate piece (the automatic part map cannot split it off)", WHEELS_NOT_FOUND: "the four wheels are not separate pieces",
  NEEDS_WHEELS: "needs the four wheels to find the sills", SINGLE_PIECE: "the whole car is one piece (a scan or AI model): nothing can be split off" };
const PROBLEM_TEXT = (p: GateProblem) => ({ LENGTH: `length ${p.value} m (cars: 2.5–6.5 m)`, WIDTH: `width ${p.value} m (cars: 1.4–2.7 m)`, HEIGHT: `height ${p.value} m (cars: 1.0–3.2 m)`,
  SHAPE: `width / length ${p.value} (cars: 0.28–0.65)`, WHEEL_SIZE: `a wheel ${p.value} m across (real wheels: 0.45–1.2 m)`, WHEELS_IN_AIR: `part of the model hangs ${p.value} mm below its tyres (the viewer stands the car on its lowest point)` })[p.code];
const between = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
const r2 = (n: number) => Math.round(n * 100) / 100;
export function accessoryGate(pieces: Piece[], dims: number[], proposal: Proposal | null): Gate {
  const [W = 0, H = 0, L = 0] = dims, problems: GateProblem[] = [], warnings: GateProblem[] = [], limited: Gate["limited"] = {}, p = proposal ?? {};
  if (!between(L, 2.5, 6.5)) problems.push({ code: "LENGTH", value: r2(L), range: [2.5, 6.5] });
  if (!between(W, 1.4, 2.7)) problems.push({ code: "WIDTH", value: r2(W), range: [1.4, 2.7] });
  if (!between(H, 1.0, 3.2)) problems.push({ code: "HEIGHT", value: r2(H), range: [1.0, 3.2] });
  if (L && !between(W / L, 0.28, 0.65)) problems.push({ code: "SHAPE", value: r2(W / L), range: [0.28, 0.65] });
  // the wheels: the automatic map's WHEELS pieces, per corner (fractions of the car's box -> mm above the model's REAL lowest point: the
  // viewer stands the car on that point, so tyres above it float; the box itself can reach lower when meshes are rotated)
  const low = pieces.length ? Math.min(...pieces.map(x => x.b[1]!)) : 0;
  const byId = new Map(pieces.map(x => [x.id, x])), corner = [0, 1, 2, 3].map(() => ({ y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity, n: 0 }));
  for (const id of p.WHEELS?.ids ?? []) { const q = byId.get(id); if (!q) continue; const b = q.b, c = corner[(b[0]! + b[3]! > 1 ? 1 : 0) + (b[2]! + b[5]! > 1 ? 2 : 0)]!;
    c.n++; c.y0 = Math.min(c.y0, b[1]!); c.y1 = Math.max(c.y1, b[4]!); c.z0 = Math.min(c.z0, b[2]!); c.z1 = Math.max(c.z1, b[5]!); }
  const wheels = corner.filter(c => c.n).map(c => ({ diameterM: r2(Math.max((c.y1 - c.y0) * H, (c.z1 - c.z0) * L)), bottomMm: Math.round((c.y0 - low) * H * 1000) }));
  if (wheels.length === 4) {
    const bad = wheels.find(w => !between(w.diameterM, 0.45, 1.2)); if (bad) problems.push({ code: "WHEEL_SIZE", value: bad.diameterM, range: [0.45, 1.2] });
    const up = Math.max(...wheels.map(w => w.bottomMm)); if (up > 100) problems.push({ code: "WHEELS_IN_AIR", value: up }); else if (up > 30) warnings.push({ code: "WHEELS_IN_AIR", value: up }); // up to 10 cm: a warning
  } else { limited.RIMS = "WHEELS_NOT_FOUND"; limited.SIDE_SKIRTS = "NEEDS_WHEELS"; }
  if (!p.FRONT_BUMPER?.ids?.length) limited.FRONT_BUMPER = "NOT_SEPARATE";
  if (!p.REAR_BUMPER?.ids?.length) limited.REAR_BUMPER = "NOT_SEPARATE";
  if (!p.MIRRORS?.ids?.length) limited.MIRROR_COVERS = "NOT_SEPARATE";
  const blob = singleBlob(pieces); if (blob) for (const t of ["FRONT_BUMPER", "REAR_BUMPER", "MIRROR_COVERS", "RIMS", "SIDE_SKIRTS"] as const) limited[t] = "SINGLE_PIECE";
  const text = [...problems.map(PROBLEM_TEXT), ...warnings.map(w => `warning: ${PROBLEM_TEXT(w)}`), ...Object.entries(limited).map(([t, c]) => `${t}: ${LIMIT_TEXT[c!]}`)];
  return { verdict: problems.length ? "REJECTED" : Object.keys(limited).length ? "LIMITED" : "FULL", problems, warnings, limited, text,
    checks: { dimsM: dims, wheels, stockSpoilerSeparate: !!p.SPOILER?.ids?.length, singlePiece: blob } };
}
/** Store a fresh segmentation. Same file = nothing to do; a new file drops the old (now meaningless) map, audited. */
export async function saveSegmentation(key: string, actorId: string | null = null, force = false) {
  const row = await prisma.carPartMap.findUnique({ where: { model3dKey: key }, select: { modelSha256: true, map: true, confirmedAt: true } });
  if (row && !force && row.modelSha256 === modelFileSha(key)) return row;
  const s = await segmentModel(key);
  const data = { modelSha256: s.sha, pieces: s.pieces as unknown as Prisma.InputJsonValue, dims: s.dims, proposal: s.proposal as Prisma.InputJsonValue, segmentedAt: new Date() };
  return prisma.$transaction(async tx => {
    const old = await tx.carPartMap.findUnique({ where: { model3dKey: key }, select: { modelSha256: true, map: true } });
    const keep = old?.modelSha256 === s.sha; // re-run on the same file: ids are identical, keep the admin's map
    await tx.auditLog.create({ data: { actorId, action: "PART_MAP_SEGMENTED", targetId: key, details: { sha: s.sha, pieces: s.pieces.length, droppedMap: !!old?.map && !keep, previousSha: old?.modelSha256 ?? null } } });
    return tx.carPartMap.upsert({ where: { model3dKey: key }, create: { model3dKey: key, ...data }, update: keep ? data : { ...data, map: Prisma.DbNull, confirmedAt: null, confirmedByUserId: null } });
  });
}

const running = new Map<string, Promise<unknown>>();
/** Background segmentation (after a publish / for models without a map); one at a time per key, failures only logged. */
export function autoSegment(key: string) {
  if (!running.has(key)) running.set(key, saveSegmentation(key).catch(() => console.error(`Part map segmentation failed for ${key}.`)).finally(() => running.delete(key)));
  return running.get(key)!;
}

/** Confirmed maps for these models, only where the served file is still the segmented one. */
export async function confirmedPartMaps(keys: string[]): Promise<Map<string, PartMap>> {
  const rows = await prisma.carPartMap.findMany({ where: { model3dKey: { in: keys }, confirmedAt: { not: null } }, select: { model3dKey: true, modelSha256: true, map: true } });
  return new Map(rows.filter(r => r.map && r.modelSha256 === modelFileSha(r.model3dKey)).map(r => [r.model3dKey, r.map as PartMap]));
}

const summary = (p: Proposal | PartMap | null) => Object.fromEntries(Object.entries(p ?? {}).map(([k, v]) => [k, Array.isArray(v) ? { n: v.length } : { n: v!.ids.length, confidence: v!.confidence, by: v!.by }]));
/** One piece holding (nearly) the whole car: a single-blob scan / AI model, nothing to map (zones only). */
const singleBlob = (pieces: Piece[]) => { const t = pieces.reduce((a, p) => a + p.tris, 0); return !t || Math.max(...pieces.map(p => p.tris)) > 0.85 * t; };

export function createPartMapService() {
  const shape = (key: string, r: Awaited<ReturnType<typeof prisma.carPartMap.findUnique>>) => {
    const sha = modelFileSha(key), pieces = (r?.pieces ?? []) as Piece[];
    const status = !r ? "none" : r.modelSha256 !== sha ? "stale" : r.confirmedAt ? "confirmed" : singleBlob(pieces) ? "single" : "proposed";
    return { key, status, modelSha256: r?.modelSha256 ?? null, pieces: pieces.length, dims: r?.dims ?? null, proposal: r?.proposal ?? null, map: r?.map ?? null,
      confirmedAt: r?.confirmedAt ?? null, segmentedAt: r?.segmentedAt ?? null, proposalSummary: summary(r?.proposal as Proposal), mapSummary: summary(r?.map as PartMap),
      gate: r && r.modelSha256 === sha ? accessoryGate(pieces, r.dims as number[], r.proposal as Proposal) : null };
  };
  return {
    /** Every active car model with its part-map status; models without a current segmentation are segmented in the background. */
    list: async () => {
      const models = activeModels(), rows = await prisma.carPartMap.findMany({ where: { model3dKey: { in: models.map(m => m.key) } } });
      return models.map(m => { const r = rows.find(x => x.model3dKey === m.key) ?? null, s = shape(m.key, r);
        if (s.status === "none" || s.status === "stale") void autoSegment(m.key);
        const { proposal: _p, map: _m, dims: _d, ...rest } = s; return { ...rest, name: m.generation }; });
    },
    get: async (key: string) => {
      if (!activeModels().some(m => m.key === key)) return fail("NO_3D_CAR", "This car model is not in the active catalog.", 404);
      return shape(key, await prisma.carPartMap.findUnique({ where: { model3dKey: key } }));
    },
    segment: async (uid: string, key: string) => { await saveSegmentation(key, uid, true); return shape(key, await prisma.carPartMap.findUnique({ where: { model3dKey: key } })); },
    /** Confirm the admin's map (null = unconfirm: the car goes back to zones). Only for the file the pieces came from. */
    confirm: async (uid: string, key: string, body: { map?: unknown; modelSha256?: unknown }) => prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "model3dKey" FROM "CarPartMap" WHERE "model3dKey"=${key} FOR UPDATE`;
      const r = await tx.carPartMap.findUnique({ where: { model3dKey: key } });
      if (!r) return fail("NOT_SEGMENTED", "This car has not been split into parts yet.", 409);
      if (body.modelSha256 !== r.modelSha256 || r.modelSha256 !== modelFileSha(key)) return fail("STALE_PART_MAP", "The car model changed. Reload the editor.", 409);
      if (body.map === null) {
        await tx.auditLog.create({ data: { actorId: uid, action: "PART_MAP_UNCONFIRMED", targetId: key, details: { sha: r.modelSha256 } } });
        return shape(key, await tx.carPartMap.update({ where: { model3dKey: key }, data: { confirmedAt: null, confirmedByUserId: null } }));
      }
      const map = parsePartMap(body.map, new Set((r.pieces as Piece[]).map(p => p.id)));
      if (!map) return fail("INVALID_PART_MAP", "Invalid part map (unknown label or piece, or a piece under two labels).");
      await tx.auditLog.create({ data: { actorId: uid, action: "PART_MAP_CONFIRMED", targetId: key, details: { sha: r.modelSha256, labels: summary(map) } } });
      return shape(key, await tx.carPartMap.update({ where: { model3dKey: key }, data: { map, confirmedAt: new Date(), confirmedByUserId: uid } }));
    }),
  };
}

/** Rim-only automatic semantics, accepted only for the exact segmented asset. Never promotes a proposal to a confirmed map.
 *  The viewer only uses it to LOCATE each wheel (it then takes everything inside the wheel itself), so only the biggest pieces per corner
 *  are sent: a proposal of thousands of tread blocks stays a small catalog entry. */
export const RIM_SEED_PIECES = 40;
export function rimSeed(ids: string[], pieces: Piece[]): string[] {
  const byId = new Map(pieces.map(p => [p.id, p])), corners: Piece[][] = [[], [], [], []];
  for (const id of ids) { const p = byId.get(id); if (p) corners[(p.b[0]! + p.b[3]! > 1 ? 1 : 0) + (p.b[2]! + p.b[5]! > 1 ? 2 : 0)]!.push(p); }
  return corners.flatMap(c => c.sort((a, b) => b.tris - a.tris || (a.id < b.id ? -1 : 1)).slice(0, RIM_SEED_PIECES).map(p => p.id));
}
export async function rimProposals(keys: string[]) {
  const rows = await prisma.carPartMap.findMany({ where: { model3dKey: { in: keys } }, select: { model3dKey: true, modelSha256: true, proposal: true, pieces: true } });
  const result = new Map<string, { ids: string[]; confidence: number }>();
  for (const r of rows) {
    if (r.modelSha256 !== modelFileSha(r.model3dKey)) continue;
    const p = (r.proposal as Proposal | null)?.WHEELS, pieces = r.pieces as unknown as Piece[];
    const known = new Set(pieces.map(p => p.id));
    if (p?.ids?.length && p.ids.every(id => known.has(id)) && Number.isFinite(p.confidence)) result.set(r.model3dKey, { ids: rimSeed(p.ids, pieces), confidence: p.confidence });
  }
  return result;
}
