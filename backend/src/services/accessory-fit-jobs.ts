// "Run auto-fit" on many cars of one accessory as a resumable background job (Parts Admin, bulk fits screen).
// - Created from a selection (picked rows or "all matching the filter"), resolved to generation ids here. Approved fits are skipped unless
//   the admin explicitly includes them; included ones lose their approval (customers lose "View on my car" until it is approved again), so
//   the request must carry the exact number of approved fits the admin confirmed. A saved manual correction (adj, not approved) is never
//   overwritten either: skipped unless corrections are explicitly included with their confirmed count; each reset one is audited.
// - 5 cars in a row that the fit checker could not compute stop the job (FAILED, FIT_CHECKER_UNAVAILABLE) at any point; those cars are
//   handed back (position rewound) so "Resume" retries them. A car-update refit that had to wait for the job runs when the job ends.
// - A correction job ("Apply this correction to similar cars", more than ~10 cars) carries the Parts Admin's correction: each car is fitted
//   with it on top and, when it passes the viewer's check, the correction is saved for review (suggestCorrection). It never approves.
// - One queued / running job per accessory. The worker holds a lease, renewed after every car; after a restart an expired lease is
//   picked up again at `position`. Each car is fitted exactly like an explicit rerun (fresh fit, waits for the Parts Admin's review).
// - Progress and the "about N min left" estimate come from the stored counters, so leaving the screen changes nothing.
import { randomUUID } from "node:crypto";
import { type AccessoryFitJob, type Prisma, type ProductAccessory3D } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { accessoryTargets, autoFitAccessory, computeFit, fitRows, forgetFitRows, hasCorrection, isAccessoryFitRunning, parseAdj, parseFitSelection, saveFit, selectFitRows, suggestCorrection, type Adj } from "./accessory-autofit.js";
import { fail } from "./vehicle3d-validation.js";

const ACTIVE: ("QUEUED" | "RUNNING")[] = ["QUEUED", "RUNNING"];
const LEASE_MS = 3 * 60_000;
/** cars in a row the checker could not compute before the job stops */
export const MAX_FAILURE_STREAK = 5;
type Compute = typeof computeFit;
/** targets = the generation ids in order; a correction job stores { ids, correction } in the same column (no schema change). */
export function jobPlan(targets: unknown): { ids: string[]; correction: Adj | null } {
  if (Array.isArray(targets)) return { ids: targets as string[], correction: null };
  const t = (targets ?? {}) as { ids?: unknown; correction?: unknown };
  return { ids: Array.isArray(t.ids) ? t.ids as string[] : [], correction: parseAdj(t.correction) };
}

export function fitJobView(j: AccessoryFitJob) {
  const fitted = j.done + j.errors, left = Math.max(0, j.total - j.position);
  // average time of the cars actually fitted so far x the cars left; null until the first one is done
  const etaSeconds = ACTIVE.includes(j.status as "QUEUED") && fitted > 0 ? Math.round((j.workMs / fitted) * left / 1000) : null;
  return { id: j.id, status: j.status, total: j.total, position: j.position, done: j.done, skipped: j.skipped, errors: j.errors, includeApproved: j.includeApproved,
    includeCorrections: j.includeCorrections, correction: jobPlan(j.targets).correction !== null, error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt, etaSeconds };
}

/** dryRun = only the counts for the confirmation sheet. */
export async function createFitJob(uid: string, accessoryId: string, body: Record<string, unknown>) {
  const sel = parseFitSelection(body), includeApproved = body.includeApproved === true, includeCorrections = body.includeCorrections === true;
  const correction = body.correction === undefined || body.correction === null ? null : parseAdj(body.correction);
  if (body.correction && !correction) return fail("INVALID_ADJUST", "Adjustments are limited to ±0.5 m, ±45° and 80-125 % scale.");
  const { rows } = await fitRows(accessoryId, true), picked = selectFitRows(rows, sel);
  const approved = picked.rows.filter(r => r.status === "approved");
  // a saved manual correction that is not approved (e.g. after Unapprove): read from the fit rows themselves, whatever the list state says
  const withAdj = new Set((await prisma.accessoryAutoFit.findMany({ where: { accessoryId, approvedAt: null, generationId: { in: picked.rows.map(r => r.generationId) } }, select: { generationId: true, adj: true } }))
    .filter(r => hasCorrection(r.adj)).map(r => r.generationId));
  const corrected = picked.rows.filter(r => r.status !== "approved" && withAdj.has(r.generationId));
  const run = picked.rows.filter(r => r.status === "approved" ? includeApproved : !withAdj.has(r.generationId) || includeCorrections);
  const summary = { toRun: run.length, approvedSkipped: includeApproved ? 0 : approved.length, approvedReset: includeApproved ? approved.length : 0,
    correctionsSkipped: includeCorrections ? 0 : corrected.length, correctionsReset: includeCorrections ? corrected.length : 0, notATarget: picked.unknown.length };
  if (body.dryRun === true) return { job: null, summary };
  if (!run.length) return fail("NOTHING_TO_RUN", "No car in this selection needs a fit run.", 409);
  if (includeApproved && body.confirmApprovedReset !== approved.length) return fail("CONFIRM_RESET_COUNT", `This run would reset ${approved.length} approved fits. Check the number and confirm again.`, 409);
  if (includeCorrections && body.confirmCorrectionReset !== corrected.length) return fail("CONFIRM_CORRECTION_RESET_COUNT", `This run would reset ${corrected.length} saved manual corrections. Check the number and confirm again.`, 409);
  const a = await prisma.productAccessory3D.findUnique({ where: { id: accessoryId }, select: { privateModelPath: true } });
  if (!a?.privateModelPath) return fail("FIT_NOT_READY", "A generated model is required.", 409);
  const job = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ProductAccessory3D" WHERE "id"=${accessoryId} FOR UPDATE`;
    if (await tx.accessoryFitJob.count({ where: { accessoryId, status: { in: ACTIVE } } })) return fail("FIT_JOB_RUNNING", "A fit run is already in progress for this accessory.", 409);
    const created = await tx.accessoryFitJob.create({ data: { accessoryId, createdById: uid, targets: correction ? { ids: run.map(r => r.generationId), correction } : run.map(r => r.generationId), includeApproved, includeCorrections, total: run.length } });
    await tx.auditLog.create({ data: { actorId: uid, action: "ACCESSORY3D_FIT_JOB_STARTED", targetId: accessoryId, details: { jobId: created.id, ...summary, includeApproved, includeCorrections, correction,
      resetGenerationIds: includeApproved ? approved.map(r => r.generationId) : [], resetCorrectionGenerationIds: includeCorrections ? corrected.map(r => r.generationId) : [], selection: "ids" in sel ? "picked" : { filter: sel.filter, excluded: sel.exclude.size } } as unknown as Prisma.InputJsonValue } });
    return created;
  });
  forgetFitRows(accessoryId);
  return { job: fitJobView(job), summary };
}

/** The newest job of the accessory (running, or the last one finished), or null. */
export async function currentFitJob(accessoryId: string) {
  const j = await prisma.accessoryFitJob.findFirst({ where: { accessoryId }, orderBy: { createdAt: "desc" } });
  return { job: j ? fitJobView(j) : null };
}

export async function cancelFitJob(uid: string, accessoryId: string, jobId: string) {
  const r = await prisma.accessoryFitJob.updateMany({ where: { id: jobId, accessoryId, status: { in: ACTIVE } }, data: { status: "CANCELLED", finishedAt: new Date(), leaseToken: null, leaseUntil: null } });
  if (!r.count) return fail("FIT_JOB_NOT_RUNNING", "This fit run is not running any more.", 409);
  await prisma.auditLog.create({ data: { actorId: uid, action: "ACCESSORY3D_FIT_JOB_CANCELLED", targetId: accessoryId, details: { jobId } } });
  forgetFitRows(accessoryId);
  await refitIfWaiting(jobId);
  return currentFitJob(accessoryId);
}

/** A stopped (FAILED) job with cars left goes back in the queue and continues at its position (the cars that failed are retried). */
export async function resumeFitJob(uid: string, accessoryId: string, jobId: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ProductAccessory3D" WHERE "id"=${accessoryId} FOR UPDATE`;
    const j = await tx.accessoryFitJob.findFirst({ where: { id: jobId, accessoryId } });
    if (!j || j.status !== "FAILED" || j.position >= j.total) return fail("FIT_JOB_NOT_RESUMABLE", "Only a stopped run with cars left can be resumed.", 409);
    if (await tx.accessoryFitJob.count({ where: { accessoryId, status: { in: ACTIVE } } })) return fail("FIT_JOB_RUNNING", "A fit run is already in progress for this accessory.", 409);
    await tx.accessoryFitJob.update({ where: { id: jobId }, data: { status: "QUEUED", error: null, finishedAt: null, leaseToken: null, leaseUntil: null } });
    await tx.auditLog.create({ data: { actorId: uid, action: "ACCESSORY3D_FIT_JOB_RESUMED", targetId: accessoryId, details: { jobId, position: j.position, total: j.total } } });
  });
  forgetFitRows(accessoryId);
  return currentFitJob(accessoryId);
}

/** A car-update refit of this accessory waited for the job (refitAfter): run it now that the job has ended. */
async function refitIfWaiting(jobId: string, compute?: Compute) {
  const j = await prisma.accessoryFitJob.findUnique({ where: { id: jobId }, select: { accessoryId: true, refitAfter: true, status: true } });
  if (!j?.refitAfter || ACTIVE.includes(j.status as "QUEUED")) return;
  await prisma.accessoryFitJob.update({ where: { id: jobId }, data: { refitAfter: false } });
  void autoFitAccessory(j.accessoryId, compute);
}

/** Claim the oldest queued (or abandoned) job and work through it until it is done, cancelled or its lease is lost. true = worked on one. */
export async function processNextFitJob(options: { compute?: Compute } = {}) {
  const now = new Date(), free = { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] };
  const candidates = await prisma.accessoryFitJob.findMany({ where: { status: { in: ACTIVE }, ...free }, orderBy: { createdAt: "asc" }, take: 5 });
  for (const c of candidates) {
    if (isAccessoryFitRunning(c.accessoryId)) continue; // the publish-time fitting of this part is still running: next tick
    const lease = randomUUID();
    const claimed = await prisma.accessoryFitJob.updateMany({ where: { id: c.id, status: { in: ACTIVE }, ...free },
      data: { status: "RUNNING", leaseToken: lease, leaseUntil: new Date(Date.now() + LEASE_MS), startedAt: c.startedAt ?? new Date() } });
    if (!claimed.count) continue;
    await runFitJob(c.id, lease, options.compute ?? computeFit);
    return true;
  }
  return false;
}

async function runFitJob(jobId: string, lease: string, compute: Compute) {
  const job = await prisma.accessoryFitJob.findUniqueOrThrow({ where: { id: jobId } });
  const mine = { id: jobId, leaseToken: lease, status: "RUNNING" as const };
  const finish = async (status: "DONE" | "FAILED", error: string | null = null, cause?: string) => {
    const r = await prisma.accessoryFitJob.updateMany({ where: mine, data: { status, error, finishedAt: new Date(), leaseToken: null, leaseUntil: null } });
    if (r.count) {
      const j = await prisma.accessoryFitJob.findUniqueOrThrow({ where: { id: jobId } });
      await prisma.auditLog.create({ data: { actorId: j.createdById, action: status === "DONE" ? "ACCESSORY3D_FIT_JOB_FINISHED" : "ACCESSORY3D_FIT_JOB_FAILED", targetId: j.accessoryId,
        details: { jobId, total: j.total, position: j.position, done: j.done, skipped: j.skipped, errors: j.errors, error, ...(cause ? { cause } : {}) } } });
    }
    forgetFitRows(job.accessoryId);
    await refitIfWaiting(jobId, compute);
  };
  const a = await prisma.productAccessory3D.findUnique({ where: { id: job.accessoryId } });
  if (!a?.privateModelPath || !["PUBLISHED", "READY_FOR_FINAL_REVIEW"].includes(a.status)) return finish("FAILED", "FIT_NOT_READY");
  const targets = new Set((await accessoryTargets(job.accessoryId)).filter(g => g.isPublished && g.model3dKey).map(g => g.id));
  const { ids: list, correction } = jobPlan(job.targets), stillMine = async () => (await prisma.accessoryFitJob.count({ where: mine })) > 0;
  // failures in a row since the last fitted car (a skipped car neither breaks nor extends it) and where that run of failures started
  let streak = 0, streakStart = 0, streakSkips = 0, cause = "";
  for (let pos = job.position; pos < list.length; pos++) {
    const started = Date.now();
    let outcome: "done" | "skipped" | "errors";
    try { outcome = await fitOne(a, list[pos]!, job, targets, compute, stillMine, correction); }
    catch (e) { outcome = "errors"; cause = String((e as Error)?.message ?? e).split("\n")[0]!.slice(0, 200); console.error(`Accessory fit job ${jobId}: one car could not be fitted.`); }
    const step = await prisma.accessoryFitJob.updateMany({ where: mine, data: { position: pos + 1, [outcome]: { increment: 1 },
      workMs: { increment: outcome === "skipped" ? 0 : Date.now() - started }, leaseUntil: new Date(Date.now() + LEASE_MS) } });
    if (!step.count) { forgetFitRows(job.accessoryId); return; } // cancelled, or the lease went to another worker
    if (outcome === "done") streak = 0;
    else if (outcome === "errors") { if (!streak) { streakStart = pos; streakSkips = 0; } streak++; }
    else if (streak) streakSkips++;
    // the fit checker cannot run here (no browser, timeouts...): stop at ANY point after 5 failures in a row instead of failing every car
    // left one by one. Those cars are handed back (position rewound, not counted as errors) so Resume retries them.
    if (streak >= MAX_FAILURE_STREAK) {
      await prisma.accessoryFitJob.updateMany({ where: mine, data: { position: streakStart, errors: { decrement: streak }, skipped: { decrement: streakSkips } } });
      return finish("FAILED", "FIT_CHECKER_UNAVAILABLE", cause);
    }
    if ((pos + 1) % 25 === 0) forgetFitRows(job.accessoryId); // the list catches up while the run goes on
  }
  return finish("DONE");
}

/** One car, exactly like an explicit rerun: a fresh fit that waits for the Parts Admin (an approved correction is re-checked on it and kept
 *  as the suggestion). "skipped" = no longer a car of this part, approved since the job started (when approved ones are not included),
 *  a saved manual correction (when corrections are not included; checked again here, so one saved after the job started is kept too),
 *  or the job was cancelled while this car was being fitted. An included correction is reset with an audit row (saveFit). */
async function fitOne(a: ProductAccessory3D, generationId: string, job: AccessoryFitJob, targets: Set<string>, compute: Compute, stillMine: () => Promise<boolean>, fix: Adj | null = null) {
  if (!targets.has(generationId)) return "skipped" as const;
  const key = (await prisma.vehicleGeneration.findUnique({ where: { id: generationId }, select: { model3dKey: true } }))?.model3dKey;
  if (!key) return "skipped" as const;
  const id = { accessoryId_generationId: { accessoryId: a.id, generationId } }, previous = await prisma.accessoryAutoFit.findUnique({ where: id });
  if (previous?.approvedAt && !job.includeApproved) return "skipped" as const;
  if (previous && !previous.approvedAt && hasCorrection(previous.adj) && !job.includeCorrections) return "skipped" as const;
  // a correction job: saved for review when it passes on this car, else this car is left as it was ("skipped")
  if (fix) return (await suggestCorrection(a, generationId, key, fix, job.createdById, compute, { jobId: job.id, go: stillMine })).saved ? "done" as const : "skipped" as const;
  const correction = previous?.approvedAt && previous.adj ? parseAdj(previous.adj) : null;
  const fit = await compute(a.accessoryType, { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, a.privateModelPath!, key, correction);
  if (!await stillMine()) return "skipped" as const;
  await prisma.accessoryAutoFit.updateMany({ where: { accessoryId: a.id, generationId }, data: { fitVersion: -1 } }); // stale, so saveFit replaces it
  await saveFit(a, generationId, key, fit, { actorId: job.createdById, reason: "bulk run with corrections included", jobId: job.id });
  await prisma.accessoryAutoFit.updateMany({ where: { accessoryId: a.id, generationId }, data: { approvedAt: null, approvedByUserId: null } });
  return "done" as const;
}
