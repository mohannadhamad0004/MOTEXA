import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode, useCallback } from "react";
import { Pressable, StatusBar, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { goBack } from "../../core/hooks/nav";
import { useL } from "../../core/hooks/useL";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Construction } from "./drawings";
import { Icon } from "./Icon";
import { Tag } from "./Primitives";

/** Dark panel (in both modes): blueprint -> blueprint2 gradient at ~160deg + a 24px grid at 7% bronzeLight. */
export function BlueprintSurface({ children, style, construction = false }: { children?: ReactNode; style?: StyleProp<ViewStyle>; construction?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[{ overflow: "hidden", backgroundColor: c.blueprint }, style]}>
      <LinearGradient colors={[c.blueprint, c.blueprint2]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id="bpgrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <Path d="M24 0 H0 V24" stroke={alpha(c.bronzeLight, 0.07)} strokeWidth={1} fill="none" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bpgrid)" />
      </Svg>
      {construction && <Construction />}
      {children}
    </View>
  );
}

// Light-content status bar while a hero is on screen (the hero is dark in both modes). A counter keeps it right
// when one hero screen replaces another (cleanup and focus can run in either order).
let heroScreens = 0;
export function useHeroStatusBar() {
  const { dark } = useTheme();
  useFocusEffect(
    useCallback(() => {
      heroScreens++;
      StatusBar.setBarStyle("light-content");
      return () => {
        heroScreens--;
        if (heroScreens <= 0) StatusBar.setBarStyle(dark ? "light-content" : "dark-content");
      };
    }, [dark])
  );
}

/**
 * Dark hero: corner tags (tl cream 70%, tr bronzeLight, bl cream 70%, br cream 50%) around a centred drawing.
 * `height` is the visible height below the status bar. Each corner label is one line, max 45% wide, so two long
 * labels can never overlap. Corners mirror in Arabic.
 */
export function Hero({
  tl,
  tr,
  bl,
  br,
  height = 240,
  children,
  back,
  right,
}: {
  tl?: ReactNode;
  tr?: ReactNode;
  bl?: ReactNode;
  br?: ReactNode;
  height?: number;
  children?: ReactNode;
  /** fallback route for the back button; omit for no back button */
  back?: Parameters<typeof goBack>[0];
  /** node pinned to the top end (settings icon on provider screens) */
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c, isArabic } = useTheme();
  useHeroStatusBar();
  const top = insets.top;
  const side = (which: "start" | "end") => ((which === "start") !== isArabic ? { left: 20 } : { right: 20 });
  const tagTop = top + 18;
  const tagBox = (which: "start" | "end", extra: ViewStyle): ViewStyle => ({
    position: "absolute",
    maxWidth: which === "start" ? "54%" : "38%",
    ...side(which),
    ...extra,
  });
  const align = (which: "start" | "end") => ((which === "start") !== isArabic ? "left" : "right") as "left" | "right";
  const hasBottom = !!(bl || br);
  // a string becomes a Tag in the given colour; any other node (a plate chip) is shown as is
  const tag = (x: ReactNode, color: string, which: "start" | "end") =>
    typeof x === "string" ? <Tag color={color} align={align(which)}>{x}</Tag> : x;
  // the sheet overlaps the bottom 32px, so bottom labels sit above that
  return (
    <BlueprintSurface construction style={{ height: top + height }}>
      {tl ? (
        <View style={tagBox("start", { top: tagTop })}>
          {tag(tl, alpha(c.cream, 0.7), "start")}
        </View>
      ) : null}
      {tr ? (
        <View style={tagBox("end", { top: tagTop })}>
          {tag(tr, c.bronzeLight, "end")}
        </View>
      ) : null}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 24, right: 24, top: top + 46, bottom: hasBottom ? 76 : 52, alignItems: "center", justifyContent: "center" }}
      >
        {children}
      </View>
      {bl ? (
        <View style={tagBox("start", { bottom: 44 })}>
          {tag(bl, alpha(c.cream, 0.7), "start")}
        </View>
      ) : null}
      {br ? (
        <View style={tagBox("end", { bottom: 44 })}>
          {tag(br, alpha(c.cream, 0.5), "end")}
        </View>
      ) : null}
      {back ? <BackButton fallback={back} below /> : null}
      {right ? <View style={{ position: "absolute", top: top + 8, ...(isArabic ? { left: 16 } : { right: 16 }) }}>{right}</View> : null}
    </BlueprintSurface>
  );
}

/** Round 44px translucent button over a hero, top-start. */
export function BackButton({ fallback, below = false }: { fallback: Parameters<typeof goBack>[0]; below?: boolean }) {
  const insets = useSafeAreaInsets();
  const { c, isArabic } = useTheme();
  const { t } = useL();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Back", "رجوع")}
      onPress={() => goBack(fallback)}
      style={({ pressed }) => ({
        position: "absolute",
        top: insets.top + (below ? 44 : 8),
        ...(isArabic ? { right: 16 } : { left: 16 }),
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: alpha(c.cream, 0.2),
        backgroundColor: alpha(c.blueprint, 0.6),
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Icon name="back" size={20} color={c.cream} />
    </Pressable>
  );
}

/** Cream/sheet panel that overlaps the hero by 32px. */
export function Sheet({ children, style, bottom = 112 }: { children: ReactNode; style?: StyleProp<ViewStyle>; bottom?: number }) {
  const { c, r } = useTheme();
  return (
    <View
      style={[
        {
          flexGrow: 1,
          marginTop: -32,
          borderTopLeftRadius: r.sheet,
          borderTopRightRadius: r.sheet,
          backgroundColor: c.sheet,
          paddingHorizontal: 20,
          paddingTop: 28,
          paddingBottom: bottom,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Dark frame around a real map (Tow, request status): status-bar band on top, the map below, corner tags in small
 * dark chips so they stay readable over bright map tiles, optional back button. The Sheet overlaps the bottom 32px.
 */
export function MapFrame({
  height,
  tl,
  tr,
  back,
  children,
}: {
  height: number;
  tl?: string;
  tr?: string;
  back?: Parameters<typeof goBack>[0];
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c, isArabic } = useTheme();
  useHeroStatusBar();
  const chip = (text: string, color: string, atStart: boolean) => (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 14,
        maxWidth: "45%",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: alpha(c.blueprint, 0.78),
        ...(atStart !== isArabic ? { left: 16 } : { right: 16 }),
        // the back button sits top-start, so the start tag moves clear of it
        ...(atStart && back ? (isArabic ? { right: 68 } : { left: 68 }) : null),
      }}
    >
      <Tag color={color} align={atStart !== isArabic ? "left" : "right"}>{text}</Tag>
    </View>
  );
  return (
    <View style={{ backgroundColor: c.blueprint }}>
      <View style={{ height: insets.top }} />
      <View style={{ height }}>
        {children}
        {tl ? chip(tl, alpha(c.cream, 0.85), true) : null}
        {tr ? chip(tr, c.bronzeLight, false) : null}
      </View>
      {back ? <BackButton fallback={back} /> : null}
    </View>
  );
}
