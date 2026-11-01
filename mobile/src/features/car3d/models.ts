// The real 3D car models we have, and how each one is set up. A car without an entry here shows "3D for <car> is coming soon".
// Files live in backend/public/3d (optimised from the originals in the git-ignored 3d-source/, see docs/3d/CREDITS.md) and are
// downloaded once by the app (car3d.ts). Adding a car = optimise its GLB into backend/public/3d and add an entry.
import type { Car } from "../catalog/myCar";

export type Offset = { x: number; y: number; z: number; scale: number };

export type CarModel = {
  make: string;
  model: string;
  years: [number, number];
  /** file name in backend/public/3d, served at /api/3d/<file> */
  file: string;
  /** scaled so the car is this long (metres) */
  lengthM: number;
  /** turn (radians, about Y) that makes the front face +Z */
  rotateY: number;
  /** extra lift after the wheels are put on the ground (metres) */
  groundOffset: number;
  /** nodes whose meshes are the painted body; ONLY their meshes get the customer's colour (a clone of the material) */
  paintNodes: string[];
  /** materials on those nodes that are paint */
  paintMaterials: string[];
  /** false: the wheels are one combined mesh, so no rim choice */
  rimsSwappable: boolean;
  /** per-model nudges for the computed wing / roof-rack anchors (metres, after scaling) */
  wing: Offset;
  rack: Offset;
  credit: { title: string; author: string; url: string; license: string };
};

const NONE: Offset = { x: 0, y: 0, z: 0, scale: 1 };

export const CAR_MODELS: CarModel[] = [
  {
    make: "Toyota",
    model: "Corolla",
    years: [2013, 2019],
    file: "toyota-corolla-2014.glb",
    lengthM: 4.6,
    rotateY: 0, // the front plate (Cube.002) sits at +Z already
    groundOffset: 0,
    paintNodes: ["corolla_e180_body"],
    paintMaterials: ["main_paint", "main_paint.001"],
    rimsSwappable: false,
    wing: NONE,
    rack: NONE,
    credit: { title: "2014 Toyota Corolla E180 EU (with interior)", author: "Armored Wave", url: "https://sketchfab.com/3d-models/2014-toyota-corolla-e180-eu-with-interior-36f95efb0585464cae43a25a3b3392e8", license: "CC BY 4.0" },
  },
];

const norm = (v: string) => v.trim().toLowerCase();
/** The real model for this car (make, model and year must match), or null = coming soon. */
export function modelFor(car: Pick<Car, "make" | "model" | "year"> | null): CarModel | null {
  if (!car) return null;
  const y = Number(car.year);
  return CAR_MODELS.find((m) => norm(m.make) === norm(car.make) && norm(m.model) === norm(car.model) && y >= m.years[0] && y <= m.years[1]) ?? null;
}
