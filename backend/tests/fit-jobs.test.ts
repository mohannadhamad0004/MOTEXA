// The bulk fits screen on the real (test) database: approve by filter takes only passed fits and counts what it skipped, "Run auto-fit"
// jobs (approved skipped by default, explicit + confirmed reset, one per accessory, resume after a lost lease, cancel, a broken checker
// stops), and 5,000 cars (paged list + approve-by-filter). Uses the published universal rim; every fit row is restored afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/prisma.js";
import { createAutoFitService, forgetFitRows } from "../src/services/accessory-autofit.js";
import { cancelFitJob, createFitJob, currentFitJob, fitJobView, processNextFitJob } from "../src/services/accessory-fit-jobs.js";

after(() => prisma.$disconnect());
const s = createAutoFitService();

async function rim() {
  const a = await prisma.productAccessory3D.findFirst({ where: { status: "PUBLISHED", accessoryType: "RIMS", product: { isUniversal: true }, privateModelPath: { not: null } } });
  if (!a) return null;
  forgetFitRows(a.id);
  const state = await s.fitsFor(a.id);
  return { a, cars: state.cars, saved: await prisma.accessoryAutoFit.findMany({ where: { accessoryId: a.id } }) };
}
async function restore(accessoryId: string, saved: Awaited<ReturnType<typeof prisma.accessoryAutoFit.findMany>>) {
  await prisma.accessoryFitJob.deleteMany({ where: { accessoryId } });
  await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId } });
  for (const r of saved) await prisma.accessoryAutoFit.create({ data: { ...r, fit: r.fit as object, adj: (r.adj ?? undefined) as object | undefined } });
  forgetFitRows(accessoryId);
}
const admin = async () => (await prisma.user.findFirstOrThrow({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } })).id;
const stored = (saved: { generationId: string; fit: unknown }[], id: string) => saved.find(r => r.generationId === id)!.fit;

test("the job's estimate: average time of the cars fitted so far x the cars left; none before the first one", () => {
  const base = { id: "j", accessoryId: "a", createdById: "u", targets: [], includeApproved: false, error: null, leaseToken: null, leaseUntil: null, createdAt: new Date(), startedAt: new Date(), finishedAt: null, updatedAt: new Date() };
  assert.equal(fitJobView({ ...base, status: "RUNNING", total: 100, position: 0, done: 0, skipped: 0, errors: 0, workMs: 0 }).etaSeconds, null);
  assert.equal(fitJobView({ ...base, status: "RUNNING", total: 100, position: 10, done: 8, skipped: 2, errors: 0, workMs: 80_000 }).etaSeconds, 900, "10 s per fitted car x 90 left");
  assert.equal(fitJobView({ ...base, status: "DONE", total: 100, position: 100, done: 100, skipped: 0, errors: 0, workMs: 1_000_000 }).etaSeconds, null);
});

test("approve by filter: only passed fits are approved (in one go, re-checked on the server), every other state is counted as skipped", async () => {
  const r = await rim(); if (!r) return; // no published universal rim in this database
  const { a, cars, saved } = r, uid = await admin();
  const passed = cars.filter(c => c.status === "passed");
  if (passed.length < 3) return;
  try {
    // one failed fit and one stored manual correction among the passed ones
    const [failedCar, corrected] = [passed[0]!, passed[1]!];
    await prisma.accessoryAutoFit.update({ where: { accessoryId_generationId: { accessoryId: a.id, generationId: failedCar.generationId } }, data: { fit: { ...(stored(saved, failedCar.generationId) as object), failed: "gap 60 mm" } } });
    await prisma.accessoryAutoFit.update({ where: { accessoryId_generationId: { accessoryId: a.id, generationId: corrected.generationId } }, data: { adj: { x: 0, y: 0.01, z: 0, rx: 0, ry: 0, s: 1 } } });
    const approvedBefore = cars.filter(c => c.status === "approved").length;
    await assert.rejects(s.approveMatching(uid, a.id, {}), { code: "INVALID_SELECTION" });
    await assert.rejects(s.approveMatching(uid, a.id, { filter: { status: "nonsense" } }), { code: "INVALID_FILTER" });
    const dry = await s.approveMatching(uid, a.id, { filter: {}, dryRun: true });
    assert.equal(dry.approvable, passed.length - 2);
    assert.deepEqual(dry.skipped, { FIT_FAILED: 1, HAS_CORRECTION: 1, ...(approvedBefore ? { ALREADY_APPROVED: approvedBefore } : {}) });
    assert.equal(await prisma.accessoryAutoFit.count({ where: { accessoryId: a.id, approvedAt: { not: null } } }), approvedBefore, "a dry run changes nothing");
    // "all matching" minus one unticked car
    const left = passed[2]!.generationId, perCar = () => prisma.auditLog.count({ where: { action: "ACCESSORY3D_FIT_APPROVED", targetId: a.id, actorId: uid } });
    const perCarBefore = await perCar();
    const res = await s.approveMatching(uid, a.id, { filter: {}, exclude: [left] });
    assert.equal(res.approved, passed.length - 3);
    const rows = await prisma.accessoryAutoFit.findMany({ where: { accessoryId: a.id } }), by = new Map(rows.map(x => [x.generationId, x]));
    assert.equal(by.get(failedCar.generationId)?.approvedAt, null, "failed: never bulk-approved");
    assert.equal(by.get(corrected.generationId)?.approvedAt, null, "manual correction: never bulk-approved");
    assert.deepEqual(by.get(corrected.generationId)?.adj, { x: 0, y: 0.01, z: 0, rx: 0, ry: 0, s: 1 }, "and the correction is kept");
    assert.equal(by.get(left)?.approvedAt, null, "the unticked car is left out");
    for (const c of passed.slice(3)) assert.ok(by.get(c.generationId)?.approvedAt, `${c.name} approved`);
    const summary = await prisma.auditLog.findFirstOrThrow({ where: { action: "ACCESSORY3D_FITS_BULK_APPROVED", targetId: a.id, actorId: uid }, orderBy: { createdAt: "desc" } });
    assert.equal((summary.details as { count: number }).count, passed.length - 3);
    assert.equal(await perCar() - perCarBefore, passed.length - 3, "one audit row per approved car");
    // picked ids: an unknown id is counted, approving twice skips as already approved
    const again = await s.approveMatching(uid, a.id, { generationIds: [passed[3]!.generationId, "00000000-0000-0000-0000-000000000000"] });
    assert.deepEqual(again, { approved: 0, skipped: { NOT_A_TARGET: 1, ALREADY_APPROVED: 1 } });
  } finally { await restore(a.id, saved); }
});

test("Run auto-fit: approved fits are skipped by default; including them needs the confirmed count; one job at a time; progress to DONE", async () => {
  const r = await rim(); if (!r) return;
  const { a, cars, saved } = r, uid = await admin();
  const passed = cars.filter(c => c.status === "passed"), approved = cars.filter(c => c.status === "approved");
  if (passed.length < 2 || !approved.length) return;
  const byKey = new Map(cars.map(c => [c.model3dKey, stored(saved, c.generationId)]));
  let calls = 0;
  const compute = async (_type: string, _size: unknown, _file: string, key: string) => { calls++; return byKey.get(key); };
  try {
    const pick = [passed[0]!.generationId, passed[1]!.generationId, approved[0]!.generationId];
    const dry = await createFitJob(uid, a.id, { generationIds: pick, dryRun: true });
    assert.deepEqual(dry.summary, { toRun: 2, approvedSkipped: 1, approvedReset: 0, notATarget: 0 });
    await assert.rejects(createFitJob(uid, a.id, { generationIds: pick, includeApproved: true }), { code: "CONFIRM_RESET_COUNT" }, "an approval is never reset without the confirmed count");
    await assert.rejects(createFitJob(uid, a.id, { generationIds: pick, includeApproved: true, confirmApprovedReset: 2 }), { code: "CONFIRM_RESET_COUNT" });
    await assert.rejects(createFitJob(uid, a.id, { generationIds: [approved[0]!.generationId] }), { code: "NOTHING_TO_RUN" });
    const { job } = await createFitJob(uid, a.id, { generationIds: pick });
    assert.equal(job?.status, "QUEUED"); assert.equal(job?.total, 2);
    await assert.rejects(createFitJob(uid, a.id, { generationIds: pick }), { code: "FIT_JOB_RUNNING" });
    assert.equal(await processNextFitJob({ compute: compute as never }), true);
    const end = (await currentFitJob(a.id)).job!;
    assert.deepEqual({ status: end.status, position: end.position, done: end.done, errors: end.errors }, { status: "DONE", position: 2, done: 2, errors: 0 });
    assert.equal(calls, 2);
    const after = await prisma.accessoryAutoFit.findUniqueOrThrow({ where: { accessoryId_generationId: { accessoryId: a.id, generationId: approved[0]!.generationId } } });
    assert.ok(after.approvedAt, "the approved fit was not touched");
    assert.ok(await prisma.auditLog.findFirst({ where: { action: "ACCESSORY3D_FIT_JOB_FINISHED", targetId: a.id } }));
    // included explicitly, with the confirmed count: that car is re-run and loses its approval
    const inc = await createFitJob(uid, a.id, { generationIds: [approved[0]!.generationId], includeApproved: true, confirmApprovedReset: 1 });
    assert.equal(inc.summary.approvedReset, 1);
    await processNextFitJob({ compute: compute as never });
    const reset = await prisma.accessoryAutoFit.findUniqueOrThrow({ where: { accessoryId_generationId: { accessoryId: a.id, generationId: approved[0]!.generationId } } });
    assert.equal(reset.approvedAt, null, "re-run approved fit waits for review again");
    const started = await prisma.auditLog.findFirstOrThrow({ where: { action: "ACCESSORY3D_FIT_JOB_STARTED", targetId: a.id }, orderBy: { createdAt: "desc" } });
    assert.deepEqual((started.details as { resetGenerationIds: string[] }).resetGenerationIds, [approved[0]!.generationId], "which approvals were reset is on record");
  } finally { await restore(a.id, saved); }
});

test("a job resumes where it stopped after a lost lease, can be cancelled, skips a car approved meanwhile, and stops when the checker cannot run", async () => {
  const r = await rim(); if (!r) return;
  const { a, cars, saved } = r, uid = await admin();
  const passed = cars.filter(c => c.status === "passed");
  if (passed.length < 6) return;
  const byKey = new Map(cars.map(c => [c.model3dKey, stored(saved, c.generationId)]));
  const seen: string[] = [];
  const compute = async (_t: string, _s: unknown, _f: string, key: string) => { seen.push(key); return byKey.get(key); };
  try {
    // resume: a worker died after the first car (lease expired)
    const two = [passed[0]!.generationId, passed[1]!.generationId];
    const { job } = await createFitJob(uid, a.id, { generationIds: two });
    await prisma.accessoryFitJob.update({ where: { id: job!.id }, data: { status: "RUNNING", leaseToken: "dead-worker", leaseUntil: new Date(Date.now() - 1000), position: 1, done: 1, startedAt: new Date() } });
    await processNextFitJob({ compute: compute as never });
    let j = (await currentFitJob(a.id)).job!;
    assert.deepEqual({ status: j.status, position: j.position, done: j.done }, { status: "DONE", position: 2, done: 2 });
    assert.deepEqual(seen, [passed[1]!.model3dKey], "only the car after the stored position was fitted");
    // a live lease is never taken over
    const live = await createFitJob(uid, a.id, { generationIds: two });
    await prisma.accessoryFitJob.update({ where: { id: live.job!.id }, data: { status: "RUNNING", leaseToken: "other-worker", leaseUntil: new Date(Date.now() + 60_000) } });
    assert.equal(await processNextFitJob({ compute: compute as never }), false);
    // cancel
    await cancelFitJob(uid, a.id, live.job!.id);
    j = (await currentFitJob(a.id)).job!;
    assert.equal(j.status, "CANCELLED");
    await assert.rejects(cancelFitJob(uid, a.id, live.job!.id), { code: "FIT_JOB_NOT_RUNNING" });
    // approved after the job was created (approved ones not included): skipped, approval kept
    await restore(a.id, saved);
    const late = await createFitJob(uid, a.id, { generationIds: [passed[2]!.generationId] });
    await s.approveMatching(uid, a.id, { generationIds: [passed[2]!.generationId] });
    await processNextFitJob({ compute: compute as never });
    j = (await currentFitJob(a.id)).job!;
    assert.deepEqual({ id: j.id, done: j.done, skipped: j.skipped }, { id: late.job!.id, done: 0, skipped: 1 });
    assert.ok((await prisma.accessoryAutoFit.findUniqueOrThrow({ where: { accessoryId_generationId: { accessoryId: a.id, generationId: passed[2]!.generationId } } })).approvedAt);
    // the checker cannot run at all: the job stops after 5 errors instead of failing every car
    await restore(a.id, saved);
    await createFitJob(uid, a.id, { generationIds: passed.slice(0, 6).map(c => c.generationId) });
    await processNextFitJob({ compute: (async () => { throw new Error("browser missing"); }) as never });
    j = (await currentFitJob(a.id)).job!;
    assert.deepEqual({ status: j.status, error: j.error, errors: j.errors, position: j.position }, { status: "FAILED", error: "FIT_CHECKER_UNAVAILABLE", errors: 5, position: 5 });
  } finally { await restore(a.id, saved); }
});

test("5,000 cars: the paged, filtered list and approve-by-filter stay fast (the filter is sent, not the ids)", async () => {
  const r = await rim(); if (!r) return;
  const { a, cars, saved } = r, uid = await admin();
  const source = cars.find(c => c.status === "passed" || c.status === "approved");
  if (!source) return;
  const src = saved.find(x => x.generationId === source.generationId)!;
  const gen = await prisma.vehicleGeneration.findUniqueOrThrow({ where: { id: source.generationId } });
  const N = 5000, tag = `ZZSCALE${Date.now()}`;
  try {
    // test-only cars that share the source car's real 3D model (removed in finally)
    await prisma.vehicleGeneration.createMany({ data: Array.from({ length: N }, (_, i) => ({ vehicleId: gen.vehicleId, code: `${tag}-${i}`, nameEn: `${tag} ${i}`, nameAr: `${tag} ${i}`,
      yearFrom: 1990 + (i % 30), yearTo: 1995 + (i % 30), model3dKey: gen.model3dKey, isPublished: true })) });
    const made = await prisma.vehicleGeneration.findMany({ where: { code: { startsWith: tag } }, select: { id: true } });
    assert.equal(made.length, N);
    await prisma.accessoryAutoFit.createMany({ data: made.map(m => ({ accessoryId: a.id, generationId: m.id, model3dKey: src.model3dKey, carRevision: src.carRevision, partRevision: src.partRevision,
      fitVersion: src.fitVersion, fit: src.fit as object, approvedAt: null, approvedByUserId: null })) });
    forgetFitRows(a.id);
    let t0 = Date.now();
    const p = await s.page(a.id, { q: tag, limit: "50" });
    const first = Date.now() - t0;
    assert.equal(p.total, N); assert.equal(p.cars.length, 50); assert.equal(p.counts.passed, N);
    t0 = Date.now();
    const p2 = await s.page(a.id, { q: tag, offset: "4990", limit: "50" });
    const next = Date.now() - t0;
    assert.equal(p2.cars.length, 10);
    t0 = Date.now();
    const dry = await createFitJob(uid, a.id, { filter: { q: tag }, dryRun: true });
    assert.equal(dry.summary.toRun, N);
    const res = await s.approveMatching(uid, a.id, { filter: { q: tag } });
    const approveMs = Date.now() - t0;
    assert.equal(res.approved, N);
    assert.equal(await prisma.accessoryAutoFit.count({ where: { accessoryId: a.id, generationId: { in: made.map(m => m.id) }, approvedAt: { not: null } } }), N);
    console.log(`5,000 cars: first page ${first} ms, later page ${next} ms, dry run + approve by filter ${approveMs} ms`);
    assert.ok(first < 15_000 && next < 2_000 && approveMs < 30_000, "fast enough for the screen");
  } finally {
    await prisma.accessoryAutoFit.deleteMany({ where: { accessoryId: a.id, generationId: { notIn: saved.map(x => x.generationId) } } });
    await prisma.vehicleGeneration.deleteMany({ where: { code: { startsWith: tag } } });
    await restore(a.id, saved);
  }
});
