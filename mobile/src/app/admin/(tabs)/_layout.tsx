// Super admin tabs: the same floating Garage tab bar as every provider / admin role (Home, Providers, Requests, More).
// UX gate only (every /admin-management endpoint checks the role on the server): an ACTIVE SUPER_ADMIN / ADMIN session, else sign in.
import { Tabs, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GarageTabBar, type GarageTabItem } from "../../../components/garage/TabBar";
import { apiUrl, clearSession, getAccessToken } from "../../../core/config/api";
import { useLanguage } from "../../../i18n/LanguageContext";
import { useGarageTheme } from "../../../theme/garage";

type AuthStatus = "checking" | "authorized" | "unauthorized";

export default function AdminTabs() {
  const { isArabic: ar } = useLanguage();
  const { g } = useGarageTheme();
  const [auth, setAuth] = useState<AuthStatus>("checking");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getAccessToken();
        const meUrl = apiUrl("/auth/me");
        if (!token || !meUrl) { if (mounted) setAuth("unauthorized"); return; }
        const response = await fetch(meUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) await clearSession();
          if (mounted) setAuth("unauthorized");
          return;
        }
        const data = await response.json();
        const ok = data.success === true && data.user?.status === "ACTIVE" && (data.user?.role === "SUPER_ADMIN" || data.user?.role === "ADMIN");
        if (mounted) setAuth(ok ? "authorized" : "unauthorized");
      } catch {
        if (mounted) setAuth("unauthorized");
      }
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => { if (auth === "unauthorized") router.replace("/auth/login"); }, [auth]);
  if (auth !== "authorized") {
    return <View style={{ flex: 1, backgroundColor: g.page, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={g.accent} /></View>;
  }
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const items: GarageTabItem[] = [
    { name: "index", label: t("Home", "الرئيسية"), icon: "home-outline", iconOn: "home" },
    { name: "providers", label: t("Providers", "المزودون"), icon: "people-outline", iconOn: "people" },
    { name: "requests", label: t("Requests", "الطلبات"), icon: "clipboard-outline", iconOn: "clipboard" },
    { name: "more", label: t("More", "المزيد"), icon: "menu-outline", iconOn: "menu" },
  ];
  return (
    <Tabs initialRouteName="index" screenOptions={{ headerShown: false }} tabBar={(p) => <GarageTabBar state={p.state} navigation={p.navigation as never} items={items} />}>
      {items.map((it) => <Tabs.Screen key={it.name} name={it.name} options={{ title: it.label }} />)}
    </Tabs>
  );
}
