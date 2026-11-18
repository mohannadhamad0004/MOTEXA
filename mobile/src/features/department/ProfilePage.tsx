import { useState } from "react";
import { View } from "react-native";
import { Card, GButton, ListRow, Note } from "../../components/garage";
import { signOut, useSessionUser } from "../../core/session/session";
import { AppearanceSection } from "../providerhub/AppearanceSection";
import { useDepartment } from "./DepartmentContext";
import { DeptPage, Pill, Section, useDT } from "./ui";

/**
 * Profile of the department admins (parts, tow, mechanics): the account, the departments it holds, "Appearance & language"
 * (Part C: language and theme moved here from the top bar) and Log out with a confirmation.
 */
export function DeptProfile() {
  const d = useDT();
  const user = useSessionUser();
  const { available } = useDepartment();
  const [confirm, setConfirm] = useState(false);
  const role = user.role === "SUPER_ADMIN" ? d.t("Super Admin", "المشرف العام") : d.t("Administrator", "مسؤول");
  return (
    <DeptPage>
      <View style={{ paddingTop: 8, paddingBottom: 6, gap: 8 }}>
        <Pill tone="bronze" label={d.t("ADMIN / ACCOUNT", "الإدارة / الحساب")} />
        <Section title={user.fullName} caption={role} />
      </View>

      <Card pad={8}>
        <ListRow icon="mail-outline" title={user.email} sub={d.t("Email address", "البريد الإلكتروني")} />
        <ListRow divider icon="shield-checkmark-outline" title={role} sub={d.t("Account role", "دور الحساب")} />
      </Card>

      <View style={{ marginTop: 28 }}>
        <Section title={d.t("Departments", "الأقسام")} caption={d.t("What this account can manage", "ما يمكن لهذا الحساب إدارته")} />
        <Card pad={8}>
          {available.map((dep, i) => (
            <ListRow key={dep.key} divider={i > 0} icon={dep.icon} title={d.t(dep.en, dep.ar)} />
          ))}
        </Card>
      </View>

      <AppearanceSection />

      <View style={{ marginTop: 28, gap: 8 }}>
        {!confirm ? (
          <GButton variant="danger" icon="log-out-outline" label={d.t("Log out", "تسجيل الخروج")} onPress={() => setConfirm(true)} />
        ) : (
          <Card>
            <Note tone="warning" icon="alert-circle-outline">{d.t("Log out of MOTEXA on this phone?", "تسجيل الخروج من موتكسا على هذا الهاتف؟")}</Note>
            <View style={{ flexDirection: d.row, gap: 10 }}>
              <GButton flex variant="secondary" label={d.t("Stay", "البقاء")} onPress={() => setConfirm(false)} />
              <GButton flex variant="danger" label={d.t("Yes, log out", "نعم، سجّل الخروج")} onPress={() => void signOut()} />
            </View>
          </Card>
        )}
      </View>
    </DeptPage>
  );
}
