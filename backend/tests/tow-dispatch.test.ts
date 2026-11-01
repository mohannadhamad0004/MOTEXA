// Tow dispatch against the dev database, on a temporary company of its own (owner, two trucks, two driver logins) so the demo
// data never changes the results. Everything it creates is deleted at the end.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/prisma.js";
import { assign, checkRequestedDriver, driverAccept, driverDecline, driverMove, driverPing, driverStatus, routeNewRequest } from "../src/services/tow-dispatch.js";

const tag = `t${Date.now()}`;
const users: string[] = [];
let customerId = "";
let ownerId = "";
let companyId = "";
const drv: Record<"a" | "b", { id: string; userId: string; truckId: string }> = {} as never;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 0;
  } catch (e: any) {
    return e.code ?? -1;
  }
};
const newRequest = async (driverId: string | null = null) => {
  const r = await prisma.towRequest.create({
    data: { customerId, companyId, pickupAddress: "Test pickup", dropoffAddress: "Test garage", contactPhone: "0599000000", vehicleMake: "Toyota", vehicleModel: "Corolla", pickupLat: 32.22, pickupLng: 35.26, ...(driverId ? { driverId, requestedDriverId: driverId } : {}) },
  });
  await routeNewRequest(r.id);
  return prisma.towRequest.findUniqueOrThrow({ where: { id: r.id } });
};
const status = async (key: "a" | "b") => driverStatus(prisma, (await prisma.towDriver.findUniqueOrThrow({ where: { id: drv[key].id } })));
const truckState = async (key: "a" | "b") => (await prisma.truck.findUniqueOrThrow({ where: { id: drv[key].truckId } })).operationalStatus;
const finishAll = () => prisma.towRequest.updateMany({ where: { companyId, status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
const freeTrucks = () => prisma.truck.updateMany({ where: { companyId }, data: { operationalStatus: "AVAILABLE" } });

before(async () => {
  customerId = (await prisma.user.findUniqueOrThrow({ where: { email: "customer@motexa.test" } })).id;
  const owner = await prisma.user.create({ data: { email: `${tag}.owner@motexa.test`, fullName: "Test Tow Owner", role: "TOW_PROVIDER", status: "ACTIVE", passwordHash: "x" } });
  ownerId = owner.id;
  users.push(owner.id);
  companyId = (await prisma.towCompanyProfile.create({ data: { userId: owner.id, companyName: `Dispatch Test ${tag}`, phone: "0599111111", city: "Nablus", verificationStatus: "APPROVED" } })).id;
  for (const key of ["a", "b"] as const) {
    const u = await prisma.user.create({ data: { email: `${tag}.${key}@motexa.test`, fullName: `Driver ${key.toUpperCase()} Test`, role: "TOW_DRIVER", status: "ACTIVE", passwordHash: "x" } });
    users.push(u.id);
    const t = await prisma.truck.create({ data: { companyId, plateNumber: `${tag}-${key}`, make: "Isuzu", model: "NPR", truckType: "FLATBED", verificationStatus: "APPROVED", operationalStatus: "AVAILABLE" } });
    const d = await prisma.towDriver.create({ data: { userId: u.id, companyId, truckId: t.id, phone: "0599222222" } });
    drv[key] = { id: d.id, userId: u.id, truckId: t.id };
  }
});

after(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: [...users, customerId] }, createdAt: { gte: new Date(Number(tag.slice(1))) } } });
  const reqs = await prisma.towRequest.findMany({ where: { companyId }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { targetId: { in: [...reqs.map((r) => r.id), drv.a?.id, drv.b?.id].filter(Boolean) as string[] } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } }); // cascades: company, trucks, drivers, requests
  await prisma.$disconnect();
});

test("assignment: two free drivers -> the company assigns; one free driver -> auto-assigned", async () => {
  const r1 = await newRequest();
  assert.equal(r1.driverId, null);
  await assign(ownerId, r1.id, drv.b.id);
  assert.equal((await prisma.towRequest.findUniqueOrThrow({ where: { id: r1.id } })).driverId, drv.b.id);
  await finishAll();
  await prisma.towDriver.update({ where: { id: drv.b.id }, data: { offline: true } });
  assert.equal(await status("b"), "OFFLINE");
  const r2 = await newRequest();
  assert.equal(r2.driverId, drv.a.id); // the only FREE driver
  await finishAll();
  await prisma.towDriver.update({ where: { id: drv.b.id }, data: { offline: false } });
});

test("a specific driver: only a FREE one; the job goes straight to him", async () => {
  await prisma.towDriver.update({ where: { id: drv.b.id }, data: { offline: true } });
  assert.equal(await code(prisma.$transaction((tx) => checkRequestedDriver(tx, companyId, drv.b.id))), 409);
  await prisma.towDriver.update({ where: { id: drv.b.id }, data: { offline: false } });
  const r = await newRequest(drv.b.id);
  assert.equal(r.driverId, drv.b.id);
  assert.equal(r.requestedDriverId, drv.b.id);
  await finishAll();
});

test("transitions and permissions: only the assigned driver moves the job, in order; truck BUSY then released", async () => {
  const r = await newRequest(drv.a.id);
  assert.equal(await code(driverAccept(drv.b.userId, r.id)), 404); // another driver
  assert.equal(await code(driverMove(drv.a.userId, r.id, "EN_ROUTE")), 409); // not accepted yet
  await driverAccept(drv.a.userId, r.id);
  assert.equal(await truckState("a"), "BUSY");
  assert.equal(await status("a"), "BUSY");
  assert.equal(await code(driverMove(drv.a.userId, r.id, "IN_PROGRESS")), 409); // must be on the way first
  await driverMove(drv.a.userId, r.id, "EN_ROUTE");
  await driverPing(drv.a.userId, r.id, 32.2, 35.25);
  assert.equal((await prisma.towDriver.findUniqueOrThrow({ where: { id: drv.a.id } })).lastLat, 32.2);
  await driverMove(drv.a.userId, r.id, "ARRIVED");
  assert.equal(await code(driverMove(drv.a.userId, r.id, "ARRIVED")), 409); // once
  await driverMove(drv.a.userId, r.id, "IN_PROGRESS");
  await driverMove(drv.a.userId, r.id, "COMPLETED");
  assert.equal(await truckState("a"), "AVAILABLE");
  assert.equal(await status("a"), "FREE");
  assert.equal(await code(driverPing(drv.a.userId, r.id, 32.2, 35.25)), 409); // no location after the job
});

test("reassign before the start: an accepted job goes back to waiting and frees the old truck; decline returns it to the company", async () => {
  await freeTrucks();
  const r = await newRequest(drv.a.id);
  await driverAccept(drv.a.userId, r.id);
  await assign(ownerId, r.id, drv.b.id);
  const moved = await prisma.towRequest.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(moved.status, "REQUESTED");
  assert.equal(moved.driverId, drv.b.id);
  assert.equal(await truckState("a"), "AVAILABLE");
  assert.equal(await code(driverDecline(drv.b.userId, r.id, "")), 400); // reason required
  await driverDecline(drv.b.userId, r.id, "Too far");
  assert.equal((await prisma.towRequest.findUniqueOrThrow({ where: { id: r.id } })).driverId, null);
  await driverAccept(drv.b.userId, r.id).then(
    () => assert.fail("a declined job is no longer his"),
    (e) => assert.equal(e.code, 404)
  );
  await finishAll();
});

test("the company can't reassign once the driver is on the way", async () => {
  await freeTrucks();
  const r = await newRequest(drv.a.id);
  await driverAccept(drv.a.userId, r.id);
  await driverMove(drv.a.userId, r.id, "EN_ROUTE");
  assert.equal(await code(assign(ownerId, r.id, drv.b.id)), 409);
  await finishAll();
});
