// Mo header video for a screen. Drop `<name>-hero.mp4` + `<name>-hero.jpg` (the last frame) into assets/mo/ and that screen's
// header shows it: names are mechanic, admin, signin. Missing files = nothing is drawn (the plain header stays).
// Plays once, muted, then rests on the poster; reduced motion or a load failure = the poster only (see MoClip `once`).
import { Asset } from "expo-asset";
import { ImageSourcePropType } from "react-native";
import { MoClip, MoClipSource } from "./MoClip";

export type MoHeroName = "mechanic" | "admin" | "signin";
// Metro bundles whatever matches; an unknown file name here is simply never asked for.
const files = require.context("../../../assets/mo", false, /-hero\.(mp4|jpg)$/);
const keys = files.keys() as string[];
const has = (f: string) => keys.includes("./" + f);

export function moHeroSource(name: MoHeroName): MoClipSource | null {
  if (!has(`${name}-hero.mp4`) || !has(`${name}-hero.jpg`)) return null;
  const last: ImageSourcePropType = files(`./${name}-hero.jpg`);
  const a = Asset.fromModule(last as number), width = a.width ?? 1172, height = a.height ?? 660;
  return { video: files(`./${name}-hero.mp4`), last, frame: { w: width, h: height }, crop: { x: 0, y: 0, w: width, h: height }, blend: false };
}

export function MoHero({ name, width, label }: { name: MoHeroName; width: number; label: string }) {
  const src = moHeroSource(name);
  return src ? <MoClip clip={src} width={width} label={label} once radius={16} /> : null;
}
