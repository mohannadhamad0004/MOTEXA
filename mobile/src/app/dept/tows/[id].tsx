import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, Field, GButton, GarageHero, GaragePage, ListRow, Note, Section, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { OrderMap } from "../../../features/orders/orderBits";
import { towTone } from "../../../features/requests/garageBits";
import { fmtDateTime, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { adminHistory, jobSteps, liveLabel } from "../../../features/tow/dispatchService";
import { gShape } from "../../../theme/garage";

/** One tow job, read only for tow admins: company, driver (live / last seen), customer first name, car, map, steps. */
export default function AdminTowJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useTowStatusLabels();
  const problem = useProblemLabels();
  const state = useLoad(() => adminHistory.job(id), [id], 10_000);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await adminHistory.cancel(id, reason.trim());
      setAsking(false);
      state.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
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
          <Note icon="eye-outline">{t("Only the assigned driver moves the job; the company assigns. You can cancel an open job with a reason (it is audited).", "السائق المعيّن وحده يحرّك المهمة؛ والشركة تُسند. يمكنك إلغاء مهمة مفتوحة مع ذكر السبب (يُسجَّل في التدقيق).")}</Note>
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
          <Card pad={12}>
            <ListRow icon="analytics-outline" title={t("Route trail", "مسار الرحلة")} sub={j.trail.length ? t(`${j.trail.length} recent points while the job is active`, `${j.trail.length} نقطة حديثة أثناء المهمة`) : t("The exact trail is deleted when a job ends; only the distance is kept.", "يُحذف المسار الدقيق عند انتهاء المهمة؛ تبقى المسافة فقط.")} />
            {j.distanceMeters !== null ? <ListRow divider icon="speedometer-outline" title={t("Distance driven", "المسافة المقطوعة")} sub={`${(j.distanceMeters / 1000).toFixed(1)} ${t("km", "كم")}`} /> : null}
            {j.review ? <ListRow divider icon="star-outline" title={t("Customer rating", "تقييم الزبون")} sub={`${"★".repeat(j.review.stars)}${j.review.comment ? ` · ${j.review.comment}` : ""}`} /> : null}
            {j.cancelReason ? <ListRow divider icon="close-circle-outline" title={t("Cancel reason", "سبب الإلغاء")} sub={`${j.cancelledBy ?? ""}: ${j.cancelReason}`} /> : null}
          </Card>
          {j.reports.length ? (
            <Section title={t("Reports", "البلاغات")} style={{ marginTop: 4 }}>
              <Card pad={12}>
                {j.reports.map((r, i) => <ListRow key={r.id} divider={i > 0} icon="flag-outline" title={r.body} sub={`${fmtDateTime(r.createdAt)}${r.closedAt ? ` · ${t("closed", "مغلق")}` : ""}`} />)}
              </Card>
            </Section>
          ) : null}
          <Section title={t("Steps", "الخطوات")}>
            <Card>
              <Timeline steps={jobSteps(j, t).map(([label, at]) => ({ label, at: at ? fmtDateTime(at) : undefined, state: at ? "done" : "todo" }))} />
            </Card>
          </Section>
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          {["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status) ? (
            asking ? (
              <Card>
                <Field label={t("Reason (the customer, the driver and the company see it)", "السبب (يراه الزبون والسائق والشركة)")} value={reason} onChangeText={setReason} multiline maxLength={300} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <GButton flex variant="secondary" label={t("Back", "رجوع")} onPress={() => setAsking(false)} />
                  <GButton flex variant="danger" label={t("Cancel the job", "إلغاء المهمة")} disabled={reason.trim().length < 3 || busy} busy={busy} onPress={() => void cancel()} />
                </View>
              </Card>
            ) : (
              <GButton variant="danger" icon="close-circle-outline" label={t("Cancel this job", "إلغاء هذه المهمة")} onPress={() => setAsking(true)} />
            )
          ) : null}
        </View>
      ) : null}
    </GaragePage>
  );
}
