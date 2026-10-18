import { MobilityArtwork } from "../../components/EditorialUI";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearanceStyles, useAppearance } from "../../components/Appearance";


import { useLanguage } from "../../i18n/LanguageContext";
import LanguageSwitch from "../../components/LanguageSwitch";
import { Text, VisualProvider, HeroReveal, DecorativeHalo } from "../../components/MotexaVisual";

import React, { useEffect, useState } from "react";
import { View, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import MotexaDialog from "../../components/MotexaDialog";
import { apiUrl } from "../../features/shared/api";
import { landingFor } from "../../features/shared/landing";

const AUTH_URL = apiUrl("/auth/login");
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

export default function LoginScreen() {
  const s = useAppearanceStyles(baseStyles);
  const insets=useSafeAreaInsets();
  const [focusedField,setFocusedField]=useState<"email"|"password"|null>(null);
  const { dark } = useAppearance();
  const { selectedRole } = useLocalSearchParams<{
    selectedRole?: string;
  }>();

  const { isArabic: ar } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    if (!AUTH_URL) {
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
        // A pending MECHANIC account goes to the pending screen instead of a bare error.
        if (response.status === 403 && data.role === "MECHANIC" && data.status === "PENDING") {
          router.replace("/auth/mechanic-pending");
          return;
        }
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
  (role === "super-admin" && user.role !== "SUPER_ADMIN") ||
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

    

const destination = landingFor(user.role, permissions);

      if (!destination) {
        error(t(
          "This account is not assigned to your department.",
          "هذا الحساب غير مخصص لقسمك الإداري."
        ));
        return;
      }

          console.log("LOGIN SUCCESS:", user.role, destination);

      await SecureStore.setItemAsync("motexa_access_token", token);

      console.log("TOKEN SAVED - NAVIGATING TO:", destination);

      router.replace(destination);
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
   <LinearGradient colors={dark?['#211B16','#30251D','#211B16']:['#EDE1CE','#D8C5A9','#E4D3B9']} style={StyleSheet.absoluteFill}/>
   <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} contentContainerStyle={[s.content,{paddingTop:insets.top+2,paddingBottom:Math.max(insets.bottom,20)}]}>
     <View style={[s.navigation,{flexDirection:ar?'row-reverse':'row'}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Back to roles','العودة إلى الأدوار')} onPress={()=>router.replace('/choose-role')} style={({pressed})=>[s.back,{opacity:pressed?.7:1}]}><Ionicons name={ar?'arrow-forward':'arrow-back'} size={20} color={dark?'#E2BD8F':'#725134'}/></Pressable>
      <View style={[s.wordmarkRow,{flexDirection:ar?'row-reverse':'row'}]}><Ionicons name="car-sport-outline" size={22} color={dark?'#E2BD8F':'#725134'}/><Text style={s.wordmark}>MOTEXA</Text></View>
     </View>
     <View style={[s.preferences,{alignItems:ar?'flex-start':'flex-end'}]}><LanguageSwitch light compact/></View>
     <View style={s.surface}>
      <HeroReveal style={{height:188,width:'100%',borderRadius:26,overflow:'hidden',paddingHorizontal:22,paddingTop:19,backgroundColor:'#332418'}}><LinearGradient colors={['#493123','#332419','#241B14']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><DecorativeHalo/><View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:8}}><View style={s.brandDot}/><Text style={s.eyebrow}>{t('YOUR MOTEXA WORKSPACE','مساحتك في MOTEXA')}</Text></View><MobilityArtwork compact/></HeroReveal>
      <View style={s.form}>
       <View style={{alignItems:ar?'flex-end':'flex-start',marginBottom:12}}><View style={[s.roleBadge,{flexDirection:ar?'row-reverse':'row'}]}><Ionicons name="shield-checkmark-outline" size={13} color={dark?'#E2BD8F':'#80532D'}/><Text style={s.roleBadgeText}>{t(roleTitle[0],roleTitle[1])}</Text></View></View>
       <Text accessibilityRole="header" style={[s.formTitle,{fontSize:28,lineHeight:36,fontWeight:'600',textAlign:ar?'right':'left'}]}>{t('Good to have you back.','مرحبًا بعودتك.')}</Text>
       <Text style={[s.formSubtitle,{textAlign:ar?'right':'left',marginTop:9}]}>{t('One account. A connected experience.','حساب واحد. تجربة متكاملة.')}</Text>
       <Text style={[s.label,{textAlign:ar?'right':'left',marginTop:25}]}>{t('Email address','البريد الإلكتروني')}</Text>
       <View style={[s.inputRow,focusedField==='email'&&{borderColor:dark?'#E2BA80':'#9D6530',backgroundColor:dark?'#3C2E22':'#FFFEFB'}]}><Ionicons name="mail-outline" size={20} color={dark?'#D1AD80':'#966B43'}/><TextInput accessibilityLabel={t('Email address','البريد الإلكتروني')} style={s.input} placeholder={t('Enter your email address','أدخل بريدك الإلكتروني')} placeholderTextColor={dark?'#BBA68C':'#95806A'} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoFocus={false} autoComplete="off" importantForAutofill="no" returnKeyType="done" blurOnSubmit={false} onSubmitEditing={()=>{}} value={email} onChangeText={setEmail} onFocus={()=>setFocusedField('email')} onBlur={()=>setFocusedField(null)}/></View>
       <View style={[s.passwordHeading,{flexDirection:ar?'row-reverse':'row'}]}><Text style={[s.label,{marginBottom:0}]}>{t('Password','كلمة المرور')}</Text><Pressable accessibilityRole="button" onPress={()=>router.push('/auth/forgot-password')} style={({pressed})=>({minHeight:32,justifyContent:'center',opacity:pressed?.7:1})}><Text style={s.forgot}>{t('Forgot password?','نسيت كلمة المرور؟')}</Text></Pressable></View>
       <View style={[s.inputRow,focusedField==='password'&&{borderColor:dark?'#DFB77E':'#A56E3B',backgroundColor:dark?'#3C2E22':'#FFFEFB'}]}><Ionicons name="lock-closed-outline" size={20} color={dark?'#D1AD80':'#966B43'}/><TextInput accessibilityLabel={t('Password','كلمة المرور')} style={s.input} placeholder={t('Enter your password','أدخل كلمة المرور')} placeholderTextColor={dark?'#BBA68C':'#95806A'} secureTextEntry={!showPassword} autoFocus={false} autoComplete="off" importantForAutofill="no" value={password} onChangeText={setPassword} onFocus={()=>setFocusedField('password')} onBlur={()=>setFocusedField(null)}/><Pressable accessibilityRole="button" accessibilityLabel={showPassword?t('Hide password','إخفاء كلمة المرور'):t('Show password','إظهار كلمة المرور')} onPress={()=>setShowPassword(!showPassword)} style={s.eye}><Ionicons name={showPassword?'eye-off-outline':'eye-outline'} size={21} color={dark?'#D1AD80':'#966B43'}/></Pressable></View>
       <Pressable accessibilityRole="button" disabled={loading} onPress={signIn} style={({pressed,hovered})=>[s.submit,{flexDirection:ar?'row-reverse':'row',opacity:loading?.65:pressed?.82:hovered?.94:1}]}>{loading?<ActivityIndicator color={dark?'#302319':'#FFF8EE'}/>:<><Text style={s.submitText}>{t('Enter workspace','إلى مساحة عملك')}</Text><View style={s.submitArrow}><Ionicons name={ar?'arrow-back':'arrow-forward'} size={22} color="#3B281B"/></View></>}</Pressable>
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
 root:{flex:1,backgroundColor:'#E4D3B9'},content:{width:'100%',maxWidth:500,alignSelf:'center',paddingHorizontal:18,flexGrow:1},navigation:{minHeight:44,alignItems:'center',gap:12,marginBottom:0},back:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#F5EADA',borderWidth:1,borderColor:'#D1B795'},wordmarkRow:{flex:1,alignItems:'center',gap:8},wordmark:{color:'#59402B',fontSize:16,fontWeight:'800',letterSpacing:3},preferences:{marginTop:0,marginBottom:6,position:'relative',top:-4},surface:{backgroundColor:'transparent'},hero:{paddingHorizontal:25,paddingTop:21,paddingBottom:30,minHeight:210,overflow:'hidden',borderRadius:27,borderWidth:1,borderColor:'#A27B52'},eyebrowRow:{alignItems:'center',gap:8,marginBottom:17},brandDot:{width:4,height:4,borderRadius:2,backgroundColor:'#E2B681'},eyebrow:{color:'#DEC19B',fontSize:8,letterSpacing:1.6},heading:{color:'#FFF8EF',fontSize:34,lineHeight:43,fontWeight:'600',letterSpacing:-.8},heroSubtitle:{color:'#E0C7A7',fontSize:12,lineHeight:21,marginTop:17},form:{alignSelf:'center',width:'100%',backgroundColor:'#FFF9F0',marginTop:-28,zIndex:2,borderRadius:26,borderWidth:1,borderColor:'#CDB796',paddingHorizontal:23,paddingTop:25,paddingBottom:24,shadowColor:'#5B3820',shadowOffset:{width:0,height:5},shadowOpacity:.12,shadowRadius:16,elevation:4},formHeader:{alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'},formTitle:{color:'#34261C',fontSize:26,lineHeight:36,fontWeight:'800'},roleBadge:{alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:12,backgroundColor:'#EEE0CD',maxWidth:'70%'},roleBadgeText:{color:'#704A29',fontSize:10,lineHeight:17,fontWeight:'600',flexShrink:1},formSubtitle:{color:'#7A6550',fontSize:12,lineHeight:21,marginTop:7},label:{color:'#533E2A',fontSize:12,lineHeight:20,fontWeight:'700',marginBottom:9},inputRow:{height:58,paddingHorizontal:14,borderWidth:1,borderColor:'#DDCDB7',borderRadius:16,backgroundColor:'#FFFDFA',flexDirection:'row',alignItems:'center',gap:10},input:{flex:1,minWidth:0,fontSize:14,color:'#3A2A1E',paddingVertical:10},passwordHeading:{alignItems:'center',justifyContent:'space-between',gap:10,marginTop:17,marginBottom:4},forgot:{color:'#8B5F35',fontSize:11,fontWeight:'600'},eye:{width:36,minHeight:44,alignItems:'center',justifyContent:'center'},submit:{marginTop:25,minHeight:60,paddingLeft:19,paddingRight:10,paddingVertical:9,borderRadius:18,backgroundColor:'#302219',alignItems:'center',justifyContent:'space-between',gap:12},submitText:{color:'#FFF9EF',fontSize:14,lineHeight:23,fontWeight:'800',flexShrink:1},submitArrow:{width:40,height:40,borderRadius:12,backgroundColor:'#DFA76F',alignItems:'center',justifyContent:'center'},security:{marginTop:24,flexDirection:'row',alignItems:'center',gap:8},securityLine:{height:1,backgroundColor:'#D8C6AE',flex:1},securityText:{color:'#8C6B48',fontSize:7,letterSpacing:1.2}
});
