import Svg, { Path } from "react-native-svg";
import { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  ImageBackground,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "./MotexaVisual";
import BrandWordmark from "./BrandWordmark";
import LanguageSwitch from "./LanguageSwitch";
import { CanvasFill, PanelFill } from "./BrandSurfaces";
import {
  MechanicPage,
  MechanicProgress,
  MechanicCard,
  MechanicButton,
  MechanicNote,
  useMechanicTheme,
} from "./MechanicUI";
import { mechanicApi } from "./mechanic-api";

type FieldProps = TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  trailing?: React.ReactNode;
};
function RegistrationField({ label, icon, trailing, ...props }: FieldProps) {
  const m = useMechanicTheme(),
    [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6, marginBottom: 13 }}>
      <Text
        style={{
          fontSize: 12,
          lineHeight: 19,
          fontWeight: "600",
          color: m.ink,
          textAlign: m.align,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: m.row,
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: focused ? "#B18350" : m.border,
          backgroundColor: m.dark ? "#30241C" : "#FFFCF7",
        }}
      >
        <Ionicons name={icon} size={18} color={m.muted} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={m.dark ? "#AD9476" : "#A18D76"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              flex: 1,
              minWidth: 0,
              minHeight: 49,
              paddingVertical: 11,
              fontSize: 13,
              lineHeight: 22,
              color: m.ink,
              textAlign: m.align,
            },
            props.style,
          ]}
        />
        {trailing}
      </View>
    </View>
  );
}
export default function MechanicRegistration({
  previewOnly = false,
  onPreviewStep,
}: { previewOnly?: boolean; onPreviewStep?: (step: number) => void } = {}) {
  const m = useMechanicTheme(),
    insets = useSafeAreaInsets(),
    [step, setStep] = useState<"account" | "done">("account"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [fullName, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phoneNumber, setPhone] = useState(""),
    [city, setCity] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [accept, setAccept] = useState(false),
    [show, setShow] = useState(false),
    [showConfirm, setShowConfirm] = useState(false),
    [terms, setTerms] = useState(false),
    [cities, setCities] = useState(false);
  const signIn = () =>
    router.replace({
      pathname: "/auth/login",
      params: { selectedRole: "mechanic" },
    });
  async function register() {
    if (previewOnly) {
      onPreviewStep?.(2);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (password !== confirm)
        throw Error(
          m.t("Passwords do not match.", "كلمتا المرور غير متطابقتين."),
        );
      if (!accept)
        throw Error(
          m.t(
            "Accept the registration terms first.",
            "وافق على شروط التسجيل أولًا.",
          ),
        );
      await mechanicApi(
        "/api/auth/mechanic/register",
        "POST",
        {
          fullName,
          email: email.trim(),
          phoneNumber,
          city,
          password,
          acceptTerms: accept,
          role: "MECHANIC",
        },
        true,
      );
      setPassword("");
      setConfirm("");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (step === "done")
    return (
      <MechanicPage
        photo
        title={m.t("Your account is created", "تم إنشاء حسابك")}
      >
        <MechanicCard>
          <Text
            style={{
              fontSize: 17,
              lineHeight: 28,
              fontWeight: "600",
              color: m.ink,
              textAlign: m.align,
            }}
          >
            {m.t(
              "Continue your professional application",
              "استكمل طلبك المهني",
            )}
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 24,
              color: m.muted,
              textAlign: m.align,
            }}
          >
            {m.t(
              "Sign in, complete your profile and upload your documents. The Mechanics Admin reviews your application and makes the final decision.",
              "سجّل الدخول، واستكمل ملفك وارفع وثائقك. يراجع أدمن الميكانيكي طلبك ويتخذ القرار النهائي.",
            )}
          </Text>
          <MechanicButton
            label={m.t("Sign in and continue", "تسجيل الدخول والمتابعة")}
            onPress={signIn}
          />
        </MechanicCard>
      </MechanicPage>
    );
  const eye = (visible: boolean, toggle: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        visible
          ? m.t("Hide password", "إخفاء كلمة المرور")
          : m.t("Show password", "إظهار كلمة المرور")
      }
      onPress={toggle}
      style={{
        minWidth: 32,
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Ionicons
        name={visible ? "eye-off-outline" : "eye-outline"}
        size={19}
        color={m.muted}
      />
    </Pressable>
  );
  return (
    <View style={{ flex: 1 }}>
      <CanvasFill />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
            paddingBottom: insets.bottom + 26,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              direction: "ltr",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 16,
              paddingTop: insets.top + 6,
              paddingBottom: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.t(
                "Back to sign in",
                "العودة لتسجيل الدخول",
              )}
              disabled={busy}
              onPress={signIn}
              style={{ width: 30, minHeight: 42, justifyContent: "center" }}
            >
              <Ionicons
                name={m.ar ? "arrow-forward" : "arrow-back"}
                size={21}
                color={m.ink}
              />
            </Pressable>
            <BrandWordmark size={18} style={{ flex: 1 }} />
            <LanguageSwitch compact light unified />
          </View>
          <View style={{ paddingHorizontal: 30, paddingBottom: 9 }}>
            <MechanicProgress current={1} />
          </View>
          {previewOnly && (
            <View style={{ paddingHorizontal: 18 }}>
              <MechanicNote>
                {m.t(
                  "Preview only · No account will be created and nothing is sent to the database.",
                  "معاينة فقط · لن يتم إنشاء حساب أو إرسال أي بيانات لقاعدة البيانات.",
                )}
              </MechanicNote>
            </View>
          )}
          <ImageBackground
            accessible={false}
            source={require("../../assets/images/motexa-mechanic-registration-hero.png")}
            resizeMode="cover"
            style={{
              width: "100%",
              height: 194,
              overflow: "hidden",
              backgroundColor: "#433020",
            }}
          >
            <LinearGradient
              colors={["rgba(36,22,12,0)", "rgba(36,22,12,.1)"]}
              style={StyleSheet.absoluteFill}
            />
            <Svg
              pointerEvents="none"
              accessible={false}
              width="100%"
              height={28}
              viewBox="0 0 390 28"
              preserveAspectRatio="none"
              style={{ position: "absolute", top: -1, left: 0 }}
            >
              <Path
                d="M0 0 H390 V24 C304 11 226 0 149 4 C80 5 30 10 0 22 Z"
                fill={m.dark ? "#30231B" : "#FFF9EF"}
              />
            </Svg>
            <Svg
              pointerEvents="none"
              accessible={false}
              width="100%"
              height={44}
              viewBox="0 0 390 44"
              preserveAspectRatio="none"
              style={{ position: "absolute", bottom: -1, left: 0 }}
            >
              <Path
                d="M0 18 C65 0 121 2 190 10 C264 20 323 33 390 20 L390 44 L0 44 Z"
                fill={m.dark ? "#35291F" : "#FFFAF1"}
              />
            </Svg>
          </ImageBackground>
          <View
            style={{
              marginHorizontal: 15,
              marginTop: -1,
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: m.border,
              padding: 18,
              backgroundColor: m.surface,
            }}
          >
            <PanelFill radius={28} />
            <View
              style={{
                flexDirection: m.row,
                alignItems: "center",
                gap: 7,
                marginBottom: 5,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  flex: 1,
                  fontSize: 25,
                  lineHeight: 34,
                  fontWeight: "600",
                  color: m.ink,
                  textAlign: m.align,
                }}
              >
                {m.t("Create your account", "إنشاء حسابك")}
              </Text>
              <Ionicons name="construct-outline" size={21} color={m.muted} />
            </View>
            <Text
              style={{
                fontSize: 12,
                lineHeight: 22,
                color: m.muted,
                textAlign: m.align,
                marginBottom: 20,
              }}
            >
              {m.t("Join MOTEXA as a mechanic.", "انضم إلى MOTEXA كميكانيكي.")}
            </Text>
            {error && <MechanicNote error>{error}</MechanicNote>}
            <RegistrationField
              label={m.t("Full name", "الاسم الكامل")}
              icon="person-outline"
              value={fullName}
              placeholder={m.t("Enter your full name", "أدخل اسمك الكامل")}
              onChangeText={setName}
              maxLength={120}
              autoComplete="name"
              editable={!busy}
            />
            <RegistrationField
              label={m.t("Email address", "البريد الإلكتروني")}
              icon="mail-outline"
              value={email}
              placeholder={m.t("name@example.com", "name@example.com")}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
            />
            <RegistrationField
              label={m.t("Phone number", "رقم الهاتف")}
              icon="call-outline"
              value={phoneNumber}
              placeholder="+970 59 123 4567"
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={24}
              autoComplete="tel"
              editable={!busy}
            />
            <RegistrationField
              label={m.t("City", "المدينة")}
              icon="location-outline"
              value={city}
              placeholder={m.t(
                "Choose or enter your city",
                "اختر مدينتك أو أدخلها",
              )}
              onChangeText={setCity}
              maxLength={80}
              editable={!busy}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={m.t("Choose city", "اختيار المدينة")}
                  disabled={busy}
                  onPress={() => setCities(true)}
                  style={{
                    minWidth: 32,
                    minHeight: 44,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="chevron-down" size={17} color={m.muted} />
                </Pressable>
              }
            />
            <RegistrationField
              label={m.t("Password", "كلمة المرور")}
              icon="lock-closed-outline"
              value={password}
              placeholder={m.t(
                "Create a strong password",
                "أنشئ كلمة مرور قوية",
              )}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              maxLength={128}
              editable={!busy}
              trailing={eye(show, () => setShow((v) => !v))}
            />
            <Text
              style={{
                fontSize: 10,
                lineHeight: 18,
                color: m.muted,
                textAlign: m.align,
                marginTop: -4,
                marginBottom: 14,
              }}
            >
              {m.t(
                "8–128 characters, uppercase, lowercase, number & symbol.",
                "8–128 حرفًا، حرف إنجليزي كبير وصغير ورقم ورمز.",
              )}
            </Text>
            <RegistrationField
              label={m.t("Confirm password", "تأكيد كلمة المرور")}
              icon="lock-closed-outline"
              value={confirm}
              placeholder={m.t(
                "Confirm your password",
                "أعد إدخال كلمة المرور",
              )}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
              editable={!busy}
              trailing={eye(showConfirm, () => setShowConfirm((v) => !v))}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={m.t(
                "I agree to these registration and document privacy terms.",
                "أوافق على شروط التسجيل وخصوصية الوثائق الموضحة أعلاه.",
              )}
              accessibilityState={{ checked: accept, disabled: busy }}
              aria-checked={accept}
              disabled={busy}
              onPress={() => setAccept((v) => !v)}
              style={{
                flexDirection: m.row,
                gap: 10,
                alignItems: "center",
                minHeight: 44,
                marginTop: 2,
              }}
            >
              <Ionicons
                name={accept ? "checkbox" : "square-outline"}
                size={23}
                color="#80542F"
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 11,
                  lineHeight: 20,
                  color: m.ink,
                  textAlign: m.align,
                }}
              >
                {m.t(
                  "I agree to the registration and privacy terms.",
                  "أوافق على شروط التسجيل والخصوصية.",
                )}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.t(
                "Read registration terms",
                "قراءة شروط التسجيل",
              )}
              onPress={() => setTerms(true)}
              style={{
                minHeight: 36,
                justifyContent: "center",
                alignSelf: m.ar ? "flex-end" : "flex-start",
                marginBottom: 9,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  lineHeight: 19,
                  color: m.muted,
                  textDecorationLine: "underline",
                }}
              >
                {m.t("Read registration terms", "قراءة شروط التسجيل")}
              </Text>
            </Pressable>
            <MechanicButton
              label={
                previewOnly
                  ? m.t("Preview next step", "معاينة الخطوة التالية")
                  : m.t("Create account", "إنشاء الحساب")
              }
              onPress={() => void register()}
              busy={busy}
            />
            <View
              style={{
                flexDirection: m.row,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                marginTop: 13,
                flexWrap: "wrap",
              }}
            >
              <Text style={{ fontSize: 11, lineHeight: 21, color: m.muted }}>
                {m.t("Already have an account?", "لديك حساب مسبقًا؟")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={m.t("Sign in", "تسجيل الدخول")}
                onPress={signIn}
                disabled={busy}
                style={{
                  minHeight: 40,
                  paddingHorizontal: 5,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: m.ink,
                    textDecorationLine: "underline",
                  }}
                >
                  {m.t("Sign in", "تسجيل الدخول")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={terms || cities}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setTerms(false);
          setCities(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#211A1570",
            justifyContent: "flex-end",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              maxHeight: "75%",
              padding: 22,
              paddingBottom: Math.max(insets.bottom, 20),
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: m.surface,
              gap: 15,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                lineHeight: 29,
                fontWeight: "600",
                color: m.ink,
                textAlign: m.align,
              }}
            >
              {cities
                ? m.t("Choose city", "اختر المدينة")
                : m.t("Registration & privacy", "التسجيل والخصوصية")}
            </Text>
            <ScrollView>
              {cities ? (
                [
                  ["Ramallah", "رام الله"],
                  ["Al-Bireh", "البيرة"],
                  ["Jerusalem", "القدس"],
                  ["Nablus", "نابلس"],
                  ["Hebron", "الخليل"],
                  ["Bethlehem", "بيت لحم"],
                  ["Jenin", "جنين"],
                  ["Tulkarm", "طولكرم"],
                  ["Qalqilya", "قلقيلية"],
                  ["Jericho", "أريحا"],
                  ["Salfit", "سلفيت"],
                  ["Tubas", "طوباس"],
                  ["Gaza", "غزة"],
                ].map(([en, ar]) => (
                  <Pressable
                    key={en}
                    accessibilityRole="button"
                    onPress={() => {
                      setCity(m.t(en, ar));
                      setCities(false);
                    }}
                    style={{
                      minHeight: 46,
                      justifyContent: "center",
                      borderBottomWidth: 1,
                      borderBottomColor: m.border,
                    }}
                  >
                    <Text
                      style={{ fontSize: 14, color: m.ink, textAlign: m.align }}
                    >
                      {m.t(en, ar)}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 25,
                    color: m.muted,
                    textAlign: m.align,
                  }}
                >
                  {m.t(
                    "Provide accurate account and professional information. Account creation only allows you to complete an application; it does not approve your mechanic services. Identity documents are private to you and authorized MOTEXA reviewers. The Mechanics Admin reviews your application, may request completion or an interview, and makes the professional approval decision.",
                    "قدّم معلومات صحيحة عن حسابك وخبرتك. إنشاء الحساب يتيح استكمال طلبك فقط، ولا يعتمد خدماتك كميكانيكي. وثائق الهوية خاصة بك وبمراجعي MOTEXA المخوّلين. يراجع أدمن الميكانيكي طلبك، وقد يطلب استكمالًا أو مقابلة، وهو صاحب قرار الاعتماد المهني.",
                  )}
                </Text>
              )}
            </ScrollView>
            <MechanicButton
              secondary
              label={m.t("Close", "إغلاق")}
              onPress={() => {
                setTerms(false);
                setCities(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
