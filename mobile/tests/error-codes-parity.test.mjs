// Every backend error code has an English + Arabic text in the app (and the app has no code the backend never sends).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ERROR_TEXT } from "../src/core/session/errorText.ts";

test("backend error codes and app texts match", () => {
  const src = readFileSync("../backend/src/services/error-codes.ts", "utf8");
  const codes = [...src.matchAll(/\["([A-Z_]+)", "/g)].map((m) => m[1]);
  assert.ok(codes.length >= 20, "at least the 20 most common messages are coded");
  assert.deepEqual([...codes].sort(), Object.keys(ERROR_TEXT).sort());
});
