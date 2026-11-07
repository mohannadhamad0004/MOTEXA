import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useDT } from "../../features/department/ui";

const SIZE = 44;

function RoundButton({ icon, label, onPress, flip }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; flip?: boolean }) {
  const d = useDT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: d.border, backgroundColor: d.surface, opacity: pressed ? 0.8 : 1 })}
    >
      <Ionicons name={icon} size={22} color={d.ink} style={flip && d.ar ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}

/**
 * The ONE header row of every provider page (tow company and parts shop): a round back button (chevron mirrored in Arabic) when the
 * page has somewhere to go back to, and a round settings gear. 44 px targets, EN/AR accessibility labels.
 */
export function ProviderHeader({ onBack, onSettings }: { onBack?: () => void; onSettings: () => void }) {
  const d = useDT();
  return (
    <View style={{ flexDirection: d.row, alignItems: "center", justifyContent: "space-between", minHeight: SIZE, marginTop: 4 }}>
      {onBack ? <RoundButton icon="chevron-back" flip label={d.t("Back", "رجوع")} onPress={onBack} /> : <View style={{ width: SIZE }} />}
      <RoundButton icon="settings-outline" label={d.t("Settings", "الإعدادات")} onPress={onSettings} />
    </View>
  );
}
