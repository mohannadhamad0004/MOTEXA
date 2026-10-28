// Parts Admin: Parts shops (the Shops tab). EVERY parts shop account the admin controls, as a list or on a map, with real status filters
// and search. Data: GET /admin/parts/shops (all shops, not paginated, so filters, counts and search are complete) and the provider review
// list (documents waiting). One account = one physical shop, so the map has one marker per saved shop location; nothing is guessed from
// a city. Opening a shop goes to the existing review screen, which holds the documents and the approve / request changes / reject actions.
import { Ionicons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { api } from "../../core/config/api";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { useReduced } from "../../motion";
import { MAPS_AVAILABLE, ServiceMap } from "../shared/maps";
import { review } from "../provider/api";
import type { Verification } from "../parts/partsService";
import { fmtPoint } from "./LocationRow";
import { Avatar, DButton, DeptPage, Empty, ItemCard, Load, Pill, Section, StatusChip, cardStyle, useDT } from "./ui";

const go = (path: string) => router.push(path as Href);
const ltr = (v: string) => "⁦" + v + "⁩";

type Shop = {
  id: string;
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  city: string;
  address: string | null;
  verificationStatus: Verification;
  baseLat: number | null;
  baseLng: number | null;
  locationAddress: string | null;
  brandName: string | null;
  branchName: string | null;
  categories: string[];
  productCount: number;
  hiddenProductCount: number;
};
type Filter = "ALL" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
const FILTERS: { k: Filter; en: string; ar: string }[] = [
  { k: "ALL", en: "All", ar: "الكل" },
  { k: "PENDING", en: "Pending", ar: "قيد المراجعة" },
  { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" },
  { k: "APPROVED", en: "Approved", ar: "معتمدة" },
  { k: "REJECTED", en: "Rejected", ar: "مرفوضة" },
];
const CATEGORY = new Map(CATALOG_GROUPS.flatMap((g) => g.categories).map((c) => [c.key, c]));
/** the localized label of a category key (never the raw key) */
const catLabel = (k: string, ar: boolean) => {
  const c = CATEGORY.get(k);
  return c ? (ar ? c.ar : c.en) : "";
};

export function PartsShopsPage() {
  const d = useDT();
  const { height } = useWindowDimensions();
  const reduced = useReduced();
  const state = useLoad(async () => {
    const [shops, pending] = await Promise.all([api<{ shops: Shop[] }>("GET", "/admin/parts/shops").then((r) => r.shops), review.list("PARTS", "NEW")]);
    return { shops, pendingDocs: new Map(pending.map((p) => [p.id, p.pendingDocuments])) };
  }, []);
  const [view, setView] = useState<"list" | "map">("list");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const data = state.data;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.shops ?? []).filter((s) => {
      if (filter !== "ALL" && s.verificationStatus !== filter) return false;
      if (!needle) return true;
      return [s.shopName, s.brandName, s.branchName, s.ownerName, s.phone, s.city, cityLabel(s.city, true)].join(" ").toLowerCase().includes(needle);
    });
  }, [data, filter, q]);
  const count = (k: Filter) => (data?.shops ?? []).filter((s) => k === "ALL" || s.verificationStatus === k).length;

  // real stored points only: one marker per shop that saved a location
  const pins = useMemo(() => shown.filter((s) => s.baseLat != null && s.baseLng != null).map((s) => ({ id: s.id, name: s.shopName, lat: s.baseLat!, lng: s.baseLng!, kind: "shop" as const, dim: s.verificationStatus !== "APPROVED", shop: s })), [shown]);
  const selected = pins.find((p) => p.id === sel)?.shop ?? null;
  const noPoint = shown.length - pins.length;

  const toggle = (k: "list" | "map", en: string, ar: string, icon: keyof typeof Ionicons.glyphMap) => (
    <InteractiveButton
      key={k}
      accessibilityRole="button"
      accessibilityState={{ selected: view === k }}
      onPress={() => setView(k)}
      style={{ flex: 1, minHeight: 40, borderRadius: 20, flexDirection: d.row, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: view === k ? "#E0A36F" : "transparent" }}
    >
      <Ionicons name={icon} size={17} color={view === k ? "#332218" : d.muted} />
      <Text style={{ color: view === k ? "#332218" : d.ink, fontSize: 13, fontWeight: "700" }}>{d.t(en, ar)}</Text>
    </InteractiveButton>
  );

  const labels = (s: Shop) => s.categories.map((k) => catLabel(k, d.ar)).filter(Boolean);
  /** shop name, then brand · branch on its own line so a long name never squeezes the rest */
  const Names = ({ s }: { s: Shop }) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={2} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{s.shopName}</Text>
      {s.brandName || s.branchName ? <Text numberOfLines={2} style={{ color: d.accent, fontSize: 12, lineHeight: 19, fontWeight: "700", textAlign: d.align }}>{[s.brandName, s.branchName].filter(Boolean).join(" · ")}</Text> : null}
      <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{[s.ownerName, cityLabel(s.city, d.ar)].filter(Boolean).join(" · ")}</Text>
      {s.phone ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{ltr(s.phone)}</Text> : null}
    </View>
  );

  return (
    <DeptPage onRefresh={() => void state.reload()} refreshing={state.loading && !!data}>
      <Section title={d.t("Parts shops", "متاجر قطع الغيار")} caption={d.t("Every shop account: one account is one physical shop or branch.", "كل حساب متجر: الحساب الواحد هو متجر أو فرع فعلي واحد.")} />
      <View style={{ ...cardStyle(d), flexDirection: d.row, padding: 4, marginBottom: 12 }}>
        {toggle("list", "List", "قائمة", "list-outline")}
        {toggle("map", "Map", "خريطة", "map-outline")}
      </View>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: d.border, backgroundColor: d.dark ? "#3A2E24" : "#FFF8ED", paddingHorizontal: 14, marginBottom: 12 }}>
        <Ionicons name="search-outline" size={20} color={d.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={d.t("Shop, brand, owner, phone or city", "المتجر أو العلامة أو المالك أو الهاتف أو المدينة")}
          placeholderTextColor={d.muted}
          accessibilityLabel={d.t("Search shops", "بحث في المتاجر")}
          style={{ flex: 1, minHeight: 46, color: d.ink, textAlign: d.align }}
        />
      </View>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <InteractiveButton
            key={f.k}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.k }}
            onPress={() => setFilter(f.k)}
            style={{ paddingHorizontal: 14, minHeight: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: filter === f.k ? "#E0A36F" : d.border, backgroundColor: filter === f.k ? "#E0A36F" : "transparent" }}
          >
            <Text style={{ color: filter === f.k ? "#332218" : d.ink, fontSize: 13, fontWeight: "600" }}>
              {d.t(f.en, f.ar)}
              {data ? ` (${count(f.k)})` : ""}
            </Text>
          </InteractiveButton>
        ))}
      </View>

      <Load state={state}>
        {() =>
          view === "list" ? (
            shown.length === 0 ? (
              <Empty icon="search-outline" text={q || filter !== "ALL" ? d.t("Nothing matches.", "لا توجد نتائج مطابقة.") : d.t("No parts shops yet.", "لا توجد متاجر بعد.")} />
            ) : (
              shown.map((s) => {
                const waiting = data!.pendingDocs.get(s.id) ?? 0;
                const cats = labels(s);
                return (
                  <ItemCard key={s.id} label={s.shopName} onPress={() => go(`/dept/review/shop/${s.id}`)}>
                    <View style={{ flexDirection: d.row, alignItems: "flex-start", gap: 12 }}>
                      <Avatar name={s.shopName} />
                      <Names s={s} />
                    </View>
                    <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      <StatusChip status={s.verificationStatus} />
                      {s.verificationStatus === "APPROVED" ? <Pill icon="cube-outline" label={`${s.productCount} ${s.productCount === 1 ? d.t("product", "منتج") : d.t("products", "منتجات")}`} /> : null}
                      {waiting ? <Pill tone="amber" icon="document-text-outline" label={`${waiting} ${d.t("documents to review", "مستندات للمراجعة")}`} /> : null}
                    </View>
                    {cats.length ? (
                      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {cats.slice(0, 3).map((c) => (
                          <Pill key={c} tone="bronze" label={c} />
                        ))}
                        {cats.length > 3 ? <Pill label={`+${cats.length - 3}`} /> : null}
                      </View>
                    ) : null}
                    <View style={{ marginTop: 10 }}>
                      <DButton variant="ghost" icon="eye-outline" label={d.t("View shop", "عرض المتجر")} onPress={() => go(`/dept/review/shop/${s.id}`)} />
                    </View>
                  </ItemCard>
                );
              })
            )
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: d.row, alignItems: "center", gap: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#B97A3F", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="storefront" size={13} color="#FFF" />
                </View>
                <Text style={{ color: d.muted, fontSize: 12 }}>{d.t("Parts shop (grey = not approved)", "متجر قطع غيار (رمادي = غير معتمد)")}</Text>
              </View>
              {pins.length === 0 ? (
                <Empty icon="map-outline" text={d.t("No stored locations to show.", "لا توجد مواقع محفوظة لعرضها.")} hint={d.t("Only locations the shops saved are shown.", "تظهر فقط المواقع التي حفظتها المتاجر.")} />
              ) : MAPS_AVAILABLE ? (
                <View style={{ height: Math.min(460, Math.round(height * 0.5)), borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: d.border }}>
                  <ServiceMap
                    pins={pins.map(({ id, name, lat, lng, kind, dim }) => ({ id, name, lat, lng, kind, dim }))}
                    selectedId={sel}
                    me={null}
                    fit={pins.map((p) => [p.lat, p.lng] as [number, number])}
                    fitKey={`${filter}|${q}|${pins.length}`}
                    pad={{ top: 0, bottom: 0, left: 0, right: 0 }}
                    reduced={reduced}
                    onSelect={setSel}
                    onBackground={() => setSel(null)}
                    height={Math.min(460, Math.round(height * 0.5))}
                  />
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t("The map is shown in the MOTEXA app on your phone. These are the stored locations:", "تظهر الخريطة في تطبيق MOTEXA على هاتفك. هذه هي المواقع المحفوظة:")}</Text>
                  {pins.map((p) => (
                    <InteractiveButton
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={p.name}
                      onPress={() => setSel(p.id)}
                      style={{ ...cardStyle(d, sel === p.id ? "warn" : undefined), flexDirection: d.row, alignItems: "center", gap: 10, padding: 10 }}
                    >
                      <Ionicons name="storefront" size={18} color={d.accent} />
                      <Text numberOfLines={1} style={{ flex: 1, color: d.ink, fontSize: 13, fontWeight: "700", textAlign: d.align }}>{p.name}</Text>
                      <Text style={{ color: d.muted, fontSize: 11, writingDirection: "ltr" }}>{fmtPoint(p.lat, p.lng)}</Text>
                    </InteractiveButton>
                  ))}
                </View>
              )}
              {selected ? (
                <View style={{ ...cardStyle(d), padding: 14, gap: 8 }} accessibilityLiveRegion="polite">
                  <View style={{ flexDirection: d.row, alignItems: "flex-start", gap: 10 }}>
                    <Ionicons name="storefront" size={22} color={d.accent} />
                    <Names s={selected} />
                    <StatusChip status={selected.verificationStatus} />
                  </View>
                  {labels(selected).length ? (
                    <Text numberOfLines={2} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{labels(selected).slice(0, 4).join(d.ar ? "، " : ", ")}{labels(selected).length > 4 ? ` +${labels(selected).length - 4}` : ""}</Text>
                  ) : null}
                  <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align, writingDirection: "ltr" }}>{fmtPoint(selected.baseLat!, selected.baseLng!)}</Text>
                  <DButton variant="ghost" icon="eye-outline" label={d.t("View shop", "عرض المتجر")} onPress={() => go(`/dept/review/shop/${selected.id}`)} />
                </View>
              ) : pins.length ? (
                <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{d.t("Tap a marker for a summary.", "المس علامة لعرض ملخص.")}</Text>
              ) : null}
              {noPoint ? (
                <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t(`Not on the map (no saved location): ${noPoint} shops.`, `غير ظاهرة على الخريطة (بلا موقع محفوظ): ${noPoint} متاجر.`)}</Text>
              ) : null}
            </View>
          )
        }
      </Load>
    </DeptPage>
  );
}
