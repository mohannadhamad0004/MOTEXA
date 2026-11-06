// Part maps against the real database: strict validation, confirm / unconfirm (audited), and the app only ever gets a CONFIRMED map
// of the EXACT served file. Uses a throwaway row for a key with no file, plus a temporary copy of an active model's file.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/prisma.js";
import { REPO_ROOT } from "../src/services/vehicle3d-catalog.js";
import { confirmedPartMaps, createPartMapService, modelFileSha, parsePartMap } from "../src/services/car-part-map.js";

const KEY = "test-part-map-tmp", FILE = path.join(REPO_ROOT, "backend/public/3d", `${KEY}.glb`), SRC = path.join(REPO_ROOT, "backend/public/3d/peugeot-308-2nd-gen-t9.glb");
const pieces = [{ id: "m1c0", name: "body", mat: "paint", tris: 900, b: [0.15, 0.7, 0.01, 0.85, 0.8, 0.08] }, { id: "m1c1", name: "body", mat: "paint", tris: 900, b: [0, 0, 0, 1, 1, 1] }];
const service = createPartMapService();
const cleanup = async () => { rmSync(FILE, { force: true }); await prisma.carPartMap.deleteMany({ where: { model3dKey: KEY } }); await prisma.auditLog.deleteMany({ where: { targetId: KEY } }); };
after(async () => { await cleanup(); await prisma.$disconnect(); });

test("parsePartMap: known labels, existing pieces, one label per piece", () => {
  const ids = new Set(["m1c0", "m1c1"]);
  assert.deepEqual(parsePartMap({ SPOILER: ["m1c0", "m1c0"], WHEELS: [] }, ids), { SPOILER: ["m1c0"] });
  for (const bad of [{ WING: ["m1c0"] }, { SPOILER: ["m9c9"] }, { SPOILER: ["m1c0"], REAR_BUMPER: ["m1c0"] }, { SPOILER: "m1c0" }, [], null])
    assert.equal(parsePartMap(bad, ids), null, JSON.stringify(bad));
});

test("confirm only the file the pieces came from; the catalog gets the map only while that file is served", async () => {
  await cleanup(); copyFileSync(SRC, FILE);
  const sha = modelFileSha(KEY)!;
  await prisma.carPartMap.create({ data: { model3dKey: KEY, modelSha256: sha, pieces, dims: [1.8, 1.4, 4.5], proposal: { SPOILER: { ids: ["m1c0"], confidence: 0.6, by: "shape" } } } });
  const admin = null as unknown as string; // actor id is only recorded in the audit log
  await assert.rejects(service.confirm(admin, KEY, { modelSha256: "0".repeat(64), map: { SPOILER: ["m1c0"] } }), { code: "STALE_PART_MAP" });
  await assert.rejects(service.confirm(admin, KEY, { modelSha256: sha, map: { SPOILER: ["m7c7"] } }), { code: "INVALID_PART_MAP" });
  assert.equal((await confirmedPartMaps([KEY])).size, 0, "a proposal is never served");
  const r = await service.confirm(admin, KEY, { modelSha256: sha, map: { SPOILER: ["m1c0"] } });
  assert.equal(r.status, "confirmed");
  assert.deepEqual((await confirmedPartMaps([KEY])).get(KEY), { SPOILER: ["m1c0"] });
  assert.equal(await prisma.auditLog.count({ where: { targetId: KEY, action: "PART_MAP_CONFIRMED" } }), 1);
  // the served file changes (a new revision of the model): the old ids mean nothing, the app falls back to zones
  rmSync(FILE); copyFileSync(path.join(REPO_ROOT, "backend/public/3d/toyota-corolla-e170-e180.glb"), FILE);
  assert.equal((await confirmedPartMaps([KEY])).size, 0);
  assert.equal((await service.get(KEY).catch(e => e)).code, "NO_3D_CAR"); // not an active catalog key: the editor never shows it
  await assert.rejects(service.confirm(admin, KEY, { modelSha256: sha, map: { SPOILER: ["m1c0"] } }), { code: "STALE_PART_MAP" });
  // back to the original file: unconfirm returns the car to zones
  rmSync(FILE); copyFileSync(SRC, FILE);
  assert.equal((await confirmedPartMaps([KEY])).size, 1);
  assert.equal((await service.confirm(admin, KEY, { modelSha256: sha, map: null })).status, "proposed");
  assert.equal((await confirmedPartMaps([KEY])).size, 0);
});
