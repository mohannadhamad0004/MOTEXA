// Privacy: a mechanic sees the exact address, pin and phone ONLY during the active job (ACCEPTED / IN_PROGRESS). Before accepting
// and after the job (COMPLETED / DECLINED / CANCELLED): nearest city + pin rounded to ~1 km, no phone; dates stay.
// Name: first name until accepted, full name once accepted (kept in history).
// Own fixtures: the test creates its customer and its approved mechanic (VERIFIED MechanicProfile) and removes them; no dev seed data.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma.js';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api';
const call = async (tok, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };
const token = (u) => jwt.sign({ role: u.role, sessionVersion: u.sessionVersion }, process.env.JWT_SECRET, { subject: u.id, expiresIn: '10m', algorithm: 'HS256' });
const EXACT = { locationText: 'Exact Street 12, Rafidia, Nablus', locationLat: 32.226789, locationLng: 35.243456, contactPhone: '+970 599 123 456' };
const body = (mechanicId) => ({ mechanicId, carMake: 'Toyota', carModel: 'Corolla', problemDescription: 'Privacy test: engine noise on start', ...EXACT });

const FULL = 'Privacy Test Customer', FIRST = 'Privacy'; // the test customer's name
const name = (v, expected, label) => assert.equal(v.customerName, expected, `${label}: customer name`);
const hidden = (v, label) => {
  assert.equal(v.location.text, null, label); assert.equal(v.contactPhone, null, label); assert.equal(v.location.approximate, true, label);
  assert.equal(v.location.area, 'Nablus', label); assert.deepEqual(v.location.point, { lat: 32.23, lng: 35.24 }, label);
  assert.doesNotMatch(JSON.stringify(v), /Exact Street|599 123|32\.2267|35\.2434/, label);
  assert.ok(v.timeline.length, `${label}: dates stay`);
};
const exact = (v, label) => {
  assert.equal(v.location.text, EXACT.locationText, label); assert.equal(v.contactPhone, EXACT.contactPhone, label);
  assert.deepEqual(v.location.point, { lat: EXACT.locationLat, lng: EXACT.locationLng }, label); assert.equal(v.location.approximate, false, label);
};

test('mechanic: exact address/pin/phone only during the active job', async () => {
  const tag = 'privacy-' + randomUUID();
  const c = await prisma.user.create({ data: { fullName: FULL, email: `${tag}-customer@example.invalid`, passwordHash: 'unused', role: 'CUSTOMER', status: 'ACTIVE' } });
  const m = await prisma.user.create({
    data: {
      fullName: 'Privacy Test Mechanic', email: `${tag}-mechanic@example.invalid`, passwordHash: 'unused', role: 'MECHANIC', status: 'ACTIVE',
      mechanicProfile: { create: { city: 'Nablus', specializations: ['Engine'], verificationStatus: 'VERIFIED', offersWorkshop: true, workshopName: 'Privacy Test Workshop', workshopAddress: 'Test address' } },
    },
  });
  try {
  const customer = token(c), mech = token(m), mechId = m.id;
  const created = await call(customer, 'POST', '/requests/mechanic', body(mechId));
  assert.equal(created.status, 201, 'request to the test mechanic');
  const first = created.data.request;
  assert.equal(first.location.text, EXACT.locationText, 'the customer sees their own exact data');
  const get = async (id) => (await call(mech, 'GET', `/requests/mechanic/${id}`)).data.request;
  const inList = async (id, status) => (await call(mech, 'GET', `/mechanic/requests${status ? '?status=' + status : ''}`)).data.requests.find((x) => x.id === id);

  // before accepting: detail + inbox list
  hidden(await get(first.id), 'REQUESTED detail'); hidden(await inList(first.id), 'REQUESTED list');
  name(await get(first.id), FIRST, 'REQUESTED detail'); name(await inList(first.id), FIRST, 'REQUESTED list');
  assert.doesNotMatch(JSON.stringify(await get(first.id)), new RegExp(FULL), 'no full name before accepting');
  // accepted -> exact; customer cancels -> hidden again
  exact((await call(mech, 'POST', `/mechanic/requests/${first.id}/accept`, {})).data.request, 'ACCEPTED action reply');
  exact(await get(first.id), 'ACCEPTED detail'); exact(await inList(first.id), 'ACCEPTED list');
  name(await get(first.id), FULL, 'ACCEPTED detail'); name(await inList(first.id), FULL, 'ACCEPTED list');
  assert.equal((await call(customer, 'POST', `/requests/mechanic/${first.id}/cancel`, {})).status, 200);
  hidden(await get(first.id), 'CANCELLED detail'); hidden(await inList(first.id, 'CANCELLED'), 'CANCELLED history');
  name(await get(first.id), FULL, 'cancelled after accepting: full name kept');

  // full job: accept -> start (exact) -> complete (hidden; name, area, dates stay)
  const job = (await call(customer, 'POST', '/requests/mechanic', body(mechId))).data.request;
  await call(mech, 'POST', `/mechanic/requests/${job.id}/accept`, {});
  exact((await call(mech, 'POST', `/mechanic/requests/${job.id}/start`, {})).data.request, 'IN_PROGRESS action reply');
  const done = (await call(mech, 'POST', `/mechanic/requests/${job.id}/complete`, {})).data.request;
  hidden(done, 'COMPLETED action reply'); hidden(await get(job.id), 'COMPLETED detail'); hidden(await inList(job.id, 'COMPLETED'), 'COMPLETED history');
  assert.ok(done.timeline.some((t) => t.status === 'COMPLETED'), 'completion date kept');
  name(done, FULL, 'COMPLETED reply'); name(await inList(job.id, 'COMPLETED'), FULL, 'COMPLETED history: full name kept');

  // declined: hidden
  const no = (await call(customer, 'POST', '/requests/mechanic', body(mechId))).data.request;
  const declined = (await call(mech, 'POST', `/mechanic/requests/${no.id}/decline`, { reason: 'busy' })).data.request;
  hidden(declined, 'DECLINED action reply'); name(declined, FIRST, 'declined without accepting: first name only');
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [c.id, m.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [c.id, m.id] } } }); // cascade: profile, requests
    await prisma.$disconnect();
  }
});
