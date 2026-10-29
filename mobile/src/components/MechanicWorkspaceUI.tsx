import { useEffect, useRef, type ReactNode } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { Text } from "./MotexaVisual";
import { CanvasFill, PanelFill } from "./BrandSurfaces";
import BrandWordmark from "./BrandWordmark";
import LanguageSwitch from "./LanguageSwitch";
import { useMechanicTheme } from "./MechanicUI";

export type WorkspaceIcon = keyof typeof Ionicons.glyphMap;
export function WorkspaceButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  small = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: WorkspaceIcon;
  small?: boolean;
}) {
  const m = useMechanicTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: small ? 39 : 46,
        borderRadius: 99,
        paddingHorizontal: small ? 14 : 19,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: secondary ? m.border : "#624029",
        backgroundColor: secondary ? m.surface : "#573822",
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        flexDirection: m.row,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={small ? 16 : 18}
          color={secondary ? m.ink : "#FFF6E8"}
        />
      )}
      <Text
        style={{
          fontSize: small ? 11 : 13,
          fontWeight: "600",
          color: secondary ? m.ink : "#FFF6E8",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function WorkspaceCard({ children }: { children: ReactNode }) {
  const m = useMechanicTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: m.border,
        backgroundColor: m.surface,
        borderRadius: 26,
        padding: 18,
        overflow: "hidden",
        gap: 14,
        marginBottom: 16,
      }}
    >
      <PanelFill radius={26} />
      {children}
    </View>
  );
}
export function WorkspaceBadge({
  label,
  tone = "bronze",
}: {
  label: string;
  tone?: "bronze" | "green" | "red" | "blue" | "grey";
}) {
  const m = useMechanicTheme(),
    color = {
      bronze: ["#F2E4CE", "#865D30"],
      green: ["#E2ECDD", "#426C48"],
      red: ["#F4E1DA", "#9D483D"],
      blue: ["#E3EAF0", "#536E86"],
      grey: ["#E7E1D9", "#766657"],
    }[tone];
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 99,
        backgroundColor: m.dark ? m.soft : color[0],
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 10, color: m.dark ? m.ink : color[1] }}>
        {label}
      </Text>
    </View>
  );
}
export function WorkspaceAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const m = useMechanicTheme();
  return (
    <View
      style={{
        width: large ? 61 : 43,
        height: large ? 61 : 43,
        borderRadius: 99,
        backgroundColor: m.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ fontSize: large ? 22 : 14, color: m.ink, fontWeight: "600" }}
      >
        {name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((v) => v[0])
          .join("")}
      </Text>
    </View>
  );
}
export function WorkspaceHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const m = useMechanicTheme();
  return (
    <View style={{ gap: 5, marginBottom: 19 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 27,
          lineHeight: 36,
          fontWeight: "600",
          color: m.ink,
          textAlign: m.align,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: 12,
            lineHeight: 21,
            color: m.muted,
            textAlign: m.align,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
export function WorkspaceTabs({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const m = useMechanicTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 15, flexGrow: 0 }}
      contentContainerStyle={{ flexDirection: m.row, gap: 6 }}
    >
      {items.map((i) => (
        <Pressable
          key={i.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === i.key }}
          onPress={() => onChange(i.key)}
          style={{
            paddingHorizontal: 15,
            paddingVertical: 10,
            borderRadius: 99,
            backgroundColor: value === i.key ? "#573822" : m.soft,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: value === i.key ? "#FFF6E8" : m.muted,
            }}
          >
            {i.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function WorkspaceSheet({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const m = useMechanicTheme(),
    { width } = useWindowDimensions();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#24170E66",
          justifyContent: width < 720 ? "flex-end" : "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Pressable
          accessibilityLabel={m.t("Close dialog", "إغلاق النافذة")}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 490,
            maxHeight: "87%",
            backgroundColor: m.surface,
            borderRadius: 29,
            borderWidth: 1,
            borderColor: m.border,
            overflow: "hidden",
          }}
        >
          <PanelFill radius={29} />
          <View
            style={{
              flexDirection: m.row,
              alignItems: "center",
              justifyContent: "space-between",
              padding: 21,
              paddingBottom: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ fontSize: 21, fontWeight: "600", color: m.ink, flex: 1 }}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.t("Close", "إغلاق")}
              onPress={onClose}
              style={{ padding: 8 }}
            >
              <Ionicons name="close" size={21} color={m.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 21, paddingTop: 7, gap: 13 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function WorkspaceHero({ name }: { name: string }) {
  const m = useMechanicTheme(),
    { width } = useWindowDimensions();
  return (
    <View
      style={{ marginHorizontal: -18, marginBottom: 17, overflow: "hidden" }}
    >
      <ImageBackground
        source={require("../../assets/images/motexa-mechanic-registration-hero.png")}
        resizeMode="cover"
        imageStyle={{ height: width >= 1050 ? 440 : 222, top: 0 }}
        style={{
          width: "100%",
          height: 222,
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <LinearGradient
          colors={["rgba(25,17,11,.87)", "rgba(25,17,11,.12)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ gap: 9, maxWidth: 365 }}>
          <Text style={{ fontSize: 9, letterSpacing: 2, color: "#E6C9A3" }}>
            {m.t("MOTEXA · MECHANICS ADMIN", "MOTEXA · إدارة الميكانيكيين")}
          </Text>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 35,
              color: "#FFF9EF",
              fontWeight: "600",
              maxWidth: 310,
            }}
          >
            {m.t("Your mechanics\nworkspace.", "مساحة إدارة\nالميكانيكيين.")}
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 20, color: "#F2E7D7" }}>
            {m.t("Welcome back, ", "أهلًا، ") +
              name +
              "\n" +
              m.t(
                "Every application. Every detail. One clear journey.",
                "كل طلب وكل تفصيل، ضمن رحلة واضحة.",
              )}
          </Text>
        </View>
        <Svg
          width="100%"
          height={26}
          viewBox="0 0 1000 40"
          preserveAspectRatio="none"
          style={{ position: "absolute", bottom: -1, left: 0 }}
          pointerEvents="none"
        >
          <Path
            d="M0 22C240 -14 640 61 1000 12V40H0Z"
            fill={m.dark ? "#30231B" : "#FFF9EF"}
          />
        </Svg>
      </ImageBackground>
    </View>
  );
}
export function WorkspaceFrame({
  children,
  page,
  onNavigate,
  unread = 0,
  name = "",
  busy = false,
  admin = true,
}: {
  children: ReactNode;
  page: string;
  onNavigate: (page: string) => void;
  unread?: number;
  name?: string;
  busy?: boolean;
  admin?: boolean;
}) {
  const m = useMechanicTheme(),
    insets = useSafeAreaInsets(),
    { width } = useWindowDimensions(),
    wide = width >= 1050,
    scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [page]);
  const links = admin
    ? [
        ["home", "home-outline", m.t("Overview", "الرئيسية")],
        [
          "applications",
          "document-text-outline",
          m.t("Applications", "الطلبات"),
        ],
        ["directory", "people-outline", m.t("Mechanics", "الميكانيكيون")],
        ["bank", "book-outline", m.t("Question bank", "بنك الأسئلة")],
        ["messages", "chatbubbles-outline", m.t("Conversations", "المحادثات")],
        [
          "notifications",
          "notifications-outline",
          m.t("Notifications", "الإشعارات"),
        ],
      ]
    : [
        [
          "test",
          "clipboard-outline",
          m.t("Professional test", "الاختبار المهني"),
        ],
        [
          "conversation",
          "chatbubbles-outline",
          m.t("Conversation", "المحادثة"),
        ],
        [
          "notifications",
          "notifications-outline",
          m.t("Notifications", "الإشعارات"),
        ],
      ];
  return (
    <View style={{ flex: 1 }}>
      <CanvasFill />
      <View
        style={{
          flex: 1,
          flexDirection: wide ? m.row : "column",
          width: "100%",
          maxWidth: 1560,
          alignSelf: "center",
        }}
      >
        {wide && (
          <View
            style={{
              width: 215,
              paddingTop: 30 + insets.top,
              paddingHorizontal: 15,
              borderRightWidth: 1,
              borderRightColor: m.border,
              gap: 9,
            }}
          >
            <BrandWordmark size={24} />
            <View style={{ height: 25 }} />
            {links.map(([key, icon, label]) => (
              <Pressable
                key={key}
                accessibilityLabel={label}
                onPress={() => onNavigate(key)}
                accessibilityRole="button"
                style={{
                  flexDirection: m.row,
                  gap: 11,
                  padding: 13,
                  borderRadius: 99,
                  backgroundColor: page === key ? "#573822" : "transparent",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={icon as WorkspaceIcon}
                  size={19}
                  color={page === key ? "#FFF6E8" : m.muted}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: page === key ? "#FFF6E8" : m.muted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            <View style={{ padding: 12, marginBottom: 20, gap: 5 }}>
              <Text style={{ color: m.ink, fontSize: 13 }}>{name}</Text>
              <Text style={{ color: m.muted, fontSize: 10 }}>
                {m.t(
                  admin ? "Mechanics Admin" : "Mechanic",
                  admin ? "أدمن الميكانيك" : "ميكانيكي",
                )}
              </Text>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              paddingTop: insets.top + 9,
              paddingHorizontal: 18,
              paddingBottom: 13,
              flexDirection: "row",
              direction: "ltr",
              alignItems: "center",
              gap: 6,
            }}
          >
            <BrandWordmark size={width < 370 ? 17 : 22} style={{ flex: 1 }} />
            <LanguageSwitch compact unified light />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.t("Notifications", "الإشعارات")}
              onPress={() => onNavigate("notifications")}
              style={{
                width: 34,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="notifications-outline" size={21} color={m.ink} />
              {unread > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    backgroundColor: "#A87949",
                    borderRadius: 10,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontSize: 8, color: "white" }}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          {busy && (
            <ActivityIndicator
              color={m.muted}
              size="small"
              accessibilityLabel={m.t("Loading", "تحميل")}
            />
          )}
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: 5,
              paddingBottom: wide ? 35 : insets.bottom + 100,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
      {!wide && (
        <View
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom, 9),
            left: 12,
            right: 12,
            maxWidth: 650,
            alignSelf: "center",
            borderRadius: 99,
            padding: 6,
            borderWidth: 1,
            borderColor: m.border,
            backgroundColor: m.surface,
            flexDirection: m.row,
            justifyContent: "space-around",
            elevation: 4,
            boxShadow: "0px 5px 24px rgba(76,46,29,0.10)",
          }}
        >
          {(admin
            ? [
                ["home", "home-outline", m.t("Home", "الرئيسية")],
                [
                  "applications",
                  "people-outline",
                  m.t("Mechanics", "الميكانيكيون"),
                ],
                ["bank", "book-outline", m.t("Tests", "الاختبارات")],
                ["more", "menu-outline", m.t("More", "المزيد")],
              ]
            : links
          ).map(([key, icon, label]) => (
            <Pressable
              key={key}
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected: page === key }}
              onPress={() => onNavigate(key)}
              style={{
                minHeight: 47,
                flex: 1,
                borderRadius: 99,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                backgroundColor: page === key ? m.soft : "transparent",
              }}
            >
              <Ionicons name={icon as WorkspaceIcon} size={19} color={m.ink} />
              <Text style={{ fontSize: 9, color: m.muted }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
