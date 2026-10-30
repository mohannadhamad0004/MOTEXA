// "Mo's Garage" customer design tokens: warm, clean, soft-3D. Customer screens only (provider / dept keep their own theme).
import { useMemo } from "react";
import { ViewStyle } from "react-native";
import { useAppearance } from "../components/Appearance";
import { useLanguage } from "../i18n/LanguageContext";

export type GarageColors = {
  page: string;
  /** exact background of Mo's clips, so a clip blends into the hero in light mode */
  heroTone: string;
  card: string;
  cardSoft: string;
  tint: string;
  ink: string;
  /** secondary text, >= 4.5:1 on page */
  soft: string;
  line: string;
  /** filled buttons */
  accent: string;
  /** text on a filled accent button */
  onAccent: string;
  /** links / prices */
  accentText: string;
  danger: string;
  success: string;
  warning: string;
  /** floating tab bar */
  bar: string;
  barInk: string;
  barActive: string;
  barActiveInk: string;
};

export const garageLight: GarageColors = {
  page: "#F4ECE2",
  heroTone: "#EAD9C6",
  card: "#FFFFFF",
  cardSoft: "#FFFBF6",
  tint: "#FBEBDC",
  ink: "#2B1F18",
  soft: "#6E5644",
  line: "#E6D8C8",
  accent: "#9A5B26",
  onAccent: "#FFFFFF",
  accentText: "#8A5524",
  danger: "#C2410C",
  success: "#15803D",
  warning: "#B45309",
  bar: "#FFFFFF",
  barInk: "#6E5644",
  barActive: "#9A5B26",
  barActiveInk: "#FFFFFF",
};

export const garageDark: GarageColors = {
  page: "#17100C",
  heroTone: "#241812",
  card: "#2A1D16",
  cardSoft: "#33241C",
  tint: "#3A2A20",
  ink: "#FFF5EA",
  soft: "#C9B4A2",
  line: "#4A3528",
  accent: "#E0A36F",
  onAccent: "#1F150F",
  accentText: "#E0A36F",
  danger: "#F87171",
  success: "#4ADE80",
  warning: "#FBBF24",
  bar: "#241812",
  barInk: "#C9B4A2",
  barActive: "#E0A36F",
  barActiveInk: "#1F150F",
};

/** Mo's clips in dark mode sit in this cream "spotlight" card (the cream cannot blend into a dark page). */
export const SPOTLIGHT = "#EAD9C6";

export const gType = {
  display: { fontSize: 26, lineHeight: 34, fontWeight: "800" },
  title: { fontSize: 17, lineHeight: 24, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "500" },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: "500" },
  tiny: { fontSize: 11, lineHeight: 15, fontWeight: "500" },
} as const;

export const gShape = { page: 20, card: 22, cardLg: 24, small: 14, hero: 32, pill: 999, spotlight: 28 } as const;

/** 4/8 grid */
export const gSpace = (n: number) => n * 4;

export function useGarageTheme() {
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  return useMemo(() => {
    const g = dark ? garageDark : garageLight;
    // light: soft warm shadow; dark: shadows are replaced by a 1px line border
    const shadow = (depth: 1 | 2 = 1): ViewStyle =>
      dark
        ? { borderWidth: 1, borderColor: g.line }
        : depth === 1
          ? { shadowColor: "#50321A", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 }
          : { shadowColor: "#50321A", shadowOpacity: 0.14, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 5 };
    return {
      dark,
      isArabic,
      g,
      shadow,
      /** horizontal row, mirrored in Arabic */
      row: { flexDirection: isArabic ? "row-reverse" : "row" } as const,
      align: { textAlign: isArabic ? "right" : "left" } as const,
      /** the start / end edge for absolutely placed things */
      start: isArabic ? ("right" as const) : ("left" as const),
      end: isArabic ? ("left" as const) : ("right" as const),
    };
  }, [dark, isArabic]);
}

export type GarageTheme = ReturnType<typeof useGarageTheme>;
