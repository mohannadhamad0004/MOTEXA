// Rims without a confirmed part map: the stored automatic proposal is only a seed that locates each wheel (the viewer takes the rest
// itself), so the catalog carries at most RIM_SEED_PIECES ids per corner; stored rim fits are replayed into the viewer, so their runtime
// part (wheels, kept tyre pieces, hidden brake pieces, moves) has a strict shape. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RIM_SEED_PIECES, rimSeed } from "../src/services/car-part-map.js";
import { fitVersion, validFit } from "../src/services/accessory-autofit.js";

test("proposal seed: the biggest pieces per corner, every corner kept, deterministic", () => {
  const corner = (x: number, z: number) => [x, 0, z, x + 0.1, 0.4, z + 0.1];
  const pieces = [[0.05, 0.1], [0.85, 0.1], [0.05, 0.8], [0.85, 0.8]].flatMap(([x, z], c) =>
    Array.from({ length: 3000 }, (_, i) => ({ id: `m${c}c${i}`, name: "tyre", mat: "rubber", tris: (i * 37) % 1000, b: corner(x!, z!) })));
  const seed = rimSeed(pieces.map(p => p.id), pieces);
  assert.equal(seed.length, 4 * RIM_SEED_PIECES);
  for (let c = 0; c < 4; c++) {
    const mine = seed.filter(id => id.startsWith(`m${c}c`)), min = Math.min(...mine.map(id => pieces.find(p => p.id === id)!.tris));
    assert.equal(mine.length, RIM_SEED_PIECES); assert.ok(min >= 960, "only the biggest pieces of the corner");
  }
  assert.deepEqual(rimSeed(pieces.map(p => p.id).reverse(), pieces), seed, "same proposal, same seed");
  assert.deepEqual(rimSeed(["m0c1", "nope"], pieces), ["m0c1"], "unknown ids dropped");
});

test("stored rim fit: the runtime part is checked before it is replayed", () => {
  const base = { version: fitVersion("RIMS"), type: "RIMS", orient: ["axle", 0, "mid"], shadows: [], tyres: [], hideMore: ["mesh_BrakeDiskFR_mat_brakes_0"],
    placements: [{ pos: [-0.8, 0.33, 1.5], sc: [0.1, 0.1, 0.1], rot: [0, 3.14, 0], side: -1 }],
    rimRuntime: { active: ["FL"], kept: ["rimPiece_3_2t"], hideBrakes: ["rimPiece_9_2r"], offsets: [{ wheel: "FL", delta: [-0.02, 0, 0] }] }, info: {} };
  assert.equal(validFit(base), true);
  const bad = (patch: Record<string, unknown>) => validFit({ ...base, rimRuntime: { ...base.rimRuntime, ...patch } });
  assert.equal(bad({ offsets: [{ wheel: "FL", delta: [-0.2, 0, 0] }] }), false, "a move over 5 cm");
  assert.equal(bad({ active: ["FL", "FR", "RL", "RR", "XX"] }), false, "more than four wheels");
  assert.equal(bad({ kept: [{ evil: true }] }), false, "not a piece id");
  assert.equal(bad({ hideBrakes: "all" }), false);
  assert.equal(validFit({ ...base, hideMore: [42] }), false);
  assert.equal(validFit({ ...base, version: base.version - 1 }), false, "an older rims fitter version is stale");
});
