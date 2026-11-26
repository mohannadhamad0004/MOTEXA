// Mechanics admin supervision of mechanic requests: only mechanics admins + the super admin; location rule; cancel with a reason (audited,
// both sides told and shown the reason). Own fixtures, removed at the end; no dev seed data.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma.js';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api';
const token = (u) => jwt.sign({ role: u.role, sessionVersion: u.sessionVersion }, process.env.JWT_SECRET, { subject: u.id, expiresIn: '10m', algorithm: 'HS256' });
const call = async (tok, method, path, body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };
const EXACT = { locationText: 'Secret Street 7, Rafidia, Nablus', locationLat: 32.226789, locationLng: 35.243456, contactPhone: '+970 599 765 432' };
const WHY = 'Duplicate request, please book again.';

test('mechanics admin: permissions, location rule, cancel with reason', async () => {
  const tag = 'madmin-' + randomUUID();
  const mk = (role, name, extra = {}) => prisma.user.create({ data: { fullName: name, email: `${tag}-${name.split(' ')[0].toLowerCase()}@example.invalid`, passwordHash: 'unused', role, status: 'ACTIVE', ...extra } });
  const customer = await mk('CUSTOMER', 'Dana Admintest');
  const mechanic = await mk('MECHANIC', 'Majed Admintest', { mechanicProfile: { create: { city: 'Jenin', specializations: ['Engine'], verificationStatus: 'VERIFIED', offersWorkshop: true, workshopName: 'Admintest Workshop', workshopAddress: 'x' } } });
  const mAdmin = await mk('ADMIN', 'Mona Admintest', { adminPermissions: { create: { permission: 'MANAGE_MECHANICS' } } });
  const pAdmin = await mk('ADMIN', 'Parts Admintest', { adminPermissions: { create: { permission: 'MANAGE_SPARE_PARTS' } } });
  const superA = await mk('SUPER_ADMIN', 'Super Admintest');
  const ids = [customer.id, mechanic.id, mAdmin.id, pAdmin.id, superA.id];
  const [ct, mt, at, pt, st] = [customer, mechanic, mAdmin, pAdmin, superA].map(token);
  try {
    const made = await call(ct, 'POST', '/requests/mechanic', { mechanicId: mechanic.id, serviceMode: 'WORKSHOP', carMake: 'Kia', carModel: 'Rio', problemDescription: 'Admin test: engine misfire', ...EXACT });
    assert.equal(made.status, 201); const id = made.data.request.id;
    const find = (d) => d.requests.find((r) => r.id === id);

    // ---- who may call: no token 401; customer, mechanic, other department 403; mechanics admin + super admin allowed
    const endpoints = [['GET', '/admin/mechanics/stats'], ['GET', '/admin/mechanics/requests'], ['GET', `/admin/mechanics/requests/${id}`], ['POST', `/admin/mechanics/requests/${id}/cancel`, { reason: 'nope nope' }]];
    for (const [m, p, b] of endpoints) {
      assert.equal((await call(null, m, p, b)).status, 401, `${p} without a token`);
      for (const [who, t] of [['customer', ct], ['mechanic', mt], ['parts admin', pt]]) assert.equal((await call(t, m, p, b)).status, 403, `${p} for ${who}`);
    }
    assert.equal((await call(st, 'GET', '/admin/mechanics/stats')).status, 200);
    assert.ok((await call(at, 'GET', '/admin/mechanics/stats')).data.stats.activeRequests >= 1);
    assert.equal((await prisma.mechanicRequest.findUnique({ where: { id } })).status, 'REQUESTED', 'the refused cancel changed nothing');

    // ---- list: active scope, status filter, search by customer / mechanic / city; no address, phone or email in the list
    let r = await call(at, 'GET', '/admin/mechanics/requests?scope=active'); assert.equal(r.status, 200);
    const row = find(r.data); assert.ok(row, 'in the active list'); assert.equal(row.customerName, 'Dana Admintest');
    assert.equal(row.city, 'Nablus', 'the car area comes from the pin'); assert.equal(row.mechanic.city, 'Jenin', 'the mechanic keeps their own city');
    assert.doesNotMatch(JSON.stringify(r.data), /Secret Street|599 765|32\.2267|35\.2434|example\.invalid/);
    for (const q of ['dana', 'majed', 'admintest workshop', 'nablus', 'jenin']) assert.ok(find((await call(at, 'GET', `/admin/mechanics/requests?scope=active&q=${encodeURIComponent(q)}`)).data), `search ${q}`);
    assert.equal(find((await call(at, 'GET', '/admin/mechanics/requests?scope=active&q=zzzz-no-match')).data), undefined);
    assert.ok(find((await call(at, 'GET', '/admin/mechanics/requests?scope=active&status=REQUESTED')).data));
    assert.equal(find((await call(at, 'GET', '/admin/mechanics/requests?scope=history')).data), undefined);
    assert.equal((await call(at, 'GET', '/admin/mechanics/requests?scope=active&status=COMPLETED')).status, 400);

    // ---- detail: exact location and phone only while the job is active (ACCEPTED / IN_PROGRESS)
    const detail = async () => (await call(at, 'GET', `/admin/mechanics/requests/${id}`)).data.request;
    let d = await detail();
    assert.equal(d.location.text, null); assert.equal(d.contactPhone, null); assert.equal(d.location.approximate, true); assert.equal(d.city, 'Nablus');
    assert.doesNotMatch(JSON.stringify(d), /Secret Street|599 765|32\.2267/, 'REQUESTED: hidden');
    assert.equal(d.customerName, 'Dana Admintest', 'the admin sees the full name');
    await call(mt, 'POST', `/mechanic/requests/${id}/accept`, {});
    d = await detail();
    assert.equal(d.location.text, EXACT.locationText); assert.equal(d.contactPhone, EXACT.contactPhone); assert.equal(d.location.approximate, false, 'ACCEPTED: exact');
    assert.ok(d.timeline.some((s) => s.status === 'ACCEPTED' && s.at));

    // ---- cancel: reason required; audited; both sides told and shown the reason; location hidden again; not twice
    assert.equal((await call(at, 'POST', `/admin/mechanics/requests/${id}/cancel`, { reason: '  ' })).status, 400);
    assert.equal((await call(at, 'POST', `/admin/mechanics/requests/${id}/cancel`, {})).status, 400);
    assert.equal((await prisma.mechanicRequest.findUnique({ where: { id } })).status, 'ACCEPTED', 'no reason: not cancelled');
    r = await call(at, 'POST', `/admin/mechanics/requests/${id}/cancel`, { reason: WHY });
    assert.equal(r.status, 200); assert.equal(r.data.request.status, 'CANCELLED'); assert.equal(r.data.request.cancelledBy, 'ADMIN');
    assert.equal(r.data.request.location.text, null, 'cancelled: location hidden again');
    assert.equal((await call(at, 'POST', `/admin/mechanics/requests/${id}/cancel`, { reason: 'again' })).status, 409);
    const cv = (await call(ct, 'GET', `/requests/mechanic/${id}`)).data.request, mv = (await call(mt, 'GET', `/requests/mechanic/${id}`)).data.request;
    for (const v of [cv, mv]) { assert.equal(v.status, 'CANCELLED'); assert.equal(v.cancelReason, WHY); assert.equal(v.cancelledBy, 'ADMIN'); }
    for (const u of [customer, mechanic]) assert.ok(await prisma.notification.findFirst({ where: { userId: u.id, body: { contains: 'Duplicate request' } } }), 'notified');
    const audit = await prisma.auditLog.findMany({ where: { targetId: id, actorId: mAdmin.id } });
    assert.ok(audit.some((a) => a.action === 'MECHANIC_REQUEST_CANCELLED' && a.details.reason === WHY));
    assert.ok(audit.some((a) => a.action === 'MECHANIC_REQUEST_ADMIN_VIEWED'));
    assert.ok(find((await call(st, 'GET', '/admin/mechanics/requests?scope=history&status=CANCELLED')).data), 'in History');
    assert.equal(find((await call(st, 'GET', '/admin/mechanics/requests?scope=active')).data), undefined);
  } finally {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); // cascade: profile, requests, notifications, permissions
    await prisma.$disconnect();
  }
});
