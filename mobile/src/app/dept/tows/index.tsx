import { router } from "expo-router";
import { ErrorState, GarageHero, GaragePage, SkeletonBlock } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { adminTows } from "../../../features/tow/dispatchService";
import { towJobActions } from "../../../features/department/towActions";
import { LiveJobsMap } from "../../../features/tow/LiveJobsMap";
import { gShape } from "../../../theme/garage";

/** Tow admins: every active tow job (driver points + customer pins + the route of the one you tap), refreshed every 10 s. */
export default function AdminActiveTows() {
  const { t } = useL();
  const state = useLoad(() => adminTows.active(), [], 10_000);
  return (
    <GaragePage
      onRefresh={state.reload}
      hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept"))} title={t("Active tows", "عمليات السحب الجارية")} line={state.data ? `${state.data.length} ${t("active jobs", "مهام نشطة")}` : undefined} />}
    >
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonBlock height={320} radius={gShape.card} /> : null}
      {state.data ? <LiveJobsMap showCompany jobs={state.data} actions={(j) => towJobActions(t, j, state.reload)} onOpen={(id) => router.push({ pathname: "/dept/tows/[id]", params: { id } })} /> : null}
    </GaragePage>
  );
}
