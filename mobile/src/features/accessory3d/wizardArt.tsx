// Line drawings for the shop's "Show it in 3D" wizard: the four part cards (the part highlighted on a plain car) and the angle guide of
// each photo slot. Plain strokes in the theme's colours, so they work in light and dark. Never mirrored in Arabic: "left end" is the
// part's real left end.
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import type { AccessoryType } from "../car3d/modelConfig";
import { useGarageTheme } from "../../theme/garage";

export type WizardType = "FRONT_BUMPER" | "REAR_BUMPER" | "WING" | "RIMS";
export const WIZARD_TYPES: WizardType[] = ["FRONT_BUMPER", "REAR_BUMPER", "WING", "RIMS"];
export const isWizardType = (t: AccessoryType | null | undefined): t is WizardType => !!t && (WIZARD_TYPES as string[]).includes(t);

/** A rim: tyre ring, rim ring, five spokes. */
function Wheel({ cx, cy, r, stroke, accent, spokes = true }: { cx: number; cy: number; r: number; stroke: string; accent: string; spokes?: boolean }) {
  return <G>
    <Circle cx={cx} cy={cy} r={r} stroke={stroke} strokeWidth={2} fill="none" />
    <Circle cx={cx} cy={cy} r={r * 0.68} stroke={accent} strokeWidth={2.4} fill="none" />
    <Circle cx={cx} cy={cy} r={r * 0.14} stroke={accent} strokeWidth={2} fill="none" />
    {spokes ? [0, 72, 144, 216, 288].map(d => { const a = (d - 90) * Math.PI / 180; return <Line key={d} x1={cx + Math.cos(a) * r * 0.16} y1={cy + Math.sin(a) * r * 0.16} x2={cx + Math.cos(a) * r * 0.66} y2={cy + Math.sin(a) * r * 0.66} stroke={accent} strokeWidth={2.4} strokeLinecap="round" />; }) : null}
  </G>;
}

/** The part card picture: the part in accent on a plain grey car. */
export function PartArt({ type, size = 96 }: { type: WizardType; size?: number }) {
  const { g } = useGarageTheme(); const s = g.soft, a = g.accent, w = size, h = size * 0.62;
  const common = { stroke: s, strokeWidth: 2, fill: "none", strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  if (type === "RIMS") return <Svg width={w} height={h} viewBox="0 0 120 74"><Wheel cx={60} cy={37} r={33} stroke={s} accent={a} /></Svg>;
  if (type === "WING") return <Svg width={w} height={h} viewBox="0 0 120 74">
    {/* side view, the wing on the boot lid */}
    <Path {...common} d="M8 52 L10 40 Q14 34 26 33 L40 32 L52 20 Q56 17 64 17 L82 18 Q90 19 96 30 L108 32 Q114 34 114 42 L114 52 Z" />
    <Circle {...common} cx={30} cy={53} r={8} /><Circle {...common} cx={92} cy={53} r={8} />
    <Path d="M96 24 L116 22 M104 23 L102 30" stroke={a} strokeWidth={3.4} strokeLinecap="round" fill="none" />
  </Svg>;
  const rear = type === "REAR_BUMPER";
  return <Svg width={w} height={h} viewBox="0 0 120 74">
    {/* the car from the front / from behind: roof, glass, body, lights; the bumper is the accent band */}
    <Path {...common} d="M30 26 L38 10 Q40 7 46 7 L74 7 Q80 7 82 10 L90 26" />
    <Path {...common} d="M18 30 Q20 26 30 26 L90 26 Q100 26 102 30 L104 46 L16 46 Z" />
    {rear ? <><Path d="M20 32 L34 32 L32 38 L20 38 Z" stroke={s} strokeWidth={2} fill="none" /><Path d="M100 32 L86 32 L88 38 L100 38 Z" stroke={s} strokeWidth={2} fill="none" /><Rect x={50} y={33} width={20} height={7} rx={1.5} stroke={s} strokeWidth={1.6} fill="none" /></>
      : <><Ellipse cx={28} cy={35} rx={8} ry={4} stroke={s} strokeWidth={2} fill="none" /><Ellipse cx={92} cy={35} rx={8} ry={4} stroke={s} strokeWidth={2} fill="none" /><Path d="M48 33 L72 33 L70 40 L50 40 Z" stroke={s} strokeWidth={1.6} fill="none" /></>}
    <Path d="M12 46 Q12 44 16 44 L104 44 Q108 44 108 46 L106 58 Q104 62 98 62 L22 62 Q16 62 14 58 Z" stroke={a} strokeWidth={3} fill={a} fillOpacity={0.16} strokeLinejoin="round" />
    <Rect {...common} x={20} y={62} width={12} height={7} rx={2} /><Rect {...common} x={88} y={62} width={12} height={7} rx={2} />
  </Svg>;
}

/** Labels of the guided photo slots (index = slot). */
export const SLOT_LABELS: Record<"body" | "rim", [string, string][]> = {
  body: [["Back", "من الخلف"], ["Left end", "الطرف الأيسر"], ["Right end", "الطرف الأيمن"], ["Three-quarter", "زاوية ثلاثة أرباع"]],
  rim: [["Face", "الوجه"], ["Side", "من الجانب"], ["Three-quarter", "زاوية ثلاثة أرباع"], ["Back", "من الخلف"]],
};
export const slotKind = (t: AccessoryType | null | undefined) => (t === "RIMS" ? "rim" : "body");

/** The angle to photograph: the part alone, drawn from that side (camera dot = where you stand). */
export function SlotArt({ kind, slot, size = 76 }: { kind: "body" | "rim"; slot: number; size?: number }) {
  const { g } = useGarageTheme(); const s = g.soft, a = g.accent;
  const p = { stroke: a, strokeWidth: 2.6, fill: a, fillOpacity: 0.12, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const thin = { stroke: s, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeDasharray: "3 3" };
  let body: React.ReactNode;
  if (kind === "rim") body = slot === 0 ? <Wheel cx={40} cy={30} r={24} stroke={a} accent={a} />
    : slot === 1 ? <><Rect x={30} y={6} width={20} height={48} rx={6} {...p} /><Line x1={40} y1={6} x2={40} y2={54} stroke={a} strokeWidth={1.6} /></>
    : slot === 2 ? <G><Ellipse cx={40} cy={30} rx={16} ry={24} {...p} /><Ellipse cx={44} cy={30} rx={10} ry={17} stroke={a} strokeWidth={2} fill="none" />{[0, 72, 144, 216, 288].map(d => { const t = (d - 90) * Math.PI / 180; return <Line key={d} x1={44} y1={30} x2={44 + Math.cos(t) * 9} y2={30 + Math.sin(t) * 16} stroke={a} strokeWidth={2} />; })}</G>
    : <><Circle cx={40} cy={30} r={24} {...p} /><Circle cx={40} cy={30} r={9} stroke={a} strokeWidth={2} fill="none" />{[0, 72, 144, 216, 288].map(d => { const t = (d - 90) * Math.PI / 180; return <Circle key={d} cx={40 + Math.cos(t) * 5} cy={30 + Math.sin(t) * 5} r={1.4} fill={a} />; })}</>;
  else body = slot === 0 ? <Path {...p} d="M6 22 Q40 14 74 22 L72 40 Q40 46 8 40 Z" />
    : slot === 1 ? <Path {...p} d="M22 18 L40 16 Q58 16 58 26 L56 40 Q48 46 36 44 L22 40 Z" />
    : slot === 2 ? <Path {...p} d="M58 18 L40 16 Q22 16 22 26 L24 40 Q32 46 44 44 L58 40 Z" />
    : <Path {...p} d="M8 20 Q34 12 66 18 Q74 22 72 30 L70 40 Q40 48 14 42 Q8 40 8 34 Z" />;
  // where the camera stands
  const cam = kind === "rim" ? [[40, 58], [10, 30], [16, 52], [40, 58]][slot]! : [[40, 58], [6, 30], [74, 30], [12, 56]][slot]!;
  return <Svg width={size} height={size * 0.8} viewBox="0 0 80 64">
    {body}
    <Line x1={cam[0]} y1={cam[1]} x2={40} y2={30} {...thin} />
    <Rect x={cam[0] - 5} y={cam[1] - 3.5} width={10} height={7} rx={2} fill={s} />
  </Svg>;
}
