// The parts catalogue: 5 groups -> 21 categories -> (for the broad ones) sub-categories. A product stores exactly ONE key,
// always a leaf (a sub-category, or a category without any); filtering a category shows its sub-categories too, each product once.
// Same keys as backend/src/catalogCategories.ts (taken from the web app's catalog.js); labels and icons are for display.

import type { Ionicons } from "@expo/vector-icons";

type IconName = keyof typeof Ionicons.glyphMap;
type Named = { en: string; ar: string; icon: IconName };

type Cat = Named & { key: string; children?: (Named & { key: string })[] };
export const CATALOG_GROUPS: (Named & { key: string; categories: Cat[] })[] = [
  {
    key: "CAR_PARTS", en: "Car parts", ar: "قطع السيارة", icon: "car-sport-outline",
    categories: [
      {
        key: "BRAKE_SYSTEM", en: "Brake system", ar: "نظام الفرامل", icon: "disc-outline",
        children: [
          { key: "BRAKE_PADS", en: "Brake pads", ar: "فحمات الفرامل", icon: "disc-outline" },
          { key: "BRAKE_DISCS", en: "Brake discs", ar: "أقراص الفرامل", icon: "disc-outline" },
        ],
      },
      {
        key: "ENGINE", en: "Engine parts", ar: "قطع المحرك", icon: "settings-outline",
        children: [
          { key: "SPARK_PLUGS", en: "Spark plugs", ar: "البواجي", icon: "flash-outline" },
          { key: "TIMING_BELTS", en: "Timing belts", ar: "أحزمة التوقيت", icon: "sync-outline" },
        ],
      },
      {
        key: "FILTERS", en: "Filters", ar: "الفلاتر", icon: "funnel-outline",
        children: [
          { key: "OIL_FILTERS", en: "Oil filters", ar: "فلاتر الزيت", icon: "funnel-outline" },
          { key: "AIR_FILTERS", en: "Air filters", ar: "فلاتر الهواء", icon: "funnel-outline" },
          { key: "CABIN_FILTERS", en: "Cabin filters", ar: "فلاتر المكيف", icon: "funnel-outline" },
        ],
      },
      { key: "SUSPENSION_STEERING", en: "Suspension & steering", ar: "التعليق والتوجيه", icon: "swap-vertical-outline" },
      {
        // the car's own electrical system; lights are under Lighting, add-on gadgets under Car electronics
        key: "ELECTRICAL", en: "Electrical", ar: "الكهرباء", icon: "battery-charging-outline",
        children: [
          { key: "BATTERIES", en: "Batteries", ar: "البطاريات", icon: "battery-full-outline" },
          { key: "ALTERNATORS_STARTERS", en: "Alternators & starters", ar: "الدينامو والسلف", icon: "flash-outline" },
          { key: "WIRING_FUSES", en: "Wiring & fuses", ar: "الأسلاك والفيوزات", icon: "git-network-outline" },
        ],
      },
      {
        key: "LIGHTING", en: "Lighting", ar: "الإضاءة", icon: "bulb-outline",
        children: [
          { key: "HEADLIGHTS", en: "Headlights", ar: "الأضواء الأمامية", icon: "bulb-outline" },
          { key: "BULBS", en: "Bulbs", ar: "اللمبات", icon: "bulb-outline" },
          { key: "FOG_LIGHTS", en: "Fog lights", ar: "أضواء الضباب", icon: "cloudy-outline" },
          { key: "TAIL_LIGHTS", en: "Tail lights", ar: "الأضواء الخلفية", icon: "bulb-outline" },
        ],
      },
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

/** Every category and sub-category (sub-categories carry their `parent`). */
export const ALL_CATEGORIES: (Named & { key: string; group: string; parent?: string; children?: Cat["children"] })[] = CATALOG_GROUPS.flatMap((g) =>
  g.categories.flatMap((c) => [{ ...c, group: g.key }, ...(c.children ?? []).map((k) => ({ ...k, group: g.key, parent: c.key }))])
);

export const findCategory = (key?: string | null) => ALL_CATEGORIES.find((c) => c.key === key) ?? null;
export const labelOf = (x: Named | null | undefined, isArabic: boolean) => (x ? (isArabic ? x.ar : x.en) : "");
