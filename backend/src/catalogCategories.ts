// The parts catalogue: 5 groups -> 21 categories -> (for the broad ones) sub-categories. A product stores exactly ONE category
// key, always a leaf: a sub-category, or a category that has none. A shop's declared specialities (signup) stay category-level.
// Filtering by a category shows itself + its sub-categories (each product once); by a sub-category only that one.
// Keys and groups come from the web app's catalog.js. Keep in sync with mobile/src/core/constants/categories.ts (same keys).

export const CATALOG_GROUPS = [
  { key: "CAR_PARTS", categories: ["BRAKE_SYSTEM", "ENGINE", "FILTERS", "SUSPENSION_STEERING", "ELECTRICAL", "LIGHTING", "BODY", "COOLING", "TRANSMISSION"] },
  { key: "OILS_FLUIDS", categories: ["ENGINE_OIL", "TRANSMISSION_FLUID", "COOLANT", "BRAKE_FLUID"] },
  { key: "TIRES_WHEELS", categories: ["TIRES", "WHEELS"] },
  { key: "ACCESSORIES", categories: ["EXTERIOR_ACCESSORIES", "CAR_ELECTRONICS", "INTERIOR_ACCESSORIES"] },
  { key: "TOOLS", categories: ["HAND_TOOLS", "JACKS_STANDS", "DIAGNOSTICS"] },
] as const;

/**
 * Sub-categories of the broad categories. LIGHTING holds everything that lights (bulbs too); ELECTRICAL is the car's own
 * electrical system (no lights); CAR_ELECTRONICS (accessories) is add-on gadgets such as dash cams. So no part fits two.
 */
export const SUBCATEGORIES: Record<string, readonly string[]> = {
  BRAKE_SYSTEM: ["BRAKE_PADS", "BRAKE_DISCS"],
  ENGINE: ["SPARK_PLUGS", "TIMING_BELTS"],
  FILTERS: ["OIL_FILTERS", "AIR_FILTERS", "CABIN_FILTERS"],
  ELECTRICAL: ["BATTERIES", "ALTERNATORS_STARTERS", "WIRING_FUSES"],
  LIGHTING: ["HEADLIGHTS", "BULBS", "FOG_LIGHTS", "TAIL_LIGHTS"],
};

export type CategoryKey = (typeof CATALOG_GROUPS)[number]["categories"][number];
export type GroupKey = (typeof CATALOG_GROUPS)[number]["key"];

/** Category level only (what shops declare as their specialities). */
export const CATEGORY_KEYS: readonly string[] = CATALOG_GROUPS.flatMap((g) => g.categories);
export const GROUP_KEYS: readonly string[] = CATALOG_GROUPS.map((g) => g.key);
const SUB_KEYS: readonly string[] = Object.values(SUBCATEGORIES).flat();
/** What a product may be filed under: sub-categories, and categories without sub-categories. */
export const PRODUCT_CATEGORY_KEYS: readonly string[] = [...CATEGORY_KEYS.filter((k) => !SUBCATEGORIES[k]), ...SUB_KEYS];

/** A category-level key (shop specialities). */
export const isCategory = (v: unknown): v is CategoryKey => typeof v === "string" && CATEGORY_KEYS.includes(v);
/** Any key a customer can filter by: category or sub-category. */
export const isAnyCategory = (v: unknown): v is string => typeof v === "string" && (CATEGORY_KEYS.includes(v) || SUB_KEYS.includes(v));
/** A key a product may store (a leaf). */
export const isProductCategory = (v: unknown): v is string => typeof v === "string" && PRODUCT_CATEGORY_KEYS.includes(v);
export const isGroup = (v: unknown): v is GroupKey => typeof v === "string" && GROUP_KEYS.includes(v);

/** The stored keys a filter matches: a category = itself (products not yet moved) + its sub-categories; a sub-category = itself. */
export const categoryFamily = (key: string): string[] => [key, ...(SUBCATEGORIES[key] ?? [])];
/** Every stored key inside a group. */
export const categoriesOfGroup = (group: string): readonly string[] => (CATALOG_GROUPS.find((g) => g.key === group)?.categories ?? []).flatMap(categoryFamily);
