import {MechanicPage,MechanicCard,MechanicButton,useMechanicTheme} from '../../components/MechanicUI';
import MechanicRegistration from '../../components/MechanicRegistration';
import BrandWordmark from '../../components/BrandWordmark';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {EditorialTitle} from '../../components/PremiumUI';
import {useAppearance,useAppearanceStyles} from "../../components/Appearance";
import {useReducedMotion} from "../../components/MotexaVisual";
import {palette} from "../../components/DesignTokens";
import { PanelFill, CanvasFill } from "../../components/BrandSurfaces";
import { Text } from "../../components/MotexaVisual";
import LanguageSwitch from "../../components/LanguageSwitch";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useLanguage } from "../../i18n/LanguageContext";

export default function SignUpScreen(){const {selectedRole}=useLocalSearchParams<{selectedRole?:string}>();const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);if(!ready)return <View style={{flex:1}}><CanvasFill/></View>;if(!selectedRole)return <ChooseRegistrationRole/>;if(selectedRole==='towing')return <Redirect href={'/provider/tow-signup' as never}/>;if(selectedRole==='parts')return <Redirect href={'/provider/parts-signup' as never}/>;return selectedRole==='mechanic'?<MechanicRegistration/>:<ExistingSignUpScreen/>;}
function ChooseRegistrationRole(){const m=useMechanicTheme();return <MechanicPage back title={m.t('Create an account','إنشاء حساب جديد')} subtitle={m.t('Choose the account you want to create.','اختر نوع الحساب الذي تريد إنشاءه.')}><MechanicCard>{[['customer','Car owner','مالك مركبة'],['mechanic','Mechanic','ميكانيكي'],['parts','Spare parts provider','مزود قطع غيار'],['towing','Towing provider','مزود سحب']].map(([role,en,ar])=><MechanicButton key={role} secondary label={m.t(en,ar)} onPress={()=>router.setParams({selectedRole:role})}/>)}</MechanicCard></MechanicPage>;}
function ExistingSignUpScreen() {
 const {selectedRole}=useLocalSearchParams<{selectedRole?:string}>();
 const role=typeof selectedRole==='string'?selectedRole:'';
 const isAdminRole=['super-admin','mechanics-admin','parts-admin','towing-admin'].includes(role);
 useEffect(()=>{if(isAdminRole)router.replace({pathname:'/auth/login',params:{selectedRole:role}});},[isAdminRole,role]);

 const insets=useSafeAreaInsets();
 const [focusedField,setFocusedField]=useState<string|null>(null);
  const styles=useAppearanceStyles(baseStyles);
  const {dark}=useAppearance();
  const reduced=useReducedMotion();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const { language, toggleLanguage, t, isArabic } =
    useLanguage();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if(reduced){fadeAnim.setValue(1);slideAnim.setValue(0);return;}
    const animation=Animated.parallel([
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
    return()=>animation.stop();
  }, [reduced]);

  return (
    <LinearGradient
      colors={dark?palette.canvasDark:palette.canvas}
      style={[styles.background,{overflow:"hidden"}]}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContainer,{paddingTop:insets.top+14,paddingBottom:insets.bottom+24}]}
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
            {/* Top Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    isArabic
                      ? "arrow-forward"
                      : "arrow-back"
                  }
                  size={21}
                  color="#A27140"
                />
              </TouchableOpacity>

              <LanguageSwitch light compact unified/>
            </View>

            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={["#F0C49A", "#B87345", "#7C4528"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoCircle}
              >
                <Ionicons
                  name="person-add-outline"
                  size={31}
                  color="#1B100B"
                />
              </LinearGradient>
            </View>

            <BrandWordmark style={styles.brandName} />

            <Text
              style={[
                styles.tagline,
                isArabic && styles.arabicTagline,
              ]}
            >
              {t.signup.system}
            </Text>

            {/* Heading */}
            <View style={styles.headingSection}>
              <EditorialTitle
                style={[
                  styles.heading,
                  isArabic && styles.arabicText,
                ]}
              >
                {t.signup.title}
              </EditorialTitle>

              <Text
                style={[
                  styles.description,
                  isArabic && styles.arabicText,
                ]}
              >
                {t.signup.description}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.card}>
              {/* Full Name */}
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.signup.fullName}
              </Text>

              <View
                style={[[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ],focusedField==='fullName'&&{borderColor:dark?'#E2BA80':'#9D6530',backgroundColor:dark?'#423225':'#FFFCF6'}]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color="#A27140"
                  />
                </View>

                <TextInput
                  style={[
                    styles.input,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={
                    t.signup.fullNamePlaceholder
                  }
                  placeholderTextColor="#9C836B"
                  value={fullName}
                  onChangeText={setFullName}
                 onFocus={()=>setFocusedField('fullName')} onBlur={()=>setFocusedField(null)} accessibilityLabel={isArabic?'الاسم الكامل':'Full name'} />
              </View>

              {/* Email */}
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.common.email}
              </Text>

              <View
                style={[[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ],focusedField==='email'&&{borderColor:dark?'#E2BA80':'#9D6530',backgroundColor:dark?'#423225':'#FFFCF6'}]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#A27140"
                  />
                </View>

                <TextInput
                  style={[
                    styles.input,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={t.common.emailPlaceholder}
                  placeholderTextColor="#9C836B"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                 onFocus={()=>setFocusedField('email')} onBlur={()=>setFocusedField(null)} accessibilityLabel={isArabic?'البريد الإلكتروني':'Email address'} />
              </View>

              {/* Password */}
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.common.password}
              </Text>

              <View
                style={[[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ],focusedField==='password'&&{borderColor:dark?'#E2BA80':'#9D6530',backgroundColor:dark?'#423225':'#FFFCF6'}]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#A27140"
                  />
                </View>

                <TextInput
                  style={[
                    styles.passwordInput,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={
                    t.signup.passwordPlaceholder
                  }
                  placeholderTextColor="#9C836B"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                 onFocus={()=>setFocusedField('password')} onBlur={()=>setFocusedField(null)} accessibilityLabel={isArabic?'كلمة المرور':'Password'} />

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  <Ionicons
                    name={
                      showPassword
                        ? "eye-outline"
                        : "eye-off-outline"
                    }
                    size={21}
                    color="#A27140"
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.signup.confirmPassword}
              </Text>

              <View
                style={[[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ],focusedField==='confirmPassword'&&{borderColor:dark?'#E2BA80':'#9D6530',backgroundColor:dark?'#423225':'#FFFCF6'}]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#A27140"
                  />
                </View>

                <TextInput
                  style={[
                    styles.passwordInput,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={
                    t.signup.confirmPasswordPlaceholder
                  }
                  placeholderTextColor="#9C836B"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                 onFocus={()=>setFocusedField('confirmPassword')} onBlur={()=>setFocusedField(null)} accessibilityLabel={isArabic?'تأكيد كلمة المرور':'Confirm password'} />

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  <Ionicons
                    name={
                      showConfirmPassword
                        ? "eye-outline"
                        : "eye-off-outline"
                    }
                    size={21}
                    color="#A27140"
                  />
                </TouchableOpacity>
              </View>

              {/* Create Account */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={["#E3AD7A", "#C47A48", "#A95F34"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createButton}
                >
                  <Text style={styles.buttonText}>
                    {t.signup.createAccount}
                  </Text>

                  <View
                    style={[
                      styles.arrowCircle,
                      isArabic &&
                        styles.arrowCircleArabic,
                    ]}
                  >
                    <Ionicons
                      name={
                        isArabic
                          ? "arrow-back"
                          : "arrow-forward"
                      }
                      size={18}
                      color="#A27140"
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Login */}
            <View
              style={[
                styles.loginContainer,
                isArabic && styles.rowReverse,
              ]}
            >
              <Text style={styles.loginQuestion}>
                {t.signup.alreadyHaveAccount}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  router.replace({pathname:'/auth/login',params:role?{selectedRole:role}:{}})
                }
              >
                <Text style={styles.loginText}>
                  {t.signup.signIn}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View
              style={[
                styles.footer,
                isArabic && styles.rowReverse,
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#A27140"
              />

              <Text
                style={[
                  styles.footerText,
                  isArabic &&
                    styles.arabicFooterText,
                ]}
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

;const baseStyles = StyleSheet.create({
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

  content: {width:'100%',maxWidth:520,alignSelf:'center'},

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

  logoCircle: {width:48,height:48,borderRadius:16,justifyContent:"center",alignItems:"center",shadowColor:"#D28B57",shadowOffset:{
      width: 0,
      height: 7,
    },shadowOpacity:0.25,shadowRadius:13,elevation:8},

  brandName: {color:"#A27140",fontSize:14,fontWeight:"800",letterSpacing:3,textAlign:'left',marginLeft:7,lineHeight:24,alignSelf:'flex-start',marginBottom:4},

  tagline: {color:"#493321",fontSize:11,fontWeight:"600",letterSpacing:2,textAlign:'left',marginTop:6,lineHeight:20,alignSelf:'flex-start'},

  arabicTagline: {
    letterSpacing: 0,
    fontSize: 11,
  },

  /* Heading */

  headingSection: {marginTop:18,marginBottom:22,alignItems:'stretch'},

  heading: {color:"#493321",fontSize:28,fontWeight:'600',marginBottom:6,lineHeight:39,textAlign:'left'},

  description: {color:"#92765B",fontSize:13,lineHeight:23,textAlign:'left'},

  arabicText: {
    textAlign: "right",
    writingDirection: "rtl",
  },

  /* Card */

  card: {backgroundColor:'transparent',borderWidth:0,borderColor:"#D5BFA1",borderRadius:0,padding:22,shadowColor:"#000000",shadowOffset:{
      width: 0,
      height: 12,
    },shadowOpacity:0,shadowRadius:20,elevation:0,paddingHorizontal:0,paddingTop:0,marginTop:0},

  label: {
    color: "#92765B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
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

  inputContainer: {height:58,flexDirection:"row",alignItems:"center",backgroundColor:"#F7EDDD",borderWidth:1,borderColor:'#D4BB99',borderRadius:29,marginBottom:17,borderBottomWidth:1,minHeight:58},

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
