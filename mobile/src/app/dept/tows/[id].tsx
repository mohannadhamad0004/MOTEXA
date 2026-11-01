import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Card, ErrorState, GarageHero, GaragePage, ListRow, Note, Section, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { OrderMap } from "../../../features/orders/orderBits";
import { towTone } from "../../../features/requests/garageBits";
import { fmtDateTime, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { adminTows, jobSteps, liveLabel } from "../../../features/tow/dispatchService";
import { gShape } from "../../../theme/garage";

/** One tow job, read only for tow admins: company, driver (live / last seen), customer first name, car, map, steps. */
export default function AdminTowJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useTowStatusLabels();
  const problem = useProblemLabels();
  const state = useLoad(() => adminTows.job(id), [id], 10_000);
  const j = state.data;
  const live = j?.driver?.live ?? null;
  return (
    <GaragePage
      onRefresh={state.reload}
      hero={
        <GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept/tows" as never))} title={j ? j.company.name : t("Tow job", "مهمة سحب")} line={j ? `${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}` : undefined}>
          {j ? <StatusChip tone={towTone(j.status)} label={j.status === "EN_ROUTE" && j.arrivedAt ? L.ARRIVED : L[j.status]} /> : null}
        </GarageHero>
      }
    >
      {state.error && !j ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!j && !state.error ? <SkeletonBlock height={240} radius={gShape.card} /> : null}
      {j ? (
        <View style={{ gap: 12 }}>
          <Note icon="eye-outline">{t("Read only. Only the assigned driver moves the job; the company assigns and cancels.", "للقراءة فقط. السائق المعيّن وحده يحرّك المهمة؛ والشركة تُسند وتلغي.")}</Note>
          <Card pad={12}>
            <ListRow icon="person-circle-outline" title={j.driver ? `${t("Driver", "السائق")}: ${j.driver.name}` : t("No driver yet", "لا يوجد سائق بعد")} sub={j.driver ? liveLabel(live, t) : undefined} />
            <ListRow divider icon="location-outline" title={t("Pickup", "الاستلام")} sub={j.pickupAddress} />
            <ListRow divider icon="flag-outline" title={t("Destination", "الوجهة")} sub={j.dropoffAddress} />
            <ListRow divider icon="alert-circle-outline" title={t("Problem", "المشكلة")} sub={problem[j.problemType]} />
          </Card>
          {j.pickup ? (
            <Section title={t("Map", "الخريطة")} style={{ marginTop: 4 }}>
              <OrderMap orderId={`tow:${j.id}`} height={260} delivery={j.status === "IN_PROGRESS" && j.dropoff ? j.dropoff : j.pickup} shop={null} courier={live ? { lat: live.lat, lng: live.lng } : null} />
            </Section>
          ) : null}
          <Section title={t("Steps", "الخطوات")}>
            <Card>
              <Timeline steps={jobSteps(j, t).map(([label, at]) => ({ label, at: at ? fmtDateTime(at) : undefined, state: at ? "done" : "todo" }))} />
            </Card>
          </Section>
        </View>
      ) : null}
    </GaragePage>
  );
}
