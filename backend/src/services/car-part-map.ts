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

/** Segment + auto-label one catalog car in the real viewer (headless). */
export async function segmentModel(key: string): Promise<{ sha: string; pieces: Piece[]; dims: number[]; proposal: Proposal }> {
  const m = activeModels().find(x => x.key === key); const sha = modelFileSha(key);
  if (!m || !sha) return fail("NO_3D_CAR", "This car model is not in the active catalog.", 404);
  const dir = path.join(PRIVATE_3D_DIR, `tmp-segment-${randomUUID()}`); mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(dir, "config.json"), JSON.stringify(m));
    await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../../scripts/accessory-fit-check.mjs", import.meta.url)),
      `--car=${carFile(key)}`, `--config=${path.join(dir, "config.json")}`, `--out=${dir}`, "--views=segment"], { timeout: 180_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const r = JSON.parse(readFileSync(path.join(dir, "pieces.json"), "utf8"));
    if (modelFileSha(key) !== sha) return fail("MODEL_CHANGED", "The model file changed while it was being segmented. Try again.", 409);
    return { sha, pieces: r.pieces, dims: r.dims, proposal: r.proposal };
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
      confirmedAt: r?.confirmedAt ?? null, segmentedAt: r?.segmentedAt ?? null, proposalSummary: summary(r?.proposal as Proposal), mapSummary: summary(r?.map as PartMap) };
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

/** Rim-only automatic semantics, accepted only for the exact segmented asset. Never promotes a proposal to a confirmed map. */
export async function rimProposals(keys: string[]) {
  const rows = await prisma.carPartMap.findMany({ where: { model3dKey: { in: keys } }, select: { model3dKey: true, modelSha256: true, proposal: true, pieces: true } });
  const result = new Map<string, { ids: string[]; confidence: number }>();
  for (const r of rows) {
    if (r.modelSha256 !== modelFileSha(r.model3dKey)) continue;
    const p = (r.proposal as Proposal | null)?.WHEELS;
    const known = new Set((r.pieces as unknown as Piece[]).map(p => p.id));
    if (p?.ids?.length && p.ids.every(id => known.has(id)) && Number.isFinite(p.confidence)) result.set(r.model3dKey, { ids: p.ids, confidence: p.confidence });
  }
  return result;
}
