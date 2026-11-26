// A tow request answered by the company itself (a company without drivers) = Detail: map, trip facts, truck, timeline. ONE primary
// in the footer per state: Accept (choose an approved, available truck in a sheet) · On the way · In progress · Completed.
// Decline / Cancel (reason required) and "Open in Google Maps" are in ⋮.
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { GButton, Note, Sheet, StatusChip, Timeline } from "../../../../components/garage";
import type { ItemAction } from "../../../../components/ItemActionsMenu";
import { ManageEntry } from "../../../../components/manage/ManagePage";
import { Block, Facts, Loaded, Page } from "../../../../components/manage/Page";
import { mapsDirectionsUrl } from "../../../../core/constants/geo";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { hapticError, hapticSuccess } from "../../../../motion";
import { toSteps, towTone } from "../../../../features/requests/garageBits";
import { buildTimeline, useProblemLabels, useTowStatusLabels } from "../../../../features/requests/requestBits";
import { TowStatus, companyTowRequests } from "../../../../features/requests/requestsService";
import { MAPS_AVAILABLE, TripMap } from "../../../../features/shared/maps";
import { asActor, useSessionUser } from "../../../../features/shared/session";
import { towFleetService } from "../../../../features/tow/towService";
import { useTruckLabels } from "../../../../features/tow/truckBits";

const NEXT = {
  ACCEPTED: { to: "EN_ROUTE", en: "Start: on the way", ar: "بدء: في الطريق", icon: "navigate-outline" },
  EN_ROUTE: { to: "IN_PROGRESS", en: "Arrived: in progress", ar: "وصلت: قيد التنفيذ", icon: "construct-outline" },
  IN_PROGRESS: { to: "COMPLETED", en: "Mark completed", ar: "تحديد كمكتمل", icon: "flag-outline" },
} as const;
const PATH: (TowStatus | "ARRIVED")[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];

export default function CompanyRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const { type } = useTruckLabels();
  const problem = useProblemLabels();
  const L = useTowStatusLabels();
  const state = useLoad(() => companyTowRequests.get(id), [id]);
  const fleet = useLoad(() => towFleetService.getMyFleet(asActor(user)), [user.id]);
  const [picking, setPicking] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const r = state.data;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); setPicking(false); await state.reload(); void fleet.reload(); } // a truck's availability changes with the job
    catch (e) { setErr((e as Error).message); throw e; } finally { setBusy(false); }
  };
  const accept = (truckId: string) => act(async () => {
    try { await companyTowRequests.accept(id, truckId); hapticSuccess(); } catch (e) { hapticError(); throw e; }
  }).catch(() => undefined);
  const available = (fleet.data?.trucks ?? []).filter((x) => x.verification === "APPROVED" && x.operational === "AVAILABLE");
  const next = r ? NEXT[r.status as keyof typeof NEXT] : undefined;
  const actions: ItemAction[] = !r ? [] : [
    ...(r.pickup ? [{ key: "pickup", label: t("Open pickup in Google Maps", "افتح نقطة الاستلام في خرائط جوجل"), icon: "navigate-outline" as const, run: () => void Linking.openURL(mapsDirectionsUrl(r.pickup!)) }] : []),
    ...(r.dropoff ? [{ key: "dropoff", label: t("Open destination in Google Maps", "افتح الوجهة في خرائط جوجل"), icon: "flag-outline" as const, run: () => void Linking.openURL(mapsDirectionsUrl(r.dropoff!)) }] : []),
    ...(r.status === "REQUESTED" ? [{ key: "decline", label: t("Decline", "رفض"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Decline this request?", "رفض هذا الطلب؟"), confirmLabel: t("Confirm decline", "تأكيد الرفض"), reason: { label: t("Reason for declining (required)", "سبب الرفض (مطلوب)"), required: true } },
      run: (why?: string) => companyTowRequests.decline(r.id, why ?? "").then(() => state.reload()) }] : []),
    ...(r.status === "ACCEPTED" ? [{ key: "cancel", label: t("Cancel this job", "إلغاء هذه المهمة"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Cancel this job?", "إلغاء هذه المهمة؟"), confirmLabel: t("Confirm cancellation", "تأكيد الإلغاء"), reason: { label: t("Reason for cancelling (required)", "سبب الإلغاء (مطلوب)"), required: true } },
      run: (why?: string) => companyTowRequests.cancel(r.id, why ?? "").then(() => state.reload()) }] : []),
  ];
  const footer = r?.status === "REQUESTED" ? <GButton icon="checkmark-circle-outline" label={t("Accept", "قبول")} busy={busy} disabled={busy} onPress={() => setPicking(true)} />
    : next ? <GButton icon={next.icon} label={t(next.en, next.ar)} busy={busy} disabled={busy} onPress={() => void act(() => companyTowRequests.setStatus(id, next.to)).catch(() => undefined)} /> : undefined;
  return (
    <Page title={r?.customerName ?? t("Tow request", "طلب سحب")} line={r ? [r.vehicle.make, r.vehicle.model].join(" ") : undefined} actions={actions.length ? actions : undefined}
      onRefresh={() => void state.reload()} refreshing={false} footer={footer}>
      <Loaded state={state}>{(r) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={towTone(r.status)} label={L[r.status]} /></View>
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          {r.status === "DECLINED" && r.declineReason ? <Note tone="danger" icon="close-circle-outline">{`${t("Declined", "مرفوض")}: ${r.declineReason}`}</Note> : null}
          {r.status === "CANCELLED" ? <Note tone="danger" icon="close-circle-outline">{[r.cancelledBy === "COMPANY" ? t("Cancelled by your company", "ألغتها شركتك") : t("Cancelled by the customer", "ألغاها العميل"), r.cancelReason].filter(Boolean).join(": ")}</Note> : null}
          {r.pickup && MAPS_AVAILABLE ? <TripMap pickup={r.pickup} dropoff={r.dropoff} height={190} /> : null}
          <Block title={t("Trip", "الرحلة")}>
            <Facts rows={[[t("Pickup", "الاستلام"), r.pickupAddress], [t("Destination", "الوجهة"), r.dropoffAddress], [t("Car", "السيارة"), [r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")],
              [t("Problem", "المشكلة"), problem[r.problemType]], [t("Contact phone", "هاتف التواصل"), r.contactPhone], [t("Notes", "ملاحظات"), r.notes]]} />
          </Block>
          {r.truck ? <Block title={t("Assigned truck", "الشاحنة المعيّنة")}>
            <Facts rows={[[t("Type", "النوع"), type[r.truck.type]], [t("Vehicle", "المركبة"), [r.truck.make, r.truck.model, r.truck.year].filter(Boolean).join(" ")], [t("Plate", "اللوحة"), r.truck.plateNumber]]} />
          </Block> : null}
          <Block title={t("Status", "الحالة")}>
            <View style={{ paddingVertical: 10 }}><Timeline steps={toSteps(buildTimeline(PATH, r.timeline as { status: TowStatus | "ARRIVED"; at: string }[], r.status, L))} /></View>
          </Block>
        </>
      )}</Loaded>
      <Sheet visible={picking} onClose={() => setPicking(false)} title={t("Choose a truck", "اختر شاحنة")} closeLabel={t("Close", "إغلاق")}>
        <View style={{ gap: 8 }}>
          {available.length ? available.map((tr) => <ManageEntry key={tr.id} icon="car-outline" title={`${type[tr.type]} · ${tr.make} ${tr.model}`} sub={tr.plate} onPress={() => void accept(tr.id)} />)
            : <Note icon="alert-circle-outline">{t("You have no approved, available truck. Set one available first.", "لا توجد لديك شاحنة معتمدة ومتاحة. اجعل إحداها متاحة أولًا.")}</Note>}
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
        </View>
      </Sheet>
    </Page>
  );
}
