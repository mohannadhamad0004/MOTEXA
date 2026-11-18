// Privacy: a mechanic sees the exact address, pin and phone ONLY during the active job (ACCEPTED / IN_PROGRESS). Before accepting
// and after the job (COMPLETED / DECLINED / CANCELLED): nearest city + pin rounded to ~1 km, no phone; name and dates stay.
import { test } from 'node:test'; import assert from 'node:assert/strict';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api', PASS = 'Motexa-Dev-1234!';
const call = async (tok, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };
const login = async (email) => (await call(null, 'POST', '/auth/login', { email, password: PASS })).data;
const EXACT = { locationText: 'Exact Street 12, Rafidia, Nablus', locationLat: 32.226789, locationLng: 35.243456, contactPhone: '+970 599 123 456' };
const body = (mechanicId) => ({ mechanicId, carMake: 'Toyota', carModel: 'Corolla', problemDescription: 'Privacy test: engine noise on start', ...EXACT });

const hidden = (v, label) => {
  assert.equal(v.location.text, null, label); assert.equal(v.contactPhone, null, label); assert.equal(v.location.approximate, true, label);
  assert.equal(v.location.area, 'Nablus', label); assert.deepEqual(v.location.point, { lat: 32.23, lng: 35.24 }, label);
  assert.doesNotMatch(JSON.stringify(v), /Exact Street|599 123|32\.2267|35\.2434/, label);
  assert.ok(v.customerName && v.timeline.length, `${label}: name and dates stay`);
};
const exact = (v, label) => {
  assert.equal(v.location.text, EXACT.locationText, label); assert.equal(v.contactPhone, EXACT.contactPhone, label);
  assert.deepEqual(v.location.point, { lat: EXACT.locationLat, lng: EXACT.locationLng }, label); assert.equal(v.location.approximate, false, label);
};

test('mechanic: exact address/pin/phone only during the active job', async () => {
  const customer = (await login('customer@motexa.test')).accessToken;
  let mech, mechId, first;
  for (const email of ['mechanic.nablus@motexa.test', 'mechanic.ramallah@motexa.test', 'mechanic.hebron@motexa.test', 'mechanic.jenin@motexa.test', 'mechanic@motexa.test']) {
    const l = await login(email); if (!l?.accessToken) continue;
    const r = await call(customer, 'POST', '/requests/mechanic', body(l.user.id));
    if (r.status === 201) { mech = l.accessToken; mechId = l.user.id; first = r.data.request; break; }
  }
  assert.ok(first, 'could create a request to some public mechanic');
  assert.equal(first.location.text, EXACT.locationText, 'the customer sees their own exact data');
  const get = async (id) => (await call(mech, 'GET', `/requests/mechanic/${id}`)).data.request;
  const inList = async (id, status) => (await call(mech, 'GET', `/mechanic/requests${status ? '?status=' + status : ''}`)).data.requests.find((x) => x.id === id);

  // before accepting: detail + inbox list
  hidden(await get(first.id), 'REQUESTED detail'); hidden(await inList(first.id), 'REQUESTED list');
  // accepted -> exact; customer cancels -> hidden again
  exact((await call(mech, 'POST', `/mechanic/requests/${first.id}/accept`, {})).data.request, 'ACCEPTED action reply');
  exact(await get(first.id), 'ACCEPTED detail'); exact(await inList(first.id), 'ACCEPTED list');
  assert.equal((await call(customer, 'POST', `/requests/mechanic/${first.id}/cancel`, {})).status, 200);
  hidden(await get(first.id), 'CANCELLED detail'); hidden(await inList(first.id, 'CANCELLED'), 'CANCELLED history');

  // full job: accept -> start (exact) -> complete (hidden; name, area, dates stay)
  const job = (await call(customer, 'POST', '/requests/mechanic', body(mechId))).data.request;
  await call(mech, 'POST', `/mechanic/requests/${job.id}/accept`, {});
  exact((await call(mech, 'POST', `/mechanic/requests/${job.id}/start`, {})).data.request, 'IN_PROGRESS action reply');
  const done = (await call(mech, 'POST', `/mechanic/requests/${job.id}/complete`, {})).data.request;
  hidden(done, 'COMPLETED action reply'); hidden(await get(job.id), 'COMPLETED detail'); hidden(await inList(job.id, 'COMPLETED'), 'COMPLETED history');
  assert.ok(done.timeline.some((t) => t.status === 'COMPLETED'), 'completion date kept');

  // declined: hidden
  const no = (await call(customer, 'POST', '/requests/mechanic', body(mechId))).data.request;
  hidden((await call(mech, 'POST', `/mechanic/requests/${no.id}/decline`, { reason: 'busy' })).data.request, 'DECLINED action reply');
});
