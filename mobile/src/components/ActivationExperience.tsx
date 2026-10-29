import { CanvasFill } from "./BrandSurfaces";
import BrandWordmark from "./BrandWordmark";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearance } from "./Appearance";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "./MotexaVisual";
import { EditorialTitle } from "./PremiumUI";
import LanguageSwitch from "./LanguageSwitch";
import { ManagementBanner } from "./ManagementBanner";

type Props = {
  checking: boolean;
  invitation: { fullName: string; email: string; permission: string } | null;
  verifyError: string;
  step: "request" | "verify" | "password" | "complete";
  otp: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  loading: boolean;
  lastSentAt: number | null;
  departmentLabel: string;
  onOtpChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onTogglePassword: () => void;
  onRequestOtp: () => void;
  onVerifyOtp: () => void;
  onActivate: () => void;
  onBack: () => void;
  onSignIn: () => void;
};

/** Presentation only. Invitation tokens, requests and account activation stay in the route. */
export default function ActivationExperience(p: Props) {
  const { dark } = useAppearance();
  const { isArabic: ar } = useLanguage();
  const insets = useSafeAreaInsets();
  const otpInput = useRef<TextInput>(null);
  const [focused, setFocused] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!p.lastSentAt || p.step !== "verify") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [p.lastSentAt, p.step]);
  const resendWait = p.lastSentAt
    ? Math.max(0, Math.ceil((60000 - (now - p.lastSentAt)) / 1000))
    : 0;
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const ink = dark ? "#FFF1DF" : "#432D1E",
    muted = dark ? "#D6BB98" : "#80654C";
  const canvas = dark ? "#30231B" : "#FFF9EF",
    surface = dark ? "#392A20" : "#FFFAF1",
    border = dark ? "#977047" : "#D9B68B";
  const row = ar ? ("row-reverse" as const) : ("row" as const);
  const align = ar ? ("right" as const) : ("left" as const);
  const mail = p.invitation?.email || "";
  const at = mail.lastIndexOf("@");
  const masked = at > 0 ? mail[0] + "***" + mail.slice(at) : mail;
  const icon: keyof typeof Ionicons.glyphMap =
    p.invitation?.permission === "MANAGE_MECHANICS"
      ? "construct-outline"
      : p.invitation?.permission === "MANAGE_SPARE_PARTS"
        ? "cube-outline"
        : "car-outline";
  const primary = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={p.loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.primary,
        { opacity: p.loading ? 0.6 : pressed ? 0.82 : 1 },
      ]}
    >
      <LinearGradient
        colors={dark ? ["#84582F", "#573A25"] : ["#684327", "#402817"]}
        style={[s.primaryFill, { flexDirection: row }]}
      >
        {p.loading ? (
          <ActivityIndicator color="#FFF1DE" />
        ) : (
          <>
            <Text style={s.primaryLabel}>{label}</Text>
            <Ionicons
              name={ar ? "arrow-back" : "arrow-forward"}
              size={20}
              color="#F1D1A5"
            />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
  const note = (
    label: string,
    name: keyof typeof Ionicons.glyphMap = "information-circle-outline",
  ) => (
    <View
      style={[
        s.note,
        { backgroundColor: dark ? "#493323" : "#F6E6CF", flexDirection: row },
      ]}
    >
      <Ionicons name={name} size={22} color={muted} />
      <Text
        style={{
          flex: 1,
          color: muted,
          fontSize: 11,
          lineHeight: 19,
          textAlign: align,
        }}
      >
        {label}
      </Text>
    </View>
  );
  const title = (label: string, subtitle: string) => (
    <View style={s.heading}>
      <EditorialTitle
        accent
        style={{ fontSize: 32, lineHeight: 43, color: ink, textAlign: align }}
      >
        {label}
      </EditorialTitle>
      <Text
        style={{
          fontSize: 13,
          lineHeight: 22,
          color: muted,
          textAlign: align,
          marginTop: 8,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
  const passwordField = (confirm = false) => {
    const id = confirm ? "confirm" : "password";
    const label = confirm
      ? text("Confirm password", "تأكيد كلمة المرور")
      : text("New password", "كلمة المرور الجديدة");
    return (
      <View style={{ marginTop: 17 }}>
        <Text
          style={{
            fontSize: 12,
            lineHeight: 21,
            color: muted,
            textAlign: align,
            marginBottom: 7,
          }}
        >
          {label}
        </Text>
        <View
          style={[
            s.passwordField,
            {
              backgroundColor: surface,
              borderColor: focused === id ? "#B17E43" : border,
              flexDirection: row,
            },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={19} color={muted} />
          <TextInput
            accessibilityLabel={label}
            value={confirm ? p.confirmPassword : p.password}
            onChangeText={confirm ? p.onConfirmChange : p.onPasswordChange}
            onFocus={() => setFocused(id)}
            onBlur={() => setFocused("")}
            editable={!p.loading}
            secureTextEntry={!p.showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            placeholder={label}
            placeholderTextColor={muted}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 53,
              color: ink,
              fontSize: 14,
              textAlign: align,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              p.showPassword
                ? text("Hide passwords", "إخفاء كلمات المرور")
                : text("Show passwords", "إظهار كلمات المرور")
            }
            onPress={p.onTogglePassword}
            style={s.eye}
          >
            <Ionicons
              name={p.showPassword ? "eye-off-outline" : "eye-outline"}
              size={21}
              color={muted}
            />
          </Pressable>
        </View>
      </View>
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: canvas }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom }]}
        >
          <View style={[s.frame, { backgroundColor: canvas }]}>
            <CanvasFill />
            <View
              style={[
                s.top,
                { paddingTop: insets.top + 12, flexDirection: row },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("Back to roles", "العودة للأدوار")}
                onPress={p.onBack}
                style={s.back}
              >
                <Ionicons
                  name={ar ? "arrow-forward" : "arrow-back"}
                  size={23}
                  color={ink}
                />
              </Pressable>
              <View style={{ flex: 1, minWidth: 68 }}>
                <BrandWordmark
                  style={{
                    fontSize: 15,
                    letterSpacing: 2.1,
                    color: ink,
                    fontWeight: "600",
                  }}
                />
                <Text
                  style={{
                    fontSize: 6,
                    lineHeight: 13,
                    letterSpacing: 1.3,
                    color: muted,
                  }}
                >
                  SMART AUTO CARE
                </Text>
              </View>
              <LanguageSwitch compact light unified />
            </View>
            {p.checking ? (
              <View style={s.loading}>
                <ActivityIndicator size="large" color="#A77845" />
                <Text
                  style={{
                    color: muted,
                    lineHeight: 24,
                    marginTop: 15,
                    textAlign: "center",
                  }}
                >
                  {text("Verifying your invitation…", "جارٍ التحقق من الدعوة…")}
                </Text>
              </View>
            ) : !p.invitation ? (
              <View style={s.panel}>
                <View
                  style={[
                    s.medallion,
                    { backgroundColor: dark ? "#624329" : "#F0D5AF" },
                  ]}
                >
                  <Ionicons
                    name="mail-unread-outline"
                    size={40}
                    color={muted}
                  />
                </View>
                {title(
                  text("Invitation unavailable", "الدعوة غير متاحة"),
                  text(
                    "This invitation could not be opened.",
                    "تعذّر فتح هذه الدعوة.",
                  ),
                )}
                {note(
                  p.verifyError ||
                    text(
                      "The invitation may have expired or been revoked. Contact your Super Admin for a new invitation.",
                      "قد تكون الدعوة منتهية أو ملغاة. اطلب دعوة جديدة من المسؤول الأعلى.",
                    ),
                )}
                {primary(
                  text("Back to sign in", "العودة لتسجيل الدخول"),
                  p.onSignIn,
                )}
              </View>
            ) : (
              <>
                {p.step === "request" && (
                  <>
                    <ImageBackground
                      source={require("../../assets/images/motexa-admin-coastal-hero.png")}
                      style={s.inviteHero}
                      resizeMode="cover"
                    >
                      <View
                        style={[
                          s.heroPaper,
                          {
                            backgroundColor: canvas,
                            [ar
                              ? "borderBottomLeftRadius"
                              : "borderBottomRightRadius"]: 115,
                            [ar ? "right" : "left"]: 0,
                          },
                        ]}
                      >
                        <EditorialTitle
                          accent
                          style={{
                            fontSize: 37,
                            lineHeight: 48,
                            color: ink,
                            textAlign: align,
                          }}
                        >
                          {text("You are\ninvited.", "أنت مدعو\nللانضمام.")}
                        </EditorialTitle>
                        <Text
                          style={{
                            fontSize: 14,
                            lineHeight: 23,
                            color: muted,
                            textAlign: align,
                            marginTop: 10,
                          }}
                        >
                          {text(
                            "Join the MOTEXA\nadmin team.",
                            "انضم إلى فريق\nإدارة MOTEXA.",
                          )}
                        </Text>
                        <Text
                          style={{
                            fontSize: 8,
                            lineHeight: 17,
                            letterSpacing: 1.4,
                            color: muted,
                            marginTop: 24,
                            textAlign: align,
                          }}
                        >
                          {text(
                            "PEOPLE. VEHICLES.\nSERVICES. ALWAYS AHEAD.",
                            "الأشخاص. المركبات.\nالخدمات. دائمًا للأمام.",
                          )}
                        </Text>
                      </View>
                    </ImageBackground>
                    <View style={[s.requestPanel, { backgroundColor: canvas }]}>
                      <View
                        style={[
                          s.mailBadge,
                          {
                            backgroundColor: dark ? "#795130" : "#EBC89A",
                            borderColor: canvas,
                          },
                        ]}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={29}
                          color={dark ? "#FFF0D9" : "#70431F"}
                        />
                      </View>
                      <EditorialTitle
                        accent
                        style={{
                          fontSize: 27,
                          lineHeight: 38,
                          color: ink,
                          textAlign: "center",
                          marginTop: 16,
                        }}
                      >
                        {p.invitation.fullName}
                      </EditorialTitle>
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 22,
                          color: muted,
                          textAlign: "center",
                          writingDirection: "ltr",
                          marginTop: 4,
                        }}
                      >
                        {masked}
                      </Text>
                      <View
                        style={[
                          s.departmentPill,
                          {
                            backgroundColor: dark ? "#533A26" : "#F2DDC0",
                            flexDirection: row,
                          },
                        ]}
                      >
                        <Ionicons name={icon} size={19} color={muted} />
                        <Text
                          style={{
                            color: ink,
                            fontSize: 12,
                            lineHeight: 21,
                            flexShrink: 1,
                            textAlign: "center",
                          }}
                        >
                          {p.departmentLabel}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          lineHeight: 21,
                          color: muted,
                          textAlign: "center",
                        }}
                      >
                        {text(
                          "Invited by your Super Admin",
                          "بدعوة من المسؤول الأعلى",
                        )}
                      </Text>
                      <View style={[s.rule, { backgroundColor: border }]} />
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 23,
                          color: muted,
                          textAlign: "center",
                        }}
                      >
                        {text(
                          "Verify your email to activate\nyour administrator account.",
                          "تحقق من بريدك الإلكتروني\nلتفعيل حساب الإدارة.",
                        )}
                      </Text>
                      {primary(
                        text("Send verification code", "إرسال رمز التحقق"),
                        p.onRequestOtp,
                      )}
                      <View style={[s.expiry, { flexDirection: row }]}>
                        <Ionicons name="time-outline" size={18} color={muted} />
                        <Text
                          style={{ fontSize: 11, lineHeight: 19, color: muted }}
                        >
                          {text(
                            "Invitations are valid for 24 hours.",
                            "الدعوات صالحة لمدة 24 ساعة.",
                          )}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
                {p.step === "verify" && (
                  <View
                    style={[
                      s.panel,
                      s.curvedPanel,
                      { backgroundColor: canvas },
                    ]}
                  >
                    {title(
                      text("Check your email", "تحقق من بريدك"),
                      text(
                        "Enter the 6-digit code sent to",
                        "أدخل الرمز المكوّن من 6 أرقام المرسل إلى",
                      ),
                    )}
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#AC7540",
                        textAlign: align,
                        writingDirection: "ltr",
                        lineHeight: 23,
                        marginTop: -16,
                      }}
                    >
                      {masked}
                    </Text>
                    <Image
                      source={require("../../assets/images/motexa-activation-envelope.png")}
                      accessible={false}
                      resizeMode="contain"
                      style={s.envelope}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={text(
                        "Enter verification code",
                        "إدخال رمز التحقق",
                      )}
                      onPress={() => otpInput.current?.focus()}
                      style={s.otpArea}
                    >
                      <View pointerEvents="none" style={s.otpCells}>
                        {Array.from({ length: 6 }, (_, i) => (
                          <View
                            key={i}
                            style={[
                              s.otpCell,
                              {
                                backgroundColor: surface,
                                borderColor:
                                  focused === "otp" &&
                                  i === Math.min(p.otp.length, 5)
                                    ? "#AC7540"
                                    : border,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: ink,
                                fontSize: 24,
                                lineHeight: 34,
                              }}
                            >
                              {p.otp[i] || ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <TextInput
                        ref={otpInput}
                        accessibilityLabel={text(
                          "Six-digit verification code",
                          "رمز التحقق من ستة أرقام",
                        )}
                        value={p.otp}
                        onChangeText={(v) =>
                          p.onOtpChange(v.replace(/\D/g, "").slice(0, 6))
                        }
                        editable={!p.loading}
                        maxLength={6}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        autoCorrect={false}
                        autoCapitalize="none"
                        caretHidden
                        onFocus={() => setFocused("otp")}
                        onBlur={() => setFocused("")}
                        style={s.otpNative}
                      />
                    </Pressable>
                    <Text style={[s.centerNote, { color: muted }]}>
                      {text(
                        "Code valid for 5 minutes.",
                        "صلاحية الرمز 5 دقائق.",
                      )}
                    </Text>
                    {primary(
                      text("Verify code", "التحقق من الرمز"),
                      p.onVerifyOtp,
                    )}
                    <View style={[s.resendCaption, { flexDirection: row }]}>
                      <View
                        style={[s.shortRule, { backgroundColor: border }]}
                      />
                      <Text style={{ fontSize: 11, color: muted }}>
                        {text("Didn't receive the code?", "لم يصلك الرمز؟")}
                      </Text>
                      <View
                        style={[s.shortRule, { backgroundColor: border }]}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={p.loading || resendWait > 0}
                      onPress={p.onRequestOtp}
                      style={({ pressed }) => [
                        s.outline,
                        {
                          borderColor: border,
                          flexDirection: row,
                          opacity:
                            p.loading || resendWait > 0
                              ? 0.55
                              : pressed
                                ? 0.8
                                : 1,
                        },
                      ]}
                    >
                      <Ionicons name="refresh-outline" size={21} color={ink} />
                      <Text
                        style={{ color: ink, fontSize: 13, lineHeight: 22 }}
                      >
                        {text("Resend code", "إعادة إرسال الرمز")}
                        {resendWait > 0 ? " (" + resendWait + "s)" : ""}
                      </Text>
                    </Pressable>
                  </View>
                )}
                {p.step === "password" && (
                  <View
                    style={[
                      s.panel,
                      s.curvedPanel,
                      { backgroundColor: canvas },
                    ]}
                  >
                    {title(
                      text("Create your password", "أنشئ كلمة المرور"),
                      text(
                        "Secure your administrator account.",
                        "احمِ حساب الإدارة الخاص بك.",
                      ),
                    )}
                    <View
                      style={[
                        s.medallion,
                        { backgroundColor: dark ? "#624329" : "#F0D5AF" },
                      ]}
                    >
                      <Ionicons
                        name="key"
                        size={46}
                        color={dark ? "#F5D3A5" : "#754619"}
                      />
                    </View>
                    {passwordField()}
                    {passwordField(true)}
                    <Text
                      style={[
                        s.centerNote,
                        {
                          color: muted,
                          fontSize: 11,
                          lineHeight: 20,
                          marginTop: 15,
                        },
                      ]}
                    >
                      {text(
                        "At least 12 characters, uppercase and lowercase letters, a number and a symbol.",
                        "12 حرفًا على الأقل، وحرف كبير وصغير، ورقم ورمز خاص.",
                      )}
                    </Text>
                    {primary(
                      text("Activate account", "تفعيل الحساب"),
                      p.onActivate,
                    )}
                    {note(
                      text(
                        "Your department access is assigned by the Super Admin.",
                        "يحدد المسؤول الأعلى القسم والصلاحية المخصصة لك.",
                      ),
                      "people-outline",
                    )}
                  </View>
                )}
                {p.step === "complete" && (
                  <>
                    <ManagementBanner index={2} style={s.completeHero}>
                      <LinearGradient
                        colors={["transparent", "rgba(35,23,14,.5)"]}
                        style={StyleSheet.absoluteFill}
                      />
                    </ManagementBanner>
                    <View
                      style={[
                        s.panel,
                        s.successPanel,
                        { backgroundColor: canvas },
                      ]}
                    >
                      <View style={s.successBadge}>
                        <Ionicons name="checkmark" size={53} color="#FFF2DD" />
                      </View>
                      <EditorialTitle
                        accent
                        style={{
                          fontSize: 33,
                          lineHeight: 44,
                          color: ink,
                          textAlign: "center",
                          marginTop: 27,
                        }}
                      >
                        {text("Account activated!", "تم تفعيل الحساب!")}
                      </EditorialTitle>
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 23,
                          color: muted,
                          textAlign: "center",
                          marginTop: 9,
                        }}
                      >
                        {text(
                          "Your administrator account is ready.",
                          "حساب الإدارة الخاص بك أصبح جاهزًا.",
                        )}
                      </Text>
                      <View
                        style={[
                          s.assignedCard,
                          {
                            backgroundColor: surface,
                            borderColor: border,
                            flexDirection: row,
                          },
                        ]}
                      >
                        <View
                          style={[
                            s.smallMedallion,
                            { backgroundColor: dark ? "#624329" : "#F0D5AF" },
                          ]}
                        >
                          <Ionicons name={icon} size={26} color={muted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <EditorialTitle
                            accent
                            style={{
                              fontSize: 20,
                              lineHeight: 28,
                              color: ink,
                              textAlign: align,
                            }}
                          >
                            {p.departmentLabel}
                          </EditorialTitle>
                          <Text
                            style={{
                              fontSize: 11,
                              lineHeight: 19,
                              color: muted,
                              textAlign: align,
                            }}
                          >
                            {text(
                              "Your assigned department",
                              "القسم المخصص لك",
                            )}
                          </Text>
                        </View>
                      </View>
                      {primary(
                        text("Go to sign in", "الانتقال لتسجيل الدخول"),
                        p.onSignIn,
                      )}
                    </View>
                  </>
                )}
                <ImageBackground
                  accessible={false}
                  source={require("../../assets/images/motexa-admin-coastal-hero.png")}
                  resizeMode="cover"
                  style={[
                    s.footerPhoto,
                    {
                      height:
                        p.step === "request" || p.step === "complete"
                          ? 170
                          : 125,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["rgba(35,23,14,.1)", "rgba(35,23,14,.72)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <BrandWordmark style={s.footerBrand} size={17} rule={false} />
                  <Text style={s.footerCaption}>
                    {text(
                      "PEOPLE. VEHICLES.\nSERVICES. ALWAYS AHEAD.",
                      "الأشخاص. المركبات.\nالخدمات. دائمًا للأمام.",
                    )}
                  </Text>
                </ImageBackground>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1 },
  frame: { width: "100%", maxWidth: 560, alignSelf: "center", flex: 1 },
  top: {
    paddingHorizontal: 16,
    paddingBottom: 15,
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  back: {
    width: 34,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: { paddingVertical: 90, paddingHorizontal: 25 },
  inviteHero: { height: 300 },
  heroPaper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "69%",
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 24,
  },
  panel: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 32 },
  requestPanel: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 26,
    marginTop: -27,
    borderTopLeftRadius: 53,
    borderTopRightRadius: 53,
    borderBottomLeftRadius: 52,
    borderBottomRightRadius: 52,
    zIndex: 1,
  },
  mailBadge: {
    alignSelf: "center",
    width: 65,
    height: 65,
    borderRadius: 33,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -54,
  },
  departmentPill: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 23,
    gap: 8,
    alignItems: "center",
    marginTop: 15,
    marginBottom: 10,
  },
  rule: { height: 1, marginVertical: 19 },
  expiry: {
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 17,
    flexWrap: "wrap",
  },
  heading: { marginTop: 11, marginBottom: 22 },
  primary: { borderRadius: 26, overflow: "hidden", marginTop: 22 },
  primaryFill: {
    minHeight: 53,
    paddingVertical: 13,
    paddingHorizontal: 19,
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    color: "#FFF1DE",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    flexShrink: 1,
  },
  curvedPanel: {
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    zIndex: 1,
  },
  envelope: {
    width: 190,
    height: 162,
    alignSelf: "center",
    marginTop: 13,
    marginBottom: 18,
  },
  otpArea: { height: 61, position: "relative" },
  otpCells: { flexDirection: "row", gap: 7, flex: 1 },
  otpCell: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  otpNative: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.015,
    fontSize: 1,
    color: "transparent",
  },
  centerNote: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 21,
    marginTop: 14,
  },
  resendCaption: {
    alignItems: "center",
    gap: 9,
    marginTop: 23,
    marginBottom: 15,
  },
  shortRule: { flex: 1, height: 1 },
  outline: {
    borderWidth: 1,
    borderRadius: 25,
    minHeight: 51,
    padding: 12,
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  medallion: {
    width: 96,
    height: 96,
    borderRadius: 49,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  passwordField: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 15,
    gap: 8,
    alignItems: "center",
  },
  eye: {
    width: 39,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    padding: 14,
    borderRadius: 23,
    gap: 10,
    alignItems: "center",
    marginTop: 21,
  },
  completeHero: { height: 235 },
  successPanel: {
    borderTopLeftRadius: 85,
    borderTopRightRadius: 85,
    marginTop: -22,
    zIndex: 1,
    paddingTop: 22,
  },
  successBadge: {
    alignSelf: "center",
    width: 92,
    height: 92,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: "#E8C38E",
    backgroundColor: "#82552B",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -65,
  },
  assignedCard: {
    borderWidth: 1,
    borderRadius: 25,
    padding: 15,
    gap: 12,
    alignItems: "center",
    marginTop: 24,
  },
  smallMedallion: {
    width: 47,
    height: 47,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  footerPhoto: {
    marginTop: -23,
    paddingHorizontal: 23,
    paddingBottom: 18,
    paddingTop: 42,
    justifyContent: "flex-end",
  },
  footerBrand: { fontSize: 20, letterSpacing: 3, color: "#FFF2DD" },
  footerCaption: {
    fontSize: 7,
    lineHeight: 13,
    letterSpacing: 1.5,
    color: "#F4DEC0",
    marginTop: 5,
  },
});
