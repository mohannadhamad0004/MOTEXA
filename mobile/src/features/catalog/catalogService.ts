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

export type PartsQuery = { q?: string; make?: string; model?: string; year?: string; page?: number };
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
  async listTowCompanies(city?: string) {
    const r = await api<{ companies: TowCompanyRow[] }>("GET", `/catalog/tow/companies${qs({ city })}`);
    return r.companies;
  },
  async getTowCompany(id: string) {
    const r = await api<{ company: Omit<TowCompanyRow, "truckTypes">; trucks: TowTruck[] }>("GET", `/catalog/tow/companies/${id}`);
    return { company: r.company, trucks: r.trucks.map((t) => ({ ...t, photoUri: publicImageUrl(t.photoUri) })) };
  },
};

/** Last "fits my car" values, kept in memory for the current app session only. */
export const fitMemory = { make: "", model: "", year: "" };
