import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLanguage } from "../../../i18n/LanguageContext";

export default function MoreScreen() {
  const { isArabic, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  const menuItems = [
    {
      title: isArabic ? "إدارة المسؤولين" : "Admin Management",
      subtitle: isArabic
        ? "إدارة حسابات المسؤولين وصلاحياتهم"
        : "Manage administrator accounts and permissions",
      icon: "shield-checkmark-outline" as const,
      action: () => router.push("/admin/admin-management"),
    },
    {
      title: isArabic ? "الإعدادات" : "Settings",
      subtitle: isArabic
        ? "إعدادات التطبيق والتفضيلات"
        : "Application settings and preferences",
      icon: "settings-outline" as const,
      action: () => {},
    },
    {
      title: isArabic ? "المساعدة والدعم" : "Help & Support",
      subtitle: isArabic
        ? "المساعدة والتواصل مع الدعم"
        : "Get help and contact support",
      icon: "help-circle-outline" as const,
      action: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 16) + 22 },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={toggleLanguage}
            activeOpacity={0.8}
            style={{
              alignSelf: "flex-end",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#35251B",
              borderWidth: 1,
              borderColor: "#C98B5B",
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 20,
            }}
          >
            <Ionicons name="language-outline" size={19} color="#E0A36F" />
            <Text style={{ color: "#E0A36F", fontWeight: "700" }}>
              {isArabic ? "EN" : "العربية"}
            </Text>
          </TouchableOpacity>
          <View style={styles.brand}>
            <Ionicons name="car-sport" size={21} color="#E0A36F" />
            <Text style={styles.brandText}>MOTEXA</Text>
          </View>

          <Text style={styles.heading}>{isArabic ? "المزيد" : "More"}</Text>

          <Text style={styles.description}>
            {isArabic
              ? "إدارة حسابك وإعدادات النظام"
              : "Manage your account and system settings"}
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={29} color="#E0A36F" />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Administrator</Text>
            <Text style={styles.profileRole}>
              {isArabic ? "لوحة الإدارة" : "Administration Panel"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {isArabic ? "إدارة النظام" : "SYSTEM MANAGEMENT"}
        </Text>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                index !== menuItems.length - 1 && styles.menuDivider,
              ]}
              activeOpacity={0.75}
              onPress={item.action}
            >
              <View style={styles.iconBox}>
                <Ionicons name={item.icon} size={23} color="#E0A36F" />
              </View>

              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>

              <Ionicons
                name={isArabic ? "chevron-back" : "chevron-forward"}
                size={19}
                color="#8E7363"
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>MOTEXA</Text>
          <Text style={styles.footerText}>
            Smart Automotive Service Platform
          </Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#120D0A",
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 45,
  },
  header: {
    marginBottom: 28,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
    gap: 9,
  },
  brandText: {
    color: "#E0A36F",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 3,
  },
  heading: {
    fontSize: 34,
    fontWeight: "900",
    color: "#F6E8DC",
    marginBottom: 8,
  },
  description: {
    color: "#9D8779",
    fontSize: 14,
  },
  profileCard: {
    backgroundColor: "#211711",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(224,163,111,0.18)",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 35,
  },
  avatar: {
    width: 57,
    height: 57,
    borderRadius: 17,
    backgroundColor: "#35251B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: "#F6E8DC",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 5,
  },
  profileRole: {
    color: "#BA967E",
    fontSize: 12,
  },
  sectionTitle: {
    color: "#AC866D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 14,
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: "#211711",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(224,163,111,0.13)",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 17,
    minHeight: 83,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(224,163,111,0.10)",
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: "#35251B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    color: "#F4E5D9",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 5,
  },
  menuSubtitle: {
    color: "#978073",
    fontSize: 11,
    lineHeight: 17,
  },
  footer: {
    alignItems: "center",
    marginTop: 48,
  },
  footerBrand: {
    color: "#A77A5B",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 4,
  },
  footerText: {
    color: "#746258",
    fontSize: 11,
    marginTop: 8,
  },
  version: {
    color: "#625047",
    fontSize: 10,
    marginTop: 7,
  },
});
