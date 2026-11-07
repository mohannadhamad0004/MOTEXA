import { router } from "expo-router";
import { View } from "react-native";
import { Card, ErrorState, GarageHero, GText, ListRow, Section, SkeletonRows } from "../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../components/layout/ProviderLayout";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { companyStatsApi } from "../../../features/tow/dispatchService";
import { RatingText } from "../../../features/tow/DriverCard";
import { gType, useGarageTheme } from "../../../theme/garage";

/** The company's numbers, counted from its real jobs and reviews (nothing estimated). */
export default function CompanyStats() {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const state = useLoad(() => companyStatsApi.get(), []);
  const s = state.data;
  const tile = (label: string, value: string | number) => (
    <Card pad={12} style={{ flexBasis: "47%", flexGrow: 1 }}>
      <GText soft style={[gType.caption, align]}>{label}</GText>
      <GText style={[gType.title, { fontSize: 24, color: g.ink }, align]}>{String(value)}</GText>
    </Card>
  );
  return (
    <GaragePage onRefresh={state.reload} hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/tow"))} title={t("Statistics", "الإحصائيات")} line={s ? t(`${s.total} requests`, `${s.total} طلب`) : undefined} />}>
      {state.error && !s ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!s && !state.error ? <SkeletonRows count={3} /> : null}
      {s ? (
        <>
          <View style={[row, { flexWrap: "wrap", gap: 10 }]}>
            {tile(t("Completed", "مكتملة"), s.completed)}
            {tile(t("Open now", "مفتوحة الآن"), s.open)}
            {tile(t("Cancelled", "ملغاة"), s.cancelled)}
            {tile(t("Declined", "مرفوضة"), s.declined)}
            {tile(t("Not answered in time", "لم يُرد عليها في الوقت"), s.timeouts)}
            {tile(t("Distance towed (km)", "المسافة المسحوبة (كم)"), s.distanceKm)}
          </View>
          <Card pad={12} style={{ marginTop: 12 }}>
            <View style={[row, { alignItems: "center", justifyContent: "space-between" }]}>
              <GText style={[gType.label, { fontWeight: "800" }]}>{t("Company rating", "تقييم الشركة")}</GText>
              <RatingText rating={s.rating} />
            </View>
          </Card>
          <Section title={t("Drivers", "السائقون")}>
            <Card pad={12}>
              {s.drivers.map((d, i) => (
                <ListRow key={d.id} divider={i > 0} icon="person-outline" title={d.name} sub={t(`${d.completed} completed`, `${d.completed} مكتملة`)} end={<RatingText rating={d.rating} />} />
              ))}
            </Card>
          </Section>
        </>
      ) : null}
    </GaragePage>
  );
}
