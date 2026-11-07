import { router, type Href } from "expo-router";
import { View } from "react-native";
import { Card, GButton, GIcon, GText, StatusChip } from "../../../components/garage";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { useL } from "../../../core/hooks/useL";
import { gType, useGarageTheme } from "../../../theme/garage";

/** The Orders tab: a calm "Coming soon" card. The current orders list stays one tap away so nothing is lost. */
export default function OrdersSoon() {
  const { t } = useL();
  const { g } = useGarageTheme();
  return (
    <ProviderLayout area="parts" title={t("Orders", "الطلبات")}>
      <Card style={{ alignItems: "center", gap: 12, paddingVertical: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
          <GIcon name="receipt-outline" size={34} />
        </View>
        <StatusChip tone="accent" label={t("Coming soon", "قريبًا")} />
        <GText style={[gType.title, { textAlign: "center" }]}>{t("A better orders screen is on its way", "شاشة طلبات أفضل قادمة")}</GText>
        <GText soft style={[gType.body, { textAlign: "center" }]}>{t("Until then, your current orders are still here.", "إلى حين ذلك، طلباتك الحالية ما زالت متاحة.")}</GText>
      </Card>
      <View style={{ marginTop: 12 }}>
        <GButton variant="secondary" icon="list-outline" label={t("Open current orders", "فتح الطلبات الحالية")} onPress={() => router.push("/provider/parts/orders/list" as Href)} />
      </View>
    </ProviderLayout>
  );
}
