import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { KV } from "../../../components/ui/Rows";
import { ReasonPanel } from "../../../components/ui/ReasonPanel";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { mapsDirectionsUrl } from "../../../core/constants/geo";
import { MAPS_AVAILABLE, TripMap } from "../../../features/shared/maps";
import { MechanicStatusBadge, MechanicTimeline, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { REFRESH_MS, mechanicInbox } from "../../../features/mechanics/mechanicsService";

type Action = "accept" | "decline" | "start" | "complete";

// One request in the mechanic's inbox. Re-reads the server every 15 s while this screen is open.
export default function MechanicRequestDetail() {
  const { c: col } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align } = useL();
  const skillLabel = useSkillLabel();
  const state = useLoad(() => mechanicInbox.get(id), [id], REFRESH_MS);
  const [pulling, setPulling] = useState(false);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ask: Record<Exclude<Action, "decline">, { question: string; yes: string }> = {
    accept: { question: t("Accept this request?", "هل تقبل هذا الطلب؟"), yes: t("Yes, accept", "نعم، اقبل") },
    start: { question: t("Start working on this job?", "هل تبدأ العمل على هذه المهمة؟"), yes: t("Yes, start", "نعم، ابدأ") },
    complete: { question: t("Mark this job as completed?", "هل تُنهي هذه المهمة؟"), yes: t("Yes, complete", "نعم، أنهِ") },
  };

  const run = async (action: Action, reason = "") => {
    setBusy(true);
    setErr(null);
    try {
      if (action === "decline") await mechanicInbox.decline(id, reason);
      else await mechanicInbox[action](id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setConfirm(null);
      setBusy(false);
      state.reload();
    }
  };

  return (
    <DashboardLayout tag="SERVICE / M2" kind="wrench"
      onRefresh={() => {
        setPulling(true);
        state.reload().finally(() => setPulling(false));
      }}
      refreshing={pulling}
      brand="MOTEXA" title={t("Service request", "طلب الخدمة")} back
    >
      <Async state={state}>
        {(r) => (
          <>
            <Card>
              <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 16, fontWeight: "800" }, align]}>{r.customerName}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                    {r.vehicle.make} {r.vehicle.model}
                  </Text>
                </View>
                <MechanicStatusBadge value={r.status} />
              </View>
            </Card>

            {r.status === "DECLINED" ? (
              <Notice tone="danger" icon="close-circle-outline">
                {t("You declined this request.", "رفضت هذا الطلب.")}
                {r.declineReason ? `\n${r.declineReason}` : ""}
              </Notice>
            ) : null}
            {r.status === "CANCELLED" ? <Notice tone="danger" icon="close-circle-outline">{t("The customer cancelled this request.", "ألغى العميل هذا الطلب.")}</Notice> : null}

            <SectionHeader title={t("Status", "الحالة")} />
            <MechanicTimeline items={r.timeline} />

            <SectionHeader title={t("The request", "الطلب")} />
            <Card>
              {r.skill ? <KV k={t("Skill", "المهارة")} v={skillLabel(r.skill)} /> : null}
              <KV k={t("Car", "السيارة")} v={[r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")} />
              <KV k={t("Problem", "المشكلة")} v={r.problemDescription} />
              <KV k={t("Location", "الموقع")} v={r.location.text} />
              {r.preferredTime ? <KV k={t("Preferred time", "الوقت المفضل")} v={r.preferredTime} /> : null}
              {r.contactPhone ? <KV k={t("Phone (added by the customer)", "الهاتف (أضافه العميل)")} v={r.contactPhone} /> : null}
            </Card>

            {r.location.point ? (
              <>
                {MAPS_AVAILABLE ? <TripMap pickup={r.location.point} height={170} /> : null}
                <View style={{ height: 10 }} />
                <Button variant="ghost" icon="navigate-outline" label={t("Open in Maps", "افتح في الخرائط")} onPress={() => Linking.openURL(mapsDirectionsUrl(r.location.point!))} />
                <View style={{ height: 10 }} />
              </>
            ) : null}

            {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}

            {confirm === "decline" ? (
              <ReasonPanel
                required={false}
                title={t("Reason (optional)", "السبب (اختياري)")}
                confirmLabel={t("Confirm decline", "تأكيد الرفض")}
                onCancel={() => setConfirm(null)}
                onConfirm={(reason) => run("decline", reason)}
              />
            ) : confirm ? (
              <Card>
                <Text style={[{ color: col.text, fontSize: 14, fontWeight: "700", marginBottom: 12 }, align]}>{ask[confirm].question}</Text>
                <View style={{ gap: 8 }}>
                  <Button label={ask[confirm].yes} disabled={busy} onPress={() => run(confirm)} />
                  <Button variant="ghost" label={t("Back", "رجوع")} disabled={busy} onPress={() => setConfirm(null)} />
                </View>
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {r.status === "REQUESTED" ? (
                  <>
                    <Button icon="checkmark-circle-outline" label={t("Accept", "قبول")} disabled={busy} onPress={() => setConfirm("accept")} />
                    <Button variant="danger" icon="close-circle-outline" label={t("Decline", "رفض")} disabled={busy} onPress={() => setConfirm("decline")} />
                  </>
                ) : null}
                {r.status === "ACCEPTED" ? <Button icon="play-outline" label={t("Start job", "ابدأ العمل")} disabled={busy} onPress={() => setConfirm("start")} /> : null}
                {r.status === "IN_PROGRESS" ? <Button icon="flag-outline" label={t("Complete job", "إنهاء العمل")} disabled={busy} onPress={() => setConfirm("complete")} /> : null}
              </View>
            )}
          </>
        )}
      </Async>
    </DashboardLayout>
  );
}
