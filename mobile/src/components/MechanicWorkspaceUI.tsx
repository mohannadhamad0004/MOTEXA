import FloatingRoleTabs from './FloatingRoleTabs';
import { useFonts } from 'expo-font';
import BrandHeader from './BrandHeader';
import BrandMonogram from './BrandMonogram';
import Pressable from "./MotionPressable";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  ScrollView,
  Modal,
  Image,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { workspace } from "./DesignTokens";
import { Text, HeroReveal, useReducedMotion } from "./MotexaVisual";
import { CanvasFill, PanelFill } from "./BrandSurfaces";
import BrandWordmark from "./BrandWordmark";
import { useMechanicTheme } from "./MechanicUI";

const ReviewVisualContext=createContext(false);

export type WorkspaceIcon = keyof typeof Ionicons.glyphMap;
export function WorkspaceButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  small = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: WorkspaceIcon;
  small?: boolean;
}) {
  const m = useMechanicTheme();
  const polished=useContext(ReviewVisualContext);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: small ? 44 : 50,
        maxWidth:"100%",
        borderRadius: 99,
        paddingHorizontal: small ? 14 : 19,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: secondary ? m.border : "#624029",
        backgroundColor: secondary ? (polished?m.soft:m.surface) : "#573822",
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        flexDirection: m.row,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={small ? 16 : 18}
          color={secondary ? m.ink : "#FFF6E8"}
        />
      )}
      <Text
        style={{
          fontSize: small ? 12 : 14,
          fontWeight: "600",
          color: secondary ? m.ink : "#FFF6E8",
          textAlign: "center",
          flexShrink:1,
          lineHeight:small?20:23,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function WorkspaceCard({ children,flat=false }: { children: ReactNode;flat?:boolean }) {
  const m = useMechanicTheme();
  const polished=useContext(ReviewVisualContext);
  const {width}=useWindowDimensions();
  return (
    <View
      style={{
        borderWidth: flat?0:1,
        borderColor: m.border,
        backgroundColor: flat?"transparent":m.surface,
        borderRadius: flat?0:polished?30:workspace.cardRadius,
        padding: polished&&width<370?15:workspace.cardPadding,
        overflow: "hidden",
        gap: 14,
        marginBottom: flat?0:16,
      }}
    >
      {!flat&&<PanelFill radius={26} />}
      {polished&&!flat&&<BrandMonogram size={170} style={{top:12,left:-20,opacity:.025}}/>}
      {children}
    </View>
  );
}
export function WorkspaceBadge({
  label,
  tone = "bronze",
}: {
  label: string;
  tone?: "bronze" | "green" | "red" | "blue" | "grey";
}) {
  const m = useMechanicTheme(),
    color = {
      bronze: ["#F2E4CE", "#865D30"],
      green: ["#E2ECDD", "#426C48"],
      red: ["#F4E1DA", "#9D483D"],
      blue: ["#E3EAF0", "#536E86"],
      grey: ["#E7E1D9", "#766657"],
    }[tone];
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 99,
        backgroundColor: m.dark ? m.soft : color[0],
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: workspace.captionSize, color: m.dark ? m.ink : color[1] }}>
        {label}
      </Text>
    </View>
  );
}
export function WorkspaceAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const m = useMechanicTheme();
  return (
    <View
      style={{
        width: large ? 61 : 43,
        height: large ? 61 : 43,
        borderRadius: 99,
        backgroundColor: m.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ fontSize: large ? 22 : 14, color: m.ink, fontWeight: "600" }}
      >
        {name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((v) => v[0])
          .join("")}
      </Text>
    </View>
  );
}
export function WorkspaceHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const m = useMechanicTheme();
  const polished=useContext(ReviewVisualContext);
  const [ready]=useFonts({MotexaAdminHeading:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaAdminHeadingArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
  return (
    <View style={{ gap: 5, marginBottom: 19 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily:polished&&ready?(m.ar?'MotexaAdminHeadingArabic':'MotexaAdminHeading'):undefined,
          fontSize:polished?(m.ar?27:36):27,
          lineHeight:polished?(m.ar?42:48):36,
          fontWeight:polished?'400':'600',
          color: m.ink,
          textAlign: m.align,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 23,
            color: m.muted,
            textAlign: m.align,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
export function WorkspaceTabs({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const m = useMechanicTheme();
  const polished=useContext(ReviewVisualContext);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 15, flexGrow: 0 }}
      contentContainerStyle={{ flexDirection: m.row, gap: 6 }}
    >
      {items.map((i) => (
        <Pressable
          key={i.key}
          accessibilityRole="tab"
          accessibilityLabel={i.label}
          aria-selected={value===i.key}
          accessibilityState={{ selected: value === i.key }}
          onPress={() => onChange(i.key)}
          style={{
            minHeight:44,
            justifyContent:"center",
            paddingHorizontal: 15,
            paddingVertical: 10,
            borderRadius: 99,
            backgroundColor: value === i.key ? (polished?(m.dark?"#D6B68F":"#EAD4B4"):"#573822") : m.surface,
            borderWidth:1,
            borderColor:m.border,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: value === i.key ? (polished?"#432D1E":"#FFF6E8") : m.muted,
              lineHeight:20,
            }}
          >
            {i.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function WorkspaceSheet({
  visible,
  title,
  children,
  onClose,
  editorial=false,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  editorial?:boolean;
}) {
  const reduced=useReducedMotion();
  const [titleFontsReady]=useFonts({MotexaSheetScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaSheetArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
  const polished=useContext(ReviewVisualContext);
  const m = useMechanicTheme(),
    { width } = useWindowDimensions();
  const scrollPresentation:ViewStyle&{scrollbarWidth?:'thin';scrollbarColor?:string;overscrollBehavior?:string}=Platform.OS==='web'?{scrollbarWidth:'thin',scrollbarColor:m.dark?'#B29470 transparent':'#B99468 transparent',overscrollBehavior:'contain'}:{};
  return (
    <Modal
      transparent
      visible={visible}
      animationType={polished&&reduced?"none":"fade"}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#24170E66",
          justifyContent: width < 720 ? "flex-end" : "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Pressable
          accessibilityLabel={m.t("Close dialog", "إغلاق النافذة")}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 490,
            maxHeight: "87%",
            backgroundColor: m.surface,
            borderRadius: 29,
            borderWidth: 1,
            borderColor: m.border,
            overflow: "hidden",
          }}
        >
          <PanelFill radius={29} />
          <View
            style={{
              flexDirection: m.row,
              alignItems: "center",
              justifyContent: "space-between",
              padding: 21,
              paddingBottom: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ fontFamily:editorial&&titleFontsReady?(m.ar?"MotexaSheetArabic":"MotexaSheetScript"):undefined,fontSize:editorial?(m.ar?26:33):21,lineHeight:editorial?43:30,fontWeight:editorial?"400":"600", color: m.ink, flex: 1 }}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.t("Close", "إغلاق")}
              onPress={onClose}
              style={{ width:44,height:44,alignItems:"center",justifyContent:"center" }}
            >
              <Ionicons name="close" size={21} color={m.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={scrollPresentation}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 21, paddingTop: 7, gap: 13 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function WorkspaceHero({name,unread=0,onNotifications}:{name:string;unread?:number;onNotifications?:()=>void}) {
  const m=useMechanicTheme();
  const [ready]=useFonts({MotexaReviewScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaReviewArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
  return <View style={{marginBottom:16}}>
    <HeroReveal style={{paddingTop:0,paddingBottom:10,gap:5}}>
      <BrandMonogram size={190} style={{top:-22,left:-14,opacity:.04}}/>
      <Text style={{fontSize:10,lineHeight:20,letterSpacing:m.ar?0:1.3,color:m.muted,textAlign:m.align}}>{m.t('MOTEXA / MECHANICS ADMIN','MOTEXA / إدارة الميكانيكيين')}</Text>
      <Text accessibilityRole="header" style={{fontFamily:ready?(m.ar?'MotexaReviewArabic':'MotexaReviewScript'):undefined,fontSize:m.ar?28:38,lineHeight:m.ar?43:49,color:m.ink,textAlign:m.align}}>{m.t('Expertise reviewed. Trust earned.','خبرة تُراجَع. ثقة تُبنى.')}</Text>
      <Text style={{fontSize:13,lineHeight:23,color:m.muted,textAlign:m.align}}>{name?m.t('Welcome back, ','أهلًا بعودتك، ')+name:m.t('Every application. One considered journey.','كل طلب، ضمن رحلة مراجعة واضحة.')}</Text>
    </HeroReveal>
    <View style={{aspectRatio:2.05,overflow:'hidden',borderTopLeftRadius:36,borderTopRightRadius:16,borderBottomLeftRadius:16,borderBottomRightRadius:48}}><Image accessible={false} source={require('../../assets/images/department-workshop-mathias.jpg')} resizeMode="cover" style={{position:'absolute',width:'100%',height:'100%'}}/>
      {onNotifications&&<Pressable accessibilityRole="button" accessibilityLabel={m.t('Notifications','الإشعارات')} onPress={onNotifications} style={{position:'absolute',top:12,right:12,zIndex:1,width:44,height:44,borderRadius:22,backgroundColor:'#30231BAA',alignItems:'center',justifyContent:'center'}}><Ionicons name="notifications-outline" size={21} color="#FFF1DF"/>{unread>0&&<Text style={{position:'absolute',top:0,right:0,fontSize:10,color:'#FFF1DF',backgroundColor:'#8E5C32',borderRadius:9,paddingHorizontal:4}}>{unread>99?'99+':unread}</Text>}</Pressable>}
      <LinearGradient pointerEvents="none" colors={['#21171000','#21171000','#21171088']} locations={[0,.5,1]} style={StyleSheet.absoluteFill}/>
      <View style={{position:'absolute',bottom:28,left:15,right:15,flexDirection:m.row,alignItems:'center',gap:7}}><Ionicons name="construct-outline" size={16} color="#FFF1DF"/><Text style={{fontSize:11,lineHeight:20,color:'#FFF1DF'}}>{m.t('Where expertise earns trust.','هنا تتحوّل الخبرة إلى ثقة.')}</Text></View>
      <Svg pointerEvents="none" width="100%" height={24} viewBox="0 0 390 24" preserveAspectRatio="none" style={{position:'absolute',bottom:-1,left:0}}><Path d="M0 20 C120 33 225 10 300 14 C340 17 370 8 390 0 L390 24 L0 24 Z" fill={m.dark?'#30231B':'#FFF9EF'}/></Svg>
    </View>
  </View>;
}
export function WorkspaceFrame({
  children,
  page,
  onNavigate,
  unread = 0,
  name = "",
  busy = false,
  admin = true,
  hideNavigation = false,
  onSignOut,
}: {
  children: ReactNode;
  page: string;
  onNavigate: (page: string) => void;
  unread?: number;
  name?: string;
  busy?: boolean;
  admin?: boolean;
  hideNavigation?: boolean;
  onSignOut?:()=>void;
}) {
  const m = useMechanicTheme(),
    insets = useSafeAreaInsets(),
    { width } = useWindowDimensions(),
    wide = width >= 1050,
    scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [page]);
  const [menuFontsReady]=useFonts({MotexaMenuScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaMenuArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
  const menuFont=menuFontsReady?(m.ar?'MotexaMenuArabic':'MotexaMenuScript'):undefined;
  const [menuOpen,setMenuOpen]=useState(false);
  const reducedMotion=useReducedMotion();
  const links = admin
    ? [
        ["home", "home-outline", m.t("Overview", "الرئيسية")],
        [
          "applications",
          "document-text-outline",
          m.t("Applications", "الطلبات"),
        ],
        ["directory", "people-outline", m.t("Mechanics", "الميكانيكيون")],
        ["bank", "book-outline", m.t("Question bank", "بنك الأسئلة")],
        ["messages", "chatbubbles-outline", m.t("Conversations", "المحادثات")],
        [
          "notifications",
          "notifications-outline",
          m.t("Notifications", "الإشعارات"),
        ],
      ]
    : [
        [
          "test",
          "clipboard-outline",
          m.t("Professional test", "الاختبار المهني"),
        ],
        [
          "conversation",
          "chatbubbles-outline",
          m.t("Conversation", "المحادثة"),
        ],
        [
          "notifications",
          "notifications-outline",
          m.t("Notifications", "الإشعارات"),
        ],
      ];
  return (
    <ReviewVisualContext.Provider value={true}>
    <View style={{ flex: 1 }}>
      <CanvasFill />
      <View
        style={{
          flex: 1,
          flexDirection: wide ? m.row : "column",
          width: "100%",
          maxWidth: 1560,
          alignSelf: "center",
        }}
      >
        {wide && !hideNavigation && (
          <View
            style={{
              width: 215,
              paddingTop: 30 + insets.top,
              paddingHorizontal: 15,
              borderRightWidth: m.ar?0:1,
              borderLeftWidth: m.ar?1:0,
              borderColor: m.border,
              gap: 9,
            }}
          >
            <BrandWordmark size={24} />
            <View style={{ height: 25 }} />
            {links.map(([key, icon, label]) => (
              <Pressable
                key={key}
                accessibilityLabel={label}
                onPress={() => onNavigate(key)}
                accessibilityRole="button"
                style={{
                  flexDirection: m.row,
                  gap: 11,
                  padding: 13,
                  borderRadius: 99,
                  backgroundColor: page === key ? "#573822" : "transparent",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={icon as WorkspaceIcon}
                  size={19}
                  color={page === key ? "#FFF6E8" : m.muted}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: page === key ? "#FFF6E8" : m.muted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            <View style={{ padding: 12, marginBottom: 20, gap: 5 }}>
              <Text style={{ color: m.ink, fontSize: 13 }}>{name}</Text>
              <Text style={{ color: m.muted, fontSize: 10 }}>
                {m.t(
                  admin ? "Mechanics Admin" : "Mechanic",
                  admin ? "أدمن الميكانيك" : "ميكانيكي",
                )}
              </Text>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{paddingTop:insets.top+4,paddingHorizontal:6,flexDirection:'row',alignItems:'center'}}>
            <View style={{flex:1,minWidth:0}}><BrandHeader/></View>
            {!admin&&<Pressable accessibilityRole="button" accessibilityLabel={m.t('Notifications','الإشعارات')} onPress={()=>onNavigate('notifications')} style={{width:44,height:44,marginRight:6,borderRadius:22,borderWidth:1,borderColor:m.border,alignItems:'center',justifyContent:'center'}}><Ionicons name="notifications-outline" size={19} color={m.ink}/>{unread>0&&<View style={{position:'absolute',top:-3,right:-2,minWidth:16,paddingHorizontal:4,borderRadius:9,backgroundColor:m.soft,borderWidth:1,borderColor:m.border}}><Text style={{fontSize:9,lineHeight:15,textAlign:'center',color:m.ink}}>{unread>99?'99+':unread}</Text></View>}</Pressable>}
          </View>
          {busy && (
            <ActivityIndicator
              color={m.muted}
              size="small"
              accessibilityLabel={m.t("Loading", "تحميل")}
            />
          )}
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: admin&&page==="home"?0:5,
              paddingBottom: wide ? 35 : insets.bottom + 100,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
      {!wide && !hideNavigation && (
        <View style={{position:'absolute',bottom:Math.max(insets.bottom,6),left:12,right:12,maxWidth:650,alignSelf:'center'}}>
          <FloatingRoleTabs selected={menuOpen?'more':admin?(['profile','documents','test','conversation','decision','history'].includes(page)?'applications':['home','applications','messages'].includes(page)?page:'more'):page} onSelect={key=>{if(admin&&key==='more')setMenuOpen(true);else onNavigate(key);}} items={(admin?[
            ['home','home-outline',m.t('Home','الرئيسية')],
            ['applications','people-outline',m.t('Applications','الطلبات')],
            ['messages','chatbubbles-outline',m.t('Conversations','المحادثات')],
            ['more','grid-outline',m.t('More','المزيد')],
          ]:links).map(([key,icon,label])=>({key,icon:icon as WorkspaceIcon,label}))}/>
        </View>
      )}

      {admin&&<Modal transparent visible={menuOpen&&!wide} animationType={reducedMotion?'none':'fade'} onRequestClose={()=>setMenuOpen(false)}>
        <View style={{flex:1,backgroundColor:'#21171066',flexDirection:m.row}}>
          <Pressable accessibilityRole="button" accessibilityLabel={m.t('Close workspace menu','إغلاق قائمة العمل')} onPress={()=>setMenuOpen(false)} style={StyleSheet.absoluteFill}/>
          <View accessibilityViewIsModal style={{width:Math.min(width-36,340),height:'100%',backgroundColor:m.surface,paddingTop:insets.top+18,paddingBottom:insets.bottom+18,borderColor:m.border,borderRightWidth:m.ar?0:1,borderLeftWidth:m.ar?1:0}}>
            <BrandMonogram size={260} style={{top:110,left:0,opacity:.035}}/>
            <View style={{paddingHorizontal:20,flexDirection:m.row,alignItems:'center',gap:10}}>
              <View style={{flex:1}}><BrandWordmark size={23}/></View>
              <Pressable accessibilityRole="button" accessibilityLabel={m.t('Close menu','إغلاق القائمة')} onPress={()=>setMenuOpen(false)} style={{width:44,height:44,borderRadius:22,backgroundColor:m.soft,alignItems:'center',justifyContent:'center'}}><Ionicons name="close-outline" size={23} color={m.ink}/></Pressable>
            </View>
            <View style={{padding:20,gap:6}}><Text style={{fontFamily:menuFont,fontSize:m.ar?28:36,lineHeight:46,color:m.ink,textAlign:m.align}}>{m.t('Your review workspace','مساحة المراجعة')}</Text><Text style={{fontSize:12,lineHeight:21,color:m.muted,textAlign:m.align}}>{m.t('Applications, expertise and conversations.','الطلبات والخبرات والمحادثات، في مكان واحد.')}</Text></View>
            <ScrollView contentContainerStyle={{paddingHorizontal:14,gap:8,paddingBottom:20}}>
              {[...links,['more','grid-outline',m.t('More tools','المزيد من الأدوات')]].map(([key,icon,label],index)=><Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:page===key}} onPress={()=>{setMenuOpen(false);onNavigate(key);}} style={{minHeight:58,padding:13,borderRadius:24,flexDirection:m.row,alignItems:'center',gap:12,backgroundColor:page===key?m.soft:'transparent',borderWidth:1,borderColor:page===key?m.border:'transparent'}}><Ionicons name={icon as WorkspaceIcon} size={21} color={m.ink}/><Text style={{flex:1,fontFamily:menuFont,fontSize:m.ar?21:27,lineHeight:38,color:m.ink,textAlign:m.align}}>{label}</Text><Text style={{fontSize:10,color:m.muted}}>{String(index+1).padStart(2,'0')}</Text></Pressable>)}
            </ScrollView>
            {!!onSignOut&&<Pressable accessibilityRole="button" accessibilityLabel={m.t('Sign out','تسجيل الخروج')} disabled={busy} onPress={()=>{setMenuOpen(false);onSignOut();}} style={{marginHorizontal:20,marginBottom:12,paddingHorizontal:16,minHeight:50,borderRadius:25,borderWidth:1,borderColor:m.border,backgroundColor:m.soft,flexDirection:m.row,alignItems:'center',gap:10,opacity:busy?.5:1}}><Ionicons name="log-out-outline" size={20} color={m.ink}/><Text style={{flex:1,fontSize:13,lineHeight:24,color:m.ink,textAlign:m.align}}>{m.t('Sign out','تسجيل الخروج')}</Text></Pressable>}
            {!!name&&<View style={{paddingHorizontal:24,paddingTop:16,borderTopWidth:1,borderColor:m.border}}><Text style={{fontSize:13,lineHeight:22,color:m.ink,textAlign:m.align}}>{name}</Text></View>}
          </View>
        </View>
      </Modal>}
    </View>
    </ReviewVisualContext.Provider>
  );
}
