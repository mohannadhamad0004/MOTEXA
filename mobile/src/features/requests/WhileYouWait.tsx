import { useState } from "react";
import { View } from "react-native";
import { Card, GIcon, GText, Tap } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";

/** Compact safety card for a waiting customer: two tips, then "More safety tips". */
export function WhileYouWait() {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const [more, setMore] = useState(false);
  const tips = [
    t("Turn on your hazard lights.", "شغّل أضواء التحذير."),
    t("Stay off the road: wait behind the barrier or well away from traffic.", "ابتعد عن الطريق: انتظر خلف الحاجز أو بعيدًا عن حركة السير."),
    t("Keep your phone charged, and keep it with you.", "أبقِ هاتفك مشحونًا واحتفظ به معك."),
    t("Keep your doors unlocked only when the driver arrives; stay inside the car if the road is busy.", "لا تفتح الأبواب إلا عند وصول السائق، وابقَ داخل السيارة إن كان الطريق مزدحمًا."),
  ];
  const shown = more ? tips : tips.slice(0, 2);
  return (
    <Card soft style={{ marginTop: 24 }}>
      <View style={[row, { alignItems: "center", gap: 8 }]}>
        <GIcon name="shield-checkmark-outline" size={18} />
        <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("While you wait", "أثناء الانتظار")}</GText>
      </View>
      <View style={{ marginTop: 8 }}>
        {shown.map((tip, i) => (
          <View key={i} style={[row, { alignItems: "flex-start", gap: 10, paddingVertical: 6 }]}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
              <GText style={{ fontSize: 11, lineHeight: 14, fontWeight: "800", color: g.accentText }}>{String(i + 1)}</GText>
            </View>
            <GText style={[gType.bodySm, { flex: 1 }, align]}>{tip}</GText>
          </View>
        ))}
      </View>
      <Tap label={more ? t("Fewer tips", "نصائح أقل") : t("More safety tips", "المزيد من نصائح السلامة")} onPress={() => setMore(!more)} style={{ minHeight: 44, justifyContent: "center" }}>
        <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }, align]}>{more ? t("Fewer tips", "نصائح أقل") : t("More safety tips", "المزيد من نصائح السلامة")}</GText>
      </Tap>
    </Card>
  );
}
