import {useFonts} from 'expo-font';
import BrandHeader from '../../../components/BrandHeader';
import WorkspaceHeading from '../../../components/WorkspaceHeading';
import BrandMonogram from '../../../components/BrandMonogram';
import TextInput from "../../../components/PremiumTextInput";
import {palette as motexaTheme} from '../../../components/DesignTokens';
import {ManagementBanner} from '../../../components/ManagementBanner';
import {EditorialTitle} from '../../../components/PremiumUI';
import {LoadingState} from "../../../components/LoadingState";
import TouchableOpacity from "../../../components/InteractiveButton";
import { useAppearanceStyles, useAppearance } from "../../../components/Appearance";
import { LinearGradient } from "expo-linear-gradient";
import { Text, VisualProvider, useReducedMotion } from "../../../components/MotexaVisual";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from '../../../components/SessionStore';
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import MotexaDialog from "../../../components/MotexaDialog";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, View, Image, BackHandler, KeyboardAvoidingView, Platform, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";

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

export default function AdminManagementScreen() {
 const [focusedField,setFocusedField]=useState<string|null>(null);
 const [department,setDepartment]=useState<AdminRole>('mechanics');
 const [detailId,setDetailId]=useState<string|null>(null);
 const [detailTab,setDetailTab]=useState<'details'|'permissions'>('details');
 const [loadError,setLoadError]=useState(false);
 const [adminStatusFilter,setAdminStatusFilter]=useState<AdminStatus|'all'>('all');
 const [accountSearch,setAccountSearch]=useState('');
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
const [departmentPickerOpen,setDepartmentPickerOpen]=useState(false);
const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AdminRole>("mechanics");
  const [revokeTarget, setRevokeTarget] = useState<AdminAccount | null>(null);
const [revoking, setRevoking] = useState(false);
const [statusTarget, setStatusTarget] = useState<AdminAccount | null>(null);
const [updatingStatus, setUpdatingStatus] = useState(false);
  const [adminFontsReady]=useFonts({MotexaTeamScript:require('../../../../assets/fonts/GreatVibes-Regular.ttf'),MotexaTeamArabic:require('../../../../assets/fonts/Tajawal-Medium.ttf'),MotexaTeamNumber:require('../../../../assets/fonts/GFSDidot-Regular.ttf')});
  const reducedMotion=useReducedMotion();
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

useFocusEffect(useCallback(() => {
  void loadAdmins();
}, [loadAdmins]));

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
  const adminGlass:ViewStyle & {backdropFilter?:string}={backgroundColor:dark?'rgba(48,35,27,.62)':'rgba(255,249,239,.62)',borderColor:dark?'#C9A77766':'#FFFFFFD9',...(Platform.OS==='web'?{backdropFilter:'blur(16px) saturate(115%)'}:{})};
  const departments: {role:AdminRole;photo:number;icon:keyof typeof Ionicons.glyphMap}[]=[{role:'mechanics',photo:1,icon:'construct-outline'},{role:'providers',photo:2,icon:'cube-outline'},{role:'requests',photo:3,icon:'car-outline'}];
  const searchQuery=accountSearch.trim().toLocaleLowerCase();
  const visibleAdmins=admins.filter(item=>item.role===department&&(adminStatusFilter==='all'||item.status===adminStatusFilter)&&(!searchQuery||(item.name+' '+item.email).toLocaleLowerCase().includes(searchQuery)));
  const departmentName=(role:AdminRole)=>role==='mechanics'?(isArabic?'الميكانيكيون':'Mechanics'):role==='providers'?(isArabic?'قطع الغيار':'Spare parts'):(isArabic?'الونشات':'Towing');
  const initials=(value:string)=>value.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const stateColor=(status:AdminStatus)=>status==='active'?(dark?'#B0E4BC':'#24633B'):status==='suspended'?(dark?'#FFC5B0':'#943C29'):muted;
  const renderAdmin=({item}:{item:AdminAccount;index:number})=><TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'تفاصيل '+item.name:'Details for '+item.name} onPress={()=>{setDetailTab('details');setDetailId(item.id);}} style={[ui.account,{...adminGlass,flexDirection:direction,borderRadius:27,borderWidth:1,minHeight:94,marginBottom:9,paddingHorizontal:14,paddingVertical:13,overflow:'hidden'}]}>
    <View style={[ui.initials,{width:43,height:48,borderRadius:17,backgroundColor:dark?'#65482F':'#F1E0C7'}]}><Text style={{color:ink,fontSize:16}}>{initials(item.name)}</Text></View>
    <View style={{flex:1,minWidth:0,gap:4}}><Text style={{fontSize:14,lineHeight:23,fontWeight:'600',color:ink,textAlign:align}}>{item.name}</Text><Text numberOfLines={1} style={{fontSize:11,lineHeight:19,color:muted,textAlign:align,writingDirection:'ltr'}}>{item.email}</Text><View style={{flexDirection:direction,alignItems:'center',gap:6}}><View style={{width:5,height:5,borderRadius:3,backgroundColor:stateColor(item.status)}}/><Text style={{fontSize:10,lineHeight:18,color:stateColor(item.status)}}>{statusLabel(item.status)}</Text></View></View>
    <View style={{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:border,alignItems:'center',justifyContent:'center'}}><Ionicons name={isArabic?'arrow-back':'arrow-forward'} size={15} color={muted}/></View>
  </TouchableOpacity>;
  const topbar=(back:()=>void)=><View style={{marginHorizontal:-12,marginBottom:8}}><BrandHeader onBack={back} backDisabled={saving||updatingStatus||revoking} /></View>;
  return (
    <VisualProvider><View style={styles.container}>{!detail&&<View pointerEvents="none" style={{position:"absolute",width:"100%",height:"100%",top:0,left:0,overflow:"hidden",backgroundColor:dark?"#30231B":"#F5E5CD"}}><LinearGradient colors={dark?["#503927","#30231B","#67472F"]:["#FFF9EF","#DFC19B","#FAF0DF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><BrandMonogram size={400} style={{top:150,left:-90,opacity:.045}}/></View> }<LinearGradient pointerEvents="none" colors={detail?(dark?motexaTheme.canvasDark:motexaTheme.canvas):(dark?['#30231BCC','#30231B44','#30231BAA']:['#FFF9EFDD','#FFF9EF33','#F3DFC488'])} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
      {detail?<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.listContent,{paddingTop:insets.top+8,paddingBottom:40}]}>
        {topbar(()=>setDetailId(null))}
        <ManagementBanner index={2} style={{...adminGlass,borderWidth:1,borderRadius:32,padding:20,marginBottom:15,alignItems:'center',overflow:'hidden',gap:5}}>
          <LinearGradient pointerEvents="none" colors={['#21171099','#21171066','#211710CC']} locations={[0,.5,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
          <BrandMonogram size={230} style={{top:-15,left:-45,opacity:.035}}/>
          <Text style={{width:'100%',alignSelf:'stretch',direction:'ltr',textAlign:'left',writingDirection:'ltr',fontSize:10,lineHeight:20,letterSpacing:isArabic?0:1.3,color:'#E7D2B7'}}>{isArabic?'MOTEXA / حساب المسؤول':'MOTEXA / ADMINISTRATOR'}</Text>
          <View style={{width:58,height:58,borderRadius:21,borderWidth:1,borderColor:'#D4AF7955',backgroundColor:dark?'#65482F':'#EDD5B3',alignItems:'center',justifyContent:'center',marginVertical:7}}><Text style={{fontSize:23,color:ink}}>{initials(detail.name)}</Text></View>
          <Text accessibilityRole="header" style={{fontFamily:adminFontsReady?(isArabic?'MotexaTeamArabic':'MotexaTeamScript'):undefined,fontSize:isArabic?28:37,lineHeight:isArabic?43:49,color:'#FFF3E1',textAlign:'center'}}>{detail.name}</Text>
          <Text style={{fontSize:13,lineHeight:23,color:'#E7D2B7',textAlign:'center'}}>{roleLabel(detail.role)}</Text>
          <View style={[ui.badge,{backgroundColor:detail.status==='active'?(dark?'#344634':'#E8EEDC'):detail.status==='suspended'?(dark?'#56352A':'#F9E4D8'):(dark?'#58432E':'#F8EBD3'),marginTop:5}]}><Text style={{fontSize:11,lineHeight:20,color:stateColor(detail.status)}}>{statusLabel(detail.status)}</Text></View>
        </ManagementBanner>
        <View style={[ui.detailTabs,{backgroundColor:dark?'#3E2E23':'#EDDDC5',flexDirection:direction,borderWidth:1,borderColor:border}]}>{(['details','permissions'] as const).map(tab=><TouchableOpacity key={tab} accessibilityRole="tab" accessibilityLabel={tab==="details"?(isArabic?"التفاصيل":"Details"):(isArabic?"الصلاحيات":"Permissions")} accessibilityState={{selected:detailTab===tab}} onPress={()=>setDetailTab(tab)} style={[ui.detailTab,{minHeight:47,borderRadius:18,backgroundColor:detailTab===tab?(dark?'#735336':'#FFFAF1'):'transparent'}]}><Ionicons name={tab==='details'?'person-outline':'list-outline'} size={18} color={detailTab===tab?ink:muted}/><Text style={{fontSize:12,color:detailTab===tab?ink:muted}}>{tab==='details'?(isArabic?'التفاصيل':'Details'):(isArabic?'الصلاحيات':'Permissions')}</Text></TouchableOpacity>)}</View>
        <EditorialTitle accent={false} style={[ui.section,{fontFamily:adminFontsReady?(isArabic?"MotexaTeamArabic":"MotexaTeamScript"):undefined,fontSize:isArabic?23:30,lineHeight:40,fontWeight:"400",color:ink,textAlign:align}]}>{detailTab==='details'?(isArabic?'معلومات الحساب':'Account information'):(isArabic?'صلاحيات القسم':'Department permissions')}</EditorialTitle>
        {detailTab==='permissions'&&<View style={{flexDirection:direction,alignItems:'flex-start',gap:9,padding:13,borderRadius:20,backgroundColor:dark?'#4C3827':'#EEDDC4',marginBottom:12}}><Ionicons name="shield-checkmark-outline" size={20} color={muted}/><Text style={{flex:1,fontSize:12,lineHeight:22,color:ink,textAlign:align}}>{isArabic?'هذا هو الوصول المعيّن لهذا الحساب. تُطبّق الصلاحيات على الخادم، وتعليق الحساب يمنع الوصول.':'This is the access assigned to this account. Permissions are enforced by the server; suspending the account blocks access.'}</Text></View>}
        <View style={[ui.accountInfoPanel,{...adminGlass,borderRadius:28,borderColor:border}]}>
        {[[labels.name,detail.name],[labels.email,detail.email],[isArabic?'القسم':'Department',roleLabel(detail.role)],[isArabic?'الصلاحية':'Permission',detail.role==='mechanics'?(isArabic?'إدارة الميكانيكيين':'Manage mechanics'):detail.role==='providers'?(isArabic?'إدارة قطع الغيار':'Manage spare parts'):(isArabic?'إدارة خدمات السحب':'Manage towing')]].filter(([label])=>detailTab==='details'||label===(isArabic?'القسم':'Department')||label===(isArabic?'الصلاحية':'Permission')).map(([label,value],index)=><View key={label} style={[ui.accountInfoRow,{flexDirection:direction,borderTopWidth:index?1:0,borderTopColor:dark?'#634B36':'#E9D7BD'}]}>
          <View style={[ui.infoIcon,{backgroundColor:dark?'#59402C':'#F4E2C8'}]}><Ionicons name={label===labels.name?'person-outline':label===labels.email?'mail-outline':label===(isArabic?'القسم':'Department')?'briefcase-outline':'key-outline'} size={18} color={muted}/></View>
          <View style={{flex:1,minWidth:0,gap:3}}><Text style={{fontSize:10,lineHeight:19,color:muted,textAlign:align}}>{label}</Text><Text selectable style={{fontSize:14,lineHeight:25,fontWeight:'500',color:ink,textAlign:align,writingDirection:label===labels.email?'ltr':isArabic?'rtl':'ltr'}}>{value}</Text></View>
        </View>)}
        </View>
        <View style={{marginTop:21,borderRadius:28,borderWidth:1,borderColor:detail.status==='active'?(dark?'#94654B':'#D9BA99'):border,backgroundColor:surface,overflow:'hidden'}}>
         <View style={{padding:17,gap:12}}>
          <View style={{flexDirection:direction,alignItems:'center',gap:10}}><View style={{width:37,height:37,borderRadius:14,backgroundColor:detail.status==='active'?(dark?'#493426':'#F5E3D0'):(dark?'#374333':'#E5EEDB'),alignItems:'center',justifyContent:'center'}}><Ionicons name="shield-checkmark-outline" size={20} color={muted}/></View><Text accessibilityRole="header" style={{flex:1,fontSize:16,lineHeight:26,fontWeight:'600',color:ink,textAlign:align}}>{isArabic?'إدارة الحساب':'Account controls'}</Text></View>
          <View style={{flexDirection:direction,alignItems:'center',gap:7,paddingTop:11,borderTopWidth:1,borderColor:border}}><Text style={{flex:1,fontSize:11,lineHeight:22,color:muted,textAlign:align}}>{isArabic?'حالة الوصول الحالية':'Current access status'}</Text><View style={{width:6,height:6,borderRadius:3,backgroundColor:stateColor(detail.status)}}/><Text style={{fontSize:12,lineHeight:22,color:stateColor(detail.status),fontWeight:'600'}}>{statusLabel(detail.status)}</Text></View>
          <Text style={{fontSize:12,lineHeight:23,color:muted,textAlign:align}}>{detail.status==='invited'?(isArabic?'إلغاء الدعوة يمنع استخدام رابط التفعيل المرسل.':'Revoking this invitation prevents the activation link from being used.'):detail.status==='active'?(isArabic?'تعليق الحساب يوقف وصول الأدمن مؤقتًا ويحافظ على بياناته. يمكنك إعادة تفعيله لاحقًا.':'Suspend access temporarily while retaining the account. You can reactivate it later.'):(isArabic?'أعد وصول الأدمن للحساب بصلاحيات القسم المعيّنة له.':'Restore access with the department permissions already assigned to this account.')}</Text>
         </View>
         <View style={{padding:12,paddingTop:0}}><TouchableOpacity accessibilityRole="button" accessibilityLabel={detail.status==='invited'?(isArabic?'إلغاء الدعوة':'Revoke invitation'):detail.status==='active'?(isArabic?'تعليق الحساب':'Suspend account'):(isArabic?'إعادة تفعيل الحساب':'Reactivate account')} accessibilityState={{disabled:loading||updatingStatus||revoking}} disabled={loading||updatingStatus||revoking} onPress={()=>toggleSuspension(detail)} style={{minHeight:57,borderRadius:21,paddingHorizontal:14,paddingVertical:12,flexDirection:direction,alignItems:'center',gap:10,backgroundColor:detail.status==='active'?(dark?'#74452F':'#F4DACA'):detail.status==='invited'?(dark?'#62462F':'#EFDCBD'):(dark?'#38553B':'#D9E8D3'),borderWidth:1,borderColor:detail.status==='active'?(dark?'#AC7958':'#D0A384'):border,opacity:loading||updatingStatus||revoking?.6:1}}><Ionicons name={detail.status==='invited'?'close-circle-outline':detail.status==='active'?'pause-circle-outline':'play-circle-outline'} size={24} color={detail.status==='active'?(dark?'#FFE1CC':'#873F24'):ink}/><Text style={{flex:1,fontSize:14,lineHeight:25,fontWeight:'600',color:detail.status==='active'?(dark?'#FFE1CC':'#873F24'):ink,textAlign:align}}>{detail.status==='invited'?(isArabic?'إلغاء الدعوة':'Revoke invitation'):detail.status==='active'?(isArabic?'تعليق الحساب':'Suspend account'):(isArabic?'إعادة تفعيل الحساب':'Reactivate account')}</Text><Ionicons name={isArabic?'arrow-back':'arrow-forward'} size={18} color={muted}/></TouchableOpacity></View>
        </View>
        <View style={{flexDirection:direction,alignItems:'flex-start',gap:7,marginTop:11,paddingHorizontal:7}}><Ionicons name="lock-closed-outline" size={13} color={muted} style={{marginTop:4}}/><Text style={{flex:1,fontSize:10,lineHeight:20,color:muted,textAlign:align}}>{isArabic?'كل تغيير يتطلب تأكيدًا، ولا يتم حذف بيانات الحساب.':'Every change requires confirmation. Account records are retained.'}</Text></View>
      </ScrollView>:<FlatList data={visibleAdmins} keyExtractor={item=>item.status==='invited'?'invite-'+item.id:item.id} renderItem={renderAdmin} showsVerticalScrollIndicator={false} refreshing={loading} onRefresh={loadAdmins} contentContainerStyle={[styles.listContent,{paddingTop:insets.top+8}]} ListHeaderComponent={<>
        {topbar(()=>router.replace('/admin'))}
        <View style={{paddingHorizontal:2,marginBottom:13}}><Text style={{fontSize:9,lineHeight:19,letterSpacing:isArabic?0:1.5,color:muted,textAlign:align}}>{isArabic?'MOTEXA / الأدمن والصلاحيات':'MOTEXA / PEOPLE & PERMISSIONS'}</Text><Text accessibilityRole="header" style={{fontFamily:adminFontsReady?(isArabic?'MotexaTeamArabic':'MotexaTeamScript'):undefined,fontSize:isArabic?31:43,lineHeight:isArabic?47:55,color:ink,textAlign:align}}>{isArabic?'فريقك، بثقة.':'Lead with purpose.'}</Text><Text style={{fontSize:12,lineHeight:22,color:muted,textAlign:align}}>{isArabic?'فريق واحد. صلاحيات واضحة.':'One team. Considered access.'}</Text></View>
        <View style={{height:145,borderTopLeftRadius:33,borderTopRightRadius:18,borderBottomLeftRadius:18,borderBottomRightRadius:38,overflow:'hidden',backgroundColor:surface,marginBottom:0}}>
         <Image accessible={false} source={require('../../../../assets/images/motexa-administration-office.png')} resizeMode="cover" style={{width:'100%',height:'100%'}}/>
         <LinearGradient pointerEvents="none" colors={['#21171000','#21171077']} style={StyleSheet.absoluteFill}/>
         <View style={{position:'absolute',bottom:15,left:15,right:15,flexDirection:direction,gap:7,alignItems:'center'}}><Ionicons name="shield-checkmark-outline" size={16} color="#FFF2DE"/><Text style={{fontSize:10,lineHeight:19,color:'#FFF2DE'}}>{isArabic?'مساحة إدارة فريق المنصّة':'Your platform leadership team'}</Text></View>
        </View>
        <View style={{...adminGlass,marginHorizontal:9,marginTop:-8,borderWidth:1,borderRadius:25,flexDirection:direction,paddingVertical:14,marginBottom:15}}>{[{label:labels.total,value:stats.total},{label:labels.active,value:stats.active},{label:isArabic?'دعوات معلّقة':'Pending invites',value:stats.invited}].map((stat,index)=><View key={stat.label} style={{flex:1,minWidth:0,paddingHorizontal:6,alignItems:'center',gap:2,borderLeftWidth:index&&!isArabic?1:0,borderRightWidth:index&&isArabic?1:0,borderColor:border}}><Text style={{fontFamily:adminFontsReady?'MotexaTeamNumber':undefined,fontSize:32,lineHeight:39,color:ink}}>{loading||loadError?'—':stat.value}</Text><Text style={{fontSize:10,lineHeight:18,color:muted,textAlign:'center'}}>{stat.label}</Text></View>)}</View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'دعوة أدمن جديد':'Invite administrator'} onPress={()=>{setSelectedRole(department);setModalVisible(true);}} style={{minHeight:76,borderRadius:26,borderWidth:1,borderColor:border,backgroundColor:surface,paddingHorizontal:14,paddingVertical:12,flexDirection:direction,alignItems:'center',gap:12,marginBottom:16}}><View style={{width:43,height:43,borderRadius:17,backgroundColor:dark?'#725132':'#EED7B4',alignItems:'center',justifyContent:'center'}}><Ionicons name="person-add-outline" size={22} color={ink}/></View><View style={{flex:1,minWidth:0}}><Text style={{fontSize:14,lineHeight:24,fontWeight:'600',color:ink,textAlign:align}}>{isArabic?'دعوة أدمن جديد':'Invite administrator'}</Text><Text style={{fontSize:11,lineHeight:20,color:muted,textAlign:align}}>{isArabic?'اختر القسم وأرسل دعوة آمنة':'Assign a department. Send a secure invitation.'}</Text></View><Ionicons name={isArabic?'arrow-back':'arrow-forward'} size={20} color={muted}/></TouchableOpacity>
        <View style={{...adminGlass,gap:9,padding:10,borderWidth:1,borderRadius:32,marginBottom:18,overflow:'hidden'}}>
          <BrandMonogram size={210} style={{top:40,left:-45,opacity:.025}}/>
          <Text style={{fontFamily:adminFontsReady?(isArabic?'MotexaTeamArabic':'MotexaTeamScript'):undefined,fontSize:isArabic?21:27,lineHeight:35,color:ink,fontWeight:'400',textAlign:align,paddingHorizontal:7,marginBottom:3}}>{isArabic?'الأقسام':'Departments'}</Text>
        <View style={{flexDirection:direction,gap:7}}>{departments.map(dept=><TouchableOpacity key={dept.role} accessibilityRole="button" accessibilityLabel={roleLabel(dept.role)} accessibilityState={{selected:department===dept.role}} onPress={()=>{setDepartment(dept.role);setAdminStatusFilter('all');setAccountSearch('');}} style={{flex:1,minWidth:0,minHeight:112,paddingHorizontal:6,paddingVertical:11,borderWidth:1,borderRadius:23,borderColor:department===dept.role?(dark?'#C49B6D':'#B98D5C'):border,backgroundColor:department===dept.role?(dark?'#62452DAA':'#EED8BACC'):(dark?'#30231B66':'#FFF9EF99'),alignItems:'center',gap:5}}>
          <Ionicons name={dept.icon} size={21} color={muted}/><Text style={{fontSize:11,lineHeight:20,fontWeight:department===dept.role?'600':'400',color:ink,textAlign:'center'}}>{departmentName(dept.role)}</Text><Text style={{fontSize:18,lineHeight:25,color:ink}}>{loading||loadError?'—':admins.filter(item=>item.role===dept.role&&item.status!=='invited').length}</Text><View style={{height:2,width:18,borderRadius:2,backgroundColor:department===dept.role?muted:'transparent'}}/>
        </TouchableOpacity>)}</View>
        </View>
        <View style={{...adminGlass,borderTopLeftRadius:30,borderTopRightRadius:30,borderBottomLeftRadius:30,borderBottomRightRadius:30,borderWidth:1,borderBottomWidth:1,borderColor:dark?'#61472F':'#E7D7BE',padding:14,marginBottom:10,overflow:'hidden'}}>
        <EditorialTitle accent={false} style={[ui.section,{fontFamily:adminFontsReady?(isArabic?"MotexaTeamArabic":"MotexaTeamScript"):undefined,fontSize:isArabic?22:29,lineHeight:38,fontWeight:"400",color:ink,textAlign:align,marginBottom:5}]}>{roleLabel(department)}</EditorialTitle><Text style={{fontSize:11,lineHeight:19,color:muted,textAlign:align,marginBottom:12}}>{isArabic?'حسابات الأدمن وحالات الوصول للقسم المختار':'Administrator accounts and access for this department'}</Text>
        <View style={{minHeight:49,borderWidth:1,borderColor:border,borderRadius:22,flexDirection:direction,alignItems:'center',gap:8,paddingHorizontal:12,backgroundColor:surface,marginBottom:12}}><Ionicons name="search-outline" size={18} color={muted}/><TextInput accessibilityLabel={isArabic?'البحث عن أدمن':'Search administrators'} value={accountSearch} onChangeText={setAccountSearch} placeholder={isArabic?'الاسم أو البريد الإلكتروني':'Name or email address'} placeholderTextColor={muted} autoCapitalize="none" style={{flex:1,minWidth:0,minHeight:47,fontSize:12,color:ink,textAlign:align}}/>{!!accountSearch&&<TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'مسح البحث':'Clear search'} onPress={()=>setAccountSearch('')} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="close-circle-outline" size={19} color={muted}/></TouchableOpacity>}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingBottom:15,flexDirection:direction}}>{(['all','active','invited','suspended'] as const).map(value=><TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{selected:adminStatusFilter===value}} onPress={()=>setAdminStatusFilter(value)} style={[ui.filter,{borderColor:value==='active'?(dark?'#6D9C76':'#7EAB89'):value==='suspended'?(dark?'#C77F65':'#CC927E'):border,backgroundColor:value==='active'?(adminStatusFilter===value?(dark?'#345E3E':'#CDE5D3'):(dark?'#2E4030':'#EDF5EE')):value==='suspended'?(adminStatusFilter===value?(dark?'#713E2D':'#F2CEBE'):(dark?'#483126':'#FBEEE7')):adminStatusFilter===value?(dark?'#735131':'#EAD1AE'):surface}]}><Text style={{fontSize:11,lineHeight:20,fontWeight:adminStatusFilter===value?'600':'400',color:value==='active'?stateColor('active'):value==='suspended'?stateColor('suspended'):ink}}>{value==='all'?(isArabic?'الكل':'All'):statusLabel(value)}</Text></TouchableOpacity>)}</ScrollView><Text accessibilityLiveRegion="polite" style={{fontSize:11,lineHeight:21,color:muted,textAlign:align}}>{loading?(isArabic?'جارٍ تحميل الحسابات…':'Loading accounts…'):loadError?(isArabic?'البيانات غير متاحة':'Data unavailable'):visibleAdmins.length+' '+(isArabic?'حساب مطابق':'matching accounts')}</Text>
        </View>
        {loadError&&<TouchableOpacity accessibilityRole="button" onPress={loadAdmins} style={[ui.infoPill,{borderColor:border,backgroundColor:surface}]}><Text style={{color:ink,lineHeight:22,textAlign:align}}>{isArabic?'تعذّر تحميل الحسابات. اضغط للمحاولة مجددًا.':'Could not load accounts. Tap to retry.'}</Text></TouchableOpacity>}
      </>} ListEmptyComponent={loading?<LoadingState label={isArabic?'جارٍ تحميل الحسابات…':'Loading accounts…'}/>:!loadError?<View style={[ui.identity,{...adminGlass,borderColor:adminGlass.borderColor,borderTopWidth:0,borderTopLeftRadius:0,borderTopRightRadius:0}]}><Ionicons name="people-outline" size={26} color={muted}/><Text style={{color:muted,fontSize:13,lineHeight:23,textAlign:'center',marginTop:9}}>{isArabic?'لا توجد حسابات تطابق هذا القسم والحالة.':'No accounts match this department and status.'}</Text></View>:null}/>} 

      <Modal visible={modalVisible} animationType={reducedMotion?"none":"slide"} onRequestClose={()=>{if(!saving)setModalVisible(false);}}>
        <KeyboardAvoidingView style={{flex:1,backgroundColor:dark?'#30231B':'#FFF9EF'}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View pointerEvents="none" style={{position:"absolute",width:"100%",height:"100%",top:0,left:0,overflow:"hidden",backgroundColor:dark?"#30231B":"#F5E5CD"}}><LinearGradient colors={dark?["#503927","#30231B","#67472F"]:["#FFF9EF","#DFC19B","#FAF0DF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><BrandMonogram size={400} style={{top:150,left:-90,opacity:.045}}/></View>
        <LinearGradient pointerEvents="none" colors={dark?['#30231BCC','#30231B33','#30231B88']:['#FFF9EFE6','#FFF9EF11','#D5AA7744']} locations={[0,.35,1]} style={StyleSheet.absoluteFill}/>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.listContent,{paddingTop:insets.top+8,paddingBottom:insets.bottom+28}]}>
          <View style={{marginHorizontal:-12,marginBottom:8,borderRadius:24,backgroundColor:dark?'#30231BBF':'#FFF9EFCC'}}><BrandHeader onBack={()=>{if(!saving)setModalVisible(false);}} backDisabled={saving}/></View>
          <View style={{overflow:'hidden',marginBottom:16,paddingHorizontal:14,paddingTop:4,paddingBottom:8,borderTopLeftRadius:12,borderTopRightRadius:32,borderBottomLeftRadius:32,borderBottomRightRadius:12,backgroundColor:dark?'#30231BB8':'#FFF9EFD1',borderWidth:1,borderColor:dark?'#D9B58A55':'#FFFFFFBB'}}>
            <BrandMonogram size={190} style={{top:5,right:0,left:undefined,opacity:.04}}/>
            <WorkspaceHeading eyebrow={isArabic?'MOTEXA / دعوات الفريق':'MOTEXA / TEAM INVITATIONS'} title={isArabic?'دعوةٌ تصنع فريقًا.':'An invitation to lead.'} description={isArabic?'أضف مسؤول القسم المناسب، بصلاحيات واضحة ودعوة آمنة.':'The right person. A defined department. Secure access.'}/>

          </View>
          <View style={[ui.formCard,{backgroundColor:dark?"rgba(48,35,27,.68)":"rgba(255,249,239,.65)",borderColor:dark?"#D9B58A66":"#FFFFFFDD",borderTopLeftRadius:34,borderTopRightRadius:34,borderBottomLeftRadius:20,borderBottomRightRadius:20,overflow:"hidden",boxShadow:"0px 12px 32px rgba(43,28,16,0.10)",...(Platform.OS==="web"?{backdropFilter:"blur(12px) saturate(115%)"}:{})}]}><BrandMonogram size={230} style={{top:20,left:-45,opacity:.025}}/><Text style={{fontSize:10,lineHeight:20,letterSpacing:isArabic?0:1.2,color:muted,textAlign:align,marginBottom:12}}>{isArabic?"01 / بيانات المسؤول":"01 / ADMINISTRATOR DETAILS"}</Text>
            <Text style={[styles.inputLabel,{textAlign:align,fontSize:12,fontWeight:'500',color:muted,marginBottom:8}]}>{labels.name}</Text>
            <View style={[ui.inputWrap,{backgroundColor:dark?"#30231BAA":"#FFFAF1BB",borderColor:focusedField==='name'?'#A67540':border,flexDirection:direction}]}><Ionicons name="person-outline" size={19} color={muted}/><TextInput value={name} onChangeText={setName} editable={!saving} onFocus={()=>setFocusedField('name')} onBlur={()=>setFocusedField(null)} placeholder={isArabic?'أدخل الاسم الكامل':'Enter full name'} placeholderTextColor={muted} autoCapitalize="words" accessibilityLabel={labels.name} style={{flex:1,minWidth:0,minHeight:50,color:ink,fontSize:14,textAlign:align}}/></View>
            <Text style={[styles.inputLabel,{textAlign:align}]}>{labels.email}</Text>
            <View style={[ui.inputWrap,{backgroundColor:dark?"#30231BAA":"#FFFAF1BB",borderColor:focusedField==='email'?'#A67540':border,flexDirection:direction}]}><Ionicons name="mail-outline" size={19} color={muted}/><TextInput value={email} onChangeText={setEmail} editable={!saving} onFocus={()=>setFocusedField('email')} onBlur={()=>setFocusedField(null)} placeholder={isArabic?'أدخل البريد الإلكتروني':'Enter email address'} placeholderTextColor={muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} accessibilityLabel={labels.email} style={{flex:1,minWidth:0,minHeight:50,color:ink,fontSize:13,textAlign:align,writingDirection:'ltr'}}/></View>
          </View>
          <View style={[ui.formCard,{marginTop:14,backgroundColor:dark?'rgba(48,35,27,.72)':'rgba(255,249,239,.70)',borderColor:dark?'#D9B58A66':'#FFFFFFDD',borderTopLeftRadius:20,borderTopRightRadius:20,borderBottomLeftRadius:34,borderBottomRightRadius:34,overflow:'hidden',...(Platform.OS==='web'?{backdropFilter:'blur(12px) saturate(115%)'}:{})}]}>
            <View style={{flexDirection:direction,alignItems:'center',gap:10,marginBottom:14}}><View style={{width:34,height:34,borderRadius:17,backgroundColor:dark?'#795331':'#E9CCA6',alignItems:'center',justifyContent:'center'}}><Ionicons name="key-outline" size={17} color={ink}/></View><View style={{flex:1}}><Text style={{fontSize:10,lineHeight:18,color:muted,textAlign:align}}>{isArabic?'02 / الوصول والصلاحيات':'02 / ACCESS & PERMISSIONS'}</Text><Text style={{fontFamily:adminFontsReady?(isArabic?'MotexaTeamArabic':'MotexaTeamScript'):undefined,fontSize:isArabic?24:31,lineHeight:41,color:ink,fontWeight:'400',textAlign:align}}>{isArabic?'اختيار نوع الأدمن':'Choose their department'}</Text></View></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'اختيار نوع الأدمن':'Choose administrator type'} accessibilityState={{expanded:departmentPickerOpen,disabled:saving}} disabled={saving} onPress={()=>setDepartmentPickerOpen(true)} style={{minHeight:70,borderWidth:1,borderColor:border,borderRadius:25,padding:14,flexDirection:direction,alignItems:'center',gap:12,backgroundColor:dark?'#30231B99':'#FFF9EFAA'}}><View style={{width:38,height:38,borderRadius:19,backgroundColor:dark?'#65482F':'#EED9BB',alignItems:'center',justifyContent:'center'}}><Ionicons name={departments.find(d=>d.role===selectedRole)?.icon??'people-outline'} size={20} color={muted}/></View><View style={{flex:1}}><Text style={{fontSize:14,lineHeight:23,fontWeight:'600',color:ink,textAlign:align}}>{roleLabel(selectedRole)}</Text><Text style={{fontSize:11,lineHeight:20,color:muted,textAlign:align}}>{isArabic?'اضغط لتغيير نوع الأدمن':'Tap to choose a different department'}</Text></View><Ionicons name="chevron-down" size={19} color={muted}/></TouchableOpacity>
            <View style={[ui.notice,{backgroundColor:dark?'#493526':'#F4E3CB',flexDirection:direction}]}><Ionicons name="information-circle" size={21} color={muted}/><Text style={{flex:1,color:muted,fontSize:11,lineHeight:19,textAlign:align}}>{isArabic?'تُرسل الدعوة إلى البريد الإلكتروني، وصلاحيتها 24 ساعة.':'The invitation is sent by email and is valid for 24 hours.'}</Text></View>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={addAdmin} style={[ui.invite,ui.inviteSubmit,{marginBottom:10,opacity:saving?.6:1}]}><Ionicons name="paper-plane-outline" size={18} color="#FFF2DE"/><Text style={{fontSize:14,color:'#FFF2DE'}}>{saving?(isArabic?'جارٍ إرسال الدعوة…':'Sending invitation…'):(isArabic?'إرسال الدعوة':'Send Invitation')}</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={()=>setModalVisible(false)} style={[ui.cancel,{borderColor:border}]}><Text style={{color:ink,fontSize:13}}>{labels.cancel}</Text></TouchableOpacity>
          </View>
        </ScrollView></KeyboardAvoidingView>

        <Modal transparent visible={modalVisible&&departmentPickerOpen} animationType={reducedMotion?'none':'fade'} onRequestClose={()=>setDepartmentPickerOpen(false)}>
          <View style={{flex:1,justifyContent:'center',padding:20,backgroundColor:'#21171066'}}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'إغلاق اختيار النوع':'Close administrator type picker'} onPress={()=>setDepartmentPickerOpen(false)} style={StyleSheet.absoluteFill}/>
            <View accessibilityViewIsModal style={{width:'100%',maxWidth:480,alignSelf:'center',maxHeight:'85%',borderRadius:32,padding:18,borderWidth:1,borderColor:dark?'#C9A77788':'#FFFFFFDD',backgroundColor:dark?'rgba(48,35,27,.88)':'rgba(255,249,239,.86)',boxShadow:'0px 18px 50px rgba(33,23,16,.22)',...(Platform.OS==='web'?{backdropFilter:'blur(20px) saturate(120%)'}:{}),overflow:'hidden'}}>
              <BrandMonogram size={240} style={{top:50,left:-50,opacity:.035}}/>
              <View style={{flexDirection:direction,alignItems:'center',gap:10,marginBottom:12}}><Text accessibilityRole="header" style={{flex:1,fontFamily:adminFontsReady?(isArabic?'MotexaTeamArabic':'MotexaTeamScript'):undefined,fontSize:isArabic?25:32,lineHeight:43,color:ink,textAlign:align}}>{isArabic?'اختر نوع الأدمن':'Choose their department'}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={isArabic?'إغلاق':'Close'} onPress={()=>setDepartmentPickerOpen(false)} style={{width:44,height:44,borderRadius:22,backgroundColor:dark?'#513B29':'#F0DFC6',alignItems:'center',justifyContent:'center'}}><Ionicons name="close-outline" size={22} color={ink}/></TouchableOpacity></View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">            {departments.map(dept=><TouchableOpacity key={dept.role} accessibilityRole="radio" accessibilityState={{checked:selectedRole===dept.role}} disabled={saving} accessibilityLabel={roleLabel(dept.role)} onPress={()=>{setSelectedRole(dept.role);setDepartmentPickerOpen(false);}} style={[ui.roleChoice,{borderColor:selectedRole===dept.role?'#A67540':border,backgroundColor:selectedRole===dept.role?(dark?'#765338E6':'#EDD2ABEB'):(dark?'#30231B55':'#FFF9EF77'),flexDirection:direction}]}><Ionicons name={selectedRole===dept.role?'radio-button-on':'radio-button-off'} size={19} color={muted}/><View style={[ui.initials,{backgroundColor:dark?'#65482F':'#F0D9B9'}]}><Ionicons name={dept.icon} size={21} color={muted}/></View><View style={{flex:1}}><EditorialTitle accent={false} style={{fontSize:16,lineHeight:26,color:ink,textAlign:align}}>{roleLabel(dept.role)}</EditorialTitle><Text style={{fontSize:10,lineHeight:17,color:muted,textAlign:align}}>{dept.role==='mechanics'?(isArabic?'إدارة الميكانيكيين وطلبات اعتمادهم':'Manage mechanics and verification requests'):dept.role==='providers'?(isArabic?'إدارة حسابات مزودي قطع الغيار':'Manage spare parts provider accounts'):(isArabic?'إدارة حسابات مزودي خدمات السحب':'Manage towing provider accounts')}</Text></View></TouchableOpacity>)}</ScrollView>
            </View>
          </View>
        </Modal>
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
  icon={statusTarget?.status === "active" ? "pause-circle-outline" : "play-circle-outline"}
  type={statusTarget?.status === "active" ? "warning" : "confirm"}
  title={
    statusTarget?.status === "active"
      ? isArabic ? "تعليق المسؤول؟" : "Suspend Administrator?"
      : isArabic ? "إعادة تفعيل المسؤول؟" : "Reactivate Administrator?"
  }
  message={
    statusTarget?.status === "active"
      ? isArabic
        ? `هل تريد تعليق حساب ${statusTarget?.name ?? ""}؟ سيتوقف وصوله مؤقتًا مع الاحتفاظ ببياناته، ويمكن إعادة تفعيله لاحقًا.`
        : `Suspend ${statusTarget?.name ?? ""}? Access will be blocked temporarily. Account records are retained and access can be restored later.`
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
 filter:{minHeight:44,paddingHorizontal:14,borderWidth:1,borderRadius:22,alignItems:'center',justifyContent:'center'},
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
