import SuperAdminMetricWheel from '../../../components/SuperAdminMetricWheel';
import SuperAdminControlCenter,{type SuperAdminSummary} from '../../../components/SuperAdminControlCenter';
import { useFonts } from 'expo-font';

import BrandHeader from '../../../components/BrandHeader';
import BrandMonogram from '../../../components/BrandMonogram';

import { palette as motexaTheme } from "../../../components/DesignTokens";
import BrandWordmark from "../../../components/BrandWordmark";
import TouchableOpacity from "../../../components/InteractiveButton";
import { useAppearance } from "../../../components/Appearance";

import { EditorialTitle } from "../../../components/PremiumUI";


import { Text, VisualProvider, HeroReveal } from "../../../components/MotexaVisual";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import * as SecureStore from "../../../components/SessionStore";
import {
  Animated,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";
type IconName = keyof typeof Ionicons.glyphMap;
export default function SuperAdminDashboardScreen() {
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();
  const [dashboardFontsReady] = useFonts({MotexaDashboardScript:require('../../../../assets/fonts/GreatVibes-Regular.ttf'),MotexaMetricEditorial:require('../../../../assets/fonts/GFSDidot-Regular.ttf'),MotexaDashboardArabic:require('../../../../assets/fonts/Tajawal-Medium.ttf')});
  const [dashboardStats,setDashboardStats]=useState<SuperAdminSummary|null>(null);

  const [reloadKey,setReloadKey] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadDashboard = async () => {
        setStatsLoading(true);
        setStatsError(false);

        try {
          const token = await SecureStore.getItemAsync("motexa_access_token");

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
            },
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
    // reloadKey is an explicit invalidation signal for pull-to-refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]),
  );
  const stats: {
    label: string;
    value: string;
    icon: IconName;
  }[] = [
    {
      label: isArabic ? "أدمن مفعّلون" : "Active admins",
      value: statsLoading
        ? "…"
        : statsError
          ? "—"
          : String(dashboardStats?.administrators ?? 0),
      icon: "shield-outline",
    },
    {
      label: isArabic ? "الميكانيكيون" : "Mechanics",
      value: statsLoading
        ? "…"
        : statsError
          ? "—"
          : String(dashboardStats?.mechanics ?? 0),
      icon: "construct-outline",
    },
    {
      label: isArabic ? "مزودو قطع الغيار" : "Parts Providers",
      value: statsLoading?"…":statsError||dashboardStats?.partsProviders===undefined?"—":String(dashboardStats.partsProviders),
      icon: "storefront-outline",
    },
    {
      label: isArabic ? "أصحاب الونشات" : "Tow Providers",
      value: statsLoading?"…":statsError||dashboardStats?.towProviders===undefined?"—":String(dashboardStats.towProviders),
      icon: "car-outline",
    },
  ];

  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const ink = dark ? '#FFF1DF' : '#432D1E';
  const muted = dark ? '#D0B99C' : '#806044';
  const surface = dark ? '#382A21' : '#FFF8EC';
  const border = dark ? '#73553B' : '#E3CFB2';
  const row = isArabic ? 'row-reverse' as const : 'row' as const;
  const align = isArabic ? 'right' as const : 'left' as const;
  const tr = (en: string, ar: string) => isArabic ? ar : en;
  const overviewStats = stats.filter((_,index)=>[0,1,2,3].includes(index));
  return <VisualProvider>
    <LinearGradient colors={dark ? motexaTheme.canvasDark : motexaTheme.canvas} style={{flex:1}}>
      <StatusBar barStyle={dark?'light-content':'dark-content'}/>
      <Animated.ScrollView showsVerticalScrollIndicator={false} scrollEventThrottle={16}
        contentContainerStyle={[s.content,{paddingTop:insets.top,paddingHorizontal:wide?30:16}]}
        refreshControl={<RefreshControl refreshing={statsLoading} onRefresh={()=>setReloadKey(key=>key+1)} tintColor={dark?'#E0A36F':'#80522F'}/>}
      >
        <BrandHeader/>
        <HeroReveal style={{paddingTop:0,paddingBottom:4,paddingHorizontal:4,marginTop:-13}}>
          <BrandMonogram size={200} style={{top:-20,left:undefined,right:0,opacity:.035}}/>
          <Text style={{fontSize:10,lineHeight:20,letterSpacing:isArabic?0:1.6,color:muted,textAlign:align}}>{tr('MOTEXA / ADMINISTRATION','MOTEXA / مساحة الإدارة')}</Text>
          <Text accessibilityRole="header" style={{fontFamily:dashboardFontsReady?(isArabic?'MotexaDashboardArabic':'MotexaDashboardScript'):undefined,fontSize:isArabic?29:42,lineHeight:isArabic?44:54,color:ink,textAlign:align,marginTop:2}}>{tr('A clearer perspective.','منصّتك، برؤية أشمل.')}</Text>
          <Text style={{fontSize:13,lineHeight:23,color:muted,textAlign:align,marginTop:3}}>{tr('Your team. Your community. One connected workspace.','فريقك ومجتمعك، في مساحة عمل مترابطة.')}</Text>
        </HeroReveal>
        <View style={{height:wide?210:126,borderTopLeftRadius:34,borderTopRightRadius:20,borderBottomLeftRadius:20,borderBottomRightRadius:42,overflow:'hidden',backgroundColor:'#39281D'}}>
          <Image accessible={false} source={require('../../../../assets/images/audi-conor-samuel.jpg')} resizeMode="cover" style={{width:'100%',height:'100%'}}/>
          <LinearGradient pointerEvents="none" colors={['#21171000','#21171000','#21171066']} locations={[0,.6,1]} style={StyleSheet.absoluteFill}/>
          <View style={{position:'absolute',bottom:15,left:16,right:16,flexDirection:row,alignItems:'center',gap:8}}><Ionicons name="shield-checkmark-outline" size={16} color="#FFF1DF"/><Text style={{fontSize:11,lineHeight:20,color:'#FFF1DF'}}>{tr('Super Admin workspace','مساحة المسؤول الأعلى')}</Text></View>

        </View>
        <View style={{marginTop:9,paddingHorizontal:12,paddingBottom:14,borderRadius:32,borderWidth:1,borderColor:border,backgroundColor:dark?'#30231B':'#F8EAD7'}}>
        <SuperAdminControlCenter summary={dashboardStats} loading={statsLoading} failed={statsError} refreshKey={reloadKey}>
        <View>
          <View style={[s.sectionHeader,{flexDirection:row,marginTop:16}]} >
            <View style={{flex:1}}><Text style={[s.eyebrow,{color:muted,textAlign:align}]}>{tr('01 / OVERVIEW','01 / نظرة عامة')}</Text><EditorialTitle accent={false} style={[s.sectionTitle,{color:ink,textAlign:align,fontFamily:dashboardFontsReady?(isArabic?'MotexaDashboardArabic':'MotexaDashboardScript'):undefined,fontSize:isArabic?24:32,lineHeight:isArabic?37:43,fontWeight:'normal'}]}>{tr('Platform overview','نظرة على المنصّة')}</EditorialTitle></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('Refresh statistics','تحديث الإحصاءات')} disabled={statsLoading} onPress={()=>setReloadKey(key=>key+1)} style={[s.roundButton,{backgroundColor:surface,borderColor:border}]}><Ionicons name="refresh-outline" size={19} color={muted}/></TouchableOpacity>
          </View>
          <View>
            <View style={{flexDirection:row,flexWrap:'wrap',gap:10}}>
              {overviewStats.map((stat,index)=><HeroReveal key={stat.label} delay={index*40} style={{width:wide?'23%':'47%',flexGrow:1}}>
                <SuperAdminMetricWheel label={stat.label} value={stat.value} icon={stat.icon} size={wide?130:Math.min(132,Math.max(96,(width-108)/2))} numberFont={dashboardFontsReady?'MotexaMetricEditorial':undefined}/>

              </HeroReveal>)}
            </View>
            <View style={{flexDirection:row,alignItems:'center',gap:7,marginTop:13}}>
              <View style={{width:6,height:6,borderRadius:3,backgroundColor:statsError?'#B7684A':statsLoading?'#BB965E':'#789371'}}/>
              <Text accessibilityLiveRegion="polite" style={{flex:1,fontSize:11,lineHeight:20,color:muted,textAlign:align}}>{statsLoading?tr('Updating statistics…','جارٍ تحديث الإحصاءات…'):statsError?tr('Statistics unavailable. Tap refresh to try again.','تعذّر تحميل الإحصاءات. اضغط تحديث لإعادة المحاولة.'):tr('Statistics from your platform','إحصاءات من بيانات منصّتك')}</Text>
            </View>
          </View>
        </View>

        </SuperAdminControlCenter>
        </View>
        <View style={[s.footer,{borderTopColor:border,flexDirection:row}]}><BrandWordmark size={13}/><Text style={{flex:1,fontSize:10,lineHeight:18,color:muted,textAlign:isArabic?'left':'right'}}>{tr('Your automotive community, connected.','مجتمع خدمات السيارات، في مكان واحد.')}</Text></View>
      </Animated.ScrollView>
    </LinearGradient>
  </VisualProvider>;
}
const s=StyleSheet.create({
  content:{width:'100%',maxWidth:1180,alignSelf:'center',paddingBottom:24},
  topbar:{alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:20},
  brandCaption:{fontSize:9,lineHeight:18,letterSpacing:1.5,marginTop:3},
  hero:{borderRadius:28,overflow:'hidden',padding:22,backgroundColor:'#352318'},
  accessBadge:{alignSelf:'flex-start',paddingHorizontal:12,paddingVertical:8,borderRadius:30},
  sectionHeader:{alignItems:'center',gap:12,marginTop:24,marginBottom:12},
  eyebrow:{fontSize:10,lineHeight:19,letterSpacing:1.2,marginBottom:5},
  sectionTitle:{fontSize:21,lineHeight:32,fontWeight:'600'},
  roundButton:{width:44,height:44,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'},
  metric:{minWidth:0,borderWidth:0,borderRadius:0,minHeight:88},
  metricTop:{alignItems:'center',justifyContent:'space-between',marginBottom:12},
  managementCard:{borderRadius:23,borderWidth:1,overflow:'hidden'},
  footer:{marginTop:30,paddingTop:20,borderTopWidth:1,alignItems:'center',gap:18},
});
