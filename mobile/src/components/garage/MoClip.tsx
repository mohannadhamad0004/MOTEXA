// Mo as a short bundled clip (expo-video). Plays muted from the start EVERY time its screen comes into focus (opening the page
// or switching back to its tab) and on every tap; never loops by itself, rests on its last frame, pauses when the screen loses
// focus. Reduced motion: the last frame as a still, no autoplay. The generator's watermark strip at the bottom is cropped away.
// In a fixed `box` (the main-tab hero) every clip fills the box edge to edge; the hero draws the frame. Without a box, cut-out
// clips (`blend`) sit straight on the page in light mode and in a cream spotlight card in dark mode. Never mirrored.
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
  // 444 x 558 = exactly the HERO_BOX ratio, watermark already removed: the whole frame is shown
  parts: {
    video: require("../../../assets/mo/customer/parts/mo-parts-customer.mp4"),
    first: require("../../../assets/mo/customer/parts/mo-parts-customer-first.jpg"),
    last: require("../../../assets/mo/customer/parts/mo-parts-customer-last.jpg"),
    frame: { w: 444, h: 558 },
    crop: { x: 0, y: 0, w: 444, h: 558 },
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
/**
 * How a clip sits in a fixed box. focusX / focusY: Mo's centre inside the crop window (0..1). scale: zoom, where 1 = the whole
 * crop window fits the box and 2 = twice that; never less than what fills the box (cover). The visible part never leaves the
 * crop window, so the watermark strip is never shown.
 */
export type MoFraming = { focusX: number; focusY: number; scale: number };
const framed = (c: MoClipSource, w: number, h: number, f: MoFraming) => {
  const k = Math.max(Math.min(w / c.crop.w, h / c.crop.h) * f.scale, w / c.crop.w, h / c.crop.h);
  const vw = w / k;
  const vh = h / k;
  // the visible window (source px), centred on Mo, kept inside the crop window (or, when bigger, around it)
  const place = (start: number, size: number, focus: number, view: number) => {
    const v = start + focus * size - view / 2;
    return view <= size ? Math.min(Math.max(v, start), start + size - view) : Math.min(Math.max(v, start + size - view), start);
  };
  const vx = place(c.crop.x, c.crop.w, f.focusX, vw);
  const vy = place(c.crop.y, c.crop.h, f.focusY, vh);
  // what of the crop window is inside the box: only this part is drawn
  const ix = Math.max(vx, c.crop.x);
  const iy = Math.max(vy, c.crop.y);
  const iw = Math.min(vx + vw, c.crop.x + c.crop.w) - ix;
  const ih = Math.min(vy + vh, c.crop.y + c.crop.h) - iy;
  return {
    window: { position: "absolute", overflow: "hidden", left: (ix - vx) * k, top: (iy - vy) * k, width: iw * k, height: ih * k } as const,
    media: { position: "absolute", left: -ix * k, top: -iy * k, width: c.frame.w * k, height: c.frame.h * k } as const,
  };
};

export type HeroTab = "home" | "parts" | "mechanics" | "tow";
/**
 * The ONE place that says which clip each main tab's hero plays, and how it is framed (see MoFraming; values measured on the
 * clips' frames so Mo's cap, face and hands stay inside the box). null = no clip yet: the same-size box shows that tab's photo
 * placeholder (theme/photos.ts "hero.<tab>"). Adding a clip later = add it to MO_CLIPS and put it here.
 */
export const HERO_CLIPS: Record<HeroTab, ({ clip: MoClipKey } & MoFraming) | null> = {
  // cut-out clip: Mo at the desk (cap ~y 125, shoes ~x 145 / y 600 of 572 x 650), a light zoom, desk edges may crop
  home: { clip: "home", focusX: 0.55, focusY: 0.5, scale: 1.25 },
  // already framed for the box: no zoom, centred
  parts: { clip: "parts", focusX: 0.5, focusY: 0.5, scale: 1 },
  mechanics: null,
  // Mo beside the truck: raised fist ~x 450 to hand on hip ~x 900 of 1280, cap from ~y 55
  tow: { clip: "tow", focusX: 0.52, focusY: 0.52, scale: 2.45 },
};

/** The four main tabs' hero box: every clip (or its photo placeholder) is shown at exactly this size. */
export const HERO_BOX = { w: 148, h: 186 } as const;

/**
 * `width` is the clip's outer width (in dark mode a blend clip's cream card takes 12 px of it on each side). With `box` the clip
 * fills exactly that box instead, framed by `framing` (default: whole clip, centred), whatever the source resolution.
 */
export function MoClip({ clip, width = HERO_BOX.w, box, framing = { focusX: 0.5, focusY: 0.5, scale: 1 }, label, radius = gShape.cardLg }: { clip: MoClipKey; width?: number; box?: { w: number; h: number }; framing?: MoFraming; label: string; radius?: number }) {
  const { dark } = useGarageTheme();
  const reduced = useReduced();
  const src: MoClipSource = MO_CLIPS[clip];
  const spotlight = src.blend && dark && !box;
  const pad = 12;
  const outerW = box ? box.w : width;
  const inner = spotlight ? outerW - pad * 2 : outerW;
  const innerH = box ? box.h : (inner * src.crop.h) / src.crop.w;
  const fr = box ? framed(src, inner, innerH, framing) : { window: { position: "absolute", left: 0, top: 0, width: inner, height: innerH, overflow: "hidden" } as const, media: layer(src, inner) };
  const full = fr.media;

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
    <View style={{ width: inner, height: innerH, overflow: "hidden", borderRadius: box ? radius : src.blend && !dark ? 0 : spotlight ? radius - pad : radius, backgroundColor: src.blend ? SPOTLIGHT : "#2A1D16" }}>
      <View style={fr.window}>
        {!failed ? <VideoView player={player} nativeControls={false} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} contentFit="cover" onFirstFrameRender={() => setShown(true)} style={full} /> : null}
        {still ? <Image source={still} style={full} resizeMode="cover" /> : null}
      </View>
    </View>
  );
  return (
    <Pressable accessibilityRole="image" accessibilityLabel={label} accessibilityHint="Tap to replay" disabled={reduced || failed} onPress={replay} style={spotlight ? { padding: pad, borderRadius: gShape.spotlight, backgroundColor: SPOTLIGHT } : undefined}>
      {view}
    </Pressable>
  );
}
