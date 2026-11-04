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

          <Section title={t("The company", "الشركة")}>
            <Card pad={12}>
              {co.description ? <GText style={[gType.bodySm, align, { paddingVertical: 6 }]}>{co.description}</GText> : null}
              {co.workingHours ? <ListRow divider={!!co.description} icon="time-outline" title={t("Working hours", "ساعات العمل")} sub={co.workingHours} /> : null}
              <ListRow divider icon="car-outline" title={t("Approved trucks", "الشاحنات المعتمدة")} end={<GText style={[gType.label, { writingDirection: "ltr" }]}>{String(co.approvedTrucks)}</GText>} />
              <ListRow divider icon="checkmark-circle-outline" title={t("Available now", "المتاحة الآن")} end={<GText style={[gType.label, { writingDirection: "ltr" }]}>{String(co.availableTrucks)}</GText>} />
            </Card>
            {co.serviceCities.length ? (
              <View style={[row, { flexWrap: "wrap", gap: 8, marginTop: 12 }]}>
                {co.serviceCities.map((x) => (
                  <Chip key={x} icon="location-outline" label={cityLabel(x, isArabic)} />
                ))}
              </View>
            ) : null}
          </Section>

          {drivers.data?.length ? (
            <Section title={t("Free drivers", "السائقون المتاحون")}>
              <Card pad={12}>
                {drivers.data.map((d, i) => (
                  <ListRow
                    key={d.id}
                    divider={i > 0}
                    icon="person-circle-outline"
                    title={d.firstName}
                    sub={d.truck ? `${type[d.truck.type]} · ${d.truck.make} ${d.truck.model}` : undefined}
                    end={<GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{t("Request", "اطلب")}</GText>}
                    onPress={() => router.push({ pathname: "/customer/towrequest/new", params: { companyId: id, driverId: d.id } })}
                  />
                ))}
              </Card>
              <GText soft style={[gType.caption, align, { marginTop: 6 }]}>{t("Or request the company: it sends whichever driver is free.", "أو اطلب الشركة: ترسل أي سائق متاح.")}</GText>
            </Section>
          ) : null}

          <Section title={`${t("Trucks", "الشاحنات")} (${trucks.length})`}>
            {trucks.length ? (
              <View style={{ gap: 12 }}>
                {trucks.map((tr) => (
                  <Card key={tr.id} pad={10}>
                    <View style={[row, { gap: 12, alignItems: "center" }]}>
                      <View style={{ width: 76, height: 76, borderRadius: gShape.small, overflow: "hidden", backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
                        {tr.photoUri ? <Image source={{ uri: tr.photoUri }} contentFit="cover" style={{ width: "100%", height: "100%" }} /> : <GIcon name="car-outline" size={26} />}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <GText numberOfLines={1} style={[gType.label, { fontWeight: "800" }, align]}>{type[tr.type]}</GText>
                        <GText soft numberOfLines={1} style={[gType.caption, align]}>{[tr.make, tr.model, tr.year].filter(Boolean).join(" ")}</GText>
                        {tr.maxWeightKg ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${t("Carries vehicles up to", "تحمل مركبات حتى")} ${tr.maxWeightKg} ${isArabic ? "كغ" : "kg"}`}</GText> : null}
                        <View style={{ marginTop: 4 }}>
                          <StatusChip tone={opTone[tr.operationalStatus]} label={opLabel[tr.operationalStatus]} />
                        </View>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState photo="empty.search" text={t("This company has no approved trucks yet.", "لا توجد شاحنات معتمدة لهذه الشركة بعد.")} />
            )}
          </Section>
          {co.availableTrucks === 0 ? <View style={{ marginTop: 12 }}><Note>{t("Trucks become available again when a job ends. Pull down to refresh.", "تصبح الشاحنات متاحة مجددًا عند انتهاء مهمة. اسحب للأسفل للتحديث.")}</Note></View> : null}
        </View>
      )}
    </GaragePage>
  );
}
