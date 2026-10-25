import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { BrakeDisc, Icon, UnderlineTabs } from "../../../components/blueprint";
import { Text } from "../../../components/ui/Text";
import { ALL_CATEGORIES, labelOf } from "../../../core/constants/categories";
import { useL } from "../../../core/hooks/useL";
import type { PartSort } from "../../../features/catalog/catalogService";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";
import { useIgnition } from "../../../motion";
import { useTheme } from "../../../theme/useTheme";

export default function CustomerParts() {
  const { t, row, isArabic } = useL();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ q?: string; sort?: string; fit?: string }>();
  const SORTS = ["relevance", "price_asc", "price_desc", "newest"];
  const sortParam = SORTS.includes(params.sort ?? "") ? (params.sort as PartSort) : undefined;
  const [category, setCategory] = useState<string | null>(null);
  const ig = useIgnition("parts");

  return (
    <ProductBrowser
      tabs
      ignition={ig}
      initialQ={params.q}
      initialSort={sortParam}
      initialFit={params.fit === "1"}
      category={category}
      hero={{
        height: 220,
        tl: "PARTS / 03",
        art: (
          <View style={{ height: "100%", aspectRatio: 1.5 }}>
            <BrakeDisc animate={ig} />
          </View>
        ),
      }}
      title={t("Parts", "القطع")}
      sub={t("Matched to your car first.", "المناسبة لسيارتك أولاً.")}
      afterSearch={
        <>
          <UnderlineTabs
            value={category ?? "ALL"}
            onChange={(k) => setCategory(k === "ALL" ? null : k)}
            items={[{ key: "ALL", label: t("All", "الكل") }, ...ALL_CATEGORIES.map((c) => ({ key: c.key, label: labelOf(c, isArabic) }))]}
          />
          <Pressable accessibilityRole="button" onPress={() => router.push("/customer/categories")} style={[row, { minHeight: 44, alignItems: "center", gap: 4 }]}>
            <Text style={{ color: c.bronze, fontSize: 13, fontWeight: "700" }}>{t("Browse categories", "تصفح الفئات")}</Text>
            <Icon name="arrow" size={16} color={c.bronze} />
          </Pressable>
        </>
      }
    />
  );
}
