import { useEffect } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ease, M, useReduced } from "../../motion";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { CategoryAssembly } from "./assemblies";
import { InspectionCheck } from "./InspectionCheck";

/**
 * The Parts hero object: a brake assembly (disc, caliper, pad, bleeder) on a soft bronze glow with a thin precision
 * ring. ONE-SHOT assembly (about 800 ms): the groups start 8-14 px apart and settle, then one small inspection check
 * resolves. It is a designed illustration, never a shop photo. `play` false (or reduced motion) = final frame.
 */
export function PartsScene({ play }: { play: boolean }) {
  const { c, isArabic } = useTheme();
  const reduced = useReduced();
  const pop = useSharedValue(play && !reduced ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    pop.value = withDelay(reduced ? 0 : 640, withTiming(1, { duration: reduced ? M.reduced : M.chip, easing: ease }));
    return () => cancelAnimation(pop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced]);
  const mark = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.8 + 0.2 * pop.value }] }));
  return (
    <View style={{ width: "100%", height: "100%" }}>
      {/* the object is mirrored in Arabic so it keeps facing the page; the check is not (a mirrored check is wrong) */}
      <View style={{ width: "100%", height: "100%", transform: [{ scaleX: isArabic ? -1 : 1 }] }}>
        <View style={{ position: "absolute", left: "8%", top: "6%", right: "2%", bottom: "6%", borderRadius: 999, backgroundColor: alpha(c.bronzeLight, 0.1), borderWidth: 1, borderColor: alpha(c.bronzeLight, 0.22) }} />
        <CategoryAssembly kind="brakes" assemble={play} />
      </View>
      <Animated.View
        style={[
          { position: "absolute", top: 0, ...(isArabic ? { left: 2 } : { right: 2 }), width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: c.bronzeLight, backgroundColor: c.blueprint, alignItems: "center", justifyContent: "center" },
          mark,
        ]}
      >
        <InspectionCheck size={16} color={c.bronzeLight} animate={false} />
      </Animated.View>
    </View>
  );
}
