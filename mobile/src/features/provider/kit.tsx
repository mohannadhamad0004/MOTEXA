// Controls of the provider screens in the admin look (bronze actions, one card style, tinted notes).
// Named Provider* so they never collide with Diala's Mechanic* kit, which renders flat gray surfaces here.
// Her files stay untouched; her MechanicPage and MechanicField are still used as they are.
import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { View } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { DButton, Panel, useDT } from "../department/ui";

export function ProviderButton({ label, onPress, secondary, disabled, busy }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean }) {
  return <DButton label={busy ? `${label}…` : label} variant={secondary ? "ghost" : "primary"} disabled={disabled || busy} onPress={onPress} />;
}

export function ProviderCard({ children }: { children: ReactNode }) {
  return <Panel>{children}</Panel>;
}

/** Tinted note: red for errors, bronze for information. */
export function ProviderNote({ children, error }: { children: ReactNode; error?: boolean }) {
  const d = useDT();
  const c = d.chip(error ? "bad" : "bronze");
  return (
    <View accessibilityLiveRegion={error ? "assertive" : "polite"} style={{ flexDirection: d.row, alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
      <Ionicons name={error ? "alert-circle" : "information-circle"} size={20} color={c.fg} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: c.fg, fontSize: 13, lineHeight: 21, fontWeight: "600", textAlign: d.align }}>{children}</Text>
    </View>
  );
}

/** Selectable chip: bronze when chosen. */
export function ProviderChoice({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const d = useDT();
  return (
    <InteractiveButton
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flexDirection: d.row, alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: selected ? d.fill : d.border, backgroundColor: selected ? d.fill : "transparent" }}
    >
      {icon || selected ? <Ionicons name={icon ?? "checkmark"} size={15} color={selected ? d.fillInk : d.muted} /> : null}
      <Text style={{ color: selected ? d.fillInk : d.ink, fontSize: 13, lineHeight: 20, fontWeight: "700" }}>{label}</Text>
    </InteractiveButton>
  );
}
