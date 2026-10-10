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

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useLanguage } from "../../i18n/LanguageContext";

export default function SignUpScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const { language, toggleLanguage, t, isArabic } =
    useLanguage();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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
    ]).start();
  }, []);

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

            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={["#F0C49A", "#B87345", "#7C4528"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoCircle}
              >
                <Ionicons
                  name="person-add-outline"
                  size={31}
                  color="#1B100B"
                />
              </LinearGradient>
            </View>

            <Text style={styles.brandName}>
              {t.common.appName}
            </Text>

            <Text
              style={[
                styles.tagline,
                isArabic && styles.arabicTagline,
              ]}
            >
              {t.signup.system}
            </Text>

            {/* Heading */}
            <View style={styles.headingSection}>
              <Text
                style={[
                  styles.heading,
                  isArabic && styles.arabicText,
                ]}
              >
                {t.signup.title}
              </Text>

              <Text
                style={[
                  styles.description,
                  isArabic && styles.arabicText,
                ]}
              >
                {t.signup.description}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.card}>
              {/* Full Name */}
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.signup.fullName}
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color="#C98B5B"
                  />
                </View>

                <TextInput
                  style={[
                    styles.input,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={
                    t.signup.fullNamePlaceholder
                  }
                  placeholderTextColor="#806F64"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Email */}
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

              {/* Password */}
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.common.password}
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#C98B5B"
                  />
                </View>

                <TextInput
                  style={[
                    styles.passwordInput,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={
                    t.signup.passwordPlaceholder
                  }
                  placeholderTextColor="#806F64"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  <Ionicons
                    name={
                      showPassword
                        ? "eye-outline"
                        : "eye-off-outline"
                    }
                    size={21}
                    color="#A99181"
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <Text
                style={[
                  styles.label,
                  isArabic && styles.arabicLabel,
                ]}
              >
                {t.signup.confirmPassword}
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  isArabic && styles.inputContainerArabic,
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#C98B5B"
                  />
                </View>

                <TextInput
                  style={[
                    styles.passwordInput,
                    isArabic && styles.arabicInput,
                  ]}
                  placeholder={
                    t.signup.confirmPasswordPlaceholder
                  }
                  placeholderTextColor="#806F64"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  <Ionicons
                    name={
                      showConfirmPassword
                        ? "eye-outline"
                        : "eye-off-outline"
                    }
                    size={21}
                    color="#A99181"
                  />
                </TouchableOpacity>
              </View>

              {/* Create Account */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={["#E3AD7A", "#C47A48", "#A95F34"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createButton}
                >
                  <Text style={styles.buttonText}>
                    {t.signup.createAccount}
                  </Text>

                  <View
                    style={[
                      styles.arrowCircle,
                      isArabic &&
                        styles.arrowCircleArabic,
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

            {/* Login */}
            <View
              style={[
                styles.loginContainer,
                isArabic && styles.rowReverse,
              ]}
            >
              <Text style={styles.loginQuestion}>
                {t.signup.alreadyHaveAccount}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  router.replace("/auth/login")
                }
              >
                <Text style={styles.loginText}>
                  {t.signup.signIn}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View
              style={[
                styles.footer,
                isArabic && styles.rowReverse,
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#78675C"
              />

              <Text
                style={[
                  styles.footerText,
                  isArabic &&
                    styles.arabicFooterText,
                ]}
              >
                {t.signup.secureRegistration}
              </Text>
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
    paddingHorizontal: 25,
    paddingTop: 45,
    paddingBottom: 100,
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
    backgroundColor: "rgba(198, 123, 72, 0.09)",
    top: -90,
    right: -90,
  },

  glowBottom: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(139, 79, 43, 0.08)",
    bottom: -80,
    left: -90,
  },

  /* Top Bar */

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
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

  logoContainer: {
    alignItems: "center",
    marginBottom: 12,
  },

  logoCircle: {
    width: 65,
    height: 65,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#D28B57",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.25,
    shadowRadius: 13,
    elevation: 8,
  },

  brandName: {
    color: "#FFF5EA",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 7,
    textAlign: "center",
    marginLeft: 7,
  },

  tagline: {
    color: "#A99181",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 6,
  },

  arabicTagline: {
    letterSpacing: 0,
    fontSize: 11,
  },

  /* Heading */

  headingSection: {
    marginTop: 27,
    marginBottom: 18,
  },

  heading: {
    color: "#FFF5EA",
    fontSize: 25,
    fontWeight: "700",
    marginBottom: 6,
  },

  description: {
    color: "#9C8A7E",
    fontSize: 13,
    lineHeight: 20,
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
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 14, 11, 0.65)",
    borderWidth: 1,
    borderColor: "#49352A",
    borderRadius: 15,
    marginBottom: 17,
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

  passwordInput: {
    flex: 1,
    height: "100%",
    color: "#FFF5EA",
    fontSize: 14,
  },

  arabicInput: {
    textAlign: "right",
    writingDirection: "rtl",
    paddingHorizontal: 5,
  },

  eyeButton: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Button */

  buttonWrapper: {
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 5,

    shadowColor: "#C47A48",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 7,
  },

  createButton: {
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

  /* Bottom */

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  rowReverse: {
    flexDirection: "row-reverse",
  },

  loginQuestion: {
    color: "#8F7E73",
    fontSize: 13,
    marginHorizontal: 3,
  },

  loginText: {
    color: "#D99B69",
    fontSize: 13,
    fontWeight: "700",
    marginHorizontal: 3,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 10,
  },

  footerText: {
    color: "#78675C",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1.4,
    marginLeft: 6,
  },

  arabicFooterText: {
    letterSpacing: 0,
    fontSize: 10,
    marginLeft: 0,
    marginRight: 6,
  },
});