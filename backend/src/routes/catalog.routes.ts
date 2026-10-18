import { Router } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { CATALOG_GROUPS, categoriesOfGroup, isCategory, isGroup } from "../catalogCategories.js";
import { SERVICE_CITIES, canonicalCity } from "../cities.js";
import { GEO_BOX_MESSAGE, cityCentre, haversineKm, inBox, round3 } from "../geo.js";
import { CONDITIONS, PART_TYPES } from "../partAttributes.js";
import { requireAuth } from "../middleware/auth.middleware.js";

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

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
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
const visible: Prisma.PartsProductWhereInput = { isHidden: false, shop: { verificationStatus: "APPROVED" } };

const productInclude = {
  files: { where: { purpose: "PRODUCT_IMAGE" as const } },
  fitments: { orderBy: { position: "asc" as const } },
  shop: { select: { id: true, shopName: true, city: true } },
};
type ProductRow = Prisma.PartsProductGetPayload<{ include: typeof productInclude }>;

const shapeProduct = (p: ProductRow, withDescription = false) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  partNumber: p.partNumber,
  ...(withDescription ? { description: p.description } : {}),
  price: Number(p.price),
  stock: stockState(p.stock),
  category: p.category,
  condition: p.condition,
  partType: p.partType,
  imageUri: p.files[0] ? `/files/public/${p.files[0].id}` : null,
  fitments: p.fitments.map((f) => ({ make: f.make, model: f.model, yearFrom: f.yearFrom, yearTo: f.yearTo, ...(f.trim ? { trim: f.trim } : {}) })),
  shop: { id: p.shop.id, name: p.shop.shopName, city: p.shop.city },
});

const PART_SORTS = ["relevance", "price_asc", "price_desc", "newest"] as const;
type PartSort = (typeof PART_SORTS)[number];
type SortRow = { id: string; name: string; stock: number; price: Prisma.Decimal; createdAt: Date };
/** Every order ends with name, then id, so pages never overlap or skip when prices or dates tie. */
const PART_ORDER: Record<PartSort, (a: SortRow, b: SortRow) => number> = {
  relevance: (a, b) => Number(b.stock > 0) - Number(a.stock > 0),
  price_asc: (a, b) => Number(a.price) - Number(b.price),
  price_desc: (a, b) => Number(b.price) - Number(a.price),
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
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
//   &condition=NEW,USED  &partType=OEM|AFTERMARKET  &brand=Bosch,Mann  &minPrice= &maxPrice=  &inStock=1  &city=Nablus (shop city, from the city list)
router.get("/parts", async (req, res) => {
  try {
    const q = text(req.query.q, 100);
    const make = text(req.query.make, 60);
    const model = text(req.query.model, 60);
    const yearRaw = typeof req.query.year === "string" ? req.query.year : "";
    if ((model || yearRaw) && !make) return bad(res, 400, "make is required when model or year is given.");
    if (yearRaw && !/^\d{4}$/.test(yearRaw)) return bad(res, 400, "year must be a 4-digit number.");
    const pageRaw = typeof req.query.page === "string" ? req.query.page : "1";
    const page = Number(pageRaw);
    if (!/^\d+$/.test(pageRaw) || page < 1 || page > 10_000) return bad(res, 400, "page must be a positive whole number.");

    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "relevance";
    if (!PART_SORTS.includes(sortRaw as PartSort)) return bad(res, 400, `sort must be one of: ${PART_SORTS.join(", ")}.`);
    const sort = sortRaw as PartSort;
    const shopId = text(req.query.shopId, 64);
    const category = typeof req.query.category === "string" ? req.query.category : "";
    if (category && !isCategory(category)) return bad(res, 400, "Unknown category.");
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
    if (city) and.push({ shop: { city: { equals: city, mode: "insensitive" } } });
    const where: Prisma.PartsProductWhereInput = {
      ...visible,
      ...(shopId ? { shopId } : {}),
      ...(category ? { category } : {}),
      ...(and.length ? { AND: and } : {}),
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
      ...(make
        ? {
            fitments: {
              some: {
                makeNormalized: normText(make),
                ...(model ? { modelNormalized: normText(model) } : {}),
                ...(year !== null ? { yearFrom: { lte: year }, yearTo: { gte: year } } : {}),
              },
            },
          }
        : {}),
    };

    // ponytail: ids are sorted in memory (default: in stock first, then name) because Prisma can't order by "stock > 0".
    // Fine for a catalog of thousands; switch to a raw ORDER BY (stock > 0) DESC, name when it grows.
    const all = await prisma.partsProduct.findMany({ where, select: { id: true, name: true, stock: true, price: true, createdAt: true } });
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
    if (category && !isCategory(category)) return bad(res, 400, "Unknown category.");
    const group = typeof req.query.group === "string" ? req.query.group : "";
    if (group && !isGroup(group)) return bad(res, 400, "Unknown group.");
    const rows = await prisma.partsProduct.findMany({
      where: { ...visible, ...(category ? { category } : {}), ...(group ? { AND: [{ category: { in: [...categoriesOfGroup(group)] } }] } : {}) },
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
      const categories = g.categories.map((key) => ({ key, count: count.get(key) ?? 0 }));
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
      select: { id: true, shopName: true, city: true, _count: { select: { products: { where: { isHidden: false } } } } },
    });
    const list = shops
      .map((s) => ({ id: s.id, name: s.shopName, city: s.city, productCount: s._count.products }))
      .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return res.json({ success: true, shops: list });
  } catch (e) {
    return fail(res, "Catalog shops error", e);
  }
});

router.get("/shops/:id", async (req, res) => {
  try {
    const s = await prisma.partsShopProfile.findFirst({
      where: { id: idParam(req.params.id), verificationStatus: "APPROVED" },
      select: { id: true, shopName: true, city: true, address: true },
    });
    if (!s) return bad(res, 404, "Shop not found.");
    const products = await prisma.partsProduct.findMany({ where: { shopId: s.id, isHidden: false }, include: productInclude, orderBy: { name: "asc" }, take: 100 });
    return res.json({
      success: true,
      shop: { id: s.id, name: s.shopName, city: s.city, address: s.address },
      products: products.map((p) => shapeProduct(p)),
    });
  } catch (e) {
    return fail(res, "Catalog shop error", e);
  }
});

// ---- tow ----

const TRUCK_TYPES = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"] as const;
const TOW_SORTS = ["available", "name", "nearest"] as const;

/** ?lat=&lng= (both or none), plain numbers inside the accepted area. null = not given, string = error message. */
function readPoint(query: any): { lat: number; lng: number } | null | string {
  const { lat, lng } = query;
  if (lat === undefined && lng === undefined) return null;
  const isNum = (v: unknown) => typeof v === "string" && /^-?\d{1,3}(\.\d{1,10})?$/.test(v.trim());
  if (!isNum(lat) || !isNum(lng)) return "lat and lng must both be given, as plain numbers.";
  const p = { lat: Number(lat), lng: Number(lng) };
  return inBox(p.lat, p.lng) ? p : GEO_BOX_MESSAGE;
}

/** Straight-line distance from `from` to a company: from its base point, else from the centre of its city. */
function distanceTo(from: { lat: number; lng: number }, c: { city: string; baseLat: number | null; baseLng: number | null }) {
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
        trucks: { where: { verificationStatus: "APPROVED" }, select: { truckType: true, operationalStatus: true } },
      },
    });
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
        approvedTrucks: c.trucks.length,
        availableTrucks: c.trucks.filter((t) => t.operationalStatus === "AVAILABLE").length,
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
          where: { verificationStatus: "APPROVED" },
          select: {
            id: true,
            truckType: true,
            maxWeightKg: true,
            make: true,
            model: true,
            year: true,
            operationalStatus: true,
            files: { where: { purpose: "TRUCK_PHOTO" }, select: { id: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!c || c.trucks.length === 0) return bad(res, 404, "Company not found.");
    // Available trucks first. No plate numbers: customers never see them.
    const trucks = [...c.trucks].sort((a, b) => Number(b.operationalStatus === "AVAILABLE") - Number(a.operationalStatus === "AVAILABLE"));
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
        approvedTrucks: trucks.length,
        availableTrucks: trucks.filter((t) => t.operationalStatus === "AVAILABLE").length,
      },
      trucks: trucks.map((t) => ({
        id: t.id,
        type: t.truckType,
        make: t.make,
        model: t.model,
        year: t.year,
        maxWeightKg: t.maxWeightKg,
        photoUri: t.files[0] ? `/files/public/${t.files[0].id}` : null,
        operationalStatus: t.operationalStatus,
      })),
    });
  } catch (e) {
    return fail(res, "Catalog tow company error", e);
  }
});

export default router;
