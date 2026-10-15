import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useLanguage } from "../../i18n/LanguageContext";

// Shown after a mechanic application is submitted. Same look as the other auth screens.
export default function MechanicPendingScreen() {
  const { t, isArabic } = useLanguage();
  const m = t.mechanicSignup;

  return (
    <LinearGradient colors={["#120D0A", "#1C120D", "#2B1B13"]} style={styles.background}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.content}>
        <LinearGradient colors={["#F0C49A", "#B87345", "#7C4528"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoCircle}>
          <Ionicons name="time-outline" size={31} color="#1B100B" />
        </LinearGradient>

        <View style={styles.badge}>
          <Text style={[styles.badgeText, isArabic && { letterSpacing: 0, fontSize: 11 }]}>{m.pendingBadge}</Text>
        </View>

        <Text style={styles.heading}>{m.pendingTitle}</Text>
        <Text style={styles.status}>{m.pendingStatus}</Text>
        <Text style={styles.body}>{m.pendingBody}</Text>

        <TouchableOpacity activeOpacity={0.85} onPress={() => router.replace("/auth/login")} style={styles.buttonWrapper} accessibilityRole="button">
          <LinearGradient colors={["#F0C49A", "#D99B69", "#B87345"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
            <Text style={styles.buttonText}>{m.backToSignIn}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  glowTop: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(198, 123, 72, 0.09)", top: -90, right: -90 },
  glowBottom: { position: "absolute", width: 230, height: 230, borderRadius: 115, backgroundColor: "rgba(139, 79, 43, 0.08)", bottom: -80, left: -90 },
  content: { flex: 1, width: "100%", maxWidth: 430, alignSelf: "center", paddingHorizontal: 25, alignItems: "center", justifyContent: "center" },
  logoCircle: { width: 65, height: 65, borderRadius: 21, justifyContent: "center", alignItems: "center", marginBottom: 22 },
  badge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(217,155,105,0.22)", backgroundColor: "rgba(217,155,105,0.09)", marginBottom: 18 },
  badgeText: { color: "#D99B69", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  heading: { color: "#FFF5EA", fontSize: 25, fontWeight: "700", textAlign: "center", marginBottom: 10 },
  status: { color: "#E5B081", fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 14 },
  body: { color: "#9C8A7E", fontSize: 13, lineHeight: 21, textAlign: "center", marginBottom: 30 },
  buttonWrapper: { borderRadius: 15, overflow: "hidden", alignSelf: "stretch" },
  button: { height: 56, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#20120B", fontSize: 15, fontWeight: "800" },
});
