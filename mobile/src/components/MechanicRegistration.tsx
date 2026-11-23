import MechanicStageSurface from './MechanicStageSurface';
import {MechanicFormSection} from './MechanicFormSection';
import MechanicJourneyHeader from './MechanicJourneyHeader';
import Pressable from "./MotionPressable";
import TextInput from "./PremiumTextInput";
import { useState } from "react";
import {
  View,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text } from "./MotexaVisual";
import BrandHeader from "./BrandHeader";

import { CanvasFill } from "./BrandSurfaces";
import {
  MechanicPage,
  MechanicCard,
  MechanicButton,
  MechanicNote,
  useMechanicTheme,
} from "./MechanicUI";
import { mechanicApi } from "./mechanic-api";
import * as Store from './SessionStore';

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
          fontSize: 13,
          lineHeight: 22,
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
              fontSize: 14,
              lineHeight: 23,
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
      // Creation completes step one only. Authenticate through the existing endpoint,
      // then continue the draft without granting any professional approval.
      try {
        const session = await mechanicApi<{accessToken?:string;user?:{role:string;status:string}}>(
          '/api/auth/login','POST',{email:email.trim().toLowerCase(),password},true,
        );
        if (!session.accessToken || session.user?.role !== 'MECHANIC' || session.user.status !== 'ACTIVE')
          throw Error('Unexpected mechanic session.');
        await Store.setItemAsync('motexa_access_token',session.accessToken);
        setPassword('');
        setConfirm('');
        router.replace('/mechanic');
      } catch {
        // The account already exists: offer sign-in rather than resubmitting registration.
        setPassword('');
        setConfirm('');
        setStep('done');
      }
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
        title={m.t("Continue your application", "استكمل طلبك")}
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
          <View style={{paddingTop:insets.top+6}}><BrandHeader onBack={signIn} backDisabled={busy} backLabel={m.t('Back to sign in','العودة لتسجيل الدخول')}/></View>
          <View style={{paddingHorizontal:18}}><MechanicJourneyHeader title={m.t('Your expertise starts here.','هنا تبدأ رحلتك المهنية.')} subtitle={m.t('Create your account. Build a profile people can trust.','أنشئ حسابك، وابنِ ملفًا مهنيًا يستحق الثقة.')} current={1} stepsDisabled={busy} canSelectStep={value=>previewOnly||value===1} onStep={value=>{if(value===1)return;if(previewOnly)onPreviewStep?.(value);else router.push({pathname:'/auth/mechanic-preview',params:{stage:String(value)}});}}/>{<MechanicNote>{previewOnly?m.t('Preview only · No account will be created.','معاينة فقط · لن يتم إنشاء حساب.'):m.t('Create your account to begin your professional application.','أنشئ حسابك لبدء طلب الاعتماد المهني.')}</MechanicNote>}</View>
          <View style={{marginHorizontal:15}}><MechanicStageSurface stage={1}><View>
            <MechanicFormSection icon="person-outline" number="01" title={m.t('Create your account','إنشاء حسابك')} description={m.t('Your identity and contact details, together in one place.','هويتك ومعلومات التواصل، في مكان واحد.')}/>
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
            <MechanicFormSection icon="lock-closed-outline" number="02" title={m.t('Protect your account','احمِ حسابك')} description={m.t('Use a strong password you do not use elsewhere.','اختر كلمة مرور قوية لا تستخدمها في حساب آخر.')}/>
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
          </View></MechanicStageSurface></View>
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
