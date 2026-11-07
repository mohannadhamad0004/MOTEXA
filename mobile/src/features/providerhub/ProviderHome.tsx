import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SettingsSheet } from "../../components/blueprint";
import { Card, EmptyState, ErrorState, GaragePage, GButton, GText, HeroLayout, ListRow, Section, SkeletonRows, StatusChip } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useSessionUser } from "../../core/session/session";
import { gType, useGarageTheme } from "../../theme/garage";
import { portalApi } from "../provider/portal/api";
import { onboarding } from "../provider/api";
import type { ProviderArea } from "../provider/portal/types";
import { fmtDateTime } from "../requests/requestBits";
import { CompanyTowRequest, companyTowRequests } from "../requests/requestsService";
import { HUB } from "./hub";

const go = (p: string) => router.push(p as Href);

/** A number tile: tap opens where it comes from. */
function Tile({ label, value, warn, path }: { label: string; value: number; warn?: boolean; path: string }) {
  const { g, align } = useGarageTheme();
  return (
    <Card label={`${label}: ${value}`} onPress={() => go(path)} style={{ width: "47.5%" }}>
      <GText style={[gType.display, align, { color: warn && value > 0 ? g.warning : g.ink }]}>{String(value)}</GText>
      <GText soft style={[gType.caption, align]}>{label}</GText>
    </Card>
  );
}

function JobRow({ r, first }: { r: CompanyTowRequest; first: boolean }) {
  const { t } = useL();
  return (
    <ListRow
      divider={!first}
      icon={r.status === "REQUESTED" ? "notifications-outline" : "navigate-outline"}
      title={`${r.customerName} · ${r.vehicle.make} ${r.vehicle.model}`}
      sub={`${r.pickupAddress} · ${fmtDateTime(r.updatedAt)}`}
      end={r.status === "REQUESTED" ? <StatusChip tone="warning" label={t("Answer", "ردّ")} /> : undefined}
      onPress={() => go(`/provider/tow/dispatch/${r.id}`)}
    />
  );
}

/** Tow company Home: new requests and active jobs first (they need you), then today's real numbers. */
function TowBody() {
  const { t } = useL();
  const user = useSessionUser();
  const [jobs, setJobs] = useState<CompanyTowRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = useLoad(() => portalApi.summary("tow"), [user.id]);
  const load = useCallback(async () => {
    try {
      setJobs(await companyTowRequests.list());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, 10_000);
      return () => clearInterval(h);
    }, [load])
  );
  const m = summary.data?.metrics;
  const fresh = (jobs ?? []).filter((r) => r.status === "REQUESTED");
  const active = (jobs ?? []).filter((r) => ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(r.status));
  return (
    <>
      {error && !jobs ? <ErrorState text={t("Could not load your jobs.", "تعذّر تحميل مهامك.")} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!jobs && !error ? <SkeletonRows count={3} /> : null}
      {jobs ? (
        <>
          <Section title={t("New requests", "طلبات جديدة")} style={{ marginTop: 4 }}>
            {fresh.length ? <Card pad={8}>{fresh.map((r, i) => <JobRow key={r.id} r={r} first={i === 0} />)}</Card> : <EmptyState photo="empty.requests" text={t("No new requests. We will tell you when one arrives.", "لا توجد طلبات جديدة. سنُعلمك عند وصول طلب.")} />}
          </Section>
          <Section title={t("Active jobs", "المهام الجارية")}>
            {active.length ? <Card pad={8}>{active.map((r, i) => <JobRow key={r.id} r={r} first={i === 0} />)}</Card> : <EmptyState photo="empty.requests" text={t("No active job right now.", "لا توجد مهمة جارية الآن.")} />}
          </Section>
        </>
      ) : null}
      {m ? (
        <Section title={t("Today", "اليوم")}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Tile label={t("Completed today", "مكتملة اليوم")} value={m.completedToday ?? 0} path="/provider/tow/history" />
            <Tile label={t("Drivers free", "سائقون متاحون")} value={m.freeDrivers ?? 0} path="/provider/tow/fleet" />
            <Tile label={t("Drivers busy", "سائقون مشغولون")} value={m.busyDrivers ?? 0} path="/provider/tow/fleet" />
            <Tile label={t("Trucks available", "شاحنات متاحة")} value={m.availableTrucks ?? 0} path="/provider/tow/fleet" />
          </View>
        </Section>
      ) : null}
    </>
  );
}

/** Parts shop Home: one big "+ Add product", then what needs the owner's attention (each item opens the fix). */
function PartsBody() {
  const { t } = useL();
  const user = useSessionUser();
  const state = useLoad(() => portalApi.summary("parts"), [user.id]);
  const msgs = useLoad(() => onboarding.messages().then((r) => r.unread).catch(() => 0), [user.id]);
  const m = state.data?.metrics;
  if (state.error && !m) return <ErrorState text={t("Could not load your numbers.", "تعذّر تحميل الأرقام.")} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />;
  if (!m) return <SkeletonRows count={4} />;
  const items: { icon: any; title: string; sub: string; path: string }[] = [
    ...(m.outOfStock ? [{ icon: "alert-circle-outline", title: t(`${m.outOfStock} sold out`, `${m.outOfStock} نفدت`), sub: t("Restock them so customers can buy.", "أعد تعبئتها ليتمكن الزبائن من الشراء."), path: "/provider/parts/products?filter=out" }] : []),
    ...(m.lowStock ? [{ icon: "trending-down-outline", title: t(`${m.lowStock} low on stock`, `${m.lowStock} مخزونها منخفض`), sub: t("Running out soon.", "ستنفد قريبًا."), path: "/provider/parts/products?filter=low" }] : []),
    ...(m.missingPhotos ? [{ icon: "image-outline", title: t(`${m.missingPhotos} need a photo`, `${m.missingPhotos} تحتاج صورة`), sub: t("Customers cannot see a product without a real photo.", "لا يرى الزبائن منتجًا بلا صورة حقيقية."), path: "/provider/parts/products?filter=photo" }] : []),
    ...(msgs.data ? [{ icon: "chatbubbles-outline", title: t(`${msgs.data} new from MOTEXA`, `${msgs.data} رسائل جديدة من موتكسا`), sub: t("Read and answer.", "اقرأ وأجب."), path: "/provider/parts/messages" }] : []),
    ...(m.openInquiries ? [{ icon: "help-circle-outline", title: t(`${m.openInquiries} customer questions`, `${m.openInquiries} أسئلة من الزبائن`), sub: t("Answer to win the sale.", "أجب لتكسب البيع."), path: "/provider/parts/inquiries" }] : []),
  ];
  return (
    <>
      <GButton icon="add" label={t("Add product", "إضافة منتج")} onPress={() => go("/provider/parts/new")} style={{ minHeight: 60 }} />
      <Section title={t("Needs your attention", "يحتاج انتباهك")}>
        {items.length ? <Card pad={8}>{items.map((x, i) => <ListRow key={x.path + x.title} divider={i > 0} icon={x.icon} title={x.title} sub={x.sub} onPress={() => go(x.path)} />)}</Card> : <EmptyState photo="empty.requests" text={t("All good: nothing needs you right now.", "كل شيء على ما يرام: لا شيء يحتاجك الآن.")} />}
      </Section>
      <Section title={t("Your shop", "متجرك")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Tile label={t("Products", "المنتجات")} value={m.products ?? 0} path="/provider/parts/products" />
          <Tile label={t("Visible to customers", "ظاهرة للزبائن")} value={m.visibleProducts ?? 0} path="/provider/parts/products" />
        </View>
      </Section>
    </>
  );
}

/** Home of both provider roles: the Garage hero (Mo clip), then the body of the role. Every other screen is reachable from Profile. */
export function ProviderHome({ area }: { area: ProviderArea }) {
  const cfg = HUB[area];
  const { t } = useL();
  const user = useSessionUser();
  const state = useLoad(() => portalApi.summary(area), [user.id]);
  const [settings, setSettings] = useState(false);
  const m = state.data?.metrics;
  return (
    <>
      <GaragePage
        tabs
        entry={`provider-${area}`}
        refreshing={state.loading && !!state.data}
        onRefresh={state.reload}
        hero={
          <HeroLayout
            config={{
              tab: cfg.hero,
              title: state.data?.identity.name ?? t(cfg.eyebrow.en, cfg.eyebrow.ar),
              line: (m && cfg.line(m, t)) || undefined,
              top: { label: t(cfg.eyebrow.en, cfg.eyebrow.ar), actions: [{ icon: "settings-outline", label: t("Settings", "الإعدادات"), onPress: () => setSettings(true) }] },
            }}
          />
        }
      >
        {area === "tow" ? <TowBody /> : <PartsBody />}
      </GaragePage>
      <SettingsSheet visible={settings} onClose={() => setSettings(false)} signOutButton />
    </>
  );
}
