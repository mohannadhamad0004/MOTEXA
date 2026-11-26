// Tow admin tabs on the one UI system (docs/guide/10-ui-system.md): Home = Dashboard, Requests = List (company applications, with the
// drivers waiting for a licence review as a Needs-you row), Companies = List. Every count is real (GET /admin/tow/stats, the review
// list, the companies / trucks lists); a count that has not loaded shows "—".
import { Href, router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Note, Section } from "../../components/garage";
import { FilterChips, ManageEntry, ManagePage, ManageRow, appStatus } from "../../components/manage/ManagePage";
import { Kpis, NeedsRow, Page } from "../../components/manage/Page";
import { api } from "../../core/config/api";
import { cityLabel } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { review } from "../provider/api";
import { TowCompany, Truck, towAdminService } from "../tow/towService";
import { AdminHero } from "./adminHero";
import { providerActions } from "./itemActions";
import { ApplicationsList } from "./partsAdmin";

const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const useStats = () => useLoad(() => api<{ stats: Record<string, number> }>("GET", "/admin/tow/stats").then((r) => r.stats), [], 30000);

// ---------------- Home ----------------
export function TowAdminHome() {
  const { t } = useL();
  const stats = useStats();
  const fleet = useLoad(() => towAdminService.listTrucks(NOACTOR), [], 30000);
  const unread = useLoad(() => review.counts("TOW").then((c) => c.unreadMessages), [], 15000);
  const s = stats.data;
  const approved = (fleet.data ?? []).filter((x) => x.verification === "APPROVED");
  const needs = [
    s?.pendingCompanies ? { icon: "business-outline" as const, title: t("Company applications to review", "طلبات شركات للمراجعة"), count: s.pendingCompanies, to: "/dept/requests" } : null,
    s?.pendingDrivers ? { icon: "id-card-outline" as const, title: t("Drivers' licences to review", "رخص سائقين للمراجعة"), count: s.pendingDrivers, to: "/dept/tows/drivers" } : null,
    s?.pendingTrucks ? { icon: "car-outline" as const, title: t("Trucks waiting for approval", "شاحنات بانتظار الاعتماد"), count: s.pendingTrucks, to: "/dept/directory" } : null,
    unread.data ? { icon: "chatbubbles-outline" as const, title: t("Unread messages", "رسائل غير مقروءة"), count: unread.data, to: "/dept/messages" } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);
  const loaded = !!s && unread.data !== null;
  return (
    <Page title={t("Tow admin", "إدارة السحب")} back={false} tabBar
      hero={<AdminHero dept="tow" title={t("Admin", "الإدارة")} line={t("Manage fleet, requests and tow providers.", "أدِر الأسطول والطلبات ومزوّدي السحب.")} />}
      onRefresh={() => { void stats.reload(); void fleet.reload(); void unread.reload(); }} refreshing={false}>
      <Section title={t("Needs you now", "بحاجة إليك الآن")}>
        <View style={{ gap: 8 }}>
          {needs.map((n) => <NeedsRow key={n.to} icon={n.icon} title={n.title} count={n.count} onPress={() => go(n.to)} />)}
          {loaded && !needs.length ? <Note tone="success" icon="checkmark-circle-outline">{t("Nothing is waiting for you.", "لا شيء بانتظارك.")}</Note> : null}
        </View>
      </Section>
      <Kpis items={[
        { label: t("Available trucks", "شاحنات متاحة"), value: fleet.data ? approved.filter((x) => x.operational === "AVAILABLE" && !x.hasActiveJob).length : null, icon: "checkmark-circle-outline", onPress: () => go("/dept/directory") },
        { label: t("Trucks on a job", "شاحنات في مهمة"), value: fleet.data ? approved.filter((x) => x.hasActiveJob).length : null, icon: "navigate-outline", onPress: () => go("/dept/tows") },
        { label: t("Tow companies", "شركات السحب"), value: s?.approvedCompanies, icon: "business-outline", onPress: () => go("/dept/directory") },
        { label: t("Waiting for review", "بانتظار المراجعة"), value: s ? (s.pendingCompanies ?? 0) + (s.pendingTrucks ?? 0) + (s.pendingDrivers ?? 0) : null, icon: "clipboard-outline", onPress: () => go("/dept/requests") },
      ]} />
      <Section title={t("Shortcuts", "اختصارات")}>
        <View style={{ gap: 8 }}>
          <ManageEntry icon="map-outline" title={t("Active tows", "عمليات السحب الجارية")} sub={t("Every active job on the map, read only", "كل مهمة جارية على الخريطة، للقراءة فقط")} onPress={() => go("/dept/tows")} />
          <ManageEntry icon="time-outline" title={t("Tow history", "سجل السحب")} onPress={() => go("/dept/tows/history")} />
          <ManageEntry icon="flag-outline" title={t("Problem reports", "بلاغات المشاكل")} onPress={() => go("/dept/tows/reports")} />
          <ManageEntry icon="id-card-outline" title={t("Drivers' licences", "رخص السائقين")} onPress={() => go("/dept/tows/drivers")} />
        </View>
      </Section>
    </Page>
  );
}

// ---------------- Requests: company applications (+ drivers waiting) ----------------
export function TowRequests() {
  const { t } = useL();
  const stats = useStats();
  const drivers = stats.data?.pendingDrivers ?? 0;
  return <ApplicationsList kind="TOW" title={t("Requests", "الطلبات")}
    above={drivers ? <NeedsRow icon="id-card-outline" title={t("Drivers waiting for licence review", "سائقون بانتظار مراجعة الرخصة")} count={drivers} onPress={() => go("/dept/tows/drivers")} /> : undefined} />;
}

// ---------------- Companies ----------------
type Company = TowCompany & { truckCount: number; pendingTruckCount: number };
type Filter = "ALL" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
const FILTERS: { k: Filter; en: string; ar: string }[] = [
  { k: "ALL", en: "All", ar: "الكل" }, { k: "PENDING", en: "Submitted", ar: "تم الإرسال" }, { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" },
  { k: "APPROVED", en: "Approved", ar: "معتمدة" }, { k: "REJECTED", en: "Rejected", ar: "مرفوضة" },
];
const expiredDocs = (x: Truck) => x.documents.filter((d) => !!d.expiresAt && new Date(d.expiresAt).getTime() < Date.now()).length;

/** Every tow company: search (name, owner, phone, plate), one status chip row with counts, to-review first, ⋮ = the shared review actions. */
/** `back`: opened outside the department tabs (/admin/tow). */
export function TowCompaniesPage({ back = false }: { back?: boolean }) {
  const { t, isArabic } = useL();
  const state = useLoad(async () => {
    const [companies, trucks, pending] = await Promise.all([towAdminService.listCompanies(NOACTOR) as Promise<Company[]>, towAdminService.listTrucks(NOACTOR), review.list("TOW", "NEW")]);
    return { companies, trucks, pendingDocs: new Map(pending.map((p) => [p.id, p.pendingDocuments])) };
  }, []);
  const [filter, setFilter] = useState<Filter>("ALL"), [q, setQ] = useState("");
  const data = state.data;
  const found = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.companies ?? []).filter((c) => {
      const hay = [c.name, c.contactName, c.phone, c.city, cityLabel(c.city, true), ...(data?.trucks ?? []).filter((x) => x.companyId === c.id).flatMap((x) => [x.plate, x.make, x.model])].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [data, q]);
  const rank = (c: Company) => (c.verification === "PENDING" ? 0 : c.pendingTruckCount ? 1 : c.verification === "NEEDS_CHANGES" ? 2 : 3);
  const rows = found.filter((c) => filter === "ALL" || c.verification === filter).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return (
    <ManagePage title={t("Tow companies", "شركات السحب")} back={back} tabBar={!back}
      line={data ? t(`${data.companies.length} companies · ${data.trucks.length} trucks`, `${data.companies.length} شركات · ${data.trucks.length} شاحنات`) : undefined}
      actions={[{ key: "map", label: t("Show on map", "عرض على الخريطة"), icon: "map-outline", run: () => go("/dept/directory-map") }]}
      search={{ value: q, onChange: setQ, placeholder: t("Company, owner, phone or plate", "الشركة أو المالك أو الهاتف أو اللوحة") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={FILTERS.map((f) => ({ key: f.k, label: t(f.en, f.ar), count: data ? found.filter((c) => f.k === "ALL" || c.verification === f.k).length : undefined }))} />}
      items={rows} keyOf={(c) => c.id}
      renderItem={(c) => {
        const trucks = (data?.trucks ?? []).filter((x) => x.companyId === c.id);
        const waiting = data?.pendingDocs.get(c.id) ?? 0;
        const expired = trucks.reduce((n, x) => n + expiredDocs(x), 0);
        return <ManageRow title={c.name} status={appStatus(c.verification, t)}
          sub={[waiting ? t(`${waiting} documents to review`, `${waiting} مستندات للمراجعة`) : null, c.pendingTruckCount ? t(`${c.pendingTruckCount} pending trucks`, `${c.pendingTruckCount} شاحنات قيد المراجعة`) : null,
            expired ? t(`${expired} expired`, `${expired} منتهية`) : null, `${c.truckCount} ${c.truckCount === 1 ? t("truck", "شاحنة") : t("trucks", "شاحنات")}`, cityLabel(c.city, isArabic)].filter(Boolean).join(" · ")}
          onPress={() => go(`/dept/review/company/${c.id}`)} actions={providerActions(t, "TOW", { id: c.id, status: c.verification, pendingDocuments: waiting }, () => state.reload())} />;
      }}
      loading={!data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q || filter !== "ALL" ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("No tow companies yet.", "لا توجد شركات سحب بعد."), action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a company to review it.", "اضغط على شركة لمراجعتها.")} />
  );
}
