import { ReactNode, useEffect, useMemo, useRef } from "react";
import { PanResponder, ScrollView, View, useWindowDimensions } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { ease, M, useReduced } from "../../motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";

export const WIDE_MIN_WIDTH = 700;
export const SIDE_PANEL_WIDTH = 380;
export type Snap = "collapsed" | "expanded";

/**
 * The panel of the map pages. On phones (width < 700) a bottom sheet (rounded top 32, handle) with two snap points,
 * dragged by its handle / header only, so it never fights the map. On wide screens a full-height side panel,
 * 380px, on the START side (left in English, right in Arabic).
 */
export function MapPanel({
  visible,
  snap,
  onSnap,
  onInset,
  header,
  children,
  footer,
}: {
  visible: boolean;
  snap: Snap;
  onSnap: (s: Snap) => void;
  /** px of the screen the panel covers at the bottom (0 on wide screens), so the map can keep its content clear of it */
  onInset: (px: number) => void;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { c, r, isArabic } = useTheme();
  const wide = width >= WIDE_MIN_WIDTH;
  const collapsedH = Math.min(360, Math.round(height * 0.46));
  const expandedH = Math.round(height * 0.88);
  const target = !visible ? 0 : snap === "expanded" ? expandedH : collapsedH;

  const reduced = useReduced();
  // the sheet springs to its height (no bounce); reduced motion: a 150 ms fade of the height change
  const h = useSharedValue(target);
  const sheetStyle = useAnimatedStyle(() => ({ height: h.value }));
  const settle = (to: number) => {
    h.value = reduced ? withTiming(to, { duration: M.reduced, easing: ease }) : withSpring(to, M.spring);
  };
  const latest = useRef({ collapsedH, expandedH, snap, onSnap, target, reduced });
  latest.current = { collapsedH, expandedH, snap, onSnap, target, reduced };
  useEffect(() => {
    if (wide) return;
    settle(target);
    onInset(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, wide]);
  useEffect(() => {
    if (wide) onInset(0);
  }, [wide, onInset]);

  const start = useRef(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          cancelAnimation(h);
          start.current = h.value;
        },
        onPanResponderMove: (_, g) => {
          const { collapsedH: lo, expandedH: hi } = latest.current;
          h.value = Math.max(lo * 0.7, Math.min(hi, start.current - g.dy));
        },
        onPanResponderRelease: (_, g) => {
          const { collapsedH: lo, expandedH: hi, snap: cur, onSnap: set } = latest.current;
          const tapped = Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6;
          const next: Snap = tapped ? (cur === "expanded" ? "collapsed" : "expanded") : g.vy < -0.4 ? "expanded" : g.vy > 0.4 ? "collapsed" : start.current - g.dy > (lo + hi) / 2 ? "expanded" : "collapsed";
          h.value = latest.current.reduced ? withTiming(next === "expanded" ? hi : lo, { duration: M.reduced }) : withSpring(next === "expanded" ? hi : lo, M.spring);
          set(next);
        },
      }),
    [h]
  );

  if (wide) {
    if (!visible) return null;
    return (
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          ...(isArabic ? { right: 0, borderLeftWidth: 1 } : { left: 0, borderRightWidth: 1 }),
          width: SIDE_PANEL_WIDTH,
          backgroundColor: c.sheet,
          borderColor: c.line,
          paddingTop: insets.top,
          zIndex: 30,
        }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>{header}</View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: c.line }}>{footer}</View> : null}
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        backgroundColor: c.sheet,
        borderTopLeftRadius: r.sheet,
        borderTopRightRadius: r.sheet,
        borderTopWidth: 1,
        borderColor: c.line,
        zIndex: 30,
        },
        sheetStyle,
      ]}
    >
      <View {...pan.panHandlers} style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
        <View accessibilityLabel="Resize" style={{ alignSelf: "center", width: 56, height: 22, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 48, height: 6, borderRadius: 3, backgroundColor: c.line }} />
        </View>
        {header}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.sheet }}>{footer}</View> : null}
    </Animated.View>
  );
}
