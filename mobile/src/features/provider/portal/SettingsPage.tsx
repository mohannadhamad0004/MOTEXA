// More settings of both provider roles = entry rows: appearance & language, the business profile, delivery (shop) or the owner's own
// driver screen (tow, only when the owner is also one of the company's drivers).
import { router, type Href } from "expo-router";
import { View } from "react-native";
import { ManageEntry } from "../../../components/manage/ManagePage";
import { Page } from "../../../components/manage/Page";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { AppearanceSection } from "../../providerhub/AppearanceSection";
import { api } from "../../shared/api";
import type { ProviderArea } from "./types";

const go = (p: string) => router.push(p as Href);

export default function SettingsPage({ area }: { area: ProviderArea }) {
  const { t } = useL();
  const isDriver = useLoad(() => (area === "tow" ? api<{ drivers: { isOwner: boolean }[] }>("GET", "/tow/me/drivers").then((r) => r.drivers.some((x) => x.isOwner), () => false) : Promise.resolve(false)), [area]);
  return (
    <Page title={t("Settings", "الإعدادات")}>
      <AppearanceSection />
      <View style={{ gap: 8 }}>
        <ManageEntry icon="business-outline" title={t("Business profile", "ملف النشاط")} onPress={() => go(area === "tow" ? "/provider/tow/company" : "/provider/parts/business")} />
        {area === "parts" ? <ManageEntry icon="bicycle-outline" title={t("Delivery settings", "إعدادات التوصيل")} onPress={() => go("/provider/parts/delivery")} /> : null}
        {area === "tow" && isDriver.data ? <ManageEntry icon="person-circle-outline" title={t("My driver profile and jobs", "ملفي ومهامي كسائق")} onPress={() => go("/driver")} /> : null}
      </View>
    </Page>
  );
}
