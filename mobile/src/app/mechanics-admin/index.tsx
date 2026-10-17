import TouchableOpacity from "../../components/InteractiveButton";
import { useAppearanceStyles, useAppearance } from "../../components/Appearance";
import { Text } from "../../components/MotexaVisual";
import LanguageSwitch from "../../components/LanguageSwitch";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useLanguage } from "../../i18n/LanguageContext";

type AdminUser = {
  id: string;
  fullName: string;
  role: string;
  status: string;
  adminPermissions?: { permission: string }[];
};

const COLORS = {
  background: "#E9DECE",
  card: "#F7EDDD",
  bronze: "#865329",
  white: "#30241D",
  muted: "#695542",
  border: "#D5BFA1",
};

export default function MechanicsAdminScreen() {
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic, language, toggleLanguage } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const token = await SecureStore.getItemAsync(
          "motexa_access_token"
        );

        const apiUrl = process.env.EXPO_PUBLIC_API_URL;

        if (!token || !apiUrl) {
          router.replace("/auth/login");
          return;
        }

        const response = await fetch(
`${apiUrl.replace(/\/$/, "")}/api/auth/me`,          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        const currentUser: AdminUser | undefined = data.user;

        const hasPermission =
          currentUser?.adminPermissions?.some(
            (item) => item.permission === "MANAGE_MECHANICS"
          ) ?? false;

        if (
          !response.ok ||
          !data.success ||
          currentUser?.role !== "ADMIN" ||
          currentUser.status !== "ACTIVE" ||
          !hasPermission
        ) {
          await SecureStore.deleteItemAsync(
            "motexa_access_token"
          );

          router.replace("/auth/login");
          return;
        }

        if (active) {
          setUser(currentUser);
        }

} catch (err) {
  console.error("MECHANICS ADMIN ERROR:", err);        Alert.alert(
          isArabic ? "خطأ في الاتصال" : "Connection error",
          isArabic
            ? "تعذر التحقق من الحساب. تأكدي من تشغيل الخادم."
            : "Could not verify your account. Check the backend."
        );

        router.replace("/auth/login");
      } 
      finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, []);

  const signOut = async () => {
  try {
    await SecureStore.deleteItemAsync("motexa_access_token");

    router.dismissAll();
    router.replace("/");
  } catch (error) {
    console.error("Sign out failed:", error);
  }
};

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.bronze} />
        <Text style={styles.loadingText}>
          {isArabic ? "جارٍ التحقق من الصلاحيات..." : "Verifying access..."}
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={dark ? ["#211B17", "#30251D", "#241D18"] : ["#E4D5C1", "#CEB797", "#DDCAB1"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <LanguageSwitch light />

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={signOut}
          >
            <Ionicons
              name="log-out-outline"
              size={19}
              color="#A27140"
            />
            <Text style={styles.signOutText}>
              {isArabic ? "خروج" : "Sign Out"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.brandRow, isArabic && styles.reverse]}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="car-sport-outline"
              size={29}
              color="#FFFFFF"
            />
          </View>

          <View>
            <Text style={styles.brand}>MOTEXA</Text>
            <Text style={styles.brandSubtitle}>
              {isArabic
                ? "لوحة إدارة الميكانيكيين"
                : "Mechanics Administration"}
            </Text>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>
            {isArabic ? "مرحبًا بعودتك" : "WELCOME BACK"}
          </Text>
          <Text style={styles.welcomeName}>
            {user.fullName}
          </Text>
          <Text style={styles.welcomeDescription}>
            {isArabic
              ? "تابعي طلبات تسجيل الميكانيكيين والتحقق من مؤهلاتهم وإدارة حساباتهم."
              : "Review mechanic applications, verify qualifications, and manage mechanic accounts."}
          </Text>

          <View style={styles.verifiedBadge}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={COLORS.bronze}
            />
            <Text style={styles.verifiedText}>
              {isArabic
                ? "مسؤول قسم الميكانيكيين"
                : "MECHANICS ADMIN"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {isArabic ? "إدارة القسم" : "Department Management"}
        </Text>

        <View style={[styles.featureCard, isArabic && styles.reverse]}>
          <View style={styles.featureIcon}>
            <Ionicons
              name="document-text-outline"
              size={26}
              color={COLORS.bronze}
            />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>
              {isArabic
                ? "طلبات تسجيل الميكانيكيين"
                : "Mechanic Applications"}
            </Text>
            <Text style={styles.featureDescription}>
              {isArabic
                ? "مراجعة الهوية والرخص والشهادات والتخصصات."
                : "Review identity documents, licenses, certificates, and specializations."}
            </Text>
          </View>
          <Ionicons
            name={isArabic ? "chevron-back" : "chevron-forward"}
            size={20}
            color={COLORS.muted}
          />
        </View>

        <View style={[styles.featureCard, isArabic && styles.reverse]}>
          <View style={styles.featureIcon}>
            <Ionicons
              name="people-outline"
              size={26}
              color={COLORS.bronze}
            />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>
              {isArabic
                ? "الميكانيكيون المعتمدون"
                : "Verified Mechanics"}
            </Text>
            <Text style={styles.featureDescription}>
              {isArabic
                ? "عرض الحسابات المعتمدة ومتابعة حالتها."
                : "View verified mechanic accounts and their status."}
            </Text>
          </View>
          <Ionicons
            name={isArabic ? "chevron-back" : "chevron-forward"}
            size={20}
            color={COLORS.muted}
          />
        </View>

        <View style={[styles.featureCard, isArabic && styles.reverse]}>
          <View style={styles.featureIcon}>
            <Ionicons
              name="construct-outline"
              size={26}
              color={COLORS.bronze}
            />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>
              {isArabic
                ? "طلبات الصيانة"
                : "Service Requests"}
            </Text>
            <Text style={styles.featureDescription}>
              {isArabic
                ? "متابعة طلبات الصيانة المتعلقة بالميكانيكيين."
                : "Monitor mechanic-related service requests."}
            </Text>
          </View>
          <Ionicons
            name={isArabic ? "chevron-back" : "chevron-forward"}
            size={20}
            color={COLORS.muted}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color={COLORS.bronze}
          />
          <Text style={styles.infoText}>
            {isArabic
              ? "هذه لوحة القسم الأساسية. سنربط بطاقات الإدارة بطلبات حقيقية من قاعدة البيانات في الخطوة التالية."
              : "This is the department dashboard. We will connect these sections to real database records next."}
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1 },
  reverse: { flexDirection: "row-reverse" },
  loadingContainer: { flex: 1, backgroundColor: "#F2E8D9", alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { color: "#493727", fontSize: 16 },
  content: { paddingHorizontal: 22, paddingTop: 52, paddingBottom: 48, width: "100%", maxWidth: 760, alignSelf: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  signOutButton: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 24, backgroundColor: "#FFF9F0", borderWidth: 1, borderColor: "#CEB798", minHeight: 48 },
  signOutText: { color: "#493321", fontWeight: "700", fontSize: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 30, marginBottom: 25 },
  brandIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#754623", alignItems: "center", justifyContent: "center" },
  brand: { color: "#30241D", fontSize: 26, fontWeight: "800", letterSpacing: 3 },
  brandSubtitle: { color: "#574737", fontSize: 14, marginTop: 4, lineHeight: 22 },
  welcomeCard: { backgroundColor: "#FFF9F0", borderRadius: 24, borderWidth: 1, borderColor: "#CEB798", padding: 24, marginBottom: 28, borderTopWidth: 4, borderTopColor: "#976132" },
  welcomeLabel: { color: "#754623", fontSize: 12, fontWeight: "800", letterSpacing: 1, lineHeight: 20 },
  welcomeName: { color: "#30241D", fontSize: 25, fontWeight: "800", marginTop: 10, lineHeight: 36 },
  welcomeDescription: { color: "#574737", fontSize: 15, lineHeight: 25, marginTop: 12 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 20, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: "#EEDCC2", flexWrap: "wrap" },
  verifiedText: { color: "#633B1C", fontSize: 12, fontWeight: "800", lineHeight: 20 },
  sectionTitle: { color: "#30241D", fontSize: 21, fontWeight: "800", marginBottom: 16, lineHeight: 32 },
  featureCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFDF8", borderRadius: 20, borderWidth: 1, borderColor: "#CEB798", padding: 18, marginBottom: 14, gap: 13 },
  featureIcon: { width: 46, height: 50, borderRadius: 14, backgroundColor: "#EEDCC2", alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, minWidth: 0 },
  featureTitle: { color: "#30241D", fontSize: 16, fontWeight: "800", marginBottom: 7, lineHeight: 25 },
  featureDescription: { color: "#574737", fontSize: 14, lineHeight: 23 },
  infoBox: { flexDirection: "row", gap: 10, padding: 18, marginTop: 12, borderRadius: 16, backgroundColor: "#EFE0C9", borderWidth: 1, borderColor: "#CEB798" },
  infoText: { flex: 1, color: "#493727", fontSize: 14, lineHeight: 24 },
});
