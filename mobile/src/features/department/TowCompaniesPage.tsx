// Tow Admin: Tow companies (the Companies tab). EVERY tow company the admin controls, as a list or on a map, with real status filters
// and search. Data: GET /admin/tow/companies, GET /admin/tow/trucks and the provider review list (documents waiting). The map shows only
// stored coordinates: a company's headquarters and each truck's own base. Nothing is guessed from a city name. Opening a company goes to
// the existing review screen, which holds the documents and the approve / request changes / reject actions.
import { Ionicons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { useMemo, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { useReduced } from "../../motion";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "../shared/maps";
import { review } from "../provider/api";
import { TowCompany, Truck, towAdminService } from "../tow/towService";
import { fmtPoint } from "./LocationRow";
import { truckTypeLabel } from "./departments";
import { Avatar, DButton, DeptPage, Empty, ItemCard, Load, Pill, Section, StatusChip, cardStyle, useDT } from "./ui";

const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const ltr = (v: string) => "⁦" + v + "⁩";

type Company = TowCompany & { truckCount: number; pendingTruckCount: number };
type Filter = "ALL" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
const FILTERS: { k: Filter; en: string; ar: string }[] = [
  { k: "ALL", en: "All", ar: "الكل" },
  { k: "PENDING", en: "Pending", ar: "قيد المراجعة" },
  { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" },
  { k: "APPROVED", en: "Approved", ar: "معتمدة" },
  { k: "REJECTED", en: "Rejected", ar: "مرفوضة" },
];
const expiredDocs = (t: Truck) => t.documents.filter((x) => !!x.expiresAt && new Date(x.expiresAt).getTime() < Date.now()).length;

export function TowCompaniesPage() {
  const d = useDT();
  const { height } = useWindowDimensions();
  const reduced = useReduced();
  const state = useLoad(async () => {
    const [companies, trucks, pending] = await Promise.all([towAdminService.listCompanies(NOACTOR) as Promise<Company[]>, towAdminService.listTrucks(NOACTOR), review.list("TOW", "NEW")]);
    return { companies, trucks, pendingDocs: new Map(pending.map((p) => [p.id, p.pendingDocuments])) };
  }, []);
  const [view, setView] = useState<"list" | "map">("list");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const data = state.data;
  const trucksOf = (id: string) => (data?.trucks ?? []).filter((t) => t.companyId === id);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.companies ?? []).filter((c) => {
      if (filter !== "ALL" && c.verification !== filter) return false;
      if (!needle) return true;
      const hay = [c.name, c.contactName, c.phone, c.city, cityLabel(c.city, true), ...(data?.trucks ?? []).filter((t) => t.companyId === c.id).flatMap((t) => [t.plate, t.make, t.model])].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [data, filter, q]);
  const count = (k: Filter) => (data?.companies ?? []).filter((c) => k === "ALL" || c.verification === k).length;

  // real stored points only: a company's HQ and every truck's own base
  const pins = useMemo(() => {
    const out: (ServicePin & { company: Company; truck?: Truck })[] = [];
    for (const c of shown) {
      if (c.baseLat != null && c.baseLng != null) out.push({ id: `c:${c.id}`, name: c.name, lat: c.baseLat, lng: c.baseLng, kind: "hq", dim: false, company: c });
      for (const t of trucksOf(c.id)) if (t.baseLat != null && t.baseLng != null) out.push({ id: `t:${t.id}`, name: t.plate, lat: t.baseLat, lng: t.baseLng, kind: "tow", dim: t.verification !== "APPROVED", company: c, truck: t });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, data]);
  const selected = pins.find((p) => p.id === sel) ?? null;
  const noHq = shown.filter((c) => c.baseLat == null || c.baseLng == null).length;
  const noTruckPoint = shown.reduce((n, c) => n + trucksOf(c.id).filter((t) => t.baseLat == null || t.baseLng == null).length, 0);

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

  return (
    <DeptPage onRefresh={() => void state.reload()} refreshing={state.loading && !!data}>
      <Section title={d.t("Tow companies", "شركات السحب")} caption={d.t("Every company, its trucks and where they operate from.", "كل شركة وشاحناتها والمكان الذي تعمل منه.")} />
      <View style={{ ...cardStyle(d), flexDirection: d.row, padding: 4, marginBottom: 12 }}>
        {toggle("list", "List", "قائمة", "list-outline")}
        {toggle("map", "Map", "خريطة", "map-outline")}
      </View>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: d.border, backgroundColor: d.dark ? "#3A2E24" : "#FFF8ED", paddingHorizontal: 14, marginBottom: 12 }}>
        <Ionicons name="search-outline" size={20} color={d.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={d.t("Company, owner, phone or plate", "الشركة أو المالك أو الهاتف أو اللوحة")}
          placeholderTextColor={d.muted}
          accessibilityLabel={d.t("Search companies", "بحث في الشركات")}
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
              <Empty icon="search-outline" text={q || filter !== "ALL" ? d.t("Nothing matches.", "لا توجد نتائج مطابقة.") : d.t("No tow companies yet.", "لا توجد شركات سحب بعد.")} />
            ) : (
              shown.map((c) => {
                const trucks = trucksOf(c.id);
                const waiting = data!.pendingDocs.get(c.id) ?? 0;
                const expired = trucks.reduce((n, t) => n + expiredDocs(t), 0);
                return (
                  <ItemCard key={c.id} label={c.name} onPress={() => go(`/dept/review/company/${c.id}`)}>
                    <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                      <Avatar name={c.name} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={2} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{c.name}</Text>
                        <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{[c.contactName, cityLabel(c.city, d.ar)].filter(Boolean).join(" · ")}</Text>
                        {c.phone ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{ltr(c.phone)}</Text> : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      <StatusChip status={c.verification} />
                      <Pill icon="car-sport-outline" label={`${c.truckCount} ${c.truckCount === 1 ? d.t("truck", "شاحنة") : d.t("trucks", "شاحنات")}`} />
                      {c.pendingTruckCount ? <Pill tone="amber" label={`${d.t("Pending trucks", "شاحنات قيد المراجعة")}: ${c.pendingTruckCount}`} /> : null}
                      {waiting ? <Pill tone="amber" icon="document-text-outline" label={`${waiting} ${d.t("documents to review", "مستندات للمراجعة")}`} /> : null}
                      {expired ? <Pill tone="bad" icon="alert-circle-outline" label={`${expired} ${d.t("expired", "منتهية")}`} /> : null}
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <DButton variant="ghost" icon="eye-outline" label={d.t("View company", "عرض الشركة")} onPress={() => go(`/dept/review/company/${c.id}`)} />
                    </View>
                  </ItemCard>
                );
              })
            )
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 14 }}>
                <View style={{ flexDirection: d.row, alignItems: "center", gap: 6 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#5B3C26", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="business" size={13} color="#FFF" />
                  </View>
                  <Text style={{ color: d.muted, fontSize: 12 }}>{d.t("Company HQ", "مقر الشركة")}</Text>
                </View>
                <View style={{ flexDirection: d.row, alignItems: "center", gap: 6 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#B97A3F", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="car-sport" size={13} color="#FFF" />
                  </View>
                  <Text style={{ color: d.muted, fontSize: 12 }}>{d.t("Truck base (grey = not approved)", "موقع شاحنة (رمادي = غير معتمدة)")}</Text>
                </View>
              </View>
              {pins.length === 0 ? (
                <Empty icon="map-outline" text={d.t("No stored locations to show.", "لا توجد مواقع محفوظة لعرضها.")} hint={d.t("Only locations the companies saved are shown.", "تظهر فقط المواقع التي حفظتها الشركات.")} />
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
                      <Ionicons name={p.kind === "hq" ? "business" : "car-sport"} size={18} color={d.accent} />
                      <Text numberOfLines={1} style={{ flex: 1, color: d.ink, fontSize: 13, fontWeight: "700", textAlign: d.align }}>{p.kind === "hq" ? p.name : ltr(p.name)}</Text>
                      <Text style={{ color: d.muted, fontSize: 11, writingDirection: "ltr" }}>{fmtPoint(p.lat, p.lng)}</Text>
                    </InteractiveButton>
                  ))}
                </View>
              )}
              {selected ? (
                <View style={{ ...cardStyle(d), padding: 14, gap: 8 }} accessibilityLiveRegion="polite">
                  <View style={{ flexDirection: d.row, alignItems: "center", gap: 10 }}>
                    <Ionicons name={selected.kind === "hq" ? "business" : "car-sport"} size={22} color={d.accent} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, fontWeight: "800", textAlign: d.align }}>{selected.truck ? `${truckTypeLabel(d.t, selected.truck.type)} · ${ltr(selected.truck.plate)}` : selected.company.name}</Text>
                      <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>
                        {selected.truck ? `${selected.company.name} · ${[selected.truck.make, selected.truck.model].filter(Boolean).join(" ")}` : `${selected.company.contactName} · ${cityLabel(selected.company.city, d.ar)}`}
                      </Text>
                    </View>
                    <StatusChip status={selected.truck ? selected.truck.verification : selected.company.verification} />
                  </View>
                  <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align, writingDirection: "ltr" }}>{selected.truck ? `${selected.truck.locationAddress ? selected.truck.locationAddress + " · " : ""}` : ""}{fmtPoint(selected.lat, selected.lng)}</Text>
                  <View style={{ flexDirection: d.row, gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <DButton variant="ghost" icon="business-outline" label={d.t("View company", "عرض الشركة")} onPress={() => go(`/dept/review/company/${selected.company.id}`)} />
                    </View>
                    {selected.truck ? (
                      <View style={{ flex: 1 }}>
                        <DButton variant="ghost" icon="car-sport-outline" label={d.t("View truck", "عرض الشاحنة")} onPress={() => go(`/dept/review/truck/${selected.truck!.id}`)} />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : pins.length ? (
                <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{d.t("Tap a marker for a summary.", "المس علامة لعرض ملخص.")}</Text>
              ) : null}
              {noHq || noTruckPoint ? (
                <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>
                  {d.t(`Not on the map (no saved location): ${noHq} companies, ${noTruckPoint} trucks.`, `غير ظاهرة على الخريطة (بلا موقع محفوظ): ${noHq} شركات، ${noTruckPoint} شاحنات.`)}
                </Text>
              ) : null}
            </View>
          )
        }
      </Load>
    </DeptPage>
  );
}
