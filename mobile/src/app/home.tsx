import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { RoleGate } from "../components/layout/RoleGate";
import { useL } from "../core/hooks/useL";
import { useLoad } from "../core/hooks/useLoad";
import { Text } from "../components/ui/Text";
import { useTheme } from "../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import { REFRESH_MS, mechanicInbox } from "../features/mechanics/mechanicsService";
import { SessionUser, useSessionUser } from "../features/shared/session";

/** The mechanic's entry to the service-request inbox, with the number of requests still waiting for an answer. */
function ServiceRequestsEntry() {
  const { c: col } = useTheme();
  const { t, row, align, isArabic } = useL();
  const inbox = useLoad(() => mechanicInbox.list(), [], REFRESH_MS);
  const waiting = inbox.data?.filter((r) => r.status === "REQUESTED").length ?? 0;
  return (
    <Card label={t("Service requests", "طلبات الخدمة")} onPress={() => router.push("/mechanic/requests")}>
      <View style={[row, { alignItems: "center", gap: 14 }]}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: col.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="construct-outline" size={26} color={col.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[{ color: col.text, fontSize: 17, fontWeight: "800" }, align]}>{t("Service requests", "طلبات الخدمة")}</Text>
          <Text numberOfLines={2} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3, lineHeight: 18 }, align]}>
            {inbox.error && !inbox.data
              ? t("Could not load requests. Tap to open.", "تعذّر تحميل الطلبات. اضغط للفتح.")
              : t("Requests from customers: accept, start and complete jobs.", "طلبات من العملاء: اقبل الأعمال وابدأها وأنهِها.")}
          </Text>
        </View>
        {waiting > 0 ? <Badge tone="warning" icon="notifications-outline" label={`${waiting} ${t("new", "جديد")}`} /> : null}
        <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
      </View>
    </Card>
  );
}

// Temporary home for CUSTOMER and MECHANIC accounts until their real home screens exist.
function Home() {
  const { c: col } = useTheme();
  const user = useSessionUser();
  const { t, align } = useL();

  return (
    <DashboardLayout tag="MOTEXA / M1" kind="wrench" brand="MOTEXA" title={`${t("Welcome", "مرحبًا")}, ${user.fullName}`} signOutButton>
      {user.role === "MECHANIC" ? <ServiceRequestsEntry /> : null}
      <Card>
        <Text style={[{ color: col.text, fontSize: 18, fontWeight: "800" }, align]}>{t("Coming soon", "قريبًا")}</Text>
        <Text style={[{ color: col.textMuted, fontSize: 13, marginTop: 6, lineHeight: 20 }, align]}>
          {t("Your home screen is on its way.", "شاشتك الرئيسية قيد الإعداد.")}
        </Text>
      </Card>
    </DashboardLayout>
  );
}

export default function HomeScreen() {
  return (
    <RoleGate allow={(u: SessionUser) => u.role === "CUSTOMER" || u.role === "MECHANIC"}>
      <Home />
    </RoleGate>
  );
}
