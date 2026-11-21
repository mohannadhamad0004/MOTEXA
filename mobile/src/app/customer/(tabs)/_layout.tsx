import { Tabs } from "expo-router";
import { GarageTabBar, GarageTabItem } from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";

export default function CustomerTabs() {
  const { t } = useL();
  // The order is mirrored in Arabic by the bar's row direction (RTL is per component in this app).
  const items: GarageTabItem[] = [
    { name: "index", label: t("Home", "الرئيسية"), icon: "home-outline", iconOn: "home" },
    { name: "parts", label: t("Parts", "القطع"), icon: "cube-outline", iconOn: "cube" },
    { name: "mechanics", label: t("Mechanics", "الميكانيكيون"), icon: "construct-outline", iconOn: "construct" },
    { name: "tow", label: t("Tow", "السحب"), icon: "car-outline", iconOn: "car" },
    { name: "profile", label: t("Profile", "حسابي"), icon: "person-outline", iconOn: "person" },
  ];
  return (
    <Tabs initialRouteName="index" screenOptions={{ headerShown: false }} tabBar={(p) => <GarageTabBar state={p.state} navigation={p.navigation as never} items={items} />}>
      {items.map((it) => (
        <Tabs.Screen key={it.name} name={it.name} options={{ title: it.label }} />
      ))}
    </Tabs>
  );
}
