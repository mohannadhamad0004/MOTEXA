import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useLoad } from "../../../core/hooks/useLoad";
import { useDepartment } from "../../../features/department/DepartmentContext";
import { DeptTabBar } from "../../../features/department/ui";
import { review } from "../../../features/provider/api";
import { useLanguage } from "../../../i18n/LanguageContext";

// Same floating oval tab bar as the super admin; the same five tabs for every department:
// Home, Requests, Directory, Messages (unread badge, refreshed every 15 s), Profile.
export default function DeptTabs() {
  const { isArabic: ar } = useLanguage();
  const { active } = useDepartment();
  const unread = useLoad(async () => (active.provider ? (await review.counts(active.provider)).unreadMessages : 0), [active.key], 15000);
  const tab = (name: string, en: string, arLabel: string, icon: keyof typeof Ionicons.glyphMap, iconOn: keyof typeof Ionicons.glyphMap, badge?: number) => (
    <Tabs.Screen
      name={name}
      options={{ title: ar ? arLabel : en, tabBarBadge: badge || undefined, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? iconOn : icon} size={22} color={color} /> }}
    />
  );
  return (
    <Tabs tabBar={(p) => <DeptTabBar {...p} />} screenOptions={{ headerShown: false }}>
      {tab("index", "Home", "الرئيسية", "home-outline", "home")}
      {tab("requests", "Requests", "الطلبات", "clipboard-outline", "clipboard")}
      {active.key === "MANAGE_TOWING" ? tab("directory", "Companies", "الشركات", "business-outline", "business") : active.key === "MANAGE_SPARE_PARTS" ? tab("directory", "Shops", "المتاجر", "storefront-outline", "storefront") : tab("directory", "Directory", "الدليل", "albums-outline", "albums")}
      {tab("messages", "Messages", "الرسائل", "chatbubbles-outline", "chatbubbles", unread.data ?? 0)}
      {tab("profile", "Profile", "الملف", "person-outline", "person")}
    </Tabs>
  );
}
