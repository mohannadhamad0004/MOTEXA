import { Router } from "express";
import { prisma } from "../prisma.js";
import { sendPasswordResetOtpEmail } from "../services/email.service.js";
import {
  createPasswordResetStore,
  createResetIpLimiter,
  createResetQueue,
  requestPasswordReset,
  RESET_RESPONSE,
} from "../services/password-reset.service.js";
import {
  verifyPasswordResetCode,
  completePasswordReset,
  meetsPasswordPolicy,
  RESET_AUTHORIZATION_MINUTES,
} from "../services/password-reset-completion.service.js";

const store = createPasswordResetStore(prisma);
const allow = createResetIpLimiter(),
  allowVerify = createResetIpLimiter(),
  allowReset = createResetIpLimiter();
const enqueue = createResetQueue(() =>
  console.error("Password recovery delivery failed."),
);
type Dependencies = {
  allow: (ip: string) => boolean;
  enqueue: (job: () => Promise<void>) => boolean;
  request: (email: string) => Promise<void>;
  verify?: (email: string, otp: string) => Promise<string | null>;
  reset?: (token: string, password: string) => Promise<boolean>;
  allowVerify?: (ip: string) => boolean;
  allowReset?: (ip: string) => boolean;
};
const normalEmail = (raw: unknown) =>
  typeof raw === "string" &&
  raw.trim().length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())
    ? raw.trim().toLowerCase()
    : null;
export function createPasswordResetRouter(deps: Dependencies) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post("/request-otp", (req, res) => {
    const email = normalEmail(req.body?.email);
    if (!email)
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Enter a valid email address.",
      });
    if (!deps.allow(req.ip || req.socket.remoteAddress || "unknown")) {
      res.set("Retry-After", "3600");
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Too many recovery requests. Please try again later.",
      });
    }
    if (!deps.enqueue(() => deps.request(email)))
      return res.status(503).json({
        success: false,
        code: "RECOVERY_BUSY",
        message: "Recovery is temporarily busy. Please try again shortly.",
      });
    return res.status(202).json(RESET_RESPONSE);
  });
  router.post("/verify-otp", async (req, res) => {
    const email = normalEmail(req.body?.email),
      otp = req.body?.otp;
    if (!email || typeof otp !== "string" || !/^\d{6}$/.test(otp))
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST",
        message: "Enter a valid email and six-digit code.",
      });
    if (
      !(deps.allowVerify || deps.allow)(
        req.ip || req.socket.remoteAddress || "unknown",
      )
    )
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again later.",
      });
    try {
      const resetToken = await deps.verify?.(email, otp);
      if (!resetToken)
        return res.status(401).json({
          success: false,
          code: "RESET_CODE_INVALID",
          message:
            "The code is invalid or expired. Request a new code if needed.",
        });
      return res.json({
        success: true,
        resetToken,
        expiresInMinutes: RESET_AUTHORIZATION_MINUTES,
      });
    } catch {
      return res.status(503).json({
        success: false,
        code: "RECOVERY_BUSY",
        message: "Recovery is temporarily unavailable.",
      });
    }
  });
  router.post("/reset", async (req, res) => {
    const { resetToken, password } = req.body ?? {};
    if (typeof resetToken !== "string" || !/^[a-f0-9]{64}$/i.test(resetToken))
      return res.status(401).json({
        success: false,
        code: "RESET_TOKEN_INVALID",
        message: "Verification expired. Request a new recovery code.",
      });
    if (typeof password !== "string" || !meetsPasswordPolicy(password))
      return res.status(400).json({
        success: false,
        code: "PASSWORD_POLICY",
        message:
          "Use 12 to 256 characters with uppercase, lowercase, a number and a symbol.",
      });
    if (
      !(deps.allowReset || deps.allow)(
        req.ip || req.socket.remoteAddress || "unknown",
      )
    )
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again later.",
      });
    try {
      if (!(await deps.reset?.(resetToken, password)))
        return res.status(401).json({
          success: false,
          code: "RESET_TOKEN_INVALID",
          message: "Verification expired. Request a new recovery code.",
        });
      return res.json({
        success: true,
        message: "Password updated. Sign in with your new password.",
      });
    } catch {
      return res.status(503).json({
        success: false,
        code: "RECOVERY_BUSY",
        message: "Recovery is temporarily unavailable.",
      });
    }
  });
  return router;
}
export default createPasswordResetRouter({
  allow,
  allowVerify,
  allowReset,
  enqueue,
  request: (email) =>
    requestPasswordReset(email, store, sendPasswordResetOtpEmail),
  verify: (email, otp) => verifyPasswordResetCode(prisma, email, otp),
  reset: (token, password) => completePasswordReset(prisma, token, password),
});
