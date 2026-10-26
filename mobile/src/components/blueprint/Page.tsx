import { Children, ReactNode, useEffect } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ease, M, useReduced } from "../../motion";
import { Rise } from "./motion";
import { useTheme } from "../../theme/useTheme";
import { DRAWINGS, DrawingKind } from "./drawings";
import { PageTitle, Sub } from "./Primitives";
import { Hero, Sheet } from "./Surface";

export type HeroConfig = {
  tl?: ReactNode;
  tr?: ReactNode;
  bl?: ReactNode;
  br?: ReactNode;
  height?: number;
  /** fallback route: shows the round back button over the hero */
  back?: Parameters<typeof Hero>[0]["back"];
  right?: ReactNode;
  /** the drawing (or a map) in the middle of the hero */
  art?: ReactNode;
};

/**
 * The standard Blueprint screen: dark Hero (under the status bar) + Sheet that overlaps it by 32px, in one
 * ScrollView with optional pull-to-refresh. `tabs` reserves room for the floating tab bar, `footer` for a
 * StickyActionBar (pass the bar itself as `footer`; it is pinned to the bottom of the screen).
 */
export function BlueprintPage({
  hero,
  children,
  onRefresh,
  refreshing = false,
  tabs = false,
  footer,
  sheetStyle,
  top,
  ignition = false,
  shift = false,
  lead,
  overlap,
  contentDelay,
}: {
  hero?: HeroConfig;
  /** first entry of a main tab (see useIgnition): grid fades in, sheet springs up, content staggers in */
  ignition?: boolean;
  /** siblings glide to their new place when content above them appears or goes (Home active request) */
  shift?: boolean;
  /** state-driven block above the content that expands in and collapses away (see Expand) */
  lead?: ReactNode;
  /** how far the sheet overlaps the hero (24 for a CompactHero) */
  overlap?: number;
  /** ms before the first sheet child resolves on an ignition entry (default: right after the grid and the sheet lift) */
  contentDelay?: number;
  /** replaces the Hero (a MapFrame) */
  top?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  tabs?: boolean;
  footer?: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { art, ...h } = hero ?? {};
  const bottom = (footer ? 144 : tabs ? 116 : 56) + insets.bottom;
  const reduced = useReduced();
  // Ignition: the sheet springs up 16px after the hero has started tracing
  const lift = useSharedValue(ignition ? 0 : 1);
  useEffect(() => {
    if (!ignition) return;
    lift.value = reduced ? withTiming(1, { duration: M.reduced }) : withDelay(M.grid + 300, withSpring(1, M.spring));
  }, [ignition, reduced, lift]);
  const liftStyle = useAnimatedStyle(() => ({ opacity: lift.value, transform: [{ translateY: reduced ? 0 : (1 - lift.value) * 16 }] }));
  const base = ignition ? (contentDelay ?? M.grid + 450) : 0;
  const kids = Children.toArray(children).map((ch, i) => (
    <Rise key={(ch as { key?: string }).key ?? i} i={i} delay={base} distance={ignition ? M.rise : M.riseDetail} layout={shift ? LinearTransition.duration(M.detail) : undefined}>
      {ch}
    </Rise>
  ));
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      {/* keeps the overscroll area above the hero dark */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 320, backgroundColor: c.blueprint }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.bronzeLight} colors={[c.bronze]} progressViewOffset={insets.top + 8} /> : undefined}
        >
          {top ?? <Hero {...h} ignition={ignition}>{art}</Hero>}
          <Animated.View style={[{ flexGrow: 1 }, ignition ? liftStyle : null]}>
            <Sheet bottom={bottom} style={sheetStyle} overlap={overlap}>
              {lead}
              {kids}
            </Sheet>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {footer}
    </View>
  );
}

/**
 * Compact page for forms, details and the denser provider / admin screens: short hero with one drawing, then the
 * sheet with a title (and subtitle). `dense` = 150px hero and a 26px title for the working screens.
 */
export function SimplePage({
  kind,
  tl,
  tr,
  bl,
  br,
  title,
  sub,
  back,
  right,
  dense = false,
  height,
  children,
  ...rest
}: {
  kind: DrawingKind;
  tl?: ReactNode;
  tr?: ReactNode;
  bl?: ReactNode;
  br?: ReactNode;
  title?: string;
  sub?: string;
  back?: HeroConfig["back"];
  right?: ReactNode;
  dense?: boolean;
  height?: number;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  tabs?: boolean;
  footer?: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
}) {
  const Art = DRAWINGS[kind];
  return (
    <BlueprintPage
      {...rest}
      hero={{
        tl,
        tr,
        bl,
        br,
        back,
        right,
        height: height ?? (dense ? 150 : 180),
        art: (
          <View style={{ height: "100%", aspectRatio: 1.5 }}>
            <Art />
          </View>
        ),
      }}
    >
      {title ? <PageTitle size={dense ? 26 : 30}>{title}</PageTitle> : null}
      {sub ? <Sub>{sub}</Sub> : null}
      {children}
    </BlueprintPage>
  );
}
