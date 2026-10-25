import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ease, M, useReduced } from "../../motion";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";

function Digit({ d, size, lh, color }: { d: number; size: number; lh: number; color: string }) {
  const reduced = useReduced();
  const y = useSharedValue(-d * lh);
  useEffect(() => {
    // the first run sets the value it already has, so nothing moves on first render
    y.value = reduced ? -d * lh : withTiming(-d * lh, { duration: M.detail, easing: ease });
  }, [d, lh, reduced, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: lh, width: Math.round(size * 0.62), overflow: "hidden" }}>
      <Animated.View style={st}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <Text key={n} style={{ height: lh, lineHeight: lh, fontSize: size, fontWeight: "700", color, textAlign: "center", fontVariant: ["tabular-nums"] }}>
            {n}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Number whose digits roll ONLY when the value changes after the first render (counts, free trucks, distances).
 * First render is static. Always left-to-right, also inside Arabic. Never use it for static prices.
 */
export function Odometer({ value, format, size = 20, color }: { value: number; format?: (n: number) => string; size?: number; color?: string }) {
  const { c } = useTheme();
  const text = format ? format(value) : String(value);
  const lh = Math.round(size * 1.3);
  const chars = text.split("");
  return (
    <View accessible accessibilityLabel={text} style={{ flexDirection: "row", direction: "ltr", height: lh, alignItems: "center" }}>
      {chars.map((ch, i) => {
        const key = chars.length - i; // keyed from the right, so 9 -> 10 keeps the units column
        return /\d/.test(ch) ? (
          <Digit key={key} d={Number(ch)} size={size} lh={lh} color={color ?? c.ink} />
        ) : (
          <Text key={"s" + key} style={{ fontSize: size, lineHeight: lh, fontWeight: "700", color: color ?? c.ink }}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
}
