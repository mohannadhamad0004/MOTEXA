// Stored accessory auto-fits against the real database: strict shapes, computed once (a current fit is never replaced), the Parts
// Admin's correction / reset, a stale fit (other viewer version) is not served to customers. Uses the published E36 wing's row and
// restores it afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/prisma.js";
import { autoFitAccessory, createAutoFitService, fitStatus, fitVersion, parseAdj, revisionOf, saveFit, validFit } from "../src/services/accessory-autofit.js";
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
  const a = await prisma.productAccessory3D.findFirst({ where: { status: "PUBLISHED", accessoryType: "WING", fits: { some: { generation: { model3dKey: "bmw-3-series-e36" } } } }, include: { fits: { include: { generation: true } } } });
  const g = a?.fits.find(f => f.generation.model3dKey === "bmw-3-series-e36");
  if (!a || !g) return; // no published E36 accessory in this database
  const key = "bmw-3-series-e36", id = { accessoryId_generationId: { accessoryId: a.id, generationId: g.generationId } };
  const saved = await prisma.accessoryAutoFit.findUnique({ where: id });
  try {
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    const first = await saveFit(a, g.generationId, key, fit());
    const second = await saveFit(a, g.generationId, key, { ...fit(), placements: [{ pos: [9, 9, 9], sc: [1, 1, 1], rot: [0, 0, 0], side: 1 }] });
    assert.deepEqual(second.fit, first.fit, "a current fit is never recomputed / replaced");
    const s = createAutoFitService({compute:async()=>({...fit(),info:{qa:{correction:{ok:true}}}})});
    await assert.rejects(s.approve("admin", a.id, g.generationId, { adj: { x: 2, y: 0, z: 0, rx: 0, ry: 0, s: 1 } }), { code: "INVALID_ADJUST" });
    const ok = await s.approve("admin", a.id, g.generationId, { adj: { x: 0, y: 0.01, z: -0.02, rx: 0, ry: 0, s: 1 } });
    assert.ok(ok.approvedAt); assert.deepEqual(ok.adj, { x: 0, y: 0.01, z: -0.02, rx: 0, ry: 0, s: 1 });
    let view = await createAccessory3DService().forProduct(a.productId, g.generationId);
    assert.deepEqual(view?.autoFit, { fit: first.fit, adj: ok.adj });
    assert.equal((await s.approve("admin", a.id, g.generationId, { adj: null })).adj, null, "reset to auto-fit");
    assert.equal((await createAccessory3DService().forProduct(a.productId, null))?.autoFit, null, "no generation, no stored fit");
    // a part that does not fit this car is stored as a failure (computed once) and never served as a fit
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    const failed = { version: fitVersion(a.accessoryType), type: a.accessoryType, failed: "this part does not fit this car cleanly (contact gap 20.7 mm)" };
    assert.ok(validFit(failed)); assert.equal(validFit({ ...failed, failed: "x".repeat(600) }), false);
    await saveFit(a, g.generationId, key, failed);
    assert.equal((await createAccessory3DService().forProduct(a.productId, g.generationId))?.autoFit, null);
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } }); await saveFit(a, g.generationId, key, fit());
    // a fit from another viewer version is stale: not served, recomputed in the background
    await prisma.accessoryAutoFit.update({ where: id, data: { fitVersion: -1 } });
    view = await createAccessory3DService().forProduct(a.productId, g.generationId); assert.equal(view?.autoFit, null);
    await assert.rejects(s.approve("admin", a.id, g.generationId, {}), { code: "FIT_NOT_READY" });
  } finally {
    // the stale fit started a real background recompute: let it finish, or it writes after this cleanup and blocks the next test
    await autoFitAccessory(a.id);
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
  const saved = await prisma.accessoryAutoFit.findUnique({ where: id }), s = createAutoFitService({compute:async()=>({...fit(),info:{qa:{correction:{ok:true}}}})});
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

test("bulk review: the review state of a fit (passed / failed / approved / not computed / needs correction) is decided by the automatic check", () => {
  const ok = { fit: { info: { qa: { ok: true } } }, approvedAt: null };
  assert.equal(fitStatus({ row: null, isCurrent: false }).status, "not_computed");
  assert.equal(fitStatus({ row: ok, isCurrent: false }).status, "not_computed", "a stale fit is not computed");
  assert.deepEqual(fitStatus({ row: ok, isCurrent: true, blockedCode: "PART_MAP_STALE" }), { status: "not_computed", reason: "PART_MAP_STALE" });
  assert.equal(fitStatus({ row: ok, isCurrent: true }).status, "passed");
  assert.equal(fitStatus({ row: { fit: { failed: "gap 60 mm" }, approvedAt: null }, isCurrent: true }).status, "failed");
  assert.equal(fitStatus({ row: { fit: { info: { qa: { ok: false } } }, approvedAt: null }, isCurrent: true }).status, "failed", "check not passed = not selectable");
  assert.equal(fitStatus({ row: { fit: { info: {} }, approvedAt: null }, isCurrent: true }).status, "failed", "no check result = not selectable");
  assert.equal(fitStatus({ row: { ...ok, approvedAt: new Date() }, isCurrent: true }).status, "approved");
  assert.equal(fitStatus({ row: { fit: { needsCorrection: true, info: { qa: { ok: true } } }, approvedAt: null }, isCurrent: true }).status, "needs_correction", "a human flag is never bulk-approved over");
  const adj = { x: 0, y: 0.01, z: 0, rx: 0, ry: 0, s: 1 };
  assert.deepEqual(fitStatus({ row: { ...ok, adj }, isCurrent: true }), { status: "has_correction", reason: "HAS_CORRECTION" }, "a stored manual correction is never bulk-approved (nor dropped)");
  assert.equal(fitStatus({ row: { ...ok, adj: null }, isCurrent: true }).status, "passed");
  assert.equal(fitStatus({ row: { ...ok, adj, approvedAt: new Date() }, isCurrent: true }).status, "approved", "an approved correction can still be bulk-unapproved");
});

test("bulk review: approve takes only passed fits, unapprove only approved ones, every step is audited, customers see approved fits only", async () => {
  const a = await prisma.productAccessory3D.findFirst({ where: { status: "PUBLISHED", accessoryType: "WING", fits: { some: { generation: { model3dKey: "bmw-3-series-e36" } } } }, include: { fits: { include: { generation: true } } } });
  const g = a?.fits.find(f => f.generation.model3dKey === "bmw-3-series-e36");
  if (!a || !g) return; // no published E36 accessory in this database
  const key = "bmw-3-series-e36", id = { accessoryId_generationId: { accessoryId: a.id, generationId: g.generationId } };
  const saved = await prisma.accessoryAutoFit.findUnique({ where: id });
  const auditBefore = await prisma.auditLog.count({ where: { targetId: a.id, action: { startsWith: "ACCESSORY3D_FIT" } } });
  const uid = (await prisma.user.findFirstOrThrow({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } })).id;
  try {
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    const s = createAutoFitService();
    // computed, passed the check, not approved
    await saveFit(a, g.generationId, key, { ...fit(), info: { feetGapMm: [0, 0.4], qa: { ok: true } } });
    let state = await s.fitsFor(a.id);
    assert.equal(state.cars.find(c => c.generationId === g.generationId)?.status, "passed");
    await assert.rejects(s.bulk(uid, a.id, "nonsense", [g.generationId]), { code: "INVALID_ACTION" });
    await assert.rejects(s.bulk(uid, a.id, "approve", []), { code: "INVALID_SELECTION" });
    // unapprove on a not-approved fit: skipped, nothing changes
    let r = await s.bulk(uid, a.id, "unapprove", [g.generationId]);
    assert.equal(r.done.length, 0); assert.equal(r.skipped[0]?.code, "FIT_NOT_APPROVED");
    // approve (+ an unknown car is skipped, a duplicate id counts once)
    r = await s.bulk(uid, a.id, "approve", [g.generationId, g.generationId, "00000000-0000-0000-0000-000000000000"]);
    assert.deepEqual(r.done.map(d => d.generationId), [g.generationId]); assert.equal(r.skipped[0]?.code, "NOT_A_TARGET");
    assert.ok((await prisma.accessoryAutoFit.findUniqueOrThrow({ where: id })).approvedAt, "approved");
    assert.equal((await createAccessory3DService().forProduct(a.productId, g.generationId))?.autoFit?.adj, null, "customers now get the approved fit");
    // approving again: skipped (not selectable any more)
    r = await s.bulk(uid, a.id, "approve", [g.generationId]);
    assert.equal(r.done.length, 0); assert.equal(r.skipped[0]?.code, "ALREADY_APPROVED");
    // a failed fit can never be bulk-approved, even when the client sends it
    await prisma.accessoryAutoFit.update({ where: id, data: { approvedAt: null, approvedByUserId: null, fit: { version: fitVersion("WING"), type: "WING", failed: "gap 60 mm" } } });
    r = await s.bulk(uid, a.id, "approve", [g.generationId]);
    assert.equal(r.done.length, 0); assert.equal(r.skipped[0]?.code, "FIT_FAILED");
    // a stored manual correction: not selectable, the bulk approve skips it and the correction stays exactly as it was
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    await saveFit(a, g.generationId, key, { ...fit(), info: { feetGapMm: [0, 0.4], qa: { ok: true } } });
    const corr = { x: 0, y: 0.01, z: -0.02, rx: 0, ry: 0, s: 1 };
    await prisma.accessoryAutoFit.update({ where: id, data: { adj: corr } });
    assert.equal((await s.fitsFor(a.id)).cars.find(c => c.generationId === g.generationId)?.status, "has_correction");
    r = await s.bulk(uid, a.id, "approve", [g.generationId]);
    assert.equal(r.done.length, 0); assert.equal(r.skipped[0]?.code, "HAS_CORRECTION");
    const kept = await prisma.accessoryAutoFit.findUniqueOrThrow({ where: id });
    assert.equal(kept.approvedAt, null); assert.deepEqual(kept.adj, corr, "the correction is kept, not dropped");
    // unapprove (a current fit is never replaced by saveFit: start from a clean row)
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    await saveFit(a, g.generationId, key, { ...fit(), info: { feetGapMm: [0, 0.4], qa: { ok: true } } });
    await s.bulk(uid, a.id, "approve", [g.generationId]);
    r = await s.bulk(uid, a.id, "unapprove", [g.generationId]);
    assert.deepEqual(r.done.map(d => d.generationId), [g.generationId]);
    assert.equal((await prisma.accessoryAutoFit.findUniqueOrThrow({ where: id })).approvedAt, null);
    assert.equal((await createAccessory3DService().forProduct(a.productId, g.generationId))?.autoFit, null, "customers see approved fits only");
    // audit: one row per car + one summary row (who, how many, which cars)
    const rows = await prisma.auditLog.findMany({ where: { targetId: a.id, action: { startsWith: "ACCESSORY3D_FIT" } }, orderBy: { createdAt: "asc" } });
    assert.ok(rows.length > auditBefore);
    const summary = rows.filter(x => x.action === "ACCESSORY3D_FITS_BULK_APPROVED" || x.action === "ACCESSORY3D_FITS_BULK_UNAPPROVED");
    assert.ok(summary.length >= 2);
    const last = summary[summary.length - 1]!;
    assert.equal(last.actorId, uid);
    const d = last.details as { count: number; cars: string[]; generationIds: string[] };
    assert.equal(d.count, 1); assert.deepEqual(d.generationIds, [g.generationId]); assert.equal(d.cars.length, 1);
    assert.ok(rows.some(x => x.action === "ACCESSORY3D_FIT_UNAPPROVED" && x.actorId === uid), "the single unapprove audit row");
  } finally {
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: g.generationId } });
    if (saved) await prisma.accessoryAutoFit.create({ data: { ...saved, fit: saved.fit as object, adj: (saved.adj ?? undefined) as object | undefined } });
  }
});
