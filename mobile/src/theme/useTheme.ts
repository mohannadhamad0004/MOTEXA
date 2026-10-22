import { useMemo } from "react";
import { useAppearance } from "../components/Appearance";
import { useLanguage } from "../i18n/LanguageContext";
import { Colors, darkColors, elevation, lightColors, motion, radius, spacing, type, weight } from "./tokens";

/** Colors + scales for the current appearance (Diala's useAppearance) and language. */
export function useTheme() {
  const { dark, mode, setMode } = useAppearance();
  const { isArabic } = useLanguage();
  return useMemo(() => {
    const c: Colors = dark ? darkColors : lightColors;
    return {
      dark,
      mode,
      setMode,
      isArabic,
      c,
      s: spacing,
      r: radius,
      type,
      weight,
      motion,
      shadow: elevation(dark, c.shadow),
      /** flexDirection for a horizontal row: mirrored in Arabic. */
      row: { flexDirection: isArabic ? "row-reverse" : "row" } as const,
      /** textAlign that follows the language. */
      align: { textAlign: isArabic ? "right" : "left" } as const,
    };
  }, [dark, mode, setMode, isArabic]);
}

export type Theme = ReturnType<typeof useTheme>;
