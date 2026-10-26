import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { UnderlineTabs } from "../../../components/blueprint";
import { ALL_CATEGORIES, labelOf } from "../../../core/constants/categories";
import { useL } from "../../../core/hooks/useL";
import type { PartSort } from "../../../features/catalog/catalogService";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";
import { useIgnition } from "../../../motion";

// The Parts tab: compact hero (Fits my car), search + filters, ONE category row, then the products.
export default function CustomerParts() {
  const { t, isArabic } = useL();
  const params = useLocalSearchParams<{ q?: string; sort?: string; fit?: string }>();
  const SORTS = ["relevance", "price_asc", "price_desc", "newest"];
  const sortParam = SORTS.includes(params.sort ?? "") ? (params.sort as PartSort) : undefined;
  const [category, setCategory] = useState<string | null>(null);
  const ig = useIgnition("parts");

  return (
    <ProductBrowser
      tabs
      partsHero
      ignition={ig}
      initialQ={params.q}
      initialSort={sortParam}
      initialFit={params.fit === "1"}
      category={category}
      afterSearch={
        <UnderlineTabs
          value={category ?? "ALL"}
          onChange={(k) => setCategory(k === "ALL" ? null : k)}
          items={[{ key: "ALL", label: t("All", "الكل") }, ...ALL_CATEGORIES.map((c) => ({ key: c.key, label: labelOf(c, isArabic) }))]}
        />
      }
    />
  );
}
