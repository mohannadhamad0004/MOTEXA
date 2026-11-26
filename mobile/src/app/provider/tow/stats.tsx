// The company's numbers = Dashboard (a sub-page: no hero), counted from its real jobs and reviews (nothing estimated).
import { View } from "react-native";
import { GText } from "../../../components/garage";
import { gType } from "../../../theme/garage";
import { Block, Facts, Kpis, Loaded, Page } from "../../../components/manage/Page";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { companyStatsApi } from "../../../features/tow/dispatchService";
import { RatingText } from "../../../features/tow/DriverCard";

export default function CompanyStats() {
  const { t } = useL();
  const state = useLoad(() => companyStatsApi.get(), []);
  return (
    <Page title={t("Statistics", "الإحصائيات")} line={state.data ? t(`${state.data.total} requests`, `${state.data.total} طلب`) : undefined} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{(s) => (
        <>
          <Kpis items={[
            { label: t("Completed", "مكتملة"), value: s.completed, icon: "checkmark-done-outline" }, { label: t("Open now", "مفتوحة الآن"), value: s.open, icon: "time-outline" },
            { label: t("Cancelled", "ملغاة"), value: s.cancelled }, { label: t("Declined", "مرفوضة"), value: s.declined },
            { label: t("Not answered in time", "لم يُرد عليها في الوقت"), value: s.timeouts }, { label: t("Distance towed (km)", "المسافة المسحوبة (كم)"), value: s.distanceKm },
          ]} />
          <Block><Facts rows={[[t("Company rating", "تقييم الشركة"), <RatingText key="r" rating={s.rating} />]]} /></Block>
          {s.drivers.length ? (
            <Block title={t("Drivers", "السائقون")}>
              <Facts rows={s.drivers.map((d) => [d.name, <View key={d.id} style={{ gap: 2 }}><GText style={gType.bodySm}>{t(`${d.completed} completed`, `${d.completed} مكتملة`)}</GText><RatingText rating={d.rating} /></View>] as [string, React.ReactNode])} />
            </Block>
          ) : null}
        </>
      )}</Loaded>
    </Page>
  );
}
