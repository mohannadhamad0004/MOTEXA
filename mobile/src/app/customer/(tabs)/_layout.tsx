import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useL } from "../../../features/shared/ui";

type IconName = keyof typeof Ionicons.glyphMap;

export default function CustomerTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useL();
  const tab = (name: string, title: string, icon: IconName) => (
    <Tabs.Screen
      name={name}
      options={{
        title,
        tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size} color={color} />,
      }}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#D99B69",
        tabBarInactiveTintColor: "#9C8A7E",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: "#1C120D",
          borderTopColor: "#4A3020",
          borderTopWidth: 1,
          height: 65 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          elevation: 0,
        },
      }}
    >
      {tab("index", t("Home", "الرئيسية"), "home-outline")}
      {tab("parts", t("Parts", "القطع"), "cube-outline")}
      {tab("tow", t("Tow", "السحب"), "car-outline")}
      {tab("mechanics", t("Mechanics", "الميكانيكيون"), "build-outline")}
      {tab("profile", t("Profile", "حسابي"), "person-outline")}
    </Tabs>
  );
}
