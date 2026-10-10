import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";

type IconName = keyof typeof Ionicons.glyphMap;

const C = {
  background: "#120D0A",
  surface: "#261A13",
  surfaceLight: "#35241A",
  bronze: "#E0A36F",
  bronzeDark: "#B66E40",
  white: "#FFF5EA",
  muted: "#A99181",
  border: "rgba(224,163,111,0.17)",
};

export default function SuperAdminDashboardScreen() {
  const { isArabic, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

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
            manageAdmins: "إدارة المسؤولين",
            manageMechanics: "إدارة الميكانيكيين",
            manageProviders: "مزودو الخدمات",
            manageRequests: "إدارة الطلبات",
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
            manageAdmins: "Manage Administrators",
            manageMechanics: "Manage Mechanics",
            manageProviders: "Service Providers",
            manageRequests: "Manage Requests",
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
    { label: t.admins, value: "3", icon: "shield-outline" },
    { label: t.mechanics, value: "86", icon: "construct-outline" },
    { label: t.providers, value: "42", icon: "storefront-outline" },
    { label: t.requests, value: "124", icon: "document-text-outline" },
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
      label: t.manageMechanics,
      icon: "construct-outline",
      onPress: () => router.push("/admin/mechanics"),
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

  return (
    <LinearGradient
      colors={["#120D0A", "#1A110D", "#24160F"]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#120D0A" />

      <View style={styles.glow} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, isArabic && styles.textRight]}>
              {t.greeting}
            </Text>

            <Text style={[styles.mainTitle, isArabic && styles.textRight]}>
              {t.title}
            </Text>

            <Text style={[styles.subtitle, isArabic && styles.textRight]}>
              {t.subtitle}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={toggleLanguage}
              accessibilityLabel={
                isArabic ? "Switch to English" : "التبديل للعربية"
              }
            >
              <Ionicons name="language-outline" size={19} color={C.bronze} />
              <Text style={styles.languageText}>{isArabic ? "EN" : "AR"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => showInfo(t.notification, t.notificationText)}
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color={C.bronze}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Branding */}
        <LinearGradient colors={["#4B3020", "#2B1D15"]} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.logoBox}>
              <Ionicons name="car-sport" size={25} color={C.bronze} />
            </View>

            <View style={styles.heroText}>
              <Text style={styles.brand}>MOTEXA</Text>
              <Text style={styles.heroSubtitle}>SUPER ADMIN CONSOLE</Text>
            </View>

            <Ionicons name="shield-checkmark" size={26} color={C.bronze} />
          </View>

          <View style={styles.demoTag}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={C.bronze}
            />
            <Text style={styles.demoText}>{t.demo}</Text>
          </View>
        </LinearGradient>

        {/* Overview */}
        <SectionTitle title={t.overview} isArabic={isArabic} />

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name={stat.icon} size={22} color={C.bronze} />
              </View>

              <Text style={styles.statValue}>{stat.value}</Text>

              <Text style={[styles.statLabel, isArabic && styles.textRight]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Attention */}
        <LinearGradient
          colors={["rgba(160,91,49,0.24)", "rgba(61,39,27,0.8)"]}
          style={styles.noticeCard}
        >
          <View style={styles.noticeRow}>
            <View style={styles.noticeIcon}>
              <Ionicons
                name="alert-circle-outline"
                size={23}
                color={C.bronze}
              />
            </View>

            <View style={styles.noticeText}>
              <Text style={[styles.noticeTitle, isArabic && styles.textRight]}>
                {t.pending}
              </Text>

              <Text
                style={[styles.noticeDescription, isArabic && styles.textRight]}
              >
                {t.pendingText}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/admin/(tabs)/providers")}
          >
            <Text style={styles.primaryButtonText}>{t.review}</Text>

            <Ionicons
              name={isArabic ? "arrow-back-outline" : "arrow-forward-outline"}
              size={18}
              color="#24140D"
            />
          </TouchableOpacity>
        </LinearGradient>

        {/* Quick Actions */}
        <SectionTitle title={t.quick} isArabic={isArabic} />

        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              activeOpacity={0.78}
              onPress={action.onPress}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={action.icon} size={23} color={C.bronze} />
              </View>

              <Text style={styles.actionLabel}>{action.label}</Text>

              <Ionicons
                name={
                  isArabic ? "chevron-back-outline" : "chevron-forward-outline"
                }
                size={15}
                color={C.muted}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <SectionTitle title={t.activity} isArabic={isArabic} />

        <View style={styles.activityCard}>
          <ActivityRow
            icon="person-add-outline"
            title={t.first}
            description={t.firstDesc}
            time={t.now}
            isArabic={isArabic}
          />

          <View style={styles.divider} />

          <ActivityRow
            icon="build-outline"
            title={t.second}
            description={t.secondDesc}
            time={t.earlier}
            isArabic={isArabic}
          />

          <View style={styles.divider} />

          <ActivityRow
            icon="mail-outline"
            title={t.third}
            description={t.thirdDesc}
            time={t.today}
            isArabic={isArabic}
          />
        </View>

        <TouchableOpacity
          style={styles.profileShortcut}
          onPress={() => showInfo(t.profile, t.profileText)}
        >
          <Ionicons name="person-circle-outline" size={19} color={C.bronze} />
          <Text style={styles.profileShortcutText}>{t.profile}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </TouchableOpacity>

        <Text style={styles.footer}>{t.footer}</Text>
      </ScrollView>
    </LinearGradient>
  );
}

function SectionTitle({
  title,
  isArabic,
}: {
  title: string;
  isArabic: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, isArabic && styles.textRight]}>
        {title}
      </Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function ActivityRow({
  icon,
  title,
  description,
  time,
  isArabic,
}: {
  icon: IconName;
  title: string;
  description: string;
  time: string;
  isArabic: boolean;
}) {
  return (
    <View style={[styles.activityRow, isArabic && styles.rowReverse]}>
      <View style={styles.activityIcon}>
        <Ionicons name={icon} size={20} color={C.bronze} />
      </View>

      <View style={styles.activityBody}>
        <Text style={[styles.activityTitle, isArabic && styles.textRight]}>
          {title}
        </Text>

        <Text
          style={[styles.activityDescription, isArabic && styles.textRight]}
        >
          {description}
        </Text>

        <Text style={[styles.activityTime, isArabic && styles.textRight]}>
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -100,
    right: -100,
    backgroundColor: "rgba(224,163,111,0.07)",
  },
  textRight: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  rowReverse: {
    flexDirection: "row-reverse",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 25,
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    color: C.muted,
    fontSize: 12,
    marginBottom: 5,
  },
  mainTitle: {
    color: C.white,
    fontSize: 27,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    color: "#8F7969",
    fontSize: 11,
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerButton: {
    minWidth: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 3,
  },
  languageText: {
    color: C.bronze,
    fontSize: 10,
    fontWeight: "800",
  },
  hero: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(224,163,111,0.22)",
    marginBottom: 30,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(224,163,111,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
  },
  brand: {
    color: C.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroSubtitle: {
    color: C.bronze,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginTop: 4,
  },
  demoTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 18,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  demoText: {
    color: "#C3A58E",
    fontSize: 11,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#EAD8C8",
    fontSize: 15,
    fontWeight: "800",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: "48.3%",
    minHeight: 142,
    backgroundColor: "rgba(43,29,22,0.86)",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  statIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "rgba(224,163,111,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: C.white,
    fontSize: 27,
    fontWeight: "900",
    marginTop: 12,
  },
  statLabel: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
  },
  noticeCard: {
    padding: 19,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(224,163,111,0.25)",
    marginBottom: 30,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noticeIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "rgba(224,163,111,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeText: {
    flex: 1,
    marginHorizontal: 12,
  },
  noticeTitle: {
    color: C.bronze,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  noticeDescription: {
    color: "#C8B3A4",
    fontSize: 12,
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: C.bronze,
    height: 47,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
    marginTop: 18,
  },
  primaryButtonText: {
    color: "#24140D",
    fontSize: 13,
    fontWeight: "900",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  actionCard: {
    width: "48.3%",
    minHeight: 105,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  actionIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: "rgba(224,163,111,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: "#E7D5C6",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 5,
  },
  activityCard: {
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
  },
  activityRow: {
    flexDirection: "row",
    paddingVertical: 17,
    alignItems: "flex-start",
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(224,163,111,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityBody: {
    flex: 1,
    marginHorizontal: 12,
  },
  activityTitle: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
  },
  activityDescription: {
    color: C.muted,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 17,
  },
  activityTime: {
    color: C.bronzeDark,
    fontSize: 10,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
  },
  profileShortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    padding: 15,
    backgroundColor: C.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  profileShortcutText: {
    flex: 1,
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    color: "#806B5D",
    fontSize: 9,
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 28,
  },
});
