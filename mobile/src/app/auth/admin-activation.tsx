import { apiUrl } from "../../features/shared/api";
import { useAppearanceStyles, useAppearance } from "../../components/Appearance";
import { PanelFill, CanvasFill } from "../../components/BrandSurfaces";
import { useLanguage } from "../../i18n/LanguageContext";
import LanguageSwitch from "../../components/LanguageSwitch";
import { Text, VisualProvider, HeroReveal, DecorativeHalo } from "../../components/MotexaVisual";

import React, { useEffect, useState } from "react";
import { View, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import MotexaDialog from "../../components/MotexaDialog";

const API = apiUrl();
const BG = "#17100C";
const BRONZE = "#E0A36F";
const WHITE = "#FFF5EA";

type Invitation = {
  fullName: string;
  email: string;
  permission: string;
};

type Step = "request" | "verify" | "password" | "complete";

export default function AdminActivationScreen() {
  const s = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token)
    ? params.token[0]
    : params.token;

  const { isArabic: ar } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const [step, setStep] = useState<Step>("request");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  const [dialog, setDialog] = useState({
    visible: false,
    success: false,
    message: "",
  });

  const t = (en: string, arabic: string) => (ar ? arabic : en);

  const showDialog = (message: string, success = false) => {
    setDialog({ visible: true, success, message });
  };

  const department = (permission: string) => {
    const departments: Record<string, [string, string]> = {
      MANAGE_MECHANICS: ["Mechanics Management", "إدارة الميكانيكيين"],
      MANAGE_SPARE_PARTS: ["Spare Parts Management", "إدارة قطع الغيار"],
      MANAGE_TOWING: ["Towing Management", "إدارة خدمات السحب"],
    };

    const value = departments[permission];
    return value ? t(value[0], value[1]) : permission;
  };

  useEffect(() => {
    let active = true;

    async function verifyInvitation() {
      if (!token || !API) {
        setVerifyError("Missing invitation token or API configuration.");
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `${API}/auth/admin/verify-invitation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );

        const data = await response.json();
        if (!active) return;

        if (!response.ok) {
          setVerifyError(
            data.message || "Invitation is invalid or expired."
          );
          return;
        }

        const details = data.invitation || data;

        if (!details.email || !details.fullName) {
          setVerifyError("Incomplete invitation details.");
          return;
        }

        setInvitation({
          fullName: details.fullName,
          email: details.email,
          permission: details.permission || "",
        });
      } catch {
        if (active) {
          setVerifyError("Unable to connect to the server.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    verifyInvitation();

    return () => {
      active = false;
    };
  }, [token]);

  const post = async (
    endpoint: string,
    body: Record<string, string>
  ) => {
    if (!API) throw new Error("API configuration is missing.");

    const response = await fetch(`${API}/auth/admin/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "Request failed.");
    }

    return data;
  };

  const requestOtp = async () => {
    if (!token || loading) return;

    if (lastSentAt && Date.now() - lastSentAt < 60000) {
      showDialog(
        t(
          "Please wait 60 seconds before requesting another code.",
          "يرجى الانتظار 60 ثانية قبل طلب رمز جديد."
        )
      );
      return;
    }

    try {
      setLoading(true);

      await post("request-otp", { token });

      setOtp("");
      setLastSentAt(Date.now());
      setStep("verify");

      showDialog(
        t(
          "A 6-digit verification code was sent to your email. It expires in 5 minutes.",
          "تم إرسال رمز تحقق من 6 أرقام إلى بريدك الإلكتروني. تنتهي صلاحيته خلال 5 دقائق."
        )
      );
    } catch (error) {
      showDialog(
        error instanceof Error
          ? error.message
          : t("Unable to send code.", "تعذر إرسال الرمز.")
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!token || loading) return;

    if (!/^\d{6}$/.test(otp)) {
      showDialog(
        t(
          "Enter the 6-digit verification code.",
          "أدخلي رمز التحقق المكوّن من 6 أرقام."
        )
      );
      return;
    }

    try {
      setLoading(true);

      await post("verify-otp", { token, otp });

      setStep("password");
      setOtp("");
    } catch (error) {
      showDialog(
        error instanceof Error
          ? error.message
          : t("Verification failed.", "فشل التحقق من الرمز.")
      );
    } finally {
      setLoading(false);
    }
  };

  const activate = async () => {
    if (!token || loading) return;

    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      showDialog(
        t(
          "Password must have at least 12 characters, uppercase and lowercase letters, a number, and a symbol.",
          "يجب أن تحتوي كلمة المرور على 12 حرفًا على الأقل، وحرف كبير وصغير، ورقم ورمز خاص."
        )
      );
      return;
    }

    if (password !== confirmPassword) {
      showDialog(
        t(
          "Passwords do not match.",
          "كلمتا المرور غير متطابقتين."
        )
      );
      return;
    }

    try {
      setLoading(true);

      await post("activate", { token, password });

      setPassword("");
      setConfirmPassword("");
      setStep("complete");

      showDialog(
        t(
          "Your administrator account has been activated successfully. You can now sign in.",
          "تم تفعيل حساب الإدارة بنجاح. يمكنك الآن تسجيل الدخول."
        ),
        true
      );
    } catch (error) {
      showDialog(
        error instanceof Error
          ? error.message
          : t("Activation failed.", "فشل تفعيل الحساب.")
      );
    } finally {
      setLoading(false);
    }
  };

  const actionButton = (
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void
  ) => (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={{ opacity: loading ? 0.6 : 1, marginTop: 20 }}
    >
      <LinearGradient
        colors={["#F1D3A8", "#D6AE78", "#BA8B52"]}
        style={s.button}
      >
        {loading ? (
          <ActivityIndicator color={BG} />
        ) : (
          <>
            <Ionicons name={icon} size={21} color={BG} />
            <Text style={s.buttonText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );

  return (
    <VisualProvider><View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={dark ? ["#211B17", "#30251D", "#241D18"] : ["#E4D5C1", "#CEB797", "#DDCAB1"]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.top}>
            <Pressable onPress={() => router.replace("/choose-role")}>
              <Ionicons name="arrow-back" size={24} color={BRONZE} />
            </Pressable>

            <LanguageSwitch light />
          </View>

          <View style={[s.header, {alignItems: ar ? "flex-end" : "flex-start"}]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={50}
              color={BRONZE}
            />
            <Text style={s.brand}>MOTEXA</Text>
            <Text style={[s.title, {textAlign: ar ? "right" : "left"}]}>
              {t("Activate Your Account", "تفعيل حساب الإدارة")}
            </Text>
            <Text style={[s.subtitle, {textAlign: ar ? "right" : "left"}]}>
              {t(
                "Complete your secure administrator registration.",
                "أكملي تسجيل حساب الإدارة بطريقة آمنة."
              )}
            </Text>
          </View>

          {checking ? (
            <View style={s.center}>
              <ActivityIndicator color={BRONZE} size="large" />
              <Text style={s.muted}>
                {t("Verifying invitation...", "جارٍ التحقق من الدعوة...")}
              </Text>
            </View>
          ) : !invitation ? (
            <View style={s.card}><PanelFill kind="hero" radius={25}/>
              <Ionicons
                name="alert-circle-outline"
                size={42}
                color="#E9A58B"
              />
              <Text style={[s.title, {textAlign: ar ? "right" : "left"}]}>
                {t("Invitation Unavailable", "الدعوة غير متاحة")}
              </Text>
              <Text style={s.muted}>
                {verifyError ||
                  t(
                    "The invitation may have expired or been revoked.",
                    "قد تكون الدعوة منتهية أو ملغاة."
                  )}
              </Text>
            </View>
          ) : (
            <>
              <View style={s.card}>
                <View style={s.cardHeading}>
                  <Ionicons
                    name="mail-open-outline"
                    size={22}
                    color={BRONZE}
                  />
                  <Text style={s.cardTitle}>
                    {t("Invitation Details", "تفاصيل الدعوة")}
                  </Text>
                </View>

                <Text style={s.infoLabel}>
                  {t("FULL NAME", "الاسم الكامل")}
                </Text>
                <Text style={s.infoValue}>{invitation.fullName}</Text>

                <Text style={s.infoLabel}>
                  {t("EMAIL", "البريد الإلكتروني")}
                </Text>
                <Text style={s.infoValue}>{invitation.email}</Text>

                <Text style={s.infoLabel}>
                  {t("DEPARTMENT", "القسم")}
                </Text>
                <Text style={s.infoValue}>
                  {department(invitation.permission)}
                </Text>
              </View>

              {step === "request" && (
                <View style={s.card}>
                  <Ionicons
                    name="shield-outline"
                    size={38}
                    color={BRONZE}
                  />
                  <Text style={s.sectionTitle}>
                    {t("Email Verification", "التحقق من البريد الإلكتروني")}
                  </Text>
                  <Text style={s.muted}>
                    {t(
                      "We'll send a 6-digit code to your email to confirm your identity.",
                      "سنرسل رمزًا من 6 أرقام إلى بريدك الإلكتروني لتأكيد هويتك."
                    )}
                  </Text>

                  {actionButton(
                    t("Send Verification Code", "إرسال رمز التحقق"),
                    "mail-outline",
                    requestOtp
                  )}
                </View>
              )}

              {step === "verify" && (
                <View style={s.card}>
                  <Ionicons
                    name="keypad-outline"
                    size={38}
                    color={BRONZE}
                  />
                  <Text style={s.sectionTitle}>
                    {t("Enter Verification Code", "أدخلي رمز التحقق")}
                  </Text>
                  <Text style={s.muted}>
                    {t(
                      "Enter the code sent to your email. It expires after 5 minutes.",
                      "أدخلي الرمز المرسل إلى بريدك. تنتهي صلاحيته بعد 5 دقائق."
                    )}
                  </Text>

                  <TextInput
                    style={s.otpInput}
                    value={otp}
                    onChangeText={(value) =>
                      setOtp(value.replace(/\D/g, "").slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="••••••"
                    placeholderTextColor="#9C836B"
                    textAlign="center"
                  />

                  {actionButton(
                    t("Verify Code", "التحقق من الرمز"),
                    "checkmark-circle-outline",
                    verifyOtp
                  )}

                  <Pressable
                    onPress={requestOtp}
                    disabled={loading}
                    style={s.secondaryAction}
                  >
                    <Text style={s.secondaryText}>
                      {t("Resend Code", "إعادة إرسال الرمز")}
                    </Text>
                  </Pressable>
                </View>
              )}

              {step === "password" && (
                <View style={s.card}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={38}
                    color={BRONZE}
                  />
                  <Text style={s.sectionTitle}>
                    {t("Email Verified", "تم التحقق من البريد")}
                  </Text>
                  <Text style={s.muted}>
                    {t(
                      "Create a strong password to activate your account.",
                      "أنشئي كلمة مرور قوية لتفعيل حسابك."
                    )}
                  </Text>

                  <Text style={s.label}>
                    {t("Create Password", "إنشاء كلمة المرور")}
                  </Text>

                  <View style={s.inputRow}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={19}
                      color={BRONZE}
                    />
                    <TextInput
                      style={s.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={t("Strong password", "كلمة مرور قوية")}
                      placeholderTextColor="#9C836B"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#B9A293"
                      />
                    </Pressable>
                  </View>

                  <Text style={s.label}>
                    {t("Confirm Password", "تأكيد كلمة المرور")}
                  </Text>

                  <View style={s.inputRow}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={19}
                      color={BRONZE}
                    />
                    <TextInput
                      style={s.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder={t("Repeat password", "أعيدي كلمة المرور")}
                      placeholderTextColor="#9C836B"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>

                  <Text style={s.hint}>
                    {t(
                      "At least 12 characters, uppercase, lowercase, number, and symbol.",
                      "12 حرفًا على الأقل، وحرف كبير وصغير، ورقم ورمز خاص."
                    )}
                  </Text>

                  {actionButton(
                    t("Activate Account", "تفعيل الحساب"),
                    "shield-checkmark-outline",
                    activate
                  )}
                </View>
              )}

              {step === "complete" && (
                <View style={s.card}>
                  <Ionicons
                    name="checkmark-circle"
                    size={48}
                    color={BRONZE}
                  />
                  <Text style={s.sectionTitle}>
                    {t("Account Activated", "تم تفعيل الحساب")}
                  </Text>
                  <Text style={s.muted}>
                    {t(
                      "Your administrator account is ready.",
                      "حساب الإدارة أصبح جاهزًا."
                    )}
                  </Text>

                  {actionButton(
                    t("Go to Sign In", "الانتقال لتسجيل الدخول"),
                    "log-in-outline",
                    () => router.replace("/auth/login")
                  )}
                </View>
              )}
            </>
          )}

          <View style={s.footer}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={BRONZE}
            />
            <Text style={s.footerText}>
              {t("Secured by MOTEXA", "محمي بواسطة MOTEXA")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MotexaDialog
        visible={dialog.visible}
        type={dialog.success ? "success" : "error"}
        title={
          dialog.success
            ? t("Account Activated", "تم تفعيل الحساب")
            : t("Notice", "تنبيه")
        }
        message={dialog.message}
        confirmText={t("Continue", "متابعة")}
        cancelText={t("Close", "إغلاق")}
        onConfirm={() => {
          const success = dialog.success;
          setDialog((previous) => ({ ...previous, visible: false }));
          if (success) router.replace("/auth/login");
        }}
        onCancel={() => {
          const success = dialog.success;
          setDialog((previous) => ({ ...previous, visible: false }));
          if (success) router.replace("/auth/login");
        }}
      />
    </View></VisualProvider>
  );
}

const baseStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E9DECE",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 58 : 35,
    paddingBottom: 35,
    flexGrow: 1,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  language: {
    color: BRONZE,
    fontWeight: "800",
    backgroundColor: "#352318",
    padding: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    alignItems: "flex-start",
    marginTop: 29,
    marginBottom: 29,
  },
  brand: {
    color: "#8A633C",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 3,
    marginTop: 10,
  },
  title: {
    color: "#3A2B1C",
    fontSize: 34,
    fontWeight: "600",
    marginTop: 24,
    textAlign: "left",
    lineHeight: 47,
  },
  subtitle: {
    color: "#8E765C",
    fontSize: 12,
    textAlign: "left",
    marginTop: 8,
    lineHeight: 22,
  },
  center: {
    alignItems: "center",
    gap: 18,
    marginTop: 50,
  },
  muted: {
    color: "#8E765C",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 12,
  },
  card: {
    backgroundColor: "#2B2117",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#A67E50",
    padding: 25,
    marginBottom: 25,
    overflow: "hidden",
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    color: "#DCB580",
    fontWeight: "600",
    fontSize: 15,
  },
  infoLabel: {
    color: "#AD8A62",
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 12,
  },
  infoValue: {
    color: "#FAF3E7",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 25,
  },
  sectionTitle: {
    color: "#3A2B1C",
    fontSize: 25,
    fontWeight: "600",
    marginTop: 14,
    lineHeight: 36,
  },
  label: {
    color: "#604A33",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 10,
    marginTop: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9EF",
    borderWidth: 1,
    borderColor: "#D6BFA0",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 61,
    gap: 10,
  },
  input: {
    flex: 1,
    color: "#3A2B1C",
    fontSize: 15,
  },
  otpInput: {
    backgroundColor: "#FFF9EF",
    borderWidth: 1,
    borderColor: "#C89D64",
    borderRadius: 16,
    color: "#3A2B1C",
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: 9,
    height: 75,
    marginTop: 22,
  },
  hint: {
    color: "#8E765C",
    fontSize: 11,
    lineHeight: 21,
    marginTop: 18,
  },
  button: {
    height: 60,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonText: {
    color: BG,
    fontWeight: "600",
    fontSize: 14,
  },
  secondaryAction: {
    alignItems: "center",
    marginTop: 22,
    padding: 10,
  },
  secondaryText: {
    color: "#8A633C",
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 35,
  },
  footerText: {
    color: "#9B805E",
    fontSize: 10,
  },
});
