import { useLanguage } from "../../i18n/LanguageContext";

/** en/ar picker + RTL helpers, following the existing `isArabic ? ar : en` convention. */
export function useL() {
  const { isArabic, toggleLanguage } = useLanguage();
  return {
    isArabic,
    toggleLanguage,
    t: (en: string, ar: string) => (isArabic ? ar : en),
    row: { flexDirection: isArabic ? "row-reverse" : "row" } as const,
    align: { textAlign: isArabic ? "right" : "left" } as const,
  };
}
