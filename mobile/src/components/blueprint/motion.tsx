import { ComponentProps, createContext, ReactNode, useEffect } from "react";
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { ease, M, useReduced } from "../../motion";

export { useReduced as useReducedMotion };

/** Inside a page-level reveal: Sections do not animate again on their own. */
export const InReveal = createContext(false);

/**
 * PrecisionReveal: fade + rise over 270 ms, once per mount. `i` staggers siblings by 45 ms (only the first batch of
 * 8 animates; later items just appear). Reduced motion: 150 ms fade, no movement.
 */
export function Rise({
  children,
  i = 0,
  style,
  distance = M.riseDetail,
  delay = 0,
  layout,
}: {
  children: ReactNode;
  i?: number;
  style?: StyleProp<ViewStyle>;
  distance?: number;
  delay?: number;
  layout?: ComponentProps<typeof Animated.View>["layout"];
}) {
  const reduced = useReduced();
  const batch = i < 8;
  const p = useSharedValue(batch ? 0 : 1);
  useEffect(() => {
    if (!batch) return;
    p.value = withDelay(reduced ? 0 : delay + i * M.stagger, withTiming(1, { duration: reduced ? M.reduced : M.entrance, easing: ease }));
    return () => cancelAnimation(p);
  }, [p, batch, reduced, i, delay]);
  const s = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: reduced ? 0 : (1 - p.value) * distance }] }));
  return (
    <InReveal.Provider value>
      <Animated.View layout={layout} style={[style, s]}>{children}</Animated.View>
    </InReveal.Provider>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that scales to .98 while held (120 ms). */
export function Press({ style, children, onPressIn, onPressOut, ...p }: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  const reduced = useReduced();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...p}
      onPressIn={(e) => {
        if (!reduced) s.value = withTiming(M.press, { duration: M.feedback, easing: ease });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, { duration: M.feedback, easing: ease });
        onPressOut?.(e);
      }}
      style={[style, a]}
    >
      {children as ReactNode}
    </AnimatedPressable>
  );
}

/** Expanding ring behind live dots: the only infinite loop in the kit (the location pulse). */
export function PulseRing({ size = 8, color }: { size?: number; color: string }) {
  const reduced = useReduced();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    v.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(v);
  }, [v, reduced]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - v.value), transform: [{ scale: 0.6 + 1.8 * v.value }] }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {!reduced && <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color }, ring]} />}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}
