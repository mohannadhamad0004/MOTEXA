// The filters of the customer's product list (the filter sheet). They live in memory for the app session, like
// "Fits my car", so they carry over between the Parts tab and the category screens.

import type { PartCondition, PartType } from "./partAttrs";

export type PartFilters = {
  conditions: PartCondition[];
  partType: PartType | null;
  brands: string[];
  minPrice: string; // typed text; "" = no bound
  maxPrice: string;
  inStock: boolean;
  city: string; // English name from shared/cities.ts; "" = any
};

export const EMPTY_FILTERS: PartFilters = { conditions: [], partType: null, brands: [], minPrice: "", maxPrice: "", inStock: false, city: "" };

export const filterMemory: { current: PartFilters } = { current: EMPTY_FILTERS };

/** Prices are typed as plain numbers: digits with an optional dot and up to 2 decimals. */
export const priceOk = (v: string) => v.trim() === "" || /^\d+(\.\d{1,2})?$/.test(v.trim());

/** What is wrong with the price range, if anything. */
export function priceProblem(f: Pick<PartFilters, "minPrice" | "maxPrice">): "invalid" | "order" | null {
  if (!priceOk(f.minPrice) || !priceOk(f.maxPrice)) return "invalid";
  if (f.minPrice.trim() && f.maxPrice.trim() && Number(f.minPrice) > Number(f.maxPrice)) return "order";
  return null;
}

/** Number of active filters, as shown on the Filters button (the price range counts once). */
export const countFilters = (f: PartFilters) =>
  f.conditions.length + (f.partType ? 1 : 0) + f.brands.length + (f.minPrice.trim() || f.maxPrice.trim() ? 1 : 0) + (f.inStock ? 1 : 0) + (f.city ? 1 : 0);

/** The query-string parameters for GET /catalog/parts. */
export function filterParams(f: PartFilters) {
  return {
    condition: f.conditions.length ? f.conditions.join(",") : undefined,
    partType: f.partType ?? undefined,
    brand: f.brands.length ? f.brands.join(",") : undefined,
    minPrice: f.minPrice.trim() || undefined,
    maxPrice: f.maxPrice.trim() || undefined,
    inStock: f.inStock ? "1" : undefined,
    city: f.city || undefined,
  };
}
