// Mechanics admin: one live map = every active mechanic job (the mechanic's point while he shares it, the customer's pin under the
// location rule) + every Online garage mechanic (latest point, shared only while Online), every 10 s. A job opens its Detail.
import { router } from "expo-router";
import { Note } from "../../components/garage";
import { Loaded, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { MechanicLiveMap } from "../../features/mechanics/MechanicLiveMap";
import { adminGarages } from "../../features/mechanics/mechanicsService";

export default function MechanicsLive() {
  const { t } = useL();
  const state = useLoad(() => adminGarages.live(), [], 10_000);
  return (
    <Page title={t("Live map", "الخريطة المباشرة")} line={state.data ? t(`${state.data.jobs.length} active jobs · ${state.data.mechanics.length} online`, `${state.data.jobs.length} مهام نشطة · ${state.data.mechanics.length} متصل`) : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(d) => <MechanicLiveMap showGarage jobs={d.jobs} people={d.mechanics} onOpen={(id) => router.push({ pathname: "/dept/mechanic-requests/[id]", params: { id } })} />}</Loaded>
      <Note icon="phone-portrait-outline">{t("Positions come from the mechanics' phones while the MOTEXA app is open (Online garage mechanics, and the mechanic of an on-site job while he is on the way).", "تأتي المواقع من هواتف الميكانيكيين أثناء فتح تطبيق موتكسا (ميكانيكيو الكراجات المتصلون، وميكانيكي العمل الميداني أثناء قدومه).")}</Note>
    </Page>
  );
}
