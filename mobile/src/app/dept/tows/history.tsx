import { router } from "expo-router";
import { ItemRow } from "../../../components/ItemActionsMenu";
import { towJobActions } from "../../../features/department/towActions";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Card, Chip, EmptyState, ErrorState, Field, GarageHero, GaragePage, GText, ListRow, SkeletonRows, StatusChip } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { isRealDate } from "../../../core/constants/files";
import { towTone } from "../../../features/requests/garageBits";
import { fmtDateTime, useTowStatusLabels } from "../../../features/requests/requestBits";
import { adminDrivers, adminHistory } from "../../../features/tow/dispatchService";
import { gType, useGarageTheme } from "../../../theme/garage";

const STATUSES = ["COMPLETED", "CANCELLED", "DECLINED", "REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] as const;

/** Tow admins: every tow job with filters (status, company, driver, dates). Real data, newest first, 200 at most. */
export default function AdminTowHistory() {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const L = useTowStatusLabels();
  const [status, setStatus] = useState<string>("");
  const [companyId, setCompanyId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dateOk = (v: string) => !v || isRealDate(v);
  const people = useLoad(() => adminDrivers.list(), []);
  const companies = useMemo(() => [...new Map((people.data ?? []).map((d) => [d.company.id, d.company.name])).entries()], [people.data]);
  const drivers = (people.data ?? []).filter((d) => !companyId || d.company.id === companyId);
  const state = useLoad(() => (dateOk(from) && dateOk(to) ? adminHistory.list({ status, companyId, driverId, from, to }) : Promise.resolve(null)), [status, companyId, driverId, from, to]);
  return (
    <GaragePage onRefresh={state.reload} hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept"))} title={t("Tow history", "سجل السحب")} line={state.data ? `${state.data.length}` : undefined} />}>
      <GText style={[gType.label, { fontWeight: "800", marginBottom: 6 }, align]}>{t("Status", "الحالة")}</GText>
      <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
        <Chip label={t("All", "الكل")} on={!status} onPress={() => setStatus("")} />
        {STATUSES.map((s) => <Chip key={s} label={L[s]} on={status === s} onPress={() => setStatus(s)} />)}
      </View>
      <GText style={[gType.label, { fontWeight: "800", marginTop: 14, marginBottom: 6 }, align]}>{t("Company", "الشركة")}</GText>
      <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
        <Chip label={t("All", "الكل")} on={!companyId} onPress={() => { setCompanyId(""); setDriverId(""); }} />
        {companies.map(([id, name]) => <Chip key={id} label={name} on={companyId === id} onPress={() => { setCompanyId(id); setDriverId(""); }} />)}
      </View>
      {drivers.length ? (
        <>
          <GText style={[gType.label, { fontWeight: "800", marginTop: 14, marginBottom: 6 }, align]}>{t("Driver", "السائق")}</GText>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
            <Chip label={t("All", "الكل")} on={!driverId} onPress={() => setDriverId("")} />
            {drivers.map((d) => <Chip key={d.id} label={d.name} on={driverId === d.id} onPress={() => setDriverId(d.id)} />)}
          </View>
        </>
      ) : null}
      <View style={[row, { gap: 10, marginTop: 14 }]}>
        <View style={{ flex: 1 }}><Field label={t("From (YYYY-MM-DD)", "من (YYYY-MM-DD)")} value={from} onChangeText={setFrom} maxLength={10} error={dateOk(from) ? undefined : t("Not a date", "ليس تاريخًا")} /></View>
        <View style={{ flex: 1 }}><Field label={t("To (YYYY-MM-DD)", "إلى (YYYY-MM-DD)")} value={to} onChangeText={setTo} maxLength={10} error={dateOk(to) ? undefined : t("Not a date", "ليس تاريخًا")} /></View>
      </View>
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error && dateOk(from) && dateOk(to) ? <SkeletonRows count={3} /> : null}
      {state.data && !state.data.length ? <EmptyState photo="empty.requests" text={t("No jobs match.", "لا توجد مهام مطابقة.")} /> : null}
      <View style={{ gap: 10, marginTop: 8 }}>
        {state.data?.map((j) => (
          <ItemRow key={j.id} title={`${j.company.name} · ${j.customer.firstName}`} onPress={() => router.push({ pathname: "/dept/tows/[id]", params: { id: j.id } })} actions={towJobActions(t, j, state.reload)}>
            <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
              <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{`${j.company.name} · ${j.customer.firstName}`}</GText>
              <StatusChip tone={towTone(j.status)} label={L[j.status]} />
            </View>
            <ListRow icon="person-outline" title={j.driver?.name ?? t("No driver", "بلا سائق")} sub={`${j.vehicle.make} ${j.vehicle.model} · ${fmtDateTime(j.createdAt)}`} />
            {j.openReports ? <StatusChip tone="danger" icon="flag" label={t(`${j.openReports} open report`, `${j.openReports} بلاغ مفتوح`)} /> : null}
          </ItemRow>
        ))}
      </View>
    </GaragePage>
  );
}
