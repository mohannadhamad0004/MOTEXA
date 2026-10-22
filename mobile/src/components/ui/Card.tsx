import { ReactNode } from "react";
import { Pressable, StyleProp, View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/useTheme";

export function Card({
  children,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, r, shadow, motion } = useTheme();
  const base: ViewStyle = {
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: 16,
    marginBottom: 11,
    ...shadow,
  };
  if (onPress)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? motion.press : 1 }] }, style]}
      >
        {children}
      </Pressable>
    );
  return <View style={[base, style]}>{children}</View>;
}
