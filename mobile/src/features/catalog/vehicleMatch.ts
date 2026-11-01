// Car-aware search: find a vehicle from the list inside what the customer typed ("corolla 2016", "كورولا 2016",
// "hyundai elantra", "brake pads corolla"). Pure: no React, no network (vehicleMatch.check.ts exercises it).
import type { VehicleRow } from "./catalogService";

/** lowercase, collapsed spaces, Arabic letter variants folded (أ إ آ -> ا, ة -> ه, ى -> ي), Arabic digits -> 0-9 */
export const normSearch = (v: string) =>
  v
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export type VehicleHit = { v: VehicleRow; year: number | null; rest: string };

/** where `needle` (whole words) sits in `tokens`, or -1 */
const at = (tokens: string[], needle: string) => {
  const n = needle.split(" ");
  for (let i = 0; i + n.length <= tokens.length; i++) if (n.every((w, j) => tokens[i + j] === w)) return i;
  return -1;
};

/**
 * The vehicle named in `q`: a model name (EN or AR, whole words; a purely numeric model like "2008" only together with its make),
 * the make words dropped too, and a 4-digit year taken only when it is inside that model's years. `rest` = the words left for the
 * part-name search. The longest model name wins ("Grand i10" over "i10"). Null when no model is named.
 */
export function matchVehicle(q: string, list: VehicleRow[]): VehicleHit | null {
  const tokens = normSearch(q).split(" ").filter(Boolean);
  if (!tokens.length) return null;
  let best: { v: VehicleRow; start: number; len: number } | null = null;
  for (const v of list) {
    const makes = [normSearch(v.make), normSearch(v.makeAr)];
    const hasMake = makes.some((m) => at(tokens, m) >= 0);
    for (const name of [normSearch(v.model), normSearch(v.modelAr)]) {
      if (!name || (/^\d+$/.test(name) && !hasMake)) continue;
      const i = at(tokens, name);
      const len = name.split(" ").length;
      if (i >= 0 && (!best || len > best.len || (len === best.len && hasMake))) best = { v, start: i, len };
    }
  }
  if (!best) return null;
  const used = new Set<number>();
  for (let j = 0; j < best.len; j++) used.add(best.start + j);
  for (const m of [normSearch(best.v.make), normSearch(best.v.makeAr)]) {
    const i = at(tokens, m);
    if (i >= 0) m.split(" ").forEach((_, j) => used.add(i + j));
  }
  let year: number | null = null;
  tokens.forEach((w, i) => {
    if (year === null && !used.has(i) && /^\d{4}$/.test(w) && +w >= best!.v.yearFrom && +w <= best!.v.yearTo) {
      year = +w;
      used.add(i);
    }
  });
  return { v: best.v, year, rest: tokens.filter((_, i) => !used.has(i)).join(" ") };
}
