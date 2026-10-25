import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { PrismaClient } from "../generated/prisma/client.js";
import { verifyOtpHash } from "./otp.service.js";

export const RESET_AUTHORIZATION_MINUTES = 10;
export function meetsPasswordPolicy(password: string) {
  return (
    password.length >= 12 &&
    password.length <= 256 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}
export function recoveryTokenHash(token: string) {
  return createHash("sha256")
    .update("password-reset-grant:" + token)
    .digest("hex");
}

export async function verifyPasswordResetCode(
  db: PrismaClient,
  email: string,
  otp: string,
): Promise<string | null> {
  if (!/^\d{6}$/.test(otp)) return null;
  return db.$transaction(async (tx) => {
    const users = await tx.$queryRaw<
      Array<{ id: string; status: string }>
    >`SELECT "id", "status" FROM "User" WHERE "email" = ${email} FOR UPDATE`;
    const user = users[0];
    if (!user || user.status !== "ACTIVE") return null;
    const request = await tx.passwordResetRequest.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    if (
      !request ||
      !request.sentAt ||
      request.verifiedAt ||
      request.expiresAt <= now ||
      request.attempts >= request.maxAttempts
    )
      return null;
    if (!verifyOtpHash("password-reset:" + request.id, otp, request.codeHash)) {
      await tx.passwordResetRequest.update({
        where: { id: request.id },
        data: {
          attempts: { increment: 1 },
          ...(request.attempts + 1 >= request.maxAttempts
            ? { consumedAt: now }
            : {}),
        },
      });
      return null;
    }
    const grant = randomBytes(32).toString("hex");
    await tx.passwordResetRequest.update({
      where: { id: request.id },
      data: {
        verifiedAt: now,
        resetTokenHash: recoveryTokenHash(grant),
        resetExpiresAt: new Date(
          now.getTime() + RESET_AUTHORIZATION_MINUTES * 60000,
        ),
      },
    });
    return grant;
  });
}

export async function completePasswordReset(
  db: PrismaClient,
  resetToken: string,
  password: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(resetToken) || !meetsPasswordPolicy(password))
    return false;
  const hash = recoveryTokenHash(resetToken);
  const candidate = await db.passwordResetRequest.findUnique({
    where: { resetTokenHash: hash },
    select: {
      id: true,
      userId: true,
      verifiedAt: true,
      resetExpiresAt: true,
      consumedAt: true,
    },
  });
  if (
    !candidate ||
    !candidate.verifiedAt ||
    candidate.consumedAt ||
    !candidate.resetExpiresAt ||
    candidate.resetExpiresAt <= new Date()
  )
    return false;
  // Expensive hashing is outside the lock; all state is checked again inside the transaction.
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return db.$transaction(async (tx) => {
    const users = await tx.$queryRaw<
      Array<{ id: string; status: string }>
    >`SELECT "id", "status" FROM "User" WHERE "id" = ${candidate.userId} FOR UPDATE`;
    if (users[0]?.status !== "ACTIVE") return false;
    const request = await tx.passwordResetRequest.findUnique({
      where: { id: candidate.id },
    });
    const now = new Date();
    if (
      !request ||
      request.resetTokenHash !== hash ||
      !request.verifiedAt ||
      request.consumedAt ||
      !request.resetExpiresAt ||
      request.resetExpiresAt <= now
    )
      return false;
    await tx.user.update({
      where: { id: candidate.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetRequest.updateMany({
      where: { userId: candidate.userId, consumedAt: null },
      data: { consumedAt: now, resetTokenHash: null, resetExpiresAt: null },
    });
    return true;
  });
}
