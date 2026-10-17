
import { Router } from "express";
import argon2 from "argon2";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const router = Router();

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

   const user = await prisma.user.findUnique({
  where: { email: email.trim().toLowerCase() },
  include: {
    adminPermissions: {
      select: {
        permission: true,
      },
    },
  },
});

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const validPassword = await argon2.verify(
      user.passwordHash,
      password
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This account is not active.",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET is missing or too short.");
    }

    const token = jwt.sign(
      { role: user.role },
      secret,
      {
        subject: user.id,
        expiresIn: "15m",
        algorithm: "HS256",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken: token,
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

    if (
      user.role !== "SUPER_ADMIN" &&
      user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required.",
      });
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

