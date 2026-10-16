import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Chip } from "../../features/catalog/catalogBits";
import { catalogService } from "../../features/catalog/catalogService";
import { CustomerScreen } from "../../features/catalog/CustomerScreen";
import { CATALOG_GROUPS, labelOf } from "../../features/shared/categories";
import { C } from "../../features/shared/palette";
import { Async, Card, Header, useL, useLoad } from "../../features/shared/ui";

/** Browse by category: the groups as tabs, that group's categories below with the real number of parts in each. */
export default function CustomerCategories() {
  const { t, row, align, isArabic } = useL();
  const [groupKey, setGroupKey] = useState(CATALOG_GROUPS[0].key);
  const state = useLoad(() => catalogService.getCategories(), []);
  const group = CATALOG_GROUPS.find((g) => g.key === groupKey)!;
  const partsLabel = (n: number) => `${n} ${n === 1 ? t("part", "قطعة") : t("parts", "قطع")}`;

  return (
    <CustomerScreen onRefresh={state.reload} refreshing={state.loading && !!state.data}>
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
                  <Ionicons name={group.icon} size={24} color={C.accent} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{t("All", "كل")} {labelOf(group, isArabic)}</Text>
                    <Text style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>{partsLabel(groupCount)}</Text>
                  </View>
                  <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
                </View>
              </Card>
              {group.categories.map((c) => {
                const n = counts.get(c.key) ?? 0;
                return (
                  <View key={c.key} style={{ opacity: n === 0 ? 0.55 : 1 }}>
                    <Card label={labelOf(c, isArabic)} onPress={() => router.push(`/customer/category/${c.key}`)}>
                      <View style={[row, { alignItems: "center", gap: 12 }]}>
                        <Ionicons name={c.icon} size={24} color={C.accent} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{labelOf(c, isArabic)}</Text>
                          <Text style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>{n === 0 ? t("No parts yet", "لا توجد قطع بعد") : partsLabel(n)}</Text>
                        </View>
                        <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
                      </View>
                    </Card>
                  </View>
                );
              })}
            </>
          );
        }}
      </Async>
    </CustomerScreen>
  );
}
