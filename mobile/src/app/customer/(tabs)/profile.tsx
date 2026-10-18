import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { KV } from "../../../components/ui/Rows";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { Screen } from "../../../components/layout/Screen";
import { router } from "expo-router";
import { useSessionUser, signOut } from "../../../features/shared/session";

export default function CustomerProfile() {
  const user = useSessionUser();
  const { t, isArabic, toggleLanguage } = useL();
  return (
    <Screen tabs>
      <Header brand="MOTEXA" title={t("Profile", "حسابي")} />
      <Card>
        <KV k={t("Name", "الاسم")} v={user.fullName} />
        <KV k={t("Email", "البريد الإلكتروني")} v={user.email} />
      </Card>

      <SectionHeader title={t("Activity", "النشاط")} />
      <Button variant="ghost" icon="receipt-outline" label={t("My requests", "طلباتي")} onPress={() => router.push("/customer/requests")} />

      <SectionHeader title={t("Language", "اللغة")} />
      <Button variant="ghost" icon="language-outline" label={isArabic ? "English" : "العربية"} onPress={toggleLanguage} />

      <SectionHeader title={t("Account", "الحساب")} />
      <Button variant="danger" icon="log-out-outline" label={t("Sign out", "تسجيل الخروج")} onPress={signOut} />
    </Screen>
  );
}
