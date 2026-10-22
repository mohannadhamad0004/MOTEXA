import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, DimensionValue, Easing, StyleProp, View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/useTheme";

/** Shimmer placeholder: a soft opacity pulse. Static when the device asks for reduced motion. */
export function Skeleton({
  width = "100%",
  height = 16,
  radius,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, r, motion } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
  }, []);
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: motion.skeleton, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: motion.skeleton, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced, motion.skeleton]);
  return (
    <Animated.View
      accessible={false}
      style={[
        { width, height, borderRadius: radius ?? r.sm, backgroundColor: c.skeleton, opacity: reduced ? 0.8 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
        style,
      ]}
    />
  );
}

/** A card-shaped placeholder: an image tile and three text lines. */
export function SkeletonCard() {
  const { c, r, row } = useTheme();
  return (
    <View style={{ borderRadius: r.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 16, marginBottom: 11 }}>
      <View style={[row, { gap: 14 }]}>
        <Skeleton width={64} height={64} radius={15} />
        <View style={{ flex: 1, gap: 9, justifyContent: "center" }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={11} />
          <Skeleton width="85%" height={11} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
