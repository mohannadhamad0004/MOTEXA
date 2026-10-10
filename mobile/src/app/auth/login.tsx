import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "../../i18n/LanguageContext";

const COLORS = {
  background: "#120D0A",
  bronze: "#C98B5B",
  lightBronze: "#E3AD7A",
  white: "#FFF5EA",
  muted: "#A99181",
  border: "#49352A",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
const [isLoading, setIsLoading] = useState(false);
  const { language, toggleLanguage, t, isArabic } = useLanguage();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, logoScale]);

 const handleLogin = async () => {
  if (isLoading) return;

  setError("");

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    setError(
      isArabic
        ? "يرجى إدخال البريد الإلكتروني وكلمة المرور."
        : "Please enter your email and password."
    );
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    setError(
      isArabic
        ? "يرجى إدخال بريد إلكتروني صحيح."
        : "Please enter a valid email address."
    );
    return;
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!apiUrl) {
    setError(
      isArabic
        ? "عنوان الخادم غير مُعدّ."
        : "Server URL is not configured."
    );
    return;
  }

  setIsLoading(true);

  try {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      setError(
        response.status === 401
          ? isArabic
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
            : "Invalid email or password."
          : response.status === 403
            ? isArabic
              ? "الحساب غير مفعّل حاليًا."
              : "This account is not active."
            : isArabic
              ? "تعذّر تسجيل الدخول. حاولي مرة أخرى."
              : "Login failed. Please try again."
      );
      return;
    }

    const role = data.user?.role;

    if (
      role !== "SUPER_ADMIN" &&
      role !== "ADMIN"
    ) {
      setError(
        isArabic
          ? "هذه البوابة مخصصة للمسؤولين فقط."
          : "This portal is for administrators only."
      );
      return;
    }

    if (
      data.user?.status !== "ACTIVE" ||
      typeof data.accessToken !== "string" ||
      !data.accessToken
    ) {
      throw new Error("Invalid login response");
    }

    await SecureStore.setItemAsync(
      "motexa_access_token",
      data.accessToken
    );

    setPassword("");

    router.replace("/admin/(tabs)");
  } catch {
    setError(
      isArabic
        ? "تعذّر الاتصال بالخادم. تأكدي من تشغيل Backend والاتصال بالشبكة."
        : "Cannot connect to the server. Check your backend and network connection."
    );
  } finally {
    setIsLoading(false);
  }
};

  return (
    <LinearGradient
      colors={["#120D0A", "#1C120D", "#2B1B13"]}
      style={styles.background}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.languageRow}>
              <TouchableOpacity
                style={styles.languageButton}
                onPress={toggleLanguage}
                activeOpacity={0.75}
              >
                <Ionicons name="language-outline" size={17} color="#E0A36F" />
                <Text style={styles.languageText}>
                  {language === "en" ? "العربية" : "EN"}
                </Text>
              </TouchableOpacity>
            </View>

            <Animated.View
              style={[
                styles.logoContainer,
                { transform: [{ scale: logoScale }] },
              ]}
            >
              <LinearGradient
                colors={["#F0C49A", "#B87345", "#7C4528"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoCircle}
              >
                <Ionicons name="car-sport-outline" size={37} color="#1B100B" />
              </LinearGradient>
            </Animated.View>

            <Text style={styles.brandName}>{t.common.appName}</Text>

            <Text style={[styles.tagline, isArabic && styles.arabicTagline]}>
              {t.common.tagline}
            </Text>

            <View style={styles.adminBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={COLORS.bronze}
              />
              <Text style={styles.adminBadgeText}>
                {isArabic ? "بوابة الإدارة الآمنة" : "SECURE ADMIN PORTAL"}
              </Text>
            </View>

            <View style={styles.welcomeSection}>
              <Text
                style={[styles.welcomeTitle, isArabic && styles.arabicText]}
              >
                {t.login.welcome}
              </Text>

              <Text style={[styles.welcomeText, isArabic && styles.arabicText]}>
                {t.login.description}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={[styles.label, isArabic && styles.arabicText]}>
                {t.common.email}
              </Text>

              <View
                style={[styles.inputContainer, isArabic && styles.rowReverse]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={COLORS.bronze}
                  />
                </View>

                <TextInput
                  style={[styles.input, isArabic && styles.arabicInput]}
                  placeholder={t.common.emailPlaceholder}
                  placeholderTextColor="#806F64"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>

              <Text style={[styles.label, isArabic && styles.arabicText]}>
                {t.common.password}
              </Text>

              <View
                style={[styles.inputContainer, isArabic && styles.rowReverse]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={COLORS.bronze}
                  />
                </View>

                <TextInput
                  style={[styles.input, isArabic && styles.arabicInput]}
                  placeholder={t.login.passwordPlaceholder}
                  placeholderTextColor="#806F64"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={21}
                    color="#A99181"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => router.push("/auth/forgot-password")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.forgotPassword,
                    isArabic && styles.forgotPasswordArabic,
                  ]}
                >
                  {t.login.forgotPassword}
                </Text>
              </TouchableOpacity>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#F0A28E"
                  />
                  <Text
                    style={[styles.errorText, isArabic && styles.arabicText]}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.loginButtonWrapper}
               onPress={handleLogin}
disabled={isLoading}
              >
                <LinearGradient
                  colors={["#E3AD7A", "#C47A48", "#A95F34"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButton}
                >
                <Text style={styles.loginButtonText}>
  {isLoading
    ? isArabic
      ? "جارٍ تسجيل الدخول..."
      : "Signing in..."
    : t.login.signIn}
</Text>

                  <View
                    style={[
                      styles.arrowCircle,
                      isArabic && styles.arrowCircleArabic,
                    ]}
                  >
                    <Ionicons
                      name={isArabic ? "arrow-back" : "arrow-forward"}
                      size={18}
                      color="#FBE9D8"
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.invitationBox}>
              <Ionicons name="mail-unread-outline" size={19} color="#D99B69" />
              <Text
                style={[styles.invitationText, isArabic && styles.arabicText]}
              >
                {isArabic
                  ? "حسابات المسؤولين تُنشأ بدعوة معتمدة من المسؤول الأعلى فقط."
                  : "Administrator accounts are activated through authorized Super Admin invitations only."}
              </Text>
            </View>

            <View style={[styles.footer, isArabic && styles.rowReverse]}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#78675C"
              />
              <Text style={styles.footerText}>{t.login.secureAccess}</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 55,
  },
  content: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
  },
  glowTop: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(198,123,72,0.09)",
    top: -90,
    right: -90,
  },
  glowBottom: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(139,79,43,0.08)",
    bottom: -80,
    left: -90,
  },
  languageRow: {
    alignItems: "flex-end",
    marginBottom: 5,
  },
  languageButton: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: "rgba(201,139,91,0.09)",
    borderWidth: 1,
    borderColor: "rgba(201,139,91,0.20)",
  },
  languageText: {
    color: "#DCA578",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 7,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D28B57",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 15,
    elevation: 10,
  },
  brandName: {
    color: "#FFF5EA",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    marginLeft: 8,
  },
  tagline: {
    color: "#A99181",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2.2,
    textAlign: "center",
    marginTop: 7,
  },
  arabicTagline: {
    letterSpacing: 0,
    fontSize: 12,
  },
  adminBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(201,139,91,0.10)",
    borderWidth: 1,
    borderColor: "rgba(201,139,91,0.22)",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 15,
  },
  adminBadgeText: {
    color: "#DCA578",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  welcomeSection: {
    marginTop: 33,
    marginBottom: 20,
  },
  welcomeTitle: {
    color: "#FFF5EA",
    fontSize: 27,
    fontWeight: "700",
    marginBottom: 6,
  },
  welcomeText: {
    color: "#9C8A7E",
    fontSize: 14,
    lineHeight: 21,
  },
  arabicText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  card: {
    backgroundColor: "rgba(45,31,24,0.78)",
    borderWidth: 1,
    borderColor: "rgba(205,150,108,0.15)",
    borderRadius: 24,
    padding: 21,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  label: {
    color: "#BDAA9C",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 9,
    marginLeft: 2,
  },
  inputContainer: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,14,11,0.65)",
    borderWidth: 1,
    borderColor: "#49352A",
    borderRadius: 15,
    marginBottom: 19,
  },
  rowReverse: {
    flexDirection: "row-reverse",
  },
  inputIcon: {
    width: 49,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#FFF5EA",
    fontSize: 14,
    paddingHorizontal: 8,
  },
  arabicInput: {
    textAlign: "right",
  },
  eyeButton: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  forgotPassword: {
    color: "#D99B69",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    marginTop: -5,
    marginBottom: 22,
  },
  forgotPasswordArabic: {
    textAlign: "left",
    writingDirection: "rtl",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(190,75,65,0.12)",
    borderWidth: 1,
    borderColor: "rgba(240,162,142,0.25)",
    marginBottom: 17,
  },
  errorText: {
    color: "#F0A28E",
    fontSize: 12,
    lineHeight: 19,
    flex: 1,
  },
  loginButtonWrapper: {
    borderRadius: 15,
    overflow: "hidden",
    shadowColor: "#C47A48",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 7,
  },
  loginButton: {
    height: 56,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "#20120B",
    fontSize: 15,
    fontWeight: "800",
  },
  arrowCircle: {
    position: "absolute",
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(71,36,18,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowCircleArabic: {
    right: undefined,
    left: 12,
  },
  invitationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "rgba(201,139,91,0.07)",
    borderWidth: 1,
    borderColor: "rgba(201,139,91,0.15)",
    borderRadius: 14,
    padding: 15,
    marginTop: 24,
  },
  invitationText: {
    color: "#BDAA9C",
    fontSize: 12,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    gap: 6,
  },
  footerText: {
    color: "#78675C",
    fontSize: 10,
    fontWeight: "600",
  },
});
