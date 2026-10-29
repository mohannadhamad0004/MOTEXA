import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPasswordResetStore,
  requestPasswordReset,
  hashPasswordResetOtp,
  createResetIpLimiter,
  createResetQueue,
  RESET_RESPONSE,
} from "../src/services/password-reset.service.js";
import { hashOtp } from "../src/services/otp.service.js";

process.env.OTP_HASH_SECRET = "7".repeat(64); // Isolated test fixture, not project configuration.
type Row = {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
  sentAt: Date | null;
  maxAttempts: number;
};
function fixture(status = "ACTIVE") {
  const user = {
    id: "test-user",
    email: "sample@example.invalid",
    fullName: "Sample Admin",
    status,
    passwordHash: "unchanged",
    role: "ADMIN",
  };
  const rows: Row[] = [];
  const db = {
    async $transaction<T>(run: (tx: unknown) => Promise<T>) {
      return run({
        async $queryRaw(strings: TemplateStringsArray, ...args: unknown[]) {
          return args[0] === user.email ? [user] : [];
        },
        passwordResetRequest: {
          async findFirst() {
            return (
              [...rows].sort(
                (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
              )[0] || null
            );
          },
          async count({ where }: any) {
            return rows.filter((row) => row.createdAt >= where.createdAt.gte)
              .length;
          },
          async updateMany({ data }: any) {
            rows.forEach((row) => {
              if (!row.consumedAt) Object.assign(row, data);
            });
          },
          async create({ data }: any) {
            rows.push({
              ...data,
              createdAt: new Date(),
              consumedAt: null,
              sentAt: null,
            });
          },
        },
      });
    },
    passwordResetRequest: {
      async update({ where, data }: any) {
        Object.assign(rows.find((row) => row.id === where.id)!, data);
      },
    },
  };
  return { user, rows, store: createPasswordResetStore(db as never) };
}
test("recovery code is six digits, short lived, hashed and uses a different purpose from invitations", async () => {
  const f = fixture();
  const before = Date.now();
  const mails: Array<{ to: string; fullName: string; otp: string }> = [];
  await requestPasswordReset(f.user.email, f.store, async (mail) => {
    mails.push(mail);
  });
  assert.equal(mails.length, 1);
  assert.match(mails[0].otp, /^\d{6}$/);
  assert.equal(mails[0].to, f.user.email);
  assert.equal(f.rows.length, 1);
  const row = f.rows[0];
  assert.notEqual(row.codeHash, mails[0].otp);
  assert.equal(row.codeHash, hashPasswordResetOtp(row.id, mails[0].otp));
  assert.notEqual(row.codeHash, hashOtp(row.id, mails[0].otp));
  assert.ok(
    row.expiresAt.getTime() >= before + 299000 &&
      row.expiresAt.getTime() <= Date.now() + 300000,
  );
  assert.ok(row.sentAt);
  assert.equal(row.maxAttempts, 5);
  assert.equal(f.user.passwordHash, "unchanged");
  assert.equal(f.user.role, "ADMIN");
  assert.equal(f.user.status, "ACTIVE");
});
test("unknown, pending and suspended accounts do not receive reset mail or acquire requests", async () => {
  for (const status of ["ACTIVE", "PENDING", "SUSPENDED", "REJECTED"]) {
    const f = fixture(status);
    let sent = 0;
    await requestPasswordReset(
      status === "ACTIVE" ? "unknown@example.invalid" : f.user.email,
      f.store,
      async () => {
        sent++;
      },
    );
    assert.equal(sent, 0);
    assert.equal(f.rows.length, 0);
  }
});
test("cooldown and hourly limits prevent email flooding; permitted resend consumes old challenge", async () => {
  const f = fixture();
  let sent = 0;
  const mail = async () => {
    sent++;
  };
  await requestPasswordReset(f.user.email, f.store, mail);
  await requestPasswordReset(f.user.email, f.store, mail);
  assert.equal(sent, 1);
  f.rows[0].createdAt = new Date(Date.now() - 61000);
  await requestPasswordReset(f.user.email, f.store, mail);
  assert.equal(sent, 2);
  assert.ok(f.rows[0].consumedAt);
  while (f.rows.length < 5) {
    f.rows.at(-1)!.createdAt = new Date(Date.now() - 61000);
    await requestPasswordReset(f.user.email, f.store, mail);
  }
  f.rows.at(-1)!.createdAt = new Date(Date.now() - 61000);
  await requestPasswordReset(f.user.email, f.store, mail);
  assert.equal(sent, 5);
});
test("delivery failure invalidates the stored challenge", async () => {
  const f = fixture();
  await assert.rejects(
    requestPasswordReset(f.user.email, f.store, async () => {
      throw Error("Test mail failure");
    }),
  );
  assert.ok(f.rows[0].consumedAt);
  assert.equal(f.rows[0].sentAt, null);
});
test("IP limiter has an expiry and does not depend on account lookup", () => {
  let time = 100000;
  const allow = createResetIpLimiter(() => time);
  for (let i = 0; i < 20; i++) assert.equal(allow("127.0.0.1"), true);
  assert.equal(allow("127.0.0.1"), false);
  time += 3600000;
  assert.equal(allow("127.0.0.1"), true);
});
test("background queue is bounded and handles mail errors without exposing them in response", async () => {
  let release!: () => void;
  let failed = 0;
  const enqueue = createResetQueue(
    () => {
      failed++;
    },
    1,
    2,
  );
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  assert.equal(
    enqueue(() => gate),
    true,
  );
  assert.equal(
    enqueue(async () => {
      throw Error("test");
    }),
    true,
  );
  assert.equal(
    enqueue(async () => {}),
    false,
  );
  release();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(failed, 1);
  assert.equal(RESET_RESPONSE.success, true);
  assert.ok(!("otp" in RESET_RESPONSE));
});
