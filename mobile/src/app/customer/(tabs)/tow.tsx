import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Chip, ChipRow } from "../../../features/catalog/catalogBits";
import { TowCompanyRow, catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { C } from "../../../features/shared/palette";
import { Badge, Button, Card, Empty, Header, Notice, SearchBar, Section, Segmented, useL } from "../../../features/shared/ui";
import { Point, distanceLabel, locationMemory } from "../../../features/shared/geo";
import { CompaniesMap, MAPS_AVAILABLE } from "../../../features/shared/maps";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { cityCentre, cityLabel } from "../../../features/shared/cities";
import { useTruckLabels } from "../../../features/tow/truckBits";
import type { TruckType } from "../../../features/tow/towService";

const TRUCK_TYPES: TruckType[] = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"];

export default function CustomerTow() {
  const { t, row, align, isArabic } = useL();
  const { type } = useTruckLabels();
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [truckType, setTruckType] = useState<TruckType | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  // Your position: read only when you tap a button, kept in memory for this session, never tracked.
  const [me, setMe] = useState<Point | null>(locationMemory.current);
  const loc = useCurrentLocation();
  const [sortChoice, setSortChoice] = useState<"nearest" | "available" | "name" | null>(null);
  const sort = sortChoice === "nearest" && !me ? "available" : (sortChoice ?? (me ? "nearest" : "available"));
  const setSort = setSortChoice;
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = !!(city.trim() || name.trim() || truckType || availableOnly);

  const useMyLocation = async () => {
    const p = await loc.locate();
    if (p) {
      setMe(p);
      setSortChoice("nearest");
    }
    return p;
  };
  const nearMe = async () => {
    const p = me ?? (await useMyLocation());
    if (p) {
      setAvailableOnly(true);
      setSortChoice("nearest");
    }
  };
  const forgetLocation = () => {
    locationMemory.current = null;
    setMe(null);
    setSortChoice(null);
  };
  const showAll = () => {
    setCity("");
    setName("");
    setTruckType(null);
    setAvailableOnly(false);
  };
  const [items, setItems] = useState<TowCompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(
    async (mode: "replace" | "refresh") => {
      const mine = ++seq.current;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const r = await catalogService.listTowCompanies({ serviceCity: city, q: name, truckType: truckType ?? undefined, availableOnly, sort, ...(me ? { lat: me.lat, lng: me.lng } : {}) });
        if (mine === seq.current) setItems(r);
      } catch (e: any) {
        if (mine === seq.current) setError(e.message);
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [city, name, truckType, availableOnly, sort, me]
  );

  useEffect(() => {
    const h = setTimeout(() => run("replace"), 350);
    return () => clearTimeout(h);
  }, [run]);

  return (
    <CustomerScreen tabs refreshing={refreshing} onRefresh={() => run("refresh")}>
      <Header brand="MOTEXA" title={t("Tow companies", "شركات السحب")} subtitle={t("Approved companies and their trucks", "الشركات المعتمدة وشاحناتها")} />
      {loc.dialog}
      <View style={{ gap: 10, marginBottom: 12 }}>
        <Button
          variant={me ? "primary" : "ghost"}
          icon="locate-outline"
          label={loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : me ? t("Update my location", "تحديث موقعي") : t("Use my location", "استخدم موقعي")}
          disabled={loc.locating}
          onPress={useMyLocation}
        />
        <Button variant="ghost" icon="flash-outline" label={t("Available now near me", "المتاح الآن قربي")} disabled={loc.locating} onPress={nearMe} />
        {me ? <Button variant="ghost" icon="close-circle-outline" label={t("Stop using my location", "إيقاف استخدام موقعي")} onPress={forgetLocation} /> : null}
      </View>
      <LocationProblem loc={loc} />
      <SearchBar value={name} onChange={setName} placeholder={t("Company name", "اسم الشركة")} />
      <SearchBar value={city} onChange={setCity} placeholder={t("City or service area", "المدينة أو منطقة الخدمة")} />
      <ChipRow>
        <Chip label={t("All types", "كل الأنواع")} on={truckType === null} onPress={() => setTruckType(null)} />
        {TRUCK_TYPES.map((k) => (
          <Chip key={k} label={type[k]} on={truckType === k} onPress={() => setTruckType(truckType === k ? null : k)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip icon="radio-button-on" label={t("Available now", "متاح الآن")} on={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} />
        {me ? <Chip icon="navigate-outline" label={t("Nearest", "الأقرب")} on={sort === "nearest"} onPress={() => setSort("nearest")} /> : null}
        <Chip label={t("Most trucks available", "الأكثر شاحنات متاحة")} on={sort === "available"} onPress={() => setSort("available")} />
        <Chip label={t("Name", "الاسم")} on={sort === "name"} onPress={() => setSort("name")} />
      </ChipRow>

      {MAPS_AVAILABLE ? (
        <View style={{ marginBottom: 12 }}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { key: "list", label: t("List", "قائمة") },
              { key: "map", label: t("Map", "خريطة") },
            ]}
          />
        </View>
      ) : null}

      {view === "map" && MAPS_AVAILABLE && items.length ? (
        <>
          <CompaniesMap
            pins={items.flatMap((c) => {
              const at = c.baseLat !== null && c.baseLng !== null ? { lat: c.baseLat, lng: c.baseLng } : cityCentre(c.city);
              return at ? [{ id: c.id, name: c.name, ...at, free: c.availableTrucks > 0 }] : [];
            })}
            me={me}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {(() => {
            const c = items.find((x) => x.id === selectedId);
            return c ? (
              <Card label={c.name} onPress={() => router.push(`/customer/tow/${c.id}`)}>
                <View style={[row, { alignItems: "center", gap: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{c.name}</Text>
                    <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                      {c.city} · {c.availableTrucks} {t("available", "متاحة")}
                      {c.distanceKm != null ? ` · ${distanceLabel(c.distanceKm, isArabic)}` : ""}
                    </Text>
                  </View>
                  <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
                </View>
              </Card>
            ) : (
              <Text style={[{ color: C.textMuted, fontSize: 12, marginBottom: 12 }, align]}>{t("Tap a pin to see the company. Pins show the company's base, or its city centre when it has not set one.", "اضغط على دبوس لعرض الشركة. تظهر الدبابيس قاعدة الشركة، أو مركز مدينتها إن لم تحدد قاعدة.")}</Text>
            );
          })()}
        </>
      ) : null}

      {loading && !items.length ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={C.accent} />
      ) : error && !items.length ? (
        <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
          <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
          <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run("replace")} />
        </View>
      ) : !items.length ? (
        <>
          <Empty icon="car-outline" text={filtered ? t("No tow companies cover this area yet.", "لا توجد شركات سحب تغطي هذه المنطقة بعد.") : t("No tow companies are available yet.", "لا توجد شركات سحب متاحة بعد.")} />
          {filtered ? <Button variant="ghost" icon="close-circle-outline" label={t("Show all", "عرض الكل")} onPress={showAll} /> : null}
        </>
      ) : view === "map" && MAPS_AVAILABLE ? null : (
        items.map((c) => (
          <Card key={c.id} label={c.name} onPress={() => router.push(`/customer/tow/${c.id}`)}>
            <View style={[row, { alignItems: "flex-start", gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[{ color: C.text, fontSize: 16, fontWeight: "800" }, align]}>{c.name}</Text>
                <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 4 }, align]}>{c.city}</Text>
                {c.distanceKm != null ? <Text numberOfLines={1} style={[{ color: C.accent, fontSize: 12, fontWeight: "800", marginTop: 4 }, align]}>{distanceLabel(c.distanceKm, isArabic)}{c.distanceSource === "city" ? ` · ${t("from the city centre", "من مركز المدينة")}` : ""}</Text> : null}
              </View>
              <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
            </View>
            {c.serviceCities.length ? (
              <Text numberOfLines={2} style={[{ color: C.textMuted, fontSize: 12, marginTop: 10 }, align]}>
                {t("Serves", "تخدم")}: {c.serviceCities.slice(0, 2).map((x) => cityLabel(x, isArabic)).join(isArabic ? "، " : ", ")}
                {c.serviceCities.length > 2 ? ` +${c.serviceCities.length - 2}` : ""}
              </Text>
            ) : null}
            <View style={[row, { flexWrap: "wrap", gap: 6, marginTop: 12 }]}>
              <Badge tone="neutral" icon="car-sport-outline" label={`${c.approvedTrucks} ${c.approvedTrucks === 1 ? t("truck", "شاحنة") : t("trucks", "شاحنات")}`} />
              <Badge tone={c.availableTrucks > 0 ? "success" : "neutral"} icon="radio-button-on" label={`${c.availableTrucks} ${t("available", "متاحة")}`} />
              {c.truckTypes.map((k) => (
                <Badge key={k} tone="accent" label={type[k]} />
              ))}
            </View>
          </Card>
        ))
      )}

      <Section title={t("While you wait", "أثناء الانتظار")} />
      <Card>
        {[
          t("Turn on your hazard lights.", "شغّل أضواء التحذير."),
          t("Stay off the road: wait behind the barrier or well away from traffic.", "ابتعد عن الطريق: انتظر خلف الحاجز أو بعيدًا عن حركة السير."),
          t("Keep your phone charged, and keep it with you.", "أبقِ هاتفك مشحونًا واحتفظ به معك."),
        ].map((tip, i) => (
          <View key={i} style={[row, { alignItems: "flex-start", gap: 10, paddingVertical: 6 }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.accent} style={{ marginTop: 2 }} />
            <Text style={[{ color: C.text, fontSize: 13, lineHeight: 19, flex: 1 }, align]}>{tip}</Text>
          </View>
        ))}
      </Card>
    </CustomerScreen>
  );
}
