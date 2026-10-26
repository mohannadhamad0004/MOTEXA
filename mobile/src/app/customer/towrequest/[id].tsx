import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { BlueprintPage, CrossFade, FadeSwitch, Hero, InspectionCheck, LiveNote, MapFrame, Mono, Panel, PrimaryButton, Row, TowTruck, VerticalTimeline } from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { ReasonPanel } from "../../../components/ui/ReasonPanel";
import { Text } from "../../../components/ui/Text";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { REFRESH_MS } from "../../../features/mechanics/mechanicsService";
import { TowStatusBadge, buildTimeline, towHeadline, useProblemLabels, useTowStatusLabels } from "../../../features/requests/requestBits";
import { WhileYouWait } from "../../../features/requests/WhileYouWait";
import { shortId } from "../../../features/requests/activeRequest";
import { TowStatus, customerTowRequests } from "../../../features/requests/requestsService";
import { cityCentre } from "../../../core/constants/cities";
import { catalogService } from "../../../features/catalog/catalogService";
import { RequestRouteMap } from "../../../features/shared/RequestRouteMap";
import { MAPS_AVAILABLE } from "../../../features/shared/maps";
import { RouteSummary, useRoute } from "../../../features/shared/useRoute";
import { useTruckLabels } from "../../../features/tow/truckBits";
import { useTheme } from "../../../theme/useTheme";

const PATH: TowStatus[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];
const OPEN: TowStatus[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

export default function TowRequestStatus() {
  const { c, align, row } = useTheme();
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { t } = useL();
  const { type } = useTruckLabels();
  const problem = useProblemLabels();
  const statusLabel = useTowStatusLabels();
  // The server is re-read every 15 s while this screen is focused, so the status changes without a pull.
  const state = useLoad(() => customerTowRequests.get(id), [id], REFRESH_MS);
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

  const r = state.data;
  // the company base point (else its city centre) is the other end of the route
  const company = useLoad(() => (r ? catalogService.getTowCompany(r.company.id) : Promise.resolve(null)), [r?.company.id]);
  const co = company.data?.company;
  const provider = co ? (co.baseLat !== null && co.baseLng !== null ? { lat: co.baseLat, lng: co.baseLng } : cityCentre(co.city)) : null;
  const { route, loading: routing } = useRoute(r?.id ?? null, r?.pickup ?? null, provider);
  const top =
    MAPS_AVAILABLE && r?.pickup && provider ? (
      <MapFrame height={320} back="/customer/requests" tr="ROUTE / 02">
        <RequestRouteMap reqId={r.id} kind="tow" height={320} provider={{ ...provider, name: r.company.name }} pickup={r.pickup} route={route} />
      </MapFrame>
    ) : (
      <Hero height={200} back="/customer/requests" tl="TOW / 02" tr="ROUTE / 02">
        <View style={{ width: "100%", maxWidth: 300, height: "100%" }}>
          <TowTruck />
        </View>
      </Hero>
    );

  return (
    <BlueprintPage top={top} onRefresh={state.reload} refreshing={state.loading && !!state.data}>
      <Async state={state}>
        {(r) => (
          <>
            {created === "1" ? (
              <Panel bronze style={{ marginBottom: 20 }}>
                <View style={[row, { alignItems: "center", gap: 12 }]}>
                  <InspectionCheck size={22} color={c.bronze} />
                  <Text style={[{ flex: 1, color: c.ink, fontSize: 14, fontWeight: "600" }, align]}>
                    {t("Request sent. You will see the answer here.", "تم إرسال الطلب. سترى الرد هنا.")}
                  </Text>
                </View>
              </Panel>
            ) : null}
            <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 10 }]}>
              <Mono>{shortId(r.id)}</Mono>
              <CrossFade k={r.status}><TowStatusBadge value={r.status} /></CrossFade>
            </View>
            <CrossFade k={r.status}>
              <Text style={[{ color: c.ink, fontSize: 30, fontWeight: "700", lineHeight: 34, marginTop: 16 }, align]}>{towHeadline(t, r.status, r.company.name)}</Text>
            </CrossFade>
            <Text style={[{ color: c.soft, fontSize: 13, marginTop: 6 }, align]}>{r.company.name} · {r.company.city}</Text>

            {r.status === "DECLINED" && r.declineReason ? (
              <View style={{ marginTop: 16 }}>
                <Notice tone="danger" icon="close-circle-outline">{`${t("Declined by the company", "رفضته الشركة")}\n${r.declineReason}`}</Notice>
              </View>
            ) : null}
            {r.status === "CANCELLED" ? (
              <View style={{ marginTop: 16 }}>
                <Notice tone="danger" icon="close-circle-outline">
                  {r.cancelledBy === "COMPANY" ? t("Cancelled by the company", "ألغته الشركة") : t("Cancelled by you", "ألغيته أنت")}
                  {r.cancelReason ? `\n${r.cancelReason}` : ""}
                </Notice>
              </View>
            ) : null}

            <View style={{ marginTop: 32 }}>
              <VerticalTimeline items={buildTimeline(PATH, r.timeline, r.status, statusLabel)} />
            </View>

            {(["REQUESTED", "ACCEPTED", "EN_ROUTE"] as TowStatus[]).includes(r.status) ? <WhileYouWait /> : null}

            <View style={{ marginTop: 24 }}>
              <Row label={t("Pickup", "الاستلام")} value={r.pickupAddress} />
              <Row label={t("Destination", "الوجهة")} value={r.dropoffAddress} />
              <Row label={t("Problem", "المشكلة")} value={problem[r.problemType]} />
              <Row label={t("Car", "السيارة")} value={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              {r.truck ? <Row label={t("Assigned truck", "الشاحنة المعيّنة")} value={[type[r.truck.type], r.truck.make, r.truck.model, r.truck.year].filter(Boolean).join(" ")} /> : null}
              <Row label={t("Contact phone", "هاتف التواصل")} value={r.contactPhone} mono />
              {r.notes ? <Row label={t("Notes", "ملاحظات")} value={r.notes} /> : null}
            </View>

            {r.pickup && provider ? (
              <View style={{ marginTop: 16 }}>
                <RouteSummary route={route} loading={routing} />
              </View>
            ) : null}

            {OPEN.includes(r.status) ? <LiveNote label={t("Updates automatically", "يتحدّث تلقائياً")} /> : null}

            {err ? (
              <View style={{ marginTop: 16 }}>
                <Notice tone="danger" icon="alert-circle-outline">{err}</Notice>
              </View>
            ) : null}
            <FadeSwitch show={r.canCancel}>
              <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 24 }}>
                {!cancelling ? (
                  <PrimaryButton variant="danger" label={t("Cancel request", "إلغاء الطلب")} disabled={busy} onPress={() => setCancelling(true)} />
                ) : (
                  <ReasonPanel
                    required={false}
                    title={t("Reason (optional)", "السبب (اختياري)")}
                    confirmLabel={t("Confirm cancellation", "تأكيد الإلغاء")}
                    onCancel={() => setCancelling(false)}
                    onConfirm={cancel}
                  />
                )}
              </View>
            </FadeSwitch>
          </>
        )}
      </Async>
    </BlueprintPage>
  );
}
