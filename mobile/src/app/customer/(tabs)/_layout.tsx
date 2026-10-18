import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTabBarOptions } from "../../../components/layout/tabBarOptions";
import { useL } from "../../../core/hooks/useL";

type IconName = keyof typeof Ionicons.glyphMap;

export default function CustomerTabs() {
  const screenOptions = useTabBarOptions();
  const { t, isArabic } = useL();
  const tabs: { name: string; title: string; icon: IconName }[] = [
    { name: "index", title: t("Home", "الرئيسية"), icon: "home-outline" },
    { name: "parts", title: t("Parts", "القطع"), icon: "cube-outline" },
    { name: "mechanics", title: t("Mechanics", "الميكانيكيون"), icon: "build-outline" },
    { name: "tow", title: t("Tow", "السحب"), icon: "car-outline" },
    { name: "profile", title: t("Profile", "حسابي"), icon: "person-outline" },
  ];
  // The tab bar is not mirrored by the OS here (RTL is handled per component), so Arabic reverses the order.
  const ordered = isArabic ? [...tabs].reverse() : tabs;

  return (
    <Tabs initialRouteName="index" screenOptions={screenOptions}>
      {ordered.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
