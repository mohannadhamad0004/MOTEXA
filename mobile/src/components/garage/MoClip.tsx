// Mo as a short bundled clip (expo-video). Plays muted from the start EVERY time its screen comes into focus (opening the page
// or switching back to its tab) and on every tap; never loops by itself, rests on its last frame, pauses when the screen loses
// focus. Reduced motion: the last frame as a still, no autoplay. The generator's watermark strip at the bottom is cropped away.
// Cut-out clips (`blend`) sit straight on the hero in light mode (their background IS heroTone) and in a cream spotlight card in
// dark mode; scene clips are shown as a rounded picture in both. Never mirrored: in Arabic the hero places it on the other side.
import { useEventListener } from "expo";
import { useFocusEffect } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useRef, useState } from "react";
import { Image, ImageSourcePropType, Pressable, View } from "react-native";
import { useReduced } from "../../motion";
import { SPOTLIGHT, gShape, useGarageTheme } from "../../theme/garage";

export type MoClipSource = {
  video: number;
  /** stills of the first / last frame (same framing). Optional: without them the player itself shows those frames */
  first?: ImageSourcePropType;
  last?: ImageSourcePropType;
  frame: { w: number; h: number };
  /** the visible window inside the frame (drops the watermark strip) */
  crop: { x: number; y: number; w: number; h: number };
  /** cut-out clip whose background is the hero colour (blends in light, spotlight card in dark) */
  blend: boolean;
  /** where Mo stands across the crop window (0 = start, 1 = end); a fixed box is cover-cropped around it. Default 0.5 */
  focusX?: number;
};

export const MO_CLIPS = {
  home: {
    video: require("../../../assets/mo/home/video/mo-home-wakeup.mp4"),
    first: require("../../../assets/mo/home/video/mo-home-wakeup-first.png"),
    last: require("../../../assets/mo/home/video/mo-home-wakeup-last.png"),
    // 572 x 716; the bottom 66 px carry the watermark
    frame: { w: 572, h: 716 },
    crop: { x: 0, y: 0, w: 572, h: 650 },
    blend: true,
  },
  // the Parts clip from before Step Garage (was PartsShopHero): 2944 x 1248, watermark in the bottom strip
  parts: {
    video: require("../../../assets/vedio/parts shop owner.mp4"),
    frame: { w: 2944, h: 1248 },
    crop: { x: 0, y: 0, w: 2944, h: 1040 },
    blend: false,
  },
  tow: {
    video: require("../../../assets/vedio/tow truck.mp4"),
    first: require("../../../assets/mo/tow/customer/tow-customer-first.jpg"),
    last: require("../../../assets/mo/tow/customer/tow-customer-last.jpg"),
    frame: { w: 1280, h: 720 },
    crop: { x: 0, y: 0, w: 1280, h: 660 },
    blend: false,
  },
} satisfies Record<string, MoClipSource>;
export type MoClipKey = keyof typeof MO_CLIPS;

/** whole frame scaled so the crop window fills `width`, shifted so only the window shows */
const layer = (c: MoClipSource, width: number) => {
  const k = width / c.crop.w;
  return { position: "absolute", left: -c.crop.x * k, top: -c.crop.y * k, width: c.frame.w * k, height: c.frame.h * k } as const;
};
export const moClipHeight = (key: MoClipKey, width: number) => (width * MO_CLIPS[key].crop.h) / MO_CLIPS[key].crop.w;
/** crop window scaled to COVER a w x h box, centred on Mo (focusX) vertically centred; the watermark strip stays outside */
const cover = (c: MoClipSource, w: number, h: number) => {
  const k = Math.max(w / c.crop.w, h / c.crop.h);
  const spare = c.crop.w * k - w;
  return { position: "absolute", left: -c.crop.x * k - spare * (c.focusX ?? 0.5), top: -c.crop.y * k - (c.crop.h * k - h) / 2, width: c.frame.w * k, height: c.frame.h * k } as const;
};

export type HeroTab = "home" | "parts" | "mechanics" | "tow";
/**
 * The ONE place that says which clip each main tab's hero plays. null = no clip yet: the same-size box shows that tab's photo
 * placeholder (theme/photos.ts "hero.<tab>"). Adding a clip later = add it to MO_CLIPS and put its key here.
 */
export const HERO_CLIPS: Record<HeroTab, MoClipKey | null> = { home: "home", parts: "parts", mechanics: null, tow: "tow" };

/** The four main tabs' hero box: every clip (or its photo placeholder) is shown at exactly this size. */
export const HERO_BOX = { w: 140, h: 180 } as const;

/**
 * `width` is the clip's outer width (in dark mode a blend clip's cream card takes 12 px of it on each side). With `box` the clip
 * fills exactly that box instead (cover, centred on Mo), whatever the source resolution.
 */
export function MoClip({ clip, width = HERO_BOX.w, box, label, radius = gShape.cardLg }: { clip: MoClipKey; width?: number; box?: { w: number; h: number }; label: string; radius?: number }) {
  const { dark } = useGarageTheme();
  const reduced = useReduced();
  const src: MoClipSource = MO_CLIPS[clip];
  const spotlight = src.blend && dark;
  const pad = box ? 10 : 12;
  const outerW = box ? box.w : width;
  const inner = spotlight ? outerW - pad * 2 : outerW;
  const innerH = box ? (spotlight ? box.h - pad * 2 : box.h) : (inner * src.crop.h) / src.crop.w;
  const full = box ? cover(src, inner, innerH) : layer(src, inner);

  const player = useVideoPlayer(src.video, (p) => {
    p.loop = false;
    p.muted = true;
  });
  const focused = useRef(false);
  const [shown, setShown] = useState(false); // the video has drawn a frame (playing, or parked on the last one)
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);

  const toEnd = useCallback(() => {
    if (player.duration > 0) player.currentTime = Math.max(0, player.duration - 0.05);
    player.pause();
    setShown(true);
  }, [player]);
  const replay = useCallback(() => {
    if (reduced) return toEnd();
    setEnded(false);
    player.currentTime = 0;
    player.play();
  }, [player, reduced, toEnd]);

  // every focus plays from the start; losing focus pauses (it never loops by itself)
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      replay();
      return () => {
        focused.current = false;
        player.pause();
      };
    }, [player, replay])
  );
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") setFailed(true);
    // web drops a play() issued before the element is ready: start (or park on the last frame) once it is
    else if (status === "readyToPlay" && focused.current) {
      if (reduced) toEnd();
      else if (!player.playing && player.currentTime === 0) player.play();
    }
  });
  useEventListener(player, "playToEnd", () => setEnded(true));

  const still = failed || reduced || ended ? src.last ?? src.first : !shown ? src.first : undefined;
  const view = (
    <View style={{ width: inner, height: innerH, overflow: "hidden", borderRadius: src.blend && !dark ? 0 : spotlight ? radius - pad : radius, backgroundColor: src.blend ? SPOTLIGHT : "#2A1D16" }}>
      {!failed ? <VideoView player={player} nativeControls={false} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} contentFit="cover" onFirstFrameRender={() => setShown(true)} style={full} /> : null}
      {still ? <Image source={still} style={full} resizeMode="cover" /> : null}
    </View>
  );
  return (
    <Pressable accessibilityRole="image" accessibilityLabel={label} accessibilityHint="Tap to replay" disabled={reduced || failed} onPress={replay} style={spotlight ? { padding: pad, borderRadius: box ? radius : gShape.spotlight, backgroundColor: SPOTLIGHT } : undefined}>
      {view}
    </Pressable>
  );
}
