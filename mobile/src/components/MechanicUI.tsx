import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ScrollView,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { CanvasFill, PanelFill } from "./BrandSurfaces";
import BrandWordmark from "./BrandWordmark";
import LanguageSwitch from "./LanguageSwitch";
import { Text } from "./MotexaVisual";
import { useAppearance } from "./Appearance";
import { useLanguage } from "../i18n/LanguageContext";
export function useMechanicTheme() {
  const { dark } = useAppearance(),
    { isArabic: ar } = useLanguage();
  return {
    dark,
    ar,
    t: (en: string, a: string) => (ar ? a : en),
    ink: dark ? "#FFF1DF" : "#432D1E",
    muted: dark ? "#D1B894" : "#80664C",
    surface: dark ? "#35291F" : "#FFFAF1",
    border: dark ? "#73563C" : "#E5D1B3",
    soft: dark ? "#4B3725" : "#F3E3CC",
    row: ar ? ("row-reverse" as const) : ("row" as const),
    align: ar ? ("right" as const) : ("left" as const),
  };
}
export function MechanicProgress({ current }: { current: number }) {
  const m = useMechanicTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 5, now: current }}
      accessibilityLabel={
        m.t("Step ", "الخطوة ") + current + m.t(" of 5", " من 5")
      }
      style={{ paddingVertical: 4, marginBottom: 19, gap: 6 }}
    >
      <View style={{ flexDirection: m.row, alignItems: "center" }}>
        {[1, 2, 3, 4, 5].map((n, i) => (
          <View
            key={n}
            style={{
              flex: i === 4 ? undefined : 1,
              flexDirection: m.row,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 27,
                height: 27,
                borderRadius: 14,
                backgroundColor: n <= current ? "#80502A" : "transparent",
                borderWidth: 1,
                borderColor: n <= current ? "#80502A" : m.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {n < current ? (
                <Ionicons name="checkmark" size={14} color="#FFF7E9" />
              ) : (
                <Text
                  style={{
                    fontSize: 11,
                    color: n === current ? "#FFF7E9" : m.muted,
                  }}
                >
                  {n}
                </Text>
              )}
            </View>
            {i < 4 && (
              <View
                style={{
                  flex: 1,
                  height: 1,
                  marginHorizontal: 4,
                  backgroundColor: n < current ? "#B38A5C" : m.border,
                }}
              />
            )}
          </View>
        ))}
      </View>
      <Text
        style={{
          fontSize: 10,
          lineHeight: 18,
          color: m.muted,
          textAlign: m.align,
        }}
      >
        {m.t("Step ", "الخطوة ") + current + m.t(" of 5", " من 5")}
      </Text>
    </View>
  );
}
export function MechanicPage({
  title,
  subtitle,
  children,
  back = false,
  progress,
  photo = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
  progress?: number;
  photo?: boolean;
}) {
  const m = useMechanicTheme(),
    insets = useSafeAreaInsets(),
    scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [progress, title]);
  return (
    <View style={{ flex: 1 }}>
      <CanvasFill />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: insets.top + 9,
            paddingBottom: insets.bottom + 28,
            width: "100%",
            maxWidth: 680,
            alignSelf: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              direction: "ltr",
              alignItems: "center",
              gap: 7,
              marginBottom: 17,
            }}
          >
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={m.t("Back", "رجوع")}
                onPress={() => router.back()}
                style={{ width: 30, minHeight: 44, justifyContent: "center" }}
              >
                <Ionicons
                  name={m.ar ? "arrow-forward" : "arrow-back"}
                  size={22}
                  color={m.ink}
                />
              </Pressable>
            )}
            <BrandWordmark size={18} style={{ flex: 1 }} />
            <LanguageSwitch light compact unified />
          </View>
          {progress !== undefined && <MechanicProgress current={progress} />}{" "}
          {photo && (
            <View style={{ marginHorizontal: -18, marginBottom: 5 }}>
              <ImageBackground
                accessible={false}
                source={require("../../assets/images/motexa-mechanic-registration-hero.png")}
                resizeMode="cover"
                style={{ width: "100%", height: 174, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={["rgba(30,20,12,0)", "rgba(30,20,12,.12)"]}
                  style={StyleSheet.absoluteFill}
                />
                <Svg
                  width="100%"
                  height={35}
                  viewBox="0 0 390 35"
                  preserveAspectRatio="none"
                  pointerEvents="none"
                  accessible={false}
                  style={{ position: "absolute", bottom: -1, left: 0 }}
                >
                  <Path
                    d="M0 18 C100 -2 174 3 244 17 C310 30 351 24 390 16 L390 35 L0 35 Z"
                    fill={m.dark ? "#30231B" : "#FFF9EF"}
                  />
                </Svg>
              </ImageBackground>
            </View>
          )}
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 26,
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
                lineHeight: 22,
                color: m.muted,
                marginTop: 6,
                textAlign: m.align,
              }}
            >
              {subtitle}
            </Text>
          )}
          <View style={{ height: 18 }} />
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
export function MechanicCard({ children }: { children: ReactNode }) {
  const m = useMechanicTheme();
  return (
    <View
      style={{
        padding: 18,
        borderRadius: 28,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: m.border,
        backgroundColor: m.surface,
        marginBottom: 15,
        gap: 13,
      }}
    >
      <PanelFill radius={28} />
      {children}
    </View>
  );
}
export function MechanicField({
  label,
  icon,
  ...props
}: TextInputProps & { label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const m = useMechanicTheme(),
    [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 12,
          lineHeight: 20,
          fontWeight: "600",
          color: m.ink,
          textAlign: m.align,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: m.row,
          gap: 10,
          alignItems: props.multiline ? "flex-start" : "center",
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: focused ? "#B18350" : m.border,
          borderRadius: props.multiline ? 21 : 26,
          backgroundColor: m.dark ? "#30241C" : "#FFFCF7",
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={m.muted}
            style={{ marginTop: props.multiline ? 14 : 0 }}
          />
        )}
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={m.muted}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minWidth: 0,
              outlineWidth: 0,
              paddingVertical: 12,
              minHeight: props.multiline ? 106 : 49,
              textAlignVertical: props.multiline ? "top" : "center",
              fontSize: 13,
              lineHeight: 22,
              color: m.ink,
              textAlign: m.align,
            },
            props.style,
          ]}
        />
      </View>
    </View>
  );
}
export function MechanicButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const m = useMechanicTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 17,
        paddingVertical: 11,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: secondary ? m.border : "#5C3C25",
        backgroundColor: secondary ? "transparent" : "#573822",
        opacity: disabled || busy ? 0.55 : pressed ? 0.75 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? m.ink : "#FFF8ED"} />
      ) : (
        <Text
          style={{
            fontSize: 13,
            lineHeight: 22,
            fontWeight: "600",
            textAlign: "center",
            color: secondary ? m.ink : "#FFF8ED",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
export function MechanicChoice({
  label,
  selected,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const m = useMechanicTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 47,
        padding: 11,
        borderWidth: 1,
        borderColor: selected ? "#B18350" : m.border,
        borderRadius: 25,
        backgroundColor: selected ? m.soft : "transparent",
        flexDirection: m.row,
        gap: 10,
        alignItems: "center",
      }}
    >
      <Ionicons
        name={icon || (selected ? "checkbox" : "square-outline")}
        size={20}
        color={m.muted}
      />
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 22,
          color: m.ink,
          textAlign: m.align,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function MechanicNote({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  const m = useMechanicTheme();
  return (
    <View
      accessibilityLiveRegion={error ? "assertive" : "polite"}
      style={{
        padding: 13,
        borderRadius: 18,
        backgroundColor: error ? (m.dark ? "#56352A" : "#F9E5D9") : m.soft,
        marginBottom: 13,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          lineHeight: 22,
          color: m.ink,
          textAlign: m.align,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function MechanicServiceChoice({
  label,
  description,
  icon,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const m = useMechanicTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={selected}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 91,
        borderWidth: 1,
        borderColor: selected ? "#B18350" : m.border,
        borderRadius: 22,
        padding: 14,
        flexDirection: m.row,
        alignItems: "center",
        gap: 12,
        backgroundColor: selected ? m.soft : m.dark ? "#30241C" : "#FFFCF7",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 45,
          height: 45,
          borderRadius: 23,
          backgroundColor: selected ? m.surface : m.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color={m.muted} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 23,
            fontWeight: "600",
            color: m.ink,
            textAlign: m.align,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 11,
            lineHeight: 19,
            color: m.muted,
            textAlign: m.align,
          }}
        >
          {description}
        </Text>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={21}
        color={m.muted}
      />
    </Pressable>
  );
}
