import { Router } from "express";
import express from "express";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { requireAuth, requireMechanicsAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// DEV STORAGE: private files live on local disk, outside any static route. Replace with real
// object storage (private bucket + signed URLs) before production.
const STORAGE_DIR = path.resolve(process.cwd(), "storage", "mechanic-documents");
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENTS = 8;
const ALLOWED_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

// Public endpoint carrying base64 images: raise the JSON limit for this router only.
router.use(express.json({ limit: "20mb" }));

const str = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

const parseDate = (v: unknown) => {
  if (v === undefined || v === null || v === "") return { ok: true as const, date: null };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false as const };
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? { ok: false as const } : { ok: true as const, date: d };
};

type DocInput = { kind: "LICENCE" | "CERTIFICATE"; title: string; mimeType: string; buffer: Buffer };

router.post("/", async (req, res) => {
  const b = req.body ?? {};
  const bad = (message: string) => res.status(400).json({ success: false, message });

  const fullName = str(b.fullName);
  const email = str(b.email)?.toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const phone = str(b.phone, 30);
  const city = str(b.city);
  const workshopName = str(b.workshopName);
  const workshopAddress = str(b.workshopAddress);
  const licenceNumber = str(b.licenceNumber, 100);
  const licenceHolderName = str(b.licenceHolderName);
  const issuingAuthority = str(b.issuingAuthority);

  if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Valid name and email are required.");
  if (password.length < 8 || password.length > 200) return bad("Password must contain at least 8 characters.");
  if (!phone || !city) return bad("Phone and city are required.");
  if (!workshopName || !workshopAddress) return bad("Workshop name and address are required.");
  if (!licenceNumber || !licenceHolderName || !issuingAuthority) return bad("Licence number, holder name and issuing authority are required.");

  const issue = parseDate(b.licenceIssueDate);
  const expiry = parseDate(b.licenceExpiryDate);
  if (!issue.ok || !expiry.ok) return bad("Dates must use YYYY-MM-DD.");
  if (issue.date && expiry.date && expiry.date < issue.date) return bad("Licence expiry date cannot be before the issue date.");

  if (b.authorizationAccepted !== true) return bad("Verification authorization must be accepted.");

  const skills: string[] = Array.isArray(b.skills)
    ? [...new Set<string>((b.skills as unknown[]).map((s) => str(s, 80)).filter((s): s is string => !!s))]
    : [];
  if (!skills.length) return bad("Select at least one skill.");
  if (skills.length > 30) return bad("Too many skills.");

  const rawDocs: unknown[] = Array.isArray(b.documents) ? b.documents : [];
  if (rawDocs.length > MAX_DOCUMENTS) return bad("Too many documents.");
  const docs: DocInput[] = [];
  for (const d of rawDocs as Record<string, unknown>[]) {
    const kind = d?.kind === "LICENCE" || d?.kind === "CERTIFICATE" ? d.kind : null;
    const title = str(d?.title, 120);
    const mimeType = typeof d?.mimeType === "string" ? d.mimeType : "";
    if (!kind || !title || !ALLOWED_MIME[mimeType] || typeof d?.dataBase64 !== "string") return bad("Invalid document.");
    const buffer = Buffer.from(d.dataBase64, "base64");
    if (!buffer.length || buffer.length > MAX_FILE_BYTES) return bad("Each document must be an image of at most 5 MB.");
    docs.push({ kind, title, mimeType, buffer });
  }
  if (!docs.some((d) => d.kind === "LICENCE")) return bad("A licence / credential document is required.");

  try {
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const stored = docs.map((d) => ({ ...d, storageKey: `${randomUUID()}.${ALLOWED_MIME[d.mimeType]}` }));
    await mkdir(STORAGE_DIR, { recursive: true });
    await Promise.all(stored.map((d) => writeFile(path.join(STORAGE_DIR, d.storageKey), d.buffer)));

    // Status PENDING == pending verification. Pending accounts cannot log in (existing login rule).
    await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "MECHANIC",
        status: "PENDING",
        mechanicApplication: {
          create: {
            phone,
            city,
            workshopName,
            workshopAddress,
            licenceNumber,
            licenceHolderName,
            issuingAuthority,
            licenceIssueDate: issue.date,
            licenceExpiryDate: expiry.date,
            authorizationAccepted: true,
            authorizationAcceptedAt: new Date(),
            skills: { create: skills.map((name) => ({ name })) },
            documents: {
              create: stored.map((d) => ({
                kind: d.kind,
                title: d.title,
                mimeType: d.mimeType,
                sizeBytes: d.buffer.length,
                storageKey: d.storageKey,
              })),
            },
          },
        },
      },
    });

    return res.status(201).json({ success: true, status: "PENDING_VERIFICATION" });
  } catch (error) {
    console.error("Mechanic application error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Private document download: Super Admin, or Admin with MANAGE_MECHANICS. Never public.
router.get("/:applicationId/documents/:documentId", requireAuth, requireMechanicsAdmin, async (req, res) => {
  try {
    const doc = await prisma.mechanicApplicationDocument.findFirst({
      where: { id: String(req.params.documentId), applicationId: String(req.params.applicationId) },
    });
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });

    const file = await readFile(path.join(STORAGE_DIR, path.basename(doc.storageKey)));
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(file);
  } catch (error) {
    console.error("Document download error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
