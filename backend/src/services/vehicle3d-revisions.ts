import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { readManifest, REPO_ROOT, safeKey, type ModelMetadata, type ViewerConfig } from "./vehicle3d-catalog.js";
import { activeAncestry } from "./vehicle-taxonomy.js";
import { parseCarModel } from "./vehicle3d-validation.js";

export const publicModelPath = (key: string) => path.join(REPO_ROOT, "backend/public/3d", key + ".glb");
export const assetHash = (key: string) => createHash("sha256").update(readFileSync(publicModelPath(key))).digest("hex");
export function manifestVersions(): ModelMetadata[] {
  const rows: ModelMetadata[] = [];
  for (const value of Object.values(readManifest())) {
    let e: ModelMetadata | undefined = value;
    while (e) { rows.push(e); e = e.previousCatalogMetadata as ModelMetadata | undefined; }
  }
  return rows;
}
export async function registerRevision(tx: Prisma.TransactionClient, generationId: string, entry: ModelMetadata, bytes: Buffer, origin: { importId?: string; submissionId?: string } = {}) {
  const data = { generationId, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
    viewerConfig: entry.viewerConfig as unknown as Prisma.InputJsonValue, metadata: entry as unknown as Prisma.InputJsonValue, ...origin };
  return tx.vehicle3DRevision.create({ data: { key: entry.file, ...data } });
}
/** Backfill factual existing metadata without replacing source records, assets or reviewed maps. Caller holds the catalog lock. */
export async function registerExistingRevisions(tx: Prisma.TransactionClient) {
  const entries = manifestVersions();
  const generations = await tx.vehicleGeneration.findMany({ where: { model3dKey: { not: null } } });
  for (const g of generations) {
    const entry = entries.find(e => e.file === g.model3dKey);
    if (!entry || !parseCarModel(entry.viewerConfig) || !safeKey(entry.file) || !existsSync(publicModelPath(entry.file))) continue;
    if (await tx.vehicle3DRevision.findUnique({ where: { key: entry.file } })) continue;
    const imported = await tx.vehicle3DImport.findFirst({ where: { publishedModel3dKey: entry.file } });
    const submission = await tx.vehicle3DSubmission.findFirst({ where: { approvedModel3dKey: entry.file } });
    await registerRevision(tx, g.id, entry, readFileSync(publicModelPath(entry.file)), { importId: imported?.id, submissionId: submission?.id });
  }
}
/** DB publication and configuration are authoritative, including while a candidate's filesystem journal is uncommitted. */
export async function effectiveVehicleModels(tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<Map<string, ViewerConfig>> {
  const generations = await tx.vehicleGeneration.findMany({ where: { ...activeAncestry, isPublished: true, model3dKey: { not: null } }, select: { id: true, model3dKey: true } });
  const keys = generations.map(g => g.model3dKey!);
  const revisions = await tx.vehicle3DRevision.findMany({ where: { key: { in: keys } } });
  const legacy = manifestVersions();
  return new Map(generations.flatMap(g => {
    const key = g.model3dKey!;
    const r = revisions.find(x => x.key === key), e = legacy.find(x => x.file === key && x.inApp !== false);
    const config = parseCarModel(r?.viewerConfig ?? e?.viewerConfig);
    return config && config.key === key && safeKey(key) && assetBytes(key) && (!r || r.generationId === g.id && usableAssetHash(key) === r.sha256)
      ? [[g.id, config] as const] : [];
  }));
}
const hashCache = new Map<string, { mtime: number; size: number; hash: string }>();
function usableAssetHash(key: string) {
  const st = statSync(publicModelPath(key)), old = hashCache.get(key);
  if (old?.mtime === st.mtimeMs && old.size === st.size) return old.hash;
  const hash = assetHash(key); hashCache.set(key, { mtime: st.mtimeMs, size: st.size, hash }); return hash;
}
export async function publishedVehicleModels(tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<ViewerConfig[]> {
  return [...(await effectiveVehicleModels(tx)).values()].sort((a,b) => a.key.localeCompare(b.key));
}
export const assetBytes = (key: string) => safeKey(key) && existsSync(publicModelPath(key)) ? statSync(publicModelPath(key)).size : null;
