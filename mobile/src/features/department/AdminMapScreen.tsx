// Full-screen directory map for the Tow Admin and the Parts Admin (/dept/directory-map, opened by "Show on map" on the Companies /
// Shops page). Same map, panel, overlay buttons and filter chips as the customer map (ServiceMapScreen); admin data only, from the
// existing role-guarded endpoints: tow companies' stored bases + the active tows (the customer's pickup point and the driver's live
// point exist only while a job is active), or every parts shop's stored location coloured by its review status. Nothing is guessed
// from a city: places without a stored point are counted, not drawn.
import { Href, router } from "expo-router";
import { ReactNode, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GButton, GIcon, GIconName, GText, Rail } from "../../components/garage";
import { api } from "../../core/config/api";
import { cityLabel } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useReduced } from "../../motion";
import { useGarageTheme } from "../../theme/garage";
import { alpha } from "../../theme/tokens";
import { useTowStatusLabels } from "../requests/requestBits";
import { MapPanel, Snap } from "../shared/MapPanel";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "../shared/maps";
import { LayerChip, OverlayButton } from "../shared/ServiceMapScreen";
import { adminTows, liveLabel, TowJob } from "../tow/dispatchService";
import { CompanyRow, towAdminService } from "../tow/towService";
import { StatusChip } from "./ui";

const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const ltr = (v: string) => "⁦" + v + "⁩";

type Shop = { id: string; shopName: string; ownerName: string; city: string; verificationStatus: string; baseLat: number | null; baseLng: number | null; productCount: number; hiddenProductCount: number };
type Layer = { key: string; en: string; ar: string; color: string; icon: GIconName };
/** one place on the map: its pin, the words of its list row and info card, and where "Open" goes */
type Place = { pin: ServicePin; layer: string; title: string; line: string; status: ReactNode; details: string[]; open: { label: [string, string]; href: string } };

const TOW_LAYERS: Layer[] = [
  { key: "company", en: "Companies", ar: "الشركات", color: "#5B3C26", icon: "business-outline" },
  { key: "job", en: "Active tows", ar: "سحب جارٍ", color: "#C8372D", icon: "car-outline" },
  { key: "driver", en: "Drivers on jobs", ar: "سائقون في مهمة", color: "#B5541C", icon: "navigate-outline" },
];
const SHOP_LAYERS: Layer[] = [
  { key: "APPROVED", en: "Approved", ar: "معتمدة", color: "#3D7A3A", icon: "checkmark-circle-outline" },
  { key: "PENDING", en: "Pending", ar: "قيد المراجعة", color: "#B9822B", icon: "time-outline" },
  { key: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات", color: "#2F6B8A", icon: "create-outline" },
  { key: "REJECTED", en: "Rejected", ar: "مرفوضة", color: "#B3362F", icon: "close-circle-outline" },
  { key: "DRAFT", en: "Draft", ar: "مسودة", color: "#7A7068", icon: "document-outline" },
];

export function AdminMapScreen({ mode }: { mode: "tow" | "parts" }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const L = useTowStatusLabels();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReduced();
  // active tows move: re-read every 10 s while this screen is open (shops: once)
  const state = useLoad<{ places: Place[]; missing: number }>(async () => (mode === "tow" ? towPlaces(...(await Promise.all([towAdminService.listCompanies(NOACTOR) as Promise<CompanyRow[]>, adminTows.active()]))) : shopPlaces((await api<{ shops: Shop[] }>("GET", "/admin/parts/shops")).shops)), [mode, isArabic], mode === "tow" ? 10_000 : undefined);
  const layers = mode === "tow" ? TOW_LAYERS : SHOP_LAYERS;
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(layers.map((l) => [l.key, true])));
  const [sel, setSel] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("collapsed");
  const [inset, setInset] = useState(0);
  const [topH, setTopH] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | null>(null);
  const [refit, setRefit] = useState(0);

  // the places, built with the screen's language
  function towPlaces(companies: CompanyRow[], jobs: TowJob[]) {
    const out: Place[] = [];
    for (const c of companies)
      if (c.baseLat != null && c.baseLng != null)
        out.push({ pin: { id: `c:${c.id}`, name: c.name, lat: c.baseLat, lng: c.baseLng, kind: "hq", dim: false }, layer: "company", title: c.name, line: [c.contactName, cityLabel(c.city, isArabic)].filter(Boolean).join(" · "), status: <StatusChip status={c.verification} />, details: [`${c.truckCount} ${c.truckCount === 1 ? t("truck", "شاحنة") : t("trucks", "شاحنات")}`], open: { label: ["Open company", "فتح الشركة"], href: `/dept/review/company/${c.id}` } });
    for (const j of jobs) {
      const step = j.stage === "ARRIVED" ? L.ARRIVED : L[j.status];
      const open = { label: ["Open tow", "فتح عملية السحب"] as [string, string], href: `/dept/tows/${j.id}` };
      // the customer's exact pickup point: admins see it only while the job is active (this endpoint returns active jobs only)
      if (j.pickup) out.push({ pin: { id: `j:${j.id}`, name: j.pickupAddress, lat: j.pickup.lat, lng: j.pickup.lng, kind: "car", dim: false, color: "#C8372D" }, layer: "job", title: `${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}`, line: j.company.name, status: <Badge text={step} />, details: [j.pickupAddress, j.dropoffAddress ? `${t("To:", "إلى:")} ${j.dropoffAddress}` : ""].filter(Boolean), open });
      if (j.driver?.live) out.push({ pin: { id: `d:${j.id}`, name: j.driver.name, lat: j.driver.live.lat, lng: j.driver.live.lng, kind: "tow", dim: j.driver.live.stale, color: "#B5541C" }, layer: "driver", title: j.driver.name, line: j.company.name, status: <Badge text={step} />, details: [liveLabel(j.driver.live, t)], open });
    }
    return { places: out, missing: companies.filter((c) => c.baseLat == null || c.baseLng == null).length };
  }
  function shopPlaces(shops: Shop[]) {
    const places: Place[] = shops
      .filter((s) => s.baseLat != null && s.baseLng != null)
      .map((s) => ({ pin: { id: s.id, name: s.shopName, lat: s.baseLat!, lng: s.baseLng!, kind: "shop" as const, dim: false, color: SHOP_LAYERS.find((l) => l.key === s.verificationStatus)?.color }, layer: s.verificationStatus, title: s.shopName, line: [s.ownerName, cityLabel(s.city, isArabic)].filter(Boolean).join(" · "), status: <StatusChip status={s.verificationStatus} />, details: [`${s.productCount} ${s.productCount === 1 ? t("product", "منتج") : t("products", "منتجات")}${s.hiddenProductCount ? ` · ${s.hiddenProductCount} ${t("hidden", "مخفية")}` : ""}`], open: { label: ["Open shop", "فتح المتجر"] as [string, string], href: `/dept/review/shop/${s.id}` } }));
    return { places, missing: shops.length - places.length };
  }

  const all = state.data?.places ?? [];
  const count = (k: string) => all.filter((p) => p.layer === k).length;
  const shown = all.filter((p) => on[p.layer]);
  const selected = shown.find((p) => p.pin.id === sel) ?? null;
  const select = (p: Place) => {
    setSel(p.pin.id);
    setSnap("collapsed");
    setFocus({ lat: p.pin.lat, lng: p.pin.lng, key: `${p.pin.id}-${Date.now()}` });
  };
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/dept/directory" as Href));
  const title = mode === "tow" ? t("Tow map", "خريطة السحب") : t("Parts shops map", "خريطة متاجر القطع");
  const layerOf = (k: string) => layers.find((l) => l.key === k)!;

  const overlay = (
    <View onLayout={(e) => setTopH(e.nativeEvent.layout.height)} style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 40, paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 12, gap: 10, backgroundColor: alpha(g.card, 0.95), borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, borderColor: g.line }}>
      <View style={[row, { alignItems: "center", gap: 10 }]}>
        <OverlayButton icon="back" label={t("Back", "رجوع")} onPress={back} />
        <GText numberOfLines={1} style={[{ flex: 1, fontSize: 20, fontWeight: "700" }, align]}>{title}</GText>
        <OverlayButton icon="fit" label={t("Show everything", "عرض الكل")} onPress={() => (setSel(null), setRefit((n) => n + 1))} />
      </View>
      <Rail gap={8}>
        {layers.filter((l) => l.key !== "DRAFT" || count("DRAFT")).map((l) => (
          <LayerChip key={l.key} color={l.color} icon={l.icon} label={t(l.en, l.ar)} count={state.data ? count(l.key) : null} on={on[l.key]} onPress={() => { setOn({ ...on, [l.key]: !on[l.key] }); if (selected?.layer === l.key) setSel(null); }} />
        ))}
      </Rail>
    </View>
  );

  let header: ReactNode, body: ReactNode, footer: ReactNode = null;
  if (!selected) {
    header = (
      <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 6 }]}>
        <GText style={[{ fontSize: 20, fontWeight: "700" }, align]}>{mode === "tow" ? t("On the map", "على الخريطة") : t("Shops on the map", "المتاجر على الخريطة")}</GText>
        {state.data ? <GText soft style={{ fontSize: 13, fontWeight: "700" }}>{String(shown.length)}</GText> : null}
      </View>
    );
    body = state.error && !state.data ? (
      <View style={{ gap: 10, paddingVertical: 12 }}>
        <GText style={[{ color: g.danger }, align]}>{state.error}</GText>
        <GButton variant="secondary" label={t("Retry", "إعادة المحاولة")} onPress={() => void state.reload()} />
      </View>
    ) : !state.data ? (
      <GText soft style={[{ paddingVertical: 20 }, align]}>{t("Loading…", "جارٍ التحميل…")}</GText>
    ) : !shown.length ? (
      <GText soft style={[{ paddingVertical: 20 }, align]}>{all.length ? t("Turn on a filter to see places.", "فعّل فلترًا لعرض الأماكن.") : t("No stored locations to show.", "لا توجد مواقع محفوظة لعرضها.")}</GText>
    ) : (
      <View style={{ marginTop: 4 }}>
        {shown.map((p) => (
          <Pressable key={p.pin.id} accessibilityRole="button" accessibilityLabel={p.title} onPress={() => select(p)} style={[row, { alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: alpha(g.line, 0.6) }]}>
            <View style={{ width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: layerOf(p.layer).color }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <GText numberOfLines={1} style={[{ fontSize: 15, fontWeight: "700" }, align]}>{p.title}</GText>
              <GText soft numberOfLines={1} style={[{ fontSize: 12 }, align]}>{[t(layerOf(p.layer).en, layerOf(p.layer).ar), p.line].filter(Boolean).join(" · ")}</GText>
            </View>
            <GIcon name="chevron-forward" size={16} flip />
          </Pressable>
        ))}
        {state.data.missing ? <GText soft style={[{ fontSize: 12, paddingTop: 12 }, align]}>{mode === "tow" ? t(`Not on the map (no saved location): ${state.data.missing} companies.`, `غير ظاهرة على الخريطة (بلا موقع محفوظ): ${state.data.missing} شركات.`) : t(`Not on the map (no saved location): ${state.data.missing} shops.`, `غير ظاهرة على الخريطة (بلا موقع محفوظ): ${state.data.missing} متاجر.`)}</GText> : null}
        {!MAPS_AVAILABLE ? <GText soft style={[{ fontSize: 12, paddingTop: 12 }, align]}>{t("The map itself shows in the MOTEXA app on your phone.", "تظهر الخريطة نفسها في تطبيق MOTEXA على هاتفك.")}</GText> : null}
      </View>
    );
  } else {
    header = (
      <View>
        <Pressable accessibilityRole="button" onPress={() => setSel(null)} hitSlop={8} style={[row, { alignItems: "center", gap: 4, minHeight: 32 }]}>
          <GIcon name="arrow-back" size={16} color={g.accentText} flip />
          <GText style={{ color: g.accentText, fontSize: 13, fontWeight: "700" }}>{t("All places", "كل الأماكن")}</GText>
        </Pressable>
        <View style={[row, { alignItems: "center", gap: 12, marginTop: 6 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <GText numberOfLines={2} style={[{ fontSize: 20, fontWeight: "700" }, align]}>{selected.title}</GText>
            <GText soft numberOfLines={2} style={[{ fontSize: 13 }, align]}>{[t(layerOf(selected.layer).en, layerOf(selected.layer).ar), selected.line].filter(Boolean).join(" · ")}</GText>
          </View>
          {selected.status}
        </View>
      </View>
    );
    body = (
      <View style={{ gap: 6, marginTop: 8 }}>
        {selected.details.map((x) => <GText key={x} style={[{ fontSize: 13 }, align]}>{x}</GText>)}
        <GText soft style={{ fontSize: 11, writingDirection: "ltr", textAlign: isArabic ? "right" : "left" }}>{ltr(`${selected.pin.lat.toFixed(5)}, ${selected.pin.lng.toFixed(5)}`)}</GText>
      </View>
    );
    footer = <GButton icon="open-outline" label={t(...selected.open.label)} onPress={() => router.push(selected.open.href as Href)} />;
  }

  const fit = shown.map((p) => [p.pin.lat, p.pin.lng] as [number, number]);
  return (
    <View style={{ flex: 1, backgroundColor: g.page }}>
      {MAPS_AVAILABLE ? (
        <ServiceMap
          height={height}
          pins={shown.map((p) => p.pin)}
          selectedId={sel}
          me={null}
          reduced={reduced}
          fit={fit}
          fitKey={`${mode}:${refit}:${shown.map((p) => p.pin.id).sort().join(",")}`}
          pad={{ top: topH, bottom: inset, left: 0, right: 0 }}
          focus={focus}
          onSelect={(id) => { const p = shown.find((x) => x.pin.id === id); if (p) select(p); }}
          onBackground={() => setSel(null)}
        />
      ) : null}
      {overlay}
      <MapPanel visible snap={snap} onSnap={setSnap} onInset={setInset} header={header} footer={footer}>
        {body}
      </MapPanel>
    </View>
  );
}

function Badge({ text }: { text: string }) {
  const { g } = useGarageTheme();
  return (
    <View style={{ paddingHorizontal: 10, minHeight: 26, justifyContent: "center", borderRadius: 13, backgroundColor: g.tint }}>
      <GText style={{ fontSize: 12, fontWeight: "700" }}>{text}</GText>
    </View>
  );
}
