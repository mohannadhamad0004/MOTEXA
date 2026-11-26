// Shop performance = Dashboard (a sub-page: no hero): real counts as KPI tiles, then coverage as facts.
import { Block, Facts, Kpis, Loaded, Page } from "../../../components/manage/Page";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { portalApi } from "../../provider/portal/api";

const TILES: [string, string, string][] = [["Products", "المنتجات", "products"], ["Customer-visible", "ظاهرة للعملاء", "visibleProducts"], ["Hidden by MOTEXA", "مخفية بواسطة موتكسا", "hiddenProducts"],
  ["Completed orders", "طلبات مكتملة", "completedOrders"], ["Stock units", "وحدات المخزون", "stockUnits"], ["Reserved units", "وحدات محجوزة", "reservedUnits"], ["Available units", "وحدات متاحة", "availableUnits"],
  ["Missing photos", "صور ناقصة", "missingPhotos"], ["Published 3D products", "منتجات ثلاثية الأبعاد منشورة", "products3d"], ["Without published 3D", "دون نموذج منشور", "without3d"]];

export default function AnalyticsPage() {
  const { t } = useL();
  const state = useLoad(() => portalApi.summary("parts"), []);
  return (
    <Page title={t("Performance", "الأداء")} line={t("Operational numbers of your shop", "أرقام متجرك التشغيلية")} onRefresh={() => void state.reload()} refreshing={false}>
      <Loaded state={state}>{({ metrics: m }) => (
        <>
          <Kpis items={TILES.map(([en, ar, key]) => ({ label: t(en, ar), value: m[key] ?? 0 }))} />
          <Block title={t("Coverage", "التغطية")}>
            <Facts rows={[[t("3D-enabled products", "منتجات بنماذج ثلاثية الأبعاد"), `${m.products ? Math.round(((m.products3d ?? 0) / m.products) * 100) : 0}%`],
              [t("Fitment specified", "توافق محدد"), t(`${m.fitmentCovered ?? 0} of ${m.products ?? 0}`, `${m.fitmentCovered ?? 0} من ${m.products ?? 0}`)]]} />
          </Block>
        </>
      )}</Loaded>
    </Page>
  );
}
