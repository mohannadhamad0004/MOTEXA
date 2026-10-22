import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleProp, ViewStyle } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../../theme/useTheme";

type IconName = keyof typeof Ionicons.glyphMap;
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const HEIGHT: Record<ButtonSize, number> = { sm: 38, md: 48, lg: 56 };

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, r, row, motion } = useTheme();
  const v = {
    primary: { bg: c.accentFill, fg: c.onAccentFill, border: c.accentFill },
    secondary: { bg: c.surfaceRaised, fg: c.text, border: c.border },
    ghost: { bg: c.accentSoft, fg: c.accent, border: c.accentBorder },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerBorder },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      hitSlop={size === "sm" ? { top: 3, bottom: 3 } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        row,
        {
          minHeight: HEIGHT[size],
          borderRadius: r.pill,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: size === "sm" ? 16 : 22,
          gap: 8,
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: off && !loading ? 0.4 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !off ? motion.press : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={v.fg} />
      ) : null}
      <Text numberOfLines={2} style={{ color: v.fg, fontSize: size === "sm" ? 13 : 14, fontWeight: "700", flexShrink: 1, textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}
