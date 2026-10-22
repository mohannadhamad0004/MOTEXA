import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, TextStyle, View, ViewStyle } from "react-native";
import { Text } from "./Text";
import { formatPrice } from "../../core/constants/money";
import { useTheme } from "../../theme/useTheme";

type IconName = keyof typeof Ionicons.glyphMap;

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border, marginVertical: 10 }} />;
}

export function KV({ k, v }: { k: string; v?: string | number | null }) {
  const { c, row, isArabic } = useTheme();
  return (
    <View style={[row, { justifyContent: "space-between", paddingVertical: 8, gap: 12 }]}>
      <Text style={{ color: c.textDim, fontSize: 12, fontWeight: "700" }}>{k}</Text>
      <Text style={{ color: c.text, fontSize: 13, flex: 1, textAlign: isArabic ? "left" : "right" }}>
        {v === undefined || v === null || v === "" ? "—" : String(v)}
      </Text>
    </View>
  );
}

/** Square image, or an icon when there is none. */
export function ImageTile({ uri, icon, size = 56 }: { uri?: string | null; icon: IconName; size?: number }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        backgroundColor: c.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Ionicons name={icon} size={size * 0.45} color={c.accent} />
      )}
    </View>
  );
}

/** ₪ price. The currency symbol stays attached to the number in Arabic (see core/constants/money). */
export function Price({ value, style }: { value: number | string; style?: TextStyle }) {
  const { c } = useTheme();
  return <Text style={[{ color: c.accent, fontSize: 15, fontWeight: "700" }, style]}>{formatPrice(value)}</Text>;
}

/** Tappable row: leading icon or image, title and subtitle, chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { c, row, align, isArabic } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [row, { alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.8 : 1 }, style]}
    >
      {icon ? <ImageTile icon={icon} size={44} /> : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[{ color: c.text, fontSize: 14, fontWeight: "700" }, align]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[{ color: c.textMuted, fontSize: 12, marginTop: 2 }, align]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={c.textDim} /> : null}
    </Pressable>
  );
}
