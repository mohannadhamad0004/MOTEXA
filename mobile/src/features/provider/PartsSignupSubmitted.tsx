// After a successful submission: the shop is PENDING with the Parts Admin. The draft was cleared, so this screen stands alone.
// It reuses an existing Mo still; no new artwork.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, View } from "react-native";
import { MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { useDT } from "../department/ui";
import { ProviderButton, ProviderCard } from "./kit";

export default function PartsSignupSubmitted() {
  const m = useMechanicTheme();
  const dt = useDT();
  const points: [string, string][] = [
    ["Your shop cannot publish products yet.", "لا يمكن لمتجرك نشر المنتجات بعد."],
    ["Approval is manual. Sign in any time to see whether your application is approved or rejected.", "الاعتماد يدوي. سجّل الدخول في أي وقت لمعرفة ما إذا تم اعتماد طلبك أو رفضه."],
    ["If MOTEXA asks for changes or rejects the application, the reason will be shown to you.", "إذا طلبت MOTEXA تعديلات أو رفضت الطلب فسيظهر لك السبب."],
  ];
  return (
    <MechanicPage title={m.t("Application submitted", "تم إرسال الطلب")}>
      <View style={{ gap: 14 }}>
        <ProviderCard>
          <View style={{ gap: 12 }}>
            <View style={{ height: 120, borderRadius: 18, overflow: "hidden", backgroundColor: dt.border }}>
              <Image source={require("../../../assets/mo/admin/parts/mo-parts-admin-last.jpg")} accessibilityLabel={m.t("Mo", "مو")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            </View>
            <Text style={{ color: dt.ink, fontSize: 16, lineHeight: m.ar ? 28 : 24, fontWeight: "700", textAlign: m.align }}>{m.t("Your parts shop is waiting for review by the MOTEXA Parts Admin.", "متجر قطع الغيار الخاص بك بانتظار المراجعة من مشرف قطع الغيار في MOTEXA.")}</Text>
            {points.map(([en, ar]) => (
              <View key={en} style={{ flexDirection: m.row, gap: 10, alignItems: "flex-start" }}>
                <Ionicons name="ellipse" size={7} color={dt.accent} style={{ marginTop: 8 }} />
                <Text style={{ flex: 1, color: dt.muted, fontSize: 13, lineHeight: 21, textAlign: m.align }}>{m.t(en, ar)}</Text>
              </View>
            ))}
          </View>
        </ProviderCard>
        <ProviderButton label={m.t("Sign in", "تسجيل الدخول")} onPress={() => router.replace({ pathname: "/auth/login", params: { selectedRole: "parts" } })} />
      </View>
    </MechanicPage>
  );
}
