// Customer signup + email code (docs/agents/AUTH-REDESIGN.md, stage A), over HTTP on the npm-test backend.
// Own fixtures (@example.invalid), removed at the end with their rate-limit rows. The real code only goes to the inbox, so a test
// plants a known code as the newest one (only the newest code counts).
import { test, after } from 'node:test'; import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/prisma.js';
import argon2 from 'argon2';
import { hashOtp } from '../src/services/otp.service.ts';
import { createPasswordResetStore, requestPasswordReset } from '../src/services/password-reset.service.ts';
import { completePasswordReset, verifyPasswordResetCode } from '../src/services/password-reset-completion.service.ts';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api', PASS = 'Signup-Test-1234!', SEED_PASS = 'Motexa-Dev-1234!';
const post = async (path, body) => { const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
const tag = 'signup-' + randomUUID().slice(0, 8), mail = (n) => `${tag}-${n}@example.invalid`;
const REPLY = { success: true, code: 'CHECK_EMAIL', message: 'Check your email for a code.' };
const userOf = (email) => prisma.user.findUnique({ where: { email }, include: { adminPermissions: true } });
let seq = 0; // strictly newer each time (two inserts can share a millisecond)
const plant = (userId, code, purpose = 'email-verify:', expiresIn = 5 * 60000) => prisma.emailVerificationOtp.create({ data: { userId, codeHash: hashOtp(purpose + userId, code), createdAt: new Date(Date.now() + ++seq), expiresAt: new Date(Date.now() + expiresIn) } });
const signup = (n, extra = {}) => post('/auth/register', { fullName: 'Sara Signuptest', email: mail(n), password: PASS, ...extra });
const clearSignupIp = () => prisma.rateLimit.deleteMany({ where: { key: { startsWith: 'signup-ip:' } } });

after(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } }); // codes cascade
  await prisma.rateLimit.deleteMany({ where: { OR: [{ key: { contains: tag } }, { key: { startsWith: 'signup-ip:' } }] } });
});

test('signup: always CUSTOMER + PENDING; role / status / permissions in the body are never read', async () => {
  await clearSignupIp();
  for (const [i, role] of ['SUPER_ADMIN', 'ADMIN', 'TOW_ADMIN', 'MECHANIC', 'TOW_DRIVER', 'super_admin', ['ADMIN'], { role: 'ADMIN' }].entries()) {
    const r = await signup('role' + i, { role, status: 'ACTIVE', adminPermissions: ['MANAGE_TOWING'], permissions: ['MANAGE_TOWING'], emailVerifiedAt: new Date().toISOString() });
    assert.equal(r.status, 202); assert.deepEqual(r.data, REPLY);
    const u = await userOf(mail('role' + i));
    assert.deepEqual([u.role, u.status, u.emailVerifiedAt, u.adminPermissions.length], ['CUSTOMER', 'PENDING', null, 0], JSON.stringify(role));
    assert.equal(await prisma.emailVerificationOtp.count({ where: { userId: u.id } }), 1, 'a code was made');
  }
  // confirming the email changes the status only: still CUSTOMER, 0 permissions, a customer session
  const u = await userOf(mail('role0'));
  await plant(u.id, '424242');
  const ok = await post('/auth/verify-email', { email: mail('role0'), password: PASS, code: '424242' });
  assert.equal(ok.status, 200); assert.deepEqual([ok.data.user.role, ok.data.user.status, ok.data.user.adminPermissions], ['CUSTOMER', 'ACTIVE', []]);
  const after = await userOf(mail('role0'));
  assert.deepEqual([after.role, after.status, after.adminPermissions.length], ['CUSTOMER', 'ACTIVE', 0]);
});

test('signup: the same reply for a new, a waiting and a taken email; a taken account is not changed', async () => {
  await clearSignupIp();
  const owner = await prisma.user.create({ data: { fullName: 'Taken Owner', email: mail('taken'), passwordHash: 'kept-as-is', role: 'TOW_PROVIDER', status: 'ACTIVE' } });
  const fresh = await signup('same'), waiting = await signup('same', { fullName: 'Sara Again' }), taken = await signup('taken');
  for (const r of [fresh, waiting, taken]) { assert.equal(r.status, 202); assert.deepEqual(r.data, REPLY); }
  const after = await userOf(mail('taken'));
  assert.deepEqual([after.passwordHash, after.role, after.fullName, after.status], [owner.passwordHash, 'TOW_PROVIDER', 'Taken Owner', 'ACTIVE']);
  assert.equal((await userOf(mail('same'))).fullName, 'Sara Signuptest', 'under 24 h a repeat signup changes nothing');
});

test('signup: validation answers 400 with a code', async () => {
  const cases = [[{ fullName: 'S' }, 'NAME_INVALID'], [{ email: 'nope' }, 'EMAIL_INVALID'], [{ phone: 'call me' }, 'PHONE_INVALID'], [{ phone: ['0599'] }, 'PHONE_INVALID'], [{ password: 'short' }, 'PASSWORD_POLICY'], [{ password: 'alllowercase-and-long-1' }, 'PASSWORD_POLICY']];
  for (const [extra, code] of cases) { const r = await signup('bad', extra); assert.equal(r.status, 400); assert.equal(r.data.code, code); }
  assert.equal(await userOf(mail('bad')), null);
  assert.equal((await signup('phone', { phone: '+970 599 123 456' })).status, 202);
  assert.equal((await userOf(mail('phone'))).phone, '+970 599 123 456');
});

test('waiting account: no session from login; the code + the password confirm it once, then login works', async () => {
  await clearSignupIp();
  assert.equal((await signup('flow')).status, 202);
  const u = await userOf(mail('flow'));
  assert.equal((await post('/auth/login', { email: mail('flow'), password: 'Wrong-Pass-1234!' })).status, 401);
  const blocked = await post('/auth/login', { email: mail('flow'), password: PASS });
  assert.equal(blocked.status, 403); assert.equal(blocked.data.code, 'EMAIL_NOT_VERIFIED'); assert.equal(blocked.data.accessToken, undefined);
  assert.equal(blocked.data.codeSent, false, 'a code went out < 60 s ago: no new one');

  await plant(u.id, '123456');
  const v = (code, password = PASS) => post('/auth/verify-email', { email: mail('flow').toUpperCase(), password, code });
  assert.equal((await v('123456', 'Wrong-Pass-1234!')).data.code, 'CODE_INVALID', 'the code alone is not enough');
  assert.equal((await v('000000')).data.code, 'CODE_INVALID');
  assert.equal((await v('12345')).status, 400);
  const ok = await v('123456');
  assert.equal(ok.status, 200); assert.match(ok.data.refreshToken, /^[a-f0-9]{64}$/);
  assert.deepEqual([ok.data.user.role, ok.data.user.status, ok.data.user.adminPermissions], ['CUSTOMER', 'ACTIVE', []]);
  assert.equal((await fetch(API + '/auth/me', { headers: { authorization: 'Bearer ' + ok.data.accessToken } })).status, 200);
  const done = await userOf(mail('flow'));
  assert.equal(done.status, 'ACTIVE'); assert.ok(done.emailVerifiedAt);
  assert.equal(await prisma.auditLog.count({ where: { targetId: u.id, action: { in: ['CUSTOMER_SIGNUP', 'CUSTOMER_EMAIL_VERIFIED'] } } }), 2);
  assert.equal(await prisma.emailVerificationOtp.count({ where: { userId: u.id } }), 0, 'confirmed: its codes are deleted');
  assert.equal((await v('123456')).status, 409, 'nothing left to confirm');
  assert.equal((await post('/auth/login', { email: mail('flow'), password: PASS })).status, 200);

  // a confirmed email is taken now: signing up again changes nothing
  assert.deepEqual((await signup('flow', { password: 'Other-Pass-9876!' })).data, REPLY);
  assert.equal((await post('/auth/login', { email: mail('flow'), password: 'Other-Pass-9876!' })).status, 401);
  assert.equal((await post('/auth/login', { email: mail('flow'), password: PASS })).status, 200);
});

test('email code: 5 tries, newest code only, expiry, purpose binding', async () => {
  await clearSignupIp();
  assert.equal((await signup('tries')).status, 202);
  const u = await userOf(mail('tries'));
  const v = (code) => post('/auth/verify-email', { email: mail('tries'), password: PASS, code });
  await plant(u.id, '222222');
  for (let i = 0; i < 5; i++) assert.equal((await v('999999')).data.code, 'CODE_INVALID');
  assert.equal((await v('222222')).data.code, 'CODE_EXPIRED', 'out of tries: even the right code is refused');

  await plant(u.id, '333333'); await plant(u.id, '444444');
  assert.equal((await v('333333')).data.code, 'CODE_INVALID', 'an older code does not count');
  await plant(u.id, '555555', 'email-verify:', -1000);
  assert.equal((await v('555555')).data.code, 'CODE_EXPIRED');
  await plant(u.id, '666666', 'password-reset:'); // a password-reset code for the same account
  assert.equal((await v('666666')).data.code, 'CODE_INVALID');
  await plant(u.id, '666666', ''); // an admin-invitation style hash
  assert.equal((await v('666666')).data.code, 'CODE_INVALID');
  await plant(u.id, '777777');
  assert.equal((await v('777777')).status, 200);
});

test('rate limit in the database: 5 signups per email and 20 per IP an hour, then 429', async () => {
  await clearSignupIp();
  for (let i = 0; i < 5; i++) assert.equal((await signup('limit')).status, 202);
  const r = await signup('limit'); assert.equal(r.status, 429); assert.equal(r.data.code, 'RATE_LIMITED');
  assert.equal((await prisma.rateLimit.findUnique({ where: { key: 'signup-email:' + mail('limit') } })).count, 6);
  await clearSignupIp();
  for (let i = 0; i < 20; i++) assert.equal((await signup('ip' + i)).status, 202, 'ip ' + i);
  assert.equal((await signup('ip-over')).status, 429, 'the 21st from one IP');
  assert.equal(await userOf(mail('ip-over')), null);
  await clearSignupIp();
});

test('seed logins still work (every account of seed/test-accounts.ts)', async () => {
  const src = readFileSync(new URL('../src/seed/test-accounts.ts', import.meta.url), 'utf8');
  const seeds = [...src.matchAll(/\{ email: "([^"]+)", fullName: "[^"]*", role: "([A-Z_]+)", status: "([A-Z]+)"/g)].map(([, email, role, status]) => ({ email, role, status }));
  assert.ok(seeds.length >= 10, 'seed list read');
  for (const s of seeds) {
    const r = await post('/auth/login', { email: s.email, password: SEED_PASS });
    if (s.status === 'ACTIVE') { assert.equal(r.status, 200, s.email); assert.equal(r.data.user.role, s.role, s.email); }
    else { assert.equal(r.status, 403, s.email); assert.notEqual(r.data.code, 'EMAIL_NOT_VERIFIED', s.email); }
  }
});

// ---- email squatting: someone signs up with my email + their password and never confirms -----------------------------------
const ageAccount = async (userId, hours) => { // the signup (and its codes) happened `hours` ago
  const at = new Date(Date.now() - hours * 3600000);
  await prisma.$executeRaw`UPDATE "User" SET "updatedAt" = ${at}, "createdAt" = ${at} WHERE "id" = ${userId}`;
  await prisma.emailVerificationOtp.updateMany({ where: { userId }, data: { createdAt: at, expiresAt: new Date(at.getTime() + 300000) } });
};

test('squatting: under 24 h a new signup changes nothing; after 24 h it takes the account over (new password, new code)', async () => {
  await clearSignupIp();
  assert.equal((await signup('squat', { fullName: 'Squatter', password: 'Squatter-Pass-1!' })).status, 202);
  const u = await userOf(mail('squat'));
  await ageAccount(u.id, 23);
  assert.deepEqual((await signup('squat', { fullName: 'Real Owner', password: PASS })).data, REPLY);
  let now = await userOf(mail('squat'));
  assert.equal(now.fullName, 'Squatter'); assert.equal(await argon2.verify(now.passwordHash, 'Squatter-Pass-1!'), true, '23 h: password kept');
  assert.equal(await prisma.emailVerificationOtp.count({ where: { userId: u.id, createdAt: { gt: new Date(Date.now() - 60000) } } }), 1, 'the code was sent again');

  await ageAccount(u.id, 25);
  assert.deepEqual((await signup('squat', { fullName: 'Real Owner', password: PASS, phone: '0599 111 222' })).data, REPLY);
  now = await userOf(mail('squat'));
  assert.deepEqual([now.id, now.fullName, now.phone, now.role, now.status], [u.id, 'Real Owner', '0599 111 222', 'CUSTOMER', 'PENDING']);
  assert.equal(await argon2.verify(now.passwordHash, PASS), true, '25 h: the new password');
  const codes = await prisma.emailVerificationOtp.findMany({ where: { userId: u.id } });
  assert.equal(codes.length, 1, 'a new code; the old ones (over an hour old) were cleaned up when it was made');
  assert.ok(codes[0].createdAt > new Date(Date.now() - 60000));
  assert.equal(await prisma.auditLog.count({ where: { targetId: u.id, action: 'CUSTOMER_SIGNUP_REPLACED' } }), 1);

  await plant(u.id, '515151');
  assert.equal((await post('/auth/verify-email', { email: mail('squat'), password: 'Squatter-Pass-1!', code: '515151' })).data.code, 'CODE_INVALID', 'the squatter password is gone');
  assert.equal((await post('/auth/verify-email', { email: mail('squat'), password: PASS, code: '515151' })).status, 200);
  // confirmed now: no more takeovers, even after 24 h
  await prisma.$executeRaw`UPDATE "User" SET "updatedAt" = ${new Date(Date.now() - 90000000)} WHERE "id" = ${u.id}`;
  await signup('squat', { password: 'Squatter-Pass-2!' });
  assert.equal(await argon2.verify((await userOf(mail('squat'))).passwordHash, PASS), true);
});

test('squatting: "Forgot password" works on an unconfirmed signup, confirms the email and drops the squatter password', async () => {
  await clearSignupIp();
  assert.equal((await signup('forgot', { fullName: 'Squatter', password: 'Squatter-Pass-1!' })).status, 202);
  const u = await userOf(mail('forgot'));
  let otp = ''; await requestPasswordReset(mail('forgot'), createPasswordResetStore(prisma), async (m) => { otp = m.otp; });
  assert.match(otp, /^\d{6}$/, 'a recovery code was sent to the unconfirmed address');
  const grant = await verifyPasswordResetCode(prisma, mail('forgot'), otp); assert.match(grant, /^[a-f0-9]{64}$/);
  assert.equal(await completePasswordReset(prisma, grant, 'Owner-New-Pass-7!'), true);
  const now = await userOf(mail('forgot'));
  assert.equal(now.status, 'ACTIVE'); assert.ok(now.emailVerifiedAt); assert.equal(now.role, 'CUSTOMER');
  assert.equal(await prisma.emailVerificationOtp.count({ where: { userId: u.id } }), 0, 'signup codes deleted');
  assert.equal(await prisma.auditLog.count({ where: { targetId: u.id, action: 'CUSTOMER_EMAIL_VERIFIED' } }), 1);
  assert.equal((await post('/auth/login', { email: mail('forgot'), password: 'Squatter-Pass-1!' })).status, 401);
  const ok = await post('/auth/login', { email: mail('forgot'), password: 'Owner-New-Pass-7!' });
  assert.equal(ok.status, 200); assert.equal(ok.data.user.role, 'CUSTOMER');

  // recovery stays closed for other non-active accounts
  for (const [n, role, status, emailVerifiedAt] of [['susp', 'CUSTOMER', 'SUSPENDED', null], ['mpend', 'MECHANIC', 'PENDING', null], ['cpend', 'CUSTOMER', 'PENDING', new Date()]]) {
    await prisma.user.create({ data: { fullName: 'Closed ' + n, email: mail(n), passwordHash: 'x', role, status, emailVerifiedAt } });
    let sent = false; await requestPasswordReset(mail(n), createPasswordResetStore(prisma), async () => { sent = true; });
    assert.equal(sent, false, `${role} ${status} gets no recovery code`);
  }
});
