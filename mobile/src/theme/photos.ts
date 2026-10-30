// The ONE map of customer-UI photos. Files live in mobile/assets/photos/. A key set to null shows the tasteful placeholder
// (tinted block + rounded icon). To add a photo, drop the file in assets/photos/ and replace `null` with require("..."), e.g.
//   "service.tow": require("../../assets/photos/service-tow.jpg"),
// Product / truck / storefront photos are NOT here: they are real uploads served by the API.
import { ImageSourcePropType } from "react-native";

export const PHOTO_KEYS = [
  // services (Home): 4:3, 800x600
  "service.tow",
  "service.parts",
  "service.mechanics",
  // tab heroes: 4:3, 1200x900
  "hero.parts",
  "hero.mechanics",
  "hero.tow",
  // empty states: 1:1, 600x600
  "empty.requests",
  "empty.search",
  "empty.offline",
  // catalogue groups + categories (keys from core/constants/categories.ts): 1:1, 600x600
  "category.CAR_PARTS",
  "category.OILS_FLUIDS",
  "category.TIRES_WHEELS",
  "category.ACCESSORIES",
  "category.TOOLS",
  "category.BRAKE_SYSTEM",
  "category.ENGINE",
  "category.FILTERS",
  "category.SUSPENSION_STEERING",
  "category.ELECTRICAL",
  "category.LIGHTING",
  "category.BODY",
  "category.COOLING",
  "category.TRANSMISSION",
  "category.ENGINE_OIL",
  "category.TRANSMISSION_FLUID",
  "category.COOLANT",
  "category.BRAKE_FLUID",
  "category.TIRES",
  "category.WHEELS",
  "category.EXTERIOR_ACCESSORIES",
  "category.CAR_ELECTRONICS",
  "category.INTERIOR_ACCESSORIES",
  "category.HAND_TOOLS",
  "category.JACKS_STANDS",
  "category.DIAGNOSTICS",
] as const;

export type PhotoKey = (typeof PHOTO_KEYS)[number];

export const PHOTOS: Record<PhotoKey, ImageSourcePropType | null> = {
  "service.tow": null,
  "service.parts": null,
  "service.mechanics": null,
  "hero.parts": null,
  "hero.mechanics": null,
  "hero.tow": null,
  "empty.requests": null,
  "empty.search": null,
  "empty.offline": null,
  "category.CAR_PARTS": null,
  "category.OILS_FLUIDS": null,
  "category.TIRES_WHEELS": null,
  "category.ACCESSORIES": null,
  "category.TOOLS": null,
  "category.BRAKE_SYSTEM": null,
  "category.ENGINE": null,
  "category.FILTERS": null,
  "category.SUSPENSION_STEERING": null,
  "category.ELECTRICAL": null,
  "category.LIGHTING": null,
  "category.BODY": null,
  "category.COOLING": null,
  "category.TRANSMISSION": null,
  "category.ENGINE_OIL": null,
  "category.TRANSMISSION_FLUID": null,
  "category.COOLANT": null,
  "category.BRAKE_FLUID": null,
  "category.TIRES": null,
  "category.WHEELS": null,
  "category.EXTERIOR_ACCESSORIES": null,
  "category.CAR_ELECTRONICS": null,
  "category.INTERIOR_ACCESSORIES": null,
  "category.HAND_TOOLS": null,
  "category.JACKS_STANDS": null,
  "category.DIAGNOSTICS": null,
};

/** Placeholder icon per key (Ionicons outline name). */
export const PHOTO_ICON: Partial<Record<PhotoKey, string>> = {
  "service.tow": "car-outline",
  "service.parts": "cube-outline",
  "service.mechanics": "construct-outline",
  "hero.parts": "cube-outline",
  "hero.mechanics": "construct-outline",
  "hero.tow": "car-outline",
  "empty.requests": "document-text-outline",
  "empty.search": "search-outline",
  "empty.offline": "cloud-offline-outline",
};
