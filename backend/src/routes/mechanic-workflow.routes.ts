import { Router, type Response } from "express";
import { prisma } from "../prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  fail,
  MechanicError,
  text,
  SPECIALIZATIONS,
} from "../services/mechanic-policy.js";

const router = Router();
router.use(requireAuth);
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

async function isReviewer(res: Response) {
  const u = res.locals.authUser;
  return (
    u.role === "SUPER_ADMIN" ||
    (u.role === "ADMIN" &&
      !!(await prisma.adminPermission.findUnique({
        where: {
          adminId_permission: { adminId: u.id, permission: "MANAGE_MECHANICS" },
        },
      })))
  );
}
async function requireReviewer(res: Response) {
  if (!(await isReviewer(res)))
    fail(403, "Mechanics administrator permission required.");
}
async function access(res: Response, userId: string) {
  const u = res.locals.authUser;
  const admin = await isReviewer(res);
  if (!admin && (u.role !== "MECHANIC" || userId !== u.id))
    fail(403, "You cannot access this application.");
  const p = await prisma.mechanicProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, fullName: true } },
      documents: true,
    },
  });
  if (!p || (admin && !p.submittedAt))
    fail(404, "Submitted application not found.");
  return { p, admin };
}
async function lock(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "MechanicProfile" WHERE "id"=${id} FOR UPDATE`;
  const p = await tx.mechanicProfile.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!p) fail(404, "Application not found.");
  return p;
}
async function notifyAdmins(
  tx: Prisma.TransactionClient,
  relatedUserId: string,
  kind: string,
  title: string,
  body: string,
  except?: string,
) {
  const users = await tx.user.findMany({
    where: {
      status: "ACTIVE",
      id: except ? { not: except } : undefined,
      OR: [
        { role: "SUPER_ADMIN" },
        {
          role: "ADMIN",
          adminPermissions: { some: { permission: "MANAGE_MECHANICS" } },
        },
      ],
    },
    select: { id: true },
  });
  if (users.length)
    await tx.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        relatedUserId,
        kind,
        title,
        body,
      })),
    });
}
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  targetId: string,
  action: string,
  notes: string,
) {
  await tx.auditLog.create({
    data: {
      actorId,
      targetId,
      action: "MECHANIC_" + action,
      details: { notes },
    },
  });
}
function validatedQuestion(b: any) {
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  const options = Array.isArray(b.options)
    ? b.options.map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
    : [];
  const specialization = text(b.specialization, 40);
  if (
    prompt.length < 10 ||
    prompt.length > 800 ||
    options.length !== 4 ||
    options.some((s: string) => !s || s.length > 300) ||
    new Set(options.map((s: string) => s.toLowerCase())).size !== 4 ||
    !Number.isInteger(b.correctIndex) ||
    b.correctIndex < 0 ||
    b.correctIndex > 3 ||
    ![...SPECIALIZATIONS, "SAFETY"].includes(specialization as any)
  )
    fail(
      400,
      "Provide a valid specialty, question, four distinct answers and a correct answer.",
    );
  return {
    prompt,
    options: options as string[],
    specialization,
    correctIndex: b.correctIndex as number,
    explanation: text(b.explanation, 2000),
    sourceUrl: text(b.sourceUrl, 1000),
    sourceReference: text(b.sourceReference, 500),
    difficulty: ["FOUNDATION", "INTERMEDIATE", "ADVANCED"].includes(
      b.difficulty,
    )
      ? b.difficulty
      : "INTERMEDIATE",
  };
}
const testInclude = { items: { orderBy: { position: "asc" as const } } };
function safeTest(t: any, admin: boolean) {
  return {
    ...t,
    assignedById: admin ? t.assignedById : undefined,
    reviewedById: admin ? t.reviewedById : undefined,
    items: t.items.map(({ correctIndex, ...item }: any) => ({
      ...item,
      ...(admin ? { correctIndex } : {}),
    })),
  };
}

router.get("/questions", async (req, res) => {
  await requireReviewer(res);
  const questions = await prisma.mechanicQuestion.findMany({
    where: req.query.active === "true" ? { active: true } : {},
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json({ success: true, questions });
});
router.post("/questions", async (req, res) => {
  await requireReviewer(res);
  const data = validatedQuestion(req.body ?? {});
  const question = await prisma.$transaction(async (tx) => {
    const q = await tx.mechanicQuestion.create({
      data: { ...data, active: false, createdById: res.locals.authUser.id },
    });
    await audit(
      tx,
      res.locals.authUser.id,
      q.id,
      "QUESTION_CREATED",
      "Added professional question",
    );
    return q;
  });
  res.status(201).json({ success: true, question });
});
router.put("/questions/:id", async (req, res) => {
  await requireReviewer(res);
  const data = validatedQuestion(req.body ?? {});
  const question = await prisma.$transaction(async (tx) => {
    const old = await tx.mechanicQuestion.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!old) fail(404, "Question not found.");
    if (req.body.revision !== old.revision)
      fail(409, "Question changed. Refresh before editing.");
    const q = await tx.mechanicQuestion.update({
      where: { id: old.id, revision: old.revision },
      data: {
        ...data,
        active: false,
        reviewStatus: "DRAFT",
        reviewerName: null,
        reviewNotes: null,
        reviewedById: null,
        reviewedAt: null,
        revision: { increment: 1 },
      },
    });
    await audit(
      tx,
      res.locals.authUser.id,
      q.id,
      "QUESTION_UPDATED",
      "Updated professional question",
    );
    return q;
  });
  res.json({ success: true, question });
});
router.post("/questions/:id/review", async (req, res) => {
  await requireReviewer(res);
  const status = req.body?.status;
  if (!["APPROVED", "DISABLED"].includes(status))
    fail(400, "Choose approval or disabling.");
  const question = await prisma.$transaction(async (tx) => {
    const old = await tx.mechanicQuestion.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!old) fail(404, "Question not found.");
    if (req.body.revision !== old.revision)
      fail(409, "Question changed. Refresh before reviewing.");
    const reviewerName = text(req.body.reviewerName, 120);
    const reviewNotes = text(req.body.reviewNotes, 1500);
    if (status === "APPROVED") {
      let validUrl = false;
      try {
        const url = new URL(old.sourceUrl);
        validUrl = url.protocol === "https:" && !!url.hostname;
      } catch {}
      if (
        !validUrl ||
        old.explanation.length < 20 ||
        old.sourceReference.length < 5
      )
        fail(
          400,
          "Add an explanation, HTTPS source and source reference before approval.",
        );
      if (
        req.body.confirmReviewed !== true ||
        reviewerName.length < 3 ||
        reviewNotes.length < 10
      )
        fail(
          400,
          "Record the technical reviewer, review notes and explicit review confirmation.",
        );
    }
    const q = await tx.mechanicQuestion.update({
      where: { id: old.id, revision: old.revision },
      data: {
        reviewStatus: status,
        active: status === "APPROVED",
        revision: { increment: 1 },
        ...(status === "APPROVED"
          ? {
              reviewerName,
              reviewNotes,
              reviewedById: res.locals.authUser.id,
              reviewedAt: new Date(),
            }
          : {}),
      },
    });
    await audit(
      tx,
      res.locals.authUser.id,
      q.id,
      "QUESTION_" + status,
      reviewNotes || "Question disabled",
    );
    return q;
  });
  res.json({ success: true, question });
});
router.get("/applications/:userId/tests", async (req, res) => {
  const { p, admin } = await access(res, String(req.params.userId));
  const tests = await prisma.mechanicTest.findMany({
    where: { profileId: p.id },
    include: testInclude,
    orderBy: [{ submissionVersion: "desc" }, { attempt: "desc" }],
    take: 30,
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, tests: tests.map((t) => safeTest(t, admin)) });
});
router.post("/applications/:userId/tests", async (req, res) => {
  await requireReviewer(res);
  const { p } = await access(res, String(req.params.userId));
  const ids = req.body?.questionIds;
  if (
    !Array.isArray(ids) ||
    ids.length !== 2 ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== 2
  )
    fail(400, "Choose exactly two distinct questions.");
  const assigned = await prisma.$transaction(async (tx) => {
    const current = await lock(tx, p.id);
    if (
      current.verificationStatus !== "PENDING" ||
      req.body.submissionVersion !== current.submissionVersion
    )
      fail(409, "Only the current pending application can receive a test.");
    const old = await tx.mechanicTest.findFirst({
      where: { profileId: p.id, submissionVersion: current.submissionVersion },
      orderBy: { attempt: "desc" },
    });
    if (old && !old.submittedAt)
      fail(409, "Wait for the assigned test to be submitted.");
    if (old && old.attempt >= 5)
      fail(
        400,
        "The maximum of five tests for this submission has been reached.",
      );
    const qs = await tx.mechanicQuestion.findMany({
      where: { id: { in: ids }, active: true, reviewStatus: "APPROVED" },
    });
    if (
      qs.length !== 2 ||
      qs.some(
        (q) =>
          q.specialization !== "SAFETY" &&
          !current.specializations.includes(q.specialization),
      )
    )
      fail(
        400,
        "Select active questions relevant to the mechanic specialties.",
      );
    const t = await tx.mechanicTest.create({
      data: {
        profileId: p.id,
        submissionVersion: current.submissionVersion,
        attempt: (old?.attempt ?? 0) + 1,
        assignedById: res.locals.authUser.id,
        items: {
          create: ids.map((id: string, i: number) => {
            const q = qs.find((q) => q.id === id)!;
            return {
              questionId: q.id,
              revision: q.revision,
              position: i,
              prompt: q.prompt,
              options: q.options,
              correctIndex: q.correctIndex,
            };
          }),
        },
      },
      include: testInclude,
    });
    await tx.mechanicProfile.update({
      where: { id: p.id },
      data: { interviewResult: null, interviewNotes: null },
    });
    await tx.notification.create({
      data: {
        userId: p.userId,
        relatedUserId: p.userId,
        kind: "TEST_ASSIGNED",
        title: "Professional test assigned",
        body: "Your Mechanics Admin sent you two professional questions. Open your application to answer.",
      },
    });
    await audit(
      tx,
      res.locals.authUser.id,
      p.id,
      "TEST_ASSIGNED",
      "Assigned two professional questions",
    );
    return t;
  });
  res.status(201).json({ success: true, test: safeTest(assigned, true) });
});
router.post("/tests/:id/submit", async (req, res) => {
  if (res.locals.authUser.role !== "MECHANIC")
    fail(403, "Only the assigned mechanic can submit answers.");
  const t = await prisma.mechanicTest.findUnique({
    where: { id: String(req.params.id) },
    include: { profile: true, items: true },
  });
  if (!t || t.profile.userId !== res.locals.authUser.id)
    fail(404, "Test not found.");
  const answers = req.body?.answers;
  if (
    !Array.isArray(answers) ||
    answers.length !== 2 ||
    new Set(answers.map((a) => a?.itemId)).size !== 2 ||
    answers.some(
      (a) =>
        !t.items.some((i) => i.id === a?.itemId) ||
        !Number.isInteger(a?.answerIndex) ||
        a.answerIndex < 0 ||
        a.answerIndex > 3,
    )
  )
    fail(400, "Answer both assigned questions.");
  await prisma.$transaction(async (tx) => {
    const p = await lock(tx, t.profileId),
      current = await tx.mechanicTest.findUniqueOrThrow({
        where: { id: t.id },
      });
    const latest = await tx.mechanicTest.findFirst({
      where: { profileId: p.id, submissionVersion: p.submissionVersion },
      orderBy: { attempt: "desc" },
    });
    if (
      p.verificationStatus !== "PENDING" ||
      p.submissionVersion !== t.submissionVersion ||
      latest?.id !== t.id ||
      current.submittedAt
    )
      fail(409, "This test is no longer open.");
    let score = 0;
    for (const answer of answers) {
      const item = t.items.find((i) => i.id === answer.itemId)!;
      if (item.correctIndex === answer.answerIndex) score++;
      await tx.mechanicTestItem.update({
        where: { id: item.id },
        data: { answerIndex: answer.answerIndex },
      });
    }
    await tx.mechanicTest.update({
      where: { id: t.id },
      data: { submittedAt: new Date(), score },
    });
    const applicant = await tx.user.findUniqueOrThrow({
      where: { id: p.userId },
      select: { fullName: true },
    });
    await notifyAdmins(
      tx,
      p.userId,
      "TEST_SUBMITTED",
      "Professional test submitted",
      `${applicant.fullName} submitted two answers for review.`,
    );
    await audit(
      tx,
      p.userId,
      p.id,
      "TEST_SUBMITTED",
      "Submitted professional test answers",
    );
  });
  res.json({
    success: true,
    message:
      "Answers submitted. Your administrator will review your application.",
  });
});
router.post("/tests/:id/review", async (req, res) => {
  await requireReviewer(res);
  const t = await prisma.mechanicTest.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!t) fail(404, "Test not found.");
  const notes = text(req.body?.notes),
    assessment = text(req.body?.assessment, 30);
  if (
    notes.length < 5 ||
    !["PASSED", "NEEDS_CLARIFICATION", "NOT_READY"].includes(assessment)
  )
    fail(400, "Record assessment and at least five characters of notes.");
  await prisma.$transaction(async (tx) => {
    const p = await lock(tx, t.profileId),
      latest = await tx.mechanicTest.findFirst({
        where: { profileId: p.id, submissionVersion: p.submissionVersion },
        orderBy: { attempt: "desc" },
      });
    if (
      !t.submittedAt ||
      p.verificationStatus !== "PENDING" ||
      p.submissionVersion !== t.submissionVersion ||
      latest?.id !== t.id
    )
      fail(
        409,
        "Review the latest submitted test for the current application.",
      );
    await tx.mechanicTest.update({
      where: { id: t.id },
      data: {
        reviewedAt: new Date(),
        reviewedById: res.locals.authUser.id,
        assessment,
        reviewNotes: notes,
      },
    });
    await tx.mechanicProfile.update({
      where: { id: p.id },
      data: {
        interviewResult: assessment === "PASSED" ? "PASSED" : "FAILED",
        interviewNotes: notes,
        interviewedAt: new Date(),
        interviewedById: res.locals.authUser.id,
      },
    });
    await audit(
      tx,
      res.locals.authUser.id,
      p.id,
      "TEST_REVIEWED",
      `${assessment}: ${notes}`,
    );
  });
  res.json({ success: true });
});
router.get("/applications/:userId/reviews", async (req, res) => {
  await requireReviewer(res);
  const { p } = await access(res, String(req.params.userId));
  const reviews = await prisma.mechanicDocumentReview.findMany({
    where: { profileId: p.id },
  });
  res.json({
    success: true,
    reviewedDocumentIds: reviews
      .filter((r) =>
        p.documents.some(
          (d) => d.id === r.documentId && d.storageKey === r.storageKey,
        ),
      )
      .map((r) => r.documentId),
  });
});
router.post("/applications/:userId/reviews", async (req, res) => {
  await requireReviewer(res);
  const { p } = await access(res, String(req.params.userId));
  await prisma.$transaction(async (tx) => {
    const current = await lock(tx, p.id);
    if (current.submissionVersion !== req.body?.submissionVersion)
      fail(409, "Application changed. Refresh before reviewing.");
    const d = current.documents.find((d) => d.id === req.body?.documentId);
    if (!d) fail(404, "Document not found.");
    if (req.body.reviewed === true) {
      await tx.mechanicDocumentReview.upsert({
        where: { profileId_documentId: { profileId: p.id, documentId: d.id } },
        create: {
          profileId: p.id,
          documentId: d.id,
          storageKey: d.storageKey,
          reviewerId: res.locals.authUser.id,
        },
        update: {
          storageKey: d.storageKey,
          reviewerId: res.locals.authUser.id,
          reviewedAt: new Date(),
        },
      });
    } else {
      await tx.mechanicDocumentReview.deleteMany({
        where: { profileId: p.id, documentId: d.id },
      });
    }
    await audit(
      tx,
      res.locals.authUser.id,
      p.id,
      "DOCUMENT_REVIEWED",
      `${d.kind}: ${req.body.reviewed === true ? "reviewed" : "pending review"}`,
    );
  });
  res.json({ success: true });
});
router.get("/applications/:userId/messages", async (req, res) => {
  const { p } = await access(res, String(req.params.userId));
  // Fetch the most recent 100; older pages are available with the oldest message id.
  const before =
    typeof req.query.before === "string" ? req.query.before : undefined;
  if (
    before &&
    !(await prisma.mechanicMessage.findFirst({
      where: { id: before, profileId: p.id },
    }))
  )
    fail(400, "Invalid conversation cursor.");
  const rows = await prisma.mechanicMessage.findMany({
    where: { profileId: p.id },
    include: { sender: { select: { id: true, fullName: true, role: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 101,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });
  const hasMore = rows.length > 100;
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, messages: rows.slice(0, 100).reverse(), hasMore });
});
router.post("/applications/:userId/messages", async (req, res) => {
  const { p, admin } = await access(res, String(req.params.userId));
  const raw = req.body?.body,
    body = typeof raw === "string" ? raw.trim() : "";
  if (!body || body.length > 2000)
    fail(400, "Write a message between 1 and 2000 characters.");
  const message = await prisma.$transaction(async (tx) => {
    await lock(tx, p.id);
    const recent = await tx.mechanicMessage.count({
      where: {
        profileId: p.id,
        senderId: res.locals.authUser.id,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });
    if (recent >= 15) fail(429, "Please wait before sending more messages.");
    const message = await tx.mechanicMessage.create({
      data: { profileId: p.id, senderId: res.locals.authUser.id, body },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    });
    if (admin)
      await tx.notification.create({
        data: {
          userId: p.userId,
          relatedUserId: p.userId,
          kind: "MESSAGE",
          title: "New application message",
          body: "Your Mechanics Admin sent you a message about your application.",
        },
      });
    else
      await notifyAdmins(
        tx,
        p.userId,
        "MESSAGE",
        "New mechanic message",
        `${p.user.fullName} sent a message about their application.`,
      );
    return message;
  });
  res.status(201).json({ success: true, message });
});
router.post("/notifications/read-all", async (_req, res) => {
  await prisma.notification.updateMany({
    where: { userId: res.locals.authUser.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ success: true });
});
router.use((err: unknown, _req: any, res: Response, _next: any) => {
  if (err instanceof MechanicError) {
    res.status(err.status).json({ success: false, message: err.message });
    return;
  }
  // Optimistic concurrent updates return a conflict rather than a generic failure.
  if ((err as any)?.code === "P2025" || (err as any)?.code === "P2002") {
    res.status(409).json({
      success: false,
      message: "The record changed. Refresh and try again.",
    });
    return;
  }
  console.error("Mechanic workflow operation failed", {
    name: err instanceof Error ? err.name : "unknown",
  });
  res.status(500).json({
    success: false,
    message: "The workflow operation could not be completed.",
  });
});
export { notifyAdmins };
export default router;
