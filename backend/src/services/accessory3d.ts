// Feature 2: shop accessories shown in 3D on the customer's car. Reuses the Feature 1 pipeline: the Meshy client, private storage,
// GLB safety checks, the lease/checkpoint worker pattern, exact-revision visual review, mock-never-publishes and explicit paid opt-in.
//   DRAFT -> PENDING_REVIEW (shop) -> APPROVED_FOR_GENERATION (Parts Admin checked photos) -> GENERATING (Parts Admin explicitly
//   starts; real = paid, capped per shop per month) -> READY_FOR_FINAL_REVIEW (validated + six-view preview on a matching car)
//   -> PUBLISHED / REJECTED (or regenerate -> APPROVED_FOR_GENERATION). Shop edits only in DRAFT / REJECTED; "revise" returns to DRAFT.
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Prisma, type AccessoryKitPart, type AccessoryType, type ProductAccessory3D } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { createMeshyClient, MeshyError, MESHY_GENERATION_CREDITS, PROVIDER_DOWNLOAD_MAX_BYTES } from "./meshy-client.js";
import { generationMode, paidGenerationEnabled, requireFixtureRuntime, testProviderRuntime } from "./generation-runtime.js";
import { confirmedPartMaps, rimProposals, modelFileSha } from "./car-part-map.js";
import { createAutoFitService, saveFit, autoFitAccessory, fitEligibility, accessoryTargets, currentFit, validFit, isAccessoryFitRunning, refreshPublishedAccessory } from "./accessory-autofit.js";
import { REPO_ROOT, activeModels, type ViewerConfig } from "./vehicle3d-catalog.js";
import { privatePath, storePrivate, removePrivate, PRIVATE_3D_DIR } from "./vehicle3d-private-assets.js";
import { ACCESSORY_TYPES, MAX_MODEL_BYTES, Vehicle3DError, digest, fail, normalizeAccessory, parseZone, readSafeGLB,parseCarModel } from "./vehicle3d-validation.js";

export { ACCESSORY_TYPES } from "./vehicle3d-validation.js";
/** Product categories that may carry a 3D accessory (rims only under WHEELS). */
export const accessoryCategoriesFor = (type: string) => type === "RIMS" ? ["WHEELS"] : ["BODY", "EXTERIOR_ACCESSORIES"];
export const ACCESSORY_CATEGORIES = ["BODY", "EXTERIOR_ACCESSORIES", "WHEELS"];
/** Add-ons that hide the car's own part (a "replace" zone) while they are on. */
export const REPLACES_STOCK = ["WING", "SPOILER", "ROOF_RACK", "MIRROR_COVERS", "RIMS"];
/** Which real size the fitter uses: rims = diameter in inches; skirts / flares = length along the car; the rest = width across it. */
/** A body kit's parts are bumpers: FRONT = a front bumper, REAR = a rear bumper; every other product has one MAIN part. */
export const KIT_PARTS = ["MAIN", "FRONT", "REAR"] as const;
export const parseKitPart = (v: unknown): AccessoryKitPart => v === undefined || v === null || v === "" ? "MAIN" : (KIT_PARTS as readonly unknown[]).includes(v) ? v as AccessoryKitPart : fail("INVALID_KIT_PART", "Unknown part of the kit.");
/** Bumpers replace the car's own bumper, so they are car-specific: exact generations only, never a universal product. */
export const isBumper = (type: string) => type === "FRONT_BUMPER" || type === "REAR_BUMPER";
/** A customer's Adjust for one part: { parts: { MAIN | FRONT | REAR: adj } } (a row from before kits holds a plain adjust = MAIN). */
const adjOf = (v: unknown, part: string) => { const o = v as Record<string, unknown> | null | undefined;
  if (!o || typeof o !== "object") return null; if ("parts" in o) return ((o.parts as Record<string, unknown>)?.[part] ?? null) as Prisma.JsonValue; return part === "MAIN" ? o as Prisma.JsonValue : null; };
/** A rim on a Universal product = "Universal by size": fitted on any car's wheels, no generation list (bumpers are never universal). */
export const universalRim = (type: string, isUniversal: boolean) => type === "RIMS" && isUniversal;
export const RIM_FINISHES = ["SILVER", "BLACK", "GUNMETAL", "CHROME"] as const;
/** Rim specs from the shop form (all optional): width 4-14 in, PCD "4x100" / "5x112" style, ET -50..80 mm, finish. */
function rimSpecs(input: Record<string, unknown>) {
  const empty = (v: unknown) => v === null || v === undefined || v === "";
  const w = empty(input.rimWidthIn) ? null : Number(input.rimWidthIn);
  if (w !== null && !(Number.isFinite(w) && w >= 4 && w <= 14)) return fail("INVALID_RIM", "Rim width is between 4 and 14 inches.");
  const pcd = empty(input.rimPcd) ? null : String(input.rimPcd).trim().toLowerCase().replace(/\s+/g, "").replace("×", "x");
  if (pcd !== null && !/^[3-8]x\d{2,3}(\.\d)?$/.test(pcd)) return fail("INVALID_RIM", "PCD looks like 5x112 (bolts x circle in mm).");
  const et = empty(input.rimOffsetMm) ? null : Number(input.rimOffsetMm);
  if (et !== null && !(Number.isInteger(et) && et >= -50 && et <= 80)) return fail("INVALID_RIM", "Offset (ET) is a whole number of mm from -50 to 80.");
  const fin = empty(input.rimFinish) ? null : input.rimFinish;
  if (fin !== null && !(RIM_FINISHES as readonly unknown[]).includes(fin)) return fail("INVALID_RIM", "Choose silver, black, gunmetal or chrome.");
  return { rimWidthIn: w, rimPcd: pcd, rimOffsetMm: et, rimFinish: fin as (typeof RIM_FINISHES)[number] | null };
}
export const rimOf = (a: Pick<ProductAccessory3D, "accessoryType" | "rimInches" | "rimWidthIn" | "rimPcd" | "rimOffsetMm" | "rimFinish">) =>
  a.accessoryType === "RIMS" ? { inches: a.rimInches, widthIn: a.rimWidthIn, pcd: a.rimPcd, offsetMm: a.rimOffsetMm, finish: a.rimFinish } : null;
export const sizeField = (type: string) => type === "RIMS" ? "rimInches" :type === "SIDE_SKIRTS" || type === "FENDER_FLARES" ? "lengthMm" : "widthMm";
/**
 * Sanity range of the part's main real size, per type (whole mm; rims are checked in inches). A bumper that is 630 mm wide is a typo
 * (or the wrong field), and a wrong size scales the part wrongly on every customer's car, so it is refused with these numbers.
 */
export const SIZE_RANGES: Record<string, { field: "widthMm" | "lengthMm"; min: number; max: number }> = {
  FRONT_BUMPER: { field: "widthMm", min: 1200, max: 2100 }, REAR_BUMPER: { field: "widthMm", min: 1200, max: 2100 },
  SIDE_SKIRTS: { field: "lengthMm", min: 1000, max: 2800 }, FRONT_LIP: { field: "widthMm", min: 900, max: 2100 }, REAR_DIFFUSER: { field: "widthMm", min: 700, max: 2000 },
  FENDER_FLARES: { field: "lengthMm", min: 300, max: 1500 }, WING: { field: "widthMm", min: 700, max: 2100 }, SPOILER: { field: "widthMm", min: 500, max: 2100 },
  ROOF_RACK: { field: "widthMm", min: 700, max: 1900 }, MIRROR_COVERS: { field: "widthMm", min: 80, max: 450 },
};
const TYPE_NAME: Record<string, string> = { FRONT_BUMPER: "front bumper", REAR_BUMPER: "rear bumper", SIDE_SKIRTS: "side skirt", FRONT_LIP: "front lip", REAR_DIFFUSER: "rear diffuser", FENDER_FLARES: "fender flare",
  WING: "wing", SPOILER: "spoiler", ROOF_RACK: "roof rack", MIRROR_COVERS: "mirror cover" };
/** null = fine (or nothing entered), else the message for a main size outside the range of its type. */
export function sizeProblem(type: string, value: number | null | undefined) {
  const r = SIZE_RANGES[type];
  if (!r || value === null || value === undefined) return null;
  if (value >= r.min && value <= r.max) return null;
  const name = TYPE_NAME[type] ?? "part";
  return `A ${name}'s ${r.field === "widthMm" ? "width" : "length"} must be ${r.min}\u2013${r.max} mm (you entered ${value}). Measure the whole part, end to end, in millimetres.`;
}
export const PUBLIC_ACCESSORY_DIR = path.join(REPO_ROOT, "backend/public/3d/accessories");
const LIMITS = { PART: [2, 4], INSTALLED: [1, 24] } as const;
const CONSENT_VERSION = "accessory-3d-v1";
type Tx = Prisma.TransactionClient;
type Full = ProductAccessory3D & { photos: { id: string; kind: string; path: string; sortOrder: number }[]; fits: { generationId: string }[] };
const missing = (): never => fail("ACCESSORY_NOT_FOUND", "3D accessory not found.", 404);
const include = { photos: { orderBy: { sortOrder: "asc" as const } }, fits: true };
const audit = (tx: Tx, actorId: string | null, action: string, targetId: string, details: Prisma.InputJsonValue = {}) =>
  tx.auditLog.create({ data: { actorId, action: `ACCESSORY3D_${action}`, targetId, details } });
/** The shop's owner hears about every admin action on a 3D request (in-app notification, stored "English||العربية"). */
async function tellShop(tx: Tx, shopId: string, title: [string, string], body: [string, string]) {
  const shop = await tx.partsShopProfile.findUnique({ where: { id: shopId }, select: { userId: true } });
  if (shop) await tx.notification.create({ data: { userId: shop.userId, title: `${title[0]}||${title[1]}`, body: `${body[0]}||${body[1]}` } });
}
const productName = async (tx: Tx, productId: string) => (await tx.partsProduct.findUnique({ where: { id: productId }, select: { name: true } }))?.name ?? "";
export const modelRevision = (a: Pick<ProductAccessory3D, "privateModelPath">) => digest(a.privateModelPath && existsSync(privatePath(a.privateModelPath)) ? readFileSync(privatePath(a.privateModelPath)) : Buffer.alloc(0)).slice(0, 16);
const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
export async function creditsThisMonth(tx: Tx, shopId: string) {
  return tx.auditLog.count({ where: { action: "ACCESSORY3D_PAID_START", createdAt: { gte: monthStart() }, details: { path: ["shopId"], equals: shopId } } });
}

/** Failures after a provider task exists that a fixed config / retry can finish from the SAME task (never a new paid one). */
const RESUMABLE = ["PROVIDER_ASSET_TOO_LARGE", "PROVIDER_DOWNLOAD_TOO_LARGE", "PROVIDER_DOWNLOAD_UNAVAILABLE", "PROVIDER_AUTH", "PROVIDER_KEY_MISSING", "PROVIDER_FORBIDDEN", "PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT", "PROVIDER_MALFORMED_RESPONSE", "PREPARATION_FAILED", "INVALID_GLB"];
export const resumable = (a: Pick<ProductAccessory3D, "status" | "providerTaskId" | "generationMode" | "generationErrorCode" | "privateModelPath">) =>
  a.status === "APPROVED_FOR_GENERATION" && a.generationMode === "meshy" && !!a.providerTaskId && !a.privateModelPath && RESUMABLE.includes(a.generationErrorCode ?? "");
export const accessoryLifecycle = (a: Pick<ProductAccessory3D,"generationStage"|"deactivatedAt"|"status">) => a.generationStage === "FAILED" ? "FAILED" : a.deactivatedAt ? "UNPUBLISHED" : a.status === "GENERATING" && a.generationStage === "QUEUED" ? "GENERATION_QUEUED" : a.status;

/** The same server-owned gates drive request detail and publication. No mobile inference from a lifecycle label. */
async function accessoryReview(a: Full, tx: Tx) {
  const bytes = a.privateModelPath && existsSync(privatePath(a.privateModelPath)) ? readFileSync(privatePath(a.privateModelPath)) : null;
  const validation = a.validation as {valid?: boolean; sha256?: string; processing?: {qualityGate?: string; optimizedBytes?: number}} | null;
  const processing = validation?.processing ?? (a.sourceMetadata as {processing?: {qualityGate?: string; optimizedBytes?: number}} | null)?.processing;
  const real = isRealSource(a);
  const validated = !!bytes && validation?.valid === true && validation.sha256 === digest(bytes);
  const validationReason = validated ? null : !bytes ? "The generated GLB file is missing." : validation?.valid === true ? "Validation is stale: the current GLB no longer matches its validated hash." : a.failureReason || "Model validation has not passed for the current GLB.";
  const optimized = !!bytes && processing?.qualityGate === "PASS" && processing.optimizedBytes === bytes.length;
  const preview = a.preview as {generationId?: string; modelRevision?: string; fitSnapshot?: {carRevision: string; partRevision: string; fitVersion: number; updatedAt: string}} | null;
  const saved = await tx.accessoryAutoFit.findMany({where: {accessoryId: a.id}}), keys = new Set(activeModels().map(m=>m.key));
  const targets = await Promise.all((await accessoryTargets(a.id,tx)).map(async g=>{
    const has3d = !!g.model3dKey && g.isPublished && keys.has(g.model3dKey) && !!modelFileSha(g.model3dKey);
    const map = isBumper(a.accessoryType) && g.model3dKey ? await tx.carPartMap.findUnique({where: {model3dKey: g.model3dKey}}) : null;
    const partMap = !isBumper(a.accessoryType) ? "NOT_REQUIRED" : map && map.modelSha256 !== modelFileSha(g.model3dKey!) ? "STALE" : !map?.confirmedAt || !Array.isArray((map.map as Record<string,unknown> | null)?.[a.accessoryType]) || !(map.map as Record<string,unknown[]>)[a.accessoryType]?.length ? "MISSING" : "CONFIRMED";
    const fit = saved.find(f=>f.generationId===g.id), current = !!fit && validFit(fit.fit) && (fit.fit as {type?:string}).type === a.accessoryType && !!a.privateModelPath && fit.model3dKey === g.model3dKey && await currentFit(fit,a.privateModelPath);
    const data = fit?.fit as {failed?: string; previousCorrection?: unknown; needsCorrection?: boolean} | undefined;
    const state = isAccessoryFitRunning(a.id) ? "RUNNING" : !current ? "NOT_RUN" : data?.failed ? "FAILED" : !fit?.approvedAt && (data?.needsCorrection || data?.previousCorrection) ? "NEEDS_CORRECTION" : fit?.approvedAt ? "APPROVED" : "PASSED";
    const snapshot = preview?.fitSnapshot;
    const previewCurrent = !!fit && current && preview?.generationId === g.id && preview.modelRevision === modelRevision(a) && snapshot?.carRevision === fit.carRevision && snapshot.partRevision === fit.partRevision && snapshot.fitVersion === fit.fitVersion && snapshot.updatedAt === fit.updatedAt.toISOString();
    return {generationId: g.id, model3dKey: g.model3dKey, name: `${g.vehicle.make} ${g.nameEn}`, nameAr: `${g.vehicle.makeAr} ${g.nameAr}`, has3d, partMap, semanticPart: a.accessoryType,
      fit: {state, current, approvedAt: current ? fit?.approvedAt ?? null : null, reason: current ? data?.failed ?? null : fit ? "The car or accessory changed. Run automatic fit again." : null}, previewCurrent};
  }));
  const blockers: {code: string; message: string; generationId?: string}[] = [];
  const block = (code: string, message: string, generationId?: string)=>blockers.push({code,message,...(generationId?{generationId}:{})});
  if (a.status !== "READY_FOR_FINAL_REVIEW") block("REVIEW_CONFLICT","A private generated candidate awaiting final review is required.");
  if (!real) block("MOCK_NOT_PUBLISHABLE","A real candidate is required: a successful Meshy generation or a manually imported model.");
  if (!bytes) block("MODEL_REQUIRED","The generated GLB file is missing.");
  if (!validated) block("VALIDATION_REJECTED",validationReason!);
  if (!optimized) block("OPTIMIZATION_REQUIRED","Optimization has not completed for the current GLB. Retry processing the same task.");
  const supported = targets.filter(g=>g.has3d);
  if (!supported.length) block("NO_3D_CAR","No compatible vehicle has a published 3D model.");
  for (const g of supported) {
    if (g.partMap === "MISSING" || g.partMap === "STALE") block("PART_MAP_STALE",`${a.accessoryType === "REAR_BUMPER" ? "Rear bumper" : "Front bumper"} stock-part mapping is ${g.partMap === "STALE" ? "stale" : "not confirmed"} for this vehicle.`,g.generationId);
    if (g.fit.state === "NOT_RUN" || g.fit.state === "RUNNING") block("FIT_NOT_READY","Run automatic fit and wait for its result.",g.generationId);
  }
  const reviewed = supported.find(g=>g.generationId===preview?.generationId);
  if (!reviewed || reviewed.fit.state !== "APPROVED") block("FIT_REVIEW_REQUIRED","Review and approve a current successful fit on the final-preview vehicle.",reviewed?.generationId);
  if (!reviewed?.previewCurrent) block("STALE_VISUAL_REVIEW","Render the final preview after the latest fit review.",reviewed?.generationId);
  const published = a.status === "PUBLISHED" && !a.deactivatedAt && !!a.publishedFile && existsSync(path.join(PUBLIC_ACCESSORY_DIR,a.publishedFile+".glb"));
  return {model: {generated: real, exists: !!bytes, optimized, validation: validated ? "PASSED" : a.validation || a.generationErrorCode ? "FAILED" : "NOT_RUN", reason: validationReason},
    targets, publication: {state: published ? "PUBLISHED" : a.deactivatedAt ? "UNPUBLISHED" : blockers.length ? "PRIVATE_CANDIDATE" : "READY_FOR_FINAL_REVIEW", file: published ? `accessories/${a.publishedFile}.glb` : null, canPublish: !blockers.length, blockers},
    canRetryProcessing: real && a.provider !== "MANUAL" && ["APPROVED_FOR_GENERATION","READY_FOR_FINAL_REVIEW"].includes(a.status) && (!validated || !optimized),
    canValidateManual: a.provider === "MANUAL" && a.generationMode === "manual" && !!bytes && (!validated || !optimized)};
}
/** A manually imported GLB (provider MANUAL) gets the same local optimisation + validation as a Meshy result (normalizeAccessory). The
 *  imported file is kept as the raw source and every run starts from it; the optimised file becomes the model and, when published, the
 *  public file (content-addressed). The replaced optimised / public file is deleted (no kept old versions). Fits are recomputed. */
export async function prepareManualAccessory(id: string, uid: string | null) {
  const a = await prisma.productAccessory3D.findUnique({ where: { id } });
  if (!a) return fail("NOT_FOUND", "Accessory not found.", 404);
  if (a.provider !== "MANUAL" || a.generationMode !== "manual") return fail("NOT_MANUAL", "Only a manually imported model is validated here; a generated model uses Retry processing.", 409);
  const source = [a.rawModelPath, a.privateModelPath].find((p): p is string => !!p && existsSync(privatePath(p)));
  if (!source) return fail("MODEL_REQUIRED", "The imported model file is missing.", 409);
  const normalized = await normalizeAccessory(readFileSync(privatePath(source))); // throws Vehicle3DError with the reason (size, geometry)
  const prepared = storePrivate(normalized.bytes, "glb");
  const file = a.publishedFile ? `acc-${normalized.report.sha256.slice(0, 16)}` : null;
  try {
    if (file) { mkdirSync(PUBLIC_ACCESSORY_DIR, { recursive: true }); const target = path.join(PUBLIC_ACCESSORY_DIR, `${file}.glb`); if (!existsSync(target)) copyFileSync(privatePath(prepared), target); }
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "ProductAccessory3D" WHERE "id"=${id} FOR UPDATE`;
      const now = await tx.productAccessory3D.findUnique({ where: { id } });
      if (!now || now.privateModelPath !== a.privateModelPath || now.rawModelPath !== a.rawModelPath) return fail("REVIEW_CONFLICT", "The model changed during validation. Reload and run it again.", 409);
      if (file && await tx.productAccessory3D.findFirst({ where: { publishedFile: file, id: { not: id } } })) return fail("DUPLICATE_PROMOTION", "This exact model is already published for another product.", 409);
      await tx.productAccessory3D.update({ where: { id }, data: { rawModelPath: source, privateModelPath: prepared, publishedFile: file,
        validation: { ...normalized.report, validatedAt: new Date().toISOString() } as Prisma.InputJsonValue,
        sourceMetadata: { ...(a.sourceMetadata as object ?? {}), processing: normalized.report.processing } as Prisma.InputJsonValue, generationErrorCode: null, failureReason: null } });
      await audit(tx, uid, "MANUAL_VALIDATED", id, { bytes: normalized.report.bytes, rawBytes: normalized.report.processing.rawBytes, file });
    });
  } catch (e) { removePrivate(prepared); throw e; }
  if (a.privateModelPath && a.privateModelPath !== source && a.privateModelPath !== prepared) removePrivate(a.privateModelPath); // the old optimised model
  if (a.publishedFile && a.publishedFile !== file && !await prisma.productAccessory3D.findFirst({ where: { publishedFile: a.publishedFile } }))
    rmSync(path.join(PUBLIC_ACCESSORY_DIR, `${a.publishedFile}.glb`), { force: true });
  void autoFitAccessory(id);
  return { bytes: normalized.report.bytes, rawBytes: normalized.report.processing.rawBytes, file };
}
export function accessoryShape(a: Full) {
  const photos = (kind: string) => a.photos.filter(p => p.kind === kind).map(p => ({ id: p.id }));
  return { id: a.id, productId: a.productId, kitPart: a.kitPart, accessoryType: a.accessoryType, status: a.status, lifecycleState: accessoryLifecycle(a), fitmentNotes:a.fitmentNotes, deactivatedAt:a.deactivatedAt, revision: a.revision, creditsUsed: a.creditsUsed,
    size: { widthMm: a.widthMm, heightMm: a.heightMm, depthMm: a.depthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, rim: rimOf(a),
    fitsGenerationIds: a.fits.map(f => f.generationId), installedGenerationId: a.installedGenerationId, installed360: a.installed360,
    installedApproved: !!a.installedApprovedAt, partPhotos: photos("PART"), installedPhotos: photos("INSTALLED"),
    submittedAt: a.submittedAt, reviewNotes: a.reviewNotes, reviewedAt: a.reviewedAt, approvedAt: a.approvedAt,
    generationMode: a.generationMode, provider: a.provider, providerState: a.providerState, providerProgress: a.providerProgress,
    generationStage: a.generationStage, generationErrorCode: a.generationErrorCode, failureReason: a.failureReason,
    hasModel: !!a.privateModelPath, validation: a.validation, processing:(a.sourceMetadata as {processing?:Prisma.JsonValue}|null)?.processing??null, preview: a.preview, modelRevision: modelRevision(a),
    mock: a.generationMode === "mock", published: a.status === "PUBLISHED" && !a.deactivatedAt && !!a.publishedFile, publishedAt: a.publishedAt, updatedAt: a.updatedAt, resumable: resumable(a) };
}

/** Re-encode (strips EXIF / GPS, fixes orientation, bounds size). Same rules as the Garage photos. */
async function cleanPhoto(base64: unknown) {
  if (typeof base64 !== "string" || !base64.length || base64.length > 7_000_000) return fail("INVALID_PHOTO", "Choose a JPEG or PNG image of at most 5 MB.");
  const bytes = Buffer.from(base64, "base64");
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000 }), meta = await image.metadata();
    if (!["jpeg", "png"].includes(meta.format ?? "") || !meta.width || !meta.height || meta.width < 32 || meta.height < 32) throw new Error();
    return await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  } catch { return fail("INVALID_PHOTO", "Photo is not a supported, decodable JPEG or PNG."); }
}

/** A deliberately generic stand-in for testing the workflow (a plain box of the part's rough proportions). Never publishable. */
export async function mockAccessoryGLB(type: string) {
  requireFixtureRuntime();
  const { Document, NodeIO } = await import("@gltf-transform/core");
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene();
  const dims: Record<string, [number, number, number]> = { RIMS: [0.22, 0.45, 0.45], SIDE_SKIRTS: [0.08, 0.12, 2.2], FENDER_FLARES: [0.06, 0.25, 0.8], MIRROR_COVERS: [0.2, 0.12, 0.1], ROOF_RACK: [1.2, 0.08, 0.9] };
  const [w, h, l] = dims[type] ?? [1.7, 0.3, 0.3];
  const points = [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1];
  const prim = doc.createPrimitive().setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(points.map((v, i) => v * [w / 2, h / 2, l / 2][i % 3]!))).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3])).setBuffer(buffer))
    .setMaterial(doc.createMaterial("MOCK_part").setBaseColorFactor([0.9, 0.35, 0.1, 1]).setDoubleSided(true));
  scene.addChild(doc.createNode("MOCK_part").setMesh(doc.createMesh("MOCK_part").addPrimitive(prim)));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

/** The runtime catalog model of a key with its admin-tuned zones (DB) merged over the file config, plus its confirmed part map. */
export async function modelWithZones(key: string, tx: Tx | typeof prisma = prisma): Promise<ViewerConfig | null> {
  const revision=await tx.vehicle3DRevision.findUnique({where:{key},select:{viewerConfig:true}});
  const m = parseCarModel(revision?.viewerConfig)??activeModels().find(x => x.key === key); if (!m) return null;
  const rows = await tx.accessoryFitZone.findMany({ where: { model3dKey: key } }), partMap = (await confirmedPartMaps([key])).get(key);
  const z = rows.length ? { ...m, zones: { ...(m.zones ?? {}), ...Object.fromEntries(rows.map(r => [r.accessoryType, r.zone as never])) } } : m;
  const rimProposal = partMap?.WHEELS?.length ? undefined : (await rimProposals([key])).get(key);
  return { ...z, ...(partMap ? { partMap } : {}), ...(rimProposal ? { rimProposal } : {}) } as ViewerConfig;
}
export async function mergeZones<T extends { key: string; zones?: unknown }>(models: T[]) {
  const rows = await prisma.accessoryFitZone.findMany({ where: { model3dKey: { in: models.map(m => m.key) } } });
  const proposals = await rimProposals(models.map(m => m.key));
  const maps = await confirmedPartMaps(models.map(m => m.key)); // confirmed part maps of the exact served file ride along too
  return models.map(m => { const z = rows.filter(r => r.model3dKey === m.key), pm = maps.get(m.key);
    const withZones = z.length ? { ...m, zones: { ...(m.zones as object ?? {}), ...Object.fromEntries(z.map(r => [r.accessoryType, r.zone])) } } : m;
    const rimProposal = pm?.WHEELS?.length ? undefined : proposals.get(m.key);
    return { ...withZones, ...(pm ? {partMap:pm} : {}), ...(rimProposal ? {rimProposal} : {}) }; });
}

/** Six views of the private part fitted on a catalog car (the real mobile viewer code, offline). Images stay private. */
export async function renderPreview(a: Full, generationId: string, tx: Tx | typeof prisma = prisma) {
  if (!a.privateModelPath) return fail("MODEL_REQUIRED", "A generated model is required.", 409);
  const targets=await accessoryTargets(a.id,tx);
  if (!targets.some(f => f.id === generationId)) return fail("GENERATION_NOT_FITTED", "Preview only on a generation this part fits.");
  const gen = await tx.vehicleGeneration.findUnique({ where: { id: generationId }, include: { vehicle: true } });
  const model = gen?.model3dKey && gen.isPublished ? await modelWithZones(gen.model3dKey, tx) : null;
  if (!gen || !model) return fail("NO_3D_CAR", "That generation has no published 3D car model to preview on.", 409);
  const dir = path.join(PRIVATE_3D_DIR, `tmp-preview-${randomUUID()}`); mkdirSync(dir, { recursive: true });
  try {
    const reviewed=await tx.accessoryAutoFit.findUnique({where:{accessoryId_generationId:{accessoryId:a.id,generationId}}});
    const baseAdj=reviewed?.approvedAt&&await currentFit(reviewed,a.privateModelPath)?reviewed.adj:null;
    writeFileSync(path.join(dir, "config.json"), JSON.stringify(model));
    writeFileSync(path.join(dir, "kit.json"), JSON.stringify({ type: a.accessoryType, size: { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, ...(baseAdj?{baseAdj}:{}) }));
    let out: { valid?: boolean; fit?: unknown; autofit?: unknown };
    try {
      const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../../scripts/accessory-fit-check.mjs", import.meta.url)),
        `--car=${path.join(REPO_ROOT, "backend/public/3d", model.key + ".glb")}`, `--config=${path.join(dir, "config.json")}`, `--part=${privatePath(a.privateModelPath)}`,
        `--kit=${path.join(dir, "kit.json")}`, `--out=${dir}`], { timeout: 120_000, windowsHide: true, maxBuffer: 256 * 1024 });
      out = JSON.parse(stdout.trim().split("\n").pop()!);
    } catch(e) { const reason=/Error: ((?:this part|this bumper|no confirmed)[^\r\n]*)/.exec(String((e as {stderr?:string}).stderr??""))?.[1];return fail(reason?"FIT_FAILED":"PREVIEW_FAILED", reason??"The part could not be fitted and rendered on this car. Check the part orientation/shape or the car's zone."); }
    if (!out.valid) return fail("PREVIEW_FAILED", "The part could not be fitted and rendered on this car.");
    if (!out.autofit) return fail("FIT_FAILED", "The viewer did not return a validated fit.",409);
    const savedFit=await saveFit(a, generationId, model.key, out.autofit);
    const views: Record<string, string> = {};
    for (const name of ["front", "front-three-quarter", "left-side", "rear-three-quarter", "rear", "top-three-quarter"])
      views[name] = storePrivate(await sharp(path.join(dir, `${name}.png`)).jpeg({ quality: 86 }).toBuffer(), "jpg");
    return { generationId, generationName: `${gen.vehicle.make} ${gen.nameEn}`, model3dKey: model.key, modelRevision: modelRevision(a), fitSnapshot:{carRevision:savedFit.carRevision,partRevision:savedFit.partRevision,fitVersion:savedFit.fitVersion,updatedAt:savedFit.updatedAt.toISOString()}, views, fit: out.fit ?? null, renderedAt: new Date().toISOString() };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const previewKeys = (p: unknown) => Object.values(((p ?? {}) as { views?: Record<string, string> }).views ?? {});

/** A real model source: a successful Meshy generation, or a manually imported GLB (provider MANUAL, no provider task). Never a mock. */
export const isRealSource = (a: Pick<ProductAccessory3D, "generationMode" | "provider" | "sourceMetadata" | "providerState" | "providerTaskId">) =>
  !isMockAccessory(a) && ((a.generationMode === "meshy" && a.provider === "MESHY" && a.providerState === "SUCCEEDED" && !!a.providerTaskId) || (a.generationMode === "manual" && a.provider === "MANUAL"));
export const isMockAccessory = (a: Pick<ProductAccessory3D, "generationMode" | "provider" | "sourceMetadata">) =>
  a.generationMode === "mock" || a.provider === "MOCK" || (a.sourceMetadata as { mock?: boolean } | null)?.mock === true || (a.sourceMetadata as { generatedBy?: string } | null)?.generatedBy === "MOCK";
/** Preserve the old files and task history, but remove a test result from the active development candidate. */
async function retireRuntimeMock(tx: Tx, row: Full): Promise<Full> {
  if (testProviderRuntime() || !isMockAccessory(row)) return row;
  await tx.$queryRaw`SELECT "id" FROM "ProductAccessory3D" WHERE "id"=${row.id} FOR UPDATE`;
  const current = await tx.productAccessory3D.findUniqueOrThrow({ where: { id: row.id }, include });
  if (!isMockAccessory(current)) return current;
  const history = Array.isArray(current.generationHistory) ? [...current.generationHistory] : [];
  history.push({ reason: "TEST_RESULT_RETIRED", retiredAt: new Date().toISOString(), revision: current.revision,
    provider: current.provider, taskId: current.providerTaskId, state: current.providerState,
    raw: current.rawModelPath, prepared: current.privateModelPath, preview: current.preview, validation: current.validation,
    sourceMetadata: current.sourceMetadata, publishedFile: current.publishedFile });
  const result = await tx.productAccessory3D.update({ where: { id: current.id }, data: {
    status: current.approvedAt ? "APPROVED_FOR_GENERATION" : current.submittedAt ? "PENDING_REVIEW" : "DRAFT",
    generationMode: null, provider: null, providerTaskId: null, providerState: null, providerProgress: null,
    rawModelPath: null, privateModelPath: null, preview: Prisma.JsonNull, validation: Prisma.JsonNull, sourceMetadata: Prisma.JsonNull,
    generationStage: "NONE", generationErrorCode: null, failureReason: null, nextPollAt: null, leaseToken: null, leaseUntil: null,
    liveAuthorizedAt: null, processingStartedAt: null, visualVerifiedAt: null, publishedFile: null, publishedAt: null,
    publishedByUserId: null, generationHistory: history as Prisma.InputJsonValue,
  }, include });
  await audit(tx, null, "TEST_RESULT_RETIRED", current.id, { previousRevision: current.revision, historyPreserved: true });
  return result;
}

export function createAccessory3DService(run: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> = work => prisma.$transaction(work, { timeout: 180_000 })) {
  const load = async (tx: Tx, where: Prisma.ProductAccessory3DWhereInput) => {
    const row = await tx.productAccessory3D.findFirst({ where, include });
    return row ? retireRuntimeMock(tx, row) : null;
  };
  const lock = (tx: Tx, id: string) => tx.$queryRaw`SELECT "id" FROM "ProductAccessory3D" WHERE "id"=${id} FOR UPDATE`;
  /** The product, only if it belongs to the caller's shop. */
  const ownProduct = async (tx: Tx, uid: string, productId: string) => {
    const shop = await tx.partsShopProfile.findUnique({ where: { userId: uid }, select: { id: true } });
    const product = shop ? await tx.partsProduct.findFirst({ where: { id: productId, shopId: shop.id } }) : null;
    return product ?? fail("PRODUCT_NOT_FOUND", "Product not found.", 404);
  };
  const owned = async (tx: Tx, uid: string, productId: string, forUpdate = false, part: AccessoryKitPart = "MAIN") => {
    await ownProduct(tx, uid, productId);
    const a = await load(tx, { productId, kitPart: part }); if (!a) return missing();
    if (forUpdate) { await lock(tx, a.id); return (await load(tx, { id: a.id }))!; }
    return a;
  };
  const editable = (a: Full) => { if (a.status !== "DRAFT" && a.status !== "REJECTED") fail("ACCESSORY_LOCKED", "Under review or generated: choose \"Edit and resubmit\" first.", 409); };
  const admin = async (tx: Tx, id: string, forUpdate = false) => { if (forUpdate) await lock(tx, id); return await load(tx, { id }) ?? missing(); };

  return {
    // ---- shop ----
    get: (uid: string, productId: string, part: AccessoryKitPart = "MAIN") => run(async tx => {
      const product = await ownProduct(tx, uid, productId), a = await load(tx, { productId, kitPart: part });
      const parts = await tx.productAccessory3D.findMany({ where: { productId }, select: { kitPart: true, accessoryType: true, status: true } });
      return { eligible: ACCESSORY_CATEGORIES.includes(product.category ?? ""), category: product.category, isUniversal: product.isUniversal, productName: product.name, sizeRanges: SIZE_RANGES, accessory: a ? accessoryShape(a) : null,
        /** every 3D part of this product (a body kit: FRONT / REAR) */
        parts: parts.map(p => ({ part: p.kitPart, type: p.accessoryType, status: p.status })) };
    }),
    /** Create or update type / fits / size / installed set. Changing anything in REJECTED returns it to DRAFT. */
    save: (uid: string, productId: string, input: Record<string, unknown>, part: AccessoryKitPart = "MAIN") => run(async tx => {
      const product = await ownProduct(tx, uid, productId);
      const type = input.accessoryType;
      if (typeof type !== "string" || !(ACCESSORY_TYPES as readonly string[]).includes(type)) return fail("INVALID_TYPE", "Choose the accessory type.");
      if ((part === "FRONT" && type !== "FRONT_BUMPER") || (part === "REAR" && type !== "REAR_BUMPER")) return fail("KIT_PART_TYPE", "A body kit's front part is a front bumper and its rear part a rear bumper.");
      const others = await tx.productAccessory3D.findMany({ where: { productId, kitPart: { not: part } }, select: { kitPart: true } });
      if (others.some(o => (part === "MAIN") !== (o.kitPart === "MAIN"))) return fail("KIT_MIXED", part === "MAIN" ? "This product is a body kit: edit its front or rear bumper." : "This product already has a single 3D part: delete it first to make it a body kit.", 409);
      if (isBumper(type) && product.isUniversal) return fail("BUMPER_NOT_UNIVERSAL", "Bumpers and body kits are made for specific cars: untick Universal on the product and choose the exact generations.");
      if (!accessoryCategoriesFor(type).includes(product.category ?? "")) return fail("CATEGORY_MISMATCH", type === "RIMS" ? "Rims need the Wheels category." : "Body-kit and exterior parts need the Body or Exterior accessories category.");
      const ids = input.fitsGenerationIds;
      if (!Array.isArray(ids) || ids.length > 60 || ids.some(i => typeof i !== "string")) return fail("INVALID_FITS", "Choose the generations this part fits.");
      const gens = await tx.vehicleGeneration.findMany({ where: { id: { in: ids as string[] }, isActive: true }, select: { id: true } });
      if (gens.length !== new Set(ids).size) return fail("INVALID_FITS", "One of the chosen generations is not in the catalog.");
      const mm = (v: unknown) => v === null || v === undefined || v === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 20 && Number(v) <= 3000 ? Number(v) : fail("INVALID_SIZE", "Sizes are whole millimetres between 20 and 3000.");
      const inches = input.rimInches === null || input.rimInches === undefined || input.rimInches === "" ? null : Number(input.rimInches);
      if (inches !== null && !(Number.isFinite(inches) && inches >= 12 && inches <= 26)) return fail("INVALID_SIZE", "Rim size is between 12 and 26 inches.");
      const installedGen = input.installedGenerationId === null || input.installedGenerationId === undefined || input.installedGenerationId === "" ? null : String(input.installedGenerationId);
      // a rim on a Universal product = "Universal by size": no generation list, the installed photos may show any catalog car
      const bySize = universalRim(type, product.isUniversal);
      if (bySize && ids.length) return fail("INVALID_FITS", "A Universal-by-size rim fits any car: untick Universal on the product to choose exact generations instead.");
      if (installedGen && bySize && !await tx.vehicleGeneration.findFirst({ where: { id: installedGen, isActive: true }, select: { id: true } })) return fail("INVALID_INSTALLED_GENERATION", "The car in the installed photos is not in the catalog.");
      if (installedGen && !bySize && !(ids as string[]).includes(installedGen)) return fail("INVALID_INSTALLED_GENERATION", "The car in the installed photos must be one of the generations it fits.");
      if (isBumper(type) && !ids.length) return fail("FITS_REQUIRED", "Bumpers fit specific cars: choose the exact generation(s).");
      const main = sizeField(type), mainValue = main === "rimInches" ? null : (mm(input[main]));
      const bad = sizeProblem(type, mainValue); if (bad) return fail("INVALID_SIZE", bad);
      const rim = type === "RIMS" ? rimSpecs(input) : { rimWidthIn: null, rimPcd: null, rimOffsetMm: null, rimFinish: null };
      const data = { ...rim, accessoryType: type as AccessoryType, widthMm: mm(input.widthMm), heightMm: mm(input.heightMm), depthMm: mm(input.depthMm), lengthMm: mm(input.lengthMm), rimInches: inches,
        installedGenerationId: installedGen, installed360: input.installed360 === true,fitmentNotes:input.fitmentNotes==null||input.fitmentNotes===""?null:typeof input.fitmentNotes==="string"&&input.fitmentNotes.length<=2000?input.fitmentNotes.trim():fail("INVALID_NOTES","Fitment notes are at most 2000 characters.") };
      let a = await load(tx, { productId, kitPart: part });
      if (a) { await lock(tx, a.id); a = (await load(tx, { id: a.id }))!; editable(a);
        await tx.productAccessory3D.update({ where: { id: a.id }, data: { ...data, status: "DRAFT", installedApprovedAt: a.installed360 !== data.installed360 || a.installedGenerationId !== installedGen ? null : a.installedApprovedAt } });
        await tx.productAccessory3DFit.deleteMany({ where: { accessoryId: a.id } });
      } else a = await tx.productAccessory3D.create({ data: { ...data, productId, kitPart: part, shopId: product.shopId }, include });
      if (ids.length) await tx.productAccessory3DFit.createMany({ data: (ids as string[]).map(generationId => ({ accessoryId: a!.id, generationId })), skipDuplicates: true });
      await audit(tx, uid, "SAVE", a.id);
      return accessoryShape((await load(tx, { id: a.id }))!);
    }),
    addPhoto: async (uid: string, productId: string, kind: string, base64: unknown, part: AccessoryKitPart = "MAIN") => {
      if (kind !== "PART" && kind !== "INSTALLED") return fail("INVALID_PHOTO", "Unknown photo kind.");
      const jpeg = await cleanPhoto(base64); let key: string | null = null;
      try {
        return await run(async tx => {
          const a = await owned(tx, uid, productId, true, part); editable(a);
          const count = a.photos.filter(p => p.kind === kind).length;
          if (count >= LIMITS[kind][1]) return fail("TOO_MANY_PHOTOS", kind === "PART" ? "At most 4 part photos." : "At most 24 installed photos.");
          key = storePrivate(jpeg, "jpg");
          await tx.productAccessory3DPhoto.create({ data: { accessoryId: a.id, kind, path: key, sortOrder: Math.max(-1, ...a.photos.map(p => p.sortOrder)) + 1 } });
          await tx.productAccessory3D.update({ where: { id: a.id }, data: { status: "DRAFT", ...(kind === "INSTALLED" ? { installedApprovedAt: null } : {}) } });
          await audit(tx, uid, `PHOTO_${kind}`, a.id);
          return accessoryShape((await load(tx, { id: a.id }))!);
        });
      } catch (error) { removePrivate(key); throw error; }
    },
    removePhoto: async (uid: string, productId: string, photoId: string, part: AccessoryKitPart = "MAIN") => {
      let gone: string | null = null;
      const result = await run(async tx => {
        const a = await owned(tx, uid, productId, true, part); editable(a);
        const p = a.photos.find(x => x.id === photoId) ?? missing();
        await tx.productAccessory3DPhoto.delete({ where: { id: p.id } }); gone = p.path;
        await tx.productAccessory3D.update({ where: { id: a.id }, data: { status: "DRAFT", ...(p.kind === "INSTALLED" ? { installedApprovedAt: null } : {}) } });
        return accessoryShape((await load(tx, { id: a.id }))!);
      });
      removePrivate(gone); return result;
    },
    submit: (uid: string, productId: string, consent: unknown, part: AccessoryKitPart = "MAIN") => run(async tx => {
      const a = await owned(tx, uid, productId, true, part); editable(a);
      // every problem at once (the app lists them all, each one opens its field)
      const universal = (await tx.partsProduct.findUnique({ where: { id: productId }, select: { isUniversal: true } }))?.isUniversal ?? false;
      const n = (k: "PART" | "INSTALLED") => a.photos.filter(p => p.kind === k).length;
      const bySize = universalRim(a.accessoryType, universal);
      const issues: { code: string; field: string; message: string }[] = [];
      const add = (code: string, field: string, message: string) => { issues.push({ code, field, message }); };
      if (isBumper(a.accessoryType) && universal) add("BUMPER_NOT_UNIVERSAL", "fits", "Bumpers and body kits are made for specific cars: untick Universal on the product.");
      if (n("PART") < 2 || n("PART") > 4) add("PART_PHOTOS_REQUIRED", "partPhotos", "Add 2-4 photos of the loose part (plain background, different angles).");
      if (n("INSTALLED") < 1) add("INSTALLED_PHOTOS_REQUIRED", "installedPhotos", "Add at least one photo of the part installed on a car.");
      else if (a.installed360 && n("INSTALLED") < 12) add("SPIN_SET_TOO_SMALL", "installedPhotos", "A 360° set needs at least 12 photos taken around the car.");
      if (!a.fits.length && !bySize) add("FITS_REQUIRED", "fits", "Choose at least one generation this part fits.");
      if (!a.installedGenerationId) add("INSTALLED_GENERATION_REQUIRED", "installedGen", "Choose which car the installed photos show.");
      const main = sizeField(a.accessoryType) as "widthMm" | "lengthMm" | "rimInches", mainValue = a[main];
      if (mainValue === null) add("SIZE_REQUIRED", "size", a.accessoryType === "RIMS" ? "Enter the rim size in inches." : "Enter the part's real size in millimetres.");
      else { const bad = main === "rimInches" ? null : sizeProblem(a.accessoryType, mainValue); if (bad) add("INVALID_SIZE", "size", bad); }
      if (consent !== true) add("CONSENT_REQUIRED", "consent", "Confirm you own these photos and allow MOTEXA to generate and show a 3D model of this part.");
      if (issues.length) throw new Vehicle3DError(400, issues[0].code, issues.length === 1 ? issues[0].message : `${issues.length} things need fixing: ${issues.map(i => i.message).join(" ")}`, issues);
      const updated = await tx.productAccessory3D.update({ where: { id: a.id }, data: { status: "PENDING_REVIEW", submittedAt: new Date(), reviewNotes: null,
        sourceMetadata: { ...(a.sourceMetadata as object ?? {}), shopConsentAt: new Date().toISOString(), shopConsentVersion: CONSENT_VERSION } }, include });
      await audit(tx, uid, "SUBMIT", a.id); return accessoryShape(updated);
    }),
    /** Back to DRAFT to change anything; a published model stops being served until it is published again. */
    revise: (uid: string, productId: string, part: AccessoryKitPart = "MAIN") => run(async tx => {
      const a = await owned(tx, uid, productId, true, part);
      if (a.status === "GENERATING") return fail("ACCESSORY_BUSY", "Wait for the 3D generation to finish.", 409);
      const updated = await tx.productAccessory3D.update({ where: { id: a.id }, data: { status: "DRAFT", visualVerifiedAt: null }, include });
      await audit(tx, uid, "REVISE", a.id, { from: a.status }); return accessoryShape(updated);
    }),
    remove: async (uid: string, productId: string, part: AccessoryKitPart = "MAIN") => {
      const a = await run(async tx => { const a = await owned(tx, uid, productId, true, part);
        if (a.status === "GENERATING" || a.publishedAt || a.publishedFile || a.creditsUsed || a.providerTaskId) return fail("DELETE_BLOCKED", "Generated or published history must be retained. Ask Parts Admin to deactivate it.", 409);
        await tx.productAccessory3D.delete({ where: { id: a.id } }); await audit(tx, uid, "DELETE", a.id); return a; });
      for (const p of a.photos) removePrivate(p.path);
      for (const k of [a.privateModelPath, a.rawModelPath, ...previewKeys(a.preview)]) removePrivate(k);
    },
    /** Private bytes: a photo id, "model" or "preview-<view>". Shop owner or Parts Admin only. */
    asset: (uid: string | null, productIdOrId: string, asset: string, asAdmin = false, part: AccessoryKitPart = "MAIN") => run(async tx => {
      const a = asAdmin ? await admin(tx, productIdOrId) : await owned(tx, uid!, productIdOrId, false, part);
      const views = ((a.preview ?? {}) as { views?: Record<string, string> }).views ?? {};
      const key = asset === "model" ? a.privateModelPath : asset.startsWith("preview-") ? views[asset.slice(8)] ?? null : a.photos.find(p => p.id === asset)?.path ?? null;
      if (!key || !existsSync(privatePath(key))) return missing();
      return { bytes: readFileSync(privatePath(key)), mime: asset === "model" ? "model/gltf-binary" : "image/jpeg" };
    }),

    // ---- Parts Admin ----
    adminList: () => run(async tx => {
      // EVERY submitted request (anything but a shop's draft), of every type and every shop, newest submission first
      const stored = await tx.productAccessory3D.findMany({ where: { OR:[{status:{not:"DRAFT"}},{publishedAt:{not:null}},{privateModelPath:{not:null}}] }, include: { ...include, product: { select: { name: true, brand: true, files: { where: { purpose: "PRODUCT_IMAGE", visibility: "PUBLIC" }, select: { id: true }, take: 1 }, shop: { select: { id: true, shopName: true } } } } }, take: 500 });
      const rows = [];
      for (const row of stored) rows.push({ ...row, ...await retireRuntimeMock(tx, row) });
      for (const row of rows) if (row.status === "PUBLISHED" && !isMockAccessory(row)) await refreshPublishedAccessory(row.id);
      const ids = [...new Set(rows.flatMap(r => [...r.fits.map(f => f.generationId), ...(r.installedGenerationId ? [r.installedGenerationId] : [])]))];
      const gens = await tx.vehicleGeneration.findMany({ where: { id: { in: ids } }, include: { vehicle: { select: { make: true, makeAr: true } } } });
      const car = (id: string) => { const g = gens.find(x => x.id === id); return g ? { id, name: `${g.vehicle.make} ${g.nameEn}`, nameAr: `${g.vehicle.makeAr} ${g.nameAr}` } : null; };
      const when = (r: { submittedAt: Date | null; updatedAt: Date }) => (r.submittedAt ?? r.updatedAt).getTime();
      return rows.sort((x, y) => when(y) - when(x)).map(r => ({ ...accessoryShape(r), productName: r.product.name, productBrand: r.product.brand, shopName: r.product.shop.shopName, shopId: r.product.shop.id,
        productImageId: r.product.files[0]?.id ?? null, firstPartPhotoId: r.photos.find(p => p.kind === "PART")?.id ?? null,
        cars: (r.fits.length ? r.fits.map(f => f.generationId) : r.installedGenerationId ? [r.installedGenerationId] : []).map(car).filter(Boolean) as { id: string; name: string; nameAr: string }[] }));
    }),
    adminGet: (id: string) => run(async tx => {
      const a = await admin(tx, id);
      if (a.status === "PUBLISHED" && !isMockAccessory(a)) await refreshPublishedAccessory(a.id);
      const product = await tx.partsProduct.findUnique({ where: { id: a.productId }, select: { name: true, brand: true, partNumber: true, category: true, shop: { select: { id: true, shopName: true, accessory3dMonthlyCredits: true } } } });
      const gens = await accessoryTargets(a.id,tx);
      const keys = new Set(activeModels().map(m => m.key));
      return { ...accessoryShape(a), review: await accessoryReview(a,tx), providerTaskId: a.providerTaskId, product, creditsThisMonth: await creditsThisMonth(tx, a.shopId), monthlyCredits: product?.shop.accessory3dMonthlyCredits ?? 5,
        mode: generationMode() === "mock" ? "mock" : "real", paidEnabled: paidGenerationEnabled() && !!process.env.MESHY_API_KEY?.trim(), estimatedProviderCredits: MESHY_GENERATION_CREDITS,
        fits: await Promise.all(gens.map(async g => ({ id: g.id, name: `${g.vehicle.make} ${g.nameEn}`, nameAr: `${g.vehicle.makeAr} ${g.nameAr}`, years: [g.yearFrom, g.yearTo], has3d: !!g.model3dKey && g.isPublished && keys.has(g.model3dKey),fit:await fitEligibility(a.id,g.id,a.privateModelPath,tx) }))) };
    }),
    approve: (uid: string, id: string) => run(async tx => {
      const a = await admin(tx, id, true);
      if (a.status !== "PENDING_REVIEW") return fail("REVIEW_CONFLICT", "Only a submitted accessory can be approved for generation.", 409);
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "APPROVED_FOR_GENERATION", approvedAt: new Date(), approvedByUserId: uid, installedApprovedAt: new Date(), reviewNotes: null }, include });
      await audit(tx, uid, "APPROVE", id); const nm = await productName(tx, a.productId);
      await tellShop(tx, a.shopId, ["Your 3D request was approved", "تمت الموافقة على طلبك ثلاثي الأبعاد"], [`${nm}: the photos were approved. The 3D model is the next step.`, `${nm}: تمت الموافقة على الصور. الخطوة التالية هي إنشاء النموذج.`]);
      return accessoryShape(updated);
    }),
    reject: (uid: string, id: string, notes: unknown) => run(async tx => {
      const a = await admin(tx, id, true);
      if (!["PENDING_REVIEW", "READY_FOR_FINAL_REVIEW", "APPROVED_FOR_GENERATION"].includes(a.status)) return fail("REVIEW_CONFLICT", "This accessory cannot be rejected now.", 409);
      if (typeof notes !== "string" || !notes.trim() || notes.length > 2000) return fail("REVIEW_NOTES_REQUIRED", "Tell the shop what to change (at most 2000 characters).");
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "REJECTED", reviewNotes: notes.trim(), reviewedAt: new Date(), reviewedByUserId: uid, visualVerifiedAt: null }, include });
      await audit(tx, uid, "REJECT", id, { from: a.status }); const nm = await productName(tx, a.productId), why = notes.trim().slice(0, 300);
      await tellShop(tx, a.shopId, ["Changes requested on your 3D request", "مطلوب تعديلات على طلبك ثلاثي الأبعاد"], [`${nm}: ${why}`, `${nm}: ${why}`]);
      return accessoryShape(updated);
    }),
    /** The only action that may spend provider credits. Real mode needs the process opt-in, a key, confirmPaid and the shop's monthly cap. */
    retryProcessing: (uid: string, id: string) => run(async tx=>{
      const a = await admin(tx,id,true);
      if (a.status === "GENERATING") return accessoryShape(a);
      if (!["APPROVED_FOR_GENERATION","READY_FOR_FINAL_REVIEW"].includes(a.status) || isMockAccessory(a) || a.generationMode !== "meshy" || a.provider !== "MESHY" || a.providerState !== "SUCCEEDED" || !a.providerTaskId) return fail("PROCESSING_RETRY_BLOCKED","Only an existing successful, private Meshy task can be processed again.",409);
      const history = Array.isArray(a.generationHistory) ? a.generationHistory : [];
      history.push({reason:"LOCAL_PROCESSING_RETRY",taskId:a.providerTaskId,prepared:a.privateModelPath,preview:a.preview,validation:a.validation,at:new Date().toISOString()});
      const row=await tx.productAccessory3D.update({where:{id},data:{status:"GENERATING",generationStage:a.rawModelPath?"VALIDATING":"DOWNLOADING",privateModelPath:null,preview:Prisma.JsonNull,validation:Prisma.JsonNull,visualVerifiedAt:null,
        generationErrorCode:null,failureReason:null,leaseToken:null,leaseUntil:null,nextPollAt:null,processingStartedAt:new Date(),generationHistory:history as Prisma.InputJsonValue},include});
      await audit(tx,uid,"PROCESSING_RETRY",id,{providerTaskId:a.providerTaskId});return accessoryShape(row);
    }),
    start: (uid: string, id: string, confirmPaid: unknown, replaceRevision?: unknown) => run(async tx => {
      const a = await admin(tx, id, true);
      if (a.status === "GENERATING") return accessoryShape(a); // duplicate click: the running job is the job
      const replacing = replaceRevision !== undefined;
      if (replacing) {
        if (confirmPaid !== true) return fail("PAID_CONFIRMATION_REQUIRED", "A new Meshy model costs credits. Confirm the paid replacement.");
        if (a.revision !== replaceRevision || a.status !== "READY_FOR_FINAL_REVIEW" || a.provider !== "MESHY" || a.providerState !== "SUCCEEDED" || !a.providerTaskId || a.publishedAt) return fail("REVIEW_CONFLICT", "Reload the successful private candidate before replacing it.", 409);
      } else if (a.status !== "APPROVED_FOR_GENERATION") return fail("REVIEW_CONFLICT", "Approve the photos for generation first.", 409);
      if (a.generationErrorCode === "PROVIDER_REQUEST_UNCONFIRMED") return fail("PROVIDER_REQUEST_UNCONFIRMED", "The previous paid request was not confirmed. Reconcile it with Meshy before starting another task.", 409);
      if (!replacing && resumable(a)) { // same paid provider task: only free status reads + download, no new task, no credit (like Feature 1)
        const resumed = await tx.productAccessory3D.update({ where: { id }, data: { status: "GENERATING", generationStage: a.rawModelPath ? "VALIDATING" : a.providerState === "SUCCEEDED" ? "DOWNLOADING" : "GENERATING",
          generationErrorCode: null, failureReason: null, leaseToken: null, leaseUntil: null, nextPollAt: null, processingStartedAt: new Date() }, include });
        await audit(tx, uid, "RESUME", id, { shopId: a.shopId, revision: a.revision, after: a.generationErrorCode });
        await tellShop(tx, a.shopId, ["Your 3D model is being created", "يتم إنشاء نموذجك ثلاثي الأبعاد"], [`${await productName(tx, a.productId)}: generation resumed.`, `${await productName(tx, a.productId)}: استُؤنف الإنشاء.`]); return accessoryShape(resumed);
      }
      if(!replacing&&a.generationErrorCode&&a.generationErrorCode!=="CANDIDATE_DISCARDED"&&a.providerTaskId&&a.providerState==="SUCCEEDED")return fail("PROVIDER_TASK_ALREADY_SUCCEEDED","The existing Meshy task succeeded. Resolve its local processing failure; do not create another paid task.",409);
      if (a.photos.filter(p => p.kind === "PART").length < 2) return fail("PART_PHOTOS_REQUIRED", "2-4 part photos are required.", 409);
      const mode = generationMode();
      if (mode === "meshy") {
        if (!process.env.MESHY_API_KEY) return fail("PROVIDER_KEY_MISSING", "Real generation requires a backend Meshy key.", 503);
        if (!paidGenerationEnabled()) return fail("LIVE_OPT_IN_REQUIRED", "Paid generation is disabled on this server.", 409);
        if (confirmPaid !== true) return fail("PAID_CONFIRMATION_REQUIRED", "Confirm that this starts a paid Meshy generation.");
        await tx.$queryRaw`SELECT "id" FROM "PartsShopProfile" WHERE "id"=${a.shopId} FOR UPDATE`; // serialize the cap per shop
        const shop = await tx.partsShopProfile.findUnique({ where: { id: a.shopId }, select: { accessory3dMonthlyCredits: true } });
        if (await creditsThisMonth(tx, a.shopId) >= (shop?.accessory3dMonthlyCredits ?? 5)) return fail("CREDIT_CAP_REACHED", "This shop has used its 3D generations for this month.", 429);
      }
      const history = Array.isArray(a.generationHistory) ? a.generationHistory : [];
      if (a.revision) history.push({ revision: a.revision, provider: a.provider, taskId: a.providerTaskId, state: a.providerState, raw: a.rawModelPath, prepared: a.privateModelPath, preview: a.preview ?? null, error: a.generationErrorCode });
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "GENERATING", generationMode: mode, provider: mode === "mock" ? "MOCK" : "MESHY",
        providerTaskId: null, providerState: null, providerProgress: null, nextPollAt: null, leaseToken: null, leaseUntil: null, generationStage: "QUEUED",
        revision: { increment: 1 }, creditsUsed: mode === "meshy" ? { increment: 1 } : undefined, generationErrorCode: null, failureReason: null,
        liveAuthorizedAt: mode === "meshy" ? new Date() : null, processingStartedAt: new Date(), rawModelPath: null, privateModelPath: null,
        validation: Prisma.JsonNull, preview: Prisma.JsonNull, visualVerifiedAt: null, generationHistory: history as Prisma.InputJsonValue }, include });
      await audit(tx, uid, mode === "meshy" ? "PAID_START" : "MOCK_START", id, { shopId: a.shopId, revision: updated.revision });
      await tellShop(tx, a.shopId, ["Your 3D model is being created", "يتم إنشاء نموذجك ثلاثي الأبعاد"], [`${await productName(tx, a.productId)}: generation started. We will tell you when it is ready for the final check.`, `${await productName(tx, a.productId)}: بدأ الإنشاء. سنُعلمك عندما يصبح جاهزًا للفحص النهائي.`]);
      return accessoryShape(updated);
    }),
    /** Re-render the six-view preview on another fitting generation (clears visual verification). */
    preview: async (uid: string, id: string, generationId: unknown) => {
      const a = await run(tx => admin(tx, id));
      if (!["READY_FOR_FINAL_REVIEW","PUBLISHED"].includes(a.status)) return fail("REVIEW_CONFLICT", "Only a generated accessory can be previewed.", 409);
      if (typeof generationId !== "string") return fail("GENERATION_REQUIRED", "Choose a generation to preview on.");
      const rendered = await renderPreview(a, generationId);
      try {
        return await run(async tx => {
          const now = await admin(tx, id, true);
          if (!["READY_FOR_FINAL_REVIEW","PUBLISHED"].includes(now.status) || modelRevision(now) !== rendered.modelRevision) return fail("STALE_VISUAL_REVIEW", "The model changed while rendering. Reload.", 409);
          const updated = await tx.productAccessory3D.update({ where: { id }, data: { preview: rendered as Prisma.InputJsonValue, visualVerifiedAt: null }, include });
          await audit(tx, uid, "PREVIEW", id, { generationId }); for (const k of previewKeys(now.preview)) removePrivate(k);
          return accessoryShape(updated);
        });
      } catch (error) { for (const k of Object.values(rendered.views)) removePrivate(k); throw error; }
    },
    regenerate: (uid: string, id: string, notes: unknown) => run(async tx => {
      const a = await admin(tx, id, true);
      if (a.status !== "READY_FOR_FINAL_REVIEW") return fail("REVIEW_CONFLICT", "Only a generated accessory awaiting final review can be regenerated.", 409);
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "APPROVED_FOR_GENERATION", generationStage: "UPLOAD", visualVerifiedAt: null,
        reviewNotes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 2000) : null }, include });
      await audit(tx, uid, "REGENERATE_REQUESTED", id); const nm = await productName(tx, a.productId);
      await tellShop(tx, a.shopId, ["We are redoing your 3D model", "نعيد إنشاء نموذجك ثلاثي الأبعاد"], [`${nm}: the first result was not good enough, a new one will be created.`, `${nm}: لم تكن النتيجة الأولى جيدة بما يكفي، سيُنشأ نموذج جديد.`]);
      return accessoryShape(updated);
    }),
    publish: async (uid: string, id: string, input: { visuallyVerified?: unknown; modelRevision?: unknown; notes?: unknown }) => run(async tx => {
      const a = await admin(tx, id, true);
      if (a.status !== "READY_FOR_FINAL_REVIEW" || !a.privateModelPath) return fail("REVIEW_CONFLICT", "Only a generated accessory awaiting final review can be published.", 409);
      if (!isRealSource(a)) return fail("MOCK_NOT_PUBLISHABLE", "Mock results can never be published. Run a real generation or import a real model.", 409);
      if (!existsSync(privatePath(a.privateModelPath))) return fail("MODEL_REQUIRED", "The generated model file is missing.", 409);
      const validation = a.validation as { valid?: boolean; sha256?: string } | null;
      if (validation?.valid !== true || validation.sha256 !== digest(readFileSync(privatePath(a.privateModelPath)))) return fail("VALIDATION_REJECTED", "Validate the current generated model before publishing.", 409);
      const current = modelRevision(a);
      if (input.visuallyVerified !== true) return fail("VISUAL_REVIEW_REQUIRED", "Confirm you checked the part and its fit in all six views.");
      if (input.modelRevision !== current) return fail("STALE_VISUAL_REVIEW", "The model changed. Reload and check the current preview.", 409);
      const review=await accessoryReview(a,tx);
      if(!review.publication.canPublish){const why=review.publication.blockers[0]!;return fail(why.code,why.message,409);}
      if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > 2000)) return fail("INVALID_NOTES", "Notes are at most 2000 characters.");
      const bytes = readFileSync(privatePath(a.privateModelPath)); await readSafeGLB(bytes, 300_000);
      const file = `acc-${digest(bytes).slice(0, 16)}`, target = path.join(PUBLIC_ACCESSORY_DIR, `${file}.glb`);
      mkdirSync(PUBLIC_ACCESSORY_DIR, { recursive: true });
      const other = await tx.productAccessory3D.findFirst({ where: { publishedFile: file, id: { not: id } } });
      if (other) return fail("DUPLICATE_PROMOTION", "This exact model is already published for another product.", 409);
      if (!existsSync(target)) copyFileSync(privatePath(a.privateModelPath), target); // content-addressed: same name = same bytes
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "PUBLISHED", deactivatedAt:null,publishedFile: file, publishedAt: new Date(), publishedByUserId: uid,
        visualVerifiedAt: new Date(), reviewedAt: new Date(), reviewedByUserId: uid, reviewNotes: typeof input.notes === "string" ? input.notes.trim() || null : null }, include });
      await audit(tx, uid, "PUBLISH", id, { file, modelRevision: current, previewGenerationId: (a.preview as { generationId?: string }).generationId ?? null });
      const nm = await productName(tx, a.productId);
      await tellShop(tx, a.shopId, ["Your 3D part is live", "قطعتك ثلاثية الأبعاد منشورة"], [`${nm}: customers can now see it on their own car.`, `${nm}: يمكن للزبائن الآن رؤيتها على سياراتهم.`]);
      return accessoryShape(updated);
    }),
    setCredits: (uid: string, shopId: string, monthly: unknown) => run(async tx => {
      if (!Number.isInteger(monthly) || (monthly as number) < 0 || (monthly as number) > 100) return fail("INVALID_CREDITS", "Monthly 3D generations are a whole number from 0 to 100.");
      const shop = await tx.partsShopProfile.update({ where: { id: shopId }, data: { accessory3dMonthlyCredits: monthly as number }, select: { id: true, accessory3dMonthlyCredits: true } }).catch(() => missing());
      await audit(tx, uid, "CREDITS", shopId, { monthly: monthly as number });
      await tellShop(tx, shopId, ["Your monthly 3D allowance changed", "تغيّر سقف إنشاءات ثلاثية الأبعاد الشهري"], [`You can now start ${monthly} paid 3D generations a month.`, `يمكنك الآن بدء ${monthly} إنشاءات ثلاثية الأبعاد مدفوعة شهريًا.`]); return { ...shop, creditsThisMonth: await creditsThisMonth(tx, shopId) };
    }),
    publication:(uid:string,id:string,enabled:boolean)=>run(async tx=>{
      const a=await admin(tx,id,true);
      if(a.status!=="PUBLISHED"||!a.publishedFile||!a.publishedAt)return fail("PUBLICATION_BLOCKED","Only a previously published model can be reactivated or deactivated.",409);
      if(enabled&&!existsSync(path.join(PUBLIC_ACCESSORY_DIR,a.publishedFile+".glb")))return fail("PUBLICATION_BLOCKED","The published model file is missing.",409);
      if(enabled){const fits=await Promise.all((await accessoryTargets(id,tx)).map(g=>fitEligibility(id,g.id,a.privateModelPath,tx)));if(!fits.some(f=>f.allowed))return fail("FIT_REVIEW_REQUIRED","No current allowed fit exists. Rerun and review the fits.",409);}
      const row=await tx.productAccessory3D.update({where:{id},data:{deactivatedAt:enabled?null:new Date()},include});
      await audit(tx,uid,enabled?"REACTIVATE":"UNPUBLISH",id);
      const nm=await productName(tx,a.productId);
      await tellShop(tx,a.shopId,enabled?["Your 3D part is live again","قطعتك ثلاثية الأبعاد منشورة من جديد"]:["Your 3D part was unpublished","تم إيقاف نشر قطعتك ثلاثية الأبعاد"],enabled?[`${nm}: customers can see it on their car again.`,`${nm}: يمكن للزبائن رؤيتها على سياراتهم مجددًا.`]:[`${nm}: customers no longer see it in 3D. Contact MOTEXA if you have questions.`,`${nm}: لم يعد الزبائن يرونها بالأبعاد الثلاثية. تواصل مع موتكسا لأي استفسار.`]);
      return accessoryShape(row);
    }),
    discardCandidate:async(uid:string,id:string)=>{
      const a=await run(async tx=>{const a=await admin(tx,id,true);
        if(a.publishedAt||a.publishedFile||a.status==="GENERATING")return fail("DELETE_BLOCKED","Published history and running tasks cannot be deleted. Deactivate a published model instead.",409);
        const history=Array.isArray(a.generationHistory)?a.generationHistory:[];
        history.push({revision:a.revision,provider:a.provider,taskId:a.providerTaskId,state:a.providerState,discardedAt:new Date().toISOString(),discarded:true});
        await tx.productAccessory3D.update({where:{id},data:{privateModelPath:null,rawModelPath:null,preview:Prisma.JsonNull,validation:Prisma.JsonNull,generationHistory:history as Prisma.InputJsonValue,generationStage:"FAILED",generationErrorCode:"CANDIDATE_DISCARDED",status:"APPROVED_FOR_GENERATION",failureReason:"Private candidate discarded. A new explicit generation start is required."}});
        await tx.accessoryAutoFit.deleteMany({where:{accessoryId:id}});await audit(tx,uid,"PRIVATE_CANDIDATE_DISCARDED",id);return a;});
      for(const key of [a.privateModelPath,a.rawModelPath,...previewKeys(a.preview)])removePrivate(key);
      return {success:true};
    },
    zones: () => run(async tx => {
      const rows = await tx.accessoryFitZone.findMany();
      const gens = await tx.vehicleGeneration.findMany({ where: { model3dKey: { not: null }, isPublished: true }, include: { vehicle: true } });
      return activeModels().map(m => { const g = gens.find(x => x.model3dKey === m.key);
        return { key: m.key, name: g ? `${g.vehicle.make} ${g.nameEn}` : m.generation, fileZones: m.zones ?? {}, zones: Object.fromEntries(rows.filter(r => r.model3dKey === m.key).map(r => [r.accessoryType, r.zone])) }; });
    }),
    setZone: (uid: string, key: string, type: string, zone: unknown) => run(async tx => {
      if (!activeModels().some(m => m.key === key)) return fail("MODEL_NOT_FOUND", "No active 3D car model with that key.", 404);
      if (!(ACCESSORY_TYPES as readonly string[]).includes(type)) return fail("INVALID_TYPE", "Unknown accessory type.");
      if (zone === null) { await tx.accessoryFitZone.deleteMany({ where: { model3dKey: key, accessoryType: type as AccessoryType } }); await audit(tx, uid, "ZONE_RESET", key, { type }); return null; }
      const parsed = parseZone(zone); if (!parsed) return fail("INVALID_ZONE", "A zone is mesh names and/or a box of fractions (each axis [from, to], -0.5..1.5), optionally with a replace zone.");
      if (parsed.wheelInsetMm && type !== "RIMS") return fail("INVALID_ZONE", "Only rims take a wheel inset (front / rear, 0-40 mm).");
      if (parsed.replace && !REPLACES_STOCK.includes(type)) return fail("INVALID_ZONE", "Only wings, spoilers, roof racks, mirror covers and rims take a replace zone (bumpers and skirts already replace their fit zone).");
      await tx.accessoryFitZone.upsert({ where: { model3dKey_accessoryType: { model3dKey: key, accessoryType: type as AccessoryType } }, create: { model3dKey: key, accessoryType: type as AccessoryType, zone: parsed, updatedByUserId: uid }, update: { zone: parsed, updatedByUserId: uid } });
      await audit(tx, uid, "ZONE_SET", key, { type, zone: parsed }); return parsed;
    }),

    // ---- customers ----
    /** What a customer may see: the published model (if any), what it fits, and the approved installed photos. */
    forProduct: (productId: string, generationId: string | null = null) => run(async tx => {
      const rows = await tx.productAccessory3D.findMany({ where: { productId, product: { isHidden: false, shop:{verificationStatus:"APPROVED",user:{status:"ACTIVE"}} } }, include: { ...include, product: { select: { isUniversal: true } }, fits: { include: { generation: { include: { vehicle: true } } } } } });
      if (!rows.length) return null;
      const bySize = universalRim(rows[0].accessoryType, rows[0].product.isUniversal); // "Universal by size": fitted on any car's wheels
      const order = { MAIN: 0, FRONT: 1, REAR: 2 } as const; rows.sort((x, y) => order[x.kitPart] - order[y.kitPart]);
      const a = rows[0]; // the single part, or the kit's front bumper: its photos are the "Installed look"
      const gen = (g: { id: string; nameEn: string; nameAr: string; model3dKey: string | null; vehicle: { make: string; model: string; makeAr: string; modelAr: string } }) =>
        ({ id: g.id, nameEn: `${g.vehicle.make} ${g.nameEn}`, nameAr: `${g.vehicle.makeAr} ${g.nameAr}` });
      const installedOf = rows.find(r => r.installedApprovedAt) ?? null;
      const installedGen = !installedOf?.installedGenerationId ? null : installedOf.fits.find(f => f.generationId === installedOf.installedGenerationId)?.generation
        ?? (bySize ? await tx.vehicleGeneration.findUnique({ where: { id: installedOf.installedGenerationId }, include: { vehicle: true } }) : null);
      const autoFits = createAutoFitService();
      const parts = [];
      for (const r of rows) {
        if (r.status === "PUBLISHED" && !isMockAccessory(r)) await refreshPublishedAccessory(r.id);
        const live = !isMockAccessory(r) && !!r.visualVerifiedAt && r.status === "PUBLISHED" && !r.deactivatedAt && !!r.publishedFile && existsSync(path.join(PUBLIC_ACCESSORY_DIR,r.publishedFile+".glb")), fitsHere = !!generationId && (bySize || r.fits.some(f => f.generationId === generationId));
        const eligibility=live&&fitsHere?await fitEligibility(r.id,generationId!,r.privateModelPath,tx):{allowed:false,code:!live?"NO_ACCESSORY_3D":"NO_COMPATIBLE_GARAGE_CAR",autoFit:null};
        parts.push({ part: r.kitPart, type: r.accessoryType, fitsIds: r.fits.map(f => f.generationId), universal: bySize,
          model: live ? { file: `accessories/${r.publishedFile}.glb`, size: { widthMm: r.widthMm, lengthMm: r.lengthMm, rimInches: r.rimInches }, finish: r.rimFinish } : null,
          // the stored auto-fit on the customer's generation (+ the Parts Admin's correction); null = the app fits it live
          autoFit: eligibility.autoFit,allowed:eligibility.allowed,reason:eligibility.code });
      }
      const fits = new Map<string, ReturnType<typeof gen>>(); rows.forEach(r => r.fits.forEach(f => fits.set(f.generationId, gen(f.generation))));
      return { type: a.accessoryType, model: parts[0].model, autoFit: parts[0].autoFit, kit: rows.some(r => r.kitPart !== "MAIN"), parts,
        fits: [...fits.values()], universal: bySize, rim: rimOf(a),
        installed: installedOf ? { photoIds: installedOf.photos.filter(p => p.kind === "INSTALLED").map(p => p.id), spin: installedOf.installed360, generation: installedGen ? gen(installedGen) : null } : null };
    }),
    installedPhoto: (photoId: string) => run(async tx => {
      const p = await tx.productAccessory3DPhoto.findFirst({ where: { id: photoId, kind: "INSTALLED", accessory: { installedApprovedAt: { not: null }, product: { isHidden: false,shop:{verificationStatus:"APPROVED",user:{status:"ACTIVE"}} } } } });
      if (!p || !existsSync(privatePath(p.path))) return missing();
      return readFileSync(privatePath(p.path));
    }),
    getAdjust: (uid: string, productId: string, part: AccessoryKitPart = "MAIN") => run(async tx => adjOf((await tx.accessoryFitAdjust.findUnique({ where: { userId_productId: { userId: uid, productId } } }))?.adj, part)),
    putAdjust: (uid: string, productId: string, adj: unknown, part: AccessoryKitPart = "MAIN") => run(async tx => {
      const a = adj as Record<string, unknown>, n = (k: string, lim: number) => typeof a?.[k] === "number" && Number.isFinite(a[k]) && Math.abs(a[k] as number) <= lim;
      if (!a || typeof a !== "object" || !n("x", 0.5) || !n("y", 0.5) || !n("z", 0.5) || !n("rx", 0.8) || !n("ry", 0.8) || !(typeof a.s === "number" && a.s >= 0.8 && a.s <= 1.25))
        return fail("INVALID_ADJUST", "Adjustments are limited to ±0.5 m, ±45° and 80-125 % scale.");
      if (!await tx.productAccessory3D.findFirst({ where: { productId, kitPart: part, status: "PUBLISHED" } })) return missing();
      const clean = { x: a.x as number, y: a.y as number, z: a.z as number, rx: a.rx as number, ry: a.ry as number, s: a.s as number };
      const old = (await tx.accessoryFitAdjust.findUnique({ where: { userId_productId: { userId: uid, productId } } }))?.adj;
      const all = { parts: { ...Object.fromEntries(KIT_PARTS.map(k => [k, adjOf(old, k)]).filter(([, v]) => v)), [part]: clean } };
      await tx.accessoryFitAdjust.upsert({ where: { userId_productId: { userId: uid, productId } }, create: { userId: uid, productId, adj: all }, update: { adj: all } });
      return clean;
    }),
  };
}

// ---- worker (same lease / checkpoint / fail-closed rules as the vehicle worker) ----
type ProcessorOptions = { client?: ReturnType<typeof createMeshyClient>; allowPaid?: boolean; now?: () => Date; render?: typeof renderPreview };
export function createAccessory3DProcessor(options: ProcessorOptions = {}) {
  const client = options.client ?? createMeshyClient({ key: process.env.MESHY_API_KEY, maxBytes: PROVIDER_DOWNLOAD_MAX_BYTES });
  const now = options.now ?? (() => new Date()), render = options.render ?? renderPreview;
  return async function processJob(onlyId: string | null = null) {
    const claimed = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ProductAccessory3D" WHERE "status"='GENERATING'
        AND (${onlyId}::text IS NULL OR "id"=${onlyId}) AND ("nextPollAt" IS NULL OR "nextPollAt"<=${now()})
        AND ("leaseUntil" IS NULL OR "leaseUntil"<${now()}) ORDER BY "updatedAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!rows[0]) return null;
      const a = (await tx.productAccessory3D.findUnique({ where: { id: rows[0].id }, include }))!;
      if (!testProviderRuntime() && isMockAccessory(a)) { await retireRuntimeMock(tx, a); return null; }
      if (a.generationStage === "REQUESTING" && !a.providerTaskId && a.generationMode !== "mock") {
        // a paid POST may or may not have reached the provider: never POST again automatically
        await tx.productAccessory3D.update({ where: { id: a.id }, data: { status: "APPROVED_FOR_GENERATION", generationStage: "FAILED", generationErrorCode: "PROVIDER_REQUEST_UNCONFIRMED", failureReason: "Provider request was not confirmed. Inspect the Meshy account before explicitly starting again.", leaseToken: null, leaseUntil: null } });
        await audit(tx, null, "REQUEST_UNCONFIRMED", a.id); return null;
      }
      const token = randomUUID();
      await tx.productAccessory3D.update({ where: { id: a.id }, data: { leaseToken: token, leaseUntil: new Date(now().getTime() + 180_000), generationStage: a.rawModelPath ? "VALIDATING" : a.providerState === "SUCCEEDED" ? "DOWNLOADING" : a.providerTaskId ? "GENERATING" : "REQUESTING" } });
      return { ...a, leaseToken: token };
    });
    if (!claimed) return;
    const a = claimed;
    const update = async (data: Prisma.ProductAccessory3DUpdateManyMutationInput, action: string) => prisma.$transaction(async tx => {
      const r = await tx.productAccessory3D.updateMany({ where: { id: a.id, status: "GENERATING", leaseToken: a.leaseToken }, data });
      if (r.count) await audit(tx, null, action, a.id, { revision: a.revision });
      return r.count === 1;
    });
    const release = { leaseToken: null, leaseUntil: null };
    let newRaw: string | null = null, newPrepared: string | null = null, newViews: string[] = [];
    let diagnostics: Record<string,unknown> = { providerTaskId:a.providerTaskId,providerState:a.providerState,outputFormat:"glb",providerDownloadLimitBytes:PROVIDER_DOWNLOAD_MAX_BYTES,finalLimitBytes:MAX_MODEL_BYTES };
    try {
      if (!a.approvedAt) throw new MeshyError("INITIAL_REVIEW_REQUIRED");
      if (a.processingStartedAt && now().getTime() - a.processingStartedAt.getTime() > 3_600_000) throw new MeshyError("PROVIDER_JOB_TIMEOUT");
      if (a.generationMode !== "mock" && !a.rawModelPath && !a.providerTaskId) {
        if (!a.liveAuthorizedAt || !(options.allowPaid ?? paidGenerationEnabled())) throw new MeshyError("LIVE_OPT_IN_REQUIRED");
        const images = a.photos.filter(p => p.kind === "PART").slice(0, 4).map(p => `data:image/jpeg;base64,${readFileSync(privatePath(p.path)).toString("base64")}`);
        const task = await client.create(images);
        await update({ providerTaskId: task, providerState: "PENDING", generationStage: "GENERATING", nextPollAt: new Date(now().getTime() + 10_000), ...release }, "PROVIDER_TASK_CREATED"); return;
      }
      let raw = a.rawModelPath && existsSync(privatePath(a.rawModelPath)) ? a.rawModelPath : null;
      if (!raw) {
        let bytes: Buffer;
        if (a.generationMode === "mock") bytes = await mockAccessoryGLB(a.accessoryType);
        else {
          const task = await client.get(a.providerTaskId!);
          const meta = { providerState: task.status, providerProgress: task.progress, generationErrorCode: null, failureReason: null };
          if (task.status === "FAILED" || task.status === "CANCELED") {
            await update({ ...meta, status: "APPROVED_FOR_GENERATION", generationStage: "FAILED", generationErrorCode: task.status === "FAILED" ? "PROVIDER_GENERATION_FAILED" : "PROVIDER_CANCELED", failureReason: "The provider could not complete this generation. Check the part photos and start again.", ...release }, "PROVIDER_FAILED"); return;
          }
          if (task.status !== "SUCCEEDED") { await update({ ...meta, generationStage: "GENERATING", nextPollAt: new Date(now().getTime() + 10_000), ...release }, "PROVIDER_CHECKED"); return; }
          diagnostics.providerState="SUCCEEDED";
          if (!await update({ ...meta, generationStage: "DOWNLOADING" }, "PROVIDER_SUCCEEDED")) return;
          bytes = await client.download(task.glb);
        }
        raw = storePrivate(bytes, "glb"); newRaw = raw;
        diagnostics.rawBytes=bytes.length;
        if (!await update({ rawModelPath: raw, generationStage: "VALIDATING", providerState: "SUCCEEDED",sourceMetadata:{...(a.sourceMetadata as object??{}),processing:diagnostics} as Prisma.InputJsonValue }, "PREPARATION_START")) { removePrivate(raw); return; }
        newRaw = null;
      }
      const rawSize=statSync(privatePath(raw)).size;
      if(rawSize>PROVIDER_DOWNLOAD_MAX_BYTES)throw new MeshyError("PROVIDER_DOWNLOAD_TOO_LARGE",false,15,{rawBytes:rawSize,downloadLimitBytes:PROVIDER_DOWNLOAD_MAX_BYTES});
      const rawBytes=readFileSync(privatePath(raw));diagnostics.rawBytes=rawBytes.length;
      const normalized = await normalizeAccessory(rawBytes,(stage,info)=>{diagnostics={...diagnostics,...info};return update({generationStage:stage,sourceMetadata:{...(a.sourceMetadata as object??{}),processing:diagnostics} as Prisma.InputJsonValue,leaseUntil:new Date(now().getTime()+180_000)},stage);});
      diagnostics={...diagnostics,...normalized.report.processing};
      console.info("Accessory 3D processing",{accessoryId:a.id,...diagnostics});
      const prepared = storePrivate(normalized.bytes, "glb"); newPrepared = prepared;
      // first preview: the car in the installed photos when it has a 3D model, else any fitting generation that has one
      const keys = new Set(activeModels().map(m => m.key));
      const gens = (await accessoryTargets(a.id)).filter(g=>g.isPublished&&g.model3dKey);
      const target = [...gens.filter(g => g.id === a.installedGenerationId), ...gens].find(g => keys.has(g.model3dKey!));
      let preview: Awaited<ReturnType<typeof renderPreview>> | null = null, previewNote: string | null = null;
      if (target) {
        await update({generationStage:"CHECKING_FIT"},"FIT_CHECK_START");
        try { preview = await render({ ...a, privateModelPath: prepared }, target.id); newViews = Object.values(preview.views); }
        catch (e) { previewNote = e instanceof Vehicle3DError ? e.message : "Preview could not be rendered."; }
      } else previewNote = "None of the fitting generations has a published 3D car yet: no preview possible.";
      if (!await update({ privateModelPath: prepared, status: "READY_FOR_FINAL_REVIEW", generationStage: "READY", nextPollAt: null, generationErrorCode: null, failureReason: previewNote,
        validation: { ...normalized.report, validatedAt: now().toISOString() }, preview: preview ? preview as Prisma.InputJsonValue : Prisma.JsonNull,
        sourceMetadata: { ...(a.sourceMetadata as object ?? {}), generatedBy: a.generationMode === "mock" ? "MOCK" : "Meshy", mock: a.generationMode === "mock", generatedAt: now().toISOString(),processing:diagnostics as Prisma.InputJsonObject }, ...release }, "GENERATION_READY")) {
        removePrivate(prepared); newViews.forEach(removePrivate); return;
      }
      newPrepared = null; newViews = [];
      void autoFitAccessory(a.id);
    } catch (error) {
      removePrivate(newRaw); removePrivate(newPrepared); newViews.forEach(removePrivate);
      const e = error instanceof MeshyError ? error : new MeshyError(error instanceof Vehicle3DError ? error.code : "PREPARATION_FAILED");
      diagnostics={...diagnostics,...(error instanceof Vehicle3DError?error.diagnostics:error instanceof MeshyError?error.diagnostics:{}),qualityGate:(error instanceof Vehicle3DError?error.diagnostics?.qualityGate:null)??"FAILED",errorCode:e.code};
      console.warn("Accessory 3D processing stopped",{accessoryId:a.id,...diagnostics});
      if (e.retryable && a.providerTaskId) await update({ generationErrorCode: e.code, failureReason: "Waiting to retry a recoverable provider request.", nextPollAt: new Date(now().getTime() + e.retryAfterSeconds * 1000), ...release }, "PROVIDER_RETRY_SCHEDULED");
      else await update({ status: "APPROVED_FOR_GENERATION", generationStage: "FAILED", generationErrorCode: e.code,
        failureReason: error instanceof Vehicle3DError ? error.message : e.code === "PROVIDER_REQUEST_UNCONFIRMED" ? "Provider request could not be confirmed. Inspect the Meshy account before explicitly starting again." : e.code==="PROVIDER_DOWNLOAD_TOO_LARGE"?`Provider source exceeds the ${PROVIDER_DOWNLOAD_MAX_BYTES}-byte download safety ceiling.`:`Generation stopped (${e.code}).`, sourceMetadata:{...(a.sourceMetadata as object??{}),processing:diagnostics} as Prisma.InputJsonValue,...release }, "GENERATION_FAILED");
    }
  };
}
export const processNextAccessory3DJob = (id: string | null = null) => createAccessory3DProcessor()(id);
/** Leftover preview temp folders from a crash (never served). */
export function cleanPreviewTemp() { if (!existsSync(PRIVATE_3D_DIR)) return; for (const d of readdirSync(PRIVATE_3D_DIR)) if (d.startsWith("tmp-preview-")) rmSync(path.join(PRIVATE_3D_DIR, d), { recursive: true, force: true }); }
