// "Report a problem" from customers = List: ONE chip row Open · All with counts, open first, ⋮ = close a handled report; a row opens
// the job.
import { router } from "expo-router";
import { useState } from "react";
import { FilterChips, ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { reportActions } from "../../../features/department/towActions";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { adminHistory } from "../../../features/tow/dispatchService";

export default function AdminTowReports() {
  const { t } = useL();
  const [show, setShow] = useState<"OPEN" | "ALL">("OPEN");
  const state = useLoad(() => adminHistory.reports(false), []);
  const all = state.data ?? [];
  const open = all.filter((r) => !r.closedAt);
  const rows = (show === "OPEN" ? open : all).slice().sort((a, b) => Number(!!a.closedAt) - Number(!!b.closedAt) || b.createdAt.localeCompare(a.createdAt));
  return (
    <ManagePage title={t("Problem reports", "بلاغات المشاكل")} line={state.data ? t(`${open.length} open`, `${open.length} مفتوحة`) : undefined}
      filters={<FilterChips value={show} onChange={setShow} filters={[{ key: "OPEN", label: t("Open", "مفتوحة"), count: state.data ? open.length : undefined }, { key: "ALL", label: t("All", "الكل"), count: state.data ? all.length : undefined }]} />}
      items={rows} keyOf={(r) => r.id}
      renderItem={(r) => <ManageRow title={`${r.job.company}${r.job.driver ? ` · ${r.job.driver}` : ""}`} sub={`${r.body} · ${r.job.customerFirstName} · ${fmtDateTime(r.createdAt)}`}
        status={r.closedAt ? { label: t("Closed", "مغلق"), tone: "neutral" } : { label: t("Open", "مفتوح"), tone: "danger" }}
        onPress={() => router.push({ pathname: "/dept/tows/[id]", params: { id: r.job.id } })} actions={reportActions(t, r, state.reload)} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: t("No reports.", "لا توجد بلاغات.") }} onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a report to open its job.", "اضغط على بلاغ لفتح مهمته.")} />
  );
}
