import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, Field, GarageHero, GaragePage, GButton, GText, ListRow, Note, Section, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { cityCentre } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService } from "../../../features/catalog/catalogService";
import { REFRESH_MS } from "../../../features/mechanics/mechanicsService";
import { shortId } from "../../../features/requests/activeRequest";
import { toSteps, towTone } from "../../../features/requests/garageBits";
import { buildTimeline, towHeadline, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { TowStatus, customerTowRequests } from "../../../features/requests/requestsService";
import { WhileYouWait } from "../../../features/requests/WhileYouWait";
import { RequestRouteMap } from "../../../features/shared/RequestRouteMap";
import { MAPS_AVAILABLE } from "../../../features/shared/maps";
import { RouteSummary, useRoute } from "../../../features/shared/useRoute";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const PATH: TowStatus[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];
const OPEN: TowStatus[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

export default function TowRequestStatus() {
  const { row, align } = useGarageTheme();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { t } = useL();
  const { type } = useTruckLabels();
  const problem = useProblemLabels();
  const statusLabel = useTowStatusLabels();
  // The server is re-read every 15 s while this screen is focused; same keys, so the status changes in place (no remount).
  const state = useLoad(() => customerTowRequests.get(id), [id], REFRESH_MS);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await customerTowRequests.cancel(id, reason.trim());
      setCancelling(false);
      state.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const r = state.data;
  // the company base point (else its city centre) is the other end of the route
  const company = useLoad(() => (r ? catalogService.getTowCompany(r.company.id) : Promise.resolve(null)), [r?.company.id]);
  const co = company.data?.company;
  const provider = co ? (co.baseLat !== null && co.baseLng !== null ? { lat: co.baseLat, lng: co.baseLng } : cityCentre(co.city)) : null;
  const { route, loading: routing } = useRoute(r?.id ?? null, r?.pickup ?? null, provider);
  const canMap = MAPS_AVAILABLE && !!r?.pickup && !!provider;

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/requests"))}
          title={r ? towHeadline(t, r.status, r.company.name) : t("Tow request", "طلب سحب")}
          line={r ? `${r.company.name} · ${r.company.city} · ${shortId(r.id)}` : shortId(id)}
        >
          {r ? <StatusChip tone={towTone(r.status)} label={statusLabel[r.status]} /> : null}
        </GarageHero>
      }
    >
      {state.error && !r ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !r ? (
        <SkeletonBlock height={240} radius={gShape.card} />
      ) : (
        <View>
          {created === "1" ? <Note tone="success" icon="checkmark-circle">{t("Request sent. You will see the answer here.", "تم إرسال الطلب. سترى الرد هنا.")}</Note> : null}
          {r.status === "DECLINED" && r.declineReason ? <Note tone="danger" icon="close-circle-outline">{`${t("Declined by the company", "رفضته الشركة")}\n${r.declineReason}`}</Note> : null}
          {r.status === "CANCELLED" ? (
            <Note tone="danger" icon="close-circle-outline">{`${r.cancelledBy === "COMPANY" ? t("Cancelled by the company", "ألغته الشركة") : t("Cancelled by you", "ألغيته أنت")}${r.cancelReason ? `\n${r.cancelReason}` : ""}`}</Note>
          ) : null}

          {canMap ? (
            <Card pad={12}>
              <ListRow icon="map-outline" title={mapOpen ? t("Hide map", "إخفاء الخريطة") : t("View on map", "عرض على الخريطة")} onPress={() => setMapOpen(!mapOpen)} />
              {mapOpen ? (
                <View style={{ marginTop: 8, borderRadius: gShape.small, overflow: "hidden" }}>
                  <RequestRouteMap reqId={r.id} kind="tow" height={280} provider={{ ...provider!, name: r.company.name }} pickup={r.pickup!} route={route} />
                </View>
              ) : null}
              <View style={{ paddingTop: 8 }}>
                <RouteSummary route={route} loading={routing} />
              </View>
            </Card>
          ) : null}

          <Section title={t("Status", "الحالة")}>
            <Card>
              <Timeline steps={toSteps(buildTimeline(PATH, r.timeline, r.status, statusLabel))} />
              {OPEN.includes(r.status) ? <GText soft style={[gType.tiny, align, { marginTop: 12 }]}>{t("Updates automatically", "يتحدّث تلقائياً")}</GText> : null}
            </Card>
          </Section>

          {(["REQUESTED", "ACCEPTED", "EN_ROUTE"] as TowStatus[]).includes(r.status) ? <WhileYouWait /> : null}

          <Section title={t("Details", "التفاصيل")}>
            <Card pad={12}>
              <ListRow icon="location-outline" title={t("Pickup", "الاستلام")} sub={r.pickupAddress} />
              <ListRow divider icon="flag-outline" title={t("Destination", "الوجهة")} sub={r.dropoffAddress} />
              <ListRow divider icon="alert-circle-outline" title={t("Problem", "المشكلة")} sub={problem[r.problemType]} />
              <ListRow divider icon="car-sport-outline" title={t("Car", "السيارة")} sub={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              {r.truck ? <ListRow divider icon="car-outline" title={t("Assigned truck", "الشاحنة المعيّنة")} sub={[type[r.truck.type], r.truck.make, r.truck.model, r.truck.year].filter(Boolean).join(" ")} /> : null}
              <ListRow divider icon="call-outline" title={t("Contact phone", "هاتف التواصل")} sub={r.contactPhone} />
              {r.notes ? <ListRow divider icon="document-text-outline" title={t("Notes", "ملاحظات")} sub={r.notes} /> : null}
            </Card>
          </Section>

          {err ? <View style={{ marginTop: 12 }}><Note tone="danger" icon="alert-circle-outline">{err}</Note></View> : null}
          {r.canCancel ? (
            <View style={{ marginTop: 24 }}>
              {!cancelling ? (
                <GButton variant="danger" label={t("Cancel request", "إلغاء الطلب")} disabled={busy} onPress={() => setCancelling(true)} />
              ) : (
                <Card>
                  <Field label={t("Reason (optional)", "السبب (اختياري)")} value={reason} onChangeText={setReason} multiline maxLength={300} />
                  <View style={[row, { gap: 10 }]}>
                    <GButton flex variant="secondary" label={t("Keep the request", "إبقاء الطلب")} disabled={busy} onPress={() => setCancelling(false)} />
                    <GButton flex variant="danger" label={t("Confirm cancellation", "تأكيد الإلغاء")} busy={busy} onPress={cancel} />
                  </View>
                </Card>
              )}
            </View>
          ) : null}
        </View>
      )}
    </GaragePage>
  );
}
