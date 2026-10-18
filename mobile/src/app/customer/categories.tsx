import { Async } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Card";
import { Header } from "../../components/layout/DashboardLayout";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { Screen } from "../../components/layout/Screen";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Chip } from "../../features/catalog/catalogBits";
import { catalogService } from "../../features/catalog/catalogService";
import { CATALOG_GROUPS, labelOf } from "../../core/constants/categories";

/** Browse by category: the groups as tabs, that group's categories below with the real number of parts in each. */
export default function CustomerCategories() {
  const { c: col } = useTheme();
  const { t, row, align, isArabic } = useL();
  const [groupKey, setGroupKey] = useState(CATALOG_GROUPS[0].key);
  const state = useLoad(() => catalogService.getCategories(), []);
  const group = CATALOG_GROUPS.find((g) => g.key === groupKey)!;
  const partsLabel = (n: number) => `${n} ${n === 1 ? t("part", "قطعة") : t("parts", "قطع")}`;

  return (
    <Screen onRefresh={state.reload} refreshing={state.loading && !!state.data}>
      <Header brand="MOTEXA" title={t("Categories", "الفئات")} subtitle={t("Shop by category", "تسوق حسب الفئة")} back />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={[row, { gap: 8 }]}>
        {CATALOG_GROUPS.map((g) => (
          <Chip key={g.key} icon={g.icon} label={labelOf(g, isArabic)} on={g.key === groupKey} onPress={() => setGroupKey(g.key)} />
        ))}
      </ScrollView>
      <Async state={state}>
        {(groups) => {
          const counts = new Map(groups.flatMap((g) => g.categories.map((c) => [c.key, c.count] as const)));
          const groupCount = groups.find((g) => g.key === groupKey)?.count ?? 0;
          return (
            <>
              <Card label={labelOf(group, isArabic)} onPress={() => router.push(`/customer/category/${group.key}`)}>
                <View style={[row, { alignItems: "center", gap: 12 }]}>
                  <Ionicons name={group.icon} size={24} color={col.accent} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{t("All", "كل")} {labelOf(group, isArabic)}</Text>
                    <Text style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{partsLabel(groupCount)}</Text>
                  </View>
                  <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
                </View>
              </Card>
              {group.categories.map((c) => {
                const n = counts.get(c.key) ?? 0;
                return (
                  <View key={c.key} style={{ opacity: n === 0 ? 0.55 : 1 }}>
                    <Card label={labelOf(c, isArabic)} onPress={() => router.push(`/customer/category/${c.key}`)}>
                      <View style={[row, { alignItems: "center", gap: 12 }]}>
                        <Ionicons name={c.icon} size={24} color={col.accent} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{labelOf(c, isArabic)}</Text>
                          <Text style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{n === 0 ? t("No parts yet", "لا توجد قطع بعد") : partsLabel(n)}</Text>
                        </View>
                        <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
                      </View>
                    </Card>
                  </View>
                );
              })}
            </>
          );
        }}
      </Async>
    </Screen>
  );
}
