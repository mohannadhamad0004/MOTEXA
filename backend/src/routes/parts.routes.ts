import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { SUBCATEGORIES, isCategory, isProductCategory } from "../catalogCategories.js";
import { CONDITIONS, PART_TYPES } from "../partAttributes.js";
import { requireAuth, requirePartsAdmin, requirePartsProvider } from "../middleware/auth.middleware.js";
import { MIN_PHOTO_BYTES, type ParsedUpload, hasPhoto, filePath, parseUpload, removeStoredFiles, storeFile } from "../uploads/providerFiles.js";
import { requireApprovedProvider } from "../services/provider-onboarding.js";
import { checklist, loadApp } from "../services/provider-onboarding.js";
import { strictNumber } from "../services/numbers.js";
import { effectiveVehicleModels } from "../services/vehicle3d-revisions.js";
import { errorBody } from "../services/error-codes.js";

// Parts shops + products. Mounted at /api.
//  - /api/parts/me/*       PARTS_PROVIDER, always scoped to the caller's own shop.
//  - /api/admin/parts/*    SUPER_ADMIN or ADMIN + MANAGE_SPARE_PARTS. Reviewer/moderator only: never edits product content.
// Mounted BEFORE the global JSON parser: provider routes carry a base64 product image and parse their own
// (larger) body, only after the caller is authenticated. Fitment is free text (no make/model catalogue yet).
const router = Router();

/** Same threshold as the mobile `LOW_STOCK_AT`: 0 = out, 1..5 = low, above = in. */
const LOW_STOCK_AT = 5;
const DECISIONS = ["APPROVED", "REJECTED"] as const;
const FILTERS = ["PENDING", "APPROVED", "REJECTED"] as const;
type Decision = (typeof DECISIONS)[number];

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idParam = (v: unknown) => String(v);
const bad = (res: any, code: number, message: string) => res.status(code).json(errorBody(message));
const fail = (res: any, label: string, error: unknown) => {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
/** Admin overrides are told apart from the provider's own changes: the action gets an ADMIN_ prefix and details.byAdmin is set. */
const acted = (res: any, action: string) => (res.locals.asAdmin ? `ADMIN_${action}` : action);
const adminMark = (res: any) => (res.locals.asAdmin ? { byAdmin: true } : {});
const log = (actorId: string, action: string, targetId: string, details: object = {}) =>
  prisma.auditLog.create({ data: { actorId, action, targetId, details } });

/** Uppercase letters/digits only, so "04465-02220", "04465 02220" and "0446502220" all match. */
const normalizePart = (v: string) => v.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");

// ---- shaping ----

const loadShop = (where: { id?: string; userId?: string }) =>
  prisma.partsShopProfile.findFirst({
    where,
    include: {
      user: { select: { fullName: true, email: true } },
      files: { where: { purpose: "PARTS_SHOP_DOCUMENT" }, orderBy: { createdAt: "asc" } },
    },
  });
type ShopRow = NonNullable<Awaited<ReturnType<typeof loadShop>>>;

type HistoryItem = { at: Date; actor: string; action: string; reason?: string };

/** Synthetic SUBMITTED entry from the shop's creation time, then real decisions from AuditLog. */
async function shopHistory(shop: { id: string; createdAt: Date; user: { fullName: string } }): Promise<HistoryItem[]> {
  const rows = await prisma.auditLog.findMany({
    where: { targetId: shop.id, action: { in: ["PARTS_SHOP_APPROVED", "PARTS_SHOP_REJECTED"] } },
    orderBy: { createdAt: "asc" },
  });
  const ids = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  return [
    { at: shop.createdAt, actor: shop.user.fullName, action: "SUBMITTED" },
    ...rows.map((r) => {
      const d = (r.details ?? {}) as { reason?: string | null };
      const approved = r.action === "PARTS_SHOP_APPROVED";
      return {
        at: r.createdAt,
        actor: (r.actorId && names.get(r.actorId)) || "MOTEXA",
        action: approved ? "APPROVED" : "REJECTED",
        ...(!approved && d.reason ? { reason: d.reason } : {}),
      };
    }),
  ];
}

const shapeShop = (s: ShopRow, history: HistoryItem[]) => ({
  id: s.id,
  shopName: s.shopName,
  ownerName: s.user.fullName,
  ownerEmail: s.user.email,
  phone: s.phone,
  city: s.city,
  address: s.address,
  licenceNumber: s.licenceNumber,
  baseLat: s.baseLat, // exact: only the shop itself and admins get this shape
  baseLng: s.baseLng,
  locationAddress: s.locationAddress,
  brandName: s.brandName,
  branchName: s.branchName,
  categories: s.categories,
  verificationStatus: s.verificationStatus,
  rejectionReason: s.rejectionReason,
  // the storefront photo (a private document: only admins and the shop get this path)
  storefrontUri: (() => {
    const f = s.files.find((x) => x.docKind === "STOREFRONT_PHOTO" || x.label === "STOREFRONT_PHOTO");
    return f ? filePath(f) : null;
  })(),
  documents: s.files.map((f) => ({ kind: f.label ?? "Document", fileName: f.originalName, uri: filePath(f) })),
  history,
});

const withFiles = { files: true, fitments: { orderBy: { position: "asc" } } } as const;
type ProductRow = Prisma.PartsProductGetPayload<{ include: typeof withFiles }>;
/** The product's real photo (same rule as hasPhoto). A dev seed tile or other tiny image is never handed out as the product image. */
const realPhoto = (p: Pick<ProductRow, "files">) =>
  p.files.find((f) => f.purpose === "PRODUCT_IMAGE" && f.visibility === "PUBLIC" && f.mimeType.startsWith("image/") && f.sizeBytes >= MIN_PHOTO_BYTES);
const shapeProduct = (p: ProductRow) => ({
  id: p.id,
  shopId: p.shopId,
  name: p.name,
  brand: p.brand,
  partNumber: p.partNumber,
  description: p.description,
  price: p.price.toString(), // Decimal -> exact string; the mobile service converts to a number
  stock: p.stock,
  category: p.category,
  condition: p.condition,
  partType: p.partType,
  isHidden: p.isHidden,
  hiddenReason: p.hiddenReason,
  imageUri: (() => {
    const f = realPhoto(p);
    return f ? filePath(f) : null;
  })(),
  fitments: p.fitments.map((f) => ({ make: f.make, model: f.model, yearFrom: f.yearFrom, yearTo: f.yearTo, ...(f.trim ? { trim: f.trim } : {}), ...(f.generationId ? { generationId: f.generationId } : {}) })),
  isUniversal: p.isUniversal,
});

// ---- product input ----

type ProductFields = { name: string; brand: string; partNumber: string; description: string | null; price: number; stock: number; category: string; condition: (typeof CONDITIONS)[number]; partType: (typeof PART_TYPES)[number] | null };

function parseProduct(body: any, full: boolean, allowEmpty = false): { data: Partial<ProductFields> } | { error: string } {
  const data: Partial<ProductFields> = {};
  const has = (k: string) => body && Object.prototype.hasOwnProperty.call(body, k);

  for (const [key, label, max] of [["name", "Name", 200], ["brand", "Brand", 100], ["partNumber", "Part number", 100]] as const) {
    if (has(key)) {
      const v = text(body[key], max);
      if (!v) return { error: `${label} is required.` };
      data[key] = v;
    }
  }
  if (has("description")) {
    const d = body.description;
    if (d !== null && typeof d !== "string") return { error: "Description is invalid." };
    data.description = typeof d === "string" && d.trim() ? d.trim().slice(0, 2000) : null;
  }
  if (has("price")) {
    const p = strictNumber(body.price, false, 9_999_999_999.99);
    if (p === null) return { error: "Price must be 0 or more, with up to two decimal places and no letters." };
    data.price = p;
  }
  if (has("stock")) {
    const s = strictNumber(body.stock, true, 1_000_000);
    if (s === null) return { error: "Stock must be a whole number from 0 to 1,000,000, without decimals or letters." };
    data.stock = s;
  }
  if (has("category")) {
    // exactly one category per product, always the most specific one (a sub-category when the category has them)
    if (SUBCATEGORIES[body.category]) return { error: "Choose a more specific category (for example Bulbs or Headlights under Lighting)." };
    if (!isProductCategory(body.category)) return { error: "Choose a valid category." };
    data.category = body.category;
  }
  if (has("condition")) {
    if (!CONDITIONS.includes(body.condition)) return { error: `Condition must be one of: ${CONDITIONS.join(", ")}.` };
    data.condition = body.condition;
  }
  if (has("partType")) {
    // null = "not specified"
    if (body.partType !== null && !PART_TYPES.includes(body.partType)) return { error: `Type must be one of: ${PART_TYPES.join(", ")}, or null.` };
    data.partType = body.partType;
  }
  if (full) {
    for (const k of ["name", "brand", "partNumber", "price", "stock"] as const) if (data[k] === undefined) return { error: `${k} is required.` };
    if (data.description === undefined) data.description = null;
    if (data.category === undefined) return { error: "Choose a category." };
  } else if (!Object.keys(data).length && !allowEmpty) {
    return { error: "No product fields to update." };
  }
  return { data };
}

// ---- fitment input: fitments?: [{ make, model, yearFrom, yearTo, trim?, generationId? }] (absent = unchanged, [] = clear) ----
// generationId ("Fits W202"): the row then takes that generation's years (toListedCars), so matching stays a year range.

const MAX_FITMENTS = 50;
/** Lowercase, trimmed, inner spaces collapsed: the form used for matching. */
const normText = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
type FitRow = { make: string; model: string; makeNormalized: string; modelNormalized: string; yearFrom: number; yearTo: number; trim: string | null; generationId: string | null; position: number };

function parseFitments(body: any): { rows?: FitRow[] } | { error: string } {
  if (body?.fitments === undefined) return {};
  if (!Array.isArray(body.fitments) || body.fitments.length > MAX_FITMENTS) return { error: `Fitment must be a list of at most ${MAX_FITMENTS} rows.` };
  const maxYear = new Date().getFullYear() + 1;
  const rows: FitRow[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of (body.fitments as any[]).entries()) {
    const at = `Fitment row ${i + 1}`;
    const make = text(raw?.make, 60);
    const model = text(raw?.model, 60);
    if (!make) return { error: `${at}: make is required.` };
    if (!model) return { error: `${at}: model is required.` };
    const { yearFrom, yearTo } = raw ?? {};
    const okYear = (y: unknown) => Number.isInteger(y) && (y as number) >= 1950 && (y as number) <= maxYear;
    if (!okYear(yearFrom) || !okYear(yearTo)) return { error: `${at}: years must be whole numbers between 1950 and ${maxYear}.` };
    if (yearFrom > yearTo) return { error: `${at}: "year from" cannot be after "year to".` };
    if (raw.trim !== undefined && raw.trim !== null && typeof raw.trim !== "string") return { error: `${at}: trim is invalid.` };
    const trim = typeof raw.trim === "string" && raw.trim.trim() ? raw.trim.trim().slice(0, 60) : null;
    if (raw.generationId != null && typeof raw.generationId !== "string") return { error: `${at}: generation is invalid.` };
    const generationId: string | null = raw.generationId || null;
    const key = [normText(make), normText(model), yearFrom, yearTo, (trim ?? "").toLowerCase(), generationId ?? ""].join("|");
    if (seen.has(key)) continue; // identical rows are stored once
    seen.add(key);
    rows.push({ make, model, makeNormalized: normText(make), modelNormalized: normText(model), yearFrom, yearTo, trim, generationId, position: rows.length });
  }
  return { rows };
}

const fitKey = (f: { make: string; model: string; yearFrom: number; yearTo: number; trim: string | null; generationId: string | null }) =>
  [f.make, f.model, f.yearFrom, f.yearTo, f.trim ?? "", f.generationId ?? ""].join("|");

/** isUniversal?: boolean (absent = unchanged). */
function parseUniversal(body: any): { value?: boolean } | { error: string } {
  if (body?.isUniversal === undefined) return {};
  if (typeof body.isUniversal !== "boolean") return { error: "isUniversal must be true or false." };
  return { value: body.isUniversal };
}

/**
 * Every fitment row must be a car from the vehicle list (no free text): its make / model are replaced by the list's exact
 * strings so they compare equal to customers' cars. Returns an error naming the first unknown row.
 */
async function toListedCars(rows: FitRow[]): Promise<{ rows: FitRow[] } | { error: string }> {
  if (!rows.length) return { rows };
  const list = await prisma.vehicle.findMany({ where: { OR: rows.map((r) => ({ makeNormalized: r.makeNormalized, modelNormalized: r.modelNormalized })) }, include: { generations: { select: { id: true, yearFrom: true, yearTo: true } } } });
  const by = new Map(list.map((v) => [`${v.makeNormalized}|${v.modelNormalized}`, v]));
  const out: FitRow[] = [];
  for (const [i, r] of rows.entries()) {
    const v = by.get(`${r.makeNormalized}|${r.modelNormalized}`);
    if (!v) return { error: `Fitment row ${i + 1}: choose the car from the vehicle list (${r.make} ${r.model} is not on it).` };
    if (r.generationId) {
      const g = v.generations.find((x) => x.id === r.generationId);
      if (!g) return { error: `Fitment row ${i + 1}: that generation is not a ${v.make} ${v.model}.` };
      out.push({ ...r, make: v.make, model: v.model, yearFrom: g.yearFrom, yearTo: g.yearTo }); // a generation = its year range
    } else out.push({ ...r, make: v.make, model: v.model });
  }
  return { rows: out };
}
const NO_FIT_MSG = "Add at least one car this part fits, or mark it Universal.";

// =====================================================================
// Parts shop (PARTS_PROVIDER)
// =====================================================================
const provider = [requireAuth, requirePartsProvider, express.json({ limit: "25mb" })];
// product changes need an approved shop (reading the shop and its products stays open during onboarding)
const approved = [...provider, requireApprovedProvider];

/** Optional { image: { name, dataBase64 } }. Returns null when no image was sent. */
function parseImage(body: any): { image: ParsedUpload | null } | { error: string } {
  if (body?.image === undefined || body.image === null) return { image: null };
  const p = parseUpload(body.image, "product-image");
  if ("error" in p) return { error: `Product image: ${p.error}` };
  if (p.file.buffer.length < MIN_PHOTO_BYTES) return { error: "Product image: this image is too small to be a real product photo." };
  return { image: p.file };
}

/**
 * The shop a request works on. A provider always gets the shop linked to their own login. The admin routes below reuse the
 * same handlers with res.locals.asAdmin = true (set only AFTER requirePartsAdmin passed): there the shop is the one named in
 * the URL, so a Parts Admin can act on any parts shop, and a provider can never reach another shop.
 */
async function myShop(res: any, req?: any) {
  const user = res.locals.authUser as { id: string };
  const s = res.locals.asAdmin && req ? await loadShop({ id: idParam(req.params.id) }) : await loadShop({ userId: user.id });
  if (!s) bad(res, 404, "No parts shop is linked to this account.");
  return s;
}

/** A rejected shop can't create or edit products (a pending one can: it prepares inventory before approval). */
const REJECTED_MSG = "Your shop application was rejected. You cannot add or edit products.";

async function ownProduct(req: any, res: any) {
  if (res.locals.asAdmin) {
    // admin: the product by id, in whichever shop it belongs to
    const found = await prisma.partsProduct.findUnique({ where: { id: idParam(req.params.id) }, include: withFiles });
    if (!found) {
      bad(res, 404, "Product not found.");
      return null;
    }
    const shop = await loadShop({ id: found.shopId });
    return shop ? { shop, product: found } : null;
  }
  const s = await myShop(res);
  if (!s) return null;
  const p = await prisma.partsProduct.findFirst({ where: { id: idParam(req.params.id), shopId: s.id }, include: withFiles });
  if (!p) {
    bad(res, 404, "Product not found.");
    return null;
  }
  return { shop: s, product: p };
}

router.get("/parts/me/shop", ...provider, async (_req, res) => {
  try {
    const s = await myShop(res);
    if (!s) return;
    return res.json({ success: true, shop: shapeShop(s, await shopHistory(s)) });
  } catch (e) {
    return fail(res, "Parts shop error", e);
  }
});

// ?q= (name, brand, part number incl. spaces/dashes) & ?stock=in|low|out
router.get("/parts/me/products", ...provider, async (req, res) => {
  try {
    const s = await myShop(res);
    if (!s) return;
    const q = text(req.query.q, 100);
    const page = req.query.page === undefined ? null : Number(req.query.page);
    if (page !== null && (!Number.isSafeInteger(page) || page < 1 || page > 10000)) return bad(res,400,"Invalid page.");
    const stock = typeof req.query.stock === "string" ? req.query.stock : undefined;
    if (stock && !["in", "low", "out"].includes(stock)) return bad(res, 400, "Invalid stock filter.");

    const norm = q ? normalizePart(q) : "";
    const products = await prisma.partsProduct.findMany({
      include: withFiles,
      ...(page ? { skip:(page-1)*20, take:21 } : {}),
      where: {
        shopId: s.id,
        ...(stock === "out" ? { stock: 0 } : stock === "low" ? { stock: { gte: 1, lte: LOW_STOCK_AT } } : stock === "in" ? { stock: { gt: LOW_STOCK_AT } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { brand: { contains: q, mode: "insensitive" } },
                { partNumber: { contains: q, mode: "insensitive" } },
                ...(norm ? [{ partNumberNormalized: { contains: norm } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ success: true, products: (page ? products.slice(0,20) : products).map(p=>({...shapeProduct(p),reservedStock:p.reservedStock,customerVisible:s.verificationStatus==="APPROVED"&&!p.isHidden&&!!realPhoto(p)})), hasMore: !!page && products.length > 20 });
  } catch (e) {
    return fail(res, "Parts products error", e);
  }
});

router.get("/parts/me/products/:id", ...provider, async (req, res) => {
  try {
    const own = await ownProduct(req, res);
    if (!own) return;
    return res.json({ success: true, product: {...shapeProduct(own.product),reservedStock:own.product.reservedStock,customerVisible:own.shop.verificationStatus==="APPROVED"&&!own.product.isHidden&&!!realPhoto(own.product)} });
  } catch (e) {
    return fail(res, "Parts product error", e);
  }
});

const createProduct = async (req: any, res: any) => {
  const written: string[] = [];
  try {
    const actor = res.locals.authUser as { id: string };
    const s = await myShop(res, req);
    if (!s) return;
    if (!res.locals.asAdmin && s.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    const parsed = parseProduct(req.body, true);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const d = parsed.data as ProductFields;
    const img = parseImage(req.body);
    if ("error" in img) return bad(res, 400, img.error);
    const fitIn = parseFitments(req.body);
    if ("error" in fitIn) return bad(res, 400, fitIn.error);
    const uni = parseUniversal(req.body);
    if ("error" in uni) return bad(res, 400, uni.error);
    const fit = await toListedCars(fitIn.rows ?? []);
    if ("error" in fit) return bad(res, 400, fit.error);
    if (!fit.rows.length && !uni.value) return bad(res, 400, NO_FIT_MSG);

    let imageRow: Prisma.ProviderFileCreateWithoutProductInput[] = [];
    if (img.image) {
      const storageKey = await storeFile(img.image);
      written.push(storageKey);
      imageRow = [
        {
          owner: { connect: { id: actor.id } },
          purpose: "PRODUCT_IMAGE",
          visibility: "PUBLIC",
          originalName: img.image.originalName,
          mimeType: img.image.mimeType,
          sizeBytes: img.image.buffer.length,
          storageKey,
          sha256: img.image.sha256,
        },
      ];
    }

    // Moderation fields are never taken from the body: a new product is always visible.
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.partsProduct.create({
        data: { ...d, partNumberNormalized: normalizePart(d.partNumber), shopId: s.id, isHidden: false, isUniversal: !!uni.value, files: { create: imageRow }, fitments: { create: fit.rows } },
        include: withFiles,
      });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: acted(res, "PARTS_PRODUCT_CREATED"), targetId: created.id, details: { name: created.name, partNumber: created.partNumber, shopId: s.id, ...adminMark(res) } },
      });
      return created;
    });
    return res.status(201).json({ success: true, product: shapeProduct(product) });
  } catch (e) {
    await removeStoredFiles(written);
    return fail(res, "Parts product create error", e);
  }
};
router.post("/parts/me/products", ...approved, createProduct);

const editProduct = async (req: any, res: any) => {
  const written: string[] = [];
  try {
    const actor = res.locals.authUser as { id: string };
    const own = await ownProduct(req, res);
    if (!own) return;
    if (!res.locals.asAdmin && own.shop.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    // Only content fields are read from the body; isHidden/hiddenReason can never be set here.
    const img = parseImage(req.body);
    if ("error" in img) return bad(res, 400, img.error);
    const fitIn = parseFitments(req.body);
    if ("error" in fitIn) return bad(res, 400, fitIn.error);
    const uni = parseUniversal(req.body);
    if ("error" in uni) return bad(res, 400, uni.error);
    const listed = fitIn.rows !== undefined ? await toListedCars(fitIn.rows) : null;
    if (listed && "error" in listed) return bad(res, 400, listed.error);
    const fit = { rows: listed?.rows };
    const parsed = parseProduct(req.body, false, !!img.image || fit.rows !== undefined || uni.value !== undefined);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const data = parsed.data;
    const p = own.product;
    // A product made before categories existed must get one the next time it is edited.
    if (!p.category && !data.category) return bad(res, 400, "Choose a category for this product.");

    const changed: string[] = (Object.keys(data) as (keyof ProductFields)[]).filter((k) => (k === "price" ? Number(p.price) !== data.price : data[k] !== p[k]));
    if (img.image) changed.push("image");
    // Fitment is replaced as a set; only a real difference counts as a change. It never touches hidden status.
    const fitChanged = fit.rows !== undefined && fit.rows.map(fitKey).join("~") !== p.fitments.map(fitKey).join("~");
    if (fitChanged) changed.push("fitments");
    const uniChanged = uni.value !== undefined && uni.value !== p.isUniversal;
    if (uniChanged) changed.push("isUniversal");
    if((fitChanged||uniChanged||changed.includes("category"))&&await prisma.productAccessory3D.count({where:{productId:p.id,status:{notIn:["DRAFT","REJECTED"]}}}))return res.status(409).json({success:false,code:"ACCESSORY_LOCKED",message:"Revise the 3D request before changing its category or compatibility. Its photos and fit must be reviewed again."});
    // whenever fitment is sent, the product must end up with a car or Universal
    if ((fit.rows !== undefined || uni.value !== undefined) && !(fit.rows ?? p.fitments).length && !(uni.value ?? p.isUniversal)) return bad(res, 400, NO_FIT_MSG);
    if (!changed.length) return res.json({ success: true, product: shapeProduct(p) });
    // stock already promised to accepted orders cannot be taken away
    if (data.stock !== undefined && data.stock < p.reservedStock) return bad(res, 409, `Stock cannot be lower than ${p.reservedStock}: that many are reserved by accepted orders.`);

    // Replacing the image changes nothing else (no re-verification, visibility untouched).
    const oldImage = img.image ? p.files.find((f) => f.purpose === "PRODUCT_IMAGE") : undefined;
    let newKey = "";
    if (img.image) {
      newKey = await storeFile(img.image);
      written.push(newKey);
    }
    await prisma.$transaction(async (tx) => {
      if (oldImage) await tx.providerFile.delete({ where: { id: oldImage.id } });
      if (img.image) {
        await tx.providerFile.create({
          data: {
            ownerUserId: actor.id,
            productId: p.id,
            purpose: "PRODUCT_IMAGE",
            visibility: "PUBLIC",
            originalName: img.image.originalName,
            mimeType: img.image.mimeType,
            sizeBytes: img.image.buffer.length,
            storageKey: newKey,
            sha256: img.image.sha256,
          },
        });
      }
      if (fitChanged) {
        await tx.partsFitment.deleteMany({ where: { productId: p.id } });
        await tx.partsFitment.createMany({ data: fit.rows!.map((r) => ({ ...r, productId: p.id })) });
      }
      await tx.partsProduct.update({
        where: { id: p.id },
        data: { ...data, ...(data.partNumber ? { partNumberNormalized: normalizePart(data.partNumber) } : {}), ...(uniChanged ? { isUniversal: uni.value } : {}) },
      });
      await tx.auditLog.create({ data: { actorId: actor.id, action: acted(res, "PARTS_PRODUCT_EDITED"), targetId: p.id, details: { fields: changed, shopId: p.shopId, ...adminMark(res) } } });
    });
    if (oldImage) await removeStoredFiles([oldImage.storageKey]); // exactly the replaced file
    const fresh = await prisma.partsProduct.findUniqueOrThrow({ where: { id: p.id }, include: withFiles });
    return res.json({ success: true, product: shapeProduct(fresh) });
  } catch (e) {
    await removeStoredFiles(written);
    return fail(res, "Parts product update error", e);
  }
};
router.patch("/parts/me/products/:id", ...approved, editProduct);

router.delete("/parts/me/products/:id", ...approved, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const own = await ownProduct(req, res);
    if (!own) return;
    // an accepted order still has to be prepared / delivered with this product
    const open = await prisma.partsOrderItem.count({ where: { productId: own.product.id, order: { stockReserved: true } } });
    if (open) return bad(res, 409, "This product is part of an accepted order. Finish or cancel that order first.");
    const modelHistory=await prisma.productAccessory3D.count({where:{productId:own.product.id,OR:[{publishedAt:{not:null}},{providerTaskId:{not:null}},{creditsUsed:{gt:0}},{status:"GENERATING"}]}});
    if(modelHistory)return res.status(409).json({success:false,code:"DELETE_BLOCKED",message:"This product has 3D generation or publication history. Parts Admin can deactivate its 3D model; history must be retained."});
    const keys = own.product.files.map((f) => f.storageKey);
    await prisma.$transaction([
      log(actor.id, "PARTS_PRODUCT_REMOVED", own.product.id, { name: own.product.name, partNumber: own.product.partNumber, files: keys.length }),
      prisma.partsProduct.delete({ where: { id: own.product.id } }), // file rows go with it (cascade)
    ]);
    await removeStoredFiles(keys); // exactly this product's files
    return res.json({ success: true });
  } catch (e) {
    return fail(res, "Parts product delete error", e);
  }
});

// Read-only search for the future customer screens: ?make= (required) &model= &year=
// Only visible products (not hidden) of APPROVED shops. Any logged-in account may call it.
router.get("/parts/fitment-search", requireAuth, async (req, res) => {
  try {
    const make = text(req.query.make, 60);
    if (!make) return bad(res, 400, "make is required.");
    const model = text(req.query.model, 60);
    const yearRaw = req.query.year;
    let year: number | null = null;
    if (yearRaw !== undefined && yearRaw !== "") {
      year = Number(yearRaw);
      if (typeof yearRaw !== "string" || !/^\d{4}$/.test(yearRaw) || !Number.isInteger(year)) return bad(res, 400, "year must be a 4-digit number.");
    }

    const match = {
      makeNormalized: normText(make),
      ...(model ? { modelNormalized: normText(model) } : {}),
      ...(year !== null ? { yearFrom: { lte: year }, yearTo: { gte: year } } : {}),
    };
    const products = await prisma.partsProduct.findMany({
      where: { isHidden: false, shop: { verificationStatus: "APPROVED" }, ...hasPhoto, fitments: { some: match } },
      include: { ...withFiles, fitments: { where: match, orderBy: { position: "asc" } }, shop: { select: { id: true, shopName: true, city: true } } },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      take: 50,
    });
    return res.json({
      success: true,
      products: products.map(({ shop, ...p }) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        partNumber: p.partNumber,
        price: p.price.toString(),
        stock: p.stock,
        imageUri: shapeProduct(p as ProductRow).imageUri,
        matchedFitments: shapeProduct(p as ProductRow).fitments,
        shop: { id: shop.id, name: shop.shopName, city: shop.city },
      })),
    });
  } catch (e) {
    return fail(res, "Parts fitment search error", e);
  }
});

// =====================================================================
// Admin (SUPER_ADMIN or ADMIN + MANAGE_SPARE_PARTS): shop decisions + product visibility only
// =====================================================================
const admin = [requireAuth, requirePartsAdmin, express.json()];

// Counts only (department home screen).
router.get("/admin/parts/stats", ...admin, async (_req, res) => {
  try {
    const [pendingShops, approvedShops, hiddenProducts, needsChanges, shops, products, cars3d] = await Promise.all([
      prisma.partsShopProfile.count({ where: { verificationStatus: "PENDING" } }),
      prisma.partsShopProfile.count({ where: { verificationStatus: "APPROVED" } }),
      prisma.partsProduct.count({ where: { isHidden: true } }),
      prisma.partsShopProfile.count({ where: { verificationStatus: "NEEDS_CHANGES" } }),
      prisma.partsShopProfile.count(),
      prisma.partsProduct.count(),
      effectiveVehicleModels().then(m => m.size),
    ]);
    return res.json({ success: true, stats: { pendingShops, approvedShops, hiddenProducts, needsChanges, shops, products, cars3d } });
  } catch (e) {
    return fail(res, "Parts stats error", e);
  }
});

// ?status=PENDING|APPROVED|REJECTED & ?q= (shop name, owner name, phone, city)
router.get("/admin/parts/shops", ...admin, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !FILTERS.includes(status as never)) return bad(res, 400, "Invalid status filter.");
    const q = text(req.query.q, 100);

    const shops = await prisma.partsShopProfile.findMany({
      where: {
        ...(status ? { verificationStatus: status as (typeof FILTERS)[number] } : {}),
        ...(q
          ? {
              OR: [
                { shopName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
                { user: { fullName: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        user: { select: { fullName: true, email: true } },
        files: { where: { purpose: "PARTS_SHOP_DOCUMENT" }, orderBy: { createdAt: "asc" } },
        products: { select: { isHidden: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    // History is only needed on the detail view; the list carries just the synthetic submitted entry.
    return res.json({
      success: true,
      shops: shops.map(({ products, ...s }) => ({
        ...shapeShop(s, [{ at: s.createdAt, actor: s.user.fullName, action: "SUBMITTED" }]),
        productCount: products.length,
        hiddenProductCount: products.filter((p) => p.isHidden).length,
      })),
    });
  } catch (e) {
    return fail(res, "Parts admin list error", e);
  }
});

router.get("/admin/parts/shops/:id", ...admin, async (req, res) => {
  try {
    const s = await loadShop({ id: idParam(req.params.id) });
    if (!s) return bad(res, 404, "Shop not found.");
    const products = await prisma.partsProduct.findMany({ where: { shopId: s.id }, include: withFiles, orderBy: { createdAt: "asc" } });
    // Admins see EVERY product of the shop. These two flags say what a customer would get: a real photo is required (see hasPhoto).
    return res.json({
      success: true,
      shop: shapeShop(s, await shopHistory(s)),
      products: products.map((p) => ({ ...shapeProduct(p), hasPhoto: !!realPhoto(p), customerVisible: s.verificationStatus === "APPROVED" && !p.isHidden && !!realPhoto(p), updatedAt: p.updatedAt, createdAt: p.createdAt })),
    });
  } catch (e) {
    return fail(res, "Parts admin shop error", e);
  }
});

router.patch("/admin/parts/shops/:id/decision", ...admin, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const decision = req.body?.decision as Decision;
    if (!DECISIONS.includes(decision)) return bad(res, 400, "Decision must be APPROVED or REJECTED.");
    const reason = text(req.body?.reason, 1000);
    if (decision === "REJECTED" && !reason) return bad(res, 400, "A rejection reason is required.");
    const s = await prisma.partsShopProfile.findUnique({ where: { id: idParam(req.params.id) }, select: { id: true } });
    if (!s) return bad(res, 404, "Shop not found.");
    if (decision === "APPROVED") {
      // same rule as the application review: the checklist must be complete
      const app = await loadApp("PARTS", { id: s.id });
      const failing = app ? checklist(app).filter((c) => !c.ok) : [];
      if (failing.length) return res.status(409).json({ success: false, message: "The approval checklist is not complete.", failing: failing.map((c) => c.key) });
    }

    await prisma.$transaction([
      prisma.partsShopProfile.update({
        where: { id: s.id },
        data: {
          verificationStatus: decision,
          rejectionReason: decision === "REJECTED" ? reason : null,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      }),
      log(actor.id, `PARTS_SHOP_${decision}`, s.id, { reason: decision === "REJECTED" ? reason : null }),
    ]);
    const updated = (await loadShop({ id: s.id }))!;
    return res.json({ success: true, shop: shapeShop(updated, await shopHistory(updated)) });
  } catch (e) {
    return fail(res, "Parts shop decision error", e);
  }
});

// Moderation: { hidden: true|false, reason? } (reason required when hiding). The only product write admins have.
router.patch("/admin/parts/products/:id/visibility", ...admin, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const hidden = req.body?.hidden;
    if (typeof hidden !== "boolean") return bad(res, 400, "hidden must be true or false.");
    const reason = text(req.body?.reason, 1000);
    if (hidden && !reason) return bad(res, 400, "A reason is required to hide a product.");
    const p = await prisma.partsProduct.findUnique({ where: { id: idParam(req.params.id) }, include: withFiles });
    if (!p) return bad(res, 404, "Product not found.");

    const [updated] = await prisma.$transaction([
      prisma.partsProduct.update({
        where: { id: p.id },
        data: hidden
          ? { isHidden: true, hiddenReason: reason, hiddenById: actor.id, hiddenAt: new Date() }
          : { isHidden: false, hiddenReason: null, hiddenById: null, hiddenAt: null },
        include: withFiles,
      }),
      log(actor.id, hidden ? "PARTS_PRODUCT_HIDDEN" : "PARTS_PRODUCT_UNHIDDEN", p.id, { reason: hidden ? reason : null }),
    ]);
    return res.json({ success: true, product: shapeProduct(updated) });
  } catch (e) {
    return fail(res, "Parts product visibility error", e);
  }
});

// =====================================================================
// Admin full control of the PARTS domain (SUPER_ADMIN or ADMIN + MANAGE_SPARE_PARTS). Nothing here touches tow, mechanics,
// other admins or permissions. No hard delete: products are unpublished with the visibility route above, never removed, and
// document history is kept. Product writes reuse the provider handlers (same validation, same image and fitment rules);
// every change is audited with an ADMIN_ action and details.byAdmin.
// =====================================================================
const adminAsAdmin = (_req: any, res: any, next: any) => {
  res.locals.asAdmin = true;
  next();
};
const adminWrite = [requireAuth, requirePartsAdmin, express.json({ limit: "25mb" }), adminAsAdmin];

router.post("/admin/parts/shops/:id/products", ...adminWrite, createProduct);
router.patch("/admin/parts/products/:id", ...adminWrite, editProduct);

// One product with everything an admin needs: all fields, fitments, image and what a customer would get.
router.get("/admin/parts/products/:id", ...admin, async (req, res) => {
  try {
    const p = await prisma.partsProduct.findUnique({ where: { id: idParam(req.params.id) }, include: { ...withFiles, shop: { select: { id: true, shopName: true, verificationStatus: true } } } });
    if (!p) return bad(res, 404, "Product not found.");
    const photo = !!realPhoto(p);
    const { shop, ...rest } = p;
    return res.json({
      success: true,
      product: { ...shapeProduct(rest as ProductRow), hasPhoto: photo, customerVisible: shop.verificationStatus === "APPROVED" && !p.isHidden && photo, createdAt: p.createdAt, updatedAt: p.updatedAt },
      shop: { id: shop.id, name: shop.shopName, verificationStatus: shop.verificationStatus },
    });
  } catch (e) {
    return fail(res, "Parts admin product error", e);
  }
});

// Shop profile edit: only the fields a shop profile has. Account ownership, login, role and the approval status are not
// editable here; the status keeps changing only through /decision, so editing never approves anything.
router.patch("/admin/parts/shops/:id", ...admin, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const s = await loadShop({ id: idParam(req.params.id) });
    if (!s) return bad(res, 404, "Shop not found.");
    const b = req.body ?? {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    const data: Prisma.PartsShopProfileUpdateInput = {};
    const need = (k: "shopName" | "phone" | "city", max: number, label: string) => {
      const v = text(b[k], max);
      if (!v) throw new Error(`${label} is required.`);
      data[k] = v;
    };
    const opt = (k: "shopNameAr" | "brandName" | "branchName" | "ownerName" | "address" | "licenceNumber" | "workingHours" | "locationAddress", max: number) => {
      const v = b[k];
      if (v === null || v === "") data[k] = null;
      else if (typeof v === "string") data[k] = v.trim().slice(0, max) || null;
      else throw new Error(`${k} must be text.`);
    };
    try {
      if (has("shopName")) need("shopName", 200, "Shop name");
      if (has("phone")) {
        need("phone", 24, "Phone");
        if (!/^\+?[0-9 ()-]{8,24}$/.test(String(data.phone))) throw new Error("Phone number is not valid.");
      }
      if (has("city")) need("city", 80, "City");
      for (const k of ["shopNameAr", "brandName", "branchName", "ownerName", "address", "licenceNumber", "workingHours", "locationAddress"] as const) if (has(k)) opt(k, k === "address" || k === "locationAddress" ? 300 : 200);
    } catch (e) {
      return bad(res, 400, (e as Error).message);
    }
    if (has("categories")) {
      if (!Array.isArray(b.categories) || !b.categories.every(isCategory)) return bad(res, 400, "categories must be a list of valid category keys.");
      data.categories = [...new Set(b.categories as string[])];
    }
    if (has("baseLat") || has("baseLng")) {
      const lat = b.baseLat;
      const lng = b.baseLng;
      if (lat === null && lng === null) {
        data.baseLat = null;
        data.baseLng = null;
      } else if (typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        // an unchanged point is not a change (and keeps its original source, e.g. "current_location")
        if (lat !== s.baseLat || lng !== s.baseLng) {
          data.baseLat = lat;
          data.baseLng = lng;
          data.locationSource = "manual";
        }
      } else return bad(res, 400, "Location needs both a latitude and a longitude (or both empty).");
    }
    const fields = [...new Set(Object.keys(data).map((k) => (k === "baseLat" || k === "baseLng" || k === "locationSource" ? "location" : k)))];
    if (!fields.length) return bad(res, 400, "Nothing to update.");
    await prisma.$transaction([prisma.partsShopProfile.update({ where: { id: s.id }, data }), log(actor.id, "ADMIN_PARTS_SHOP_EDITED", s.id, { fields, byAdmin: true })]);
    const fresh = (await loadShop({ id: s.id }))!;
    return res.json({ success: true, shop: shapeShop(fresh, await shopHistory(fresh)) });
  } catch (e) {
    return fail(res, "Parts admin shop edit error", e);
  }
});

// Replace the storefront photo (a private shop document). Same image rules as the signup upload; the old file is removed.
router.put("/admin/parts/shops/:id/storefront", ...adminWrite, async (req, res) => {
  let key = "";
  try {
    const actor = res.locals.authUser as { id: string };
    const s = await loadShop({ id: idParam(req.params.id) });
    if (!s) return bad(res, 404, "Shop not found.");
    const up = parseUpload(req.body?.image, "storefront");
    if ("error" in up) return bad(res, 400, up.error);
    if (up.file.buffer.length < MIN_PHOTO_BYTES) return bad(res, 400, "This image is too small to be a real storefront photo.");
    key = await storeFile(up.file);
    const old = s.files.filter((f) => f.docKind === "STOREFRONT_PHOTO" || f.label === "STOREFRONT_PHOTO");
    await prisma.$transaction(async (tx) => {
      if (old.length) await tx.providerFile.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      await tx.providerFile.create({
        data: {
          ownerUserId: s.userId,
          purpose: "PARTS_SHOP_DOCUMENT",
          visibility: "PRIVATE",
          partsShopId: s.id,
          label: "STOREFRONT_PHOTO",
          docKind: "STOREFRONT_PHOTO",
          originalName: up.file.originalName,
          mimeType: up.file.mimeType,
          sizeBytes: up.file.buffer.length,
          storageKey: key,
          sha256: up.file.sha256,
          reviewStatus: "ACCEPTED",
        },
      });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "ADMIN_PARTS_STOREFRONT_REPLACED", targetId: s.id, details: { byAdmin: true } } });
    });
    await removeStoredFiles(old.map((o) => o.storageKey));
    const fresh = (await loadShop({ id: s.id }))!;
    return res.json({ success: true, shop: shapeShop(fresh, await shopHistory(fresh)) });
  } catch (e) {
    if (key) await removeStoredFiles([key]);
    return fail(res, "Parts admin storefront error", e);
  }
});

export default router;
