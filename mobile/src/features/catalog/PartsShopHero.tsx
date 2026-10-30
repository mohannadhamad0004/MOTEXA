// Parts hero: the bundled "parts shop owner" clip, full width, cover-cropped, muted. Plays when the screen gains focus
// (not on re-renders), a tap replays it, reduced motion shows the first frame only, and a failed load falls back to a plain
// dark panel. The picture is never mirrored.
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useEventListener } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { ReactNode, useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../components/blueprint";
import { BackButton, useHeroStatusBar } from "../../components/blueprint/Surface";
import { useReduced } from "../../motion";
import { useTheme } from "../../theme/useTheme";

const CLIP = require("../../../assets/vedio/parts shop owner.mp4");
const BODY = 210;
/** the clip carries its generator's watermark in the bottom corner: it is drawn this much taller than the hero and clipped */
const CROP = 40;
export const PARTS_HERO_OVERLAP = 24;

export function PartsShopHero({ back, children }: { back?: Parameters<typeof BackButton>[0]["fallback"]; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const reduced = useReduced();
  const [failed, setFailed] = useState(false);
  const focused = useRef(false);
  useHeroStatusBar();
  const player = useVideoPlayer(CLIP, (p) => {
    p.loop = false;
    p.muted = true;
  });
  const replay = useCallback(() => {
    player.currentTime = 0;
    player.play();
  }, [player]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (!reduced) replay();
      return () => {
        focused.current = false;
        player.pause();
      };
    }, [player, reduced, replay])
  );
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") setFailed(true);
    // web drops a play() issued before the element is attached: start once it is ready, only while focused
    else if (status === "readyToPlay" && focused.current && !reduced && !player.playing && player.currentTime === 0) player.play();
  });
  return (
    <View style={{ height: insets.top + BODY, backgroundColor: c.blueprint, overflow: "hidden" }}>
      {failed ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 30 }}>
          <Icon name="shop" size={44} color={c.bronzeLight} />
        </View>
      ) : (
        <Pressable accessibilityLabel="Replay" onPress={replay} style={{ position: "absolute", left: 0, right: 0, top: 0, height: insets.top + BODY + CROP }}>
          <VideoView player={player} nativeControls={false} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} contentFit="cover" style={{ width: "100%", height: "100%" }} />
        </Pressable>
      )}
      {/* melts the clip into the dark shop area below */}
      <LinearGradient pointerEvents="none" colors={["transparent", c.blueprint]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 56 }} />
      {back ? <BackButton fallback={back} /> : null}
      {children}
    </View>
  );
}
