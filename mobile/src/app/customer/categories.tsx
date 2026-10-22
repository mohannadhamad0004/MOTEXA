import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { BlueprintPage, Icon, PageTitle, PartThumb, Press, Sub, Toolbox, UnderlineTabs } from "../../components/blueprint";
import { Async } from "../../components/ui/Feedback";
import { Text } from "../../components/ui/Text";
import { CATALOG_GROUPS, labelOf } from "../../core/constants/categories";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { catalogService } from "../../features/catalog/catalogService";
import { useTheme } from "../../theme/useTheme";

/** Browse by category: the groups as tabs, that group's categories below with the real number of parts in each. */
export default function CustomerCategories() {
  const { c } = useTheme();
  const { t, row, align, isArabic } = useL();
  const [groupKey, setGroupKey] = useState(CATALOG_GROUPS[0].key);
  const state = useLoad(() => catalogService.getCategories(), []);
  const group = CATALOG_GROUPS.find((g) => g.key === groupKey)!;
  const partsLabel = (n: number) => `${n} ${n === 1 ? t("part", "قطعة") : t("parts", "قطع")}`;

  const line = (key: string, label: string, sub: string, category: string | null, dim: boolean) => (
    <Press
      key={key}
      accessibilityLabel={label}
      onPress={() => router.push(`/customer/category/${key}`)}
      style={[row, { alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line + "99", opacity: dim ? 0.55 : 1 }]}
    >
      <PartThumb category={category} size={52} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{label}</Text>
        <Text style={[{ color: c.soft, fontSize: 12, marginTop: 2 }, align]}>{sub}</Text>
      </View>
      <Icon name="chev" size={16} color={c.soft} />
    </Press>
  );

  return (
    <BlueprintPage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={{
        height: 180,
        back: "/customer/parts",
        tl: "CATEGORIES",
        art: (
          <View style={{ height: "100%", aspectRatio: 1.5 }}>
            <Toolbox animate />
          </View>
        ),
      }}
    >
      <PageTitle>{t("Categories", "الفئات")}</PageTitle>
      <Sub>{t("Shop by category", "تسوق حسب الفئة")}</Sub>
      <View style={{ marginTop: 20 }}>
        <UnderlineTabs value={groupKey} onChange={setGroupKey} items={CATALOG_GROUPS.map((g) => ({ key: g.key, label: labelOf(g, isArabic) }))} />
      </View>
      <Async state={state}>
        {(groups) => {
          const counts = new Map(groups.flatMap((g) => g.categories.map((x) => [x.key, x.count] as const)));
          const groupCount = groups.find((g) => g.key === groupKey)?.count ?? 0;
          return (
            <View style={{ marginTop: 8 }}>
              {line(group.key, `${t("All", "كل")} ${labelOf(group, isArabic)}`, partsLabel(groupCount), null, false)}
              {group.categories.map((x) => {
                const n = counts.get(x.key) ?? 0;
                return line(x.key, labelOf(x, isArabic), n === 0 ? t("No parts yet", "لا توجد قطع بعد") : partsLabel(n), x.key, n === 0);
              })}
            </View>
          );
        }}
      </Async>
    </BlueprintPage>
  );
}
