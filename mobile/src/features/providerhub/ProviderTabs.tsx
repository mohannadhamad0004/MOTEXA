import { Tabs } from "expo-router";
import { GarageTabBar, type GarageTabItem } from "../../components/garage/TabBar";
import { useL } from "../../core/hooks/useL";
import type { ProviderArea } from "../provider/portal/types";
import { HUB } from "./hub";

/** The tab shell of both provider roles: the customer's Garage tab bar, items from hub.ts. */
export function ProviderTabs({ area }: { area: ProviderArea }) {
  const { t } = useL();
  const items: GarageTabItem[] = HUB[area].tabs.map((x) => ({ name: x.name, label: t(x.en, x.ar), icon: x.icon, iconOn: x.iconOn }));
  return (
    <Tabs initialRouteName="index" screenOptions={{ headerShown: false }} tabBar={(p) => <GarageTabBar state={p.state} navigation={p.navigation as never} items={items} />}>
      {items.map((it) => (
        <Tabs.Screen key={it.name} name={it.name} options={{ title: it.label }} />
      ))}
    </Tabs>
  );
}
