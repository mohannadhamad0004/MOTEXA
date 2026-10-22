import { router } from "expo-router";
import { ReactNode, useState } from "react";
import { View } from "react-native";
import { DrawingKind, DrawingThumb, Mono, Press, Rise, SimplePage, Steps, UnderlineTabs } from "../../components/blueprint";
import { Async, EmptyState } from "../../components/ui/Feedback";
import { Text } from "../../components/ui/Text";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { MechanicStatusBadge } from "../../features/mechanics/mechanicBits";
import { customerMechanicRequests } from "../../features/mechanics/mechanicsService";
import { InquiryStatusBadge, TowStatusBadge, fmtDateTime } from "../../features/requests/requestBits";
import { customerInquiries, customerTowRequests } from "../../features/requests/requestsService";
import { useTheme } from "../../theme/useTheme";

type Tab = "QUESTIONS" | "TOW" | "MECHANIC";

// "My requests": the customer's part questions, tow requests and mechanic service requests. Pull down to refresh.
export default function MyRequests() {
  const { c, row, align } = useTheme();
  const { t } = useL();
  const [tab, setTab] = useState<Tab>("QUESTIONS");
  const questions = useLoad(() => customerInquiries.list(), []);
  const tows = useLoad(() => customerTowRequests.list(), []);
  const mechs = useLoad(() => customerMechanicRequests.list(), []);
  const cur = tab === "QUESTIONS" ? questions : tab === "TOW" ? tows : mechs;
  const stepLabels = [t("Requested", "تم الطلب"), t("Accepted", "مقبول"), t("In progress", "قيد التنفيذ"), t("Completed", "مكتمل")];

  const line = (key: string, kind: DrawingKind, onPress: () => void, title: string, sub: string, badge: ReactNode, extra: ReactNode, at: string, i: number) => (
    <Rise key={key} i={i}>
      <Press accessibilityLabel={title} onPress={onPress} style={[row, { gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.line + "99" }]}>
        <DrawingThumb kind={kind} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{title}</Text>
              <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12, marginTop: 2 }, align]}>{sub}</Text>
            </View>
            {badge}
          </View>
          {extra}
          <View style={{ marginTop: 6, alignSelf: row.flexDirection === "row" ? "flex-start" : "flex-end" }}>
            <Mono size={11}>{at}</Mono>
          </View>
        </View>
      </Press>
    </Rise>
  );

  return (
    <SimplePage
      kind="toolbox"
      tl="REQUESTS"
      back="/customer"
      title={t("My requests", "طلباتي")}
      onRefresh={() => {
        questions.reload();
        tows.reload();
        mechs.reload();
      }}
      refreshing={cur.loading && !!cur.data}
    >
      <View style={{ marginTop: 20 }}>
        <UnderlineTabs
          value={tab}
          onChange={setTab}
          items={[
            { key: "QUESTIONS", label: t("Questions", "الأسئلة") },
            { key: "TOW", label: t("Tow", "السحب") },
            { key: "MECHANIC", label: t("Mechanics", "الميكانيكيون") },
          ]}
        />
      </View>
      {tab === "QUESTIONS" ? (
        <Async state={questions}>
          {(list) =>
            !list.length ? (
              <EmptyState icon="chatbubbles-outline" text={t("You have not asked a shop anything yet.", "لم تسأل أي متجر بعد.")} />
            ) : (
              list.map((q, i) =>
                line(
                  q.id,
                  "shop",
                  () => router.push(`/customer/inquiry/${q.id}`),
                  q.product.name,
                  q.shop.name,
                  <InquiryStatusBadge value={q.status} />,
                  q.lastMessage ? <Text numberOfLines={2} style={[{ color: c.soft, fontSize: 12, marginTop: 8 }, align]}>{q.lastMessage}</Text> : null,
                  fmtDateTime(q.updatedAt),
                  i
                )
              )
            )
          }
        </Async>
      ) : tab === "MECHANIC" ? (
        <Async state={mechs}>
          {(list) =>
            !list.length ? (
              <EmptyState icon="build-outline" text={t("You have not asked a mechanic for help yet.", "لم تطلب مساعدة ميكانيكي بعد.")} />
            ) : (
              list.map((r, i) => {
                const idx = { REQUESTED: 0, ACCEPTED: 1, IN_PROGRESS: 2, COMPLETED: 3 }[r.status as string];
                return line(
                  r.id,
                  "wrench",
                  () => router.push(`/customer/mechanicrequest/${r.id}`),
                  r.mechanic.name,
                  `${r.vehicle.make} ${r.vehicle.model}`,
                  <MechanicStatusBadge value={r.status} />,
                  idx !== undefined ? <Steps labels={stepLabels} index={idx} /> : <Text numberOfLines={2} style={[{ color: c.soft, fontSize: 12, marginTop: 8 }, align]}>{r.problemDescription}</Text>,
                  fmtDateTime(r.updatedAt),
                  i
                );
              })
            )
          }
        </Async>
      ) : (
        <Async state={tows}>
          {(list) =>
            !list.length ? (
              <EmptyState icon="car-outline" text={t("You have not requested a tow yet.", "لم تطلب سحبًا بعد.")} />
            ) : (
              list.map((r, i) => {
                const idx = { REQUESTED: 0, ACCEPTED: 1, EN_ROUTE: 2, IN_PROGRESS: 2, COMPLETED: 3 }[r.status as string];
                return line(
                  r.id,
                  "tow",
                  () => router.push(`/customer/towrequest/${r.id}`),
                  r.company.name,
                  `${r.vehicle.make} ${r.vehicle.model}`,
                  <TowStatusBadge value={r.status} />,
                  idx !== undefined ? (
                    <Steps labels={[stepLabels[0], stepLabels[1], r.status === "IN_PROGRESS" ? stepLabels[2] : t("On the way", "في الطريق"), stepLabels[3]]} index={idx} />
                  ) : (
                    <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12, marginTop: 8 }, align]}>{r.pickupAddress}</Text>
                  ),
                  fmtDateTime(r.updatedAt),
                  i
                );
              })
            )
          }
        </Async>
      )}
    </SimplePage>
  );
}
