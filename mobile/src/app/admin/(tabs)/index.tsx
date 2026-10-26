import {palette as motexaTheme} from '../../../components/DesignTokens';
import BrandWordmark from '../../../components/BrandWordmark';
import TouchableOpacity from "../../../components/InteractiveButton";
import { useAppearance } from "../../../components/Appearance";
import LanguageSwitch from "../../../components/LanguageSwitch";
import { EditorialTitle } from "../../../components/PremiumUI";
import { WorkspacePhotography } from "../../../components/WorkspacePhotography";
import { DashboardPhotography } from "../../../components/DashboardPhotography";
import { Text, VisualProvider } from "../../../components/MotexaVisual";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import * as SecureStore from '../../../components/SessionStore';
import { Alert, Image, ImageBackground, ScrollView, StatusBar, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";
type IconName = keyof typeof Ionicons.glyphMap;
export default function SuperAdminDashboardScreen() {


  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();
const [dashboardStats, setDashboardStats] = useState<{
  administrators: number;
  mechanics: number;
  pendingMechanics: number;
  pendingInvitations: number;
} | null>(null);

const [statsLoading, setStatsLoading] = useState(true);
const [statsError, setStatsError] = useState(false);

useFocusEffect(
  useCallback(() => {
    let active = true;

    const loadDashboard = async () => {
      setStatsLoading(true);
      setStatsError(false);

      try {
        const token = await SecureStore.getItemAsync(
          "motexa_access_token"
        );

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;

        if (!token || !apiUrl) {
          throw new Error("Missing authentication or API URL");
        }

       const response = await fetch(
  `${apiUrl.replace(/\/$/, "")}/api/admin-management/dashboard`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

        if (!response.ok) {
          throw new Error(`Dashboard API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.stats) {
          throw new Error("Invalid dashboard response");
        }

        if (active) {
          setDashboardStats(data.stats);
        }
      } catch (error) {
        console.error("Dashboard error:", error);

        if (active) {
          setDashboardStats(null);
          setStatsError(true);
        }
      } finally {
        if (active) {
          setStatsLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [])
);
  const t = useMemo(
    () =>
      isArabic
        ? {
            greeting: "مرحبًا بعودتك",
            title: "المسؤول الأعلى",
            subtitle: "مركز التحكم والإشراف على منصة MOTEXA",
            overview: "نظرة عامة على النظام",
            admins: "المسؤولون",
            mechanics: "الميكانيكيون",
            providers: "مزودو الخدمات",
            requests: "طلبات الصيانة",
            pending: "طلبات بانتظار المراجعة",
            pendingText:
              "هناك طلبات تحقق تجريبية بانتظار المراجعة من مسؤولي الأقسام.",
            review: "عرض مزودي الخدمات",
            quick: "إدارة المنصة",
            manageAdmins: "إدارة أدمن الأقسام",
            manageMechanics: "إدارة الميكانيكيين",
            manageProviders: "مزودو الخدمات",
            manageRequests: "عرض الطلبات",
            activity: "النشاط الأخير",
            first: "طلب انضمام ميكانيكي",
            firstDesc: "طلب تحقق جديد بانتظار المراجعة",
            second: "طلب صيانة جديد",
            secondDesc: "تم إنشاء طلب خدمة جديد",
            third: "دعوة مسؤول",
            thirdDesc: "دعوة تجريبية بانتظار التفعيل",
            now: "الآن",
            earlier: "منذ 12 دقيقة",
            today: "اليوم",
            demo: "بيانات تجريبية — غير متصلة بالخادم",
            notification: "الإشعارات",
            notificationText: "سيتم تطوير مركز الإشعارات في مرحلة لاحقة.",
            profile: "الملف الشخصي",
            profileText: "سيتم تطوير إعدادات الحساب لاحقًا.",
            footer: "MOTEXA • SUPER ADMIN CONTROL CENTER",
          }
        : {
            greeting: "Welcome back",
            title: "Super Admin",
            subtitle: "Your MOTEXA platform control center",
            overview: "System Overview",
            admins: "Administrators",
            mechanics: "Mechanics",
            providers: "Service Providers",
            requests: "Service Requests",
            pending: "Pending Reviews",
            pendingText:
              "Demo verification requests are waiting for department administrators.",
            review: "View Providers",
            quick: "Platform Management",
            manageAdmins: "Department Administrators",
            manageMechanics: "Manage Mechanics",
            manageProviders: "Service Providers",
            manageRequests: "View Requests",
            activity: "Recent Activity",
            first: "Mechanic Application",
            firstDesc: "A new verification request was submitted",
            second: "New Service Request",
            secondDesc: "A new service request was created",
            third: "Administrator Invitation",
            thirdDesc: "A demo invitation is pending activation",
            now: "Now",
            earlier: "12 min ago",
            today: "Today",
            demo: "Demo data — not connected to backend",
            notification: "Notifications",
            notificationText:
              "The notification center will be developed later.",
            profile: "Profile",
            profileText: "Account settings will be developed later.",
            footer: "MOTEXA • SUPER ADMIN CONTROL CENTER",
          },
    [isArabic],
  );

  const showInfo = (title: string, message: string) => {
    Alert.alert(title, message);
  };

 const stats: {
  label: string;
  value: string;
  icon: IconName;
}[] = [
  {
    label: isArabic ? 'الأدمن' : 'Admins',
    value: statsLoading
      ? "…"
      : statsError
        ? "—"
        : String(dashboardStats?.administrators ?? 0),
    icon: "shield-outline",
  },
  {
    label: isArabic ? 'الميكانيكيون' : 'Mechanics',
    value: statsLoading
      ? "…"
      : statsError
        ? "—"
        : String(dashboardStats?.mechanics ?? 0),
    icon: "construct-outline",
  },
  {
    label: isArabic ? "مزودو قطع الغيار" : "Parts Providers",
    value: "—",
    icon: "storefront-outline",
  },
  {
    label: isArabic ? "مزودو السحب" : "Tow Providers",
    value: "—",
    icon: "car-outline",
  },
  {
    label: t.requests,
    value: "—",
    icon: "document-text-outline",
  },
  {
    label: isArabic ? "بانتظار المراجعة" : "Pending Reviews",
    value: statsLoading
      ? "…"
      : statsError
        ? "—"
        : String(dashboardStats?.pendingMechanics ?? 0),
    icon: "time-outline",
  },
];

  const actions: {
    label: string;
    icon: IconName;
    onPress: () => void;
  }[] = [
    {
      label: t.manageAdmins,
      icon: "shield-checkmark-outline",
      onPress: () => router.push("/admin/admin-management"),
    },
    {
      label: t.manageProviders,
      icon: "storefront-outline",
      onPress: () => router.push("/admin/(tabs)/providers"),
    },
    {
      label: t.manageRequests,
      icon: "clipboard-outline",
      onPress: () => router.push("/admin/(tabs)/requests"),
    },
  ];

  const [providersOpen,setProvidersOpen]=useState(false);
  const departments=[
    {role:'MECHANIC',en:'Mechanics',ar:'الميكانيكيون',descEn:'Applications and accounts',descAr:'طلبات الانضمام والحسابات',photo:1},
    {role:'PARTS_PROVIDER',en:'Spare Parts',ar:'قطع الغيار',descEn:'Parts provider accounts',descAr:'حسابات مزودي قطع الغيار',photo:2},
    {role:'TOW_PROVIDER',en:'Towing',ar:'السحب',descEn:'Roadside service accounts',descAr:'حسابات مزودي خدمة السحب',photo:3},
  ];
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 370 || fontScale > 1.15 ? 2 : 3;
  const ink = dark ? '#FFF1DF' : '#432D1E';
  const muted = dark ? '#D0B99C' : '#806044';
  const surface = dark ? '#3B2C22' : '#FFF9EF';
  const border = dark ? '#816044' : '#D9B991';
  const row = isArabic ? 'row-reverse' as const : 'row' as const;
  const align = isArabic ? 'right' as const : 'left' as const;
  return <VisualProvider><LinearGradient colors={dark?motexaTheme.canvasDark:motexaTheme.canvas} style={{flex:1}}>
    <StatusBar barStyle={dark?"light-content":"dark-content"} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={[s.topbar,{paddingTop:insets.top+7,backgroundColor:dark?'#291F19':'#FBF1E2'}]}>
        <BrandWordmark size={20} style={{flex:1}} />
        <LanguageSwitch compact light unified/>
      </View>
      <View style={{marginHorizontal:0,marginTop:0,borderRadius:0,overflow:'hidden'}}>
      <ImageBackground source={require('../../../../assets/images/motexa-admin-coastal-hero.png')} resizeMode="cover" style={s.hero} imageStyle={{opacity:dark?.72:1}}>
        <LinearGradient colors={['rgba(20,13,8,.1)','rgba(20,13,8,.18)','rgba(20,13,8,.3)']} style={StyleSheet.absoluteFill}/>
        <View style={s.welcome}>
          <Text style={[s.greeting,{textAlign:align}]}>{t.greeting}</Text>
          <EditorialTitle accent={false} style={[s.title,{color:'#FFF5E9',textAlign:align,maxWidth:'67%',alignSelf:isArabic?'flex-end':'flex-start'}]}>{t.title}</EditorialTitle>
          <Text style={[s.subtitle,{textAlign:align,maxWidth:'58%',alignSelf:isArabic?'flex-end':'flex-start'}]}>{isArabic?'كل التفاصيل، في مساحة واحدة.':'Your platform. One workspace.'}</Text>
        </View>
        <View pointerEvents="none" style={{position:'absolute',bottom:-82,left:'-16%',width:'138%',height:110,borderTopLeftRadius:190,borderTopRightRadius:280,backgroundColor:dark?'#30231B':'#FFF9EF',transform:[{rotate:isArabic?'-3deg':'3deg'}]}}/>
      </ImageBackground>
      </View>
      <LinearGradient colors={dark?['#30231B','#33271E','#39281D']:['#FFF9EF','#FBF0E0','#F3DFC4']} style={s.body}>
        <EditorialTitle accent={false} style={s.section}>{t.overview}</EditorialTitle>
        <View style={[s.metrics,{flexDirection:row}]}>
          {stats.filter((_,index)=>[0,1,5].includes(index)).map(stat=><View key={stat.label} accessible accessibilityLabel={stat.label+': '+stat.value} style={[s.metric,{flex:1,minWidth:0,backgroundColor:surface,borderColor:border}]}>
            <View style={[s.icon,{backgroundColor:dark?'#60432E':'#F3D8B7'}]}><Ionicons name={stat.icon} size={21} color={dark?'#F1C68F':'#80522F'}/></View>
            <Text style={[s.value,{color:ink}]}>{stat.value}</Text>
            <Text style={[s.metricLabel,{color:muted}]}>{stat.label}</Text>
          </View>)}
        </View>
        {statsError&&<Text accessibilityRole="alert" style={{color:muted,fontSize:12,lineHeight:20,marginBottom:14,textAlign:align}}>{isArabic?'تعذّر تحميل الإحصاءات. أعد فتح الصفحة للمحاولة مجددًا.':'Statistics could not load. Reopen this screen to try again.'}</Text>}
        <EditorialTitle accent={false} style={s.section}>{t.quick}</EditorialTitle>
        <View style={{padding:11,borderRadius:28,borderWidth:1,borderColor:dark?'#61472F':'#EBD6B9',backgroundColor:dark?'#32241B':'#F7EBD9'}}>
        {[
          {key:'administrators',title:isArabic?'إدارة الأدمن':'Administrators',description:isArabic?'حسابات الأقسام والدعوات':'Department accounts and invitations',icon:'people-outline' as const,photo:0,onPress:actions[0].onPress},
          {key:'providers',title:isArabic?'مزودو الخدمات':'Service Providers',description:isArabic?'الميكانيكيون وقطع الغيار والسحب':'Mechanics, spare parts and towing',icon:'storefront-outline' as const,photo:1,onPress:()=>setProvidersOpen(open=>!open)},
          {key:'requests',title:isArabic?'طلبات الخدمات':'Service Requests',description:isArabic?'متابعة طلبات الخدمات':'Review and follow service requests',icon:'clipboard-outline' as const,photo:2,onPress:actions[2].onPress},
          {key:'profile',title:isArabic?'ملفي الشخصي':'My Profile',description:isArabic?'بيانات حسابك وصلاحياتك':'Your account details and access',icon:'person-outline' as const,photo:3,onPress:()=>router.push('/admin/profile')},
        ].map(item=><View key={item.key}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={item.key==='providers'?{expanded:providersOpen}:undefined} onPress={item.onPress} style={[s.workspaceCard,{flexDirection:row,backgroundColor:surface,borderColor:border}]}>
            <View style={{flex:1,minWidth:0,padding:12,gap:6}}>
              <View style={{flexDirection:row,alignItems:'center',gap:8}}><Ionicons name={item.icon} size={18} color={muted}/><Text style={{flex:1,fontSize:14,lineHeight:22,fontWeight:'600',color:ink,textAlign:align}}>{item.title}</Text></View>
              <Text style={{fontSize:11,lineHeight:18,color:muted,textAlign:align}}>{item.description}</Text>
            </View>
            <View style={{width:'28%',alignSelf:'stretch',overflow:'hidden'}}>
              {item.photo===0?<WorkspacePhotography index={0} style={StyleSheet.absoluteFill}/>:item.photo===1?<DashboardPhotography index={1} style={StyleSheet.absoluteFill}/>:item.photo===2?<WorkspacePhotography index={1} style={StyleSheet.absoluteFill}/>:<Image source={require('../../../../assets/images/motexa-profile-membership.png')} resizeMode="cover" style={{width:'100%',height:'100%'}}/>}
              <View style={{position:'absolute',bottom:9,right:9,width:28,height:28,borderRadius:14,backgroundColor:'#573C29D9',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#E6C6A17A'}}><Ionicons name={item.key==='providers'?(providersOpen?'chevron-up':'chevron-down'):(isArabic?'arrow-back':'arrow-forward')} size={16} color="#FFF9EF"/></View>
            </View>
          </TouchableOpacity>
          {item.key==='providers'&&providersOpen&&<View style={{borderWidth:1,borderColor:border,borderRadius:20,padding:7,marginTop:-3,marginBottom:13,gap:5,backgroundColor:surface}}>{departments.map(dept=><TouchableOpacity key={dept.role} accessibilityRole="button" onPress={()=>router.push({pathname:'/admin/(tabs)/providers',params:{category:dept.role}})} style={{flexDirection:row,alignItems:'center',gap:11,padding:7,minHeight:66,borderRadius:14,backgroundColor:dark?'#30241D':'#F8EFDF'}}><DashboardPhotography index={dept.photo} style={{width:62,height:50,borderRadius:10}}/><View style={{flex:1,minWidth:0}}><Text style={{fontSize:14,lineHeight:22,fontWeight:'600',color:ink,textAlign:align}}>{isArabic?dept.ar:dept.en}</Text><Text style={{fontSize:10,lineHeight:17,color:muted,textAlign:align}}>{isArabic?dept.descAr:dept.descEn}</Text></View><Ionicons name={isArabic?'chevron-back':'chevron-forward'} size={17} color={muted}/></TouchableOpacity>)}</View>}
        </View>)}
        </View>
        <Text style={[s.footer,{color:muted}]}>{t.footer}</Text>
      </LinearGradient>
    </ScrollView>
  </LinearGradient></VisualProvider>;
}
const s=StyleSheet.create({
 workspaceCard:{height:108,minHeight:108,borderWidth:0,borderRadius:19,overflow:'hidden',alignItems:'center',marginBottom:12},
 editorialCard:{minHeight:116,borderRadius:21,paddingHorizontal:13,gap:10},
 editorialPhoto:{position:'absolute',top:0,bottom:0,width:'40%',overflow:'hidden'},
 editorialCopy:{flex:1,paddingVertical:7,paddingEnd:8},
 editorialTitle:{fontSize:21,lineHeight:29,marginBottom:4},
 editorialArrow:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:'#F1D4AE',backgroundColor:'#754D2E',alignItems:'center',justifyContent:'center'},
 buttonIcon:{width:43,height:43,borderRadius:22,alignItems:'center',justifyContent:'center'},
 simpleButtonTitle:{fontSize:16,lineHeight:25,fontWeight:'600',marginBottom:3},
 outlineArrow:{width:32,height:32,borderRadius:16,borderWidth:1,alignItems:'center',justifyContent:'center'},
 profileCard:{borderWidth:1,borderRadius:24,overflow:'hidden',marginTop:8},
 profileInner:{minHeight:112,padding:17,alignItems:'center',gap:13},
 profileAvatar:{width:49,height:49,borderRadius:25,borderWidth:1,borderColor:'#BC9566',backgroundColor:'#795537',alignItems:'center',justifyContent:'center'},
 profileEyebrow:{fontSize:8,lineHeight:16,letterSpacing:1.3,color:'#D9B68A',marginBottom:2},
 profileArrow:{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:'#BB956A',alignItems:'center',justifyContent:'center'},
 providerGroup:{borderWidth:1,borderRadius:23,marginBottom:12,overflow:'hidden'},
 groupHeader:{minHeight:88,padding:15,gap:12,alignItems:'center'},
 department:{borderWidth:1,borderRadius:18,padding:8,gap:12,alignItems:'center',minHeight:92},
 departmentTitle:{fontSize:19,lineHeight:27,marginBottom:2},
 smallArrow:{width:32,height:32,borderRadius:16,backgroundColor:'#704A2B',alignItems:'center',justifyContent:'center',marginHorizontal:2},
 content:{width:'100%',maxWidth:680,alignSelf:'center',paddingBottom:34},
 hero:{width:'100%',overflow:'hidden',height:258,paddingHorizontal:20,justifyContent:'flex-end',paddingTop:20,paddingBottom:48,backgroundColor:'#503522'},
 topbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:16,paddingBottom:8,direction:'ltr',flexWrap:'nowrap'},
 wordmark:{fontSize:16,letterSpacing:2.5,fontWeight:'600'},
 profile:{width:42,height:42,borderRadius:21,backgroundColor:'#4E3526AA',borderWidth:1,borderColor:'#D0AB7B',alignItems:'center',justifyContent:'center'},
 controls:{alignItems:'flex-end',marginTop:10},
 welcome:{position:'absolute',top:23,left:20,right:20},greeting:{fontSize:13,color:'#F2DDC4',marginBottom:3},
 title:{fontSize:27,lineHeight:36,fontWeight:'600'},subtitle:{fontSize:12,lineHeight:21,color:'#F2DDC4',marginTop:5},
 body:{marginTop:0,borderTopLeftRadius:0,borderTopRightRadius:0,paddingTop:19,paddingHorizontal:18},
 section:{fontSize:18,lineHeight:27,fontWeight:'600',marginBottom:12},
 metrics:{flexWrap:'nowrap',gap:8,marginBottom:22},
 metric:{minHeight:100,borderWidth:1,borderRadius:18,padding:7,alignItems:'center',justifyContent:'center'},
 icon:{width:35,height:35,borderRadius:18,alignItems:'center',justifyContent:'center'},value:{fontSize:24,lineHeight:32,marginTop:3},
 metricLabel:{fontSize:10,lineHeight:17,textAlign:'center'},
 action:{minHeight:96,borderRadius:23,borderWidth:1,overflow:'hidden',alignItems:'center',padding:12,gap:10,marginBottom:12},
 photo:{position:'absolute',top:0,bottom:0,width:150},actionText:{flex:1,paddingVertical:4},
 actionTitle:{fontSize:20,lineHeight:28,marginBottom:3},
 arrow:{width:37,height:37,borderRadius:19,backgroundColor:'#704A2B',borderWidth:1,borderColor:'#E2BF8D',alignItems:'center',justifyContent:'center'},
 profileRow:{minHeight:58,borderBottomWidth:1,alignItems:'center',gap:10,marginTop:3},
 footer:{fontSize:8,lineHeight:16,letterSpacing:1,textAlign:'center',marginTop:20}
});
