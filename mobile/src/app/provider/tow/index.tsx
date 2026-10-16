import { router } from "expo-router";
import { VerificationBadge } from "../../../features/shared/blocks";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { Async, Button, Card, Empty, Header, Notice, Screen, useL, useLoad } from "../../../features/shared/ui";
import { towFleetService } from "../../../features/tow/towService";
import { TruckSummary } from "../../../features/tow/truckBits";
import { View } from "react-native";

export default function MyFleet() {
  const user = useSessionUser();
  const { t } = useL();
  const state = useLoad(() => towFleetService.getMyFleet(asActor(user)), [user.id]);

  return (
    <Screen>
      <Header
        brand="MOTEXA TOW"
        title={t("My Trucks", "شاحناتي")}
        subtitle={state.data ? state.data.company.name : undefined}
        signOutButton
      />
      <Async state={state}>
        {({ company, trucks }) => (
          <>
            {company.verification !== "APPROVED" && (
              <View style={{ marginBottom: 12, alignItems: "flex-start" }}>
                <VerificationBadge value={company.verification} prefix={t("Company", "الشركة")} />
              </View>
            )}
            <Button variant="ghost" label={t("Company profile", "ملف الشركة")} icon="business-outline" onPress={() => router.push("/provider/tow/company")} />
            <View style={{ height: 10 }} />
            <Button variant="ghost" label={t("Tow requests", "طلبات السحب")} icon="navigate-outline" onPress={() => router.push("/provider/tow/requests")} />
            <View style={{ height: 10 }} />
            <Button label={t("Add truck", "إضافة شاحنة")} icon="add-circle-outline" onPress={() => router.push("/provider/tow/new")} />
            <View style={{ height: 16 }} />
            {!trucks.length ? (
              <Empty icon="car-sport-outline" text={t("No trucks yet. Add your first truck.", "لا توجد شاحنات بعد. أضف أول شاحنة.")} />
            ) : (
              trucks.map((tr) => (
                <Card key={tr.id} label={tr.plate} onPress={() => router.push(`/provider/tow/${tr.id}`)}>
                  <TruckSummary truck={tr} />
                  {tr.verification === "REJECTED" && tr.rejectionReason ? (
                    <View style={{ marginTop: 12 }}>
                      <Notice tone="danger" icon="close-circle-outline">{tr.rejectionReason}</Notice>
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </>
        )}
      </Async>
    </Screen>
  );
}
