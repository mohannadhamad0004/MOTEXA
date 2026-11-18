// Privacy: a mechanic sees only the area (nearest city + pin rounded to ~1 km) and no phone until they ACCEPT; then the exact data.
import { test } from 'node:test'; import assert from 'node:assert/strict';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api', PASS = 'Motexa-Dev-1234!';
const call = async (tok, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };
const login = async (email) => (await call(null, 'POST', '/auth/login', { email, password: PASS })).data;

test('mechanic: approximate area and no phone before accepting, exact data after', async () => {
  const customer = (await login('customer@motexa.test')).accessToken;
  let mech, created;
  for (const email of ['mechanic.nablus@motexa.test', 'mechanic.ramallah@motexa.test', 'mechanic.hebron@motexa.test', 'mechanic.jenin@motexa.test', 'mechanic@motexa.test']) {
    const l = await login(email); if (!l?.accessToken) continue;
    const r = await call(customer, 'POST', '/requests/mechanic', { mechanicId: l.user.id, carMake: 'Toyota', carModel: 'Corolla', problemDescription: 'Privacy test: engine noise on start',
      locationText: 'Exact Street 12, Rafidia, Nablus', locationLat: 32.226789, locationLng: 35.243456, contactPhone: '+970 599 123 456' });
    if (r.status === 201) { mech = l.accessToken; created = r.data.request; break; }
  }
  assert.ok(created, 'could create a request to some public mechanic');
  assert.equal(created.location.text, 'Exact Street 12, Rafidia, Nablus', 'the customer sees their own exact data');

  const before = (await call(mech, 'GET', `/requests/mechanic/${created.id}`)).data.request;
  const inbox = (await call(mech, 'GET', '/mechanic/requests')).data.requests.find(x => x.id === created.id);
  for (const v of [before, inbox]) {
    assert.equal(v.location.text, null); assert.equal(v.contactPhone, null); assert.equal(v.location.approximate, true);
    assert.equal(v.location.area, 'Nablus'); assert.deepEqual(v.location.point, { lat: 32.23, lng: 35.24 });
    assert.doesNotMatch(JSON.stringify(v), /Exact Street|599 123|32\.2267|35\.2434/);
  }

  const accepted = (await call(mech, 'POST', `/mechanic/requests/${created.id}/accept`, {})).data.request;
  const after = (await call(mech, 'GET', `/requests/mechanic/${created.id}`)).data.request;
  for (const v of [accepted, after]) {
    assert.equal(v.location.text, 'Exact Street 12, Rafidia, Nablus'); assert.equal(v.contactPhone, '+970 599 123 456');
    assert.deepEqual(v.location.point, { lat: 32.226789, lng: 35.243456 }); assert.equal(v.location.approximate, false);
  }
  // cancelled after acceptance: hidden again
  assert.equal((await call(customer, 'POST', `/requests/mechanic/${created.id}/cancel`, {})).status, 200);
  const cancelled = (await call(mech, 'GET', `/requests/mechanic/${created.id}`)).data.request;
  assert.equal(cancelled.location.text, null); assert.equal(cancelled.contactPhone, null);
});
