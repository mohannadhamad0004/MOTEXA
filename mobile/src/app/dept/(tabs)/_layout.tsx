import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useLanguage } from "../../../i18n/LanguageContext";
import { DeptTabBar } from "../../../features/department/ui";

// Same floating oval tab bar as the super admin: Home, Requests, Directory, Profile.
export default function DeptTabs() {
  const { isArabic: ar } = useLanguage();
  const tab = (name: string, en: string, arLabel: string, icon: keyof typeof Ionicons.glyphMap, iconOn: keyof typeof Ionicons.glyphMap) => (
    <Tabs.Screen
      name={name}
      options={{ title: ar ? arLabel : en, tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? iconOn : icon} size={22} color={color} /> }}
    />
  );
  return (
    <Tabs tabBar={(p) => <DeptTabBar {...p} />} screenOptions={{ headerShown: false }}>
      {tab("index", "Home", "الرئيسية", "home-outline", "home")}
      {tab("requests", "Requests", "الطلبات", "clipboard-outline", "clipboard")}
      {tab("directory", "Directory", "الدليل", "albums-outline", "albums")}
      {tab("profile", "Profile", "الملف", "person-outline", "person")}
    </Tabs>
  );
}
