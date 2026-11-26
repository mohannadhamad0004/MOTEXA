// "Apply this correction to similar cars": which cars are offered (same 3D model, same make + model, same body type), the "To review" filter,
// one car saved for review (never approved; an approved fit only with the explicit reset), and the background correction job (> ~10 cars).
// Uses the published universal rim of the test copy; every fit row is restored afterwards, audit rows stay (append-only).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/prisma.js";
import { createAutoFitService, forgetFitRows, matchesFitFilter, parseFitFilter, similarCars, type FitRow } from "../src/services/accessory-autofit.js";
import { createFitJob, currentFitJob, jobPlan, processNextFitJob } from "../src/services/accessory-fit-jobs.js";

after(() => prisma.$disconnect());

const row = (id: string, o: Partial<FitRow>): FitRow => ({ generationId: id, make: "Toyota", makeAr: "تويوتا", model: "Corolla", modelAr: "كورولا", code: id, nameEn: id, nameAr: id,
  yearFrom: 2000, yearTo: 2005, model3dKey: `key-${id}`, photoUrl: null, bodyType: "sedan", status: "passed", reason: null, approvedAt: null, stamp: null, ...o });

test("similar cars: the same 3D model first, then the other generations of the same model, then the same body type; each car once", () => {
  const rows = [row("src", { model3dKey: "k1" }), row("twin", { model3dKey: "k1", make: "Lexus", model: "IS" }), row("e210", {}), row("camry", { model: "Camry" }),
    row("golf", { make: "VW", model: "Golf", bodyType: "hatchback" }), row("polo", { make: "VW", model: "Polo", bodyType: "sedan" })];
  const s = similarCars(rows, "src");
  assert.deepEqual(s.groups.model3d.map(r => r.generationId), ["twin"]);
  assert.deepEqual(s.groups.family.map(r => r.generationId), ["e210"]);
  assert.deepEqual(s.groups.body.map(r => r.generationId), ["camry", "polo"]);
  assert.equal(s.bodyType, "sedan");
  assert.ok(!("stamp" in s.groups.family[0]!), "public rows only");
  assert.deepEqual(similarCars([row("src", { bodyType: null }), row("x", { make: "VW", model: "Golf", bodyType: null })], "src").groups.body, [], "no body type, no body group");
  assert.throws(() => similarCars(rows, "nope"), { code: "NOT_A_TARGET" });
});

test('"To review" = passed + needs correction + manual correction; unknown statuses are refused', () => {
  const f = parseFitFilter({ status: "review" });
  const want = (status: FitRow["status"]) => matchesFitFilter(row("a", { status }), f);
  assert.deepEqual(["passed", "needs_correction", "has_correction", "failed", "approved", "not_computed"].map(s => want(s as FitRow["status"])), [true, true, true, false, false, false]);
  assert.throws(() => parseFitFilter({ status: "toString" }), { code: "INVALID_FILTER" });
});

test("a job's plan: plain ids, or ids + the correction", () => {
  assert.deepEqual(jobPlan(["a", "b"]), { ids: ["a", "b"], correction: null });
  const adj = { x: 0.005, y: 0, z: 0, rx: 0, ry: 0, s: 1 };
  assert.deepEqual(jobPlan({ ids: ["a"], correction: adj }), { ids: ["a"], correction: adj });
});

async function rim() {
  const a = await prisma.productAccessory3D.findFirst({ where: { status: "PUBLISHED", accessoryType: "RIMS", product: { isUniversal: true }, privateModelPath: { not: null } } });
  if (!a) return null;
  forgetFitRows(a.id);
  return { a, saved: await prisma.accessoryAutoFit.findMany({ where: { accessoryId: a.id } }) };
}
async function restore(accessoryId: string, saved: Awaited<ReturnType<typeof prisma.accessoryAutoFit.findMany>>) {
  await prisma.accessoryFitJob.deleteMany({ where: { accessoryId } });
  await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId } });
  for (const r of saved) await prisma.accessoryAutoFit.create({ data: { ...r, fit: r.fit as object, adj: (r.adj ?? undefined) as object | undefined } });
  forgetFitRows(accessoryId);
}
const admin = async () => (await prisma.user.findFirstOrThrow({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } })).id;

test("a correction saved on similar cars waits for review: never approved, an approved fit only with the reset, a failing car unchanged, as a job too", async () => {
  const r = await rim(); if (!r) return; // no published universal rim in this database
  const { a, saved } = r, uid = await admin();
  const adj = { x: 0, y: 0.005, z: 0, rx: 0, ry: 0, s: 1 };
  let bad = "";
  // the headless checker stand-in: the car's own stored fit, with the correction's verdict (fails on the car `bad`)
  const byKey = new Map(saved.map(x => [x.model3dKey, x.fit as Record<string, unknown>]));
  const compute = async (_t: string, _s: unknown, _f: string, key: string, baseAdj: unknown) => {
    const fit = byKey.get(key)!, info = (fit.info ?? {}) as Record<string, unknown>;
    return { ...fit, info: { ...info, qa: { ...(info.qa as object ?? {}), correction: { adj: baseAdj, clipMm: 1.2, gapMm: key === bad ? 14 : 2, ok: key !== bad, tier: key === bad ? "REFUSED" : "PERFECT" } } } };
  };
  const s = createAutoFitService({ compute: compute as never });
  // enough cars waiting for review: unapprove a few approved ones (restored at the end)
  const all = (await s.fitsFor(a.id)).cars, approvedIds = all.filter(c => c.status === "approved").map(c => c.generationId);
  if (approvedIds.length < 5) return;
  await prisma.accessoryAutoFit.updateMany({ where: { accessoryId: a.id, generationId: { in: approvedIds.slice(1, 5) } }, data: { approvedAt: null, approvedByUserId: null } });
  forgetFitRows(a.id);
  const cars = (await s.fitsFor(a.id)).cars, passed = cars.filter(c => c.status === "passed"), approved = cars.find(c => c.generationId === approvedIds[0]);
  assert.ok(passed.length >= 4 && approved?.status === "approved", "the test setup has 4 passed fits and 1 approved");
  const fitOf = (gid: string) => prisma.accessoryAutoFit.findUniqueOrThrow({ where: { accessoryId_generationId: { accessoryId: a.id, generationId: gid } } });
  try {
    const one = await s.suggest(uid, a.id, passed[0]!.generationId, { adj });
    assert.equal(one.saved, true); assert.equal(one.check.gapMm, 2);
    const f1 = await fitOf(passed[0]!.generationId);
    assert.deepEqual(f1.adj, adj); assert.equal(f1.approvedAt, null, "saved for review, never approved");
    forgetFitRows(a.id);
    assert.equal((await s.fitsFor(a.id)).cars.find(c => c.generationId === passed[0]!.generationId)?.status, "has_correction");
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "ACCESSORY3D_FIT_CORRECTION_SUGGESTED", targetId: a.id, actorId: uid } }));

    await assert.rejects(s.suggest(uid, a.id, approved.generationId, { adj }), { code: "FIT_APPROVED" }, "an approval is never reset without the confirmation");
    assert.ok((await fitOf(approved.generationId)).approvedAt);
    assert.equal((await s.suggest(uid, a.id, approved.generationId, { adj, resetApproval: true })).saved, true);
    assert.equal((await fitOf(approved.generationId)).approvedAt, null, "confirmed: the approval is reset, the correction waits for review");

    bad = passed[1]!.model3dKey;
    const before = await fitOf(passed[1]!.generationId);
    const no = await s.suggest(uid, a.id, passed[1]!.generationId, { adj });
    assert.equal(no.saved, false); assert.equal(no.check.ok, false);
    assert.deepEqual(await fitOf(passed[1]!.generationId), before, "a correction that fails the check changes nothing");
    await assert.rejects(s.suggest(uid, a.id, passed[2]!.generationId, { adj: { ...adj, s: 3 } }), { code: "INVALID_ADJUST" });

    // many cars: the background job carries the correction; the failing car is skipped, nothing is approved
    const { job } = await createFitJob(uid, a.id, { generationIds: [passed[1]!.generationId, passed[2]!.generationId, passed[3]!.generationId], correction: adj });
    assert.equal(job?.correction, true);
    await assert.rejects(s.suggest(uid, a.id, passed[2]!.generationId, { adj }), { code: "FIT_JOB_RUNNING" }, "the job owns the fits while it runs");
    assert.equal(await processNextFitJob({ compute: compute as never }), true);
    const end = (await currentFitJob(a.id)).job!;
    assert.deepEqual({ status: end.status, done: end.done, skipped: end.skipped, errors: end.errors }, { status: "DONE", done: 2, skipped: 1, errors: 0 });
    for (const gid of [passed[2]!.generationId, passed[3]!.generationId]) { const f = await fitOf(gid); assert.deepEqual(f.adj, adj); assert.equal(f.approvedAt, null); }
    assert.equal((await fitOf(passed[1]!.generationId)).adj, null, "the failing car keeps no correction");
  } finally { await restore(a.id, saved); }
});
