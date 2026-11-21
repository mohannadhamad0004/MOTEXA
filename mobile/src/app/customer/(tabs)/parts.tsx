import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { HeroLayout } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { carName } from "../../../features/catalog/catalogBits";
import { catalogService, type PartSort } from "../../../features/catalog/catalogService";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";
import { BrandStrip, QuickCategories, SectionHead, ShopsStrip } from "../../../features/catalog/partsLanding";

// The Parts tab: garage hero (real count + Fits my car), search + filters, quick category groups, approved shops, then the products.
export default function CustomerParts() {
  const { t } = useL();
  const params = useLocalSearchParams<{ q?: string; sort?: string; fit?: string }>();
  const SORTS = ["relevance", "price_asc", "price_desc", "newest", "discount"];
  const sortParam = SORTS.includes(params.sort ?? "") ? (params.sort as PartSort) : undefined;
  const [group, setGroup] = useState<string | null>(null);
  const shops = useLoad(() => catalogService.getShops(), []);
  const shopCount = (shops.data ?? []).filter((s) => s.productCount > 0).length;

  return (
    <ProductBrowser
      tabs
      entry="parts"
      initialQ={params.q}
      initialSort={sortParam}
      initialFit={params.fit === "1"}
      group={group}
      hero={(s) => (
        <HeroLayout
          config={{
            tab: "parts",
            title: t("Parts", "القطع"),
            line:
            s.total === null
              ? undefined
              : s.fitOn && s.car
                ? s.browsing
                  ? t(`${s.total} ${s.total === 1 ? "part fits" : "parts fit"} the ${carName(s.car)}`, `${s.total} قطعة تناسب ${carName(s.car)}`)
                  : t(`${s.total} ${s.total === 1 ? "part fits" : "parts fit"} your ${carName({ ...s.car, year: "" })}`, `${s.total} قطعة تناسب ${carName({ ...s.car, year: "" })}`)
                : shops.data
                  ? t(`${s.total} ${s.total === 1 ? "part" : "parts"} from ${shopCount} ${shopCount === 1 ? "shop" : "shops"}`, `${s.total} قطعة من ${shopCount} متاجر`)
                  : undefined,
            // no car yet: setFit(true) opens the car picker
            action: { kind: "toggle", icon: "car-sport-outline", label: t("Fits my car", "تناسب سيارتي"), on: s.fitOn && !s.browsing, onPress: () => s.setFit(!(s.fitOn && !s.browsing)) },
          }}
        />
      )}
      afterSearch={
        <>
          <QuickCategories value={group} onChange={setGroup} />
          <ShopsStrip />
          <SectionHead title={t("Parts", "القطع")} />
        </>
      }
      footerExtra={<BrandStrip />}
    />
  );
}
