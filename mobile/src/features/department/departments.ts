// ONE config per department. The department screens (Home, Requests, Directory, Review) read only this file: titles (EN/AR), icon,
// hero image, stat tiles, how the lists are loaded, the approval checklists and which backend calls decide. Add a department here and
// it shows up in every screen. Real data only: every number and row comes from the backend.
import type { Ionicons } from "@expo/vector-icons";
import type { ImageSourcePropType } from "react-native";
import { api } from "../../core/config/api";
import { cityLabel } from "../../core/constants/cities";
import { partsAdminService } from "../parts/partsService";
import type { Shop } from "../parts/partsService";
import { towAdminService } from "../tow/towService";
import type { TowCompany, Truck, TruckType } from "../tow/towService";
import type { Kind as ProviderKind } from "../provider/api";

type IconName = keyof typeof Ionicons.glyphMap;
export type DeptKey = "MANAGE_TOWING" | "MANAGE_SPARE_PARTS" | "MANAGE_MECHANICS";
/** What a review route can open. `mechanic` is handled by Diala's review screen (no route of ours). */
export type ReviewKind = "company" | "truck" | "shop" | "mechanic";
export type Status = "DRAFT" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
export type T = (en: string, ar: string) => string;

/** One line of a list, already shaped for display. */
export type Row = {
  id: string;
  kind: ReviewKind;
  title: string;
  subtitle: string;
  meta: string[];
  status?: Status;
  /** pending trucks of a company, shown under it in the directory */
  children?: Row[];
};

export type CheckItem = { ok: boolean; label: string; hint?: string; blocking?: boolean };

export type StatTile = { key: string; icon: IconName; en: string; ar: string; warn?: boolean };

export type Dept = {
  key: DeptKey;
  icon: IconName;
  en: string;
  ar: string;
  blurbEn: string;
  blurbAr: string;
  /** photo hero of Home (assets already shipped with the super admin UI) */
  hero: ImageSourcePropType;
  /** DashboardPhotography index used on cards (1 mechanics, 2 parts, 3 towing) */
  photo: number;
  /** backend routes used by this department (documentation + decisions) */
  endpoints: { stats: string; list: string[]; decide: string[] };
  stats: StatTile[];
  loadStats: () => Promise<Record<string, number>>;
  /** which provider applications this department reviews (tow / parts); null for mechanics */
  provider: ProviderKind | null;
  /** applications = the New / Needs changes / Approved / Rejected tabs; screen = Diala's review screen (mechanics) */
  requests: { mode: "applications" } | { mode: "screen" };
  directory: { titleEn: string; titleAr: string; emptyEn: string; emptyAr: string; searchEn: string; searchAr: string; load: (t: T) => Promise<Row[]> };
  /** what the review route can open for this department, and the approval checklists */
  review: { kinds: ReviewKind[] };
  /** shortcut cards on Home */
  shortcuts: { id: "requests" | "directory"; en: string; ar: string; descEn: string; descAr: string; icon: IconName; photo: number }[];
};

const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };

export const truckTypeLabel = (t: T, k: TruckType) =>
  ({
    FLATBED: t("Flatbed", "سطحة"),
    HOOK_CHAIN: t("Hook & chain", "خطاف وسلسلة"),
    WHEEL_LIFT: t("Wheel lift", "رافعة عجلات"),
    HEAVY_DUTY: t("Heavy duty", "خدمة ثقيلة"),
  })[k];

const ltr = (v: string) => "⁦" + v + "⁩";

// ---------- towing ----------
const companyRow = (t: T, c: TowCompany & { truckCount?: number; pendingTruckCount?: number }): Row => ({
  id: c.id,
  kind: "company",
  title: c.name,
  subtitle: [c.contactName, t(cityLabel(c.city, false), cityLabel(c.city, true))].filter(Boolean).join(" · "),
  meta: [
    typeof c.truckCount === "number" ? `${c.truckCount} ${c.truckCount === 1 ? t("truck", "شاحنة") : t("trucks", "شاحنات")}` : "",
    c.pendingTruckCount ? `${t("Pending trucks", "شاحنات قيد المراجعة")}: ${c.pendingTruckCount}` : "",
  ].filter(Boolean),
  status: c.verification,
});

const truckRow = (t: T, tr: Truck, company?: string): Row => ({
  id: tr.id,
  kind: "truck",
  title: `${truckTypeLabel(t, tr.type)} · ${ltr(tr.plate)}`,
  subtitle: [company, [tr.make, tr.model, tr.year].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
  meta: [`${tr.documents.length} ${t("documents", "مستندات")}`, tr.photoUri ? t("photo added", "الصورة مضافة") : t("no photo", "بلا صورة")],
  status: tr.verification,
});

const towing: Dept = {
  key: "MANAGE_TOWING",
  icon: "car-outline",
  en: "Towing",
  ar: "السحب",
  blurbEn: "Tow companies and their trucks",
  blurbAr: "شركات السحب وشاحناتها",
  hero: require("../../../assets/images/motexa-mercedes-coastal.png"),
  photo: 3,
  endpoints: {
    stats: "GET /admin/tow/stats",
    list: ["GET /admin/tow/companies", "GET /admin/tow/trucks", "GET /admin/tow/companies/:id"],
    decide: ["PATCH /admin/tow/companies/:id/decision", "PATCH /admin/tow/trucks/:id/decision"],
  },
  stats: [
    { key: "pendingCompanies", icon: "business-outline", en: "New applications", ar: "طلبات جديدة", warn: true },
    { key: "needsChanges", icon: "create-outline", en: "Needs changes", ar: "بانتظار التعديل" },
    { key: "approvedCompanies", icon: "shield-checkmark-outline", en: "Approved companies", ar: "شركات معتمدة" },
  ],
  loadStats: async () => (await api<{ stats: Record<string, number> }>("GET", "/admin/tow/stats")).stats,
  provider: "TOW",
  requests: { mode: "applications" },
  directory: {
    titleEn: "Tow companies",
    titleAr: "شركات السحب",
    emptyEn: "No tow companies yet.",
    emptyAr: "لا توجد شركات سحب بعد.",
    searchEn: "Company, plate or truck type",
    searchAr: "الشركة أو اللوحة أو نوع الشاحنة",
    load: async (t) => {
      const [companies, trucks] = await Promise.all([towAdminService.listCompanies(NOACTOR), towAdminService.listTrucks(NOACTOR)]);
      return companies.map((c) => ({ ...companyRow(t, c), children: trucks.filter((tr) => tr.companyId === c.id).map((tr) => truckRow(t, tr)) }));
    },
  },
  review: { kinds: ["company", "truck"] },
  shortcuts: [
    { id: "requests", en: "Review requests", ar: "مراجعة الطلبات", descEn: "Applications waiting for a decision", descAr: "طلبات بانتظار القرار", icon: "clipboard-outline", photo: 3 },
    { id: "directory", en: "Tow companies", ar: "شركات السحب", descEn: "Every company with its trucks and documents", descAr: "كل شركة مع شاحناتها ومستنداتها", icon: "business-outline", photo: 1 },
  ],
};

// ---------- spare parts ----------
const shopRow = (s: Shop): Row => ({
  id: s.id,
  kind: "shop",
  title: s.name,
  subtitle: [s.ownerName, s.city].filter(Boolean).join(" · "),
  meta: [],
  status: s.verification,
});

const parts: Dept = {
  key: "MANAGE_SPARE_PARTS",
  icon: "storefront-outline",
  en: "Spare parts",
  ar: "قطع الغيار",
  blurbEn: "Parts shops and their listings",
  blurbAr: "متاجر قطع الغيار ومنتجاتها",
  hero: require("../../../assets/images/motexa-administration-office.png"),
  photo: 2,
  endpoints: {
    stats: "GET /admin/parts/stats",
    list: ["GET /admin/parts/shops", "GET /admin/parts/shops/:id"],
    decide: ["PATCH /admin/parts/shops/:id/decision", "PATCH /admin/parts/products/:id/visibility"],
  },
  stats: [
    { key: "pendingShops", icon: "storefront-outline", en: "New applications", ar: "طلبات جديدة", warn: true },
    { key: "needsChanges", icon: "create-outline", en: "Needs changes", ar: "بانتظار التعديل" },
    { key: "approvedShops", icon: "shield-checkmark-outline", en: "Approved shops", ar: "متاجر معتمدة" },
  ],
  loadStats: async () => (await api<{ stats: Record<string, number> }>("GET", "/admin/parts/stats")).stats,
  provider: "PARTS",
  requests: { mode: "applications" },
  directory: {
    titleEn: "Parts shops",
    titleAr: "متاجر قطع الغيار",
    emptyEn: "No parts shops yet.",
    emptyAr: "لا توجد متاجر بعد.",
    searchEn: "Shop, owner or city",
    searchAr: "المتجر أو المالك أو المدينة",
    load: async () => (await partsAdminService.listShops(NOACTOR)).map(shopRow),
  },
  review: { kinds: ["shop"] },
  shortcuts: [
    { id: "requests", en: "Review requests", ar: "مراجعة الطلبات", descEn: "Applications waiting for a decision", descAr: "طلبات بانتظار القرار", icon: "clipboard-outline", photo: 2 },
    { id: "directory", en: "Parts shops", ar: "متاجر قطع الغيار", descEn: "Every shop with its products (hide or show)", descAr: "كل متجر مع منتجاته (إخفاء أو إظهار)", icon: "storefront-outline", photo: 1 },
  ],
};

// ---------- mechanics (Diala's review screen is shown for Requests) ----------
type MechanicListItem = { id: string; userId: string; city: string | null; specializations: string[]; user: { fullName: string; email: string } };

const mechanics: Dept = {
  key: "MANAGE_MECHANICS",
  icon: "construct-outline",
  en: "Mechanics",
  ar: "الميكانيكيون",
  blurbEn: "Mechanic applications and accounts",
  blurbAr: "طلبات الميكانيكيين وحساباتهم",
  hero: require("../../../assets/images/motexa-workspace-garage.png"),
  photo: 1,
  endpoints: {
    stats: "GET /mechanics/admin (counts)",
    list: ["GET /mechanics/admin", "GET /mechanics/admin/:userId"],
    decide: ["POST /mechanics/admin/:userId/interview", "POST /mechanics/admin/:userId/decision"],
  },
  stats: [
    { key: "PENDING", icon: "time-outline", en: "Pending", ar: "قيد المراجعة", warn: true },
    { key: "NEEDS_COMPLETION", icon: "document-text-outline", en: "Needs completion", ar: "تحتاج استكمالًا" },
    { key: "VERIFIED", icon: "shield-checkmark-outline", en: "Verified", ar: "موثّقون" },
  ],
  loadStats: async () => {
    const r = await api<{ counts: Record<string, number> }>("GET", "/mechanics/admin");
    return { PENDING: r.counts.PENDING ?? 0, NEEDS_COMPLETION: r.counts.NEEDS_COMPLETION ?? 0, VERIFIED: r.counts.VERIFIED ?? 0 };
  },
  provider: null,
  requests: { mode: "screen" },
  directory: {
    titleEn: "Verified mechanics",
    titleAr: "الميكانيكيون الموثّقون",
    emptyEn: "No verified mechanics yet.",
    emptyAr: "لا يوجد ميكانيكيون موثّقون بعد.",
    searchEn: "Name, email or city",
    searchAr: "الاسم أو البريد أو المدينة",
    load: async () => {
      const r = await api<{ profiles: MechanicListItem[] }>("GET", "/mechanics/admin?status=VERIFIED");
      return r.profiles.map((p) => ({ id: p.userId, kind: "mechanic" as const, title: p.user.fullName, subtitle: [p.user.email, p.city].filter(Boolean).join(" · "), meta: p.specializations.slice(0, 3), status: "APPROVED" as const }));
    },
  },
  review: { kinds: [] },
  shortcuts: [
    { id: "requests", en: "Review applications", ar: "مراجعة الطلبات", descEn: "Professional applications and interviews", descAr: "طلبات الانضمام والمقابلات", icon: "clipboard-outline", photo: 1 },
    { id: "directory", en: "Verified mechanics", ar: "الميكانيكيون الموثّقون", descEn: "Approved mechanics on the platform", descAr: "الميكانيكيون المعتمدون في المنصة", icon: "people-outline", photo: 2 },
  ],
};

export const DEPARTMENTS: Record<DeptKey, Dept> = { MANAGE_TOWING: towing, MANAGE_SPARE_PARTS: parts, MANAGE_MECHANICS: mechanics };
export const DEPT_ORDER: DeptKey[] = ["MANAGE_TOWING", "MANAGE_SPARE_PARTS", "MANAGE_MECHANICS"];

// ---------- approval checklists (what a reviewer verifies before approving) ----------
const expired = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now();

export const checklists = {
  truck: (t: T, tr: Truck): CheckItem[] => {
    const reg = tr.documents.find((d) => d.kind === "REGISTRATION");
    const ins = tr.documents.find((d) => d.kind === "INSURANCE");
    return [
      { ok: !!tr.photoUri, label: t("Truck photo", "صورة الشاحنة"), blocking: true },
      { ok: !!reg, label: t("Vehicle registration", "ترخيص المركبة"), blocking: true, hint: reg && expired(reg.expiresAt) ? t("Expired: flagged, does not block", "منتهٍ: للتنبيه ولا يمنع") : undefined },
      { ok: !!ins, label: t("Insurance", "التأمين"), blocking: true, hint: ins && expired(ins.expiresAt) ? t("Expired: flagged, does not block", "منتهٍ: للتنبيه ولا يمنع") : undefined },
      { ok: !!tr.plate && !!tr.make && !!tr.model, label: t("Plate, make and model", "اللوحة والصنع والطراز") },
    ];
  },
};

export const hasBlocking = (items: CheckItem[]) => items.some((i) => i.blocking && !i.ok);
