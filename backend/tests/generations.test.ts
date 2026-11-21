import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generationsForYear, genKey, listMake, parseTsv, parseYears, sketchfabUid } from "../src/generations.js";

test("years: plain, present, and the odd forms (best guess, marked inexact)", () => {
  assert.deepEqual(parseYears("1993–2000"), { from: 1993, to: 2000, exact: true });
  assert.deepEqual(parseYears("2018–present", 2026), { from: 2018, to: 2027, exact: true });
  assert.deepEqual(parseYears("1998–2004/08"), { from: 1998, to: 2008, exact: false });
  assert.deepEqual(parseYears("1997–2004+"), { from: 1997, to: 2004, exact: false });
  assert.deepEqual(parseYears("2017+ select markets", 2026), { from: 2017, to: 2027, exact: false });
  assert.equal(parseYears("soon"), null);
  assert.equal(parseYears("2005–2001"), null);
});

const gens = parseTsv(readFileSync(new URL("../../docs/3d/generations-master.tsv", import.meta.url), "utf8"))
  .filter((r) => r.make === "Skoda" && r.model === "Octavia")
  .map((r) => ({ code: r.code, yearFrom: parseYears(r.years, 2026)!.from, yearTo: parseYears(r.years, 2026)!.to }));

test("year -> generation: one match, an overlap gives both (newest first), outside the list gives none", () => {
  const codes = (y: number) => generationsForYear(gens, y).map((g) => g.code);
  assert.deepEqual(codes(1999), ["Mk1 / 1U"]);
  assert.deepEqual(codes(2005), ["Mk2 / 1Z", "Mk1 / 1U"]); // Mk1 sold on beside Mk2: the customer picks
  assert.deepEqual(codes(2012), ["Mk3 / 5E", "Mk2 / 1Z"]);
  assert.deepEqual(codes(2016), ["Mk3 / 5E"]);
  assert.deepEqual(codes(1980), []);
});

test("names, keys and Sketchfab ids", () => {
  assert.equal(listMake("Mercedes-Benz"), "Mercedes");
  assert.equal(listMake("SEAT"), "Seat");
  assert.equal(genKey("Toyota", "Corolla", "E170/E180"), "toyota-corolla-e170-e180");
  assert.equal(genKey("Mercedes-Benz", "C-Class", "W202"), "mercedes-c-class-w202");
  assert.equal(sketchfabUid("https://sketchfab.com/3d-models/toyota-corolla-2020-6d7d34ee42734d1ab28a6b1f1c5fc4fc"), "6d7d34ee42734d1ab28a6b1f1c5fc4fc");
  assert.equal(sketchfabUid("https://sketchfab.com/models/05e62ce036554a7eb5cd97b3d2fe0158/embed"), null);
  assert.equal(sketchfabUid("https://sketchfab.com/3d-models/x-8bfcbf50d13b47d98d77bdfdbd68b31"), null); // 31 chars: truncated
});
