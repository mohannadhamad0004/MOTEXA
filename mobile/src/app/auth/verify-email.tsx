import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Button, Input, Notice, Text, type Tone } from "../../components/ui";
import { apiUrl, saveSession } from "../../core/config/api";
import { useL } from "../../core/hooks/useL";
import { landingFor } from "../../core/session/landing";
import { dropPassword, heldPassword } from "../../core/session/pendingSignup";
import { useTheme } from "../../theme/useTheme";

const post = async (path: string, body: object) => {
  const r = await fetch(apiUrl(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => null) };
};

/**
 * Signup step 2 (also reached from sign-in while the email is not confirmed): the 6-digit code + the password typed a moment ago
 * (memory only; asked again after an app reload) -> the account is active and signed in. "Send a new code" = a sign-in attempt,
 * which sends one (at most every 60 s, 5 an hour).
 */
export default function VerifyEmailScreen() {
  const { email = "", sent } = useLocalSearchParams<{ email?: string; sent?: string }>();
  const { c, row } = useTheme();
  const { t } = useL();
  const [askPassword] = useState(() => !heldPassword(email));
  const [password, setPassword] = useState(() => heldPassword(email));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"confirm" | "resend" | null>(null);
  const [note, setNote] = useState<{ tone: Tone; text: string } | null>(null);
  const [lastSent, setLastSent] = useState(() => (sent === "1" ? Date.now() : 0));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!email) return <Redirect href="/auth/signup" />;

  const wait = Math.max(0, 60 - Math.floor((now - lastSent) / 1000));
  const at = email.lastIndexOf("@");
  const masked = at > 0 ? email[0] + "***" + email.slice(at) : email;
  const maskedAr = "⁦" + masked + "⁩"; // LTR email kept whole inside Arabic text
  const offline = t("Could not connect. Check your connection and try again.", "تعذّر الاتصال. تحقق من الشبكة وحاول مجددًا.");
  const tooMany = t("Too many attempts. Please wait 15 minutes and try again.", "محاولات كثيرة. يرجى الانتظار 15 دقيقة ثم المحاولة مجددًا.");

  const enter = async (data: any) => {
    dropPassword();
    await saveSession(data.accessToken, data.refreshToken);
    router.replace((landingFor(data.user.role, data.user.adminPermissions ?? []) ?? "/auth/login") as Href);
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code)) return setNote({ tone: "danger", text: t("Enter the 6-digit code from the email.", "أدخل الرمز المكوّن من 6 أرقام من الرسالة.") });
    if (!password) return setNote({ tone: "danger", text: t("Enter your password.", "أدخل كلمة المرور.") });
    setBusy("confirm");
    setNote(null);
    try {
      const r = await post("/auth/verify-email", { email, password, code });
      if (r.status === 200) return await enter(r.data);
      const k = r.data?.code;
      setNote({
        tone: "danger",
        text:
          k === "CODE_INVALID" ? (askPassword ? t("The code or the password is not correct.", "الرمز أو كلمة المرور غير صحيحة.") : t("The code is not correct. Check the email and try again.", "الرمز غير صحيح. تحقق من الرسالة وحاول مجددًا."))
          : k === "CODE_EXPIRED" ? t("This code expired or was tried too often. Send a new code.", "انتهت صلاحية هذا الرمز أو جُرّب مرات كثيرة. أرسل رمزًا جديدًا.")
          : k === "NOTHING_TO_VERIFY" ? t("This email is already confirmed. Sign in.", "هذا البريد مؤكَّد بالفعل. سجّل الدخول.")
          : r.status === 429 ? tooMany
          : t("Something went wrong on our side. Please try again.", "حدث خطأ من جهتنا. يرجى المحاولة مرة أخرى."),
      });
    } catch {
      setNote({ tone: "danger", text: offline });
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    if (!password) return setNote({ tone: "danger", text: t("Enter your password first.", "أدخل كلمة المرور أولًا.") });
    setBusy("resend");
    setNote(null);
    try {
      const r = await post("/auth/login", { email, password });
      if (r.status === 200) return await enter(r.data); // confirmed meanwhile (e.g. on another phone)
      if (r.data?.code === "EMAIL_NOT_VERIFIED" && r.data.codeSent) {
        setLastSent(Date.now());
        setNote({ tone: "success", text: t(`We sent a new code to ${masked}.`, `أرسلنا رمزًا جديدًا إلى ${maskedAr}.`) });
      } else if (r.data?.code === "EMAIL_NOT_VERIFIED") {
        setNote({ tone: "warning", text: t("A new code can't be sent yet (one a minute, 5 an hour). Use the last code or try again later.", "لا يمكن إرسال رمز جديد الآن (رمز كل دقيقة و5 في الساعة). استخدم آخر رمز أو حاول لاحقًا.") });
      } else if (r.status === 429) setNote({ tone: "danger", text: tooMany });
      else setNote({ tone: "danger", text: t("We could not send a code for this email and password. If you already have an account, sign in instead.", "تعذّر إرسال رمز لهذا البريد وكلمة المرور. إذا كان لديك حساب بالفعل، فسجّل الدخول.") });
    } catch {
      setNote({ tone: "danger", text: offline });
    } finally {
      setBusy(null);
    }
  };

  const link = (label: string, go: () => void) => (
    <Pressable accessibilityRole="link" onPress={go} hitSlop={8} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}>
      <Text style={{ color: c.accent, fontSize: 13, fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );

  return (
    <AuthLayout
      title={t("Check your email", "تحقّق من بريدك")}
      subtitle={t(`Enter the 6-digit code we sent to ${masked}. It is valid for 5 minutes.`, `أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى ${maskedAr}. صالح لمدة 5 دقائق.`)}
    >
      {!!note && <Notice tone={note.tone} icon={note.tone === "success" ? "checkmark-circle-outline" : "alert-circle-outline"}>{note.text}</Notice>}
      <Input
        label={t("Verification code", "رمز التحقق")}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
        placeholder="••••••"
        onSubmitEditing={() => void confirm()}
      />
      {askPassword && (
        <Input label={t("Password", "كلمة المرور")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" />
      )}
      <Button label={t("Confirm email", "تأكيد البريد")} onPress={() => void confirm()} loading={busy === "confirm"} disabled={!!busy} size="lg" icon="mail-open-outline" />
      <Button
        label={wait ? t(`Send a new code (${wait} s)`, `إرسال رمز جديد (${wait} ث)`) : t("Send a new code", "إرسال رمز جديد")}
        onPress={() => void resend()}
        variant="ghost"
        loading={busy === "resend"}
        disabled={!!busy || wait > 0}
        style={{ marginTop: 10 }}
      />
      {__DEV__ && (
        <Text style={{ color: c.textDim, fontSize: 11, lineHeight: 17, marginTop: 12, textAlign: "center" }}>
          {t("Dev: with no email provider set in backend/.env, the code is printed in the backend terminal ([DEV EMAIL] line).", "للتطوير: إذا لم يُضبط مزوّد بريد في backend/.env فالرمز يظهر في نافذة الخادم (سطر [DEV EMAIL]).")}
        </Text>
      )}
      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, alignItems: "center" }}>
        <View style={[row, { justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }]}>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>{t("Already have an account?", "لديك حساب بالفعل؟")}</Text>
          {link(t("Sign in", "تسجيل الدخول"), () => router.replace("/auth/login"))}
        </View>
        {link(t("Use a different email", "استخدم بريدًا آخر"), () => router.replace("/auth/signup"))}
        {/* also the way out when someone else signed up with this email: the recovery code proves the inbox and confirms it */}
        {link(t("Can't confirm? Set a new password", "تعذّر التأكيد؟ عيّن كلمة مرور جديدة"), () => router.push("/auth/forgot-password"))}
      </View>
    </AuthLayout>
  );
}
