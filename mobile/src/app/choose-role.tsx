
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../i18n/LanguageContext";

type IconName = keyof typeof Ionicons.glyphMap;

const COLORS = {
  background: "#120D0A",
  surface: "#281B14",
  border: "#503729",
  gold: "#E0A36F",
  white: "#FFF5EA",
  muted: "#AE9686",
};

export default function ChooseRoleScreen() {
  const { isArabic, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(25)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const roles: {
    id: string;
    icon: IconName;
    title: string;
    description: string;
  }[] = [
    {
      id: "customer",
      icon: "car-sport-outline",
      title: isArabic ? "مالك سيارة" : "Car Owner",
      description: isArabic
        ? "سيارتك تستحق عناية أذكى. اكتشفي الخدمات المناسبة بسهولة."
        : "Your car deserves smarter care. Find trusted services.",
    },
    {
      id: "mechanic",
      icon: "construct-outline",
      title: isArabic ? "ميكانيكي" : "Mechanic",
      description: isArabic
        ? "مهارتك تصنع الفرق. تواصل مع أصحاب السيارات."
        : "Your skills matter. Connect with vehicle owners.",
    },
    {
      id: "parts",
      icon: "settings-outline",
      title: isArabic ? "محل قطع غيار" : "Parts Provider",
      description: isArabic
        ? "اعرض قطع الغيار وساعد العملاء في إيجاد القطعة المناسبة."
        : "Showcase spare parts and reach more customers.",
    },
    {
      id: "tow",
      icon: "car-outline",
      title: isArabic ? "مزود خدمة ونش" : "Tow Provider",
      description: isArabic
        ? "كن المساعدة التي يحتاجها السائق على الطريق."
        : "Be there when drivers need roadside assistance.",
    },
  ];

  const openLogin = () => {
    router.push("/auth/login");
  };

  return (
    <LinearGradient
      colors={["#0D0907", "#1B120D", "#2A1A11", "#120D0A"]}
      locations={[0, 0.35, 0.72, 1]}
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#120D0A"
      />

      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 35,
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: fade,
            transform: [{ translateY: slide }],
          }}
        >
          {/* Language */}
          <View style={styles.topRow}>
            <View style={styles.brandMini}>
              <Ionicons
                name="car-sport"
                size={19}
                color={COLORS.gold}
              />
              <Text style={styles.brandMiniText}>MOTEXA</Text>
            </View>

            <TouchableOpacity
              style={styles.languageButton}
              onPress={toggleLanguage}
              activeOpacity={0.8}
            >
              <Ionicons
                name="language-outline"
                size={18}
                color={COLORS.gold}
              />
              <Text style={styles.languageText}>
                {isArabic ? "EN" : "AR"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Welcome */}
          <View style={styles.hero}>
            <LinearGradient
              colors={["#F4C99E", "#D58B53", "#A85D34"]}
              style={styles.logo}
            >
              <Ionicons
                name="car-sport-outline"
                size={40}
                color="#24130B"
              />
            </LinearGradient>

            <Text style={styles.welcome}>
              {isArabic ? "أهلًا بك في" : "Welcome to"}
            </Text>

            <Text style={styles.brand}>MOTEXA</Text>

            <Text style={styles.tagline}>
              YOUR SMART AUTOMOTIVE COMPANION
            </Text>

            <Text style={styles.heroDescription}>
              {isArabic
                ? "كل ما تحتاجه سيارتك، في مكان واحد."
                : "Everything your vehicle needs, in one place."}
            </Text>
          </View>

          {/* Section */}
          <Text
            style={[
              styles.sectionTitle,
              isArabic && styles.textRight,
            ]}
          >
            {isArabic
              ? "كيف تحب أن تبدأ رحلتك؟"
              : "How would you like to continue?"}
          </Text>

          <Text
            style={[
              styles.sectionDescription,
              isArabic && styles.textRight,
            ]}
          >
            {isArabic
              ? "اختر نوع حسابك للوصول إلى الخدمات المناسبة."
              : "Choose your account type to get started."}
          </Text>

          {/* Role cards */}
          <View style={styles.grid}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={styles.roleCard}
                activeOpacity={0.8}
                onPress={openLogin}
                accessibilityRole="button"
                accessibilityLabel={role.title}
              >
                <View style={styles.roleIcon}>
                  <Ionicons
                    name={role.icon}
                    size={27}
                    color={COLORS.gold}
                  />
                </View>

                <Text
                  style={[
                    styles.roleTitle,
                    isArabic && styles.textRight,
                  ]}
                >
                  {role.title}
                </Text>

                <Text
                  style={[
                    styles.roleDescription,
                    isArabic && styles.textRight,
                  ]}
                >
                  {role.description}
                </Text>

                <Ionicons
                  name={
                    isArabic
                      ? "arrow-back-outline"
                      : "arrow-forward-outline"
                  }
                  size={18}
                  color={COLORS.gold}
                  style={styles.roleArrow}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Admin portal */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openLogin}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={["#493020", "#2A1B13"]}
              style={styles.adminCard}
            >
              <View style={styles.adminTop}>
                <View style={styles.adminIcon}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={26}
                    color={COLORS.gold}
                  />
                </View>

                <View style={styles.adminText}>
                  <Text style={styles.adminTitle}>
                    {isArabic
                      ? "بوابة الإدارة"
                      : "Administration Portal"}
                  </Text>

                  <Text style={styles.adminSubtitle}>
                    {isArabic
                      ? "دخول آمن للمسؤول الأعلى ومسؤولي الأقسام."
                      : "Secure access for authorized administrators."}
                  </Text>
                </View>

                <Ionicons
                  name={
                    isArabic
                      ? "chevron-back"
                      : "chevron-forward"
                  }
                  size={19}
                  color={COLORS.gold}
                />
              </View>

              <View style={styles.adminDivider} />

              <Text style={styles.adminRoles}>
                {isArabic
                  ? "المسؤول الأعلى • الميكانيكيون • الونشات • قطع الغيار"
                  : "Super Admin • Mechanics • Towing • Spare Parts"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={COLORS.gold}
            />

            <Text style={styles.footerText}>
              {isArabic
                ? "خدمات موثوقة • تجربة آمنة • عناية أذكى"
                : "Trusted Services • Secure Access • Smarter Care"}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  glowTop: {
    position: "absolute",
    width: 290,
    height: 290,
    borderRadius: 145,
    top: -120,
    right: -120,
    backgroundColor: "rgba(224,163,111,0.08)",
  },
  glowBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: -100,
    left: -120,
    backgroundColor: "rgba(224,163,111,0.06)",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandMiniText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  languageText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  hero: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 30,
  },
  logo: {
    width: 83,
    height: 83,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
    elevation: 10,
  },
  welcome: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  brand: {
    color: COLORS.white,
    fontSize: 35,
    fontWeight: "900",
    letterSpacing: 5,
    marginTop: 4,
  },
  tagline: {
    color: COLORS.gold,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginTop: 7,
    textAlign: "center",
  },
  heroDescription: {
    color: "#D0B9A7",
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 7,
  },
  sectionDescription: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 20,
    lineHeight: 19,
  },
  textRight: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  roleCard: {
    width: "48.2%",
    minHeight: 185,
    padding: 15,
    marginBottom: 13,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "rgba(224,163,111,0.11)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  roleTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },
  roleDescription: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    flexGrow: 1,
  },
  roleArrow: {
    marginTop: 10,
  },
  adminCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#805438",
    padding: 17,
    marginTop: 4,
  },
  adminTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adminIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "rgba(224,163,111,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  adminText: {
    flex: 1,
  },
  adminTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },
  adminSubtitle: {
    color: "#C6AD99",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  adminDivider: {
    height: 1,
    backgroundColor: "rgba(224,163,111,0.18)",
    marginVertical: 13,
  },
  adminRoles: {
    color: COLORS.gold,
    fontSize: 10,
    lineHeight: 17,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 27,
  },
  footerText: {
    color: "#917B6B",
    fontSize: 10,
    textAlign: "center",
  },
});
