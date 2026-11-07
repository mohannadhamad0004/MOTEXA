// Feature 2: shop accessory 3D lifecycle against the real database, with a fake provider (no network) and a stub renderer
// (the real renderer is exercised by scripts/accessory-fit-check.mjs and the body-kit test).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/prisma.js";
import { activeModels } from "../src/services/vehicle3d-catalog.js";
import { createMeshyClient } from "../src/services/meshy-client.js";
import { PRIVATE_3D_DIR } from "../src/services/vehicle3d-private-assets.js";
import { PUBLIC_ACCESSORY_DIR, createAccessory3DProcessor, createAccessory3DService, mockAccessoryGLB, modelRevision, mergeZones } from "../src/services/accessory3d.js";
after(() => prisma.$disconnect());
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const jpg = (c: string) => sharp({ create: { width: 48, height: 48, channels: 3, background: c } }).jpeg().toBuffer().then(b => b.toString("base64"));
const stubRender = async (a: { privateModelPath: string | null }, generationId: string) => ({ generationId, generationName: "Test", model3dKey: "test", modelRevision: modelRevision(a), views: {}, fit: null, renderedAt: new Date().toISOString() });

async function fixture(work: (f: { owner: string; admin: string; shopId: string; productId: string; gid: string; service: ReturnType<typeof createAccessory3DService>; due: (id: string) => Promise<void> }) => Promise<void>, category = "BODY") {
  const owner = randomUUID(), admin = randomUUID(), vid = randomUUID(), gid = randomUUID(), shopId = randomUUID(), productId = randomUUID();
  const privBefore = new Set(existsSync(PRIVATE_3D_DIR) ? readdirSync(PRIVATE_3D_DIR) : []), pubBefore = new Set(existsSync(PUBLIC_ACCESSORY_DIR) ? readdirSync(PUBLIC_ACCESSORY_DIR) : []);
  const old = { mode: process.env.VEHICLE3D_MODE, allow: process.env.MESHY_ALLOW_PAID_GENERATION, key: process.env.MESHY_API_KEY };
  try {
    for (const [id, role] of [[owner, "PARTS_PROVIDER"], [admin, "ADMIN"]] as const) await prisma.user.create({ data: { id, email: `${id}@acc-test.invalid`, fullName: "Accessory test", passwordHash: "no-login", role, status: "ACTIVE" } });
    await prisma.adminPermission.create({ data: { adminId: admin, permission: "MANAGE_SPARE_PARTS" } });
    await prisma.partsShopProfile.create({ data: { id: shopId, userId: owner, shopName: "Test kit shop", phone: "0", city: "Test", verificationStatus: "APPROVED" } });
    await prisma.partsProduct.create({ data: { id: productId, shopId, name: "Front bumper", brand: "Test", partNumber: "FB-1", partNumberNormalized: "FB1", price: 100, category } });
    await prisma.vehicleBrand.create({ data: { id: vid, name: vid, nameAr: vid, normalizedName: vid } });
    await prisma.vehicle.create({ data: { brandId: vid, id: vid, make: vid, model: "Test", makeAr: "Test", modelAr: "Test", makeNormalized: vid, modelNormalized: "test", yearFrom: 2000, yearTo: 2030 } });
    // shown with an existing 3D car so the worker renders a preview (stubbed) on it
    await prisma.vehicleGeneration.create({ data: { id: gid, vehicleId: vid, code: "T", nameEn: "T", nameAr: "T", yearFrom: 2000, yearTo: 2030, model3dKey: activeModels()[0]!.key, isPublished: true } });
    await work({ owner, admin, shopId, productId, gid, service: createAccessory3DService(), due: async id => { await prisma.productAccessory3D.update({ where: { id }, data: { nextPollAt: new Date(0) } }); } });
  } finally {
    for (const [k, v] of Object.entries({ VEHICLE3D_MODE: old.mode, MESHY_ALLOW_PAID_GENERATION: old.allow, MESHY_API_KEY: old.key })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    if (existsSync(PRIVATE_3D_DIR)) for (const p of readdirSync(PRIVATE_3D_DIR)) if (!privBefore.has(p)) unlinkSync(path.join(PRIVATE_3D_DIR, p));
    if (existsSync(PUBLIC_ACCESSORY_DIR)) for (const p of readdirSync(PUBLIC_ACCESSORY_DIR)) if (!pubBefore.has(p)) unlinkSync(path.join(PUBLIC_ACCESSORY_DIR, p));
    const acc = await prisma.productAccessory3D.findMany({ where: { productId }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: [owner, admin] } }, { targetId: { in: [shopId, ...acc.map(a => a.id)] } }] } });
    await prisma.partsProduct.deleteMany({ where: { id: productId } }); await prisma.partsShopProfile.deleteMany({ where: { id: shopId } });
    await prisma.vehicleGeneration.deleteMany({ where: { id: gid } }); await prisma.vehicle.deleteMany({ where: { id: vid } }); await prisma.vehicleBrand.deleteMany({ where: { id: vid } });
    await prisma.adminPermission.deleteMany({ where: { adminId: admin } }); await prisma.user.deleteMany({ where: { id: { in: [owner, admin] } } });
  }
}
async function submitted(f: Parameters<Parameters<typeof fixture>[0]>[0]) {
  await f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [f.gid], widthMm: 1780, installedGenerationId: f.gid });
  for (const c of ["red", "blue"]) await f.service.addPhoto(f.owner, f.productId, "PART", await jpg(c));
  await f.service.addPhoto(f.owner, f.productId, "INSTALLED", await jpg("green"));
  return f.service.submit(f.owner, f.productId, true);
}

test("shop input is validated: category, fits, size, photo counts, 360 set, consent", () => fixture(async f => {
  await assert.rejects(f.service.save(f.owner, f.productId, { accessoryType: "RIMS", fitsGenerationIds: [f.gid] }), /Wheels/);
  await assert.rejects(f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [randomUUID()] }), /not in the catalog/);
  await assert.rejects(f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [f.gid], widthMm: 5 }), /millimetres/);
  await f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [f.gid], installedGenerationId: f.gid, installed360: true });
  await assert.rejects(f.service.submit(f.owner, f.productId, true), (e: any) => e.code === "PART_PHOTOS_REQUIRED");
  for (const c of ["red", "blue"]) await f.service.addPhoto(f.owner, f.productId, "PART", await jpg(c));
  await f.service.addPhoto(f.owner, f.productId, "INSTALLED", await jpg("green"));
  await assert.rejects(f.service.submit(f.owner, f.productId, true), (e: any) => e.code === "SPIN_SET_TOO_SMALL");
  await f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [f.gid], installedGenerationId: f.gid });
  await assert.rejects(f.service.submit(f.owner, f.productId, true), (e: any) => e.code === "SIZE_REQUIRED");
  await f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [f.gid], installedGenerationId: f.gid, widthMm: 1780 });
  await assert.rejects(f.service.submit(f.owner, f.productId, false), (e: any) => e.code === "CONSENT_REQUIRED");
  assert.equal((await f.service.submit(f.owner, f.productId, true)).status, "PENDING_REVIEW");
  await assert.rejects(f.service.addPhoto(f.owner, f.productId, "PART", await jpg("white")), (e: any) => e.code === "ACCESSORY_LOCKED");
  await assert.rejects(f.service.get(randomUUID(), f.productId), (e: any) => e.status === 404);
}));

test("sizes are checked per part type, and submit lists every problem at once (a W203-style draft)", () => fixture(async f => {
  const save = (type: string, size: Record<string, unknown>) => f.service.save(f.owner, f.productId, { accessoryType: type, fitsGenerationIds: [f.gid], ...size });
  // a bumper's width must be 1200-2100 mm: 630 (a typo or the wrong field) is refused with the numbers, 1200 and 2100 are fine
  await assert.rejects(save("FRONT_BUMPER", { widthMm: 630 }), (e: any) => e.code === "INVALID_SIZE" && /front bumper's width must be 1200.2100 mm \(you entered 630\)/.test(e.message));
  await assert.rejects(save("FRONT_BUMPER", { widthMm: 2200 }), (e: any) => e.code === "INVALID_SIZE");
  await save("FRONT_BUMPER", { widthMm: 1200 });
  await save("FRONT_BUMPER", { widthMm: 2100 });
  await assert.rejects(save("FRONT_BUMPER", { widthMm: 2100.5 }), (e: any) => e.code === "INVALID_SIZE");
  await assert.rejects(save("SIDE_SKIRTS", { lengthMm: 500 }), (e: any) => /side skirt's length must be 1000.2800/.test(e.message));
  await assert.rejects(save("MIRROR_COVERS", { widthMm: 1500 }), (e: any) => e.code === "INVALID_SIZE");
  await save("MIRROR_COVERS", { widthMm: 200 });
  const got = await f.service.get(f.owner, f.productId);
  assert.deepEqual(got.sizeRanges.FRONT_BUMPER, { field: "widthMm", min: 1200, max: 2100 });
  assert.equal(got.productName, "Front bumper");
  // the draft of the bug report: one car chosen, installed car not set, no size, no photos, no consent
  await f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [f.gid], installed360: true });
  await assert.rejects(f.service.submit(f.owner, f.productId, false), (e: any) => {
    const fields = (e.issues as { code: string; field: string }[]).map(i => `${i.field}:${i.code}`);
    assert.deepEqual(fields, ["partPhotos:PART_PHOTOS_REQUIRED", "installedPhotos:INSTALLED_PHOTOS_REQUIRED", "installedGen:INSTALLED_GENERATION_REQUIRED", "size:SIZE_REQUIRED", "consent:CONSENT_REQUIRED"]);
    assert.match(e.message, /5 things need fixing/);
    return true;
  });
  // an old draft that already holds an impossible size (630) is listed too, not silently accepted
  const id = got.accessory?.id ?? (await f.service.get(f.owner, f.productId)).accessory!.id;
  await prisma.productAccessory3D.update({ where: { id }, data: { widthMm: 630, installedGenerationId: f.gid, installed360: false } });
  for (const c of ["red", "blue"]) await f.service.addPhoto(f.owner, f.productId, "PART", await jpg(c));
  await f.service.addPhoto(f.owner, f.productId, "INSTALLED", await jpg("green"));
  await assert.rejects(f.service.submit(f.owner, f.productId, true), (e: any) => e.code === "INVALID_SIZE" && e.issues.length === 1 && e.issues[0].field === "size");
  await prisma.productAccessory3D.update({ where: { id }, data: { widthMm: 1500 } });
  assert.equal((await f.service.submit(f.owner, f.productId, true)).status, "PENDING_REVIEW");
}));

test("the Parts Admin list shows EVERY submitted request (newest first, with shop, photo source and car) and the shop is told about every admin action", () => fixture(async f => {
  const mine = async () => (await f.service.adminList()).filter(x => x.productId === f.productId);
  assert.deepEqual(await mine(), [], "a draft is not a request yet");
  await submitted(f);
  const [row] = await mine();
  assert.equal(row.status, "PENDING_REVIEW");
  assert.equal(row.accessoryType, "FRONT_BUMPER");
  assert.equal(row.shopName, "Test kit shop");
  assert.equal(row.productName, "Front bumper");
  assert.ok(row.firstPartPhotoId, "the first loose-part photo is the thumbnail when the product has no photo");
  assert.deepEqual(row.cars.map(c => c.id), [f.gid]);
  assert.ok(row.submittedAt);
  // newest submission first across the whole list
  const all = await f.service.adminList();
  const times = all.map(x => (x.submittedAt ?? x.updatedAt).getTime());
  assert.deepEqual(times, [...times].sort((x, y) => y - x));
  assert.equal(all[0].id, row.id, "the request just submitted is the first row");
  const tell = async () => (await prisma.notification.findMany({ where: { userId: f.owner }, orderBy: { createdAt: "asc" } })).map(n => n.title.split("||")[0]);
  const id = row.id;
  await f.service.reject(f.admin, id, "The photos are blurry: retake them on a plain background.");
  assert.deepEqual(await tell(), ["Changes requested on your 3D request"]);
  const note = (await prisma.notification.findFirstOrThrow({ where: { userId: f.owner } })).body;
  assert.match(note, /Front bumper: The photos are blurry/);
  assert.match(note.split("||")[1], /The photos are blurry/);
  assert.match((await f.service.get(f.owner, f.productId)).accessory!.reviewNotes ?? "", /blurry/, "the message is on the shop's form too");
  assert.equal((await mine())[0].status, "REJECTED", "a rejected request stays in the list");
  // resubmit, approve, start (mock: no credits), each one tells the shop
  await f.service.submit(f.owner, f.productId, true);
  await f.service.approve(f.admin, id);
  process.env.VEHICLE3D_MODE = "mock";
  await f.service.start(f.admin, id, false);
  assert.deepEqual(await tell(), ["Changes requested on your 3D request", "Your 3D request was approved", "Your 3D model is being created"]);
  await f.service.setCredits(f.admin, f.shopId, 7);
  assert.equal((await tell()).at(-1), "Your monthly 3D allowance changed");
}));

test("mock generation reaches final review, shows the installed look only after approval, and can never be published", () => fixture(async f => {
  await submitted(f);
  assert.equal(await f.service.forProduct(f.productId).then(x => x!.installed), null);
  const id = (await f.service.get(f.owner, f.productId)).accessory!.id;
  await assert.rejects(f.service.start(f.admin, id, false), (e: any) => e.code === "REVIEW_CONFLICT");
  await f.service.approve(f.admin, id);
  assert.equal((await f.service.forProduct(f.productId))!.installed!.photoIds.length, 1);
  process.env.VEHICLE3D_MODE = "mock";
  const started = await f.service.start(f.admin, id, false); assert.equal(started.status, "GENERATING"); assert.equal(started.mock, true); assert.equal(started.creditsUsed, 0);
  assert.equal((await f.service.start(f.admin, id, false)).revision, 1, "a duplicate start is the same job");
  await createAccessory3DProcessor({ render: stubRender as never })(id);
  const ready = await f.service.adminGet(id); assert.equal(ready.status, "READY_FOR_FINAL_REVIEW", ready.failureReason ?? ""); assert.ok(ready.hasModel);
  await assert.rejects(f.service.publish(f.admin, id, { visuallyVerified: true, modelRevision: ready.modelRevision }), (e: any) => e.code === "MOCK_NOT_PUBLISHABLE");
  assert.equal((await f.service.forProduct(f.productId))!.model, null);
}));

test("real generation: explicit paid opt-in, one provider POST, restart-safe polling, monthly cap, exact-revision publish", () => fixture(async f => {
  await submitted(f); const id = (await f.service.get(f.owner, f.productId)).accessory!.id; await f.service.approve(f.admin, id);
  process.env.VEHICLE3D_MODE = "real"; delete process.env.MESHY_ALLOW_PAID_GENERATION; process.env.MESHY_API_KEY = "fake-never-sent";
  await assert.rejects(f.service.start(f.admin, id, true), (e: any) => e.code === "LIVE_OPT_IN_REQUIRED");
  process.env.MESHY_ALLOW_PAID_GENERATION = "1";
  await assert.rejects(f.service.start(f.admin, id, false), (e: any) => e.code === "PAID_CONFIRMATION_REQUIRED");
  await f.service.setCredits(f.admin, f.shopId, 1);
  let creates = 0, polls = 0; const task = "private-accessory-task", glb = await mockAccessoryGLB("FRONT_BUMPER");
  const client = createMeshyClient({ key: "fake", maxBytes: 8 * 1048576, fetcher: (async (url, o) => {
    if (o?.method === "POST") { creates++; assert.equal(JSON.parse(o.body as string).image_urls.length, 2); return json({ result: task }, 202); }
    if (String(url).startsWith("https://assets.meshy.ai/")) return new Response(glb);
    polls++; return json({ id: task, status: polls === 1 ? "IN_PROGRESS" : "SUCCEEDED", progress: polls === 1 ? 40 : 100, model_urls: polls === 1 ? {} : { glb: "https://assets.meshy.ai/p.glb?sig" } });
  }) as typeof fetch });
  const s = await f.service.start(f.admin, id, true); assert.equal(s.creditsUsed, 1);
  await createAccessory3DProcessor({ client, allowPaid: true, render: stubRender as never })(id); assert.equal(creates, 1);
  for (let i = 0; i < 2; i++) { await f.due(id); await createAccessory3DProcessor({ client, allowPaid: true, render: stubRender as never })(id); } // a new processor = a restart
  const ready = await f.service.adminGet(id); assert.equal(ready.status, "READY_FOR_FINAL_REVIEW", ready.failureReason ?? ""); assert.equal(creates, 1);
  assert.ok(!JSON.stringify(ready).includes(task)); assert.ok(!JSON.stringify(ready).includes("sig"));
  await assert.rejects(f.service.publish(f.admin, id, { visuallyVerified: false, modelRevision: ready.modelRevision }), (e: any) => e.code === "VISUAL_REVIEW_REQUIRED");
  await assert.rejects(f.service.publish(f.admin, id, { visuallyVerified: true, modelRevision: "stale" }), (e: any) => e.code === "STALE_VISUAL_REVIEW");
  const pub = await f.service.publish(f.admin, id, { visuallyVerified: true, modelRevision: ready.modelRevision });
  assert.equal(pub.status, "PUBLISHED"); const live = (await f.service.forProduct(f.productId))!.model!;
  assert.match(live.file, /^accessories\/acc-[a-f0-9]{16}\.glb$/); assert.ok(existsSync(path.join(PUBLIC_ACCESSORY_DIR, live.file.slice(12))));
  // the cap: a second paid start this month is refused
  await f.service.revise(f.owner, f.productId); await f.service.submit(f.owner, f.productId, true); await f.service.approve(f.admin, id);
  await assert.rejects(f.service.start(f.admin, id, true), (e: any) => e.code === "CREDIT_CAP_REACHED");
  assert.equal((await f.service.forProduct(f.productId))!.model, null, "a revised product stops serving its model");
}));

test("an unconfirmed paid request fails closed and is never re-sent", () => fixture(async f => {
  await submitted(f); const id = (await f.service.get(f.owner, f.productId)).accessory!.id; await f.service.approve(f.admin, id);
  process.env.VEHICLE3D_MODE = "real"; process.env.MESHY_ALLOW_PAID_GENERATION = "1"; process.env.MESHY_API_KEY = "fake";
  await f.service.start(f.admin, id, true);
  // a crash right after claiming: stage REQUESTING, no task id, lease expired
  await prisma.productAccessory3D.update({ where: { id }, data: { generationStage: "REQUESTING", leaseUntil: new Date(0) } });
  let creates = 0; const client = createMeshyClient({ key: "fake", maxBytes: 1024, fetcher: (async () => { creates++; return json({ result: "x" }, 202); }) as typeof fetch });
  await createAccessory3DProcessor({ client, allowPaid: true })(id);
  const a = await f.service.adminGet(id); assert.equal(creates, 0); assert.equal(a.status, "APPROVED_FOR_GENERATION"); assert.equal(a.generationErrorCode, "PROVIDER_REQUEST_UNCONFIRMED");
}));

test("tuned zones are validated, merged into the runtime catalog and reset; customer adjust is bounded", () => fixture(async f => {
  const key = (await f.service.zones())[0]!.key;
  const before = await prisma.accessoryFitZone.findUnique({ where: { model3dKey_accessoryType: { model3dKey: key, accessoryType: "REAR_BUMPER" } } });
  try {
    await assert.rejects(f.service.setZone(f.admin, key, "REAR_BUMPER", { box: { x: [0, 1], y: [1, 0], z: [0, 0.1] } }), (e: any) => e.code === "INVALID_ZONE");
    await assert.rejects(f.service.setZone(f.admin, "no-such-car", "REAR_BUMPER", { box: { x: [0, 1], y: [0, 0.4], z: [0, 0.1] } }), (e: any) => e.status === 404);
    await f.service.setZone(f.admin, key, "REAR_BUMPER", { box: { x: [0, 1], y: [0, 0.4], z: [0, 0.1] } });
    const merged = await mergeZones([{ key, zones: undefined }]); assert.deepEqual((merged[0]!.zones as any).REAR_BUMPER.box.y, [0, 0.4]);
    await f.service.setZone(f.admin, key, "REAR_BUMPER", null);
    assert.equal(await prisma.accessoryFitZone.count({ where: { model3dKey: key, accessoryType: "REAR_BUMPER" } }), 0);
    // replace zones: only add-ons that hide a stock part; nested replace and unknown keys are refused
    const replace = { box: { x: [0.16, 0.84], y: [0.735, 0.9], z: [0, 0.075] } };
    await assert.rejects(f.service.setZone(f.admin, key, "REAR_BUMPER", { box: { x: [0, 1], y: [0, 0.4], z: [0, 0.1] }, replace }), (e: any) => e.code === "INVALID_ZONE");
    await assert.rejects(f.service.setZone(f.admin, key, "SPOILER", { replace: { replace } }), (e: any) => e.code === "INVALID_ZONE");
    await assert.rejects(f.service.setZone(f.admin, key, "SPOILER", { replace: { box: replace.box, extra: 1 } }), (e: any) => e.code === "INVALID_ZONE");
    const spoilerBefore = await prisma.accessoryFitZone.findUnique({ where: { model3dKey_accessoryType: { model3dKey: key, accessoryType: "SPOILER" } } });
    try {
      assert.deepEqual(await f.service.setZone(f.admin, key, "SPOILER", { replace }), { replace });
      assert.deepEqual(((await mergeZones([{ key, zones: undefined }]))[0]!.zones as any).SPOILER.replace.box.z, [0, 0.075]);
    } finally { await prisma.accessoryFitZone.deleteMany({ where: { model3dKey: key, accessoryType: "SPOILER" } }); if (spoilerBefore) await prisma.accessoryFitZone.create({ data: spoilerBefore as never }); }
  } finally { if (before) await prisma.accessoryFitZone.create({ data: before as never }); }
  await assert.rejects(f.service.putAdjust(f.owner, f.productId, { x: 2, y: 0, z: 0, rx: 0, ry: 0, s: 1 }), (e: any) => e.code === "INVALID_ADJUST");
  await assert.rejects(f.service.putAdjust(f.owner, f.productId, { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1 }), (e: any) => e.status === 404, "only published accessories");
}));

test("a finished paid task that failed only on download is resumed from the same task: no second POST, no extra credit", () => fixture(async f => {
  await submitted(f); const id = (await f.service.get(f.owner, f.productId)).accessory!.id; await f.service.approve(f.admin, id);
  process.env.VEHICLE3D_MODE = "real"; process.env.MESHY_ALLOW_PAID_GENERATION = "1"; process.env.MESHY_API_KEY = "fake";
  let creates = 0, big = true; const glb = await mockAccessoryGLB("WING");
  const client = createMeshyClient({ key: "fake", maxBytes: 8 * 1048576, fetcher: (async (url, o) => {
    if (o?.method === "POST") { creates++; return json({ result: "task-1" }, 202); }
    if (String(url).startsWith("https://assets.meshy.ai/")) return new Response(big ? new Uint8Array(9 * 1048576) : glb);
    return json({ id: "task-1", status: "SUCCEEDED", progress: 100, model_urls: { glb: "https://assets.meshy.ai/w.glb" } });
  }) as typeof fetch });
  await f.service.start(f.admin, id, true);
  const run = async () => { await f.due(id); await createAccessory3DProcessor({ client, allowPaid: true, render: stubRender as never })(id); };
  await run(); await run();
  let a = await f.service.adminGet(id); assert.equal(a.generationErrorCode, "PROVIDER_ASSET_TOO_LARGE"); assert.equal(a.resumable, true);
  big = false; delete process.env.MESHY_ALLOW_PAID_GENERATION; process.env.VEHICLE3D_MODE = "mock"; // resume needs no paid switch
  const resumed = await f.service.start(f.admin, id, false); assert.equal(resumed.status, "GENERATING"); assert.equal(resumed.creditsUsed, 1); assert.equal(resumed.revision, 1);
  await run(); a = await f.service.adminGet(id);
  assert.equal(a.status, "READY_FOR_FINAL_REVIEW", a.failureReason ?? ""); assert.equal(creates, 1); assert.equal(a.creditsThisMonth, 1);
}));

test("body kits: front + rear bumper as two parts of one product; bumpers are car-specific; customer adjust per part", () => fixture(async f => {
  const kit = (part: "FRONT" | "REAR", type = part === "FRONT" ? "FRONT_BUMPER" : "REAR_BUMPER") => f.service.save(f.owner, f.productId, { accessoryType: type, fitsGenerationIds: [f.gid], widthMm: 1780, installedGenerationId: f.gid }, part);
  await assert.rejects(kit("FRONT", "REAR_BUMPER"), (e: any) => e.code === "KIT_PART_TYPE");
  await assert.rejects(f.service.save(f.owner, f.productId, { accessoryType: "FRONT_BUMPER", fitsGenerationIds: [] }, "FRONT"), (e: any) => e.code === "FITS_REQUIRED");
  const front = await kit("FRONT"), rear = await kit("REAR");
  assert.notEqual(front.id, rear.id); assert.equal(front.kitPart, "FRONT"); assert.equal(rear.kitPart, "REAR");
  assert.deepEqual((await f.service.get(f.owner, f.productId, "REAR")).parts.map(p => p.part).sort(), ["FRONT", "REAR"]);
  await assert.rejects(f.service.save(f.owner, f.productId, { accessoryType: "WING", fitsGenerationIds: [f.gid] }), (e: any) => e.code === "KIT_MIXED"); // a kit has no MAIN part
  // the DB itself refuses a kit part of the wrong type
  await assert.rejects(prisma.productAccessory3D.update({ where: { id: front.id }, data: { accessoryType: "WING" } }));
  // bumpers never on a universal product
  await prisma.partsProduct.update({ where: { id: f.productId }, data: { isUniversal: true } });
  await assert.rejects(kit("FRONT"), (e: any) => e.code === "BUMPER_NOT_UNIVERSAL");
  await prisma.partsProduct.update({ where: { id: f.productId }, data: { isUniversal: false } });
  // the customer sees both parts (not published yet: no models), and each one's Adjust is kept separately
  const view = await f.service.forProduct(f.productId, f.gid);
  assert.equal(view?.kit, true); assert.deepEqual(view?.parts.map(p => [p.part, p.type, p.model]), [["FRONT", "FRONT_BUMPER", null], ["REAR", "REAR_BUMPER", null]]);
  for (const id of [front.id, rear.id]) await prisma.productAccessory3D.update({ where: { id }, data: { status: "PUBLISHED" } });
  const cust = randomUUID(); await prisma.user.create({ data: { id: cust, email: `${cust}@acc-test.invalid`, fullName: "C", passwordHash: "no-login", role: "CUSTOMER", status: "ACTIVE" } });
  try {
    await f.service.putAdjust(cust, f.productId, { x: 0.01, y: 0, z: 0, rx: 0, ry: 0, s: 1 }, "FRONT");
    await f.service.putAdjust(cust, f.productId, { x: 0, y: -0.02, z: 0, rx: 0, ry: 0, s: 1 }, "REAR");
    assert.equal(((await f.service.getAdjust(cust, f.productId, "FRONT")) as any).x, 0.01);
    assert.equal(((await f.service.getAdjust(cust, f.productId, "REAR")) as any).y, -0.02);
    assert.equal(await f.service.getAdjust(cust, f.productId, "MAIN"), null);
  } finally { await prisma.accessoryFitAdjust.deleteMany({ where: { userId: cust } }); await prisma.user.delete({ where: { id: cust } }); }
}));

test("rims: optional specs validated and shown; Universal by size takes no generation list and is offered for any car", () => fixture(async f => {
  const rim = (extra: Record<string, unknown>) => f.service.save(f.owner, f.productId, { accessoryType: "RIMS", fitsGenerationIds: [f.gid], rimInches: 17, installedGenerationId: f.gid, ...extra });
  for (const bad of [{ rimPcd: "abc" }, { rimFinish: "GOLD" }, { rimWidthIn: 20 }, { rimOffsetMm: 1.5 }]) await assert.rejects(rim(bad), (e: any) => e.code === "INVALID_RIM", JSON.stringify(bad));
  const a = await rim({ rimWidthIn: 8, rimPcd: "5 × 112", rimOffsetMm: 35, rimFinish: "BLACK" });
  assert.deepEqual(a.rim, { inches: 17, widthIn: 8, pcd: "5x112", offsetMm: 35, finish: "BLACK" });
  assert.deepEqual((await rim({})).rim, { inches: 17, widthIn: null, pcd: null, offsetMm: null, finish: null }, "optional: cleared when left empty");
  await prisma.partsProduct.update({ where: { id: f.productId }, data: { isUniversal: true } });
  await assert.rejects(rim({}), (e: any) => e.code === "INVALID_FITS", "Universal by size has no generation list");
  await rim({ fitsGenerationIds: [], rimPcd: "5x112" });
  for (const c of ["red", "blue"]) await f.service.addPhoto(f.owner, f.productId, "PART", await jpg(c));
  await f.service.addPhoto(f.owner, f.productId, "INSTALLED", await jpg("green"));
  assert.equal((await f.service.submit(f.owner, f.productId, true)).status, "PENDING_REVIEW", "no generation list needed");
  const seen = await f.service.forProduct(f.productId, randomUUID()); // any car
  assert.equal(seen?.universal, true); assert.equal(seen?.parts[0]!.universal, true); assert.equal(seen?.rim?.pcd, "5x112");
}, "WHEELS"));

test("wheel inset: rims only, per axle, whole mm 0-40; merged into the runtime catalog", () => fixture(async f => {
  const key = activeModels()[0]!.key, before = (await f.service.zones()).find(m => m.key === key)?.zones.RIMS ?? null;
  try {
    for (const bad of [{ wheelInsetMm: { front: 41, rear: 0 } }, { wheelInsetMm: { front: 1.5, rear: 0 } }, { wheelInsetMm: { front: 1 } }, { wheelInsetMm: { front: 1, rear: 1, left: 2 } }])
      await assert.rejects(f.service.setZone(f.admin, key, "RIMS", bad), (e: any) => e.code === "INVALID_ZONE", JSON.stringify(bad));
    await assert.rejects(f.service.setZone(f.admin, key, "WING", { wheelInsetMm: { front: 5, rear: 5 } }), (e: any) => e.code === "INVALID_ZONE");
    assert.deepEqual(await f.service.setZone(f.admin, key, "RIMS", { wheelInsetMm: { front: 16, rear: 29 } }), { wheelInsetMm: { front: 16, rear: 29 } });
    assert.deepEqual((await f.service.zones()).find(m => m.key === key)?.zones.RIMS, { wheelInsetMm: { front: 16, rear: 29 } });
  } finally { await f.service.setZone(f.admin, key, "RIMS", before as never); }
}));
