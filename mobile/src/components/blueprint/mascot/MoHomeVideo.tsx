// Mo's Home wake-up as a short bundled video (temporary approved asset). The first Home entry of the session plays it once, muted,
// no controls, and it rests on its own last frame; every other case (later visits, reduced motion, a failed load) shows that same
// last frame as a still image, so the Working state is identical everywhere and nothing flashes at the end. Never mirrored.
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useEvent, useEventListener } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { useReduced } from "../../../motion";

import { ImageSourcePropType } from "react-native";

/** One bundled clip: the video, its first and last frame as stills (same framing), the stills' size and the visible window inside them. */
export type MoClipSource = { video: number; first: ImageSourcePropType; last: ImageSourcePropType; frame: { w: number; h: number }; crop: { x: number; y: number; w: number; h: number } };

const HOME_CLIP: MoClipSource = {
  video: require("../../../../assets/mo/home/video/mo-home-wakeup.mp4"),
  first: require("../../../../assets/mo/home/video/mo-home-wakeup-first.png"),
  last: require("../../../../assets/mo/home/video/mo-home-wakeup-last.png"),
  // source is 572 x 716; the bottom 66 px carry the generator's watermark, so the visible window stops at row 650
  frame: { w: 572, h: 716 },
  crop: { x: 0, y: 0, w: 572, h: 650 },
};
export const moClipHeight = (c: MoClipSource, width: number) => (width * c.crop.h) / c.crop.w;
export const moVideoHeight = (width: number) => moClipHeight(HOME_CLIP, width);

function Player({ clip, width, onEnd, onFail }: { clip: MoClipSource; width: number; onEnd: () => void; onFail: () => void }) {
  const full = layer(clip, width);
  const player = useVideoPlayer(clip.video, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const [started, setStarted] = useState(false);
  useEventListener(player, "playToEnd", onEnd);
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") onFail();
    else if (status === "readyToPlay" && !player.playing && player.currentTime === 0) player.play(); // web drops a play() issued before the element is attached
  });
  useEffect(() => {
    if (isPlaying) setStarted(true);
  }, [isPlaying]);
  return (
    <>
      <Image source={clip.first} style={full} resizeMode="stretch" />
      <VideoView
        player={player}
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
        contentFit="fill"
        style={{ ...full, opacity: started ? 1 : 0 }}
      />
    </>
  );
}

/** the whole frame, scaled so the crop window fills `width` and positioned so the window is what shows */
const layer = (c: MoClipSource, width: number) => {
  const k = width / c.crop.w;
  return { position: "absolute", left: -c.crop.x * k, top: -c.crop.y * k, width: c.frame.w * k, height: c.frame.h * k } as const;
};

/** `play`: first entry of the session. Otherwise (or with reduced motion / on failure) the still last frame. */
export function MoClip({ clip, width, play, radius = 14, playKey = 0 }: { clip: MoClipSource; width: number; play: boolean; radius?: number; playKey?: number }) {
  const reduced = useReduced();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  // a new playKey (screen focus, a tap) replays from the start; the same key (rerender, refresh) never does
  useEffect(() => {
    setDone(false);
    setFailed(false);
  }, [playKey]);
  const live = play && !reduced && !done && !failed;
  return (
    <View style={{ width, height: moClipHeight(clip, width), borderRadius: radius, overflow: "hidden", backgroundColor: "#E9E0D8" }}>
      <Image source={clip.last} style={layer(clip, width)} resizeMode="stretch" />
      {live ? <Player key={playKey} clip={clip} width={width} onEnd={() => setDone(true)} onFail={() => setFailed(true)} /> : null}
    </View>
  );
}

export const MoHomeVideo = ({ width, play, radius }: { width: number; play: boolean; radius?: number }) => <MoClip clip={HOME_CLIP} width={width} play={play} radius={radius} />;
