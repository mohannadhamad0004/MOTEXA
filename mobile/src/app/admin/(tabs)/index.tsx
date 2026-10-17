import TouchableOpacity from "../../../components/InteractiveButton";
import { useAppearanceStyles, useAppearance } from "../../../components/Appearance";
import { PanelFill, CanvasFill } from "../../../components/BrandSurfaces";
import { MetricSurface } from "../../../components/EditorialUI";
import LanguageSwitch from "../../../components/LanguageSwitch";
import { Text, VisualProvider, HeroReveal, DecorativeHalo } from "../../../components/MotexaVisual";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Alert, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../../i18n/LanguageContext";

type IconName = keyof typeof Ionicons.glyphMap;

const C = {
  background: "#E9DECE",
  surface: "#F7EDDD",
  surfaceLight: "#E8D4B8",
  bronze: "#E0A36F",
  bronzeDark: "#B66E40",
  white: "#FFF5EA",
  muted: "#92765B",
  border: "#D5BFA1",
};

export default function SuperAdminDashboardScreen() {
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
  const { isArabic, toggleLanguage } = useLanguage();
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
  {
    label: t.admins,
    value: statsLoading
      ? "…"
      : statsError
        ? "—"
        : String(dashboardStats?.administrators ?? 0),
    icon: "shield-outline",
  },
  {
    label: t.mechanics,
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
    label: isArabic ? "مراجعات الميكانيكيين" : "Mechanic Reviews",
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
    <VisualProvider><LinearGradient
      colors={dark ? ["#211B17", "#30251D", "#241D18"] : ["#E4D5C1", "#CEB797", "#DDCAB1"]}
      style={styles.container}
    >
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor="#E9DECE" />



      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 0 },
        ]}
      >
        <View style={[styles.masthead, {paddingTop: insets.top + 20}]}><DecorativeHalo />
          <View style={[styles.headerActions, isArabic && styles.rowReverse]}>
            <LanguageSwitch light />

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


        </View>

        {/* Branding */}
        <HeroReveal><LinearGradient colors={["#775138", "#493327", "#2D2521"]} style={styles.hero}>
          <View pointerEvents="none" style={styles.heroMonogram}><Text style={styles.monogramLetter}>M</Text></View><View style={styles.heroTop}>
            <View style={styles.logoBox}>
              <Ionicons name="car-sport" size={25} color={C.bronze} />
            </View>

            <View style={styles.heroText}>
              <Text style={styles.brand}>MOTEXA</Text>
              <Text style={styles.heroSubtitle}>SUPER ADMIN WORKSPACE</Text>
            </View>

            <Ionicons name="shield-checkmark" size={26} color={C.bronze} />
          </View>

          
          <Text style={[styles.heroHeadline, isArabic && styles.textRight]}>{isArabic ? "رؤية أوضح.\nإدارة بثقة." : "Clarity to lead.\nConfidence to grow."}</Text>
          <View style={styles.heroFooter}><View style={styles.heroRule}/><Text style={[styles.heroCaption, isArabic && styles.textRight]}>{isArabic ? "كل التفاصيل، في مساحة واحدة." : "Every detail. One considered workspace."}</Text></View>
        </LinearGradient></HeroReveal></View>

        {/* Overview */}
        <SectionTitle title={t.overview} isArabic={isArabic} />

        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <MetricSurface key={stat.label} style={[styles.statCard, index === 0 && styles.featuredStat]}><PanelFill kind={index === 0 ? "accent" : "light"} radius={20}/>
              <View style={[styles.statIcon, index === 0 && styles.featuredStatIcon]}>
                <Ionicons name={stat.icon} size={22} color={index === 0 ? "#6B4828" : "#9A623C"} />
              </View>

              <Text style={[styles.statValue, index === 0 && styles.featuredStatValue]}>{stat.value}</Text>

              <Text style={[styles.statLabel, index === 0 && styles.featuredStatLabel, isArabic && styles.textRight]}>
                {stat.label}
              </Text>
            </MetricSurface>
          ))}
        </View>

       

        {/* Quick Actions */}
        <SectionTitle title={t.quick} isArabic={isArabic} />

        <View style={styles.actionsGrid}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionCard, index === 0 && styles.primaryAction, isArabic && styles.rowReverse]}
              activeOpacity={0.78}
              onPress={action.onPress}
            ><PanelFill kind={index === 0 ? "hero" : "light"} radius={20}/>
              <View style={[styles.actionIcon, index === 0 && styles.primaryActionIcon]}>
                <Ionicons name={action.icon} size={23} color={index === 0 ? C.bronze : "#9A623C"} />
              </View>

              <Text style={[styles.actionLabel, index === 0 && styles.primaryActionLabel]}>{action.label}</Text>

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


        <TouchableOpacity
          style={styles.profileShortcut}
          onPress={() => router.push("/admin/profile")}
        >
          <Ionicons name="person-circle-outline" size={21} color="#9A623C" />
          <Text style={styles.profileShortcutText}>{t.profile}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </TouchableOpacity>

        <Text style={styles.footer}>{t.footer}</Text>
      </ScrollView>
    </LinearGradient></VisualProvider>
  );
}

function SectionTitle({
  title,
  isArabic,
}: {
  title: string;
  isArabic: boolean;
}) {
 const styles = useAppearanceStyles(baseStyles);
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
 const styles = useAppearanceStyles(baseStyles);
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

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E9DECE",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
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
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    gap: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#DDD0BD",
  },
  headerText: {
    width: "100%",
  },
  greeting: {
    color: "#9E8160",
    fontSize: 10,
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  mainTitle: {
    color: "#3A2B1C",
    fontSize: 27,
    fontWeight: "600",
    marginBottom: 6,
    lineHeight: 38,
  },
  subtitle: {
    color: "#8E765C",
    fontSize: 11,
    lineHeight: 20,
  },
  headerActions: {
    width: "100%",
    marginBottom: 24,
    flexWrap: "wrap",
    justifyContent: "space-between",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerButton: {
    minWidth: 42,
    height: 44,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D9C7AF",
    backgroundColor: "#E8DDCC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 3,
    width: 42,
  },
  languageText: {
    color: C.bronze,
    fontSize: 10,
    fontWeight: "800",
  },
  hero: {
    borderRadius: 26,
    padding: 25,
    borderWidth: 1,
    borderColor: "#A67E50",
    marginBottom: 0,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#4B3321",
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
  },
  brand: {
    color: C.white,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 3.5,
  },
  heroSubtitle: {
    color: "#D5AE88",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.4,
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
    gap: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#3A2B1C",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 28,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#DACEBA",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 19,
  },
  statCard: {
    width: "48.2%",
    minHeight: 162,
    backgroundColor: "#FCFAF5",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D4B998",
    padding: 21,
    marginBottom: 14,
    overflow: "hidden",
  },
  statIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: "#EFE5D6",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: "#3A2B1C",
    fontSize: 39,
    fontWeight: "600",
    marginTop: 13,
    lineHeight: 49,
  },
  statLabel: {
    color: "#8E765C",
    fontSize: 10,
    marginTop: 3,
    lineHeight: 18,
  },
  noticeCard: {
    padding: 22,
    borderRadius: 24,
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
    height: 52,
    borderRadius: 26,
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
    marginBottom: 14,
    gap: 0,
  },
  actionCard: {
    width: "48.2%",
    minHeight: 148,
    borderRadius: 20,
    backgroundColor: "#FCFAF5",
    borderWidth: 1,
    borderColor: "#D4B998",
    padding: 19,
    marginBottom: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 17,
    paddingVertical: 17,
    flexDirection: "column",
    gap: 10,
    overflow: "hidden",
  },
  actionIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#EFE5D6",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: "#3A2B1C",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 7,
    marginBottom: 0,
    lineHeight: 21,
    flex: 0,
  },
  activityCard: {
    borderRadius: 22,
    backgroundColor: "#30231C",
    borderWidth: 1,
    borderColor: "#513D30",
    paddingHorizontal: 18,
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
    fontSize: 14,
    fontWeight: "600",
  },
  activityDescription: {
    color: C.muted,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 20,
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
    marginTop: 12,
    padding: 18,
    backgroundColor: "#E5D1B5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C8A77B",
  },
  profileShortcutText: {
    flex: 1,
    color: "#735334",
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    color: "#AB8E69",
    fontSize: 8,
    textAlign: "center",
    letterSpacing: 1.6,
    marginTop: 28,
  },

masthead: {
    backgroundColor: "transparent",
    marginHorizontal: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 30,
    overflow: "hidden",
  },
heroHeadline: {
    fontSize: 33,
    lineHeight: 44,
    color: "#FAF3E7",
    fontWeight: "600",
    marginTop: 27,
  },
heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 19,
  },
heroRule: {
    height: 1,
    width: 25,
    backgroundColor: "#BA8658",
  },
heroCaption: {
    flex: 1,
    color: "#CFA97C",
    fontSize: 10,
    lineHeight: 18,
  },
featuredStat: {
    backgroundColor: "#E8D6BA",
    borderColor: "#D1B58D",
  },
featuredStatIcon: {
    backgroundColor: "#D7BC94",
  },
featuredStatValue: {
    color: "#51351F",
  },
featuredStatLabel: {
    color: "#85623E",
  },
primaryAction: {
    backgroundColor: "#2B2117",
    borderColor: "#2B2117",
  },
primaryActionIcon: {
    backgroundColor: "#503A23",
  },
primaryActionLabel: {
    color: "#FAF3E7",
  },

heroMonogram: {
    position: "absolute",
    right: -10,
    bottom: -75,
  },
monogramLetter: {
    fontSize: 250,
    lineHeight: 290,
    color: "#D8AA6F0E",
    fontWeight: "700",
  },
});

