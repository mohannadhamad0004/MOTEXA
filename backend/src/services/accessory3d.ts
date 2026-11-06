// Feature 2: shop accessories shown in 3D on the customer's car. Reuses the Feature 1 pipeline: the Meshy client, private storage,
// GLB safety checks, the lease/checkpoint worker pattern, exact-revision visual review, mock-never-publishes and explicit paid opt-in.
//   DRAFT -> PENDING_REVIEW (shop) -> APPROVED_FOR_GENERATION (Parts Admin checked photos) -> GENERATING (Parts Admin explicitly
//   starts; real = paid, capped per shop per month) -> READY_FOR_FINAL_REVIEW (validated + six-view preview on a matching car)
//   -> PUBLISHED / REJECTED (or regenerate -> APPROVED_FOR_GENERATION). Shop edits only in DRAFT / REJECTED; "revise" returns to DRAFT.
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Prisma, type AccessoryKitPart, type AccessoryType, type ProductAccessory3D } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { createMeshyClient, MeshyError } from "./meshy-client.js";
import { confirmedPartMaps, rimProposals } from "./car-part-map.js";
import { createAutoFitService, saveFit } from "./accessory-autofit.js";
import { REPO_ROOT, activeModels, type ViewerConfig } from "./vehicle3d-catalog.js";
import { privatePath, storePrivate, removePrivate, PRIVATE_3D_DIR } from "./vehicle3d-private-assets.js";
import { ACCESSORY_TYPES, MAX_MODEL_BYTES, Vehicle3DError, digest, fail, normalizeAccessory, parseZone, readSafeGLB } from "./vehicle3d-validation.js";

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
export const PUBLIC_ACCESSORY_DIR = path.join(REPO_ROOT, "backend/public/3d/accessories");
const LIMITS = { PART: [2, 4], INSTALLED: [1, 24] } as const;
const CONSENT_VERSION = "accessory-3d-v1";
type Tx = Prisma.TransactionClient;
type Full = ProductAccessory3D & { photos: { id: string; kind: string; path: string; sortOrder: number }[]; fits: { generationId: string }[] };
const missing = (): never => fail("ACCESSORY_NOT_FOUND", "3D accessory not found.", 404);
const include = { photos: { orderBy: { sortOrder: "asc" as const } }, fits: true };
const audit = (tx: Tx, actorId: string | null, action: string, targetId: string, details: Prisma.InputJsonValue = {}) =>
  tx.auditLog.create({ data: { actorId, action: `ACCESSORY3D_${action}`, targetId, details } });
export const modelRevision = (a: Pick<ProductAccessory3D, "privateModelPath">) => digest(Buffer.from(a.privateModelPath ?? "")).slice(0, 16);
const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
export async function creditsThisMonth(tx: Tx, shopId: string) {
  return tx.auditLog.count({ where: { action: "ACCESSORY3D_PAID_START", createdAt: { gte: monthStart() }, details: { path: ["shopId"], equals: shopId } } });
}

/** Failures after a provider task exists that a fixed config / retry can finish from the SAME task (never a new paid one). */
const RESUMABLE = ["PROVIDER_ASSET_TOO_LARGE", "PROVIDER_DOWNLOAD_UNAVAILABLE", "PROVIDER_AUTH", "PROVIDER_KEY_MISSING", "PROVIDER_FORBIDDEN", "PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT", "PROVIDER_MALFORMED_RESPONSE", "PREPARATION_FAILED", "INVALID_GLB"];
export const resumable = (a: Pick<ProductAccessory3D, "status" | "providerTaskId" | "generationMode" | "generationErrorCode" | "privateModelPath">) =>
  a.status === "APPROVED_FOR_GENERATION" && a.generationMode === "meshy" && !!a.providerTaskId && !a.privateModelPath && RESUMABLE.includes(a.generationErrorCode ?? "");
export function accessoryShape(a: Full) {
  const photos = (kind: string) => a.photos.filter(p => p.kind === kind).map(p => ({ id: p.id }));
  return { id: a.id, productId: a.productId, kitPart: a.kitPart, accessoryType: a.accessoryType, status: a.status, revision: a.revision, creditsUsed: a.creditsUsed,
    size: { widthMm: a.widthMm, heightMm: a.heightMm, depthMm: a.depthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, rim: rimOf(a),
    fitsGenerationIds: a.fits.map(f => f.generationId), installedGenerationId: a.installedGenerationId, installed360: a.installed360,
    installedApproved: !!a.installedApprovedAt, partPhotos: photos("PART"), installedPhotos: photos("INSTALLED"),
    submittedAt: a.submittedAt, reviewNotes: a.reviewNotes, reviewedAt: a.reviewedAt, approvedAt: a.approvedAt,
    generationMode: a.generationMode, provider: a.provider, providerState: a.providerState, providerProgress: a.providerProgress,
    generationStage: a.generationStage, generationErrorCode: a.generationErrorCode, failureReason: a.failureReason,
    hasModel: !!a.privateModelPath, validation: a.validation, preview: a.preview, modelRevision: modelRevision(a),
    mock: a.generationMode === "mock", published: a.status === "PUBLISHED" && !!a.publishedFile, publishedAt: a.publishedAt, updatedAt: a.updatedAt, resumable: resumable(a) };
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
  const m = activeModels().find(x => x.key === key); if (!m) return null;
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
  if (!a.fits.some(f => f.generationId === generationId)) return fail("GENERATION_NOT_FITTED", "Preview only on a generation this part fits.");
  const gen = await tx.vehicleGeneration.findUnique({ where: { id: generationId }, include: { vehicle: true } });
  const model = gen?.model3dKey && gen.isPublished ? await modelWithZones(gen.model3dKey, tx) : null;
  if (!gen || !model) return fail("NO_3D_CAR", "That generation has no published 3D car model to preview on.", 409);
  const dir = path.join(PRIVATE_3D_DIR, `tmp-preview-${randomUUID()}`); mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(dir, "config.json"), JSON.stringify(model));
    writeFileSync(path.join(dir, "kit.json"), JSON.stringify({ type: a.accessoryType, size: { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches } }));
    let out: { valid?: boolean; fit?: unknown; autofit?: unknown };
    try {
      const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../../scripts/accessory-fit-check.mjs", import.meta.url)),
        `--car=${path.join(REPO_ROOT, "backend/public/3d", model.key + ".glb")}`, `--config=${path.join(dir, "config.json")}`, `--part=${privatePath(a.privateModelPath)}`,
        `--kit=${path.join(dir, "kit.json")}`, `--out=${dir}`], { timeout: 120_000, windowsHide: true, maxBuffer: 256 * 1024 });
      out = JSON.parse(stdout.trim().split("\n").pop()!);
    } catch { return fail("PREVIEW_FAILED", "The part could not be fitted and rendered on this car. Check the part orientation/shape or the car's zone."); }
    if (!out.valid) return fail("PREVIEW_FAILED", "The part could not be fitted and rendered on this car.");
    if (out.autofit) await saveFit(a, generationId, model.key, out.autofit).catch(() => console.error("Could not store the auto-fit from the preview.")); // computed once
    const views: Record<string, string> = {};
    for (const name of ["front", "front-three-quarter", "left-side", "rear-three-quarter", "rear", "top-three-quarter"])
      views[name] = storePrivate(await sharp(path.join(dir, `${name}.png`)).jpeg({ quality: 86 }).toBuffer(), "jpg");
    return { generationId, generationName: `${gen.vehicle.make} ${gen.nameEn}`, model3dKey: model.key, modelRevision: modelRevision(a), views, fit: out.fit ?? null, renderedAt: new Date().toISOString() };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const previewKeys = (p: unknown) => Object.values(((p ?? {}) as { views?: Record<string, string> }).views ?? {});

export function createAccessory3DService(run: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> = work => prisma.$transaction(work, { timeout: 180_000 })) {
  const load = (tx: Tx, where: Prisma.ProductAccessory3DWhereInput) => tx.productAccessory3D.findFirst({ where, include });
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
      return { eligible: ACCESSORY_CATEGORIES.includes(product.category ?? ""), category: product.category, isUniversal: product.isUniversal, accessory: a ? accessoryShape(a) : null,
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
      const rim = type === "RIMS" ? rimSpecs(input) : { rimWidthIn: null, rimPcd: null, rimOffsetMm: null, rimFinish: null };
      const data = { ...rim, accessoryType: type as AccessoryType, widthMm: mm(input.widthMm), heightMm: mm(input.heightMm), depthMm: mm(input.depthMm), lengthMm: mm(input.lengthMm), rimInches: inches,
        installedGenerationId: installedGen, installed360: input.installed360 === true };
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
      if (isBumper(a.accessoryType) && (await tx.partsProduct.findUnique({ where: { id: productId }, select: { isUniversal: true } }))?.isUniversal) return fail("BUMPER_NOT_UNIVERSAL", "Bumpers and body kits are made for specific cars: untick Universal on the product.");
      const n = (k: "PART" | "INSTALLED") => a.photos.filter(p => p.kind === k).length;
      if (n("PART") < 2 || n("PART") > 4) return fail("PART_PHOTOS_REQUIRED", "Add 2-4 photos of the loose part (plain background, different angles).");
      if (n("INSTALLED") < 1) return fail("INSTALLED_PHOTOS_REQUIRED", "Add at least one photo of the part installed on a car.");
      if (a.installed360 && n("INSTALLED") < 12) return fail("SPIN_SET_TOO_SMALL", "A 360° set needs at least 12 photos taken around the car.");
      const bySize = universalRim(a.accessoryType, (await tx.partsProduct.findUnique({ where: { id: productId }, select: { isUniversal: true } }))?.isUniversal ?? false);
      if (!a.fits.length && !bySize) return fail("FITS_REQUIRED", "Choose at least one generation this part fits.");
      if (!a.installedGenerationId) return fail("INSTALLED_GENERATION_REQUIRED", "Choose which car the installed photos show.");
      if (a[sizeField(a.accessoryType) as "widthMm" | "lengthMm" | "rimInches"] === null) return fail("SIZE_REQUIRED", a.accessoryType === "RIMS" ? "Enter the rim size in inches." : "Enter the part's real size in millimetres.");
      if (consent !== true) return fail("CONSENT_REQUIRED", "Confirm you own these photos and allow MOTEXA to generate and show a 3D model of this part.");
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
        if (a.status === "GENERATING" || a.status === "PUBLISHED") return fail("ACCESSORY_BUSY", "Revise it first (published or generating 3D cannot be deleted).", 409);
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
      const rows = await tx.productAccessory3D.findMany({ where: { status: { not: "DRAFT" } }, include: { ...include, product: { select: { name: true, brand: true, shop: { select: { id: true, shopName: true } } } } }, orderBy: { updatedAt: "desc" }, take: 300 });
      return rows.map(r => ({ ...accessoryShape(r), productName: r.product.name, productBrand: r.product.brand, shopName: r.product.shop.shopName }));
    }),
    adminGet: (id: string) => run(async tx => {
      const a = await admin(tx, id);
      const product = await tx.partsProduct.findUnique({ where: { id: a.productId }, select: { name: true, brand: true, partNumber: true, category: true, shop: { select: { id: true, shopName: true, accessory3dMonthlyCredits: true } } } });
      const gens = await tx.vehicleGeneration.findMany({ where: { id: { in: a.fits.map(f => f.generationId) } }, include: { vehicle: true } });
      const keys = new Set(activeModels().map(m => m.key));
      return { ...accessoryShape(a), product, creditsThisMonth: await creditsThisMonth(tx, a.shopId), monthlyCredits: product?.shop.accessory3dMonthlyCredits ?? 5,
        mode: process.env.VEHICLE3D_MODE === "real" ? "real" : "mock", paidEnabled: process.env.VEHICLE3D_MODE === "real" && process.env.MESHY_ALLOW_PAID_GENERATION === "1" && !!process.env.MESHY_API_KEY,
        fits: gens.map(g => ({ id: g.id, name: `${g.vehicle.make} ${g.nameEn}`, nameAr: `${g.vehicle.makeAr} ${g.nameAr}`, years: [g.yearFrom, g.yearTo], has3d: !!g.model3dKey && g.isPublished && keys.has(g.model3dKey) })) };
    }),
    approve: (uid: string, id: string) => run(async tx => {
      const a = await admin(tx, id, true);
      if (a.status !== "PENDING_REVIEW") return fail("REVIEW_CONFLICT", "Only a submitted accessory can be approved for generation.", 409);
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "APPROVED_FOR_GENERATION", approvedAt: new Date(), approvedByUserId: uid, installedApprovedAt: new Date(), reviewNotes: null }, include });
      await audit(tx, uid, "APPROVE", id); return accessoryShape(updated);
    }),
    reject: (uid: string, id: string, notes: unknown) => run(async tx => {
      const a = await admin(tx, id, true);
      if (!["PENDING_REVIEW", "READY_FOR_FINAL_REVIEW", "APPROVED_FOR_GENERATION"].includes(a.status)) return fail("REVIEW_CONFLICT", "This accessory cannot be rejected now.", 409);
      if (typeof notes !== "string" || !notes.trim() || notes.length > 2000) return fail("REVIEW_NOTES_REQUIRED", "Tell the shop what to change (at most 2000 characters).");
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "REJECTED", reviewNotes: notes.trim(), reviewedAt: new Date(), reviewedByUserId: uid, visualVerifiedAt: null }, include });
      await audit(tx, uid, "REJECT", id, { from: a.status }); return accessoryShape(updated);
    }),
    /** The only action that may spend provider credits. Real mode needs the process opt-in, a key, confirmPaid and the shop's monthly cap. */
    start: (uid: string, id: string, confirmPaid: unknown) => run(async tx => {
      const a = await admin(tx, id, true);
      if (a.status === "GENERATING") return accessoryShape(a); // duplicate click: the running job is the job
      if (a.status !== "APPROVED_FOR_GENERATION") return fail("REVIEW_CONFLICT", "Approve the photos for generation first.", 409);
      if (resumable(a)) { // same paid provider task: only free status reads + download, no new task, no credit (like Feature 1)
        const resumed = await tx.productAccessory3D.update({ where: { id }, data: { status: "GENERATING", generationStage: a.rawModelPath ? "PREPARING" : "GENERATING",
          generationErrorCode: null, failureReason: null, leaseToken: null, leaseUntil: null, nextPollAt: null, processingStartedAt: new Date() }, include });
        await audit(tx, uid, "RESUME", id, { shopId: a.shopId, revision: a.revision, after: a.generationErrorCode }); return accessoryShape(resumed);
      }
      if (a.photos.filter(p => p.kind === "PART").length < 2) return fail("PART_PHOTOS_REQUIRED", "2-4 part photos are required.", 409);
      const mode = process.env.VEHICLE3D_MODE === "real" ? "meshy" : "mock";
      if (mode === "meshy") {
        if (!process.env.MESHY_API_KEY) return fail("PROVIDER_KEY_MISSING", "Real generation requires a backend Meshy key.", 503);
        if (process.env.MESHY_ALLOW_PAID_GENERATION !== "1") return fail("LIVE_OPT_IN_REQUIRED", "Paid generation is disabled. Enable it explicitly for an intentional live run.", 409);
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
      return accessoryShape(updated);
    }),
    /** Re-render the six-view preview on another fitting generation (clears visual verification). */
    preview: async (uid: string, id: string, generationId: unknown) => {
      const a = await run(tx => admin(tx, id));
      if (a.status !== "READY_FOR_FINAL_REVIEW") return fail("REVIEW_CONFLICT", "Only a generated accessory awaiting final review can be previewed.", 409);
      if (typeof generationId !== "string") return fail("GENERATION_REQUIRED", "Choose a generation to preview on.");
      const rendered = await renderPreview(a, generationId);
      try {
        return await run(async tx => {
          const now = await admin(tx, id, true);
          if (now.status !== "READY_FOR_FINAL_REVIEW" || modelRevision(now) !== rendered.modelRevision) return fail("STALE_VISUAL_REVIEW", "The model changed while rendering. Reload.", 409);
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
      await audit(tx, uid, "REGENERATE_REQUESTED", id); return accessoryShape(updated);
    }),
    publish: (uid: string, id: string, input: { visuallyVerified?: unknown; modelRevision?: unknown; notes?: unknown }) => run(async tx => {
      const a = await admin(tx, id, true);
      if (a.status !== "READY_FOR_FINAL_REVIEW" || !a.privateModelPath) return fail("REVIEW_CONFLICT", "Only a generated accessory awaiting final review can be published.", 409);
      if (a.generationMode !== "meshy" || a.provider !== "MESHY" || a.providerState !== "SUCCEEDED" || !a.providerTaskId) return fail("MOCK_NOT_PUBLISHABLE", "Mock results can never be published. Run a real generation.", 409);
      const current = modelRevision(a), p = a.preview as { modelRevision?: string } | null;
      if (!p || p.modelRevision !== current) return fail("PREVIEW_REQUIRED", "Render the preview on a matching car for the current model first.", 409);
      if (input.visuallyVerified !== true) return fail("VISUAL_REVIEW_REQUIRED", "Confirm you checked the part and its fit in all six views.");
      if (input.modelRevision !== current) return fail("STALE_VISUAL_REVIEW", "The model changed. Reload and check the current preview.", 409);
      if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > 2000)) return fail("INVALID_NOTES", "Notes are at most 2000 characters.");
      const bytes = readFileSync(privatePath(a.privateModelPath)); await readSafeGLB(bytes, 300_000);
      const file = `acc-${digest(bytes).slice(0, 16)}`, target = path.join(PUBLIC_ACCESSORY_DIR, `${file}.glb`);
      mkdirSync(PUBLIC_ACCESSORY_DIR, { recursive: true });
      const other = await tx.productAccessory3D.findFirst({ where: { publishedFile: file, id: { not: id } } });
      if (other) return fail("DUPLICATE_PROMOTION", "This exact model is already published for another product.", 409);
      if (!existsSync(target)) copyFileSync(privatePath(a.privateModelPath), target); // content-addressed: same name = same bytes
      const updated = await tx.productAccessory3D.update({ where: { id }, data: { status: "PUBLISHED", publishedFile: file, publishedAt: new Date(), publishedByUserId: uid,
        visualVerifiedAt: new Date(), reviewedAt: new Date(), reviewedByUserId: uid, reviewNotes: typeof input.notes === "string" ? input.notes.trim() || null : null }, include });
      await audit(tx, uid, "PUBLISH", id, { file, modelRevision: current, previewGenerationId: (a.preview as { generationId?: string }).generationId ?? null });
      return accessoryShape(updated);
    }),
    setCredits: (uid: string, shopId: string, monthly: unknown) => run(async tx => {
      if (!Number.isInteger(monthly) || (monthly as number) < 0 || (monthly as number) > 100) return fail("INVALID_CREDITS", "Monthly 3D generations are a whole number from 0 to 100.");
      const shop = await tx.partsShopProfile.update({ where: { id: shopId }, data: { accessory3dMonthlyCredits: monthly as number }, select: { id: true, accessory3dMonthlyCredits: true } }).catch(() => missing());
      await audit(tx, uid, "CREDITS", shopId, { monthly: monthly as number }); return { ...shop, creditsThisMonth: await creditsThisMonth(tx, shopId) };
    }),
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
      const rows = await tx.productAccessory3D.findMany({ where: { productId, product: { isHidden: false } }, include: { ...include, product: { select: { isUniversal: true } }, fits: { include: { generation: { include: { vehicle: true } } } } } });
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
        const live = r.status === "PUBLISHED" && !!r.publishedFile, fitsHere = !!generationId && (bySize || r.fits.some(f => f.generationId === generationId));
        parts.push({ part: r.kitPart, type: r.accessoryType, fitsIds: r.fits.map(f => f.generationId), universal: bySize,
          model: live ? { file: `accessories/${r.publishedFile}.glb`, size: { widthMm: r.widthMm, lengthMm: r.lengthMm, rimInches: r.rimInches }, finish: r.rimFinish } : null,
          // the stored auto-fit on the customer's generation (+ the Parts Admin's correction); null = the app fits it live
          autoFit: live && fitsHere ? await autoFits.forCustomer(r.id, generationId!, r.privateModelPath) : null });
      }
      const fits = new Map<string, ReturnType<typeof gen>>(); rows.forEach(r => r.fits.forEach(f => fits.set(f.generationId, gen(f.generation))));
      return { type: a.accessoryType, model: parts[0].model, autoFit: parts[0].autoFit, kit: rows.some(r => r.kitPart !== "MAIN"), parts,
        fits: [...fits.values()], universal: bySize, rim: rimOf(a),
        installed: installedOf ? { photoIds: installedOf.photos.filter(p => p.kind === "INSTALLED").map(p => p.id), spin: installedOf.installed360, generation: installedGen ? gen(installedGen) : null } : null };
    }),
    installedPhoto: (photoId: string) => run(async tx => {
      const p = await tx.productAccessory3DPhoto.findFirst({ where: { id: photoId, kind: "INSTALLED", accessory: { installedApprovedAt: { not: null }, product: { isHidden: false } } } });
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
  const client = options.client ?? createMeshyClient({ key: process.env.MESHY_API_KEY, maxBytes: MAX_MODEL_BYTES });
  const now = options.now ?? (() => new Date()), render = options.render ?? renderPreview;
  return async function processJob(onlyId: string | null = null) {
    const claimed = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ProductAccessory3D" WHERE "status"='GENERATING'
        AND (${onlyId}::text IS NULL OR "id"=${onlyId}) AND ("nextPollAt" IS NULL OR "nextPollAt"<=${now()})
        AND ("leaseUntil" IS NULL OR "leaseUntil"<${now()}) ORDER BY "updatedAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!rows[0]) return null;
      const a = (await tx.productAccessory3D.findUnique({ where: { id: rows[0].id }, include }))!;
      if (a.generationStage === "REQUESTING" && !a.providerTaskId && a.generationMode !== "mock") {
        // a paid POST may or may not have reached the provider: never POST again automatically
        await tx.productAccessory3D.update({ where: { id: a.id }, data: { status: "APPROVED_FOR_GENERATION", generationStage: "FAILED", generationErrorCode: "PROVIDER_REQUEST_UNCONFIRMED", failureReason: "Provider request was not confirmed. Inspect the Meshy account before explicitly starting again.", leaseToken: null, leaseUntil: null } });
        await audit(tx, null, "REQUEST_UNCONFIRMED", a.id); return null;
      }
      const token = randomUUID();
      await tx.productAccessory3D.update({ where: { id: a.id }, data: { leaseToken: token, leaseUntil: new Date(now().getTime() + 180_000), generationStage: a.rawModelPath ? "PREPARING" : a.providerTaskId ? "GENERATING" : "REQUESTING" } });
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
    try {
      if (!a.approvedAt) throw new MeshyError("INITIAL_REVIEW_REQUIRED");
      if (a.processingStartedAt && now().getTime() - a.processingStartedAt.getTime() > 3_600_000) throw new MeshyError("PROVIDER_JOB_TIMEOUT");
      if (a.generationMode !== "mock" && !a.rawModelPath && !a.providerTaskId) {
        if (!a.liveAuthorizedAt || !(options.allowPaid ?? (process.env.MESHY_ALLOW_PAID_GENERATION === "1" && process.env.VEHICLE3D_MODE === "real"))) throw new MeshyError("LIVE_OPT_IN_REQUIRED");
        const images = a.photos.filter(p => p.kind === "PART").slice(0, 4).map(p => `data:image/jpeg;base64,${readFileSync(privatePath(p.path)).toString("base64")}`);
        const task = await client.create(images);
        await update({ providerTaskId: task, providerState: "PENDING", generationStage: "GENERATING", nextPollAt: new Date(now().getTime() + 10_000), ...release }, "PROVIDER_TASK_CREATED"); return;
      }
      let raw = a.rawModelPath;
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
          if (!await update({ ...meta, generationStage: "DOWNLOADING" }, "PROVIDER_SUCCEEDED")) return;
          bytes = await client.download(task.glb);
        }
        raw = storePrivate(bytes, "glb"); newRaw = raw;
        if (!await update({ rawModelPath: raw, generationStage: "PREPARING", providerState: "SUCCEEDED" }, "PREPARATION_START")) { removePrivate(raw); return; }
        newRaw = null;
      }
      const normalized = await normalizeAccessory(readFileSync(privatePath(raw)));
      const prepared = storePrivate(normalized.bytes, "glb"); newPrepared = prepared;
      // first preview: the car in the installed photos when it has a 3D model, else any fitting generation that has one
      const keys = new Set(activeModels().map(m => m.key));
      const gens = await prisma.vehicleGeneration.findMany({ where: { id: { in: a.fits.map(f => f.generationId) }, isPublished: true, model3dKey: { not: null } }, select: { id: true, model3dKey: true } });
      const target = [...gens.filter(g => g.id === a.installedGenerationId), ...gens].find(g => keys.has(g.model3dKey!));
      let preview: Awaited<ReturnType<typeof renderPreview>> | null = null, previewNote: string | null = null;
      if (target) {
        try { preview = await render({ ...a, privateModelPath: prepared }, target.id); newViews = Object.values(preview.views); }
        catch (e) { previewNote = e instanceof Vehicle3DError ? e.message : "Preview could not be rendered."; }
      } else previewNote = "None of the fitting generations has a published 3D car yet: no preview possible.";
      if (!await update({ privateModelPath: prepared, status: "READY_FOR_FINAL_REVIEW", generationStage: "READY", nextPollAt: null, generationErrorCode: null, failureReason: previewNote,
        validation: { ...normalized.report, validatedAt: now().toISOString() }, preview: preview ? preview as Prisma.InputJsonValue : Prisma.JsonNull,
        sourceMetadata: { ...(a.sourceMetadata as object ?? {}), generatedBy: a.generationMode === "mock" ? "MOCK" : "Meshy", mock: a.generationMode === "mock", generatedAt: now().toISOString() }, ...release }, "GENERATION_READY")) {
        removePrivate(prepared); newViews.forEach(removePrivate); return;
      }
      newPrepared = null; newViews = [];
    } catch (error) {
      removePrivate(newRaw); removePrivate(newPrepared); newViews.forEach(removePrivate);
      const e = error instanceof MeshyError ? error : new MeshyError(error instanceof Vehicle3DError ? error.code : "PREPARATION_FAILED");
      if (e.retryable && a.providerTaskId) await update({ generationErrorCode: e.code, failureReason: "Waiting to retry a recoverable provider request.", nextPollAt: new Date(now().getTime() + e.retryAfterSeconds * 1000), ...release }, "PROVIDER_RETRY_SCHEDULED");
      else await update({ status: "APPROVED_FOR_GENERATION", generationStage: "FAILED", generationErrorCode: e.code,
        failureReason: error instanceof Vehicle3DError ? error.message : e.code === "PROVIDER_REQUEST_UNCONFIRMED" ? "Provider request could not be confirmed. Inspect the Meshy account before explicitly starting again." : `Generation stopped (${e.code}).`, ...release }, "GENERATION_FAILED");
    }
  };
}
export const processNextAccessory3DJob = (id: string | null = null) => createAccessory3DProcessor()(id);
/** Leftover preview temp folders from a crash (never served). */
export function cleanPreviewTemp() { if (!existsSync(PRIVATE_3D_DIR)) return; for (const d of readdirSync(PRIVATE_3D_DIR)) if (d.startsWith("tmp-preview-")) rmSync(path.join(PRIVATE_3D_DIR, d), { recursive: true, force: true }); }
