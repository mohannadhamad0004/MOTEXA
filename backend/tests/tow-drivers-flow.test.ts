// STEP DRIVERS, phases 1-2, end to end over HTTP against the dev backend on :5000 (skipped when it is not running):
// company adds a driver (photo + licence) -> tow admin approves -> driver is FREE -> customer sees the card -> requests him -> driver
// accepts -> strict steps -> chat -> completed -> customer rates -> ratings update. Also: permissions, validation, privacy.
// It creates its own company / owner / driver / customer (deleted at the end) and uses the seeded admin.tow@motexa.test.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import sharp from "sharp";
import { prisma } from "../src/prisma.js";
import { removeStoredFile } from "../src/uploads/providerFiles.js";

const API = process.env.API_URL || "http://127.0.0.1:5000/api";
const PASS = "Motexa-Dev-1234!";
const tag = `d${Date.now()}`;
let up = false;
const tok: Record<string, string> = {};
const users: string[] = [];
const requests: string[] = [];
let companyId = "", truckId = "", driverId = "", driverUserId = "", jobId = "";
const BASE = { lat: 32.2211, lng: 35.2544 };

const call = async (who: string | null, method: string, path: string, body?: unknown) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", ...(who && tok[who] ? { authorization: "Bearer " + tok[who] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* binary */ }
  return { status: r.status, json, text };
};
const login = async (email: string) => (await (await fetch(API + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASS }) })).json()).accessToken as string;
const b64 = (buf: Buffer) => buf.toString("base64");
const noise = (w: number, h: number) => { const px = Buffer.alloc(w * h * 3); for (let i = 0; i < px.length; i++) px[i] = (i * 7919 + (i >> 3)) & 255; return sharp(px, { raw: { width: w, height: h, channels: 3 } }); };
let jpeg: Buffer, webp: Buffer, gif: Buffer;

before(async () => {
  try { up = (await fetch(API + "/health")).ok; } catch { up = false; }
  if (!up) return;
  jpeg = await noise(900, 700).jpeg({ quality: 90 }).toBuffer(); // a few hundred KB: the old 16 kb body limit refused this
  webp = await noise(400, 300).webp().toBuffer();
  gif = Buffer.from("R0lGODlhAQABAAAAACw=", "base64");
  const hash = await argon2.hash(PASS, { type: argon2.argon2id });
  const mk = async (key: string, role: any) => {
    const u = await prisma.user.create({ data: { email: `${tag}.${key}@motexa.test`, fullName: `${key} Tester Person`, role, status: "ACTIVE", passwordHash: hash } });
    users.push(u.id);
    return u;
  };
  const owner = await mk("owner", "TOW_PROVIDER");
  await mk("cust", "CUSTOMER");
  await mk("stranger", "CUSTOMER");
  const company = await prisma.towCompanyProfile.create({ data: { userId: owner.id, companyName: `Flow Test ${tag}`, phone: "0599111000", city: "Nablus", verificationStatus: "APPROVED" } });
  companyId = company.id;
  truckId = (await prisma.truck.create({ data: { companyId, plateNumber: `${tag}-99`, make: "Isuzu", model: "NPR", truckType: "FLATBED", verificationStatus: "APPROVED", operationalStatus: "AVAILABLE", baseLat: BASE.lat, baseLng: BASE.lng } })).id;
  for (const k of ["owner", "cust", "stranger"]) tok[k] = await login(`${tag}.${k}@motexa.test`);
  tok.admin = await login("admin.tow@motexa.test");
  tok.partsAdmin = await login("admin.parts@motexa.test");
});

after(async () => {
  if (!up) return;
  const files = await prisma.providerFile.findMany({ where: { towDriver: { companyId } }, select: { storageKey: true } });
  await Promise.all(files.map((f) => removeStoredFile(f.storageKey)));
  const ids = [...requests, driverId, companyId].filter(Boolean);
  await prisma.auditLog.deleteMany({ where: { OR: [{ targetId: { in: ids } }, { actorId: { in: users } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.passwordResetRequest.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } }); // cascades company, trucks, drivers, requests, reviews, messages
  await prisma.$disconnect();
});

const T = (name: string, fn: () => Promise<void>) => test(name, async (t) => { if (!up) return t.skip("backend not running on :5000"); await fn(); });
const driverBody = (over: any = {}) => ({ fullName: "Sami Khalil Driver", email: `${tag}.drv@motexa.test`, phone: "0599222333", licenceNumber: "LIC-4455", licencePhoto: { dataBase64: b64(jpeg), name: "l.jpg" }, photo: { dataBase64: b64(webp), name: "p.webp" }, truckId: undefined as any, ...over });

T("the old failure: a 300 KB body is refused by the 16 kb JSON limit that still guards small routes", async () => {
  const r = await call("owner", "POST", "/driver/jobs/x/decline", { reason: "x".repeat(300_000) });
  assert.equal(r.status, 413); // this is what adding a driver with a photo used to hit on /tow/me/drivers
});

T("add driver: validation and permissions", async () => {
  assert.equal((await call(null, "POST", "/tow/me/drivers", driverBody())).status, 401);
  assert.equal((await call("cust", "POST", "/tow/me/drivers", driverBody())).status, 403);
  assert.equal((await call("admin", "POST", "/tow/me/drivers", driverBody())).status, 403);
  assert.equal((await call("owner", "POST", "/tow/me/drivers", driverBody({ licencePhoto: undefined }))).status, 400); // licence photo required
  assert.equal((await call("owner", "POST", "/tow/me/drivers", driverBody({ licenceNumber: "1" }))).status, 400);
  assert.equal((await call("owner", "POST", "/tow/me/drivers", driverBody({ phone: "abc" }))).status, 400);
  assert.equal((await call("owner", "POST", "/tow/me/drivers", driverBody({ email: "nope" }))).status, 400);
  const bad = await call("owner", "POST", "/tow/me/drivers", driverBody({ photo: { dataBase64: b64(gif) } }));
  assert.equal(bad.status, 400);
  assert.match(bad.json.message, /JPEG, PNG and WEBP/);
  assert.equal(await prisma.user.count({ where: { email: `${tag}.drv@motexa.test` } }), 0, "a failed add leaves nothing behind");
});

T("add driver with a photo (WEBP) and a licence (JPEG) works: invited, PENDING, never visible to customers", async () => {
  const r = await call("owner", "POST", "/tow/me/drivers", driverBody({ truckId }));
  assert.equal(r.status, 201, r.text);
  driverId = r.json.driverId;
  driverUserId = (await prisma.towDriver.findUniqueOrThrow({ where: { id: driverId } })).userId;
  users.push(driverUserId);
  assert.equal((await call("owner", "POST", "/tow/me/drivers", driverBody({ truckId }))).status, 409); // same email
  const list = (await call("owner", "GET", "/tow/me/drivers")).json.drivers.find((d: any) => d.id === driverId);
  assert.equal(list.approval, "PENDING");
  assert.equal(list.status, "UNAPPROVED");
  assert.ok(list.photoUri?.startsWith("/files/public/") && list.licenceUri?.startsWith("/files/private/"));
  const near = (await call("cust", "GET", `/catalog/tow/drivers?lat=${BASE.lat}&lng=${BASE.lng}`)).json.drivers;
  assert.ok(!near.some((d: any) => d.id === driverId), "unapproved driver is not offered");
  assert.equal((await call("cust", "GET", `/catalog/tow/companies/${companyId}/drivers`)).json.drivers.length, 0);
  // an unapproved driver cannot be requested directly either
  const pending = await call("cust", "POST", "/requests/tow", { mode: "DRIVER", driverId, ...reqBody() });
  assert.equal(pending.status, 404);
});

const reqBody = (over: any = {}) => ({ pickupAddress: "Test pickup street", dropoffAddress: "Test garage", contactPhone: "0599000111", vehicleMake: "Toyota", vehicleModel: "Corolla", problemType: "WONT_START", pickupLat: BASE.lat, pickupLng: BASE.lng, dropoffLat: 32.23, dropoffLng: 35.27, ...over });

T("licence privacy: owner + tow admin read it; customer / parts admin / anonymous cannot; the photo is public", async () => {
  const l = (await call("owner", "GET", "/tow/me/drivers")).json.drivers.find((d: any) => d.id === driverId);
  assert.equal((await call("owner", "GET", l.licenceUri)).status, 200);
  assert.equal((await call("admin", "GET", l.licenceUri)).status, 200);
  for (const who of ["cust", "stranger", "partsAdmin", null]) assert.ok([401, 403].includes((await call(who, "GET", l.licenceUri)).status), `${who} refused`);
  assert.equal((await call(null, "GET", l.licenceUri.replace("private", "public"))).status, 404, "licence is never public");
  assert.equal((await call(null, "GET", l.photoUri)).status, 200);
});

T("licence review: permissions, validation, approve", async () => {
  assert.equal((await call("owner", "GET", "/admin/tow/drivers")).status, 403);
  assert.equal((await call("cust", "GET", "/admin/tow/drivers")).status, 403);
  assert.equal((await call("partsAdmin", "GET", "/admin/tow/drivers")).status, 403);
  assert.equal((await call("owner", "POST", `/admin/tow/drivers/${driverId}/review`, { decision: "APPROVE" })).status, 403);
  const pending = (await call("admin", "GET", "/admin/tow/drivers?status=PENDING")).json.drivers;
  assert.ok(pending.some((d: any) => d.id === driverId && d.licenceUri));
  assert.equal((await call("admin", "POST", `/admin/tow/drivers/${driverId}/review`, { decision: "MAYBE" })).status, 400);
  assert.equal((await call("admin", "POST", `/admin/tow/drivers/${driverId}/review`, { decision: "REJECT" })).status, 400); // reason required
  assert.equal((await call("admin", "POST", `/admin/tow/drivers/00000000-0000-4000-8000-000000000000/review`, { decision: "APPROVE" })).status, 404);
  assert.equal((await call("admin", "POST", `/admin/tow/drivers/${driverId}/review`, { decision: "REJECT", reason: "Blurry photo" })).status, 200);
  assert.equal((await call("owner", "GET", "/tow/me/drivers")).json.drivers.find((d: any) => d.id === driverId).approval, "REJECTED");
  assert.equal((await call("admin", "POST", `/admin/tow/drivers/${driverId}/review`, { decision: "APPROVE" })).status, 200);
  assert.ok(await prisma.auditLog.count({ where: { targetId: driverId, action: "TOW_DRIVER_APPROVED" } }));
  // the driver gets his password (the emailed code is not readable here) and signs in
  await prisma.user.update({ where: { id: driverUserId }, data: { passwordHash: await argon2.hash(PASS, { type: argon2.argon2id }) } });
  tok.drv = await login(`${tag}.drv@motexa.test`);
  assert.ok(tok.drv);
  const me = (await call("drv", "GET", "/driver/me")).json.driver;
  assert.equal(me.approval, "APPROVED");
  assert.equal(me.status, "FREE");
});

T("the customer sees the driver card: rating New, plate masked, company always, never a phone or email", async () => {
  const list = (await call("cust", "GET", `/catalog/tow/drivers?lat=${BASE.lat}&lng=${BASE.lng}`)).json.drivers;
  const d = list.find((x: any) => x.id === driverId);
  assert.ok(d, "approved FREE driver is offered");
  assert.equal(d.name, "Sami D.");
  assert.deepEqual(d.rating, { avg: null, count: 0 });
  assert.equal(d.completedTows, 0);
  assert.equal(d.truck.plate, "•••• 99");
  assert.equal(d.company.id, companyId);
  assert.equal(d.company.verified, true);
  assert.ok(d.photoUri.startsWith("/files/public/"));
  assert.equal(d.distanceKm, 0);
  assert.ok(Math.abs(d.pin.lat - 32.221) < 0.0006); // rounded to 3 decimals
  const json = JSON.stringify(list);
  assert.ok(!json.includes("0599222333") && !json.includes(`${tag}.drv@`) && !json.includes("LIC-4455") && !json.includes(`${tag}-99`));
  const comp = (await call("cust", "GET", "/catalog/tow/companies")).json.companies.find((c: any) => c.id === companyId);
  assert.equal(comp.freeDrivers, 1);
  assert.equal(comp.verified, true);
  assert.deepEqual(comp.rating, { avg: null, count: 0 });
});

T("request a driver, he accepts; strict order; late cancel needs a reason; plate full only after assignment", async () => {
  const bad = await call("cust", "POST", "/requests/tow", { mode: "DRIVER", ...reqBody() });
  assert.equal(bad.status, 400); // driverId required
  const r = await call("cust", "POST", "/requests/tow", { mode: "DRIVER", driverId, ...reqBody() });
  assert.equal(r.status, 201, r.text);
  jobId = r.json.request.id;
  requests.push(jobId);
  const v = r.json.request;
  assert.equal(v.choiceMode, "DRIVER");
  assert.equal(v.driver.company.name, `Flow Test ${tag}`);
  assert.equal(v.driver.truck.plate, "•••• 99");
  assert.equal(v.contactPhone, undefined);
  assert.equal((await call("cust", "POST", "/requests/tow", { mode: "DRIVER", driverId, ...reqBody() })).status, 409); // already active with this company
  // not his job / wrong role
  assert.equal((await call("stranger", "GET", `/requests/tow/${jobId}`)).status, 404);
  assert.equal((await call("owner", "POST", `/driver/jobs/${jobId}/accept`)).status, 403);
  // order: nothing before accept
  assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/status`, { to: "EN_ROUTE" })).status, 409);
  assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/accept`)).status, 200);
  assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/accept`)).status, 409, "no double accept");
  const accepted = (await call("cust", "GET", `/requests/tow/${jobId}`)).json.request;
  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(accepted.driver.truck.plate, `${tag}-99`, "full plate after assignment");
  assert.equal(accepted.canChat, true);
  for (const to of ["ARRIVED", "LOADING", "IN_PROGRESS", "DELIVERED", "COMPLETED"]) assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/status`, { to })).status, 409, `${to} before on the way`);
  assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/status`, { to: "EN_ROUTE" })).status, 200);
  assert.equal((await call("cust", "GET", `/requests/tow/${jobId}`)).json.request.cancelWarning, true);
  // late cancel: reason required, then it works (a second request is used so the main flow continues)
  const c = await call("cust", "PATCH", `/requests/tow/${jobId}/cancel`, {});
  assert.equal(c.status, 400);
  assert.equal((await call("cust", "GET", `/requests/tow/${jobId}`)).json.request.status, "EN_ROUTE", "still on");
});

T("steps cannot be skipped or undone; chat; live location only for the assigned driver", async () => {
  const step = async (to: string) => (await call("drv", "POST", `/driver/jobs/${jobId}/status`, { to })).status;
  assert.equal(await step("LOADING"), 409);
  assert.equal(await step("IN_PROGRESS"), 409);
  assert.equal(await step("EN_ROUTE"), 409, "no going back");
  assert.equal(await step("ARRIVED"), 200);
  assert.equal(await step("ARRIVED"), 409);
  assert.equal(await step("IN_PROGRESS"), 409, "loading first");
  // chat: customer <-> driver, company reads, stranger cannot
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/messages`, { body: "I am at the red gate" })).status, 201);
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/messages`, { body: "   " })).status, 400);
  assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/messages`, { body: "On my way in" })).status, 201);
  const seen = (await call("drv", "GET", `/driver/jobs/${jobId}/messages`)).json;
  assert.equal(seen.messages.length, 2);
  assert.equal(seen.messages[0].mine, false);
  assert.equal((await call("owner", "GET", `/tow/me/requests/${jobId}/messages`)).json.messages.length, 2);
  assert.equal((await call("owner", "GET", `/tow/me/requests/${jobId}/messages`)).json.canPost, false);
  assert.equal((await call("stranger", "GET", `/requests/tow/${jobId}/messages`)).status, 404);
  assert.equal((await call("stranger", "POST", `/requests/tow/${jobId}/messages`, { body: "hi" })).status, 404);
  // location: the assigned driver only
  assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/location`, { lat: 32.2215, lng: 35.2549 })).status, 200);
  assert.equal((await call("drv", "POST", `/driver/jobs/${jobId}/location`, { lat: 0, lng: 0 })).status, 400);
  assert.equal((await call("owner", "POST", `/driver/jobs/${jobId}/location`, { lat: 32.22, lng: 35.25 })).status, 403);
  assert.equal((await call("cust", "POST", `/driver/jobs/${jobId}/location`, { lat: 32.22, lng: 35.25 })).status, 403);
  const live = (await call("cust", "GET", `/requests/tow/${jobId}`)).json.request.driver.live;
  assert.ok(live && Math.abs(live.lat - 32.2215) < 1e-6 && live.stale === false);
  assert.equal(await step("LOADING"), 200);
  assert.equal(await step("IN_PROGRESS"), 200);
  assert.equal((await call("cust", "PATCH", `/requests/tow/${jobId}/cancel`, { reason: "x" })).status, 409, "no cancel while towing");
  assert.equal(await step("COMPLETED"), 409, "delivered first");
  assert.equal(await step("DELIVERED"), 200);
  assert.equal((await call("cust", "GET", `/requests/tow/${jobId}`)).json.request.stage, "DELIVERED");
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/review`, { stars: 5 })).status, 409, "not completed yet");
  assert.equal(await step("COMPLETED"), 200);
});

T("after completion: summary, rate once, ratings update on driver card and company; report a problem", async () => {
  const done = (await call("cust", "GET", `/requests/tow/${jobId}`)).json.request;
  assert.equal(done.status, "COMPLETED");
  assert.equal(done.canReview, true);
  assert.equal(done.canChat, false);
  assert.ok(done.distanceKm > 0);
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/messages`, { body: "late" })).status, 409, "chat is closed");
  for (const stars of [0, 6, 2.5, "5"]) assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/review`, { stars })).status, 400);
  assert.equal((await call("stranger", "POST", `/requests/tow/${jobId}/review`, { stars: 5 })).status, 404);
  assert.equal((await call("owner", "POST", `/requests/tow/${jobId}/review`, { stars: 5 })).status, 403);
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/review`, { stars: 5, comment: "Fast and polite" })).status, 201);
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/review`, { stars: 1 })).status, 409, "once");
  const after = (await call("cust", "GET", `/requests/tow/${jobId}`)).json.request;
  assert.deepEqual(after.reviewed, { stars: 5, comment: "Fast and polite" });
  assert.equal(after.canReview, false);
  assert.deepEqual(after.driver.rating, { avg: 5, count: 1 });
  assert.equal(after.driver.completedTows, 1);
  assert.deepEqual(after.driver.company.rating, { avg: 5, count: 1 });
  const prof = (await call("cust", "GET", `/catalog/tow/companies/${companyId}`)).json.company;
  assert.deepEqual(prof.rating, { avg: 5, count: 1 });
  assert.equal(prof.reviews[0].comment, "Fast and polite");
  assert.equal(prof.verified, true);
  assert.equal(prof.driversCount, 1);
  assert.ok(!JSON.stringify(prof.reviews).includes("customerId"), "no reviewer identity");
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/report`, { body: "hey" })).status, 400);
  assert.equal((await call("stranger", "POST", `/requests/tow/${jobId}/report`, { body: "not mine at all" })).status, 404);
  assert.equal((await call("cust", "POST", `/requests/tow/${jobId}/report`, { body: "The driver was late by an hour" })).status, 201);
  assert.equal(await prisma.towReport.count({ where: { requestId: jobId } }), 1);
});

T("nearest available: the server picks the nearest FREE driver; needs a pickup point; late cancel works with a reason", async () => {
  assert.equal((await call("cust", "POST", "/requests/tow", { mode: "NEAREST", ...reqBody({ pickupLat: undefined, pickupLng: undefined }) })).status, 400);
  const r = await call("cust", "POST", "/requests/tow", { mode: "NEAREST", ...reqBody() });
  assert.equal(r.status, 201, r.text);
  const id = r.json.request.id;
  requests.push(id);
  assert.equal(r.json.request.choiceMode, "NEAREST");
  assert.equal(r.json.request.company.id, companyId, "our driver is at distance 0");
  assert.equal(r.json.request.driver.id, driverId);
  assert.equal((await call("drv", "POST", `/driver/jobs/${id}/accept`)).status, 200);
  assert.equal((await call("drv", "POST", `/driver/jobs/${id}/status`, { to: "EN_ROUTE" })).status, 200);
  assert.equal((await call("cust", "PATCH", `/requests/tow/${id}/cancel`, {})).status, 400, "reason needed once he is on the way");
  const c = await call("cust", "PATCH", `/requests/tow/${id}/cancel`, { reason: "Found another way" });
  assert.equal(c.status, 200, c.text);
  assert.equal(c.json.request.status, "CANCELLED");
  assert.equal((await call("drv", "GET", "/driver/me")).json.driver.status, "FREE", "driver and truck are free again");
});

T("a company request (no driver) shows the responsible company before any driver is assigned", async () => {
  await prisma.towDriver.update({ where: { id: driverId }, data: { offline: true } });
  const r = await call("cust", "POST", "/requests/tow", { mode: "COMPANY", companyId, ...reqBody() });
  assert.equal(r.status, 201, r.text);
  requests.push(r.json.request.id);
  assert.equal(r.json.request.driver, null);
  assert.equal(r.json.request.company.name, `Flow Test ${tag}`);
  assert.equal(r.json.request.company.verified, true);
  assert.equal((await call("cust", "PATCH", `/requests/tow/${r.json.request.id}/cancel`, {})).status, 200); // free before a driver is on the way
});

T("suspended driver can't be FREE or offered", async () => {
  await prisma.towDriver.update({ where: { id: driverId }, data: { offline: false } });
  assert.equal((await call("admin", "POST", `/admin/tow/drivers/${driverId}/review`, { decision: "SUSPEND", reason: "Complaint" })).status, 200);
  assert.equal((await call("drv", "GET", "/driver/me")).json.driver.status, "UNAPPROVED");
  const near = (await call("cust", "GET", `/catalog/tow/drivers?lat=${BASE.lat}&lng=${BASE.lng}`)).json.drivers;
  assert.ok(!near.some((d: any) => d.id === driverId));
  assert.equal((await call("cust", "POST", "/requests/tow", { mode: "DRIVER", driverId, ...reqBody() })).status, 404);
});
