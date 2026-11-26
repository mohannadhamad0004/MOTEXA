// The mechanic's service requests = List: search, ONE chip row New · Active · Past with counts (`?filter=` from the home's Needs-you
// row and tiles), compact rows (customer, car, skill, time, status), ⋮ = the step the current status allows. Re-reads every 15 s.
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { FilterChips, ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { inboxActions } from "../../../features/mechanics/inboxActions";
import { useMechanicStatusLabels, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MechanicRequestStatus, REFRESH_MS, mechanicInbox } from "../../../features/mechanics/mechanicsService";
import { mechTone } from "../../../features/requests/garageBits";
import { fmtDateTime } from "../../../features/requests/requestBits";

type Tab = "new" | "active" | "past";
// What a mechanic thinks in: waiting for an answer, on a job, finished.
const GROUPS: Record<Tab, MechanicRequestStatus[]> = { new: ["REQUESTED"], active: ["ACCEPTED", "IN_PROGRESS"], past: ["COMPLETED", "DECLINED", "CANCELLED"] };
const isTab = (v?: string): v is Tab => v === "new" || v === "active" || v === "past";

export default function MechanicInbox() {
  const { t } = useL();
  const skill = useSkillLabel();
  const L = useMechanicStatusLabels();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [tab, setTab] = useState<Tab>(isTab(params.filter) ? params.filter : "new"), [q, setQ] = useState("");
  useEffect(() => { if (isTab(params.filter)) setTab(params.filter); }, [params.filter]);
  const state = useLoad(() => mechanicInbox.list(), [], REFRESH_MS);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (state.data ?? []).filter((r) => words.every((w) => `${r.customerName} ${r.vehicle.make} ${r.vehicle.model} ${r.skill ? skill(r.skill) : ""} ${r.problemDescription}`.toLowerCase().includes(w)));
  const count = (g: Tab) => found.filter((r) => GROUPS[g].includes(r.status)).length;
  const rows = found.filter((r) => GROUPS[tab].includes(r.status));
  return (
    <ManagePage title={t("Service requests", "طلبات الخدمة")}
      line={state.data ? t(`${count("new")} new · ${count("active")} active`, `${count("new")} جديدة · ${count("active")} نشطة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Customer, car, skill or problem", "العميل أو السيارة أو المهارة أو المشكلة") }}
      filters={<FilterChips value={tab} onChange={setTab} filters={[
        { key: "new", label: t("New", "جديدة"), count: state.data ? count("new") : undefined },
        { key: "active", label: t("Active", "نشطة"), count: state.data ? count("active") : undefined },
        { key: "past", label: t("Past", "سابقة"), count: state.data ? count("past") : undefined },
      ]} />}
      items={rows} keyOf={(r) => r.id}
      renderItem={(r) => <ManageRow title={r.customerName} status={{ label: L[r.status], tone: mechTone(r.status) }}
        sub={[`${r.vehicle.make} ${r.vehicle.model}`, r.skill ? skill(r.skill) : null, fmtDateTime(r.updatedAt)].filter(Boolean).join(" · ")}
        onPress={() => router.push(`/mechanic/requests/${r.id}` as Href)} actions={inboxActions(t, r, state.reload)} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : tab === "new" ? t("No new requests.", "لا توجد طلبات جديدة.") : tab === "active" ? t("No active jobs.", "لا توجد أعمال نشطة.") : t("Nothing here yet.", "لا يوجد شيء هنا بعد."),
        action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a request to open it.", "اضغط على طلب لفتحه.")} />
  );
}
