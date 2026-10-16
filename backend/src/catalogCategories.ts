// The parts catalogue: 5 groups with 21 categories. A product stores one category key, chosen by its shop.
// Keys and groups come from the web app's catalog.js (without its name-matching subcategories).
// Keep in sync with mobile/src/features/shared/categories.ts (same keys).

export const CATALOG_GROUPS = [
  { key: "CAR_PARTS", categories: ["BRAKE_SYSTEM", "ENGINE", "FILTERS", "SUSPENSION_STEERING", "ELECTRICAL", "LIGHTING", "BODY", "COOLING", "TRANSMISSION"] },
  { key: "OILS_FLUIDS", categories: ["ENGINE_OIL", "TRANSMISSION_FLUID", "COOLANT", "BRAKE_FLUID"] },
  { key: "TIRES_WHEELS", categories: ["TIRES", "WHEELS"] },
  { key: "ACCESSORIES", categories: ["EXTERIOR_ACCESSORIES", "CAR_ELECTRONICS", "INTERIOR_ACCESSORIES"] },
  { key: "TOOLS", categories: ["HAND_TOOLS", "JACKS_STANDS", "DIAGNOSTICS"] },
] as const;

export type CategoryKey = (typeof CATALOG_GROUPS)[number]["categories"][number];
export type GroupKey = (typeof CATALOG_GROUPS)[number]["key"];

export const CATEGORY_KEYS: readonly string[] = CATALOG_GROUPS.flatMap((g) => g.categories);
export const GROUP_KEYS: readonly string[] = CATALOG_GROUPS.map((g) => g.key);

export const isCategory = (v: unknown): v is CategoryKey => typeof v === "string" && CATEGORY_KEYS.includes(v);
export const isGroup = (v: unknown): v is GroupKey => typeof v === "string" && GROUP_KEYS.includes(v);
export const categoriesOfGroup = (group: string): readonly string[] => CATALOG_GROUPS.find((g) => g.key === group)?.categories ?? [];
