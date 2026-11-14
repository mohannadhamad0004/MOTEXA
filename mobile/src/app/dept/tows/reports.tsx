import { router } from "expo-router";
import { ItemRow } from "../../../components/ItemActionsMenu";
import { reportActions } from "../../../features/department/towActions";
import { useState } from "react";
import { View } from "react-native";
import { Chip, EmptyState, ErrorState, GarageHero, GaragePage, GText, SkeletonRows, StatusChip } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { adminHistory } from "../../../features/tow/dispatchService";
import { gType, useGarageTheme } from "../../../theme/garage";

/** "Report a problem" from customers. Open the job to see everything; close a report once handled. */
export default function AdminTowReports() {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const [open, setOpen] = useState(true);
  const state = useLoad(() => adminHistory.reports(open), [open]);
  return (
    <GaragePage onRefresh={state.reload} hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept"))} title={t("Problem reports", "بلاغات المشاكل")} line={state.data ? `${state.data.length}` : undefined} />}>
      <View style={[row, { gap: 8, marginBottom: 12 }]}>
        <Chip label={t("Open", "مفتوحة")} on={open} onPress={() => setOpen(true)} />
        <Chip label={t("All", "الكل")} on={!open} onPress={() => setOpen(false)} />
      </View>
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonRows count={3} /> : null}
      {state.data && !state.data.length ? <EmptyState photo="empty.requests" text={t("No reports.", "لا توجد بلاغات.")} /> : null}
      <View style={{ gap: 10 }}>
        {state.data?.map((r) => (
          <ItemRow key={r.id} title={`${r.job.company}${r.job.driver ? ` · ${r.job.driver}` : ""}`} onPress={() => router.push({ pathname: "/dept/tows/[id]", params: { id: r.job.id } })} actions={reportActions(t, r, state.reload)}>
            <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
              <GText style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{`${r.job.company}${r.job.driver ? ` · ${r.job.driver}` : ""}`}</GText>
              <StatusChip tone={r.closedAt ? "neutral" : "danger"} label={r.closedAt ? t("Closed", "مغلق") : t("Open", "مفتوح")} />
            </View>
            <GText style={[gType.body, align, { marginVertical: 8 }]}>{r.body}</GText>
            <GText soft style={[gType.caption, align]}>{`${r.job.customerFirstName} · ${fmtDateTime(r.createdAt)}`}</GText>
          </ItemRow>
        ))}
      </View>
    </GaragePage>
  );
}
