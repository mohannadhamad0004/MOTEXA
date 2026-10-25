import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { BlueprintPage, Chip, HStrip, HeroIconButton, IconTile, Mono, Odometer, PageTitle, Press, PrimaryButton, Rise, SearchField, Section, TowTruck } from "../../../components/blueprint";
import { Button } from "../../../components/ui/Button";
import { EmptyState, Notice } from "../../../components/ui/Feedback";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { Text } from "../../../components/ui/Text";
import { cityLabel, cityToEnglish } from "../../../core/constants/cities";
import { Point, locationMemory } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { TowCompanyRow, catalogService } from "../../../features/catalog/catalogService";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import type { TruckType } from "../../../features/tow/towService";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { M, useIgnition } from "../../../motion";
import { useTheme } from "../../../theme/useTheme";

const TRUCK_TYPES: TruckType[] = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"];

/** "≈ 7.0 km" (straight line). */
const kmShort = (km: number, ar: boolean) => (km < 1 ? (ar ? "≈ <1 كم" : "≈ <1 km") : `≈ ${km < 10 ? km.toFixed(1) : Math.round(km)} ${ar ? "كم" : "km"}`);

export default function CustomerTow() {
  const { c, row, align } = useTheme();
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const ig = useIgnition("tow");
  const [city, setCity] = useState("");
  const [showCity, setShowCity] = useState(false);
  const [name, setName] = useState("");
  const [truckType, setTruckType] = useState<TruckType | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  // Your position: read only when you tap a button, kept in memory for this session, never tracked.
  const [me, setMe] = useState<Point | null>(locationMemory.current);
  const loc = useCurrentLocation();
  const [sortChoice, setSortChoice] = useState<"nearest" | "available" | "name" | null>(null);
  const sort = sortChoice === "nearest" && !me ? "available" : (sortChoice ?? (me ? "nearest" : "available"));
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

  const freeNow = items.filter((x) => x.availableTrucks > 0).length;
  const cityTag = city.trim() ? cityLabel(cityToEnglish(city) || city, isArabic) : undefined;

  return (
    <BlueprintPage
      tabs
      ignition={ig}
      refreshing={refreshing}
      onRefresh={() => run("refresh")}
      hero={{
        height: 240,
        tl: "TOW / 02",
        tr: cityTag ?? (me ? t("Near you", "بالقرب منك") : undefined),
        right: <HeroIconButton icon="map" label={t("View on map", "عرض على الخريطة")} onPress={() => router.push("/customer/tow/map")} />,
        art: (
          <View style={{ width: "100%", maxWidth: 300, height: "100%" }}>
            <TowTruck animate={ig} delay={M.grid} />
          </View>
        ),
      }}
    >
      {loc.dialog}
      <PageTitle>{t("Tow trucks", "شاحنات السحب")}</PageTitle>
      <View style={[row, { alignItems: "center", gap: 8, marginTop: 4 }]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: freeNow ? c.bronze : c.line }} />
        {loading && !items.length ? null : <Odometer value={freeNow} size={14} color={c.soft} />}
        <Text style={{ color: c.soft, fontSize: 14 }}>
          {loading && !items.length ? t("Looking for trucks…", "جارٍ البحث عن شاحنات…") : t("available now", "متاح الآن")}
        </Text>
      </View>

      <View style={{ marginTop: 20 }}>
        <PrimaryButton icon="tow" label={t("Request nearest available", "اطلب أقرب شاحنة متاحة")} loading={nearBusy || loc.locating} road onPress={requestNearest} />
      </View>
      <View style={{ marginTop: 10 }}>
        <PrimaryButton variant="outline" icon="map" label={t("View on map", "عرض على الخريطة")} onPress={() => router.push("/customer/tow/map")} />
      </View>
      {nearErr ? (
        <View style={{ marginTop: 12 }}>
          <Notice tone="danger" icon="alert-circle-outline">{nearErr}</Notice>
        </View>
      ) : null}
      <LocationProblem loc={loc} />

      <View style={{ marginTop: 16 }}>
        <HStrip>
          <Chip label={t("Available now", "متاح الآن")} on={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} />
          {TRUCK_TYPES.map((k) => (
            <Chip key={k} label={type[k]} on={truckType === k} onPress={() => setTruckType(truckType === k ? null : k)} />
          ))}
        </HStrip>
      </View>
      <View style={{ marginTop: 8 }}>
        <HStrip>
          <Chip icon="pin" label={me ? t("Update my location", "تحديث موقعي") : t("Use my location", "استخدم موقعي")} on={!!me} onPress={useMyLocation} />
          {me ? <Chip label={t("Nearest", "الأقرب")} on={sort === "nearest"} onPress={() => setSortChoice("nearest")} /> : null}
          <Chip label={t("Most trucks", "الأكثر شاحنات")} on={sort === "available"} onPress={() => setSortChoice("available")} />
          <Chip label={t("Name", "الاسم")} on={sort === "name"} onPress={() => setSortChoice("name")} />
          <Chip icon="search" label={city ? cityLabel(cityToEnglish(city) || city, isArabic) : t("City", "المدينة")} on={showCity || !!city} trailing="down" onPress={() => setShowCity(!showCity)} />
          {me ? <Chip icon="close" label={t("Stop using my location", "إيقاف استخدام موقعي")} onPress={forgetLocation} /> : null}
        </HStrip>
      </View>
      <SearchField style={{ marginTop: 12 }} value={name} onChangeText={setName} placeholder={t("Company name", "اسم الشركة")} />
      {showCity ? <SearchField style={{ marginTop: 8 }} value={city} onChangeText={setCity} placeholder={t("City or service area", "المدينة أو منطقة الخدمة")} /> : null}

      {error && items.length ? (
        <View style={{ gap: 8, marginTop: 16 }}>
          <Notice tone="danger" icon="alert-circle-outline">{t("Could not refresh. The results below may be out of date.", "تعذّر التحديث. قد تكون النتائج أدناه قديمة.")}</Notice>
          <Button variant="ghost" icon="refresh-outline" label={t("Retry", "إعادة المحاولة")} onPress={() => run("replace")} />
        </View>
      ) : null}

      <View style={{ marginTop: 8 }}>
        {loading && !items.length ? (
          <View style={{ marginTop: 8 }}>
            <SkeletonList />
          </View>
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
          items.map((x, i) => (
            <Rise key={x.id} i={i} style={{ marginTop: 12 }}>
              <Press
                accessibilityLabel={x.name}
                onPress={() => router.push(`/customer/tow/${x.id}`)}
                style={[row, { alignItems: "center", gap: 16, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, padding: 16 }]}
              >
                <IconTile icon="tow" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{x.name}</Text>
                  <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12 }, align]}>
                    {[cityLabel(x.city, isArabic), x.truckTypes.map((k) => type[k]).join(isArabic ? "، " : ", ")].filter(Boolean).join(" · ")}
                  </Text>
                  <View style={[row, { alignItems: "center", gap: 4, marginTop: 4 }]}>
                    {x.availableTrucks ? <Odometer value={x.availableTrucks} size={12} color={c.bronze} /> : null}
                    <Text style={{ color: x.availableTrucks ? c.bronze : c.soft, fontSize: 12, fontWeight: "600" }}>
                      {x.availableTrucks
                        ? x.availableTrucks === 1 ? t("truck free", "شاحنة متاحة") : t("trucks free", "شاحنات متاحة")
                        : t("No free truck", "لا توجد شاحنة متاحة")}
                    </Text>
                  </View>
                </View>
                {x.distanceKm != null ? (
                  <View style={{ alignItems: isArabic ? "flex-start" : "flex-end" }}>
                    <Mono color={c.ink} size={13} bold>{kmShort(x.distanceKm, isArabic)}</Mono>
                    {x.distanceSource === "city" ? <Text style={{ color: c.soft, fontSize: 10 }}>{t("city centre", "مركز المدينة")}</Text> : null}
                  </View>
                ) : null}
              </Press>
            </Rise>
          ))
        )}
        {items.some((x) => x.distanceKm != null) ? (
          <Text style={[{ color: c.soft, fontSize: 11, marginTop: 12 }, align]}>{t("Distances are straight lines, not driving routes.", "المسافات خطوط مستقيمة وليست مسارات قيادة.")}</Text>
        ) : null}
      </View>

      <Section n="01" title={t("While you wait", "أثناء الانتظار")}>
        {[
          t("Turn on your hazard lights.", "شغّل أضواء التحذير."),
          t("Stay off the road: wait behind the barrier or well away from traffic.", "ابتعد عن الطريق: انتظر خلف الحاجز أو بعيدًا عن حركة السير."),
          t("Keep your phone charged, and keep it with you.", "أبقِ هاتفك مشحونًا واحتفظ به معك."),
        ].map((tip, i) => (
          <View key={i} style={[row, { alignItems: "flex-start", gap: 12, paddingVertical: 8 }]}>
            <Mono color={c.bronze}>{String(i + 1).padStart(2, "0")}</Mono>
            <Text style={[{ color: c.ink, fontSize: 14, lineHeight: 21, flex: 1 }, align]}>{tip}</Text>
          </View>
        ))}
      </Section>
    </BlueprintPage>
  );
}
