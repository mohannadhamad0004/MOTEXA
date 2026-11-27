// Garage owner: the garage's service requests.
//  List   = ONE chip row To assign · Waiting · Active · History with counts (`?filter=` from the dashboard), search, compact rows.
//  Detail = facts, the map (customer pin once exact, the mechanic's point while he shares it), the steps; the ONE primary is
//           "Assign a mechanic" (a sheet with the FREE mechanics, nearest first: km · live / from the garage) while the request can
//           still be (re)assigned; Decline (reason, required) is in ⋮ while nobody accepted. Re-reads every 15 s.
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GText, Note, Sheet, StatusChip, Tap, Timeline } from "../../components/garage";
import { showToast, type ItemAction } from "../../components/ItemActionsMenu";
import { StepFooter } from "../../components/manage/Form";
import { FilterChips, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { Block, Facts, Loaded, Page } from "../../components/manage/Page";
import { cityLabel } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { pathOf, useMechanicStatusLabels, useSkillLabel } from "../mechanics/mechanicBits";
import { REFRESH_MS, garageOwner, type MechanicRequestStatus, type MechanicSideRequest, type Suggestion } from "../mechanics/mechanicsService";
import { mechTone, toSteps } from "../requests/garageBits";
import { buildTimeline, fmtDateTime } from "../requests/requestBits";
import { MAPS_AVAILABLE, TripMap } from "../shared/maps";

type Tab = "assign" | "waiting" | "active" | "history";
const ACTIVE: MechanicRequestStatus[] = ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"];
const tabOf = (r: MechanicSideRequest): Tab => (r.status === "REQUESTED" ? (r.mechanicUserId ? "waiting" : "assign") : ACTIVE.includes(r.status) ? "active" : "history");
const isTab = (v?: string): v is Tab => v === "assign" || v === "waiting" || v === "active" || v === "history";

export function GarageRequests() {
  const { t } = useL();
  const skill = useSkillLabel();
  const L = useMechanicStatusLabels();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [tab, setTab] = useState<Tab>(isTab(params.filter) ? params.filter : "assign"), [q, setQ] = useState("");
  useEffect(() => { if (isTab(params.filter)) setTab(params.filter); }, [params.filter]);
  const state = useLoad(() => Promise.all([garageOwner.requests("open"), garageOwner.requests("history")]).then(([a, b]) => [...a, ...b]), [], REFRESH_MS);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (state.data ?? []).filter((r) => words.every((w) => `${r.customerName} ${r.mechanicName ?? ""} ${r.vehicle.make} ${r.vehicle.model} ${r.skill ? skill(r.skill) : ""} ${r.problemDescription}`.toLowerCase().includes(w)));
  const count = (k: Tab) => found.filter((r) => tabOf(r) === k).length;
  const rows = found.filter((r) => tabOf(r) === tab);
  const label: Record<Tab, string> = { assign: t("To assign", "للإسناد"), waiting: t("Waiting", "بانتظار الرد"), active: t("Active", "نشطة"), history: t("History", "السجل") };
  return (
    <ManagePage title={t("Requests", "الطلبات")} back={false} tabBar
      line={state.data ? t(`${count("assign")} to assign · ${count("active")} active`, `${count("assign")} للإسناد · ${count("active")} نشطة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Customer, mechanic, car or problem", "الزبون أو الميكانيكي أو السيارة أو المشكلة") }}
      filters={<FilterChips value={tab} onChange={setTab} filters={(["assign", "waiting", "active", "history"] as Tab[]).map((k) => ({ key: k, label: label[k], count: state.data ? count(k) : undefined }))} />}
      items={rows} keyOf={(r) => r.id}
      renderItem={(r) => <ManageRow title={r.customerName} status={{ label: L[r.status], tone: mechTone(r.status) }}
        sub={[`${r.vehicle.make} ${r.vehicle.model}`, r.mechanicName ?? t("No mechanic yet", "لا يوجد ميكانيكي بعد"), r.serviceMode === "WORKSHOP" ? t("Workshop", "الورشة") : t("On site", "في الموقع"), fmtDateTime(r.updatedAt)].join(" · ")}
        onPress={() => router.push(`/garage/requests/${r.id}` as Href)} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : tab === "assign" ? t("No request is waiting for a mechanic.", "لا يوجد طلب بانتظار ميكانيكي.") : t("Nothing here yet.", "لا يوجد شيء هنا بعد."),
        action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a request to open it.", "اضغط على طلب لفتحه.")} />
  );
}

/** The FREE mechanics of the garage, nearest first (live point while Online, else the garage's own pin). */
function AssignSheet({ visible, onClose, suggestions, current, onAssign }: { visible: boolean; onClose: () => void; suggestions: Suggestion[]; current: string | null; onAssign: (s: Suggestion) => Promise<void> }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const skill = useSkillLabel();
  const [busy, setBusy] = useState<string | null>(null);
  const km = (s: Suggestion) => (s.distanceKm == null ? t("distance unknown", "المسافة غير معروفة") : `${s.distanceKm < 1 ? "<1" : s.distanceKm.toFixed(1)} ${isArabic ? "كم" : "km"} · ${s.source === "live" ? t("live", "مباشر") : t("from the garage", "من الكراج")}`);
  return (
    <Sheet visible={visible} onClose={onClose} title={t("Assign a mechanic", "إسناد ميكانيكي")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 8 }}>
        {suggestions.length ? suggestions.map((s, i) => (
          <Tap key={s.id} label={s.name} disabled={!!busy} onPress={async () => { setBusy(s.id); try { await onAssign(s); } finally { setBusy(null); } }}
            style={[row, { alignItems: "center", gap: 10, minHeight: 56, padding: 12, borderRadius: gShape.small, backgroundColor: i === 0 ? g.tint : g.cardSoft }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <GText numberOfLines={1} style={[gType.label, align, { fontWeight: "800" }]}>{s.name}</GText>
              <GText soft numberOfLines={1} style={[gType.caption, align]}>{[km(s), s.skills.map(skill).join(", ")].filter(Boolean).join(" · ")}</GText>
            </View>
            {i === 0 ? <StatusChip tone="success" label={t("Nearest", "الأقرب")} /> : null}
            {busy === s.id ? <GText soft style={gType.caption}>{t("Assigning…", "جارٍ الإسناد…")}</GText> : null}
          </Tap>
        )) : <Note icon="people-outline">{t("No free mechanic is Online right now (with the skill asked for). Ask one to go Online, or decline the request.", "لا يوجد ميكانيكي متاح ومتصل الآن (بالمهارة المطلوبة). اطلب من أحدهم أن يتصل، أو ارفض الطلب.")}</Note>}
        {current ? <GText soft style={[gType.tiny, align]}>{t("Choosing another mechanic takes the request from the current one.", "اختيار ميكانيكي آخر يسحب الطلب من الحالي.")}</GText> : null}
      </View>
    </Sheet>
  );
}

export function GarageRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skill = useSkillLabel();
  const L = useMechanicStatusLabels();
  const state = useLoad(() => garageOwner.request(id), [id], REFRESH_MS);
  const [assigning, setAssigning] = useState(false);
  const r = state.data?.request;
  const canAssign = !!r && (r.status === "REQUESTED" || r.status === "ACCEPTED");
  const point = r && !r.location.approximate ? r.location.point : null;
  const actions: ItemAction[] = r?.status === "REQUESTED" ? [{
    key: "decline", label: t("Decline the request", "رفض الطلب"), icon: "close-circle-outline", destructive: true,
    confirm: { title: t("Decline this request?", "رفض هذا الطلب؟"), message: t("The customer is told your garage cannot take it.", "يُبلَّغ الزبون أن كراجك لا يستطيع تنفيذه."), reason: { label: t("Reason", "السبب"), required: true }, confirmLabel: t("Decline", "رفض") },
    success: t("Request declined.", "تم رفض الطلب."), run: async (reason?: string) => { await garageOwner.decline(id, reason ?? ""); await state.reload(); },
  }] : [];
  const assign = async (s: Suggestion) => {
    try { await garageOwner.assign(id, s.id); setAssigning(false); showToast(t(`Assigned to ${s.name}.`, `تم الإسناد إلى ${s.name}.`), "ok"); }
    catch (e) { showToast((e as Error).message, "bad"); }
    finally { void state.reload(); }
  };
  const footer = canAssign ? (
    <StepFooter primary={{ icon: "person-add-outline", label: r!.mechanicUserId ? t("Assign another mechanic", "إسناد ميكانيكي آخر") : t("Assign a mechanic", "إسناد ميكانيكي"), onPress: () => setAssigning(true) }} />
  ) : undefined;
  return (
    <Page title={r?.customerName ?? t("Service request", "طلب الخدمة")} line={r ? `${r.vehicle.make} ${r.vehicle.model}` : undefined}
      actions={actions.length ? actions : undefined} onRefresh={() => void state.reload()} refreshing={false} footer={footer}>
      <Loaded state={state}>{({ request: r, suggestions }) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={mechTone(r.status)} label={L[r.status]} /></View>
          {r.status === "DECLINED" ? <Note tone="danger" icon="close-circle-outline">{[t("Declined.", "مرفوض."), r.declineReason].filter(Boolean).join("\n")}</Note> : null}
          {r.status === "CANCELLED" ? <Note tone="danger" icon="close-circle-outline">{[r.cancelledBy === "ADMIN" ? t("MOTEXA cancelled this request.", "ألغت موتكسا هذا الطلب.") : t("The customer cancelled this request.", "ألغى الزبون هذا الطلب."), r.cancelledBy === "ADMIN" ? r.cancelReason : null].filter(Boolean).join("\n")}</Note> : null}
          {point && MAPS_AVAILABLE ? <TripMap pickup={point} height={190} /> : null}
          {r.live ? <Note icon="navigate-outline">{r.live.stale ? t("The mechanic's last known position is a few minutes old.", "آخر موقع معروف للميكانيكي قديم ببضع دقائق.") : t("The mechanic is sharing his position: see it on the Live map.", "الميكانيكي يشارك موقعه: شاهده على الخريطة المباشرة.")}</Note> : null}
          <Block title={t("The request", "الطلب")}>
            <Facts rows={[
              [t("Mechanic", "الميكانيكي"), r.mechanicName ?? t("Not assigned yet", "لم يُسند بعد")],
              [t("Where", "المكان"), r.serviceMode === "WORKSHOP" ? t("At the workshop (the customer brings the car)", "في الورشة (يُحضر الزبون السيارة)") : t("On site (the mechanic goes to the car)", "في الموقع (يذهب الميكانيكي إلى السيارة)")],
              r.skill ? [t("Skill", "المهارة"), skill(r.skill)] : null,
              [t("Car", "السيارة"), [r.vehicle.make, r.vehicle.model, r.vehicle.year].filter(Boolean).join(" ")],
              [t("Problem", "المشكلة"), r.problemDescription],
              [t("Location", "الموقع"), !r.location.approximate ? (r.location.text ?? "")
                : r.location.area ? t(`Near ${r.location.area} (approximate)`, `قرب ${cityLabel(r.location.area, isArabic)} (تقريبي)`) : t("Shared once a mechanic accepts", "يظهر بعد قبول الميكانيكي")],
              [t("Preferred time", "الوقت المفضل"), r.preferredTime],
              [t("Phone (added by the customer)", "الهاتف (أضافه الزبون)"), r.contactPhone],
            ]} />
          </Block>
          {r.location.approximate ? <Note icon="lock-closed-outline">{t("The exact address and phone are shown only while a mechanic of yours works on it.", "يظهر العنوان الدقيق والهاتف فقط أثناء عمل أحد ميكانيكييك عليه.")}</Note> : null}
          <Block title={t("Status", "الحالة")}>
            <View style={{ paddingVertical: 10 }}><Timeline steps={toSteps(buildTimeline(pathOf(r.serviceMode), r.timeline, r.status, L))} /></View>
          </Block>
          <AssignSheet visible={assigning} onClose={() => setAssigning(false)} suggestions={suggestions} current={r.mechanicUserId} onAssign={assign} />
        </>
      )}</Loaded>
    </Page>
  );
}
