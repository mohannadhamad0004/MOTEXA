import { useEffect } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useReduced } from "../../motion";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";

const PERIOD = 22; // 12 dash + 10 gap
const DASHES = 24;

/**
 * Thin bronze road centre-line, dashes sliding sideways (about 1.2 s per cycle). Only for location lookup, route
 * calculation, sending a tow / mechanic request and a provider accept in progress. Mirrors in Arabic. Reduced
 * motion: static dashes. `compact` = 36px mark without label (inside buttons).
 */
export function RoadLoader({ label, compact = false, color }: { label?: string; compact?: boolean; color?: string }) {
  const { c, isArabic } = useTheme();
  const reduced = useReduced();
  const x = useSharedValue(0);
  const from = isArabic ? 0 : PERIOD;
  const to = isArabic ? PERIOD : 0;
  useEffect(() => {
    if (reduced) return;
    x.value = from;
    x.value = withRepeat(withTiming(to, { duration: 1200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [x, reduced, from, to]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: reduced ? PERIOD / 2 : x.value }] }));
  const col = color ?? c.bronze;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ alignItems: "center", gap: 8, width: compact ? 36 : "100%", maxWidth: compact ? 36 : 180, alignSelf: "center" }}>
      <View style={{ width: "100%", height: 3, overflow: "hidden" }}>
        <Animated.View style={[{ position: "absolute", left: -PERIOD, top: 0, flexDirection: "row", direction: "ltr" }, st]}>
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={{ width: 12, height: 3, borderRadius: 1.5, marginRight: 10, backgroundColor: col }} />
          ))}
        </Animated.View>
      </View>
      {label && !compact ? <Text style={{ color: c.soft, fontSize: 12 }}>{label}</Text> : null}
    </View>
  );
}
