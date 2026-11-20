import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, ErrorState, Field, GButton, ListRow, Note, Section, SkeletonBlock, StatusChip, Timeline } from "../../../components/garage";
import { DeptHead, DeptPage } from "../../../features/department/ui";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { cityLabel } from "../../../core/constants/cities";
import { mechanicAdmin } from "../../../features/mechanics/mechanicAdminService";
import { useMechanicStatusLabels, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { mechTone } from "../../../features/requests/garageBits";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { gShape } from "../../../theme/garage";

/** One mechanic request for the mechanics admin: people, car, problem, timeline with times, city. The address and phone appear only while the job is active. */
export default function AdminMechanicRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const L = useMechanicStatusLabels();
  const skill = useSkillLabel();
  const state = useLoad(() => mechanicAdmin.get(id), [id]);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await mechanicAdmin.cancel(id, reason.trim());
      setAsking(false);
      state.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const r = state.data;
  return (
    <DeptPage back tabs={false} onRefresh={state.reload} refreshing={state.loading && !!r}>
      <DeptHead title={r ? r.customerName : t("Mechanic request", "طلب ميكانيكي")} caption={r ? `${r.vehicle.make} ${r.vehicle.model}` : undefined} end={r ? <StatusChip tone={mechTone(r.status)} label={L[r.status]} /> : undefined} />
      {state.error && !r ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!r && !state.error ? <SkeletonBlock height={240} radius={gShape.card} /> : null}
      {r ? (
        <View style={{ gap: 12 }}>
          <Note icon="eye-outline">{t("The exact address and the phone are shown only while the job is active; otherwise only the city. You can cancel an open request with a reason (it is audited).", "يظهر العنوان الدقيق والهاتف أثناء العمل النشط فقط؛ وإلا تظهر المدينة فقط. يمكنك إلغاء طلب مفتوح مع سبب (يُسجَّل في السجل).")}</Note>
          <Card pad={12}>
            <ListRow icon="person-outline" title={t("Customer", "الزبون")} sub={r.customerName} />
            <ListRow divider icon="construct-outline" title={t("Mechanic", "الميكانيكي")} sub={[r.mechanic.name, r.mechanic.workshopName].filter(Boolean).join(" · ")} />
            <ListRow divider icon="car-outline" title={t("Car", "السيارة")} sub={`${r.vehicle.make} ${r.vehicle.model}${r.vehicle.year ? ` ${r.vehicle.year}` : ""}`} />
            {r.skill ? <ListRow divider icon="build-outline" title={t("Skill", "المهارة")} sub={skill(r.skill)} /> : null}
            <ListRow divider icon="alert-circle-outline" title={t("Problem", "المشكلة")} sub={r.problemDescription} />
            {r.preferredTime ? <ListRow divider icon="time-outline" title={t("Preferred time", "الوقت المفضل")} sub={r.preferredTime} /> : null}
          </Card>
          <Card pad={12}>
            <ListRow icon="map-outline" title={t("City", "المدينة")} sub={r.city ? cityLabel(r.city, isArabic) : "—"} />
            {r.location.approximate === false && r.location.text ? <ListRow divider icon="location-outline" title={t("Address", "العنوان")} sub={r.location.text} /> : null}
            {r.contactPhone ? <ListRow divider icon="call-outline" title={t("Phone", "الهاتف")} sub={r.contactPhone} /> : null}
            {r.declineReason ? <ListRow divider icon="close-circle-outline" title={t("Decline reason", "سبب الرفض")} sub={r.declineReason} /> : null}
            {r.cancelReason ? <ListRow divider icon="close-circle-outline" title={t("Cancel reason", "سبب الإلغاء")} sub={`${r.cancelledBy === "ADMIN" ? t("MOTEXA", "موتكسا") : t("Customer", "الزبون")}: ${r.cancelReason}`} /> : null}
          </Card>
          <Section title={t("Steps", "الخطوات")}>
            <Card>
              <Timeline steps={r.timeline.map((s) => ({ label: L[s.status], at: fmtDateTime(s.at), state: s.status === "CANCELLED" || s.status === "DECLINED" ? "failed" : "done" }))} />
            </Card>
          </Section>
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          {r.active ? (
            asking ? (
              <Card>
                <Field label={t("Reason (the customer and the mechanic see it)", "السبب (يراه الزبون والميكانيكي)")} value={reason} onChangeText={setReason} multiline maxLength={300} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <GButton flex variant="secondary" label={t("Back", "رجوع")} onPress={() => setAsking(false)} />
                  <GButton flex variant="danger" label={t("Cancel the request", "إلغاء الطلب")} disabled={reason.trim().length < 3 || busy} busy={busy} onPress={() => void cancel()} />
                </View>
              </Card>
            ) : (
              <GButton variant="danger" icon="close-circle-outline" label={t("Cancel this request", "إلغاء هذا الطلب")} onPress={() => setAsking(true)} />
            )
          ) : null}
        </View>
      ) : null}
    </DeptPage>
  );
}
