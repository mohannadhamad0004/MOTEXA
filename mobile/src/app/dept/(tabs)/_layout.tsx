import { Tabs } from "expo-router";
import { GarageTabBar, type GarageTabItem } from "../../../components/garage/TabBar";
import { useLoad } from "../../../core/hooks/useLoad";
import { useDepartment } from "../../../features/department/DepartmentContext";
import { review } from "../../../features/provider/api";
import { useLanguage } from "../../../i18n/LanguageContext";

// The same floating garage tab bar as the provider roles; the same five tabs for every department:
// Home, Requests, Directory, Messages (unread badge, refreshed every 15 s), Profile.
export default function DeptTabs() {
  const { isArabic: ar } = useLanguage();
  const { active } = useDepartment();
  const unread = useLoad(async () => (active.provider ? (await review.counts(active.provider)).unreadMessages : 0), [active.key], 15000);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const directory: GarageTabItem =
    active.key === "MANAGE_TOWING"
      ? { name: "directory", label: t("Companies", "الشركات"), icon: "business-outline", iconOn: "business" }
      : active.key === "MANAGE_SPARE_PARTS"
        ? { name: "directory", label: t("Shops", "المتاجر"), icon: "storefront-outline", iconOn: "storefront" }
        : { name: "directory", label: t("Directory", "الدليل"), icon: "albums-outline", iconOn: "albums" };
  const items: GarageTabItem[] = [
    { name: "index", label: t("Home", "الرئيسية"), icon: "home-outline", iconOn: "home" },
    { name: "requests", label: t("Requests", "الطلبات"), icon: "clipboard-outline", iconOn: "clipboard" },
    directory,
    { name: "messages", label: t("Messages", "الرسائل"), icon: "chatbubbles-outline", iconOn: "chatbubbles", badge: unread.data ?? 0 },
    { name: "profile", label: t("Profile", "الملف"), icon: "person-outline", iconOn: "person" },
  ];
  return (
    <Tabs initialRouteName="index" screenOptions={{ headerShown: false }} tabBar={(p) => <GarageTabBar state={p.state} navigation={p.navigation as never} items={items} />}>
      {items.map((it) => (
        <Tabs.Screen key={it.name} name={it.name} options={{ title: it.label }} />
      ))}
    </Tabs>
  );
}
