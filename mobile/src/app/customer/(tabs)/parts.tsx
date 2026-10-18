import { Button } from "../../../components/ui/Button";
import { Header } from "../../../components/layout/DashboardLayout";
import { useL } from "../../../core/hooks/useL";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Chip } from "../../../features/catalog/catalogBits";
import type { PartSort } from "../../../features/catalog/catalogService";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";
import { ALL_CATEGORIES, labelOf } from "../../../core/constants/categories";

export default function CustomerParts() {
  const { t, row, isArabic } = useL();
  const params = useLocalSearchParams<{ q?: string; sort?: string; fit?: string }>();
  const SORTS = ["relevance", "price_asc", "price_desc", "newest"];
  const sortParam = SORTS.includes(params.sort ?? "") ? (params.sort as PartSort) : undefined;
  const [category, setCategory] = useState<string | null>(null);

  return (
    <ProductBrowser
      tabs
      initialQ={params.q}
      initialSort={sortParam}
      initialFit={params.fit === "1"}
      category={category}
      header={<Header brand="MOTEXA" title={t("Parts", "قطع الغيار")} subtitle={t("Find the right part for your car", "اعثر على القطعة المناسبة لسيارتك")} />}
      afterSearch={
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={[row, { gap: 8 }]}>
            <Chip label={t("All", "الكل")} on={category === null} onPress={() => setCategory(null)} />
            {ALL_CATEGORIES.map((c) => (
              <Chip key={c.key} icon={c.icon} label={labelOf(c, isArabic)} on={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)} />
            ))}
          </ScrollView>
          <View style={{ marginBottom: 12 }}>
            <Button variant="ghost" icon="grid-outline" label={t("Browse categories", "تصفح الفئات")} onPress={() => router.push("/customer/categories")} />
          </View>
        </>
      }
    />
  );
}
