import { Async, EmptyState } from "../../../../components/ui/Feedback";
import { Card } from "../../../../components/ui/Card";
import { Header } from "../../../../components/layout/DashboardLayout";
import { Screen } from "../../../../components/layout/Screen";
import { Segmented } from "../../../../components/ui/Chip";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { Text } from "../../../../components/ui/Text";
import { useTheme } from "../../../../theme/useTheme";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { TowStatusBadge, fmtDateTime, useProblemLabels } from "../../../../features/requests/requestBits";
import { TowStatus, companyTowRequests } from "../../../../features/requests/requestsService";

type Filter = "ALL" | "NEW" | "ACTIVE" | "DONE";
// Filters group the statuses a company thinks in: waiting for an answer, on a job, finished.
const GROUPS: Record<Exclude<Filter, "ALL">, TowStatus[]> = {
  NEW: ["REQUESTED"],
  ACTIVE: ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"],
  DONE: ["COMPLETED", "DECLINED", "CANCELLED"],
};

export default function CompanyRequests() {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const problem = useProblemLabels();
  const [filter, setFilter] = useState<Filter>("ALL");
  const state = useLoad(() => companyTowRequests.list(), []);

  return (
    <Screen>
      <Header brand="MOTEXA TOW" title={t("Tow requests", "طلبات السحب")} subtitle={t("Requests from customers", "طلبات من العملاء")} back />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { key: "ALL", label: t("All", "الكل") },
          { key: "NEW", label: t("New", "جديدة") },
          { key: "ACTIVE", label: t("Active", "نشطة") },
          { key: "DONE", label: t("Finished", "منتهية") },
        ]}
      />
      <Async state={state}>
        {(all) => {
          const list = filter === "ALL" ? all : all.filter((r) => GROUPS[filter].includes(r.status));
          return !list.length ? (
            <EmptyState icon="navigate-outline" text={t("No requests here.", "لا توجد طلبات هنا.")} />
          ) : (
            list.map((r) => (
              <Card key={r.id} label={r.customerName} onPress={() => router.push(`/provider/tow/requests/${r.id}`)}>
                <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{r.customerName}</Text>
                    <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                      {r.vehicle.make} {r.vehicle.model} · {problem[r.problemType]}
                    </Text>
                  </View>
                  <TowStatusBadge value={r.status} />
                </View>
                <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 12, marginTop: 10 }, align]}>{r.pickupAddress}</Text>
                <Text style={[{ color: col.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(r.updatedAt)}</Text>
              </Card>
            ))
          );
        }}
      </Async>
    </Screen>
  );
}
