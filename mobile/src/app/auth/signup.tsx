import {OwnerStudioScene} from '../../components/OwnerAuthHero';
import {useFonts} from 'expo-font';
import {mechanicApi,MechanicApiError} from '../../components/mechanic-api';

import TextInput from "../../components/PremiumTextInput";
import {
  MechanicPage,
  MechanicCard,
  MechanicButton,
  useMechanicTheme,
} from "../../components/MechanicUI";
import MechanicRegistration from "../../components/MechanicRegistration";
import BrandHeader from "../../components/BrandHeader";
import BrandMonogram from "../../components/BrandMonogram";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditorialTitle } from "../../components/PremiumUI";
import {
  useAppearance,
  useAppearanceStyles,
} from "../../components/Appearance";
import { Text, useReducedMotion } from "../../components/MotexaVisual";
import { palette } from "../../components/DesignTokens";
import { CanvasFill } from "../../components/BrandSurfaces";


import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useLanguage } from "../../i18n/LanguageContext";

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export default function SignUpScreen() {
  const { selectedRole } = useLocalSearchParams<{ selectedRole?: string }>();
  const ready = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  if (!ready)
    return (
      <View style={{ flex: 1 }}>
        <CanvasFill />
      </View>
    );
  if (!selectedRole) return <ChooseRegistrationRole />;

  return selectedRole === "mechanic" ? (
    <MechanicRegistration />
  ) : (
    <ExistingSignUpScreen />
  );
}
function ChooseRegistrationRole() {
  const m = useMechanicTheme();
  return (
    <MechanicPage
      back
      title={m.t("Create an account", "إنشاء حساب جديد")}
      subtitle={m.t(
        "Choose the account you want to create.",
        "اختر نوع الحساب الذي تريد إنشاءه.",
      )}
    >
      <MechanicCard>
        {[
          ["customer", "Car owner", "مالك مركبة"],
          ["mechanic", "Mechanic", "ميكانيكي"],
          ["parts", "Spare parts provider", "مزود قطع غيار"],
          ["towing", "Towing provider", "مزود سحب"],
        ].map(([role, en, ar]) => (
          <MechanicButton
            key={role}
            secondary
            label={m.t(en, ar)}
            onPress={() => router.setParams({ selectedRole: role })}
          />
        ))}
      </MechanicCard>
    </MechanicPage>
  );
}
function ExistingSignUpScreen() {
  const [greetingFontsReady]=useFonts({MotexaSignupGreeting:require('../../../assets/fonts/GreatVibes-Regular.ttf'),MotexaSignupArabic:require('../../../assets/fonts/Tajawal-Medium.ttf')});
  const submitting=useRef(false);
  const { selectedRole } = useLocalSearchParams<{ selectedRole?: string }>();
  const role = typeof selectedRole === "string" ? selectedRole : "";
  const isAdminRole = [
    "super-admin",
    "mechanics-admin",
    "parts-admin",
    "towing-admin",
  ].includes(role);
  useEffect(() => {
    if (isAdminRole)
      router.replace({
        pathname: "/auth/login",
        params: { selectedRole: role },
      });
  }, [isAdminRole, role]);

  const insets = useSafeAreaInsets();
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const reduced = useReducedMotion();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [phone,setPhone]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { t, isArabic } = useLanguage();

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(30));

  useEffect(() => {
    if (reduced) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reduced, fadeAnim, slideAnim]);

  async function createCustomer(){
    if(submitting.current||role!=='customer')return;
    setError('');
    if(fullName.trim().length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||!/^\+?[\d\s()-]{8,30}$/.test(phone.trim())||password.length<10||!/[a-z]/i.test(password)||!/[0-9]/.test(password)||password!==confirmPassword){setError(isArabic?'أكمل الاسم والجوال والبريد. كلمة المرور 10 أحرف على الأقل تضم حروفًا وأرقامًا مع تأكيد مطابق.':'Complete your name, phone and email. Use matching passwords of at least 10 characters with letters and numbers.');return;}
    submitting.current=true;setBusy(true);
    try{await mechanicApi('/api/customer/register','POST',{fullName:fullName.trim(),phoneNumber:phone.trim(),email:email.trim(),password},true);router.replace({pathname:'/auth/login',params:{selectedRole:'customer',registered:'1'}});}
    catch(e){setError(e instanceof MechanicApiError&&e.status===409?(isArabic?'البريد مستخدم. سجّل الدخول أو استعد الحساب.':'Email already registered. Sign in or recover your account.'):(isArabic?'تعذر إنشاء الحساب. راجع البيانات والاتصال وحاول مجددًا.':'Could not create account. Check your details and connection, then retry.'));}
    finally{submitting.current=false;setBusy(false);}
  }

  return (
    <LinearGradient
      colors={dark ? palette.canvasDark : palette.canvas}
      style={[styles.background, { overflow: "hidden" }]}
    >
      <BrandMonogram/>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <BrandHeader onBack={()=>router.back()} backLabel={isArabic?'رجوع':'Back'}/>
            <Text style={[styles.tagline, isArabic && styles.arabicTagline]}>
              {role==='customer'?(isArabic?'حساب صاحب السيارة':'CAR OWNER ACCOUNT'):t.signup.system}
            </Text>

            {role==='customer'&&<View style={{marginTop:15,marginBottom:8}}><OwnerStudioScene height={205} word="MOTEXA"/></View>}
            {/* Heading */}
            <View style={styles.headingSection}>
              <EditorialTitle
                accent={role!=='customer'}
                style={[styles.heading, isArabic && styles.arabicText,role==='customer'&&{fontFamily:greetingFontsReady?(isArabic?'MotexaSignupArabic':'MotexaSignupGreeting'):undefined,fontSize:isArabic?30:40,lineHeight:isArabic?44:54,fontWeight:'400'}]}
              >
                {role==='customer'?(isArabic?'أهلًا بك في MOTEXA.':'Welcome to MOTEXA.'):t.signup.title}
              </EditorialTitle>

              <Text style={[styles.description, isArabic && styles.arabicText]}>
                {role==='customer'?(isArabic?'أنشئ حسابك، ثم سجّل الدخول لإضافة سيارتك وبدء رحلتك.':'Create your account, then sign in to add your car and begin your journey.'):t.signup.description}
              </Text>
            </View>

            {/* Form */}
            <View style={[styles.card,role==='customer'&&{padding:20,paddingHorizontal:20,paddingTop:20,borderRadius:28,borderWidth:1,borderColor:dark?'#795A40':'#DDC7AA',backgroundColor:dark?'#382A21':'#FFFCF6',boxShadow:dark?'0px 12px 35px #00000020':'0px 12px 35px #7950340D'}]}>
              {role==='customer'&&<View style={{flexDirection:isArabic?'row-reverse':'row',gap:10,alignItems:'center',paddingBottom:18,marginBottom:18,borderBottomWidth:1,borderColor:dark?'#795A40':'#E7D6BE'}}><Ionicons name="person-circle-outline" size={24} color={dark?'#DDB184':'#8E613D'}/><Text style={{fontSize:15,fontWeight:'600',color:dark?'#FFF1DF':'#432D1E'}}>{isArabic?'بيانات حسابك':'Your account details'}</Text><View style={{flex:1}}/><Ionicons name="shield-checkmark-outline" size={19} color={dark?'#DDB184':'#8E613D'}/></View>}
              {/* Full Name */}
              <Text style={[styles.label, isArabic && styles.arabicLabel]}>
                {t.signup.fullName}
              </Text>

              <View
                style={[
                  [
                    styles.inputContainer,
                    isArabic && styles.inputContainerArabic,
                  ],
                  focusedField === "fullName" && {
                    borderColor: dark ? "#E2BA80" : "#9D6530",
                    backgroundColor: dark ? "#423225" : "#FFFCF6",
                  },
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons name="person-outline" size={20} color="#A27140" />
                </View>

                <TextInput
                  style={[styles.input, isArabic && styles.arabicInput]}
                  placeholder={t.signup.fullNamePlaceholder}
                  placeholderTextColor="#9C836B"
                  editable={!busy}
                  autoComplete="name"
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocusedField("fullName")}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel={isArabic ? "الاسم الكامل" : "Full name"}
                />
              </View>

              {role==='customer'&&<><Text style={[styles.label,isArabic&&styles.arabicLabel]}>{isArabic?'رقم الجوال':'Phone number'}</Text><View style={[styles.inputContainer,isArabic&&styles.inputContainerArabic]}><View style={styles.inputIcon}><Ionicons name="call-outline" size={20} color="#A27140"/></View><TextInput style={[styles.input,isArabic&&styles.arabicInput]} accessibilityLabel={isArabic?'رقم الجوال':'Phone number'} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!busy}/></View></>}
              {/* Email */}
              <Text style={[styles.label, isArabic && styles.arabicLabel]}>
                {t.common.email}
              </Text>

              <View
                style={[
                  [
                    styles.inputContainer,
                    isArabic && styles.inputContainerArabic,
                  ],
                  focusedField === "email" && {
                    borderColor: dark ? "#E2BA80" : "#9D6530",
                    backgroundColor: dark ? "#423225" : "#FFFCF6",
                  },
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons name="mail-outline" size={20} color="#A27140" />
                </View>

                <TextInput
                  style={[styles.input, isArabic && styles.arabicInput]}
                  placeholder={t.common.emailPlaceholder}
                  placeholderTextColor="#9C836B"
                  editable={!busy}
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel={
                    isArabic ? "البريد الإلكتروني" : "Email address"
                  }
                />
              </View>

              {/* Password */}
              <Text style={[styles.label, isArabic && styles.arabicLabel]}>
                {t.common.password}
              </Text>

              <View
                style={[
                  [
                    styles.inputContainer,
                    isArabic && styles.inputContainerArabic,
                  ],
                  focusedField === "password" && {
                    borderColor: dark ? "#E2BA80" : "#9D6530",
                    backgroundColor: dark ? "#423225" : "#FFFCF6",
                  },
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#A27140"
                  />
                </View>

                <TextInput
                  style={[styles.passwordInput, isArabic && styles.arabicInput,role==='customer'&&{fontSize:16}]}
                  placeholder={t.signup.passwordPlaceholder}
                  placeholderTextColor="#9C836B"
                  editable={!busy}
                  autoComplete="new-password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel={isArabic ? "كلمة المرور" : "Password"}
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={isArabic?(showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'):(showPassword?'Hide password':'Show password')}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={21}
                    color="#A27140"
                  />
                </TouchableOpacity>
              </View>

              {role==='customer'&&<Text style={{fontSize:12,lineHeight:22,color:dark?'#D4BDA3':'#795C43',textAlign:isArabic?'right':'left',marginTop:-7,marginBottom:17}}>{isArabic?'10 أحرف على الأقل، تتضمّن حروفًا وأرقامًا.':'At least 10 characters, including letters and numbers.'}</Text>}
              {/* Confirm Password */}
              <Text style={[styles.label, isArabic && styles.arabicLabel]}>
                {t.signup.confirmPassword}
              </Text>

              <View
                style={[
                  [
                    styles.inputContainer,
                    isArabic && styles.inputContainerArabic,
                  ],
                  focusedField === "confirmPassword" && {
                    borderColor: dark ? "#E2BA80" : "#9D6530",
                    backgroundColor: dark ? "#423225" : "#FFFCF6",
                  },
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#A27140"
                  />
                </View>

                <TextInput
                  style={[styles.passwordInput, isArabic && styles.arabicInput,role==='customer'&&{fontSize:16}]}
                  placeholder={t.signup.confirmPasswordPlaceholder}
                  placeholderTextColor="#9C836B"
                  editable={!busy}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel={
                    isArabic ? "تأكيد كلمة المرور" : "Confirm password"
                  }
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={isArabic?(showConfirmPassword?'إخفاء تأكيد كلمة المرور':'إظهار تأكيد كلمة المرور'):(showConfirmPassword?'Hide password confirmation':'Show password confirmation')}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-outline" : "eye-off-outline"
                    }
                    size={21}
                    color="#A27140"
                  />
                </TouchableOpacity>
              </View>

              {!!error&&<Text accessibilityRole="alert" style={{color:dark?'#FFB4A5':'#9C3528',lineHeight:24,marginBottom:12,textAlign:isArabic?'right':'left'}}>{error}</Text>}
              {/* Create Account */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.buttonWrapper,{opacity:busy?.6:1}]}
                onPress={()=>void createCustomer()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t.signup.createAccount}
              >
                <LinearGradient
                  colors={role==='customer'?(dark?['#EAC299','#C68E5A']:['#6D482F','#302219']):['#E3AD7A','#C47A48','#A95F34']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createButton}
                >
                  <Text style={[styles.buttonText,role==='customer'&&{color:dark?'#2C1D12':'#FFF5E7'}]}>
                    {busy?(isArabic?'جارٍ إنشاء الحساب…':'Creating account…'):t.signup.createAccount}
                  </Text>

                  <View
                    style={[
                      styles.arrowCircle,
                      isArabic && styles.arrowCircleArabic,
                    ]}
                  >
                    <Ionicons
                      name={isArabic ? "arrow-back" : "arrow-forward"}
                      size={18}
                      color="#A27140"
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Login */}
            <View
              style={[styles.loginContainer, isArabic && styles.rowReverse]}
            >
              <Text style={styles.loginQuestion}>
                {t.signup.alreadyHaveAccount}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  router.replace({
                    pathname: "/auth/login",
                    params: role ? { selectedRole: role } : {},
                  })
                }
              >
                <Text style={styles.loginText}>{t.signup.signIn}</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={[styles.footer, isArabic && styles.rowReverse]}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#A27140"
              />

              <Text
                style={[styles.footerText, isArabic && styles.arabicFooterText]}
              >
                {t.signup.secureRegistration}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const baseStyles = StyleSheet.create({
  background: {
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 45,
    paddingBottom: 100,
  },

  content: { width: "100%", maxWidth: 520, alignSelf: "center" },

  glowTop: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(198, 123, 72, 0.09)",
    top: -90,
    right: -90,
  },

  glowBottom: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(139, 79, 43, 0.08)",
    bottom: -80,
    left: -90,
  },

  /* Top Bar */

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(201,139,91,0.10)",
    borderWidth: 1,
    borderColor: "#D5BFA1",
    justifyContent: "center",
    alignItems: "center",
  },

  languageButton: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: "rgba(201,139,91,0.09)",
    borderWidth: 1,
    borderColor: "#D5BFA1",
  },

  languageText: {
    color: "#A27140",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 7,
  },

  /* Logo */

  logoContainer: {
    alignItems: "center",
    marginBottom: 12,
  },

  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D28B57",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.25,
    shadowRadius: 13,
    elevation: 8,
  },

  brandName: {
    color: "#A27140",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "left",
    marginLeft: 7,
    lineHeight: 24,
    alignSelf: "flex-start",
    marginBottom: 4,
  },

  tagline: {
    color: "#493321",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "left",
    marginTop: 6,
    lineHeight: 20,
    alignSelf: "flex-start",
  },

  arabicTagline: {
    letterSpacing: 0,
    fontSize: 11,
  },

  /* Heading */

  headingSection: { marginTop: 18, marginBottom: 22, alignItems: "stretch" },

  heading: {
    color: "#493321",
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 6,
    lineHeight: 39,
    textAlign: "left",
  },

  description: {
    color: "#92765B",
    fontSize: 13,
    lineHeight: 23,
    textAlign: "left",
  },

  arabicText: {
    textAlign: "right",
    writingDirection: "rtl",
  },

  /* Card */

  card: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "#D5BFA1",
    borderRadius: 0,
    padding: 22,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0,
    shadowRadius: 20,
    elevation: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    marginTop: 0,
  },

  label: {
    color: "#92765B",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 9,
    marginLeft: 2,
  },

  arabicLabel: {
    textAlign: "right",
    writingDirection: "rtl",
    letterSpacing: 0,
    fontSize: 12,
    marginLeft: 0,
    marginRight: 2,
  },

  inputContainer: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7EDDD",
    borderWidth: 1,
    borderColor: "#D4BB99",
    borderRadius: 29,
    marginBottom: 17,
    borderBottomWidth: 1,
    minHeight: 58,
  },

  inputContainerArabic: {
    flexDirection: "row-reverse",
  },

  inputIcon: {
    width: 49,
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    height: "100%",
    color: "#493321",
    fontSize: 16,
    paddingRight: 15,
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    color: "#493321",
    fontSize: 14,
  },

  arabicInput: {
    textAlign: "right",
    writingDirection: "rtl",
    paddingHorizontal: 5,
  },

  eyeButton: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Button */

  buttonWrapper: {
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 5,

    shadowColor: "#C47A48",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 7,
  },

  createButton: {
    height: 56,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: "#20120B",
    fontSize: 15,
    fontWeight: "800",
  },

  arrowCircle: {
    position: "absolute",
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(71, 36, 18, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  arrowCircleArabic: {
    right: undefined,
    left: 12,
  },

  /* Bottom */

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  rowReverse: {
    flexDirection: "row-reverse",
  },

  loginQuestion: {
    color: "#493321",
    fontSize: 13,
    marginHorizontal: 3,
  },

  loginText: {
    color: "#493321",
    fontSize: 13,
    fontWeight: "700",
    marginHorizontal: 3,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 10,
  },

  footerText: {
    color: "#92765B",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1.4,
    marginLeft: 6,
  },

  arabicFooterText: {
    letterSpacing: 0,
    fontSize: 10,
    marginLeft: 0,
    marginRight: 6,
  },
});
