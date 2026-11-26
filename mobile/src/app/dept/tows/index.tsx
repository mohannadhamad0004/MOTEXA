// Tow admins: every active tow job = a Detail whose body is the live map (driver points, customer pins, the route of the one you tap)
// + every driver who is Online (latest point, only while Online), refreshed every 10 s; ⋮ per job on the map's list.
import { router } from "expo-router";
import { Loaded, Page } from "../../../components/manage/Page";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { towJobActions } from "../../../features/department/towActions";
import { adminTows } from "../../../features/tow/dispatchService";
import { LiveJobsMap } from "../../../features/tow/LiveJobsMap";

export default function AdminActiveTows() {
  const { t } = useL();
  const state = useLoad(async () => { const [jobs, drivers] = await Promise.all([adminTows.active(), adminTows.online()]); return { jobs, drivers }; }, [], 10_000);
  return (
    <Page title={t("Active tows", "عمليات السحب الجارية")} line={state.data ? `${state.data.jobs.length} ${t("active jobs", "مهام نشطة")} · ${state.data.drivers.length} ${t("online", "متصل")}` : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(d) => <LiveJobsMap showCompany jobs={d.jobs} people={d.drivers} actions={(j) => towJobActions(t, j, state.reload)} onOpen={(id) => router.push({ pathname: "/dept/tows/[id]", params: { id } })} />}</Loaded>
    </Page>
  );
}
