import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { SessionUser, useSessionUser } from "../../features/shared/session";
import { Card, Header, RoleGate, Screen, useL } from "../../features/shared/ui";
import { C } from "../../features/shared/palette";

// Landing screen for admins that hold more than one department permission.
// Lists ONLY the areas the account is allowed to open. Each area re-checks access itself.
const AREAS = [
  { permission: "MANAGE_MECHANICS", href: "/mechanics-admin", icon: "build-outline", en: "Mechanics", ar: "الميكانيكيون" },
  { permission: "MANAGE_TOWING", href: "/admin/tow", icon: "car-outline", en: "Tow Companies", ar: "شركات السحب" },
  { permission: "MANAGE_SPARE_PARTS", href: "/admin/shops", icon: "storefront-outline", en: "Parts Shops", ar: "متاجر قطع الغيار" },
] as const;

function Departments() {
  const user = useSessionUser();
  const { t, row, align } = useL();
  const held = new Set(user.adminPermissions.map((p) => p.permission));

  return (
    <Screen>
      <Header
        brand="MOTEXA ADMIN"
        title={t("Your departments", "أقسامك")}
        subtitle={t("Choose the area you want to manage", "اختر القسم الذي تريد إدارته")}
        signOutButton
      />
      {AREAS.filter((a) => held.has(a.permission)).map((a) => (
        <Card key={a.permission} label={t(a.en, a.ar)} onPress={() => router.push(a.href)}>
          <View style={[row, { alignItems: "center", gap: 12 }]}>
            <Ionicons name={a.icon} size={24} color={C.accent} />
            <Text style={[{ flex: 1, color: C.text, fontSize: 16, fontWeight: "800" }, align]}>{t(a.en, a.ar)}</Text>
            <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

export default function DepartmentsScreen() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "ADMIN"}>
      <Departments />
    </RoleGate>
  );
}
