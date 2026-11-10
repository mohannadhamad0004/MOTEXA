import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ERROR_CODES, errorBody, errorCodeOf } from "../src/services/error-codes.ts";

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return n === "generated" ? [] : statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith("error-codes.ts") ? [p] : []; });
const source = walk("src").map((f) => readFileSync(f, "utf8")).join("\n");

test("every coded message still exists in the source (a reworded message cannot lose its code silently)", () => {
  for (const [code, prefix] of ERROR_CODES) assert.ok(source.includes(prefix), `${code}: "${prefix}" no longer appears in src`);
});
test("codes are unique and matched by the start of the message", () => {
  assert.equal(new Set(ERROR_CODES.map(([c]) => c)).size, ERROR_CODES.length);
  assert.equal(errorCodeOf("Not enough stock of Brake pad to accept this order."), "NOT_ENOUGH_STOCK");
  assert.equal(errorCodeOf("This driver is not free right now."), "DRIVER_NOT_FREE");
  assert.equal(errorCodeOf("Something nobody coded"), undefined);
});
test("error bodies carry errorCode only when known, and keep extras", () => {
  assert.deepEqual(errorBody("The order changed meanwhile. Refresh and try again."), { success: false, message: "The order changed meanwhile. Refresh and try again.", errorCode: "ORDER_CHANGED" });
  assert.deepEqual(errorBody("Odd", { existingRequestId: "x" }), { success: false, message: "Odd", existingRequestId: "x" });
});
