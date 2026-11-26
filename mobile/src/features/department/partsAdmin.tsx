// Parts admin tabs on the one UI system (docs/guide/10-ui-system.md): Home = Dashboard, Requests = List (shop applications | 3D
// requests), Shops = List. Every count is real (GET /admin/parts/stats, the review counts, the 3D request list); a count that has not
// loaded is shown as "—", never guessed. The tow admin reuses ApplicationsList (its applications + drivers waiting).
import { Image } from "expo-image";
import { Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Note, Section } from "../../components/garage";
import { FilterChips, ManageEntry, ManagePage, ManageRow, appStatus } from "../../components/manage/ManagePage";
import { Kpis, NeedsRow, Page } from "../../components/manage/Page";
import { api } from "../../core/config/api";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { cityLabel } from "../../core/constants/cities";
import { publicImageUrl } from "../../core/constants/files";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useGarageTheme } from "../../theme/garage";
import { ACCESSORY_TYPE_LABELS, STATUS_LABELS, adminAccessoryApi, type AccessoryStatus, type ListedAccessory } from "../accessory3d/api";
import type { Verification } from "../parts/partsService";
import { review, type Kind, type Tab } from "../provider/api";
import { fmtDay } from "../provider/labels";
import { AdminHero } from "./adminHero";
import { accessoryActions, providerActions } from "./itemActions";

const go = (path: string) => router.push(path as Href);
type T = (en: string, ar: string) => string;

// ---------------- 3D request counts (Home + Requests) ----------------
/** Which 3D requests need the Parts Admin: new submissions and models waiting for the final check. */
export const NEEDS_ACTION: AccessoryStatus[] = ["PENDING_REVIEW", "READY_FOR_FINAL_REVIEW"];
export function useThreeDCount() {
  const list = useLoad(() => adminAccessoryApi.list(), [], 15000);
  return { list, needs: (list.data ?? []).filter(a => NEEDS_ACTION.includes(a.status)).length };
}

// ---------------- Home ----------------
export function PartsAdminHome() {
  const { t } = useL();
  const stats = useLoad(() => api<{ stats: Record<string, number> }>("GET", "/admin/parts/stats").then(r => r.stats), []);
  const threeD = useThreeDCount();
  const unread = useLoad(() => review.counts("PARTS").then(c => c.unreadMessages), [], 15000);
  const s = stats.data;
  const needs = [
    s?.pendingShops ? { icon: "storefront-outline" as const, title: t("Shop applications to review", "طلبات متاجر للمراجعة"), count: s.pendingShops, to: "/dept/requests" } : null,
    threeD.needs ? { icon: "cube-outline" as const, title: t("3D requests waiting for you", "طلبات ثلاثية الأبعاد بانتظارك"), count: threeD.needs, to: "/dept/requests?seg=3d" } : null,
    unread.data ? { icon: "chatbubbles-outline" as const, title: t("Unread messages", "رسائل غير مقروءة"), count: unread.data, to: "/dept/messages" } : null,
    s?.hiddenProducts ? { icon: "eye-off-outline" as const, title: t("Products hidden from customers", "منتجات مخفية عن العملاء"), count: s.hiddenProducts, to: "/dept/directory" } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);
  const loaded = !!s && !!threeD.list.data && unread.data !== null;
  return (
    <Page title={t("Parts admin", "إدارة قطع الغيار")} back={false} tabBar
      hero={<AdminHero dept="parts" title={t("Marketplace review", "مراجعة السوق")} line={t("Review shops, products and marketplace submissions.", "راجِع المتاجر والمنتجات وطلبات السوق.")} />}
      onRefresh={() => { void stats.reload(); void threeD.list.reload(); void unread.reload(); }} refreshing={stats.loading && !!s}>
      <Section title={t("Needs you now", "بحاجة إليك الآن")}>
        <View style={{ gap: 8 }}>
          {needs.map(n => <NeedsRow key={n.to} icon={n.icon} title={n.title} count={n.count} onPress={() => go(n.to)} />)}
          {loaded && !needs.length ? <Note tone="success" icon="checkmark-circle-outline">{t("Nothing is waiting for you.", "لا شيء بانتظارك.")}</Note> : null}
        </View>
      </Section>
      <Kpis items={[
        { label: t("Shops", "المتاجر"), value: s?.shops, icon: "storefront-outline", onPress: () => go("/dept/directory") },
        { label: t("Products", "المنتجات"), value: s?.products, icon: "disc-outline" },
        { label: t("3D cars published", "سيارات ثلاثية الأبعاد منشورة"), value: s?.cars3d, icon: "car-sport-outline", onPress: () => go("/dept/3d/vehicles") },
        { label: t("3D accessory requests", "طلبات الإكسسوارات ثلاثية الأبعاد"), value: threeD.list.data?.length, icon: "cube-outline", onPress: () => go("/dept/requests?seg=3d") },
      ]} />
      <Section title={t("Shortcuts", "اختصارات")}>
        <View style={{ gap: 8 }}>
          <ManageEntry icon="add-circle-outline" title={t("Add 3D model", "إضافة نموذج ثلاثي الأبعاد")} onPress={() => go("/dept/3d/add")} />
          <ManageEntry icon="car-sport-outline" title={t("3D models", "النماذج ثلاثية الأبعاد")} sub={t("Cars, accessories, part maps, fits", "السيارات والإكسسوارات وخرائط القطع والتركيب")} onPress={() => go("/dept/3d")} />
          <ManageEntry icon="construct-outline" title={t("Accessory fitting", "تركيب الإكسسوارات")} onPress={() => go("/dept/accessory-zones?mode=fits")} />
          <ManageEntry icon="receipt-outline" title={t("Orders", "الطلبات")} onPress={() => go("/dept/orders")} />
          <ManageEntry icon="map-outline" title={t("Active deliveries", "التوصيلات الجارية")} onPress={() => go("/dept/orders/map")} />
          <ManageEntry icon="list-outline" title={t("Vehicle catalog", "كتالوج المركبات")} onPress={() => go("/dept/vehicles")} />
        </View>
      </Section>
    </Page>
  );
}

// ---------------- Requests: shop applications | 3D requests ----------------
const APP_TABS: { k: Tab; en: string; ar: string }[] = [
  { k: "NEW", en: "New", ar: "جديد" }, { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" }, { k: "APPROVED", en: "Approved", ar: "معتمد" }, { k: "REJECTED", en: "Rejected", ar: "مرفوض" },
];
const kindLabel = (t: T, k: Kind) => (k === "TOW" ? t("Tow company", "شركة سحب") : t("Parts shop", "متجر قطع غيار"));
type Tabbed = { value: string; options: { key: string; label: string; count?: number }[]; onChange: (k: string) => void };

/** Provider applications (parts shops / tow companies): one status chip row, the newest waiting first, ⋮ = the shared review actions. */
export function ApplicationsList({ kind, tabs, above, title }: { kind: Kind; tabs?: Tabbed; above?: ReactNode; title?: string }) {
  const { t, isArabic } = useL();
  const [tab, setTab] = useState<Tab>("NEW"), [q, setQ] = useState("");
  const counts = useLoad(() => review.counts(kind), [kind], 15000);
  const list = useLoad(() => review.list(kind, tab), [kind, tab], 15000);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (list.data ?? []).filter(r => { const hay = [r.name, r.ownerName, r.city, cityLabel(r.city, true)].join(" ").toLowerCase(); return words.every(w => hay.includes(w)); })
    .sort((a, b) => (b.unreadMessages ?? 0) - (a.unreadMessages ?? 0) || String(a.submittedAt ?? "").localeCompare(String(b.submittedAt ?? "")));
  const reload = () => Promise.all([list.reload(), counts.reload()]);
  const n = counts.data?.counts;
  return (
    <ManagePage title={title ?? t("Requests", "الطلبات")} back={false} tabBar tabs={tabs}
      line={n ? t(`${n.NEW ?? 0} new · ${n.NEEDS_CHANGES ?? 0} waiting for changes`, `${n.NEW ?? 0} جديد · ${n.NEEDS_CHANGES ?? 0} بانتظار التعديلات`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search name, owner or city", "ابحث بالاسم أو المالك أو المدينة") }}
      filters={<FilterChips value={tab} onChange={setTab} filters={APP_TABS.map(x => ({ key: x.k, label: t(x.en, x.ar), count: n?.[x.k] }))} />}
      above={above}
      items={rows} keyOf={r => r.id}
      renderItem={r => <ManageRow title={r.name} status={appStatus(r.status, t)}
        sub={[r.unreadMessages ? t(`${r.unreadMessages} unread`, `${r.unreadMessages} غير مقروءة`) : null, r.ownerName, cityLabel(r.city, isArabic),
          r.pendingDocuments ? t(`${r.pendingDocuments} documents waiting`, `${r.pendingDocuments} مستندات بانتظار المراجعة`) : null, r.submittedAt ? fmtDay(r.submittedAt) : null].filter(Boolean).join(" · ")}
        onPress={() => go(`/dept/review/${kind === "TOW" ? "company" : "shop"}/${r.id}`)}
        actions={providerActions(t, kind, { id: r.id, status: r.status, pendingDocuments: r.pendingDocuments }, reload)} />}
      loading={!list.data && !list.error} error={list.error} onRetry={() => void reload()}
      empty={{ text: q ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : tab === "NEW" ? t("No application is waiting for review.", "لا يوجد طلب بانتظار المراجعة.") : t("Nothing here yet.", "لا يوجد شيء هنا بعد."), action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void reload()} refreshing={list.loading && !!list.data}
      detailHint={t(`Tap a ${kind === "TOW" ? "company" : "shop"} to review its application.`, "اضغط على طلب لمراجعته.")} />
  );
}

/** 3D requests: one chip row (All · Needs you · In progress · Published · Changes requested), what needs the admin first. */
const GROUPS: { key: string; en: string; ar: string; of: AccessoryStatus[] | null }[] = [
  { key: "ALL", en: "All", ar: "الكل", of: null },
  { key: "NEEDS", en: "Needs you", ar: "بحاجة إليك", of: NEEDS_ACTION },
  { key: "PROGRESS", en: "In progress", ar: "قيد الإنشاء", of: ["APPROVED_FOR_GENERATION", "GENERATING"] },
  { key: "LIVE", en: "Published", ar: "منشور", of: ["PUBLISHED"] },
  { key: "CHANGES", en: "Changes requested", ar: "مطلوب تعديلات", of: ["REJECTED"] },
];
const accTone = (s: AccessoryStatus) => (s === "PUBLISHED" ? "success" : s === "REJECTED" ? "danger" : NEEDS_ACTION.includes(s) ? "accent" : "neutral") as "success" | "danger" | "accent" | "neutral";
function Thumb({ a }: { a: ListedAccessory }) {
  const { g } = useGarageTheme();
  const pub = publicImageUrl(a.productImageId ? `/files/public/${a.productImageId}` : null);
  const [priv, setPriv] = useState<string | null>(null);
  useEffect(() => {
    if (pub || !a.firstPartPhotoId) return;
    let live = true;
    adminAccessoryApi.asset(a.id, a.firstPartPhotoId).then(b => live && setPriv(`data:image/jpeg;base64,${b}`), () => undefined);
    return () => { live = false; };
  }, [a.id, a.firstPartPhotoId, pub]);
  const src = pub ?? priv;
  return src ? <Image source={{ uri: src }} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: g.cardSoft }} contentFit="cover" accessibilityLabel={a.productName} />
    : <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: g.cardSoft }} />;
}
export function ThreeDRequestsList({ tabs }: { tabs?: Tabbed }) {
  const { t, isArabic } = useL();
  const { list } = useThreeDCount();
  const [group, setGroup] = useState("ALL"), [q, setQ] = useState("");
  const all = list.data ?? [];
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = all.filter(a => { const hay = [a.productName, a.shopName, ...a.cars.map(c => `${c.name} ${c.nameAr}`)].join(" ").toLowerCase(); return words.every(w => hay.includes(w)); });
  const g = GROUPS.find(x => x.key === group)!;
  const rows = matching.filter(a => !g.of || g.of.includes(a.status))
    .sort((x, y) => Number(NEEDS_ACTION.includes(y.status)) - Number(NEEDS_ACTION.includes(x.status)) || String(y.submittedAt ?? "").localeCompare(String(x.submittedAt ?? "")));
  const needs = all.filter(a => NEEDS_ACTION.includes(a.status)).length;
  return (
    <ManagePage title={tabs ? t("Requests", "الطلبات") : t("3D requests", "طلبات ثلاثية الأبعاد")} back={!tabs} tabBar={!!tabs} tabs={tabs}
      line={list.data ? t(`${all.length} 3D requests · ${needs} need you`, `${all.length} طلب ثلاثي الأبعاد · ${needs} بحاجة إليك`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Search product, shop or car", "ابحث عن منتج أو متجر أو سيارة") }}
      filters={<FilterChips value={group} onChange={setGroup} filters={GROUPS.map(x => ({ key: x.key, label: t(x.en, x.ar), count: list.data ? (x.of ? matching.filter(a => x.of!.includes(a.status)).length : matching.length) : undefined }))} />}
      items={rows} keyOf={a => a.id}
      renderItem={a => <ManageRow leading={<Thumb a={a} />} title={a.productName} status={{ label: t(...STATUS_LABELS[a.status]).split(":")[0]!, tone: accTone(a.status) }}
        sub={[a.shopName, t(...ACCESSORY_TYPE_LABELS[a.accessoryType]), a.cars.length ? a.cars.map(c => (isArabic ? c.nameAr : c.name)).join(isArabic ? "، " : ", ") : t("Universal by size", "عام حسب المقاس")].join(" · ")}
        onPress={() => go(`/dept/accessory3d/${a.id}`)} actions={accessoryActions(t, a, () => list.reload())} />}
      loading={!list.data && !list.error} error={list.error} onRetry={() => void list.reload()}
      empty={{ text: q || group !== "ALL" ? t("No 3D requests here.", "لا توجد طلبات ثلاثية الأبعاد هنا.") : t("Requests appear as soon as a shop submits them.", "تظهر الطلبات فور إرسالها من المتاجر."), action: q || group !== "ALL" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setGroup("ALL"); } } : undefined }}
      onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}
      detailHint={t("Tap a request to review it.", "اضغط على طلب لمراجعته.")} />
  );
}
export function PartsRequests() {
  const { t } = useL();
  const params = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg] = useState<"apps" | "3d">(params.seg === "3d" ? "3d" : "apps");
  useEffect(() => { if (params.seg === "3d" || params.seg === "apps") setSeg(params.seg); }, [params.seg]);
  const { needs } = useThreeDCount();
  const tabs: Tabbed = { value: seg, onChange: k => setSeg(k as "apps" | "3d"), options: [{ key: "apps", label: t("Shop applications", "طلبات المتاجر") }, { key: "3d", label: t("3D requests", "طلبات ثلاثية الأبعاد"), count: needs || undefined }] };
  return seg === "apps" ? <ApplicationsList kind="PARTS" tabs={tabs} /> : <ThreeDRequestsList tabs={tabs} />;
}

// ---------------- Shops ----------------
type Shop = { id: string; shopName: string; ownerName: string; phone: string; city: string; verificationStatus: Verification; baseLat: number | null; baseLng: number | null; brandName: string | null; branchName: string | null; categories: string[]; productCount: number; hiddenProductCount: number };
type ShopFilter = "ALL" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
const SHOP_FILTERS: { k: ShopFilter; en: string; ar: string }[] = [
  { k: "ALL", en: "All", ar: "الكل" }, { k: "PENDING", en: "Pending", ar: "قيد المراجعة" }, { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" }, { k: "APPROVED", en: "Approved", ar: "معتمدة" }, { k: "REJECTED", en: "Rejected", ar: "مرفوضة" },
];
const ORDER: Record<string, number> = { PENDING: 0, NEEDS_CHANGES: 1, DRAFT: 2, APPROVED: 3, REJECTED: 4 };
const CATEGORY = new Map(CATALOG_GROUPS.flatMap(g => g.categories).map(c => [c.key, c]));
export function PartsShopsPage() {
  const { t, isArabic } = useL();
  const state = useLoad(async () => {
    const [shops, pending] = await Promise.all([api<{ shops: Shop[] }>("GET", "/admin/parts/shops").then(r => r.shops), review.list("PARTS", "NEW")]);
    return { shops, pendingDocs: new Map(pending.map(p => [p.id, p.pendingDocuments])) };
  }, []);
  const [filter, setFilter] = useState<ShopFilter>("ALL"), [q, setQ] = useState("");
  const data = state.data;
  const matching = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.shops ?? []).filter(s => { const hay = [s.shopName, s.brandName, s.branchName, s.ownerName, s.phone, s.city, cityLabel(s.city, true), ...s.categories.map(k => `${CATEGORY.get(k)?.en ?? ""} ${CATEGORY.get(k)?.ar ?? ""}`)].join(" ").toLowerCase(); return words.every(w => hay.includes(w)); });
  }, [data, q]);
  const shown = matching.filter(s => filter === "ALL" || s.verificationStatus === filter).sort((a, b) => (ORDER[a.verificationStatus] ?? 9) - (ORDER[b.verificationStatus] ?? 9) || a.shopName.localeCompare(b.shopName));
  const count = (k: ShopFilter) => matching.filter(s => k === "ALL" || s.verificationStatus === k).length;
  const toReview = (data?.shops ?? []).filter(s => s.verificationStatus === "PENDING").length;
  return (
    <ManagePage title={t("Parts shops", "متاجر قطع الغيار")} back={false} tabBar
      line={data ? t(`${data.shops.length} shops · ${toReview} to review`, `${data.shops.length} متجر · ${toReview} للمراجعة`) : undefined}
      actions={[{ key: "map", label: t("Show on map", "عرض على الخريطة"), icon: "map-outline", run: () => go("/dept/directory-map") }]}
      search={{ value: q, onChange: setQ, placeholder: t("Shop, brand, owner, phone, city or category", "المتجر أو العلامة أو المالك أو الهاتف أو المدينة أو الفئة") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={SHOP_FILTERS.map(f => ({ key: f.k, label: t(f.en, f.ar), count: data ? count(f.k) : undefined }))} />}
      items={shown} keyOf={s => s.id}
      renderItem={s => {
        const waiting = data!.pendingDocs.get(s.id) ?? 0;
        const notes = [s.verificationStatus === "APPROVED" ? t(`${s.productCount} products`, `${s.productCount} منتجات`) : null, s.hiddenProductCount ? t(`${s.hiddenProductCount} hidden`, `${s.hiddenProductCount} مخفية`) : null,
          s.baseLat == null || s.baseLng == null ? t("location missing", "الموقع غير محدد") : null, waiting ? t(`${waiting} documents waiting`, `${waiting} مستندات بانتظار المراجعة`) : null];
        return <ManageRow title={[s.shopName, s.branchName].filter(Boolean).join(" · ")} status={appStatus(s.verificationStatus, t)}
          sub={[s.ownerName, cityLabel(s.city, isArabic), ...notes].filter(Boolean).join(" · ")}
          onPress={() => go(`/dept/review/shop/${s.id}`)}
          actions={providerActions(t, "PARTS", { id: s.id, status: s.verificationStatus === "DRAFT" ? "DRAFT" : s.verificationStatus, pendingDocuments: waiting }, () => state.reload())} />;
      }}
      loading={!data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q || filter !== "ALL" ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("No parts shops yet.", "لا توجد متاجر بعد."), action: q || filter !== "ALL" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setFilter("ALL"); } } : undefined }}
      onRefresh={() => void state.reload()} refreshing={state.loading && !!data}
      detailHint={t("Tap a shop to open its application and documents.", "اضغط على متجر لفتح طلبه ومستنداته.")} />
  );
}
