// Pictures for the shop's "Show it in 3D" wizard: the four part cards (rendered from our own 3D viewer: BMW E36, grey, the part in
// bronze, transparent background) and the angle guide of each photo slot (the part's silhouette from that angle + where to stand).
// Never mirrored in Arabic: "left end" is the part's real left end.
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import type { ImageSourcePropType } from "react-native";
import type { AccessoryType } from "../car3d/modelConfig";
import { useGarageTheme } from "../../theme/garage";

export type WizardType = "FRONT_BUMPER" | "REAR_BUMPER" | "WING" | "RIMS";
export const WIZARD_TYPES: WizardType[] = ["FRONT_BUMPER", "REAR_BUMPER", "WING", "RIMS"];
export const isWizardType = (t: AccessoryType | null | undefined): t is WizardType => !!t && (WIZARD_TYPES as string[]).includes(t);

/** 360 x 240 webp renders (2x of the card), re-made with backend/scripts/wizard-part-cards.mjs if the viewer or the E36 changes. */
export const PART_IMAGES: Record<WizardType, ImageSourcePropType> = {
  FRONT_BUMPER: require("../../../assets/wizard/front-bumper.webp"),
  REAR_BUMPER: require("../../../assets/wizard/rear-bumper.webp"),
  WING: require("../../../assets/wizard/rear-wing.webp"),
  RIMS: require("../../../assets/wizard/rims.webp"),
};

/** Labels of the guided photo slots (index = slot). */
export const SLOT_LABELS: Record<"body" | "rim", [string, string][]> = {
  body: [["Back", "من الخلف"], ["Left end", "الطرف الأيسر"], ["Right end", "الطرف الأيمن"], ["Three-quarter", "زاوية ثلاثة أرباع"]],
  rim: [["Face", "الوجه"], ["Side", "من الجانب"], ["Three-quarter", "زاوية ثلاثة أرباع"], ["Back", "من الخلف"]],
};
export const slotKind = (t: AccessoryType | null | undefined) => (t === "RIMS" ? "rim" : "body");
export type SlotPart = "bumper" | "wing" | "rim";
export const slotPart = (t: AccessoryType | null | undefined): SlotPart => (t === "RIMS" ? "rim" : t === "WING" ? "wing" : "bumper");

/** The part seen from each slot's angle (viewBox 0 0 100 72, part around x 50, y 30). */
const SHAPES: Record<SlotPart, string[][]> = {
  bumper: [
    // straight on: the long band with its lower opening
    ["M8 20 Q50 10 92 20 L90 40 Q50 48 10 40 Z", "M30 32 L70 32 L66 40 L34 40 Z"],
    // from its left end: the end wraps towards you, the face runs away
    ["M14 22 Q20 16 34 16 L86 20 L84 34 L36 40 Q18 40 14 34 Z", "M14 22 Q24 26 26 38"],
    // from its right end (mirror of the left)
    ["M86 22 Q80 16 66 16 L14 20 L16 34 L64 40 Q82 40 86 34 Z", "M86 22 Q76 26 74 38"],
    // three-quarter: face and one end
    ["M10 24 Q40 12 78 16 Q90 18 90 28 L88 38 Q50 48 16 44 Q8 42 10 34 Z", "M78 16 Q84 26 82 40", "M30 34 L62 32 L60 38 L32 40 Z"],
  ],
  wing: [
    // from behind: the blade, two end plates, two legs
    ["M8 18 L92 18 L92 25 L8 25 Z", "M8 12 L14 12 L14 30 L8 30 Z", "M86 12 L92 12 L92 30 L86 30 Z", "M30 25 L32 46 L38 46 L36 25 Z", "M70 25 L68 46 L62 46 L64 25 Z"],
    // from its left end: the blade's profile on an end plate, one leg
    ["M28 22 Q50 12 76 18 L76 23 Q52 20 28 27 Z", "M40 10 L74 10 L74 34 L40 34 Z", "M54 26 L56 50 L62 50 L60 24 Z"],
    // from its right end (mirror)
    ["M72 22 Q50 12 24 18 L24 23 Q48 20 72 27 Z", "M60 10 L26 10 L26 34 L60 34 Z", "M46 26 L44 50 L38 50 L40 24 Z"],
    // three-quarter: the blade in perspective
    ["M10 22 L80 14 L88 18 L18 28 Z", "M80 8 L88 8 L88 26 L80 26 Z", "M32 25 L34 46 L40 46 L38 24 Z", "M64 20 L64 42 L70 42 L70 19 Z"],
  ],
  rim: [[], [], [], []], // drawn below
};
/** Where the camera stands for each slot (bottom = in front of the side shown). */
const CAMERA: Record<SlotPart, [number, number][]> = {
  bumper: [[50, 62], [8, 58], [92, 58], [16, 64]],
  wing: [[50, 62], [12, 58], [88, 58], [18, 64]],
  rim: [[50, 63], [14, 56], [20, 62], [50, 63]],
};

function Rim({ slot, a }: { slot: number; a: string }) {
  const fill = { fill: a, fillOpacity: 0.16, stroke: a, strokeWidth: 2.4, strokeLinejoin: "round" as const };
  const spokes = (cx: number, cy: number, rx: number, ry: number) => [0, 72, 144, 216, 288].map(d => { const r = (d - 90) * Math.PI / 180; return <Line key={d} x1={cx + Math.cos(r) * rx * 0.2} y1={cy + Math.sin(r) * ry * 0.2} x2={cx + Math.cos(r) * rx * 0.9} y2={cy + Math.sin(r) * ry * 0.9} stroke={a} strokeWidth={2.4} strokeLinecap="round" />; });
  if (slot === 0) return <G><Circle cx={50} cy={27} r={21} {...fill} /><Circle cx={50} cy={27} r={4.5} stroke={a} strokeWidth={2} fill="none" />{spokes(50, 27, 19, 19)}</G>;
  if (slot === 1) return <G><Rect x={40} y={6} width={20} height={48} rx={7} {...fill} /><Line x1={50} y1={8} x2={50} y2={52} stroke={a} strokeWidth={1.6} /></G>;
  if (slot === 2) return <G><Ellipse cx={50} cy={30} rx={15} ry={24} {...fill} /><Ellipse cx={54} cy={30} rx={10} ry={18} stroke={a} strokeWidth={2} fill="none" />{spokes(54, 30, 9, 16)}</G>;
  return <G><Circle cx={50} cy={27} r={21} {...fill} /><Circle cx={50} cy={27} r={9} stroke={a} strokeWidth={2} fill="none" />{[0, 72, 144, 216, 288].map(d => { const r = (d - 90) * Math.PI / 180; return <Circle key={d} cx={50 + Math.cos(r) * 5.5} cy={27 + Math.sin(r) * 5.5} r={1.5} fill={a} />; })}</G>;
}

/** A small camera: body, lens, viewfinder bump. */
function Camera({ x, y, ink, bg }: { x: number; y: number; ink: string; bg: string }) {
  return <G>
    <Rect x={x - 8} y={y - 5} width={16} height={11} rx={3} fill={ink} />
    <Rect x={x - 3} y={y - 8} width={6} height={4} rx={1.2} fill={ink} />
    <Circle cx={x} cy={y + 0.5} r={3.4} fill={bg} />
    <Circle cx={x} cy={y + 0.5} r={1.6} fill={ink} />
  </G>;
}

/** The angle to photograph: the part's silhouette from that side, and where to stand (dashed line to the part). */
export function SlotArt({ part, slot, size = 96 }: { part: SlotPart; slot: number; size?: number }) {
  const { g } = useGarageTheme(); const a = g.accent;
  const [cx, cy] = CAMERA[part][slot]!;
  return <Svg width={size} height={size * 0.72} viewBox="0 0 100 72">
    <Line x1={cx} y1={cy} x2={50} y2={30} stroke={g.soft} strokeWidth={1.4} strokeDasharray="3 3" strokeLinecap="round" />
    {part === "rim" ? <Rim slot={slot} a={a} />
      : SHAPES[part][slot]!.map((d, i) => <Path key={i} d={d} fill={i === 0 || part === "wing" ? a : "none"} fillOpacity={0.16} stroke={a} strokeWidth={i === 0 ? 2.6 : 2} strokeLinejoin="round" strokeLinecap="round" />)}
    <Camera x={cx} y={cy} ink={g.ink} bg={g.cardSoft} />
  </Svg>;
}
