
import { Card } from "../components/ui/Card";
import { Header } from "../components/layout/DashboardLayout";
import { RoleGate } from "../components/layout/RoleGate";
import { Screen } from "../components/layout/Screen";
import { useL } from "../core/hooks/useL";
import { Text } from "../components/ui/Text";
import { useTheme } from "../theme/useTheme";
import { SessionUser, useSessionUser } from "../features/shared/session";

// Temporary home for CUSTOMER and MECHANIC accounts until their real home screens exist.
function Home() {
  const { c: col } = useTheme();
  const user = useSessionUser();
  const { t, align } = useL();

  return (
    <Screen>
      <Header brand="MOTEXA" title={`${t("Welcome", "مرحبًا")}, ${user.fullName}`} signOutButton />
      <Card>
        <Text style={[{ color: col.text, fontSize: 18, fontWeight: "800" }, align]}>{t("Coming soon", "قريبًا")}</Text>
        <Text style={[{ color: col.textMuted, fontSize: 13, marginTop: 6, lineHeight: 20 }, align]}>
          {t("Your home screen is on its way.", "شاشتك الرئيسية قيد الإعداد.")}
        </Text>
      </Card>
    </Screen>
  );
}

export default function HomeScreen() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "CUSTOMER" || u.role === "MECHANIC"}>
      <Home />
    </RoleGate>
  );
}
