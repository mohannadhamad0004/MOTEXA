import { useEffect } from "react";
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ease, M, useReduced } from "../../motion";
import { useTheme } from "../../theme/useTheme";

const AnimPath = Animated.createAnimatedComponent(Path);

const GLYPH = {
  check: "M5 12.5 L10 17.5 L19 7",
  x: "M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5",
  warn: "M12 6 L12 13.5 M12 17.6 L12 17.7",
} as const;

/**
 * A precise check that sweeps in: the stroke draws over 190 ms with a tiny 0.9 -> 1 scale. It resolves ("fits",
 * "verified", an admin decision) instead of stamping down. Reduced motion: a 150 ms fade. `animate={false}`
 * renders it already resolved.
 */
export function InspectionCheck({
  kind = "check",
  size = 18,
  color,
  delay = 0,
  animate = true,
}: {
  kind?: keyof typeof GLYPH;
  size?: number;
  color?: string;
  delay?: number;
  animate?: boolean;
}) {
  const { c } = useTheme();
  const reduced = useReduced();
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    p.value = withDelay(delay, withTiming(1, { duration: reduced ? M.reduced : M.chip, easing: ease }));
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ap = useAnimatedProps(() => ({ strokeDashoffset: reduced ? 0 : 40 * (1 - p.value) }));
  const st = useAnimatedStyle(() => ({ opacity: reduced ? p.value : Math.min(1, p.value * 4), transform: [{ scale: reduced ? 1 : 0.9 + 0.1 * p.value }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, st]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <AnimPath d={GLYPH[kind]} stroke={color ?? c.bronze} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={40} animatedProps={ap} />
      </Svg>
    </Animated.View>
  );
}
