import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { C } from "../../../features/shared/palette";
import { Badge, Card, Header, useL } from "../../../features/shared/ui";

// Mechanic public profiles are a later step: nothing here is real data.
export default function CustomerMechanics() {
  const { t, align } = useL();
  return (
    <CustomerScreen tabs>
      <Header brand="MOTEXA" title={t("Mechanics", "الميكانيكيون")} subtitle={t("Find a trusted mechanic", "اعثر على ميكانيكي موثوق")} />
      <Card>
        <View style={{ alignItems: "center", paddingVertical: 18, gap: 10 }}>
          <Ionicons name="build-outline" size={38} color={C.accent} />
          <Badge tone="neutral" icon="time-outline" label={t("Coming soon", "قريبًا")} />
          <Text style={[{ color: C.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center" }, align]}>
            {t(
              "Verified mechanic profiles are on their way. You will be able to browse them here.",
              "ملفات الميكانيكيين الموثّقين قادمة قريبًا. ستتمكن من تصفحها هنا."
            )}
          </Text>
        </View>
      </Card>
    </CustomerScreen>
  );
}
