import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect } from "react";
import { useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
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
const API_URL = process.env.EXPO_PUBLIC_API_URL;

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
  background: "#120D0A",
  surface: "#211711",
  surfaceLight: "#302117",
  bronze: "#E0A36F",
  text: "#F6E8DC",
  muted: "#A99181",
  border: "rgba(224,163,111,0.18)",
  green: "#8BC8A1",
  red: "#E59B91",
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
  const { isArabic } = useLanguage();
  const insets = useSafeAreaInsets();

const [admins, setAdmins] = useState<AdminAccount[]>([]);
const [loading, setLoading] = useState(true);  
const [modalVisible, setModalVisible] = useState(false);
const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AdminRole>("mechanics");
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

    Alert.alert(
      isArabic ? "تم إنشاء الدعوة" : "Invitation Created",
      isArabic
        ? "تم حفظ دعوة المسؤول في قاعدة البيانات بنجاح. إرسال البريد الإلكتروني لم يُفعّل بعد."
        : "The invitation was saved in the database. Email delivery is not enabled yet."
    );
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
      Alert.alert(
        isArabic ? "دعوة معلّقة" : "Pending Invitation",
        isArabic
          ? "إدارة الدعوات ستكون متاحة بعد ربط الخادم."
          : "Invitation management will be available after backend integration.",
      );
      return;
    }

    const nextStatus: AdminStatus =
      admin.status === "active" ? "suspended" : "active";

    Alert.alert(
      isArabic ? "تأكيد التغيير التجريبي" : "Confirm Demo Change",
      isArabic
        ? "سيتم تغيير حالة المسؤول داخل الواجهة فقط."
        : "This will change the administrator status in the demo UI only.",
      [
        {
          text: labels.cancel,
          style: "cancel",
        },
        {
          text: isArabic ? "تأكيد" : "Confirm",
          onPress: () =>
            setAdmins((current) =>
              current.map((item) =>
                item.id === admin.id ? { ...item, status: nextStatus } : item,
              ),
            ),
        },
      ],
    );
  };

  const renderAdmin = ({ item }: { item: AdminAccount }) => {
    const statusColor =
      item.status === "active"
        ? COLORS.green
        : item.status === "suspended"
          ? COLORS.red
          : COLORS.bronze;

    return (
      <View style={styles.adminCard}>
        <View style={styles.adminTop}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={23} color={COLORS.bronze} />
          </View>

          <View style={styles.adminInfo}>
            <Text style={styles.adminName}>{item.name}</Text>
            <Text style={styles.adminEmail}>{item.email}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-outline" size={14} color={COLORS.bronze} />
            <Text style={styles.roleText}>{roleLabel(item.role)}</Text>
          </View>

          <View style={styles.statusBadge}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>

        {item.status !== "invited" && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleSuspension(item)}
          >
            <Ionicons
              name={
                item.status === "active"
                  ? "pause-circle-outline"
                  : "checkmark-circle-outline"
              }
              size={18}
              color={COLORS.bronze}
            />
            <Text style={styles.actionText}>
              {item.status === "active"
                ? isArabic
                  ? "تعليق تجريبي"
                  : "Demo Suspend"
                : isArabic
                  ? "إعادة تفعيل تجريبية"
                  : "Demo Reactivate"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={admins}
        keyExtractor={(item) => item.id}
        renderItem={renderAdmin}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 18 },
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

            <View style={styles.brandRow}>
              <Ionicons name="car-sport" size={21} color={COLORS.bronze} />
              <Text style={styles.brand}>MOTEXA</Text>
            </View>

            <Text style={styles.heading}>{labels.title}</Text>
            <Text style={styles.subtitle}>{labels.subtitle}</Text>

            <View style={styles.demoNotice}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={COLORS.bronze}
              />
              <Text style={styles.demoText}>
                {isArabic
                  ? "وضع تجريبي: لا توجد حسابات حقيقية أو دعوات مرسلة."
                  : "Demo mode: No real accounts or invitations are created."}
              </Text>
            </View>

            <View style={styles.statsRow}>
              {[
                { label: labels.total, value: stats.total },
                { label: labels.active, value: stats.active },
                { label: labels.invited, value: stats.invited },
              ].map((stat) => (
                <View style={styles.statCard} key={stat.label}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={22} color="#21130C" />
              <Text style={styles.addButtonText}>{labels.add}</Text>
            </TouchableOpacity>

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
          <View style={styles.modalCard}>
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
                placeholderTextColor="#7F6C60"
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>{labels.email}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="admin@example.com"
                placeholderTextColor="#7F6C60"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 55,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 26,
  },
  backText: {
    color: COLORS.bronze,
    fontSize: 15,
    fontWeight: "700",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 20,
  },
  brand: {
    color: COLORS.bronze,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
  },
  heading: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginBottom: 20,
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
    gap: 9,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.bronze,
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 7,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: COLORS.bronze,
    minHeight: 54,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 30,
  },
  addButtonText: {
    color: "#21130C",
    fontSize: 15,
    fontWeight: "900",
  },
  sectionTitle: {
    color: "#BD987D",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  adminCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 19,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adminTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },
  avatar: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 5,
  },
  adminEmail: {
    color: COLORS.muted,
    fontSize: 11,
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
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roleText: {
    color: COLORS.bronze,
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionButton: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: {
    color: COLORS.bronze,
    fontSize: 12,
    fontWeight: "700",
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
    backgroundColor: "#241912",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 24,
  },
  inputLabel: {
    color: "#C8AA94",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 9,
  },
  input: {
    backgroundColor: "#150F0B",
    borderWidth: 1,
    borderColor: "#49352A",
    borderRadius: 13,
    height: 52,
    paddingHorizontal: 14,
    color: COLORS.text,
    marginBottom: 19,
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1A120D",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3B2A20",
    padding: 15,
    marginBottom: 9,
  },
  roleOptionSelected: {
    borderColor: COLORS.bronze,
    backgroundColor: "#35251B",
  },
  roleOptionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  modalSubmit: {
    backgroundColor: COLORS.bronze,
    padding: 17,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 19,
  },
  modalSubmitText: {
    color: "#21130C",
    fontSize: 15,
    fontWeight: "900",
  },
  cancelButton: {
    padding: 17,
    alignItems: "center",
    marginTop: 5,
  },
  cancelText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
  },
});
