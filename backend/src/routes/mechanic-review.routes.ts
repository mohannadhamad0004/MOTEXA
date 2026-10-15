import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireMechanicsAdmin } from "../middleware/auth.middleware.js";

// Admin review of mechanic applications. Every route enforces SUPER_ADMIN or
// ADMIN + MANAGE_MECHANICS on the server; the mobile gate is only UX.
const router = Router();
router.use(requireAuth, requireMechanicsAdmin);

const STATUSES = ["PENDING_REVIEW", "NEEDS_CORRECTION", "MANUAL_REVIEW", "READY_FOR_AUTHORITY", "REJECTED"] as const;
const OBSERVATIONS = [
  "NOT_REVIEWED",
  "INFORMATION_MATCHES",
  "MISSING_INFORMATION",
  "DOCUMENT_UNREADABLE",
  "EXPIRED",
  "MANUAL_REVIEW_REQUIRED",
] as const;
// Observations that mean something is still unresolved; they block READY_FOR_AUTHORITY.
const BLOCKING = ["MISSING_INFORMATION", "DOCUMENT_UNREADABLE", "EXPIRED"];

const text = (v: unknown, max = 1000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idParam = (v: unknown) => String(v);

const log = (actorId: string, applicationId: string, action: string, reason?: string | null, details?: object) =>
  prisma.auditLog.create({
    data: { actorId, action, targetId: applicationId, details: { reason: reason ?? null, ...details } },
  });

// List. ?status=PENDING_REVIEW|... & ?q= (name, email, application id, licence number)
router.get("/", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return res.status(400).json({ success: false, message: "Invalid status filter." });
    }
    const rows = await prisma.mechanicApplication.findMany({
      where: {
        ...(status ? { reviewStatus: status as (typeof STATUSES)[number] } : {}),
        ...(q
          ? {
              OR: [
                { id: { startsWith: q.toLowerCase() } },
                { licenceNumber: { contains: q, mode: "insensitive" } },
                { user: { fullName: { contains: q, mode: "insensitive" } } },
                { user: { email: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { submittedAt: "desc" },
      include: { user: { select: { fullName: true, email: true, status: true } }, skills: { select: { name: true, status: true } } },
    });
    return res.json({
      success: true,
      applications: rows.map((a) => ({
        id: a.id,
        applicantName: a.user.fullName,
        email: a.user.email,
        accountStatus: a.user.status,
        workshopName: a.workshopName,
        skills: a.skills.map((s) => s.name),
        submittedAt: a.submittedAt,
        reviewStatus: a.reviewStatus,
      })),
    });
  } catch (error) {
    console.error("Mechanic list error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Detail. Document entries carry metadata only: never storage keys or file URLs.
router.get("/:id", async (req, res) => {
  try {
    const a = await prisma.mechanicApplication.findUnique({
      where: { id: idParam(req.params.id) },
      include: {
        user: { select: { fullName: true, email: true, status: true } },
        skills: { orderBy: { name: "asc" } },
        documents: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!a) return res.status(404).json({ success: false, message: "Application not found." });

    const events = await prisma.auditLog.findMany({
      where: { targetId: a.id, action: { startsWith: "MECHANIC_APPLICATION_" } },
      orderBy: { createdAt: "asc" },
    });
    const actors = await prisma.user.findMany({
      where: { id: { in: [...new Set(events.map((e) => e.actorId).filter((x): x is string => !!x))] } },
      select: { id: true, fullName: true },
    });
    const name = new Map(actors.map((u) => [u.id, u.fullName]));

    // The submission itself is a real fact stored on the application; admin actions come from AuditLog.
    const history = [
      { at: a.submittedAt, actor: a.user.fullName, action: "SUBMITTED", reason: null as string | null, skill: null as string | null, observation: null as string | null },
      ...events.map((e) => ({
        at: e.createdAt,
        actor: (e.actorId && name.get(e.actorId)) || "Admin",
        action: e.action.replace("MECHANIC_APPLICATION_", ""),
        reason: ((e.details as { reason?: string | null } | null)?.reason ?? null) as string | null,
        skill: ((e.details as { skill?: string } | null)?.skill ?? null) as string | null,
        observation: ((e.details as { observation?: string } | null)?.observation ?? null) as string | null,
      })),
    ];

    return res.json({
      success: true,
      application: {
        id: a.id,
        reviewStatus: a.reviewStatus,
        reviewReason: a.reviewReason,
        submittedAt: a.submittedAt,
        account: { fullName: a.user.fullName, email: a.user.email, status: a.user.status },
        profile: { phone: a.phone, city: a.city },
        workshop: {
          name: a.workshopName,
          address: a.workshopAddress,
          preReview: a.workshopPreReview,
          preReviewNote: a.workshopPreReviewNote,
        },
        licence: {
          number: a.licenceNumber,
          holderName: a.licenceHolderName,
          issuingAuthority: a.issuingAuthority,
          issueDate: a.licenceIssueDate,
          expiryDate: a.licenceExpiryDate,
          preReview: a.professionalPreReview,
          preReviewNote: a.professionalPreReviewNote,
        },
        skills: a.skills.map((s) => ({ id: s.id, name: s.name, status: s.status, rejectionReason: s.rejectionReason })),
        documents: a.documents.map((d) => ({ id: d.id, kind: d.kind, title: d.title, mimeType: d.mimeType, sizeBytes: d.sizeBytes })),
        authorization: { accepted: a.authorizationAccepted, acceptedAt: a.authorizationAcceptedAt },
        history,
      },
    });
  } catch (error) {
    console.error("Mechanic detail error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Review decision on the whole application.
// body: { action: NEEDS_CORRECTION | MANUAL_REVIEW | READY_FOR_AUTHORITY | REJECT, reason?: string }
router.patch("/:id/review", async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const action = req.body?.action;
    const reason = text(req.body?.reason);
    const bad = (code: number, message: string) => res.status(code).json({ success: false, message });

    const a = await prisma.mechanicApplication.findUnique({
      where: { id: idParam(req.params.id) },
      include: { documents: { select: { kind: true } } },
    });
    if (!a) return bad(404, "Application not found.");
    if (a.reviewStatus === "REJECTED") return bad(409, "This application was rejected and can no longer be reviewed.");

    if (action === "NEEDS_CORRECTION" || action === "REJECT") {
      if (!reason) return bad(400, "A reason is required.");
    }

    if (action === "READY_FOR_AUTHORITY") {
      const missing: string[] = [];
      if (!a.authorizationAccepted || !a.authorizationAcceptedAt) missing.push("verification authorization was not accepted");
      if (!a.licenceNumber || !a.licenceHolderName || !a.issuingAuthority) missing.push("licence information is incomplete");
      if (!a.documents.some((d) => d.kind === "LICENCE")) missing.push("licence document is missing");
      if (!a.workshopName || !a.workshopAddress || !a.phone || !a.city) missing.push("application information is incomplete");
      if (BLOCKING.includes(a.professionalPreReview) || BLOCKING.includes(a.workshopPreReview))
        missing.push("a pre-review observation is still unresolved");
      if (missing.length) return bad(422, `Cannot mark ready for authority: ${missing.join("; ")}.`);
    }

    const next = {
      NEEDS_CORRECTION: "NEEDS_CORRECTION",
      MANUAL_REVIEW: "MANUAL_REVIEW",
      READY_FOR_AUTHORITY: "READY_FOR_AUTHORITY",
      REJECT: "REJECTED",
    }[action as string] as (typeof STATUSES)[number] | undefined;
    if (!next) return bad(400, "Invalid action.");

    // Only REJECT touches the account status; every other state leaves the account PENDING.
    await prisma.$transaction([
      prisma.mechanicApplication.update({ where: { id: a.id }, data: { reviewStatus: next, reviewReason: reason } }),
      ...(next === "REJECTED" ? [prisma.user.update({ where: { id: a.userId }, data: { status: "REJECTED" } })] : []),
      log(actor.id, a.id, `MECHANIC_APPLICATION_${next}`, reason),
    ]);
    return res.json({ success: true, reviewStatus: next });
  } catch (error) {
    console.error("Mechanic review error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Individual skill review. body: { status: APPROVED | REJECTED, reason? } (reason required for REJECTED)
router.patch("/:id/skills/:skillId", async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const status = req.body?.status;
    const reason = text(req.body?.reason);
    if (status !== "APPROVED" && status !== "REJECTED") return res.status(400).json({ success: false, message: "Invalid status." });
    if (status === "REJECTED" && !reason) return res.status(400).json({ success: false, message: "A reason is required." });

    const skill = await prisma.mechanicSkillApplication.findFirst({
      where: { id: idParam(req.params.skillId), applicationId: idParam(req.params.id) },
      include: { application: { select: { reviewStatus: true } } },
    });
    if (!skill) return res.status(404).json({ success: false, message: "Skill not found." });
    if (skill.application.reviewStatus === "REJECTED")
      return res.status(409).json({ success: false, message: "This application was rejected and can no longer be reviewed." });

    // Only this one row changes.
    await prisma.$transaction([
      prisma.mechanicSkillApplication.update({
        where: { id: skill.id },
        data: { status, rejectionReason: status === "REJECTED" ? reason : null },
      }),
      log(actor.id, skill.applicationId, `MECHANIC_APPLICATION_SKILL_${status}`, status === "REJECTED" ? reason : null, { skill: skill.name }),
    ]);
    return res.json({ success: true, status });
  } catch (error) {
    console.error("Skill review error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Pre-review observation for the person (PROFESSIONAL) or the workshop. Not a verification result.
// body: { target: PROFESSIONAL | WORKSHOP, observation, note? }
router.patch("/:id/pre-review", async (req, res) => {
  try {
    const actor = res.locals.authUser as { id: string };
    const { target, observation } = req.body ?? {};
    const note = text(req.body?.note);
    if ((target !== "PROFESSIONAL" && target !== "WORKSHOP") || !OBSERVATIONS.includes(observation))
      return res.status(400).json({ success: false, message: "Invalid observation." });

    const a = await prisma.mechanicApplication.findUnique({ where: { id: idParam(req.params.id) }, select: { id: true, reviewStatus: true } });
    if (!a) return res.status(404).json({ success: false, message: "Application not found." });
    if (a.reviewStatus === "REJECTED")
      return res.status(409).json({ success: false, message: "This application was rejected and can no longer be reviewed." });

    await prisma.$transaction([
      prisma.mechanicApplication.update({
        where: { id: a.id },
        data:
          target === "PROFESSIONAL"
            ? { professionalPreReview: observation, professionalPreReviewNote: note }
            : { workshopPreReview: observation, workshopPreReviewNote: note },
      }),
      log(actor.id, a.id, `MECHANIC_APPLICATION_PRE_REVIEW_${target}`, note, { observation }),
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error("Pre-review error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
