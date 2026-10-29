import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { prisma } from "../src/prisma.js";
import {
  createPasswordResetStore,
  requestPasswordReset,
} from "../src/services/password-reset.service.js";
import {
  verifyPasswordResetCode,
  completePasswordReset,
  meetsPasswordPolicy,
  recoveryTokenHash,
} from "../src/services/password-reset-completion.service.js";
import { createPasswordResetRouter } from "../src/routes/password-reset.routes.js";
import { isCurrentSession } from "../src/services/session-version.service.js";
import authRoutes from "../src/routes/auth.routes.js";
import { requireAuth } from "../src/middleware/auth.middleware.js";

const oldPassword = "OldTestPassword12!",
  newPassword = "NewTestPassword34!";
async function withAccount(
  run: (
    user: { id: string; email: string },
    code: () => Promise<string>,
  ) => Promise<void>,
) {
  const id = randomUUID(),
    email = `reset-completion-${id}@example.invalid`;
  await prisma.user.create({
    data: {
      id,
      email,
      fullName: "Recovery test fixture",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: await argon2.hash(oldPassword),
    },
  });
  await prisma.adminPermission.create({
    data: { adminId: id, permission: "MANAGE_MECHANICS" },
  });
  const code = async () => {
    let otp = "";
    await requestPasswordReset(
      email,
      createPasswordResetStore(prisma),
      async (mail) => {
        otp = mail.otp;
      },
    );
    assert.match(otp, /^\d{6}$/);
    return otp;
  };
  try {
    await run({ id, email }, code);
  } finally {
    // Only the UUID created above is deleted, cascading its test-only recovery rows.
    await prisma.user.delete({ where: { id } });
    assert.equal(
      await prisma.passwordResetRequest.count({ where: { userId: id } }),
      0,
    );
  }
}

test("password policy matches the existing admin activation minimum and caps oversized inputs", () => {
  assert.equal(meetsPasswordPolicy("short"), false);
  assert.equal(meetsPasswordPolicy("lowercase123!"), false);
  assert.equal(meetsPasswordPolicy("UPPERCASE123!"), false);
  assert.equal(meetsPasswordPolicy("NoNumbersHere!"), false);
  assert.equal(meetsPasswordPolicy("NoSymbols1234"), false);
  assert.equal(meetsPasswordPolicy("A1!" + "x".repeat(254)), false);
  assert.equal(meetsPasswordPolicy(newPassword), true);
});
test("session version preserves old tokens until recovery, then rejects them", () => {
  assert.equal(isCurrentSession({}, 0), true);
  assert.equal(isCurrentSession({}, 1), false);
  assert.equal(isCurrentSession({ sessionVersion: 1 }, 1), true);
  assert.equal(isCurrentSession({ sessionVersion: "1" }, 1), false);
  assert.equal(isCurrentSession({ sessionVersion: null }, 0), false);
});
test("correct code yields a hashed short-lived single-use reset grant; password, permissions and existing sessions behave correctly", async () => {
  await withAccount(async (user, code) => {
    const otp = await code();
    const grant = await verifyPasswordResetCode(prisma, user.email, otp);
    assert.match(grant!, /^[a-f0-9]{64}$/);
    const row = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: user.id },
    });
    assert.notEqual(row.resetTokenHash, grant);
    assert.equal(row.resetTokenHash, recoveryTokenHash(grant!));
    assert.ok(row.verifiedAt);
    assert.ok(row.resetExpiresAt! > new Date());
    assert.equal(
      await verifyPasswordResetCode(prisma, user.email, otp),
      null,
      "OTP cannot mint another grant",
    );
    assert.equal(await completePasswordReset(prisma, grant!, "weak"), false);
    assert.equal(
      await completePasswordReset(prisma, grant!, newPassword),
      true,
    );
    assert.equal(
      await completePasswordReset(prisma, grant!, "AnotherPassword56!"),
      false,
      "grant cannot be reused",
    );
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { adminPermissions: true },
    });
    assert.equal(await argon2.verify(account.passwordHash, newPassword), true);
    assert.equal(await argon2.verify(account.passwordHash, oldPassword), false);
    assert.equal(account.status, "ACTIVE");
    assert.equal(account.role, "ADMIN");
    assert.equal(account.fullName, "Recovery test fixture");
    assert.equal(account.adminPermissions[0].permission, "MANAGE_MECHANICS");
    assert.equal(account.sessionVersion, 1);
    const oldToken = jwt.sign(
      { sub: user.id, sessionVersion: 0 },
      "isolated-test-secret",
    );
    const current = jwt.sign(
      { sub: user.id, sessionVersion: account.sessionVersion },
      "isolated-test-secret",
    );
    assert.equal(
      isCurrentSession(
        jwt.verify(oldToken, "isolated-test-secret"),
        account.sessionVersion,
      ),
      false,
    );
    assert.equal(
      isCurrentSession(
        jwt.verify(current, "isolated-test-secret"),
        account.sessionVersion,
      ),
      true,
    );
  });
});
test("incorrect codes exhaust persisted attempts and expired or undelivered codes cannot verify", async () => {
  await withAccount(async (user, code) => {
    const otp = await code();
    const wrong = otp === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      assert.equal(
        await verifyPasswordResetCode(prisma, user.email, wrong),
        null,
      );
    assert.equal(await verifyPasswordResetCode(prisma, user.email, otp), null);
    let row = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: user.id },
    });
    assert.equal(row.attempts, 5);
    assert.ok(row.consumedAt);
    await prisma.passwordResetRequest.update({
      where: { id: row.id },
      data: {
        attempts: 0,
        consumedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    assert.equal(await verifyPasswordResetCode(prisma, user.email, otp), null);
    await prisma.passwordResetRequest.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() + 300000), sentAt: null },
    });
    assert.equal(await verifyPasswordResetCode(prisma, user.email, otp), null);
  });
});
test("resend, expired grant and account suspension prevent reset without changing the password", async () => {
  await withAccount(async (user, code) => {
    let otp = await code();
    const grant = await verifyPasswordResetCode(prisma, user.email, otp);
    let first = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: user.id },
    });
    await prisma.passwordResetRequest.update({
      where: { id: first.id },
      data: { createdAt: new Date(Date.now() - 61000) },
    });
    otp = await code();
    assert.equal(
      await completePasswordReset(prisma, grant!, newPassword),
      false,
    );
    const nextGrant = await verifyPasswordResetCode(prisma, user.email, otp);
    const next = await prisma.passwordResetRequest.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    await prisma.passwordResetRequest.update({
      where: { id: next.id },
      data: { resetExpiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal(
      await completePasswordReset(prisma, nextGrant!, newPassword),
      false,
    );
    await prisma.passwordResetRequest.update({
      where: { id: next.id },
      data: { resetExpiresAt: new Date(Date.now() + 600000) },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "SUSPENDED" },
    });
    assert.equal(
      await completePasswordReset(prisma, nextGrant!, newPassword),
      false,
    );
    assert.equal(await verifyPasswordResetCode(prisma, user.email, otp), null);
    assert.equal(
      await argon2.verify(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
          .passwordHash,
        oldPassword,
      ),
      true,
    );
  });
});
test("concurrent reset requests consume one grant exactly once", async () => {
  await withAccount(async (user, code) => {
    const grant = await verifyPasswordResetCode(
      prisma,
      user.email,
      await code(),
    );
    const results = await Promise.all([
      completePasswordReset(prisma, grant!, newPassword),
      completePasswordReset(prisma, grant!, newPassword),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .sessionVersion,
      1,
    );
  });
});
test("full HTTP request, verification and reset flow uses a test mail sink and never calls a real email provider", async () => {
  await withAccount(async (user) => {
    let otp = "";
    const pending: Array<() => Promise<void>> = [];
    const app = express();
    app.use(express.json());
    app.use(
      "/api/auth/password-reset",
      createPasswordResetRouter({
        allow: () => true,
        enqueue: (job) => {
          pending.push(job);
          return true;
        },
        request: (email) =>
          requestPasswordReset(
            email,
            createPasswordResetStore(prisma),
            async (mail) => {
              otp = mail.otp;
            },
          ),
        verify: (email, code) => verifyPasswordResetCode(prisma, email, code),
        reset: (token, password) =>
          completePasswordReset(prisma, token, password),
      }),
    );
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/password-reset/`;
    const post = (path: string, body: unknown) =>
      fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    try {
      assert.equal(
        (await post("request-otp", { email: user.email.toUpperCase() })).status,
        202,
      );
      await pending[0]();
      assert.equal(
        (await post("verify-otp", { email: user.email, otp: "12" })).status,
        400,
      );
      const verified = await post("verify-otp", { email: user.email, otp });
      assert.equal(verified.status, 200);
      assert.equal(verified.headers.get("cache-control"), "no-store");
      const { resetToken } = (await verified.json()) as { resetToken: string };
      assert.equal(
        (await post("reset", { resetToken, password: "weak" })).status,
        400,
      );
      assert.equal(
        (await post("reset", { resetToken, password: newPassword })).status,
        200,
      );
      assert.equal(
        (await post("reset", { resetToken, password: newPassword })).status,
        401,
      );
      assert.equal(
        await argon2.verify(
          (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
            .passwordHash,
          newPassword,
        ),
        true,
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
test("real login and both session guards reject the previous password and tokens after reset", async () => {
  await withAccount(async (user, code) => {
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
    app.get("/protected", requireAuth, (_req, res) =>
      res.json({ success: true }),
    );
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const login = (password: string) =>
      fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password }),
      });
    const guarded = (path: string, token: string) =>
      fetch(base + path, { headers: { Authorization: "Bearer " + token } });
    try {
      const first = await login(oldPassword);
      assert.equal(first.status, 200);
      const { accessToken: oldToken } = (await first.json()) as {
        accessToken: string;
      };
      assert.equal((await guarded("/api/auth/me", oldToken)).status, 200);
      assert.equal((await guarded("/protected", oldToken)).status, 200);
      const grant = await verifyPasswordResetCode(
        prisma,
        user.email,
        await code(),
      );
      assert.equal(
        await completePasswordReset(prisma, grant!, newPassword),
        true,
      );
      assert.equal((await login(oldPassword)).status, 401);
      assert.equal((await guarded("/api/auth/me", oldToken)).status, 401);
      assert.equal((await guarded("/protected", oldToken)).status, 401);
      const current = await login(newPassword);
      assert.equal(current.status, 200);
      const { accessToken: newToken } = (await current.json()) as {
        accessToken: string;
      };
      assert.equal((await guarded("/api/auth/me", newToken)).status, 200);
      assert.equal((await guarded("/protected", newToken)).status, 200);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
test.after(async () => {
  await prisma.$disconnect();
});
