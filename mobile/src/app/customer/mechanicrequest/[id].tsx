import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { KV } from "../../../components/ui/Rows";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { cityLabel } from "../../../core/constants/cities";
import { MAPS_AVAILABLE, TripMap } from "../../../features/shared/maps";
import { InitialAvatar, MechanicStatusBadge, MechanicTimeline, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { REFRESH_MS, customerMechanicRequests } from "../../../features/mechanics/mechanicsService";

// The customer's view of one service request. Re-reads the server every 15 s while this screen is open.
export default function MechanicRequestStatus() {
  const { c: col } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align, isArabic } = useL();
  const skillLabel = useSkillLabel();
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

  return (
    <Screen
      onRefresh={() => {
        setPulling(true);
        state.reload().finally(() => setPulling(false));
      }}
      refreshing={pulling}
    >
      <Header brand="MOTEXA" title={t("Service request", "طلب الخدمة")} back />
      <Async state={state}>
        {(r) => (
          <>
            <Card>
              <View style={[row, { alignItems: "center", gap: 12 }]}>
                <InitialAvatar name={r.mechanic.name} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 16, fontWeight: "800" }, align]}>{r.mechanic.name}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                    {[r.mechanic.workshopName, r.mechanic.city ? cityLabel(r.mechanic.city, isArabic) : null].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <MechanicStatusBadge value={r.status} />
              </View>
            </Card>

            {r.status === "DECLINED" ? (
              <Notice tone="danger" icon="close-circle-outline">
                {t("Declined by the mechanic", "رفضه الميكانيكي")}
                {r.declineReason ? `\n${r.declineReason}` : ""}
              </Notice>
            ) : null}
            {r.status === "CANCELLED" ? <Notice tone="danger" icon="close-circle-outline">{t("You cancelled this request.", "ألغيت هذا الطلب.")}</Notice> : null}

            <SectionHeader title={t("Status", "الحالة")} />
            <MechanicTimeline items={r.timeline} />

            {MAPS_AVAILABLE && r.location.point ? (
              <>
                <SectionHeader title={t("Your location", "موقعك")} />
                <TripMap pickup={r.location.point} height={170} />
              </>
            ) : null}

            <SectionHeader title={t("Your request", "طلبك")} />
            <Card>
              {r.skill ? <KV k={t("Skill", "المهارة")} v={skillLabel(r.skill)} /> : null}
              <KV k={t("Car", "السيارة")} v={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              <KV k={t("Problem", "المشكلة")} v={r.problemDescription} />
              <KV k={t("Location", "الموقع")} v={r.location.text} />
              {r.preferredTime ? <KV k={t("Preferred time", "الوقت المفضل")} v={r.preferredTime} /> : null}
              {r.contactPhone ? <KV k={t("Your phone (shared only with this mechanic)", "هاتفك (يُشارك مع هذا الميكانيكي فقط)")} v={r.contactPhone} /> : null}
            </Card>

            {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
            {r.canCancel && !confirming ? <Button variant="danger" icon="close-circle-outline" label={t("Cancel request", "إلغاء الطلب")} disabled={busy} onPress={() => setConfirming(true)} /> : null}
            {r.canCancel && confirming ? (
              <Card>
                <Text style={[{ color: col.text, fontSize: 14, fontWeight: "700", marginBottom: 12 }, align]}>{t("Cancel this request?", "هل تريد إلغاء هذا الطلب؟")}</Text>
                <View style={{ gap: 8 }}>
                  <Button variant="danger" label={t("Yes, cancel it", "نعم، ألغِه")} disabled={busy} onPress={cancel} />
                  <Button variant="ghost" label={t("Keep the request", "إبقاء الطلب")} disabled={busy} onPress={() => setConfirming(false)} />
                </View>
              </Card>
            ) : null}
          </>
        )}
      </Async>
    </Screen>
  );
}
