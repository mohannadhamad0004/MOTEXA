import {isCurrentSession} from "../services/session-version.service.js";

import { Router } from "express";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { createFailureLimiter, issueSession, revokeSession, rotateSession } from "../services/auth-session.service.js";

const router = Router();

// Login security: failed attempts per email (5) and per IP (20) in 15 minutes; then 429 until the window ends.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const loginLimits = { email: createFailureLimiter(5, LOGIN_WINDOW_MS), ip: createFailureLimiter(20, LOGIN_WINDOW_MS) };
// Unknown email: verify against this so the reply takes as long as a wrong password (no account-existence timing leak).
const dummyHash = argon2.hash(randomBytes(16).toString("hex"));
const INVALID_LOGIN = { success: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password." };

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const emailKey = email.trim().toLowerCase();
    const ipKey = req.ip || req.socket.remoteAddress || "unknown";
    if (loginLimits.email.blocked(emailKey) || loginLimits.ip.blocked(ipKey)) {
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
      });
    }

   const user = await prisma.user.findUnique({
  where: { email: emailKey },
  include: {
    adminPermissions: {
      select: {
        permission: true,
      },
    },
  },
});

    const validPassword = await argon2
      .verify(user?.passwordHash ?? (await dummyHash), password)
      .catch(() => false);

    if (!user || !validPassword) {
      loginLimits.email.fail(emailKey);
      loginLimits.ip.fail(ipKey);
      return res.status(401).json(INVALID_LOGIN);
    }
    loginLimits.email.clear(emailKey);

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This account is not active.",
        role: user.role,
        status: user.status,
      });
    }

    const session = await issueSession(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
     user: {
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  adminPermissions:
    user.role === "ADMIN"
      ? user.adminPermissions.map((item) => item.permission)
      : [],
},
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});
/** E-03: swap a refresh token for a new pair (the old one is revoked). 401 = sign in again. */
router.post("/refresh", async (req, res) => {
  try {
    const session = await rotateSession(req.body?.refreshToken);
    if (!session) return res.status(401).json({ success: false, message: "Session expired. Sign in again." });
    return res.json({ success: true, ...session });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/** E-03: logout ends this device's sign-in on the server (works with an expired access token). */
router.post("/logout", async (req, res) => {
  try {
    await revokeSession(req.body?.refreshToken);
    return res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authorization.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is missing.");
    }

    let payload: jwt.JwtPayload | string;

    try {
      payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
      });
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        sessionVersion: true,
        adminPermissions: {
          select: {
            permission: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is not active.",
      });
    }

    if (!isCurrentSession(payload, user.sessionVersion)) {
      return res.status(401).json({success:false,message:"Session expired. Sign in again."});
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Session verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});
router.post("/admin/verify-invitation", async (req, res) => {
  try {
    const { token } = req.body ?? {};

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation token.",
      });
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const invitation = await prisma.adminInvitation.findUnique({
      where: { tokenHash },
      select: {
        email: true,
        fullName: true,
        permission: true,
        status: true,
        expiresAt: true,
      },
    });

    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invitation is invalid or expired.",
      });
    }

    return res.status(200).json({
      success: true,
      invitation: {
        email: invitation.email,
        fullName: invitation.fullName,
        permission: invitation.permission,
      },
    });
  } catch (error) {
    console.error("Verify invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify invitation.",
    });
  }
});

router.post("/admin/activate", async (req, res) => {
  try {
    const { token, password } = req.body ?? {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid activation information.",
      });
    }

    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements.",
      });
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const passwordHash = await argon2.hash(password);

    const result = await prisma.$transaction(async (tx) => {
      // Lock the invitation to prevent concurrent activation.
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "AdminInvitation"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        return { status: "INVALID_INVITATION" as const };
      }

      const invitation = await tx.adminInvitation.findUnique({
        where: { id: rows[0].id },
      });

      if (
        !invitation ||
        invitation.status !== "PENDING" ||
        invitation.expiresAt <= new Date()
      ) {
        return { status: "INVALID_INVITATION" as const };
      }

      // Only the most recently requested OTP is accepted.
      const latestOtp = await tx.adminInvitationOtp.findFirst({
        where: {
          invitationId: invitation.id,
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
      });

      if (
        !latestOtp ||
        latestOtp.verifiedAt === null ||
        latestOtp.consumedAt !== null ||
        latestOtp.expiresAt <= new Date() ||
        latestOtp.attempts >= latestOtp.maxAttempts
      ) {
        return { status: "OTP_REQUIRED" as const };
      }

      // Check for an account already using this email.
      const existingUser = await tx.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      });

      if (existingUser) {
        return { status: "ACCOUNT_EXISTS" as const };
      }

      const now = new Date();

      // Consume the verified OTP inside the transaction.
      const consumed = await tx.adminInvitationOtp.updateMany({
        where: {
          id: latestOtp.id,
          verifiedAt: { not: null },
          consumedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: latestOtp.maxAttempts },
        },
        data: {
          consumedAt: now,
        },
      });

      if (consumed.count !== 1) {
        return { status: "OTP_REQUIRED" as const };
      }

      // Claim the invitation exactly once.
      const claimed = await tx.adminInvitation.updateMany({
        where: {
          id: invitation.id,
          status: "PENDING",
          expiresAt: { gt: now },
        },
        data: {
          status: "ACCEPTED",
          acceptedAt: now,
        },
      });

      if (claimed.count !== 1) {
        throw new Error("INVITATION_ALREADY_USED");
      }

      const user = await tx.user.create({
        data: {
          fullName: invitation.fullName,
          email: invitation.email,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          adminPermissions: {
            create: {
              permission: invitation.permission,
            },
          },
        },
      });

      await tx.adminInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ADMIN_INVITATION_ACCEPTED",
          targetId: user.id,
          details: {
            invitationId: invitation.id,
            permission: invitation.permission,
            otpVerified: true,
          },
        },
      });

      return {
        status: "ACTIVATED" as const,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      };
    });

    if (result.status === "INVALID_INVITATION") {
      return res.status(400).json({
        success: false,
        message: "Invitation is invalid or expired.",
      });
    }

    if (result.status === "OTP_REQUIRED") {
      return res.status(403).json({
        success: false,
        message:
          "A valid, verified OTP is required before activation.",
      });
    }

    if (result.status === "ACCOUNT_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Administrator account activated successfully.",
      user: result.user,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVITATION_ALREADY_USED"
    ) {
      return res.status(409).json({
        success: false,
        message: "Invitation has already been used or expired.",
      });
    }

    console.error("Admin activation error:", error);

    return res.status(500).json({
      success: false,
      message: "Account activation failed.",
    });
  }
});


export default router;

