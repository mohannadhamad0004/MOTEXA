import { Text } from "react-native";
import { C } from "../features/shared/palette";
import { SessionUser, useSessionUser } from "../features/shared/session";
import { Card, Header, RoleGate, Screen, useL } from "../features/shared/ui";

// Temporary home for CUSTOMER and MECHANIC accounts until their real home screens exist.
function Home() {
  const user = useSessionUser();
  const { t, align } = useL();

  return (
    <Screen>
      <Header brand="MOTEXA" title={`${t("Welcome", "مرحبًا")}, ${user.fullName}`} signOutButton />
      <Card>
        <Text style={[{ color: C.text, fontSize: 18, fontWeight: "800" }, align]}>{t("Coming soon", "قريبًا")}</Text>
        <Text style={[{ color: C.textMuted, fontSize: 13, marginTop: 6, lineHeight: 20 }, align]}>
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
