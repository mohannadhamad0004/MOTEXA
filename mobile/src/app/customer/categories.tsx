import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Chip, ErrorState, GarageHero, GaragePage, GText, Photo, Rail, SkeletonCards, Tap } from "../../components/garage";
import { CATALOG_GROUPS, labelOf } from "../../core/constants/categories";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { catalogService } from "../../features/catalog/catalogService";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import type { PhotoKey } from "../../theme/photos";

/** Browse by category: the groups as chips, that group's categories as a photo grid with the real number of parts in each. */
export default function CustomerCategories() {
  const { g, shadow, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const [groupKey, setGroupKey] = useState(CATALOG_GROUPS[0].key);
  const state = useLoad(() => catalogService.getCategories(), []);
  const group = CATALOG_GROUPS.find((x) => x.key === groupKey)!;
  const partsLabel = (n: number) => `${n} ${n === 1 ? t("part", "قطعة") : t("parts", "قطع")}`;
  const total = state.data ? state.data.reduce((n, x) => n + x.count, 0) : null;

  const tile = (key: string, label: string, sub: string, dim: boolean) => (
    <Tap key={key} label={label} onPress={() => router.push(`/customer/category/${key}`)} style={[{ width: "48%", borderRadius: gShape.card, padding: 8, backgroundColor: g.card, opacity: dim ? 0.6 : 1 }, shadow(1)]}>
      <Photo k={`category.${key}` as PhotoKey} radius={16} style={{ width: "100%", aspectRatio: 1 }} />
      <View style={{ padding: 6 }}>
        <GText numberOfLines={2} style={[gType.label, { fontWeight: "800", minHeight: 40 }, align]}>{label}</GText>
        <GText soft style={[gType.caption, align]}>{sub}</GText>
      </View>
    </Tap>
  );

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/parts"))}
          title={t("Categories", "الفئات")}
          line={total !== null ? t(`${total} parts in ${CATALOG_GROUPS.length} groups`, `${total} قطعة في ${CATALOG_GROUPS.length} مجموعات`) : undefined}
        />
      }
    >
      <Rail gap={8}>
        {CATALOG_GROUPS.map((x) => (
          <Chip key={x.key} label={labelOf(x, isArabic)} on={x.key === groupKey} onPress={() => setGroupKey(x.key)} />
        ))}
      </Rail>
      <View style={{ marginTop: 16 }}>
        {state.error && !state.data ? (
          <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !state.data ? (
          <SkeletonCards />
        ) : (
          (() => {
            const counts = new Map(state.data.flatMap((x) => x.categories.map((c) => [c.key, c.count] as const)));
            const groupCount = state.data.find((x) => x.key === groupKey)?.count ?? 0;
            return (
              <View style={[row, { flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 }]}>
                {tile(group.key, `${t("All", "كل")} ${labelOf(group, isArabic)}`, partsLabel(groupCount), false)}
                {group.categories.map((c) => {
                  const n = counts.get(c.key) ?? 0;
                  return tile(c.key, labelOf(c, isArabic), n === 0 ? t("No parts yet", "لا توجد قطع بعد") : partsLabel(n), n === 0);
                })}
              </View>
            );
          })()
        )}
      </View>
    </GaragePage>
  );
}
