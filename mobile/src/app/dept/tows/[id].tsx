// One tow job for tow admins = Detail (read only): company, driver (live / last seen), customer first name, car, map, route trail,
// reports, steps. Only the assigned driver moves the job; the company assigns. Cancelling an open job (reason required, audited) is in ⋮.
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Note, StatusChip, Timeline } from "../../../components/garage";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { Block, Facts, Loaded, Page } from "../../../components/manage/Page";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { OrderMap } from "../../../features/orders/orderBits";
import { towTone } from "../../../features/requests/garageBits";
import { fmtDateTime, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { adminHistory, jobSteps, liveLabel } from "../../../features/tow/dispatchService";

export default function AdminTowJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useTowStatusLabels();
  const problem = useProblemLabels();
  const state = useLoad(() => adminHistory.job(id), [id], 10_000);
  const j = state.data;
  const live = j?.driver?.live ?? null;
  const actions: ItemAction[] = j && ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status) ? [{ key: "cancel", label: t("Cancel this job", "إلغاء هذه المهمة"), icon: "close-circle-outline", destructive: true,
    confirm: { title: t("Cancel this job?", "إلغاء هذه المهمة؟"), confirmLabel: t("Cancel the job", "إلغاء المهمة"), reason: { label: t("Reason (the customer, the driver and the company see it)", "السبب (يراه الزبون والسائق والشركة)"), required: true } },
    run: (why?: string) => adminHistory.cancel(id, (why ?? "").trim()).then(() => state.reload()) }] : [];
  return (
    <Page title={j ? j.company.name : t("Tow job", "مهمة سحب")} line={j ? `${j.customer.firstName} · ${j.vehicle.make} ${j.vehicle.model}` : undefined} actions={actions.length ? actions : undefined}
      onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(j) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={towTone(j.status)} label={j.status === "EN_ROUTE" && j.arrivedAt ? L.ARRIVED : L[j.status]} /></View>
          <Note icon="eye-outline">{t("Only the assigned driver moves the job; the company assigns. You can cancel an open job with a reason (it is audited).", "السائق المعيّن وحده يحرّك المهمة؛ والشركة تُسند. يمكنك إلغاء مهمة مفتوحة مع ذكر السبب (يُسجَّل في التدقيق).")}</Note>
          <Block title={t("Job", "المهمة")}>
            <Facts rows={[[t("Driver", "السائق"), j.driver ? `${j.driver.name} · ${liveLabel(live, t)}` : t("No driver yet", "لا يوجد سائق بعد")], [t("Pickup", "الاستلام"), j.pickupAddress], [t("Destination", "الوجهة"), j.dropoffAddress], [t("Problem", "المشكلة"), problem[j.problemType]]]} />
          </Block>
          {j.pickup ? <OrderMap orderId={`tow:${j.id}`} height={260} delivery={j.status === "IN_PROGRESS" && j.dropoff ? j.dropoff : j.pickup} shop={null} courier={live ? { lat: live.lat, lng: live.lng } : null} /> : null}
          <Block title={t("Trip", "الرحلة")}>
            <Facts rows={[
              [t("Route trail", "مسار الرحلة"), j.trail.length ? t(`${j.trail.length} recent points while the job is active`, `${j.trail.length} نقطة حديثة أثناء المهمة`) : t("The exact trail is deleted when a job ends; only the distance is kept.", "يُحذف المسار الدقيق عند انتهاء المهمة؛ تبقى المسافة فقط.")],
              [t("Distance driven", "المسافة المقطوعة"), j.distanceMeters !== null ? `${(j.distanceMeters / 1000).toFixed(1)} ${t("km", "كم")}` : null],
              [t("Customer rating", "تقييم الزبون"), j.review ? `${"★".repeat(j.review.stars)}${j.review.comment ? ` · ${j.review.comment}` : ""}` : null],
              [t("Cancel reason", "سبب الإلغاء"), j.cancelReason ? `${j.cancelledBy ?? ""}: ${j.cancelReason}` : null],
            ]} />
          </Block>
          {j.reports.length ? <Block title={t("Reports", "البلاغات")}><Facts rows={j.reports.map((r) => [`${fmtDateTime(r.createdAt)}${r.closedAt ? ` · ${t("closed", "مغلق")}` : ""}`, r.body] as [string, string])} /></Block> : null}
          <Block title={t("Steps", "الخطوات")}>
            <View style={{ paddingVertical: 10 }}><Timeline steps={jobSteps(j, t).map(([label, at]) => ({ label, at: at ? fmtDateTime(at) : undefined, state: at ? "done" : "todo" }))} /></View>
          </Block>
        </>
      )}</Loaded>
    </Page>
  );
}
