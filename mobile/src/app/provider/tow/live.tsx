import { router } from "expo-router";
import { ErrorState, GarageHero,  SkeletonBlock } from "../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../components/layout/ProviderLayout";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { companyDispatch } from "../../../features/tow/dispatchService";
import { LiveJobsMap } from "../../../features/tow/LiveJobsMap";
import { gShape } from "../../../theme/garage";

/** The company's Live map: all its active jobs (driver points + customer pins), refreshed every 10 s. */
export default function CompanyLive() {
  const { t } = useL();
  const state = useLoad(() => companyDispatch.live(), [], 10_000);
  return (
    <GaragePage
      onRefresh={state.reload}
      hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/tow"))} title={t("Live map", "الخريطة المباشرة")} line={state.data ? `${state.data.length} ${t("active jobs", "مهام نشطة")}` : undefined} />}
    >
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonBlock height={320} radius={gShape.card} /> : null}
      {state.data ? <LiveJobsMap jobs={state.data} onOpen={(id) => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id } })} /> : null}
    </GaragePage>
  );
}
