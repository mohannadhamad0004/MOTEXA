// Garages + live locations (docs/agents/RUN-LOG.md, mechanics like tow). Own fixtures, removed afterwards (audit rows stay):
//  1. only an APPROVED garage owner adds a mechanic, and only to his own garage; the new MECHANIC login stays PENDING (no Online switch,
//     not listed to customers) until a mechanics admin approves it; an existing account can never become a garage mechanic (one or the other)
//  2. a request to a garage: the owner sees the area only + "nearest available" (live point first), assigns; the mechanic accepts, goes
//     on the way (location shared), arrives, starts, completes; exact location only during the job; the customer sees the live point only
//     while on the way / arrived; the path and the live point are deleted at the end; other owners / customers get 404
//  3. on duty: pings refused while Offline, only the latest point stored (>= 30 s apart), Offline clears it; tow drivers the same,
//     and the tow / mechanics admins' online layers; customers can't read them
//  4. on-site needs a pin, a workshop visit doesn't; On the way / Arrived exist only on site
import { test, before, after } from 'node:test'; import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { prisma } from '../src/prisma.js';
import { removeStoredFile } from '../src/uploads/providerFiles.js';
const API = process.env.API_URL || 'http://127.0.0.1:5000/api';
const call = async (tok, method, path, body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
};
const token = (u) => jwt.sign({ role: u.role, sessionVersion: u.sessionVersion }, process.env.JWT_SECRET, { subject: u.id, expiresIn: '15m', algorithm: 'HS256' });
const tag = 'garage-' + randomUUID().slice(0, 8);
const users = [], garages = [];
const NABLUS = { lat: 32.2211, lng: 35.2544 }, CUSTOMER_AT = { lat: 32.226789, lng: 35.243456 };
let up = true, jpeg = '', admin = null, tok = {}, u = {}, gA = null, gB = null;

const mk = async (key, role, extra = {}) => {
  const x = await prisma.user.create({ data: { email: `${tag}.${key}@example.invalid`, fullName: `${key} Tester Person`, passwordHash: 'unused', role, status: 'ACTIVE', ...extra } });
  users.push(x.id); u[key] = x; tok[key] = token(x); return x;
};
const mechBody = (key) => ({ fullName: `${key} Garage Mechanic`, email: `${tag}.${key}@example.invalid`, phone: '0599 123 456', skills: ['Engine', 'Brakes'], idPhoto: { name: 'id.jpg', dataBase64: jpeg }, password: 'Garage-Test-1234!' });
const login = async (email) => { const x = await prisma.user.findUniqueOrThrow({ where: { email } }); users.push(x.id); return { user: x, tok: token(x) }; };
const request = (extra) => ({ serviceMode: 'ON_SITE', carMake: 'Kia', carModel: 'Rio', problemDescription: 'Garage test: the engine will not start', locationText: 'Exact Street 7, Rafidia, Nablus', locationLat: CUSTOMER_AT.lat, locationLng: CUSTOMER_AT.lng, contactPhone: '+970 599 765 432', ...extra });

before(async () => {
  try { up = (await fetch(API + '/health')).ok; } catch { up = false; }
  if (!up) return;
  jpeg = (await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 120, g: 90, b: 60 } } }).jpeg().toBuffer()).toString('base64');
  admin = await prisma.user.findFirstOrThrow({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
  tok.admin = token(admin);
  await mk('ownerA', 'GARAGE_OWNER'); await mk('ownerB', 'GARAGE_OWNER'); await mk('cust', 'CUSTOMER'); await mk('other', 'CUSTOMER');
  gA = await prisma.garageProfile.create({ data: { userId: u.ownerA.id, garageName: `Garage A ${tag}`, phone: '0599000111', city: 'Nablus', services: ['Engine', 'Brakes'], baseLat: NABLUS.lat, baseLng: NABLUS.lng, verificationStatus: 'APPROVED' } });
  gB = await prisma.garageProfile.create({ data: { userId: u.ownerB.id, garageName: `Garage B ${tag}`, phone: '0599000222', city: 'Nablus', services: ['Engine'], verificationStatus: 'PENDING' } });
  garages.push(gA.id, gB.id);
});

after(async () => {
  if (!up) return;
  const files = await prisma.providerFile.findMany({ where: { OR: [{ garageMechanic: { garageId: { in: garages } } }, { ownerUserId: { in: users } }] }, select: { storageKey: true } });
  await Promise.all(files.map((f) => removeStoredFile(f.storageKey)));
  await prisma.mechanicRequest.deleteMany({ where: { OR: [{ customerId: { in: users } }, { garageId: { in: garages } }] } });
  await prisma.towDriver.deleteMany({ where: { userId: { in: users } } });
  await prisma.towCompanyProfile.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } }); // cascades: garage profiles, garage mechanics, files
  await prisma.$disconnect();
});

test('garage application: apply, onboarding, submit; only the mechanics department reviews it; approval makes the account GARAGE_OWNER', async () => {
  if (!up) return;
  const applicant = await mk('applicant', 'CUSTOMER');
  const OK = { acknowledgeProviderAccount: true, acceptTerms: true, businessName: `Applied Garage ${tag}`, phone: '0599 222 333', city: 'Nablus' };
  assert.equal((await call(tok.applicant, 'POST', '/apply/garage', { ...OK, businessName: '' })).status, 400);
  assert.equal((await call(tok.applicant, 'POST', '/apply/garage', OK)).status, 201);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: applicant.id } })).role, 'CUSTOMER', 'applying never changes the role');
  assert.equal((await call(tok.applicant, 'PUT', '/provider/onboarding/info', { services: ['Teleportation'] })).status, 400, 'services from the list only');
  const info = await call(tok.applicant, 'PUT', '/provider/onboarding/info', { ownerName: 'Applicant Tester Person', services: ['Engine', 'Electrical'], workingHours: 'Sat–Thu 8:00–17:00', baseLat: NABLUS.lat, baseLng: NABLUS.lng });
  assert.equal(info.status, 200, JSON.stringify(info.data));
  assert.equal(info.data.application.kind, 'GARAGE');
  assert.deepEqual(info.data.application.requiredDocuments, ['COMMERCIAL_REGISTRATION', 'OWNER_ID', 'WORKSHOP_PHOTO']);
  for (const kind of info.data.application.requiredDocuments) assert.equal((await call(tok.applicant, 'POST', '/provider/onboarding/documents', { kind, name: `${kind}.jpg`, dataBase64: jpeg })).status, 201);
  const sub = await call(tok.applicant, 'POST', '/provider/onboarding/submit');
  assert.equal(sub.status, 200, JSON.stringify(sub.data)); assert.equal(sub.data.application.status, 'PENDING');
  const appId = sub.data.application.id;
  const towAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE', adminPermissions: { some: { permission: 'MANAGE_TOWING' } }, NOT: { adminPermissions: { some: { permission: 'MANAGE_MECHANICS' } } } } });
  if (towAdmin) assert.equal((await call(token(towAdmin), 'GET', `/admin/providers/garage/applications/${appId}`)).status, 403, 'a tow admin cannot review garages');
  const detail = (await call(tok.admin, 'GET', `/admin/providers/garage/applications/${appId}`)).data.application;
  assert.equal((await call(tok.admin, 'POST', `/admin/providers/garage/applications/${appId}/approve`)).status, 409, 'checklist: documents not accepted yet');
  for (const d of detail.documents) assert.equal((await call(tok.admin, 'PATCH', `/admin/providers/garage/applications/${appId}/documents/${d.id}`, { status: 'ACCEPTED' })).status, 200);
  assert.equal((await call(tok.admin, 'POST', `/admin/providers/garage/applications/${appId}/approve`)).status, 200);
  const promoted = await prisma.user.findUniqueOrThrow({ where: { id: applicant.id } });
  assert.equal(promoted.role, 'GARAGE_OWNER'); assert.ok(promoted.sessionVersion > applicant.sessionVersion, 'old sessions end');
  const g = await call(token(promoted), 'GET', '/garage/me');
  assert.equal(g.status, 200); assert.deepEqual(g.data.garage.services, ['Engine', 'Electrical']);
  garages.push(appId);
});

test('only an APPROVED garage owner adds mechanics, only to his own garage; a new mechanic is PENDING until the mechanics admin approves', async () => {
  if (!up) return;
  assert.equal((await call(tok.ownerB, 'POST', '/garage/me/mechanics', mechBody('m0'))).status, 403, 'a garage that is not approved cannot add mechanics');
  assert.equal((await call(tok.cust, 'POST', '/garage/me/mechanics', mechBody('m0'))).status, 403, 'a customer cannot add mechanics');
  assert.equal((await call(tok.admin, 'POST', '/garage/me/mechanics', mechBody('m0'))).status, 403, 'not even an admin, through the owner endpoint');
  const added = await call(tok.ownerA, 'POST', '/garage/me/mechanics', mechBody('m1'));
  assert.equal(added.status, 201, JSON.stringify(added.data));
  const m1 = await login(`${tag}.m1@example.invalid`);
  assert.equal(m1.user.role, 'MECHANIC');
  const row = await prisma.garageMechanic.findUniqueOrThrow({ where: { userId: m1.user.id } });
  assert.equal(row.garageId, gA.id, 'added to HIS garage'); assert.equal(row.approval, 'PENDING'); assert.equal(row.offline, true);
  assert.equal(await prisma.mechanicProfile.count({ where: { userId: m1.user.id } }), 0, 'never also an independent mechanic');
  assert.ok(await prisma.auditLog.findFirst({ where: { action: 'GARAGE_MECHANIC_ADDED', targetId: row.id, actorId: u.ownerA.id } }));
  // his home is the garage-mechanic one: GET /mechanics/me never starts an independent application for him
  assert.equal((await call(m1.tok, 'GET', '/mechanics/me')).status, 404);
  assert.equal(await prisma.mechanicProfile.count({ where: { userId: m1.user.id } }), 0, 'no draft application created');
  // pending: no Online switch, no pings, not offered to customers
  assert.equal((await call(m1.tok, 'PUT', '/mechanic/me/availability', { offline: false })).status, 409);
  assert.equal((await call(m1.tok, 'POST', '/mechanic/me/location', NABLUS)).status, 409);
  const card = (await call(tok.cust, 'GET', `/catalog/garages/${gA.id}`)).data.garage;
  assert.equal(card.mechanics.length, 0, 'a pending mechanic is not listed');
  assert.equal((await call(tok.cust, 'POST', '/requests/mechanic', request({ mechanicId: m1.user.id }))).status, 404, 'nor can be asked directly');
  // another owner's mechanic: invisible to owner A
  const other = await prisma.user.create({ data: { email: `${tag}.mb@example.invalid`, fullName: 'Other Garage Mechanic', passwordHash: 'unused', role: 'MECHANIC', status: 'ACTIVE' } });
  users.push(other.id);
  const otherRow = await prisma.garageMechanic.create({ data: { userId: other.id, garageId: gB.id, phone: '0599000333', skills: ['Engine'] } });
  assert.equal((await call(tok.ownerA, 'PATCH', `/garage/me/mechanics/${otherRow.id}`, { phone: '0599000444' })).status, 404, 'own garage only');
  assert.equal((await call(tok.ownerA, 'POST', '/garage/me/requests/x/assign', { mechanicId: otherRow.id })).status, 404);
  // one or the other: an existing account (customer, independent mechanic, anyone) never becomes a garage mechanic
  const taken = await call(tok.ownerA, 'POST', '/garage/me/mechanics', { ...mechBody('dup'), email: u.cust.email });
  assert.equal(taken.status, 409); assert.doesNotMatch(taken.data.message, /registered|exists/i, 'neutral message');
  // the mechanics admin approves the ID
  assert.equal((await call(tok.cust, 'POST', `/admin/garages/mechanics/${row.id}/review`, { decision: 'APPROVE' })).status, 403);
  const pending = (await call(tok.admin, 'GET', '/admin/garages/mechanics?approval=PENDING')).data.mechanics;
  assert.ok(pending.some((m) => m.id === row.id && m.idUri?.startsWith('/files/private/')), 'the admin sees the private ID');
  // the private ID file itself: the owner and a mechanics admin may open it, a parts-only admin and the customer may not
  const idUri = pending.find((m) => m.id === row.id).idUri;
  const adminWith = (has, not) => prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE', adminPermissions: { some: { permission: has } }, ...(not ? { NOT: { adminPermissions: { some: { permission: not } } } } : {}) } });
  const [mechAdmin, partsAdmin] = await Promise.all([adminWith('MANAGE_MECHANICS'), adminWith('MANAGE_SPARE_PARTS', 'MANAGE_MECHANICS')]);
  assert.equal((await call(tok.ownerA, 'GET', idUri)).status, 200, 'the garage owner opens his mechanic\'s ID');
  if (mechAdmin) assert.equal((await call(token(mechAdmin), 'GET', idUri)).status, 200, 'a mechanics admin opens a garage mechanic\'s ID');
  if (partsAdmin) assert.equal((await call(token(partsAdmin), 'GET', idUri)).status, 403, 'a parts admin does not');
  assert.equal((await call(tok.cust, 'GET', idUri)).status, 403);
  assert.equal((await call(tok.admin, 'POST', `/admin/garages/mechanics/${row.id}/review`, { decision: 'APPROVE' })).status, 200);
  assert.equal((await prisma.garageMechanic.findUniqueOrThrow({ where: { id: row.id } })).approval, 'APPROVED');
  assert.equal((await call(m1.tok, 'PUT', '/mechanic/me/availability', { offline: false })).status, 200, 'approved: may go online');
  u.m1 = m1.user; tok.m1 = m1.tok; u.m1Row = row;
});

test('on duty: refused while Offline, only the latest point (>= 30 s apart), Offline clears it; admins see online people, customers never', async () => {
  if (!up || !tok.m1) return;
  assert.equal((await call(tok.m1, 'POST', '/mechanic/me/location', { lat: 99, lng: 99 })).status, 400, 'outside the area');
  const first = await call(tok.m1, 'POST', '/mechanic/me/location', { lat: 32.2251, lng: 35.2501 });
  assert.equal(first.status, 200); assert.equal(first.data.stored, true);
  assert.equal((await call(tok.m1, 'POST', '/mechanic/me/location', { lat: 32.3, lng: 35.3 })).data.stored, false, 'a second ping within 30 s is ignored');
  const row = await prisma.garageMechanic.findUniqueOrThrow({ where: { id: u.m1Row.id } });
  assert.deepEqual([row.lastLat, row.lastLng], [32.2251, 35.2501], 'only the latest point is kept, on his own row');
  const live = (await call(tok.admin, 'GET', '/admin/mechanics/live')).data;
  assert.ok(live.mechanics.some((m) => m.id === row.id && m.live?.lat === 32.2251));
  assert.equal((await call(tok.cust, 'GET', '/admin/mechanics/live')).status, 403);
  assert.doesNotMatch(JSON.stringify((await call(tok.cust, 'GET', `/catalog/garages/${gA.id}`)).data), /32\.2251|lastLat|"live"/, 'customers never get on-duty points');
  assert.equal((await call(tok.m1, 'PUT', '/mechanic/me/availability', { offline: true })).status, 200);
  const off = await prisma.garageMechanic.findUniqueOrThrow({ where: { id: row.id } });
  assert.deepEqual([off.lastLat, off.lastLng, off.lastAt], [null, null, null], 'Offline clears the point');
  assert.equal((await call(tok.m1, 'POST', '/mechanic/me/location', NABLUS)).status, 409, 'no pings while Offline');
  // tow drivers: the same rules
  const owner = await mk('towOwner', 'TOW_PROVIDER'), driver = await mk('driver', 'TOW_DRIVER');
  const company = await prisma.towCompanyProfile.create({ data: { userId: owner.id, companyName: `Tow ${tag}`, phone: '0599000555', city: 'Nablus', verificationStatus: 'APPROVED' } });
  await prisma.towDriver.create({ data: { userId: driver.id, companyId: company.id, phone: '0599000666', approval: 'APPROVED' } });
  assert.equal((await call(tok.driver, 'POST', '/driver/me/location', NABLUS)).data.stored, true);
  assert.ok((await call(tok.admin, 'GET', '/admin/tow/online')).data.drivers.some((d) => d.name === driver.fullName && d.live));
  assert.ok((await call(tok.towOwner, 'GET', '/tow/me/live')).data.drivers.some((d) => d.name === driver.fullName));
  assert.equal((await call(tok.cust, 'GET', '/admin/tow/online')).status, 403);
  assert.equal((await call(tok.driver, 'PUT', '/driver/me/availability', { offline: true })).status, 200);
  assert.equal((await prisma.towDriver.findUniqueOrThrow({ where: { userId: driver.id } })).lastLat, null, 'Offline clears the driver point');
  assert.equal((await call(tok.driver, 'POST', '/driver/me/location', NABLUS)).status, 409);
});

test('a request to a garage: area only + nearest available, assign, on-site steps with live location, exact only during the job, cleared after', async () => {
  if (!up || !tok.m1) return;
  // a second approved mechanic, online and farther away
  assert.equal((await call(tok.ownerA, 'POST', '/garage/me/mechanics', mechBody('m2'))).status, 201);
  const m2 = await login(`${tag}.m2@example.invalid`);
  const m2Row = await prisma.garageMechanic.update({ where: { userId: m2.user.id }, data: { approval: 'APPROVED', offline: false, lastLat: 32.31, lastLng: 35.31, lastAt: new Date() } });
  await prisma.garageMechanic.update({ where: { id: u.m1Row.id }, data: { offline: false, lastLat: 32.2262, lastLng: 35.2440, lastAt: new Date() } });

  assert.equal((await call(tok.cust, 'POST', '/requests/mechanic', request({ garageId: gA.id, locationLat: undefined, locationLng: undefined }))).status, 400, 'on site needs a pin');
  assert.equal((await call(tok.cust, 'POST', '/requests/mechanic', request({ garageId: gB.id }))).status, 404, 'a garage that is not approved');
  const made = await call(tok.cust, 'POST', '/requests/mechanic', request({ garageId: gA.id, skill: 'Engine' }));
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const id = made.data.request.id;
  assert.equal(made.data.request.mechanic, null, 'no mechanic until the owner assigns one');

  const ownerView = (await call(tok.ownerA, 'GET', `/garage/me/requests/${id}`)).data;
  assert.equal(ownerView.request.location.approximate, true); assert.equal(ownerView.request.contactPhone, null);
  assert.doesNotMatch(JSON.stringify(ownerView.request), /Exact Street|765 432|32\.2267/, 'the owner sees the area only before acceptance');
  assert.deepEqual(ownerView.suggestions.map((s) => s.id), [u.m1Row.id, m2Row.id], 'nearest available first (live points)');
  assert.equal(ownerView.suggestions[0].source, 'live');
  assert.equal((await call(tok.ownerB, 'GET', `/garage/me/requests/${id}`)).status, 403, 'another owner (not approved) cannot even open the garage endpoints');

  assert.equal((await call(tok.ownerA, 'POST', `/garage/me/requests/${id}/assign`, { mechanicId: u.m1Row.id })).status, 200);
  const before = (await call(tok.m1, 'GET', `/requests/mechanic/${id}`)).data.request;
  assert.equal(before.location.approximate, true);
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/location`, CUSTOMER_AT)).status, 409, 'no job location before accepting');
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/start`)).status, 409, 'on site: start only after arriving');
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/accept`)).status, 200);
  const accepted = (await call(tok.m1, 'GET', `/requests/mechanic/${id}`)).data.request;
  assert.equal(accepted.location.approximate, false); assert.equal(accepted.location.text, 'Exact Street 7, Rafidia, Nablus'); assert.equal(accepted.contactPhone, '+970 599 765 432');
  assert.equal((await call(tok.ownerA, 'GET', `/garage/me/requests/${id}`)).data.request.location.approximate, false, 'the owner too, during the job');

  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/location`, { lat: 32.2240, lng: 35.2470 })).status, 200);
  assert.equal((await call(tok.cust, 'GET', `/requests/mechanic/${id}`)).data.request.live, null, 'accepted, not on the way yet: the customer sees no point');
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/en-route`)).status, 200);
  const following = (await call(tok.cust, 'GET', `/requests/mechanic/${id}`)).data.request;
  assert.ok(following.live && following.live.lat === 32.224, 'on the way: the customer follows HIS mechanic');
  assert.equal(following.mechanic.name, 'm1', 'a garage mechanic is shown by first name');
  assert.equal(following.mechanic.workshopName, gA.garageName);
  assert.equal((await call(tok.other, 'GET', `/requests/mechanic/${id}`)).status, 404, 'another customer never sees it');
  assert.ok((await call(tok.ownerA, 'GET', '/garage/me/live')).data.jobs.some((j) => j.id === id && j.live), 'the owner sees the job live');
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/arrived`)).status, 200);
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/start`)).status, 200);
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/complete`)).status, 200);
  const done = await prisma.mechanicRequest.findUniqueOrThrow({ where: { id } });
  assert.deepEqual([done.liveLat, done.liveLng, done.liveAt], [null, null, null], 'the live point is deleted at the end');
  assert.equal(await prisma.mechanicJobTrail.count({ where: { requestId: id } }), 0, 'and the path');
  const after = (await call(tok.m1, 'GET', `/requests/mechanic/${id}`)).data.request;
  assert.equal(after.location.approximate, true, 'back to the area after the job');
  assert.deepEqual(after.timeline.map((t) => t.status), ['REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']);
  assert.equal((await call(tok.cust, 'GET', `/requests/mechanic/${id}`)).data.request.live, null);
});

test('workshop visits: the pin is optional and there is no On the way / Arrived; a garage mechanic who declines gives the request back', async () => {
  if (!up || !tok.m1) return;
  const made = await call(tok.cust, 'POST', '/requests/mechanic', request({ mechanicId: u.m1.id, serviceMode: 'WORKSHOP', locationLat: undefined, locationLng: undefined }));
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const id = made.data.request.id;
  assert.equal(made.data.request.garage.id, gA.id, 'asking a garage mechanic directly involves his garage');
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/decline`, { reason: 'Fully booked' })).status, 200);
  const back = await prisma.mechanicRequest.findUniqueOrThrow({ where: { id } });
  assert.equal(back.status, 'REQUESTED'); assert.equal(back.mechanicUserId, null, 'back to the garage to assign someone else');
  assert.equal((await call(tok.ownerA, 'POST', `/garage/me/requests/${id}/assign`, { mechanicId: u.m1Row.id })).status, 200);
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/accept`)).status, 200);
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/en-route`)).status, 409, 'no On the way at the workshop');
  assert.equal((await call(tok.m1, 'POST', `/mechanic/requests/${id}/start`)).status, 200, 'a workshop job starts after accepting');
  assert.equal((await call(tok.cust, 'POST', '/requests/mechanic', request({ mechanicId: u.m1.id, serviceMode: 'ELSEWHERE' }))).status, 400);
});
