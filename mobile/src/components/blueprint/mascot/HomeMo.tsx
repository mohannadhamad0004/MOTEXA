import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ease, M, useReduced } from "../../../motion";
import { HOME_MO } from "./moConfig";

const SCENE = require("../../../../assets/mascot/home-mo-scene.png");

/**
 * Mo at his desk with a coffee: one transparent scene image used as hero artwork. Entrance only (about 300 ms): it fades in and
 * rises 10 px while settling from 0.98 to 1; no bounce, no loop. play false (later Home visits) or reduced motion = the final
 * frame (reduced motion keeps a simple fade). The image is never flipped: the M on the cap, chest, laptop and mug must stay
 * readable, so Arabic moves the whole group to the other side instead.
 */
export function HomeMo({
  size,
  play = true,
  playKey = 0,
  delay = 0,
  mirrored = false,
  onPress,
}: {
  size: number;
  play?: boolean;
  playKey?: number;
  /** ms before the entrance starts (the Home hero sequence) */
  delay?: number;
  /** Motion Lab comparison only: the production hero never flips the artwork */
  mirrored?: boolean;
  onPress?: () => void;
}) {
  const reduced = useReduced();
  const W = size * HOME_MO.ratio;
  const enter = useSharedValue(1);
  useEffect(() => {
    if (!play) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withDelay(reduced ? 0 : delay, withTiming(1, { duration: reduced ? M.reduced : 300, easing: ease }));
    return () => cancelAnimation(enter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, playKey, reduced]);
  const st = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: reduced ? [] : [{ translateY: (1 - enter.value) * 10 }, { scale: 0.98 + 0.02 * enter.value }],
  }));
  return (
    <Pressable accessibilityLabel="Mo" onPress={onPress} disabled={!onPress} style={{ width: W, height: size }}>
      <Animated.View style={[{ width: W, height: size }, st]}>
        <Image source={SCENE} style={{ width: W, height: size, transform: [{ scaleX: mirrored ? -1 : 1 }] }} contentFit="contain" />
      </Animated.View>
    </Pressable>
  );
}
