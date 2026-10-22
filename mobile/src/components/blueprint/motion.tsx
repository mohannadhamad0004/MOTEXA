import { ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, PressableProps, StyleProp, View, ViewStyle } from "react-native";
import { motion } from "../../theme/tokens";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Fade + translateY 8 -> 0 over 600 ms, once per mount. `i` staggers list items by 70 ms. */
export function Rise({ children, i = 0, style }: { children: ReactNode; i?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: motion.rise,
      delay: Math.min(i, 8) * motion.stagger,
      easing: Easing.bezier(0.2, 0.7, 0.3, 1),
      useNativeDriver: true,
      isInteraction: false,
    });
    a.start();
    return () => a.stop();
  }, [v, i, reduced]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that scales to .98 while held. */
export function Press({ style, children, ...p }: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      {...p}
      style={({ pressed }) => [style, pressed && { transform: [{ scale: motion.press }] }]}
    >
      {children}
    </Pressable>
  );
}

/** Expanding ring used behind live dots (the only looping animation in the kit). */
export function PulseRing({ size = 8, color }: { size?: number; color: string }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false })
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {!reduced && (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) }],
          }}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}
