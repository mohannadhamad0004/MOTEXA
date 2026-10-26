import CurvedPhotoHero from '../components/CurvedPhotoHero';
import {palette as motexaTheme} from '../components/DesignTokens';
import BrandWordmark from '../components/BrandWordmark';
import {RolePhotography} from '../components/RolePhotography';
import {EditorialTitle,SectionCaption} from '../components/PremiumUI';
import {useBrandPalette} from "../components/BrandSurfaces";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearanceStyles, useAppearance } from "../components/Appearance";
import { PanelFill, CanvasFill } from "../components/BrandSurfaces";
import { MobilityArtwork } from "../components/EditorialUI";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSwitch from "../components/LanguageSwitch";
import { Text, VisualProvider, HeroReveal, DecorativeHalo } from "../components/MotexaVisual";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, Modal, Pressable, StyleSheet, StatusBar, Platform, Animated, AccessibilityInfo, useWindowDimensions, Image } from "react-native";
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
 const brandPalette=useBrandPalette();
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic: ar, language, setLanguage } = useLanguage();
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
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor='#FFF9EF' />

      <LinearGradient
        colors={dark ? motexaTheme.canvasDark : motexaTheme.canvas}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[styles.content,{paddingTop:insets.top+16,paddingBottom:insets.bottom+35}]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.brandMini}>
            
            <BrandWordmark style={styles.brandMiniText} />
          </View>

          <LanguageSwitch light compact unified/>
        </View>

        <HeroReveal style={{minHeight:230,marginTop:8,marginBottom:18,overflow:'hidden',paddingTop:18,paddingBottom:16}}>
          <View pointerEvents="none" accessible={false} style={{position:'absolute',top:0,bottom:0,width:'47%',right:ar?undefined:0,left:ar?0:undefined,overflow:'hidden',borderBottomLeftRadius:ar?0:64,borderBottomRightRadius:ar?64:0}}><Image source={require('../../assets/images/motexa-mercedes-coastal.png')} resizeMode="cover" style={{width:'100%',height:'100%'}}/><LinearGradient colors={['#3C291400','#3C291430']} style={StyleSheet.absoluteFill}/></View>
          <View style={{width:'51%',alignSelf:ar?'flex-end':'flex-start',paddingRight:ar?0:9,paddingLeft:ar?9:0}}>
            <Text style={{fontSize:9,letterSpacing:2,color:dark?'#D7B383':'#97704A',marginBottom:15,textAlign:ar?'right':'left'}}>01 / MOTEXA</Text>
            <EditorialTitle accent style={{fontSize:ar?31:38,lineHeight:ar?43:40,color:dark?'#FFF0DC':'#35251B',textAlign:ar?'right':'left'}}>{t('Choose\nyour role.','اختر\nدورك.')}</EditorialTitle>
            <Text style={{fontSize:8,lineHeight:16,letterSpacing:ar?0:1.3,color:dark?'#D5B17F':'#8E663F',marginTop:16,textAlign:ar?'right':'left'}}>{t('YOUR JOURNEY STARTS HERE','رحلتك تبدأ هنا')}</Text>
            <Text style={{fontSize:11,lineHeight:18,color:dark?'#D7C5AF':'#75614C',marginTop:7,textAlign:ar?'right':'left'}}>{t('One platform. Every automotive solution.','منصة واحدة لجميع خدمات السيارات')}</Text>
          </View>
        </HeroReveal>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('Choose your role','اختر دورك')}>
          {roles.map((role,index)=><PhotoRoleChoice key={role.key} index={index} icon={role.icon} title={t(role.en,role.ar)} description={t(role.descEn,role.descAr)} selected={selectedRole===role.key} onPress={()=>setSelectedRole(current=>current===role.key?null:role.key)} ar={ar}/>)}
        </View>
        <View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:12,marginTop:7,marginBottom:11}}><Text style={{fontSize:9,letterSpacing:1.5,color:dark?'#D7B383':'#937049'}}>{t('SECURE ACCESS','الدخول الإداري الآمن')}</Text><View style={{flex:1,height:1,backgroundColor:dark?'#806044':'#DCC3A2'}}/></View>
        <PhotoRoleChoice index={4} icon="shield-outline" title={t('Administration','الإدارة')} description={t('Choose your administrator role','اختر دورك الإداري')} ar={ar} expanded={adminOpen} onPress={()=>{setSelectedRole(null);setAdminOpen(true);}}/>

        <View style={{marginTop:24,gap:12}}>
          <Text accessibilityLiveRegion="polite" style={{color:dark?'#F4E8D8':'#493321',fontSize:14,lineHeight:24,textAlign:ar?'right':'left'}}>{selectedRole ? t('Selected: ','تم اختيار: ')+([...roles,...admins].find(role=>role.key===selectedRole)?.[ar?'ar':'en']??'') : t('Choose your role to continue.','اختر دورك للمتابعة.')}</Text>
          <Pressable accessibilityRole="button" disabled={!selectedRole} onPress={()=>{if(selectedRole)goLogin(selectedRole)}} style={({pressed,hovered})=>({backgroundColor:selectedRole?'#563923':dark?'#46372C':'#CBB89E',borderRadius:29,minHeight:58,padding:18,flexDirection:ar?'row-reverse':'row',alignItems:'center',justifyContent:'space-between',opacity:pressed?.8:hovered?.92:1})}>
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
        <View accessibilityViewIsModal style={{width:'100%',maxWidth:620,alignSelf:'center',flex:1,borderTopLeftRadius:30,borderTopRightRadius:30,overflow:'hidden',backgroundColor:dark?'#38291F':'#FFF9EF',paddingBottom:Math.max(insets.bottom,18),paddingTop:12}}><CanvasFill/>
         <View style={{paddingHorizontal:22,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}><Pressable accessibilityRole="button" accessibilityLabel={t('Close','إغلاق')} onPress={()=>setAdminOpen(false)} style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#493729':'#EEDFC9'}}><Ionicons name="close" size={21} color={dark?'#F2DBBC':'#664226'}/></Pressable><BrandWordmark size={18} rule={false} style={{flex:1}}/><LanguageSwitch light compact unified/></View>
         <CurvedPhotoHero eyebrow="MOTEXA / ADMIN" title={t('Select your\nadmin role.','اختر دورك\nالإداري.')} caption={t('Administration','الإدارة')} description={t('Select your assigned access','اختر الصلاحية المخصّصة لحسابك')} icon="people-outline"/>
         <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:8}} showsVerticalScrollIndicator={false}>
          <View style={{marginHorizontal:22}}><SectionCaption index="01" title={t('SELECT YOUR WORKSPACE','اختر مساحة عملك')}/><View accessibilityRole="radiogroup" accessibilityLabel={t('Administrator roles','الأدوار الإدارية')} style={{marginTop:14}}>
            {admins.map((item,adminIndex) => (
              <RoleChoice gold
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
function PhotoRoleChoice({index,icon,title,description,selected=false,expanded,onPress,ar}:{index:number;icon:IconName;title:string;description:string;selected?:boolean;expanded?:boolean;onPress:()=>void;ar:boolean}){
 const {dark}=useAppearance();const [frame,setFrame]=useState({width:92,height:92});
 const photoWidth=frame.height*10/3;
 return <Pressable accessibilityRole={index===4?'button':'radio'} accessibilityLabel={index===4?(ar?'فتح أدوار الإدارة':'Open administration roles'):title} accessibilityState={index===4?{expanded}:{checked:selected}} onPress={onPress} style={({pressed})=>({flexDirection:ar?'row-reverse':'row',minHeight:92,borderRadius:25,borderWidth:selected?2:1,borderColor:selected?'#B78248':dark?'#98714D':'#D9BD97',backgroundColor:dark?(selected?'#65472F':'#463226'):(selected?'#F3DEC0':'#FFF8ED'),overflow:'hidden',marginBottom:9,opacity:pressed?.78:1})}>
  <View pointerEvents="none" accessible={false} onLayout={e=>setFrame({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height})} style={{width:'27%',overflow:'hidden',backgroundColor:'#795236'}}><Image source={require('../../assets/images/motexa-role-atlas.png')} resizeMode="stretch" style={{position:'absolute',width:photoWidth,height:frame.height*5,left:(frame.width-photoWidth)/2,top:-index*frame.height}}/></View>
  <View style={{flex:1,flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:9,paddingHorizontal:11,paddingVertical:12}}>
   <View style={{width:31,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#6E4D31':'#F0D7B5'}}><Ionicons name={icon} size={19} color={dark?'#F4D6AE':'#93673B'}/></View>
   <View style={{flex:1,minWidth:0}}><Text style={{fontSize:8,color:dark?'#C6A77E':'#A0805B',letterSpacing:1,marginBottom:2,textAlign:ar?'right':'left'}}>{'0'+(index+1)}</Text><Text style={{fontSize:14,lineHeight:20,fontWeight:'600',color:dark?'#FFF2DE':'#3D2B1D',textAlign:ar?'right':'left'}}>{title}</Text><Text style={{fontSize:10,lineHeight:15,color:dark?'#D9C5A9':'#806A52',marginTop:3,textAlign:ar?'right':'left'}}>{description}</Text></View>
   <View style={{width:25,height:25,borderRadius:13,backgroundColor:selected?'#654024':'#B68755',alignItems:'center',justifyContent:'center'}}><Ionicons name={selected?'checkmark':ar?'arrow-back':'arrow-forward'} size={14} color='#FFF9EF'/></View>
  </View>
 </Pressable>
}
function RoleChoice({icon,title,description,onPress,compact=false,selected,ar,index=0,featured=false,gold=false,photoIndex}:{icon:IconName;title:string;description?:string;onPress:()=>void;compact?:boolean;selected:boolean;ar:boolean;index?:number;featured?:boolean;gold?:boolean;photoIndex?:number}) {
 const {dark}=useAppearance();const {width,fontScale}=useWindowDimensions();const tile=false;
 const reduced=useMotionPreference();const progress=useRef(new Animated.Value(selected?1:0)).current;const hover=useRef(new Animated.Value(0)).current;
 const [focused,setFocused]=useState(false);
 useEffect(()=>{if(reduced){progress.setValue(selected?1:0);return;}const animation=Animated.spring(progress,{toValue:selected?1:0,damping:18,stiffness:190,mass:.8,useNativeDriver:true});animation.start();return()=>animation.stop()},[selected,reduced,progress]);
 const move=(value:number)=>{hover.stopAnimation();if(reduced){hover.setValue(0);return;}Animated.timing(hover,{toValue:value,duration:150,useNativeDriver:true}).start()};
 const ink=featured?'#FFF5E8':dark?'#FFF5E8':'#30241D',muted=featured?'#E2C5A1':dark?'#D7C5AF':'#65513E';
 const iconNode=<View style={{width:gold?40:48,height:gold?40:48,borderRadius:24,backgroundColor:featured?'#80532D':selected?'#80532D':dark?'#4D3B2B':'#F3D2AE',alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={gold?22:25} color={featured||selected?'#FFF9F0':dark?'#E4BD88':'#754623'}/></View>;
 const check=gold?<View style={{width:27,height:27,borderRadius:14,borderWidth:1,borderColor:dark?'#BB9466':'#BC9368',backgroundColor:selected?'#8C6039':'transparent',alignItems:'center',justifyContent:'center'}}><Ionicons name={selected?'checkmark':ar?'arrow-back':'arrow-forward'} size={15} color={selected?'#FFF4E4':dark?'#E7C89F':'#9A704A'}/></View>:<Ionicons name={selected?'checkmark-circle':'ellipse-outline'} size={23} color={featured?'#EDC58E':selected?(dark?'#EDC58E':'#80532D'):dark?'#AE967A':'#A58B6A'}/>;
 return <Animated.View style={{width:tile?'48%':'100%',marginBottom:gold?10:compact?12:0,transform:[{translateY:hover.interpolate({inputRange:[0,1],outputRange:[0,-3]})},{scale:progress.interpolate({inputRange:[0,1],outputRange:[1,1]})}]}}>
 <Pressable accessibilityRole="radio" accessibilityState={{checked:selected}} accessibilityLabel={title} accessibilityHint={ar ? (selected ? "اضغط مرة ثانية لإلغاء التحديد" : "اضغط لاختيار هذا الدور") : (selected ? "Tap again to deselect" : "Tap to select this role")} onPress={onPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onHoverIn={()=>move(1)} onHoverOut={()=>move(0)} style={({pressed})=>({minHeight:gold?92:compact?88:96,height:gold?Math.max(92,Math.ceil(62*fontScale+24)):undefined,padding:gold?12:compact?16:15,borderRadius:gold?25:compact?30:23,borderWidth:selected?2:1.5,shadowColor:'#77471F',shadowOffset:{width:0,height:3},shadowOpacity:selected?.14:compact?.07:0,shadowRadius:selected?10:compact?8:0,elevation:selected?3:compact?2:0,borderColor:gold?(selected?'#A77B3E':dark?'#C2A06C':'#C5A16B'):selected?'#9A602D':focused?'#AD855A':dark?'#9B7852':'#C69C6E',backgroundColor:featured?(selected?'#6A482D':'#3E2B1D'):selected?(dark?'#593D28':'#F3DFC1'):dark?'#352A23':'#FFFBF3',opacity:pressed?.86:1,outlineStyle:focused?'solid':undefined,outlineWidth:focused?2:0,outlineColor:'#B78049',outlineOffset:3,overflow:'hidden'})}>
 {gold&&photoIndex!==undefined&&<RolePhotography index={photoIndex} style={{position:'absolute',top:0,bottom:0,width:80,left:ar?undefined:0,right:ar?0:undefined}}/>}
 {tile?<><View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',justifyContent:'space-between'}}>{iconNode}{check}</View><Text style={{color:muted,fontSize:10,letterSpacing:2,marginTop:16,textAlign:ar?'right':'left'}}>{'0'+(index+1)}</Text><Text style={{color:ink,fontSize:16,lineHeight:25,fontWeight:'800',marginTop:4,textAlign:ar?'right':'left'}}>{title}</Text><Text style={{color:muted,fontSize:12,lineHeight:20,marginTop:5,textAlign:ar?'right':'left'}}>{description}</Text></>:<View style={{flexDirection:ar?'row-reverse':'row',alignItems:'center',gap:gold&&photoIndex!==undefined?9:13,paddingLeft:gold&&photoIndex!==undefined&&!ar?78:0,paddingRight:gold&&photoIndex!==undefined&&ar?78:0}}>{gold&&photoIndex!==undefined?null:iconNode}<View style={{flex:1,minWidth:0}}><EditorialTitle accent={false} style={{fontSize:gold?17:17,lineHeight:gold?25:26,color:ink,textAlign:ar?'right':'left'}}>{title}</EditorialTitle>{description&&<Text style={{fontSize:gold?11:13,lineHeight:gold?17:21,marginTop:4,color:muted,textAlign:ar?'right':'left'}}>{description}</Text>}</View>{check}</View>}
 <Animated.View pointerEvents="none" style={{position:'absolute',bottom:0,left:18,right:18,height:3,borderRadius:2,backgroundColor:dark?'#EDC58E':'#9A6331',opacity:progress,transform:[{scaleX:progress}]}}/>
 </Pressable></Animated.View>
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



