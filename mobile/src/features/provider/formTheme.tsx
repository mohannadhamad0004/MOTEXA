// The application wizards (provider onboarding, mechanic application) on the Garage kit. Their screens were written against older
// theme objects; this gives them Garage tokens under the same short names, plus the few controls they share.
import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import { Field, GButton, StatusChip, type GIconName } from "../../components/garage";
import { appStatus } from "../../components/manage/ManagePage";
import { Block } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { gShape, useGarageTheme } from "../../theme/garage";

export type ChipTone = "bad" | "amber" | "ok" | "bronze" | "neutral";

export function useFormTheme() {
  const { t, isArabic } = useL();
  const { g, dark } = useGarageTheme();
  const chip = (tone: ChipTone | string) => {
    const c = tone === "bad" ? g.danger : tone === "amber" ? g.warning : tone === "ok" ? g.success : tone === "bronze" ? g.accentText : g.soft;
    return { fg: c, bg: c + "1A", border: c + "55" };
  };
  return {
    t, ar: isArabic, dark,
    row: isArabic ? ("row-reverse" as const) : ("row" as const), align: isArabic ? ("right" as const) : ("left" as const),
    ink: g.ink, muted: g.soft, border: g.line, surface: g.card, soft: g.cardSoft, bad: g.danger, accent: g.accent, chip,
  };
}

/** One card style; `tone` tints its border (a rejected document). */
export function cardStyle(theme: ReturnType<typeof useFormTheme>, tone?: ChipTone) {
  return { borderRadius: gShape.small, borderWidth: 1, borderColor: tone ? theme.chip(tone).border : theme.border, backgroundColor: theme.surface };
}

/** A Garage field; the old icon prop is accepted and left out (labels carry the meaning). */
export function IconField({ icon: _icon, ...p }: ComponentProps<typeof Field> & { icon?: GIconName }) {
  return <Field {...p} />;
}

export function FormButton({ label, onPress, icon, variant = "primary", disabled }: { label: string; onPress: () => void; icon?: GIconName; variant?: "primary" | "ghost" | "success" | "danger"; disabled?: boolean }) {
  return <GButton label={label} icon={icon} variant={variant === "success" ? "primary" : variant} disabled={disabled} onPress={onPress} />;
}

/** A titled soft panel (no heavy card). */
export function FormPanel({ title, children }: { title?: string; icon?: GIconName; children: ReactNode }) {
  const th = useFormTheme();
  if (title) return <Block title={title}><View style={{ gap: 10, paddingVertical: 10 }}>{children}</View></Block>;
  return <View style={[cardStyle(th), { gap: 10, padding: 14 }]}>{children}</View>;
}

/** Application / document status as the shared chip. */
export function AppStatusChip({ status, kind = "app" }: { status: string; kind?: "app" | "doc"; size?: "l" }) {
  const { t } = useL();
  return <StatusChip {...appStatus(status, t, kind)} />;
}
