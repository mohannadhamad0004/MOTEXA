import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Mono, Panel, Tag } from "../../components/blueprint";
import { Text } from "../../components/ui/Text";
import { useL } from "../../core/hooks/useL";
import { M } from "../../motion";
import { useTheme } from "../../theme/useTheme";

/** Compact safety card for a waiting customer: two tips, then "More safety tips". Lives on the active request, not on Discovery. */
export function WhileYouWait() {
  const { c, row, align } = useTheme();
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
    <Animated.View layout={LinearTransition.duration(M.detail)} style={{ marginTop: 24 }}>
      <Panel>
        <Tag color={c.soft} align={align.textAlign}>{t("While you wait", "أثناء الانتظار")}</Tag>
        <View style={{ marginTop: 8 }}>
          {shown.map((tip, i) => (
            <Animated.View key={i} entering={i >= 2 ? FadeIn.duration(M.chip) : undefined} style={[row, { alignItems: "flex-start", gap: 12, paddingVertical: 6 }]}>
              <Mono color={c.bronze}>{String(i + 1).padStart(2, "0")}</Mono>
              <Text style={[{ color: c.ink, fontSize: 14, lineHeight: 21, flex: 1 }, align]}>{tip}</Text>
            </Animated.View>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setMore(!more)} hitSlop={8} style={{ minHeight: 40, justifyContent: "center" }}>
          <Text style={[{ color: c.bronze, fontSize: 13, fontWeight: "700" }, align]}>{more ? t("Fewer tips", "نصائح أقل") : t("More safety tips", "المزيد من نصائح السلامة")}</Text>
        </Pressable>
      </Panel>
    </Animated.View>
  );
}
