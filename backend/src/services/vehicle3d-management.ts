import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { prisma } from "../prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { catalogLock, requirePartsActor } from "./vehicle-taxonomy.js";
import { readManifest, safeKey, type Manifest, type ModelMetadata } from "./vehicle3d-catalog.js";
import { fail, parseCarModel } from "./vehicle3d-validation.js";
import { assetBytes, assetHash, publicModelPath, registerExistingRevisions, effectiveVehicleModels } from "./vehicle3d-revisions.js";
import { recoverCatalogJournal, stageCatalogMetadata } from "./vehicle3d-promotion.js";
import { accessoryGate, modelFileSha, saveSegmentation } from "./car-part-map.js";
import { refitPublishedAccessories } from "./accessory-autofit.js";

type Tx = Prisma.TransactionClient;
const configFields = ["lengthM", "preRotateX", "rotateY", "groundOffset", "centerX", "keepBox", "paintNodes", "paintMaterials", "bakedPaint", "rimsSwappable", "wing", "rack", "zones"];
const shapeFields = ["lengthM", "preRotateX", "rotateY", "groundOffset", "centerX", "keepBox"];
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export function createVehicleModelService() {
  const run = <T>(uid: string, fn: (tx: Tx) => Promise<T>) => prisma.$transaction(async tx => { await requirePartsActor(tx, uid); return fn(tx); }, { timeout: 90_000 });
  const load = async (tx: Tx, key: string) => {
    if (!safeKey(key)) return fail("MODEL_NOT_FOUND", "Vehicle 3D model not found.", 404);
    return await tx.vehicle3DRevision.findUnique({ where: { key }, include: { generation: { include: { vehicle: { include: { brand: true } } } } } }) ?? fail("MODEL_NOT_FOUND", "Vehicle 3D model not found.", 404);
  };
  const usage = async (tx: Tx, key: string, generationId: string) => {
    const g = await tx.vehicleGeneration.findUniqueOrThrow({ where: { id: generationId }, include: { vehicle: { include: { brand: true } } } });
    const names = [g.vehicle.make, g.vehicle.brand?.name, ...(g.vehicle.brand?.aliases ?? [])].filter((x): x is string => !!x);
    const snapshots = { OR: names.map(make => ({ make: { equals: make, mode: "insensitive" as const }, model: { equals: g.vehicle.model, mode: "insensitive" as const } })) };
    const [garage, legacyCars, partsFitment, autoFits, partMaps, zones, submissions, imports, requests, towHistory, serviceHistory, promotions] = await Promise.all([
      tx.customerGarageCar.count({ where: { OR: [{ generationId }, snapshots] } }),
      tx.customerCar.count({ where: { OR: [{ generationId }, snapshots] } }),
      tx.partsFitment.count({ where: { OR: [{ generationId }, snapshots] } }),
      tx.accessoryAutoFit.count({ where: { OR: [{ generationId }, { model3dKey: key }] } }),
      tx.carPartMap.count({ where: { model3dKey: key } }), tx.accessoryFitZone.count({ where: { model3dKey: key } }),
      tx.vehicle3DSubmission.count({ where: { OR: [{ generationId }, { approvedModel3dKey: key }, snapshots] } }),
      tx.vehicle3DImport.count({ where: { OR: [{ generationId }, { publishedModel3dKey: key }] } }),
      tx.vehicleCatalogRequest.count({ where: { OR: [{ submission: { generationId } }, ...names.map(make => ({ requestedMake: { equals: make, mode: "insensitive" as const }, requestedModel: { equals: g.vehicle.model, mode: "insensitive" as const } }))] } }),
      tx.towRequest.count({ where: { OR: names.map(make => ({ vehicleMake: { equals: make, mode: "insensitive" as const }, vehicleModel: { equals: g.vehicle.model, mode: "insensitive" as const } })) } }),
      tx.mechanicRequest.count({ where: { OR: names.map(make => ({ carMake: { equals: make, mode: "insensitive" as const }, carModel: { equals: g.vehicle.model, mode: "insensitive" as const } })) } }),
      tx.auditLog.count({ where: { action: "VEHICLE3D_CATALOG_PROMOTE", targetId: generationId } }),
    ]);
    const manifest = readManifest();
    const catalogReferences = Object.values(manifest).filter(e => JSON.stringify(e).includes(key)).length;
    const accessoryFitment = await tx.productAccessory3DFit.count({ where: { generationId } });
    return { currentGeneration: g.model3dKey === key ? 1 : 0, garage, legacyCars, partsFitment, accessoryFitment, autoFits, partMaps, zones, submissions, imports, requests, towHistory, serviceHistory, promotions, catalogReferences };
  };
  const detail = async (tx: Tx, key: string) => {
    const r = await load(tx, key), g = r.generation, metadata = r.metadata as unknown as ModelMetadata;
    const map = await tx.carPartMap.findUnique({ where: { model3dKey: key } });
    const sourceImport = r.importId ? await tx.vehicle3DImport.findUnique({ where: { id: r.importId }, select: { validation: true, sourceProvider: true } }) : null;
    const references = await usage(tx, key, r.generationId);
    const effectiveAvailable = (await effectiveVehicleModels(tx)).get(g.id)?.key === key;
    const status = assetBytes(key) === null ? "FAILED" : effectiveAvailable ? "PUBLISHED" : (r.metadata as Record<string, unknown>).geometryReviewRequired === true ? "IN_REVIEW" : "HIDDEN";
    return { key, status, bodyType: g.bodyType, nameEn: g.nameEn, nameAr: g.nameAr, brandId: g.vehicle.brandId, aliases: g.vehicle.brand?.aliases ?? [], generationId: g.id, make: g.vehicle.make, model: g.vehicle.model, code: g.code, yearFrom: g.yearFrom, yearTo: g.yearTo,
      published: effectiveAvailable, effectiveAvailable, publicationRequested: g.isPublished && g.model3dKey === key, reviewRequired: (r.metadata as Record<string, unknown>).geometryReviewRequired === true,
      current: g.model3dKey === key, revision: r.revision, sha256: r.sha256, bytes: assetBytes(key), viewerConfig: r.viewerConfig,
      source: sourceImport?.sourceProvider ?? (r.submissionId ? "MESHY" : r.importId ? "MANUAL_IMPORT" : "LEGACY_CATALOG"),
      provenance: { title: metadata.title, author: metadata.author, license: metadata.license, url: metadata.url, authorUrl: metadata.authorUrl ?? null, licenseUrl: metadata.licenseUrl ?? null },
      validation: sourceImport?.validation ?? {sha256:r.sha256,bytes:r.bytes,source:"RETAINED_CATALOG"}, qualityGate: (sourceImport?.validation as { accessoryGate?: unknown } | null)?.accessoryGate ?? (map&&map.modelSha256===modelFileSha(key)?accessoryGate(map.pieces as never,map.dims as number[],map.proposal as never):null),
      partMapStatus: !map ? "MISSING" : map.modelSha256 !== modelFileSha(key) ? "STALE" : map.confirmedAt ? "CONFIRMED" : "PROPOSED",
      paintSupport: !!parseCarModel(r.viewerConfig)?.paintMaterials.length || !!parseCarModel(r.viewerConfig)?.paintNodes.length || !!parseCarModel(r.viewerConfig)?.bakedPaint,
      createdAt: r.createdAt, updatedAt: r.updatedAt, references, canDelete: Object.values(references).every(n => n === 0), importId: r.importId, submissionId: r.submissionId };
  };
  const mutate = async (uid: string, key: string, expectedRevision: unknown, action: string, work: (tx: Tx, r: Awaited<ReturnType<typeof load>>, manifest: Manifest) => Promise<void>) => {
    try {
      return await run(uid, async tx => {
        await catalogLock(tx); await recoverCatalogJournal(tx);
        const r = await load(tx, key);
        if (expectedRevision !== r.revision) return fail("CATALOG_REVISION_STALE", "This model changed. Reload before saving.", 409);
        const manifest = readManifest(); await work(tx, r, manifest);
        const auditId = randomUUID();
        await tx.auditLog.create({ data: { id: auditId, actorId: uid, action: `VEHICLE3D_${action}`, targetId: key, details: { previousRevision: r.revision } } });
        await tx.vehicle3DRevision.update({ where: { key }, data: { revision: { increment: 1 } } });
        await stageCatalogMetadata(tx, manifest, auditId);
        return detail(tx, key);
      });
    } finally { await prisma.$transaction(async tx => { await catalogLock(tx); await recoverCatalogJournal(tx); }); }
  };
  return {
    initialize: async (uid: string) => run(uid, async tx => {
      await catalogLock(tx); await recoverCatalogJournal(tx); await registerExistingRevisions(tx);
      const rows = await tx.vehicleGeneration.findMany({ where: { model3dKey: { not: null } } });
      let quarantined = 0;
      for (const g of rows) if (!await tx.vehicle3DRevision.findUnique({ where: { key: g.model3dKey! } }) && assetBytes(g.model3dKey!) === null) {
        await tx.auditLog.create({ data: { actorId: uid, action: "VEHICLE3D_MISSING_ASSET_QUARANTINED", targetId: g.id, details: { previousModel3dKey: g.model3dKey, previousIsPublished: g.isPublished, reason: "No retained catalog metadata or asset; request and import history preserved" } } });
        await tx.vehicleGeneration.update({ where: { id: g.id }, data: { isPublished: false, model3dKey: null } }); quarantined++;
      }
      return { quarantined };
    }),
    list: (uid: string) => run(uid, async tx => {
      const rows = await tx.vehicle3DRevision.findMany({ orderBy: { updatedAt: "desc" } });
      return Promise.all(rows.map(r => detail(tx, r.key)));
    }),
    get: (uid: string, key: string) => run(uid, tx => detail(tx, key)),
    /** Every retained revision of this car's generation, newest first. The current one is what customers get; the rest are restorable. */
    revisions: (uid: string, key: string) => run(uid, async tx => {
      const r = await load(tx, key);
      const rows = await tx.vehicle3DRevision.findMany({ where: { generationId: r.generationId }, orderBy: { createdAt: "desc" } });
      return { revisions: rows.map(x => { const m = x.metadata as unknown as ModelMetadata, bytes = assetBytes(x.key);
        return { key: x.key, revision: x.revision, createdAt: x.createdAt, current: r.generation.model3dKey === x.key, bytes, sha256: x.sha256, source: x.importId ? "IMPORT" : x.submissionId ? "MESHY" : "LEGACY_CATALOG",
          title: m.title ?? null, author: m.author ?? null, license: m.license ?? null, restorable: r.generation.model3dKey !== x.key && bytes !== null && assetHash(x.key) === x.sha256 && (x.metadata as Record<string, unknown>).geometryReviewRequired !== true }; }) };
    }),
    /** Make a retained revision the car's current model (confirmed in the UI). The swap is journaled like a publication; the replaced model stays in the history. */
    restore: async (uid: string, key: string, body: { revision?: unknown }) => {
      const out = await mutate(uid, key, body.revision, "RESTORE", async (tx, r, manifest) => {
        const g = r.generation;
        if (g.model3dKey === key) return fail("MODEL_CURRENT", "This version is already the current model.", 409);
        if (!g.isActive || !g.vehicle.isActive || !g.vehicle.brand?.isActive) return fail("INACTIVE", "Activate the brand, model and generation first.", 409);
        if (!existsSync(publicModelPath(key)) || assetHash(key) !== r.sha256) return fail("PUBLICATION_BLOCKED", "This version's file is missing or changed, so it cannot be restored.", 409);
        const old = r.metadata as unknown as ModelMetadata;
        if ((old as unknown as Record<string, unknown>).geometryReviewRequired === true || !parseCarModel(r.viewerConfig)) return fail("PUBLICATION_BLOCKED", "This version was never approved, so it cannot be restored.", 409);
        const manifestKey = Object.entries(manifest).find(([, m]) => m.file === g.model3dKey)?.[0];
        if (!manifestKey) return fail("PUBLICATION_BLOCKED", "Catalog metadata is missing.", 409);
        manifest[manifestKey] = { ...old, inApp: true, previousCatalogMetadata: manifest[manifestKey] } as ModelMetadata;
        await tx.vehicleGeneration.update({ where: { id: g.id }, data: { isPublished: true, model3dKey: key, modelSourceUrl: old.url || null, modelLicense: old.license } });
        await tx.auditLog.create({ data: { actorId: uid, action: "VEHICLE3D_CATALOG_RESTORE", targetId: g.id, details: { model3dKey: key, previousModel3dKey: g.model3dKey } } });
      });
      void refitPublishedAccessories();
      return out;
    },
    configure: async (uid: string, key: string, body: { revision?: unknown; config?: unknown }) => {
      const patch = body.config;
      if (!patch || typeof patch !== "object" || Array.isArray(patch) || Object.keys(patch).some(k => !configFields.includes(k))) return fail("CONFIG_INVALID", "Unsupported viewer setting.");
      let shapeChanged=false;
      const result = await mutate(uid, key, body.revision, "CONFIG_EDIT", async (tx, r, manifest) => {
        if (r.generation.model3dKey !== key) return fail("MODEL_NOT_CURRENT", "Edit the current model or prepare a replacement candidate.", 409);
        const combined={...(r.viewerConfig as Record<string,unknown>),...patch};for(const k of ["keepBox","bakedPaint","centerX"])if(combined[k]===null)delete combined[k];
        const config = parseCarModel(combined); if (!config) return fail("CONFIG_INVALID", "Invalid viewer configuration.");
        const entry = Object.values(manifest).find(e => e.file === key); if (!entry) return fail("PUBLICATION_BLOCKED", "Catalog metadata is missing.", 409);
        // Shape edits invalidate geometric review. Fit carRevision includes all relevant runtime config automatically.
        shapeChanged=shapeFields.some(k => k in patch&&JSON.stringify((r.viewerConfig as Record<string,unknown>)[k]??0)!==JSON.stringify(combined[k]??0));
        if (shapeChanged) {
          await tx.vehicleGeneration.update({ where: { id: r.generationId }, data: { isPublished: false } });
          entry.inApp = false;
          (entry as unknown as Record<string, unknown>).geometryReviewRequired = true;
          await tx.carPartMap.updateMany({ where: { model3dKey: key }, data: { confirmedAt: null, confirmedByUserId: null } });
        }
        entry.viewerConfig = config;
        await tx.vehicle3DRevision.update({ where: { key }, data: { viewerConfig: json(config), metadata: json(entry) } });
      });
      if (shapeChanged) void saveSegmentation(key, uid, true).catch(() => console.error("Updated vehicle requires part-map segmentation."));
      return result;
    },
    publication: (uid: string, key: string, body: { revision?: unknown; published?: unknown; visuallyVerified?: unknown }) => {
      if (typeof body.published !== "boolean") return fail("INVALID_STATUS", "Choose publish or deactivate.");
      return mutate(uid, key, body.revision, body.published ? "REACTIVATE" : "DEACTIVATE", async (tx, r, manifest) => {
        if (r.generation.model3dKey !== key) return fail("PUBLICATION_BLOCKED", "A historical revision cannot replace the current model through reactivation.", 409);
        if (body.published && (r.metadata as Record<string, unknown>).geometryReviewRequired === true && body.visuallyVerified !== true) return fail("VISUAL_REVIEW_REQUIRED", "Preview and approve the changed geometry before publishing.", 409);
        if (body.published && !parseCarModel(r.viewerConfig)) return fail("PUBLICATION_BLOCKED", "Validate the viewer configuration before publishing.", 409);
        if (body.published && (!existsSync(publicModelPath(key)) || assetHash(key) !== r.sha256 || !r.generation.isActive || !r.generation.vehicle.isActive || !r.generation.vehicle.brand?.isActive)) return fail("PUBLICATION_BLOCKED", "The asset or active taxonomy failed validation.", 409);
        await tx.vehicleGeneration.update({ where: { id: r.generationId }, data: { isPublished: body.published as boolean } });
        const entry = Object.values(manifest).find(e => e.file === key); if (!entry) return fail("PUBLICATION_BLOCKED", "Catalog metadata is missing.", 409);
        entry.inApp = body.published as boolean;
        if (body.published) {
          (entry as unknown as Record<string, unknown>).geometryReviewRequired = false;
          await tx.vehicle3DRevision.update({ where: { key }, data: { metadata: json(entry) } });
        }
      });
    },
    remove: async (uid: string, key: string) => {
      await run(uid, async tx => {
        await catalogLock(tx); const r = await load(tx, key), references = await usage(tx, key, r.generationId);
        if (Object.values(references).some(n => n > 0)) return fail("MODEL_REFERENCED", `Hard deletion refused: ${Object.entries(references).filter(([,n]) => n).map(([k,n]) => `${k} (${n})`).join(", ")}. Deactivate instead.`, 409);
        await tx.vehicle3DRevision.delete({ where: { key } });
        await tx.auditLog.create({ data: { actorId: uid, action: "VEHICLE3D_UNUSED_ASSET_DELETED", targetId: key } });
      });
      if (existsSync(publicModelPath(key))) unlinkSync(publicModelPath(key));
      return { success: true };
    },
  };
}
