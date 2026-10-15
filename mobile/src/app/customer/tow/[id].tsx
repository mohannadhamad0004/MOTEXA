import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { C } from "../../../features/shared/palette";
import { Async, Button, Card, Empty, Header, KV, Notice, Section, Thumb, useL, useLoad } from "../../../features/shared/ui";
import { OperationalBadge, useTruckLabels } from "../../../features/tow/truckBits";

// Customers see approved trucks only, never plate numbers, documents or contact data.
export default function CustomerTowCompany() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align } = useL();
  const { type } = useTruckLabels();
  const state = useLoad(() => catalogService.getTowCompany(id), [id]);

  return (
    <CustomerScreen>
      <Header brand="MOTEXA" title={state.data?.company.name ?? t("Tow company", "شركة سحب")} back />
      <Async state={state}>
        {({ company, trucks }) => (
          <>
            <Card>
              <KV k={t("City", "المدينة")} v={company.city} />
              <KV k={t("Approved trucks", "الشاحنات المعتمدة")} v={company.approvedTrucks} />
              <KV k={t("Available now", "المتاحة الآن")} v={company.availableTrucks} />
            </Card>

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
