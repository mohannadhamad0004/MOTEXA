import { Tabs } from "expo-router";
import { FloatingTabBar, TabItem } from "../../../components/blueprint";
import { useL } from "../../../core/hooks/useL";

export default function CustomerTabs() {
  const { t } = useL();
  // The order is mirrored in Arabic by the bar's row direction (RTL is per component in this app).
  const items: TabItem[] = [
    { name: "index", label: t("Home", "الرئيسية"), icon: "home" },
    { name: "parts", label: t("Parts", "القطع"), icon: "parts" },
    { name: "mechanics", label: t("Mechanics", "الميكانيكيون"), icon: "mech" },
    { name: "tow", label: t("Tow", "السحب"), icon: "tow" },
    { name: "profile", label: t("Profile", "حسابي"), icon: "user" },
  ];
  return (
    <Tabs initialRouteName="index" screenOptions={{ headerShown: false }} tabBar={(p) => <FloatingTabBar state={p.state} navigation={p.navigation as never} items={items} />}>
      {items.map((it) => (
        <Tabs.Screen key={it.name} name={it.name} options={{ title: it.label }} />
      ))}
    </Tabs>
  );
}
