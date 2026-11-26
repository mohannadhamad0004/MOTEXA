// Tow admins: every tow job = List: search, ONE chip row (All · Active · Completed · Cancelled · Declined), the company / driver / date
// filters in a "Filters" sheet (smart pickers), open reports first, ⋮ per row. Real data, newest first, 200 at most per read.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Field, GButton, Sheet } from "../../../components/garage";
import { SmartPicker } from "../../../components/manage/Form";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { isRealDate } from "../../../core/constants/files";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { towJobActions } from "../../../features/department/towActions";
import { towTone } from "../../../features/requests/garageBits";
import { fmtDateTime, useTowStatusLabels } from "../../../features/requests/requestBits";
import { adminDrivers, adminHistory } from "../../../features/tow/dispatchService";
import { useGarageTheme } from "../../../theme/garage";

type Group = "" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "DECLINED";
const ACTIVE = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

export default function AdminTowHistory() {
  const { t } = useL();
  const { row } = useGarageTheme();
  const L = useTowStatusLabels();
  const [group, setGroup] = useState<Group>(""), [q, setQ] = useState(""), [sheet, setSheet] = useState(false);
  const [f, setF] = useState({ companyId: "", driverId: "", from: "", to: "" });
  const dateOk = (v: string) => !v || isRealDate(v);
  const people = useLoad(() => adminDrivers.list(), []);
  const companies = useMemo(() => [...new Map((people.data ?? []).map((d) => [d.company.id, d.company.name])).entries()].map(([id, name]) => ({ id, label: name })), [people.data]);
  const drivers = (people.data ?? []).filter((d) => !f.companyId || d.company.id === f.companyId).map((d) => ({ id: d.id, label: d.name, sub: d.company.name }));
  // one status goes to the server (its own 200); "Active" is four statuses, filtered from the newest 200
  const server = group === "ACTIVE" ? "" : group;
  const state = useLoad(() => (dateOk(f.from) && dateOk(f.to) ? adminHistory.list({ status: server, ...f }) : Promise.resolve(null)), [server, f.companyId, f.driverId, f.from, f.to]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (state.data ?? []).filter((j) => (group !== "ACTIVE" || ACTIVE.includes(j.status)) && words.every((w) => `${j.company.name} ${j.customer.firstName} ${j.driver?.name ?? ""} ${j.vehicle.make} ${j.vehicle.model}`.toLowerCase().includes(w)))
    .sort((a, b) => (b.openReports ?? 0) - (a.openReports ?? 0));
  const summary = [companies.find((c) => c.id === f.companyId)?.label, drivers.find((d) => d.id === f.driverId)?.label, f.from && `${t("from", "من")} ${f.from}`, f.to && `${t("to", "إلى")} ${f.to}`].filter(Boolean).join(" · ");
  return (<>
    <ManagePage title={t("Tow history", "سجل السحب")} line={state.data ? t(`${rows.length} jobs`, `${rows.length} مهمة`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Company, customer, driver or car", "الشركة أو العميل أو السائق أو السيارة") }}
      filters={<FilterChips value={group} onChange={setGroup} filters={[{ key: "", label: t("All", "الكل") }, { key: "ACTIVE", label: t("Active", "نشطة") },
        { key: "COMPLETED", label: L.COMPLETED }, { key: "CANCELLED", label: L.CANCELLED }, { key: "DECLINED", label: L.DECLINED }]} />}
      above={<ManageEntry icon="options-outline" title={t("Filters", "الفلاتر")} sub={summary || t("Company, driver, dates", "الشركة والسائق والتواريخ")} onPress={() => setSheet(true)} />}
      items={rows} keyOf={(j) => j.id}
      renderItem={(j) => <ManageRow title={`${j.company.name} · ${j.customer.firstName}`}
        sub={[j.openReports ? t(`${j.openReports} open report`, `${j.openReports} بلاغ مفتوح`) : null, j.driver?.name ?? t("No driver", "بلا سائق"), `${j.vehicle.make} ${j.vehicle.model}`, fmtDateTime(j.createdAt)].filter(Boolean).join(" · ")}
        status={{ label: L[j.status], tone: j.openReports ? "danger" : towTone(j.status) }}
        onPress={() => router.push({ pathname: "/dept/tows/[id]", params: { id: j.id } })} actions={towJobActions(t, j, state.reload)} />}
      loading={!state.data && !state.error && dateOk(f.from) && dateOk(f.to)} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: t("No jobs match.", "لا توجد مهام مطابقة."), action: q || summary || group ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setGroup(""); setF({ companyId: "", driverId: "", from: "", to: "" }); } } : undefined }}
      onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a job to open it.", "اضغط على مهمة لفتحها.")} />
    <Sheet visible={sheet} onClose={() => setSheet(false)} title={t("Filters", "الفلاتر")} closeLabel={t("Close", "إغلاق")}>
        <View style={{ gap: 12 }}>
          <SmartPicker label={t("Company", "الشركة")} value={f.companyId} options={[{ id: "", label: t("All companies", "كل الشركات") }, ...companies]} onChange={(id) => setF({ ...f, companyId: id, driverId: "" })} />
          <SmartPicker label={t("Driver", "السائق")} value={f.driverId} options={[{ id: "", label: t("All drivers", "كل السائقين") }, ...drivers]} onChange={(id) => setF({ ...f, driverId: id })} />
          <View style={[row, { gap: 10 }]}>
            <View style={{ flex: 1 }}><Field label={t("From (YYYY-MM-DD)", "من (YYYY-MM-DD)")} value={f.from} onChangeText={(v) => setF({ ...f, from: v })} keyboardType="numbers-and-punctuation" maxLength={10} error={dateOk(f.from) ? undefined : t("Not a date", "ليس تاريخًا")} /></View>
            <View style={{ flex: 1 }}><Field label={t("To (YYYY-MM-DD)", "إلى (YYYY-MM-DD)")} value={f.to} onChangeText={(v) => setF({ ...f, to: v })} keyboardType="numbers-and-punctuation" maxLength={10} error={dateOk(f.to) ? undefined : t("Not a date", "ليس تاريخًا")} /></View>
          </View>
          <GButton label={t("Show jobs", "عرض المهام")} onPress={() => setSheet(false)} />
        </View>
    </Sheet>
  </>);
}
