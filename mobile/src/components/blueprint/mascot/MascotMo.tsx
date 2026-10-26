import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ease, M, useReduced } from "../../../motion";
import { useTheme } from "../../../theme/useTheme";
import { InspectionCheck } from "../InspectionCheck";
import { MO } from "./moConfig";

const BODY = require("../../../../assets/mascot/mo-body.png");
const ARM = require("../../../../assets/mascot/mo-arm-wrench.png");
const AnimPath = Animated.createAnimatedComponent(Path);

const DASHES = 8;
const START = 200; // degrees, clockwise from 3 o'clock
const STEP = 34;
const SPAN = 24;
const rad = (d: number) => (d * Math.PI) / 180;

/** One dash of the torque arc: appears when the draw progress passes its slot. */
function ArcDash({ i, d, progress, color }: { i: number; d: string; progress: SharedValue<number>; color: string }) {
  const ap = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, progress.value * (DASHES + 1) - i)) }));
  return <AnimPath d={d} stroke={color} strokeWidth={11} strokeLinecap="round" fill="none" animatedProps={ap} />;
}

/**
 * Mo, the mechanic mascot: a body image plus a separate arm image attached at the right shoulder. The arm layer sits ABOVE
 * the body so its dark cuff hides the seam, and it rotates around the shoulder pivot (translate - rotate - translate).
 *
 * Sequence (one-shot, then still): 0 ms fade in + rise 12 px (270 ms) / 300 ms arm turns restAngle -> peakAngle (380 ms) /
 * 520 ms a dashed bronze torque arc draws around the wrench head (300 ms) / 820 ms the arm settles to endAngle (spring, no
 * bounce) / 900 ms a bronze check resolves. `playKey` changing replays it; `play` false or reduced motion = final frame.
 * `mirrored` flips the whole mascot (used in Arabic, where Mo stands on the left): the check is never mirrored.
 */
export function MascotMo({
  size = MO.size,
  pivot = MO.pivot,
  armOffset = MO.armOffset,
  armScale = MO.armScale,
  restAngle = MO.restAngle,
  peakAngle = MO.peakAngle,
  endAngle = MO.endAngle,
  check = MO.check,
  head = MO.head,
  play = true,
  playKey = 0,
  mirrored = false,
  showCheck = true,
  onPress,
}: {
  size?: number;
  pivot?: { x: number; y: number };
  armOffset?: { x: number; y: number };
  armScale?: number;
  restAngle?: number;
  peakAngle?: number;
  endAngle?: number;
  check?: { x: number; y: number };
  head?: { x: number; y: number; r: number };
  play?: boolean;
  playKey?: number;
  mirrored?: boolean;
  /** only when there is something genuinely verified to confirm */
  showCheck?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const reduced = useReduced();
  const W = size * MO.ratio;
  const Aw = W * armScale;
  const Ah = size * armScale;
  const left = armOffset.x * W - pivot.x * Aw;
  const top = armOffset.y * size - pivot.y * Ah;
  // RN rotates around the centre of the view, so the pivot is expressed as an offset from that centre
  const px = (pivot.x - 0.5) * Aw;
  const py = (pivot.y - 0.5) * Ah;

  const enter = useSharedValue(1);
  const angle = useSharedValue(endAngle);
  const arc = useSharedValue(1);

  useEffect(() => {
    if (!play) {
      enter.value = 1;
      angle.value = endAngle;
      arc.value = 1;
      return;
    }
    if (reduced) {
      enter.value = 0;
      angle.value = endAngle;
      arc.value = 1;
      enter.value = withTiming(1, { duration: M.reduced });
      return;
    }
    enter.value = 0;
    angle.value = restAngle;
    arc.value = 0;
    enter.value = withTiming(1, { duration: 270, easing: ease });
    angle.value = withDelay(
      300,
      withSequence(
        withTiming(peakAngle, { duration: 380, easing: Easing.inOut(Easing.ease) }),
        // hold the top of the turn until 820 ms, then settle without bounce
        withDelay(140, withSpring(endAngle, { damping: 20, stiffness: 180, mass: 1, overshootClamping: true }))
      )
    );
    arc.value = withDelay(520, withTiming(1, { duration: 300, easing: ease }));
    return () => {
      cancelAnimation(enter);
      cancelAnimation(angle);
      cancelAnimation(arc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, playKey, reduced, restAngle, peakAngle, endAngle]);

  const whole = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: reduced ? 0 : (1 - enter.value) * 12 }] }));
  const armStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: px }, { translateY: py }, { rotate: `${angle.value}deg` }, { translateX: -px }, { translateY: -py }],
  }));
  const arrow = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, arc.value * (DASHES + 1) - DASHES)) }));

  const pt = (a: number) => ({ x: head.x + head.r * Math.cos(rad(a)), y: head.y + head.r * Math.sin(rad(a)) });
  const dashes = Array.from({ length: DASHES }, (_, i) => {
    const a0 = START + i * STEP;
    const p0 = pt(a0);
    const p1 = pt(a0 + SPAN);
    return `M${p0.x} ${p0.y} A${head.r} ${head.r} 0 0 1 ${p1.x} ${p1.y}`;
  });
  // arrowhead at the end of the last dash, pointing along the clockwise tangent
  const aEnd = START + (DASHES - 1) * STEP + SPAN;
  const tip0 = pt(aEnd);
  const tx = -Math.sin(rad(aEnd));
  const ty = Math.cos(rad(aEnd));
  const nx = Math.cos(rad(aEnd));
  const ny = Math.sin(rad(aEnd));
  const arrowPath = `M${tip0.x + tx * 22} ${tip0.y + ty * 22} L${tip0.x + nx * 14} ${tip0.y + ny * 14} L${tip0.x - nx * 14} ${tip0.y - ny * 14} Z`;

  return (
    <Pressable accessibilityLabel="Mo" onPress={onPress} disabled={!onPress} style={{ width: W, height: size }}>
      <Animated.View style={[{ width: W, height: size, transform: [{ scaleX: mirrored ? -1 : 1 }] }, whole]}>
        {/* soft shadow under the feet */}
        <View style={{ position: "absolute", left: W * 0.08, right: W * 0.08, bottom: -5, height: 10, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.38)" }} />
        <Image source={BODY} style={{ position: "absolute", left: 0, top: 0, width: W, height: size }} contentFit="contain" />
        <Animated.View style={[{ position: "absolute", left, top, width: Aw, height: Ah }, armStyle]}>
          <Image source={ARM} style={{ width: Aw, height: Ah }} contentFit="contain" />
          <Svg style={{ position: "absolute", left: 0, top: 0 }} width={Aw} height={Ah} viewBox="0 0 252 473" fill="none">
            {dashes.map((d, i) => (
              <ArcDash key={i} i={i} d={d} progress={arc} color={c.bronzeLight} />
            ))}
            <AnimPath d={arrowPath} fill={c.bronzeLight} animatedProps={arrow} />
          </Svg>
        </Animated.View>
      </Animated.View>
      {showCheck ? (
        <View style={{ position: "absolute", left: mirrored ? W - check.x * W - 18 : check.x * W, top: check.y * size }}>
          <InspectionCheck key={playKey} size={18} color={c.bronzeLight} animate={play && !reduced} delay={900} />
        </View>
      ) : null}
    </Pressable>
  );
}
