import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  generateOtp,
  hashOtp,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "./otp.service.js";

export const RESET_TTL_MINUTES = OTP_EXPIRY_MINUTES;
export const RESET_RESPONSE = {
  success: true,
  message:
    "If this email belongs to an eligible MOTEXA account, a verification code will be sent.",
  expiresInMinutes: RESET_TTL_MINUTES,
  resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
} as const;
export type ResetEmail = { to: string; fullName: string; otp: string };
type Challenge = { id: string; email: string; fullName: string; otp: string };
export interface PasswordResetStore {
  reserve(email: string): Promise<Challenge | null>;
  markDelivered(id: string): Promise<void>;
  invalidate(id: string): Promise<void>;
}

/** Separate purpose binding: invitation OTP hashes cannot validate a password reset. */
export function hashPasswordResetOtp(id: string, otp: string) {
  return hashOtp("password-reset:" + id, otp);
}

export function createPasswordResetStore(db: PrismaClient): PasswordResetStore {
  return {
    async reserve(email) {
      return db.$transaction(async (tx) => {
        // Serialise requests for the same account, including requests from different server processes.
        const users = await tx.$queryRaw<
          Array<{ id: string; email: string; fullName: string; status: string }>
        >`
     SELECT "id", "email", "fullName", "status" FROM "User" WHERE "email" = ${email} FOR UPDATE
    `;
        const user = users[0];
        if (!user || user.status !== "ACTIVE") return null;
        const now = new Date();
        const latest = await tx.passwordResetRequest.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
        if (
          latest &&
          now.getTime() - latest.createdAt.getTime() <
            OTP_RESEND_COOLDOWN_SECONDS * 1000
        )
          return null;
        const count = await tx.passwordResetRequest.count({
          where: {
            userId: user.id,
            createdAt: { gte: new Date(now.getTime() - 3600000) },
          },
        });
        if (count >= OTP_MAX_REQUESTS_PER_HOUR) return null;
        const id = randomUUID(),
          otp = generateOtp();
        await tx.passwordResetRequest.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: now },
        });
        await tx.passwordResetRequest.create({
          data: {
            id,
            userId: user.id,
            codeHash: hashPasswordResetOtp(id, otp),
            expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60000),
            maxAttempts: OTP_MAX_ATTEMPTS,
          },
        });
        return { id, email: user.email, fullName: user.fullName, otp };
      });
    },
    async markDelivered(id) {
      await db.passwordResetRequest.update({
        where: { id },
        data: { sentAt: new Date() },
      });
    },
    async invalidate(id) {
      await db.passwordResetRequest.update({
        where: { id },
        data: { consumedAt: new Date() },
      });
    },
  };
}

/** Does not change passwords, roles, account state, invitations or login sessions. */
export async function requestPasswordReset(
  email: string,
  store: PasswordResetStore,
  send: (input: ResetEmail) => Promise<unknown>,
) {
  const challenge = await store.reserve(email);
  if (!challenge) return;
  try {
    await send({
      to: challenge.email,
      fullName: challenge.fullName,
      otp: challenge.otp,
    });
    await store.markDelivered(challenge.id);
  } catch (error) {
    await store.invalidate(challenge.id);
    throw error;
  }
}

/** Bounded, in-process admission limit; durable per-account limits live in PostgreSQL. */
export function createResetIpLimiter(now = () => Date.now()) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string) => {
    const time = now();
    for (const [ip, value] of windows)
      if (time - value.start >= 3600000) windows.delete(ip);
    let window = windows.get(key);
    if (!window) {
      if (windows.size >= 10000) return false;
      window = { start: time, count: 0 };
      windows.set(key, window);
    }
    if (window.count >= 20) return false;
    window.count++;
    return true;
  };
}

/** Replies need not wait for mail delivery, avoiding account-existence timing differences. */
export function createResetQueue(
  onError: () => void,
  concurrency = 2,
  capacity = 100,
) {
  const waiting: Array<() => Promise<void>> = [];
  let active = 0;
  const run = () => {
    while (active < concurrency && waiting.length) {
      const job = waiting.shift()!;
      active++;
      Promise.resolve()
        .then(job)
        .catch(onError)
        .finally(() => {
          active--;
          run();
        });
    }
  };
  return (job: () => Promise<void>) => {
    if (waiting.length + active >= capacity) return false;
    waiting.push(job);
    setImmediate(run);
    return true;
  };
}
