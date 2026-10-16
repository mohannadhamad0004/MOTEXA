import { Router } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
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

// ?q= &make= &model= &year= &shopId= &sort=relevance|price_asc|price_desc|newest &page=   (model/year need make)
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

    const norm = q ? normalizePart(q) : "";
    const year = yearRaw ? Number(yearRaw) : null;
    const where: Prisma.PartsProductWhereInput = {
      ...visible,
      ...(shopId ? { shopId } : {}),
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

router.get("/parts/:id", async (req, res) => {
  try {
    const p = await prisma.partsProduct.findFirst({ where: { id: idParam(req.params.id), ...visible }, include: productInclude });
    if (!p) return bad(res, 404, "Product not found.");
    return res.json({ success: true, product: shapeProduct(p, true) });
  } catch (e) {
    return fail(res, "Catalog part error", e);
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
const TOW_SORTS = ["available", "name"] as const;

// ?city= &q= (company name) contains, case-insensitive. ?truckType= at least one APPROVED truck of that type.
// ?availableOnly=1 at least one AVAILABLE truck. ?sort=available (default: most available trucks, then name) | name.
// Only APPROVED companies; counts only APPROVED trucks.
router.get("/tow/companies", async (req, res) => {
  try {
    const city = text(req.query.city, 60);
    const q = text(req.query.q, 100);
    const truckTypeRaw = typeof req.query.truckType === "string" ? req.query.truckType : "";
    if (truckTypeRaw && !TRUCK_TYPES.includes(truckTypeRaw as never)) return bad(res, 400, `truckType must be one of: ${TRUCK_TYPES.join(", ")}.`);
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "available";
    if (!TOW_SORTS.includes(sortRaw as never)) return bad(res, 400, `sort must be one of: ${TOW_SORTS.join(", ")}.`);
    const availableOnly = req.query.availableOnly === "1" || req.query.availableOnly === "true";

    const companies = await prisma.towCompanyProfile.findMany({
      where: {
        verificationStatus: "APPROVED",
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...(q ? { companyName: { contains: q, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        companyName: true,
        city: true,
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
        approvedTrucks: c.trucks.length,
        availableTrucks: c.trucks.filter((t) => t.operationalStatus === "AVAILABLE").length,
        truckTypes: [...new Set(c.trucks.map((t) => t.truckType))],
      }))
      .filter((c) => !availableOnly || c.availableTrucks > 0)
      .sort((a, b) => (sortRaw === "available" ? b.availableTrucks - a.availableTrucks : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return res.json({ success: true, companies: rows });
  } catch (e) {
    return fail(res, "Catalog tow list error", e);
  }
});

router.get("/tow/companies/:id", async (req, res) => {
  try {
    const c = await prisma.towCompanyProfile.findFirst({
      where: { id: idParam(req.params.id), verificationStatus: "APPROVED" },
      select: {
        id: true,
        companyName: true,
        city: true,
        trucks: {
          where: { verificationStatus: "APPROVED" },
          select: {
            id: true,
            truckType: true,
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
        approvedTrucks: trucks.length,
        availableTrucks: trucks.filter((t) => t.operationalStatus === "AVAILABLE").length,
      },
      trucks: trucks.map((t) => ({
        id: t.id,
        type: t.truckType,
        make: t.make,
        model: t.model,
        year: t.year,
        photoUri: t.files[0] ? `/files/public/${t.files[0].id}` : null,
        operationalStatus: t.operationalStatus,
      })),
    });
  } catch (e) {
    return fail(res, "Catalog tow company error", e);
  }
});

export default router;
