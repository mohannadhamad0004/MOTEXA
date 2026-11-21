import { useEffect } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { ease, M, useReduced } from "../../motion";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { InspectionCheck } from "./InspectionCheck";

const fill = { position: "absolute" as const, left: 0, top: 0, right: 0, bottom: 0 };

/**
 * The Mechanics hero scene, PERSON -> SKILLS -> TRUST, one-shot (about 800 ms): a mechanic's bust resolves, three
 * approved-skill markers appear one after another, and the MOTEXA verification check resolves LAST. The check only plays
 * when `verified` is true (there is at least one real, approved mechanic); otherwise the scene stops after the skills.
 * Reduced motion / `play` false = final frame. Mirrored in Arabic except the check.
 */
export function MechanicScene({ play, verified }: { play: boolean; verified: boolean }) {
  const { c, isArabic } = useTheme();
  const reduced = useReduced();
  const animate = play && !reduced;
  const person = useSharedValue(animate ? 0 : 1);
  const s0 = useSharedValue(animate ? 0 : 1);
  const s1 = useSharedValue(animate ? 0 : 1);
  const s2 = useSharedValue(animate ? 0 : 1);
  const trust = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    if (reduced) {
      [person, s0, s1, s2, trust].forEach((v) => (v.value = withTiming(1, { duration: M.reduced })));
      return;
    }
    person.value = withTiming(1, { duration: 300, easing: ease });
    s0.value = withDelay(260, withTiming(1, { duration: 200, easing: ease }));
    s1.value = withDelay(305, withTiming(1, { duration: 200, easing: ease }));
    s2.value = withDelay(350, withTiming(1, { duration: 200, easing: ease }));
    trust.value = withDelay(620, withTiming(1, { duration: M.chip, easing: ease }));
    return () => [person, s0, s1, s2, trust].forEach((v) => cancelAnimation(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced]);
  const personStyle = useAnimatedStyle(() => ({ opacity: person.value, transform: [{ translateY: animate ? (1 - person.value) * 8 : 0 }] }));
  const skill = (v: typeof s0) => useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateX: animate ? (1 - v.value) * 8 : 0 }] }));
  const k0 = skill(s0);
  const k1 = skill(s1);
  const k2 = skill(s2);
  const mark = useAnimatedStyle(() => ({ opacity: trust.value, transform: [{ scale: 0.8 + 0.2 * trust.value }] }));
  const line = c.bronzeLight;
  const bar = (top: string, style: object) => (
    <Animated.View style={[{ position: "absolute", right: "6%", top: top as `${number}%`, width: "36%", height: 14, borderRadius: 7, borderWidth: 1, borderColor: alpha(line, 0.55), backgroundColor: alpha(line, 0.08), flexDirection: "row", alignItems: "center", paddingHorizontal: 5, gap: 4 }, style]}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: line }} />
      <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: alpha(line, 0.5) }} />
    </Animated.View>
  );
  return (
    <View style={{ width: "100%", height: "100%" }}>
      <View style={{ ...fill, transform: [{ scaleX: isArabic ? -1 : 1 }] }}>
        <View style={{ position: "absolute", left: "2%", top: "10%", width: "52%", bottom: "6%", borderRadius: 18, backgroundColor: alpha(line, 0.09), borderWidth: 1, borderColor: alpha(line, 0.22) }} />
        <Animated.View style={[fill, personStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 120 84" fill="none">
            {/* head, hard-cap line, shoulders: a calm, professional bust */}
            <Circle cx="34" cy="34" r="11" stroke={line} strokeWidth={1.5} />
            <Path d="M22 31 C23 20 45 20 46 31" stroke={line} strokeWidth={1.5} strokeLinecap="round" />
            <Path d="M19 71 C19 54 49 54 49 71" stroke={line} strokeWidth={1.5} strokeLinecap="round" />
            <Path d="M28 59 L34 66 L40 59" stroke={alpha(line, 0.6)} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        {bar("28%", k0)}
        {bar("46%", k1)}
        {bar("64%", k2)}
      </View>
      {verified ? (
        <Animated.View
          style={[
            { position: "absolute", top: 0, ...(isArabic ? { left: 2 } : { right: 2 }), width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: line, backgroundColor: c.blueprint, alignItems: "center", justifyContent: "center" },
            mark,
          ]}
        >
          <InspectionCheck size={16} color={line} animate={false} />
        </Animated.View>
      ) : null}
    </View>
  );
}
