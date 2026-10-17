import { activationDestination, activationOpenPage } from "../services/activation-link.service.js";

import { Router } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../prisma.js";
import { sendAdminOtpEmail } from "../services/email.service.js";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiryDate,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_REQUESTS_PER_HOUR,
} from "../services/otp.service.js";
const router = Router();

// Invitation handoff only; account verification remains in the existing activation endpoints.
router.get("/open-invitation", (req, res) => {
  res.set({"Cache-Control":"no-store", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff", "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
  try {
    const expoOrigin = process.env.NODE_ENV !== "production" ? process.env.EXPO_GO_BASE_URL : undefined;
    const destination = activationDestination(req.query.token, expoOrigin);
    return res.status(destination ? 200 : 400).type("html").send(activationOpenPage(destination, Boolean(expoOrigin)));
  } catch {
    return res.status(503).type("html").send(activationOpenPage(null, false));
  }
});

router.post("/request-otp", async (req, res) => {
  try {
    const { token } = req.body ?? {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation token.",
      });
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await prisma.$transaction(async (tx) => {
      const invitations = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT id
        FROM "AdminInvitation"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;

      if (invitations.length === 0) {
        return { status: "INVALID" as const };
      }

      const invitation = await tx.adminInvitation.findUnique({
        where: { id: invitations[0].id },
      });

      if (
        !invitation ||
        invitation.status !== "PENDING" ||
        invitation.expiresAt <= new Date()
      ) {
        return { status: "INVALID" as const };
      }

      const now = new Date();

      const latestOtp = await tx.adminInvitationOtp.findFirst({
        where: { invitationId: invitation.id },
        orderBy: { createdAt: "desc" },
      });

      if (
        latestOtp &&
        now.getTime() - latestOtp.createdAt.getTime() <
          OTP_RESEND_COOLDOWN_SECONDS * 1000
      ) {
        return { status: "COOLDOWN" as const };
      }

      const oneHourAgo = new Date(
        now.getTime() - 60 * 60 * 1000
      );

      const requestsLastHour =
        await tx.adminInvitationOtp.count({
          where: {
            invitationId: invitation.id,
            createdAt: { gte: oneHourAgo },
          },
        });

      if (requestsLastHour >= OTP_MAX_REQUESTS_PER_HOUR) {
        return { status: "RATE_LIMIT" as const };
      }

      const otp = generateOtp();

      await tx.adminInvitationOtp.create({
        data: {
          invitationId: invitation.id,
          codeHash: hashOtp(invitation.id, otp),
          expiresAt: getOtpExpiryDate(),
          maxAttempts: OTP_MAX_ATTEMPTS,
        },
      });

      return {
        status: "CREATED" as const,
        otp,
        email: invitation.email,
        fullName: invitation.fullName,
      };
    });

    if (result.status === "INVALID") {
      return res.status(400).json({
        success: false,
        message: "Invitation is invalid or expired.",
      });
    }

    if (result.status === "COOLDOWN") {
      return res.status(429).json({
        success: false,
        message: "Please wait 60 seconds before requesting another code.",
      });
    }

    if (result.status === "RATE_LIMIT") {
      return res.status(429).json({
        success: false,
        message: "Too many verification code requests. Try again later.",
      });
    }

    await sendAdminOtpEmail({
      to: result.email,
      fullName: result.fullName,
      otp: result.otp,
    });

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email.",
      expiresInMinutes: 5,
    });
  } catch (error) {
    console.error("Request OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to request verification code.",
    });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { token, otp } = req.body ?? {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification information.",
      });
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await prisma.$transaction(async (tx) => {
      const invitations = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT id
        FROM "AdminInvitation"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;

      if (invitations.length === 0) {
        return "INVALID_INVITATION";
      }

      const invitation = await tx.adminInvitation.findUnique({
        where: { id: invitations[0].id },
      });

      if (
        !invitation ||
        invitation.status !== "PENDING" ||
        invitation.expiresAt <= new Date()
      ) {
        return "INVALID_INVITATION";
      }

      const latestOtp = await tx.adminInvitationOtp.findFirst({
        where: { invitationId: invitation.id },
        orderBy: { createdAt: "desc" },
      });

      if (
        !latestOtp ||
        latestOtp.expiresAt <= new Date() ||
        latestOtp.consumedAt !== null
      ) {
        return "EXPIRED_OTP";
      }

      if (latestOtp.verifiedAt !== null) {
        return "ALREADY_VERIFIED";
      }

      if (latestOtp.attempts >= latestOtp.maxAttempts) {
        return "TOO_MANY_ATTEMPTS";
      }

      const valid = verifyOtpHash(
        invitation.id,
        otp,
        latestOtp.codeHash
      );

      if (!valid) {
        await tx.adminInvitationOtp.update({
          where: { id: latestOtp.id },
          data: {
            attempts: { increment: 1 },
          },
        });

        return "INVALID_OTP";
      }

      await tx.adminInvitationOtp.update({
        where: { id: latestOtp.id },
        data: { verifiedAt: new Date() },
      });

      return "VERIFIED";
    });

    if (result === "VERIFIED" || result === "ALREADY_VERIFIED") {
      return res.status(200).json({
        success: true,
        message: "Email verified successfully.",
      });
    }

    if (result === "TOO_MANY_ATTEMPTS") {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    return res.status(400).json({
      success: false,
      message:
        result === "INVALID_OTP"
          ? "Incorrect verification code."
          : "Verification code or invitation is invalid or expired.",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "OTP verification failed.",
    });
  }
});

export default router;
