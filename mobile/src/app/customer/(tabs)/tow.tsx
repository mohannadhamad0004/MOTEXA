import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { BlueprintPage, Chip, Icon, Ltr, Odometer, OptionSheet, Press, PrimaryButton, SearchField, TowHero, TOW_HERO_OVERLAP } from "../../../components/blueprint";
import { Button } from "../../../components/ui/Button";
import { EmptyState, Notice } from "../../../components/ui/Feedback";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { Text } from "../../../components/ui/Text";
import { CITIES, cityLabel, cityToEnglish } from "../../../core/constants/cities";
import { Point, locationMemory } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { TowCompanyRow, catalogService } from "../../../features/catalog/catalogService";
import { WhileYouWait } from "../../../features/requests/WhileYouWait";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import type { TruckType } from "../../../features/tow/towService";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { M, useIgnition } from "../../../motion";
import { alpha } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

const TRUCK_TYPES: TruckType[] = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"];
type Sort = "nearest" | "available" | "name";
type Sheet = null | "type" | "city" | "sort";

/** "≈ 7.0 km" (straight line). */
const kmShort = (km: number, ar: boolean) => (km < 1 ? (ar ? "≈ <1 كم" : "≈ <1 km") : `≈ ${km < 10 ? km.toFixed(1) : Math.round(km)} ${ar ? "كم" : "km"}`);

/** A tow company: availability rail, strong name, city and truck types, free-truck count, distance when computed. */
function CompanyRow({ x, i }: { x: TowCompanyRow; i: number }) {
  const { c, row, align } = useTheme();
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const free = x.availableTrucks > 0;
  return (
    <Animated.View entering={i < 8 ? FadeIn.duration(M.entrance).delay(i * M.stagger) : undefined} layout={LinearTransition.duration(M.detail)}>
      <Press
        accessibilityLabel={x.name}
        onPress={() => router.push(`/customer/tow/${x.id}`)}
        style={[row, { alignItems: "stretch", gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: alpha(c.line, 0.6) }]}
      >
        <View style={{ width: 3, borderRadius: 2, backgroundColor: free ? c.bronze : c.line }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 17, fontWeight: "700", lineHeight: isArabic ? 25 : 21 }, align]}>{x.name}</Text>
          <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 13, marginTop: 2 }, align]}>
            {[cityLabel(x.city, isArabic), x.truckTypes.map((k) => type[k]).join(isArabic ? "، " : " · ")].filter(Boolean).join(" · ")}
          </Text>
          <View style={[row, { alignItems: "center", gap: 6, marginTop: 7 }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: free ? c.bronze : c.line }} />
            {free ? <Odometer value={x.availableTrucks} size={13} color={c.bronze} /> : null}
            <Text style={{ color: free ? c.bronze : c.soft, fontSize: 13, fontWeight: "600" }}>
              {free ? (x.availableTrucks === 1 ? t("truck free", "شاحنة متاحة") : t("trucks free", "شاحنات متاحة")) : t("No free truck", "لا توجد شاحنة متاحة")}
            </Text>
            {x.distanceKm != null ? <Ltr style={{ color: c.soft, fontSize: 12 }}>{`· ${kmShort(x.distanceKm, isArabic)}`}</Ltr> : null}
          </View>
        </View>
        <View style={{ justifyContent: "center" }}>
          <Icon name="chev" size={15} color={alpha(c.soft, 0.7)} />
        </View>
      </Press>
    </Animated.View>
  );
}

export default function CustomerTow() {
  const { c, row } = useTheme();
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const ig = useIgnition("tow");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [truckType, setTruckType] = useState<TruckType | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  // Your position: read only when you tap a button, kept in memory for this session, never tracked.
  const [me, setMe] = useState<Point | null>(locationMemory.current);
  const loc = useCurrentLocation();
  const [sortChoice, setSortChoice] = useState<Sort | null>(null);
  const sort: Sort = sortChoice === "nearest" && !me ? "available" : (sortChoice ?? (me ? "nearest" : "available"));
  const filtered = !!(city.trim() || name.trim() || truckType || availableOnly);

  const useMyLocation = async () => {
    const p = await loc.locate();
    if (p) {
      setMe(p);
      setSortChoice("nearest");
    }
    return p;
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

  // "Request nearest available": the closest company that has a free truck, straight into its request form.
  const [nearBusy, setNearBusy] = useState(false);
  const [nearErr, setNearErr] = useState<string | null>(null);
  const requestNearest = async () => {
    setNearErr(null);
    const p = me ?? (await useMyLocation());
    if (!p) return;
    setNearBusy(true);
    try {
      const list = await catalogService.listTowCompanies({ availableOnly: true, sort: "nearest", lat: p.lat, lng: p.lng });
      const best = list[0];
      if (!best) setNearErr(t("No company has a free truck right now. Try again soon.", "لا توجد شركة لديها شاحنة متاحة الآن. حاول مرة أخرى قريبًا."));
      else router.push({ pathname: "/customer/towrequest/new", params: { companyId: best.id } });
    } catch (e: any) {
      setNearErr(e.message);
    } finally {
      setNearBusy(false);
    }
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
        const r = await catalogService.listTowCompanies({ serviceCity: cityToEnglish(city), q: name, truckType: truckType ?? undefined, availableOnly, sort, ...(me ? { lat: me.lat, lng: me.lng } : {}) });
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

  // ---- hero: REAL numbers only ----
  const cityEn = cityToEnglish(city);
  const freeTrucks = items.reduce((n, x) => n + x.availableTrucks, 0);
  const freeCompanies = items.filter((x) => x.availableTrucks > 0).length;
  const nearestFree = me ? items.filter((x) => x.availableTrucks > 0 && x.distanceKm != null).sort((x, y) => (x.distanceKm ?? 0) - (y.distanceKm ?? 0))[0] : undefined;
  const soft = alpha(c.cream, 0.82);
  const lineText = { color: soft, fontSize: 14 } as const;
  const where = me ? t("near you", "بالقرب منك") : cityEn ? `${t("in", "في")} ${cityLabel(cityEn, isArabic)}` : "";
  const heroLine = (
    <View style={[row, { alignItems: "center", flexWrap: "wrap", columnGap: 5 }]}>
      {loading && !items.length ? (
        <Text style={lineText}>{t("Looking for trucks…", "جارٍ البحث عن شاحنات…")}</Text>
      ) : !items.length ? (
        <Text style={lineText}>{t("No tow companies found", "لا توجد شركات سحب")}</Text>
      ) : freeTrucks === 0 ? (
        <Text style={lineText}>{t("No free truck right now", "لا توجد شاحنة متاحة الآن")}</Text>
      ) : where ? (
        <>
          <Odometer value={freeTrucks} size={14} color={c.cream} />
          <Text style={lineText}>{`${freeTrucks === 1 ? t("truck available", "شاحنة متاحة") : t("trucks available", "شاحنات متاحة")} ${where}`}</Text>
        </>
      ) : (
        <>
          <Odometer value={freeCompanies} size={14} color={c.cream} />
          <Text style={lineText}>{freeCompanies === 1 ? t("tow company available", "شركة سحب متاحة") : t("tow companies available", "شركات سحب متاحة")}</Text>
        </>
      )}
    </View>
  );
  const hint = me
    ? nearestFree?.distanceKm != null
      ? `${t("Nearest with a free truck", "الأقرب وفيها شاحنة")} ${kmShort(nearestFree.distanceKm, isArabic)} · ${t("straight line", "خط مستقيم")}`
      : undefined
    : cityEn
      ? undefined
      : t("Choose your location to find nearby towing", "اختر موقعك للعثور على سحب قريب");

  const sortLabel: Record<Sort, string> = { nearest: t("Nearest", "الأقرب"), available: t("Most trucks", "الأكثر شاحنات"), name: t("Name", "الاسم") };
  const cityPillLabel = me ? t("Near me", "بالقرب مني") : cityEn ? cityLabel(cityEn, isArabic) : t("City", "المدينة");

  return (
    <BlueprintPage
      tabs
      ignition={ig}
      overlap={TOW_HERO_OVERLAP}
      refreshing={refreshing}
      onRefresh={() => run("refresh")}
      top={
        <TowHero
          play={ig}
          available={freeTrucks > 0}
          tag="TOW / 02"
          title={t("Tow trucks", "شاحنات السحب")}
          line={heroLine}
          hint={hint}
          primary={{ label: t("Request nearest available", "اطلب أقرب شاحنة"), icon: "tow", loading: nearBusy || loc.locating, onPress: requestNearest }}
          secondary={{ label: t("View map", "الخريطة"), icon: "map", onPress: () => router.push("/customer/tow/map") }}
        />
      }
    >
      {loc.dialog}
      {nearErr ? (
        <View style={{ marginBottom: 12 }}>
          <Notice tone="danger" icon="alert-circle-outline">{nearErr}</Notice>
        </View>
      ) : null}

      <SearchField
        compact
        style={{ height: 46, borderRadius: 14, backgroundColor: "transparent" }}
        value={name}
        onChangeText={setName}
        placeholder={t("Company name", "اسم الشركة")}
      />
      <View style={[row, { marginTop: 10, gap: 8 }]}>
        <Chip check label={t("Available", "متاح")} on={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} />
        <Chip label={truckType ? type[truckType] : t("Type", "النوع")} on={!!truckType} trailing="down" onPress={() => setSheet("type")} />
        <Chip label={cityPillLabel} on={!!cityEn || !!me} trailing="down" onPress={() => setSheet("city")} />
      </View>
      <LocationProblem loc={loc} />

      {items.length ? (
        <View style={[row, { marginTop: 14, alignItems: "center", justifyContent: "space-between" }]}>
          <View style={[row, { alignItems: "center", gap: 4 }]}>
            <Odometer value={items.length} size={13} color={c.soft} />
            <Text style={{ color: c.soft, fontSize: 13 }}>{items.length === 1 ? t("company", "شركة") : t("companies", "شركات")}</Text>
          </View>
          <Press accessibilityLabel={t("Sort", "ترتيب")} onPress={() => setSheet("sort")} style={[row, { minHeight: 40, alignItems: "center", gap: 4, paddingHorizontal: 4 }]}>
            <Text style={{ color: c.ink, fontSize: 13, fontWeight: "600" }}>{sortLabel[sort]}</Text>
            <Icon name="down" size={14} color={c.soft} />
          </Press>
        </View>
      ) : null}

      <View style={{ marginTop: 2 }}>
        {loading && !items.length ? (
          <SkeletonList />
        ) : error && !items.length ? (
          <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
            <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
            <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run("replace")} />
          </View>
        ) : !items.length ? (
          <>
            <EmptyState icon="car-outline" text={filtered ? t("No tow companies cover this area yet.", "لا توجد شركات سحب تغطي هذه المنطقة بعد.") : t("No tow companies are available yet.", "لا توجد شركات سحب متاحة بعد.")} />
            {filtered ? <Button variant="ghost" icon="close-circle-outline" label={t("Show all", "عرض الكل")} onPress={showAll} /> : null}
          </>
        ) : (
          <>
            {error ? (
              <View style={{ gap: 8, marginVertical: 8 }}>
                <Notice tone="danger" icon="alert-circle-outline">{t("Could not refresh. The results below may be out of date.", "تعذّر التحديث. قد تكون النتائج أدناه قديمة.")}</Notice>
                <Button variant="ghost" icon="refresh-outline" label={t("Retry", "إعادة المحاولة")} onPress={() => run("replace")} />
              </View>
            ) : null}
            {items.map((x, i) => (
              <CompanyRow key={x.id} x={x} i={i} />
            ))}
            {items.some((x) => x.distanceKm != null) ? (
              <Text style={{ color: c.soft, fontSize: 11, marginTop: 12, textAlign: isArabic ? "right" : "left" }}>{t("Distances are straight lines, not driving routes.", "المسافات خطوط مستقيمة وليست مسارات قيادة.")}</Text>
            ) : null}
          </>
        )}
      </View>

      {!loading || items.length ? <WhileYouWait /> : null}

      <OptionSheet
        visible={sheet === "type"}
        onClose={() => setSheet(null)}
        title={t("Truck type", "نوع الشاحنة")}
        value={truckType ?? "ANY"}
        options={[{ key: "ANY", label: t("Any type", "أي نوع") }, ...TRUCK_TYPES.map((k) => ({ key: k as string, label: type[k] }))]}
        onSelect={(k) => {
          setTruckType(k === "ANY" ? null : (k as TruckType));
          setSheet(null);
        }}
      />
      <OptionSheet
        visible={sheet === "city"}
        onClose={() => setSheet(null)}
        title={t("Location", "الموقع")}
        value={cityEn || "ALL"}
        header={
          <PrimaryButton
            variant="outline"
            icon="pin"
            label={me ? t("Stop using my location", "إيقاف استخدام موقعي") : loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my location", "استخدم موقعي")}
            onPress={async () => {
              if (me) {
                forgetLocation();
                setSheet(null);
              } else {
                const p = await useMyLocation();
                if (p) setSheet(null);
              }
            }}
          />
        }
        options={[{ key: "ALL", label: t("All cities", "كل المدن") }, ...CITIES.map((x) => ({ key: x.name as string, label: cityLabel(x.name, isArabic) }))]}
        onSelect={(k) => {
          setCity(k === "ALL" ? "" : k);
          setSheet(null);
        }}
      />
      <OptionSheet
        visible={sheet === "sort"}
        onClose={() => setSheet(null)}
        title={t("Sort by", "ترتيب حسب")}
        value={sort}
        options={[...(me ? [{ key: "nearest" as Sort, label: sortLabel.nearest }] : []), { key: "available" as Sort, label: sortLabel.available }, { key: "name" as Sort, label: sortLabel.name }]}
        onSelect={(k) => {
          setSortChoice(k);
          setSheet(null);
        }}
      />
    </BlueprintPage>
  );
}
