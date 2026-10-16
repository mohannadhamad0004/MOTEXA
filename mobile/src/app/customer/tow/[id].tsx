import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { cityLabel } from "../../../features/shared/cities";
import { C } from "../../../features/shared/palette";
import { Async, Badge, Button, Card, Empty, Header, KV, Notice, Section, Thumb, useL, useLoad } from "../../../features/shared/ui";
import { OperationalBadge, useTruckLabels } from "../../../features/tow/truckBits";

// Customers see approved trucks only, never plate numbers, documents or contact data.
export default function CustomerTowCompany() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align, isArabic } = useL();
  const { type } = useTruckLabels();
  const state = useLoad(() => catalogService.getTowCompany(id), [id]);

  return (
    <CustomerScreen>
      <Header brand="MOTEXA" title={state.data?.company.name ?? t("Tow company", "شركة سحب")} back />
      <Async state={state}>
        {({ company, trucks }) => (
          <>
            <Text style={[{ color: C.textMuted, fontSize: 13, marginBottom: 12 }, align]}>
              {t("Based in", "المقر في")} {company.city}
              {company.address ? ` · ${company.address}` : ""}
            </Text>
            {company.description ? (
              <Card>
                <Text style={[{ color: C.text, fontSize: 13, lineHeight: 20 }, align]}>{company.description}</Text>
              </Card>
            ) : null}
            <Card>
              {company.workingHours ? <KV k={t("Working hours", "ساعات العمل")} v={company.workingHours} /> : null}
              <KV k={t("Approved trucks", "الشاحنات المعتمدة")} v={company.approvedTrucks} />
              <KV k={t("Available now", "المتاحة الآن")} v={company.availableTrucks} />
            </Card>

            {company.serviceCities.length ? (
              <>
                <Section title={t("Service area", "منطقة الخدمة")} />
                <View style={[row, { flexWrap: "wrap", gap: 6, marginBottom: 12 }]}>
                  {company.serviceCities.map((x) => (
                    <Badge key={x} tone="neutral" icon="location-outline" label={cityLabel(x, isArabic)} />
                  ))}
                </View>
              </>
            ) : null}

            <Section title={`${t("Trucks", "الشاحنات")} (${trucks.length})`} />
            {trucks.length ? (
              trucks.map((tr) => (
                <Card key={tr.id}>
                  <View style={[row, { gap: 14, alignItems: "center" }]}>
                    <Thumb uri={tr.photoUri} icon="car-sport-outline" size={64} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{type[tr.type]}</Text>
                      <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                        {[tr.make, tr.model, tr.year].filter(Boolean).join(" ")}
                      </Text>
                      {tr.maxWeightKg ? (
                        <Text style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                          {t("Carries vehicles up to", "تحمل مركبات حتى")} {tr.maxWeightKg} {t("kg", "كغ")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={[row, { marginTop: 12 }]}>
                    <OperationalBadge value={tr.operationalStatus} />
                  </View>
                </Card>
              ))
            ) : (
              <Empty icon="car-outline" text={t("This company has no approved trucks yet.", "لا توجد شاحنات معتمدة لهذه الشركة بعد.")} />
            )}

            <View style={{ height: 8 }} />
            <Button
              disabled={company.availableTrucks === 0}
              icon="navigate-outline"
              label={t("Request a tow", "اطلب سحبًا")}
              onPress={() => router.push({ pathname: "/customer/towrequest/new", params: { companyId: company.id } })}
            />
            {company.availableTrucks === 0 && (
              <View style={{ marginTop: 10 }}>
                <Notice icon="information-circle-outline">{t("No truck is available right now. Please try again later or choose another company.", "لا توجد شاحنة متاحة الآن. حاول لاحقًا أو اختر شركة أخرى.")}</Notice>
              </View>
            )}
          </>
        )}
      </Async>
    </CustomerScreen>
  );
}
