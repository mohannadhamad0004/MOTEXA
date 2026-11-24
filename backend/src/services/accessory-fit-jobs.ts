// "Run auto-fit" on many cars of one accessory as a resumable background job (Parts Admin, bulk fits screen).
// - Created from a selection (picked rows or "all matching the filter"), resolved to generation ids here. Approved fits are skipped unless
//   the admin explicitly includes them; included ones lose their approval (customers lose "View on my car" until it is approved again), so
//   the request must carry the exact number of approved fits the admin confirmed.
// - One queued / running job per accessory. The worker holds a lease, renewed after every car; after a restart an expired lease is
//   picked up again at `position`. Each car is fitted exactly like an explicit rerun (fresh fit, waits for the Parts Admin's review).
// - Progress and the "about N min left" estimate come from the stored counters, so leaving the screen changes nothing.
import { randomUUID } from "node:crypto";
import { type AccessoryFitJob, type Prisma, type ProductAccessory3D } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { accessoryTargets, computeFit, fitRows, forgetFitRows, isAccessoryFitRunning, parseAdj, parseFitSelection, saveFit, selectFitRows } from "./accessory-autofit.js";
import { fail } from "./vehicle3d-validation.js";

const ACTIVE: ("QUEUED" | "RUNNING")[] = ["QUEUED", "RUNNING"];
const LEASE_MS = 3 * 60_000;
type Compute = typeof computeFit;

export function fitJobView(j: AccessoryFitJob) {
  const fitted = j.done + j.errors, left = Math.max(0, j.total - j.position);
  // average time of the cars actually fitted so far x the cars left; null until the first one is done
  const etaSeconds = ACTIVE.includes(j.status as "QUEUED") && fitted > 0 ? Math.round((j.workMs / fitted) * left / 1000) : null;
  return { id: j.id, status: j.status, total: j.total, position: j.position, done: j.done, skipped: j.skipped, errors: j.errors, includeApproved: j.includeApproved,
    error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt, etaSeconds };
}

/** dryRun = only the counts for the confirmation sheet. */
export async function createFitJob(uid: string, accessoryId: string, body: Record<string, unknown>) {
  const sel = parseFitSelection(body), includeApproved = body.includeApproved === true;
  const { rows } = await fitRows(accessoryId, true), picked = selectFitRows(rows, sel);
  const approved = picked.rows.filter(r => r.status === "approved"), run = includeApproved ? picked.rows : picked.rows.filter(r => r.status !== "approved");
  const summary = { toRun: run.length, approvedSkipped: includeApproved ? 0 : approved.length, approvedReset: includeApproved ? approved.length : 0, notATarget: picked.unknown.length };
  if (body.dryRun === true) return { job: null, summary };
  if (!run.length) return fail("NOTHING_TO_RUN", "No car in this selection needs a fit run.", 409);
  if (includeApproved && body.confirmApprovedReset !== approved.length) return fail("CONFIRM_RESET_COUNT", `This run would reset ${approved.length} approved fits. Check the number and confirm again.`, 409);
  const a = await prisma.productAccessory3D.findUnique({ where: { id: accessoryId }, select: { privateModelPath: true } });
  if (!a?.privateModelPath) return fail("FIT_NOT_READY", "A generated model is required.", 409);
  const job = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ProductAccessory3D" WHERE "id"=${accessoryId} FOR UPDATE`;
    if (await tx.accessoryFitJob.count({ where: { accessoryId, status: { in: ACTIVE } } })) return fail("FIT_JOB_RUNNING", "A fit run is already in progress for this accessory.", 409);
    const created = await tx.accessoryFitJob.create({ data: { accessoryId, createdById: uid, targets: run.map(r => r.generationId), includeApproved, total: run.length } });
    await tx.auditLog.create({ data: { actorId: uid, action: "ACCESSORY3D_FIT_JOB_STARTED", targetId: accessoryId, details: { jobId: created.id, ...summary, includeApproved,
      resetGenerationIds: includeApproved ? approved.map(r => r.generationId) : [], selection: "ids" in sel ? "picked" : { filter: sel.filter, excluded: sel.exclude.size } } as unknown as Prisma.InputJsonValue } });
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
  return currentFitJob(accessoryId);
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
  const finish = async (status: "DONE" | "FAILED", error: string | null = null) => {
    const r = await prisma.accessoryFitJob.updateMany({ where: mine, data: { status, error, finishedAt: new Date(), leaseToken: null, leaseUntil: null } });
    if (r.count) {
      const j = await prisma.accessoryFitJob.findUniqueOrThrow({ where: { id: jobId } });
      await prisma.auditLog.create({ data: { actorId: j.createdById, action: status === "DONE" ? "ACCESSORY3D_FIT_JOB_FINISHED" : "ACCESSORY3D_FIT_JOB_FAILED", targetId: j.accessoryId,
        details: { jobId, total: j.total, done: j.done, skipped: j.skipped, errors: j.errors, error } } });
    }
    forgetFitRows(job.accessoryId);
  };
  const a = await prisma.productAccessory3D.findUnique({ where: { id: job.accessoryId } });
  if (!a?.privateModelPath || !["PUBLISHED", "READY_FOR_FINAL_REVIEW"].includes(a.status)) return finish("FAILED", "FIT_NOT_READY");
  const targets = new Set((await accessoryTargets(job.accessoryId)).filter(g => g.isPublished && g.model3dKey).map(g => g.id));
  const list = job.targets as string[], stillMine = async () => (await prisma.accessoryFitJob.count({ where: mine })) > 0;
  let done = job.done, errors = job.errors;
  for (let pos = job.position; pos < list.length; pos++) {
    const started = Date.now();
    let outcome: "done" | "skipped" | "errors";
    try { outcome = await fitOne(a, list[pos]!, job.includeApproved, targets, compute, stillMine); }
    catch { outcome = "errors"; console.error(`Accessory fit job ${jobId}: one car could not be fitted.`); }
    const step = await prisma.accessoryFitJob.updateMany({ where: mine, data: { position: pos + 1, [outcome]: { increment: 1 },
      workMs: { increment: outcome === "skipped" ? 0 : Date.now() - started }, leaseUntil: new Date(Date.now() + LEASE_MS) } });
    if (!step.count) { forgetFitRows(job.accessoryId); return; } // cancelled, or the lease went to another worker
    if (outcome === "done") done++; else if (outcome === "errors") errors++;
    // the fit checker itself cannot run here (no browser…): stop after 5 errors in a row instead of failing 5,000 cars one by one
    if (errors >= 5 && done === 0) return finish("FAILED", "FIT_CHECKER_UNAVAILABLE");
    if ((pos + 1) % 25 === 0) forgetFitRows(job.accessoryId); // the list catches up while the run goes on
  }
  return finish("DONE");
}

/** One car, exactly like an explicit rerun: a fresh fit that waits for the Parts Admin (an approved correction is re-checked on it and kept
 *  as the suggestion). "skipped" = no longer a car of this part, approved since the job started (when approved ones are not included),
 *  or the job was cancelled while this car was being fitted. */
async function fitOne(a: ProductAccessory3D, generationId: string, includeApproved: boolean, targets: Set<string>, compute: Compute, stillMine: () => Promise<boolean>) {
  if (!targets.has(generationId)) return "skipped" as const;
  const key = (await prisma.vehicleGeneration.findUnique({ where: { id: generationId }, select: { model3dKey: true } }))?.model3dKey;
  if (!key) return "skipped" as const;
  const id = { accessoryId_generationId: { accessoryId: a.id, generationId } }, previous = await prisma.accessoryAutoFit.findUnique({ where: id });
  if (previous?.approvedAt && !includeApproved) return "skipped" as const;
  const correction = previous?.approvedAt && previous.adj ? parseAdj(previous.adj) : null;
  const fit = await compute(a.accessoryType, { widthMm: a.widthMm, lengthMm: a.lengthMm, rimInches: a.rimInches }, a.privateModelPath!, key, correction);
  if (!await stillMine()) return "skipped" as const;
  await prisma.accessoryAutoFit.updateMany({ where: { accessoryId: a.id, generationId }, data: { fitVersion: -1 } }); // stale, so saveFit replaces it
  await saveFit(a, generationId, key, fit);
  await prisma.accessoryAutoFit.updateMany({ where: { accessoryId: a.id, generationId }, data: { approvedAt: null, approvedByUserId: null } });
  return "done" as const;
}
