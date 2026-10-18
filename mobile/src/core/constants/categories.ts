// The parts catalogue: 5 groups with 21 categories. A product stores one category key, chosen by its shop.
// Same keys as backend/src/catalogCategories.ts (taken from the web app's catalog.js); labels and icons are for display.

import type { Ionicons } from "@expo/vector-icons";

type IconName = keyof typeof Ionicons.glyphMap;
type Named = { en: string; ar: string; icon: IconName };

export const CATALOG_GROUPS: (Named & { key: string; categories: (Named & { key: string })[] })[] = [
  {
    key: "CAR_PARTS", en: "Car parts", ar: "قطع السيارة", icon: "car-sport-outline",
    categories: [
      { key: "BRAKE_SYSTEM", en: "Brake system", ar: "نظام الفرامل", icon: "disc-outline" },
      { key: "ENGINE", en: "Engine parts", ar: "قطع المحرك", icon: "settings-outline" },
      { key: "FILTERS", en: "Filters", ar: "الفلاتر", icon: "funnel-outline" },
      { key: "SUSPENSION_STEERING", en: "Suspension & steering", ar: "التعليق والتوجيه", icon: "swap-vertical-outline" },
      { key: "ELECTRICAL", en: "Electrical", ar: "الكهرباء", icon: "battery-charging-outline" },
      { key: "LIGHTING", en: "Lighting", ar: "الإضاءة", icon: "bulb-outline" },
      { key: "BODY", en: "Body parts", ar: "قطع الهيكل", icon: "car-sport-outline" },
      { key: "COOLING", en: "Cooling", ar: "التبريد", icon: "snow-outline" },
      { key: "TRANSMISSION", en: "Transmission & clutch", ar: "ناقل الحركة والقابض", icon: "cog-outline" },
    ],
  },
  {
    key: "OILS_FLUIDS", en: "Oils & fluids", ar: "الزيوت والسوائل", icon: "water-outline",
    categories: [
      { key: "ENGINE_OIL", en: "Engine oil", ar: "زيت المحرك", icon: "water-outline" },
      { key: "TRANSMISSION_FLUID", en: "Transmission fluid", ar: "زيت ناقل الحركة", icon: "beaker-outline" },
      { key: "COOLANT", en: "Coolant", ar: "سائل التبريد", icon: "thermometer-outline" },
      { key: "BRAKE_FLUID", en: "Brake fluid", ar: "زيت الفرامل", icon: "flask-outline" },
    ],
  },
  {
    key: "TIRES_WHEELS", en: "Tires & wheels", ar: "الإطارات والجنوط", icon: "ellipse-outline",
    categories: [
      { key: "TIRES", en: "Tires", ar: "الإطارات", icon: "ellipse-outline" },
      { key: "WHEELS", en: "Wheels", ar: "الجنوط", icon: "aperture-outline" },
    ],
  },
  {
    key: "ACCESSORIES", en: "Accessories & equipment", ar: "الإكسسوارات والمعدات", icon: "albums-outline",
    categories: [
      { key: "EXTERIOR_ACCESSORIES", en: "Exterior accessories", ar: "إكسسوارات خارجية", icon: "sparkles-outline" },
      { key: "CAR_ELECTRONICS", en: "Car electronics", ar: "إلكترونيات السيارة", icon: "videocam-outline" },
      { key: "INTERIOR_ACCESSORIES", en: "Interior accessories", ar: "إكسسوارات داخلية", icon: "grid-outline" },
    ],
  },
  {
    key: "TOOLS", en: "Tools", ar: "الأدوات", icon: "hammer-outline",
    categories: [
      { key: "HAND_TOOLS", en: "Hand tools", ar: "العدد اليدوية", icon: "hammer-outline" },
      { key: "JACKS_STANDS", en: "Jacks & stands", ar: "الرافعات والحوامل", icon: "construct-outline" },
      { key: "DIAGNOSTICS", en: "Diagnostics", ar: "أجهزة الفحص", icon: "speedometer-outline" },
    ],
  },
];

export const ALL_CATEGORIES = CATALOG_GROUPS.flatMap((g) => g.categories.map((c) => ({ ...c, group: g.key })));

export const findCategory = (key?: string | null) => ALL_CATEGORIES.find((c) => c.key === key) ?? null;
export const labelOf = (x: Named | null | undefined, isArabic: boolean) => (x ? (isArabic ? x.ar : x.en) : "");
