import {activeModels} from "../src/services/vehicle3d-catalog.js";
// Real PostgreSQL + HTTP route integration. All fixtures and mutations are rolled back, never seeded into accounts.
// Run with tsx --test tests/garage.test.ts (or compile this entry with tsc if tsx cannot start on the host).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import { prisma } from "../src/prisma.js";
import { createGarageService, MAX_GARAGE_CARS } from "../src/services/garage.js";
import { createGarageRouter } from "../src/routes/garage.routes.js";

after(() => prisma.$disconnect());
const migration = readFileSync("prisma/migrations/20261103180000_customer_garage/migration.sql", "utf8");
const backfill = migration.slice(migration.indexOf('INSERT INTO "CustomerGarageCar"'), migration.indexOf("\nCOMMIT;"));
const orphanGuard = migration.slice(migration.indexOf("DO $$"), migration.indexOf("END $$;") + "END $$;".length);

test("garage migration contains no destructive SQL", () => assert.doesNotMatch(migration, /\b(DROP|RENAME)\b/i));

test("garage writers wait for the per-user lock before inspecting or modifying cars", async t => {
  // No data writes: hold an existing user's row, then attempt a missing-car update in another transaction.
  const user = await prisma.user.findFirst({ where: { role: "CUSTOMER" }, select: { id: true } });
  if (!user) { t.skip("No existing customer available for two-connection lock test"); return; }
  let release!: () => void, locked!: () => void, started!: () => void;
  const released = new Promise<void>(r => { release = r; });
  const ready = new Promise<void>(r => { locked = r; });
  const running = new Promise<void>(r => { started = r; });
  const holder = prisma.$transaction(async tx => { await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`; locked(); await released; });
  await ready;
  let settled = false;
  const service = createGarageService(work => prisma.$transaction(async tx => { started(); return work(tx); }));
  const waiting = service.update(user.id, randomUUID(), {}).then(() => { settled = true; throw new Error("Missing car unexpectedly updated"); }, error => { settled = true; assert.equal(error.code, "GARAGE_CAR_NOT_FOUND"); });
  try { await running; await new Promise(r => setTimeout(r, 100)); assert.equal(settled, false); }
  finally { release(); await holder; await waiting; }
  assert.equal(settled, true);
});

test("garage HTTP and database behavior (rollback-only fixtures)", async t => {
  const rollback = new Error("intentional test rollback");
  try {
    await prisma.$transaction(async tx => {
      const user = async () => tx.user.create({ data: { email: `${randomUUID()}@garage-test.invalid`, fullName: "Garage transaction fixture", passwordHash: "not-a-login-hash", role: "CUSTOMER", status: "ACTIVE" } });
      const a = await user(), b = await user(), legacy = await user();
      const key = randomUUID();
      const brand=await tx.vehicleBrand.create({data:{name:key,nameAr:key,normalizedName:key}});
      const approvedKey=activeModels()[0]!.key;
      const vehicle = await tx.vehicle.create({ data: {brandId:brand.id, make: key, model: "Test", makeAr: key, modelAr: "Test", makeNormalized: key, modelNormalized: "test", yearFrom: 2000, yearTo: 2030 } });
      const gen = await tx.vehicleGeneration.create({ data: {isPublished:true,model3dKey:approvedKey, vehicleId: vehicle.id, code: "A", nameEn: "A", nameAr: "A", yearFrom: 2000, yearTo: 2010 } });
      const otherVehicle = await tx.vehicle.create({ data: {brandId:brand.id, make: key, model: "Other", makeAr: key, modelAr: "Other", makeNormalized: key, modelNormalized: "other", yearFrom: 2000, yearTo: 2030 } });
      const foreignGen = await tx.vehicleGeneration.create({ data: {isPublished:true,model3dKey:approvedKey, vehicleId: otherVehicle.id, code: "B", nameEn: "B", nameAr: "B", yearFrom: 2000, yearTo: 2010 } });
      const input = { make: key, model: "Test", year: 2005, color: "#AbC123", generationId: gen.id };
      const service = createGarageService(work => work(tx));
      const app = express();
      // Authentication identity injected only in this test harness; production catalog runs requireAuth first.
      app.use((req, res, next) => { res.locals.authUser = { id: req.headers["x-test-user"] ?? a.id, role: req.headers["x-test-role"] ?? "CUSTOMER" }; next(); });
      app.use("/api/catalog", createGarageRouter(service));
      const server = app.listen(0, "127.0.0.1");
      await new Promise<void>(resolve => server.once("listening", resolve));
      const port = (server.address() as { port: number }).port;
      const call = async (method: string, path: string, data?: unknown, uid = a.id, role = "CUSTOMER") => {
        const res = await fetch(`http://127.0.0.1:${port}/api/catalog${path}`, { method, headers: { "Content-Type": "application/json", "x-test-user": uid, "x-test-role": role }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
        return { status: res.status, ...await res.json() as any };
      };
      const list = async () => (await call("GET", "/garage")).cars as any[];
      let first = "", second = "", third = "";
      try {
        await t.test("backfill preserves all legacy fields and makes one active; repeated INSERT is harmless", async () => {
          const c = await tx.customerCar.create({ data: { userId: legacy.id, ...input } });
          await tx.$executeRawUnsafe(backfill);
          await tx.$executeRawUnsafe(backfill);
          const cars = await service.list(legacy.id);
          assert.equal(cars.length, 1); assert.equal(cars[0]!.isActive, true);
          for (const field of ["make", "model", "year", "color", "generationId"] as const) assert.equal(cars[0]![field], c[field]);
          assert.ok(await tx.customerCar.findUnique({ where: { userId: legacy.id } }));
        });
        await t.test("first car becomes active", async () => { const r = await call("POST", "/garage", input); assert.equal(r.status, 201); assert.equal(r.car.isActive, true); first = r.car.id; });
        await t.test("applied migration refuses orphan generations without changing legacy data", async () => {
          const orphan = await user();
          const orphanId = randomUUID();
          const before = await tx.customerCar.create({ data: { userId: orphan.id, ...input, generationId: orphanId } });
          await tx.$executeRawUnsafe("SAVEPOINT garage_orphan_test");
          try { await assert.rejects(tx.$executeRawUnsafe(orphanGuard), /legacy generation IDs need repair/); }
          finally { await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT garage_orphan_test"); }
          assert.deepEqual(await tx.customerCar.findUnique({ where: { userId: orphan.id } }), before);
          assert.deepEqual(await service.list(orphan.id), []);
        });
        await t.test("second car does not replace first", async () => { const r = await call("POST", "/garage", input); second = r.car.id; assert.equal(r.car.isActive, false); assert.equal((await list())[0].id, first); });
        await t.test("third car and many cars owned by same user", async () => { third = (await call("POST", "/garage", input)).car.id; assert.equal((await list()).length, 3); });
        await t.test("activate another car, exactly one active, selection persists in GET", async () => { assert.equal((await call("POST", `/garage/${second}/activate`)).status, 200); const cars = await list(); assert.equal(cars[0].id, second); assert.equal(cars.filter(c => c.isActive).length, 1); assert.ok(cars[0].lastSelectedAt); });
        await t.test("update one car leaves another unchanged", async () => { const before = (await list()).find(c => c.id === second); await call("PATCH", `/garage/${first}`, { nickname: " Daily ", color: "#112233" }); assert.equal((await list()).find(c => c.id === first).nickname, "Daily"); assert.deepEqual((await list()).find(c => c.id === second), before); });
        await t.test("PATCH omitted generation preserves selected generation and explicit Not sure", async () => {
          assert.equal((await call("PATCH", `/garage/${first}`, { nickname: "Selected" })).car.generationId, gen.id);
          assert.equal((await call("PATCH", `/garage/${first}`, { generationId: null })).car.generationId, null);
          assert.equal((await call("PATCH", `/garage/${first}`, { nickname: "Not sure" })).car.generationId, null);
          assert.equal((await list()).find(c => c.id === first).generation, null);
          await call("PATCH", `/garage/${first}`, { generationId: gen.id });
        });
        await t.test("POST explicit Not sure stays null even for a unique generation", async () => {
          const r = await call("POST", "/garage", { ...input, generationId: null }, b.id);
          assert.equal(r.status, 201); assert.equal(r.car.generationId, null);
          assert.equal((await call("GET", "/my-car", undefined, b.id)).car.generation, null);
          await call("DELETE", `/garage/${r.car.id}`, undefined, b.id);
        });
        await t.test("other customer cannot read/update/delete/activate a car", async () => { assert.deepEqual((await call("GET", "/garage", undefined, b.id)).cars, []); for (const [method, path, data] of [["PATCH", `/garage/${first}`, { nickname: "stolen" }], ["DELETE", `/garage/${first}`, undefined], ["POST", `/garage/${first}/activate`, undefined]] as const) assert.equal((await call(method, path, data, b.id)).status, 404); assert.equal((await call("GET", "/my-car", undefined, b.id)).car, null); });
        await t.test("non-customer is rejected", async () => { assert.equal((await call("GET", "/garage", undefined, b.id, "TOW_COMPANY")).status, 403); });
        await t.test("invalid generation rejected", async () => { assert.equal((await call("POST", "/garage", { ...input, generationId: randomUUID() })).status, 400); });
        await t.test("generation from another model rejected", async () => { assert.equal((await call("POST", "/garage", { ...input, generationId: foreignGen.id })).status, 400); });
        await t.test("generation outside selected year rejected", async () => { assert.equal((await call("POST", "/garage", { ...input, year: 2020 })).status, 400); });
        await t.test("PATCH cannot retain incompatible generation or change ownership/active", async () => { for (const data of [{ year: 2020 }, { model: "Other" }, { userId: b.id }, { isActive: true }]) assert.equal((await call("PATCH", `/garage/${first}`, data)).status, 400); });
        await t.test("Not sure stays null; omitted generation selects unique match", async () => { await call("PATCH", `/garage/${first}`, { year: 2005, generationId: null }); assert.equal((await list()).find(c => c.id === first).generation, null); const r = await call("PUT", "/my-car", { make: key, model: "Test", year: 2005 }); assert.equal(r.car.generation.id, gen.id); await call("PUT", "/my-car", { ...input, generationId: null }); assert.equal((await call("GET", "/my-car")).car.generation, null); });
        await t.test("overlapping generations stay unselected without confirmation", async () => {
          await tx.vehicleGeneration.create({ data: {isPublished:true,model3dKey:approvedKey, vehicleId: vehicle.id, code: "overlap", nameEn: "Overlap", nameAr: "Overlap", yearFrom: 2005, yearTo: 2007 } });
          const r = await call("PUT", "/my-car", { make: key, model: "Test", year: 2005 });
          assert.equal(r.car.generation, null);
        });
        await t.test("nickname, color, year and unknown model validation", async () => { for (const data of [{ ...input, nickname: "x".repeat(41) }, { ...input, nickname: 123 }, { ...input, color: "blue" }, { ...input, year: 1900 }, { ...input, model: "missing" }]) assert.equal((await call("POST", "/garage", data)).status, 400); });
        await t.test("ten cars allowed; eleventh returns stable error", async () => { while ((await list()).length < MAX_GARAGE_CARS) assert.equal((await call("POST", "/garage", input)).status, 201); const r = await call("POST", "/garage", input); assert.equal(r.status, 409); assert.equal(r.code, "GARAGE_LIMIT_REACHED"); assert.equal((await list()).length, MAX_GARAGE_CARS); });
        await t.test("GET my-car is active car with old mobile shape", async () => { const c = (await call("GET", "/my-car")).car; assert.deepEqual(Object.keys(c).sort(), ["make", "model", "year", "color", "bodyType", "generation"].sort()); assert.equal(c.make, key); });
        await t.test("PUT my-car updates only active even at limit", async () => { const before = (await list()).filter(c => !c.isActive); const r = await call("PUT", "/my-car", { ...input, color: "#998877" }); assert.equal(r.status, 200); assert.equal(r.car.color, "#998877"); assert.deepEqual((await list()).filter(c => !c.isActive), before); });
        await t.test("delete inactive preserves active", async () => { await call("DELETE", `/garage/${third}`); assert.equal((await list())[0].id, second); });
        await t.test("delete active promotes most recently selected", async () => { await call("POST", `/garage/${first}/activate`); await call("POST", `/garage/${second}/activate`); await call("DELETE", `/garage/${second}`); assert.equal((await list())[0].id, first); });
        await t.test("DELETE my-car removes only active and returns replacement", async () => { const before = await list(); const r = await call("DELETE", "/my-car"); assert.equal((await list()).length, before.length - 1); assert.ok(!(await list()).some(c => c.id === first)); assert.deepEqual(r.car, (await call("GET", "/my-car")).car); });
        await t.test("delete last leaves empty and no active", async () => { for (const c of await list()) await call("DELETE", `/garage/${c.id}`); assert.deepEqual(await list(), []); assert.equal((await call("GET", "/my-car")).car, null); });
        await t.test("PUT my-car on empty creates one active; repeated PUT no duplicate", async () => { await call("PUT", "/my-car", input); await call("PUT", "/my-car", input); const cars = await list(); assert.equal(cars.length, 1); assert.equal(cars[0].isActive, true); });
        await t.test("all garage mutations create audit records", async () => { assert.ok(await tx.auditLog.count({ where: { actorId: a.id, action: "GARAGE_CREATE" } })); assert.ok(await tx.auditLog.count({ where: { actorId: a.id, action: "GARAGE_ACTIVATE" } })); });
        await t.test("partial unique index rejects second active at database level", async () => {
          await tx.$executeRawUnsafe("SAVEPOINT garage_unique_test");
          try { await assert.rejects(tx.customerGarageCar.create({ data: { userId: a.id, ...input, isActive: true } })); }
          finally { await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT garage_unique_test"); }
        });
      } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
});
