import { View } from "react-native";
import { Card } from "./Card";
import { Text } from "./Text";
import { useTheme } from "../../theme/useTheme";

/** One line per step that happened, with its time. The last step is highlighted. */
export function StatusTimeline({ items }: { items: { key: string; label: string; at: string }[] }) {
  const { c, row, align } = useTheme();
  return (
    <Card>
      {items.map((it, i) => (
        <View
          key={it.key}
          style={[row, { alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }]}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i === items.length - 1 ? c.accent : c.textDim }} />
          <Text style={[{ color: c.text, fontSize: 13, fontWeight: "700", flex: 1 }, align]}>{it.label}</Text>
          <Text style={{ color: c.textDim, fontSize: 11 }}>{it.at}</Text>
        </View>
      ))}
    </Card>
  );
}
