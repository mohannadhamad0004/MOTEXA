
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "../../i18n/LanguageContext";

type AdminUser = {
  id: string;
  fullName: string;
  role: string;
  status: string;
  adminPermissions?: { permission: string }[];
};

const COLORS = {
  background: "#120D0A",
  card: "#2D1F18",
  bronze: "#E0A36F",
  white: "#FFF5EA",
  muted: "#A99181",
  border: "#49352A",
};

export default function MechanicsAdminScreen() {
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
          `${apiUrl.replace(/\/$/, "")}/auth/me`,
          {
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
      } catch {
        Alert.alert(
          isArabic ? "خطأ في الاتصال" : "Connection error",
          isArabic
            ? "تعذر التحقق من الحساب. تأكدي من تشغيل الخادم."
            : "Could not verify your account. Check the backend."
        );

        router.replace("/auth/login");
      } finally {
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
      colors={["#120D0A", "#1C120D", "#2B1B13"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.languageButton}
            onPress={toggleLanguage}
          >
            <Ionicons
              name="language-outline"
              size={18}
              color={COLORS.bronze}
            />
            <Text style={styles.languageText}>
              {language === "en" ? "العربية" : "EN"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={signOut}
          >
            <Ionicons
              name="log-out-outline"
              size={19}
              color="#F0A28E"
            />
            <Text style={styles.signOutText}>
              {isArabic ? "خروج" : "Sign Out"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Ionicons
              name="car-sport-outline"
              size={29}
              color="#1B100B"
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

        <View style={styles.featureCard}>
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
            name="chevron-forward"
            size={20}
            color={COLORS.muted}
          />
        </View>

        <View style={styles.featureCard}>
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
            name="chevron-forward"
            size={20}
            color={COLORS.muted}
          />
        </View>

        <View style={styles.featureCard}>
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
            name="chevron-forward"
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 55,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  languageText: {
    color: COLORS.bronze,
    fontWeight: "700",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 11,
  },
  signOutText: {
    color: "#F0A28E",
    fontWeight: "700",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginTop: 36,
    marginBottom: 30,
  },
  brandIcon: {
    width: 62,
    height: 62,
    borderRadius: 19,
    backgroundColor: COLORS.bronze,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: 5,
  },
  brandSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  welcomeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 23,
    marginBottom: 34,
  },
  welcomeLabel: {
    color: COLORS.bronze,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  welcomeName: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 9,
  },
  welcomeDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 22,
    marginTop: 11,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 20,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(224,163,111,0.12)",
  },
  verifiedText: {
    color: COLORS.bronze,
    fontSize: 11,
    fontWeight: "800",
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 17,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    marginBottom: 13,
    gap: 14,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(224,163,111,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1 },
  featureTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  featureDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  infoBox: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    marginTop: 24,
    borderRadius: 15,
    backgroundColor: "rgba(224,163,111,0.07)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
  },
});
