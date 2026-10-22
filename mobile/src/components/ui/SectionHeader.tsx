import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../../theme/useTheme";
import { useL } from "../../core/hooks/useL";

/** A small uppercase section title, with an optional "See all" link on the other side. */
export function SectionHeader({ title, onSeeAll, extra }: { title: string; onSeeAll?: () => void; extra?: string }) {
  const { c, row, align, isArabic } = useTheme();
  const { t } = useL();
  return (
    <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 32, marginBottom: 14, gap: 10 }]}>
      <Text numberOfLines={2} style={[{ color: c.text, fontSize: 18, fontWeight: "700", flex: 1 }, align]}>
        {title}
      </Text>
      {onSeeAll ? (
        <Pressable accessibilityRole="button" onPress={onSeeAll} hitSlop={10} style={[row, { alignItems: "center", gap: 2 }]}>
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700" }}>{extra ?? t("See all", "عرض الكل")}</Text>
          <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={14} color={c.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}
