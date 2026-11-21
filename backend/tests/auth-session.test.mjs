// E-03 refresh tokens + login security, over HTTP on the npm-test backend (dev seed account customer@motexa.test).
import { test } from 'node:test'; import assert from 'node:assert/strict';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api', PASS = 'Motexa-Dev-1234!', EMAIL = 'customer@motexa.test';
const post = async (path, body, ip) => { const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(ip ? { 'x-test-ip': ip } : {}) }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
const me = async (t) => (await fetch(API + '/auth/me', { headers: { authorization: 'Bearer ' + t } })).status;
const login = () => post('/auth/login', { email: EMAIL, password: PASS });

test('login returns both tokens; refresh rotates; reuse of a rotated token revokes the family', async () => {
  const l = await login(); assert.equal(l.status, 200); assert.match(l.data.refreshToken, /^[a-f0-9]{64}$/);
  assert.equal(await me(l.data.accessToken), 200);
  const r1 = await post('/auth/refresh', { refreshToken: l.data.refreshToken }); assert.equal(r1.status, 200);
  assert.notEqual(r1.data.refreshToken, l.data.refreshToken); assert.equal(await me(r1.data.accessToken), 200);
  assert.equal((await post('/auth/refresh', { refreshToken: l.data.refreshToken })).status, 401, 'old token is single-use');
  assert.equal((await post('/auth/refresh', { refreshToken: r1.data.refreshToken })).status, 401, 'reuse revoked the whole family');
});

test('parallel refreshes with one token: exactly one wins', async () => {
  const l = await login();
  const both = await Promise.all([post('/auth/refresh', { refreshToken: l.data.refreshToken }), post('/auth/refresh', { refreshToken: l.data.refreshToken })]);
  assert.deepEqual(both.map(b => b.status).sort(), [200, 401]);
});

test('logout revokes the refresh token server-side; other sign-ins keep working', async () => {
  const a = await login(), b = await login();
  assert.equal((await post('/auth/logout', { refreshToken: a.data.refreshToken })).status, 200);
  assert.equal((await post('/auth/refresh', { refreshToken: a.data.refreshToken })).status, 401);
  assert.equal((await post('/auth/refresh', { refreshToken: b.data.refreshToken })).status, 200);
  assert.equal((await post('/auth/logout', { refreshToken: 'nonsense' })).status, 200, 'logout never fails');
  assert.equal((await post('/auth/refresh', {})).status, 401);
});

test('login: unknown email and wrong password get the same 401; unknown email is not faster (dummy hash)', async () => {
  const time = async (email, password) => { const t = performance.now(); const r = await post('/auth/login', { email, password }); return { ms: performance.now() - t, ...r }; };
  const wrong = [], unknown = [];
  for (let i = 0; i < 3; i++) { wrong.push(await time(EMAIL, 'Wrong-Password-1!')); unknown.push(await time(`nobody.${i}.${Date.now()}@motexa.test`, 'Wrong-Password-1!')); }
  for (const r of [...wrong, ...unknown]) { assert.equal(r.status, 401); assert.deepEqual(r.data, wrong[0].data); }
  const median = a => a.map(r => r.ms).sort((x, y) => x - y)[1];
  assert.ok(median(unknown) > median(wrong) * 0.5, `unknown ${median(unknown)} ms vs wrong ${median(wrong)} ms`);
  assert.equal((await login()).status, 200, 'a success clears the email counter');
});

test('login: 5 failures for one email -> 429 (checked before the password), other emails unaffected', async () => {
  const email = `locked.${Date.now()}@motexa.test`;
  for (let i = 0; i < 5; i++) assert.equal((await post('/auth/login', { email, password: 'x' })).status, 401);
  const blocked = await post('/auth/login', { email, password: 'x' });
  assert.equal(blocked.status, 429); assert.equal(blocked.data.code, 'RATE_LIMITED');
  assert.equal((await post('/auth/login', { email: email.toUpperCase(), password: 'x' })).status, 429, 'case-insensitive key');
  const { prisma } = await import('../src/prisma.ts');
  assert.equal((await prisma.rateLimit.findUnique({ where: { key: 'login-email:' + email } }))?.count, 5, 'counted in the database (survives a restart)');
  assert.equal((await login()).status, 200);
});

test('DB limiter: fixed window, separate names, clear (unit)', async () => {
  const { createLimiter } = await import('../src/services/auth-session.service.ts');
  const { prisma } = await import('../src/prisma.ts');
  const name = 'unit-' + Date.now(); let now = Date.now();
  const l = createLimiter(name, 2, 1000, () => now), other = createLimiter(name + '-b', 2, 1000, () => now);
  try {
    assert.equal(await l.hit('a'), true); assert.equal(await l.blocked('a'), false);
    assert.equal(await l.hit('a'), true); assert.equal(await l.blocked('a'), true, '2 of 2 used');
    assert.equal(await l.hit('a'), false, 'third hit is over the limit');
    assert.equal(await l.blocked('b'), false); assert.equal(await other.blocked('a'), false, 'another name has its own counter');
    assert.equal((await prisma.rateLimit.findUnique({ where: { key: name + ':a' } })).count, 3, 'stored in the database');
    now += 1000; assert.equal(await l.blocked('a'), false, 'window over'); assert.equal(await l.hit('a'), true, 'a new window starts at 1');
    await l.hit('a'); await l.clear('a'); assert.equal(await l.blocked('a'), false);
    // cleanup on use: a hit removes this limiter's rows whose window is over (not other limiters' rows)
    await prisma.rateLimit.createMany({ data: [{ key: name + ':old', windowStart: new Date(now - 5000), count: 9 }, { key: name + '-b:old', windowStart: new Date(now - 5000), count: 9 }] });
    await l.hit('c');
    assert.equal(await prisma.rateLimit.count({ where: { key: name + ':old' } }), 0, 'expired row removed');
    assert.equal(await prisma.rateLimit.count({ where: { key: name + '-b:old' } }), 1, 'another limiter keeps its rows');
  } finally { await prisma.rateLimit.deleteMany({ where: { key: { startsWith: name } } }); }
});

test('admin.routes uses the shared prisma client: super-admin dashboard answers on the test database', async () => {
  const l = await post('/auth/login', { email: 'superadmin@motexa.test', password: PASS }); assert.equal(l.status, 200);
  const r = await fetch(API + '/admin-management/dashboard', { headers: { authorization: 'Bearer ' + l.data.accessToken } });
  assert.equal(r.status, 200); const d = await r.json(); assert.equal(d.success, true);
  for (const k of ['towCompanies', 'partsShops']) for (const f of ['pending', 'approved']) assert.ok(Number.isInteger(d.stats[k][f]), `${k}.${f}`);
  const src = (await import('node:fs')).readFileSync(new URL('../src/routes/admin.routes.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /new PrismaClient/);
});
