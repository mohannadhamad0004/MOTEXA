import {palette as motexaTheme} from '../../components/DesignTokens';
import BrandWordmark from '../../components/BrandWordmark';
import {ManagementBanner} from '../../components/ManagementBanner';
import {DashboardPhotography} from '../../components/DashboardPhotography';
import {EditorialTitle} from '../../components/PremiumUI';
import {LoadingState} from "../../components/LoadingState";
import {useBrandPalette} from "../../components/BrandSurfaces";
import TouchableOpacity from "../../components/InteractiveButton";
import { useAppearanceStyles, useAppearance } from "../../components/Appearance";
import { PanelFill, CanvasFill } from "../../components/BrandSurfaces";
import { LinearGradient } from "expo-linear-gradient";
import LanguageSwitch from "../../components/LanguageSwitch";
import { Heading, Text, VisualProvider, HeroReveal, DecorativeHalo } from "../../components/MotexaVisual";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from '../../components/SessionStore';
import { useCallback, useEffect } from "react";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import MotexaDialog from "../../components/MotexaDialog";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, TextInput, View, Image, ImageBackground, BackHandler, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../i18n/LanguageContext";

type AdminRole = "mechanics" | "providers" | "requests";
type AdminStatus = "active" | "invited" | "suspended";

type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
};
const API_URL = `${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "")}/api`;
type ApiAdmin = {
  id: string;
  fullName: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  adminPermissions: {
    permission: string;
  }[];
};

type ApiInvitation = {
  id: string;
  fullName: string;
  email: string;
  permission: string;
  status: "PENDING";
  expiresAt: string;
};

const COLORS = {
  background: '#FFF9EF',
  surface: "#F7EDDD",
  surfaceLight: "#E8D4B8",
  bronze: "#A26F43",
  text: "#342418",
  muted: "#92765B",
  border: "#D5BFA1",
  green: "#377250",
  red: "#A84437",
};

const INITIAL_ADMINS: AdminAccount[] = [
  {
    id: "1",
    name: "Mechanics Admin",
    email: "mechanics@example.com",
    role: "mechanics",
    status: "active",
  },
  {
    id: "2",
    name: "Providers Admin",
    email: "providers@example.com",
    role: "providers",
    status: "invited",
  },
  {
    id: "3",
    name: "Requests Admin",
    email: "requests@example.com",
    role: "requests",
    status: "active",
  },
];

export default function AdminManagementScreen() {
 const [focusedField,setFocusedField]=useState<string|null>(null);
 const [department,setDepartment]=useState<AdminRole>('mechanics');
 const [detailId,setDetailId]=useState<string|null>(null);
 const [detailTab,setDetailTab]=useState<'details'|'permissions'>('details');
 const [loadError,setLoadError]=useState(false);
 const [adminStatusFilter,setAdminStatusFilter]=useState<AdminStatus|'all'>('all');
 const brandPalette=useBrandPalette();
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();

const [admins, setAdmins] = useState<AdminAccount[]>([]);
const [activationLink, setActivationLink] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
 const detail=admins.find(account=>account.id===detailId);
 useEffect(()=>{if(!detailId)return;const listener=BackHandler.addEventListener('hardwareBackPress',()=>{setDetailId(null);return true;});return()=>listener.remove();},[detailId]);  
const [modalVisible, setModalVisible] = useState(false);
const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AdminRole>("mechanics");
  const [revokeTarget, setRevokeTarget] = useState<AdminAccount | null>(null);
const [revoking, setRevoking] = useState(false);
const [statusTarget, setStatusTarget] = useState<AdminAccount | null>(null);
const [updatingStatus, setUpdatingStatus] = useState(false);
  const loadAdmins = useCallback(async () => {
  try {
    setLoading(true);
    setLoadError(false);

    const token = await SecureStore.getItemAsync(
      "motexa_access_token"
    );

    if (!token || !API_URL) {
      throw new Error("Missing authentication or API configuration.");
    }

    const response = await fetch(`${API_URL}/admin-invitations`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load administrators.");
    }

    const mapRole = (permission: string): AdminRole => {
      if (permission === "MANAGE_MECHANICS") return "mechanics";
      if (permission === "MANAGE_SPARE_PARTS") return "providers";
      return "requests";
    };

    const accounts: AdminAccount[] = (data.admins as ApiAdmin[]).map(
      (admin) => ({
        id: admin.id,
        name: admin.fullName,
        email: admin.email,
        role: mapRole(admin.adminPermissions[0]?.permission ?? ""),
        status: admin.status === "ACTIVE" ? "active" : "suspended",
      })
    );

    const invitations: AdminAccount[] = (
      data.invitations as ApiInvitation[]
    ).map((invitation) => ({
      id: invitation.id,
      name: invitation.fullName,
      email: invitation.email,
      role: mapRole(invitation.permission),
      status: "invited",
    }));

    setAdmins([...invitations, ...accounts]);
  } catch (error) {
    setLoadError(true);
    Alert.alert(
      "Error",
      error instanceof Error ? error.message : "Connection failed."
    );
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  loadAdmins();
}, [loadAdmins]);

  const labels = {
    title: isArabic ? "إدارة المسؤولين" : "Admin Management",
    subtitle: isArabic
      ? "إدارة حسابات المسؤولين وأدوارهم"
      : "Manage administrator accounts and roles",
    add: isArabic ? "إضافة مسؤول" : "Add Administrator",
    total: isArabic ? "إجمالي المسؤولين" : "Total Admins",
    active: isArabic ? "نشط" : "Active",
    invited: isArabic ? "بانتظار التفعيل" : "Invited",
    suspended: isArabic ? "معلّق" : "Suspended",
    name: isArabic ? "الاسم الكامل" : "Full Name",
    email: isArabic ? "البريد الإلكتروني" : "Email Address",
    role: isArabic ? "نوع المسؤول" : "Administrator Role",
create: isArabic ? "إرسال الدعوة" : "Create Invitation",    cancel: isArabic ? "إلغاء" : "Cancel",
    empty: isArabic ? "لا يوجد مسؤولون" : "No administrators found",
  };
const roleLabel = (role: AdminRole) => {
  if (role === "mechanics") {
    return isArabic
      ? "مسؤول الميكانيكيين"
      : "Mechanics Admin";
  }

  if (role === "providers") {
    return isArabic
      ? "مسؤول قطع الغيار"
      : "Spare Parts Admin";
  }

  return isArabic
    ? "مسؤول خدمات السحب"
    : "Towing Admin";
};

  const statusLabel = (status: AdminStatus) => {
    if (status === "active") return labels.active;
    if (status === "invited") return labels.invited;
    return labels.suspended;
  };

  const stats = useMemo(
    () => ({
      total: admins.filter(a=>a.status!=="invited").length,
      active: admins.filter((a) => a.status === "active").length,
      invited: admins.filter((a) => a.status === "invited").length,
    }),
    [admins],
  );

 

const addAdmin = async () => {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName || !cleanEmail) {
    Alert.alert(
      isArabic ? "بيانات ناقصة" : "Missing Information",
      isArabic
        ? "يرجى إدخال الاسم والبريد الإلكتروني."
        : "Please enter the name and email."
    );
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    Alert.alert(
      isArabic ? "بريد غير صحيح" : "Invalid Email",
      isArabic
        ? "يرجى إدخال بريد إلكتروني صحيح."
        : "Please enter a valid email."
    );
    return;
  }

  const permissions: Record<AdminRole, string> = {
    mechanics: "MANAGE_MECHANICS",
    providers: "MANAGE_SPARE_PARTS",
    requests: "MANAGE_TOWING",
  };

  try {
    setSaving(true);

    const token = await SecureStore.getItemAsync(
      "motexa_access_token"
    );

    if (!token || !API_URL) {
      throw new Error(
        isArabic
          ? "انتهت الجلسة أو إعدادات الاتصال غير متوفرة."
          : "Session expired or API configuration is missing."
      );
    }

    const response = await fetch(
      `${API_URL}/admin-invitations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          permission: permissions[selectedRole],
        }),
      }
    );

    const result = await response.json();
    console.log("Invitation response check:", {
  success: result.success,
  responseKeys: Object.keys(result),
  hasActivationLink:
    typeof result.activationLink === "string" &&
    result.activationLink.length > 0,
});

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Failed to create invitation."
      );
    }

    setModalVisible(false);
setName("");
setEmail("");
setSelectedRole("mechanics");

await loadAdmins();

if (typeof result.activationLink === "string" && result.activationLink) {
  setActivationLink(result.activationLink);
} else {
  Alert.alert(
    isArabic ? "تم إنشاء الدعوة" : "Invitation Created",
    isArabic
      ? "تم إرسال الدعوة إلى البريد الإلكتروني. يكمل المستلم التفعيل من رابط الدعوة، ثم يتحقق برمز OTP وينشئ كلمة المرور."
      : "Invitation sent by email. The recipient can open the invitation, verify the OTP, and set a password."
  );
}
  } catch (error) {
    Alert.alert(
      isArabic ? "فشلت العملية" : "Operation Failed",
      error instanceof Error
        ? error.message
        : "An unexpected error occurred."
    );
  } finally {
    setSaving(false);
  }
};

const toggleSuspension = (admin: AdminAccount) => {
  if (admin.status === "invited") {
    setRevokeTarget(admin);
  } else {
    setStatusTarget(admin);
  }
};

const confirmRevoke = async () => {
  if (!revokeTarget || revoking) return;

  try {
    setRevoking(true);

    const token = await SecureStore.getItemAsync(
      "motexa_access_token"
    );

    if (!token || !API_URL) {
      throw new Error("Missing authentication or API URL.");
    }

    const response = await fetch(
      `${API_URL.replace(/\/$/, "")}/admin-invitations/${revokeTarget.id}/revoke`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to revoke invitation.");
    }

    setRevokeTarget(null);
    await loadAdmins();
  } catch (error) {
    Alert.alert(
      isArabic ? "فشل إلغاء الدعوة" : "Revoke Failed",
      error instanceof Error ? error.message : "Connection failed."
    );
  } finally {
    setRevoking(false);
  }
};
 const confirmStatusChange = async () => {
  if (!statusTarget || updatingStatus || statusTarget.status === "invited") {
    return;
  }

  const newStatus =
    statusTarget.status === "active" ? "SUSPENDED" : "ACTIVE";

  try {
    setUpdatingStatus(true);

    const token = await SecureStore.getItemAsync(
      "motexa_access_token"
    );

    if (!token || !API_URL) {
      throw new Error("Missing authentication or API URL.");
    }

    const response = await fetch(
      `${API_URL.replace(/\/$/, "")}/admin-invitations/${statusTarget.id}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to update administrator.");
    }

    setStatusTarget(null);
    await loadAdmins();
  } catch (error) {
    Alert.alert(
      isArabic ? "فشل تحديث الحالة" : "Update Failed",
      error instanceof Error ? error.message : "Connection failed."
    );
  } finally {
    setUpdatingStatus(false);
  }
};

  const direction=isArabic?'row-reverse' as const:'row' as const;
  const align=isArabic?'right' as const:'left' as const;
  const ink=dark?'#FFF2DE':'#432D1E',muted=dark?'#D9C5A9':'#806A52',surface=dark?'#352A23':'#FFFAF1',border=dark?'#765A40':'#E3CEAF';
  const departments: {role:AdminRole;photo:number;icon:keyof typeof Ionicons.glyphMap}[]=[{role:'mechanics',photo:1,icon:'construct-outline'},{role:'providers',photo:2,icon:'cube-outline'},{role:'requests',photo:3,icon:'car-outline'}];
  const visibleAdmins=admins.filter(item=>item.role===department&&(adminStatusFilter==='all'||item.status===adminStatusFilter));
  const initials=(value:string)=>value.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const stateColor=(status:AdminStatus)=>status==='active'?(dark?'#BFCF97':'#526533'):status==='suspended'?(dark?'#F1B39C':'#A34D35'):muted;
  const renderAdmin=({item,index}:{item:AdminAccount;index:number})=><TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'تفاصيل '+item.name:'Details for '+item.name} onPress={()=>{setDetailTab('details');setDetailId(item.id);}} style={[ui.account,{backgroundColor:surface,borderColor:dark?'#61472F':'#E7D7BE',flexDirection:direction,borderRadius:0,borderBottomLeftRadius:index===visibleAdmins.length-1?23:0,borderBottomRightRadius:index===visibleAdmins.length-1?23:0,borderTopWidth:0,borderBottomWidth:index===visibleAdmins.length-1?1:0,marginBottom:0,paddingHorizontal:14,paddingVertical:14,overflow:'hidden'}]}><LinearGradient pointerEvents="none" colors={dark?['#403023','#35271E']:['#FFFCF6','#F8EAD8']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View style={[ui.initials,{backgroundColor:dark?'#65482F':'#F1E0C7'}]}><Text style={{color:ink,fontSize:16}}>{initials(item.name)}</Text></View>
    <View style={{flex:1,minWidth:0,gap:4}}><Text numberOfLines={1} style={{fontSize:15,lineHeight:23,fontWeight:'600',color:ink,textAlign:align}}>{item.name}</Text><Text numberOfLines={1} style={{fontSize:10,lineHeight:17,color:muted,textAlign:align,writingDirection:'ltr'}}>{item.email}</Text></View>
    <View style={[ui.badge,{backgroundColor:item.status==='active'?(dark?'#344634':'#E8EEDC'):item.status==='suspended'?(dark?'#56352A':'#F9E4D8'):(dark?'#58432E':'#F8EBD3')}]}><Text style={{fontSize:10,lineHeight:17,color:stateColor(item.status)}}>{statusLabel(item.status)}</Text></View>
    <Ionicons name={isArabic?'chevron-back':'chevron-forward'} size={17} color={muted}/>
    {index<visibleAdmins.length-1&&<View pointerEvents="none" style={{position:'absolute',bottom:0,left:isArabic?14:68,right:isArabic?68:14,height:1,backgroundColor:dark?'#584332':'#EFE2CF'}}/>}
  </TouchableOpacity>;
  const topbar=(back:()=>void)=><View style={[ui.topbar,{flexDirection:direction}]}><TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'رجوع':'Back'} onPress={back} style={ui.back}><Ionicons name={isArabic?'arrow-forward':'arrow-back'} size={21} color={ink}/></TouchableOpacity><BrandWordmark style={{color:ink,fontSize:15,letterSpacing:2.5,flex:1,fontWeight:'600'}} /><LanguageSwitch light compact unified/></View>;
  return (
    <VisualProvider><View style={styles.container}><LinearGradient pointerEvents="none" colors={dark?motexaTheme.canvasDark:motexaTheme.canvas} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
      {detail?<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.listContent,{paddingTop:insets.top+8,paddingBottom:40}]}>
        {topbar(()=>setDetailId(null))}
        <ManagementBanner index={2} style={ui.profileHero}><LinearGradient colors={['rgba(25,17,11,.15)','rgba(25,17,11,.88)']} style={StyleSheet.absoluteFill}/><View style={[ui.identityAvatar,{backgroundColor:'#EFD9B8'}]}><EditorialTitle accent={false} style={{fontSize:27,lineHeight:36,color:'#432D1E'}}>{initials(detail.name)}</EditorialTitle></View><EditorialTitle accent={false} style={{fontSize:23,lineHeight:33,color:'#FFF3E1',textAlign:'center'}}>{detail.name}</EditorialTitle><Text style={{fontSize:12,lineHeight:21,color:'#E7D2B7'}}>{roleLabel(detail.role)}</Text><View style={[ui.badge,{backgroundColor:detail.status==='active'?'#647136':detail.status==='suspended'?'#9C5037':'#8A6543',marginTop:6}]}><Text style={{fontSize:10,color:'#FFF6E6'}}>{statusLabel(detail.status)}</Text></View></ManagementBanner>
        <View style={[ui.detailTabs,{backgroundColor:dark?'#453123':'#F2E2CB',flexDirection:direction}]}>{(['details','permissions'] as const).map(tab=><TouchableOpacity key={tab} accessibilityRole="tab" accessibilityState={{selected:detailTab===tab}} onPress={()=>setDetailTab(tab)} style={[ui.detailTab,{backgroundColor:detailTab===tab?'#654127':'transparent'}]}><Ionicons name={tab==='details'?'person-outline':'list-outline'} size={18} color={detailTab===tab?'#FFF1DC':muted}/><Text style={{fontSize:12,color:detailTab===tab?'#FFF1DC':muted}}>{tab==='details'?(isArabic?'التفاصيل':'Details'):(isArabic?'الصلاحيات':'Permissions')}</Text></TouchableOpacity>)}</View>
        <EditorialTitle accent={false} style={[ui.section,{color:ink,textAlign:align}]}>{detailTab==='details'?(isArabic?'معلومات الحساب':'Account information'):(isArabic?'صلاحيات القسم':'Department permissions')}</EditorialTitle>
        <View style={[ui.accountInfoPanel,{backgroundColor:surface,borderColor:border}]}>
        {[[labels.name,detail.name],[labels.email,detail.email],[isArabic?'القسم':'Department',roleLabel(detail.role)],[isArabic?'الصلاحية':'Permission',detail.role==='mechanics'?(isArabic?'إدارة الميكانيكيين':'Manage mechanics'):detail.role==='providers'?(isArabic?'إدارة قطع الغيار':'Manage spare parts'):(isArabic?'إدارة خدمات السحب':'Manage towing')]].filter(([label])=>detailTab==='details'||label===(isArabic?'القسم':'Department')||label===(isArabic?'الصلاحية':'Permission')).map(([label,value],index)=><View key={label} style={[ui.accountInfoRow,{flexDirection:direction,borderTopWidth:index?1:0,borderTopColor:dark?'#634B36':'#E9D7BD'}]}>
          <View style={[ui.infoIcon,{backgroundColor:dark?'#59402C':'#F4E2C8'}]}><Ionicons name={label===labels.name?'person-outline':label===labels.email?'mail-outline':label===(isArabic?'القسم':'Department')?'briefcase-outline':'key-outline'} size={18} color={muted}/></View>
          <View style={{flex:1,minWidth:0,gap:3}}><Text style={{fontSize:11,lineHeight:18,color:muted,textAlign:align}}>{label}</Text><Text selectable style={{fontSize:14,lineHeight:23,color:ink,textAlign:align,writingDirection:label===labels.email?'ltr':isArabic?'rtl':'ltr'}}>{value}</Text></View>
        </View>)}
        </View>
        <EditorialTitle accent={false} style={[ui.section,{color:ink,textAlign:align,marginTop:17}]}>{isArabic?'إدارة الحساب':'Account controls'}</EditorialTitle>
        <TouchableOpacity accessibilityRole="button" disabled={loading||updatingStatus||revoking} onPress={()=>{setDetailId(null);toggleSuspension(detail);}} style={[ui.control,{backgroundColor:surface,borderColor:border,flexDirection:direction}]}><View style={[ui.initials,{width:36,height:36,backgroundColor:dark?'#65482F':'#F0D9B9'}]}><Ionicons name={detail.status==='invited'?'close-outline':detail.status==='active'?'pause-outline':'play-outline'} size={20} color={muted}/></View><View style={{flex:1}}><Text style={{fontSize:14,lineHeight:23,color:ink,fontWeight:'600',textAlign:align}}>{detail.status==='invited'?(isArabic?'إلغاء الدعوة':'Revoke invitation'):detail.status==='active'?(isArabic?'تعليق الحساب':'Suspend account'):(isArabic?'إعادة تفعيل الحساب':'Reactivate account')}</Text><Text style={{fontSize:10,lineHeight:18,color:muted,textAlign:align}}>{detail.status==='invited'?(isArabic?'إلغاء صلاحية رابط التفعيل':'Invalidate the activation invitation'):detail.status==='active'?(isArabic?'إيقاف الوصول مؤقتًا':'Temporarily block account access'):(isArabic?'استعادة الوصول للحساب':'Restore account access')}</Text></View><Ionicons name={isArabic?'chevron-back':'chevron-forward'} size={18} color={muted}/></TouchableOpacity>
        <Text style={{fontSize:11,lineHeight:20,color:muted,textAlign:align,marginTop:12,paddingHorizontal:8}}>{isArabic?'يمكن إعادة تفعيل الحساب المعلّق. لا يتم حذف بيانات الحساب.':'Suspended accounts can be reactivated. Account records are retained.'}</Text>
      </ScrollView>:<FlatList data={visibleAdmins} keyExtractor={item=>item.status==='invited'?'invite-'+item.id:item.id} renderItem={renderAdmin} showsVerticalScrollIndicator={false} refreshing={loading} onRefresh={loadAdmins} contentContainerStyle={[styles.listContent,{paddingTop:insets.top+8}]} ListHeaderComponent={<>
        {topbar(()=>router.back())}
        <ImageBackground source={require('../../../assets/images/motexa-administration-office.png')} resizeMode="cover" style={{width:'100%',minHeight:168,borderRadius:24,overflow:'hidden',backgroundColor:surface,marginBottom:15,borderWidth:1,borderColor:dark?'#61472F':'#EFDFC9'}}>
          <LinearGradient pointerEvents="none" colors={dark?['#352A23','#352A23F0','#352A2300']:['#FFFAF1','#FFFAF1ED','#FFFAF100']} locations={[0,0.43,0.76]} start={{x:isArabic?1:0,y:0}} end={{x:isArabic?0:1,y:0}} style={StyleSheet.absoluteFill}/>
          <View style={{width:'63%',alignSelf:isArabic?'flex-end':'flex-start',padding:18,minHeight:168,justifyContent:'center',gap:8}}><EditorialTitle accent={false} style={{fontSize:24,lineHeight:33,fontWeight:'600',color:ink,textAlign:align}}>{isArabic?'إدارة الأدمن':'Administration'}</EditorialTitle><Text style={{fontSize:12,lineHeight:20,color:muted,textAlign:align,maxWidth:'86%'}}>{isArabic?'إدارة فرق الأدمن وصلاحيات الأقسام':'Manage your department teams'}</Text></View>
        </ImageBackground>
        <View style={[ui.stats,{flexDirection:direction}]}>{[{label:labels.total,value:stats.total,icon:'people-outline' as const,tint:dark?'#58432E':'#F1E4D0'},{label:labels.active,value:stats.active,icon:'person-outline' as const,tint:dark?'#354433':'#E8EEDC'},{label:isArabic?'دعوات معلّقة':'Pending invites',value:stats.invited,icon:'time-outline' as const,tint:dark?'#58432E':'#FAECD3'}].map(stat=><View key={stat.label} style={[ui.stat,{backgroundColor:surface,borderColor:dark?'#61472F':'#EDDFC9',gap:3}]}><View style={{width:29,height:29,borderRadius:15,backgroundColor:stat.tint,alignItems:'center',justifyContent:'center'}}><Ionicons name={stat.icon} size={16} color={muted}/></View><Text style={{fontSize:23,lineHeight:30,color:ink,fontWeight:'600'}}>{loading||loadError?'—':stat.value}</Text><Text style={{fontSize:10,lineHeight:17,color:muted,textAlign:'center'}}>{stat.label}</Text></View>)}</View>
        <TouchableOpacity accessibilityRole="button" onPress={()=>{setSelectedRole(department);setModalVisible(true);}} style={ui.invite}><Ionicons name="add-outline" size={20} color="#FFF2DE"/><Text style={{color:'#FFF2DE',fontSize:14,fontWeight:'600'}}>{isArabic?'دعوة أدمن جديد':'Invite administrator'}</Text></TouchableOpacity>
        <EditorialTitle accent={false} style={[ui.section,{color:ink,textAlign:align}]}>{isArabic?'الأقسام':'Departments'}</EditorialTitle>
        <View style={{padding:7,borderWidth:1,borderColor:border,borderRadius:25,overflow:'hidden',backgroundColor:dark?'#32271E':'#F7ECDC',marginBottom:13}}><LinearGradient pointerEvents="none" colors={dark?['#403023','#35271E']:['#FFFCF6','#F8EAD8']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        {departments.map(dept=><TouchableOpacity key={dept.role} accessibilityRole="button" accessibilityState={{selected:department===dept.role}} onPress={()=>{setDepartment(dept.role);setAdminStatusFilter('all');}} style={[ui.department,{borderColor:department===dept.role?'#AD7B45':border,backgroundColor:department===dept.role?(dark?'#593D28':'#F4E5CE'):surface,flexDirection:direction}]}>
          <View style={{flex:1,minWidth:0,padding:10}}><View style={{flexDirection:direction,gap:8,alignItems:'center'}}><Ionicons name={dept.icon} size={20} color={muted}/><EditorialTitle accent={false} style={{flex:1,fontSize:15,lineHeight:23,color:ink,textAlign:align}}>{roleLabel(dept.role)}</EditorialTitle></View><Text style={{fontSize:11,lineHeight:19,color:muted,textAlign:align,marginTop:3}}>{loading||loadError?'—':admins.filter(item=>item.role===dept.role&&item.status!=='invited').length} {isArabic?'حساب أدمن':'admin accounts'}</Text></View>
          <DashboardPhotography index={dept.photo} style={{width:80,height:78,borderRadius:14}}/>
          <View style={[ui.deptArrow,{backgroundColor:department===dept.role?'#946333':dark?'#483426':'#F6E9D8'}]}><Ionicons name={department===dept.role?'checkmark':isArabic?'chevron-back':'chevron-forward'} size={18} color={department===dept.role?'#FFF2DE':muted}/></View>
        </TouchableOpacity>)}
        </View>
        <View style={{backgroundColor:surface,borderTopLeftRadius:23,borderTopRightRadius:23,borderBottomLeftRadius:visibleAdmins.length?0:23,borderBottomRightRadius:visibleAdmins.length?0:23,borderWidth:1,borderBottomWidth:visibleAdmins.length?0:1,borderColor:dark?'#61472F':'#E7D7BE',padding:14,marginBottom:0,overflow:'hidden'}}><LinearGradient pointerEvents="none" colors={dark?['#403023','#35271E']:['#FFFCF6','#F8EAD8']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        <EditorialTitle accent={false} style={[ui.section,{color:ink,textAlign:align,marginBottom:5}]}>{roleLabel(department)}</EditorialTitle><Text style={{fontSize:11,lineHeight:19,color:muted,textAlign:align,marginBottom:12}}>{isArabic?'حسابات الأدمن وحالات الوصول للقسم المختار':'Administrator accounts and access for this department'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingBottom:15,flexDirection:direction}}>{(['all','active','invited','suspended'] as const).map(value=><TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{selected:adminStatusFilter===value}} onPress={()=>setAdminStatusFilter(value)} style={[ui.filter,{borderColor:border,backgroundColor:adminStatusFilter===value?(dark?'#735131':'#EAD1AE'):surface}]}><Text style={{fontSize:11,lineHeight:20,color:ink}}>{value==='all'?(isArabic?'الكل':'All'):statusLabel(value)}</Text></TouchableOpacity>)}</ScrollView>
        </View>
        {loadError&&<TouchableOpacity accessibilityRole="button" onPress={loadAdmins} style={[ui.infoPill,{borderColor:border,backgroundColor:surface}]}><Text style={{color:ink,lineHeight:22,textAlign:align}}>{isArabic?'تعذّر تحميل الحسابات. اضغط للمحاولة مجددًا.':'Could not load accounts. Tap to retry.'}</Text></TouchableOpacity>}
      </>} ListEmptyComponent={loading?<LoadingState label={isArabic?'جارٍ تحميل الحسابات…':'Loading accounts…'}/>:!loadError?<View style={[ui.identity,{backgroundColor:surface,borderColor:border}]}><Ionicons name="people-outline" size={26} color={muted}/><Text style={{color:muted,fontSize:13,lineHeight:23,textAlign:'center',marginTop:9}}>{isArabic?'لا توجد حسابات تطابق هذا القسم والحالة.':'No accounts match this department and status.'}</Text></View>:null}/>} 

      <Modal visible={modalVisible} animationType="slide" onRequestClose={()=>{if(!saving)setModalVisible(false);}}>
        <KeyboardAvoidingView style={{flex:1,backgroundColor:dark?'#2C211A':'#FCF3E5'}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.listContent,{paddingTop:insets.top+8,paddingBottom:insets.bottom+28}]}>
          {topbar(()=>{if(!saving)setModalVisible(false);})}
          <ManagementBanner index={1} style={ui.inviteHero}><LinearGradient colors={dark?['#2C211A','rgba(44,33,26,.2)']:['#FCF3E5','rgba(252,243,229,.15)']} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill}/><EditorialTitle accent={false} style={{fontSize:29,lineHeight:40,color:ink,textAlign:align}}>{isArabic?'دعوة أدمن جديد':'Invite New Administrator'}</EditorialTitle><Text style={{fontSize:12,lineHeight:20,color:muted,textAlign:align,maxWidth:'80%'}}>{isArabic?'أرسل دعوة لأدمن قسم جديد':'Send an invitation to a department admin.'}</Text></ManagementBanner>
          <View style={[ui.formCard,{backgroundColor:surface,borderColor:border}]}>
            <Text style={[styles.inputLabel,{textAlign:align,fontSize:12,fontWeight:'500',color:muted,marginBottom:8}]}>{labels.name}</Text>
            <View style={[ui.inputWrap,{borderColor:focusedField==='name'?'#A67540':border,flexDirection:direction}]}><Ionicons name="person-outline" size={19} color={muted}/><TextInput value={name} onChangeText={setName} editable={!saving} onFocus={()=>setFocusedField('name')} onBlur={()=>setFocusedField(null)} placeholder={isArabic?'أدخل الاسم الكامل':'Enter full name'} placeholderTextColor={muted} autoCapitalize="words" accessibilityLabel={labels.name} style={{flex:1,minWidth:0,minHeight:50,color:ink,fontSize:14,textAlign:align}}/></View>
            <Text style={[styles.inputLabel,{textAlign:align}]}>{labels.email}</Text>
            <View style={[ui.inputWrap,{borderColor:focusedField==='email'?'#A67540':border,flexDirection:direction}]}><Ionicons name="mail-outline" size={19} color={muted}/><TextInput value={email} onChangeText={setEmail} editable={!saving} onFocus={()=>setFocusedField('email')} onBlur={()=>setFocusedField(null)} placeholder={isArabic?'أدخل البريد الإلكتروني':'Enter email address'} placeholderTextColor={muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} accessibilityLabel={labels.email} style={{flex:1,minWidth:0,minHeight:47,color:ink,fontSize:13,textAlign:align,writingDirection:'ltr'}}/></View>
            <Text style={[styles.inputLabel,{textAlign:align}]}>{isArabic?'صلاحية القسم':'Department Permission'}</Text>
            {departments.map(dept=><TouchableOpacity key={dept.role} accessibilityRole="radio" accessibilityState={{checked:selectedRole===dept.role}} disabled={saving} onPress={()=>setSelectedRole(dept.role)} style={[ui.roleChoice,{borderColor:selectedRole===dept.role?'#A67540':border,backgroundColor:selectedRole===dept.role?(dark?'#513B27':'#F6E6D0'):'transparent',flexDirection:direction}]}><Ionicons name={selectedRole===dept.role?'radio-button-on':'radio-button-off'} size={19} color={muted}/><View style={[ui.initials,{backgroundColor:dark?'#65482F':'#F0D9B9'}]}><Ionicons name={dept.icon} size={21} color={muted}/></View><View style={{flex:1}}><EditorialTitle accent={false} style={{fontSize:18,lineHeight:27,color:ink,textAlign:align}}>{roleLabel(dept.role)}</EditorialTitle><Text style={{fontSize:10,lineHeight:17,color:muted,textAlign:align}}>{dept.role==='mechanics'?(isArabic?'إدارة الميكانيكيين وطلبات اعتمادهم':'Manage mechanics and verification requests'):dept.role==='providers'?(isArabic?'إدارة حسابات مزودي قطع الغيار':'Manage spare parts provider accounts'):(isArabic?'إدارة حسابات مزودي خدمات السحب':'Manage towing provider accounts')}</Text></View></TouchableOpacity>)}
            <View style={[ui.notice,{backgroundColor:dark?'#493526':'#F4E3CB',flexDirection:direction}]}><Ionicons name="information-circle" size={21} color={muted}/><Text style={{flex:1,color:muted,fontSize:11,lineHeight:19,textAlign:align}}>{isArabic?'تُرسل الدعوة إلى البريد الإلكتروني، وصلاحيتها 24 ساعة.':'The invitation is sent by email and is valid for 24 hours.'}</Text></View>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={addAdmin} style={[ui.invite,ui.inviteSubmit,{marginBottom:10,opacity:saving?.6:1}]}><Ionicons name="paper-plane-outline" size={18} color="#FFF2DE"/><Text style={{fontSize:14,color:'#FFF2DE'}}>{saving?(isArabic?'جارٍ إرسال الدعوة…':'Sending invitation…'):(isArabic?'إرسال الدعوة':'Send Invitation')}</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={()=>setModalVisible(false)} style={[ui.cancel,{borderColor:border}]}><Text style={{color:ink,fontSize:13}}>{labels.cancel}</Text></TouchableOpacity>
          </View>
        </ScrollView></KeyboardAvoidingView>
      </Modal>

     <Modal
  visible={activationLink !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setActivationLink(null)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalCard}>
      <EditorialTitle accent={false} style={styles.modalTitle}>
        {isArabic
          ? "رابط تفعيل المسؤول"
          : "Administrator Activation Link"}
      </EditorialTitle>

      <Text
        selectable
        style={{
          color: COLORS.text,
          fontSize: 13,
          lineHeight: 22,
          marginBottom: 20,
        }}
      >
        {activationLink}
      </Text>

      {/* Copy Link */}
      <TouchableOpacity
        style={styles.modalSubmit}
        onPress={async () => {
          if (!activationLink) return;

          await Clipboard.setStringAsync(activationLink);

          Alert.alert(
            isArabic ? "تم النسخ" : "Copied",
            isArabic
              ? "تم نسخ رابط التفعيل."
              : "Activation link copied."
          );
        }}
      >
        <Text style={styles.modalSubmitText}>
          {isArabic ? "نسخ الرابط" : "Copy Link"}
        </Text>
      </TouchableOpacity>

      {/* Open Activation */}
      <TouchableOpacity
        style={styles.modalSubmit}
        onPress={() => {
          if (!activationLink) return;

          try {
            const url = new URL(activationLink);
            const token = url.searchParams.get("token");

            if (!token) {
              Alert.alert(
                "Invalid Link",
                "Activation token is missing."
              );
              return;
            }

            setActivationLink(null);

            router.push({
              pathname: "/auth/admin-activation",
              params: { token },
            });
          } catch {
            Alert.alert(
              "Invalid Link",
              "Unable to open activation link."
            );
          }
        }}
      >
        <Text style={styles.modalSubmitText}>
          {isArabic
            ? "فتح صفحة التفعيل"
            : "Open Activation"}
        </Text>
      </TouchableOpacity>

      {/* Close */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => setActivationLink(null)}
      >
        <Text style={styles.cancelText}>
          {isArabic ? "إغلاق" : "Close"}
        </Text>
      </TouchableOpacity>
    </View>
    
  </View>
</Modal>
<MotexaDialog
  visible={statusTarget !== null}
  type="warning"
  title={
    statusTarget?.status === "active"
      ? isArabic ? "تعليق المسؤول؟" : "Suspend Administrator?"
      : isArabic ? "إعادة تفعيل المسؤول؟" : "Reactivate Administrator?"
  }
  message={
    statusTarget?.status === "active"
      ? isArabic
        ? `هل تريد تعليق حساب ${statusTarget?.name ?? ""}؟`
        : `Suspend the account of ${statusTarget?.name ?? ""}?`
      : isArabic
        ? `هل تريدين إعادة تفعيل حساب ${statusTarget?.name ?? ""}؟`
        : `Reactivate the account of ${statusTarget?.name ?? ""}?`
  }
  confirmText={
    statusTarget?.status === "active"
      ? isArabic ? "تعليق" : "Suspend"
      : isArabic ? "إعادة تفعيل" : "Reactivate"
  }
  cancelText={isArabic ? "رجوع" : "Cancel"}
  loading={updatingStatus}
  onConfirm={confirmStatusChange}
  onCancel={() => setStatusTarget(null)}
/>
      <MotexaDialog
  visible={revokeTarget !== null}
  type="warning"
  title={isArabic ? "إلغاء الدعوة؟" : "Revoke Invitation?"}
  message={
    isArabic
      ? `هل تريدين إلغاء دعوة ${revokeTarget?.name ?? ""}؟ لن يتمكن من تفعيل الحساب بهذه الدعوة.`
      : `Are you sure you want to revoke the invitation for ${revokeTarget?.name ?? ""}? This invitation will no longer be valid.`
  }
  confirmText={isArabic ? "إلغاء الدعوة" : "Revoke"}
  cancelText={isArabic ? "رجوع" : "Cancel"}
  loading={revoking}
  onConfirm={confirmRevoke}
  onCancel={() => setRevokeTarget(null)}
/>
    </View></VisualProvider>
  );
}

const ui=StyleSheet.create({
 accountInfoPanel:{borderWidth:1,borderRadius:27,paddingHorizontal:16,overflow:'hidden'},
 accountInfoRow:{minHeight:71,paddingVertical:13,alignItems:'center',gap:12},
 infoIcon:{width:35,height:35,borderRadius:18,alignItems:'center',justifyContent:'center'},
 profileHero:{minHeight:230,borderRadius:22,overflow:'hidden',alignItems:'center',justifyContent:'flex-end',padding:18,marginBottom:10},
 detailTabs:{flexDirection:'row',gap:5,borderRadius:18,padding:5,marginBottom:19},detailTab:{flex:1,minHeight:46,borderRadius:14,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},
 inviteHero:{minHeight:126,borderRadius:24,overflow:'hidden',padding:16,justifyContent:'center',marginBottom:18},formCard:{borderWidth:1,borderRadius:28,padding:19},
 inputWrap:{borderWidth:1,borderRadius:28,paddingHorizontal:16,gap:10,alignItems:'center',marginBottom:20},roleChoice:{borderWidth:1,borderRadius:25,padding:13,gap:11,alignItems:'center',marginBottom:10,minHeight:82},
 notice:{borderRadius:23,padding:13,gap:10,alignItems:'center',marginTop:7,marginBottom:17},inviteSubmit:{minHeight:52,borderRadius:28,backgroundColor:'#573A25'},cancel:{minHeight:49,borderRadius:26,borderWidth:1,alignItems:'center',justifyContent:'center'},
 topbar:{alignItems:'center',gap:7,marginBottom:18,flexWrap:'wrap'},back:{minWidth:38,minHeight:42,borderRadius:22,alignItems:'center',justifyContent:'center'},
 pageTitle:{fontSize:29,lineHeight:41,marginBottom:16},hero:{minHeight:147,padding:19,justifyContent:'flex-end',marginBottom:16},
 stats:{gap:8,marginBottom:13},stat:{flex:1,borderWidth:1,borderRadius:22,paddingVertical:9,paddingHorizontal:5,alignItems:'center'},
 invite:{minHeight:46,borderRadius:27,backgroundColor:'#573A25',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginBottom:19},
 section:{fontSize:19,lineHeight:28,marginBottom:10},department:{minHeight:82,borderWidth:0,borderRadius:18,overflow:'hidden',alignItems:'center',marginBottom:9},
 deptArrow:{width:28,height:28,borderRadius:14,marginHorizontal:7,alignItems:'center',justifyContent:'center'},
 filter:{minHeight:40,paddingHorizontal:14,borderWidth:1,borderRadius:22,alignItems:'center',justifyContent:'center'},
 account:{borderWidth:1,borderRadius:21,padding:11,gap:10,alignItems:'center',marginBottom:8,minHeight:74},
 initials:{width:41,height:41,borderRadius:22,alignItems:'center',justifyContent:'center'},badge:{paddingHorizontal:10,paddingVertical:5,borderRadius:18},
 identity:{borderWidth:1,borderRadius:34,padding:19,alignItems:'center',marginBottom:20},identityAvatar:{width:61,height:61,borderRadius:31,alignItems:'center',justifyContent:'center',marginBottom:8},
 infoPill:{minHeight:47,borderWidth:1,borderRadius:18,paddingHorizontal:17,paddingVertical:12,gap:12,alignItems:'center',marginBottom:8},
 control:{minHeight:66,borderWidth:1,borderRadius:21,paddingHorizontal:14,paddingVertical:10,gap:11,alignItems:'center'}
});
const baseStyles = StyleSheet.create({
  managementHero: {
    padding:22,
    marginHorizontal:-6,
    borderRadius:24,
    overflow:"hidden",
    marginBottom:20,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF9EF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 42,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 8,
  },
  backText: {
    color: COLORS.bronze,
    fontSize: 12,
    fontWeight: "600",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 0,
  },
  brand: {
    color: "#98623B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3.2,
    marginBottom: 0,
  },
  heading: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "600",
    marginBottom: 8,
    lineHeight: 40,
  },
  subtitle: {
    color: "#8C735D",
    fontSize: 14,
    marginBottom: 26,
    lineHeight: 22,
  },
  demoNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
  },
  demoText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F3E4CE",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1B28B",
  },
  statValue: {
    color: "#493122",
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 6,
  },
  statLabel: {
    color: "#8C735D",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  addButton: {
    backgroundColor: "#D2A46C",
    minHeight: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 29,
  },
  addButtonText: {
    color: "#3B2817",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#654C38",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginBottom: 16,
  },
  adminCard: {
    backgroundColor: "#FCFAF5",
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#C69C6E",
    overflow: "hidden",
  },
  adminTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#E4CAA5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 0,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    color: "#342418",
    fontSize: 21,
    fontWeight: "600",
    marginBottom: 5,
    lineHeight: 28,
  },
  adminEmail: {
    color: "#715A46",
    fontSize: 13,
    lineHeight: 20,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0E7D9",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roleText: {
    color: "#98623B",
    fontSize: 12,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFE3D1",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionButton: {
    borderTopWidth: 0,
    borderTopColor: "#E6D9C8",
    paddingTop: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    backgroundColor: "#EAD9C0",
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  actionText: {
    color: "#98623B",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#F3F0E8",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 28,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "#DCCBB6",
  },
  modalTitle: {
    color: "#342418",
    fontSize: 25,
    fontWeight: "600",
    marginBottom: 24,
  },
  inputLabel: {
    color: "#6E5039",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 9,
  },
  input: {backgroundColor:"#FCFAF5",borderWidth:1,borderColor:'#D4BB99',borderRadius:29,height:58,paddingHorizontal:18,color:"#342418",marginBottom:19,fontSize:15},
  roleOption: {flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#FCFAF5",borderRadius:25,borderWidth:1,borderColor:"#DCCBB6",padding:16,marginBottom:9,minHeight:54},
  roleOptionSelected: {
    borderColor: "#A26F43",
    backgroundColor: "#EEDCC6",
  },
  roleOptionText: {
    color: "#493122",
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmit: {
    backgroundColor: "#D3A16C",
    padding: 18,
    borderRadius: 22,
    alignItems: "center",
    marginTop: 19,
    minHeight: 52,
  },
  modalSubmitText: {
    color: "#3B2817",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelButton: {
    padding: 17,
    alignItems: "center",
    marginTop: 5,
  },
  cancelText: {
    color: "#8C735D",
    fontSize: 14,
    fontWeight: "700",
  },
});
