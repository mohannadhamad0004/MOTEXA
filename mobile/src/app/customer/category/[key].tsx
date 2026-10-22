import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { DRAWINGS, DrawingKind, drawingForCategory } from "../../../components/blueprint";
import { CATALOG_GROUPS, findCategory, labelOf } from "../../../core/constants/categories";
import { useL } from "../../../core/hooks/useL";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";

const GROUP_DRAWING: Record<string, DrawingKind> = { CAR_PARTS: "car", OILS_FLUIDS: "oil", TIRES_WHEELS: "tyre", ACCESSORIES: "light", TOOLS: "toolbox" };

/** One category (or, from "All <group>" on the categories screen, a whole group): the product list limited to it. */
export default function CustomerCategory() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t, isArabic } = useL();
  const category = findCategory(key);
  const group = category ? null : CATALOG_GROUPS.find((g) => g.key === key) ?? null;
  const title = labelOf(category ?? group, isArabic) || t("Category", "الفئة");
  const kind: DrawingKind = (category && drawingForCategory(category.key)) || (group && GROUP_DRAWING[group.key]) || "disc";
  const Art = DRAWINGS[kind];

  return (
    <ProductBrowser
      category={category?.key}
      group={group?.key}
      hero={{
        height: 180,
        back: "/customer/categories",
        tl: "CATEGORY",
        art: (
          <View style={{ height: "100%", aspectRatio: 1.5 }}>
            <Art animate />
          </View>
        ),
      }}
      title={title}
      emptyText={category || group ? t("No parts in this category yet.", "لا توجد قطع في هذه الفئة بعد.") : t("This category does not exist.", "هذه الفئة غير موجودة.")}
    />
  );
}
