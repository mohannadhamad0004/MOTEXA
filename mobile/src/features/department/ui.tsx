// What is left of the old department kit: the palette and three small pieces still used by customer-side screens (the order chat,
// the shops' / tow companies' public profiles and the "as customers see it" previews). Provider and admin screens use
// components/manage/* and the Garage kit (docs/guide/10-ui-system.md).
import { Ionicons } from "@expo/vector-icons";
import { View, ViewStyle } from "react-native";
import { useAppearance } from "../../components/Appearance";
import { Text } from "../../components/MotexaVisual";
import { useLanguage } from "../../i18n/LanguageContext";
import { garageDark, garageLight, gShape } from "../../theme/garage";

type IconName = keyof typeof Ionicons.glyphMap;

/** The department palette: the shared theme tokens (src/theme/garage.ts), so dark/light and contrast come from one place. */
export function useDT() {
  const { dark } = useAppearance();
  const { isArabic: ar } = useLanguage();
  const g = dark ? garageDark : garageLight;
  const chip = (tone: Tone): ChipColors => {
    const c = tone === "ok" ? g.success : tone === "bad" ? g.danger : tone === "amber" ? g.warning : tone === "bronze" ? g.accentText : g.soft;
    return tone === "neutral" ? { fg: g.soft, bg: g.cardSoft, border: g.line } : { fg: c, bg: c + "26", border: c + "66" };
  };
  return {
    dark,
    ar,
    t: (en: string, arabic: string) => (ar ? arabic : en),
    ink: g.ink,
    muted: g.soft,
    surface: g.card,
    border: g.line,
    /** solid bronze for primary actions and active states, and the ink that sits on it */
    fill: g.accent,
    fillInk: g.onAccent,
    soft: g.tint,
    accent: g.accentText,
    paper: g.cardSoft,
    /** the garage page background (shell of every admin page) */
    page: g.page,
    warn: g.warning,
    ok: g.success,
    bad: g.danger,
    row: (ar ? "row-reverse" : "row") as "row" | "row-reverse",
    align: (ar ? "right" : "left") as "right" | "left",
    chip,
  };
}

export type Tone = "neutral" | "bronze" | "amber" | "ok" | "bad";
type ChipColors = { fg: string; bg: string; border: string };

/** The one chip of the admin area: tinted background, border and text in the same hue. */
export function Pill({ label, tone = "neutral", icon, size = "s" }: { label: string; tone?: Tone | "warn"; icon?: IconName; size?: "s" | "l" }) {
  const d = useDT();
  const c = d.chip(tone === "warn" ? "amber" : tone);
  const big = size === "l";
  return (
    <View style={{ flexDirection: d.row, alignItems: "center", gap: big ? 6 : 4, paddingHorizontal: big ? 14 : 9, paddingVertical: big ? 7 : 3, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, alignSelf: "flex-start" }}>
      {icon ? <Ionicons name={icon} size={big ? 16 : 12} color={c.fg} /> : null}
      <Text style={{ fontSize: big ? 14 : 11, lineHeight: big ? 21 : 17, color: c.fg, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** The one card look = the garage Card: radius 22, card colour; light: soft warm shadow, dark: 1 px line. warn / bad tint the border. */
export const cardStyle = (d: ReturnType<typeof useDT>, tone?: "warn" | "bad"): ViewStyle => ({
  borderRadius: gShape.card,
  backgroundColor: d.surface,
  borderWidth: d.dark || tone ? 1 : 0,
  borderColor: tone === "bad" ? d.bad : tone === "warn" ? d.warn : d.border,
  ...(d.dark ? null : { shadowColor: "#50321A", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 }),
})

/** Initial in a tinted circle: the avatar of a business or a person. */
export function Avatar({ name, size = 44, tone = "bronze" }: { name: string; size?: number; tone?: Tone }) {
  const d = useDT();
  const c = d.chip(tone);
  const initial = (name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.fg, fontSize: size * 0.42, lineHeight: size * 0.6, fontWeight: "700" }}>{initial}</Text>
    </View>
  );
}
