// The accessory quality gate of a car model (car-part-map accessoryGate), from a segmentation only: realistic size, four wheels on the
// ground, which stock parts the automatic map can split off. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { accessoryGate, segmentFile } from "../src/services/car-part-map.js";
import { activeModels, REPO_ROOT } from "../src/services/vehicle3d-catalog.js";

// a 4.5 x 1.8 x 1.4 m car: pieces as fractions of its box [x0, y0, z0, x1, y1, z1]
const wheel = (left: boolean, front: boolean, lift = 0) => ({ id: `m${left ? 0 : 1}${front ? 1 : 0}c0`, name: "tyre", mat: "rubber", tris: 800,
  b: [left ? 0.02 : 0.86, lift, front ? 0.72 : 0.12, left ? 0.14 : 0.98, lift + 0.47, front ? 0.86 : 0.26] });
const body = { id: "m9c0", name: "body", mat: "paint", tris: 20000, b: [0, 0.1, 0, 1, 1, 1] };
const wheels = [wheel(true, true), wheel(false, true), wheel(true, false), wheel(false, false)];
const all = { WHEELS: { ids: wheels.map(w => w.id), confidence: 0.9, by: "shape" }, FRONT_BUMPER: { ids: ["m5c0"], confidence: 0.6, by: "shape" },
  REAR_BUMPER: { ids: ["m6c0"], confidence: 0.6, by: "shape" }, MIRRORS: { ids: ["m7c0"], confidence: 0.6, by: "shape" } };
const pieces = [body, ...wheels, ...["m5c0", "m6c0", "m7c0"].map(id => ({ id, name: "x", mat: "paint", tris: 500, b: [0.2, 0.1, 0.9, 0.8, 0.3, 1] }))];

test("a normal car with every part splittable: full accessories", () => {
  const g = accessoryGate(pieces, [1.8, 1.4, 4.5], all);
  assert.equal(g.verdict, "FULL", JSON.stringify(g)); assert.deepEqual(g.problems, []);
});

test("bumper / mirrors not separate: limited, each type with its reason", () => {
  const g = accessoryGate(pieces, [1.8, 1.4, 4.5], { WHEELS: all.WHEELS });
  assert.equal(g.verdict, "LIMITED");
  assert.deepEqual(g.limited, { FRONT_BUMPER: "NOT_SEPARATE", REAR_BUMPER: "NOT_SEPARATE", MIRROR_COVERS: "NOT_SEPARATE" });
  assert.ok(g.text.some(t => t.startsWith("FRONT_BUMPER: not a separate piece")));
});

test("wheels not found: no rims, no skirts", () => {
  const parts = [body, ...[1, 2, 3, 4, 5].map(i => ({ ...body, id: `m9c${i}`, tris: 9000 }))]; // several pieces, but no wheels among them
  const g = accessoryGate(parts, [1.8, 1.4, 4.5], { ...all, WHEELS: undefined });
  assert.equal(g.limited.RIMS, "WHEELS_NOT_FOUND"); assert.equal(g.limited.SIDE_SKIRTS, "NEEDS_WHEELS");
});

test("rejected: wrong size, toy-sized wheels, wheels in the air, one-piece scans are limited", () => {
  assert.deepEqual(accessoryGate(pieces, [1.8, 1.4, 45], all).problems.map(p => p.code), ["LENGTH", "SHAPE", "WHEEL_SIZE"]);
  assert.equal(accessoryGate(pieces, [0.18, 0.14, 0.45], all).verdict, "REJECTED");
  // the car stands on its real lowest point: a piece hanging 140 mm below the tyres = rejected, 56 mm = a warning only, none = fine
  const low = (y: number) => ({ ...body, b: [0, y, 0, 1, 1, 1] }), lifted = wheels.map(w => ({ ...w, b: [w.b[0]!, 0.1, w.b[2]!, w.b[3]!, 0.57, w.b[5]!] }));
  const air = accessoryGate([low(0), ...lifted, ...pieces.slice(5)], [1.8, 1.4, 4.5], all);
  assert.equal(air.verdict, "REJECTED"); assert.deepEqual(air.problems, [{ code: "WHEELS_IN_AIR", value: 140 }]);
  const near = accessoryGate([low(0.06), ...lifted, ...pieces.slice(5)], [1.8, 1.4, 4.5], all);
  assert.equal(near.verdict, "FULL"); assert.deepEqual(near.warnings, [{ code: "WHEELS_IN_AIR", value: 56 }]); assert.ok(near.text.some(t => t.startsWith("warning: ")));
  assert.deepEqual(accessoryGate([low(0.1), ...lifted, ...pieces.slice(5)], [1.8, 1.4, 4.5], all).problems, []); // the tyres are the lowest point: it stands on them
  const scan = accessoryGate([{ ...body, tris: 1e6 }, ...wheels], [1.8, 1.4, 4.5], all);
  assert.equal(scan.verdict, "LIMITED"); assert.equal(scan.limited.FRONT_BUMPER, "SINGLE_PIECE");
});

test("the import path: a model FILE is split in the real viewer and graded before it is published (here the E36's own file)", { skip: !existsSync(resolve(REPO_ROOT, ".private/three-r160/package")) && "local Three.js missing" }, async () => {
  const m = activeModels().find(x => x.key === "bmw-3-series-e36"); if (!m) return;
  const seg = await segmentFile(resolve(REPO_ROOT, "backend/public/3d/bmw-3-series-e36.glb"), { ...m, key: "manual-gate-test" });
  const g = accessoryGate(seg.pieces, seg.dims, seg.proposal);
  assert.equal(g.verdict, "FULL", JSON.stringify(g)); assert.equal((g.checks.wheels as unknown[]).length, 4);
});
