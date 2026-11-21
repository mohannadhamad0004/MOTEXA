// Work with MOTEXA (docs/agents/AUTH-REDESIGN.md, stage B): POST /apply/:kind, customer applicants on the wizard endpoints, and the
// role promotion that only the approval by that department's admin performs. Own fixtures (@example.invalid), removed at the end.
import { test, after } from 'node:test'; import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/prisma.js';
import { CATEGORY_KEYS } from '../src/catalogCategories.ts';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api';
const tag = 'apply-' + randomUUID().slice(0, 8);
const token = (u) => jwt.sign({ role: u.role, sessionVersion: u.sessionVersion }, process.env.JWT_SECRET, { subject: u.id, expiresIn: '10m', algorithm: 'HS256' });
const call = async (u, method, path, body) => {
  const auth = u ? { authorization: 'Bearer ' + (typeof u === 'string' ? u : token(u)) } : {};
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...auth }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};
let n = 0;
const mk = (role, extra = {}) => prisma.user.create({ data: { fullName: `Apply Test ${++n}`, email: `${tag}-${n}@example.invalid`, passwordHash: 'unused', role, status: 'ACTIVE', ...extra } });
const admin = (permission) => mk('ADMIN', { adminPermissions: { create: { permission } } });
const OK = { acknowledgeProviderAccount: true, acceptTerms: true };
const BIZ = { ...OK, businessName: 'Apply Test Business', phone: '+970 599 555 111', city: 'Nablus' };
const userOf = (id) => prisma.user.findUnique({ where: { id } });
const roleOf = async (id) => (await userOf(id)).role;
const file = (ownerUserId, extra) => prisma.providerFile.create({ data: { ownerUserId, visibility: 'PRIVATE', originalName: 'f.pdf', mimeType: 'application/pdf', sizeBytes: 10, storageKey: `${tag}-${randomUUID()}`, sha256: 'x', reviewStatus: 'ACCEPTED', ...extra } });
/** Submitted + every checklist item accepted (what the review would have produced), so only the approval itself is tested. */
async function readyForApproval(kind, userId) {
  if (kind === 'PARTS') {
    const s = await prisma.partsShopProfile.update({ where: { userId }, data: { verificationStatus: 'PENDING', baseLat: 32.22, baseLng: 35.26, categories: [CATEGORY_KEYS[0]] } });
    for (const k of ['COMMERCIAL_REGISTRATION', 'TRADE_LICENCE', 'OWNER_ID']) await file(userId, { purpose: 'PARTS_SHOP_DOCUMENT', partsShopId: s.id, docKind: k });
    return s.id;
  }
  const c = await prisma.towCompanyProfile.update({ where: { userId }, data: { verificationStatus: 'PENDING', baseLat: 32.22, baseLng: 35.26 } });
  for (const k of ['COMMERCIAL_REGISTRATION', 'OWNER_ID', 'DRIVER_LICENCE']) await file(userId, { purpose: 'TOW_COMPANY_DOCUMENT', towCompanyId: c.id, docKind: k });
  const t = await prisma.truck.create({ data: { companyId: c.id, plateNumber: `AT-${randomUUID().slice(0, 8)}`, make: 'Isuzu', model: 'NPR', truckType: 'FLATBED' } });
  for (const p of ['TRUCK_PHOTO', 'TRUCK_REGISTRATION', 'TRUCK_INSURANCE']) await file(userId, { purpose: p, truckId: t.id });
  return c.id;
}
let towCo; // an approved tow company, for customer tow requests
const activeTowRequest = async (customerId) => {
  towCo ??= (await mk('TOW_PROVIDER', { towCompanyProfile: { create: { companyName: 'Apply Test Tow Co', phone: '+970599000000', city: 'Nablus', verificationStatus: 'APPROVED' } } })).id;
  const co = await prisma.towCompanyProfile.findUnique({ where: { userId: towCo } });
  return prisma.towRequest.create({ data: { customerId, companyId: co.id, pickupAddress: 'a', dropoffAddress: 'b', contactPhone: '0599', vehicleMake: 'Kia', vehicleModel: 'Rio' } });
};

after(async () => { await prisma.user.deleteMany({ where: { email: { startsWith: tag } } }); });

test('apply: token required, customers only, confirmation required, and it never changes the role', async () => {
  assert.equal((await call(null, 'POST', '/apply/mechanic', OK)).status, 401);
  for (const role of ['MECHANIC', 'TOW_PROVIDER', 'PARTS_PROVIDER', 'TOW_DRIVER', 'ADMIN', 'SUPER_ADMIN']) {
    const u = await mk(role);
    const r = await call(u, 'POST', '/apply/parts', BIZ);
    assert.equal(r.status, 403, role); assert.equal(r.data.code, 'CUSTOMERS_ONLY'); assert.equal(await roleOf(u.id), role);
  }
  const c = await mk('CUSTOMER');
  assert.equal((await call(c, 'POST', '/apply/garage', OK)).status, 404);
  assert.equal((await call(c, 'POST', '/apply/mechanic', { acceptTerms: true })).data.code, 'CONFIRM_REQUIRED');
  assert.equal((await call(c, 'POST', '/apply/mechanic', { ...OK, acknowledgeProviderAccount: 'yes' })).status, 400);
  const r = await call(c, 'POST', '/apply/mechanic', { ...OK, role: 'MECHANIC', status: 'ACTIVE', verificationStatus: 'VERIFIED', adminPermissions: ['MANAGE_MECHANICS'] });
  assert.equal(r.status, 201); assert.deepEqual(r.data.application, { kind: 'MECHANIC', status: 'DRAFT' });
  assert.equal(await roleOf(c.id), 'CUSTOMER', 'applying never changes the role');
  assert.equal((await prisma.mechanicProfile.findUnique({ where: { userId: c.id } })).verificationStatus, 'DRAFT');
  assert.equal((await call(c, 'POST', '/apply/mechanic', OK)).data.created, false, 'applying again opens the same application');
  assert.equal((await call(c, 'POST', '/apply/tow', BIZ)).data.code, 'ALREADY_APPLIED', 'one kind of work per account');
  assert.deepEqual((await call(c, 'GET', '/auth/me')).data.user.applications, [{ kind: 'MECHANIC', status: 'DRAFT' }]);
  assert.equal(await prisma.auditLog.count({ where: { actorId: c.id, action: 'APPLICATION_STARTED' } }), 1);

  const c2 = await mk('CUSTOMER');
  assert.equal((await call(c2, 'POST', '/apply/parts', { ...BIZ, city: 'Atlantis' })).data.code, 'CITY_NOT_IN_LIST');
  assert.equal((await call(c2, 'POST', '/apply/parts', { ...BIZ, phone: 'x' })).data.code, 'PHONE_INVALID');
  assert.equal((await call(c2, 'POST', '/apply/parts', { ...BIZ, businessName: '' })).data.code, 'BUSINESS_NAME_INVALID');
  assert.equal(await prisma.partsShopProfile.count({ where: { userId: c2.id } }), 0);
});

test('apply: refused while the customer has an active request or order', async () => {
  const c = await mk('CUSTOMER');
  const req = await activeTowRequest(c.id);
  const r = await call(c, 'POST', '/apply/tow', BIZ);
  assert.equal(r.status, 409); assert.equal(r.data.code, 'ACTIVE_WORK');
  assert.equal(await prisma.towCompanyProfile.count({ where: { userId: c.id } }), 0);
  await prisma.towRequest.update({ where: { id: req.id }, data: { status: 'COMPLETED' } });
  assert.equal((await call(c, 'POST', '/apply/tow', BIZ)).status, 201, 'a finished request does not block');
});

test('a customer applicant reaches only their own application, never provider actions', async () => {
  const plain = await mk('CUSTOMER');
  assert.equal((await call(plain, 'GET', '/mechanics/me')).status, 404, 'no application: nothing to open');
  assert.equal(await prisma.mechanicProfile.count({ where: { userId: plain.id } }), 0, 'and none is created by opening it');
  assert.equal((await call(plain, 'GET', '/provider/onboarding')).status, 403, 'like any non-provider role');
  assert.equal((await call(plain, 'GET', '/tow/me/trucks')).status, 403);

  const m = await mk('CUSTOMER'); await call(m, 'POST', '/apply/mechanic', OK);
  assert.equal((await call(m, 'GET', '/mechanics/me')).status, 200);
  assert.equal((await call(m, 'GET', '/mechanic/requests')).status, 403, 'no mechanic inbox before approval');
  assert.equal((await call(m, 'GET', '/mechanics/me/service-access')).status, 403);

  const t = await mk('CUSTOMER'); await call(t, 'POST', '/apply/tow', BIZ);
  const ob = await call(t, 'GET', '/provider/onboarding');
  assert.equal(ob.status, 200); assert.deepEqual([ob.data.application.kind, ob.data.application.status], ['TOW', 'DRAFT']);
  assert.equal((await call(t, 'GET', '/tow/me/trucks')).status, 200, 'trucks are part of the application');
  assert.equal((await call(t, 'GET', '/tow/me/company')).status, 403, 'company area: providers only');
  assert.equal((await call(t, 'PATCH', '/tow/me/trucks/x/status', { operationalStatus: 'AVAILABLE' })).status, 403);
  assert.equal((await call(t, 'GET', '/mechanics/me')).status, 404, 'not their kind of application');
});

test('provider approval: only that department admin, and it promotes the applicant (both review paths)', async () => {
  const [towAdmin, partsAdmin, mechAdmin] = [await admin('MANAGE_TOWING'), await admin('MANAGE_SPARE_PARTS'), await admin('MANAGE_MECHANICS')];

  // parts, review queue
  const p = await mk('CUSTOMER'); await call(p, 'POST', '/apply/parts', BIZ);
  const shopId = await readyForApproval('PARTS', p.id);
  const approveShop = (u) => call(u, 'POST', `/admin/providers/parts/applications/${shopId}/approve`);
  for (const u of [p, towAdmin, mechAdmin]) assert.equal((await approveShop(u)).status, 403);
  assert.equal((await call(towAdmin, 'POST', `/admin/providers/tow/applications/${shopId}/approve`)).status, 404, 'the tow queue has no parts applications');
  assert.equal(await roleOf(p.id), 'CUSTOMER');
  const before = await userOf(p.id);
  assert.equal((await approveShop(partsAdmin)).status, 200);
  const promoted = await userOf(p.id);
  assert.deepEqual([promoted.role, promoted.sessionVersion], ['PARTS_PROVIDER', before.sessionVersion + 1]);
  assert.equal((await call(before, 'GET', '/auth/me')).status, 401, 'the customer session ended: the next sign-in lands in the provider area');
  assert.equal(await prisma.auditLog.count({ where: { targetId: p.id, action: 'ROLE_PROMOTED', actorId: partsAdmin.id } }), 1);

  // tow, review queue
  const t = await mk('CUSTOMER'); await call(t, 'POST', '/apply/tow', BIZ);
  const coId = await readyForApproval('TOW', t.id);
  assert.equal((await call(partsAdmin, 'POST', `/admin/providers/tow/applications/${coId}/approve`)).status, 403);
  assert.equal((await call(towAdmin, 'POST', `/admin/providers/tow/applications/${coId}/approve`)).status, 200);
  assert.equal(await roleOf(t.id), 'TOW_PROVIDER');

  // parts, the older shop decision endpoint
  const q = await mk('CUSTOMER'); await call(q, 'POST', '/apply/parts', BIZ);
  const shop2 = await readyForApproval('PARTS', q.id);
  assert.equal((await call(towAdmin, 'PATCH', `/admin/parts/shops/${shop2}/decision`, { decision: 'APPROVED' })).status, 403);
  assert.equal(await roleOf(q.id), 'CUSTOMER');
  assert.equal((await call(partsAdmin, 'PATCH', `/admin/parts/shops/${shop2}/decision`, { decision: 'APPROVED' })).status, 200);
  assert.equal(await roleOf(q.id), 'PARTS_PROVIDER');

  // a rejection never promotes
  const r = await mk('CUSTOMER'); await call(r, 'POST', '/apply/parts', BIZ);
  const shop3 = await readyForApproval('PARTS', r.id);
  assert.equal((await call(partsAdmin, 'POST', `/admin/providers/parts/applications/${shop3}/reject`, { reason: 'Test rejection' })).status, 200);
  assert.equal(await roleOf(r.id), 'CUSTOMER');
});

test('approval waits while the applicant still has an active request (tow, older company decision endpoint)', async () => {
  const [towAdmin, partsAdmin] = [await admin('MANAGE_TOWING'), await admin('MANAGE_SPARE_PARTS')];
  const c = await mk('CUSTOMER'); await call(c, 'POST', '/apply/tow', BIZ);
  const coId = await readyForApproval('TOW', c.id);
  const req = await activeTowRequest(c.id); // booked after applying
  const decide = (u) => call(u, 'PATCH', `/admin/tow/companies/${coId}/decision`, { decision: 'APPROVED' });
  assert.equal((await decide(partsAdmin)).status, 403);
  const blocked = await decide(towAdmin);
  assert.equal(blocked.status, 409); assert.match(blocked.data.message, /active request or order/);
  assert.equal(await roleOf(c.id), 'CUSTOMER');
  assert.equal((await prisma.towCompanyProfile.findUnique({ where: { id: coId } })).verificationStatus, 'PENDING');
  await prisma.towRequest.update({ where: { id: req.id }, data: { status: 'CANCELLED' } });
  assert.equal((await decide(towAdmin)).status, 200);
  assert.equal(await roleOf(c.id), 'TOW_PROVIDER');
});

test('mechanic approval: only the mechanics admin, and it promotes the applicant', async () => {
  const [mechAdmin, partsAdmin, towAdmin] = [await admin('MANAGE_MECHANICS'), await admin('MANAGE_SPARE_PARTS'), await admin('MANAGE_TOWING')];
  const c = await mk('CUSTOMER'); await call(c, 'POST', '/apply/mechanic', OK);
  const p = await prisma.mechanicProfile.update({
    where: { userId: c.id },
    data: { city: 'Jenin', phoneNumber: '+970599123123', specializations: ['Engine'], yearsOfExperience: 5, experienceSummary: 'Engines for years', offersOnline: true, verificationStatus: 'PENDING', interviewResult: 'PASSED', submissionVersion: 1, submittedAt: new Date() },
  });
  const doc = await prisma.mechanicDocument.create({ data: { profileId: p.id, kind: 'IDENTITY', fileName: 'id.jpg', mimeType: 'image/jpeg', size: 10, storageKey: `${tag}-id` } });
  await prisma.auditLog.create({ data: { actorId: mechAdmin.id, targetId: p.id, action: 'MECHANIC_DOCUMENT_VIEWED', details: { documentId: doc.id } } });
  const decide = (u) => call(u, 'POST', `/mechanics/admin/${c.id}/decision`, { action: 'APPROVE', submissionVersion: 1 });
  for (const u of [c, partsAdmin, towAdmin]) assert.equal((await decide(u)).status, 403);
  assert.equal(await roleOf(c.id), 'CUSTOMER');
  assert.equal((await decide(mechAdmin)).status, 200);
  assert.equal(await roleOf(c.id), 'MECHANIC');
  assert.equal(await prisma.auditLog.count({ where: { targetId: c.id, action: 'ROLE_PROMOTED' } }), 1);
});
