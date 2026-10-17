import TouchableOpacity from "../../components/InteractiveButton";
import { useAppearanceStyles, useAppearance } from "../../components/Appearance";
import { PanelFill, CanvasFill } from "../../components/BrandSurfaces";
import { LinearGradient } from "expo-linear-gradient";
import LanguageSwitch from "../../components/LanguageSwitch";
import { Text, VisualProvider, HeroReveal, DecorativeHalo } from "../../components/MotexaVisual";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect } from "react";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import MotexaDialog from "../../components/MotexaDialog";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";
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
  background: "#E9DECE",
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
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();

const [admins, setAdmins] = useState<AdminAccount[]>([]);
const [activationLink, setActivationLink] = useState<string | null>(null);
const [loading, setLoading] = useState(true);  
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
      total: admins.length,
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

  const renderAdmin = ({ item }: { item: AdminAccount }) => {
    const statusColor=item.status==='active'?COLORS.green:item.status==='suspended'?COLORS.red:COLORS.bronze;
    const initials=item.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    return <View style={[styles.adminCard,{backgroundColor:dark?"#372B22":"#FFF8EC",borderColor:dark?"#66513C":"#E6D5BC"}]}>
      <View style={{flexDirection:isArabic?'row-reverse':'row',alignItems:'center',gap:12}}>
        <View style={[styles.avatar,{backgroundColor:dark?'#63482F':'#DFC19A'}]}><Text style={{fontSize:18,fontWeight:'700',color:dark?'#FFE5C0':'#4B3020'}}>{initials}</Text></View>
        <View style={{flex:1,gap:3}}><Text style={[styles.adminName,{textAlign:isArabic?'right':'left'}]}>{item.name}</Text><Text style={[styles.roleText,{textAlign:isArabic?'right':'left'}]}>{roleLabel(item.role)}</Text></View>
        <View style={{width:10,height:10,borderRadius:5,backgroundColor:statusColor}}/>
      </View>
      <Text selectable style={[styles.adminEmail,{marginTop:8,marginBottom:10,writingDirection:'ltr',textAlign:isArabic?'right':'left'}]}>{item.email}</Text>
      <View style={{borderTopWidth:1,borderTopColor:dark?'#68513C':'#DDC9AD',paddingTop:8,flexDirection:isArabic?'row-reverse':'row',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <Text style={{color:statusColor,fontSize:12,fontWeight:'600'}}>{statusLabel(item.status)}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={()=>toggleSuspension(item)} style={{minHeight:40,paddingHorizontal:12,borderRadius:12,backgroundColor:dark?'#513E2C':'#EAD6B9',flexDirection:isArabic?'row-reverse':'row',alignItems:'center',gap:6}}>
          <Ionicons name={item.status==='invited'?'close-outline':item.status==='active'?'pause-outline':'play-outline'} size={16} color={dark?'#E7C294':'#704A2D'}/>
          <Text style={{color:dark?'#E7C294':'#704A2D',fontSize:12,fontWeight:'600'}}>{item.status==='invited'?(isArabic?'إلغاء الدعوة':'Revoke invitation'):item.status==='active'?(isArabic?'تعليق':'Suspend'):(isArabic?'إعادة التفعيل':'Reactivate')}</Text>
        </TouchableOpacity>
      </View>
    </View>;
  };

  return (
    <VisualProvider><View style={styles.container}><LinearGradient pointerEvents="none" colors={dark?["#211B17","#30251D","#241D18"]:["#D9C4A8","#BDA07C","#CDB595"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
      <FlatList
        data={admins}
        keyExtractor={(item) => item.id}
        renderItem={renderAdmin}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 8 },
        ]}
        ListHeaderComponent={
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons
                name={isArabic ? "arrow-forward" : "arrow-back"}
                size={22}
                color={COLORS.bronze}
              />
              <Text style={styles.backText}>{isArabic ? "رجوع" : "Back"}</Text>
            </TouchableOpacity>

            <View style={{flexDirection:isArabic?"row-reverse":"row",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:10}}><View style={styles.brandRow}>
              <Ionicons name="car-sport" size={21} color={COLORS.bronze} />
              <Text style={styles.brand}>MOTEXA</Text>
            </View><LanguageSwitch light compact /></View>

            
          <HeroReveal style={{marginBottom:24}}>
            <Text style={{color:dark?'#CBA575':'#785334',fontSize:11,letterSpacing:2,marginBottom:10}}>{isArabic?'مساحة الإدارة':'TEAM WORKSPACE'}</Text>
            <View style={{flexDirection:isArabic?'row-reverse':'row',alignItems:'center',gap:12}}>
              <Text style={[styles.heading,{flex:1,fontSize:24,lineHeight:32,textAlign:isArabic?'right':'left'}]}>{isArabic?'إدارة الأدمن':'Administrators'}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={labels.add} onPress={()=>setModalVisible(true)} style={{minHeight:44,paddingHorizontal:12,borderRadius:14,flexDirection:isArabic?'row-reverse':'row',gap:5,backgroundColor:dark?'#DDB47D':'#493020',alignItems:'center',justifyContent:'center'}}><Ionicons name="add" size={18} color={dark?'#352216':'#F7E9D6'}/><Text style={{fontSize:12,fontWeight:"600",color:dark?"#352216":"#F7E9D6"}}>{isArabic?"إضافة":"Add admin"}</Text></TouchableOpacity>
            </View>
            <Text style={[styles.subtitle,{marginBottom:18,textAlign:isArabic?'right':'left'}]}>{labels.subtitle}</Text>
            <View style={{borderRadius:22,overflow:'hidden',padding:18,flexDirection:isArabic?'row-reverse':'row'}}><PanelFill kind="hero" radius={22}/>
              {[{label:labels.total,value:stats.total},{label:labels.active,value:stats.active},{label:labels.invited,value:stats.invited}].map((stat,index)=><View key={stat.label} style={{flex:1,alignItems:'center',gap:5,borderLeftWidth:index?1:0,borderLeftColor:'#8C70564D'}}><Text style={{fontSize:27,color:'#FFF5E5',fontWeight:'600'}}>{stat.value}</Text><Text style={{fontSize:12,color:'#E4C7A4'}}>{stat.label}</Text></View>)}
            </View>
          </HeroReveal>

            <Text style={styles.sectionTitle}>
{isArabic ? "المسؤولون والدعوات" : "ADMINISTRATORS & INVITATIONS"}            </Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{labels.empty}</Text>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard,{overflow:"hidden"}]}><CanvasFill/>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>
{isArabic ? "إضافة مسؤول جديد" : "Add New Administrator"}              </Text>

              <Text style={styles.inputLabel}>{labels.name}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={labels.name}
                placeholderTextColor="#9C836B"
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>{labels.email}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={isArabic?"أدخل البريد الإلكتروني":"Enter email address"}
                placeholderTextColor="#9C836B"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>{labels.role}</Text>

              {(["mechanics", "providers", "requests"] as AdminRole[]).map(
                (role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      selectedRole === role && styles.roleOptionSelected,
                    ]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <Ionicons
                      name={
                        selectedRole === role
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={COLORS.bronze}
                    />
                    <Text style={styles.roleOptionText}>{roleLabel(role)}</Text>
                  </TouchableOpacity>
                ),
              )}
<TouchableOpacity
  style={[
    styles.modalSubmit,
    saving && { opacity: 0.6 },
  ]}
  onPress={addAdmin}
  disabled={saving}
>
  <Text style={styles.modalSubmitText}>
    {saving
      ? isArabic
        ? "جارٍ الحفظ..."
        : "Saving..."
      : labels.create}
  </Text>
</TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>{labels.cancel}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
              </Modal>

     <Modal
  visible={activationLink !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setActivationLink(null)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        {isArabic
          ? "رابط تفعيل المسؤول"
          : "Administrator Activation Link"}
      </Text>

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
        ? `هل تريدين تعليق حساب ${statusTarget?.name ?? ""}؟`
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
    backgroundColor: "#E9DECE",
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
    borderRadius: 18,
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
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#BE9C75",
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
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
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
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 24,
  },
  inputLabel: {
    color: "#6E5039",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 9,
  },
  input: {
    backgroundColor: "#FCFAF5",
    borderWidth: 1,
    borderColor: "#DCD1BF",
    borderRadius: 14,
    height: 58,
    paddingHorizontal: 14,
    color: "#342418",
    marginBottom: 19,
    fontSize: 15,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FCFAF5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCCBB6",
    padding: 16,
    marginBottom: 9,
  },
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
    backgroundColor: "#D2A46C",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 19,
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
