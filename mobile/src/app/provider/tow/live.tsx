// The company's Live map = a Detail whose body is the map: all its active jobs (driver points + customer pins), every 10 s.
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
    <Page title={t("Live map", "الخريطة المباشرة")} line={state.data ? `${state.data.length} ${t("active jobs", "مهام نشطة")}` : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(jobs) => <LiveJobsMap jobs={jobs} onOpen={(id) => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id } })} />}</Loaded>
    </Page>
  );
}
