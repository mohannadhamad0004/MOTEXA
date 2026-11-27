import { Tabs } from "expo-router";
import { GarageTabBar, type GarageTabItem } from "../../../components/garage/TabBar";
import { useL } from "../../../core/hooks/useL";

/** The garage owner's tab shell (the same Garage tab bar as the other provider roles). */
export default function GarageTabs() {
  const { t } = useL();
  const items: GarageTabItem[] = [
    { name: "index", label: t("Home", "الرئيسية"), icon: "home-outline", iconOn: "home" },
    { name: "requests", label: t("Requests", "الطلبات"), icon: "clipboard-outline", iconOn: "clipboard" },
    { name: "mechanics", label: t("Mechanics", "الميكانيكيون"), icon: "people-outline", iconOn: "people" },
    { name: "messages", label: t("Messages", "الرسائل"), icon: "chatbubbles-outline", iconOn: "chatbubbles" },
    { name: "profile", label: t("Profile", "الملف"), icon: "person-outline", iconOn: "person" },
  ];
  return (
    <Tabs initialRouteName="index" screenOptions={{ headerShown: false }} tabBar={(p) => <GarageTabBar state={p.state} navigation={p.navigation as never} items={items} />}>
      {items.map((it) => <Tabs.Screen key={it.name} name={it.name} options={{ title: it.label }} />)}
    </Tabs>
  );
}
