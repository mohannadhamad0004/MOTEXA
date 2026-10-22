import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../../theme/useTheme";

/** A small pill for sort and filter choices. */
export function Chip({
  label,
  on,
  onPress,
  icon,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { c, r, row } = useTheme();
  const fg = on ? c.onAccentFill : c.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [
        row,
        {
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 12,
          paddingVertical: 8,
          minHeight: 44,
          borderRadius: r.pill,
          borderWidth: 1,
          borderColor: on ? c.accentFill : c.border,
          backgroundColor: on ? c.accentFill : c.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/** Wrapping row of chips, mirrored in Arabic. */
export function ChipRow({ children }: { children: ReactNode }) {
  const { row } = useTheme();
  return <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>{children}</View>;
}

/** Segmented control (two to four options). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const { c, r, row } = useTheme();
  return (
    <View
      style={[
        row,
        {
          minHeight: 52,
          borderRadius: r.pill,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          padding: 4,
          gap: 4,
          marginBottom: 20,
        },
      ]}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: r.pill,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 4,
              backgroundColor: on ? c.accentFill : "transparent",
            }}
          >
            <Text numberOfLines={1} style={{ color: on ? c.onAccentFill : c.textMuted, fontSize: 12, fontWeight: "700" }}>
              {o.label}
              {o.count !== undefined ? ` ${o.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
