import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Avatar, BlueprintPage, Hero, LiveNote, MapFrame, Mono, PrimaryButton, Row, VerticalTimeline, Wrench } from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { Text } from "../../../components/ui/Text";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { MechanicStatusBadge, useMechanicStatusLabels, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MechanicRequestStatus, REFRESH_MS, customerMechanicRequests } from "../../../features/mechanics/mechanicsService";
import { shortId } from "../../../features/requests/activeRequest";
import { buildTimeline } from "../../../features/requests/requestBits";
import { MAPS_AVAILABLE, TripMap } from "../../../features/shared/maps";
import { useTheme } from "../../../theme/useTheme";

const PATH: MechanicRequestStatus[] = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];

// The customer's view of one service request. Re-reads the server every 15 s while this screen is open.
export default function MechanicRequestScreen() {
  const { c, row, align } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const statusLabel = useMechanicStatusLabels();
  const state = useLoad(() => customerMechanicRequests.get(id), [id], REFRESH_MS);
  const [pulling, setPulling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
  const top =
    MAPS_AVAILABLE && r?.location.point ? (
      <MapFrame height={320} back="/customer/requests" tr="SERVICE / 04">
        <TripMap bare bottomInset={36} height={320} pickup={r.location.point} />
      </MapFrame>
    ) : (
      <Hero height={200} back="/customer/requests" tl="MECHANICS / 04" tr="SERVICE / 04">
        <View style={{ height: "100%", aspectRatio: 1.6 }}>
          <Wrench animate />
        </View>
      </Hero>
    );

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
    <BlueprintPage
      top={top}
      onRefresh={() => {
        setPulling(true);
        state.reload().finally(() => setPulling(false));
      }}
      refreshing={pulling}
    >
      <Async state={state}>
        {(r) => (
          <>
            <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 10 }]}>
              <Mono>{shortId(r.id)}</Mono>
              <MechanicStatusBadge value={r.status} />
            </View>
            <Text style={[{ color: c.ink, fontSize: 30, fontWeight: "700", lineHeight: isArabic ? 40 : 34, marginTop: 16 }, align]}>{headline(r.mechanic.name, r.status)}</Text>
            <View style={[row, { alignItems: "center", gap: 12, marginTop: 12 }]}>
              <Avatar name={r.mechanic.name} size={40} />
              <Text numberOfLines={2} style={[{ flex: 1, color: c.soft, fontSize: 13 }, align]}>
                {[r.mechanic.workshopName, r.mechanic.city ? cityLabel(r.mechanic.city, isArabic) : null].filter(Boolean).join(" · ")}
              </Text>
            </View>

            {r.status === "DECLINED" ? (
              <View style={{ marginTop: 16 }}>
                <Notice tone="danger" icon="close-circle-outline">
                  {t("Declined by the mechanic", "رفضه الميكانيكي")}
                  {r.declineReason ? `\n${r.declineReason}` : ""}
                </Notice>
              </View>
            ) : null}

            <View style={{ marginTop: 32 }}>
              <VerticalTimeline items={buildTimeline(PATH, r.timeline, r.status, statusLabel)} />
            </View>

            <View style={{ marginTop: 24 }}>
              {r.skill ? <Row label={t("Skill", "المهارة")} value={skillLabel(r.skill)} /> : null}
              <Row label={t("Car", "السيارة")} value={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              <Row label={t("Problem", "المشكلة")} value={r.problemDescription} />
              <Row label={t("Location", "الموقع")} value={r.location.text} />
              {r.preferredTime ? <Row label={t("Preferred time", "الوقت المفضل")} value={r.preferredTime} /> : null}
              {r.contactPhone ? <Row label={t("Your phone", "هاتفك")} value={r.contactPhone} mono /> : null}
            </View>
            {r.contactPhone ? <Text style={[{ color: c.soft, fontSize: 11, marginTop: 8 }, align]}>{t("Shared only with this mechanic.", "يُشارك مع هذا الميكانيكي فقط.")}</Text> : null}

            {["REQUESTED", "ACCEPTED", "IN_PROGRESS"].includes(r.status) ? <LiveNote label={t("Updates automatically", "يتحدّث تلقائياً")} /> : null}

            {err ? (
              <View style={{ marginTop: 16 }}>
                <Notice tone="danger" icon="alert-circle-outline">{err}</Notice>
              </View>
            ) : null}
            {r.canCancel ? (
              <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 24, gap: 8 }}>
                {!confirming ? (
                  <PrimaryButton variant="danger" label={t("Cancel request", "إلغاء الطلب")} disabled={busy} onPress={() => setConfirming(true)} />
                ) : (
                  <>
                    <Text style={[{ color: c.ink, fontSize: 14, fontWeight: "700", marginBottom: 4 }, align]}>{t("Cancel this request?", "هل تريد إلغاء هذا الطلب؟")}</Text>
                    <PrimaryButton variant="danger" label={t("Yes, cancel it", "نعم، ألغِه")} loading={busy} onPress={cancel} />
                    <PrimaryButton variant="outline" label={t("Keep the request", "إبقاء الطلب")} disabled={busy} onPress={() => setConfirming(false)} />
                  </>
                )}
              </View>
            ) : null}
          </>
        )}
      </Async>
    </BlueprintPage>
  );
}
