import { ReactNode } from "react";
import { View } from "react-native";
import LanguageSwitch from "../LanguageSwitch";
import { Text } from "../ui/Text";
import { Screen } from "./Screen";
import { useTheme } from "../../theme/useTheme";

/** Centered brand, language / appearance switch and a card for a sign-in style form. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { c, r, row, align, isArabic, shadow } = useTheme();
  return (
    <Screen>
      <View style={[row, { justifyContent: "space-between", alignItems: "center", marginBottom: 28 }]}>
        <Text style={{ color: c.accent, fontSize: 13, letterSpacing: 3, fontWeight: "700" }}>MOTEXA</Text>
        <LanguageSwitch compact light />
      </View>
      <Text style={[{ color: c.text, fontSize: 30, lineHeight: 38, fontWeight: "700", letterSpacing: isArabic ? 0 : -0.7 }, align]}>{title}</Text>
      {subtitle ? <Text style={[{ color: c.textMuted, fontSize: 14, lineHeight: 22, marginTop: 4, marginBottom: 20 }, align]}>{subtitle}</Text> : null}
      <View style={{ borderRadius: r.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 20, ...shadow }}>{children}</View>
    </Screen>
  );
}
