// ONE config per provider role (tow company / parts shop), the way departments.ts is one config per department. The tab shell,
// Home and Fleet read only this file: tabs (EN/AR, icons), the hero (clip key, label, primary action), the Home numbers and the
// shortcut list. Real numbers only: every value comes from GET /<area>/me/portal/summary.
import type { GIconName } from "../../components/garage/text";
import type { HeroTab } from "../../components/garage/MoClip";
import { providerLinks } from "../provider/portal/navigation";
import type { ProviderArea } from "../provider/portal/types";

export type HubTab = { name: string; en: string; ar: string; icon: GIconName; iconOn: GIconName };
export type HubStat = { en: string; ar: string; icon: GIconName; value: (m: Record<string, number>) => number; path: string; warn?: boolean };
export type HubConfig = {
  area: ProviderArea;
  /** which Mo clip the hero plays (a key of HERO_CLIPS: the same clips the customer tabs use) */
  hero: HeroTab;
  eyebrow: { en: string; ar: string };
  tabs: HubTab[];
  stats: HubStat[];
  /** the hero's one pill */
  action: { en: string; ar: string; icon: GIconName; path: string };
  /** hero data line, from the summary (null = leave the line out) */
  line: (m: Record<string, number>, t: (en: string, ar: string) => string) => string | null;
  /** portal links that are NOT a tab: Home lists them so every existing screen stays reachable */
  more: { path: string; icon: GIconName }[];
};

const base = (area: ProviderArea) => `/provider/${area}`;

export const HUB: Record<ProviderArea, HubConfig> = {
  tow: {
    area: "tow",
    hero: "tow",
    eyebrow: { en: "Tow company", ar: "شركة السحب" },
    tabs: [
      { name: "index", en: "Home", ar: "الرئيسية", icon: "home-outline", iconOn: "home" },
      { name: "jobs", en: "Jobs", ar: "المهام", icon: "clipboard-outline", iconOn: "clipboard" },
      { name: "fleet", en: "Fleet", ar: "الأسطول", icon: "car-outline", iconOn: "car" },
      { name: "messages", en: "Messages", ar: "الرسائل", icon: "chatbubbles-outline", iconOn: "chatbubbles" },
      { name: "profile", en: "Profile", ar: "الملف", icon: "person-outline", iconOn: "person" },
    ],
    stats: [
      { en: "Open jobs", ar: "مهام مفتوحة", icon: "clipboard-outline", value: (m) => (m.newRequests ?? 0) + (m.activeJobs ?? 0), path: `${base("tow")}/jobs`, warn: true },
      { en: "Active trucks", ar: "شاحنات فعّالة", icon: "car-outline", value: (m) => m.approvedTrucks ?? 0, path: `${base("tow")}/fleet` },
      { en: "Drivers", ar: "السائقون", icon: "people-outline", value: (m) => m.drivers ?? 0, path: `${base("tow")}/fleet` },
      { en: "Completed today", ar: "مكتملة اليوم", icon: "checkmark-done-outline", value: (m) => m.completedToday ?? 0, path: `${base("tow")}/history` },
    ],
    action: { en: "Open jobs", ar: "فتح المهام", icon: "clipboard-outline", path: `${base("tow")}/jobs` },
    line: (m, t) => (m.newRequests ? t(`${m.newRequests} new ${m.newRequests === 1 ? "request" : "requests"} need an answer`, `${m.newRequests} طلبات جديدة بانتظار ردّك`) : null),
    more: [
      { path: "active", icon: "navigate-outline" }, { path: "history", icon: "time-outline" }, { path: "live", icon: "map-outline" },
      { path: "availability", icon: "toggle-outline" }, { path: "service-area", icon: "locate-outline" }, { path: "media", icon: "images-outline" },
      { path: "preview", icon: "eye-outline" }, { path: "settings", icon: "settings-outline" },
    ],
  },
  parts: {
    area: "parts",
    hero: "parts",
    eyebrow: { en: "Parts shop", ar: "متجر القطع" },
    tabs: [
      { name: "index", en: "Home", ar: "الرئيسية", icon: "home-outline", iconOn: "home" },
      { name: "products", en: "Products", ar: "المنتجات", icon: "cube-outline", iconOn: "cube" },
      { name: "orders", en: "Orders", ar: "الطلبات", icon: "receipt-outline", iconOn: "receipt" },
      { name: "messages", en: "Messages", ar: "الرسائل", icon: "chatbubbles-outline", iconOn: "chatbubbles" },
      { name: "profile", en: "Profile", ar: "الملف", icon: "person-outline", iconOn: "person" },
    ],
    stats: [
      { en: "Products", ar: "المنتجات", icon: "cube-outline", value: (m) => m.products ?? 0, path: `${base("parts")}/products` },
      { en: "Sold out", ar: "نفدت", icon: "alert-circle-outline", value: (m) => m.outOfStock ?? 0, path: `${base("parts")}/inventory`, warn: true },
      { en: "Low stock", ar: "مخزون منخفض", icon: "trending-down-outline", value: (m) => m.lowStock ?? 0, path: `${base("parts")}/inventory` },
      { en: "Pending orders", ar: "طلبات قيد التنفيذ", icon: "receipt-outline", value: (m) => m.pendingOrders ?? 0, path: `${base("parts")}/orders` },
    ],
    action: { en: "Add product", ar: "إضافة منتج", icon: "add-circle-outline", path: `${base("parts")}/new` },
    line: (m, t) => (m.missingPhotos ? t(`${m.missingPhotos} ${m.missingPhotos === 1 ? "product needs" : "products need"} a real photo`, `${m.missingPhotos} منتجات بحاجة إلى صورة حقيقية`) : null),
    more: [
      { path: "3d", icon: "cube-outline" }, { path: "3d/submissions", icon: "layers-outline" }, { path: "inventory", icon: "file-tray-stacked-outline" },
      { path: "fitment", icon: "git-compare-outline" }, { path: "categories", icon: "grid-outline" }, { path: "inquiries", icon: "help-circle-outline" },
      { path: "media", icon: "images-outline" }, { path: "preview", icon: "eye-outline" }, { path: "analytics", icon: "stats-chart-outline" },
      { path: "delivery", icon: "bicycle-outline" }, { path: "settings", icon: "settings-outline" },
    ],
  },
};

/** label of a portal link (EN/AR) from the shared navigation list */
export const linkLabel = (area: ProviderArea, path: string) => providerLinks[area].find((l) => l.path === path) ?? { path, en: path, ar: path };
