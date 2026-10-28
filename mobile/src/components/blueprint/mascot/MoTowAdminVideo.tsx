// Mo at the dispatch desk for the Tow Admin hero (approved local clip). Same player as the Home clip.
import { MoClip } from "./MoHomeVideo";

// stills are the first / last video frames (1280 x 720); the visible window keeps clear of the generator watermark in the bottom-right corner
const TOW_CLIP = {
  video: require("../../../../assets/mo/admin/tow/mo-tow-admin.mp4"),
  first: require("../../../../assets/mo/admin/tow/mo-tow-admin-first.jpg"),
  last: require("../../../../assets/mo/admin/tow/mo-tow-admin-last.jpg"),
  frame: { w: 1280, h: 720 },
  crop: { x: 430, y: 60, w: 680, h: 595 },
};
export const MOTOW_ASPECT = TOW_CLIP.crop.h / TOW_CLIP.crop.w;
export const MoTowAdminVideo = ({ width, play, playKey }: { width: number; play: boolean; playKey: number }) => <MoClip clip={TOW_CLIP} width={width} play={play} playKey={playKey} radius={18} />;
