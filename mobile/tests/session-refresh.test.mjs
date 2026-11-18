import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRefresher, expiresSoon, ACCESS_KEY, REFRESH_KEY } from '../src/core/session/sessionExpiry.ts';

const jwt = (exp) => 'h.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.s';
const memory = (init) => { const m = new Map(Object.entries(init)); return { m, get: async k => m.get(k) ?? null, set: async (k, v) => void m.set(k, v), del: async k => void m.delete(k) }; };

test('expiresSoon: 60 s margin, unpadded base64url, garbage = false', () => {
  const now = 1_700_000_000_000;
  assert.equal(expiresSoon(jwt(now / 1000 + 30), now), true);
  assert.equal(expiresSoon(jwt(now / 1000 + 600), now), false);
  assert.equal(expiresSoon(jwt(now / 1000 - 1), now), true);
  for (const exp of [1, 12, 123]) assert.equal(expiresSoon(jwt(exp), now), true); // every padding length decodes
  assert.equal(expiresSoon('not-a-jwt', now), false);
});

test('parallel callers share one refresh and get the rotated pair', async () => {
  const s = memory({ [ACCESS_KEY]: 'old', [REFRESH_KEY]: 'r1' }); let calls = 0; const sent = [];
  const refresh = createRefresher(s, async (rt) => { calls++; sent.push(rt); await new Promise(r => setTimeout(r, 10)); return { status: 200, data: { accessToken: 'a2', refreshToken: 'r2' } }; });
  assert.deepEqual(await Promise.all([refresh(), refresh(), refresh()]), ['a2', 'a2', 'a2']);
  assert.equal(calls, 1); assert.equal(s.m.get(REFRESH_KEY), 'r2'); assert.equal(s.m.get(ACCESS_KEY), 'a2');
  await refresh(); assert.equal(calls, 2, 'a later refresh runs again'); assert.deepEqual(sent, ['r1', 'r2']);
});

test('401 clears both tokens; network/5xx throws and keeps them', async () => {
  const s = memory({ [ACCESS_KEY]: 'a', [REFRESH_KEY]: 'r' });
  await assert.rejects(createRefresher(s, async () => ({ status: 503, data: null }))());
  await assert.rejects(createRefresher(s, async () => { throw new Error('Network request failed'); })());
  assert.equal(s.m.get(REFRESH_KEY), 'r');
  assert.equal(await createRefresher(s, async () => ({ status: 401, data: null }))(), null);
  assert.equal(s.m.size, 0);
  assert.equal(await createRefresher(s, async () => assert.fail('no token, no call'))(), null);
});

test('sign-out during a refresh is not undone by the late answer', async () => {
  const s = memory({ [ACCESS_KEY]: 'a', [REFRESH_KEY]: 'r' });
  const p = createRefresher(s, async () => { s.m.clear(); return { status: 200, data: { accessToken: 'a2', refreshToken: 'r2' } }; })();
  assert.equal(await p, null); assert.equal(s.m.size, 0);
});
