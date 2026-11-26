// One request in the mechanic's inbox = Detail: status, the request facts, the map once the exact place is shared, the steps.
// ONE primary in the footer = the step the status allows (Accept · Start job · Complete job), confirmed with a second tap;
// Decline (optional reason) and "Open in Maps" are in ⋮. Re-reads the server every 15 s while open.
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { Note, StatusChip, Timeline } from "../../../components/garage";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { StepFooter } from "../../../components/manage/Form";
import { Block, Facts, Loaded, Page } from "../../../components/manage/Page";
import { cityLabel } from "../../../core/constants/cities";
import { mapsDirectionsUrl } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useMechanicStatusLabels, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MechanicRequestStatus, REFRESH_MS, mechanicInbox } from "../../../features/mechanics/mechanicsService";
import { mechTone, toSteps } from "../../../features/requests/garageBits";
import { buildTimeline } from "../../../features/requests/requestBits";
import { MAPS_AVAILABLE, TripMap } from "../../../features/shared/maps";
import { hapticError, hapticSuccess } from "../../../motion";

type Step = "accept" | "start" | "complete";
const PATH: MechanicRequestStatus[] = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];

export default function MechanicRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skill = useSkillLabel();
  const L = useMechanicStatusLabels();
  const state = useLoad(() => mechanicInbox.get(id), [id], REFRESH_MS);
  const [confirm, setConfirm] = useState<Step | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const r = state.data;
  const run = async (step: Step) => {
    setBusy(true); setErr(null);
    try { await mechanicInbox[step](id); if (step === "accept") hapticSuccess(); }
    catch (e) { if (step === "accept") hapticError(); setErr((e as Error).message); }
    finally { setConfirm(null); setBusy(false); void state.reload(); }
  };
  const NEXT: Partial<Record<MechanicRequestStatus, { key: Step; label: string; icon: "checkmark-circle-outline" | "play-outline" | "flag-outline" }>> = {
    REQUESTED: { key: "accept", label: t("Accept", "قبول"), icon: "checkmark-circle-outline" },
    ACCEPTED: { key: "start", label: t("Start job", "ابدأ العمل"), icon: "play-outline" },
    IN_PROGRESS: { key: "complete", label: t("Complete job", "إنهاء العمل"), icon: "flag-outline" },
  };
  const next = r ? NEXT[r.status] : undefined;
  const point = r && !r.location.approximate ? r.location.point : null;
  const actions: ItemAction[] = !r ? [] : [
    ...(point ? [{ key: "maps", label: t("Open in Maps", "افتح في الخرائط"), icon: "navigate-outline" as const, run: () => void Linking.openURL(mapsDirectionsUrl(point)) }] : []),
    ...(r.status === "REQUESTED" ? [{
      key: "decline", label: t("Decline", "رفض"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Decline this request?", "رفض هذا الطلب؟"), message: t("The customer is told you cannot take it.", "يُبلَّغ الزبون أنك لا تستطيع تنفيذه."), reason: { label: t("Reason (optional)", "السبب (اختياري)") }, confirmLabel: t("Confirm decline", "تأكيد الرفض") },
      success: t("Request declined.", "تم رفض الطلب."), run: async (reason?: string) => { await mechanicInbox.decline(id, reason ?? ""); await state.reload(); },
    }] : []),
  ];
  const footer = next ? (
    <StepFooter back={confirm === next.key ? { label: t("Not yet", "ليس الآن"), onPress: () => setConfirm(null) } : undefined}
      primary={{ icon: confirm === next.key ? "checkmark-done" : next.icon, busy, disabled: busy,
        label: confirm === next.key ? t(`Tap again to confirm: ${next.label}`, `اضغط مرة أخرى للتأكيد: ${next.label}`) : next.label,
        onPress: () => (confirm === next.key ? void run(next.key) : setConfirm(next.key)) }} />
  ) : undefined;
  return (
    <Page title={r?.customerName ?? t("Service request", "طلب الخدمة")} line={r ? `${r.vehicle.make} ${r.vehicle.model}` : undefined}
      actions={actions.length ? actions : undefined} onRefresh={() => void state.reload()} refreshing={false} footer={footer}>
      <Loaded state={state}>{(r) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={mechTone(r.status)} label={L[r.status]} /></View>
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          {r.status === "DECLINED" ? <Note tone="danger" icon="close-circle-outline">{[t("You declined this request.", "رفضت هذا الطلب."), r.declineReason].filter(Boolean).join("\n")}</Note> : null}
          {r.status === "CANCELLED" ? (
            <Note tone="danger" icon="close-circle-outline">
              {[r.cancelledBy === "ADMIN" ? t("MOTEXA cancelled this request.", "ألغت موتكسا هذا الطلب.") : t("The customer cancelled this request.", "ألغى العميل هذا الطلب."), r.cancelledBy === "ADMIN" ? r.cancelReason : null].filter(Boolean).join("\n")}
            </Note>
          ) : null}
          {point && MAPS_AVAILABLE ? <TripMap pickup={point} height={190} /> : null}
          <Block title={t("The request", "الطلب")}>
            <Facts rows={[
              r.skill ? [t("Skill", "المهارة"), skill(r.skill)] : null,
              [t("Car", "السيارة"), [r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")],
              [t("Problem", "المشكلة"), r.problemDescription],
              [t("Location", "الموقع"), !r.location.approximate ? (r.location.text ?? "")
                : r.location.area ? t(`Near ${r.location.area} (approximate)`, `قرب ${cityLabel(r.location.area, isArabic)} (تقريبي)`) : t("Shared after you accept", "يظهر بعد قبول الطلب")],
              [t("Preferred time", "الوقت المفضل"), r.preferredTime],
              [t("Phone (added by the customer)", "الهاتف (أضافه العميل)"), r.contactPhone],
            ]} />
          </Block>
          {r.location.approximate ? (
            <Note icon="lock-closed-outline">
              {r.status === "REQUESTED" ? t("The exact address and the customer's phone are shared after you accept.", "يظهر العنوان الدقيق وهاتف العميل بعد قبولك الطلب.")
                : t("The exact address and phone are shown only during an active job.", "يظهر العنوان الدقيق والهاتف أثناء العمل النشط فقط.")}
            </Note>
          ) : null}
          <Block title={t("Status", "الحالة")}>
            <View style={{ paddingVertical: 10 }}><Timeline steps={toSteps(buildTimeline(PATH, r.timeline, r.status, L))} /></View>
          </Block>
        </>
      )}</Loaded>
    </Page>
  );
}
