// Mo inspecting submissions for the Parts Admin hero (approved local clip). Same player as the Home / Tow Admin clips.
import { MoClip } from "./MoHomeVideo";

// stills are the first / last video frames (1280 x 720); the visible window stops above the generator watermark in the bottom-right corner
const PARTS_CLIP = {
  video: require("../../../../assets/mo/admin/parts/mo-parts-admin.mp4"),
  first: require("../../../../assets/mo/admin/parts/mo-parts-admin-first.jpg"),
  last: require("../../../../assets/mo/admin/parts/mo-parts-admin-last.jpg"),
  frame: { w: 1280, h: 720 },
  crop: { x: 300, y: 20, w: 800, h: 635 },
};
export const MOPARTS_ASPECT = PARTS_CLIP.crop.h / PARTS_CLIP.crop.w;
export const MoPartsAdminVideo = ({ width, play, playKey }: { width: number; play: boolean; playKey: number }) => <MoClip clip={PARTS_CLIP} width={width} play={play} playKey={playKey} radius={18} />;
