// The hero of every department Home: the SAME HeroLayout the customer tabs, tow company and parts shop use (title + one real line
// on the start side, Mo's clip in the 148 x 186 box on the end side, plays on every focus and rests on its last frame).
// A department's own clip comes from here; without one the box shows the tab's photo placeholder.
import { HeroLayout } from "../../components/garage";
import type { HeroTab, MoClipSource, MoFraming } from "../../components/garage/MoClip";
import { moHeroMedia } from "../../components/garage/MoHero";
import { useL } from "../../core/hooks/useL";

// frames are 1280 x 720 stills; each crop window stays clear of the generator watermark in the bottom-right corner
const TOW_ADMIN: MoClipSource = {
  video: require("../../../assets/mo/admin/tow/mo-tow-admin.mp4"),
  first: require("../../../assets/mo/admin/tow/mo-tow-admin-first.jpg"),
  last: require("../../../assets/mo/admin/tow/mo-tow-admin-last.jpg"),
  frame: { w: 1280, h: 720 },
  crop: { x: 430, y: 60, w: 680, h: 595 },
  blend: false,
};
const PARTS_ADMIN: MoClipSource = {
  video: require("../../../assets/mo/admin/parts/mo-parts-admin.mp4"),
  first: require("../../../assets/mo/admin/parts/mo-parts-admin-first.jpg"),
  last: require("../../../assets/mo/admin/parts/mo-parts-admin-last.jpg"),
  frame: { w: 1280, h: 720 },
  crop: { x: 300, y: 20, w: 800, h: 635 },
  blend: false,
};
const FRAME: MoFraming = { focusX: 0.5, focusY: 0.5, scale: 1 };

export function AdminHero({ dept, title, line }: { dept: "tow" | "parts" | "mechanics"; title: string; line?: string }) {
  const { t } = useL();
  const tab: HeroTab = dept;
  const label = { tow: t("Tow admin", "إدارة السحب"), parts: t("Parts admin", "إدارة القطع"), mechanics: t("Mechanics admin", "إدارة الميكانيكيين") }[dept];
  const mo = t("Mo, the MOTEXA mascot", "مو، تميمة موتيكسا");
  const media = dept === "tow" ? { clip: TOW_ADMIN, framing: FRAME, label: mo } : dept === "parts" ? { clip: PARTS_ADMIN, framing: FRAME, label: mo } : moHeroMedia("admin", mo) ?? { clip: null, label: mo };
  return <HeroLayout config={{ tab, title, line, top: { label, actions: [] }, media }} />;
}
