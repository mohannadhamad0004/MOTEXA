import { Image } from "expo-image";
import { useCallback, useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ease, M, useReduced } from "../../../motion";
import { HOME_MO } from "./moConfig";

const BODY = require("../../../../assets/mascot/home-mo-body.png");
const ARM_REST = require("../../../../assets/mascot/home-mo-arm-rest.png");
const ARM_DRINK = require("../../../../assets/mascot/home-mo-arm-drink.png");

const SIP_LIFT = 360; // the arm turns and swaps in this time (one way)
const SWAP = 0.11; // half of the swap window as a fraction of SIP_LIFT: 2 x 0.11 x 360 = about 80 ms of overlap
const SIP_HOLD = 900;
const STEAM_MS = 1700;

/** One wisp of steam over the mug: rises about 9% of the height, fading in then out; hidden while the mug is lifted. */
function Wisp({ k, steam, sip, size, x, y, color }: { k: number; steam: SharedValue<number>; sip: SharedValue<number>; size: number; x: number; y: number; color: string }) {
  const w = size * 0.07;
  const st = useAnimatedStyle(() => {
    const t = (steam.value + k * 0.34) % 1;
    return { opacity: Math.sin(Math.PI * t) * 0.6 * (1 - sip.value), transform: [{ translateY: -t * size * 0.09 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x - w / 2 + (k - 1) * w * 0.9, top: y - size * 0.1, width: w, height: size * 0.1 }, st]}>
      <Svg width="100%" height="100%" viewBox="0 0 10 24">
        <Path d="M5 23 C1 17 9 12 5 6 C3 3 5 1 5 1" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Mo at his desk with a coffee (Home hero), as three layers of one shared frame: the body (no mug arm), the arm resting with
 * the mug, and the arm lifting it. Entrance (about 300 ms): fade in + rise 10 px, settling 0.98 to 1. Then he takes ONE sip:
 * the arm turns 5 degrees about the shoulder and is swapped for the lifted one at the midpoint (about 80 ms of overlap, hidden by
 * the turn, 360 ms in all), holds 0.9 s, and swaps back while a little steam rises from the mug. Tapping Mo replays the sip. play false (later Home visits) or reduced motion = the resting frame only (no sip, no
 * steam). The image is never flipped: the M on the cap, chest, laptop and mug must stay readable, so Arabic moves the whole
 * group to the other side instead.
 */
export function HomeMo({
  size,
  play = true,
  playKey = 0,
  delay = 0,
  sipDelay = 1300,
  restArm = HOME_MO.restArm,
}: {
  size: number;
  play?: boolean;
  playKey?: number;
  delay?: number;
  sipDelay?: number;
  /** Motion Lab only: fit of the resting arm's sleeve cap */
  restArm?: { dx: number; dy: number; scale: number };
}) {
  const reduced = useReduced();
  const W = size * HOME_MO.ratio;
  const enter = useSharedValue(1);
  const sip = useSharedValue(0);
  const steam = useSharedValue(0);

  const runSip = useCallback(
    (wait: number) => {
      cancelAnimation(sip);
      cancelAnimation(steam);
      sip.value = withDelay(
        wait,
        withSequence(withTiming(1, { duration: SIP_LIFT, easing: ease }), withDelay(SIP_HOLD, withTiming(0, { duration: SIP_LIFT, easing: ease }))),
      );
      steam.value = 0;
      steam.value = withDelay(wait + SIP_LIFT * 2 + SIP_HOLD, withRepeat(withTiming(1, { duration: STEAM_MS, easing: ease }), 2, false));
    },
    [sip, steam],
  );

  useEffect(() => {
    if (!play) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withDelay(reduced ? 0 : delay, withTiming(1, { duration: reduced ? M.reduced : 300, easing: ease }));
    if (!reduced) runSip(sipDelay);
    return () => {
      cancelAnimation(enter);
      cancelAnimation(sip);
      cancelAnimation(steam);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, playKey, reduced]);

  const st = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: reduced ? [] : [{ translateY: (1 - enter.value) * 10 }, { scale: 0.98 + 0.02 * enter.value }],
  }));
  // both arms turn about the shoulder; the swap happens at the midpoint, in a window of about 80 ms, while the arm is mid turn
  const px = W * (HOME_MO.shoulder.x - 0.5);
  const py = size * (HOME_MO.shoulder.y - 0.5);
  const unit = size / 456;
  const rdx = restArm.dx * unit;
  const rdy = restArm.dy * unit;
  const rscale = restArm.scale;
  const turn = HOME_MO.swapTurn;
  const rest = useAnimatedStyle(() => {
    const a = Math.min(1, Math.max(0, (sip.value - (0.5 - SWAP)) / (2 * SWAP)));
    const deg = -turn * Math.min(1, sip.value / 0.5);
    return {
      opacity: 1 - a,
      transform: [{ translateX: rdx }, { translateY: rdy }, { translateX: px }, { translateY: py }, { rotate: deg + "deg" }, { scale: rscale }, { translateX: -px }, { translateY: -py }],
    };
  });
  const drink = useAnimatedStyle(() => {
    const a = Math.min(1, Math.max(0, (sip.value - (0.5 - SWAP)) / (2 * SWAP)));
    const deg = -turn * (1 - Math.max(0, (sip.value - 0.5) / 0.5));
    return { opacity: a, transform: [{ translateX: px }, { translateY: py }, { rotate: deg + "deg" }, { translateX: -px }, { translateY: -py }] };
  });
  const fill = { position: "absolute", left: 0, top: 0, width: W, height: size } as const;
  return (
    <Pressable accessibilityLabel="Mo" onPress={reduced ? undefined : () => runSip(0)} style={{ width: W, height: size }}>
      <Animated.View style={[{ width: W, height: size }, st]}>
        <Image source={BODY} style={fill} contentFit="contain" />
        <Animated.View style={[fill, rest]}>
          <Image source={ARM_REST} style={fill} contentFit="contain" />
        </Animated.View>
        <Animated.View style={[fill, drink]}>
          <Image source={ARM_DRINK} style={fill} contentFit="contain" />
        </Animated.View>
        {reduced ? null : [0, 1, 2].map((k) => <Wisp key={k} k={k} steam={steam} sip={sip} size={size} x={W * HOME_MO.mug.x} y={size * HOME_MO.mug.y} color="#f1e6d0" />)}
      </Animated.View>
    </Pressable>
  );
}
