import { router } from "expo-router";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { useSessionUser, signOut } from "../../../features/shared/session";
import { Button, Card, Header, KV, Section, useL } from "../../../features/shared/ui";

export default function CustomerProfile() {
  const user = useSessionUser();
  const { t, isArabic, toggleLanguage } = useL();
  return (
    <CustomerScreen tabs>
      <Header brand="MOTEXA" title={t("Profile", "حسابي")} />
      <Card>
        <KV k={t("Name", "الاسم")} v={user.fullName} />
        <KV k={t("Email", "البريد الإلكتروني")} v={user.email} />
      </Card>

      <Section title={t("Activity", "النشاط")} />
      <Button variant="ghost" icon="receipt-outline" label={t("My requests", "طلباتي")} onPress={() => router.push("/customer/requests")} />

      <Section title={t("Language", "اللغة")} />
      <Button variant="ghost" icon="language-outline" label={isArabic ? "English" : "العربية"} onPress={toggleLanguage} />

      <Section title={t("Account", "الحساب")} />
      <Button variant="danger" icon="log-out-outline" label={t("Sign out", "تسجيل الخروج")} onPress={signOut} />
    </CustomerScreen>
  );
}
