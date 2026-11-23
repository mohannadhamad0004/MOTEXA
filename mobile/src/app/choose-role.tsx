import RoleCinematicHero from '../components/RoleCinematicHero';
import { useFonts } from 'expo-font';

import BrandHeader from '../components/BrandHeader';
import BrandMonogram from '../components/BrandMonogram';
import RoleOptionCard from "../components/RoleOptionCard";
import Pressable from "../components/MotionPressable";

import {palette as motexaTheme} from '../components/DesignTokens';

import {EditorialTitle} from '../components/PremiumUI';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearanceStyles, useAppearance } from "../components/Appearance";
import { CanvasFill } from "../components/BrandSurfaces";
import { useLanguage } from "../i18n/LanguageContext";

import { Text, VisualProvider, HeroReveal } from "../components/MotexaVisual";

import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Modal, StyleSheet, StatusBar, AccessibilityInfo, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";

const C = {
  bg: '#FFF9EF',
  card: "#F7EDDD",
  card2: "#352318",
  border: "#D5BFA1",
  bronze: "#E0A36F",
  bronze2: "#B87542",
  white: "#FFF5EA",
  muted: "#92765B",
};

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export default function ChooseRoleScreen() {
  const [heroFontsReady] = useFonts({MotexaRoleScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaRoleArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic: ar } = useLanguage();

  const [adminPhotoWidth,setAdminPhotoWidth]=useState(0);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  useFocusEffect(useCallback(()=>{setSelectedRole(null);setAdminOpen(false);},[]));

  const t = (en: string, arabic: string) => ar ? arabic : en;

  const roles: {
    key: string;
    icon: IconName;
    en: string;
    ar: string;
    descEn: string;
    descAr: string;
  }[] = [
    {
      key: "customer",
      icon: "person-outline",
      en: "Car Owner",
      ar: "مالك المركبة",
      descEn: "Find trusted automotive services",
      descAr: "احصل على خدمات سيارات موثوقة",
    },
    {
      key: "mechanic",
      icon: "construct-outline",
      en: "Mechanic",
      ar: "ميكانيكي",
      descEn: "Manage your repair services",
      descAr: "إدارة خدمات الصيانة",
    },
    {
      key: "parts",
      icon: "cube-outline",
      en: "Spare Parts Provider",
      ar: "مزود قطع غيار",
      descEn: "Manage your parts business",
      descAr: "إدارة متجر قطع الغيار",
    },
    {
      key: "towing",
      icon: "car-sport-outline",
      en: "Towing Provider",
      ar: "مزود خدمة سحب",
      descEn: "Manage roadside assistance",
      descAr: "إدارة خدمات المساعدة على الطريق",
    },
  ];

  const admins: {
    key: string;
    icon: IconName;
    en: string;
    ar: string;
  }[] = [
    {
      key: "super-admin",
      icon: "shield-checkmark-outline",
      en: "Super Admin",
      ar: "المشرف العام",
    },
    {
      key: "mechanics-admin",
      icon: "construct-outline",
      en: "Mechanics Admin",
      ar: "مسؤول الميكانيكيين",
    },
    {
      key: "parts-admin",
      icon: "cube-outline",
      en: "Spare Parts Admin",
      ar: "مسؤول قطع الغيار",
    },
    {
      key: "towing-admin",
      icon: "car-outline",
      en: "Towing Admin",
      ar: "مسؤول خدمات السحب",
    },
  ];

  const goLogin = (role: string) => {
    router.push({
      pathname: "/auth/login",
      params: { selectedRole: role },
    });
  };

  return (
    <VisualProvider><View style={styles.root}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor={dark?'#30231B':'#FFF9EF'} />

      <LinearGradient
        colors={dark ? motexaTheme.canvasDark : motexaTheme.canvas}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView accessibilityElementsHidden={adminOpen} importantForAccessibility={adminOpen?"no-hide-descendants":"auto"} aria-hidden={adminOpen}
        contentContainerStyle={[styles.content,{paddingTop:insets.top+6,paddingBottom:insets.bottom+35}]}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader brandRule/>

        <HeroReveal style={{marginTop:-4,marginBottom:20,overflow:'hidden'}}>
          <BrandMonogram size={210} style={{left:ar?undefined:-20,right:ar?-20:undefined,top:4}}/>
          <View style={{flexDirection:ar?'row-reverse':'row',alignItems:'flex-end',justifyContent:'space-between',gap:12,paddingHorizontal:2}}>
            <View style={{flex:1}}>
              <Text style={{fontSize:10,lineHeight:19,letterSpacing:1.5,color:dark?'#D7B383':'#97704A',marginBottom:6,textAlign:ar?'right':'left'}}>01 / MOTEXA</Text>
              <EditorialTitle accent style={{fontSize:ar?31:34,lineHeight:ar?43:39,color:dark?'#FFF0DC':'#35251B',textAlign:ar?'right':'left'}}>{t('Choose\nyour role.','اختر\nدورك.')}</EditorialTitle>
            </View>
            <Text style={{width:'43%',fontFamily:heroFontsReady?(ar?'MotexaRoleArabic':'MotexaRoleScript'):undefined,fontSize:ar?17:28,lineHeight:ar?29:34,letterSpacing:0,color:dark?'#D5B17F':'#8E663F',paddingBottom:5,textAlign:ar?'left':'right'}}>{t('Your journey starts here.','رحلتك تبدأ هنا')}</Text>
          </View>
          <View style={{marginTop:10}}><RoleCinematicHero role={selectedRole} ar={ar} photographOnly title={selectedRole?t(roles.find(r=>r.key===selectedRole)?.en??'Choose your role',roles.find(r=>r.key===selectedRole)?.ar??'اختر دورك'):t('Choose your role.','اختر دورك.')} description={selectedRole?t(roles.find(r=>r.key===selectedRole)?.descEn??'',roles.find(r=>r.key===selectedRole)?.descAr??''):t('One community. Different ways to belong.','مجتمع واحد، وأدوار تصنع الفرق.')}/></View>
          <Text style={{fontFamily:heroFontsReady?(ar?'MotexaRoleArabic':'MotexaRoleScript'):undefined,fontSize:ar?17:26,lineHeight:ar?30:36,color:dark?'#E4C49E':'#785331',marginTop:10,textAlign:'left'}}>{t('One platform. Every automotive solution.','منصة واحدة لجميع خدمات السيارات')}</Text>
        </HeroReveal>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('Choose your role','اختر دورك')}><BrandMonogram size={310} style={{top:20,left:-25}}/>
          {roles.map((role,index)=><RoleOptionCard key={role.key} index={index} icon={role.icon} title={t(role.en,role.ar)} description={t(role.descEn,role.descAr)} selected={selectedRole===role.key} onPress={()=>setSelectedRole(current=>current===role.key?null:role.key)} ar={ar}/>)}
        </View>
        <View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:12,marginTop:7,marginBottom:11}}><Text style={{fontSize:11,lineHeight:20,letterSpacing:ar?0:1.3,color:dark?'#D7B383':'#937049'}}>{t('SECURE ACCESS','الدخول الإداري الآمن')}</Text><View style={{flex:1,height:1,backgroundColor:dark?'#806044':'#DCC3A2'}}/></View>
        <RoleOptionCard index={4} icon="shield-outline" title={t('Administration','الإدارة')} description={t('Choose your administrator role','اختر دورك الإداري')} ar={ar} expanded={adminOpen} onPress={()=>{setSelectedRole(null);setAdminOpen(true);}}/>

        <View style={{marginTop:24,gap:12}}>
          <Text accessibilityLiveRegion="polite" style={{color:dark?'#F4E8D8':'#493321',fontSize:14,lineHeight:24,textAlign:ar?'right':'left'}}>{selectedRole ? t('Selected: ','تم اختيار: ')+([...roles,...admins].find(role=>role.key===selectedRole)?.[ar?'ar':'en']??'') : t('Choose your role to continue.','اختر دورك للمتابعة.')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={selectedRole?t("Continue as ","المتابعة بصفتك ")+([...roles,...admins].find(item=>item.key===selectedRole)?.[ar?"ar":"en"]??""):t("Choose your role to continue","اختر دورك للمتابعة")} accessibilityState={{disabled:!selectedRole}} disabled={!selectedRole} onPress={()=>{if(selectedRole)goLogin(selectedRole)}} style={({pressed,hovered})=>({backgroundColor:selectedRole?'#563923':dark?'#46372C':'#CBB89E',borderRadius:29,minHeight:60,padding:18,flexDirection:ar?'row-reverse':'row',alignItems:'center',justifyContent:'space-between',opacity:pressed?.8:hovered?.92:1})}>
            <Text style={{color:'#FFF8EF',fontSize:14,fontWeight:'800',flex:1,lineHeight:23,textAlign:ar?'right':'left'}}>{selectedRole ? t('Continue as ','المتابعة بصفتك ')+([...roles,...admins].find(item=>item.key===selectedRole)?.[ar?'ar':'en']??'') : t('Choose your role to continue','اختر دورك للمتابعة')}</Text><Ionicons name={ar?'arrow-back':'arrow-forward'} size={23} color="#FFF8EF"/>
          </Pressable>
        </View>
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>
            MOTEXA  •  {t("SMART AUTOMOTIVE CARE", "العناية الذكية بالسيارات")}
          </Text>
          <Text style={styles.version}>VERSION 1.0</Text>
        </View>
      </ScrollView>

      <Modal visible={adminOpen} transparent animationType={reduced?'none':'slide'} statusBarTranslucent onRequestClose={()=>setAdminOpen(false)}>
       <View style={{flex:1,backgroundColor:dark?'#241C16':'#D0B795'}}>
        <CanvasFill/>
        <View accessibilityViewIsModal style={{width:'100%',maxWidth:520,alignSelf:'center',flex:1,borderTopLeftRadius:30,borderTopRightRadius:30,overflow:'hidden',backgroundColor:dark?'#38291F':'#FFF9EF',paddingBottom:Math.max(insets.bottom,18),paddingTop:12}}><CanvasFill/>
         <View style={{paddingTop:insets.top}}><BrandHeader brandRule onBack={()=>setAdminOpen(false)} backLabel={t('Close','إغلاق')}/></View>
         <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:8}} showsVerticalScrollIndicator>
          <View onLayout={e=>{const next=e.nativeEvent.layout.width;if(next>0)setAdminPhotoWidth(current=>current===next?current:next);}} style={{marginHorizontal:22,marginTop:4,marginBottom:16,height:210,borderTopLeftRadius:34,borderTopRightRadius:18,borderBottomLeftRadius:18,borderBottomRightRadius:42,overflow:'hidden',backgroundColor:dark?'#30231B':'#FFF9EF',borderWidth:1,borderColor:dark?'#80604466':'#E2CDB1'}}>
            {adminPhotoWidth>0&&<Image accessible={false} source={require('../../assets/images/admin-meeting-colin-white.jpg')} resizeMode="cover" style={{position:'absolute',left:0,width:'100%',height:'100%',top:0}}/>}
            <LinearGradient pointerEvents="none" colors={dark?['#30231BF2','#30231BC9','#30231B44']:['#FFF9EFE6','#FFF9EFA6','#432D1E18']} locations={[0,.5,1]} start={{x:ar?1:0,y:0}} end={{x:ar?0:1,y:0}} style={StyleSheet.absoluteFill}/>
            <HeroReveal key={(selectedRole??'default')+'-'+ar} style={{width:'78%',alignSelf:ar?'flex-end':'flex-start',height:'100%',padding:17,paddingTop:16,justifyContent:'flex-start',gap:6}}>
              <View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:6}}><Ionicons name="lock-closed-outline" size={12} color={dark?'#D5B17F':'#8E663F'}/><Text style={{fontSize:9,lineHeight:18,letterSpacing:ar?0:1,color:dark?'#D5B17F':'#8E663F'}}>MOTEXA / ADMINISTRATION</Text></View>
              <Text accessibilityRole="header" style={{fontFamily:heroFontsReady?(ar?'MotexaRoleArabic':'MotexaRoleScript'):undefined,fontSize:ar?25:34,lineHeight:ar?39:44,color:dark?'#FFF1DF':'#432D1E',textAlign:ar?'right':'left'}}>{admins.some(item=>item.key===selectedRole)?(admins.find(item=>item.key===selectedRole)?.[ar?'ar':'en']??''):t('Lead with care.','إدارةٌ تصنع الفرق.')}</Text>
              <Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:21,color:dark?'#E0C7A8':'#71563F',textAlign:ar?'right':'left'}}>{selectedRole==='super-admin'?t('Platform oversight, department leaders and permissions.','الإشراف على المنصّة ومسؤولي الأقسام والصلاحيات.'):selectedRole==='mechanics-admin'?t('Mechanic applications, documents and assessments.','طلبات الميكانيكيين ووثائقهم وتقييماتهم.'):selectedRole==='parts-admin'?t('Parts provider accounts and department access.','حسابات مزوّدي قطع الغيار وصلاحيات القسم.'):selectedRole==='towing-admin'?t('Towing providers and roadside service accounts.','حسابات أصحاب الونشات وخدمات الطريق.'):t('Choose the workspace assigned to your account.','اختر مساحة العمل المخصّصة لحسابك.')}</Text>
            </HeroReveal>
          </View>
          <View style={{marginHorizontal:22}}><View accessibilityRole="radiogroup" accessibilityLabel={t('Administrator roles','الأدوار الإدارية')} style={{padding:10,borderRadius:34,borderWidth:1,borderColor:dark?'#B58B5D66':'#FFFFFFDD',backgroundColor:dark?'#30231BAA':'#FFF9EFAA',overflow:'hidden'}}>
            <BrandMonogram size={270} style={{top:30,left:-70,opacity:.035}}/>
            {admins.map((item) => (
              <RoleOptionCard variant="admin"
                key={item.key}
                icon={item.icon}
                title={t(item.en, item.ar)}
                description={item.key === "super-admin" ? t("Administrator accounts & platform oversight", "حسابات المسؤولين والإشراف على المنصة") : item.key === "mechanics-admin" ? t("Mechanic applications & accounts", "طلبات الميكانيكيين وحساباتهم") : item.key === "parts-admin" ? t("Spare parts department", "إدارة قسم قطع الغيار") : t("Towing department", "إدارة قسم خدمات السحب")}
                onPress={() => setSelectedRole(current => current === item.key ? null : item.key)}
                selected={selectedRole === item.key}
                ar={ar}
              />
            ))}

            </View>
            <View style={styles.securityNote}>
              <Ionicons
                name="lock-closed-outline"
                size={15}
                color={C.bronze}
              />
              <Text style={styles.securityText}>
                {t(
                  "Administrator access requires an approved account.",
                  "الدخول الإداري يتطلب حسابًا معتمدًا."
                )}
              </Text>
            </View>
          </View>
</ScrollView>
         <View style={{paddingHorizontal:22,paddingTop:10}}><Pressable accessibilityRole="button" accessibilityLabel={admins.some(item=>item.key===selectedRole)?t("Continue as ","المتابعة بصفتك ")+(admins.find(item=>item.key===selectedRole)?.[ar?"ar":"en"]??""):t("Choose an admin role","اختر دورًا إداريًا")} disabled={!admins.some(item=>item.key===selectedRole)} onPress={()=>{if(selectedRole){setAdminOpen(false);goLogin(selectedRole)}}} style={({pressed})=>({borderRadius:25,minHeight:54,padding:16,backgroundColor:admins.some(item=>item.key===selectedRole)?'#563923':dark?'#554536':'#D7C5AA',opacity:pressed?.8:1,alignItems:'center',justifyContent:'center'})}><Text style={{color:admins.some(item=>item.key===selectedRole)?'#FFF9EF':dark?'#E1CBB0':'#61472F',fontSize:15,fontWeight:'600',textAlign:'center'}}>{admins.some(item=>item.key===selectedRole)?t('Continue as ','المتابعة بصفتك ')+(admins.find(item=>item.key===selectedRole)?.[ar?'ar':'en']??''):t('Choose an admin role','اختر دورًا إداريًا')}</Text></Pressable></View>
        </View>
       </View>
      </Modal>
    </View></VisualProvider>
  );
}


function useMotionPreference() {
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduced(value)}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{active=false;sub.remove()}},[]);return reduced;
}
const baseStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF9EF',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 35,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  topRow: {
    flexWrap: "wrap",
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#E2D0B7",
  },
  brandMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandMiniText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#3A2B1C",
  },
  languageBox: {
    flexDirection: "row",
    backgroundColor: "#2A1B13",
    borderRadius: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  langButton: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },
  langActive: {
    backgroundColor: C.bronze,
  },
  langText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  langTextActive: {
    color: C.bg,
  },
  hero: {
    alignItems: "flex-start",
    paddingTop: 27,
    paddingBottom: 20,
    backgroundColor: "#2B2117",
    borderRadius: 29,
    padding: 26,
    marginTop: 25,
    marginBottom: 29,
    overflow: "hidden",
    borderColor: "#A67E50",
    borderWidth: 1,
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: "#302319",
    borderWidth: 1,
    borderColor: "#795435",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    color: "#FAF4E9",
    fontSize: 30,
    fontWeight: "600",
    textAlign: "left",
    letterSpacing: 0.1,
    lineHeight: 39,
  },
  heroSubtitle: {
    color: "#CDAA82",
    fontSize: 12,
    textAlign: "left",
    marginTop: 16,
    lineHeight: 21,
  },
  sectionLabel: {
    color: "#886541",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 14,
    marginLeft: 3,
  },
  roleCard: {
    backgroundColor: "#FCFAF5",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#D4B998",
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 11,
    overflow: "hidden",
  },
  compactCard: {
    backgroundColor: "#F7EDDD",
    marginBottom: 8,
    paddingVertical: 16,
  },
  roleContent: {
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#E6CDAA",
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    color: "#3A2B1C",
    fontSize: 15,
    fontWeight: "600",
  },
  roleDescription: {
    color: "#8A765F",
    fontSize: 11,
    marginTop: 5,
    lineHeight: 18,
  },
  adminButton: {
    borderRadius: 17,
    padding: 19,
  },
  adminIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#FFFFFF24",
    alignItems: "center",
    justifyContent: "center",
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#302318",
  },
  adminSubtitle: {
    fontSize: 11,
    color: "#4C2E1B",
    marginTop: 3,
  },
  adminPanel: {
    backgroundColor: "#E6D6BF",
    borderWidth: 1,
    borderColor: "#C9AA83",
    borderRadius: 20,
    padding: 10,
    marginTop: 9,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  securityText: {
    flex: 1,
    color: "#8A765F",
    fontSize: 12,
    lineHeight: 21,
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
    gap: 7,
  },
  footerLine: {
    height: 1,
    width: "100%",
    backgroundColor: "#DDD0BC",
    marginBottom: 11,
  },
  footerText: {
    color: "#8E6D49",
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
  },
  version: {
    color: "#B39A7B",
    fontSize: 10,
    letterSpacing: 1.5,
  },

heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 23,
  },
heroDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D8AB74",
  },
heroKicker: {
    color: "#D4AD7F",
    fontSize: 8,
    letterSpacing: 1.6,
  },
});



