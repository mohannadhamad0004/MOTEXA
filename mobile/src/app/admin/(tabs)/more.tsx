import TouchableOpacity from "../../../components/InteractiveButton";
import { useAppearanceStyles, useAppearance } from "../../../components/Appearance";
import { PanelFill, CanvasFill } from "../../../components/BrandSurfaces";
import { Text } from "../../../components/MotexaVisual";
import LanguageSwitch from "../../../components/LanguageSwitch";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import MotexaDialog from "../../../components/MotexaDialog";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "../../../i18n/LanguageContext";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";
import { canManageMechanics, canManageParts, canManageTow, useSession } from "../../../features/shared/session";
export default function MoreScreen() {
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const user = session.status === "ready" ? session.user : null;
  const tow = !!user && canManageTow(user);
  const parts = !!user && canManageParts(user);
 const [logoutVisible, setLogoutVisible] = useState(false);
const [loggingOut, setLoggingOut] = useState(false);

const handleLogout = () => {
  setLogoutVisible(true);
};

const confirmLogout = async () => {
  if (loggingOut) return;

  try {
    setLoggingOut(true);

    await SecureStore.deleteItemAsync("motexa_access_token");

    setLogoutVisible(false);
    router.dismissAll();
    router.replace("/");
  } catch (error) {
    console.error("Sign out failed:", error);
    setLogoutVisible(false);
  } finally {
    setLoggingOut(false);
  }
};

  // Tow / parts review screens: shown only to admins allowed to manage them (UX gate; the routes re-check).
  const departmentItems = [
    ...(tow ? [{
      title: isArabic ? "شركات السحب" : "Tow companies",
      subtitle: isArabic ? "مراجعة شركات السحب وشاحناتها" : "Review tow companies and their trucks",
      icon: "car-outline" as const,
      action: () => router.push("/admin/tow"),
    }] : []),
    ...(parts ? [{
      title: isArabic ? "متاجر القطع" : "Parts shops",
      subtitle: isArabic ? "مراجعة متاجر قطع الغيار ومنتجاتها" : "Review parts shops and their products",
      icon: "cube-outline" as const,
      action: () => router.push("/admin/shops"),
    }] : []),
    ...([tow, parts, !!user && canManageMechanics(user)].filter(Boolean).length > 1 ? [{
      title: isArabic ? "الأقسام" : "Departments",
      subtitle: isArabic ? "كل أقسامك الإدارية" : "All your administration departments",
      icon: "grid-outline" as const,
      action: () => router.push("/admin/departments"),
    }] : []),
  ];

  const menuItems = [
    {title:isArabic ? "الملف الشخصي" : "My Profile",subtitle:isArabic ? "بيانات حسابك وصلاحياتك" : "Your account details and access",icon:"person-outline" as const,action:()=>router.push("/admin/profile")},
    ...departmentItems,
    {
      title: isArabic ? "إدارة المسؤولين" : "Admin Management",
      subtitle: isArabic
        ? "إدارة حسابات المسؤولين وصلاحياتهم"
        : "Manage administrator accounts and permissions",
      icon: "shield-checkmark-outline" as const,
      action: () => router.push("/admin/admin-management"),
    },
    {
      title: isArabic ? "الإعدادات" : "Settings",
      subtitle: isArabic
        ? "إعدادات التطبيق والتفضيلات"
        : "Application settings and preferences",
      icon: "settings-outline" as const,
      action: () => {},
    },
    {
      title: isArabic ? "المساعدة والدعم" : "Help & Support",
      subtitle: isArabic
        ? "المساعدة والتواصل مع الدعم"
        : "Get help and contact support",
      icon: "help-circle-outline" as const,
      action: () => {},
    },
    {
  title: isArabic ? "تسجيل الخروج" : "Sign Out",
  subtitle: isArabic
    ? "الخروج من حسابك الحالي"
    : "Sign out of your current account",
  icon: "log-out-outline" as const,
  action: handleLogout,
},
  ];

  return (
    <View style={styles.container}><CanvasFill/>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 16) + 22 },
        ]}
      >
        <View style={styles.header}>
          <LanguageSwitch light />
          <View style={styles.brand}>
            <Ionicons name="car-sport" size={21} color="#A27140" />
            <Text style={styles.brandText}>MOTEXA</Text>
          </View>

          <Text style={styles.heading}>{isArabic ? "المزيد" : "More"}</Text>

          <Text style={styles.description}>
            {isArabic
              ? "إدارة حسابك وإعدادات النظام"
              : "Manage your account and system settings"}
          </Text>
        </View>

        <View style={[styles.profileCard,{flexDirection:isArabic?"row-reverse":"row",gap:15}]}><PanelFill kind="hero" radius={25}/>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={29} color="#E7C18D" />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Administrator</Text>
            <Text style={styles.profileRole}>
              {isArabic ? "لوحة الإدارة" : "Administration Panel"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {isArabic ? "إدارة النظام" : "SYSTEM MANAGEMENT"}
        </Text>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                {flexDirection:isArabic?"row-reverse":"row"},
              ]}
              activeOpacity={0.75}
              onPress={item.action}
            >
              <View style={styles.iconBox}>
                <Ionicons name={item.icon} size={23} color="#A27140" />
              </View>

              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>

              <Ionicons
                name={isArabic ? "chevron-back" : "chevron-forward"}
                size={19}
                color="#A27140"
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>MOTEXA</Text>
          <Text style={styles.footerText}>
            Smart Automotive Service Platform
          </Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

      </ScrollView>
      <MotexaDialog
  visible={logoutVisible}
  type="warning"
  title={isArabic ? "تسجيل الخروج؟" : "Sign Out?"}
  message={
    isArabic
      ? "هل تريدين تسجيل الخروج من حساب Super Admin؟"
      : "Are you sure you want to sign out of your Super Admin account?"
  }
  confirmText={isArabic ? "تسجيل الخروج" : "Sign Out"}
  cancelText={isArabic ? "إلغاء" : "Cancel"}
  loading={loggingOut}
  onConfirm={confirmLogout}
  onCancel={() => setLogoutVisible(false)}
/>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E9DECE",
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 45,
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    marginBottom: 28,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
    gap: 9,
  },
  brandText: {
    color: "#A27140",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 3,
  },
  heading: {
    fontSize: 34,
    fontWeight: "600",
    color: "#51351F",
    marginBottom: 8,
    lineHeight: 47,
  },
  description: {
    color: "#92765B",
    fontSize: 14,
  },
  profileCard: {
    backgroundColor: "#F7EDDD",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#A67E50",
    padding: 23,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 35,
    overflow: "hidden",
  },
  avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: "#775333", alignItems: "center", justifyContent: "center" },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: "#FFF6EA",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  profileRole: {
    color: "#D7B995",
    fontSize: 11,
  },
  sectionTitle: {
    color: "#493321",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
    marginBottom: 14,
    marginLeft: 4,
    lineHeight: 28,
  },
  menuContainer: { backgroundColor: "transparent", gap: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", minHeight: 88, paddingVertical: 18, paddingHorizontal: 18, gap: 13, backgroundColor: "#FFF9EF", borderRadius: 23, borderWidth: 1, borderColor: "#D3BB98" },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#DECAAF",
  },
  iconBox: { width: 45, height: 45, borderRadius: 16, backgroundColor: "#EEDDC4", alignItems: "center", justifyContent: "center" },
  menuText: {
    flex: 1,
  },
  menuTitle: { color: "#3D2A1C", fontSize: 16, fontWeight: "700", lineHeight: 26, marginBottom: 4 },
  menuSubtitle: { color: "#705B43", fontSize: 13, lineHeight: 22 },
  footer: {
    alignItems: "center",
    marginTop: 48,
  },
  footerBrand: {
    color: "#A27140",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 4,
  },
  footerText: {
    color: "#92765B",
    fontSize: 11,
    marginTop: 8,
  },
  version: {
    color: "#493321",
    fontSize: 10,
    marginTop: 7,
  },
});

