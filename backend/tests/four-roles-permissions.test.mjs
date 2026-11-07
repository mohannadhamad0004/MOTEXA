// FOUR-ROLES permission matrix over HTTP (needs the dev backend on :5000 and the dev seed accounts; skipped when it is not running).
// For every endpoint a role's screens call: no token -> 401, every wrong role -> 403, the right role -> not 401 / 403 (200 or a validation 4xx).
// Mutating endpoints are called with a bogus id / empty body, so a wrong role must be stopped BEFORE anything is looked up or changed.
import { test, before } from 'node:test'; import assert from 'node:assert/strict';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api', PASS = 'Motexa-Dev-1234!', BOGUS = '00000000-0000-4000-8000-000000000000';
const WHO = { customer: 'customer@motexa.test', towOwner: 'tow@motexa.test', towPending: 'tow.apply@motexa.test', partsOwner: 'demo.parts@motexa.test', towAdmin: 'admin.tow@motexa.test', partsAdmin: 'admin.parts@motexa.test', mechanic: 'mechanic@motexa.test' };
const tok = {}; let up = false;
before(async () => {
  try { up = (await fetch(API + '/health')).ok; } catch { up = false; }
  if (!up) return; for (const [k, email] of Object.entries(WHO)) { const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASS }) }); tok[k] = (await r.json()).accessToken; }
});
const call = async (who, method, path, body) => (await fetch(API + path.replace(':id', BOGUS), { method, headers: { 'content-type': 'application/json', ...(who && tok[who] ? { authorization: 'Bearer ' + tok[who] } : {}) }, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body ?? {}) })).status;
/** [method, path, allowed roles] ; every other role (and no token) must be refused */
const ALL = Object.keys(WHO);
const MATRIX = {
  // 1. tow company (own data): the approved owner. A not-yet-approved owner is a TOW_PROVIDER too: the route may answer 403 (not approved) but never leak data (checked below)
  towCompany: [
    ['GET', '/tow/me/company', ['towOwner', 'towPending']], ['PATCH', '/tow/me/company', ['towOwner', 'towPending']], ['GET', '/tow/me/trucks', ['towOwner', 'towPending']], ['POST', '/tow/me/trucks', ['towOwner', 'towPending']],
    ['GET', '/tow/me/trucks/:id', ['towOwner', 'towPending']], ['PATCH', '/tow/me/trucks/:id', ['towOwner', 'towPending']], ['PATCH', '/tow/me/trucks/:id/status', ['towOwner']], ['DELETE', '/tow/me/trucks/:id', ['towOwner', 'towPending']],
    ['GET', '/tow/me/drivers', ['towOwner']], ['POST', '/tow/me/drivers', ['towOwner']], ['PATCH', '/tow/me/drivers/:id', ['towOwner']], ['GET', '/tow/me/live', ['towOwner']],
    ['GET', '/tow/me/requests', ['towOwner']], ['GET', '/tow/me/requests/:id', ['towOwner']], ['PATCH', '/tow/me/requests/:id/accept', ['towOwner']], ['PATCH', '/tow/me/requests/:id/decline', ['towOwner']],
    ['PATCH', '/tow/me/requests/:id/status', ['towOwner']], ['PATCH', '/tow/me/requests/:id/cancel', ['towOwner']], ['POST', '/tow/me/requests/:id/assign', ['towOwner']],
    ['GET', '/tow/me/portal/summary', ['towOwner', 'towPending']], ['GET', '/tow/me/portal/public-drivers', ['towOwner', 'towPending']],
  ],
  // 3. tow admin
  towAdmin: [
    ['GET', '/admin/tow/companies', ['towAdmin']], ['GET', '/admin/tow/companies/:id', ['towAdmin']], ['PATCH', '/admin/tow/companies/:id', ['towAdmin']], ['PATCH', '/admin/tow/companies/:id/decision', ['towAdmin']],
    ['GET', '/admin/tow/trucks', ['towAdmin']], ['PATCH', '/admin/tow/trucks/:id', ['towAdmin']], ['PATCH', '/admin/tow/trucks/:id/decision', ['towAdmin']], ['PATCH', '/admin/tow/trucks/:id/archive', ['towAdmin']],
    ['GET', '/admin/tow/active-jobs', ['towAdmin']], ['GET', '/admin/tow/jobs/:id', ['towAdmin']],
    ['GET', '/admin/providers/tow/applications', ['towAdmin']], ['GET', '/admin/providers/tow/applications/:id', ['towAdmin']], ['POST', '/admin/providers/tow/applications/:id/approve', ['towAdmin']],
    ['POST', '/admin/providers/tow/applications/:id/reject', ['towAdmin']], ['POST', '/admin/providers/tow/applications/:id/request-changes', ['towAdmin']], ['GET', '/admin/providers/tow/threads', ['towAdmin']],
    ['GET', '/admin/providers/tow/applications/:id/messages', ['towAdmin']], ['POST', '/admin/providers/tow/applications/:id/messages', ['towAdmin']],
  ],
  // providers' own onboarding / messages (either provider kind, nobody else)
  providerShared: [
    ['GET', '/provider/onboarding', ['towOwner', 'towPending', 'partsOwner']], ['GET', '/provider/onboarding/status', ['towOwner', 'towPending', 'partsOwner']], ['GET', '/provider/messages', ['towOwner', 'towPending', 'partsOwner']],
    ['POST', '/provider/messages/read', ['towOwner', 'towPending', 'partsOwner']],
  ],
};
for (const [group, rows] of Object.entries(MATRIX)) for (const [method, path, allowed] of rows) {
  test(`${group}: ${method} ${path} -> only ${allowed.join(', ')}`, async t => {
    if (!up) return t.skip('backend not running on :5000');
    assert.equal(await call(null, method, path), 401, 'no token');
    for (const who of ALL) { const s = await call(who, method, path, {});
      if (allowed.includes(who)) assert.ok(![401, 403].includes(s) || (who === 'towPending' && s === 403), `${who} must reach it, got ${s}`);
      else assert.ok([401, 403].includes(s), `${who} must be refused, got ${s}`); }
  });
}

// own data only: another tow company (here the not-yet-approved one) can never read or change the approved company's truck / job, whatever it sends
test('towCompany: another company cannot touch the approved company real truck', async t => {
  if (!up) return t.skip('backend not running on :5000');
  const auth = who => ({ authorization: 'Bearer ' + tok[who], 'content-type': 'application/json' });
  const trucks = (await (await fetch(API + '/tow/me/trucks', { headers: auth('towOwner') })).json()).trucks ?? []; assert.ok(trucks.length > 0, 'the approved demo company has trucks');
  const id = trucks[0].id;
  for (const who of ['towPending', 'partsOwner', 'customer', 'towAdmin']) {
    for (const [m, p, b] of [['GET', `/tow/me/trucks/${id}`], ['PATCH', `/tow/me/trucks/${id}`, { plateNumber: 'HACK' }], ['PATCH', `/tow/me/trucks/${id}/status`, { operationalStatus: 'OUT_OF_SERVICE' }], ['DELETE', `/tow/me/trucks/${id}`]]) {
      const r = await fetch(API + p, { method: m, headers: auth(who), body: b ? JSON.stringify(b) : undefined }); assert.ok([401, 403, 404].includes(r.status), `${who} ${m} ${p} -> ${r.status}`); }
  }
  const after = (await (await fetch(API + `/tow/me/trucks/${id}`, { headers: auth('towOwner') })).json()); assert.ok(JSON.stringify(after).includes(trucks[0].plateNumber ?? trucks[0].plate ?? ''), 'truck unchanged');
});
