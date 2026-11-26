// The company's Live map = a Detail whose body is the map: all its active jobs (driver points + customer pins) and its drivers who are
// Online (latest point, shared only while Online), every 10 s.
import { router } from "expo-router";
import { Loaded, Page } from "../../../components/manage/Page";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { companyDispatch } from "../../../features/tow/dispatchService";
import { LiveJobsMap } from "../../../features/tow/LiveJobsMap";

export default function CompanyLive() {
  const { t } = useL();
  const state = useLoad(() => companyDispatch.live(), [], 10_000);
  return (
    <Page title={t("Live map", "الخريطة المباشرة")} line={state.data ? `${state.data.jobs.length} ${t("active jobs", "مهام نشطة")} · ${state.data.drivers.length} ${t("online", "متصل")}` : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(d) => <LiveJobsMap jobs={d.jobs} people={d.drivers} onOpen={(id) => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id } })} />}</Loaded>
    </Page>
  );
}
