// STEP DRIVERS, phases 3-5 over HTTP (dev backend on :5000; skipped when it is not running): offer timeouts and re-offers,
// reassign during a job, the live trail (private, deleted at the end), admin history / cancel / reports, company stats.
// Own company, two drivers and customers (deleted at the end); uses the seeded admin.tow@ / admin.parts@.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import { prisma } from "../src/prisma.js";
import { sweepOffers } from "../src/services/tow-offers.js";

const API = process.env.API_URL || "http://127.0.0.1:5000/api";
const PASS = "Motexa-Dev-1234!";
const tag = `p3${Date.now()}`;
const BASE = { lat: 32.2211, lng: 35.2544 };
let up = false;
const tok: Record<string, string> = {};
const users: string[] = [];
const jobs: string[] = [];
let companyId = "", A = "", B = "", aUser = "", bUser = "", aTruck = "", bTruck = "", custId = "";

const call = async (who: string | null, method: string, path: string, body?: unknown) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", ...(who && tok[who] ? { authorization: "Bearer " + tok[who] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text };
};
const login = async (email: string) => (await (await fetch(API + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASS }) })).json()).accessToken as string;
const body = (over: any = {}) => ({ pickupAddress: "Test pickup street", dropoffAddress: "Test garage", contactPhone: "0599000111", vehicleMake: "Toyota", vehicleModel: "Corolla", problemType: "WONT_START", pickupLat: BASE.lat, pickupLng: BASE.lng, dropoffLat: 32.23, dropoffLng: 35.27, ...over });
const expire = (id: string) => prisma.towRequest.update({ where: { id }, data: { offerExpiresAt: new Date(Date.now() - 1000) } });
const view = async (id: string) => (await call("cust", "GET", `/requests/tow/${id}`)).json.request;
const T = (name: string, fn: () => Promise<void>) => test(name, async (t) => { if (!up) return t.skip("backend not running on :5000"); await fn(); });
/** a ping the server will accept (it ignores points closer than 5 s) */
const ping = async (who: string, id: string, lat: number, lng: number) => { await prisma.towDriver.updateMany({ where: { user: { email: `${tag}.${who}@motexa.test` } }, data: { lastAt: new Date(Date.now() - 10_000) } }); return call(who, "POST", `/driver/jobs/${id}/location`, { lat, lng }); };

before(async () => {
  try { up = (await fetch(API + "/health")).ok; } catch { up = false; }
  if (!up) return;
  const hash = await argon2.hash(PASS, { type: argon2.argon2id });
  const mk = async (key: string, role: any) => { const u = await prisma.user.create({ data: { email: `${tag}.${key}@motexa.test`, fullName: `${key} Tester Person`, role, status: "ACTIVE", passwordHash: hash } }); users.push(u.id); return u; };
  const owner = await mk("owner", "TOW_PROVIDER");
  custId = (await mk("cust", "CUSTOMER")).id;
  await mk("stranger", "CUSTOMER");
  companyId = (await prisma.towCompanyProfile.create({ data: { userId: owner.id, companyName: `Phase3 ${tag}`, phone: "0599111000", city: "Nablus", verificationStatus: "APPROVED" } })).id;
  for (const [k, off] of [["a", 0], ["b", 0.002]] as const) {
    const u = await mk(k, "TOW_DRIVER");
    const t = await prisma.truck.create({ data: { companyId, plateNumber: `${tag}-${k}`, make: "Isuzu", model: "NPR", truckType: "FLATBED", verificationStatus: "APPROVED", operationalStatus: "AVAILABLE", baseLat: BASE.lat + off, baseLng: BASE.lng } });
    const d = await prisma.towDriver.create({ data: { userId: u.id, companyId, truckId: t.id, phone: "0599222333", licenceNumber: "LIC-1234", approval: "APPROVED" } });
    if (k === "a") { A = d.id; aUser = u.id; aTruck = t.id; } else { B = d.id; bUser = u.id; bTruck = t.id; }
  }
  for (const k of ["owner", "cust", "stranger", "a", "b"]) tok[k] = await login(`${tag}.${k}@motexa.test`);
  tok.admin = await login("admin.tow@motexa.test");
  tok.partsAdmin = await login("admin.parts@motexa.test");
});

after(async () => {
  if (!up) return;
  const ids = [...jobs, A, B, companyId];
  await prisma.auditLog.deleteMany({ where: { OR: [{ targetId: { in: ids } }, { actorId: { in: users } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

const free = async () => { await prisma.truck.updateMany({ where: { companyId }, data: { operationalStatus: "AVAILABLE" } }); await prisma.towRequest.updateMany({ where: { companyId, status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } }); };

T("every new offer has a deadline (default 3 minutes)", async () => {
  const r = await call("cust", "POST", "/requests/tow", { mode: "COMPANY", companyId, ...body() });
  assert.equal(r.status, 201, r.text);
  jobs.push(r.json.request.id);
  const left = new Date(r.json.request.offerExpiresAt).getTime() - Date.now();
  assert.ok(left > 150_000 && left <= 181_000, `about 3 min, got ${left}`);
  assert.equal(r.json.request.driver, null, "choose a company: the company assigns, nobody is auto-assigned");
});

T("choose a company, nobody answers: the request ends (timeout), the customer is told and can choose again", async () => {
  const id = jobs[0];
  assert.equal(await sweepOffers(), 0, "not due yet");
  await expire(id);
  assert.ok((await sweepOffers()) >= 1);
  const v = await view(id);
  assert.equal(v.status, "CANCELLED");
  assert.equal(v.timedOut, true);
  assert.equal(await prisma.notification.count({ where: { userId: custId, title: { startsWith: "Nobody accepted" } } }), 1);
  assert.ok(await prisma.auditLog.count({ where: { targetId: id, action: "TOW_OFFER_TIMED_OUT" } }));
  const again = await call("cust", "POST", "/requests/tow", { mode: "COMPANY", companyId, ...body() });
  assert.equal(again.status, 201, "a new request is possible right away");
  jobs.push(again.json.request.id);
  await free();
});

T("nearest available: an unanswered offer is re-offered to the next driver (not the one who ignored it)", async () => {
  const r = await call("cust", "POST", "/requests/tow", { mode: "NEAREST", ...body() });
  assert.equal(r.status, 201, r.text);
  const id = r.json.request.id;
  jobs.push(id);
  assert.equal(r.json.request.driver.id, A, "A is nearest");
  await expire(id);
  assert.ok((await sweepOffers()) >= 1);
  const v = await view(id);
  assert.equal(v.status, "REQUESTED");
  assert.equal(v.driver.id, B);
  assert.ok(new Date(v.offerExpiresAt).getTime() > Date.now());
  const row = await prisma.towRequest.findUniqueOrThrow({ where: { id } });
  assert.deepEqual(row.triedDriverIds, [A]);
  assert.equal((await call("a", "POST", `/driver/jobs/${id}/accept`)).status, 404, "A lost it");
  assert.equal((await call("b", "POST", `/driver/jobs/${id}/accept`)).status, 200);
  await free();
});

T("reassign during a job: the customer gets the new driver, the old truck is free, rules hold", async () => {
  const r = await call("cust", "POST", "/requests/tow", { mode: "DRIVER", driverId: B, ...body() });
  assert.equal(r.status, 201, r.text);
  const id = r.json.request.id;
  jobs.push(id);
  assert.equal((await call("b", "POST", `/driver/jobs/${id}/accept`)).status, 200);
  assert.equal((await call("b", "POST", `/driver/jobs/${id}/status`, { to: "EN_ROUTE" })).status, 200);
  assert.equal((await call("cust", "POST", `/tow/me/requests/${id}/assign`, { driverId: A })).status, 403, "customer");
  assert.equal((await call("stranger", "POST", `/tow/me/requests/${id}/assign`, { driverId: A })).status, 403);
  assert.equal((await call("owner", "POST", `/tow/me/requests/${id}/assign`, {})).status, 400);
  const re = await call("owner", "POST", `/tow/me/requests/${id}/assign`, { driverId: A });
  assert.equal(re.status, 200, re.text);
  const v = await view(id);
  assert.equal(v.status, "REQUESTED");
  assert.equal(v.driver.id, A);
  assert.equal(v.driver.company.id, companyId);
  assert.equal((await prisma.truck.findUniqueOrThrow({ where: { id: bTruck } })).operationalStatus, "AVAILABLE");
  assert.ok(await prisma.notification.count({ where: { userId: custId, title: { startsWith: "Your driver was changed" } } }));
  assert.ok(await prisma.notification.count({ where: { userId: bUser, title: { startsWith: "A job was moved" } } }));
  assert.equal((await call("b", "POST", `/driver/jobs/${id}/status`, { to: "ARRIVED" })).status, 404, "old driver is out");
  assert.equal((await call("a", "POST", `/driver/jobs/${id}/accept`)).status, 200);
  for (const to of ["EN_ROUTE", "ARRIVED", "LOADING", "IN_PROGRESS"]) assert.equal((await call("a", "POST", `/driver/jobs/${id}/status`, { to })).status, 200, to);
  assert.equal((await call("owner", "POST", `/tow/me/requests/${id}/assign`, { driverId: B })).status, 409, "not once towing started");
  jobs.push(id);
});

let liveJob = "";
T("live trail: only the assigned driver sends; admin sees it; it is deleted when the job ends; the distance stays", async () => {
  const id = jobs[jobs.length - 1]; // the job above: A is towing it
  liveJob = id;
  assert.equal((await ping("b", id, 32.2, 35.25)).status, 404, "not his job");
  assert.equal((await call("cust", "POST", `/driver/jobs/${id}/location`, { lat: 32.2, lng: 35.25 })).status, 403);
  assert.equal((await ping("a", id, 91, 35.25)).status, 400);
  for (const [lat, lng] of [[32.2215, 35.2549], [32.2225, 35.2559], [32.2240, 35.2570]]) assert.equal((await ping("a", id, lat, lng)).status, 200);
  assert.equal((await call("a", "POST", `/driver/jobs/${id}/location`, { lat: 32.225, lng: 35.258 })).status, 200); // too soon: ignored, not an error
  assert.equal(await prisma.towJobTrail.count({ where: { requestId: id } }), 3);
  const d = (await call("admin", "GET", `/admin/tow/jobs/${id}`)).json.job;
  assert.equal(d.trail.length, 3);
  assert.ok(d.distanceMeters > 100, `distance ${d.distanceMeters}`);
  assert.equal(d.driver.live.stale, false);
  for (const who of ["cust", "owner", "a", "partsAdmin", null]) assert.ok([401, 403].includes((await call(who, "GET", `/admin/tow/jobs/${id}`)).status), `${who} cannot read the admin trail`);
  assert.equal(JSON.stringify((await view(id))).includes('"trail"'), false, "the customer gets the live point, never the trail");
  const live = (await call("owner", "GET", "/tow/me/live")).json.jobs.find((j: any) => j.id === id);
  assert.ok(live.driver.live);
  assert.equal((await call("a", "POST", `/driver/jobs/${id}/status`, { to: "DELIVERED" })).status, 200);
  assert.equal((await call("a", "POST", `/driver/jobs/${id}/status`, { to: "COMPLETED" })).status, 200);
  assert.equal(await prisma.towJobTrail.count({ where: { requestId: id } }), 0, "exact trail deleted");
  const end = (await call("admin", "GET", `/admin/tow/jobs/${id}`)).json.job;
  assert.deepEqual(end.trail, []);
  assert.ok(end.distanceMeters > 100, "summary distance kept");
  assert.equal((await ping("a", id, 32.2, 35.25)).status, 409, "no location after the job");
});

T("admin: history filters, cancel with reason (audited), reports", async () => {
  const hist = (q: string) => call("admin", "GET", `/admin/tow/jobs?${q}`);
  assert.equal((await hist("status=NOPE")).status, 400);
  const byCompany = (await hist(`companyId=${companyId}`)).json.jobs;
  assert.ok(byCompany.length >= 4);
  assert.ok(byCompany.every((j: any) => j.company.id === companyId));
  const done = (await hist(`companyId=${companyId}&status=COMPLETED`)).json.jobs;
  assert.deepEqual(done.map((j: any) => j.id), [liveJob]);
  assert.equal((await hist(`driverId=${A}&status=COMPLETED`)).json.jobs.length, 1);
  assert.equal((await hist(`driverId=${B}&status=COMPLETED`)).json.jobs.length, 0);
  assert.equal((await hist(`companyId=${companyId}&from=2999-01-01`)).json.jobs.length, 0);
  const today = new Date().toISOString().slice(0, 10);
  assert.ok((await hist(`companyId=${companyId}&from=${today}&to=${today}`)).json.jobs.length >= 4);
  for (const who of ["cust", "owner", "partsAdmin", null]) assert.ok([401, 403].includes((await call(who, "GET", "/admin/tow/jobs")).status));
  // cancel
  await prisma.truck.updateMany({ where: { companyId }, data: { operationalStatus: "AVAILABLE" } });
  const r = await call("cust", "POST", "/requests/tow", { mode: "DRIVER", driverId: A, ...body() });
  const id = r.json.request.id;
  jobs.push(id);
  assert.equal((await call("a", "POST", `/driver/jobs/${id}/accept`)).status, 200);
  assert.equal((await call("owner", "POST", `/admin/tow/jobs/${id}/cancel`, { reason: "abc" })).status, 403);
  assert.equal((await call("admin", "POST", `/admin/tow/jobs/${id}/cancel`, {})).status, 400);
  assert.equal((await call("admin", "POST", `/admin/tow/jobs/${id}/cancel`, { reason: "Duplicate request" })).status, 200);
  assert.equal((await call("admin", "POST", `/admin/tow/jobs/${id}/cancel`, { reason: "Again please" })).status, 409, "only open jobs");
  const v = await view(id);
  assert.equal(v.status, "CANCELLED");
  assert.equal(v.cancelReason, "Duplicate request");
  assert.ok(await prisma.auditLog.count({ where: { targetId: id, action: "TOW_REQUEST_CANCELLED" } }));
  assert.equal((await prisma.truck.findUniqueOrThrow({ where: { id: aTruck } })).operationalStatus, "AVAILABLE");
  // reports
  assert.equal((await call("cust", "POST", `/requests/tow/${liveJob}/report`, { body: "He took the long road" })).status, 201);
  const open = (await call("admin", "GET", "/admin/tow/reports?open=1")).json.reports;
  const mine = open.find((x: any) => x.job.id === liveJob);
  assert.ok(mine && mine.job.company === `Phase3 ${tag}` && mine.job.driver);
  assert.equal(JSON.stringify(mine).includes("0599"), false, "no phones in reports");
  assert.equal((await call("owner", "GET", "/admin/tow/reports")).status, 403);
  assert.equal((await call("owner", "POST", `/admin/tow/reports/${mine.id}/close`, {})).status, 403);
  assert.equal((await call("admin", "POST", `/admin/tow/reports/${mine.id}/close`, {})).status, 200);
  assert.equal((await call("admin", "POST", `/admin/tow/reports/${mine.id}/close`, {})).status, 404);
  assert.ok(!(await call("admin", "GET", "/admin/tow/reports?open=1")).json.reports.some((x: any) => x.id === mine.id));
  assert.equal((await call("admin", "GET", `/admin/tow/jobs/${liveJob}`)).json.job.reports.length, 1);
});

T("company stats come from real jobs", async () => {
  assert.equal((await call("cust", "GET", "/tow/me/stats")).status, 403);
  await call("cust", "POST", `/requests/tow/${liveJob}/review`, { stars: 4, comment: "ok" });
  const s = (await call("owner", "GET", "/tow/me/stats")).json.stats;
  assert.equal(s.completed, 1);
  assert.ok(s.cancelled >= 3);
  assert.equal(s.timeouts, 1);
  assert.ok(s.distanceKm > 0);
  assert.deepEqual(s.rating, { avg: 4, count: 1 });
  const a = s.drivers.find((d: any) => d.id === A);
  assert.equal(a.completed, 1);
  assert.deepEqual(a.rating, { avg: 4, count: 1 });
  assert.equal(s.drivers.find((d: any) => d.id === B).completed, 0);
  assert.equal(s.drivers.find((d: any) => d.id === B).rating.avg, null);
  void aUser;
});
