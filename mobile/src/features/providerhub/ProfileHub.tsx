import { router, type Href } from "expo-router";
import { AppearanceSection } from "./AppearanceSection";
import { View } from "react-native";
import { ErrorState, GText, Section } from "../../components/garage";
import { ManageEntry } from "../../components/manage/ManagePage";
import { LogOut, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useSessionUser } from "../../core/session/session";
import { gType, useGarageTheme } from "../../theme/garage";
import { portalApi } from "../provider/portal/api";
import type { ProviderArea } from "../provider/portal/types";
import { MiniMap } from "../shared/MiniMap";
import { MAPS_AVAILABLE } from "../shared/maps";
import { asActor } from "../shared/session";
import { towFleetService } from "../tow/towService";
import type { GIconName } from "../../components/garage/text";

type Row = { icon: GIconName; en: string; ar: string; path: string };
const go = (p: string) => router.push(p as Href);

const GROUPS: Record<ProviderArea, { en: string; ar: string; rows: Row[] }[]> = {
  tow: [
    { en: "Business", ar: "النشاط", rows: [
      { icon: "business-outline", en: "Business info", ar: "معلومات النشاط", path: "/provider/tow/company" },
      { icon: "images-outline", en: "Photos and videos", ar: "الصور والفيديو", path: "/provider/tow/media" },
      { icon: "eye-outline", en: "Preview as a customer", ar: "معاينة كزبون", path: "/provider/tow/preview" },
    ] },
    { en: "Work", ar: "العمل", rows: [
      { icon: "stats-chart-outline", en: "Statistics", ar: "الإحصائيات", path: "/provider/tow/stats" },
      { icon: "time-outline", en: "History", ar: "السجل", path: "/provider/tow/history" },
      { icon: "map-outline", en: "Live map", ar: "الخريطة المباشرة", path: "/provider/tow/live" },
      { icon: "navigate-outline", en: "Active jobs", ar: "المهام الجارية", path: "/provider/tow/active" },
      { icon: "toggle-outline", en: "Availability", ar: "التوفر", path: "/provider/tow/availability" },
    ] },
  ],
  parts: [
    { en: "Business", ar: "النشاط", rows: [
      { icon: "storefront-outline", en: "Shop info", ar: "معلومات المتجر", path: "/provider/parts/business" },
      { icon: "images-outline", en: "Photos and videos", ar: "الصور والفيديو", path: "/provider/parts/media" },
      { icon: "eye-outline", en: "Preview as a customer", ar: "معاينة كزبون", path: "/provider/parts/preview" },
    ] },
    { en: "Catalog tools", ar: "أدوات الكتالوج", rows: [
      { icon: "file-tray-stacked-outline", en: "Inventory", ar: "المخزون", path: "/provider/parts/inventory" },
      { icon: "grid-outline", en: "Categories", ar: "الفئات", path: "/provider/parts/categories" },
      { icon: "git-compare-outline", en: "Fitment", ar: "التوافق", path: "/provider/parts/fitment" },
      { icon: "cube-outline", en: "3D parts", ar: "قطع ثلاثية الأبعاد", path: "/provider/parts/3d" },
      { icon: "layers-outline", en: "3D submissions", ar: "طلبات ثلاثية الأبعاد", path: "/provider/parts/3d/submissions" },
      { icon: "help-circle-outline", en: "Customer questions", ar: "استفسارات الزبائن", path: "/provider/parts/inquiries" },
      { icon: "stats-chart-outline", en: "Performance", ar: "الأداء", path: "/provider/parts/analytics" },
      { icon: "bicycle-outline", en: "Delivery", ar: "التوصيل", path: "/provider/parts/delivery" },
    ] },
  ],
};

/**
 * Profile of both provider roles = entry rows (docs/guide/10-ui-system.md): business, work / catalog tools, location (small map),
 * documents, appearance & language, more settings, Log out (asks first). Every screen that is not a tab is one row here.
 */
export function ProfileHub({ area }: { area: ProviderArea }) {
  const { t } = useL();
  const user = useSessionUser();
  const { align } = useGarageTheme();
  const where = useLoad(async () => {
    if (area === "tow") {
      const { company } = await towFleetService.getMyFleet(asActor(user));
      return { name: company.name, city: company.city, address: company.address, lat: company.baseLat, lng: company.baseLng };
    }
    const s = await portalApi.profile();
    return { name: s.name, city: s.city, address: s.address, lat: s.baseLat, lng: s.baseLng };
  }, [user.id, area]);
  const w = where.data;
  const pin = w && w.lat !== null && w.lng !== null ? { id: "me", name: w.name, lat: w.lat, lng: w.lng, kind: (area === "tow" ? "tow" : "hq") as "tow" | "hq", dim: false } : null;
  const loc = area === "tow" ? "/provider/tow/service-area" : "/provider/parts/business";
  return (
    <Page title={w?.name ?? t("Profile", "الملف")} line={w?.city} back={false} tabBar onRefresh={() => void where.reload()} refreshing={false}>
      {where.error && !w ? <ErrorState text={where.error} onRetry={where.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {GROUPS[area].map((gr) => (
        <Section key={gr.en} title={t(gr.en, gr.ar)}>
          <View style={{ gap: 8 }}>{gr.rows.map((r) => <ManageEntry key={r.path} icon={r.icon} title={t(r.en, r.ar)} onPress={() => go(r.path)} />)}</View>
        </Section>
      ))}
      <Section title={t("Location", "الموقع")}>
        <View style={{ gap: 8 }}>
          {pin && MAPS_AVAILABLE ? (
            <View style={{ borderRadius: 16, overflow: "hidden" }}>
              <MiniMap pins={[pin]} me={null} height={150} fitKey={`${pin.lat},${pin.lng}`} onOpen={() => go(loc)} label={t("Open location settings", "فتح إعدادات الموقع")} />
            </View>
          ) : null}
          {w ? <GText soft style={[gType.caption, align]}>{pin ? [w.address, w.city].filter(Boolean).join(" · ") : t("No map point yet. Set your location so customers can find you.", "لا توجد نقطة على الخريطة بعد. حدّد موقعك ليجدك الزبائن.")}</GText> : null}
          <ManageEntry icon="locate-outline" title={area === "tow" ? t("Service area and map point", "منطقة الخدمة ونقطة الخريطة") : t("Address and map point", "العنوان ونقطة الخريطة")} onPress={() => go(loc)} />
        </View>
      </Section>
      <Section title={t("Documents", "المستندات")}>
        <ManageEntry icon="document-text-outline" title={t("Application and documents", "الطلب والمستندات")} sub={t("Private: only you and MOTEXA see them.", "خاصة: لا يراها إلا أنت وموتكسا.")} onPress={() => go("/provider/onboarding")} />
      </Section>
      <AppearanceSection />
      <ManageEntry icon="settings-outline" title={t("More settings", "المزيد من الإعدادات")} onPress={() => go(`/provider/${area}/settings`)} />
      <LogOut />
    </Page>
  );
}
