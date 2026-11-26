// The Parts Admin's position correction (fit review editor): nudges with step sizes, kept inside the server's bounds (backend parseAdj:
// ±0.5 m, ±0.8 rad, 80–125 %), and the values in words. Pure (tests/fit-correction.test.mjs).
import type { FitAdjust } from "../car3d/car3d";

export type StepSize = "fine" | "mid" | "coarse";
export type Axis = keyof FitAdjust;
/** move 1 mm / 5 mm / 1 cm; rotate 0.25° / 1° / 2°; scale 0.1 / 0.5 / 1 % */
export const STEP: Record<StepSize, { m: number; deg: number; pct: number }> = {
  fine: { m: 0.001, deg: 0.25, pct: 0.1 }, mid: { m: 0.005, deg: 1, pct: 0.5 }, coarse: { m: 0.01, deg: 2, pct: 1 },
};
const MOVE = 0.5, TURN = 0.8, S_MIN = 0.8, S_MAX = 1.25;
const round = (v: number) => Math.round(v * 1e7) / 1e7;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const kind = (a: Axis) => (a === "s" ? "pct" : a === "rx" || a === "ry" ? "deg" : "m");

export function nudge(adj: FitAdjust, axis: Axis, dir: 1 | -1, size: StepSize): FitAdjust {
  const st = STEP[size], k = kind(axis);
  const v = k === "pct" ? clamp(adj.s + dir * st.pct / 100, S_MIN, S_MAX)
    : k === "deg" ? clamp(adj[axis] + dir * st.deg * Math.PI / 180, -TURN, TURN) : clamp(adj[axis] + dir * st.m, -MOVE, MOVE);
  return { ...adj, [axis]: round(v) };
}
/** the button that would go past the bound is off */
export function atBound(adj: FitAdjust, axis: Axis, dir: 1 | -1): boolean {
  const k = kind(axis), v = adj[axis];
  return k === "pct" ? (dir > 0 ? v >= S_MAX : v <= S_MIN) : (dir > 0 ? v >= (k === "deg" ? TURN : MOVE) : v <= -(k === "deg" ? TURN : MOVE));
}
/** "+12" (mm), "−0.25" (°), "+1.5" (%): up to two decimals, shown left to right in both languages; 0 has no sign */
export function axisNumber(adj: FitAdjust, axis: Axis): string {
  const k = kind(axis), v = k === "pct" ? (adj.s - 1) * 100 : k === "deg" ? adj[axis] * 180 / Math.PI : adj[axis] * 1000;
  const r = Math.round(v * 100) / 100;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${String(Math.abs(r))}`;
}
export const unitOf = (axis: Axis): "mm" | "deg" | "pct" => (kind(axis) === "m" ? "mm" : kind(axis) as "deg" | "pct");
export const isCorrected = (a: FitAdjust) => a.x !== 0 || a.y !== 0 || a.z !== 0 || a.rx !== 0 || a.ry !== 0 || a.s !== 1;
export const sameAdj = (a: FitAdjust, b: FitAdjust) => (["x", "y", "z", "rx", "ry", "s"] as Axis[]).every(k => a[k] === b[k]);
/** "Apply to similar cars": up to this many cars run here one by one ("3 / 8"); more run as a background job on the server */
export const IN_APP_MAX = 10;
