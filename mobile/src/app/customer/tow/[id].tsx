import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Icon, Mono, Pill, Row, Section, SimplePage, StickyActionBar } from "../../../components/blueprint";
import { Card } from "../../../components/ui/Card";
import { Async, EmptyState, Notice } from "../../../components/ui/Feedback";
import { ImageTile } from "../../../components/ui/Rows";
import { Text } from "../../../components/ui/Text";
import { cityLabel } from "../../../core/constants/cities";
import { distanceLabel, locationMemory } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService } from "../../../features/catalog/catalogService";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { OperationalBadge, useTruckLabels } from "../../../features/tow/truckBits";
import { useTheme } from "../../../theme/useTheme";

// Customers see approved trucks only, never plate numbers, documents or contact data.
export default function CustomerTowCompany() {
  const { c, row, align } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const state = useLoad(() => catalogService.getTowCompany(id, locationMemory.current), [id]);
  const co = state.data?.company;

  return (
    <SimplePage
      kind="tow"
      back="/customer/tow"
      tl="TOW / 02"
      tr={co ? cityLabel(co.city, isArabic) : undefined}
      title={co?.name ?? t("Tow company", "شركة سحب")}
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      footer={
        co ? (
          <StickyActionBar
            icon="tow"
            label={t("Request a tow", "اطلب سحبًا")}
            disabled={co.availableTrucks === 0}
            onPress={() => router.push({ pathname: "/customer/towrequest/new", params: { companyId: co.id } })}
          />
        ) : undefined
      }
    >
      <Async state={state}>
        {({ company, trucks }) => (
          <>
            <Text style={[{ color: c.soft, fontSize: 14, marginTop: 8 }, align]}>
              {t("Based in", "المقر في")} {cityLabel(company.city, isArabic)}
              {company.address ? ` · ${company.address}` : ""}
            </Text>
            {company.distanceKm != null ? (
              <Text style={[{ color: c.bronze, fontSize: 13, fontWeight: "700", marginTop: 8 }, align]}>
                {distanceLabel(company.distanceKm, isArabic)}
                {company.distanceSource === "city" ? ` · ${t("from the city centre", "من مركز المدينة")}` : ""}
              </Text>
            ) : null}
            {company.availableTrucks === 0 ? (
              <View style={{ marginTop: 16 }}>
                <Notice icon="information-circle-outline">{t("No truck is available right now. Please try again later or choose another company.", "لا توجد شاحنة متاحة الآن. حاول لاحقًا أو اختر شركة أخرى.")}</Notice>
              </View>
            ) : null}

            {MAPS_AVAILABLE && company.baseLat !== null && company.baseLng !== null ? (
              <View style={{ marginTop: 20 }}>
                <PinMap point={{ lat: company.baseLat, lng: company.baseLng }} height={160} />
              </View>
            ) : null}

            <Section n="01" title={t("The company", "الشركة")}>
              {company.description ? <Text style={[{ color: c.ink, fontSize: 14, lineHeight: 22, marginBottom: 8 }, align]}>{company.description}</Text> : null}
              {company.workingHours ? <Row label={t("Working hours", "ساعات العمل")} value={company.workingHours} /> : null}
              <Row label={t("Approved trucks", "الشاحنات المعتمدة")} value={String(company.approvedTrucks)} mono />
              <Row label={t("Available now", "المتاحة الآن")} value={String(company.availableTrucks)} mono />
              {company.serviceCities.length ? (
                <View style={[row, { flexWrap: "wrap", gap: 8, marginTop: 16 }]}>
                  {company.serviceCities.map((x) => (
                    <Pill key={x} icon={<Icon name="pin" size={14} color={c.bronze} />}>{cityLabel(x, isArabic)}</Pill>
                  ))}
                </View>
              ) : null}
            </Section>

            <Section n="02" title={`${t("Trucks", "الشاحنات")} (${trucks.length})`}>
              {trucks.length ? (
                trucks.map((tr) => (
                  <Card key={tr.id}>
                    <View style={[row, { gap: 14, alignItems: "center" }]}>
                      <ImageTile uri={tr.photoUri} icon="car-sport-outline" size={64} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={[{ color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{type[tr.type]}</Text>
                        <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12, marginTop: 3 }, align]}>
                          {[tr.make, tr.model, tr.year].filter(Boolean).join(" ")}
                        </Text>
                        {tr.maxWeightKg ? (
                          <View style={[row, { gap: 4, marginTop: 3, alignItems: "baseline" }]}>
                            <Text style={{ color: c.soft, fontSize: 12 }}>{t("Carries vehicles up to", "تحمل مركبات حتى")}</Text>
                            <Mono size={12}>{`${tr.maxWeightKg} ${isArabic ? "كغ" : "kg"}`}</Mono>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={[row, { marginTop: 12 }]}>
                      <OperationalBadge value={tr.operationalStatus} />
                    </View>
                  </Card>
                ))
              ) : (
                <EmptyState icon="car-outline" text={t("This company has no approved trucks yet.", "لا توجد شاحنات معتمدة لهذه الشركة بعد.")} />
              )}
            </Section>
          </>
        )}
      </Async>
    </SimplePage>
  );
}
