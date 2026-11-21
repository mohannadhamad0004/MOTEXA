import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Button, Input, Notice, Text } from "../../components/ui";
import { api } from "../../core/config/api";
import { useL } from "../../core/hooks/useL";
import { holdPassword } from "../../core/session/pendingSignup";
import { useTheme } from "../../theme/useTheme";

type Field = "fullName" | "email" | "phone" | "password" | "confirm";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = (v: string) => /^[0-9+()\-\s]{6,20}$/.test(v) && v.replace(/\D/g, "").length >= 5;
/** The server's rule (meetsPasswordPolicy), shown as a checklist while typing. */
const RULES: [(p: string) => boolean, string, string][] = [
  [(p) => p.length >= 12 && p.length <= 256, "12 to 256 characters", "من 12 إلى 256 حرفًا"],
  [(p) => /[A-Z]/.test(p), "One uppercase letter", "حرف إنجليزي كبير"],
  [(p) => /[a-z]/.test(p), "One lowercase letter", "حرف إنجليزي صغير"],
  [(p) => /[0-9]/.test(p), "One number", "رقم واحد"],
  [(p) => /[^A-Za-z0-9]/.test(p), "One symbol", "رمز خاص"],
];
const SERVER_FIELD: Record<string, Field> = { NAME_INVALID: "fullName", EMAIL_INVALID: "email", PHONE_INVALID: "phone", PASSWORD_POLICY: "password" };

/** Customer signup (the only account anyone can create here). The server always answers "check your email", then the code screen. */
export default function SignUpScreen() {
  const { c, row } = useTheme();
  const { t } = useL();
  const [form, setForm] = useState<Record<Field, string>>({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: Field) => (v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const email = form.email.trim().toLowerCase();

  const fieldText: Record<Field, string> = {
    fullName: t("Enter your full name (2 to 80 characters).", "أدخل اسمك الكامل (من 2 إلى 80 حرفًا)."),
    email: t("Enter a valid email address.", "أدخل بريدًا إلكترونيًا صحيحًا."),
    phone: t("Enter a valid phone number, or leave it empty.", "أدخل رقم هاتف صحيحًا أو اتركه فارغًا."),
    password: t("Your password must meet every rule below.", "يجب أن تحقق كلمة المرور كل الشروط أدناه."),
    confirm: t("The two passwords are not the same.", "كلمتا المرور غير متطابقتين."),
  };

  const submit = async () => {
    const name = form.fullName.trim();
    const bad: Partial<Record<Field, string>> = {};
    if (name.length < 2 || name.length > 80) bad.fullName = fieldText.fullName;
    if (!EMAIL.test(email) || email.length > 254) bad.email = fieldText.email;
    if (form.phone.trim() && !PHONE(form.phone.trim())) bad.phone = fieldText.phone;
    if (!RULES.every(([ok]) => ok(form.password))) bad.password = fieldText.password;
    else if (form.confirm !== form.password) bad.confirm = fieldText.confirm;
    setErrors(bad);
    setFormError("");
    if (Object.keys(bad).length) return;
    setBusy(true);
    try {
      await api("POST", "/auth/register", { fullName: name, email, phone: form.phone.trim() || undefined, password: form.password });
      holdPassword(email, form.password);
      router.replace({ pathname: "/auth/verify-email", params: { email, sent: "1" } });
    } catch (e: any) {
      const code = e?.data?.code;
      if (SERVER_FIELD[code]) setErrors({ [SERVER_FIELD[code]]: fieldText[SERVER_FIELD[code]] });
      else if (code === "RATE_LIMITED") setFormError(t("Too many sign-up attempts. Please wait an hour and try again.", "محاولات إنشاء حساب كثيرة. يرجى الانتظار ساعة ثم المحاولة مجددًا."));
      else if (!e?.status) setFormError(t("Could not connect. Check your connection and try again.", "تعذّر الاتصال. تحقق من الشبكة وحاول مجددًا."));
      else setFormError(t("Something went wrong on our side. Please try again.", "حدث خطأ من جهتنا. يرجى المحاولة مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t("Create your account", "أنشئ حسابك")}
      subtitle={t("For car owners: book mechanics, tow trucks and parts.", "لأصحاب السيارات: احجز ميكانيكيين وشاحنات سحب وقطع غيار.")}
    >
      {!!formError && <Notice tone="danger" icon="alert-circle-outline">{formError}</Notice>}
      <Input label={t("Full name", "الاسم الكامل")} value={form.fullName} onChangeText={set("fullName")} error={errors.fullName} autoComplete="name" textContentType="name" maxLength={80} />
      <Input label={t("Email address", "البريد الإلكتروني")} value={form.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
      <Input label={t("Phone (optional)", "الهاتف (اختياري)")} value={form.phone} onChangeText={set("phone")} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={20} />
      <Input label={t("Password", "كلمة المرور")} value={form.password} onChangeText={set("password")} error={errors.password} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
      <View style={{ marginTop: -6, marginBottom: 14, gap: 4 }}>
        {RULES.map(([ok, en, ar]) => {
          const met = ok(form.password);
          return (
            <View key={en} style={[row, { alignItems: "center", gap: 7 }]}>
              <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} size={15} color={met ? c.success : c.textDim} />
              <Text style={{ color: met ? c.text : c.textMuted, fontSize: 12 }}>{t(en, ar)}</Text>
            </View>
          );
        })}
      </View>
      <Input label={t("Confirm password", "تأكيد كلمة المرور")} value={form.confirm} onChangeText={set("confirm")} error={errors.confirm} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" onSubmitEditing={() => void submit()} />
      <Button label={t("Create account", "إنشاء الحساب")} onPress={() => void submit()} loading={busy} size="lg" icon="person-add-outline" style={{ marginTop: 4 }} />
      <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" }}>
        {t("We will email you a 6-digit code to confirm the address.", "سنرسل إلى بريدك رمزًا من 6 أرقام لتأكيده.")}
      </Text>
      <View style={[row, { justifyContent: "center", alignItems: "center", gap: 4, marginTop: 10, flexWrap: "wrap" }]}>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{t("Already have an account?", "لديك حساب بالفعل؟")}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace("/auth/login")} hitSlop={8} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}>
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: "700" }}>{t("Sign in", "تسجيل الدخول")}</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}
