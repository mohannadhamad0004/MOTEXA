// Home of both provider roles = Dashboard (docs/guide/10-ui-system.md): the Mo hero (name, one real line, the ONE main action), "Needs
// you now" rows with real counts that open the filtered list, KPI tiles, shortcut rows. Every number comes from the server; a row
// whose count is 0 is left out and a tile shows "—" until its value is known.
import { router, type Href } from "expo-router";
import { View } from "react-native";
import { HeroLayout, Note, Section } from "../../components/garage";
import { ManageEntry } from "../../components/manage/ManagePage";
import { Kpis, NeedsRow, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useSessionUser } from "../../core/session/session";
import { portalApi } from "../provider/portal/api";
import { onboarding } from "../provider/api";
import type { ProviderArea } from "../provider/portal/types";
import { companyTowRequests } from "../requests/requestsService";
import { HUB } from "./hub";

const go = (p: string) => router.push(p as Href);
type Need = { icon: Parameters<typeof NeedsRow>[0]["icon"]; title: string; count: number; to: string };

export function ProviderHome({ area }: { area: ProviderArea }) {
  const cfg = HUB[area];
  const { t } = useL();
  const user = useSessionUser();
  const state = useLoad(() => portalApi.summary(area), [user.id], 30000);
  const msgs = useLoad(() => onboarding.messages().then((r) => r.unread).catch(() => 0), [user.id], 30000);
  // tow: the open jobs themselves (new requests need an answer within minutes), re-read every 10 s like before
  const jobs = useLoad(() => (area === "tow" ? companyTowRequests.list() : Promise.resolve([])), [user.id, area], 10000);
  const m = state.data?.metrics;
  const fresh = (jobs.data ?? []).filter((r) => r.status === "REQUESTED").length;
  const active = (jobs.data ?? []).filter((r) => ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(r.status)).length;
  const needs: (Need | null)[] = area === "tow" ? [
    fresh ? { icon: "notifications-outline", title: t("New requests to answer", "طلبات جديدة بانتظار ردّك"), count: fresh, to: "/provider/tow/jobs?filter=new" } : null,
    active ? { icon: "navigate-outline", title: t("Active jobs", "مهام جارية"), count: active, to: "/provider/tow/jobs?filter=active" } : null,
  ] : [
    m?.outOfStock ? { icon: "alert-circle-outline", title: t("Sold out", "نفدت"), count: m.outOfStock, to: "/provider/parts/products?filter=out" } : null,
    m?.lowStock ? { icon: "trending-down-outline", title: t("Low on stock", "مخزون منخفض"), count: m.lowStock, to: "/provider/parts/products?filter=low" } : null,
    m?.missingPhotos ? { icon: "image-outline", title: t("Need a real photo", "تحتاج صورة حقيقية"), count: m.missingPhotos, to: "/provider/parts/products?filter=photo" } : null,
    m?.openInquiries ? { icon: "help-circle-outline", title: t("Customer questions", "أسئلة الزبائن"), count: m.openInquiries, to: "/provider/parts/inquiries" } : null,
  ];
  if (msgs.data) needs.push({ icon: "chatbubbles-outline", title: t("New messages from MOTEXA", "رسائل جديدة من موتكسا"), count: msgs.data, to: `/provider/${area}/messages` });
  const shown = needs.filter((n): n is Need => !!n);
  const loaded = !!m && msgs.data !== null && (area !== "tow" || !!jobs.data);
  const shortcuts = area === "tow"
    ? [{ icon: "map-outline" as const, en: "Live map", ar: "الخريطة المباشرة", to: "/provider/tow/live" }, { icon: "time-outline" as const, en: "History", ar: "السجل", to: "/provider/tow/history" }, { icon: "stats-chart-outline" as const, en: "Statistics", ar: "الإحصائيات", to: "/provider/tow/stats" }]
    : [{ icon: "receipt-outline" as const, en: "Orders", ar: "الطلبات", to: "/provider/parts/orders" }, { icon: "cube-outline" as const, en: "3D parts", ar: "قطع ثلاثية الأبعاد", to: "/provider/parts/3d" }, { icon: "stats-chart-outline" as const, en: "Performance", ar: "الأداء", to: "/provider/parts/analytics" }];
  return (
    <Page title={state.data?.identity.name ?? t(cfg.eyebrow.en, cfg.eyebrow.ar)} back={false} tabBar
      onRefresh={() => { void state.reload(); void msgs.reload(); void jobs.reload(); }} refreshing={state.loading && !!state.data}
      hero={<HeroLayout config={{
        tab: cfg.hero,
        title: state.data?.identity.name ?? t(cfg.eyebrow.en, cfg.eyebrow.ar),
        line: (m && cfg.line(m, t)) || undefined,
        top: { label: t(cfg.eyebrow.en, cfg.eyebrow.ar), actions: [] },
        action: { kind: "button", label: t(cfg.action.en, cfg.action.ar), icon: cfg.action.icon, onPress: () => go(cfg.action.path) },
      }} />}>
      <Section title={t("Needs you now", "بحاجة إليك الآن")}>
        <View style={{ gap: 8 }}>
          {shown.map((n) => <NeedsRow key={n.to} icon={n.icon} title={n.title} count={n.count} onPress={() => go(n.to)} />)}
          {loaded && !shown.length ? <Note tone="success" icon="checkmark-circle-outline">{t("All good: nothing needs you right now.", "كل شيء على ما يرام: لا شيء يحتاجك الآن.")}</Note> : null}
          {state.error && !m ? <Note tone="danger" icon="alert-circle-outline">{t("Could not load your numbers. Pull down to try again.", "تعذّر تحميل الأرقام. اسحب للأسفل للمحاولة مجددًا.")}</Note> : null}
        </View>
      </Section>
      <Kpis items={cfg.stats.map((s) => ({ label: t(s.en, s.ar), value: m ? s.value(m) : null, icon: s.icon, onPress: () => go(s.path) }))} />
      <Section title={t("Shortcuts", "اختصارات")}>
        <View style={{ gap: 8 }}>{shortcuts.map((s) => <ManageEntry key={s.to} icon={s.icon} title={t(s.en, s.ar)} onPress={() => go(s.to)} />)}</View>
      </Section>
    </Page>
  );
}
