import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/prisma.js";
import {
  createPasswordResetStore,
  requestPasswordReset,
  hashPasswordResetOtp,
} from "../src/services/password-reset.service.js";

test("PostgreSQL stores recovery challenges and invalidates old ones; all fixture records roll back and no email is sent", async () => {
  const userId = randomUUID(),
    email = `recovery-test-${userId}@example.invalid`,
    rollback = new Error("ROLLBACK_TEST_FIXTURE");
  try {
    await assert.rejects(
      prisma.$transaction(
        async (tx) => {
          await tx.user.create({
            data: {
              id: userId,
              fullName: "Recovery integration fixture",
              email,
              passwordHash: "not-a-real-password",
              role: "ADMIN",
              status: "ACTIVE",
            },
          });
          const database = {
            $transaction: async (run: (value: typeof tx) => Promise<unknown>) =>
              run(tx),
            passwordResetRequest: tx.passwordResetRequest,
          };
          const store = createPasswordResetStore(database as never);
          const mails: Array<{ otp: string }> = [];
          await requestPasswordReset(email, store, async (mail) => {
            mails.push(mail);
          });
          const first = await tx.passwordResetRequest.findFirstOrThrow({
            where: { userId },
          });
          assert.equal(
            first.codeHash,
            hashPasswordResetOtp(first.id, mails[0].otp),
          );
          assert.ok(first.sentAt);
          assert.equal(first.consumedAt, null);
          await requestPasswordReset(email, store, async (mail) => {
            mails.push(mail);
          });
          assert.equal(mails.length, 1);
          await tx.passwordResetRequest.update({
            where: { id: first.id },
            data: { createdAt: new Date(Date.now() - 61000) },
          });
          await requestPasswordReset(email, store, async (mail) => {
            mails.push(mail);
          });
          assert.equal(mails.length, 2);
          assert.ok(
            (
              await tx.passwordResetRequest.findUniqueOrThrow({
                where: { id: first.id },
              })
            ).consumedAt,
          );
          assert.equal(
            (await tx.user.findUniqueOrThrow({ where: { id: userId } }))
              .passwordHash,
            "not-a-real-password",
          );
          throw rollback;
        },
        { timeout: 15000 },
      ),
      (error) => error === rollback,
    );
    assert.equal(await prisma.user.findUnique({ where: { id: userId } }), null);
    assert.equal(
      await prisma.passwordResetRequest.count({ where: { userId } }),
      0,
    );
  } finally {
    await prisma.$disconnect();
  }
});
