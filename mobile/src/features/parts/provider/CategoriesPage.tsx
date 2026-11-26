// The shared category list = List (read only): MOTEXA manages the taxonomy; a shop picks one while editing a product.
import { useState } from "react";
import { ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { CATALOG_GROUPS, labelOf } from "../../../core/constants/categories";
import { useL } from "../../../core/hooks/useL";

export default function CategoriesPage() {
  const { t, isArabic } = useL();
  const [q, setQ] = useState("");
  const all = CATALOG_GROUPS.flatMap((g) => g.categories.flatMap((c) => (c.children ?? [c]).map((k) => ({ key: k.key, title: labelOf(k, isArabic), sub: [labelOf(g, isArabic), c.children ? labelOf(c, isArabic) : null].filter(Boolean).join(" · "), find: [k.en, k.ar, c.en, c.ar, g.en, g.ar].join(" ").toLowerCase() }))));
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter((r) => words.every((w) => r.find.includes(w)));
  return (
    <ManagePage title={t("Categories", "الفئات")} line={t("Managed by MOTEXA · choose one while editing a product", "تديرها موتكسا · اختر فئة عند تعديل المنتج")}
      search={{ value: q, onChange: setQ, placeholder: t("Search categories", "ابحث عن فئة") }}
      items={rows} keyOf={(r) => r.key} renderItem={(r) => <ManageRow title={r.title} sub={r.sub} />}
      loading={false} error={null} onRetry={() => undefined}
      empty={{ text: t("No category matches.", "لا توجد فئة مطابقة."), action: { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } }} />
  );
}
