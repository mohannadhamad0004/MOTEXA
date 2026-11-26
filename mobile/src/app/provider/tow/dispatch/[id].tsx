// One request, company side = Detail: who has it (and who the customer asked for), the live map, the timeline, the facts. ONE primary
// in the footer: assign / transfer to a FREE driver (a sheet of free drivers; until the driver is on the way), or, for a company
// without drivers, answer it on the classic screen. Decline a new one / cancel an accepted one (reason required) are in ⋮.
// Only the driver moves a job he has.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { GButton, Note, Sheet, StatusChip, Timeline } from "../../../../components/garage";
import type { ItemAction } from "../../../../components/ItemActionsMenu";
import { ManageEntry } from "../../../../components/manage/ManagePage";
import { Block, Facts, Loaded, Page } from "../../../../components/manage/Page";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { OrderMap } from "../../../../features/orders/orderBits";
import { toSteps, towTone } from "../../../../features/requests/garageBits";
import { buildTimeline, useProblemLabels, useTowStatusLabels } from "../../../../features/requests/requestBits";
import { TowStatus, companyTowRequests } from "../../../../features/requests/requestsService";
import { companyDispatch, liveLabel } from "../../../../features/tow/dispatchService";

const PATH: (TowStatus | "ARRIVED")[] = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"];

export default function CompanyDispatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useTowStatusLabels();
  const problem = useProblemLabels();
  const state = useLoad(() => Promise.all([companyTowRequests.get(id), companyDispatch.drivers()]).then(([r, drivers]) => ({ r, drivers })), [id], 10_000);
  const [picking, setPicking] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const r = state.data?.r, drivers = state.data?.drivers ?? [];
  const free = drivers.filter((d) => d.status === "FREE" && d.id !== r?.driver?.id);
  const live = r?.driver?.live ?? null;
  const assign = async (driverId: string) => {
    setBusy(true); setError(null);
    try { await companyDispatch.assign(id, driverId); setPicking(false); await state.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const actions: ItemAction[] = !r ? [] : [
    ...(r.status === "REQUESTED" ? [{ key: "decline", label: t("Decline request", "رفض الطلب"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Decline this request?", "رفض هذا الطلب؟"), confirmLabel: t("Decline", "رفض"), reason: { label: t("Reason (the customer sees this)", "السبب (يراه الزبون)"), required: true } },
      run: (why?: string) => companyTowRequests.decline(r.id, why ?? "").then(() => state.reload()) }] : []),
    ...(r.status === "ACCEPTED" || r.status === "EN_ROUTE" ? [{ key: "cancel", label: t("Cancel job", "إلغاء المهمة"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Cancel this job?", "إلغاء هذه المهمة؟"), confirmLabel: t("Cancel job", "إلغاء المهمة"), reason: { label: t("Reason (the customer sees this)", "السبب (يراه الزبون)"), required: true } },
      run: (why?: string) => companyTowRequests.cancel(r.id, why ?? "").then(() => state.reload()) }] : []),
  ];
  const classic = !!r && !r.driver && r.status === "REQUESTED" && !drivers.length;
  const footer = !r ? undefined : r.canReassign && drivers.length
    ? <GButton icon="person-add-outline" label={r.driver ? t("Transfer to another driver", "التحويل إلى سائق آخر") : t("Assign a driver", "إسناد سائق")} busy={busy} disabled={busy} onPress={() => setPicking(true)} />
    : classic ? <GButton icon="open-outline" label={t("Answer and choose a truck", "الرد واختيار شاحنة")} onPress={() => router.push({ pathname: "/provider/tow/requests/[id]", params: { id: r.id } })} />
    : undefined;
  return (
    <Page title={r ? `${r.customerName} · ${r.vehicle.make} ${r.vehicle.model}` : t("Request", "الطلب")} line={r?.pickupAddress} actions={actions.length ? actions : undefined}
      onRefresh={() => void state.reload()} refreshing={false} footer={footer}>
      <Loaded state={state}>{({ r }) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={towTone(r.status)} label={r.status === "EN_ROUTE" && r.arrivedAt ? L.ARRIVED : L[r.status]} /></View>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          <Block title={t("Driver", "السائق")}>
            <Facts rows={[[t("Driver", "السائق"), r.driver ? `${r.driver.name} · ${liveLabel(live, t)}` : t("No driver yet", "لا يوجد سائق بعد")], [t("The customer asked for", "طلب الزبون"), r.requestedDriver?.name]]} />
          </Block>
          {r.canReassign && (r.status === "ACCEPTED" || r.status === "EN_ROUTE") && r.driver ? <Note icon="information-circle-outline">{t("Transferring frees the current truck; the customer is told and sees the new driver's card; the new driver accepts with his own truck.", "التحويل يحرّر الشاحنة الحالية؛ يُبلَّغ الزبون ويرى بطاقة السائق الجديد؛ ويقبل السائق الجديد بشاحنته.")}</Note> : null}
          {r.pickup ? <OrderMap orderId={`tow:${r.id}`} height={260} delivery={r.pickup} shop={null} courier={live ? { lat: live.lat, lng: live.lng } : null} /> : null}
          <Block title={t("Status", "الحالة")}>
            <View style={{ paddingVertical: 10 }}><Timeline steps={toSteps(buildTimeline(PATH, r.timeline as { status: TowStatus | "ARRIVED"; at: string }[], r.status === "EN_ROUTE" && r.arrivedAt ? "ARRIVED" : r.status, L))} /></View>
          </Block>
          <Block title={t("Details", "التفاصيل")}>
            <Facts rows={[[t("Pickup", "الاستلام"), r.pickupAddress], [t("Destination", "الوجهة"), r.dropoffAddress], [t("Problem", "المشكلة"), problem[r.problemType]],
              [t("Customer phone", "هاتف الزبون"), r.contactPhone], [t("Notes", "ملاحظات"), r.notes], [t("Truck", "الشاحنة"), r.truck ? [r.truck.plateNumber, r.truck.make, r.truck.model].filter(Boolean).join(" · ") : null]]} />
          </Block>
        </>
      )}</Loaded>
      <Sheet visible={picking} onClose={() => setPicking(false)} title={r?.driver ? t("Transfer to a free driver", "التحويل إلى سائق متاح") : t("Assign to a free driver", "الإسناد إلى سائق متاح")} closeLabel={t("Close", "إغلاق")}>
        <View style={{ gap: 8 }}>
          {free.length ? free.map((d) => <ManageEntry key={d.id} icon="person-outline" title={d.name} sub={d.truck?.plate} onPress={() => void assign(d.id)} />)
            : <Note>{t("No other driver is free right now.", "لا يوجد سائق آخر متاح الآن.")}</Note>}
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
        </View>
      </Sheet>
    </Page>
  );
}
