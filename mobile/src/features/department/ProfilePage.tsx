import { View } from "react-native";
import { GIcon, GText } from "../../components/garage";
import { Block, Facts, LogOut, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useSessionUser } from "../../core/session/session";
import { gType, useGarageTheme } from "../../theme/garage";
import { AppearanceSection } from "../providerhub/AppearanceSection";
import { useDepartment } from "./DepartmentContext";

/** Profile of the department admins (parts, tow, mechanics): the account, its departments, appearance & language, Log out (asks first). */
export function DeptProfile() {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const user = useSessionUser();
  const { available } = useDepartment();
  const role = user.role === "SUPER_ADMIN" ? t("Super Admin", "المشرف العام") : t("Administrator", "مسؤول");
  return (
    <Page title={user.fullName} line={role} back={false} tabBar>
      <Block title={t("Account", "الحساب")}>
        <Facts rows={[[t("Email address", "البريد الإلكتروني"), user.email], [t("Account role", "دور الحساب"), role]]} />
      </Block>
      <Block title={t("Departments", "الأقسام")}>
        {available.map((dep, i) => (
          <View key={dep.key} style={[row, { minHeight: 48, alignItems: "center", gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: g.line }]}>
            <GIcon name={dep.icon} size={20} color={g.accentText} />
            <GText style={[gType.bodySm, align, { flex: 1, fontWeight: "700" }]}>{t(dep.en, dep.ar)}</GText>
          </View>
        ))}
      </Block>
      <AppearanceSection />
      <LogOut />
    </Page>
  );
}
