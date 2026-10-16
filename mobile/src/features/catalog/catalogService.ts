// Customer catalog: REST client for the read-only /catalog endpoints (parts and tow companies).
// The server only returns what a customer may see (approved shops/companies, visible products, no plates,
// documents or contact data) and stock as a state, never an exact number.

import { api } from "../shared/api";
import { publicImageUrl } from "../shared/files";
import type { Fitment } from "../parts/partsService";
import type { Operational, TruckType } from "../tow/towService";

export type StockLevel = "IN" | "LOW" | "OUT";

export type CatalogShopRef = { id: string; name: string; city: string };

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description?: string | null;
  price: number;
  stock: StockLevel;
  imageUri: string | null;
  fitments: Fitment[];
  shop: CatalogShopRef;
};

export type PartSort = "relevance" | "price_asc" | "price_desc" | "newest";
export type PartsQuery = { q?: string; make?: string; model?: string; year?: string; shopId?: string; sort?: PartSort; page?: number };
export type PartsPage = { products: CatalogProduct[]; page: number; total: number; hasMore: boolean };

export type CatalogShop = { id: string; name: string; city: string; address: string | null };

export type TowCompanyRow = {
  id: string;
  name: string;
  city: string;
  approvedTrucks: number;
  availableTrucks: number;
  truckTypes: TruckType[];
};

export type TowFilters = { city?: string; q?: string; truckType?: TruckType; sort?: "available" | "name"; availableOnly?: boolean };

export type TowTruck = {
  id: string;
  type: TruckType;
  make: string;
  model: string;
  year: number | null;
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
  async getPart(id: string) {
    const r = await api<{ product: CatalogProduct }>("GET", `/catalog/parts/${id}`);
    return withImage(r.product);
  },
  async getShop(id: string) {
    const r = await api<{ shop: CatalogShop; products: CatalogProduct[] }>("GET", `/catalog/shops/${id}`);
    return { shop: r.shop, products: r.products.map(withImage) };
  },
  async listTowCompanies(f: TowFilters = {}) {
    const r = await api<{ companies: TowCompanyRow[] }>("GET", `/catalog/tow/companies${qs({ ...f, availableOnly: f.availableOnly ? "1" : undefined })}`);
    return r.companies;
  },
  async getTowCompany(id: string) {
    const r = await api<{ company: Omit<TowCompanyRow, "truckTypes">; trucks: TowTruck[] }>("GET", `/catalog/tow/companies/${id}`);
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
