import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, GarageHero, GaragePage, GButton, GText, ListRow, Note, Section, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { cityCentre, cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useMechanicStatusLabels, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MechanicRequestStatus, REFRESH_MS, customerMechanicRequests } from "../../../features/mechanics/mechanicsService";
import { shortId } from "../../../features/requests/activeRequest";
import { InitialBubble, mechTone, toSteps } from "../../../features/requests/garageBits";
import { buildTimeline } from "../../../features/requests/requestBits";
import { RequestRouteMap } from "../../../features/shared/RequestRouteMap";
import { MAPS_AVAILABLE } from "../../../features/shared/maps";
import { RouteSummary, useRoute } from "../../../features/shared/useRoute";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const PATH: MechanicRequestStatus[] = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];

// The customer's view of one service request. Re-reads the server every 15 s while this screen is open; the page is never
// remounted by that (same keys), so the status simply changes in place.
export default function MechanicRequestScreen() {
  const { row, align } = useGarageTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const statusLabel = useMechanicStatusLabels();
  const state = useLoad(() => customerMechanicRequests.get(id), [id], REFRESH_MS);
  const [pulling, setPulling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await customerMechanicRequests.cancel(id);
      setConfirming(false);
    } catch (e: any) {
      setErr(e.message);
      setConfirming(false);
    } finally {
      setBusy(false);
      state.reload();
    }
  };

  const r = state.data;
  // MOTEXA stores no workshop coordinates yet: the other end of the route is the mechanic's city centre (approximate)
  const provider = r?.mechanic.city ? cityCentre(r.mechanic.city) : null;
  const { route, loading: routing } = useRoute(r?.id ?? null, r?.location.point ?? null, provider);
  const canMap = MAPS_AVAILABLE && !!r?.location.point && !!provider;

  const headline = (name: string, status: MechanicRequestStatus) =>
    ({
      REQUESTED: t(`Waiting for ${name} to answer`, `بانتظار رد ${name}`),
      ACCEPTED: t(`${name} accepted your request`, `${name} قبل طلبك`),
      IN_PROGRESS: t(`${name} is working on your car`, `${name} يعمل على سيارتك`),
      COMPLETED: t("Service completed", "اكتملت الخدمة"),
      DECLINED: t(`${name} declined your request`, `${name} رفض طلبك`),
      CANCELLED: t("Request cancelled", "تم إلغاء الطلب"),
    })[status];

  return (
    <GaragePage
      onRefresh={() => {
        setPulling(true);
        state.reload().finally(() => setPulling(false));
      }}
      refreshing={pulling}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/requests"))}
          title={r ? headline(r.mechanic.name, r.status) : t("Service request", "طلب خدمة")}
          line={shortId(id)}
        >
          {r ? <StatusChip tone={mechTone(r.status)} label={statusLabel[r.status]} /> : null}
        </GarageHero>
      }
    >
      {state.error && !r ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !r ? (
        <SkeletonBlock height={220} radius={gShape.card} />
      ) : (
        <View>
          <Card pad={12}>
            <View style={[row, { alignItems: "center", gap: 12, paddingVertical: 4 }]}>
              <InitialBubble name={r.mechanic.name} size={44} />
              <View style={{ flex: 1 }}>
                <GText numberOfLines={1} style={[gType.label, { fontWeight: "800" }, align]}>{r.mechanic.name}</GText>
                <GText soft numberOfLines={2} style={[gType.caption, align]}>{[r.mechanic.workshopName, r.mechanic.city ? cityLabel(r.mechanic.city, isArabic) : null].filter(Boolean).join(" · ")}</GText>
              </View>
            </View>
            {canMap ? <ListRow divider icon="map-outline" title={mapOpen ? t("Hide map", "إخفاء الخريطة") : t("View on map", "عرض على الخريطة")} onPress={() => setMapOpen(!mapOpen)} /> : null}
          </Card>

          {canMap && mapOpen ? (
            <View style={{ marginTop: 12, borderRadius: gShape.card, overflow: "hidden" }}>
              <RequestRouteMap reqId={r.id} kind="mech" height={280} provider={{ ...provider!, name: r.mechanic.name }} pickup={r.location.point!} route={route} />
              <View style={{ paddingTop: 8 }}>
                <RouteSummary route={route} loading={routing} />
                <GText soft style={[gType.tiny, align, { marginTop: 4 }]}>{t("The mechanic pin is approximate (city centre).", "دبوس الميكانيكي تقريبي (مركز المدينة).")}</GText>
              </View>
            </View>
          ) : null}

          {r.status === "DECLINED" ? (
            <View style={{ marginTop: 12 }}>
              <Note tone="danger" icon="close-circle-outline">{`${t("Declined by the mechanic", "رفضه الميكانيكي")}${r.declineReason ? `\n${r.declineReason}` : ""}`}</Note>
            </View>
          ) : null}

          <Section title={t("Status", "الحالة")}>
            <Card>
              <Timeline steps={toSteps(buildTimeline(PATH, r.timeline, r.status, statusLabel))} />
              {["REQUESTED", "ACCEPTED", "IN_PROGRESS"].includes(r.status) ? <GText soft style={[gType.tiny, align, { marginTop: 12 }]}>{t("Updates automatically", "يتحدّث تلقائياً")}</GText> : null}
            </Card>
          </Section>

          <Section title={t("Details", "التفاصيل")}>
            <Card pad={12}>
              {r.skill ? <ListRow icon="construct-outline" title={t("Skill", "المهارة")} sub={skillLabel(r.skill)} /> : null}
              <ListRow divider={!!r.skill} icon="car-sport-outline" title={t("Car", "السيارة")} sub={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              <ListRow divider icon="alert-circle-outline" title={t("Problem", "المشكلة")} sub={r.problemDescription} />
              <ListRow divider icon="location-outline" title={t("Location", "الموقع")} sub={r.location.text} />
              {r.preferredTime ? <ListRow divider icon="time-outline" title={t("Preferred time", "الوقت المفضل")} sub={r.preferredTime} /> : null}
              {r.contactPhone ? <ListRow divider icon="call-outline" title={t("Your phone", "هاتفك")} sub={`${r.contactPhone} · ${t("Shared only with this mechanic.", "يُشارك مع هذا الميكانيكي فقط.")}`} /> : null}
            </Card>
          </Section>

          {err ? <View style={{ marginTop: 12 }}><Note tone="danger" icon="alert-circle-outline">{err}</Note></View> : null}
          {r.canCancel ? (
            <View style={{ marginTop: 24, gap: 8 }}>
              {!confirming ? (
                <GButton variant="danger" label={t("Cancel request", "إلغاء الطلب")} disabled={busy} onPress={() => setConfirming(true)} />
              ) : (
                <>
                  <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("Cancel this request?", "هل تريد إلغاء هذا الطلب؟")}</GText>
                  <View style={[row, { gap: 10 }]}>
                    <GButton flex variant="secondary" label={t("Keep the request", "إبقاء الطلب")} disabled={busy} onPress={() => setConfirming(false)} />
                    <GButton flex variant="danger" label={t("Yes, cancel it", "نعم، ألغِه")} busy={busy} onPress={cancel} />
                  </View>
                </>
              )}
            </View>
          ) : null}
        </View>
      )}
    </GaragePage>
  );
}
