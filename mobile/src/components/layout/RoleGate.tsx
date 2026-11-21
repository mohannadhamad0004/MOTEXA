import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode, useEffect } from "react";
import { View } from "react-native";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { SkeletonList } from "../ui/Skeleton";
import { Screen } from "./Screen";
import { SessionProvider, SessionUser, signOut, useSession } from "../../core/session/session";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";

/** Client-side UX gate. Every API route enforces the same rule on the server. */
export function RoleGate({ allow, children }: { allow: (u: SessionUser) => boolean; children: ReactNode }) {
  const s = useSession();
  const { t } = useL();
  const { c } = useTheme();
  useEffect(() => {
    if (s.status === "none") router.replace("/auth/login");
  }, [s.status]);

  if (s.status !== "ready")
    return (
      <Screen scroll={false}>
        <SkeletonList count={3} />
      </Screen>
    );
  if (!allow(s.user)) {
    return (
      <Screen scroll={false} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="lock-closed-outline" size={34} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: "700", marginTop: 14 }}>{t("Access denied", "الوصول مرفوض")}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13, textAlign: "center", marginTop: 6 }}>
          {t("Your account is not allowed to open this area.", "حسابك غير مصرّح له بفتح هذه المنطقة.")}
        </Text>
        <View style={{ height: 18 }} />
        <Button label={t("Sign out", "تسجيل الخروج")} variant="ghost" onPress={signOut} />
      </Screen>
    );
  }
  return <SessionProvider user={s.user}>{children}</SessionProvider>;
}
