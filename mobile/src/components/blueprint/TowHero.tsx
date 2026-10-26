import { ReactNode, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useDelayed } from "../../motion/useDelayed";
import { ease, M, useReduced } from "../../motion";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";
import { Icon, IconName } from "./Icon";
import { Tag } from "./Primitives";
import { InspectionCheck } from "./InspectionCheck";
import { Press } from "./motion";
import { RoadLoader } from "./RoadLoader";
import { BackButton, BlueprintSurface, useHeroStatusBar } from "./Surface";

export const TOW_HERO_HEIGHT = 216;
export const TOW_HERO_OVERLAP = 24;

const AnimPath = Animated.createAnimatedComponent(Path);
const ROAD = "M4 70 C28 64 62 74 116 62";

/**
 * The Tow hero scene (ONE-SHOT, about 800 ms, then still): a short bronze road draws, a simplified flat-bed tow truck
 * settles in from 16 px to its place, and one small availability dot resolves. It never loops and never pretends to
 * drive. `play` false (or reduced motion) shows the final frame.
 */
export function TowScene({ play, available }: { play: boolean; available: boolean }) {
  const { c, isArabic } = useTheme();
  const reduced = useReduced();
  const animate = play && !reduced;
  const road = useSharedValue(animate ? 0 : 1);
  const truck = useSharedValue(animate ? 0 : 1);
  const dot = useSharedValue(animate ? 0 : 1);
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!play) return;
    if (reduced) {
      truck.value = withTiming(1, { duration: M.reduced });
      road.value = 1;
      dot.value = withTiming(1, { duration: M.reduced });
      return;
    }
    road.value = withTiming(1, { duration: 520, easing: ease });
    truck.value = withDelay(200, withTiming(1, { duration: 360, easing: ease }));
    dot.value = withDelay(560, withTiming(1, { duration: 200, easing: ease }));
    ring.value = withDelay(620, withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 500, easing: ease })));
    return () => {
      cancelAnimation(road);
      cancelAnimation(truck);
      cancelAnimation(dot);
      cancelAnimation(ring);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced]);
  const roadProps = useAnimatedProps(() => ({ strokeDashoffset: 140 * (1 - road.value) }));
  const truckStyle = useAnimatedStyle(() => ({ opacity: truck.value, transform: [{ translateX: reduced ? 0 : (1 - truck.value) * -12 }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value, transform: [{ scale: 0.4 + 0.6 * dot.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.value), transform: [{ scale: 1 + 1.6 * ring.value }] }));
  const fill = { position: "absolute" as const, left: 0, top: 0, right: 0, bottom: 0 };
  const dotColor = available ? c.bronzeLight : alpha(c.cream, 0.4);
  return (
    // the scene faces the end side: in Arabic it is mirrored as a whole
    <View style={{ width: "100%", height: "100%", transform: [{ scaleX: isArabic ? -1 : 1 }] }}>
      <Svg style={fill} viewBox="0 0 120 84" fill="none">
        <AnimPath d={ROAD} stroke={c.bronzeLight} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={140} animatedProps={roadProps} />
        <Path d="M10 77 H112" stroke={alpha(c.bronzeLight, 0.25)} strokeWidth={1} strokeDasharray="2 5" />
      </Svg>
      <Animated.View style={[fill, truckStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 120 84" fill="none">
          {/* flat bed */}
          <Path d="M14 46 H60 L66 42 H14 Z" fill={alpha(c.bronzeLight, 0.55)} />
          <Rect x="14" y="46" width="48" height="6" rx="1.5" fill={c.bronzeLight} />
          {/* boom + hook */}
          <Path d="M18 42 L18 26 L40 26" stroke={c.bronzeLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M40 26 V36" stroke={c.bronzeLight} strokeWidth={1.2} strokeLinecap="round" />
          <Path d="M37 36 Q40 41 43 36" stroke={c.bronzeLight} strokeWidth={1.4} strokeLinecap="round" />
          {/* cab */}
          <Path d="M64 52 V34 H76 L84 42 H94 V52 Z" fill={c.bronzeLight} />
          <Path d="M68 38 H75 L80 43 H68 Z" fill={c.blueprint} opacity={0.85} />
          {/* wheels */}
          <Circle cx="26" cy="55" r="7" fill={c.blueprint} stroke={c.bronzeLight} strokeWidth={2} />
          <Circle cx="48" cy="55" r="7" fill={c.blueprint} stroke={c.bronzeLight} strokeWidth={2} />
          <Circle cx="84" cy="55" r="7" fill={c.blueprint} stroke={c.bronzeLight} strokeWidth={2} />
          <Circle cx="26" cy="55" r="2" fill={c.bronzeLight} />
          <Circle cx="48" cy="55" r="2" fill={c.bronzeLight} />
          <Circle cx="84" cy="55" r="2" fill={c.bronzeLight} />
        </Svg>
      </Animated.View>
      {/* availability indicator: bronze when a truck is really free */}
      <View style={{ position: "absolute", left: "74%", top: "12%", width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
        {available ? <Animated.View style={[{ position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: dotColor }, ringStyle]} /> : null}
        <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: dotColor }, dotStyle]} />
      </View>
    </View>
  );
}

type Cta = { label: string; icon?: IconName; onPress: () => void; loading?: boolean; /** selected / on: quiet bronze outline with a check */ active?: boolean };

/**
 * Tow Discovery hero (~216 px): label, title, REAL availability line, the animated scene on the end side, and two
 * rounded-rectangle actions: a filled primary and a quiet, narrower secondary (pills are reserved for filters).
 * Entrance (one-shot, under ~800 ms): text resolves, the road draws and the truck settles, then the actions resolve.
 * Dark in both modes.
 */
export function TowHero({
  tag,
  title,
  line,
  hint,
  primary,
  secondary,
  play,
  available,
  back,
  scene,
}: {
  tag: string;
  title: string;
  line: ReactNode;
  hint?: string;
  primary: Cta;
  secondary?: Cta;
  play: boolean;
  available?: boolean;
  back?: Parameters<typeof BackButton>[0]["fallback"];
  /** a different end-side scene (Parts); default is the tow scene. Receives the replay key and whether to play. */
  scene?: (key: number, play: boolean) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c, row, isArabic, align } = useTheme();
  useHeroStatusBar();
  const [replay, setReplay] = useState(0);
  const reduced = useReduced();
  const seq = play && !reduced;
  const textP = useSharedValue(seq ? 0 : 1);
  const ctaP = useSharedValue(seq ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    textP.value = withTiming(1, { duration: reduced ? M.reduced : 260, easing: ease });
    ctaP.value = withDelay(reduced ? 0 : 420, withTiming(1, { duration: reduced ? M.reduced : 260, easing: ease }));
    return () => {
      cancelAnimation(textP);
      cancelAnimation(ctaP);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced]);
  const textStyle = useAnimatedStyle(() => ({ opacity: textP.value, transform: [{ translateY: seq ? (1 - textP.value) * 8 : 0 }] }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaP.value, transform: [{ translateY: seq ? (1 - ctaP.value) * 8 : 0 }] }));
  // the road loader shows only when the work really takes more than ~300 ms
  const busy = useDelayed(!!primary.loading, 300);
  const button = (cta: Cta, kind: "primary" | "secondary") => {
    const main = kind === "primary";
    return (
      <Press
        accessibilityLabel={cta.label}
        onPress={cta.loading ? undefined : cta.onPress}
        style={[
          row,
          {
            flex: main ? 1 : undefined,
            minWidth: main ? 0 : 96,
            minHeight: 48,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingHorizontal: main ? 14 : 12,
            paddingVertical: 6,
            backgroundColor: main ? (cta.active ? alpha(c.bronzeLight, 0.16) : c.bronzeLight) : alpha(c.cream, 0.06),
            borderWidth: main && !cta.active ? 0 : 1,
            borderColor: cta.active ? c.bronzeLight : alpha(c.cream, 0.22),
            opacity: cta.loading && !busy ? 0.85 : 1,
          },
        ]}
      >
        {main && busy ? <RoadLoader compact color={c.blueprint} /> : cta.active ? <InspectionCheck size={18} color={c.bronzeLight} animate={false} /> : cta.icon ? <Icon name={cta.icon} size={18} color={main ? c.blueprint : alpha(c.cream, 0.85)} /> : null}
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={{ flexShrink: 1, textAlign: "center", color: main ? (cta.active ? c.bronzeLight : c.blueprint) : alpha(c.cream, 0.88), fontSize: main ? 14 : 13, fontWeight: main ? "700" : "600", lineHeight: isArabic ? 20 : 17 }}
        >
          {cta.label}
        </Text>
      </Press>
    );
  };
  return (
    <BlueprintSurface gridFade={play} style={{ height: insets.top + TOW_HERO_HEIGHT }}>
      <View style={{ position: "absolute", left: 20, right: 20, top: insets.top + 10, bottom: TOW_HERO_OVERLAP + 8 }}>
        <View style={[row, { flex: 1, gap: 6 }]}>
          <Animated.View style={[{ flex: 1, minWidth: 0 }, textStyle]}>
            <Tag color={alpha(c.cream, 0.6)} align={isArabic ? "right" : "left"}>{tag}</Tag>
            <Text numberOfLines={1} style={[{ color: c.cream, fontSize: 28, fontWeight: "700", lineHeight: isArabic ? 38 : 33, marginTop: 4 }, align]}>
              {title}
            </Text>
            <View style={{ marginTop: 4 }}>{line}</View>
            {hint ? (
              <Text numberOfLines={2} style={[{ color: alpha(c.cream, 0.6), fontSize: 12, marginTop: 4, lineHeight: isArabic ? 18 : 16 }, align]}>
                {hint}
              </Text>
            ) : null}
          </Animated.View>
          <Pressable accessibilityLabel={title} onPress={() => setReplay((n) => n + 1)} style={{ width: 134, height: 96, alignSelf: "flex-end", marginBottom: 6 }}>
            {scene ? scene(replay, play || replay > 0) : <TowScene key={replay} play={play || replay > 0} available={!!available} />}
          </Pressable>
        </View>
        <Animated.View style={[row, { gap: 10 }, ctaStyle]}>
          {button(primary, "primary")}
          {secondary ? button(secondary, "secondary") : null}
        </Animated.View>
      </View>
      {back ? <BackButton fallback={back} /> : null}
    </BlueprintSurface>
  );
}
