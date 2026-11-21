// E-03: short access token (15 min JWT) + long refresh token (random, only its SHA-256 stored, rotated on every use).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

export const REFRESH_DAYS = 30;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function signAccessToken(user: { id: string; role: string; sessionVersion: number }) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET is missing or too short.");
  return jwt.sign({ role: user.role, sessionVersion: user.sessionVersion }, secret, { subject: user.id, expiresIn: "15m", algorithm: "HS256" });
}

async function newRefreshToken(userId: string, sessionVersion: number, familyId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.refreshToken.create({
    data: { userId, sessionVersion, familyId, tokenHash: hash(token), expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000) },
  });
  return token;
}

/** Login: a new token pair in a new family. Also drops this user's expired rows. */
export async function issueSession(user: { id: string; role: string; sessionVersion: number }) {
  await prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  return { accessToken: signAccessToken(user), refreshToken: await newRefreshToken(user.id, user.sessionVersion, randomUUID()) };
}

/** Rotate: the presented token is revoked and a new pair returned. Reuse of a revoked token revokes the whole family (theft signal). null = sign in again. */
export async function rotateSession(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: { select: { id: true, role: true, status: true, sessionVersion: true } } } });
  if (!row) return null;
  const now = new Date();
  // Claim it atomically: two parallel refreshes with the same token -> only one wins, the other counts as reuse.
  const claimed = row.revokedAt ? 0 : (await prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: now } })).count;
  if (claimed !== 1) {
    await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: now } });
    return null;
  }
  const u = row.user;
  if (row.expiresAt <= now || u.status !== "ACTIVE" || u.sessionVersion !== row.sessionVersion) return null;
  return { accessToken: signAccessToken(u), refreshToken: await newRefreshToken(u.id, u.sessionVersion, row.familyId) };
}

/** Logout: revokes the token's whole family (this device's sign-in). Unknown tokens are ignored. */
export async function revokeSession(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) }, select: { familyId: true } });
  if (row) await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * The one auth rate limiter (login failures, signup attempts), stored in the RateLimit table so it survives restarts and is shared by
 * every backend process. Fixed window per key: blocked once `max` hits fall inside `windowMs`. `name` keeps the counters apart.
 */
export function createLimiter(name: string, max: number, windowMs: number, now = () => Date.now()) {
  const id = (key: string) => `${name}:${key}`;
  return {
    async blocked(key: string) {
      const row = await prisma.rateLimit.findUnique({ where: { key: id(key) } });
      return !!row && now() - row.windowStart.getTime() < windowMs && row.count >= max;
    },
    /** Counts one hit (atomic). true = this hit is still inside the limit. */
    async hit(key: string) {
      const at = new Date(now()), expired = new Date(now() - windowMs);
      // cleanup on use: this limiter's rows whose window is over count nothing any more
      await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `${name}:` }, windowStart: { lte: expired } } });
      const [row] = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${id(key)}, ${at}, 1)
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "RateLimit"."windowStart" <= ${expired} THEN 1 ELSE "RateLimit"."count" + 1 END,
          "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${expired} THEN ${at} ELSE "RateLimit"."windowStart" END
        RETURNING "count"`;
      return row.count <= max;
    },
    clear: async (key: string) => void (await prisma.rateLimit.deleteMany({ where: { key: id(key) } })),
  };
}
