import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");

  const { language, toggleLanguage, t, isArabic } =
    useLanguage();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.spring(iconScale, {
        toValue: 1,
        friction: 5,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={["#120D0A", "#1C120D", "#2B1B13"]}
      style={styles.background}
    >
      {/* Background */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView
        style={styles.container}
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
            {/* Top Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    isArabic
                      ? "arrow-forward"
                      : "arrow-back"
                  }
                  size={21}
                  color="#E5B081"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.languageButton}
                onPress={toggleLanguage}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="language-outline"
                  size={17}
                  color="#E0A36F"
                />

                <Text style={styles.languageText}>
                  {language === "en" ? "العربية" : "EN"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Icon */}
            <Animated.View
              style={[
                styles.iconWrapper,
                {
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <LinearGradient
                colors={["#F0C49A", "#B87345", "#7C4528"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconContainer}
              >
                <Ionicons
                  name="key-outline"
                  size={35}
                  color="#1B100B"
                />
              </LinearGradient>
            </Animated.View>

            {/* Brand */}
            <Text style={styles.brandName}>
              {t.common.appName}
            </Text>

            <Text
              style={[
                styles.brandSubtitle,
                isArabic && styles.arabicSubtitle,
              ]}
            >
              {t.forgotPassword.system}
            </Text>

            {/* Heading */}
            <View style={styles.headingSection}>
              <Text
                style={[
                  styles.heading,
                  isArabic && styles.arabicText,
                ]}
              >
                {t.forgotPassword.title}
              </Text>

              <Text
                style={[
                  styles.description,
                  isArabic && styles.arabicText,
                ]}
              >
                {t.forgotPassword.description}
              </Text>
            </View>

            {/* Recovery Card */}
            <View style={styles.card}>
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.common.email}
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#C98B5B"
                  />
                </View>

                <TextInput
                  style={[
                    styles.input,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={t.common.emailPlaceholder}
                  placeholderTextColor="#806F64"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Send Reset Link */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={["#E3AD7A", "#C47A48", "#A95F34"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendButton}
                >
                  <Text style={styles.buttonText}>
                    {t.forgotPassword.sendResetLink}
                  </Text>

                  <View
                    style={[
                      styles.arrowCircle,
                      isArabic && styles.arrowCircleArabic,
                    ]}
                  >
                    <Ionicons
                      name={
                        isArabic
                          ? "arrow-back"
                          : "arrow-forward"
                      }
                      size={18}
                      color="#FBE9D8"
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Security */}
            <View
              style={[
                styles.securityBox,
                isArabic && styles.securityBoxArabic,
              ]}
            >
              <View
                style={[
                  styles.securityIcon,
                  isArabic && styles.securityIconArabic,
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#C98B5B"
                />
              </View>

              <Text
                style={[
                  styles.securityText,
                  isArabic && styles.arabicSecurityText,
                ]}
              >
                {t.forgotPassword.securityMessage}
              </Text>
            </View>

            {/* Back to Login */}
            <TouchableOpacity
              style={[
                styles.loginLink,
                isArabic && styles.rowReverse,
              ]}
              onPress={() =>
                router.replace("/auth/login")
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  isArabic
                    ? "arrow-forward"
                    : "arrow-back"
                }
                size={16}
                color="#D99B69"
              />

              <Text
                style={[
                  styles.loginLinkText,
                  isArabic && styles.loginLinkTextArabic,
                ]}
              >
                {t.forgotPassword.backToSignIn}
              </Text>
            </TouchableOpacity>
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

  container: {
    flex: 1,
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingTop: 40,
    paddingBottom: 80,
  },

  content: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
  },

  glowTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(198, 123, 72, 0.09)",
    top: -100,
    right: -100,
  },

  glowBottom: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(139, 79, 43, 0.08)",
    bottom: -90,
    left: -100,
  },

  /* Top */

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(201,139,91,0.10)",
    borderWidth: 1,
    borderColor: "rgba(201,139,91,0.22)",
    justifyContent: "center",
    alignItems: "center",
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

  /* Logo */

  iconWrapper: {
    alignSelf: "center",
  },

  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#D28B57",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.28,
    shadowRadius: 15,
    elevation: 10,
  },

  brandName: {
    color: "#FFF5EA",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 7,
    textAlign: "center",
    marginLeft: 7,
    marginTop: 17,
  },

  brandSubtitle: {
    color: "#A99181",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 7,
  },

  arabicSubtitle: {
    letterSpacing: 0,
    fontSize: 11,
  },

  /* Heading */

  headingSection: {
    marginTop: 35,
    marginBottom: 21,
  },

  heading: {
    color: "#FFF5EA",
    fontSize: 27,
    fontWeight: "700",
    marginBottom: 9,
  },

  description: {
    color: "#9C8A7E",
    fontSize: 14,
    lineHeight: 21,
  },

  arabicText: {
    textAlign: "right",
    writingDirection: "rtl",
  },

  /* Card */

  card: {
    backgroundColor: "rgba(45, 31, 24, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(205, 150, 108, 0.15)",
    borderRadius: 24,
    padding: 21,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },

  label: {
    color: "#BDAA9C",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 9,
    marginLeft: 2,
  },

  arabicLabel: {
    textAlign: "right",
    writingDirection: "rtl",
    letterSpacing: 0,
    fontSize: 12,
    marginLeft: 0,
    marginRight: 2,
  },

  inputContainer: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 14, 11, 0.65)",
    borderWidth: 1,
    borderColor: "#49352A",
    borderRadius: 15,
    marginBottom: 21,
  },

  inputContainerArabic: {
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
    paddingRight: 15,
  },

  arabicInput: {
    textAlign: "right",
    writingDirection: "rtl",
    paddingHorizontal: 5,
  },

  /* Button */

  buttonWrapper: {
    borderRadius: 15,
    overflow: "hidden",

    shadowColor: "#C47A48",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 7,
  },

  sendButton: {
    height: 56,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
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
    backgroundColor: "rgba(71, 36, 18, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  arrowCircleArabic: {
    right: undefined,
    left: 12,
  },

  /* Security */

  securityBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(201, 139, 91, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(201, 139, 91, 0.12)",
    borderRadius: 17,
    padding: 15,
    marginTop: 20,
  },

  securityBoxArabic: {
    flexDirection: "row-reverse",
  },

  securityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(201, 139, 91, 0.10)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  securityIconArabic: {
    marginRight: 0,
    marginLeft: 12,
  },

  securityText: {
    flex: 1,
    color: "#8F7E73",
    fontSize: 11,
    lineHeight: 17,
  },

  arabicSecurityText: {
    textAlign: "right",
    writingDirection: "rtl",
    fontSize: 12,
    lineHeight: 19,
  },

  /* Login */

  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 27,
  },

  rowReverse: {
    flexDirection: "row-reverse",
  },

  loginLinkText: {
    color: "#D99B69",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 7,
  },

  loginLinkTextArabic: {
    marginLeft: 0,
    marginRight: 7,
  },
});