// Controls of the provider application wizard on the Garage kit (one card style, one button, tinted notes, choice chips).
import type { ReactNode } from "react";
import { View } from "react-native";
import { Chip, GButton, Note, type GIconName } from "../../components/garage";
import { gShape, useGarageTheme } from "../../theme/garage";

export function ProviderButton({ label, onPress, secondary, disabled, busy }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean }) {
  return <GButton label={label} variant={secondary ? "ghost" : "primary"} busy={busy} disabled={disabled || busy} onPress={onPress} />;
}

export function ProviderCard({ children }: { children: ReactNode }) {
  const { g } = useGarageTheme();
  return <View style={{ gap: 10, padding: 14, borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: g.card }}>{children}</View>;
}

/** Tinted note: red for errors, bronze for information. */
export function ProviderNote({ children, error }: { children: ReactNode; error?: boolean }) {
  return <Note tone={error ? "danger" : "accent"} icon={error ? "alert-circle" : "information-circle"}>{children}</Note>;
}

/** Selectable chip: bronze when chosen. */
export function ProviderChoice({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; icon?: GIconName }) {
  return <Chip label={label} on={selected} icon={icon} onPress={onPress} />;
}
