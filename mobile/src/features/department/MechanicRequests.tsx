import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ItemRow, type ItemAction } from "../../components/ItemActionsMenu";
import { Chip, EmptyState, ErrorState, GText, ListRow, SearchBar, SkeletonRows, StatusChip } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { cityLabel } from "../../core/constants/cities";
import { gType, useGarageTheme } from "../../theme/garage";
import { mechanicAdmin, ACTIVE_STATUSES, HISTORY_STATUSES, type AdminRequestRow } from "../mechanics/mechanicAdminService";
import { useMechanicStatusLabels } from "../mechanics/mechanicBits";
import { fmtDateTime } from "../requests/requestBits";
import { mechTone } from "../requests/garageBits";

/** "⋮" actions of a mechanic request: Open, and Cancel with a required reason while it is open (audited; both sides see the reason). */
export function mechanicRequestActions(t: (en: string, ar: string) => string, r: { id: string; active: boolean }, reload: () => unknown): ItemAction[] {
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => router.push(`/dept/mechanic-requests/${r.id}` as Href) }];
  if (r.active)
    out.push({
      key: "cancel", label: t("Cancel request…", "إلغاء الطلب…"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Cancel this request?", "إلغاء هذا الطلب؟"), message: t("The customer and the mechanic are told the reason.", "يُبلَّغ الزبون والميكانيكي بالسبب."), reason: { label: t("Reason (the customer and the mechanic see it)", "السبب (يراه الزبون والميكانيكي)"), required: true } },
      success: t("Request cancelled.", "تم إلغاء الطلب."), run: async (reason) => { await mechanicAdmin.cancel(r.id, reason ?? ""); await reload(); },
    });
  return out;
}

/** Mechanics admin: every mechanic request. Active / History tabs, a status filter and a search by customer, mechanic or city. Newest activity first. */
export function MechanicRequestsList() {
  const { t, isArabic } = useL();
  const { row, align } = useGarageTheme();
  const L = useMechanicStatusLabels();
  const [scope, setScope] = useState<"active" | "history">("active");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const state = useLoad(() => mechanicAdmin.list(scope, status, q), [scope, status, q], 15_000);
  const statuses = scope === "active" ? ACTIVE_STATUSES : HISTORY_STATUSES;
  const mechanicLine = (r: AdminRequestRow) => [r.mechanic.name, r.mechanic.city ? cityLabel(r.mechanic.city, isArabic) : null].filter(Boolean).join(" · ");
  const carLine = (r: AdminRequestRow) => [r.city ? t(`Car in ${cityLabel(r.city, false)}`, `السيارة في ${cityLabel(r.city, true)}`) : null, `${r.vehicle.make} ${r.vehicle.model}`, fmtDateTime(r.updatedAt)].filter(Boolean).join(" · ");
  return (
    <View>
      <View style={[row, { gap: 8, marginBottom: 12 }]}>
        <Chip label={t("Active", "النشطة")} on={scope === "active"} onPress={() => { setScope("active"); setStatus(""); }} />
        <Chip label={t("History", "السجل")} on={scope === "history"} onPress={() => { setScope("history"); setStatus(""); }} />
      </View>
      <SearchBar value={q} onChangeText={setQ} placeholder={t("Customer, mechanic or city", "الزبون أو الميكانيكي أو المدينة")} />
      <View style={[row, { flexWrap: "wrap", gap: 8, marginTop: 12 }]}>
        <Chip label={t("All", "الكل")} on={!status} onPress={() => setStatus("")} />
        {statuses.map((s) => <Chip key={s} label={L[s]} on={status === s} onPress={() => setStatus(s)} />)}
      </View>
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonRows count={3} /> : null}
      {state.data && !state.data.length ? <EmptyState photo="empty.requests" text={q || status ? t("No requests match.", "لا توجد طلبات مطابقة.") : scope === "active" ? t("No active requests.", "لا توجد طلبات نشطة.") : t("No past requests yet.", "لا توجد طلبات سابقة بعد.")} /> : null}
      <View style={{ gap: 10, marginTop: 12 }}>
        {state.data?.map((r) => (
          <ItemRow key={r.id} title={`${r.customerName} · ${r.mechanic.name}`} onPress={() => router.push(`/dept/mechanic-requests/${r.id}` as Href)} actions={mechanicRequestActions(t, r, state.reload)}>
            <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
              <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{r.customerName}</GText>
              <StatusChip tone={mechTone(r.status)} label={L[r.status]} />
            </View>
            <ListRow icon="construct-outline" title={mechanicLine(r)} sub={carLine(r)} />
          </ItemRow>
        ))}
      </View>
    </View>
  );
}
