import { notifyAdmins } from "./mechanic-workflow.routes.js";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  SPECIALIZATIONS,
  completeProfile,
  completeDocuments,
  fail,
  MechanicError,
  text,
  requireVerifiedMechanic,
} from "../services/mechanic-policy.js";

const router = Router(),
  privateRoot = path.resolve(
    process.env.MECHANIC_DOCUMENT_DIR || ".private/mechanic-documents",
  );
const documentsSelect = {
  id: true,
  kind: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;
const ownerSelect = {
  id: true,
  fullName: true,
  email: true,
  status: true,
} as const;
function own(res: Response) {
  if (res.locals.authUser?.role !== "MECHANIC")
    fail(403, "Mechanic access required.");
  return res.locals.authUser.id as string;
}
async function reviewer(_req: Request, res: Response, next: NextFunction) {
  const u = res.locals.authUser;
  if (u?.role === "SUPER_ADMIN") {
    next();
    return;
  }
  if (
    u?.role !== "ADMIN" ||
    !(await prisma.adminPermission.findUnique({
      where: {
        adminId_permission: { adminId: u.id, permission: "MANAGE_MECHANICS" },
      },
    }))
  )
    fail(403, "Mechanics administrator permission required.");
  next();
}
async function locked(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRawUnsafe(
    'SELECT "id" FROM "MechanicProfile" WHERE "userId"=$1 FOR UPDATE',
    userId,
  );
  const p = await tx.mechanicProfile.findUnique({
    where: { userId },
    include: { documents: true },
  });
  if (!p) fail(404, "Mechanic profile not found.");
  return p;
}
function editable(status: string) {
  if (!["DRAFT", "NEEDS_COMPLETION"].includes(status))
    fail(409, "This application cannot be edited in its current state.");
}
async function view(userId: string) {
  const p = await prisma.mechanicProfile.findUnique({
    where: { userId },
    include: {
      user: { select: ownerSelect },
      documents: { select: documentsSelect },
    },
  });
  if (!p) fail(404, "Mechanic profile not found.");
  const {
    nationalId,
    nationalIdDocumentUrl,
    licenseDocumentUrl,
    certificateUrl,
    ...safe
  } = p;
  const history = await prisma.auditLog.findMany({
    where: { targetId: p.id, action: { startsWith: "MECHANIC_" } },
    select: { id: true, action: true, details: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return {
    ...safe,
    history,
    canReceiveServices:
      p.verificationStatus === "VERIFIED" && p.user.status === "ACTIVE",
  };
}
async function event(
  tx: Prisma.TransactionClient,
  actorId: string,
  targetId: string,
  action: string,
  notes: string,
) {
  await tx.auditLog.create({
    data: { actorId, targetId, action, details: { notes } },
  });
}
router.use(requireAuth);
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
router.get("/options", (_req, res) =>
  res.json({
    success: true,
    specializations: SPECIALIZATIONS,
    documentMaxBytes: 5 * 1024 * 1024,
  }),
);
router.get("/me", async (_req, res) =>
  res.json({ success: true, profile: await view(own(res)) }),
);
router.put("/me", async (req, res) => {
  const userId = own(res),
    b = req.body ?? {};
  const specs = Array.isArray(b.specializations)
    ? [...new Set(b.specializations)]
    : [];
  if (
    specs.some(
      (s) => !SPECIALIZATIONS.includes(s as (typeof SPECIALIZATIONS)[number]),
    ) ||
    specs.length > 6
  )
    fail(400, "Choose valid specializations.");
  const years =
    b.yearsOfExperience === null || b.yearsOfExperience === ""
      ? null
      : Number(b.yearsOfExperience);
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 80))
    fail(400, "Experience must be between 0 and 80 years.");
  const areas = Array.isArray(b.coverageAreas)
    ? [
        ...new Set(
          b.coverageAreas.map((v: unknown) => text(v, 80)).filter(Boolean),
        ),
      ].slice(0, 30)
    : [];
  await prisma.$transaction(async (tx) => {
    const p = await locked(tx, userId);
    editable(p.verificationStatus);
    await tx.mechanicProfile.update({
      where: { id: p.id },
      data: {
        city: text(b.city, 80),
        phoneNumber: text(b.phoneNumber, 24),
        specializations: specs as string[],
        yearsOfExperience: years,
        experienceSummary: text(b.experienceSummary),
        offersWorkshop: b.offersWorkshop === true,
        offersOnSite: b.offersOnSite === true,
        offersOnline: b.offersOnline === true,
        workshopName: text(b.workshopName, 120),
        workshopAddress: text(b.workshopAddress, 250),
        coverageAreas: areas as string[],
      },
    });
  });
  res.json({ success: true, profile: await view(userId) });
});
router.post("/me/documents", async (req, res) => {
  const userId = own(res),
    b = req.body ?? {},
    kind = text(b.kind, 30);
  if (!["IDENTITY", "CERTIFICATE", "WORKSHOP_PROOF"].includes(kind))
    fail(400, "Choose identity, certificate or workshop proof.");
  const base64 = typeof b.base64 === "string" ? b.base64 : "";
  if (
    base64.length > 7 * 1024 * 1024 ||
    !base64 ||
    !base64.match(/^[A-Za-z0-9+/]*={0,2}$/)
  )
    fail(400, "Invalid document encoding or size.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 16)
    fail(400, "Documents must be under 5 MB.");
  let mime = "";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = "image/png";
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    mime = "image/jpeg";
  else if (bytes.subarray(0, 5).toString() === "%PDF-")
    mime = "application/pdf";
  if (!mime || b.mimeType !== mime)
    fail(
      400,
      "Only JPEG, PNG and PDF documents with matching content are accepted.",
    );
  const key = randomUUID();
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await writeFile(path.join(privateRoot, key), bytes, {
    mode: 0o600,
    flag: "wx",
  });
  let oldKey: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      const p = await locked(tx, userId);
      editable(p.verificationStatus);
      oldKey = p.documents.find((d) => d.kind === kind)?.storageKey;
      await tx.mechanicDocument.upsert({
        where: { profileId_kind: { profileId: p.id, kind } },
        create: {
          profileId: p.id,
          kind,
          fileName: text(b.fileName, 150) || "document",
          mimeType: mime,
          size: bytes.length,
          storageKey: key,
        },
        update: {
          fileName: text(b.fileName, 150) || "document",
          mimeType: mime,
          size: bytes.length,
          storageKey: key,
        },
      });
      await event(tx, userId, p.id, "MECHANIC_DOCUMENT_UPLOADED", kind);
      if (p.submittedAt) {
        const applicant = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { fullName: true },
        });
        await notifyAdmins(
          tx,
          userId,
          "DOCUMENT_UPDATED",
          "Mechanic document updated",
          applicant.fullName + " updated an application document.",
        );
      }
    });
  } catch (e) {
    await unlink(path.join(privateRoot, key)).catch(() => {});
    throw e;
  }
  if (oldKey) await unlink(path.join(privateRoot, oldKey)).catch(() => {});
  res.status(201).json({ success: true, profile: await view(userId) });
});
router.post("/me/submit", async (req, res) => {
  const userId = own(res);
  if (req.body?.acceptPrivacy !== true)
    fail(400, "Confirm the privacy statement before submitting.");
  await prisma.$transaction(async (tx) => {
    const p = await locked(tx, userId);
    editable(p.verificationStatus);
    if (!completeProfile(p) || !completeDocuments(p))
      fail(
        400,
        "Complete your professional information, service options, identity, certificate and workshop proof (if applicable) first.",
      );
    await tx.mechanicProfile.update({
      where: { id: p.id },
      data: {
        verificationStatus: "PENDING",
        submittedAt: new Date(),
        submissionVersion: { increment: 1 },
        reviewNotes: null,
        reviewedAt: null,
        reviewedById: null,
        interviewResult: null,
        interviewNotes: null,
        interviewedAt: null,
        interviewedById: null,
      },
    });
    const applicant = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fullName: true },
    });
    await notifyAdmins(
      tx,
      userId,
      "APPLICATION_SUBMITTED",
      "New mechanic application",
      applicant.fullName + " submitted an application for professional review.",
    );
    await event(
      tx,
      userId,
      p.id,
      "MECHANIC_SUBMITTED",
      "Submitted for professional review",
    );
    await tx.notification.create({
      data: {
        userId,
        relatedUserId: userId,
        title: "Application submitted",
        body: "Your mechanic application is under review. You cannot receive services until it is approved.",
      },
    });
  });
  res.json({ success: true, profile: await view(userId) });
});
router.get("/me/service-access", requireVerifiedMechanic, (_req, res) =>
  res.json({ success: true, canReceiveServices: true }),
);
router.get("/notifications", async (_req, res) =>
  res.json({
    success: true,
    notifications: await prisma.notification.findMany({
      where: { userId: res.locals.authUser.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  }),
);
router.post("/notifications/:id/read", async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: res.locals.authUser.id },
    data: { readAt: new Date() },
  });
  res.json({ success: true });
});
router.get("/documents/:id", async (req, res) => {
  const d = await prisma.mechanicDocument.findUnique({
    where: { id: String(req.params.id) },
    include: { profile: { select: { id: true, userId: true } } },
  });
  if (!d) fail(404, "Document not found.");
  const u = res.locals.authUser;
  if (d.profile.userId !== u.id) {
    await new Promise<void>((resolve, reject) => {
      reviewer(req, res, (err) => (err ? reject(err) : resolve())).catch(
        reject,
      );
    });
  }
  const bytes = await readFile(path.join(privateRoot, d.storageKey));
  await prisma.auditLog.create({
    data: {
      actorId: u.id,
      targetId: d.profile.id,
      action: "MECHANIC_DOCUMENT_VIEWED",
      details: { documentId: d.id, kind: d.kind },
    },
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({
    success: true,
    document: {
      id: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      base64: bytes.toString("base64"),
    },
  });
});
router.get("/admin", reviewer, async (req, res) => {
  const status = text(req.query.status, 30);
  const allowed = [
    "PENDING",
    "NEEDS_COMPLETION",
    "VERIFIED",
    "REJECTED",
    "SUSPENDED",
  ];
  if (status && !allowed.includes(status))
    fail(400, "Invalid application status.");
  const cursor =
    typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  if (
    cursor &&
    !(await prisma.mechanicProfile.findFirst({
      where: { id: cursor, submittedAt: { not: null } },
    }))
  )
    fail(400, "Invalid application cursor.");
  const profiles = await prisma.mechanicProfile.findMany({
    where: {
      submittedAt: { not: null },
      ...(status ? { verificationStatus: status as "PENDING" } : {}),
    },
    select: {
      id: true,
      userId: true,
      city: true,
      specializations: true,
      verificationStatus: true,
      submittedAt: true,
      interviewResult: true,
      yearsOfExperience: true,
      offersWorkshop: true,
      offersOnSite: true,
      offersOnline: true,
      submissionVersion: true,
      documents: { select: { id: true, kind: true } },
      tests: {
        orderBy: [{ submissionVersion: "desc" }, { attempt: "desc" }],
        take: 1,
        select: {
          id: true,
          submissionVersion: true,
          submittedAt: true,
          reviewedAt: true,
          score: true,
          assessment: true,
        },
      },
      user: { select: ownerSelect },
    },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take: 101,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const counts = await prisma.mechanicProfile.groupBy({
    by: ["verificationStatus"],
    where: { submittedAt: { not: null } },
    _count: { _all: true },
  });
  const pendingSummaries = await prisma.mechanicProfile.findMany({
    where: { verificationStatus: "PENDING", submittedAt: { not: null } },
    select: {
      submissionVersion: true,
      tests: {
        orderBy: [{ submissionVersion: "desc" }, { attempt: "desc" }],
        take: 1,
        select: { submissionVersion: true, submittedAt: true },
      },
    },
  });
  const workflowCounts = { NEW: 0, AWAITING_TEST: 0, READY: 0 };
  for (const profile of pendingSummaries) {
    const test = profile.tests.find(
      (t) => t.submissionVersion === profile.submissionVersion,
    );
    workflowCounts[
      test?.submittedAt ? "READY" : test ? "AWAITING_TEST" : "NEW"
    ]++;
  }
  res.json({
    success: true,
    workflowCounts,
    profiles: profiles.slice(0, 100),
    nextCursor: profiles.length > 100 ? profiles[99].id : null,
    counts: Object.fromEntries(
      counts.map((c) => [c.verificationStatus, c._count._all]),
    ),
  });
});
router.get("/admin/:userId", reviewer, async (req, res) =>
  res.json({ success: true, profile: await view(String(req.params.userId)) }),
);
router.post("/admin/:userId/interview", reviewer, async (req, res) => {
  const result = text(req.body?.result, 10),
    notes = text(req.body?.notes);
  if (!["PASSED", "FAILED"].includes(result) || notes.length < 5)
    fail(400, "Record a result and professional interview notes.");
  await prisma.$transaction(async (tx) => {
    const p = await locked(tx, String(req.params.userId));
    if (p.verificationStatus !== "PENDING")
      fail(409, "Only pending applications can be interviewed.");
    if (req.body?.submissionVersion !== p.submissionVersion)
      fail(409, "The application changed. Refresh before reviewing.");
    await tx.mechanicProfile.update({
      where: { id: p.id },
      data: {
        interviewResult: result,
        interviewNotes: notes,
        interviewedAt: new Date(),
        interviewedById: res.locals.authUser.id,
      },
    });
    await event(
      tx,
      res.locals.authUser.id,
      p.id,
      "MECHANIC_INTERVIEW_" + result,
      notes,
    );
  });
  res.json({ success: true, profile: await view(String(req.params.userId)) });
});
router.post("/admin/:userId/decision", reviewer, async (req, res) => {
  const action = text(req.body?.action, 30),
    notes = text(req.body?.notes);
  if (
    ![
      "APPROVE",
      "NEEDS_COMPLETION",
      "REJECT",
      "SUSPEND",
      "REACTIVATE",
    ].includes(action)
  )
    fail(400, "Invalid decision.");
  if (action !== "APPROVE" && action !== "REACTIVATE" && notes.length < 5)
    fail(400, "Explain the required changes or decision.");
  await prisma.$transaction(async (tx) => {
    const p = await locked(tx, String(req.params.userId));
    if (req.body?.submissionVersion !== p.submissionVersion)
      fail(409, "The application changed. Refresh before reviewing.");
    if (
      ["APPROVE", "NEEDS_COMPLETION", "REJECT"].includes(action) &&
      p.verificationStatus !== "PENDING"
    )
      fail(409, "This application has already been reviewed.");
    if (action === "SUSPEND" && p.verificationStatus !== "VERIFIED")
      fail(409, "Only verified mechanics can be suspended.");
    if (action === "REACTIVATE" && p.verificationStatus !== "SUSPENDED")
      fail(409, "Only suspended mechanics can be reactivated.");
    if (
      action === "APPROVE" &&
      (!completeProfile(p) ||
        !completeDocuments(p) ||
        p.interviewResult !== "PASSED")
    )
      fail(
        400,
        "Complete all required information, upload the required documents and pass the professional interview first.",
      );
    // New test-based reviews must be complete and refer to the current submission.
    // Existing interview-based applications remain compatible.
    if (action === "APPROVE") {
      const latest = await tx.mechanicTest.findFirst({
        where: { profileId: p.id, submissionVersion: p.submissionVersion },
        orderBy: { attempt: "desc" },
      });
      if (latest) {
        if (
          !latest.submittedAt ||
          !latest.reviewedAt ||
          latest.assessment !== "PASSED"
        )
          fail(400, "Review the current professional test before approving.");
        const reviews = await tx.mechanicDocumentReview.findMany({
          where: { profileId: p.id },
        });
        const required = [
          "IDENTITY",
          "CERTIFICATE",
          ...(p.offersWorkshop ? ["WORKSHOP_PROOF"] : []),
        ];
        if (
          required.some(
            (kind) =>
              !p.documents.some(
                (d) =>
                  d.kind === kind &&
                  reviews.some(
                    (r) =>
                      r.documentId === d.id && r.storageKey === d.storageKey,
                  ),
              ),
          )
        )
          fail(400, "Review all current required documents before approving.");
      }
    }
    const status =
      action === "APPROVE" || action === "REACTIVATE"
        ? "VERIFIED"
        : action === "REJECT"
          ? "REJECTED"
          : action === "SUSPEND"
            ? "SUSPENDED"
            : "NEEDS_COMPLETION";
    await tx.mechanicProfile.update({
      where: { id: p.id },
      data: {
        verificationStatus: status,
        reviewNotes: notes,
        reviewedAt: new Date(),
        reviewedById: res.locals.authUser.id,
      },
    });
    await event(tx, res.locals.authUser.id, p.id, "MECHANIC_" + action, notes);
    await tx.notification.create({
      data: {
        userId: p.userId,
        relatedUserId: p.userId,
        kind: "DECISION",
        title:
          status === "VERIFIED"
            ? "Mechanic account approved"
            : status === "NEEDS_COMPLETION"
              ? "Application needs completion"
              : status === "SUSPENDED"
                ? "Mechanic services suspended"
                : "Application decision",
        body:
          notes ||
          (status === "VERIFIED"
            ? "Your professional application is approved."
            : "Your application status has changed."),
      },
    });
  });
  res.json({ success: true, profile: await view(String(req.params.userId)) });
});
router.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof MechanicError) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    console.error("Mechanic operation failed", {
      name: err instanceof Error ? err.name : "unknown",
    });
    res.status(500).json({
      success: false,
      message: "The mechanic operation could not be completed.",
    });
  },
);
export default router;
