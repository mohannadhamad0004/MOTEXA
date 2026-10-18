// Customer catalog: REST client for the read-only /catalog endpoints (parts and tow companies).
// The server only returns what a customer may see (approved shops/companies, visible products, no plates,
// documents or contact data) and stock as a state, never an exact number.

import { api } from "../shared/api";
import { publicImageUrl } from "../../core/constants/files";
import type { Fitment } from "../parts/partsService";
import type { Operational, TruckType } from "../tow/towService";
import type { PartCondition, PartType } from "./partAttrs";

export type StockLevel = "IN" | "LOW" | "OUT";

export type CategoryCounts = { groups: { key: string; count: number; categories: { key: string; count: number }[] }[] };

export type CatalogShopRef = { id: string; name: string; city: string };

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description?: string | null;
  price: number;
  stock: StockLevel;
  category: string | null;
  condition: PartCondition;
  partType: PartType | null;
  imageUri: string | null;
  fitments: Fitment[];
  shop: CatalogShopRef;
};

export type PartSort = "relevance" | "price_asc" | "price_desc" | "newest";
export type PartsQuery = { q?: string; make?: string; model?: string; year?: string; shopId?: string; category?: string; group?: string; sort?: PartSort; page?: number;
  // filter sheet (see filters.ts)
  condition?: string; partType?: string; brand?: string; minPrice?: string; maxPrice?: string; inStock?: string; city?: string };
export type PartsPage = { products: CatalogProduct[]; page: number; total: number; hasMore: boolean };

export type CatalogShopRow = { id: string; name: string; city: string; productCount: number };

export type CatalogShop = { id: string; name: string; city: string; address: string | null };

export type TowCompanyRow = {
  id: string;
  name: string;
  city: string;
  serviceCities: string[];
  workingHours: string | null;
  /** business location, rounded to about 110 m by the server; null when the company has not set one */
  baseLat: number | null;
  baseLng: number | null;
  /** only with a position: straight-line km from the company's base point ("base") or from its city centre ("city") */
  distanceKm?: number | null;
  distanceSource?: "base" | "city" | null;
  approvedTrucks: number;
  availableTrucks: number;
  truckTypes: TruckType[];
};

/** The company page adds the fields the list leaves out. */
export type TowCompanyDetail = Omit<TowCompanyRow, "truckTypes"> & { address: string | null; description: string | null };

export type TowFilters = { city?: string; serviceCity?: string; q?: string; truckType?: TruckType; sort?: "nearest" | "available" | "name"; availableOnly?: boolean; lat?: number; lng?: number };

export type TowTruck = {
  id: string;
  type: TruckType;
  make: string;
  model: string;
  year: number | null;
  maxWeightKg: number | null;
  photoUri: string | null;
  operationalStatus: Operational;
};

const withImage = (p: CatalogProduct): CatalogProduct => ({ ...p, imageUri: publicImageUrl(p.imageUri) });

const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v).trim())}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const catalogService = {
  async searchParts(query: PartsQuery): Promise<PartsPage> {
    const r = await api<PartsPage>("GET", `/catalog/parts${qs({ ...query })}`);
    return { ...r, products: r.products.map(withImage) };
  },
  /** Brands that really exist among the visible products (optionally within one category or group). */
  async getBrands(f: { category?: string; group?: string } = {}) {
    return (await api<{ brands: string[] }>("GET", `/catalog/brands${qs({ ...f })}`)).brands;
  },
  /** Real counts of the products a customer can see, per group and category (zero is included). */
  async getCategories() {
    return (await api<CategoryCounts & { success: boolean }>("GET", "/catalog/categories")).groups;
  },
  async getPart(id: string) {
    const r = await api<{ product: CatalogProduct }>("GET", `/catalog/parts/${id}`);
    return withImage(r.product);
  },
  /** Approved shops, busiest first: name, city and the number of parts a customer can see. */
  async getShops() {
    return (await api<{ shops: CatalogShopRow[] }>("GET", "/catalog/shops")).shops;
  },
  async getShop(id: string) {
    const r = await api<{ shop: CatalogShop; products: CatalogProduct[] }>("GET", `/catalog/shops/${id}`);
    return { shop: r.shop, products: r.products.map(withImage) };
  },
  async listTowCompanies(f: TowFilters = {}) {
    const r = await api<{ companies: TowCompanyRow[] }>("GET", `/catalog/tow/companies${qs({ ...f, availableOnly: f.availableOnly ? "1" : undefined })}`);
    return r.companies;
  },
  async getTowCompany(id: string, from?: { lat: number; lng: number } | null) {
    const r = await api<{ company: TowCompanyDetail; trucks: TowTruck[] }>("GET", `/catalog/tow/companies/${id}${qs({ lat: from?.lat, lng: from?.lng })}`);
    return { company: r.company, trucks: r.trucks.map((t) => ({ ...t, photoUri: publicImageUrl(t.photoUri) })) };
  },
};

/** Last "fits my car" values, kept in memory for the current app session only. */
export const fitMemory = { make: "", model: "", year: "" };

/** Same rule as the server's fitment filter: make must match, model and year only when given. */
export function fitsCar(p: { fitments: Fitment[] }, car: { make: string; model: string; year: string }) {
  const n = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  const year = car.year.trim() ? Number(car.year.trim()) : null;
  return p.fitments.some(
    (f) => n(f.make) === n(car.make) && (!car.model.trim() || n(f.model) === n(car.model)) && (year === null || (f.yearFrom <= year && year <= f.yearTo))
  );
}

/** The car from "Fits my car", or null when none (or an invalid year) is set. */
export function currentCar() {
  const { make, model, year } = fitMemory;
  if (!make.trim()) return null;
  if (year.trim() && !/^\d{4}$/.test(year.trim())) return null;
  return { make, model, year };
}
