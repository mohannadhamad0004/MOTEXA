import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { KV } from "../../../components/ui/Rows";
import { ReasonPanel } from "../../../components/ui/ReasonPanel";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { TowStatusBadge, Timeline, useProblemLabels } from "../../../features/requests/requestBits";
import { customerTowRequests } from "../../../features/requests/requestsService";
import { MAPS_AVAILABLE, TripMap } from "../../../features/shared/maps";
import { useTruckLabels } from "../../../features/tow/truckBits";

export default function TowRequestStatus() {
  const { c: col } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align } = useL();
  const { type } = useTruckLabels();
  const problem = useProblemLabels();
  const state = useLoad(() => customerTowRequests.get(id), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cancel = async (reason: string) => {
    setBusy(true);
    setErr(null);
    try {
      await customerTowRequests.cancel(id, reason);
      setCancelling(false);
      state.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={state.reload} refreshing={state.loading && !!state.data}>
      <Header brand="MOTEXA" title={t("Tow request", "طلب السحب")} back />
      <Async state={state}>
        {(r) => (
          <>
            <Card>
              <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 16, fontWeight: "800" }, align]}>{r.company.name}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{r.company.city}</Text>
                </View>
                <TowStatusBadge value={r.status} />
              </View>
            </Card>

            {r.status === "DECLINED" && r.declineReason ? <Notice tone="danger" icon="close-circle-outline">{`${t("Declined by the company", "رفضته الشركة")}\n${r.declineReason}`}</Notice> : null}
            {r.status === "CANCELLED" ? (
              <Notice tone="danger" icon="close-circle-outline">
                {r.cancelledBy === "COMPANY" ? t("Cancelled by the company", "ألغته الشركة") : t("Cancelled by you", "ألغيته أنت")}
                {r.cancelReason ? `\n${r.cancelReason}` : ""}
              </Notice>
            ) : null}

            <SectionHeader title={t("Status", "الحالة")} />
            <Timeline items={r.timeline} />

            {r.truck && (
              <>
                <SectionHeader title={t("Assigned truck", "الشاحنة المعيّنة")} />
                <Card>
                  <KV k={t("Type", "النوع")} v={type[r.truck.type]} />
                  <KV k={t("Vehicle", "المركبة")} v={[r.truck.make, r.truck.model, r.truck.year].filter(Boolean).join(" ")} />
                </Card>
              </>
            )}

            {MAPS_AVAILABLE && r.pickup ? (
              <>
                <SectionHeader title={t("Pickup point", "نقطة الاستلام")} />
                <TripMap pickup={r.pickup} dropoff={r.dropoff} height={170} />
              </>
            ) : null}

            <SectionHeader title={t("Your request", "طلبك")} />
            <Card>
              <KV k={t("Pickup", "الاستلام")} v={r.pickupAddress} />
              <KV k={t("Destination", "الوجهة")} v={r.dropoffAddress} />
              <KV k={t("Car", "السيارة")} v={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              <KV k={t("Problem", "المشكلة")} v={problem[r.problemType]} />
              <KV k={t("Contact phone", "هاتف التواصل")} v={r.contactPhone} />
              {r.notes ? <KV k={t("Notes", "ملاحظات")} v={r.notes} /> : null}
            </Card>

            {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
            {r.canCancel && !cancelling && (
              <Button variant="danger" icon="close-circle-outline" label={t("Cancel request", "إلغاء الطلب")} disabled={busy} onPress={() => setCancelling(true)} />
            )}
            {cancelling && (
              <ReasonPanel
                required={false}
                title={t("Reason (optional)", "السبب (اختياري)")}
                confirmLabel={t("Confirm cancellation", "تأكيد الإلغاء")}
                onCancel={() => setCancelling(false)}
                onConfirm={cancel}
              />
            )}
          </>
        )}
      </Async>
    </Screen>
  );
}
