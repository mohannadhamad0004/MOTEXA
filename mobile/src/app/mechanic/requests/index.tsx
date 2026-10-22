import { Async, EmptyState } from "../../../components/ui/Feedback";
import { Card } from "../../../components/ui/Card";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Segmented } from "../../../components/ui/Chip";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { MechanicStatusBadge, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MechanicRequestStatus, REFRESH_MS, mechanicInbox } from "../../../features/mechanics/mechanicsService";

type Tab = "NEW" | "ACTIVE" | "PAST";
// What a mechanic thinks in: waiting for an answer, on a job, finished.
const INBOX_GROUPS: Record<Tab, MechanicRequestStatus[]> = {
  NEW: ["REQUESTED"],
  ACTIVE: ["ACCEPTED", "IN_PROGRESS"],
  PAST: ["COMPLETED", "DECLINED", "CANCELLED"],
};

// The mechanic's inbox. Re-reads the server every 15 s while this screen is open.
export default function MechanicInbox() {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const skillLabel = useSkillLabel();
  const [tab, setTab] = useState<Tab>("NEW");
  const [pulling, setPulling] = useState(false);
  const state = useLoad(() => mechanicInbox.list(), [], REFRESH_MS);
  const all = state.data ?? [];
  const count = (g: Tab) => all.filter((r) => INBOX_GROUPS[g].includes(r.status)).length;

  return (
    <DashboardLayout tag="SERVICE / M2" kind="wrench"
      onRefresh={() => {
        setPulling(true);
        state.reload().finally(() => setPulling(false));
      }}
      refreshing={pulling}
      brand="MOTEXA" title={t("Service requests", "طلبات الخدمة")} subtitle={t("Requests from customers", "طلبات من العملاء")} back
    >
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: "NEW", label: t("New", "جديدة"), count: count("NEW") },
          { key: "ACTIVE", label: t("Active", "نشطة"), count: count("ACTIVE") },
          { key: "PAST", label: t("Past", "سابقة"), count: count("PAST") },
        ]}
      />
      <Async state={state}>
        {(data) => {
          const list = data.filter((r) => INBOX_GROUPS[tab].includes(r.status));
          return !list.length ? (
            <EmptyState
              icon="construct-outline"
              text={tab === "NEW" ? t("No new requests.", "لا توجد طلبات جديدة.") : tab === "ACTIVE" ? t("No active jobs.", "لا توجد أعمال نشطة.") : t("Nothing here yet.", "لا يوجد شيء هنا بعد.")}
            />
          ) : (
            list.map((r) => (
              <Card key={r.id} label={r.customerName} onPress={() => router.push(`/mechanic/requests/${r.id}`)}>
                <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{r.customerName}</Text>
                    <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                      {r.vehicle.make} {r.vehicle.model}
                      {r.skill ? ` · ${skillLabel(r.skill)}` : ""}
                    </Text>
                  </View>
                  <MechanicStatusBadge value={r.status} />
                </View>
                <Text numberOfLines={2} style={[{ color: col.textDim, fontSize: 12, marginTop: 10 }, align]}>{r.problemDescription}</Text>
                <Text style={[{ color: col.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(r.updatedAt)}</Text>
              </Card>
            ))
          );
        }}
      </Async>
    </DashboardLayout>
  );
}
