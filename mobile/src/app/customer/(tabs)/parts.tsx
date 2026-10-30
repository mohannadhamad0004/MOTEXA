import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { GarageHero, Toggle } from "../../../components/garage";
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
        <GarageHero
          variant="tab"
          tab="parts"
          onMap={() => router.push("/customer/parts/map")}
          title={t("Parts", "القطع")}
          line={
            s.total === null
              ? undefined
              : s.fitOn && s.car
                ? t(`${s.total} ${s.total === 1 ? "part fits" : "parts fit"} your ${carName({ ...s.car, year: "" })}`, `${s.total} قطعة تناسب ${carName({ ...s.car, year: "" })}`)
                : shops.data
                  ? t(`${s.total} ${s.total === 1 ? "part" : "parts"} from ${shopCount} ${shopCount === 1 ? "shop" : "shops"}`, `${s.total} قطعة من ${shopCount} متاجر`)
                  : undefined
          }
        >
          <Toggle label={t("Fits my car", "تناسب سيارتي")} sub={s.car ? carName(s.car) : t("Set your car", "حدّد سيارتك")} value={s.fitOn} onChange={s.setFit} />
        </GarageHero>
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
