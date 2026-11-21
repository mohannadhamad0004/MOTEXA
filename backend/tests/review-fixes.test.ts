// CODEX-REVIEW group 4, over HTTP against the dev backend on :5000 (skipped when it is not running) + the dev DB.
// Uses the seeded accounts; every row it creates is removed at the end.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/prisma.js";

const API = process.env.API_URL || "http://127.0.0.1:5000/api";
const PASS = "Motexa-Dev-1234!";
let up = false;
const tok: Record<string, string> = {};
let customerId = "", companyId = "";
const requests: string[] = [];

const call = async (who: string, method: string, path: string, body?: unknown) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", authorization: "Bearer " + tok[who] }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
};
const login = async (email: string) => (await (await fetch(API + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASS }) })).json()).accessToken as string;
const mk = (status: string, extra: object = {}) =>
  prisma.towRequest.create({ data: { customerId, companyId, status: status as never, pickupAddress: "Test pickup", dropoffAddress: "Test garage", contactPhone: "0599000000", vehicleMake: "Toyota", vehicleModel: "Corolla", pickupLat: 32.22, pickupLng: 35.26, ...extra } }).then((r) => (requests.push(r.id), r));

before(async () => {
  try { up = (await fetch(API + "/health")).ok; } catch { up = false; }
  const c = await prisma.user.findUnique({ where: { email: "customer@motexa.test" } });
  const co = await prisma.towCompanyProfile.findFirst({ where: { verificationStatus: "APPROVED" } });
  if (!c || !co) { up = false; return; }
  customerId = c.id; companyId = co.id;
  if (up) { tok.cust = await login("customer@motexa.test"); tok.shop = await login("shop@motexa.test"); }
});
after(async () => { await prisma.towRequest.deleteMany({ where: { id: { in: requests } } }); await prisma.$disconnect(); });

test("#19 a second active request for the same customer + company is refused by the database", async (t) => {
  if (!customerId) return t.skip("no seed data");
  await prisma.towRequest.deleteMany({ where: { customerId, companyId, status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] } } });
  await mk("REQUESTED");
  await assert.rejects(mk("ACCEPTED"), (e: any) => e.code === "P2002");
  await mk("COMPLETED"); // finished ones are not limited
  await mk("CANCELLED");
});

test("#12 no customer cancel once loading started", async (t) => {
  if (!up) return t.skip("backend not running");
  await prisma.towRequest.deleteMany({ where: { customerId, companyId, status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] } } });
  const r = await mk("EN_ROUTE", { enRouteAt: new Date(), arrivedAt: new Date(), loadingAt: new Date() });
  const seen = await call("cust", "GET", `/requests/tow/${r.id}`);
  assert.equal(seen.json.request.canCancel, false);
  const cancel = await call("cust", "PATCH", `/requests/tow/${r.id}/cancel`, { reason: "changed my mind" });
  assert.equal(cancel.status, 409);
  assert.equal(cancel.json.errorCode, "CANCEL_NOT_ALLOWED");
  await prisma.towRequest.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
});

test("#13 driver endpoints need a driver role", async (t) => {
  if (!up) return t.skip("backend not running");
  for (const [m, p] of [["GET", "/driver/me"], ["GET", "/driver/jobs/x/messages"]] as const) {
    const r = await call("cust", m, p);
    assert.equal(r.status, 403, p);
  }
});

test("#15 customer distances are whole km", async (t) => {
  if (!up) return t.skip("backend not running");
  const r = await call("cust", "GET", "/catalog/tow/companies?lat=32.2211&lng=35.2544");
  assert.equal(r.status, 200);
  const km = r.json.companies.map((c: any) => c.distanceKm).filter((x: unknown) => typeof x === "number");
  assert.ok(km.length > 0);
  for (const k of km) assert.ok(Number.isInteger(k), String(k));
});

test("#17 stock cannot go below what accepted orders reserved", async (t) => {
  if (!up) return t.skip("backend not running");
  const shop = await prisma.partsShopProfile.findFirst({ where: { user: { email: "shop@motexa.test" } }, include: { products: { take: 1 } } });
  const p = shop?.products[0];
  if (!p) return t.skip("no product");
  const before = { stock: p.stock, reservedStock: p.reservedStock };
  try {
    await prisma.partsProduct.update({ where: { id: p.id }, data: { stock: 5, reservedStock: 3 } });
    const low = await call("shop", "PATCH", `/parts/me/products/${p.id}`, { stock: 2 });
    assert.equal(low.status, 409);
    assert.match(low.json.message, /reserved/);
    const ok = await call("shop", "PATCH", `/parts/me/products/${p.id}`, { stock: 3 });
    assert.equal(ok.status, 200);
  } finally {
    await prisma.partsProduct.update({ where: { id: p.id }, data: before });
  }
});

test("#21 super admins are tow-admin recipients", async () => {
  const { adminIds } = await import("../src/services/provider-onboarding.js");
  const ids = await adminIds("TOW");
  const sup = await prisma.user.findUnique({ where: { email: "superadmin@motexa.test" } });
  if (sup) assert.ok(ids.includes(sup.id));
});
