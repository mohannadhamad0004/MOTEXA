// One request in the mechanic's inbox = Detail: status, the request facts, the map once the exact place is shared, the steps.
// ONE primary in the footer = the step the status allows, confirmed with a second tap: Accept · (on site) On the way · I have arrived ·
// Start job · Complete job. Decline (optional reason) and "Open in Maps" are in ⋮. Re-reads the server every 15 s while open.
// On the way / arrived (on site): this screen sends his position about every 10 s (foreground only, while it is open) so the customer
// follows him, and draws the road route from him to the customer.
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { GButton, Note, StatusChip, Timeline } from "../../../components/garage";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { StepFooter } from "../../../components/manage/Form";
import { Block, Facts, Loaded, Page } from "../../../components/manage/Page";
import { cityLabel } from "../../../core/constants/cities";
import { mapsDirectionsUrl } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { pathOf, useMechanicStatusLabels, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MechanicRequestStatus, REFRESH_MS, mechanicInbox } from "../../../features/mechanics/mechanicsService";
import { mechTone, toSteps } from "../../../features/requests/garageBits";
import { buildTimeline } from "../../../features/requests/requestBits";
import { MAPS_AVAILABLE, TripMap } from "../../../features/shared/maps";
import { useShareLocation } from "../../../features/orders/orderBits";
import { RequestRouteMap } from "../../../features/shared/RequestRouteMap";
import { RouteSummary, useRoute } from "../../../features/shared/useRoute";
import { hapticError, hapticSuccess } from "../../../motion";

type Step = "accept" | "enRoute" | "arrived" | "start" | "complete";
type StepIcon = "checkmark-circle-outline" | "navigate-outline" | "location-outline" | "play-outline" | "flag-outline";

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
  const onSite = r?.serviceMode === "ON_SITE";
  const NEXT: Partial<Record<MechanicRequestStatus, { key: Step; label: string; icon: StepIcon }>> = {
    REQUESTED: { key: "accept", label: t("Accept", "قبول"), icon: "checkmark-circle-outline" },
    ACCEPTED: onSite ? { key: "enRoute", label: t("On the way", "في الطريق"), icon: "navigate-outline" } : { key: "start", label: t("Start job", "ابدأ العمل"), icon: "play-outline" },
    EN_ROUTE: { key: "arrived", label: t("I have arrived", "لقد وصلت"), icon: "location-outline" },
    ARRIVED: { key: "start", label: t("Start job", "ابدأ العمل"), icon: "play-outline" },
    IN_PROGRESS: { key: "complete", label: t("Complete job", "إنهاء العمل"), icon: "flag-outline" },
  };
  const next = r ? NEXT[r.status] : undefined;
  const point = r && !r.location.approximate ? r.location.point : null;
  // his position: only for an on-site job, only while on the way / arrived, only while this screen is open
  const sharing = !!r && onSite && (r.status === "EN_ROUTE" || r.status === "ARRIVED");
  const share = useShareLocation(`mjob:${id}`, sharing, (p) => mechanicInbox.ping(id, p), { minMs: 10_000 });
  const { route, loading: routing } = useRoute(sharing && share.me && point ? `mjob:${id}` : null, share.me, point, 50);
  const actions: ItemAction[] = !r ? [] : [
    ...(point ? [{ key: "maps", label: t("Open in Maps", "افتح في الخرائط"), icon: "navigate-outline" as const, run: () => void Linking.openURL(mapsDirectionsUrl(point)) }] : []),
    ...(r.status === "REQUESTED" ? [{
      key: "decline", label: t("Decline", "رفض"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Decline this request?", "رفض هذا الطلب؟"), message: r.garage ? t("The request goes back to your garage, which gives it to another mechanic.", "يعود الطلب إلى كراجك ليُسنده إلى ميكانيكي آخر.") : t("The customer is told you cannot take it.", "يُبلَّغ الزبون أنك لا تستطيع تنفيذه."), reason: { label: t("Reason (optional)", "السبب (اختياري)") }, confirmLabel: t("Confirm decline", "تأكيد الرفض") },
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
          {point && MAPS_AVAILABLE ? (
            sharing && share.me ? (
              <View style={{ gap: 8 }}>
                <View style={{ borderRadius: 16, overflow: "hidden" }}><RequestRouteMap reqId={`mjob:${r.id}`} kind="mech" height={240} provider={{ ...share.me, name: t("You", "أنت") }} pickup={point} route={route} /></View>
                <RouteSummary route={route} loading={routing} />
              </View>
            ) : <TripMap pickup={point} height={190} />
          ) : null}
          {sharing ? (
            share.problem ? (
              <View style={{ gap: 8 }}>
                <Note tone="warning" icon="navigate-outline">{share.problem}</Note>
                {share.canOpenSettings ? <GButton variant="secondary" icon="settings-outline" label={t("Open settings", "فتح الإعدادات")} onPress={() => void share.openSettings()} /> : null}
              </View>
            ) : (
              <Note icon="navigate-outline">{share.notReaching ? t("Your position is not reaching MOTEXA. Check your connection.", "موقعك لا يصل إلى موتكسا. تحقق من الاتصال.")
                : t("The customer follows you on the map while you are on the way. Keep this screen open while you drive.", "يتابعك الزبون على الخريطة أثناء قدومك. أبقِ هذه الشاشة مفتوحة أثناء القيادة.")}</Note>
            )
          ) : null}
          <Block title={t("The request", "الطلب")}>
            <Facts rows={[
              r.serviceMode ? [t("Where", "المكان"), r.serviceMode === "ON_SITE" ? t("On site: you go to the car", "في الموقع: تذهب إلى السيارة") : t("At the workshop: the customer brings the car", "في الورشة: يُحضر الزبون السيارة")] : null,
              r.garage ? [t("Garage", "الكراج"), r.garage.name] : null,
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
            <View style={{ paddingVertical: 10 }}><Timeline steps={toSteps(buildTimeline(pathOf(r.serviceMode), r.timeline, r.status, L))} /></View>
          </Block>
        </>
      )}</Loaded>
    </Page>
  );
}
