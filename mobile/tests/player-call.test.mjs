// A released expo-video player rejects every call; safePlayerCall ignores exactly that error and nothing else.
import assert from "node:assert/strict";
import { test } from "node:test";
import { safePlayerCall } from "../src/core/hooks/usePlayerCall.ts";

test("player calls ignore an already released player and keep every other error", () => {
  const releasedError = new Error("Call to function 'VideoPlayer.pause' has been rejected.\n→ Caused by: Cannot use shared object that was already released");
  assert.equal(safePlayerCall(() => { throw releasedError; }), undefined);
  assert.equal(safePlayerCall(() => 42), 42);
  assert.throws(() => safePlayerCall(() => { throw new Error("network down"); }), /network down/);
});
