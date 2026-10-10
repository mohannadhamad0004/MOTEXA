import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    Alert,
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

export default function AdminActivationScreen() {
  const { isArabic, language, toggleLanguage } = useLanguage();

  const params = useLocalSearchParams<{
    token?: string;
    email?: string;
  }>();

  const email = typeof params.email === "string" ? params.email : "";

  const token = typeof params.token === "string" ? params.token : "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const handleActivation = () => {
    setError("");

    if (!token) {
      setError(
        isArabic
          ? "رابط الدعوة غير متوفر. يجب فتح رابط تفعيل صالح."
          : "Invitation link is missing. Open a valid activation link.",
      );
      return;
    }

    if (!password || !confirmPassword) {
      setError(
        isArabic
          ? "يرجى إدخال كلمة المرور وتأكيدها."
          : "Please enter and confirm your password.",
      );
      return;
    }

    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError(
        isArabic
          ? "يجب أن تحتوي كلمة المرور على 12 حرفًا على الأقل، وحروف كبيرة وصغيرة ورقم ورمز."
          : "Use at least 12 characters, including uppercase, lowercase, a number and a symbol.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        isArabic ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.",
      );
      return;
    }

    // TODO: Backend integration
    // POST /api/auth/admin/activate
    // Server verifies the invitation token, its expiration,
    // one-time use, invited email and assigned permissions.
    // Never activate an admin account on the client alone.

    Alert.alert(
      isArabic ? "التفعيل غير متاح بعد" : "Activation Unavailable",
      isArabic
        ? "تم التحقق من المدخلات، لكن تفعيل الحساب يحتاج إلى Backend وقاعدة بيانات. لم يتم إنشاء أي حساب."
        : "Inputs are valid, but account activation requires the backend and database. No account has been created.",
    );
  };

  return (
    <LinearGradient
      colors={["#120D0A", "#1C120D", "#2B1B13"]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.languageButton}
            onPress={toggleLanguage}
          >
            <Ionicons name="language-outline" size={18} color="#DCA578" />
            <Text style={styles.languageText}>
              {language === "en" ? "العربية" : "EN"}
            </Text>
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <LinearGradient
              colors={["#F0C49A", "#B87345", "#7C4528"]}
              style={styles.iconGradient}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={39}
                color="#1B100B"
              />
            </LinearGradient>
          </View>

          <Text style={styles.brand}>MOTEXA</Text>

          <Text style={styles.title}>
            {isArabic ? "تفعيل حساب المسؤول" : "Admin Account Activation"}
          </Text>

          <Text style={styles.subtitle}>
            {isArabic
              ? "قم بإعداد كلمة مرور آمنة لتفعيل حسابك الإداري."
              : "Set a secure password to activate your administrator account."}
          </Text>

          <View style={styles.card}>
            <View style={styles.infoBox}>
              <Ionicons name="mail-outline" size={19} color="#DCA578" />
              <Text style={styles.infoText}>
                {email ||
                  (isArabic
                    ? "سيتم تحديد البريد الإلكتروني من الدعوة."
                    : "Email will be identified from the invitation.")}
              </Text>
            </View>

            <Text style={styles.label}>
              {isArabic ? "كلمة المرور الجديدة" : "New Password"}
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  { textAlign: isArabic ? "right" : "left" },
                ]}
                placeholder={
                  isArabic ? "أدخل كلمة المرور" : "Enter new password"
                }
                placeholderTextColor="#806F64"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />

              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={21}
                  color="#BDAA9C"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              {isArabic ? "تأكيد كلمة المرور" : "Confirm Password"}
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  { textAlign: isArabic ? "right" : "left" },
                ]}
                placeholder={
                  isArabic ? "أعد إدخال كلمة المرور" : "Confirm new password"
                }
                placeholderTextColor="#806F64"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />

              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm(!showConfirm)}
              >
                <Ionicons
                  name={showConfirm ? "eye-outline" : "eye-off-outline"}
                  size={21}
                  color="#BDAA9C"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>
              {isArabic
                ? "12 حرفًا على الأقل، مع حروف كبيرة وصغيرة ورقم ورمز."
                : "At least 12 characters, with uppercase, lowercase, a number and a symbol."}
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity activeOpacity={0.85} onPress={handleActivation}>
              <LinearGradient
                colors={["#E3AD7A", "#C47A48", "#A95F34"]}
                style={styles.button}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#20120B"
                />
                <Text style={styles.buttonText}>
                  {isArabic ? "تفعيل الحساب" : "Activate Account"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/auth/login")}
          >
            <Ionicons
              name={isArabic ? "arrow-forward" : "arrow-back"}
              size={17}
              color="#D99B69"
            />
            <Text style={styles.backText}>
              {isArabic ? "العودة لتسجيل الدخول" : "Back to Sign In"}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Ionicons name="lock-closed-outline" size={14} color="#78675C" />
            <Text style={styles.footerText}>
              {isArabic
                ? "حسابات المسؤولين تتطلب دعوة معتمدة"
                : "Administrator access requires an authorized invitation"}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingTop: 35,
    paddingBottom: 45,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  languageButton: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 13,
    backgroundColor: "rgba(201,139,91,0.09)",
    borderWidth: 1,
    borderColor: "rgba(201,139,91,0.20)",
  },
  languageText: {
    color: "#DCA578",
    fontSize: 12,
    fontWeight: "700",
  },
  iconContainer: {
    alignItems: "center",
    marginTop: 25,
    marginBottom: 15,
  },
  iconGradient: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: "#FFF5EA",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 7,
    textAlign: "center",
  },
  title: {
    color: "#FFF5EA",
    fontSize: 25,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 28,
  },
  subtitle: {
    color: "#A99181",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 25,
  },
  card: {
    backgroundColor: "rgba(45,31,24,0.78)",
    borderWidth: 1,
    borderColor: "rgba(205,150,108,0.15)",
    borderRadius: 24,
    padding: 21,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "rgba(201,139,91,0.09)",
    marginBottom: 22,
  },
  infoText: {
    color: "#DCA578",
    fontSize: 12,
    flex: 1,
  },
  label: {
    color: "#BDAA9C",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 55,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#49352A",
    backgroundColor: "rgba(20,14,11,0.65)",
    marginBottom: 19,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#FFF5EA",
    fontSize: 14,
    paddingHorizontal: 15,
  },
  eyeButton: {
    width: 47,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    color: "#9C8A7E",
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 18,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(190,75,65,0.12)",
    marginBottom: 16,
  },
  errorText: {
    color: "#F0A28E",
    fontSize: 12,
    lineHeight: 19,
  },
  button: {
    height: 55,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonText: {
    color: "#20120B",
    fontSize: 15,
    fontWeight: "800",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 27,
  },
  backText: {
    color: "#D99B69",
    fontSize: 13,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 32,
  },
  footerText: {
    color: "#78675C",
    fontSize: 10,
    textAlign: "center",
  },
});
