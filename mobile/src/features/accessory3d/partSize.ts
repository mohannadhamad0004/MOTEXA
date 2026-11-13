// Measured part size (8-point shape in the part-map editor) and its check against the shop's "Real size".
import type { AccessoryType, PartLabel } from "../car3d/modelConfig";

export type MeasuredSize = { widthMm: number; heightMm: number; depthMm: number };
type ShopSize = { widthMm: number | null; heightMm: number | null; depthMm: number | null; lengthMm: number | null };

/** World points are metres (the viewer scales every car to its real length): x across the car, y up, z along it. */
export function shapeSize(pts: number[][]): MeasuredSize | null {
  if (pts.length < 8) return null;
  const ext = (i: number) => Math.round((Math.max(...pts.map(p => p[i]!)) - Math.min(...pts.map(p => p[i]!))) * 1000);
  return { widthMm: ext(0), heightMm: ext(1), depthMm: ext(2) };
}

/** The car part whose measured size a shop part of this type must match (a lip / diffuser only takes a bumper's position, rims use inches). */
export const SIZE_LABEL: Partial<Record<AccessoryType, PartLabel>> = {
  FRONT_BUMPER: "FRONT_BUMPER", REAR_BUMPER: "REAR_BUMPER", SPOILER: "SPOILER", WING: "SPOILER", SIDE_SKIRTS: "SIDE_SKIRTS", MIRROR_COVERS: "MIRRORS", ROOF_RACK: "ROOF_RAILS",
};

/** Every dimension the shop gave that differs from the measured one by more than 15 %. */
export function sizeMismatches(type: AccessoryType, shop: ShopSize, m: MeasuredSize) {
  // a side skirt runs along the car: its length is the z extent and its depth the x extent
  const pairs: [keyof ShopSize, number][] = type === "SIDE_SKIRTS"
    ? [["lengthMm", m.depthMm], ["heightMm", m.heightMm], ["depthMm", m.widthMm]]
    : [["widthMm", m.widthMm], ["heightMm", m.heightMm], ["depthMm", m.depthMm], ["lengthMm", m.depthMm]];
  return pairs.flatMap(([k, measured]) => { const v = shop[k]; return v && measured && Math.abs(v - measured) / measured > 0.15 ? [{ field: k, shop: v, measured }] : []; });
}
