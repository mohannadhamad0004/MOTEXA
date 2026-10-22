import { ReactNode } from "react";
import { View } from "react-native";
import LanguageSwitch from "../LanguageSwitch";
import { Text } from "../ui/Text";
import { IconButton } from "../ui/IconButton";
import { Screen } from "./Screen";
import { signOut } from "../../core/session/session";
import { goBack } from "../../core/hooks/nav";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";

/** Page header: brand mark (or back button), language + appearance switch, title and subtitle. */
export function Header({
  brand,
  title,
  subtitle,
  back,
  signOutButton,
}: {
  brand: string;
  title: string;
  subtitle?: string;
  back?: boolean;
  signOutButton?: boolean;
}) {
  const { c, row, align, isArabic, type, weight } = useTheme();
  const { t } = useL();
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={[row, { alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }]}>
        {back ? (
          <IconButton icon={isArabic ? "arrow-forward" : "arrow-back"} label={t("Back", "رجوع")} onPress={() => goBack("/")} />
        ) : (
          <View style={[row, { alignItems: "center", gap: 7 }]}>
            <View style={{ width: 18, height: 2, borderRadius: 2, backgroundColor: c.accent }} />
            <Text style={{ color: c.accent, fontSize: 10, letterSpacing: 2, fontWeight: weight.bold }}>{brand}</Text>
          </View>
        )}
        <View style={[row, { gap: 8, alignItems: "center" }]}>
          <LanguageSwitch compact light />
          {signOutButton && <IconButton icon="log-out-outline" label={t("Sign out", "تسجيل الخروج")} onPress={signOut} />}
        </View>
      </View>
      <Text style={[{ color: c.text, fontSize: 30, lineHeight: 38, fontWeight: weight.bold, letterSpacing: isArabic ? 0 : -0.7 }, align]}>{title}</Text>
      {subtitle ? <Text style={[{ color: c.textMuted, fontSize: type.body.fontSize, lineHeight: 20, marginTop: 3 }, align]}>{subtitle}</Text> : null}
    </View>
  );
}

/** Screen + Header in one: the usual provider / admin page. */
export function DashboardLayout({
  brand = "MOTEXA",
  title,
  subtitle,
  back,
  signOutButton,
  onRefresh,
  refreshing,
  children,
}: {
  brand?: string;
  title: string;
  subtitle?: string;
  back?: boolean;
  signOutButton?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}) {
  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <Header brand={brand} title={title} subtitle={subtitle} back={back} signOutButton={signOutButton} />
      {children}
    </Screen>
  );
}
