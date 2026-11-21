import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Chip, GarageHero, Photo, Rail, Toggle } from "../../../components/garage";
import { CATALOG_GROUPS, findCategory, labelOf } from "../../../core/constants/categories";
import { useL } from "../../../core/hooks/useL";
import { carName } from "../../../features/catalog/catalogBits";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";
import type { PhotoKey } from "../../../theme/photos";

/** One category (or, from "All <group>" on the categories screen, a whole group): the product list limited to it. */
export default function CustomerCategory() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t, isArabic } = useL();
  const category = findCategory(key);
  // a category with sub-categories: "All" (itself + every sub-category, each part once) or one sub-category
  const [sub, setSub] = useState<string | null>(null);
  const group = category ? null : CATALOG_GROUPS.find((g) => g.key === key) ?? null;
  const title = labelOf(category ?? group, isArabic) || t("Category", "الفئة");
  const photo = (category || group ? `category.${(category ?? group)!.key}` : "empty.search") as PhotoKey;

  return (
    <ProductBrowser
      category={sub ?? category?.key}
      afterSearch={
        category?.children ? (
          <Rail gap={8}>
            <Chip label={`${t("All", "كل")} ${labelOf(category, isArabic)}`} on={!sub} onPress={() => setSub(null)} />
            {category.children.map((c) => (
              <Chip key={c.key} icon={c.icon} label={labelOf(c, isArabic)} on={sub === c.key} onPress={() => setSub(sub === c.key ? null : c.key)} />
            ))}
          </Rail>
        ) : category?.parent ? (
          <Rail gap={8}>
            <Chip icon="arrow-up-outline" label={`${t("All", "كل")} ${labelOf(findCategory(category.parent), isArabic)}`} onPress={() => router.replace(`/customer/category/${category.parent}`)} />
          </Rail>
        ) : undefined
      }
      group={group?.key}
      hero={(s) => (
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/categories"))}
          title={title}
          line={s.total === null ? undefined : s.fitOn && s.car ? t(`${s.total} ${s.total === 1 ? "part fits" : "parts fit"} your ${carName({ ...s.car, year: "" })}`, `${s.total} قطعة تناسب ${carName({ ...s.car, year: "" })}`) : `${s.total} ${s.total === 1 ? t("part", "قطعة") : t("parts", "قطع")}`}
          visual={<Photo k={photo} radius={20} style={{ width: 96, height: 96 }} />}
        >
          <Toggle label={t("Fits my car", "تناسب سيارتي")} sub={s.car ? carName(s.car) : t("Set your car", "حدّد سيارتك")} value={s.fitOn} onChange={s.setFit} />
        </GarageHero>
      )}
      emptyText={category || group ? t("No parts in this category yet.", "لا توجد قطع في هذه الفئة بعد.") : t("This category does not exist.", "هذه الفئة غير موجودة.")}
    />
  );
}
