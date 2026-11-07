import { DriverCard } from "../../../features/tow/DriverCard";
import { TowPublicProfile } from "../../../features/catalog/TowPublicProfile";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Card, Chip, EmptyState, ErrorState, GarageHero, GaragePage, GButton, GIcon, GText, ListRow, Note, Section, SkeletonBlock, StatusChip, StickyActionBar } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { distanceLabel, getLocationMemory } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSessionUser } from "../../../core/session/session";
import { catalogService } from "../../../features/catalog/catalogService";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { freeDriversOf } from "../../../features/tow/dispatchService";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

// Customers see approved trucks only, never plate numbers, documents or contact data.
export default function CustomerTowCompany() {
  const user = useSessionUser();
  const { g, row, align } = useGarageTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const from = getLocationMemory(user.id)?.point ?? null;
  const state = useLoad(() => catalogService.getTowCompany(id, from), [id, user.id]);
  const co = state.data?.company;
  const trucks = state.data?.trucks ?? [];
  // FREE drivers a customer may ask directly (first name + truck type only)
  const drivers = useLoad(() => freeDriversOf(id), [id], 30_000);
  const opLabel = { AVAILABLE: t("Available", "متاحة"), BUSY: t("Busy", "مشغولة"), OUT_OF_SERVICE: t("Out of service", "خارج الخدمة") };
  const opTone = { AVAILABLE: "success", BUSY: "warning", OUT_OF_SERVICE: "neutral" } as const;

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/tow"))}
          title={co?.name ?? t("Tow company", "شركة سحب")}
          line={co ? [cityLabel(co.city, isArabic), co.address].filter(Boolean).join(" · ") : undefined}
        >
          {co ? (
            <View style={[row, { gap: 6, flexWrap: "wrap" }]}>
              <StatusChip tone="success" icon="shield-checkmark" label={t("Verified by MOTEXA", "موثّقة من موتكسا")} />
              <StatusChip tone={co.availableTrucks > 0 ? "success" : "neutral"} label={co.availableTrucks > 0 ? `${co.availableTrucks} ${co.availableTrucks === 1 ? t("truck free", "شاحنة متاحة") : t("trucks free", "شاحنات متاحة")}` : t("No free truck", "لا توجد شاحنة متاحة")} />
            </View>
          ) : null}
        </GarageHero>
      }
      bottom={
        co ? (
          <StickyActionBar note={co.availableTrucks === 0 ? t("No truck is available right now. Please try again later or choose another company.", "لا توجد شاحنة متاحة الآن. حاول لاحقًا أو اختر شركة أخرى.") : undefined}>
            <GButton flex icon="car-outline" label={t("Request a tow", "اطلب سحبًا")} disabled={co.availableTrucks === 0} onPress={() => router.push({ pathname: "/customer/towrequest/new", params: { companyId: co.id } })} />
          </StickyActionBar>
        ) : undefined
      }
    >
      {state.error && !co ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !co ? (
        <SkeletonBlock height={200} radius={gShape.card} />
      ) : (
        <View>
          <Card pad={12}>
            {co.distanceKm != null ? <ListRow icon="navigate-outline" title={distanceLabel(co.distanceKm, isArabic)} sub={co.distanceSource === "city" ? t("from the city centre", "من مركز المدينة") : undefined} /> : null}
            <ListRow divider={co.distanceKm != null} icon="map-outline" title={t("View on map", "عرض على الخريطة")} onPress={() => router.push({ pathname: "/customer/tow/map", params: { focus: co.id } })} />
          </Card>

          {MAPS_AVAILABLE && co.baseLat !== null && co.baseLng !== null ? (
            <View style={{ marginTop: 12, borderRadius: gShape.card, overflow: "hidden" }}>
              <PinMap point={{ lat: co.baseLat, lng: co.baseLng }} height={160} />
            </View>
          ) : null}

          <TowPublicProfile company={co} trucks={trucks}/>

          {drivers.data?.length ? (
            <Section title={t("Free drivers", "السائقون المتاحون")}>
              <Card pad={12}>
                {drivers.data.map((d) => (
                  <View key={d.id} style={{ marginBottom: 8 }}>
                    <DriverCard d={d} onPress={() => router.push({ pathname: "/customer/towrequest/new", params: { companyId: id, driverId: d.id } })} />
                  </View>
                ))}
              </Card>
              <GText soft style={[gType.caption, align, { marginTop: 6 }]}>{t("Or request the company: it sends whichever driver is free.", "أو اطلب الشركة: ترسل أي سائق متاح.")}</GText>
            </Section>
          ) : null}


          {co.availableTrucks === 0 ? <View style={{ marginTop: 12 }}><Note>{t("Trucks become available again when a job ends. Pull down to refresh.", "تصبح الشاحنات متاحة مجددًا عند انتهاء مهمة. اسحب للأسفل للتحديث.")}</Note></View> : null}
        </View>
      )}
    </GaragePage>
  );
}
