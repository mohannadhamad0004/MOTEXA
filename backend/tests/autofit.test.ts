// Stored accessory auto-fits against the real database: strict shapes, computed once (a current fit is never replaced), the Parts
// Admin's correction / reset, a stale fit (other viewer version) is not served to customers. Uses the published E36 wing's row and
// restores it afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/prisma.js";
import { createAutoFitService, fitVersion, parseAdj, revisionOf, saveFit, validFit } from "../src/services/accessory-autofit.js";
import { createAccessory3DService } from "../src/services/accessory3d.js";

after(() => prisma.$disconnect());
const fit = (v = fitVersion("WING")) => ({ version: v, type: "WING", orient: ["x", 0, "bottom"], placements: [{ pos: [0, 1, -2], sc: [0.6, 0.6, 0.6], rot: [-0.08, 0, 0], side: 1 }],
  shadows: [{ x: -0.9, y: 0, z: 0.1, w: 0.05, d: 0.4 }], info: { feetGapMm: [0, 0.4] } });

test("shapes: fits and admin corrections are exact", () => {
  assert.ok(validFit(fit()));
  for (const bad of [{ ...fit(), version: -1 }, { ...fit(), placements: [] }, { ...fit(), placements: [{ pos: [0, 1], sc: [1, 1, 1], rot: [0, 0, 0], side: 1 }] },
    { ...fit(), placements: [{ pos: [0, 1e9, 0], sc: [1, 1, 1], rot: [0, 0, 0], side: 1 }] }, { ...fit(), shadows: [{ x: "1" }] }, { ...fit(), info: { pad: "x".repeat(30_000) } }, null])
    assert.equal(validFit(bad), false, JSON.stringify(bad)?.slice(0, 80));
  assert.deepEqual(parseAdj({ x: 0.1, y: 0, z: 0, rx: 0, ry: 0, s: 1 }), { x: 0.1, y: 0, z: 0, rx: 0, ry: 0, s: 1 });
  for (const bad of [{ x: 0.6, y: 0, z: 0, rx: 0, ry: 0, s: 1 }, { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 2 }, { x: "0" }, null]) assert.equal(parseAdj(bad), null);
});

test("fit versions are per fitter group: one group's bump leaves the others alone", () => {
  assert.equal(fitVersion("SPOILER"), fitVersion("WING")); assert.equal(fitVersion("ROOF_RACK"), fitVersion("WING"));
  assert.equal(fitVersion("REAR_BUMPER"), fitVersion("FRONT_BUMPER")); assert.equal(fitVersion("FRONT_LIP"), fitVersion("MIRROR_COVERS"));
  assert.ok(["RIMS", "WING", "FRONT_BUMPER", "SIDE_SKIRTS"].every(t => fitVersion(t) > 0));
  const rim = { version: fitVersion("RIMS"), type: "RIMS", failed: "no wheels" };
  assert.ok(validFit(rim)); assert.equal(validFit({ ...rim, type: "WING" }), fitVersion("WING") === fitVersion("RIMS"), "a fit is checked against its own type's version");
});

test("a car's RIMS zone (wheel inset) only changes the car revision seen by rim fits", () => {
  const base = { key: "k", zones: { WING: { box: { x: [0, 1], y: [0, 1], z: [0, 0.1] } } } }, inset = { ...base, zones: { ...base.zones, RIMS: { wheelInsetMm: { front: 16, rear: 29 } } } };
  for (const t of ["WING", "FRONT_BUMPER", "SIDE_SKIRTS"]) assert.equal(revisionOf("sha", inset, t), revisionOf("sha", base, t), t);
  assert.notEqual(revisionOf("sha", inset, "RIMS"), revisionOf("sha", base, "RIMS"));
  assert.ok(validFit({ version: fitVersion("RIMS"), type: "RIMS", orient: ["axle", 0, "mid"], placements: [{ pos: [0, 0.3, 1], sc: [1, 1, 1], rot: [0, 0, 0], side: 1 }], shadows: [], shift: [["tyre", -0.016]] }));
  assert.equal(validFit({ version: fitVersion("RIMS"), type: "RIMS", orient: ["axle", 0, "mid"], placements: [{ pos: [0, 0.3, 1], sc: [1, 1, 1], rot: [0, 0, 0], side: 1 }], shadows: [], shift: [["tyre", 0.5]] }), false, "at most 5 cm");
});

test("computed once; admin correction and reset; customers only get a current fit", async () => {
  const a = await prisma.productAccessory3D.findFirst({ where: { status: "PUBLISHED", accessoryType: { not: "RIMS" }, fits: { some: { generation: { model3dKey: "bmw-3-series-e36" } } } }, include: { fits: { include: { generation: true } } } });
  const g = a?.fits.find(f => f.generation.model3dKey === "bmw-3-series-e36");
  if (!a || !g) return; // no published E36 accessory in this database
  const key = "bmw-3-series-e36", id = { accessoryId_generationId: { accessoryId: a.id, generationId: g.generationId } };
  const saved = await prisma.accessoryAutoFit.findUnique({ where: id });
  try {
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    const first = await saveFit(a, g.generationId, key, fit());
    const second = await saveFit(a, g.generationId, key, { ...fit(), placements: [{ pos: [9, 9, 9], sc: [1, 1, 1], rot: [0, 0, 0], side: 1 }] });
    assert.deepEqual(second.fit, first.fit, "a current fit is never recomputed / replaced");
    const s = createAutoFitService();
    await assert.rejects(s.approve("admin", a.id, g.generationId, { adj: { x: 2, y: 0, z: 0, rx: 0, ry: 0, s: 1 } }), { code: "INVALID_ADJUST" });
    const ok = await s.approve("admin", a.id, g.generationId, { adj: { x: 0, y: 0.01, z: -0.02, rx: 0, ry: 0, s: 1 } });
    assert.ok(ok.approvedAt); assert.deepEqual(ok.adj, { x: 0, y: 0.01, z: -0.02, rx: 0, ry: 0, s: 1 });
    let view = await createAccessory3DService().forProduct(a.productId, g.generationId);
    assert.deepEqual(view?.autoFit, { fit: first.fit, adj: ok.adj });
    assert.equal((await s.approve("admin", a.id, g.generationId, { adj: null })).adj, null, "reset to auto-fit");
    assert.equal((await createAccessory3DService().forProduct(a.productId, null))?.autoFit, null, "no generation, no stored fit");
    // a part that does not fit this car is stored as a failure (computed once) and never served as a fit
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    const failed = { version: fitVersion("FRONT_BUMPER"), type: "FRONT_BUMPER", failed: "this bumper does not fit this car cleanly (fendersArches gap 20.7 mm)" };
    assert.ok(validFit(failed)); assert.equal(validFit({ ...failed, failed: "x".repeat(600) }), false);
    await saveFit(a, g.generationId, key, failed);
    assert.equal((await createAccessory3DService().forProduct(a.productId, g.generationId))?.autoFit, null);
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } }); await saveFit(a, g.generationId, key, fit());
    // a fit from another viewer version is stale: not served, recomputed in the background
    await prisma.accessoryAutoFit.update({ where: id, data: { fitVersion: -1 } });
    view = await createAccessory3DService().forProduct(a.productId, g.generationId); assert.equal(view?.autoFit, null);
    await assert.rejects(s.approve("admin", a.id, g.generationId, {}), { code: "FIT_NOT_READY" });
  } finally {
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    if (saved) await prisma.accessoryAutoFit.create({ data: { ...saved, fit: saved.fit as object, adj: saved.adj === null ? undefined : saved.adj as object } });
    await prisma.auditLog.deleteMany({ where: { actorId: "admin", action: "ACCESSORY3D_FIT_APPROVED" } });
  }
});

test("after a fit-version bump an approved correction is re-checked: kept when it passes, recorded (not silently dropped) when it fails", async () => {
  const a = await prisma.productAccessory3D.findFirst({ where: { status: "PUBLISHED", accessoryType: "WING", fits: { some: { generation: { model3dKey: "bmw-3-series-e36" } } } }, include: { fits: { include: { generation: true } } } });
  const g = a?.fits.find(f => f.generation.model3dKey === "bmw-3-series-e36");
  if (!a || !g) return; // no published E36 wing in this database
  const key = "bmw-3-series-e36", id = { accessoryId_generationId: { accessoryId: a.id, generationId: g.generationId } }, adj = { x: 0, y: 0.004, z: 0, rx: 0, ry: 0, s: 1 };
  const saved = await prisma.accessoryAutoFit.findUnique({ where: id }), s = createAutoFitService();
  const recomputed = (ok: boolean) => ({ ...fit(), info: { qa: { clipMm: 0, gapMm: 1, ok: true, correction: { adj, clipMm: ok ? 0 : 6.5, gapMm: 1, ok } } } });
  const approveThenAge = async () => { await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } }); await saveFit(a, g.generationId, key, fit());
    await s.approve("admin", a.id, g.generationId, { adj }); await prisma.accessoryAutoFit.update({ where: id, data: { fitVersion: fitVersion("WING") - 1 } }); };
  try {
    await approveThenAge();
    const kept = await saveFit(a, g.generationId, key, recomputed(true));
    assert.deepEqual(kept.adj, adj); assert.ok(kept.approvedAt, "still passes: stays approved"); assert.equal(kept.fitVersion, fitVersion("WING"));
    await approveThenAge();
    const since = new Date(), dropped = await saveFit(a, g.generationId, key, recomputed(false));
    assert.equal(dropped.adj, null, "a failing correction is never served"); assert.equal(dropped.approvedAt, null, "back to review");
    const prev = (dropped.fit as { previousCorrection?: Record<string, unknown> }).previousCorrection;
    assert.deepEqual({ adj: prev?.adj, result: prev?.result, clipMm: prev?.clipMm, ok: prev?.ok }, { adj, result: "fails", clipMm: 6.5, ok: false }, "kept on record with its numbers");
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "ACCESSORY3D_FIT_CORRECTION_FAILED", targetId: a.id, createdAt: { gte: since } } }), "audited");
  } finally {
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    if (saved) await prisma.accessoryAutoFit.create({ data: { ...saved, fit: saved.fit as never, adj: (saved.adj ?? undefined) as never } });
  }
});
