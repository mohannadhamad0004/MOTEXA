import { publicProviderMedia } from "../services/public-provider-presentation.js";
import { freeDriversNear } from "../services/tow-cards.js";
import {publishedVehicleList} from "../services/vehicle-taxonomy.js";
import express, { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expiredDocuments } from "../services/truck-eligibility.js";
import { PROVIDER_STORAGE_DIR, hasPhoto } from "../uploads/providerFiles.js";
import { type SaleFields, discountPct, productBadges, saleWas } from "../services/catalog-badges.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { CATALOG_GROUPS, SUBCATEGORIES, categoriesOfGroup, categoryFamily, isAnyCategory, isCategory, isGroup } from "../catalogCategories.js";
import { SERVICE_CITIES, canonicalCity } from "../cities.js";
import { GEO_BOX_MESSAGE, cityCentre, haversineKm, inBox, round3 } from "../geo.js";
import { CONDITIONS, PART_TYPES } from "../partAttributes.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { fitWhere } from "../services/fitment.js";
import { GEN_FIELDS } from "../services/garage.js";
import { createGarageRouter } from "./garage.routes.js";

// Read-only customer catalog: parts and tow companies. Any logged-in (ACTIVE) account may read it.
//
// PRIVACY: this is the only place customers get provider data, so every response is built from an explicit
// field list. Never returned: hidden products, anything from a PENDING/REJECTED shop or company, truck plates,
// phones, emails, licence numbers, documents, storage paths, exact stock numbers.
const router = Router();
router.use(requireAuth);

const PAGE_SIZE = 20;
/** Same threshold as the mobile `LOW_STOCK_AT`: 0 = out, 1..5 = low, above = in. */
const LOW_STOCK_AT = 5;

export const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idParam = (v: unknown) => String(v);
const bad = (res: any, code: number, message: string) => res.status(code).json({ success: false, message });
const fail = (res: any, label: string, error: unknown) => {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
const normText = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const normalizePart = (v: string) => v.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
/** Stock is shown as a state, not a number: exact inventory levels are the shop's business. */
const stockState = (n: number) => (n <= 0 ? "OUT" : n <= LOW_STOCK_AT ? "LOW" : "IN");

// ---- parts ----

/** Only products a customer may ever see. */
/** A customer never sees a part without a real photo (see hasPhoto). Products without one stay available to the provider and the admin. */
const visible: Prisma.PartsProductWhereInput = { isHidden: false, shop: { verificationStatus: "APPROVED" }, ...hasPhoto };

const productInclude = {
  files: { where: { purpose: "PRODUCT_IMAGE" as const } },
  fitments: { orderBy: { position: "asc" as const } },
  shop: { select: { id: true, shopName: true, city: true } },
  // published 3D parts only (a customer never sees a draft); drives the "3D · View on my car" badge and the "Front + rear" label
  accessory3d: { where: { status: "PUBLISHED" as const }, select: { kitPart: true, accessoryType: true, fits: { select: { generationId: true } } } },
};
type ProductRow = Prisma.PartsProductGetPayload<{ include: typeof productInclude }>;

const shapeProduct = (p: ProductRow, withDescription = false) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  partNumber: p.partNumber,
  ...(withDescription ? { description: p.description } : {}),
  price: Number(p.price),
  // what a customer can still buy: units held for accepted orders are not offered again
  stock: stockState(p.stock - p.reservedStock),
  /** units free to order (stock minus reserved), capped for the quantity picker; never an exact warehouse count above 99 */
  available: Math.max(0, Math.min(99, p.stock - p.reservedStock)),
  category: p.category,
  condition: p.condition,
  partType: p.partType,
  imageUri: p.files[0] ? `/files/public/${p.files[0].id}` : null,
  fitments: p.fitments.map((f) => ({ make: f.make, model: f.model, yearFrom: f.yearFrom, yearTo: f.yearTo, ...(f.trim ? { trim: f.trim } : {}), ...(f.generationId ? { generationId: f.generationId } : {}) })),
  isUniversal: p.isUniversal,
  shop: { id: p.shop.id, name: p.shop.shopName, city: p.shop.city },
  compareAtPrice: saleWas(p),
  warrantyMonths: p.warrantyMonths,
  badges: productBadges({ ...p, stock: p.stock - p.reservedStock }),
  model3d: p.accessory3d.length ? { kit: p.accessory3d.some((a) => a.kitPart !== "MAIN"), parts: p.accessory3d.map((a) => ({ part: a.kitPart, type: a.accessoryType })), generationIds: [...new Set(p.accessory3d.flatMap((a) => a.fits.map((f) => f.generationId)))],
    // a rim on a Universal product ("Universal by size") is shown on any car that has a 3D model
    universal: p.isUniversal && p.accessory3d.some((a) => a.accessoryType === "RIMS") } : null,
});

// Product names are English: the common Arabic body-kit words also match their English name ("مصد E36" finds "E36 M3 front bumper").
// ponytail: a hand list, not a translator. Add a word when shops start listing it; a real Arabic name field is the long-term fix.
const AR_ALIASES: Record<string, string[]> = { مصد: ["bumper"], مصدات: ["bumper"], صدام: ["bumper"], جناح: ["wing", "spoiler"], سبويلر: ["spoiler"], طقم: ["kit"], بودي: ["body"] };
const arAlias = (w: string) => AR_ALIASES[w.replace(/^ال/, "")] ?? [];

const PART_SORTS = ["relevance", "price_asc", "price_desc", "newest", "discount"] as const;
type PartSort = (typeof PART_SORTS)[number];
type SortRow = SaleFields & { id: string; name: string; stock: number; createdAt: Date };
/** Every order ends with name, then id, so pages never overlap or skip when prices or dates tie. */
const PART_ORDER: Record<PartSort, (a: SortRow, b: SortRow) => number> = {
  relevance: (a, b) => Number(b.stock > 0) - Number(a.stock > 0),
  price_asc: (a, b) => Number(a.price) - Number(b.price),
  price_desc: (a, b) => Number(b.price) - Number(a.price),
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  discount: (a, b) => discountPct(b) - discountPct(a),
};

/** A list parameter: "a,b" or repeated ?x=a&x=b. Blank items are dropped, at most 20 are kept. */
const listParam = (v: unknown) =>
  (Array.isArray(v) ? v : [v])
    .filter((x): x is string => typeof x === "string")
    .flatMap((x) => x.split(","))
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
/** A price bound: a plain number of 0 or more. */
const money = (v: unknown) => (typeof v === "string" && /^\d+(\.\d{1,2})?$/.test(v.trim()) && Number(v) <= 9_999_999_999.99 ? Number(v) : null);

// ?q= &make= &model= &year= &shopId= &category=KEY &group=KEY &sort=relevance|price_asc|price_desc|newest &page=   (model/year need make)
//   &condition=NEW,USED  &partType=OEM|AFTERMARKET  &brand=Bosch,Mann  &minPrice= &maxPrice=  &inStock=1  &onSale=1  &city=Nablus (shop city, from the city list)
//   &sort=discount (biggest running discount first)
router.get("/parts", async (req, res) => {
  try {
    const q = text(req.query.q, 100);
    const make = text(req.query.make, 60);
    const model = text(req.query.model, 60);
    const trim = text(req.query.trim, 60); // engine / variant, only with a make
    const yearRaw = typeof req.query.year === "string" ? req.query.year : "";
    if ((model || yearRaw || trim) && !make) return bad(res, 400, "make is required when model or year is given.");
    if (yearRaw && !/^\d{4}$/.test(yearRaw)) return bad(res, 400, "year must be a 4-digit number.");
    const pageRaw = typeof req.query.page === "string" ? req.query.page : "1";
    const page = Number(pageRaw);
    if (!/^\d+$/.test(pageRaw) || page < 1 || page > 10_000) return bad(res, 400, "page must be a positive whole number.");

    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "relevance";
    if (!PART_SORTS.includes(sortRaw as PartSort)) return bad(res, 400, `sort must be one of: ${PART_SORTS.join(", ")}.`);
    const sort = sortRaw as PartSort;
    const shopId = text(req.query.shopId, 64);
    const category = typeof req.query.category === "string" ? req.query.category : "";
    if (category && !isAnyCategory(category)) return bad(res, 400, "Unknown category.");
    const group = typeof req.query.group === "string" ? req.query.group : "";
    if (group && !isGroup(group)) return bad(res, 400, "Unknown group.");

    const conditions = listParam(req.query.condition);
    if (conditions.some((c) => !CONDITIONS.includes(c as never))) return bad(res, 400, `condition must be any of: ${CONDITIONS.join(", ")}.`);
    const partType = typeof req.query.partType === "string" ? req.query.partType : "";
    if (partType && !PART_TYPES.includes(partType as never)) return bad(res, 400, `partType must be one of: ${PART_TYPES.join(", ")}.`);
    const brands = listParam(req.query.brand);
    if (brands.some((b) => b.length > 100)) return bad(res, 400, "brand is too long.");
    const minRaw = typeof req.query.minPrice === "string" ? req.query.minPrice : "";
    const maxRaw = typeof req.query.maxPrice === "string" ? req.query.maxPrice : "";
    const minPrice = minRaw ? money(minRaw) : null;
    const maxPrice = maxRaw ? money(maxRaw) : null;
    if ((minRaw && minPrice === null) || (maxRaw && maxPrice === null)) return bad(res, 400, "minPrice and maxPrice must be numbers of 0 or more.");
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) return bad(res, 400, "minPrice cannot be more than maxPrice.");
    const inStockRaw = typeof req.query.inStock === "string" ? req.query.inStock : "";
    if (inStockRaw && !["1", "true", "0", "false"].includes(inStockRaw)) return bad(res, 400, "inStock must be 1 or 0.");
    const onSaleRaw = typeof req.query.onSale === "string" ? req.query.onSale : "";
    if (onSaleRaw && !["1", "true", "0", "false"].includes(onSaleRaw)) return bad(res, 400, "onSale must be 1 or 0.");
    const cityRaw = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const city = cityRaw ? canonicalCity(cityRaw) : null;
    if (cityRaw && !city) return bad(res, 400, "Unknown city. Choose from the city list.");

    const norm = q ? normalizePart(q) : "";
    const year = yearRaw ? Number(yearRaw) : null;
    const and: Prisma.PartsProductWhereInput[] = [];
    // a category outside the group matches nothing
    if (group) and.push({ category: { in: [...categoriesOfGroup(group)] } });
    if (conditions.length) and.push({ condition: { in: conditions as never[] } });
    if (partType) and.push({ partType: partType as never });
    if (brands.length) and.push({ OR: brands.map((b) => ({ brand: { equals: b, mode: "insensitive" as const } })) });
    if (minPrice !== null || maxPrice !== null) and.push({ price: { ...(minPrice !== null ? { gte: minPrice } : {}), ...(maxPrice !== null ? { lte: maxPrice } : {}) } });
    if (inStockRaw === "1" || inStockRaw === "true") and.push({ stock: { gt: 0 } });
    // same rule as saleWas(): a "was" price above the price, inside the optional window
    if (onSaleRaw === "1" || onSaleRaw === "true") {
      const now = new Date();
      and.push(
        { compareAtPrice: { gt: prisma.partsProduct.fields.price } },
        { OR: [{ saleStartsAt: null }, { saleStartsAt: { lte: now } }] },
        { OR: [{ saleEndsAt: null }, { saleEndsAt: { gt: now } }] }
      );
    }
    if (city) and.push({ shop: { city: { equals: city, mode: "insensitive" } } });
    // the car: a matching fitment row OR a universal part (services/fitment.ts)
    if (make) and.push(fitWhere({ make, model, year, trim }));
    // Search: every word must match something real of the product: its name, brand, part / OEM number (formatting ignored,
    // 4+ characters, no fuzzy matching) or the make / model of one of its fitment records (so "W202 brake pads" = model W202 + name).
    for (const w of q ? normText(q).split(" ").filter(Boolean).slice(0, 6) : []) {
      const np = normalizePart(w);
      and.push({
        OR: [
          ...[w, ...arAlias(w)].map((x) => ({ name: { contains: x, mode: "insensitive" as const } })),
          { brand: { contains: w, mode: "insensitive" } },
          ...(w.length >= 3 ? [{ partNumber: { contains: w, mode: "insensitive" as const } }] : []),
          ...(np.length >= 4 ? [{ partNumberNormalized: { contains: np } }] : []),
          { fitments: { some: { OR: [{ makeNormalized: { contains: w } }, { modelNormalized: { contains: w } }] } } },
        ],
      });
    }
    const where: Prisma.PartsProductWhereInput = {
      ...visible,
      ...(shopId ? { shopId } : {}),
      // a category matches itself + its sub-categories; one stored key per product, so every product appears once
      ...(category ? { category: { in: categoryFamily(category) } } : {}),
      ...(and.length ? { AND: and } : {}),
    };

    // ponytail: ids are sorted in memory (default: in stock first, then name) because Prisma can't order by "stock > 0".
    // Fine for a catalog of thousands; switch to a raw ORDER BY (stock > 0) DESC, name when it grows.
    const all = await prisma.partsProduct.findMany({ where, select: { id: true, name: true, stock: true, price: true, createdAt: true, compareAtPrice: true, saleStartsAt: true, saleEndsAt: true } });
    all.sort((a, b) => PART_ORDER[sort](a, b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const ids = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => p.id);
    const rows = await prisma.partsProduct.findMany({ where: { id: { in: ids } }, include: productInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));

    return res.json({
      success: true,
      products: ids.map((id) => shapeProduct(byId.get(id)!)),
      page,
      pageSize: PAGE_SIZE,
      total: all.length,
      hasMore: page * PAGE_SIZE < all.length,
    });
  } catch (e) {
    return fail(res, "Catalog parts error", e);
  }
});

// Distinct brands of the products a customer can see, for the filter chips. ?category= or ?group= narrows them.
router.get("/brands", async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : "";
    if (category && !isAnyCategory(category)) return bad(res, 400, "Unknown category.");
    const group = typeof req.query.group === "string" ? req.query.group : "";
    if (group && !isGroup(group)) return bad(res, 400, "Unknown group.");
    const rows = await prisma.partsProduct.findMany({
      where: { ...visible, ...(category ? { category: { in: categoryFamily(category) } } : {}), ...(group ? { AND: [{ category: { in: [...categoriesOfGroup(group)] } }] } : {}) },
      select: { brand: true },
      distinct: ["brand"],
    });
    // one entry per spelling-ignoring-case, alphabetical, at most 100
    const seen = new Map<string, string>();
    for (const { brand } of rows) if (!seen.has(brand.toLowerCase())) seen.set(brand.toLowerCase(), brand);
    const brands = [...seen.values()].sort((a, b) => a.localeCompare(b)).slice(0, 100);
    return res.json({ success: true, brands });
  } catch (e) {
    return fail(res, "Catalog brands error", e);
  }
});

// Groups with the number of products a customer can see in each category (zero is listed too, never hidden).
router.get("/categories", async (_req, res) => {
  try {
    const rows = await prisma.partsProduct.groupBy({ by: ["category"], where: { ...visible, category: { not: null } }, _count: { _all: true } });
    const count = new Map(rows.map((r) => [r.category as string, r._count._all]));
    const groups = CATALOG_GROUPS.map((g) => {
      // a category's count = its own products (not yet moved to a sub-category) + its sub-categories'; each product counted once
      const categories = g.categories.map((key) => {
        const subs = (SUBCATEGORIES[key] ?? []).map((k) => ({ key: k, count: count.get(k) ?? 0 }));
        return { key, count: categoryFamily(key).reduce((n, k) => n + (count.get(k) ?? 0), 0), ...(subs.length ? { subcategories: subs } : {}) };
      });
      return { key: g.key, count: categories.reduce((n, c) => n + c.count, 0), categories };
    });
    return res.json({ success: true, groups });
  } catch (e) {
    return fail(res, "Catalog categories error", e);
  }
});

router.get("/parts/:id", async (req, res) => {
  try {
    const p = await prisma.partsProduct.findFirst({ where: { id: idParam(req.params.id), ...visible }, include: productInclude });
    if (!p) return bad(res, 404, "Product not found.");
    return res.json({ success: true, product: shapeProduct(p, true) });
  } catch (e) {
    return fail(res, "Catalog part error", e);
  }
});

// APPROVED shops with the number of products a customer can see in each. Busiest first, then by name. Public fields only.
router.get("/shops", async (_req, res) => {
  try {
    const shops = await prisma.partsShopProfile.findMany({
      where: { verificationStatus: "APPROVED" },
      select: {
        id: true, shopName: true, shopNameAr: true, brandName: true, branchName: true, city: true, categories: true, baseLat: true, baseLng: true, workingHours: true,
        files: { where: { purpose: "PARTS_SHOP_DOCUMENT", docKind: "STOREFRONT_PHOTO" }, select: { id: true }, take: 1 },
        _count: { select: { products: { where: { isHidden: false, ...hasPhoto } } } },
      },
    });
    const list = shops
      .map((s) => ({
        id: s.id, name: s.shopName, nameAr: s.shopNameAr, brandName: s.brandName, branchName: s.branchName, city: s.city, productCount: s._count.products,
        categories: s.categories.filter(isCategory), baseLat: round3(s.baseLat), baseLng: round3(s.baseLng), storefrontUri: s.files[0] ? `/catalog/shops/${s.id}/storefront` : null,
        hours: s.workingHours,
      }))
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return res.json({ success: true, shops: list });
  } catch (e) {
    return fail(res, "Catalog shops error", e);
  }
});

// One APPROVED shop, public fields only. The storefront photo is a private verification file: only that photo (never another
// document) is streamed, to logged-in customers, by /shops/:id/storefront. The map point is rounded to ~110 m like tow companies.
router.get("/shops/:id", async (req, res) => {
  try {
    const s = await prisma.partsShopProfile.findFirst({
      where: { id: idParam(req.params.id), verificationStatus: "APPROVED" },
      select: {
        id: true, shopName: true, shopNameAr: true, brandName: true, branchName: true, city: true, address: true, locationAddress: true, categories: true, baseLat: true, baseLng: true, workingHours: true,
        deliveryEnabled: true, deliveryFee: true, deliveryAreaNote: true,
        files: { where: { purpose: "PARTS_SHOP_DOCUMENT", docKind: "STOREFRONT_PHOTO" }, select: { id: true }, take: 1 },
      },
    });
    if (!s) return bad(res, 404, "Shop not found.");
    const products = await prisma.partsProduct.findMany({ where: { shopId: s.id, isHidden: false, ...hasPhoto }, include: productInclude, orderBy: { name: "asc" }, take: 100 });
    return res.json({
      success: true,
      shop: {
        id: s.id,
        name: s.shopName,
        nameAr: s.shopNameAr,
        brandName: s.brandName,
        branchName: s.branchName,
        city: s.city,
        address: s.address ?? s.locationAddress,
        categories: s.categories.filter(isCategory),
        baseLat: round3(s.baseLat),
        baseLng: round3(s.baseLng),
        storefrontUri: s.files[0] ? `/catalog/shops/${s.id}/storefront` : null,
        media: await publicProviderMedia("parts", s.id),
        workingHours: s.workingHours,
        // orders: whether the owner delivers, his fee (null = agreed with the shop) and where he delivers
        delivery: { enabled: s.deliveryEnabled, fee: s.deliveryFee === null ? null : Number(s.deliveryFee), areaNote: s.deliveryAreaNote },
      },
      products: products.map((p) => shapeProduct(p)),
    });
  } catch (e) {
    return fail(res, "Catalog shop error", e);
  }
});

router.get("/shops/:id/storefront", async (req, res) => {
  try {
    const f = await prisma.providerFile.findFirst({
      where: { purpose: "PARTS_SHOP_DOCUMENT", docKind: "STOREFRONT_PHOTO", partsShop: { id: idParam(req.params.id), verificationStatus: "APPROVED" } },
      select: { storageKey: true, mimeType: true },
    });
    if (!f || !f.mimeType.startsWith("image/")) return bad(res, 404, "Photo not found.");
    const bytes = await readFile(path.join(PROVIDER_STORAGE_DIR, path.basename(f.storageKey)));
    res.setHeader("Content-Type", f.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(bytes);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return bad(res, 404, "Photo not found.");
    return fail(res, "Catalog storefront error", e);
  }
});

// Vehicles that really appear in the fitment data of visible products (no separate vehicle catalogue exists). ?q= is split into
// The whole vehicle list (makes -> models -> year ranges, EN + AR) for the car pickers and the car-aware search. Small and
// fixed, so it is sent in one go and the client narrows it. Each model carries its generations (years may overlap).
router.get("/vehicle-list", async (req, res) => {
  try {
    const fitment=req.query.purpose==="fitment"&&["PARTS_PROVIDER","ADMIN","SUPER_ADMIN"].includes(res.locals.authUser.role);
    const vehicles=await prisma.$transaction(tx=>publishedVehicleList(tx,fitment));
    return res.json({ success: true, vehicles });
  } catch (e) {
    return fail(res, "Vehicle list error", e);
  }
});

// Garage and single-car compatibility routes share one transactional source of truth.
router.use(createGarageRouter());

// words and every word must be part of the make or the model, so "mercedes w202" finds make Mercedes, model W202. Each row
// carries the exact make / model strings the /parts filter expects, the years covered and how many parts fit.
router.get("/vehicles", async (req, res) => {
  try {
    const words = normText(text(req.query.q, 60) ?? "").split(" ").filter(Boolean).slice(0, 4);
    const rows = await prisma.partsFitment.findMany({
      where: {
        product: visible,
        AND: words.map((w) => ({ OR: [{ makeNormalized: { contains: w } }, { modelNormalized: { contains: w } }] })),
      },
      select: { make: true, model: true, makeNormalized: true, modelNormalized: true, yearFrom: true, yearTo: true, trim: true, productId: true },
      take: 3000,
    });
    const by = new Map<string, { make: string; model: string; yearFrom: number; yearTo: number; products: Set<string>; trims: Set<string> }>();
    for (const r of rows) {
      const k = `${r.makeNormalized}|${r.modelNormalized}`;
      const v = by.get(k) ?? { make: r.make, model: r.model, yearFrom: r.yearFrom, yearTo: r.yearTo, products: new Set<string>(), trims: new Set<string>() };
      v.yearFrom = Math.min(v.yearFrom, r.yearFrom);
      v.yearTo = Math.max(v.yearTo, r.yearTo);
      v.products.add(r.productId);
      if (r.trim) v.trims.add(r.trim);
      by.set(k, v);
    }
    const vehicles = [...by.values()]
      .map((v) => ({ make: v.make, model: v.model, yearFrom: v.yearFrom, yearTo: v.yearTo, partCount: v.products.size, trims: [...v.trims].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => b.partCount - a.partCount || a.make.localeCompare(b.make) || a.model.localeCompare(b.model))
      .slice(0, 15);
    return res.json({ success: true, vehicles });
  } catch (e) {
    return fail(res, "Catalog vehicles error", e);
  }
});

// ---- tow ----

const TRUCK_TYPES = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"] as const;
const TOW_SORTS = ["available", "name", "nearest"] as const;

/** ?lat=&lng= (both or none), plain numbers inside the accepted area. null = not given, string = error message. */
export function readPoint(query: any): { lat: number; lng: number } | null | string {
  const { lat, lng } = query;
  if (lat === undefined && lng === undefined) return null;
  const isNum = (v: unknown) => typeof v === "string" && /^-?\d{1,3}(\.\d{1,15})?$/.test(v.trim());
  if (!isNum(lat) || !isNum(lng)) return "lat and lng must both be given, as plain numbers.";
  const p = { lat: Number(lat), lng: Number(lng) };
  return inBox(p.lat, p.lng) ? p : GEO_BOX_MESSAGE;
}

/** Straight-line distance from `from` to a company: from its base point, else from the centre of its city. */
export function distanceTo(from: { lat: number; lng: number }, c: { city: string; baseLat: number | null; baseLng: number | null }) {
  if (c.baseLat !== null && c.baseLng !== null) return { distanceKm: Math.round(haversineKm(from, { lat: c.baseLat, lng: c.baseLng }) * 10) / 10, distanceSource: "base" as const };
  const centre = cityCentre(c.city);
  if (centre) return { distanceKm: Math.round(haversineKm(from, centre) * 10) / 10, distanceSource: "city" as const };
  return { distanceKm: null, distanceSource: null };
}

// ?city= &q= (company name) contains, case-insensitive. ?serviceCity= company city OR a service city contains it. ?truckType= at least one APPROVED truck of that type.
// ?availableOnly=1 at least one AVAILABLE truck. ?sort=available (default: most available trucks, then name) | name.
// ?lat=&lng= (your position, both or none) adds distanceKm + distanceSource ("base" | "city") and makes sort=nearest the default.
// Only APPROVED companies; counts only APPROVED trucks.
router.get("/tow/companies", async (req, res) => {
  try {
    const city = text(req.query.city, 60);
    const q = text(req.query.q, 100);
    const serviceCity = text(req.query.serviceCity, 60);
    // A typed fragment ("nab") matches every listed service city whose name contains it.
    const serviceMatches = serviceCity ? SERVICE_CITIES.filter((c) => c.toLowerCase().includes(serviceCity.toLowerCase())) : [];
    const truckTypeRaw = typeof req.query.truckType === "string" ? req.query.truckType : "";
    if (truckTypeRaw && !TRUCK_TYPES.includes(truckTypeRaw as never)) return bad(res, 400, `truckType must be one of: ${TRUCK_TYPES.join(", ")}.`);
    const point = readPoint(req.query);
    if (typeof point === "string") return bad(res, 400, point);
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : point ? "nearest" : "available";
    if (!TOW_SORTS.includes(sortRaw as never)) return bad(res, 400, `sort must be one of: ${TOW_SORTS.join(", ")}.`);
    if (sortRaw === "nearest" && !point) return bad(res, 400, "sort=nearest needs lat and lng.");
    const availableOnly = req.query.availableOnly === "1" || req.query.availableOnly === "true";

    const companies = await prisma.towCompanyProfile.findMany({
      where: {
        verificationStatus: "APPROVED",
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...(q ? { companyName: { contains: q, mode: "insensitive" } } : {}),
        ...(serviceCity
          ? { OR: [{ city: { contains: serviceCity, mode: "insensitive" } }, ...(serviceMatches.length ? [{ serviceCities: { hasSome: [...serviceMatches] } }] : [])] }
          : {}),
      },
      select: {
        id: true,
        companyName: true,
        city: true,
        serviceCities: true,
        workingHours: true,
        baseLat: true,
        baseLng: true,
        trucks: { where: { verificationStatus: "APPROVED", archivedAt: null }, select: { truckType: true, operationalStatus: true, files: { select: { purpose: true, expiresAt: true } } } },
      },
    });
    // real numbers only: FREE drivers right now and the stored reviews
    const freeBy = new Map<string, number>();
    for (const d of await freeDriversNear(null)) freeBy.set(d._companyId, (freeBy.get(d._companyId) ?? 0) + 1);
    const rated = await prisma.towReview.groupBy({ by: ["companyId"], _avg: { stars: true }, _count: { _all: true } });
    const rows = companies
      // A company with no approved truck has nothing to offer a customer yet, so it is not listed.
      .filter((c) => c.trucks.length > 0)
      .filter((c) => !truckTypeRaw || c.trucks.some((t) => t.truckType === truckTypeRaw))
      .map((c) => ({
        id: c.id,
        name: c.companyName,
        city: c.city,
        serviceCities: c.serviceCities,
        workingHours: c.workingHours,
        // the business location, rounded to about 110 m; distances are worked out from the exact point
        baseLat: round3(c.baseLat),
        baseLng: round3(c.baseLng),
        ...(point ? distanceTo(point, c) : {}),
        verified: true, // listed = approved by MOTEXA
        freeDrivers: freeBy.get(c.id) ?? 0,
        rating: { avg: rated.find((x) => x.companyId === c.id)?._avg.stars ? Math.round(rated.find((x) => x.companyId === c.id)!._avg.stars! * 10) / 10 : null, count: rated.find((x) => x.companyId === c.id)?._count._all ?? 0 },
        approvedTrucks: c.trucks.length,
        // a truck with an expired document is not available for new work
        availableTrucks: c.trucks.filter((t) => t.operationalStatus === "AVAILABLE" && expiredDocuments(t.files).length === 0).length,
        truckTypes: [...new Set(c.trucks.map((t) => t.truckType))],
      }))
      .filter((c) => !availableOnly || c.availableTrucks > 0)
      .sort((a, b) => {
        const km = (x: object) => (x as { distanceKm?: number | null }).distanceKm ?? Infinity;
        const byDistance = sortRaw === "nearest" ? km(a) - km(b) : 0;
        return (Number.isNaN(byDistance) ? 0 : byDistance) || (sortRaw === "available" ? b.availableTrucks - a.availableTrucks : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      });
    return res.json({ success: true, companies: rows });
  } catch (e) {
    return fail(res, "Catalog tow list error", e);
  }
});

router.get("/tow/companies/:id", async (req, res) => {
  try {
    const point = readPoint(req.query);
    if (typeof point === "string") return bad(res, 400, point);
    const c = await prisma.towCompanyProfile.findFirst({
      where: { id: idParam(req.params.id), verificationStatus: "APPROVED" },
      select: {
        id: true,
        companyName: true,
        city: true,
        address: true,
        description: true,
        serviceCities: true,
        workingHours: true,
        baseLat: true,
        baseLng: true,
        trucks: {
          where: { verificationStatus: "APPROVED", archivedAt: null },
          select: {
            id: true,
            truckType: true,
            maxWeightKg: true,
            make: true,
            model: true,
            year: true,
            operationalStatus: true,
            files: { select: { id: true, purpose: true, expiresAt: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!c || c.trucks.length === 0) return bad(res, 404, "Company not found.");
    // Available trucks first. No plate numbers: customers never see them.
    // a truck with an expired document is shown as not available (it cannot take new work)
    const usable = (t: (typeof c.trucks)[number]) => t.operationalStatus === "AVAILABLE" && expiredDocuments(t.files).length === 0;
    const trucks = [...c.trucks].sort((a, b) => Number(usable(b)) - Number(usable(a)));
    const agg = await prisma.towReview.aggregate({ where: { companyId: c.id }, _avg: { stars: true }, _count: { _all: true } });
    const reviews = await prisma.towReview.findMany({ where: { companyId: c.id }, orderBy: { createdAt: "desc" }, take: 20, select: { stars: true, comment: true, createdAt: true } });
    const driversCount = await prisma.towDriver.count({ where: { companyId: c.id, approval: "APPROVED", user: { status: "ACTIVE" } } });
    return res.json({
      success: true,
      company: {
        id: c.id,
        name: c.companyName,
        city: c.city,
        address: c.address,
        description: c.description,
        serviceCities: c.serviceCities,
        workingHours: c.workingHours,
        baseLat: round3(c.baseLat),
        baseLng: round3(c.baseLng),
        ...(point ? distanceTo(point, c) : {}),
        media: await publicProviderMedia("tow", c.id, trucks.map(t=>t.id)),
        approvedTrucks: trucks.length,
        availableTrucks: trucks.filter(usable).length,
        verified: true,
        driversCount,
        freeDrivers: (await freeDriversNear(null, c.id)).length,
        rating: { avg: agg._avg.stars === null ? null : Math.round(agg._avg.stars * 10) / 10, count: agg._count._all },
        reviews, // no reviewer names
      },
      trucks: trucks.map((t) => ({
        id: t.id,
        type: t.truckType,
        make: t.make,
        model: t.model,
        year: t.year,
        maxWeightKg: t.maxWeightKg,
        photoUri: t.files.find((f) => f.purpose === "TRUCK_PHOTO") ? `/files/public/${t.files.find((f) => f.purpose === "TRUCK_PHOTO")!.id}` : null,
        operationalStatus: usable(t) || t.operationalStatus !== "AVAILABLE" ? t.operationalStatus : "OUT_OF_SERVICE",
      })),
    });
  } catch (e) {
    return fail(res, "Catalog tow company error", e);
  }
});

export default router;
