import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Card, Chip, EmptyState, ErrorState, GaragePage, HeroLayout, GButton, GIcon, GText, ListRow, Note, OptionSheet, SearchBar, SkeletonRows, StatusChip, Tap } from "../../../components/garage";
import { CITIES, cityLabel, cityToEnglish } from "../../../core/constants/cities";
import { clearLocationMemory, Point } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useSessionUser } from "../../../core/session/session";
import { TowCompanyRow, catalogService } from "../../../features/catalog/catalogService";
import { RatingText } from "../../../features/tow/DriverCard";
import { WhileYouWait } from "../../../features/requests/WhileYouWait";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import type { TruckType } from "../../../features/tow/towService";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const TRUCK_TYPES: TruckType[] = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"];
type Sort = "nearest" | "available" | "name";
type Sheet = null | "type" | "city" | "sort";

/** "≈ 7.0 km" (straight line). */
const kmShort = (km: number, ar: boolean) => (km < 1 ? (ar ? "≈ <1 كم" : "≈ <1 km") : `≈ ${km < 10 ? km.toFixed(1) : Math.round(km)} ${ar ? "كم" : "km"}`);

/** A tow company: name, real availability chip, truck types, distance when computed; View + Request (only with a free truck). */
function CompanyCard({ x }: { x: TowCompanyRow }) {
  const { g, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const free = x.availableTrucks > 0;
  return (
    <Card>
      <View style={[row, { alignItems: "flex-start", gap: 10 }]}>
        <View style={{ width: 44, height: 44, borderRadius: gShape.small, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
          <GIcon name="car-outline" size={22} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[row, { alignItems: "center", gap: 6 }]}>
            <GText numberOfLines={2} style={[gType.label, { fontWeight: "800", fontSize: 16, flexShrink: 1 }, align]}>{x.name}</GText>
            {x.verified ? <GIcon name="checkmark-circle" size={16} color={g.success} /> : null}
            {x.rating ? <RatingText rating={x.rating} /> : null}
          </View>
          <View style={[row, { alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 2 }]}>
            <GIcon name="location-outline" size={13} color={g.soft} />
            <GText soft numberOfLines={1} style={[gType.caption, { flexShrink: 1 }]}>{cityLabel(x.city, isArabic)}</GText>
            {x.distanceKm != null ? <GText soft style={[gType.caption, { writingDirection: "ltr" }]}>{`· ${kmShort(x.distanceKm, isArabic)}`}</GText> : null}
          </View>
          {x.truckTypes.length ? <GText soft numberOfLines={2} style={[gType.caption, align, { marginTop: 2 }]}>{x.truckTypes.map((k) => type[k]).join(isArabic ? "، " : " · ")}</GText> : null}
          <View style={{ marginTop: 8 }}>
            <StatusChip
              tone={free ? "success" : "neutral"}
              icon={free ? "checkmark-circle" : "time-outline"}
              label={free ? `${x.availableTrucks} ${x.availableTrucks === 1 ? t("truck free", "شاحنة متاحة") : t("trucks free", "شاحنات متاحة")}` : t("No free truck", "لا توجد شاحنة متاحة")}
            />
            {x.freeDrivers !== undefined ? <GText soft style={[gType.caption, align, { marginTop: 4 }]}>{t(`${x.freeDrivers} free drivers`, `${x.freeDrivers} سائقين متاحين`)}</GText> : null}
          </View>
        </View>
      </View>
      <View style={[row, { gap: 10, marginTop: 14 }]}>
        <GButton flex variant="secondary" label={t("View", "عرض")} onPress={() => router.push(`/customer/tow/${x.id}`)} />
        {free ? <GButton flex icon="car-outline" label={t("Request", "اطلب")} onPress={() => router.push({ pathname: "/customer/towrequest/new", params: { companyId: x.id } })} /> : null}
      </View>
    </Card>
  );
}

export default function CustomerTow() {
  const user = useSessionUser();
  const { g, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [truckType, setTruckType] = useState<TruckType | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  // Your position is read only when you tap a button; it is never tracked from this list screen.
  const [me, setMe] = useState<Point | null>(null);
  const loc = useCurrentLocation("tow-request", user.id);
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
    clearLocationMemory(user.id);
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
  // the server picks the nearest FREE driver from the pickup point you give in the form
  const requestNearest = async () => {
    setNearErr(null);
    setNearBusy(false);
    router.push({ pathname: "/customer/towrequest/new", params: { mode: "NEAREST" } });
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
  const nearestFree = me ? items.filter((x) => x.availableTrucks > 0 && x.distanceKm != null).sort((x, y) => (x.distanceKm ?? 0) - (y.distanceKm ?? 0))[0] : undefined;
  const line =
    loading && !items.length
      ? t("Looking for trucks…", "جارٍ البحث عن شاحنات…")
      : !items.length
        ? t("No tow companies found", "لا توجد شركات سحب")
        : freeTrucks === 0
          ? t("No free truck right now", "لا توجد شاحنة متاحة الآن")
          : !me
            ? t("Turn on location to find the nearest", "شغّل الموقع لإيجاد الأقرب")
            : [
                `${freeTrucks} ${freeTrucks === 1 ? t("truck free", "شاحنة متاحة") : t("trucks free", "شاحنات متاحة")}`,
                nearestFree?.distanceKm != null ? `${t("nearest", "الأقرب")} ${kmShort(nearestFree.distanceKm, isArabic)}` : null,
              ]
                .filter(Boolean)
                .join(" · ");

  const sortLabel: Record<Sort, string> = { nearest: t("Nearest", "الأقرب"), available: t("Most trucks", "الأكثر شاحنات"), name: t("Name", "الاسم") };
  const cityPillLabel = me ? t("Near me", "بالقرب مني") : cityEn ? cityLabel(cityEn, isArabic) : t("City", "المدينة");

  return (
    <GaragePage
      tabs
      entry="tow"
      refreshing={refreshing}
      onRefresh={() => run("refresh")}
      hero={
        <HeroLayout
          config={{
            tab: "tow",
            title: t("Tow trucks", "شاحنات السحب"),
            line,
            action: { kind: "button", icon: "navigate", label: t("Request nearest", "اطلب الأقرب"), busy: nearBusy || loc.locating, onPress: requestNearest },
          }}
        />
      }
    >
      {loc.dialog}
      <Card pad={12}>
        <GText style={[gType.label, { fontWeight: "800", marginBottom: 4 }, align]}>{t("How do you want your tow?", "كيف تريد السحب؟")}</GText>
        <ListRow icon="navigate-outline" title={t("Nearest available", "الأقرب المتاح")} sub={t("We offer it to the nearest free driver.", "نعرضه على أقرب سائق متاح.")} onPress={requestNearest} />
        <ListRow divider icon="business-outline" title={t("Choose a company", "اختر شركة")} sub={t("Pick from the companies below.", "اختر من الشركات أدناه.")} />
        <ListRow divider icon="person-outline" title={t("Choose a driver", "اختر سائقًا")} sub={t("See free drivers near you.", "شاهد السائقين المتاحين بالقرب منك.")} onPress={() => router.push("/customer/tow/drivers")} />
      </Card>
      {nearErr ? <Note tone="danger" icon="alert-circle-outline">{nearErr}</Note> : null}

      <SearchBar value={name} onChangeText={setName} placeholder={t("Company name", "اسم الشركة")} />
      <View style={[row, { marginTop: 12, gap: 8, flexWrap: "wrap" }]}>
        <Chip icon={availableOnly ? "checkmark" : undefined} label={t("Available", "متاح")} on={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} />
        <Chip icon="chevron-down" label={truckType ? type[truckType] : t("Type", "النوع")} on={!!truckType} onPress={() => setSheet("type")} />
        <Chip icon="location-outline" label={cityPillLabel} on={!!cityEn || !!me} onPress={() => setSheet("city")} />
      </View>
      <LocationProblem loc={loc} />

      {items.length ? (
        <View style={[row, { marginTop: 14, alignItems: "center", justifyContent: "space-between" }]}>
          <GText soft style={[gType.caption, { fontWeight: "700" }]}>{`${items.length} ${items.length === 1 ? t("company", "شركة") : t("companies", "شركات")}`}</GText>
          <Tap label={t("Sort", "ترتيب")} onPress={() => setSheet("sort")} style={[row, { minHeight: 44, alignItems: "center", gap: 4, paddingHorizontal: 4 }]}>
            <GIcon name="swap-vertical-outline" size={16} />
            <GText style={[gType.caption, { fontWeight: "800", color: g.accentText }]}>{sortLabel[sort]}</GText>
          </Tap>
        </View>
      ) : null}

      <View style={{ marginTop: 8, gap: 12 }}>
        {loading && !items.length ? (
          <SkeletonRows count={3} />
        ) : error && !items.length ? (
          <ErrorState text={error} onRetry={() => run("replace")} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !items.length ? (
          <EmptyState
            photo="empty.search"
            text={filtered ? t("No tow companies cover this area yet.", "لا توجد شركات سحب تغطي هذه المنطقة بعد.") : t("No tow companies are available yet.", "لا توجد شركات سحب متاحة بعد.")}
            action={filtered ? { label: t("Show all", "عرض الكل"), onPress: showAll } : undefined}
          />
        ) : (
          <>
            {error ? <Note tone="danger" icon="alert-circle-outline">{t("Could not refresh. The results below may be out of date.", "تعذّر التحديث. قد تكون النتائج أدناه قديمة.")}</Note> : null}
            {items.map((x) => (
              <CompanyCard key={x.id} x={x} />
            ))}
            {items.some((x) => x.distanceKm != null) ? <GText soft style={[gType.tiny, { textAlign: isArabic ? "right" : "left" }]}>{t("Distances are straight lines, not driving routes.", "المسافات خطوط مستقيمة وليست مسارات قيادة.")}</GText> : null}
          </>
        )}
      </View>

      {!loading || items.length ? <WhileYouWait /> : null}

      <OptionSheet
        visible={sheet === "type"}
        onClose={() => setSheet(null)}
        closeLabel={t("Close", "إغلاق")}
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
        closeLabel={t("Close", "إغلاق")}
        title={t("Location", "الموقع")}
        value={cityEn || "ALL"}
        header={
          <GButton
            variant="secondary"
            icon="navigate-outline"
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
        closeLabel={t("Close", "إغلاق")}
        title={t("Sort by", "ترتيب حسب")}
        value={sort}
        options={[...(me ? [{ key: "nearest" as Sort, label: sortLabel.nearest }] : []), { key: "available" as Sort, label: sortLabel.available }, { key: "name" as Sort, label: sortLabel.name }]}
        onSelect={(k) => {
          setSortChoice(k);
          setSheet(null);
        }}
      />
    </GaragePage>
  );
}
