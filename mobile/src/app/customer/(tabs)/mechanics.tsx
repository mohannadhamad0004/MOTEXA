import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { useL } from "../../../core/hooks/useL";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

// Mechanic public profiles are a later step: nothing here is real data.
export default function CustomerMechanics() {
  const { c: col } = useTheme();
  const { t, align } = useL();
  return (
    <Screen tabs>
      <Header brand="MOTEXA" title={t("Mechanics", "الميكانيكيون")} subtitle={t("Find a trusted mechanic", "اعثر على ميكانيكي موثوق")} />
      <Card>
        <View style={{ alignItems: "center", paddingVertical: 18, gap: 10 }}>
          <Ionicons name="build-outline" size={38} color={col.accent} />
          <Badge tone="neutral" icon="time-outline" label={t("Coming soon", "قريبًا")} />
          <Text style={[{ color: col.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center" }, align]}>
            {t(
              "Verified mechanic profiles are on their way. You will be able to browse them here.",
              "ملفات الميكانيكيين الموثّقين قادمة قريبًا. ستتمكن من تصفحها هنا."
            )}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
