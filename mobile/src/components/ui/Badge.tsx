import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../../theme/useTheme";

type IconName = keyof typeof Ionicons.glyphMap;
export type Tone = "accent" | "success" | "danger" | "warning" | "neutral";

export function useTones() {
  const { c } = useTheme();
  return {
    accent: { fg: c.accent, bg: c.accentSoft, border: c.accentBorder },
    success: { fg: c.success, bg: c.successSoft, border: c.successBorder },
    danger: { fg: c.danger, bg: c.dangerSoft, border: c.dangerBorder },
    warning: { fg: c.warning, bg: c.warningSoft, border: c.warningBorder },
    neutral: { fg: c.textMuted, bg: c.neutralSoft, border: c.neutralBorder },
  } satisfies Record<Tone, { fg: string; bg: string; border: string }>;
}

export function Badge({ tone, label, icon, prefix }: { tone: Tone; label: string; icon?: IconName; prefix?: string }) {
  const k = useTones()[tone];
  const { c, row } = useTheme();
  return (
    <View
      style={[
        row,
        {
          alignItems: "center",
          paddingHorizontal: 6,
          paddingVertical: 5,
          borderRadius: 9,
          borderWidth: 1,
          alignSelf: "flex-start",
          backgroundColor: k.bg,
          borderColor: k.border,
        },
      ]}
      accessible
      accessibilityLabel={`${prefix ?? ""} ${label}`}
    >
      {icon ? <Ionicons name={icon} size={12} color={k.fg} style={{ marginHorizontal: 3 }} /> : null}
      {prefix ? <Text style={{ color: c.textDim, fontSize: 10, fontWeight: "700", marginHorizontal: 3 }}>{prefix}</Text> : null}
      <Text style={{ color: k.fg, fontSize: 10, fontWeight: "700", marginHorizontal: 3 }}>{label}</Text>
    </View>
  );
}
