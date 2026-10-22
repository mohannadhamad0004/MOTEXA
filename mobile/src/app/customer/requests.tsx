import { Async, EmptyState } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Card";
import { Header } from "../../components/layout/DashboardLayout";
import { Segmented } from "../../components/ui/Chip";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { Screen } from "../../components/layout/Screen";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { InquiryStatusBadge, TowStatusBadge, fmtDateTime } from "../../features/requests/requestBits";
import { customerInquiries, customerTowRequests } from "../../features/requests/requestsService";
import { MechanicStatusBadge } from "../../features/mechanics/mechanicBits";
import { customerMechanicRequests } from "../../features/mechanics/mechanicsService";

type Tab = "QUESTIONS" | "TOW" | "MECHANIC";

// "My requests": the customer's part questions, tow requests and mechanic service requests. Pull down to refresh.
export default function MyRequests() {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const [tab, setTab] = useState<Tab>("QUESTIONS");
  const questions = useLoad(() => customerInquiries.list(), []);
  const tows = useLoad(() => customerTowRequests.list(), []);
  const mechs = useLoad(() => customerMechanicRequests.list(), []);
  const cur = tab === "QUESTIONS" ? questions : tab === "TOW" ? tows : mechs;

  return (
    <Screen
      onRefresh={() => {
        questions.reload();
        tows.reload();
        mechs.reload();
      }}
      refreshing={cur.loading && !!cur.data}
    >
      <Header brand="MOTEXA" title={t("My requests", "طلباتي")} back />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: "QUESTIONS", label: t("Questions", "الأسئلة") },
          { key: "TOW", label: t("Tow", "السحب") },
          { key: "MECHANIC", label: t("Mechanics", "الميكانيكيون") },
        ]}
      />
      {tab === "QUESTIONS" ? (
        <Async state={questions}>
          {(list) =>
            !list.length ? (
              <EmptyState icon="chatbubbles-outline" text={t("You have not asked a shop anything yet.", "لم تسأل أي متجر بعد.")} />
            ) : (
              list.map((q) => (
                <Card key={q.id} label={q.product.name} onPress={() => router.push(`/customer/inquiry/${q.id}`)}>
                  <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{q.product.name}</Text>
                      <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{q.shop.name}</Text>
                    </View>
                    <InquiryStatusBadge value={q.status} />
                  </View>
                  {q.lastMessage ? <Text numberOfLines={2} style={[{ color: col.textDim, fontSize: 12, marginTop: 10 }, align]}>{q.lastMessage}</Text> : null}
                  <Text style={[{ color: col.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(q.updatedAt)}</Text>
                </Card>
              ))
            )
          }
        </Async>
      ) : tab === "MECHANIC" ? (
        <Async state={mechs}>
          {(list) =>
            !list.length ? (
              <EmptyState icon="build-outline" text={t("You have not asked a mechanic for help yet.", "لم تطلب مساعدة ميكانيكي بعد.")} />
            ) : (
              list.map((r) => (
                <Card key={r.id} label={r.mechanic.name} onPress={() => router.push(`/customer/mechanicrequest/${r.id}`)}>
                  <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{r.mechanic.name}</Text>
                      <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                        {r.vehicle.make} {r.vehicle.model}
                      </Text>
                    </View>
                    <MechanicStatusBadge value={r.status} />
                  </View>
                  <Text numberOfLines={2} style={[{ color: col.textDim, fontSize: 12, marginTop: 10 }, align]}>{r.problemDescription}</Text>
                  <Text style={[{ color: col.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(r.updatedAt)}</Text>
                </Card>
              ))
            )
          }
        </Async>
      ) : (
        <Async state={tows}>
          {(list) =>
            !list.length ? (
              <EmptyState icon="car-outline" text={t("You have not requested a tow yet.", "لم تطلب سحبًا بعد.")} />
            ) : (
              list.map((r) => (
                <Card key={r.id} label={r.company.name} onPress={() => router.push(`/customer/towrequest/${r.id}`)}>
                  <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{r.company.name}</Text>
                      <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                        {r.vehicle.make} {r.vehicle.model}
                      </Text>
                    </View>
                    <TowStatusBadge value={r.status} />
                  </View>
                  <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 12, marginTop: 10 }, align]}>{r.pickupAddress}</Text>
                  <Text style={[{ color: col.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(r.updatedAt)}</Text>
                </Card>
              ))
            )
          }
        </Async>
      )}
    </Screen>
  );
}
