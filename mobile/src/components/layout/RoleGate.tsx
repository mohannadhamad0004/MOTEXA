import { router } from "expo-router";
import { ReactNode, useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GButton, GIcon, GText, SkeletonRows } from "../garage";
import { SessionProvider, SessionUser, signOut, useSession } from "../../core/session/session";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";

/** Client-side UX gate. Every API route enforces the same rule on the server. */
export function RoleGate({ allow, children }: { allow: (u: SessionUser) => boolean; children: ReactNode }) {
  const s = useSession();
  const { t } = useL();
  const { g } = useGarageTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (s.status === "none") router.replace("/auth/login");
  }, [s.status]);

  const frame = { flex: 1, backgroundColor: g.page, paddingTop: insets.top + 24, paddingHorizontal: 20 } as const;
  if (s.status !== "ready")
    return (
      <View style={frame}>
        <SkeletonRows count={3} />
      </View>
    );
  if (!allow(s.user)) {
    return (
      <View style={[frame, { alignItems: "center", justifyContent: "center", gap: 6 }]}>
        <GIcon name="lock-closed-outline" size={34} color={g.accentText} />
        <GText accessibilityRole="header" style={[gType.title, { marginTop: 8 }]}>{t("Access denied", "الوصول مرفوض")}</GText>
        <GText soft style={[gType.bodySm, { textAlign: "center" }]}>{t("Your account is not allowed to open this area.", "حسابك غير مصرّح له بفتح هذه المنطقة.")}</GText>
        <View style={{ height: 12 }} />
        <GButton label={t("Sign out", "تسجيل الخروج")} variant="ghost" onPress={() => void signOut()} />
      </View>
    );
  }
  return <SessionProvider user={s.user}>{children}</SessionProvider>;
}
