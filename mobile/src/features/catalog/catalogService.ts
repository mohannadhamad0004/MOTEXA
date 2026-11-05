// Customer catalog: REST client for the read-only /catalog endpoints (parts and tow companies).
// The server only returns what a customer may see (approved shops/companies, visible products, no plates,
// documents or contact data) and stock as a state, never an exact number.

import { api } from "../shared/api";
import { publicImageUrl } from "../../core/constants/files";
import type { Fitment } from "../parts/partsService";
import type { Operational, TruckType } from "../tow/towService";
import type { PartCondition, PartType } from "./partAttrs";

export type StockLevel = "IN" | "LOW" | "OUT";

export type CategoryCounts = { groups: { key: string; count: number; categories: { key: string; count: number; subcategories?: { key: string; count: number }[] }[] }[] };

export type CatalogShopRef = { id: string; name: string; city: string };

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description?: string | null;
  price: number;
  stock: StockLevel;
  /** units free to order (stock minus reserved, at most 99) */
  available?: number;
  category: string | null;
  condition: PartCondition;
  partType: PartType | null;
  imageUri: string | null;
  fitments: Fitment[];
  /** the shop marked it as fitting every car */
  isUniversal?: boolean;
  shop: CatalogShopRef;
  /** "was" price while a sale runs (server only sends it when it is higher than price and the sale window is open) */
  compareAtPrice?: number | null;
  warrantyMonths?: number | null;
  /** server-computed badges (catalog list + detail) */
  badges?: ProductBadge[];
};

/** DISCOUNT value = whole %, LOW_STOCK value = units left (only when 3 or fewer), CONDITION value = USED / REFURBISHED. */
export type ProductBadge = { kind: "DISCOUNT" | "SOLD_OUT" | "LOW_STOCK" | "NEW" | "CONDITION"; value?: number | string };

export type PartSort = "relevance" | "price_asc" | "price_desc" | "newest" | "discount";
export type PartsQuery = { q?: string; make?: string; model?: string; year?: string; trim?: string; shopId?: string; category?: string; group?: string; sort?: PartSort; page?: number;
  // filter sheet (see filters.ts)
  condition?: string; partType?: string; brand?: string; minPrice?: string; maxPrice?: string; inStock?: string; onSale?: string; city?: string };
export type PartsPage = { products: CatalogProduct[]; page: number; total: number; hasMore: boolean };

export type CatalogShopRow = {
  id: string;
  name: string;
  nameAr: string | null;
  brandName: string | null;
  branchName: string | null;
  city: string;
  productCount: number;
  categories: string[];
  /** business location rounded to about 110 m by the server; null when the shop has not set one */
  baseLat: number | null;
  baseLng: number | null;
  /** login-gated path of the storefront photo (use privateImageSource) */
  storefrontUri: string | null;
  /** opening hours as the shop wrote them */
  hours: string | null;
};

/** One model of the vehicle list (makes -> models -> year range), EN + AR names. */
/** A model generation ("Corolla E210"); years may overlap with the next one. photoUrl is an /api/cars/... path (CC photo, credited). */
export type GenerationRow = { id: string; code: string; nameEn: string; nameAr: string; yearFrom: number; yearTo: number; photoUrl: string | null; photoCredit: string | null; photoLicense: string | null; model3dKey: string | null };
export type VehicleRow = { make: string; makeAr: string; model: string; modelAr: string; yearFrom: number; yearTo: number; generations?: GenerationRow[] };

/** A vehicle that really appears in the fitment data of visible parts; make / model are the exact strings the parts filter expects. */
export type CatalogVehicle = { make: string; model: string; yearFrom: number; yearTo: number; partCount: number; /** engine / variant labels shops entered for this vehicle */ trims: string[] };

export type CatalogShop = {
  id: string;
  name: string;
  nameAr: string | null;
  brandName: string | null;
  branchName: string | null;
  city: string;
  address: string | null;
  /** catalogue keys */
  categories: string[];
  /** business location rounded to about 110 m by the server; null when the shop has not set one */
  baseLat: number | null;
  baseLng: number | null;
  /** login-gated path of the storefront photo (use privateImageSource) */
  storefrontUri: string | null;
  /** as the shop typed it, e.g. "Sat–Thu 08:00–18:00"; null when not set */
  workingHours?: string | null;
  /** orders: whether the owner delivers, his fee (null = agreed with the shop), where */
  delivery?: { enabled: boolean; fee: number | null; areaNote: string | null };
};

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

type MyCarRow = { make: string; model: string; year: number; color?: string | null; bodyType?: string | null; generationId?: string | null; generation?: GenerationRow | null };
export type GarageInput = { make: string; model: string; year: number; nickname?: string | null; color?: string | null; generationId?: string | null };
export type GarageCarScalar = GarageInput & { id: string; userId: string; nickname: string | null; color: string | null; generationId: string | null; isActive: boolean; lastSelectedAt: string | null; createdAt: string; updatedAt: string };
export type GarageCar = Omit<GarageCarScalar, "userId"> & { generation: GenerationRow | null };
let vehicleList: Promise<VehicleRow[]> | null = null;

/** Append a page to a list, each product once (a product can shift pages while the list is read). */
export const appendDistinct = (cur: CatalogProduct[], more: CatalogProduct[]) => {
  const seen = new Set(cur.map((p) => p.id));
  return [...cur, ...more.filter((p) => !seen.has(p.id) && seen.add(p.id))];
};

const withImage = (p: CatalogProduct): CatalogProduct => ({ ...p, imageUri: publicImageUrl(p.imageUri) });

const qs = (params: Record<string, string | number | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v).trim())}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const catalogService = {
  async getGarage(): Promise<GarageCar[]> {
    return (await api<{ success: boolean; cars: GarageCar[] }>("GET", "/catalog/garage")).cars;
  },
  async addGarageCar(input: GarageInput): Promise<GarageCarScalar> {
    return (await api<{ car: GarageCarScalar }>("POST", "/catalog/garage", input)).car;
  },
  async updateGarageCar(id: string, input: Partial<GarageInput>): Promise<GarageCarScalar> {
    return (await api<{ car: GarageCarScalar }>("PATCH", `/catalog/garage/${encodeURIComponent(id)}`, input)).car;
  },
  async deleteGarageCar(id: string): Promise<void> {
    await api("DELETE", `/catalog/garage/${encodeURIComponent(id)}`);
  },
  async activateGarageCar(id: string): Promise<GarageCarScalar> {
    return (await api<{ car: GarageCarScalar }>("POST", `/catalog/garage/${encodeURIComponent(id)}/activate`)).car;
  },
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
  /** Vehicles found in the fitment data; `q` words must each be part of the make or the model (empty q = the most covered). */
  async getVehicles(q = "") {
    return (await api<{ vehicles: CatalogVehicle[] }>("GET", `/catalog/vehicles${qs({ q })}`)).vehicles;
  },
  /** Share concurrent reads only. Each subsequent read rechecks server availability. */
  invalidateVehicleList(){vehicleList=null;},
  getVehicleList(purpose="garage") {
    if(purpose==="fitment")return api<{vehicles:VehicleRow[]}>("GET","/catalog/vehicle-list?purpose=fitment").then(r=>r.vehicles);
    vehicleList ??= api<{ vehicles: VehicleRow[] }>("GET", "/catalog/vehicle-list")
      .then((r) => r.vehicles)
      .finally(()=>{vehicleList=null;})
      .catch((e) => {
        vehicleList = null; // a failed read is retried next time
        throw e;
      });
    return vehicleList;
  },
  async getMyCar() {
    return (await api<{ car: MyCarRow | null }>("GET", "/catalog/my-car")).car;
  },
  async putMyCar(car: MyCarRow) {
    return (await api<{ car: MyCarRow }>("PUT", "/catalog/my-car", car)).car;
  },
  async deleteMyCar() {
    return (await api<{ car: MyCarRow | null }>("DELETE", "/catalog/my-car")).car;
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

/** One fitment row matches the car: make must match, model and year only when given. (Universal is not a row: see fitStatus.) */
export function fitsCar(p: { fitments: Fitment[] }, car: { make: string; model: string; year: string; trim?: string }) {
  const n = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  const year = car.year.trim() ? Number(car.year.trim()) : null;
  return p.fitments.some(
    (f) => n(f.make) === n(car.make) && (!car.model.trim() || n(f.model) === n(car.model)) && (year === null || (f.yearFrom <= year && year <= f.yearTo)) && (!car.trim?.trim() || n(f.trim ?? "") === n(car.trim))
  );
}

/**
 * Same rule as the server (backend/src/services/fitment.ts): FITS = a fitment row matches; UNIVERSAL = the shop marked it as
 * fitting every car; NOT_LISTED = it lists cars, not this one; UNKNOWN = no fitment data at all (never shown as a fit).
 */
export type FitStatus = "FITS" | "UNIVERSAL" | "NOT_LISTED" | "UNKNOWN";
export function fitStatus(p: { fitments: Fitment[]; isUniversal?: boolean }, car: { make: string; model: string; year: string; trim?: string }): FitStatus {
  if (fitsCar(p, car)) return "FITS";
  if (p.isUniversal) return "UNIVERSAL";
  return p.fitments.length ? "NOT_LISTED" : "UNKNOWN";
}
