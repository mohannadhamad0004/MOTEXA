import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import argon2 from "argon2";
import { prisma } from "../prisma.js";
import { fail, MechanicError, text } from "../services/mechanic-policy.js";

// Independent self-registration. Administrator invitation/email services are not used here.
const attempts = new Map<string, { start: number; count: number }>();
function limit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  for (const [key, v] of attempts)
    if (now - v.start > 3600000) attempts.delete(key);
  const key = req.ip || "unknown",
    v = attempts.get(key) || { start: now, count: 0 };
  if (v.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) {
    res.status(429).json({
      success: false,
      message: "Too many registration attempts. Try again later.",
    });
    return;
  }
  v.count++;
  attempts.set(key, v);
  next();
}
export function createMechanicRegistrationRouter() {
  const router = Router();
  router.use(limit);
  router.post("/register", async (req, res) => {
    const b = req.body ?? {},
      fullName = text(b.fullName, 120),
      email = text(b.email, 254).toLowerCase(),
      phoneNumber = text(b.phoneNumber, 24),
      city = text(b.city, 80),
      password = b.password;
    if (
      fullName.length < 3 ||
      !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ||
      !phoneNumber.match(/^\+?[0-9 ()-]{8,24}$/) ||
      city.length < 2 ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^\w\s]/.test(password) ||
      b.acceptTerms !== true
    )
      fail(
        400,
        "Complete all fields. Password requires 8–128 characters, uppercase, lowercase, number and symbol.",
      );
    if (b.role && b.role !== "MECHANIC")
      fail(400, "This registration is for mechanics only.");
    const passwordHash = await argon2.hash(password);
    try {
      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          role: "MECHANIC",
          status: "ACTIVE",
          mechanicProfile: {
            create: {
              phoneNumber,
              city,
              specializations: [],
              verificationStatus: "DRAFT",
              termsAcceptedAt: new Date(),
            },
          },
        },
        select: { id: true },
      });
      res.status(201).json({
        success: true,
        userId: user.id,
        message:
          "Account created. Sign in to complete your mechanic application. Professional approval is still required.",
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002")
        fail(
          409,
          "Unable to create this account. If you registered before, sign in.",
        );
      throw e;
    }
  });
  router.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof MechanicError) {
        res.status(err.status).json({ success: false, message: err.message });
        return;
      }
      console.error("Mechanic registration failed", {
        name: err instanceof Error ? err.name : "unknown",
      });
      res.status(500).json({
        success: false,
        message: "Registration could not be completed.",
      });
    },
  );
  return router;
}
export default createMechanicRegistrationRouter();
