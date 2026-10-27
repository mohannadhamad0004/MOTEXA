// Self-registration of tow companies and parts shops. Same pattern as the mechanic registration: the account is created
// ACTIVE with a DRAFT application; the owner signs in and completes the onboarding; nothing is public until APPROVED.
import { Router, type NextFunction, type Request, type Response } from "express";
import argon2 from "argon2";
import { prisma } from "../prisma.js";
import { canonicalCity } from "../cities.js";
import { ROLE_OF, audit, fail, sendError, text, type Kind } from "../services/provider-onboarding.js";

const attempts = new Map<string, { start: number; count: number }>();
function limit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, v] of attempts) if (now - v.start > 3600000) attempts.delete(key);
  const key = req.ip || "unknown";
  const v = attempts.get(key) || { start: now, count: 0 };
  if (v.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) {
    res.status(429).json({ success: false, message: "Too many registration attempts. Try again later." });
    return;
  }
  v.count++;
  attempts.set(key, v);
  next();
}

const router = Router();
router.use(limit);

router.post("/register", async (req, res) => {
  try {
    const b = req.body ?? {};
    const kind: Kind | null = b.kind === "TOW" || b.kind === "PARTS" ? b.kind : null;
    if (!kind) return fail(400, "Choose tow company or parts shop.");
    const fullName = text(b.fullName, 120);
    const businessName = text(b.businessName, 120);
    const email = text(b.email, 254).toLowerCase();
    const phone = text(b.phoneNumber, 24);
    const city = canonicalCity(b.city);
    const password = b.password;
    if (
      fullName.length < 3 ||
      businessName.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\+?[0-9 ()-]{8,24}$/.test(phone) ||
      !city ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^\w\s]/.test(password) ||
      b.acceptTerms !== true
    )
      return fail(400, "Complete all fields. Password requires 8–128 characters, uppercase, lowercase, number and symbol.");

    const passwordHash = await argon2.hash(password);
    try {
      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          role: ROLE_OF[kind],
          status: "ACTIVE",
          ...(kind === "TOW"
            ? { towCompanyProfile: { create: { companyName: businessName, ownerName: fullName, phone, city, verificationStatus: "DRAFT" } } }
            : { partsShopProfile: { create: { shopName: businessName, ownerName: fullName, phone, city, verificationStatus: "DRAFT" } } }),
        },
        select: { id: true, towCompanyProfile: { select: { id: true } }, partsShopProfile: { select: { id: true } } },
      });
      await audit(user.id, "PROVIDER_REGISTERED", (user.towCompanyProfile ?? user.partsShopProfile)!.id, { kind });
      return res.status(201).json({
        success: true,
        userId: user.id,
        message: "Account created. Sign in to complete your application. Approval by MOTEXA is required before you can receive requests.",
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return fail(409, "Unable to create this account. If you registered before, sign in.");
      throw e;
    }
  } catch (e) {
    return sendError(res, e, "Provider registration failed");
  }
});

export default router;
