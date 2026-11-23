import {useOwnerIdentity} from './OwnerIdentity';
import {automotive} from './DesignTokens';
import MechanicJourneyHeader from './MechanicJourneyHeader';
import BrandMonogram from './BrandMonogram';
import Pressable from "./MotionPressable";
import TextInput from "./PremiumTextInput";
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  ScrollView,
  RefreshControl,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { CanvasFill, PanelFill } from "./BrandSurfaces";
import BrandHeader from "./BrandHeader";

import { Text } from "./MotexaVisual";
import { useAppearance } from "./Appearance";
import { useLanguage } from "../i18n/LanguageContext";
export function useMechanicTheme() {
  const owner=useOwnerIdentity(), { dark } = useAppearance(),
    { isArabic: ar } = useLanguage();
  return {
    dark,
    ar,
    t: (en: string, a: string) => (ar ? a : en),
    ...(dark?automotive.dark:automotive.light),
    ...(owner&&dark?{canvas:'#130E0B',surface:'#211A16',soft:'#33261E',border:'#49382C',muted:'#BEAEA1',inactive:'#928073'}:{}),
    primary:dark?automotive.dark.bronze:'#573822',
    primaryInk:dark?automotive.dark.canvas:'#FFF5EA',
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
          fontSize: 12,
          lineHeight: 20,
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
  onStep,
  stepsDisabled=false,
  canSelectStep,
  presentation="journey",
  footer,
  onRefresh,
  refreshing=false,
  backdrop,
  contentOverlay,
  onContentScroll,
  scrollKey,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  presentation?:"journey"|"workspace";
  onRefresh?:()=>void;
  refreshing?:boolean;
  footer?:ReactNode;
  backdrop?:ReactNode;
  contentOverlay?:ReactNode;
  onContentScroll?:import("react-native").ScrollViewProps["onScroll"];
  scrollKey?:string;
  back?: boolean;
  progress?: number;
  photo?: boolean;
  onStep?: (step:number)=>void;
  stepsDisabled?:boolean;
  canSelectStep?: (step:number)=>boolean;
}) {
  const owner=useOwnerIdentity(), m = useMechanicTheme(),
    insets = useSafeAreaInsets(),
    scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [progress, title,scrollKey]);
  return (
    <View style={{ flex: 1 }}>
      {owner?<View style={{position:"absolute",inset:0,backgroundColor:m.canvas}}/>:<CanvasFill />}
      {backdrop}
      <View pointerEvents="none" style={{position:'absolute',top:100,left:0,right:0,bottom:0,overflow:'hidden'}}><BrandMonogram size={340} style={{top:10,left:-85,opacity:presentation==='workspace'?.012:.025}}/></View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scroll}
          onScroll={onContentScroll}
          scrollEventThrottle={onContentScroll?16:undefined}
          refreshControl={onRefresh&&Platform.OS!=="web"?<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[m.muted]} tintColor={m.muted} progressBackgroundColor={m.surface}/>:undefined}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: insets.top + 9,
            paddingBottom: footer?24:insets.bottom + 28,
            width: "100%",
            maxWidth: owner?520:680,
            alignSelf: "center",
          }}
        >
          <View style={{marginHorizontal:-6}}><BrandHeader onBack={back?()=>router.back():undefined} backLabel={m.t('Back','رجوع')}/></View>
          {presentation==='journey'&&<MechanicJourneyHeader title={title} subtitle={subtitle} current={progress} photo={photo} onStep={onStep} stepsDisabled={stepsDisabled} canSelectStep={canSelectStep}/>}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {contentOverlay}
      {footer&&<View pointerEvents="box-none" style={{zIndex:contentOverlay?30:undefined,paddingHorizontal:owner?18:14,paddingTop:5,paddingBottom:Math.max(insets.bottom,owner?18:8),width:'100%',maxWidth:owner?520:680,alignSelf:'center'}}>{footer}</View>}
    </View>
  );
}
export function MechanicCard({ children }: { children: ReactNode }) {
  const m = useMechanicTheme();
  return (
    <View
      style={{
        padding: 18,
        borderRadius: 29,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: m.border,
        backgroundColor: m.surface,
        marginBottom: 15,
        gap: 13,
      }}
    >
      <PanelFill radius={29} /><BrandMonogram size={150} style={{top:-18,right:-45,opacity:.018}}/>
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
          borderColor: focused ? (m.dark ? "#E0B78B" : "#986B40") : m.border,
          boxShadow: focused ? (m.dark ? "0px 0px 0px 3px rgba(224,183,139,0.13)" : "0px 0px 0px 3px rgba(152,107,64,0.10)") : undefined,
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
              fontSize: 14,
              lineHeight: 23,
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
        borderColor: secondary ? m.border : m.primary,
        backgroundColor: secondary ? "transparent" : m.primary,
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
            color: secondary ? m.ink : m.primaryInk,
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

