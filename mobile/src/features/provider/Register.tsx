// Tow company / parts shop registration. Same two-part pattern as the mechanic registration: create the account here,
// then sign in and complete the application (Onboarding.tsx). Built with Diala's mechanic UI kit.
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { MechanicField, MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { ProviderButton, ProviderCard, ProviderChoice, ProviderNote } from "./kit";
import { Text } from "../../components/MotexaVisual";
import { CITIES, cityLabel } from "../../core/constants/cities";
import { Kind, register } from "./api";

export default function ProviderRegister({ kind }: { kind: Kind }) {
  const m = useMechanicTheme();
  const tow = kind === "TOW";
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const signIn = () => router.replace({ pathname: "/auth/login", params: { selectedRole: tow ? "towing" : "parts" } });

  async function submit() {
    if (busy) return;
    setError("");
    if (password !== confirm) return setError(m.t("Passwords do not match.", "كلمتا المرور غير متطابقتين."));
    if (!accept) return setError(m.t("Accept the terms to continue.", "وافق على الشروط للمتابعة."));
    setBusy(true);
    try {
      await register({ kind, fullName: fullName.trim(), businessName: businessName.trim(), email: email.trim(), phoneNumber: phone.trim(), city, password, acceptTerms: true });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.t("Registration could not be completed.", "تعذّر إكمال التسجيل."));
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <MechanicPage photo title={m.t("Your account is created", "تم إنشاء حسابك")}>
        <ProviderCard>
          <Text style={{ fontSize: 17, lineHeight: 28, fontWeight: "600", color: m.ink, textAlign: m.align }}>
            {tow ? m.t("Continue your tow company application", "تابع طلب شركة السحب") : m.t("Continue your parts shop application", "تابع طلب متجر قطع الغيار")}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 23, color: m.muted, textAlign: m.align, marginVertical: 10 }}>
            {m.t(
              "Sign in to add your business details and documents. MOTEXA reviews every application before you can receive requests.",
              "سجّل الدخول لإضافة بيانات نشاطك ومستنداتك. تراجع MOTEXA كل طلب قبل أن تتمكن من استقبال الطلبات.",
            )}
          </Text>
          <ProviderButton label={m.t("Sign in", "تسجيل الدخول")} onPress={signIn} />
        </ProviderCard>
      </MechanicPage>
    );

  return (
    <MechanicPage
      back
      title={tow ? m.t("Register your tow company", "سجّل شركة السحب") : m.t("Register your parts shop", "سجّل متجر قطع الغيار")}
      subtitle={m.t("Step 1 of 2: create your account. Next you add your business details and documents.", "الخطوة 1 من 2: أنشئ حسابك. بعدها تضيف بيانات نشاطك ومستنداتك.")}
    >
      <ProviderCard>
        <View style={{ gap: 13 }}>
          {error ? <ProviderNote error>{error}</ProviderNote> : null}
          <MechanicField label={tow ? m.t("Company name", "اسم الشركة") : m.t("Shop name", "اسم المتجر")} icon="business-outline" value={businessName} onChangeText={setBusinessName} maxLength={120} />
          <MechanicField label={m.t("Owner full name", "الاسم الكامل للمالك")} icon="person-outline" value={fullName} onChangeText={setFullName} maxLength={120} autoComplete="name" />
          <MechanicField label={m.t("Email address", "البريد الإلكتروني")} icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={254} />
          <MechanicField label={m.t("Phone number", "رقم الهاتف")} icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={24} />
          <Text style={{ fontSize: 12, lineHeight: 19, fontWeight: "600", color: m.ink, textAlign: m.align }}>{m.t("City", "المدينة")}</Text>
          <View style={{ flexDirection: m.row, flexWrap: "wrap", gap: 8 }}>
            {CITIES.map((c) => (
              <ProviderChoice key={c.name} label={cityLabel(c.name, m.ar)} selected={city === c.name} onPress={() => setCity(c.name)} />
            ))}
          </View>
          <MechanicField label={m.t("Password", "كلمة المرور")} icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} />
          <MechanicField label={m.t("Confirm password", "تأكيد كلمة المرور")} icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" maxLength={128} />
          <Text style={{ fontSize: 11, lineHeight: 18, color: m.muted, textAlign: m.align }}>
            {m.t("Password: 8 to 128 characters with uppercase, lowercase, a number and a symbol.", "كلمة المرور: من 8 إلى 128 حرفًا مع حرف كبير وصغير ورقم ورمز.")}
          </Text>
          <ProviderChoice
            label={m.t("I accept the MOTEXA terms for service providers", "أوافق على شروط MOTEXA لمزودي الخدمة")}
            selected={accept}
            onPress={() => setAccept(!accept)}
            icon={accept ? "checkmark-circle" : "ellipse-outline"}
          />
          <ProviderButton label={m.t("Create account", "إنشاء الحساب")} onPress={submit} busy={busy} disabled={busy} />
          <ProviderButton secondary label={m.t("I already have an account", "لدي حساب بالفعل")} onPress={signIn} />
        </View>
      </ProviderCard>
    </MechanicPage>
  );
}
