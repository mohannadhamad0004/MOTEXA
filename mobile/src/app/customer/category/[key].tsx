import { Header } from "../../../components/layout/DashboardLayout";
import { useL } from "../../../core/hooks/useL";
import { useLocalSearchParams } from "expo-router";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";
import { CATALOG_GROUPS, findCategory, labelOf } from "../../../core/constants/categories";

/** One category (or, from "All <group>" on the categories screen, a whole group): the product list limited to it. */
export default function CustomerCategory() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t, isArabic } = useL();
  const category = findCategory(key);
  const group = category ? null : CATALOG_GROUPS.find((g) => g.key === key) ?? null;
  const title = labelOf(category ?? group, isArabic) || t("Category", "الفئة");

  return (
    <ProductBrowser
      category={category?.key}
      group={group?.key}
      header={<Header brand="MOTEXA" title={title} back />}
      emptyText={category || group ? t("No parts in this category yet.", "لا توجد قطع في هذه الفئة بعد.") : t("This category does not exist.", "هذه الفئة غير موجودة.")}
    />
  );
}
