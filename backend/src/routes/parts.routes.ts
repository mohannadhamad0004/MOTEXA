import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { isCategory } from "../catalogCategories.js";
import { CONDITIONS, PART_TYPES } from "../partAttributes.js";
import { requireAuth, requirePartsAdmin, requirePartsProvider } from "../middleware/auth.middleware.js";
import { type ParsedUpload, filePath, parseUpload, removeStoredFiles, storeFile } from "../uploads/providerFiles.js";

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
const bad = (res: any, code: number, message: string) => res.status(code).json({ success: false, message });
const fail = (res: any, label: string, error: unknown) => {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
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
  verificationStatus: s.verificationStatus,
  rejectionReason: s.rejectionReason,
  documents: s.files.map((f) => ({ kind: f.label ?? "Document", fileName: f.originalName, uri: filePath(f) })),
  history,
});

const withFiles = { files: true, fitments: { orderBy: { position: "asc" } } } as const;
type ProductRow = Prisma.PartsProductGetPayload<{ include: typeof withFiles }>;
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
    const f = p.files.find((x) => x.purpose === "PRODUCT_IMAGE");
    return f ? filePath(f) : null;
  })(),
  fitments: p.fitments.map((f) => ({ make: f.make, model: f.model, yearFrom: f.yearFrom, yearTo: f.yearTo, ...(f.trim ? { trim: f.trim } : {}) })),
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
    const p = body.price;
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 9_999_999_999.99) return { error: "Price must be a valid number of 0 or more." };
    data.price = Math.round(p * 100) / 100;
  }
  if (has("stock")) {
    const s = body.stock;
    if (!Number.isInteger(s) || s < 0 || s > 1_000_000) return { error: "Stock must be a whole number of 0 or more." };
    data.stock = s;
  }
  if (has("category")) {
    if (!isCategory(body.category)) return { error: "Choose a valid category." };
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

// ---- fitment input: fitments?: [{ make, model, yearFrom, yearTo, trim? }] (absent = unchanged, [] = clear) ----

const MAX_FITMENTS = 50;
/** Lowercase, trimmed, inner spaces collapsed: the form used for matching. */
const normText = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
type FitRow = { make: string; model: string; makeNormalized: string; modelNormalized: string; yearFrom: number; yearTo: number; trim: string | null; position: number };

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
    const key = [normText(make), normText(model), yearFrom, yearTo, (trim ?? "").toLowerCase()].join("|");
    if (seen.has(key)) continue; // identical rows are stored once
    seen.add(key);
    rows.push({ make, model, makeNormalized: normText(make), modelNormalized: normText(model), yearFrom, yearTo, trim, position: rows.length });
  }
  return { rows };
}

const fitKey = (f: { make: string; model: string; yearFrom: number; yearTo: number; trim: string | null }) =>
  [f.make, f.model, f.yearFrom, f.yearTo, f.trim ?? ""].join("|");

// =====================================================================
// Parts shop (PARTS_PROVIDER)
// =====================================================================
const provider = [requireAuth, requirePartsProvider, express.json({ limit: "25mb" })];

/** Optional { image: { name, dataBase64 } }. Returns null when no image was sent. */
function parseImage(body: any): { image: ParsedUpload | null } | { error: string } {
  if (body?.image === undefined || body.image === null) return { image: null };
  const p = parseUpload(body.image, "product-image");
  return "error" in p ? { error: `Product image: ${p.error}` } : { image: p.file };
}

async function myShop(res: any) {
  const user = res.locals.authUser as { id: string };
  const s = await loadShop({ userId: user.id });
  if (!s) bad(res, 404, "No parts shop is linked to this account.");
  return s;
}

/** A rejected shop can't create or edit products (a pending one can: it prepares inventory before approval). */
const REJECTED_MSG = "Your shop application was rejected. You cannot add or edit products.";

async function ownProduct(req: any, res: any) {
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
    const stock = typeof req.query.stock === "string" ? req.query.stock : undefined;
    if (stock && !["in", "low", "out"].includes(stock)) return bad(res, 400, "Invalid stock filter.");

    const norm = q ? normalizePart(q) : "";
    const products = await prisma.partsProduct.findMany({
      include: withFiles,
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
    return res.json({ success: true, products: products.map(shapeProduct) });
  } catch (e) {
    return fail(res, "Parts products error", e);
  }
});

router.get("/parts/me/products/:id", ...provider, async (req, res) => {
  try {
    const own = await ownProduct(req, res);
    if (!own) return;
    return res.json({ success: true, product: shapeProduct(own.product) });
  } catch (e) {
    return fail(res, "Parts product error", e);
  }
});

router.post("/parts/me/products", ...provider, async (req, res) => {
  const written: string[] = [];
  try {
    const actor = res.locals.authUser as { id: string };
    const s = await myShop(res);
    if (!s) return;
    if (s.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    const parsed = parseProduct(req.body, true);
    if ("error" in parsed) return bad(res, 400, parsed.error);
    const d = parsed.data as ProductFields;
    const img = parseImage(req.body);
    if ("error" in img) return bad(res, 400, img.error);
    const fit = parseFitments(req.body);
    if ("error" in fit) return bad(res, 400, fit.error);

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
        data: { ...d, partNumberNormalized: normalizePart(d.partNumber), shopId: s.id, isHidden: false, files: { create: imageRow }, fitments: { create: fit.rows ?? [] } },
        include: withFiles,
      });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: "PARTS_PRODUCT_CREATED", targetId: created.id, details: { name: created.name, partNumber: created.partNumber } },
      });
      return created;
    });
    return res.status(201).json({ success: true, product: shapeProduct(product) });
  } catch (e) {
    await removeStoredFiles(written);
    return fail(res, "Parts product create error", e);
  }
});

router.patch("/parts/me/products/:id", ...provider, async (req, res) => {
  const written: string[] = [];
  try {
    const actor = res.locals.authUser as { id: string };
    const own = await ownProduct(req, res);
    if (!own) return;
    if (own.shop.verificationStatus === "REJECTED") return bad(res, 403, REJECTED_MSG);
    // Only content fields are read from the body; isHidden/hiddenReason can never be set here.
    const img = parseImage(req.body);
    if ("error" in img) return bad(res, 400, img.error);
    const fit = parseFitments(req.body);
    if ("error" in fit) return bad(res, 400, fit.error);
    const parsed = parseProduct(req.body, false, !!img.image || fit.rows !== undefined);
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
    if (!changed.length) return res.json({ success: true, product: shapeProduct(p) });

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
        data: { ...data, ...(data.partNumber ? { partNumberNormalized: normalizePart(data.partNumber) } : {}) },
      });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "PARTS_PRODUCT_EDITED", targetId: p.id, details: { fields: changed } } });
    });
    if (oldImage) await removeStoredFiles([oldImage.storageKey]); // exactly the replaced file
    const fresh = await prisma.partsProduct.findUniqueOrThrow({ where: { id: p.id }, include: withFiles });
    return res.json({ success: true, product: shapeProduct(fresh) });
  } catch (e) {
    await removeStoredFiles(written);
    return fail(res, "Parts product update error", e);
  }
});

router.delete("/parts/me/products/:id", ...provider, async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const own = await ownProduct(req, res);
    if (!own) return;
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
      where: { isHidden: false, shop: { verificationStatus: "APPROVED" }, fitments: { some: match } },
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
    return res.json({ success: true, shop: shapeShop(s, await shopHistory(s)), products: products.map(shapeProduct) });
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

export default router;
