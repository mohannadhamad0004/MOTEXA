import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { CustomerScreen } from "../../features/catalog/CustomerScreen";
import { InquiryStatusBadge, TowStatusBadge, fmtDateTime } from "../../features/requests/requestBits";
import { customerInquiries, customerTowRequests } from "../../features/requests/requestsService";
import { C } from "../../features/shared/palette";
import { Async, Card, Empty, Header, Segmented, useL, useLoad } from "../../features/shared/ui";

type Tab = "QUESTIONS" | "TOW";

// "My requests": the customer's part questions and tow requests. Pull down to refresh.
export default function MyRequests() {
  const { t, row, align } = useL();
  const [tab, setTab] = useState<Tab>("QUESTIONS");
  const questions = useLoad(() => customerInquiries.list(), []);
  const tows = useLoad(() => customerTowRequests.list(), []);
  const cur = tab === "QUESTIONS" ? questions : tows;

  return (
    <CustomerScreen
      onRefresh={() => {
        questions.reload();
        tows.reload();
      }}
      refreshing={cur.loading && !!cur.data}
    >
      <Header brand="MOTEXA" title={t("My requests", "طلباتي")} back />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: "QUESTIONS", label: t("Part questions", "أسئلة القطع") },
          { key: "TOW", label: t("Tow requests", "طلبات السحب") },
        ]}
      />
      {tab === "QUESTIONS" ? (
        <Async state={questions}>
          {(list) =>
            !list.length ? (
              <Empty icon="chatbubbles-outline" text={t("You have not asked a shop anything yet.", "لم تسأل أي متجر بعد.")} />
            ) : (
              list.map((q) => (
                <Card key={q.id} label={q.product.name} onPress={() => router.push(`/customer/inquiry/${q.id}`)}>
                  <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{q.product.name}</Text>
                      <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>{q.shop.name}</Text>
                    </View>
                    <InquiryStatusBadge value={q.status} />
                  </View>
                  {q.lastMessage ? <Text numberOfLines={2} style={[{ color: C.textDim, fontSize: 12, marginTop: 10 }, align]}>{q.lastMessage}</Text> : null}
                  <Text style={[{ color: C.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(q.updatedAt)}</Text>
                </Card>
              ))
            )
          }
        </Async>
      ) : (
        <Async state={tows}>
          {(list) =>
            !list.length ? (
              <Empty icon="car-outline" text={t("You have not requested a tow yet.", "لم تطلب سحبًا بعد.")} />
            ) : (
              list.map((r) => (
                <Card key={r.id} label={r.company.name} onPress={() => router.push(`/customer/towrequest/${r.id}`)}>
                  <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{r.company.name}</Text>
                      <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                        {r.vehicle.make} {r.vehicle.model}
                      </Text>
                    </View>
                    <TowStatusBadge value={r.status} />
                  </View>
                  <Text numberOfLines={1} style={[{ color: C.textDim, fontSize: 12, marginTop: 10 }, align]}>{r.pickupAddress}</Text>
                  <Text style={[{ color: C.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(r.updatedAt)}</Text>
                </Card>
              ))
            )
          }
        </Async>
      )}
    </CustomerScreen>
  );
}
