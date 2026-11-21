import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PARTS_PHOTOS, PARTS_ASSET_DIR, seedPartsPhoto, storeSeedPhoto } from "../src/seed/parts-photos.js";

const target = { ...PARTS_PHOTOS[0], productId: "legacy-product-id", ownerUserId: "provider-id" };
// In-memory upload-signature fixture only; never written to tracked assets or runtime storage.
const jpeg = () => { const b = Buffer.alloc(2048, 7); b.set([0xff, 0xd8, 0xff]); return b; };
function fixture() {
  const state = { row: null as Record<string, unknown> | null, audits: 0, reads: 0, stores: 0,
    bytes: jpeg(), missing: false, race: false, failAudit: false, files: new Map<string, Buffer>() };
  const db = {
    providerFile: { findFirst: async () => state.row },
    $transaction: async (callback: (tx: unknown) => Promise<void>) => {
      const before = state.row;
      try {
        await callback({
          providerFile: { create: async ({ data }: { data: Record<string, unknown> }) => {
            if (state.race) {
              state.row = { originalName: "real-provider-upload.jpg" };
              throw Object.assign(new Error("unique"), { code: "P2002" });
            }
            state.row = data;
          } },
          auditLog: { create: async () => {
            if (state.failAudit) throw new Error("audit failure");
            state.audits++;
          } },
        });
      } catch (error) { if (!state.race) state.row = before; throw error; }
    },
  } as unknown as Parameters<typeof seedPartsPhoto>[0];
  const io = {
    read: async () => {
      state.reads++;
      if (state.missing) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return state.bytes;
    },
    store: async (key: string, bytes: Buffer) => { state.stores++; state.files.set(key, bytes); },
  };
  return { state, run: (t = target) => seedPartsPhoto(db, t, io) };
}

test("five exact mappings, including Bosch's original stable key; source resolves to tracked directory", () => {
  assert.equal(PARTS_PHOTOS.length, 5);
  assert.equal(PARTS_PHOTOS[1].seedKey, "1987479107");
  assert.equal(PARTS_PHOTOS[1].filename, "bosch_1987479106_dot4_500ml.jpg");
  assert.equal(PARTS_ASSET_DIR.replaceAll("\\", "/").replace(/\/$/, ""),
    path.resolve("src/seed/assets/parts").replaceAll("\\", "/"));
});
test("missing and unmapped assets do not create rows, files or audit records", async () => {
  const { state, run } = fixture(); state.missing = true;
  assert.equal(await run(), "missing");
  assert.equal(await run({ ...target, email: "unmapped" as typeof target.email }), "unmapped");
  assert.equal(state.row, null); assert.equal(state.stores, 0); assert.equal(state.audits, 0);
});
test("installation uses actual resolved product ID and public metadata; rerun is a no-op", async () => {
  const { state, run } = fixture();
  assert.equal(await run(), "installed");
  assert.equal(state.row?.productId, target.productId);
  assert.equal(state.row?.purpose, "PRODUCT_IMAGE"); assert.equal(state.row?.visibility, "PUBLIC");
  assert.equal(state.row?.sizeBytes, 2048); assert.match(String(state.row?.sha256), /^[a-f0-9]{64}$/);
  assert.equal(await run(), "preserved");
  assert.equal(state.files.size, 1); assert.equal(state.stores, 1); assert.equal(state.audits, 1);
});
test("changed source never replaces even a previously installed seed image", async () => {
  const { state, run } = fixture(); await run(); const row = state.row;
  state.bytes = jpeg(); state.bytes[100] = 99;
  assert.equal(await run(), "preserved"); assert.equal(state.row, row); assert.equal(state.reads, 1);
});
test("all existing uploads are preserved without reading sources (provider, admin and tiny legacy)", async () => {
  for (const ownerUserId of ["provider-id", "admin-id", "legacy-id"]) {
    const { state, run } = fixture();
    const row = { ownerUserId, sizeBytes: 100, visibility: "PRIVATE", storageKey: "real.jpg" };
    state.row = row;
    assert.equal(await run(), "preserved"); assert.equal(state.row, row);
    assert.equal(state.reads, 0); assert.equal(state.stores, 0);
  }
});
test("invalid or undersized present source fails before any write", async () => {
  for (const bytes of [Buffer.alloc(2048), jpeg().subarray(0, 100)]) {
    const { state, run } = fixture(); state.bytes = bytes;
    await assert.rejects(run()); assert.equal(state.row, null); assert.equal(state.stores, 0);
  }
});
test("concurrent upload winning the unique row is preserved without writing seed bytes", async () => {
  const { state, run } = fixture(); state.race = true;
  assert.equal(await run(), "preserved"); assert.equal(state.stores, 0);
  assert.equal(state.row?.originalName, "real-provider-upload.jpg");
});
test("failed transaction rolls back row; retry reuses the same content-addressed runtime key", async () => {
  const { state, run } = fixture(); state.failAudit = true;
  await assert.rejects(run(), /audit failure/); assert.equal(state.row, null);
  assert.equal(state.files.size, 1); const key = [...state.files.keys()][0];
  state.failAudit = false; assert.equal(await run(), "installed");
  assert.equal(state.files.size, 1); assert.equal(state.row?.storageKey, key);
});
test("exclusive disk writer reuses identical bytes and preserves conflicting bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "motexa-photo-storage-test-"));
  try {
    await storeSeedPhoto("fixture.bin", Buffer.from("original"), directory);
    await storeSeedPhoto("fixture.bin", Buffer.from("original"), directory);
    await assert.rejects(storeSeedPhoto("fixture.bin", Buffer.from("changed"), directory), /storage conflict/);
    assert.equal((await readFile(path.join(directory, "fixture.bin"))).toString(), "original");
  } finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith("motexa-photo-storage-test-"));
    await rm(directory, { recursive: true, force: true });
  }
});
