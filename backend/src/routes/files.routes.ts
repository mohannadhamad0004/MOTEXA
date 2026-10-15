import { Router } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { PARTS_PURPOSES, PROVIDER_STORAGE_DIR, TOW_PURPOSES } from "../uploads/providerFiles.js";

// Serves provider files. Every request is resolved by id in the ProviderFile table: there is no directory
// listing and no raw storage path ever leaves the server.
const router = Router();

const notFound = (res: any) => res.status(404).json({ success: false, message: "File not found." });

async function send(res: any, file: { storageKey: string; mimeType: string }, cache: string) {
  const bytes = await readFile(path.join(PROVIDER_STORAGE_DIR, path.basename(file.storageKey)));
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", cache);
  return res.send(bytes);
}

// PUBLIC files only (truck photo, product image). No login. A private id is a 404 here.
router.get("/public/:id", async (req, res) => {
  try {
    const file = await prisma.providerFile.findFirst({ where: { id: String(req.params.id), visibility: "PUBLIC" } });
    if (!file) return notFound(res);
    return await send(res, file, "public, max-age=300");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return notFound(res);
    console.error("Public file error:", e);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// PRIVATE files: the owner, SUPER_ADMIN, or ADMIN with MANAGE_TOWING (tow files) / MANAGE_SPARE_PARTS (parts files).
router.get("/private/:id", requireAuth, async (req, res) => {
  try {
    const user = res.locals.authUser as { id: string; role: string };
    const file = await prisma.providerFile.findFirst({ where: { id: String(req.params.id), visibility: "PRIVATE" } });
    if (!file) return notFound(res);

    let allowed = file.ownerUserId === user.id || user.role === "SUPER_ADMIN";
    if (!allowed && user.role === "ADMIN") {
      const permission = (TOW_PURPOSES as readonly string[]).includes(file.purpose)
        ? "MANAGE_TOWING"
        : (PARTS_PURPOSES as readonly string[]).includes(file.purpose)
          ? "MANAGE_SPARE_PARTS"
          : null;
      allowed = !!permission && !!(await prisma.adminPermission.findUnique({ where: { adminId_permission: { adminId: user.id, permission } } }));
    }
    if (!allowed) return res.status(403).json({ success: false, message: "You do not have access to this file." });

    return await send(res, file, "private, no-store");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return notFound(res);
    console.error("Private file error:", e);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
