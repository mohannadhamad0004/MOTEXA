import {palette as motexaTheme} from '../../components/DesignTokens';
import BrandWordmark from '../../components/BrandWordmark';
import {EditorialTitle} from '../../components/PremiumUI';
import {useBrandPalette} from "../../components/BrandSurfaces";
import { MobilityArtwork } from "../../components/EditorialUI";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearanceStyles, useAppearance } from "../../components/Appearance";


import { useLanguage } from "../../i18n/LanguageContext";
import LanguageSwitch from "../../components/LanguageSwitch";
import { Text, VisualProvider, HeroReveal, DecorativeHalo } from "../../components/MotexaVisual";

import React, { useEffect, useRef, useState } from "react";
import { View, Image, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams, type Href } from "expo-router";
import * as SecureStore from '../../components/SessionStore';
import MotexaDialog from "../../components/MotexaDialog";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "")
  .replace(/\/+$/, "");

const AUTH_URL = `${API_BASE}/api/auth/login`;
const BG = "#17100C";
const BRONZE = "#E0A36F";
const WHITE = "#FFF5EA";

const roles: Record<string, [string, string]> = {
  "super-admin": ["Super Admin", "المشرف العام"],
  "mechanics-admin": ["Mechanics Admin", "مسؤول الميكانيكيين"],
  "parts-admin": ["Spare Parts Admin", "مسؤول قطع الغيار"],
  "towing-admin": ["Towing Admin", "مسؤول خدمات السحب"],
  mechanic: ["Mechanic", "ميكانيكي"],
  customer: ["Car Owner", "مالك المركبة"],
  parts: ["Spare Parts Provider", "مزود قطع غيار"],
  towing: ["Towing Provider", "مزود خدمة سحب"],
};

const REMEMBER_EMAIL_KEY='motexa_remembered_email';
async function readRememberedEmail(){
 try{return Platform.OS==='web'?(typeof localStorage==='undefined'?null:localStorage.getItem(REMEMBER_EMAIL_KEY)):await SecureStore.getItemAsync(REMEMBER_EMAIL_KEY);}catch{return null;}
}
async function rememberEmail(value:string|null){
 if(Platform.OS==='web'){if(typeof localStorage!=='undefined'){if(value)localStorage.setItem(REMEMBER_EMAIL_KEY,value);else localStorage.removeItem(REMEMBER_EMAIL_KEY);}return;}
 if(value)await SecureStore.setItemAsync(REMEMBER_EMAIL_KEY,value);else await SecureStore.deleteItemAsync(REMEMBER_EMAIL_KEY);
}
export default function LoginScreen() {
 const brandPalette=useBrandPalette();
  const s = useAppearanceStyles(baseStyles);
  const insets=useSafeAreaInsets();
  const [photoFrame,setPhotoFrame]=useState(390);
  const [focusedField,setFocusedField]=useState<"email"|"password"|null>(null);
  const { dark } = useAppearance();
  const { selectedRole } = useLocalSearchParams<{
    selectedRole?: string;
  }>();

  const { isArabic: ar } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember,setRemember]=useState(false);
  const emailTouched=useRef(false),rememberTouched=useRef(false),passwordInput=useRef<TextInput>(null);
  useEffect(()=>{let active=true;void readRememberedEmail().then(saved=>{if(active&&saved&&!emailTouched.current&&!rememberTouched.current){setEmail(saved);setRemember(true);}});return()=>{active=false;};},[]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({
    visible: false,
    title: "",
    message: "",
  });

  const t = (en: string, arabic: string) => ar ? arabic : en;
  const role = typeof selectedRole === "string"
    ? selectedRole
    : "";
  const canCreateAccount=role===''||['customer','mechanic','parts','towing'].includes(role);
  const [displayReady, setDisplayReady] = useState(false);
  useEffect(() => { setDisplayReady(true); }, []);
  const roleTitle = roles[displayReady ? role : ""] || ["Welcome Back", "مرحبًا بعودتك"];

  const error = (message: string) => {
    setDialog({
      visible: true,
      title: t("Sign In Failed", "تعذر تسجيل الدخول"),
      message,
    });
  };

  const signIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      error(t("Enter a valid email address.", "أدخل بريدًا إلكترونيًا صحيحًا."));
      return;
    }

    if (!password) {
      error(t("Password is required.", "كلمة المرور مطلوبة."));
      return;
    }

    if (!API_BASE) {
      error(t("API URL is not configured.", "رابط الخادم غير مُعدّ."));
      return;
    }

    try {
      setLoading(true);

const response = await fetch(
  AUTH_URL,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: normalizedEmail,
      password,
    }),
  }
);
      const data = await response.json();

      if (!response.ok) {
        error(data.message || data.error ||
          t("Invalid credentials.", "بيانات الدخول غير صحيحة."));
        return;
      }

      const token = data.token || data.accessToken;
      const user = data.user;

      if (!token || !user) {
        error(t("Unexpected server response.", "استجابة غير متوقعة من الخادم."));
        return;
      }

      if (user.status !== "ACTIVE") {
        error(t("Your account is not active.", "حسابك غير مفعّل."));
        return;
      }

      const permissions: string[] = Array.isArray(user.adminPermissions)
  ? user.adminPermissions.map((item: string | { permission: string }) =>
      typeof item === "string" ? item : item.permission
    )
  : [];

const expectedPermission: Record<string, string> = {
  "mechanics-admin": "MANAGE_MECHANICS",
  "parts-admin": "MANAGE_SPARE_PARTS",
  "towing-admin": "MANAGE_TOWING",
};

if (
  (role === "super-admin" && user.role !== "SUPER_ADMIN") || (role==="mechanic"&&user.role!=="MECHANIC") ||
  (expectedPermission[role] &&
    (user.role !== "ADMIN" ||
      !permissions.includes(expectedPermission[role])))
) {
  error(t(
    "This account does not have access to the selected department.",
    "هذا الحساب لا يملك صلاحية الدخول للقسم المحدد."
  ));
  return;
}

    

let destination: "/admin/(tabs)" | "/mechanics-admin" | "/mechanic" | null = null;

if(user.role==="MECHANIC"){destination="/mechanic";} else if (user.role === "SUPER_ADMIN") {
  destination = "/admin/(tabs)";
} else if (
  user.role === "ADMIN" &&
  permissions.includes("MANAGE_MECHANICS")
) {
  destination = "/mechanics-admin";
}

      if (!destination) {
        error(t(
          "This role's dashboard is not available yet.",
          "لوحة التحكم الخاصة بهذا الدور غير جاهزة بعد."
        ));
        return;
      }

          console.log("LOGIN SUCCESS:", user.role, destination);

      await SecureStore.setItemAsync("motexa_access_token", token);
      try{await rememberEmail(remember?normalizedEmail:null);}catch{console.warn('Sign-in preference could not be saved.');}

      console.log("TOKEN SAVED - NAVIGATING TO:", destination);

      router.replace(destination as Href);
    } catch (err) {
      console.error("MOTEXA LOGIN ERROR:", err);

      error(t(
        "Login failed. Check the Expo terminal for details.",
        "فشل تسجيل الدخول. راجع الخطأ في شاشة Expo."
      ));
    } finally {
      setLoading(false);
    }
  
  };

  return <VisualProvider><View style={s.root}>
   <StatusBar barStyle={dark?'light-content':'dark-content'}/>
   <LinearGradient colors={dark?motexaTheme.canvasDark:motexaTheme.canvas} style={StyleSheet.absoluteFill}/>
   <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} contentContainerStyle={[s.content,{paddingTop:insets.top+2,paddingBottom:Math.max(insets.bottom,20)}]}>
     <View style={[s.navigation,{flexDirection:ar?'row-reverse':'row'}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Back to roles','العودة إلى الأدوار')} onPress={()=>router.replace('/choose-role')} style={({pressed})=>[s.back,{opacity:pressed?.7:1}]}><Ionicons name={ar?'arrow-forward':'arrow-back'} size={20} color={dark?'#E2BD8F':'#725134'}/></Pressable>
      <View style={[s.wordmarkRow,{flexDirection:ar?'row-reverse':'row'}]}><BrandWordmark style={s.wordmark} /></View>
     </View>
     <View style={[s.preferences,{alignItems:'flex-end'}]}><LanguageSwitch light compact unified/></View>
     <View style={s.surface}>
      <HeroReveal onLayout={event=>setPhotoFrame(Math.min(event.nativeEvent.layout.width||390,500))} style={{height:204,width:'100%',overflow:'hidden',backgroundColor:'#38291F'}}>
       <Image accessible={false} source={require('../../../assets/images/motexa-mercedes-onboarding.png')} resizeMode="cover" style={{position:'absolute',top:-photoFrame*.4,left:'-50%',width:'165%',height:photoFrame*2.475}}/>
       <LinearGradient pointerEvents="none" colors={['#2B1B0B22','transparent','#33200E33']} style={StyleSheet.absoluteFill}/>
       <View pointerEvents="none" style={{position:'absolute',bottom:-1,left:0,width:0,height:0,borderLeftWidth:500,borderLeftColor:'transparent',borderBottomWidth:34,borderBottomColor:dark?'#38291F':'#FFF9EF'}}/>
      </HeroReveal>
      <View style={s.form}>
       <View style={{alignItems:ar?'flex-end':'flex-start',marginBottom:12}}><View style={[s.roleBadge,{flexDirection:ar?'row-reverse':'row'}]}><Ionicons name="shield-checkmark-outline" size={13} color={dark?'#E2BD8F':'#80532D'}/><Text style={s.roleBadgeText}>{t(roleTitle[0],roleTitle[1])}</Text></View></View>
       <View style={{flexDirection:ar?'row-reverse':'row',alignItems:'flex-start',justifyContent:'space-between',gap:16}}><EditorialTitle accent accessibilityRole="header" style={[s.formTitle,{fontSize:36,lineHeight:48,fontWeight:'400',textAlign:ar?'right':'left',flex:1}]}>{t('Sign in','تسجيل الدخول')}</EditorialTitle><Text style={{color:dark?'#C6A27A':'#97704D',fontSize:10,letterSpacing:1,lineHeight:20,paddingTop:13}}>{t('01 / ACCESS','01 / الدخول')}</Text></View>
       <Text style={[s.formSubtitle,{textAlign:ar?'right':'left',marginTop:9}]}>{t('Your world. Beautifully connected.','عالمك، بتواصل أجمل.')}</Text>
       <Text style={[s.label,{textAlign:ar?'right':'left',marginTop:25}]}>{t('Email address','البريد الإلكتروني')}</Text>
       <View style={[s.inputRow,focusedField==='email'&&{borderColor:dark?'#E2BA80':'#9D6530',backgroundColor:dark?'#3C2E22':'#FFFEFB'}]}><Ionicons name="mail-outline" size={20} color={dark?'#D1AD80':'#966B43'}/><TextInput accessibilityLabel={t('Email address','البريد الإلكتروني')} style={s.input} placeholder={t('Enter your email address','أدخل بريدك الإلكتروني')} placeholderTextColor={dark?'#BBA68C':'#95806A'} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoFocus={false} autoComplete={remember?"username":"off"} textContentType={remember?"username":"none"} importantForAutofill={remember?"yes":"no"} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={()=>passwordInput.current?.focus()} value={email} onChangeText={value=>{emailTouched.current=true;setEmail(value);}} onFocus={()=>setFocusedField('email')} onBlur={()=>setFocusedField(null)}/></View>
       <View style={[s.passwordHeading,{flexDirection:ar?'row-reverse':'row'}]}><Text style={[s.label,{marginBottom:0}]}>{t('Password','كلمة المرور')}</Text><Pressable accessibilityRole="button" onPress={()=>router.push('/auth/forgot-password')} style={({pressed})=>({minHeight:32,justifyContent:'center',opacity:pressed?.7:1})}><Text style={s.forgot}>{t('Forgot password?','نسيت كلمة المرور؟')}</Text></Pressable></View>
       <View style={[s.inputRow,focusedField==='password'&&{borderColor:dark?'#DFB77E':'#A56E3B',backgroundColor:dark?'#3C2E22':'#FFFEFB'}]}><Ionicons name="lock-closed-outline" size={20} color={dark?'#D1AD80':'#966B43'}/><TextInput accessibilityLabel={t('Password','كلمة المرور')} style={s.input} placeholder={t('Enter your password','أدخل كلمة المرور')} placeholderTextColor={dark?'#BBA68C':'#95806A'} secureTextEntry={!showPassword} autoFocus={false} autoCapitalize="none" autoCorrect={false} autoComplete={remember?"current-password":"off"} textContentType={remember?"password":"none"} importantForAutofill={remember?"yes":"no"} ref={passwordInput} returnKeyType="go" onSubmitEditing={()=>{if(!loading)void signIn();}} value={password} onChangeText={setPassword} onFocus={()=>setFocusedField('password')} onBlur={()=>setFocusedField(null)}/><Pressable accessibilityRole="button" accessibilityLabel={showPassword?t('Hide password','إخفاء كلمة المرور'):t('Show password','إظهار كلمة المرور')} onPress={()=>setShowPassword(!showPassword)} style={s.eye}><Ionicons name={showPassword?'eye-off-outline':'eye-outline'} size={21} color={dark?'#D1AD80':'#966B43'}/></Pressable></View>
       <Pressable accessibilityRole="checkbox" accessibilityState={{checked:remember}} aria-checked={remember} accessibilityLabel={t('Save sign-in details','حفظ بيانات الدخول')} disabled={loading} onPress={()=>{rememberTouched.current=true;const next=!remember;setRemember(next);if(!next)void rememberEmail(null).catch(()=>{});}} style={({pressed})=>({minHeight:45,marginTop:12,flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:10,opacity:pressed?.75:1})}>
        <View style={{width:22,height:22,borderRadius:7,borderWidth:1,borderColor:dark?'#CBA16E':'#A77946',backgroundColor:remember?'#80522E':'transparent',alignItems:'center',justifyContent:'center'}}>{remember&&<Ionicons name="checkmark" size={16} color="#FFF3DE"/>}</View>
        <Text style={{color:dark?'#F3DEC0':'#66482F',fontSize:12,lineHeight:21}}>{t('Save sign-in details','حفظ بيانات الدخول')}</Text>
       </Pressable>
       <Text style={{fontSize:10,lineHeight:17,color:dark?'#C8B18F':'#897056',textAlign:ar?'right':'left'}}>{t('Remembers your email. Your device password manager can save and fill your password.','يحفظ بريدك. يمكن لمدير كلمات المرور في جهازك حفظ كلمة السر وتعبئتها.')}</Text>
       <Pressable accessibilityRole="button" accessibilityLabel={t("Enter workspace","إلى مساحة عملك")} disabled={loading} onPress={signIn} style={({pressed,hovered})=>[s.submit,{flexDirection:ar?'row-reverse':'row',opacity:loading?.65:pressed?.82:hovered?.94:1}]}>{loading?<ActivityIndicator color={dark?'#302319':'#FFF8EE'}/>:<><Text style={s.submitText}>{t('Enter workspace','إلى مساحة عملك')}</Text><View style={s.submitArrow}><Ionicons name={ar?'arrow-back':'arrow-forward'} size={22} color="#3B281B"/></View></>}</Pressable>
       {displayReady&&canCreateAccount&&<View style={{marginTop:20,paddingTop:15,borderTopWidth:1,borderTopColor:dark?'#654C34':'#E6D3B9',alignItems:'center',gap:3}}><Text style={{fontSize:12,lineHeight:21,color:dark?'#D9C1A0':'#80664C'}}>{t('New to MOTEXA?','جديد في MOTEXA؟')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Create a new account','إنشاء حساب جديد')} disabled={loading} onPress={()=>router.push({pathname:'/auth/signup',params:{selectedRole:role}})} style={({pressed})=>({minHeight:44,paddingHorizontal:16,justifyContent:'center',opacity:pressed?.7:1})}><Text style={{fontSize:14,lineHeight:23,fontWeight:'600',color:dark?'#EDC697':'#704620'}}>{t('Create a new account','إنشاء حساب جديد')}</Text></Pressable></View>}
       <View style={s.security}><View style={s.securityLine}/><Ionicons name="shield-checkmark-outline" size={14} color={dark?'#D1AD80':'#966B43'}/><Text style={s.securityText}>{t('SECURE BY DESIGN','الأمان أساس تجربتك')}</Text><View style={s.securityLine}/></View>
      </View>
     </View>
    </ScrollView>
   </KeyboardAvoidingView>
      <MotexaDialog
        visible={dialog.visible}
        type="error"
        title={dialog.title}
        message={dialog.message}
        confirmText={t("OK", "حسنًا")}
        cancelText={t("Close", "إغلاق")}
        onConfirm={() => setDialog({ ...dialog, visible: false })}
        onCancel={() => setDialog({ ...dialog, visible: false })}
      />
  </View></VisualProvider>;
}
const baseStyles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FFF9EF'},content:{width:'100%',maxWidth:500,alignSelf:'center',paddingHorizontal:0,flexGrow:1},navigation:{paddingHorizontal:22,minHeight:44,alignItems:'center',gap:12,marginBottom:0},back:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#F5EADA',borderWidth:1,borderColor:'#D1B795'},wordmarkRow:{flex:1,alignItems:'center',gap:8},wordmark:{color:'#59402B',fontSize:16,fontWeight:'800',letterSpacing:3},preferences:{paddingHorizontal:22,marginTop:0,marginBottom:6,position:'relative',top:-4},surface:{backgroundColor:'transparent'},hero:{paddingHorizontal:25,paddingTop:21,paddingBottom:30,minHeight:210,overflow:'hidden',borderRadius:27,borderWidth:1,borderColor:'#A27B52'},eyebrowRow:{alignItems:'center',gap:8,marginBottom:17},brandDot:{width:4,height:4,borderRadius:2,backgroundColor:'#E2B681'},eyebrow:{color:'#DEC19B',fontSize:8,letterSpacing:1.6},heading:{color:'#FFF8EF',fontSize:34,lineHeight:43,fontWeight:'600',letterSpacing:-.8},heroSubtitle:{color:'#E0C7A7',fontSize:12,lineHeight:21,marginTop:17},form:{alignSelf:'center',width:'90%',maxWidth:460,backgroundColor:'#FFF9F0',marginTop:-28,zIndex:2,borderRadius:27,borderWidth:1,borderColor:'#CDB796',paddingHorizontal:22,paddingTop:25,paddingBottom:25,shadowColor:'#5B3820',shadowOffset:{width:0,height:5},shadowOpacity:.10,shadowRadius:16,elevation:4},formHeader:{alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'},formTitle:{color:'#34261C',fontSize:26,lineHeight:36,fontWeight:'800'},roleBadge:{alignItems:'center',gap:7,paddingVertical:4,maxWidth:'100%'},roleBadgeText:{color:'#704A29',fontSize:10,lineHeight:17,fontWeight:'600',flexShrink:1},formSubtitle:{color:'#7A6550',fontSize:12,lineHeight:21,marginTop:7},label:{color:'#533E2A',fontSize:12,lineHeight:20,fontWeight:'700',marginBottom:9},inputRow:{minHeight:58,paddingHorizontal:17,borderBottomWidth:1,borderColor:'#D4BB99',borderRadius:29,backgroundColor:'#FFF8ED',flexDirection:'row',alignItems:'center',gap:10,borderWidth:1},input:{flex:1,minWidth:0,fontSize:14,color:'#3A2A1E',paddingVertical:10},passwordHeading:{alignItems:'center',justifyContent:'space-between',gap:10,marginTop:17,marginBottom:4},forgot:{color:'#8B5F35',fontSize:11,fontWeight:'600'},eye:{width:36,minHeight:44,alignItems:'center',justifyContent:'center'},submit:{marginTop:27,minHeight:60,paddingLeft:22,paddingRight:10,paddingVertical:9,borderRadius:30,backgroundColor:'#302219',alignItems:'center',justifyContent:'space-between',gap:12},submitText:{color:'#FFF9EF',fontSize:14,lineHeight:23,fontWeight:'800',flexShrink:1},submitArrow:{width:40,height:40,borderRadius:20,backgroundColor:'#DFA76F',alignItems:'center',justifyContent:'center'},security:{marginTop:24,flexDirection:'row',alignItems:'center',gap:8},securityLine:{height:1,backgroundColor:'#D8C6AE',flex:1},securityText:{color:'#8C6B48',fontSize:7,letterSpacing:1.2}
});

