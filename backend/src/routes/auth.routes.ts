import {isCurrentSession} from "../services/session-version.service.js";

import { Router, type Request } from "express";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { createLimiter, issueSession, revokeSession, rotateSession } from "../services/auth-session.service.js";
import { generateOtp, getOtpExpiryDate, hashOtp, verifyOtpHash, OTP_MAX_ATTEMPTS, OTP_MAX_REQUESTS_PER_HOUR, OTP_RESEND_COOLDOWN_SECONDS } from "../services/otp.service.js";
import { awaitingEmail, meetsPasswordPolicy } from "../services/password-reset-completion.service.js";
import { sendAccountExistsEmail, sendSignupCodeEmail } from "../services/email.service.js";
import { applicationsOf } from "../services/applications.js";

const router = Router();

// One DB rate limiter (auth-session.service) for login and signup, per email and per IP.
// Login: 5 failures per email / 20 per IP in 15 minutes, then 429 until the window ends. Signup: 5 attempts per email / 20 per IP an hour.
const MINUTE = 60 * 1000;
export const loginLimits = { email: createLimiter("login-email", 5, 15 * MINUTE), ip: createLimiter("login-ip", 20, 15 * MINUTE) };
export const signupLimits = { email: createLimiter("signup-email", 5, 60 * MINUTE), ip: createLimiter("signup-ip", 20, 60 * MINUTE) };
const clientIp = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";
// Unknown email: verify against this so the reply takes as long as a wrong password (no account-existence timing leak).
const dummyHash = argon2.hash(randomBytes(16).toString("hex"));
const INVALID_LOGIN = { success: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password." };
const TOO_MANY_LOGINS = { success: false, code: "RATE_LIMITED", message: "Too many sign-in attempts. Please wait 15 minutes and try again." };
const bad = (code: string, message: string) => ({ success: false, code, message });

const findAccount = (email: string) => prisma.user.findUnique({ where: { email }, include: { adminPermissions: { select: { permission: true } } } });
type Account = NonNullable<Awaited<ReturnType<typeof findAccount>>>;

/** The login reply: a new session + the public user fields. */
async function signedIn(user: Account) {
  const session = await issueSession(user);
  return {
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
      adminPermissions: user.role === "ADMIN" ? user.adminPermissions.map((item) => item.permission) : [],
    },
  };
}

// ---- customer signup + email check -------------------------------------------------------------------------------------------
/** Purpose binding: an admin invitation or password-reset code can never confirm an email. */
const EMAIL_CODE = "email-verify:";

/** A new code by email, unless one went out in the last 60 s or 5 in the last hour (the admin OTP rules). true = a new code was made. */
async function sendSignupCode(user: { id: string; email: string; fullName: string }) {
  const hourAgo = new Date(Date.now() - 60 * MINUTE);
  // cleanup on use: a code older than an hour is expired (5 min) and outside the hourly count, for every account
  await prisma.emailVerificationOtp.deleteMany({ where: { createdAt: { lt: hourAgo } } });
  const recent = await prisma.emailVerificationOtp.findMany({
    where: { userId: user.id, createdAt: { gte: hourAgo } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent.length >= OTP_MAX_REQUESTS_PER_HOUR || (recent[0] && Date.now() - recent[0].createdAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000)) return false;
  const otp = generateOtp();
  await prisma.emailVerificationOtp.create({ data: { userId: user.id, codeHash: hashOtp(EMAIL_CODE + user.id, otp), expiresAt: getOtpExpiryDate(), maxAttempts: OTP_MAX_ATTEMPTS } });
  // In the background: the reply must not wait on (or reveal) mail delivery. Dev without a mail provider: printed as [DEV EMAIL] in the log.
  void sendSignupCodeEmail({ to: user.email, fullName: user.fullName, otp }).catch((e) => console.error("Signup code email failed:", e instanceof Error ? e.message : e));
  return true;
}

const SIGNUP_REPLY = { success: true, code: "CHECK_EMAIL", message: "Check your email for a code." };
/** An unconfirmed signup can be taken over by a new signup after this long (anti-squatting; "Forgot password" works at any time). */
export const SIGNUP_REPLACEABLE_AFTER_MS = 24 * 60 * MINUTE;
const phoneOk = (v: string) => /^[0-9+()\-\s]{6,20}$/.test(v) && v.replace(/\D/g, "").length >= 5;
const CODE_EXPIRED = bad("CODE_EXPIRED", "This code expired or was tried too often. Send a new code.");

/**
 * Customer signup. Reads ONLY fullName, email, phone, password: the account is always CUSTOMER (role, status, permissions in the body
 * are never read). Same 202 reply whether the email is new, still waiting for its code, or taken (the owner of a taken email gets a
 * notice instead of a code). The account stays PENDING until POST /verify-email (or a completed "Forgot password").
 * An unconfirmed account: under 24 h since its signup nothing changes (the code is sent again); older, the new signup replaces name,
 * phone and password and a new code goes out, so a squatter who never confirms cannot keep someone's email.
 */
router.post("/register", async (req, res) => {
  try {
    const b = req.body ?? {};
    const fullName = typeof b.fullName === "string" ? b.fullName.trim().replace(/\s+/g, " ") : "";
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    const phone = typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;
    const password = typeof b.password === "string" ? b.password : "";
    if (fullName.length < 2 || fullName.length > 80) return res.status(400).json(bad("NAME_INVALID", "Enter your full name (2 to 80 characters)."));
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json(bad("EMAIL_INVALID", "Enter a valid email address."));
    if ((b.phone != null && typeof b.phone !== "string") || (phone && !phoneOk(phone))) return res.status(400).json(bad("PHONE_INVALID", "Enter a valid phone number, or leave it empty."));
    if (!meetsPasswordPolicy(password)) return res.status(400).json(bad("PASSWORD_POLICY", "Use 12 to 256 characters with an uppercase letter, a lowercase letter, a number and a symbol."));

    const [emailOk, ipOk] = await Promise.all([signupLimits.email.hit(email), signupLimits.ip.hit(clientIp(req))]);
    if (!emailOk || !ipOk) return res.status(429).json(bad("RATE_LIMITED", "Too many sign-up attempts. Please wait an hour and try again."));

    const passwordHash = await argon2.hash(password); // always, so a taken email answers as slowly as a new one
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const user = await prisma.user
        .create({ data: { fullName, email, phone, passwordHash, role: "CUSTOMER", status: "PENDING" } })
        .catch((e) => { if (e?.code === "P2002") return null; throw e; }); // same email at the same moment: one wins, same reply
      if (user) {
        await prisma.auditLog.create({ data: { actorId: user.id, action: "CUSTOMER_SIGNUP", targetId: user.id } });
        await sendSignupCode(user);
      }
    } else if (awaitingEmail(existing)) {
      // updatedAt = the last signup: nothing else writes an unconfirmed account (confirming it makes it ACTIVE).
      const age = Date.now() - existing.updatedAt.getTime();
      if (age < SIGNUP_REPLACEABLE_AFTER_MS) await sendSignupCode(existing);
      else {
        // Safe: confirming needs the code (only the inbox owner has it) AND this password.
        const user = await prisma.user.update({ where: { id: existing.id }, data: { fullName, phone, passwordHash } });
        await prisma.auditLog.create({ data: { actorId: user.id, action: "CUSTOMER_SIGNUP_REPLACED", targetId: user.id, details: { unconfirmedHours: Math.floor(age / (60 * MINUTE)) } } });
        await sendSignupCode(user);
      }
    } else {
      void sendAccountExistsEmail({ to: existing.email, fullName: existing.fullName }).catch((e) => console.error("Account notice email failed:", e instanceof Error ? e.message : e));
    }
    return res.status(202).json(SIGNUP_REPLY);
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/** Confirms the email with the newest code + the signup password, activates the customer and signs in (same reply as login). */
router.post("/verify-email", async (req, res) => {
  const WRONG = bad("CODE_INVALID", "The code is not correct.");
  try {
    const { email, password, code } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !password || typeof code !== "string" || !/^\d{6}$/.test(code))
      return res.status(400).json(bad("INVALID_REQUEST", "Enter the 6-digit code."));
    const emailKey = email.trim().toLowerCase(), ipKey = clientIp(req);
    if ((await loginLimits.email.blocked(emailKey)) || (await loginLimits.ip.blocked(ipKey))) return res.status(429).json(TOO_MANY_LOGINS);

    const user = await findAccount(emailKey);
    const validPassword = await argon2.verify(user?.passwordHash ?? (await dummyHash), password).catch(() => false);
    if (!user || !validPassword) {
      await Promise.all([loginLimits.email.hit(emailKey), loginLimits.ip.hit(ipKey)]); // a password guess here counts as a failed login
      return res.status(400).json(WRONG);
    }
    if (!awaitingEmail(user)) return res.status(409).json(bad("NOTHING_TO_VERIFY", "This account has nothing to confirm. Sign in."));

    const otp = await prisma.emailVerificationOtp.findFirst({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    const now = new Date();
    // take one try first (atomic), so parallel guesses can never go past maxAttempts
    const tried = otp && otp.expiresAt > now
      ? await prisma.emailVerificationOtp.updateMany({ where: { id: otp.id, consumedAt: null, attempts: { lt: otp.maxAttempts } }, data: { attempts: { increment: 1 } } })
      : { count: 0 };
    if (!otp || tried.count !== 1) return res.status(400).json(CODE_EXPIRED);
    if (!verifyOtpHash(EMAIL_CODE + user.id, code, otp.codeHash)) return res.status(400).json(WRONG);

    const activated = await prisma.$transaction(async (tx) => {
      const used = await tx.emailVerificationOtp.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: now } });
      if (used.count !== 1) return false;
      const done = await tx.user.updateMany({ where: { id: user.id, role: "CUSTOMER", status: "PENDING", emailVerifiedAt: null }, data: { status: "ACTIVE", emailVerifiedAt: now } });
      if (done.count !== 1) return false;
      await tx.emailVerificationOtp.deleteMany({ where: { userId: user.id } }); // confirmed: its codes are no longer needed
      await tx.auditLog.create({ data: { actorId: user.id, action: "CUSTOMER_EMAIL_VERIFIED", targetId: user.id } });
      return true;
    });
    if (!activated) return res.status(400).json(CODE_EXPIRED);
    await loginLimits.email.clear(emailKey);
    return res.status(200).json(await signedIn({ ...user, status: "ACTIVE", emailVerifiedAt: now }));
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

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
    const ipKey = clientIp(req);
    if ((await loginLimits.email.blocked(emailKey)) || (await loginLimits.ip.blocked(ipKey))) {
      return res.status(429).json(TOO_MANY_LOGINS);
    }

    const user = await findAccount(emailKey);

    const validPassword = await argon2
      .verify(user?.passwordHash ?? (await dummyHash), password)
      .catch(() => false);

    if (!user || !validPassword) {
      await Promise.all([loginLimits.email.hit(emailKey), loginLimits.ip.hit(ipKey)]);
      return res.status(401).json(INVALID_LOGIN);
    }
    await loginLimits.email.clear(emailKey);

    // Signed up, email not confirmed: no session. A new code goes out (60 s / 5 an hour rule); the app opens the code screen.
    if (awaitingEmail(user)) {
      const codeSent = await sendSignupCode(user);
      return res.status(403).json({ ...bad("EMAIL_NOT_VERIFIED", "Confirm your email first: enter the code we sent you."), codeSent });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This account is not active.",
        role: user.role,
        status: user.status,
      });
    }

    return res.status(200).json(await signedIn(user));
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
      user: { ...user, applications: await applicationsOf(user.id) }, // Work with MOTEXA status (Profile)
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

