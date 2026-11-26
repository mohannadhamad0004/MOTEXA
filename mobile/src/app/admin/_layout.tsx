import { Stack } from "expo-router";
import { useLanguage } from "../../i18n/LanguageContext";
import { useReduced } from "../../motion";
import { useGarageTheme } from "../../theme/garage";

export default function AdminLayout() {
  const reduced = useReduced();
  const { isArabic } = useLanguage();
  const { g } = useGarageTheme();
  return <Stack screenOptions={{ headerShown: false, animation: reduced ? "none" : isArabic ? "slide_from_left" : "slide_from_right", contentStyle: { backgroundColor: g.page } }} />;
}
