import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearanceStyles, useAppearance } from "../components/Appearance";
import { PanelFill, CanvasFill } from "../components/BrandSurfaces";
import { MobilityArtwork } from "../components/EditorialUI";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSwitch from "../components/LanguageSwitch";
import { Text, VisualProvider, HeroReveal, DecorativeHalo } from "../components/MotexaVisual";

import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, Modal, Pressable, StyleSheet, StatusBar, Platform, Animated, AccessibilityInfo, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

const C = {
  bg: "#E9DECE",
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
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic: ar, language, setLanguage } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

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
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor="#E9DECE" />

      <LinearGradient
        colors={dark ? ["#211B17", "#30251D", "#241D18"] : ["#DBC8AD", "#BE9E77", "#D0B795"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.brandMini}>
            <Ionicons name="car-sport" size={24} color={C.bronze} />
            <Text style={styles.brandMiniText}>MOTEXA</Text>
          </View>

          <LanguageSwitch light />
        </View>

        <HeroReveal style={[styles.hero, {alignItems: ar ? "flex-end" : "flex-start"}]}><PanelFill kind="hero" radius={29}/>
          <View style={styles.heroEyebrow}><View style={styles.heroDot}/><Text style={styles.heroKicker}>THE MOTEXA EXPERIENCE</Text></View>

          <Text style={[styles.heroTitle, {textAlign: ar ? "right" : "left"}]}>
            {t("One place.\nEvery journey.", "مساحة واحدة.\nلكل رحلة.")}
          </Text>

          <Text style={[styles.heroSubtitle, {textAlign: ar ? "right" : "left"}]}>
            {t(
              "One platform. Every automotive solution.",
              "منصة واحدة لجميع خدمات السيارات"
            )}
          </Text>
        <MobilityArtwork compact /></HeroReveal>

        <Text style={[
          styles.sectionLabel,
          { textAlign: ar ? "right" : "left" },
        ]}>
          {t("HOW WOULD YOU LIKE TO START?", "كيف تحب تبدأ مع MOTEXA؟")}
        </Text>

        <View accessibilityRole="radiogroup" accessibilityLabel={t('Choose your role','اختر دورك')} style={{gap:12}}>
          <RoleChoice icon="car-sport-outline" title={t('Car Owner','مالك المركبة')} description={t('Your car. Your care. Your next journey.','العناية بسيارتك تبدأ من هنا.')} selected={selectedRole==='customer'} onPress={()=>setSelectedRole(current=>current==='customer'?null:'customer')} ar={ar}/>
          <View style={{marginTop:14,marginBottom:3}}><Text style={{color:dark?'#F8EDDC':'#3D2B1D',fontSize:21,fontWeight:'800',lineHeight:34,textAlign:ar?'right':'left'}}>{t('Here to offer a service?','تقدّم خدمة؟')}</Text><Text style={{color:dark?'#D5C2A8':'#624B34',fontSize:13,lineHeight:23,marginTop:3,textAlign:ar?'right':'left'}}>{t('Choose your professional workspace.','اختر مساحة العمل المناسبة لخدمتك.')}</Text></View>
          {roles.slice(1).map(role=><RoleChoice key={role.key} compact icon={role.icon} title={t(role.en,role.ar)} description={t(role.descEn,role.descAr)} selected={selectedRole===role.key} onPress={()=>setSelectedRole(current=>current===role.key?null:role.key)} ar={ar}/>)}
        </View>

        <Text style={[
          styles.sectionLabel,
          { marginTop: 19, textAlign: ar ? "right" : "left" },
        ]}>
          {t("SECURE ACCESS", "الدخول الإداري الآمن")}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded:adminOpen}}
          accessibilityLabel={t("Administration, four access roles", "الإدارة، أربعة أدوار للدخول")}
          onPress={() => setAdminOpen(true)}
          style={({ pressed }) => [
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <LinearGradient
            colors={["#F1D3A8", "#D6AE78", "#BA8B52"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.adminButton}
          >
            <View style={[
              styles.roleContent,
              { flexDirection: ar ? "row-reverse" : "row" },
            ]}>
              <View style={styles.adminIcon}>
                <Ionicons
                  name="shield-checkmark"
                  size={25}
                  color="#633B1C"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.adminTitle,
                  { textAlign: ar ? "right" : "left" },
                ]}>
                  {t("Administration", "الإدارة")}
                </Text>
                <Text style={[
                  styles.adminSubtitle,
                  { textAlign: ar ? "right" : "left" },
                ]}>
                  {t("4 roles · Select your assigned access", "٤ أدوار · اختر صلاحيتك المخصّصة")}
                </Text>
              </View>

              <Ionicons
                name={ar ? "arrow-back" : "arrow-forward"}
                size={21}
                color="#633B1C"
              />
            </View>
          </LinearGradient>
        </Pressable>



        <View style={{marginTop:24,gap:12}}>
          <Text accessibilityLiveRegion="polite" style={{color:dark?'#F4E8D8':'#493321',fontSize:14,lineHeight:24,textAlign:ar?'right':'left'}}>{selectedRole ? t('Selected: ','تم اختيار: ')+([...roles,...admins].find(role=>role.key===selectedRole)?.[ar?'ar':'en']??'') : t('Choose your role to continue.','اختر دورك للمتابعة.')}</Text>
          <Pressable accessibilityRole="button" disabled={!selectedRole} onPress={()=>{if(selectedRole)goLogin(selectedRole)}} style={({pressed,hovered})=>({backgroundColor:selectedRole?'#563923':dark?'#46372C':'#CBB89E',borderRadius:19,minHeight:58,padding:18,flexDirection:ar?'row-reverse':'row',alignItems:'center',justifyContent:'space-between',opacity:pressed?.8:hovered?.92:1})}>
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

      <Modal visible={adminOpen} transparent={false} animationType={reduced?'none':'slide'} statusBarTranslucent onRequestClose={()=>setAdminOpen(false)}>
       <View style={{flex:1,backgroundColor:dark?'#241C16':'#D0B795'}}>
        <CanvasFill/>
        <View accessibilityViewIsModal style={{width:'100%',maxWidth:620,alignSelf:'center',flex:1,borderTopLeftRadius:0,borderTopRightRadius:0,backgroundColor:dark?'#2D241D':'#FFF7EA',paddingBottom:Math.max(insets.bottom,18),paddingTop:insets.top+18}}>
         <View style={{paddingHorizontal:22,marginBottom:20,flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:9}}><Ionicons name="shield-checkmark-outline" size={22} color={dark?'#E5C28F':'#80532D'}/><Text style={{color:dark?'#E5C28F':'#80532D',fontSize:12,fontWeight:'800',letterSpacing:2}}>MOTEXA / ADMIN</Text></View>
         <View style={{paddingHorizontal:22,flexDirection:ar?'row-reverse':'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><View style={{flex:1}}><Text style={{color:dark?'#FFF1DF':'#3E2A1A',fontSize:23,fontWeight:'800',textAlign:ar?'right':'left'}}>{t('Your control centre','مساحة إدارتك')}</Text><Text style={{color:dark?'#D9C6AD':'#6B523A',fontSize:13,lineHeight:22,textAlign:ar?'right':'left'}}>{t('Select your assigned access','اختر الصلاحية المخصّصة لحسابك')}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t('Close','إغلاق')} onPress={()=>setAdminOpen(false)} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#493729':'#EEDFC9'}}><Ionicons name="close" size={22} color={dark?'#F2DBBC':'#664226'}/></Pressable></View>
         <View style={{paddingHorizontal:22,paddingBottom:16,alignItems:ar?'flex-end':'flex-start'}}><View accessibilityRole="radiogroup" accessibilityLabel="Language / اللغة" style={{flexDirection:'row',padding:4,gap:3,borderRadius:25,backgroundColor:dark?'#493729':'#EADAC2',borderWidth:1,borderColor:dark?'#796046':'#CDB08C'}}>{(['en','ar'] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:language===value}} accessibilityLabel={value==='ar'?'العربية':'English'} onPress={()=>setLanguage(value)} style={({pressed,hovered})=>({minWidth:52,minHeight:40,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:language===value?'#80532D':'transparent',opacity:pressed?.75:hovered?.85:1})}><Text style={{fontSize:12,fontWeight:'800',color:language===value?'#FFF7EA':dark?'#EBD7BA':'#624326'}}>{value.toUpperCase()}</Text></Pressable>)}</View></View>
         <ScrollView style={{flexShrink:1}} showsVerticalScrollIndicator={false}>
          <View style={{paddingHorizontal:22,paddingBottom:12}}><Text style={{color:dark?"#F4E8D8":"#493321",fontSize:15,fontWeight:"800",marginBottom:6,textAlign:ar?"right":"left"}}>{t("Choose your administration role", "اختر دورك الإداري")}</Text><Text style={{color:dark?"#DBCAB5":"#62503E",fontSize:13,lineHeight:22,marginBottom:18,textAlign:ar?"right":"left"}}>{t("Choose the role assigned to your account.", "اختر الدور المعيّن لحسابك.")}</Text>
            {admins.map((item) => (
              <RoleChoice
                key={item.key}
                icon={item.icon}
                title={t(item.en, item.ar)}
                description={item.key === "super-admin" ? t("Administrator accounts & platform oversight", "حسابات المسؤولين والإشراف على المنصة") : item.key === "mechanics-admin" ? t("Mechanic applications & accounts", "طلبات الميكانيكيين وحساباتهم") : item.key === "parts-admin" ? t("Spare parts department", "إدارة قسم قطع الغيار") : t("Towing department", "إدارة قسم خدمات السحب")}
                compact
                onPress={() => setSelectedRole(current => current === item.key ? null : item.key)}
                selected={selectedRole === item.key}
                ar={ar}
              />
            ))}

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
         <View style={{paddingHorizontal:22,paddingTop:10}}><Pressable accessibilityRole="button" disabled={!admins.some(item=>item.key===selectedRole)} onPress={()=>{if(selectedRole){setAdminOpen(false);goLogin(selectedRole)}}} style={({pressed})=>({borderRadius:25,minHeight:54,padding:16,backgroundColor:admins.some(item=>item.key===selectedRole)?'#563923':dark?'#554536':'#D7C5AA',opacity:pressed?.8:1,alignItems:'center',justifyContent:'center'})}><Text style={{color:'#FFF9EF',fontSize:15,fontWeight:'700',textAlign:'center'}}>{admins.some(item=>item.key===selectedRole)?t('Continue as ','المتابعة بصفتك ')+(admins.find(item=>item.key===selectedRole)?.[ar?'ar':'en']??''):t('Choose an admin role','اختر دورًا إداريًا')}</Text></Pressable></View>
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
function RolePanel({open,children}:{open:boolean;children:React.ReactNode}) {
 const reduced=useMotionPreference();const progress=useRef(new Animated.Value(open?1:0)).current;const [height,setHeight]=useState(0);
 useEffect(()=>{if(reduced){progress.setValue(open?1:0);return;}const animation=Animated.timing(progress,{toValue:open?1:0,duration:260,useNativeDriver:false});animation.start();return()=>animation.stop()},[open,progress,reduced]);
 return <Animated.View pointerEvents={open?'auto':'none'} accessibilityElementsHidden={!open} importantForAccessibility={open?'auto':'no-hide-descendants'} style={{height:progress.interpolate({inputRange:[0,1],outputRange:[0,height]}),overflow:'hidden',opacity:progress}}>{open&&<View style={{position:'absolute',top:0,left:0,right:0}} onLayout={event=>setHeight(event.nativeEvent.layout.height)}>{children}</View>}</Animated.View>;
}
function RoleChoice({icon,title,description,onPress,compact=false,selected,ar,index=0,featured=false}:{icon:IconName;title:string;description?:string;onPress:()=>void;compact?:boolean;selected:boolean;ar:boolean;index?:number;featured?:boolean}) {
 const {dark}=useAppearance();const {width,fontScale}=useWindowDimensions();const tile=false;
 const reduced=useMotionPreference();const progress=useRef(new Animated.Value(selected?1:0)).current;const hover=useRef(new Animated.Value(0)).current;
 const [focused,setFocused]=useState(false);
 useEffect(()=>{if(reduced){progress.setValue(selected?1:0);return;}const animation=Animated.spring(progress,{toValue:selected?1:0,damping:18,stiffness:190,mass:.8,useNativeDriver:true});animation.start();return()=>animation.stop()},[selected,reduced,progress]);
 const move=(value:number)=>{hover.stopAnimation();if(reduced){hover.setValue(0);return;}Animated.timing(hover,{toValue:value,duration:150,useNativeDriver:true}).start()};
 const ink=featured?'#FFF5E8':dark?'#FFF5E8':'#30241D',muted=featured?'#E2C5A1':dark?'#D7C5AF':'#65513E';
 const iconNode=<View style={{width:46,height:46,borderRadius:15,backgroundColor:featured?'#80532D':selected?'#80532D':dark?'#4D3B2B':'#EEDCC2',alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={25} color={featured||selected?'#FFF9F0':dark?'#E4BD88':'#754623'}/></View>;
 const check=<Ionicons name={selected?'checkmark-circle':'ellipse-outline'} size={23} color={featured?'#EDC58E':selected?(dark?'#EDC58E':'#80532D'):dark?'#AE967A':'#A58B6A'}/>;
 return <Animated.View style={{width:tile?'48%':'100%',marginBottom:compact?10:0,transform:[{translateY:hover.interpolate({inputRange:[0,1],outputRange:[0,-3]})},{scale:progress.interpolate({inputRange:[0,1],outputRange:[1,1]})}]}}>
 <Pressable accessibilityRole="radio" accessibilityState={{checked:selected}} accessibilityLabel={title} accessibilityHint={ar ? (selected ? "اضغط مرة ثانية لإلغاء التحديد" : "اضغط لاختيار هذا الدور") : (selected ? "Tap again to deselect" : "Tap to select this role")} onPress={onPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onHoverIn={()=>move(1)} onHoverOut={()=>move(0)} style={({pressed})=>({minHeight:102,height:fontScale<1.2?102:undefined,padding:15,borderRadius:23,borderWidth:2,shadowColor:'#77471F',shadowOffset:{width:0,height:3},shadowOpacity:selected?.18:0,shadowRadius:selected?8:0,elevation:selected?3:0,borderColor:selected?'#9A602D':focused?'#AD855A':dark?'#66503D':'#CDB797',backgroundColor:featured?(selected?'#6A482D':'#3E2B1D'):selected?(dark?'#593D28':'#F3DFC1'):dark?'#352A23':'#FFFDF8',opacity:pressed?.86:1,outlineStyle:focused?'solid':undefined,outlineWidth:focused?2:0,outlineColor:'#B78049',outlineOffset:3,overflow:'hidden'})}>
 {tile?<><View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',justifyContent:'space-between'}}>{iconNode}{check}</View><Text style={{color:muted,fontSize:10,letterSpacing:2,marginTop:16,textAlign:ar?'right':'left'}}>{'0'+(index+1)}</Text><Text style={{color:ink,fontSize:16,lineHeight:25,fontWeight:'800',marginTop:4,textAlign:ar?'right':'left'}}>{title}</Text><Text style={{color:muted,fontSize:12,lineHeight:20,marginTop:5,textAlign:ar?'right':'left'}}>{description}</Text></>:<View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:13}}>{iconNode}<View style={{flex:1,minWidth:0}}><Text style={{fontSize:featured?23:16,lineHeight:featured?34:25,fontWeight:'800',color:ink,textAlign:ar?'right':'left'}}>{title}</Text>{description&&<Text style={{fontSize:13,lineHeight:21,marginTop:4,color:muted,textAlign:ar?'right':'left'}}>{description}</Text>}</View>{check}</View>}
 <Animated.View pointerEvents="none" style={{position:'absolute',bottom:0,left:18,right:18,height:3,borderRadius:2,backgroundColor:dark?'#EDC58E':'#9A6331',opacity:progress,transform:[{scaleX:progress}]}}/>
 </Pressable></Animated.View>
}

const baseStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E9DECE",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 35,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  topRow: {
    flexWrap: "wrap",
    gap: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#DDD3C4",
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
    fontSize: 34,
    fontWeight: "600",
    textAlign: "left",
    letterSpacing: 0.1,
    lineHeight: 44,
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
    fontSize: 10,
    lineHeight: 15,
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
    fontSize: 8,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  version: {
    color: "#B39A7B",
    fontSize: 8,
    letterSpacing: 2,
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
